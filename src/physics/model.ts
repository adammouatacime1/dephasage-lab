/**
 * Modèle partagé du laboratoire de déphasage.
 *
 * Unités internes : secondes, mètres, hertz, radians, volts et m⁻¹.
 * La phase initiale est définie à M1 ; le trajet source → M1 est déjà
 * compris dans cette origine. En présence d'une interface, il s'agit de la
 * phase de l'onde incidente à M1, avant addition de l'onde réfléchie.
 */
export const TAU = 2 * Math.PI;
export const PHASE_TOLERANCE = 1e-6;

export type LaboratoryMode = 'microphones' | 'free';
export type Medium = 'air' | 'water';
export type PropagationConfiguration = 'uniform' | 'air-water' | 'water-air';

export interface MediumPreset {
  label: string;
  /** Masse volumique usuelle approchée en kg/m³. */
  density: number;
  /** Valeur usuelle approchée, vers 20 °C ; peut ensuite être réglée. */
  soundSpeed: number;
  /** Valeur d'illustration réglable, et non une mesure du matériau. */
  illustrativeAbsorption: number;
  description: string;
}

export const MEDIA: Readonly<Record<Medium, Readonly<MediumPreset>>> = Object.freeze({
  air: Object.freeze({
    label: 'Air',
    density: 1.2,
    soundSpeed: 340,
    illustrativeAbsorption: 0.2,
    description: 'Célérité usuelle approchée dans l’air vers 20 °C. Le coefficient d’absorption proposé est une valeur d’illustration réglable, pas une mesure du matériau.',
  }),
  water: Object.freeze({
    label: 'Eau douce',
    density: 998,
    soundSpeed: 1480,
    illustrativeAbsorption: 0.05,
    description: 'Célérité usuelle approchée dans l’eau douce vers 20 °C. Le coefficient d’absorption proposé est une valeur d’illustration réglable, pas une mesure du matériau.',
  }),
});
export type PhaseStatus = 'En phase' | 'Opposition de phase' | 'Quadrature' | 'Déphasage quelconque';

export interface LabParameters {
  medium: Medium;
  configuration: PropagationConfiguration;
  /** Interface repérée en mètres depuis M1. */
  interfacePosition: number;
  secondSoundSpeed: number;
  secondAbsorption: number;
  mode: LaboratoryMode;
  frequency: number;
  soundSpeed: number;
  amplitude: number;
  distance: number;
  sourceDistance: number;
  absorption: number;
  attenuation: boolean;
  freePhaseDegrees: number;
  initialPhase: number;
}

export const DEFAULT_PARAMETERS: Readonly<LabParameters> = Object.freeze({
  medium: 'air',
  configuration: 'uniform',
  interfacePosition: 0.4,
  secondSoundSpeed: MEDIA.water.soundSpeed,
  secondAbsorption: MEDIA.water.illustrativeAbsorption,
  mode: 'microphones',
  frequency: 1000,
  soundSpeed: MEDIA.air.soundSpeed,
  amplitude: 1,
  distance: 0.133,
  sourceDistance: 0.2,
  absorption: MEDIA.air.illustrativeAbsorption,
  attenuation: true,
  freePhaseDegrees: 90,
  initialPhase: 0,
});

