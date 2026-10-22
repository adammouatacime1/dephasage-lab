/**
 * Modèle partagé du laboratoire de déphasage.
 *
 * Unités internes : secondes, mètres, hertz, radians, volts et m⁻¹.
 * La phase initiale est définie à M1 ; le trajet haut-parleur → M1
 * est déjà compris dans cette origine de phase.
 */
export const TAU = 2 * Math.PI;
export const PHASE_TOLERANCE = 1e-6;

export type LaboratoryMode = 'microphones' | 'free';
export type Medium = 'air' | 'water';

export interface MediumPreset {
  label: string;
  /** Valeur usuelle approchée, vers 20 °C ; peut ensuite être réglée. */
  soundSpeed: number;
  /** Valeur d'illustration réglable, et non une mesure du matériau. */
  illustrativeAbsorption: number;
  description: string;
}

export const MEDIA: Readonly<Record<Medium, Readonly<MediumPreset>>> = Object.freeze({
  air: Object.freeze({
    label: 'Air',
    soundSpeed: 340,
    illustrativeAbsorption: 0.2,
    description: 'Célérité usuelle approchée dans l’air vers 20 °C. Le coefficient d’absorption proposé est une valeur d’illustration réglable, pas une mesure du matériau.',
  }),
  water: Object.freeze({
    label: 'Eau douce',
    soundSpeed: 1480,
    illustrativeAbsorption: 0.05,
    description: 'Célérité usuelle approchée dans l’eau douce vers 20 °C. Le coefficient d’absorption proposé est une valeur d’illustration réglable, pas une mesure du matériau.',
  }),
});
export type PhaseStatus = 'En phase' | 'Opposition de phase' | 'Quadrature' | 'Déphasage quelconque';

export interface LabParameters {
  medium: Medium;
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
  /** Retard total, sans réduction modulo T. Mathématique en phase libre. */
  delay: number;
  /** Retard de phase positif : δ = ωΔt. */
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
  const finite: (keyof LabParameters)[] = ['frequency', 'soundSpeed', 'amplitude', 'distance', 'sourceDistance', 'absorption', 'freePhaseDegrees', 'initialPhase'];
  for (const name of finite) {
    if (!Number.isFinite(p[name])) throw new RangeError(`Le paramètre ${name} doit être fini.`);
  }
  if (p.frequency < 200 || p.frequency > 2000) throw new RangeError('La fréquence doit être comprise entre 200 et 2 000 Hz.');
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

export function derive(p: LabParameters): PhysicalValues {
  validateParameters(p);
  const omega = TAU * p.frequency;
  const period = 1 / p.frequency;
  const wavelength = p.soundSpeed / p.frequency;
  const isPhysicalDelay = p.mode === 'microphones';
  const delta = isPhysicalDelay ? omega * p.distance / p.soundSpeed : p.freePhaseDegrees * Math.PI / 180;
  const delay = isPhysicalDelay ? p.distance / p.soundSpeed : delta / omega;
  const phaseDifference = delta === 0 ? 0 : -delta;
  const equivalentDelta = positivePhase(delta);
  const equivalentPhase = signedPhase(phaseDifference);
  // L'atténuation est une propriété spatiale de l'expérience acoustique.
  // En phase libre, les tensions ont des amplitudes égales et aucun trajet
  // acoustique n'est imposé par le réglage mathématique de δ.
  const ratio = isPhysicalDelay && p.attenuation
    ? p.sourceDistance / (p.sourceDistance + p.distance) * Math.exp(-p.absorption * p.distance)
    : 1;
  return {
    omega, period, wavelength, delay, delta, phaseDifference,
    equivalentDelta, equivalentPhase,
    deltaDegrees: delta * 180 / Math.PI,
    phaseDifferenceDegrees: phaseDifference * 180 / Math.PI,
    equivalentDeltaDegrees: equivalentDelta * 180 / Math.PI,
    equivalentPhaseDegrees: equivalentPhase * 180 / Math.PI,
    ratio, A1: p.amplitude, A2: p.amplitude * ratio,
    status: phaseStatus(delta), isPhysicalDelay,
  };
}

function evaluate(omega: number, phase: number, delta: number, A1: number, A2: number, t: number): SignalSample {
  if (!Number.isFinite(t)) throw new RangeError('Le temps doit être fini.');
  const theta1 = omega * t + phase;
  const theta2 = theta1 - delta;
  const projection1 = Math.sin(theta1);
  const projection2 = Math.sin(theta2);
  return { theta1, theta2, projection1, projection2, y1: A1 * projection1, y2: A2 * projection2 };
}

/** Même échantillon pour les points tournants et l'oscilloscope. */
export function sample(p: LabParameters, t: number): SignalSample {
  const m = derive(p);
  return evaluate(m.omega, p.initialPhase, m.delta, m.A1, m.A2, t);
}

/** Évite de recalculer les paramètres pour chaque sommet d'une courbe SVG. */
export function createSignalSampler(p: LabParameters): (t: number) => SignalSample {
  const m = derive(p), initialPhase = p.initialPhase;
  return t => evaluate(m.omega, initialPhase, m.delta, m.A1, m.A2, t);
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
