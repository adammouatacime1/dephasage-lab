export const TAU = 2 * Math.PI;
export type Mode = 'phase' | 'wave';
export interface Parameters { mode: Mode; frequency: number; velocity: number; amplitude: number; phaseDegrees: number; distance: number }
export const initial: Parameters = { mode: 'phase', frequency: 1, velocity: 2, amplitude: 2, phaseDegrees: 90, distance: 0.5 };
export function reduced(angle: number): number {
  const value = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Math.abs(value) < 1e-10 ? 0 : value;
}
export function physics(p: Parameters) {
  const omega = TAU * p.frequency, period = 1 / p.frequency, wavelength = p.velocity / p.frequency;
  const phase = p.mode === 'wave' ? -TAU * p.distance / wavelength : p.phaseDegrees * Math.PI / 180;
  const phaseReduced = reduced(phase), delay = -phase / omega;
  const status = Math.abs(phaseReduced) < 1e-7 ? 'En phase' : Math.abs(Math.abs(phaseReduced) - Math.PI) < 1e-7 ? 'Opposition de phase' : Math.abs(Math.abs(phaseReduced) - Math.PI / 2) < 1e-7 ? 'Quadrature' : 'Déphasage quelconque';
  return { omega, period, wavelength, phase, phaseReduced, delay, reducedDelay: -phaseReduced / omega, status };
}
export function sample(p: Parameters, t: number) {
  const m = physics(p), thetaA = m.omega * t, thetaB = thetaA + m.phase;
  return { thetaA, thetaB, a: p.amplitude * Math.cos(thetaA), b: p.amplitude * Math.cos(thetaB) };
}
export function waveAt(p: Parameters, x: number, t: number) { const m = physics(p); return p.amplitude * Math.cos(m.omega * t - TAU * x / m.wavelength); }
export function number(value: number, digits = 2) { return (Math.abs(value) < 1e-10 ? 0 : value).toLocaleString('fr-FR', { maximumFractionDigits: digits }); }
export function radians(angle: number) {
  if (Math.abs(angle) < 1e-9) return '0';
  const quarter = angle / (Math.PI / 2), n = Math.round(quarter);
  if (Math.abs(quarter - n) < 1e-7) {
    const sign = n < 0 ? '−' : '', a = Math.abs(n);
    return sign + (a % 2 === 0 ? (a === 2 ? 'π' : `${a / 2}π`) : (a === 1 ? 'π/2' : `${a}π/2`));
  }
  return number(angle, 3);
}