export interface PhysicalValues {
  omega: number;
  period: number;
  wavelength: number;
  /** Temps de parcours géométrique total ; mathématique en phase libre. */
  delay: number;
  /** Décalage des sinusoïdes totales, avec l'interférence réfléchie éventuelle. */
  signalDelay: number;
  /** Phase liée au seul parcours géométrique : ω × delay. */
  propagationPhaseDelay: number;
  /** Retard de phase mesuré entre les tensions totales : δ = φ1 − φ2. */
  delta: number;
  /** Différence de phase signée : φ2 − φ1 = −δ. */
  phaseDifference: number;
  /** Représentant de δ dans [0, 2π[. */
  equivalentDelta: number;
  /** Représentant de Δφ dans [−π, π[. */
  equivalentPhase: number;
  deltaDegrees: number;
  phaseDifferenceDegrees: number;
  equivalentDeltaDegrees: number;
  equivalentPhaseDegrees: number;
  ratio: number;
  A1: number;
  A2: number;
  status: PhaseStatus;
  /** Faux en phase libre : aucune distance acoustique n'est déduite. */
  isPhysicalDelay: boolean;
  isInterface: boolean;
  phase1: number;
  phase2: number;
  wavelength2: number;
  reflectionPressure: number;
  transmissionPressure: number;
  reflectedIntensity: number;
  transmittedIntensity: number;
  firstMedium: Medium;
  secondMedium: Medium;
  medium1: Medium;
  medium2: Medium;
  pathFirst: number;
  pathSecond: number;
  density1: number;
  density2: number;
  impedance1: number;
  impedance2: number;
}

export interface SignalSample {
  theta1: number;
  theta2: number;
  projection1: number;
  projection2: number;
  y1: number;
  y2: number;
}

/** Refuse les valeurs non physiques au lieu de propager NaN dans les vues. */
export function validateParameters(p: LabParameters): void {
  if (p.medium !== 'air' && p.medium !== 'water') throw new RangeError('Milieu de propagation invalide.');
  if (p.mode !== 'microphones' && p.mode !== 'free') throw new RangeError('Mode de laboratoire invalide.');
  if (!['uniform', 'air-water', 'water-air'].includes(p.configuration)) throw new RangeError('Configuration de propagation invalide.');
  if (p.configuration === 'air-water' && p.medium !== 'air' || p.configuration === 'water-air' && p.medium !== 'water') throw new RangeError('Le premier milieu doit correspondre à la configuration.');
  const finite: (keyof LabParameters)[] = ['frequency', 'soundSpeed', 'amplitude', 'distance', 'sourceDistance', 'absorption', 'freePhaseDegrees', 'initialPhase', 'interfacePosition', 'secondSoundSpeed', 'secondAbsorption'];
  for (const name of finite) {
    if (!Number.isFinite(p[name])) throw new RangeError(`Le paramètre ${name} doit être fini.`);
  }
  if (p.frequency < 200 || p.frequency > 2000) throw new RangeError('La fréquence doit être comprise entre 200 et 2 000 Hz.');
  if (p.interfacePosition < 0.05 || p.interfacePosition > 1.95) throw new RangeError('L’interface doit être comprise entre 0,05 et 1,95 m depuis M1.');
  if (p.secondSoundSpeed <= 0) throw new RangeError('La célérité du second milieu doit être strictement positive.');
  if (p.secondAbsorption < 0) throw new RangeError('L’absorption du second milieu doit être positive ou nulle.');
  if (p.soundSpeed <= 0) throw new RangeError('La célérité doit être strictement positive.');
  if (p.amplitude <= 0) throw new RangeError('L’amplitude de référence doit être strictement positive.');
  if (p.distance < 0 || p.distance > 2) throw new RangeError('La distance doit être comprise entre 0 et 2 m.');
  if (p.sourceDistance <= 0) throw new RangeError('La position de M1 doit être strictement positive.');
  if (p.absorption < 0) throw new RangeError('Le coefficient d’absorption doit être positif ou nul.');
  if (p.freePhaseDegrees < 0) throw new RangeError('Le retard de phase libre doit être positif ou nul.');
  if (typeof p.attenuation !== 'boolean') throw new RangeError('Le choix d’atténuation doit être booléen.');
}

/**
 * Change le milieu sans déplacer les capteurs ni modifier le GBF.
 * L'absorption est une présélection illustrative ; l'atténuation est spatiale.
 */
