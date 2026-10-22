import { useId, useMemo, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { derive, formatNumber, sample, TAU, type LabParameters, MEDIA, getMediumAt, getSecondMedium, pressureAt } from '../../physics/model';
import './scenes.css';

const BLUE = '#218dba';
const RED = '#d4515e';
const clamp = (n: number, min = 0, max = 2) => Math.min(max, Math.max(min, n));
const degrees = (n: number) => ((n % TAU + TAU) % TAU) * 180 / Math.PI;
const formatVoltage = (value: number, mixed: boolean) => mixed && Math.abs(value) > 1e-12 && Math.abs(value) < 1e-5 ? value.toExponential(2).replace('.', ',') : formatNumber(value, mixed ? 6 : 3);

export interface ApparatusProps {
  parameters: LabParameters;
  time: number;
  onDistanceChange: (metres: number) => void;
  disabled?: boolean;
}

/** The rails separate the drawings, not the longitudinal coordinates of the model. */
export function Apparatus({ parameters, time, onDistanceChange, disabled = false }: ApparatusProps) {
  const id = useId().replace(/:/g, '');
  const mixed = parameters.configuration !== 'uniform';
  const medium1 = getMediumAt(parameters,0), medium2 = getMediumAt(parameters,parameters.distance);
  const water = medium1 === 'water';
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
  const mic = (x: number, y: number, label: string, color: string, voltage: number, mobile = false, compact = false) => {
    const sensorWater = (mobile ? medium2 : medium1) === 'water';
    return <g
    className={`dp-microphone ${mobile ? 'dp-movable' : ''}`}
    transform={`translate(${x},${y})`}
    {...(mobile ? {
      role: 'slider', tabIndex: disabled ? -1 : 0, 'aria-label': sensorWater ? 'Position longitudinale de l’hydrophone M2' : 'Position longitudinale du microphone M2',
      'aria-valuemin': 0, 'aria-valuemax': 200, 'aria-valuenow': Number((parameters.distance * 100).toFixed(2)),
      'aria-valuetext': `${formatNumber(parameters.distance * 100, 2)} centimètres de M1`, 'aria-disabled': disabled,
      onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onKeyDown: keyboard,
    } : {})}
    style={{ color }} data-medium={mobile ? medium2 : medium1}
  >
    <rect className="dp-mic-hit" x="-25" y="-45" width="50" height="100" rx="12"/>
    <path d={sensorWater ? "M-12-21Q0-28 12-21V8Q12 20 0 20Q-12 20-12 8Z" : "M-13-24H13V5Q13 18 0 18Q-13 18-13 5Z"} className="dp-mic-body"/>
    <path d={sensorWater ? "M-8-12H8M-8-3H8M-8 6H8" : "M-8-16H8M-8-11H8M-8-6H8M-8-1H8"} className="dp-mic-grille"/>
    <path d="M-20 0V5Q-20 25 0 25Q20 25 20 5V0M0 25V46M-20 46H20" className="dp-mic-stand"/>
    <circle cy="-25" r="3" fill={color}/>
    <text x={mobile ? (x > (compact ? 500 : 780) ? -29 : 29) : 0} y={mobile ? -6 : -54} className="dp-mic-label" textAnchor={mobile ? (x > (compact ? 500 : 780) ? 'end' : 'start') : 'middle'}>{label}{mobile && <tspan className="dp-mic-drag-label"> ↔</tspan>}</text>
    <text x={mobile ? (x > (compact ? 500 : 780) ? -29 : 29) : 0} y={mobile ? 14 : -35} className="dp-voltage" textAnchor={mobile ? (x > (compact ? 500 : 780) ? 'end' : 'start') : 'middle'}>{formatVoltage(voltage,mixed)} V</text>
  </g>;
  };

  return <div className={`dp-apparatus${water ? ' dp-apparatus-water' : ''}`} data-medium={parameters.medium} data-configuration={parameters.configuration}>
    <div className="dp-scene-caption"><span className="dp-channel dp-channel-one">CH1 / M1 · fixe</span><span className="dp-channel dp-channel-two">CH2 / M2 · mobile</span><span>{mixed ? `${MEDIA[medium1].label} → ${MEDIA[getSecondMedium(parameters)].label} · incidence normale` : `${MEDIA[parameters.medium].label} · son établi · propagation vers +x`}</span></div>
    {mixed&&<div className="dp-interface-flow"><span>→ Onde incidente</span><span>← Onde réfléchie</span><span>→ Onde transmise</span></div>}
    <svg className="dp-apparatus-svg dp-apparatus-desktop" data-ruler-left={left} data-ruler-right={right} viewBox="0 0 900 340" role="group" aria-label={`Montage : GBF, ${water ? 'émetteur immergé' : 'haut-parleur'}, M1 dans ${medium1==='water'?'l’eau':'l’air'} et M2 dans ${medium2==='water'?'l’eau':'l’air'}. M1 est fixe ; M2 est à ${formatNumber(parameters.distance * 100, 2)} cm de M1.`}>
      <defs>
        <marker id={`${id}-dimension`} viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="5" refY="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" className="dp-arrow-head"/></marker>
      </defs>
      {mixed&&<InterfaceRegions parameters={parameters} id={id} compact={false}/>}
      {water&&!mixed&&<g className="dp-water-region" aria-hidden="true"><rect x="162" y="51" width="723" height="191" rx="8"/><path d="M162 56q20-9 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0"/><text x="865" y="78" textAnchor="end">Eau douce</text></g>}
      <path d="M180 34H384" className="dp-propagation-arrow" markerEnd={`url(#${id}-dimension)`}/>
      <text x="276" y="22" textAnchor="middle" className="dp-diagram-label">{mixed ? 'Onde incidente →' : 'Propagation du son →'}</text>
      <g transform="translate(25,108)">
        <rect width="110" height="72" rx="9" className="dp-gbf"/>
        <rect x="12" y="12" width="61" height="32" rx="4" className="dp-gbf-screen"/>
        <path d="M18 28Q24 10 30 28T42 28T54 28T66 28" className="dp-gbf-wave"/>
        <circle cx="91" cy="27" r="8" className="dp-gbf-dial"/>
        <circle cx="91" cy="53" r="3" className="dp-terminal"/>
        <text x="16" y="62" className="dp-device-name">GBF</text>{water&&<text x="55" y="-12" textAnchor="middle" className="dp-small-label">Hors de l’eau</text>}
        <text x="55" y="97" textAnchor="middle" className="dp-diagram-label">{formatNumber(parameters.frequency, 0)} Hz</text>
      </g>
      <path d="M116 161H151V176H170V142H184" className="dp-electrical-wire"/>
      <text x="138" y="216" textAnchor="middle" className="dp-small-label">Liaison électrique</text>
      <g transform="translate(181,106)">
        <path d="M0 20H17L43 0V72L17 52H0Z" className="dp-speaker"/>
        <path d="M52 23Q65 36 52 49M66 11Q91 36 66 61" className="dp-sound-arc"/>
        <text x="22" y="102" textAnchor="middle" className="dp-device-name">{water ? 'Émetteur immergé' : 'Haut-parleur'}</text>
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
      {mixed&&<InterfaceRegions parameters={parameters} id={id} compact/>}
      {water&&!mixed&&<g className="dp-water-region" aria-hidden="true"><rect x="44" y="118" width="540" height="173" rx="8"/><path d="M44 123q15-8 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0"/></g>}
      <g transform="translate(20,24)">
        <rect width="110" height="72" rx="9" className="dp-gbf"/>
        <rect x="12" y="12" width="61" height="32" rx="4" className="dp-gbf-screen"/>
        <path d="M18 28Q24 10 30 28T42 28T54 28T66 28" className="dp-gbf-wave"/>
        <circle cx="91" cy="27" r="8" className="dp-gbf-dial"/>
        <circle cx="91" cy="53" r="3" className="dp-terminal"/>
        <text x="16" y="63" className="dp-device-name">GBF</text>{water&&<text x="55" y="-10" textAnchor="middle" className="dp-small-label">Hors de l’eau</text>}
      </g>
      <text x="150" y="43" className="dp-diagram-label">{formatNumber(parameters.frequency, 0)} Hz</text>
      <path d="M111 77H140V116H60V181H77" className="dp-electrical-wire"/>
      <g transform="translate(77,145)">
        <path d="M0 20H17L43 0V72L17 52H0Z" className="dp-speaker"/>
        <path d="M51 23Q64 36 51 49M65 11Q90 36 65 61" className="dp-sound-arc"/>
      </g>
      <text x="77" y="242" textAnchor="middle" className="dp-device-name">{water ? 'Émetteur immergé' : 'Haut-parleur'}</text>
      <path d="M280 52H518" className="dp-propagation-arrow" markerEnd={`url(#${id}-compact-dimension)`}/>
      <text x="400" y="37" textAnchor="middle" className="dp-diagram-label">{mixed ? 'Incidente vers +x' : 'Son vers +x'}</text>
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
    <p className="dp-scene-note">M1 est à x₀ = {formatNumber(parameters.sourceDistance * 100, 1)} cm de {water ? 'l’émetteur immergé' : 'l’émetteur acoustique'}. {mixed ? `M1 : ${medium1==='water'?'hydrophone dans l’eau':'microphone dans l’air'} ; M2 : ${medium2==='water'?'hydrophone dans l’eau':'microphone dans l’air'}. Les sensibilités sont étalonnées pour comparer les pressions. ` : water ? 'M1 et M2 sont des hydrophones adaptés à l’eau, avec une même sensibilité étalonnée. ' : ''}Les deux rails distinguent les dessins ; le modèle utilise les positions longitudinales sur <strong>le même axe</strong>. M2 : flèches ±0,1 cm, Maj + flèche ±1 cm, Début / Fin.</p>
    {mixed&&<p className="dp-scene-note dp-interface-note">Interface à {formatNumber(parameters.interfacePosition*100,1)} cm de M1. Avant elle, les ondes incidente et réfléchie se superposent ; après elle, le capteur reçoit l’onde transmise. Modèle d’ondes planes à incidence normale, sans réflexions multiples. Le schéma est orienté selon la propagation, indépendamment de la verticale. Glissez M2 pour le faire passer d’un milieu à l’autre.</p>}
    {parameters.mode === 'free' && <p className="dp-scene-note dp-free-note">Phase libre : ce montage n’impose pas le déphasage. La distance conservée est informative ; le retard affiché est mathématique.</p>}
    {parameters.mode === 'microphones' && <AmplitudeEnvelope parameters={parameters}/>}
    <div className="dp-signal-readouts"><span className="dp-channel-one">y₁ = {formatVoltage(first.y1,mixed)} V</span><span className="dp-channel-two">y₂ = {formatVoltage(first.y2,mixed)} V</span><span>{mixed ? `λ₁ = ${formatNumber(model.wavelength*100,2)} cm · λ₂ = ${formatNumber(model.wavelength2*100,2)} cm` : `λ = ${formatNumber(model.wavelength*100,2)} cm`}</span></div>
  </div>;
}

/** La séparation longitudinale est schématique ; le GBF reste hors du volume d’eau. */
function InterfaceRegions({parameters,id,compact}:{parameters:LabParameters;id:string;compact:boolean}) {
  const rulerLeft=compact?160:285, rulerRight=compact?560:850;
  const start=compact?44:162,end=compact?584:885,top=compact?118:51,bottom=compact?291:242;
  const boundary=rulerLeft+parameters.interfacePosition/2*(rulerRight-rulerLeft);
  const firstWater=getMediumAt(parameters,0)==='water';
  const waterLeft=firstWater?start:boundary,waterRight=firstWater?boundary:end;
  const rulerY=compact?310:258;
  const beforeCenter=start+36,afterCenter=(boundary+end)/2;
  return <g className="dp-interface-regions" data-testid={compact?'interface-compact':'interface-desktop'}>
    <g className="dp-water-region" aria-hidden="true"><rect x={waterLeft} y={top} width={Math.max(0,waterRight-waterLeft)} height={bottom-top} rx="5"/></g>
    <line x1={boundary} x2={boundary} y1={top-10} y2={rulerY+10} className="dp-interface-boundary"/>
    <text x={beforeCenter} y={top+21} textAnchor="middle" className="dp-interface-medium">{MEDIA[parameters.medium].label}</text>
    <text x={afterCenter} y={top+21} textAnchor="middle" className="dp-interface-medium">{MEDIA[getSecondMedium(parameters)].label}</text>
    <text x={boundary+(boundary>end-75?-7:7)} y={compact?285:252} textAnchor={boundary>end-75?'end':'start'} className="dp-interface-label">Interface</text>
    <path d={`M${Math.min(boundary-18,start+18)} ${bottom-10}H${Math.max(start+10,boundary-18)}`} className="dp-interface-wave dp-wave-reflected" markerStart={`url(#${id}${compact?'-compact':''}-dimension)`}><title>Onde réfléchie vers les x décroissants</title></path>
    <path d={`M${Math.min(end-12,boundary+13)} ${bottom-10}H${end-12}`} className="dp-interface-wave dp-wave-transmitted" markerEnd={`url(#${id}${compact?'-compact':''}-dimension)`}><title>Onde transmise vers les x croissants</title></path>
  </g>;
}

/** Profil spatial, indépendant du temps et de toute horloge d’animation. */
function AmplitudeEnvelope({parameters}:{parameters:LabParameters}) {
  return parameters.configuration !== 'uniform' ? <InterfacePressureEnvelope parameters={parameters}/> : <UniformAmplitudeEnvelope parameters={parameters}/>;
}

function UniformAmplitudeEnvelope({parameters}:{parameters:LabParameters}) {
  const values = derive(parameters), left = 52, right = 574, top = 28, bottom = 139;
  const X = (x:number) => left + x / 2 * (right-left);
  const Y = (ratio:number) => bottom - ratio * (bottom-top);
  const curve = useMemo(() => Array.from({length:121},(_,i)=>{
    const d=i/60;
    const ratio=parameters.attenuation ? parameters.sourceDistance/(parameters.sourceDistance+d)*Math.exp(-parameters.absorption*d) : 1;
    return `${i===0?'M':'L'}${(52+d/2*522).toFixed(2)},${(139-ratio*111).toFixed(2)}`;
  }).join(' '),[parameters]);
  return <section className="dp-envelope" aria-label="Amortissement spatial de l’amplitude" data-testid="amplitude-envelope" data-ratio={values.ratio}>
    <div className="dp-envelope-copy"><span className="lk-eyebrow">L’AMPLITUDE ET LA DISTANCE</span><h3>{parameters.attenuation?'Le son s’atténue en s’éloignant.':'Même amplitude à toute distance.'}</h3><p>M1 : 100 %<br/><span className="dp-channel-two">M2 : {formatNumber(100*values.ratio,2)} % restants</span></p><p>À position fixe, cette enveloppe reste constante dans le temps.</p></div>
    <svg viewBox="0 0 620 195" role="img" aria-label={`Amplitude restante de 0 à 200 centimètres. Au capteur M2 : ${formatNumber(values.ratio*100,2)} pour cent.`}>
      <text x={left} y="15" className="dp-envelope-unit">Amplitude restante (%)</text>
      {[0,.5,1].map(r=><g key={r}><line x1={left} x2={right} y1={Y(r)} y2={Y(r)} className="dp-envelope-grid"/><text x={left-9} y={Y(r)+4} textAnchor="end" className="dp-envelope-label">{r*100}</text></g>)}
      {[0,.5,1,1.5,2].map(x=><g key={x}><line x1={X(x)} x2={X(x)} y1={top} y2={bottom} className="dp-envelope-grid"/><text x={X(x)} y={bottom+22} textAnchor="middle" className="dp-envelope-label">{x*100}</text></g>)}
      <path d={curve} className="dp-envelope-path"/>
      <line x1={X(parameters.distance)} x2={X(parameters.distance)} y1={Y(values.ratio)} y2={bottom} className="dp-envelope-projection"/>
      <circle cx={left} cy={top} r="6" fill={BLUE}/><circle cx={X(parameters.distance)} cy={Y(values.ratio)} r="4.5" fill={RED}/>
      <text x={right} y="187" textAnchor="end" className="dp-envelope-unit">Distance depuis M1 (cm)</text>
    </svg>
  </section>;
}

/** Pression totale : une interférence peut augmenter le rapport de pression sans gain d’énergie. */
function InterfacePressureEnvelope({parameters}:{parameters:LabParameters}) {
  const values=derive(parameters),left=72,right=574,top=28,bottom=139;
  const profile=useMemo(()=>{
    const count=Math.max(400,Math.ceil(2*parameters.frequency/Math.min(parameters.soundSpeed,parameters.secondSoundSpeed)*96));
    const coordinates=[...new Set([...Array.from({length:count+1},(_,i)=>2*i/count),parameters.interfacePosition])].sort((a,b)=>a-b);
    return coordinates.map(x=>({x,ratio:pressureAt(parameters,x).amplitude/values.A1}));
  },[parameters,values.A1]);
  const maximum=Math.max(1,Math.ceil(Math.max(...profile.map(point=>point.ratio))*10)/10);
  const X=(x:number)=>left+x/2*(right-left),Y=(ratio:number)=>bottom-ratio/maximum*(bottom-top);
  const curve=profile.map(({x,ratio},index)=>`${index===0?'M':'L'}${X(x).toFixed(2)},${Y(ratio).toFixed(2)}`).join(' ');
  const percent=(ratio:number)=>ratio*100>=10000?`${formatNumber(ratio/10,1)} k`:formatNumber(ratio*100,1);
  return <section className="dp-envelope dp-interface-envelope" aria-label="Pression totale et interface" data-testid="amplitude-envelope" data-ratio={values.ratio}>
    <div className="dp-envelope-copy"><span className="lk-eyebrow">PRESSION TOTALE ET INTERFACE</span><h3>La réflexion modifie la pression mesurée.</h3><p>M1 : référence 100 %<br/><span className="dp-channel-two">M2 / M1 : {formatNumber(100*values.ratio,2)} %</span></p><p>Un rapport supérieur à 100 % ne signifie pas un gain d’énergie. Les interférences restent présentes si l’absorption est désactivée.</p></div>
    <svg viewBox="0 0 620 195" role="img" aria-label={`Amplitude de pression relative à M1, de 0 à 200 centimètres. Interface à ${formatNumber(parameters.interfacePosition*100,1)} centimètres. Rapport M2/M1 ${formatNumber(values.ratio*100,2)} pour cent.`}>
      <text x={left} y="15" className="dp-envelope-unit">Pression relative à M1 (%)</text>
      {[0,.5,1].map(fraction=><g key={fraction}><line x1={left} x2={right} y1={Y(fraction*maximum)} y2={Y(fraction*maximum)} className="dp-envelope-grid"/><text x={left-9} y={Y(fraction*maximum)+4} textAnchor="end" className="dp-envelope-label">{percent(fraction*maximum)}</text></g>)}
      {[0,.5,1,1.5,2].map(x=><g key={x}><line x1={X(x)} x2={X(x)} y1={top} y2={bottom} className="dp-envelope-grid"/><text x={X(x)} y={bottom+22} textAnchor="middle" className="dp-envelope-label">{x*100}</text></g>)}
      <line x1={X(parameters.interfacePosition)} x2={X(parameters.interfacePosition)} y1={top} y2={bottom} className="dp-interface-boundary"/>
      <path d={curve} className="dp-envelope-path"/>
      <line x1={X(parameters.distance)} x2={X(parameters.distance)} y1={Y(values.ratio)} y2={bottom} className="dp-envelope-projection"/>
      <circle cx={left} cy={Y(1)} r="6" fill={BLUE}/><circle cx={X(parameters.distance)} cy={Y(values.ratio)} r="4.5" fill={RED}/>
      <text x={right} y="187" textAnchor="end" className="dp-envelope-unit">Distance depuis M1 (cm)</text>
    </svg>
  </section>;
}

export interface PhaseCirclesProps { parameters: LabParameters; time: number }
/** Unit circles compare phase only; signal amplitude is applied after the projection. */
export function PhaseCircles({ parameters, time }: PhaseCirclesProps) {
  const id = useId().replace(/:/g, '');
  const points = sample(parameters, time), m = derive(parameters), r = 72, cy = 117, mixed = m.isInterface;
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
          <text x={cx} y="301" className="dp-phase-voltage-label" textAnchor="middle">y{index + 1} = {formatVoltage(amplitude,mixed)} × sin θ{index + 1} = {formatVoltage(voltage,mixed)} V</text>
        </g>;
      })}
    </svg>
    <p className="dp-scene-note">Les deux cercles ont le même rayon normalisé. Leur projection <strong>verticale</strong> vaut sin θ ; la tension est yᵢ = Aᵢ sin θᵢ. Ils représentent des phases mathématiques, pas la trajectoire du fluide ni celle des capteurs.</p>
    <div className="dp-circle-relation"><span>θ₂ = θ₁ − δ</span><span>Δφ = −δ = {formatNumber(m.phaseDifference * 180 / Math.PI, 2)}°</span><span>Même vitesse angulaire ω</span></div>
  </div>;
}
