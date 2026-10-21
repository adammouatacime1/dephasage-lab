import { useEffect, useId, useState } from 'react';
import { Activity, ArrowRightLeft, BookOpen, FlaskConical, Radio, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, Callout, LabLayout, LabRoot, MetricGrid, Panel, ParameterControl, PlaybackBar, SelectControl, SimulationCard, SimulationViewport, Tabs, Toggle, WorkspaceHeading } from '../../shared/lab-ui';
import type { LabTheme } from '../../shared/lab-ui';
import { DEFAULT_PARAMETERS, derive, sample, formatNumber, radianLabel, type LabParameters } from '../../physics/model';
import { useSimulationClock } from './useSimulationClock';
import { Apparatus, PhaseCircles } from './Scenes';
import { Oscilloscope } from './Oscilloscope';
import './dephasage.css';

export interface DephasageLaboratoryProps { active?: boolean; theme?: LabTheme }
export const format = formatNumber;
const piLabel = radianLabel;
const positions = [
  {ratio:0,label:'0'}, {ratio:.25,label:'λ/4'}, {ratio:.5,label:'λ/2'}, {ratio:.75,label:'3λ/4'},
  {ratio:1,label:'λ'}, {ratio:1.5,label:'3λ/2'}, {ratio:2,label:'2λ'}, {ratio:3,label:'3λ'},
];
const views = [{id:'microphones',label:'Microphones'},{id:'circles',label:'Cercles'},{id:'sync',label:'Vue synchronisée'}];

