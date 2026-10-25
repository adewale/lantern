/**
 * Zoom and pan for the stage. A 16:9 stage on a phone shows a 14 px label at
 * about 4 px, so the reader enlarges the vector drawing itself: buttons and
 * keys zoom about the centre, pinch and Ctrl-scroll about the fingers or
 * pointer, double-click about the point clicked. Once zoomed, a drag pans, and
 * so does a click or tap, which centres the point under it (no drag needed).
 */
/** A zoom: scale `k` about the stage's top-left corner, then a pan of (x, y) stage pixels. */
export interface Zoom {
  k: number;
  x: number;
  y: number;
}
export const ZOOM_MAX = 6;
export const IDENTITY: Readonly<Zoom> = Object.freeze({ k: 1, x: 0, y: 0 });

/** Clamp so the drawing always covers a `w`×`h` stage: 1 ≤ k ≤ max, and no gap at any edge. */
export function clampZoom(z: Zoom, w: number, h: number, max = ZOOM_MAX): Zoom {
  // Math.min/max pass NaN through; a NaN component falls back to the identity's.
  const k = Number.isNaN(z.k) ? 1 : Math.min(max, Math.max(1, z.k));
  const pan = (p: number, side: number) => {
    // The left-most pan that still covers is side - side*k. When side*k is large that
    // subtraction rounds, sometimes leaving a sliver uncovered, so step right until it covers.
    const span = side * k;
    let lowest = side - span;
    for (let i = 0; i < 4 && lowest + span < side; i++) lowest += Math.abs(lowest) * 2 * Number.EPSILON;
    return Number.isNaN(p) ? 0 : Math.min(0, Math.max(lowest, p));
  };
  return { k, x: pan(z.x, w), y: pan(z.y, h) };
}

/** Zoom by `factor`, keeping the stage point (px, py) still, then clamp. */
export function zoomAt(z: Zoom, factor: number, px: number, py: number, w: number, h: number, max = ZOOM_MAX): Zoom {
  const k = Math.min(max, Math.max(1, z.k * factor)),
    r = k / z.k;
  // No scale change (a factor of 1, or more zoom at a limit) moves nothing; without
  // this, px - (px - x) rounds and the drawing creeps. A NaN factor or a point at
  // infinity has no meaning, so it changes nothing either.
  if (k === z.k || Number.isNaN(factor) || !Number.isFinite(px) || !Number.isFinite(py)) return clampZoom(z, w, h, max);
  return clampZoom({ k, x: px - (px - z.x) * r, y: py - (py - z.y) * r }, w, h, max);
}

/** Move the drawing by (dx, dy) stage pixels, then clamp. */
export function panBy(z: Zoom, dx: number, dy: number, w: number, h: number, max = ZOOM_MAX): Zoom {
  // A NaN delta has no direction: that axis stays put.
  return clampZoom({ k: z.k, x: Number.isNaN(dx) ? z.x : z.x + dx, y: Number.isNaN(dy) ? z.y : z.y + dy }, w, h, max);
}

/** The CSS transform that paints `z` (with transform-origin 0 0); empty at the identity. */
export function zoomTransform(z: Zoom): string {
  return z.k === 1 ? '' : `translate(${z.x}px, ${z.y}px) scale(${z.k})`;
}

export class StageZoom {
  k = 1;
  x = 0;
  y = 0;
  readonly max = ZOOM_MAX;
  private readonly stage: HTMLElement;
  private readonly changed: () => void;

