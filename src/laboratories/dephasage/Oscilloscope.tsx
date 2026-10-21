import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Button, NumericInput, SelectControl, Toggle } from '../../shared/lab-ui';
import { createSignalSampler, derive, sample } from '../../physics/model';
import type { LabParameters } from '../../physics/model';
import './oscilloscope.css';

export interface OscilloscopeProps {
  parameters: LabParameters;
  time: number;
  running: boolean;
  disabled?: boolean;
  onTimeChange: (time: number) => void;
}

const BASES = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];
const SENSITIVITIES = [0.1, 0.2, 0.5, 1, 2];
const number = (value: number, digits = 3) => (Math.abs(value) < 1e-12 ? 0 : value).toLocaleString('fr-FR', { maximumFractionDigits: digits });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The stabilized acquisition is anchored to a rising CH1 zero, not to another clock. */
export function scopeWindow(parameters: LabParameters, time: number, millisecondsPerDivision: number, stabilized: boolean) {
  const { period, omega } = derive(parameters);
  const duration = millisecondsPerDivision * 10 / 1000;
  const risingZero = -parameters.initialPhase / omega;
  const start = stabilized
    ? risingZero + Math.floor((time - risingZero) / period + 1e-10) * period
    : Math.floor(time / duration) * duration;
  return { start, duration, relativeTime: clamp(time - start, 0, duration) };
}

