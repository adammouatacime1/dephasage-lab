import { useId, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { derive, formatNumber, sample, TAU, type LabParameters } from '../../physics/model';
import './scenes.css';

const BLUE = '#218dba';
const RED = '#d4515e';
const clamp = (n: number, min = 0, max = 2) => Math.min(max, Math.max(min, n));
const degrees = (n: number) => ((n % TAU + TAU) % TAU) * 180 / Math.PI;

export interface ApparatusProps {
  parameters: LabParameters;
  time: number;
  onDistanceChange: (metres: number) => void;
  disabled?: boolean;
}

/** The rails separate the drawings, not the longitudinal coordinates of the model. */
export function Apparatus({ parameters, time, onDistanceChange, disabled = false }: ApparatusProps) {
  const id = useId().replace(/:/g, '');
  const first = sample(parameters, time);
  const model = derive(parameters);
  const currentPointer = useRef<number | null>(null);
  const left = 285, right = 850, rulerY = 258;
  const x2 = left + parameters.distance / 2 * (right - left);
  const position = (event: PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const inverse = svg?.getScreenCTM()?.inverse();
    if (!svg || !inverse) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    const rulerLeft = Number(svg.dataset.rulerLeft ?? left), rulerRight = Number(svg.dataset.rulerRight ?? right);
    onDistanceChange(Math.round(clamp((point.x - rulerLeft) / (rulerRight - rulerLeft) * 2) * 10000) / 10000);
  };
  const down = (event: PointerEvent<SVGGElement>) => {
    if (disabled) return;
    event.preventDefault(); currentPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGGElement>) => {
    if (disabled || currentPointer.current !== event.pointerId) return;
    event.preventDefault(); position(event);
  };
  const up = (event: PointerEvent<SVGGElement>) => {
    if (currentPointer.current !== event.pointerId) return;
    currentPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboard = (event: KeyboardEvent<SVGGElement>) => {
    if (disabled) return;
    let next = parameters.distance;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += event.shiftKey ? .01 : .001;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= event.shiftKey ? .01 : .001;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 2;
    else return;
    event.preventDefault(); onDistanceChange(Math.round(clamp(next) * 10000) / 10000);
  };
  const mic = (x: number, y: number, label: string, color: string, voltage: number, mobile = false, compact = false) => <g
    className={`dp-microphone ${mobile ? 'dp-movable' : ''}`}
    transform={`translate(${x},${y})`}
    {...(mobile ? {
      role: 'slider', tabIndex: disabled ? -1 : 0, 'aria-label': 'Position longitudinale du microphone M2',
      'aria-valuemin': 0, 'aria-valuemax': 200, 'aria-valuenow': Number((parameters.distance * 100).toFixed(2)),
      'aria-valuetext': `${formatNumber(parameters.distance * 100, 2)} centimètres de M1`, 'aria-disabled': disabled,
      onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onKeyDown: keyboard,
    } : {})}
    style={{ color }}
  >
    <rect className="dp-mic-hit" x="-25" y="-45" width="50" height="100" rx="12"/>
    <path d="M-13-24H13V5Q13 18 0 18Q-13 18-13 5Z" className="dp-mic-body"/>
    <path d="M-8-16H8M-8-11H8M-8-6H8M-8-1H8" className="dp-mic-grille"/>
    <path d="M-20 0V5Q-20 25 0 25Q20 25 20 5V0M0 25V46M-20 46H20" className="dp-mic-stand"/>
    <circle cy="-25" r="3" fill={color}/>
    <text x={mobile ? (x > (compact ? 500 : 780) ? -29 : 29) : 0} y={mobile ? -6 : -54} className="dp-mic-label" textAnchor={mobile ? (x > (compact ? 500 : 780) ? 'end' : 'start') : 'middle'}>{label}{mobile && <tspan className="dp-mic-drag-label"> ↔</tspan>}</text>
    <text x={mobile ? (x > (compact ? 500 : 780) ? -29 : 29) : 0} y={mobile ? 14 : -35} className="dp-voltage" textAnchor={mobile ? (x > (compact ? 500 : 780) ? 'end' : 'start') : 'middle'}>{formatNumber(voltage, 3)} V</text>
  </g>;

  return <div className="dp-apparatus">
    <div className="dp-scene-caption"><span className="dp-channel dp-channel-one">CH1 / M1 · fixe</span><span className="dp-channel dp-channel-two">CH2 / M2 · mobile</span><span>Son établi · propagation vers +x</span></div>
    <svg className="dp-apparatus-svg dp-apparatus-desktop" data-ruler-left={left} data-ruler-right={right} viewBox="0 0 900 340" role="group" aria-label={`Montage : GBF, haut-parleur et microphones. M1 est fixe ; M2 est à ${formatNumber(parameters.distance * 100, 2)} cm de M1.`}>
      <defs>
        <marker id={`${id}-dimension`} viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="5" refY="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" className="dp-arrow-head"/></marker>
      </defs>
      <path d="M180 34H384" className="dp-propagation-arrow" markerEnd={`url(#${id}-dimension)`}/>
      <text x="276" y="22" textAnchor="middle" className="dp-diagram-label">Propagation du son →</text>
      <g transform="translate(25,108)">
        <rect width="110" height="72" rx="9" className="dp-gbf"/>
        <rect x="12" y="12" width="61" height="32" rx="4" className="dp-gbf-screen"/>
        <path d="M18 28Q24 10 30 28T42 28T54 28T66 28" className="dp-gbf-wave"/>
        <circle cx="91" cy="27" r="8" className="dp-gbf-dial"/>
        <circle cx="91" cy="53" r="3" className="dp-terminal"/>
        <text x="16" y="62" className="dp-device-name">GBF</text>
        <text x="55" y="97" textAnchor="middle" className="dp-diagram-label">{formatNumber(parameters.frequency, 0)} Hz</text>
      </g>
      <path d="M116 161H151V176H170V142H184" className="dp-electrical-wire"/>
      <text x="138" y="216" textAnchor="middle" className="dp-small-label">Liaison électrique</text>
      <g transform="translate(181,106)">
        <path d="M0 20H17L43 0V72L17 52H0Z" className="dp-speaker"/>
        <path d="M52 23Q65 36 52 49M66 11Q91 36 66 61" className="dp-sound-arc"/>
        <text x="22" y="102" textAnchor="middle" className="dp-device-name">Haut-parleur</text>
      </g>
      <path d={`M${left} 129H${right}M${left} 200H${right}`} className="dp-rail"/>
      <path d={`M${left} 55V${rulerY}M${x2} 145V${rulerY}`} className="dp-position-projection"/>
      {mic(left, 101, 'M1', BLUE, first.y1)}
      {mic(x2, 172, 'M2', RED, first.y2, true)}
      <path d={`M${left} ${rulerY}H${right}`} className="dp-ruler"/>
      {Array.from({ length: 41 }, (_, index) => {
        const x = left + index / 40 * (right - left), major = index % 4 === 0;
        return <g key={index}><path d={`M${x} ${rulerY}v${major ? 11 : 6}`} className="dp-ruler-tick"/>{major && <text x={x} y={rulerY + 29} textAnchor="middle" className="dp-ruler-label">{index * 5}</text>}</g>;
      })}
      <text x={right} y={rulerY - 10} textAnchor="end" className="dp-small-label">Position par rapport à M1 (cm)</text>
      <path d={`M${left} 307H${x2}`} className="dp-distance-dimension" markerStart={`url(#${id}-dimension)`} markerEnd={`url(#${id}-dimension)`}/>
      <text x={left + Math.max(32, (x2 - left) / 2)} y="331" textAnchor="middle" className="dp-distance-label">Δx = {formatNumber(parameters.distance * 100, 2)} cm</text>
      <path d={`M224 235H${left}`} className="dp-source-dimension"/>
      <text x="250" y="252" textAnchor="middle" className="dp-small-label">x₀</text>
    </svg>
    <svg className="dp-apparatus-svg dp-apparatus-compact" data-ruler-left="160" data-ruler-right="560" viewBox="0 0 600 405" role="group" aria-label={`Montage adapté au téléphone. M2 est à ${formatNumber(parameters.distance * 100, 2)} centimètres de M1.`}>
      <defs><marker id={`${id}-compact-dimension`} viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="5" refY="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" className="dp-arrow-head"/></marker></defs>
      <g transform="translate(20,24)">
        <rect width="110" height="72" rx="9" className="dp-gbf"/>
        <rect x="12" y="12" width="61" height="32" rx="4" className="dp-gbf-screen"/>
        <path d="M18 28Q24 10 30 28T42 28T54 28T66 28" className="dp-gbf-wave"/>
        <circle cx="91" cy="27" r="8" className="dp-gbf-dial"/>
        <circle cx="91" cy="53" r="3" className="dp-terminal"/>
        <text x="16" y="63" className="dp-device-name">GBF</text>
      </g>
      <text x="150" y="43" className="dp-diagram-label">{formatNumber(parameters.frequency, 0)} Hz</text>
      <path d="M111 77H140V116H60V181H77" className="dp-electrical-wire"/>
      <g transform="translate(77,145)">
        <path d="M0 20H17L43 0V72L17 52H0Z" className="dp-speaker"/>
        <path d="M51 23Q64 36 51 49M65 11Q90 36 65 61" className="dp-sound-arc"/>
      </g>
      <text x="77" y="242" textAnchor="middle" className="dp-device-name">Haut-parleur</text>
      <path d="M280 52H518" className="dp-propagation-arrow" markerEnd={`url(#${id}-compact-dimension)`}/>
      <text x="400" y="37" textAnchor="middle" className="dp-diagram-label">Son vers +x</text>
      <path d="M160 173H560M160 247H560" className="dp-rail"/>
      <path d={`M160 93V310M${160 + parameters.distance * 200} 168V310`} className="dp-position-projection"/>
      {mic(160, 145, 'M1', BLUE, first.y1)}
      {mic(160 + parameters.distance * 200, 219, 'M2', RED, first.y2, true, true)}
      <path d="M160 310H560" className="dp-ruler"/>
      {Array.from({ length: 21 }, (_, index) => <g key={index}><path d={`M${160 + index * 20} 310v${index % 5 === 0 ? 13 : 7}`} className="dp-ruler-tick"/>{index % 5 === 0 && <text x={160 + index * 20} y="348" textAnchor="middle" className="dp-ruler-label">{index * 10}</text>}</g>)}
      <text x="560" y="296" textAnchor="end" className="dp-diagram-label">Position / M1 (cm)</text>
      <path d={`M160 370H${160 + parameters.distance * 200}`} className="dp-distance-dimension" markerStart={`url(#${id}-compact-dimension)`} markerEnd={`url(#${id}-compact-dimension)`}/>
      <text x={160 + Math.max(45, parameters.distance * 100)} y="397" textAnchor="middle" className="dp-distance-label">Δx = {formatNumber(parameters.distance * 100, 2)} cm</text>
      <path d="M120 275H160" className="dp-source-dimension"/>
      <text x="128" y="298" textAnchor="middle" className="dp-diagram-label">x₀</text>
    </svg>
    <div className="dp-mobile-distance"><span>Position de M2</span><strong>Δx = {formatNumber(parameters.distance * 100, 2)} cm</strong><small>Glissez M2, ou utilisez le curseur et la saisie ci-dessous.</small></div>
    <p className="dp-scene-note">M1 est à x₀ = {formatNumber(parameters.sourceDistance * 100, 1)} cm du haut-parleur. Les deux rails distinguent les dessins ; le modèle utilise les positions longitudinales sur <strong>le même axe</strong>. M2 : flèches ±0,1 cm, Maj + flèche ±1 cm, Début / Fin.</p>
    {parameters.mode === 'free' && <p className="dp-scene-note dp-free-note">Phase libre : ce montage n’impose pas le déphasage. La distance conservée est informative ; le retard affiché est mathématique.</p>}
    <div className="dp-signal-readouts"><span className="dp-channel-one">y₁ = {formatNumber(first.y1, 3)} V</span><span className="dp-channel-two">y₂ = {formatNumber(first.y2, 3)} V</span><span>λ = {formatNumber(model.wavelength * 100, 2)} cm</span></div>
  </div>;
}

export interface PhaseCirclesProps { parameters: LabParameters; time: number }
/** Unit circles compare phase only; signal amplitude is applied after the projection. */
export function PhaseCircles({ parameters, time }: PhaseCirclesProps) {
  const id = useId().replace(/:/g, '');
  const points = sample(parameters, time), m = derive(parameters), r = 72, cy = 117;
  return <div className="dp-phase-circles">
    <svg viewBox="0 0 660 310" role="img" aria-label="Deux cercles de phase normalisés, avec les projections verticales des sinus et les tensions correspondantes.">
      <defs><marker id={`${id}-rotation`} viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" className="dp-arrow-head"/></marker></defs>
      {[{ cx: 165, angle: points.theta1, projection: points.projection1, voltage: points.y1, amplitude: m.A1, label: 'P1', color: BLUE }, { cx: 495, angle: points.theta2, projection: points.projection2, voltage: points.y2, amplitude: m.A2, label: 'P2', color: RED }].map(({ cx, angle, projection, voltage, amplitude, label, color }, index) => {
        const x = cx + r * Math.cos(angle), y = cy - r * Math.sin(angle);
        return <g key={label}>
          <circle cx={cx} cy={cy} r={r} className="dp-phase-circle"/>
          <path d={`M${cx - 88} ${cy}H${cx + 88}M${cx} ${cy - 88}V${cy + 88}`} className="dp-phase-axis"/>
          <text x={cx + 95} y={cy + 5} textAnchor="middle" className="dp-angle-label">0</text>
          <text x={cx - 95} y={cy + 5} textAnchor="middle" className="dp-angle-label">π</text>
          <text x={cx} y={cy - 96} textAnchor="middle" className="dp-angle-label">π/2</text>
          <text x={cx} y={cy + 106} textAnchor="middle" className="dp-angle-label">3π/2</text>
          <path d={`M${cx - 33} ${cy - 85}Q${cx - 64} ${cy - 74} ${cx - 77} ${cy - 49}`} className="dp-rotation" markerEnd={`url(#${id}-rotation)`}/>
          <path d={`M${cx} ${cy}L${x} ${y}`} stroke={color} className="dp-phase-ray"/>
          <path d={`M${x} ${y}H${cx}`} stroke={color} className="dp-phase-projection"/>
          <path d={`M${cx} ${cy}V${y}`} stroke={color} className="dp-normalized-projection"/>
          <circle cx={cx} cy={cy} r="3" className="dp-phase-origin"/>
          <circle cx={cx} cy={y} r="4" fill={color} opacity=".65"/>
          <circle cx={x} cy={y} r="7" fill={color}/>
          <text x={cx} y="252" className="dp-phase-point-label" fill={color} textAnchor="middle">{label} · θ{index + 1} = {formatNumber(degrees(angle), 1)}°</text>
          <text x={cx} y="276" className="dp-phase-projection-label" textAnchor="middle">sin θ{index + 1} = {formatNumber(projection, 3)}</text>
          <text x={cx} y="301" className="dp-phase-voltage-label" textAnchor="middle">y{index + 1} = {formatNumber(amplitude, 3)} × sin θ{index + 1} = {formatNumber(voltage, 3)} V</text>
        </g>;
      })}
    </svg>
    <p className="dp-scene-note">Les deux cercles ont le même rayon normalisé. Leur projection <strong>verticale</strong> vaut sin θ ; la tension est yᵢ = Aᵢ sin θᵢ. Ils représentent des phases mathématiques, pas la trajectoire de l’air ni celle des microphones.</p>
    <div className="dp-circle-relation"><span>θ₂ = θ₁ − δ</span><span>Δφ = −δ = {formatNumber(m.phaseDifference * 180 / Math.PI, 2)}°</span><span>Même vitesse angulaire ω</span></div>
  </div>;
}