export function changeMedium(p: LabParameters, medium: Medium): LabParameters {
  if (medium !== 'air' && medium !== 'water') throw new RangeError('Milieu de propagation invalide.');
  const preset = MEDIA[medium];
  const next: LabParameters = {
    ...p,
    medium,
    configuration: 'uniform',
    soundSpeed: preset.soundSpeed,
    absorption: preset.illustrativeAbsorption,
    attenuation: true,
  };
  validateParameters(next);
  return next;
}

export function positivePhase(angle: number): number {
  const value = ((angle % TAU) + TAU) % TAU;
  return value < 1e-10 || TAU - value < 1e-10 ? 0 : value;
}

export function signedPhase(angle: number): number {
  const positive = positivePhase(angle);
  const value = positive >= Math.PI ? positive - TAU : positive;
  return Math.abs(value) < 1e-10 ? 0 : value;
}

export function phaseStatus(delta: number): PhaseStatus {
  const phase = positivePhase(delta);
  if (Math.min(phase, TAU - phase) < PHASE_TOLERANCE) return 'En phase';
  if (Math.abs(phase - Math.PI) < PHASE_TOLERANCE) return 'Opposition de phase';
  if (Math.min(Math.abs(phase - Math.PI / 2), Math.abs(phase - 3 * Math.PI / 2)) < PHASE_TOLERANCE) return 'Quadrature';
  return 'Déphasage quelconque';
}

/** Choisit le milieu après l'interface, sans déduire de célérité depuis un nom de fichier. */
export function getSecondMedium(p: LabParameters): Medium {
  return p.configuration === 'air-water' ? 'water' : p.configuration === 'water-air' ? 'air' : p.medium;
}

/** À l'interface exacte, le capteur est classé dans le second milieu. */
export function getMediumAt(p: LabParameters, position: number): Medium {
  if (!Number.isFinite(position) || position < 0) throw new RangeError('La position doit être finie et positive ou nulle.');
  return p.configuration === 'uniform' || position < p.interfacePosition ? p.medium : getSecondMedium(p);
}

/**
 * Prépare une interface en conservant le GBF et la position de la frontière.
 * M2 est placé dans le second milieu uniquement lors de ce changement explicite.
 */
export function changeConfiguration(p: LabParameters, configuration: PropagationConfiguration): LabParameters {
  if (!['uniform', 'air-water', 'water-air'].includes(configuration)) throw new RangeError('Configuration de propagation invalide.');
  if (configuration === 'uniform') return changeMedium(p, p.medium);
  const medium: Medium = configuration === 'air-water' ? 'air' : 'water';
  const secondMedium: Medium = medium === 'air' ? 'water' : 'air';
  const next: LabParameters = {
    ...p, configuration, medium,
    soundSpeed: MEDIA[medium].soundSpeed,
    absorption: MEDIA[medium].illustrativeAbsorption,
    secondSoundSpeed: MEDIA[secondMedium].soundSpeed,
    secondAbsorption: MEDIA[secondMedium].illustrativeAbsorption,
    distance: Math.min(2, Math.max(p.distance, p.interfacePosition + .2)),
    attenuation: true,
  };
  validateParameters(next);
  return next;
}

export interface PressurePhasor {
  /** Amplitude de la tension proportionnelle à la pression totale. */
  amplitude: number;
  /** Phase déroulée, incluant initialPhase. */
  phase: number;
  medium: Medium;
  /** y(x,t) = real sin(ωt) + imag cos(ωt). */
  real: number;
  imag: number;
}

