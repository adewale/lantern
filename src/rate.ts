// Rate functions: [0,1] -> [0,1], mapping normalized time to animation alpha.

export type RateFunc = (t: number) => number;

export const linear: RateFunc = (t) => t;
// Quintic smoothstep: zero first and second derivative at both ends (manim's `smooth`)
export const smooth: RateFunc = (t) => { const s = Math.min(Math.max(t, 0), 1); return s * s * s * (s * (6 * s - 15) + 10); };
export const rushInto: RateFunc = (t) => 2 * smooth(t / 2);
export const rushFrom: RateFunc = (t) => 2 * smooth(t / 2 + 0.5) - 1;
export const thereAndBack: RateFunc = (t) => (t < 0.5 ? smooth(2 * t) : smooth(2 * (1 - t)));
export const easeInQuad: RateFunc = (t) => t * t;
export const easeOutQuad: RateFunc = (t) => 1 - (1 - t) * (1 - t);
// Exact at the ends: the polynomial leaves 2.2e-16 at t = 0, so the first frame would not be the start
export const easeOutBack: RateFunc = (t) => { if (t <= 0) return 0; if (t >= 1) return 1; const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
export const wiggle: RateFunc = (t) => thereAndBack(t) * Math.sin(4 * Math.PI * t);
export const clip = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);