export function Oscilloscope({ parameters, time, running, disabled = false, onTimeChange }: OscilloscopeProps) {
  const [base, setBase] = useState(0.2);
  const [vertical, setVertical] = useState(0.5);
  const [stabilized, setStabilized] = useState(true);
  const [show1, setShow1] = useState(true);
  const [show2, setShow2] = useState(true);
  const [cursor1, setCursor1] = useState(0.2);
  const [cursor2, setCursor2] = useState(0.7);
  const [width, setWidth] = useState(900);
  const [heldWindow, setHeldWindow] = useState<{start:number;duration:number} | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const scrubStart = useRef<number | null>(null);
  const drag = useRef<{ kind: 'time' | 'measure1' | 'measure2'; start: number; duration: number } | null>(null);
  const id = useId().replaceAll(':', '');
  const clipId = `${id}-scope-clip`;
  const arrowId = `${id}-scope-arrow`;
  const m = derive(parameters);
  const computedWindow = scopeWindow(parameters, time, base, stabilized);
  const win = heldWindow ? {...heldWindow,relativeTime:clamp(time-heldWindow.start,0,heldWindow.duration)} : computedWindow;
  const compact = width < 500;
  const height = compact ? 340 : 370;
  const left = compact ? 46 : 58, right = width - 20, top = 49, bottom = height - 76;
  const mid = (top + bottom) / 2, plotWidth = right - left, plotHeight = bottom - top;
  const X = (t: number) => left + (t - win.start) / win.duration * plotWidth;
  const Y = (voltage: number) => mid - voltage / vertical * plotHeight / 8;
  const value = sample(parameters, time);
  const timeVisible = time >= win.start - 1e-10 && time <= win.start + win.duration + 1e-10;
  const cursorX = timeVisible ? X(time) : left;
  const delayOutside = m.delay > win.duration + 1e-12;
  const clipped = Math.max(show1 ? m.A1 : 0, show2 ? m.A2 : 0) > vertical * 4 + 1e-12;

  useEffect(() => {
    const element = holder.current;
    if (!element || disabled) return;
    const resize = () => setWidth(Math.max(280, element.getBoundingClientRect().width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => { observer.disconnect(); drag.current = null; };
  }, [disabled]);

  useEffect(() => {
    const cancelGesture = () => { drag.current = null; scrubStart.current = null; setHeldWindow(null); };
    if (disabled) { cancelGesture(); return; }
    const visibility = () => { if (document.hidden) cancelGesture(); };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [disabled]);

  const traces = useMemo(() => {
    const steps = Math.max(400, Math.ceil(parameters.frequency * win.duration * 48));
    const at = createSignalSampler(parameters);
    let ch1 = '', ch2 = '';
    for (let i = 0; i <= steps; i++) {
      const t = win.start + win.duration * i / steps;
      const sampleValue = at(t);
      const x = left + i / steps * plotWidth;
      const prefix = i === 0 ? 'M' : 'L';
      ch1 += `${prefix}${x.toFixed(2)},${(mid - sampleValue.y1 / vertical * plotHeight / 8).toFixed(2)}`;
      ch2 += `${prefix}${x.toFixed(2)},${(mid - sampleValue.y2 / vertical * plotHeight / 8).toFixed(2)}`;
    }
    return { ch1, ch2, steps };
  }, [parameters, win.start, win.duration, left, plotWidth, mid, vertical, plotHeight]);

  function point(event: PointerEvent<SVGElement>) {
    const element = event.currentTarget.ownerSVGElement ?? event.currentTarget as SVGSVGElement;
    const matrix = element.getScreenCTM();
    if (!matrix) return 0;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
  }
  function begin(event: PointerEvent<SVGElement>, kind: 'time' | 'measure1' | 'measure2') {
    if (disabled || (kind === 'time' && running)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind, start: win.start, duration: win.duration };
    if (kind === 'time') setHeldWindow({start:win.start,duration:win.duration});
  }
  function move(event: PointerEvent<SVGElement>) {
    const current = drag.current;
    if (!current || disabled) return;
    const ratio = clamp((point(event) - left) / plotWidth, 0, 1 - 1e-10);
    if (current.kind === 'time') onTimeChange(Math.max(0, current.start + ratio * current.duration));
    else if (current.kind === 'measure1') setCursor1(ratio);
    else setCursor2(ratio);
  }
  function end(event: PointerEvent<SVGElement>) {
    drag.current = null; setHeldWindow(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function adjustBase() {
    const required = (m.delay + m.period * 1.25) * 1000 / 10;
    setBase(BASES.find(candidate => candidate >= required - 1e-10) ?? BASES.at(-1)!);
  }

  // A CH1 maximum at phase π/2 is paired with its delayed CH2 maximum.
  const firstMaximum = Math.ceil((win.start + parameters.initialPhase / m.omega - m.period / 4) / m.period - 1e-10) * m.period + m.period / 4 - parameters.initialPhase / m.omega;
  const secondMaximum = firstMaximum + m.delay;
  const periodVisible = firstMaximum + m.period <= win.start + win.duration + 1e-12;
  const maximumPairVisible = secondMaximum <= win.start + win.duration + 1e-12;
  const scrubMax = win.duration * 1000;
  const relativeMs = win.relativeTime * 1000;
  const waveformCount = parameters.frequency * win.duration;
  const dense = waveformCount > plotWidth / 12;
  function reduceBase() {
    const maxBase = plotWidth / (12 * parameters.frequency) * 1000 / 10;
    setBase([...BASES].reverse().find(candidate=>candidate <= maxBase) ?? BASES[0]);
  }
  function holdScrub() {
    scrubStart.current = win.start;
    setHeldWindow({start:win.start,duration:win.duration});
    if (running) onTimeChange(time);
  }
  function releaseScrub() {scrubStart.current=null;setHeldWindow(null);}

  return <div className="dp-oscilloscope" data-testid="oscilloscope" data-sample-y1={value.y1} data-sample-y2={value.y2}>
    <fieldset className="dp-scope-controls" disabled={disabled}>
      <SelectControl label="Base de temps" value={String(base)} options={BASES.map(item => ({ id: String(item), label: `${number(item)} ms/div` }))} onChange={v => setBase(Number(v))}/>
      <SelectControl label="Sensibilité commune" value={String(vertical)} options={SENSITIVITIES.map(item => ({ id: String(item), label: `${number(item)} V/div` }))} onChange={v => setVertical(Number(v))}/>
      <Toggle label="Acquisition stabilisée sur CH1" checked={stabilized} onChange={setStabilized}/>
    </fieldset>
    <div className="dp-scope-legend">
      <fieldset disabled={disabled}><span className="dp-channel1"><Toggle label="CH1 / M1" checked={show1} onChange={setShow1}/></span><span className="dp-channel2"><Toggle label="CH2 / M2" checked={show2} onChange={setShow2}/></span></fieldset>
      <span>{stabilized ? 'Déclenchement : zéro montant de CH1' : 'Acquisition libre par fenêtres'}</span>
    </div>
    <div className="dp-scope-graph" ref={holder}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Oscilloscope : tensions CH1 en bleu et CH2 en rouge, ${number(base)} milliseconde par division et ${number(vertical)} volt par division. Les amplitudes relatives sont conservées.`}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={plotWidth} height={plotHeight}/></clipPath><marker id={arrowId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="currentColor" strokeWidth="1.5"/></marker></defs>
        <rect className="dp-scope-background" x={left} y={top} width={plotWidth} height={plotHeight}/>
        {Array.from({length:11}, (_, i) => {
          const x = left + plotWidth * i / 10;
          return <g key={`x${i}`}><line className="dp-scope-grid" x1={x} x2={x} y1={top} y2={bottom}/>{(!compact || i % 2 === 0) && <text className="dp-scope-tick" x={x} y={bottom + 20} textAnchor="middle">{number(base * i)}</text>}</g>;
        })}
        {Array.from({length:9}, (_, i) => {
          const y = top + plotHeight * i / 8;
          return <g key={`y${i}`}><line className={i===4 ? 'dp-scope-axis' : 'dp-scope-grid'} x1={left} x2={right} y1={y} y2={y}/>{(!compact || i % 2 === 0) && <text className="dp-scope-tick" x={left - 8} y={y + 4} textAnchor="end">{number((4 - i) * vertical)}</text>}</g>;
        })}
        <text x={left} y={top-14} className="dp-scope-unit">Tension (V)</text>
        <text x={right} y={bottom+39} textAnchor="end" className="dp-scope-unit">{stabilized ? 'Temps depuis le déclenchement (ms)' : 'Temps depuis le début de fenêtre (ms)'}</text>
        <g clipPath={`url(#${clipId})`}>
          {show1 && <path className="dp-scope-trace dp-trace1" d={traces.ch1} data-testid="trace-ch1"/>}
          {show2 && <path className="dp-scope-trace dp-trace2" d={traces.ch2} data-testid="trace-ch2"/>}
          {timeVisible && <line x1={cursorX} x2={cursorX} y1={top} y2={bottom} className="dp-time-cursor"/>}
          {show1 && timeVisible && <circle cx={cursorX} cy={Y(value.y1)} r={5} className="dp-sample1"/>}
          {show2 && timeVisible && <circle cx={cursorX} cy={Y(value.y2)} r={5} className="dp-sample2"/>}
        </g>
        {show1 && periodVisible && <g className="dp-scope-dimension"><line x1={X(firstMaximum)} x2={X(firstMaximum + m.period)} y1={bottom+57} y2={bottom+57} markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`}/><text x={X(firstMaximum+m.period/2)} y={bottom+73} textAnchor="middle">T = {number(m.period*1000)} ms</text></g>}
        {show1 && show2 && maximumPairVisible && m.delay > 1e-12 && <g className="dp-scope-dimension"><line x1={X(firstMaximum)} x2={X(firstMaximum)} y1={top-3} y2={top+16} className="dp-scope-guide"/><line x1={X(secondMaximum)} x2={X(secondMaximum)} y1={top-3} y2={top+16} className="dp-scope-guide"/><line x1={X(firstMaximum)} x2={X(secondMaximum)} y1={top+5} y2={top+5} markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`}/><text x={(X(firstMaximum)+X(secondMaximum))/2} y={top-30} textAnchor="middle">Δt total = {number(m.delay*1000)} ms</text></g>}
        {[cursor1,cursor2].map((ratio, i) => {
          const x = left + ratio * plotWidth;
          return <g key={i}><line x1={x} x2={x} y1={top+25} y2={bottom} className="dp-measure-line"/><rect x={x-8} y={top+15} width={16} height={17} rx={4} className="dp-measure-label"/><text x={x} y={top+27} textAnchor="middle" className="dp-measure-number">{i+1}</text><rect x={x-17} y={top+10} width={34} height={plotHeight-7} className="dp-scope-drag" onPointerDown={e=>begin(e,i===0?'measure1':'measure2')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/></g>;
        })}
        {timeVisible && <g onPointerDown={e=>begin(e,'time')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className={running || disabled ? '' : 'dp-time-handle'}>
          <path d={`M${cursorX-6},${bottom+4}L${cursorX+6},${bottom+4}L${cursorX},${bottom-4}Z`} className="dp-scope-triangle"/>
          <rect x={cursorX-19} y={bottom-10} width={38} height={36} fill="transparent"/>
        </g>}
      </svg>
    </div>
    <div className="dp-scope-instant"><label htmlFor={`${id}-time`}>Instant commun</label><input id={`${id}-time`} aria-label="Curseur temporel commun" type="range" min={0} max={scrubMax} step={scrubMax/1000} value={relativeMs} disabled={disabled} onBlur={releaseScrub} onPointerDown={holdScrub} onPointerUp={releaseScrub} onPointerCancel={releaseScrub} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)&&!heldWindow)holdScrub();}} onChange={event=>onTimeChange(Math.max(0,(scrubStart.current??win.start)+Number(event.target.value)/1000))}/><span>{number(time*1000,4)} ms</span></div>
    <div className="dp-scope-measures">
      <span>Intervalle mesuré : <strong>{number(Math.abs(cursor2-cursor1)*win.duration*1000)} ms</strong></span>
      <label>C1 <span className="lk-number-unit"><NumericInput label="Curseur de mesure 1 en pourcentage" value={cursor1*100} min={0} max={100} step={1} onChange={v=>setCursor1(v/100)} disabled={disabled}/><span>%</span></span></label>
      <label>C2 <span className="lk-number-unit"><NumericInput label="Curseur de mesure 2 en pourcentage" value={cursor2*100} min={0} max={100} step={1} onChange={v=>setCursor2(v/100)} disabled={disabled}/><span>%</span></span></label>
    </div>
    {!maximumPairVisible && <div className="dp-scope-warning"><span>{delayOutside ? `Le retard total (${number(m.delay*1000)} ms) dépasse la fenêtre de ${number(win.duration*1000)} ms.` : 'La fenêtre ne contient pas les deux maxima correspondant au retard total.'}</span><Button onClick={adjustBase} disabled={disabled}>Ajuster la base de temps</Button></div>}
    {!timeVisible && <div className="dp-scope-warning"><span>L’instant commun est hors de cette courte fenêtre déclenchée sur CH1. Agrandissez la base de temps pour voir son curseur.</span><Button onClick={adjustBase} disabled={disabled}>Agrandir la fenêtre</Button></div>}
    {dense && <div className="dp-scope-warning"><span>Les cycles sont trop serrés pour une lecture fiable à cette largeur. Réduisez la fenêtre pour distinguer les oscillations.</span><Button onClick={reduceBase} disabled={disabled}>Réduire la base de temps</Button></div>}
    {clipped && <div className="dp-scope-warning">Une voie dépasse l’écran. Augmentez la sensibilité en V/div ; les amplitudes restent calculées sans normalisation.</div>}
    <p className="dp-scope-note">{stabilized ? 'Tracé stabilisé sur CH1 ; le point mobile indique l’instant partagé avec les cercles.' : 'Le tracé avance par fenêtres de temps, avec la même horloge que les cercles.'} En pause, glissez le triangle pour parcourir le temps. Les curseurs gris mesurent un intervalle libre.</p>
    <p className="dp-scope-note">Deux sinusoïdes seules donnent le retard à un multiple entier de T près. Ici, le retard total est {parameters.mode==='microphones' ? 'calculé à partir de Δx/c' : 'un décalage mathématique calculé à partir de δ/ω, sans distance imposée'}. Les repères Δt relient des maxima correspondants du modèle, pas deux maxima choisis arbitrairement.</p>
    <div className="dp-scope-sampling">{number(waveformCount,2)} périodes affichées · tensions instantanées : <span className="dp-channel1">{number(value.y1,3)} V</span> / <span className="dp-channel2">{number(value.y2,3)} V</span></div>
  </div>;
}

export default Oscilloscope;
