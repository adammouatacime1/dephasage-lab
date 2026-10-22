import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PARAMETERS, MEDIA, changeMedium, changeConfiguration, getSecondMedium, getMediumAt, pressureAt, TAU, PHASE_TOLERANCE, derive, sample, createSignalSampler, positivePhase, signedPhase, phaseStatus, validateParameters, radianLabel, formatNumber, type LabParameters } from '../src/physics/model.ts';

const parameters = (overrides: Partial<LabParameters> = {}): LabParameters => ({ ...DEFAULT_PARAMETERS, ...overrides });
const near = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≈ ${expected}`);

test('conditions initiales : 1 000 Hz, 13,3 cm et longueur d’onde de 34 cm', () => {
  const m = derive(parameters());
  near(m.wavelength, .34); near(m.period * 1000, 1); near(m.delay * 1000, .133 / 340 * 1000);
  near(m.delta, TAU * .133 / .34); near(m.phaseDifference, -m.delta);
  near(m.deltaDegrees, 360 * .133 / .34); assert.equal(m.status, 'Déphasage quelconque');
  assert.equal(DEFAULT_PARAMETERS.medium,'air'); assert.equal(DEFAULT_PARAMETERS.attenuation,true);
  assert.ok(m.A2>0 && m.A2<m.A1);
});

test('Δx = 0 : retard nul et tensions identiques, avec ou sans atténuation', () => {
  for (const attenuation of [false, true]) {
    const p = parameters({distance:0, attenuation}), m = derive(p);
    near(m.delay,0); near(m.delta,0); near(m.ratio,1); assert.equal(m.status,'En phase');
    for (const t of [0,.00013,.00025,.00117]) near(sample(p,t).y1,sample(p,t).y2);
  }
});

for (const ratio of [.25,.5,.75,1,1.5,2,3]) test(`Δx = ${ratio} λ : retard total et statut de phase`, () => {
  const base = parameters(), p = parameters({distance: ratio * derive(base).wavelength,attenuation:false}), m = derive(p);
  near(m.delay,ratio * m.period); near(m.delta,ratio * TAU); near(m.phaseDifference,-ratio * TAU);
  const expected = ratio % 1 === 0 ? 'En phase' : ratio % .5 === 0 ? 'Opposition de phase' : 'Quadrature';
  assert.equal(m.status,expected);
  for (const t of [0,.00017,.00025,.00103]) {
    const s=sample(p,t);
    if (ratio % 1 === 0) near(s.y1,s.y2);
    if (ratio % 1 === .5) near(s.y1,-s.y2);
  }
});

test('un retard total de trois périodes ne devient pas nul à la réduction modulo', () => {
  const p=parameters({distance:3 * .34}), m=derive(p);
  near(m.delay,3*m.period); near(m.delta,6*Math.PI); near(m.equivalentDelta,0); near(m.equivalentPhase,0);
  assert.notEqual(m.delay,0);
});

test('doubler f conserve la position et le retard, double δ et divise λ et T par deux', () => {
  const p=parameters(), a=derive(p), b=derive({...p,frequency:2000});
  near(b.delta,2*a.delta); near(b.wavelength,a.wavelength/2); near(b.period,a.period/2); near(b.delay,a.delay); near(p.distance,.133);
});

test('M2 reçoit la tension de M1 avec le retard total, et non le retard réduit', () => {
  const p=parameters({distance:1.71,attenuation:true}), m=derive(p);
  for(const t of [0,.0001,.00223,.013]) near(sample(p,t).y2,m.ratio * sample(p,t-m.delay).y1);
});

test('divergence sphérique et absorption respectent la formule en mètres', () => {
  const p=parameters({distance:.4,sourceDistance:.2,absorption:.7,attenuation:true}), m=derive(p);
  near(m.ratio,.2/.6*Math.exp(-.7*.4)); near(m.A2,m.A1*m.ratio);
  const remaining=100*m.ratio, lost=100*(1-m.ratio); near(remaining+lost,100);
});

test('éloigner M2 augmente le retard et diminue son amplitude si l’atténuation est activée', () => {
  const p=parameters({attenuation:true}), a=derive({...p,distance:.1}), b=derive({...p,distance:.9});
  assert.ok(b.delay>a.delay); assert.ok(b.delta>a.delta); assert.ok(b.A2<a.A2); near(a.A1,b.A1);
});

test('l’atténuation est spatiale : même amplitude après plusieurs milliers de périodes', () => {
  const p=parameters({distance:.68,attenuation:true,absorption:.4}), m=derive(p);
  // Choisir le maximum propre de M2 et recommencer après des cycles entiers.
  const peak = m.delay + (Math.PI/2-p.initialPhase)/m.omega;
  near(sample(p,peak).y2,m.A2); near(sample(p,peak+10000*m.period).y2,m.A2,1e-8);
});

test('désactiver l’atténuation égalise les amplitudes à toute position', () => {
  for(const distance of [0,.133,1,2]) {
    const m=derive(parameters({distance,attenuation:false,absorption:7})); near(m.A1,m.A2); near(m.ratio,1);
  }
});

test('une absorption nulle conserve la divergence géométrique', () => {
  const m=derive(parameters({distance:.2,attenuation:true,absorption:0})); near(m.ratio,.5);
});

test('cercles normalisés : mêmes rayons et projections pondérées par les tensions propres', () => {
  const p=parameters({attenuation:true,initialPhase:.37}), m=derive(p);
  for(const t of [0,.00013,.0004,.00173]) {
    const s=sample(p,t);
    near(Math.cos(s.theta1)**2+s.projection1**2,1); near(Math.cos(s.theta2)**2+s.projection2**2,1);
    near(s.y1,m.A1*s.projection1); near(s.y2,m.A2*s.projection2); near(s.theta1-s.theta2,m.delta);
  }
});

test('phase libre : δ indépendant de Δx, décalage mathématique et amplitudes égales', () => {
  const p=parameters({mode:'free',freePhaseDegrees:1080,attenuation:true,absorption:3}), a=derive(p), b=derive({...p,distance:2});
  near(a.delta,6*Math.PI); near(a.delay,3*a.period); near(a.delta,b.delta); near(a.A1,a.A2); near(a.ratio,1);
  assert.equal(a.isPhysicalDelay,false); assert.equal(a.status,'En phase'); near(p.distance,.133);
});

test('l’horloge change les phases à la même vitesse, leur différence reste constante', () => {
  const p=parameters(), m=derive(p), a=sample(p,0), b=sample(p,m.period/24);
  near(b.theta1-a.theta1,TAU/24); near(b.theta2-a.theta2,TAU/24); near(b.theta1-b.theta2,m.delta);
});

test('un tour de 24 pas restitue les deux signaux', () => {
  const p=parameters({attenuation:true}), m=derive(p); let t=0;
  for(let step=0;step<24;step++)t+=m.period/24;
  near(sample(p,t).y1,sample(p,0).y1); near(sample(p,t).y2,sample(p,0).y2);
});

test('le constructeur de courbe utilise le même échantillon sans état mutable ni horloge interne', () => {
  const p=parameters({attenuation:true}), expected=sample(p,.000123), curve=createSignalSampler(p);
  assert.deepEqual(curve(.000123),expected);
  p.frequency=2000; p.amplitude=4;
  assert.deepEqual(curve(.000123),expected);
});

test('modulo et tolérance numériques : angles positifs, signés et états remarquables', () => {
  near(positivePhase(-Math.PI/2),3*Math.PI/2); near(signedPhase(Math.PI),-Math.PI); near(positivePhase(-6*TAU),0);
  assert.equal(phaseStatus(TAU+PHASE_TOLERANCE/2),'En phase');
  assert.equal(phaseStatus(Math.PI-PHASE_TOLERANCE/2),'Opposition de phase');
  assert.equal(phaseStatus(3*Math.PI/2+PHASE_TOLERANCE/2),'Quadrature');
  assert.equal(phaseStatus(.3),'Déphasage quelconque');
});

test('présentation française des valeurs et des angles remarquables', () => {
  assert.equal(formatNumber(13.3),'13,3'); assert.equal(formatNumber(-1e-9),'0');
  assert.equal(radianLabel(Math.PI/2),'π/2'); assert.equal(radianLabel(3*Math.PI/2),'3π/2');
  assert.equal(radianLabel(-TAU),'−2π'); assert.equal(radianLabel(Math.PI/4),'π/4'); assert.equal(radianLabel(2e-10),'0');
});

test('les paramètres invalides sont refusés avant tout calcul de la simulation', () => {
  for(const invalid of [{frequency:199},{frequency:2001},{frequency:NaN},{soundSpeed:0},{soundSpeed:Infinity},{amplitude:0},{sourceDistance:0},{distance:-.1},{distance:2.01},{absorption:-.1},{freePhaseDegrees:-1},{initialPhase:NaN}]) {
    assert.throws(()=>derive(parameters(invalid)),RangeError);
  }
  assert.throws(()=>sample(parameters(),Infinity),RangeError);
  assert.doesNotThrow(()=>validateParameters(parameters()));
});

for(const frequency of [200,2000])test(`extrémités physiques à ${frequency} Hz : valeurs finies et cohérence des signaux`,()=>{
  const p=parameters({frequency,distance:2,attenuation:true,absorption:4}),m=derive(p),s=sample(p,.12345);
  assert.ok(Object.values(m).filter(v=>typeof v==='number').every(Number.isFinite));
  assert.ok(m.ratio>=0&&m.ratio<=1);near(s.y2,m.ratio*sample(p,.12345-m.delay).y1,1e-8);
});

test('eau douce : à 1 000 Hz, 148 cm donnent une longueur d’onde et un retard d’une période', () => {
  const p=changeMedium(parameters({distance:1.48}), 'water'), m=derive(p);
  near(m.wavelength,1.48); near(m.period,.001); near(m.delay,.001); near(m.delta,TAU);
  assert.equal(m.status,'En phase'); near(m.equivalentDelta,0); near(m.equivalentPhase,0);
  // Le rapport d’amplitude reste spatial ; être en phase ne signifie pas avoir la même amplitude.
  for(const t of [.00017,.00025,.00103]) near(sample(p,t).y2,m.ratio*sample(p,t).y1);
});

test('changer air → eau réduit le retard et le déphasage à fréquence et position fixes', () => {
  const air=parameters({distance:1.48}), water=changeMedium(air,'water');
  const a=derive(air), w=derive(water);
  assert.ok(w.wavelength>a.wavelength); assert.ok(w.delay<a.delay); assert.ok(w.delta<a.delta);
  near(a.delay,1.48/340); near(w.delay,1.48/1480);
  assert.equal(w.status,'En phase'); assert.equal(a.status,'Déphasage quelconque');
  near(w.period,a.period);
});

test('changer de milieu conserve la position des capteurs, la fréquence et les réglages indépendants', () => {
  const p=parameters({frequency:1400,distance:.913,amplitude:2.5,sourceDistance:.3,initialPhase:.7,freePhaseDegrees:450,attenuation:false});
  const before={...p}, water=changeMedium(p,'water');
  assert.deepEqual(p,before); assert.notEqual(water,p);
  for(const key of ['frequency','distance','amplitude','sourceDistance','initialPhase','freePhaseDegrees','mode'] as const) assert.equal(water[key],p[key]);
  assert.equal(water.medium,'water'); assert.equal(water.attenuation,true);
  const restored=changeMedium({...water,soundSpeed:1520,absorption:1.2,attenuation:false},'air');
  near(restored.soundSpeed,340); near(restored.absorption,.2); assert.equal(restored.attenuation,true);
  near(restored.distance,p.distance); near(restored.frequency,p.frequency);
});

test('les deux milieux produisent une atténuation spatiale sans extinction temporelle du signal continu', () => {
  for(const medium of ['air','water'] as const) {
    const p=changeMedium(parameters({distance:1,amplitude:2}),medium), m=derive(p);
    near(m.ratio,.2/1.2*Math.exp(-p.absorption)); assert.ok(m.A2<m.A1);
    const peak=m.delay+Math.PI/(2*m.omega);
    near(sample(p,peak).y2,m.A2); near(sample(p,peak+5000*m.period).y2,m.A2,1e-8);
    near(derive({...p,attenuation:false}).A2,m.A1);
  }
});

test('les coefficients proposés sont explicitement illustratifs, non des mesures des matériaux', () => {
  for(const preset of Object.values(MEDIA)) {
    assert.match(preset.description,/illustration réglable/);
    assert.match(preset.description,/pas une mesure/);
    assert.ok(preset.illustrativeAbsorption>=0);
  }
});

test('phase libre : changer le milieu conserve le déphasage mathématique et les amplitudes égales', () => {
  const p=parameters({mode:'free',freePhaseDegrees:450,distance:.87}), a=derive(p), water=changeMedium(p,'water'), w=derive(water);
  near(w.delta,a.delta); near(w.delay,a.delay); near(w.A1,w.A2); near(w.ratio,1);
  near(water.distance,p.distance); near(water.freePhaseDegrees,450); assert.equal(w.isPhysicalDelay,false);
});

test('un milieu absent ou inconnu est refusé', () => {
  assert.throws(()=>derive({...parameters(),medium:'oil'} as unknown as LabParameters),RangeError);
  assert.throws(()=>derive({...parameters(),medium:undefined} as unknown as LabParameters),RangeError);
  assert.throws(()=>changeMedium(parameters(),'oil' as 'air'),RangeError);
});

test('les nouveaux réglages conservent le modèle uniforme par défaut', () => {
  const p=parameters(), m=derive(p);
  assert.equal(p.configuration,'uniform'); near(p.interfacePosition,.4);
  near(p.secondSoundSpeed,1480); near(p.secondAbsorption,.05);
  assert.equal(m.isInterface,false); assert.equal(m.firstMedium,'air'); assert.equal(m.secondMedium,'air');
  assert.equal(m.medium1,'air'); assert.equal(m.medium2,'air');
  near(m.reflectionPressure,0); near(m.transmissionPressure,1); near(m.reflectedIntensity,0); near(m.transmittedIntensity,1);
  near(m.phase1,p.initialPhase); near(m.phase2,p.initialPhase-m.delta); near(m.signalDelay,m.delay);
  near(m.propagationPhaseDelay,m.omega*m.delay); near(m.wavelength2,m.wavelength);
  near(m.pathFirst,p.distance); near(m.pathSecond,0);
});

test('sélectionner une interface prépare les deux milieux et place explicitement M2 après la frontière', () => {
  const p=parameters({frequency:1400,distance:.133,interfacePosition:.4,attenuation:false}), before={...p};
  const mixed=changeConfiguration(p,'air-water');
  assert.deepEqual(p,before); assert.notEqual(mixed,p);
  assert.equal(mixed.configuration,'air-water'); assert.equal(mixed.medium,'air'); assert.equal(getSecondMedium(mixed),'water');
  near(mixed.soundSpeed,340); near(mixed.secondSoundSpeed,1480); near(mixed.absorption,.2); near(mixed.secondAbsorption,.05);
  near(mixed.distance,.6); near(mixed.interfacePosition,p.interfacePosition); near(mixed.frequency,p.frequency); assert.equal(mixed.attenuation,true);
  const reversed=changeConfiguration({...mixed,distance:1.7},'water-air');
  assert.equal(reversed.medium,'water'); assert.equal(getSecondMedium(reversed),'air');
  near(reversed.soundSpeed,1480); near(reversed.secondSoundSpeed,340); near(reversed.absorption,.05); near(reversed.secondAbsorption,.2); near(reversed.distance,1.7);
  const end=changeConfiguration(parameters({interfacePosition:1.95}), 'air-water');
  near(end.distance,2); assert.ok(end.distance>end.interfacePosition);
});

test('revenir au milieu uniforme conserve les positions et retire la frontière du calcul', () => {
  const mixed=changeConfiguration(parameters({distance:1.48,frequency:1200}),'air-water');
  const uniform=changeMedium(mixed,'water'), m=derive(uniform);
  assert.equal(uniform.configuration,'uniform'); assert.equal(uniform.medium,'water');
  near(uniform.distance,mixed.distance); near(uniform.interfacePosition,mixed.interfacePosition); near(uniform.frequency,mixed.frequency);
  near(m.delay,uniform.distance/1480); assert.equal(m.isInterface,false); near(m.reflectionPressure,0);
  assert.equal(changeConfiguration(mixed,'uniform').configuration,'uniform');
});

test('masses volumiques et impédances acoustiques sont calculées en unités SI', () => {
  const m=derive(changeConfiguration(parameters(),'air-water'));
  near(MEDIA.air.density,1.2); near(MEDIA.water.density,998);
  near(m.density1,1.2); near(m.density2,998); near(m.impedance1,408); near(m.impedance2,1477040);
  const changed=derive({...changeConfiguration(parameters(),'air-water'),soundSpeed:400,secondSoundSpeed:1500});
  near(changed.impedance1,1.2*400); near(changed.impedance2,998*1500);
});

for(const configuration of ['air-water','water-air'] as const) test(`${configuration} : coefficients de pression et conservation locale de l’intensité`, () => {
  const p=changeConfiguration(parameters(),configuration), m=derive(p), Z1=MEDIA[p.medium].density*p.soundSpeed, Z2=MEDIA[getSecondMedium(p)].density*p.secondSoundSpeed;
  near(m.reflectionPressure,(Z2-Z1)/(Z2+Z1)); near(m.transmissionPressure,2*Z2/(Z1+Z2));
  near(m.reflectedIntensity,m.reflectionPressure**2);
  near(m.transmittedIntensity,m.transmissionPressure**2*Z1/Z2);
  near(m.reflectedIntensity+m.transmittedIntensity,1);
  // Le bouton d’absorption ne doit pas supprimer une réflexion due aux impédances.
  const lossless=derive({...p,attenuation:false});
  near(lossless.reflectionPressure,m.reflectionPressure); near(lossless.transmissionPressure,m.transmissionPressure);
  near(lossless.reflectedIntensity+lossless.transmittedIntensity,1);
});

test('air vers eau : pression transmise presque doublée, mais intensité transmise très faible', () => {
  const p={...changeConfiguration(parameters(),'air-water'),attenuation:false}, m=derive(p);
  assert.ok(m.transmissionPressure>1.999 && m.transmissionPressure<2);
  assert.ok(m.transmittedIntensity>.001 && m.transmittedIntensity<.0012);
  assert.ok(m.reflectedIntensity>.998);
  // Pas de gain d’énergie : le facteur de pression doit être pondéré par Z1/Z2.
  assert.ok(m.transmissionPressure**2>3.99);
  assert.ok(m.transmissionPressure**2*m.impedance1/m.impedance2<.0012);
  near(pressureAt(p,p.interfacePosition).amplitude,p.amplitude*m.transmissionPressure);
});

test('eau vers air : inversion de la pression réfléchie et faible pression transmise', () => {
  const air=derive(changeConfiguration(parameters(),'air-water')), water=derive(changeConfiguration(parameters(),'water-air'));
  assert.ok(water.reflectionPressure<-.999); assert.ok(water.transmissionPressure>0&&water.transmissionPressure<.001);
  near(water.reflectionPressure,-air.reflectionPressure); near(water.transmissionPressure+air.transmissionPressure,2);
  near(water.transmittedIntensity,air.transmittedIntensity); near(water.reflectedIntensity,air.reflectedIntensity);
});

for(const configuration of ['air-water','water-air'] as const) test(`${configuration} : continuité complexe de la pression et de la vitesse normale à l’interface`, () => {
  const p={...changeConfiguration(parameters({amplitude:1.7,initialPhase:.37}),configuration),absorption:.6,secondAbsorption:.15};
  const m=derive(p), b=p.interfacePosition, field=pressureAt(p,b);
  const incidentMagnitude=p.amplitude*Math.exp(-p.absorption*b), angle=p.initialPhase-m.omega*b/p.soundSpeed;
  const incidentReal=incidentMagnitude*Math.cos(angle), incidentImag=incidentMagnitude*Math.sin(angle);
  const reflectedReal=m.reflectionPressure*incidentReal, reflectedImag=m.reflectionPressure*incidentImag;
  near(field.real,incidentReal+reflectedReal); near(field.imag,incidentImag+reflectedImag);
  // La vitesse de l’onde réfléchie porte le signe opposé à sa pression.
  near((incidentReal-reflectedReal)/m.impedance1,field.real/m.impedance2,1e-14);
  near((incidentImag-reflectedImag)/m.impedance1,field.imag/m.impedance2,1e-14);
  const before=pressureAt(p,b-1e-10), after=pressureAt(p,b+1e-10);
  near(before.real,after.real,1e-7); near(before.imag,after.imag,1e-7); near(before.amplitude,after.amplitude,1e-7);
});

test('le milieu du capteur dépend de sa position et bascule exactement à la frontière', () => {
  const p=changeConfiguration(parameters(),'air-water');
  assert.equal(getMediumAt(p,0),'air'); assert.equal(getMediumAt(p,p.interfacePosition-1e-8),'air');
  assert.equal(getMediumAt(p,p.interfacePosition),'water'); assert.equal(getMediumAt(p,2),'water');
  const reversed=changeConfiguration(p,'water-air');
  assert.equal(getMediumAt(reversed,0),'water'); assert.equal(getMediumAt(reversed,2),'air');
  const uniform=changeMedium(p,'air'); assert.equal(getMediumAt(uniform,2),'air');
});

test('trajet mixte : 148 cm utilisent les deux célérités et non une célérité unique', () => {
  const p=changeConfiguration(parameters({distance:1.48,interfacePosition:.4}),'air-water'), m=derive(p);
  near(m.pathFirst,.4); near(m.pathSecond,1.08); near(m.delay,.4/340+1.08/1480);
  near(m.propagationPhaseDelay,TAU*1000*(.4/340+1.08/1480));
  near(m.wavelength,.34); near(m.wavelength2,1.48);
  assert.ok(Math.abs(m.delay-1.48/340)>.001); assert.ok(Math.abs(m.delay-1.48/1480)>.0004);
  assert.equal(m.medium1,'air'); assert.equal(m.medium2,'water');
});

test('M2 avant l’interface reçoit la somme incidente et réfléchie dans le premier milieu', () => {
  const p={...changeConfiguration(parameters({amplitude:1.3,initialPhase:.2}),'air-water'),distance:.133,attenuation:false};
  const m=derive(p), x=p.distance, k=m.omega/p.soundSpeed, r=m.reflectionPressure;
  const real=p.amplitude*(Math.cos(p.initialPhase-k*x)+r*Math.cos(p.initialPhase-k*(2*p.interfacePosition-x)));
  const imag=p.amplitude*(Math.sin(p.initialPhase-k*x)+r*Math.sin(p.initialPhase-k*(2*p.interfacePosition-x)));
  const field=pressureAt(p,x);
  near(field.real,real); near(field.imag,imag); near(m.A2,Math.hypot(real,imag));
  near(m.pathFirst,x); near(m.pathSecond,0); near(m.delay,x/p.soundSpeed); assert.equal(m.medium2,'air');
});

test('le temps de parcours et le décalage des sinusoïdes totales restent distincts en présence de réflexion', () => {
  const p=changeConfiguration(parameters({distance:.8,initialPhase:.3}),'air-water'), m=derive(p);
  near(m.signalDelay,m.delta/m.omega); near(m.phaseDifference,m.phase2-m.phase1);
  assert.ok(Math.abs(m.signalDelay-m.delay)>1e-6);
  const reflected=p.attenuation?m.reflectionPressure*Math.exp(-2*p.absorption*p.interfacePosition):m.reflectionPressure;
  const correction=Math.atan2(-reflected*Math.sin(2*m.omega*p.interfacePosition/p.soundSpeed),1+reflected*Math.cos(2*m.omega*p.interfacePosition/p.soundSpeed));
  near(m.phase1,p.initialPhase+correction); near(m.phase2,p.initialPhase-m.omega*m.delay);
  near(m.delta,m.propagationPhaseDelay+correction);
  for(const t of [.000137,.00043,.00171]) near(sample(p,t).y2,m.ratio*sample(p,t-m.signalDelay).y1);
  assert.ok(Math.abs(sample(p,.000137).y2-m.ratio*sample(p,.000137-m.delay).y1)>.001);
});

test('pression totale à M1 : un nœud par interférence peut rendre A2/A1 supérieur à 1 sans gain d’énergie', () => {
  const p={...changeConfiguration(parameters({interfacePosition:.74}),'water-air'),distance:.37,attenuation:false}, m=derive(p);
  near(m.A1,p.amplitude*(1+m.reflectionPressure)); near(m.A2,p.amplitude*(1-m.reflectionPressure));
  assert.ok(m.A1<.001); assert.ok(m.A2>1.99); assert.ok(m.ratio>3000);
  near(m.reflectedIntensity+m.transmittedIntensity,1);
});

test('le raccordement plan n’ajoute pas de divergence sphérique au champ transmis', () => {
  const p={...changeConfiguration(parameters(),'air-water'),attenuation:true,absorption:0,secondAbsorption:0}, m=derive(p);
  near(pressureAt(p,.6).amplitude,p.amplitude*m.transmissionPressure);
  near(pressureAt(p,1.8).amplitude,pressureAt(p,.6).amplitude);
  const otherReference={...p,sourceDistance:3};
  near(derive(otherReference).A1,m.A1); near(derive(otherReference).A2,m.A2);
});

test('une interface absorbante conserve ses amplitudes au cours du temps, pour les deux sens de propagation', () => {
  for(const configuration of ['air-water','water-air'] as const) {
    const p={...changeConfiguration(parameters({distance:.9}),configuration),absorption:.7,secondAbsorption:.2}, m=derive(p);
    const peak1=(Math.PI/2-m.phase1)/m.omega, peak2=(Math.PI/2-m.phase2)/m.omega;
    near(sample(p,peak1).y1,m.A1); near(sample(p,peak2).y2,m.A2);
    near(sample(p,peak1+10000*m.period).y1,m.A1,1e-8); near(sample(p,peak2+10000*m.period).y2,m.A2,1e-8);
    const expected=p.amplitude*m.transmissionPressure*Math.exp(-p.absorption*p.interfacePosition-p.secondAbsorption*(p.distance-p.interfacePosition));
    near(m.A2,expected);
  }
});

test('les composantes complexes, les projections des cercles et les échantillons de courbes sont identiques', () => {
  for(const configuration of ['air-water','water-air'] as const) {
    const p=changeConfiguration(parameters({initialPhase:.71,amplitude:2.2}),configuration), m=derive(p), curve=createSignalSampler(p);
    const first=pressureAt(p,0), second=pressureAt(p,p.distance);
    near(first.phase,m.phase1); near(second.phase,m.phase2); near(first.amplitude,m.A1); near(second.amplitude,m.A2);
    for(const t of [0,.00017,.00031,.00237]) {
      const value=sample(p,t); assert.deepEqual(curve(t),value);
      near(value.y1,first.real*Math.sin(m.omega*t)+first.imag*Math.cos(m.omega*t));
      near(value.y2,second.real*Math.sin(m.omega*t)+second.imag*Math.cos(m.omega*t));
      near(value.y1,m.A1*value.projection1); near(value.y2,m.A2*value.projection2);
      near(value.theta1-value.theta2,m.delta);
    }
  }
});

test('les tours de phase sont conservés à travers les deux milieux et les paramètres ne déplacent pas les capteurs', () => {
  const p=changeConfiguration(parameters({distance:1.8}),'air-water'), a=derive(p), b=derive({...p,frequency:2000});
  near(b.delay,a.delay); near(b.propagationPhaseDelay,2*a.propagationPhaseDelay);
  near(b.wavelength,a.wavelength/2); near(b.wavelength2,a.wavelength2/2);
  assert.ok(Math.abs(b.phase2)>TAU); near(b.phase2,p.initialPhase-b.omega*b.delay);
  near(p.distance,1.8); near(p.interfacePosition,.4);
});

test('à positions identiques, les capteurs mesurent la même pression totale, même avec une réflexion', () => {
  const p={...changeConfiguration(parameters(),'air-water'),distance:0}, m=derive(p);
  near(m.delay,0); near(m.signalDelay,0); near(m.delta,0); near(m.ratio,1);
  for(const t of [0,.0001,.00025,.00131]) near(sample(p,t).y1,sample(p,t).y2);
});

test('la phase libre ignore l’interface conservée et reste une paire de sinusoïdes idéales', () => {
  const p={...changeConfiguration(parameters({freePhaseDegrees:450,initialPhase:.4}),'water-air'),mode:'free' as const}, m=derive(p);
  assert.equal(m.isInterface,false); assert.equal(m.isPhysicalDelay,false);
  near(m.delta,5*Math.PI/2); near(m.A1,p.amplitude); near(m.A2,p.amplitude); near(m.ratio,1);
  near(m.phase1,p.initialPhase); near(m.phase2,p.initialPhase-5*Math.PI/2); near(m.signalDelay,m.delay);
  near(m.reflectionPressure,0); near(m.transmissionPressure,1);
  const field=pressureAt(p,1.1); near(field.amplitude,p.amplitude); near(field.phase,p.initialPhase);
});

test('les nouveaux paramètres invalides et configurations incohérentes sont refusés', () => {
  for(const invalid of [{configuration:'unknown'},{configuration:'water-air',medium:'air'},{configuration:'air-water',medium:'water'},{interfacePosition:0},{interfacePosition:1.96},{interfacePosition:NaN},{secondSoundSpeed:0},{secondSoundSpeed:Infinity},{secondAbsorption:-.1}]) {
    assert.throws(()=>derive({...parameters(),...invalid} as LabParameters),RangeError);
  }
  assert.throws(()=>changeConfiguration(parameters(),'unknown' as 'uniform'),RangeError);
  assert.throws(()=>pressureAt(parameters(),-.1),RangeError); assert.throws(()=>getMediumAt(parameters(),NaN),RangeError);
});