export function DephasageLaboratory({active = true, theme = 'light'}: DephasageLaboratoryProps) {
  const [parameters, setParameters] = useState<LabParameters>({...DEFAULT_PARAMETERS});
  const [view, setView] = useState('sync');
  const [running,setRunning] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed,setSpeed] = useState(1);
  const [presentation,setPresentation] = useState(false);
  const {time,setTime} = useSimulationClock(active,running,speed);
  const id = useId(); const m = derive(parameters), current = sample(parameters,time), physical = parameters.mode === 'microphones';
  const update = (patch: Partial<LabParameters>) => { setParameters(previous => ({...previous,...patch})); setTime(0); };
  useEffect(() => {
    if (!active) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => { if (query.matches) setRunning(false); };
    query.addEventListener('change',listener); return () => query.removeEventListener('change',listener);
  },[active]);
  const signedDegrees = m.phaseDifference * 180 / Math.PI;
  const geometry = [
    {label:'Distance entre microphones',symbol:'Δx',value:format(parameters.distance*100,2),unit:'cm',hint:physical ? 'M1 fixe · M2 mobile de 0 à 200 cm' : 'Position conservée · sans effet en phase libre'},
    {label:'Longueur d’onde',symbol:'λ',value:format(m.wavelength*100,2),unit:'cm',hint:'λ = c/f'},
    {label:'Nombre de longueurs d’onde',value:format(parameters.distance/m.wavelength),hint:physical ? 'Δx/λ · distance physique conservée si f change' : 'Δx/λ · position conservée, sans effet sur δ'},
    {label:'Fréquence du GBF',symbol:'f',value:format(parameters.frequency,0),unit:'Hz',hint:`c = ${format(parameters.soundSpeed)} m/s`},
  ];
  const timing = [
    {label:'Période',symbol:'T',value:format(m.period*1000,4),unit:'ms',hint:'T = 1/f'},
    {label:physical ? 'Retard total calculé' : 'Décalage temporel mathématique',symbol:'Δt',value:format(m.delay*1000,4),unit:'ms',hint:physical ? `${format(m.delay/m.period)} T · Δt = Δx/c` : `${format(m.delay/m.period)} T · Δt = δ/ω`},
    {label:'Retard de phase total',symbol:'δ',value:piLabel(m.delta),unit:'rad',hint:`${format(m.delta*180/Math.PI,2)}° · δ = 2πf Δt`},
    {label:'Différence de phase signée',symbol:'Δφ',value:piLabel(m.phaseDifference),unit:'rad',hint:`${format(signedDegrees,2)}° · Δφ = φ₂ − φ₁ = −δ`},
  ];
  const amplitudes = [
    {label:'Amplitude de référence',symbol:'A₁',value:format(m.A1),unit:'V',hint:'Tension du microphone M1'},
    {label:'Amplitude reçue',symbol:'A₂',value:format(m.A2,6),unit:'V',hint:physical && parameters.attenuation ? 'Atténuation spatiale, constante dans le temps' : 'Modèle idéal : A₂ = A₁'},
    {label:'Amplitude restante',value:format(100*m.ratio,2),unit:'%',hint:'100 × A₂/A₁'},
    {label:'Perte d’amplitude',value:format(100*(1-m.ratio),2),unit:'%',hint:'100 × (1 − A₂/A₁)'},
  ];
  return <LabRoot theme={theme} className={`lk-app dephasage-lab${presentation ? ' dp-presentation' : ''}`} aria-label="Laboratoire de déphasage" data-active={active}>
    <WorkspaceHeading eyebrow="PHYSIQUE · 2ᵉ BAC SCIENCES MATHÉMATIQUES · MAROC" title="Le son, une question de phase." description="Déplacez un microphone. Comparez les signaux. Donnez du sens au déphasage.">
      <Tabs id={id} label="Vues du laboratoire" options={views} value={view} onChange={setView}/>
    </WorkspaceHeading>
    {!active && <div className="dp-inactive" role="status">Laboratoire suspendu : l’horloge est arrêtée. Réactivez-le depuis le bandeau du site.</div>}
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${view}`}>
    <LabLayout sidebar={<>
      <Panel title="Paramètres de l’expérience" icon={<SlidersHorizontal size={15}/>} className="lk-parameters">
        <fieldset disabled={!active} className="dp-parameter-fields">
          <SelectControl label="Modèle" value={parameters.mode} options={[{id:'microphones',label:'Microphones'},{id:'free',label:'Phase libre'}]} onChange={mode=>update({mode:mode as LabParameters['mode']})}/>
          <ParameterControl label="Fréquence du GBF" symbol="f" unit="Hz" value={parameters.frequency} min={200} max={2000} step={10} onChange={frequency=>update({frequency})}/>
          <ParameterControl label="Célérité du son" symbol="c" unit="m/s" value={parameters.soundSpeed} min={200} max={500} step={1} onChange={soundSpeed=>update({soundSpeed})}/>
          <ParameterControl label="Amplitude de référence" symbol="A₁" unit="V" value={parameters.amplitude} min={0.1} max={5} step={0.1} onChange={amplitude=>update({amplitude})}/>
          {physical ? <ParameterControl label="Position de M2" symbol="Δx" unit="cm" value={parameters.distance*100} min={0} max={200} step={0.1} onChange={centimeters=>update({distance:centimeters/100})} hint="Distance depuis M1, conservée lors d’un changement de fréquence."/> : <ParameterControl label="Retard de phase libre" symbol="δ" unit="°" value={parameters.freePhaseDegrees} min={0} max={2160} step={1} onChange={freePhaseDegrees=>update({freePhaseDegrees})}/>}
          <div className="lk-derived"><div className="lk-derived-row"><span>Distance source → M1</span><b>x₀ = {format(parameters.sourceDistance*100)} cm</b></div><div className="lk-derived-row"><span>Phase initiale</span><b>φ₀ = 0 rad</b></div></div>
          <Button onClick={()=>{setParameters({...DEFAULT_PARAMETERS});setTime(0);setSpeed(1);}}><RotateCcw size={13}/>Paramètres initiaux</Button>
        </fieldset>
      </Panel>
      <Panel title="Expériences remarquables" icon={<FlaskConical size={15}/>} bodyClassName="lk-library-body">
        <div className="lk-experiments dp-presets" aria-label="Positions prédéfinies">{positions.map(({ratio,label},index)=>{
          const distance=ratio*m.wavelength,disabled=!active||!physical||distance>2+1e-10;
          const chosen=physical&&Math.abs(parameters.distance-distance)<1e-7;
          return <button key={label} type="button" disabled={disabled} aria-pressed={chosen} title={!physical ? 'Disponible en mode microphones' : distance>2 ? `Hors course : ${format(distance*100,2)} cm dépasse 200 cm` : `Déplacer M2 à ${format(distance*100,2)} cm`} onClick={()=>update({distance:Math.min(2,distance)})}><span className="lk-experiment-number">{String(index+1).padStart(2,'0')}</span><span>Δx = {label}<small>{format(distance*100,2)} cm{distance>2 ? ' · hors course' : ''}</small></span><span aria-hidden="true">{chosen?'•':'›'}</span></button>;
        })}</div><p className="dp-preset-note">{physical ? 'Au-delà de 200 cm, la position est hors de la course de M2.' : 'Ces positions sont disponibles dans le mode Microphones.'}</p>
      </Panel>
      <Panel title="Amplitude et distance" icon={<Radio size={15}/>}>
        <fieldset disabled={!active||!physical} className="dp-parameter-fields">
          <Toggle label="Divergence sphérique et absorption" checked={parameters.attenuation} onChange={attenuation=>update({attenuation})}/>
          {parameters.attenuation&&<ParameterControl label="Absorption" symbol="α" unit="m⁻¹" value={parameters.absorption} min={0} max={3} step={0.05} onChange={absorption=>update({absorption})}/>}
        </fieldset>
        <p className="dp-small">{!physical ? 'Phase libre : deux tensions idéales d’amplitudes égales. La distance et l’atténuation ne commandent pas les signaux.' : parameters.attenuation ? 'Modèle illustratif en champ libre : l’amplitude baisse avec la distance, sans décroissance temporelle à position fixe.' : 'Modèle idéal sans atténuation : A₂ = A₁. Les deux microphones ont la même sensibilité.'}</p>
      </Panel>
      <Callout icon={<BookOpen size={16}/>} title="Une seule convention."><p>δ ≥ 0 est le retard de phase. La différence signée vaut Δφ = −δ : M2 est en retard sur M1. Après un tour complet, les signaux peuvent être en phase malgré un retard non nul.</p></Callout>
    </>}>
      {(view==='sync'||view==='microphones') && <SimulationCard eyebrow="01 / LE MONTAGE EXPÉRIMENTAL" title="Du GBF aux deux microphones" actions={<Badge>{physical ? 'Propagation vers +x' : 'Phase libre · montage indépendant'}</Badge>}>
        <SimulationViewport label="Montage expérimental avec règle graduée"><Apparatus parameters={parameters} time={time} onDistanceChange={distance=>update({distance})} disabled={!active||!physical}/></SimulationViewport>
        <div className="dp-montage-controls"><ParameterControl label="Déplacer M2" unit="cm" value={parameters.distance*100} min={0} max={200} step={0.1} onChange={n=>update({distance:n/100})} disabled={!active||!physical}/><span className="dp-small">Glissez le microphone rouge, utilisez les flèches du clavier ou saisissez une position.</span></div>
      </SimulationCard>}
      {!physical&&<div className="lk-warning">Mode mathématique « phase libre » : δ est réglé directement. Le montage et Δx sont conservés à titre de repères et ne déterminent pas le déphasage. Le décalage δ/ω n’est pas présenté comme un temps de propagation.</div>}
      <MetricGrid metrics={geometry}/>
      <SimulationCard eyebrow="02 / LES TENSIONS REÇUES" title="Oscilloscope à deux voies" actions={<Badge>{m.status}</Badge>} playback={<>
        <PlaybackBar running={running&&active} onRunningChange={setRunning} onReset={()=>setTime(0)} onStep={()=>setTime(t=>t+m.period/24)} speed={speed} onSpeedChange={setSpeed} time={time} disabled={!active}/>
        <div className="dp-clock-detail"><span data-testid="physical-time">t = {format(time*1000,5)} ms</span><span>Ralenti pédagogique : 1 s à l’écran = {format(speed)} ms physiques · pas = T/24</span></div>
      </>}>
        <Oscilloscope parameters={parameters} time={time} running={running&&active} disabled={!active} onTimeChange={t=>{setRunning(false);setTime(t);}}/>
      </SimulationCard>
      <MetricGrid metrics={timing}/>
      {(view==='sync'||view==='circles')&&<SimulationCard eyebrow="03 / LA REPRÉSENTATION MATHÉMATIQUE" title="Deux points, deux phases" actions={<Badge>Même fréquence · même horloge</Badge>}><div className="dp-circles-wrapper"><PhaseCircles parameters={parameters} time={time}/></div><div className="dp-phase-summary"><span>δ équivalent = <strong>{piLabel(m.equivalentDelta)} rad</strong> ({format(m.equivalentDelta*180/Math.PI,2)}°)</span><span>Δφ réduit = <strong>{piLabel(m.equivalentPhase)} rad</strong> ({format(m.equivalentPhase*180/Math.PI,2)}°)</span></div></SimulationCard>}
      <MetricGrid metrics={amplitudes}/>
      <Callout icon={<ArrowRightLeft size={20}/>} eyebrow="CE QUE VOUS OBSERVEZ" title={m.status}>
        <p>{physical ? `M2 est à ${format(parameters.distance*100,2)} cm de M1, soit ${format(parameters.distance/m.wavelength)} λ. Son signal reproduit celui de M1 avec un retard total de ${format(m.delay*1000,4)} ms (${format(m.delay/m.period)} T).` : `Le retard de phase est imposé : δ = ${piLabel(m.delta)} rad. Les deux signaux ont la même amplitude ; aucun déplacement physique du microphone n’est déduit.`} {m.status==='En phase'&&m.delay>0 ? 'Les tensions ont la même phase, mais un nombre entier de périodes sépare les événements correspondants.' : m.status==='Opposition de phase' ? 'Le maximum de l’une correspond au minimum de l’autre, à un facteur d’amplitude près.' : m.status==='Quadrature' ? 'Les phases équivalentes diffèrent d’un quart de tour, à un nombre entier de demi-tours près.' : 'Observez le décalage horizontal entre les deux voies.'}</p>
      </Callout>
      <Panel title="Du modèle aux équations" icon={<Activity size={15}/>}>
        <div className="dp-equations"><div><span className="lk-eyebrow">EXPRESSIONS GÉNÉRALES · TENSIONS EN VOLTS</span><p className="dp-math dp-channel1">y₁(t) = A₁ sin(2πft + φ₀)</p><p className="dp-math dp-channel2">y₂(t) = A₂ sin(2πft + φ₀ − δ)</p></div><div><span className="lk-eyebrow">APPLICATION NUMÉRIQUE · t EN SECONDES</span><p className="dp-math dp-channel1">y₁(t) = {format(m.A1)} sin({format(2*parameters.frequency,0)}πt) V</p><p className="dp-math dp-channel2">y₂(t) = {format(m.A2,6)} sin({format(2*parameters.frequency,0)}πt − {piLabel(m.delta)}) V</p></div></div>
        <div className="dp-equations-footer"><span>À l’instant commun : <b className="dp-channel1" data-testid="instant-y1">y₁ = {format(current.y1,4)} V</b> · <b className="dp-channel2" data-testid="instant-y2">y₂ = {format(current.y2,4)} V</b></span><span>Δφ équivalent modulo 2π : {format(m.equivalentPhase*180/Math.PI,2)}°</span></div>
      </Panel>
      <details className="dp-theory"><summary><BookOpen size={16}/>Comprendre les mesures et les limites du modèle</summary><div className="dp-theory-grid"><article><h3>Le temps et l’espace</h3><p>T = 1/f et λ = c/f. La période est une durée ; la longueur d’onde est une distance. Ici, Δt = Δx/c et δ = 2π Δx/λ = 2πf Δt. Δφ = −δ.</p></article><article><h3>Un retard, plusieurs tours</h3><p>Deux sinusoïdes seules ne permettent de retrouver le retard qu’à un multiple entier de T près. À Δx = 3λ, le retard total est 3T, bien que les signaux soient en phase. Les totaux sont calculés à partir de la distance, sans confusion avec le modulo.</p></article><article><h3>La pression devient une tension</h3><p>Les microphones ont la même sensibilité. y₁ et y₂ sont des tensions de sortie proportionnelles à la pression acoustique, en volts. Les cercles normalisés représentent des phases ; ils ne sont pas des trajectoires de particules d’air ou de microphones.</p></article><article><h3>Une atténuation spatiale</h3><p>Modèle idéal : A₂ = A₁. Modèle illustratif : A₂/A₁ = x₀/(x₀ + Δx) × exp(−αΔx), avec x₀ = 0,20 m et α ≥ 0 en m⁻¹. À position fixe, l’amplitude reste constante au cours du temps.</p></article><article><h3>Hypothèses du modèle</h3><p>Son sinusoïdal établi dans un milieu homogène, non dispersif et sans réflexion. La divergence sphérique et l’absorption sont une approximation pédagogique du haut-parleur en champ libre, sans prise en compte de sa directivité ni de son champ proche.</p></article><article><h3>Le temps de l’expérience</h3><p>Le ralenti pédagogique change seulement la vitesse d’écoulement du temps physique. Il ne modifie ni f, ni T, ni λ. Un changement de paramètre remet t à zéro ; changer f ou c conserve Δx en mètres. L’onglet masqué, la désactivation et la fermeture arrêtent l’horloge.</p></article></div></details>
      <div className="dp-lab-footer"><span>Réalisé par Adam — 2ᵉ Bac Sciences Mathématiques</span><Button onClick={()=>setPresentation(v=>!v)} disabled={!active}>{presentation ? 'Quitter la présentation' : 'Mode présentation'}</Button></div>
    </LabLayout></div>
  </LabRoot>;
}
export default DephasageLaboratory;
