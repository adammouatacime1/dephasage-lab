import { useEffect, useId, useState } from 'react';
import { Activity, ArrowRightLeft, BookOpen, FlaskConical, Radio, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, Callout, LabLayout, LabRoot, MetricGrid, Panel, ParameterControl, PlaybackBar, SegmentedControl, SelectControl, SimulationCard, SimulationViewport, Tabs, Toggle, WorkspaceHeading } from '../../shared/lab-ui';
import type { LabTheme } from '../../shared/lab-ui';
import { DEFAULT_PARAMETERS, derive, sample, formatNumber, radianLabel, MEDIA, changeMedium, changeConfiguration, getMediumAt, getSecondMedium, type Medium, type LabParameters, type PropagationConfiguration } from '../../physics/model';
import { useSimulationClock } from './useSimulationClock';
import { Apparatus, PhaseCircles } from './Scenes';
import { Oscilloscope } from './Oscilloscope';
import './dephasage.css';

export interface DephasageLaboratoryProps { active?: boolean; theme?: LabTheme }
export const format = formatNumber;
const piLabel = radianLabel;
const voltage = (value:number) => Math.abs(value)>1e-12&&Math.abs(value)<1e-5 ? value.toExponential(2).replace('.',',') : format(value,6);
const phaseTerm = (phase:number) => Math.abs(phase)<1e-10 ? '' : ` ${phase<0?'−':'+'} ${piLabel(Math.abs(phase))}`;
const positions = [{ratio:0,label:'0'},{ratio:.25,label:'λ/4'},{ratio:.5,label:'λ/2'},{ratio:.75,label:'3λ/4'},{ratio:1,label:'λ'},{ratio:1.5,label:'3λ/2'},{ratio:2,label:'2λ'},{ratio:3,label:'3λ'}];
const views = [{id:'microphones',label:'Microphones'},{id:'circles',label:'Cercles'},{id:'sync',label:'Vue synchronisée'}];
const mediumOptions = [{id:'air',label:'Air'},{id:'water',label:'Eau douce'},{id:'air-water',label:'Air → Eau'},{id:'water-air',label:'Eau → Air'}];