function interfaceProperties(p: LabParameters) {
  const firstMedium = p.medium, secondMedium = getSecondMedium(p);
  const density1 = MEDIA[firstMedium].density, density2 = MEDIA[secondMedium].density;
  const c2 = p.configuration === 'uniform' ? p.soundSpeed : p.secondSoundSpeed;
  const impedance1 = density1 * p.soundSpeed, impedance2 = density2 * c2;
  if (![impedance1, impedance2].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Les impédances doivent être finies et strictement positives.');
  const sum = impedance1 + impedance2;
  if (!Number.isFinite(sum)) throw new RangeError('La somme des impédances doit rester finie.');
  const reflectionPressure = (impedance2 - impedance1) / sum;
  return {
    firstMedium, secondMedium, density1, density2, impedance1, impedance2,
    reflectionPressure, transmissionPressure: 1 + reflectionPressure,
    reflectedIntensity: reflectionPressure ** 2,
    transmittedIntensity: 4 * (impedance1 / sum) * (impedance2 / sum),
  };
}

function phasor(amplitude: number, phase: number, medium: Medium): PressurePhasor {
  return { amplitude, phase, medium, real: amplitude * Math.cos(phase), imag: amplitude * Math.sin(phase) };
}

/**
 * Champ harmonique pur, sans horloge interne.
 *
 * Uniforme : modèle illustratif de divergence sphérique antérieur.
 * Interface : onde plane à incidence normale, pression incidente + réfléchie
 * avant la frontière, pression transmise après. L'absorption est un facteur
 * spatial phénoménologique ; les coefficients locaux utilisent les impédances
 * réelles ρc. Aucune divergence 1/r n'est ajoutée au raccordement plan.
 */
export function pressureAt(p: LabParameters, position: number): PressurePhasor {
  validateParameters(p);
  if (!Number.isFinite(position) || position < 0) throw new RangeError('La position doit être finie et positive ou nulle.');
  const medium = getMediumAt(p, position), omega = TAU * p.frequency;
  if (p.mode === 'free') return phasor(p.amplitude, p.initialPhase, medium);
  if (p.configuration === 'uniform') {
    const ratio = p.attenuation ? p.sourceDistance / (p.sourceDistance + position) * Math.exp(-p.absorption * position) : 1;
    return phasor(p.amplitude * ratio, p.initialPhase - omega * position / p.soundSpeed, medium);
  }
  const properties = interfaceProperties(p), b = p.interfacePosition;
  const alpha1 = p.attenuation ? p.absorption : 0, alpha2 = p.attenuation ? p.secondAbsorption : 0;
  if (position < b) {
    const remaining = b - position, reflection = properties.reflectionPressure * Math.exp(-2 * alpha1 * remaining);
    const angle = 2 * omega * remaining / p.soundSpeed;
    const factorReal = 1 + reflection * Math.cos(angle), factorImag = -reflection * Math.sin(angle);
    const magnitude = Math.hypot(factorReal, factorImag);
    // Re(1 + r exp(-2γL)) > 0 : cet argument principal reste continu.
    const correction = Math.atan2(factorImag, factorReal);
    return phasor(p.amplitude * Math.exp(-alpha1 * position) * magnitude,
      p.initialPhase - omega * position / p.soundSpeed + correction, medium);
  }
  const pathSecond = position - b;
  const delay = b / p.soundSpeed + pathSecond / p.secondSoundSpeed;
  const amplitude = p.amplitude * properties.transmissionPressure * Math.exp(-alpha1 * b - alpha2 * pathSecond);
  return phasor(amplitude, p.initialPhase - omega * delay, medium);
}

export function derive(p: LabParameters): PhysicalValues {
  validateParameters(p);
  const omega = TAU * p.frequency, period = 1 / p.frequency;
  const wavelength = p.soundSpeed / p.frequency;
  const isPhysicalDelay = p.mode === 'microphones';
  const isInterface = isPhysicalDelay && p.configuration !== 'uniform';
  const properties = interfaceProperties(p);
  const pathFirst = !isPhysicalDelay ? 0 : isInterface ? Math.min(p.distance, p.interfacePosition) : p.distance;
  const pathSecond = isInterface ? Math.max(p.distance - p.interfacePosition, 0) : 0;
  let phase1: number, phase2: number, A1: number, A2: number, delay: number;
  if (p.mode === 'free') {
    phase1 = p.initialPhase;
    phase2 = phase1 - p.freePhaseDegrees * Math.PI / 180;
    A1 = A2 = p.amplitude;
    delay = p.freePhaseDegrees * Math.PI / 180 / omega;
  } else {
    const first = pressureAt(p, 0), second = pressureAt(p, p.distance);
    phase1 = first.phase; phase2 = second.phase; A1 = first.amplitude; A2 = second.amplitude;
    delay = pathFirst / p.soundSpeed + (isInterface ? pathSecond / p.secondSoundSpeed : 0);
  }
  const delta = phase1 === phase2 ? 0 : phase1 - phase2;
  const phaseDifference = delta === 0 ? 0 : -delta;
  const equivalentDelta = positivePhase(delta), equivalentPhase = signedPhase(phaseDifference);
  return {
    omega, period, wavelength, delay, delta, phaseDifference,
    signalDelay: delta / omega, propagationPhaseDelay: omega * delay,
    equivalentDelta, equivalentPhase,
    deltaDegrees: delta * 180 / Math.PI,
    phaseDifferenceDegrees: phaseDifference * 180 / Math.PI,
    equivalentDeltaDegrees: equivalentDelta * 180 / Math.PI,
    equivalentPhaseDegrees: equivalentPhase * 180 / Math.PI,
    ratio: A2 / A1, A1, A2,
    status: phaseStatus(delta), isPhysicalDelay, isInterface, phase1, phase2,
    wavelength2: (p.configuration === 'uniform' ? p.soundSpeed : p.secondSoundSpeed) / p.frequency,
    ...properties,
    reflectionPressure: isInterface ? properties.reflectionPressure : 0,
    transmissionPressure: isInterface ? properties.transmissionPressure : 1,
    reflectedIntensity: isInterface ? properties.reflectedIntensity : 0,
    transmittedIntensity: isInterface ? properties.transmittedIntensity : 1,
    medium1: getMediumAt(p, 0), medium2: getMediumAt(p, p.distance),
    pathFirst, pathSecond,
  };
}

function evaluate(omega: number, phase1: number, phase2: number, A1: number, A2: number, t: number): SignalSample {
  if (!Number.isFinite(t)) throw new RangeError('Le temps doit être fini.');
  const theta1 = omega * t + phase1, theta2 = omega * t + phase2;
  const projection1 = Math.sin(theta1), projection2 = Math.sin(theta2);
  return { theta1, theta2, projection1, projection2, y1: A1 * projection1, y2: A2 * projection2 };
}

/** Même échantillon pour les points tournants et l'oscilloscope. */
export function sample(p: LabParameters, t: number): SignalSample {
  const m = derive(p);
  return evaluate(m.omega, m.phase1, m.phase2, m.A1, m.A2, t);
}

/** Évite de recalculer les paramètres pour chaque sommet d'une courbe SVG. */
export function createSignalSampler(p: LabParameters): (t: number) => SignalSample {
  const m = derive(p);
  return t => evaluate(m.omega, m.phase1, m.phase2, m.A1, m.A2, t);
}

export function formatNumber(value: number, digits = 3): string {
  const clean = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return clean.toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

/** Écriture exacte des multiples de π/4 ; valeur décimale dans les autres cas. */
export function radianLabel(angle: number): string {
  if (Math.abs(angle) < 1e-10) return '0';
  const quarters = angle / (Math.PI / 4), rounded = Math.round(quarters);
  if (Math.abs(quarters - rounded) >= 1e-7) return formatNumber(angle, 3);
  if (rounded === 0) return '0';
  const sign = rounded < 0 ? '−' : '';
  let numerator = Math.abs(rounded), denominator = 4;
  while (denominator > 1 && numerator % 2 === 0) { numerator /= 2; denominator /= 2; }
  return `${sign}${numerator === 1 ? '' : numerator}π${denominator === 1 ? '' : `/${denominator}`}`;
}
