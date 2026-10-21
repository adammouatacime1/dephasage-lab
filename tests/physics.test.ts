import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PARAMETERS, TAU, PHASE_TOLERANCE, derive, sample, createSignalSampler, positivePhase, signedPhase, phaseStatus, validateParameters, radianLabel, formatNumber, type LabParameters } from '../src/physics/model.ts';

const parameters = (overrides: Partial<LabParameters> = {}): LabParameters => ({ ...DEFAULT_PARAMETERS, ...overrides });
const near = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≈ ${expected}`);

test('conditions initiales : 1 000 Hz, 13,3 cm et longueur d’onde de 34 cm', () => {
  const m = derive(parameters());
  near(m.wavelength, .34); near(m.period * 1000, 1); near(m.delay * 1000, .133 / 340 * 1000);
  near(m.delta, TAU * .133 / .34); near(m.phaseDifference, -m.delta);
  near(m.deltaDegrees, 360 * .133 / .34); assert.equal(m.status, 'Déphasage quelconque');
});

test('Δx = 0 : retard nul et tensions identiques, avec ou sans atténuation', () => {
  for (const attenuation of [false, true]) {
    const p = parameters({distance:0, attenuation}), m = derive(p);
    near(m.delay,0); near(m.delta,0); near(m.ratio,1); assert.equal(m.status,'En phase');
    for (const t of [0,.00013,.00025,.00117]) near(sample(p,t).y1,sample(p,t).y2);
  }
});

for (const ratio of [.25,.5,.75,1,1.5,2,3]) test(`Δx = ${ratio} λ : retard total et statut de phase`, () => {
  const base = parameters(), p = parameters({distance: ratio * derive(base).wavelength}), m = derive(p);
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