  constructor(stage: HTMLElement, changed: () => void) {
    this.stage = stage;
    this.changed = changed;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    stage.addEventListener(
      'wheel',
      (e) => {
        // Trackpad pinch arrives as ctrl+wheel; a plain wheel keeps scrolling the page.
        if (!e.ctrlKey) return;
        e.preventDefault();
        this.zoomAt(Math.exp(-e.deltaY / 100), ...local(e));
      },
      { passive: false },
    );
    stage.addEventListener('dblclick', (e) => {
      if (this.k > 1) this.reset(true);
      else this.zoomAt(2.5, ...local(e), true);
    });
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0,
      // How far the pointer has moved since it went down: a click after a drag is the drag's end.
      travel = 0;
    stage.addEventListener('click', (e) => {
      if (this.k <= 1 || travel > 4) return;
      const [px, py] = local(e);
      this.pan(stage.clientWidth / 2 - px, stage.clientHeight / 2 - py, true);
    });
    // A pinch measures from the distance between exactly two fingers when that pair formed;
    // any change to the set of fingers starts a new measurement.
    const regroup = () => {
      const [a, b] = [...pointers.values()];
      pinch = pointers.size === 2 ? Math.hypot(a!.x - b!.x, a!.y - b!.y) : 0;
    };
    stage.addEventListener('pointerdown', (e) => {
      travel = 0;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      regroup();
      // Capture every pointer, so its pointerup arrives here even off the stage; a lost
      // pointerup would leave a phantom finger that turns the next touch into a pinch.
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      travel += Math.hypot(e.clientX - last.x, e.clientY - last.y);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch) this.zoomAt(d / pinch, ...local({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 }));
        pinch = d;
      } else if (this.k > 1) this.pan(e.clientX - last.x, e.clientY - last.y);
    });
    const release = (e: PointerEvent) => {
      if (pointers.delete(e.pointerId)) regroup();
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    // A captured pointer can leave without pointerup; it must not stay a pinch partner.
    stage.addEventListener('lostpointercapture', release);
    new ResizeObserver(() => this.apply()).observe(stage);
  }

  /** Clamp so the drawing always covers the stage, then paint. `glide` eases discrete steps. */
  apply(glide = false): void {
    const w = this.stage.clientWidth,
      h = this.stage.clientHeight;
    // A resize (a phone turning) keeps the same part of the drawing in view: the pan is in
    // stage pixels, so it scales with the stage.
    const z = this.size && this.size[0] > 0 && this.size[1] > 0 && (this.size[0] !== w || this.size[1] !== h)
      ? { k: this.k, x: (this.x * w) / this.size[0], y: (this.y * h) / this.size[1] }
      : this;
    this.size = [w, h];
    this.set(clampZoom(z, w, h, this.max), glide);
  }
  private size: [number, number] | null = null;

  /** Adopt an already clamped zoom, then paint. */
  private set(z: Zoom, glide = false): void {
    this.k = z.k;
    this.x = z.x;
    this.y = z.y;
    const svg = this.stage.querySelector('svg');
    if (svg) {
      svg.classList.toggle('glide', glide);
      svg.style.transformOrigin = '0 0';
      svg.style.transform = zoomTransform(this);
    }
    this.stage.classList.toggle('zoomed', this.k > 1);
    this.changed();
  }

  /** Zoom by `factor`, keeping the stage point (px, py) still. */
  zoomAt(factor: number, px = this.stage.clientWidth / 2, py = this.stage.clientHeight / 2, glide = false): void {
    this.set(zoomAt(this, factor, px, py, this.stage.clientWidth, this.stage.clientHeight, this.max), glide);
  }

  /** Move the drawing by (dx, dy) stage pixels. */
  pan(dx: number, dy: number, glide = false): void {
    this.set(panBy(this, dx, dy, this.stage.clientWidth, this.stage.clientHeight, this.max), glide);
  }

  /** Go to a zoom worked out elsewhere (a step's close-up), clamped to this stage. */
  to(z: Zoom, glide = false): void {
    const w = this.stage.clientWidth,
      h = this.stage.clientHeight;
    // Worked out for this size, so a later resize scales the pan from here.
    this.size = [w, h];
    this.set(clampZoom(z, w, h, this.max), glide);
  }

  reset(glide = false): void {
    this.set(clampZoom(IDENTITY, this.stage.clientWidth, this.stage.clientHeight, this.max), glide);
  }
}