export function DephasageLaboratory({active=true,theme='light'}:DephasageLaboratoryProps) {
  const [parameters,setParameters] = useState<LabParameters>({...DEFAULT_PARAMETERS});
  const [view,setView] = useState('sync');
  const [running,setRunning] = useState(()=>typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed,setSpeed] = useState(1);
  const [presentation,setPresentation] = useState(false);
  const {time,setTime} = useSimulationClock(active,running,speed);
  const id=useId(), m=derive(parameters), current=sample(parameters,time);
  const physical=parameters.mode==='microphones', mixed=parameters.configuration!=='uniform';
  const water=parameters.medium==='water', firstMedium=MEDIA[parameters.medium], secondMedium=MEDIA[getSecondMedium(parameters)];
  const water2=getMediumAt(parameters,parameters.distance)==='water';
  const selectedMedium=mixed?parameters.configuration:parameters.medium;
  const viewOptions=views.map(option=>option.id==='microphones'?{...option,label:mixed?'Interface air–eau':water?'Hydrophones':'Microphones'}:option);
  const update=(patch:Partial<LabParameters>)=>{setParameters(previous=>({...previous,...patch}));setTime(0);};
  const selectMedium=(value:string)=>{
    setParameters(previous=>value==='air-water'||value==='water-air'?changeConfiguration(previous,value as PropagationConfiguration):changeMedium(previous,value as Medium));setTime(0);
  };
  useEffect(()=>{
    if(!active)return;
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener=()=>{if(query.matches)setRunning(false);};
    query.addEventListener('change',listener);return()=>query.removeEventListener('change',listener);
  },[active]);

  const geometry=mixed?[
    {label:'Distance entre capteurs',symbol:'Δx',value:format(parameters.distance*100,2),unit:'cm',hint:`M1 : ${firstMedium.label} · M2 : ${MEDIA[getMediumAt(parameters,parameters.distance)].label}`},
    {label:`Longueur d’onde · ${firstMedium.label}`,symbol:'λ₁',value:format(m.wavelength*100,2),unit:'cm',hint:'λ₁ = c₁/f'},
    {label:`Longueur d’onde · ${secondMedium.label}`,symbol:'λ₂',value:format(m.wavelength2*100,2),unit:'cm',hint:'λ₂ = c₂/f · même fréquence'},
    {label:'Fréquence du GBF',symbol:'f',value:format(parameters.frequency,0),unit:'Hz',hint:'La fréquence reste identique à l’interface'},
  ]:[
    {label:water?'Distance entre hydrophones':'Distance entre microphones',symbol:'Δx',value:format(parameters.distance*100,2),unit:'cm',hint:physical?'M1 fixe · M2 mobile de 0 à 200 cm':'Position conservée · sans effet en phase libre'},
    {label:'Longueur d’onde',symbol:'λ',value:format(m.wavelength*100,2),unit:'cm',hint:'λ = c/f'},
    {label:'Nombre de longueurs d’onde',value:format(parameters.distance/m.wavelength),hint:physical?'Δx/λ · distance physique conservée si f change':'Δx/λ · position conservée, sans effet sur δ'},
    {label:'Fréquence du GBF',symbol:'f',value:format(parameters.frequency,0),unit:'Hz',hint:`${firstMedium.label} · c = ${format(parameters.soundSpeed)} m/s`},
  ];
  const timing=m.isInterface?[
    {label:'Période',symbol:'T',value:format(m.period*1000,4),unit:'ms',hint:'T = 1/f'},
    {label:'Temps de parcours',symbol:'τ',value:format(m.delay*1000,4),unit:'ms',hint:'τ = d₁/c₁ + d₂/c₂ · trajet de l’onde incidente'},
    {label:'Déphasage entre capteurs',symbol:'Δφ',value:piLabel(m.phaseDifference),unit:'rad',hint:`${format(m.phaseDifferenceDegrees,2)}° · tensions totales avec réflexion`},
    {label:'Phase du parcours',symbol:'ωτ',value:piLabel(m.propagationPhaseDelay),unit:'rad',hint:`${format(m.propagationPhaseDelay*180/Math.PI,2)}° · distincte du déphasage mesuré`},
  ]:[
    {label:'Période',symbol:'T',value:format(m.period*1000,4),unit:'ms',hint:'T = 1/f'},
    {label:physical?'Retard total calculé':'Décalage temporel mathématique',symbol:'Δt',value:format(m.delay*1000,4),unit:'ms',hint:physical?`${format(m.delay/m.period)} T · Δt = Δx/c`:`${format(m.delay/m.period)} T · Δt = δ/ω`},
    {label:'Retard de phase total',symbol:'δ',value:piLabel(m.delta),unit:'rad',hint:`${format(m.deltaDegrees,2)}° · δ = 2πf Δt`},
    {label:'Différence de phase signée',symbol:'Δφ',value:piLabel(m.phaseDifference),unit:'rad',hint:`${format(m.phaseDifferenceDegrees,2)}° · Δφ = φ₂ − φ₁ = −δ`},
  ];
  const amplitudes=m.isInterface?[
    {label:'Amplitude incidente à M1',symbol:'Aᵢ',value:format(parameters.amplitude),unit:'V',hint:'Référence avant addition de l’onde réfléchie'},
    {label:'Amplitude totale à M1',symbol:'A₁',value:voltage(m.A1),unit:'V',hint:'Somme de l’onde incidente et de l’onde réfléchie'},
    {label:'Amplitude totale à M2',symbol:'A₂',value:voltage(m.A2),unit:'V',hint:parameters.distance>=parameters.interfacePosition?'Onde transmise':'Onde incidente + onde réfléchie'},
    {label:'Rapport de pression A₂/A₁',value:format(100*m.ratio,2),unit:'%',hint:'Peut dépasser 100 % · ce n’est pas un rapport d’énergie'},
  ]:[
    {label:'Amplitude de référence',symbol:'A₁',value:format(m.A1),unit:'V',hint:water?'Tension de l’hydrophone M1':'Tension du microphone M1'},
    {label:'Amplitude reçue',symbol:'A₂',value:format(m.A2,6),unit:'V',hint:physical&&parameters.attenuation?'Atténuation spatiale, constante dans le temps':'Modèle idéal : A₂ = A₁'},
    {label:'Amplitude restante',value:format(100*m.ratio,2),unit:'%',hint:'100 × A₂/A₁'},
    {label:'Perte d’amplitude',value:format(100*(1-m.ratio),2),unit:'%',hint:'100 × (1 − A₂/A₁)'},
  ];
  const interfacePresets=[
    {label:`M2 dans ${water?'l’eau':'l’air'}`,distance:parameters.interfacePosition/2},
    {label:`M2 dans ${water?'l’air':'l’eau'}`,distance:Math.min(2,parameters.interfacePosition+.2)},
    {label:'Juste avant l’interface',distance:parameters.interfacePosition-.01},
    {label:'Juste après l’interface',distance:parameters.interfacePosition+.01},
  ];

  return <LabRoot theme={theme} className={`lk-app dephasage-lab${presentation?' dp-presentation':''}`} aria-label="Laboratoire de déphasage" data-active={active}>
    <WorkspaceHeading eyebrow="PHYSIQUE · 2ᵉ BAC SCIENCES MATHÉMATIQUES · MAROC" title="Le son, une question de phase." description="Déplacez un capteur. Comparez les signaux. Donnez du sens au déphasage.">
      <Tabs id={id} label="Vues du laboratoire" options={viewOptions} value={view} onChange={setView}/>
    </WorkspaceHeading>
    {!active&&<div className="dp-inactive" role="status">Laboratoire suspendu : l’horloge est arrêtée. Réactivez-le depuis le bandeau du site.</div>}
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${view}`}>
    <LabLayout sidebar={<>
      <Panel title="Paramètres de l’expérience" icon={<SlidersHorizontal size={15}/>} className="lk-parameters">
        <fieldset disabled={!active} className="dp-parameter-fields">
          <SelectControl label="Modèle" value={parameters.mode} options={[{id:'microphones',label:mixed?'Interface entre milieux':water?'Hydrophones':'Microphones'},{id:'free',label:'Phase libre'}]} onChange={mode=>update({mode:mode as LabParameters['mode']})}/>
          <SelectControl label="Milieu de propagation" value={selectedMedium} options={mediumOptions} onChange={selectMedium}/>
          <ParameterControl label="Fréquence du GBF" symbol="f" unit="Hz" value={parameters.frequency} min={200} max={2000} step={10} onChange={frequency=>update({frequency})}/>
          <ParameterControl label={mixed?`Célérité · ${firstMedium.label}`:'Célérité du son'} symbol={mixed?'c₁':'c'} unit="m/s" value={parameters.soundSpeed} min={200} max={2000} step={1} onChange={soundSpeed=>update({soundSpeed})}/>
          {mixed&&<ParameterControl label={`Célérité · ${secondMedium.label}`} symbol="c₂" unit="m/s" value={parameters.secondSoundSpeed} min={200} max={2000} step={1} onChange={secondSoundSpeed=>update({secondSoundSpeed})}/>}
          <ParameterControl label={mixed?'Amplitude incidente':'Amplitude de référence'} symbol={mixed?'Aᵢ':'A₁'} unit="V" value={parameters.amplitude} min={0.1} max={5} step={0.1} onChange={amplitude=>update({amplitude})}/>
          {physical?<ParameterControl label="Position de M2" symbol="Δx" unit="cm" value={parameters.distance*100} min={0} max={200} step={0.1} onChange={n=>update({distance:n/100})} hint="La distance est conservée lors d’un changement de fréquence."/>:<ParameterControl label="Retard de phase libre" symbol="δ" unit="°" value={parameters.freePhaseDegrees} min={0} max={2160} step={1} onChange={freePhaseDegrees=>update({freePhaseDegrees})}/>}
          {mixed&&<ParameterControl label="Position de l’interface" symbol="b" unit="cm" value={parameters.interfacePosition*100} min={5} max={195} step={1} onChange={n=>update({interfacePosition:n/100})} disabled={!physical}/>}
          <div className="lk-derived"><div className="lk-derived-row"><span>Configuration</span><b>{mixed?`${firstMedium.label} → ${secondMedium.label}`:firstMedium.label}</b></div><div className="lk-derived-row"><span>Distance source → M1</span><b>x₀ = {format(parameters.sourceDistance*100)} cm</b></div><div className="lk-derived-row"><span>Origine de phase</span><b>{mixed?'Onde incidente : φ₀ = 0':'φ₀ = 0 rad'}</b></div></div>
          <Button onClick={()=>{setParameters({...DEFAULT_PARAMETERS});setTime(0);setSpeed(1);}}><RotateCcw size={13}/>Paramètres initiaux</Button>
        </fieldset>
      </Panel>
      <Panel title={mixed?'Placer les capteurs':'Expériences remarquables'} icon={<FlaskConical size={15}/>} bodyClassName="lk-library-body">
        <div className="lk-experiments dp-presets" aria-label="Positions prédéfinies">{mixed?interfacePresets.map(({label,distance},index)=><button key={label} type="button" disabled={!active||!physical} aria-pressed={Math.abs(parameters.distance-distance)<1e-7} onClick={()=>update({distance})}><span className="lk-experiment-number">{String(index+1).padStart(2,'0')}</span><span>{label}<small>{format(distance*100,2)} cm</small></span><span aria-hidden="true">›</span></button>):positions.map(({ratio,label},index)=>{
          const distance=ratio*m.wavelength,disabled=!active||!physical||distance>2+1e-10;
          return <button key={label} type="button" disabled={disabled} aria-pressed={physical&&Math.abs(parameters.distance-distance)<1e-7} title={!physical?'Disponible en mode microphones':distance>2?`Hors course : ${format(distance*100,2)} cm dépasse 200 cm`:`Déplacer M2 à ${format(distance*100,2)} cm`} onClick={()=>update({distance:Math.min(2,distance)})}><span className="lk-experiment-number">{String(index+1).padStart(2,'0')}</span><span>Δx = {label}<small>{format(distance*100,2)} cm{distance>2?' · hors course':''}</small></span><span aria-hidden="true">{physical&&Math.abs(parameters.distance-distance)<1e-7?'•':'›'}</span></button>;
        })}</div><p className="dp-preset-note">{mixed?'Deux célérités : il n’existe pas de longueur d’onde unique sur tout le trajet.':physical?'Au-delà de 200 cm, la position est hors de la course de M2.':'Ces positions sont disponibles dans le mode Microphones.'}</p>
      </Panel>
      <Panel title="Amortissement dans le milieu" icon={<Radio size={15}/>}>
        <fieldset disabled={!active||!physical} className="dp-parameter-fields">
          <Toggle label={mixed?'Absorption sur les trajets':'Divergence sphérique et absorption'} checked={parameters.attenuation} onChange={attenuation=>update({attenuation})}/>
          {parameters.attenuation&&<ParameterControl label={mixed?`Absorption illustrative · ${firstMedium.label}`:'Absorption illustrative'} symbol={mixed?'α₁':'α'} unit="m⁻¹" value={parameters.absorption} min={0} max={3} step={0.05} onChange={absorption=>update({absorption})}/>}
          {mixed&&parameters.attenuation&&<ParameterControl label={`Absorption illustrative · ${secondMedium.label}`} symbol="α₂" unit="m⁻¹" value={parameters.secondAbsorption} min={0} max={3} step={0.05} onChange={secondAbsorption=>update({secondAbsorption})}/>}
        </fieldset>
        <p className="dp-small">{!physical?'Phase libre : deux tensions idéales d’amplitudes égales. Le montage n’impose pas les signaux.':mixed?'Ondes planes : l’absorption agit sur chaque trajet, sans facteur de divergence 1/r. La réflexion et la transmission restent présentes même si l’absorption est désactivée.':parameters.attenuation?`Dans ${water?'l’eau douce':'l’air'}, l’amplitude diminue avec la distance. À position fixe, elle reste constante dans le temps.`:'Modèle idéal sans atténuation : A₂ = A₁. Les deux capteurs ont la même sensibilité.'}</p>
        {!mixed&&<p className="dp-small">La divergence répartit l’énergie dans l’espace ; l’absorption la dissipe dans le milieu. Leurs facteurs d’amplitude se multiplient.</p>}
        <p className="dp-small">α est un coefficient d’illustration réglable, pas une valeur mesurée du matériau. Les valeurs réelles dépendent notamment de la fréquence et de la température.</p>
        {!mixed&&physical&&parameters.attenuation&&<div className="lk-derived"><div className="lk-derived-row"><span>Amplitude après divergence</span><b>{format(parameters.sourceDistance/(parameters.sourceDistance+parameters.distance)*100,2)} %</b></div><div className="lk-derived-row"><span>Amplitude après absorption</span><b>{format(Math.exp(-parameters.absorption*parameters.distance)*100,2)} %</b></div></div>}
      </Panel>
      <Callout icon={<BookOpen size={16}/>} title={mixed?'Pression et énergie sont distinctes.':'Une seule convention.'}><p>{mixed?'À une interface air–eau, une pression transmise élevée ne signifie pas une énergie élevée : les impédances acoustiques sont très différentes. La réflexion modifie aussi la tension totale mesurée à M1.':'δ ≥ 0 est le retard de phase. La différence signée vaut Δφ = −δ : M2 est en retard sur M1. Après un tour complet, les signaux peuvent être en phase malgré un retard non nul.'}</p></Callout>
    </>}>
      {(view==='sync'||view==='microphones')&&<SimulationCard eyebrow="01 / LE MONTAGE EXPÉRIMENTAL" title={mixed?'Les capteurs et l’interface air–eau':water?'Du GBF aux deux hydrophones':'Du GBF aux deux microphones'} actions={<Badge>{mixed?`M1 : ${firstMedium.label} · M2 : ${MEDIA[getMediumAt(parameters,parameters.distance)].label}`:physical?`${firstMedium.label} · propagation vers +x`:'Phase libre · montage indépendant'}</Badge>} toolbar={<div className="dp-medium-toolbar"><fieldset disabled={!active}><SegmentedControl label="Milieu de l’expérience" options={mediumOptions} value={selectedMedium} onChange={selectMedium}/></fieldset><span>{mixed?'Interface plane · incidence normale':`c = ${format(parameters.soundSpeed,0)} m/s · ${physical&&parameters.attenuation?'amortissement activé':'modèle idéal'}`}</span></div>}>
        <SimulationViewport label="Montage expérimental avec règle graduée"><Apparatus parameters={parameters} time={time} onDistanceChange={distance=>update({distance})} disabled={!active||!physical}/></SimulationViewport>
        <div className="dp-medium-note">{mixed?'Choisir une interface place M2 dans le second milieu. Ensuite, glissez M2 à travers la frontière : son milieu et son type de capteur se mettent à jour. Changer f ou les célérités conserve les positions.':'Changer de milieu conserve Δx, rétablit la célérité et l’absorption proposées, puis active l’atténuation. Les célérités sont des valeurs usuelles approchées, réglables.'}</div>
        <div className="dp-montage-controls"><ParameterControl label="Déplacer M2" unit="cm" value={parameters.distance*100} min={0} max={200} step={0.1} onChange={n=>update({distance:n/100})} disabled={!active||!physical}/><span className="dp-small">Glissez {water2?'l’hydrophone':'le microphone'} rouge, utilisez les flèches du clavier ou saisissez une position.</span></div>
        {mixed&&<div className="dp-montage-controls dp-interface-control"><ParameterControl label="Déplacer l’interface" unit="cm" value={parameters.interfacePosition*100} min={5} max={195} step={1} onChange={n=>update({interfacePosition:n/100})} disabled={!active||!physical}/><span className="dp-small">La règle repère la frontière depuis M1. Aucun déplacement automatique de M2 lors de ce réglage.</span></div>}
      </SimulationCard>}
      {!physical&&<div className="lk-warning">Mode mathématique « phase libre » : δ est réglé directement. Le montage, les milieux et Δx sont conservés à titre de repères et ne déterminent pas le déphasage. Le décalage δ/ω n’est pas présenté comme un temps de propagation.</div>}
      <MetricGrid metrics={geometry}/>
      {m.isInterface&&<Panel title="Réflexion et transmission à l’interface" icon={<ArrowRightLeft size={15}/>}>
        <div className="dp-interface-facts"><div><span className="lk-eyebrow">TRAJET ENTRE M1 ET M2</span><p>{firstMedium.label} : {format(m.pathFirst*100,2)} cm · {secondMedium.label} : {format(m.pathSecond*100,2)} cm</p><p>τ = ({format(m.pathFirst,4)}/{format(parameters.soundSpeed,0)} + {format(m.pathSecond,4)}/{format(parameters.secondSoundSpeed,0)}) s = {format(m.delay*1000,4)} ms</p></div><div><span className="lk-eyebrow">IMPÉDANCES ACOUSTIQUES · Z = ρc</span><p>Z₁ = {format(m.impedance1,0)} · Z₂ = {format(m.impedance2,0)} kg·m⁻²·s⁻¹</p><p>ρ₁ = {format(m.density1)} · ρ₂ = {format(m.density2)} kg/m³ · valeurs usuelles approchées</p></div></div>
        <MetricGrid label="Coefficients à l’interface" metrics={[
          {label:'Réflexion de pression',symbol:'rₚ',value:format(m.reflectionPressure,6),hint:'rₚ = (Z₂ − Z₁)/(Z₂ + Z₁)'},
          {label:'Transmission de pression',symbol:'tₚ',value:format(m.transmissionPressure,6),hint:'tₚ = 1 + rₚ · peut dépasser 1'},
          {label:'Intensité réfléchie',symbol:'R',value:format(m.reflectedIntensity*100,3),unit:'%',hint:'R = rₚ² · à l’interface'},
          {label:'Intensité transmise',symbol:'𝒯',value:format(m.transmittedIntensity*100,3),unit:'%',hint:'𝒯 = 4Z₁Z₂/(Z₁ + Z₂)² · R + 𝒯 = 1'},
        ]}/>
        <p className="dp-interface-explanation">{m.reflectionPressure<0?'Le coefficient de réflexion de pression est négatif : l’onde réfléchie est inversée. ':''}Ces pourcentages portent sur l’intensité acoustique incidente au niveau de l’interface, hors absorption sur les trajets. Une tension proportionnelle à la pression peut augmenter sans gain d’énergie. Avant la frontière, chaque capteur reçoit l’onde incidente et l’onde réfléchie ; après, il reçoit l’onde transmise.</p>
        <div className="lk-warning">La réflexion change la phase à M1 : le déphasage des tensions totales n’est pas simplement −ωτ. Le temps de parcours géométrique et le décalage des maxima sont affichés séparément.</div>
      </Panel>}
      <SimulationCard eyebrow="02 / LES TENSIONS REÇUES" title="Oscilloscope à deux voies" actions={<Badge>{m.status}</Badge>} playback={<>
        <PlaybackBar running={running&&active} onRunningChange={setRunning} onReset={()=>setTime(0)} onStep={()=>setTime(t=>t+m.period/24)} speed={speed} onSpeedChange={setSpeed} time={time} disabled={!active}/>
        <div className="dp-clock-detail"><span data-testid="physical-time">t = {format(time*1000,5)} ms</span><span>Ralenti pédagogique : 1 s à l’écran = {format(speed)} ms physiques · pas = T/24</span></div>
      </>}><Oscilloscope parameters={parameters} time={time} running={running&&active} disabled={!active} onTimeChange={t=>{setRunning(false);setTime(t);}}/></SimulationCard>
      <MetricGrid metrics={timing}/>
      {(view==='sync'||view==='circles')&&<SimulationCard eyebrow="03 / LA REPRÉSENTATION MATHÉMATIQUE" title="Deux points, deux phases" actions={<Badge>Même fréquence · même horloge</Badge>}><div className="dp-circles-wrapper"><PhaseCircles parameters={parameters} time={time}/></div><div className="dp-phase-summary"><span>δ équivalent = <strong>{piLabel(m.equivalentDelta)} rad</strong> ({format(m.equivalentDeltaDegrees,2)}°)</span><span>Δφ réduit = <strong>{piLabel(m.equivalentPhase)} rad</strong> ({format(m.equivalentPhaseDegrees,2)}°)</span></div></SimulationCard>}
      <MetricGrid metrics={amplitudes}/>
      <Callout icon={<ArrowRightLeft size={20}/>} eyebrow="CE QUE VOUS OBSERVEZ" title={m.status}>
        <p>{m.isInterface?`M1 est dans ${water?'l’eau':'l’air'} et M2 dans ${water2?'l’eau':'l’air'}. Le trajet géométrique dure ${format(m.delay*1000,4)} ms ; le décalage entre maxima des tensions totales vaut ${format(m.signalDelay*1000,4)} ms. Les interférences avant l’interface expliquent leur différence.`:physical?`M2 est à ${format(parameters.distance*100,2)} cm de M1, soit ${format(parameters.distance/m.wavelength)} λ. Son signal reproduit celui de M1 avec un retard total de ${format(m.delay*1000,4)} ms (${format(m.delay/m.period)} T).`:`Le retard de phase est imposé : δ = ${piLabel(m.delta)} rad. Les deux signaux ont la même amplitude ; aucun déplacement physique du microphone n’est déduit.`} {!m.isInterface&&(m.status==='En phase'&&m.delay>0?'Les tensions ont la même phase, mais un nombre entier de périodes sépare les événements correspondants.':m.status==='Opposition de phase'?'Le maximum de l’une correspond au minimum de l’autre, à un facteur d’amplitude près.':m.status==='Quadrature'?'Les phases équivalentes diffèrent d’un quart de tour, à un nombre entier de demi-tours près.':'Observez le décalage horizontal entre les deux voies.')}</p>
      </Callout>
      <Panel title="Du modèle aux équations" icon={<Activity size={15}/>}>
        <div className="dp-equations"><div><span className="lk-eyebrow">EXPRESSIONS GÉNÉRALES · TENSIONS EN VOLTS</span><p className="dp-math dp-channel1">y₁(t) = A₁ sin(2πft + {m.isInterface?'φ₁':'φ₀'})</p><p className="dp-math dp-channel2">y₂(t) = A₂ sin(2πft + {m.isInterface?'φ₂':'φ₀ − δ'})</p></div><div><span className="lk-eyebrow">APPLICATION NUMÉRIQUE · t EN SECONDES</span><p className="dp-math dp-channel1">y₁(t) = {m.isInterface?voltage(m.A1):format(m.A1,6)} sin({format(2*parameters.frequency,0)}πt{phaseTerm(m.phase1)}) V</p><p className="dp-math dp-channel2">y₂(t) = {m.isInterface?voltage(m.A2):format(m.A2,6)} sin({format(2*parameters.frequency,0)}πt{phaseTerm(m.phase2)}) V</p></div></div>
        {m.isInterface&&<p className="dp-small">φ₁ = {piLabel(m.phase1)} rad · φ₂ = {piLabel(m.phase2)} rad · Δφ = φ₂ − φ₁. Les capteurs sont étalonnés avec la même sensibilité en tension par unité de pression.</p>}
        <div className="dp-equations-footer"><span>À l’instant commun : <b className="dp-channel1" data-testid="instant-y1">y₁ = {m.isInterface?voltage(current.y1):format(current.y1,4)} V</b> · <b className="dp-channel2" data-testid="instant-y2">y₂ = {m.isInterface?voltage(current.y2):format(current.y2,4)} V</b></span><span>Δφ équivalent modulo 2π : {format(m.equivalentPhaseDegrees,2)}°</span></div>
      </Panel>
      <details className="dp-theory"><summary><BookOpen size={16}/>Comprendre les mesures et les limites du modèle</summary><div className="dp-theory-grid">
        <article><h3>Le temps et l’espace</h3><p>Un milieu : T = 1/f, λ = c/f, Δt = Δx/c et δ = 2πfΔt. Deux milieux : λ₁ = c₁/f, λ₂ = c₂/f et τ = d₁/c₁ + d₂/c₂. La fréquence est conservée à l’interface.</p></article>
        <article><h3>Un retard, plusieurs tours</h3><p>Deux sinusoïdes seules ne donnent le décalage qu’à un multiple entier de T près. Les totaux du modèle ne sont pas remplacés par leur modulo. Avec réflexion, le temps de parcours est en plus distinct du décalage des signaux totaux.</p></article>
        <article><h3>La pression devient une tension</h3><p>Microphones dans l’air, hydrophones dans l’eau : ils sont étalonnés avec la même sensibilité. Les tensions en volts sont proportionnelles à la pression. Les cercles représentent des phases mathématiques, pas le mouvement des capteurs ou du fluide.</p></article>
        <article><h3>Air et eau</h3><p>Références approchées : 340 m/s dans l’air et 1 480 m/s dans l’eau douce. Les α proposés sont illustratifs. Le choix d’un seul milieu utilise le modèle de divergence sphérique ; une interface utilise des ondes planes à incidence normale, sans divergence 1/r.</p></article>
        <article><h3>Réflexion et transmission</h3><p>Z = ρc. À incidence normale, rₚ = (Z₂ − Z₁)/(Z₂ + Z₁), tₚ = 1 + rₚ, R = rₚ² et 𝒯 = 4Z₁Z₂/(Z₁ + Z₂)². À l’interface, R + 𝒯 = 1. La pression et la vitesse particulaire normale sont continues ; le fort contraste d’impédance explique une énergie transmise faible.</p></article>
        <article><h3>Des interférences stationnaires</h3><p>Avant l’interface, la pression totale est la somme de l’onde incidente et de l’onde réfléchie. Son amplitude varie avec la position. Dans le second milieu, seule l’onde transmise est conservée. Pas de réflexion multiple vers la source ni de résonance de cuve.</p></article>
        <article><h3>Une atténuation spatiale</h3><p>L’absorption atténue les ondes avec les trajets. À position fixe et avec un GBF continu, les amplitudes restent constantes au cours du temps. Les coefficients locaux de l’interface utilisent des impédances réelles ; l’absorption est ajoutée comme facteur spatial phénoménologique.</p></article>
        <article><h3>Une seule horloge</h3><p>Le ralenti ne change ni f, ni T, ni les longueurs d’onde. Les réglages remettent t à zéro. L’onglet masqué, la désactivation et la fermeture arrêtent les animations ; aucune horloge indépendante n’est créée par les vues.</p></article>
      </div></details>
      <div className="dp-lab-footer"><span>Réalisé par Adam — 2ᵉ Bac Sciences Mathématiques</span><Button onClick={()=>setPresentation(v=>!v)} disabled={!active}>{presentation?'Quitter la présentation':'Mode présentation'}</Button></div>
    </LabLayout></div>
  </LabRoot>;
}
export default DephasageLaboratory;
