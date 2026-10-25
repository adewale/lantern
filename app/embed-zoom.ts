/**
 * Zoom and pan for the stage. A 16:9 stage on a phone shows a 14 px label at
 * about 4 px, so the reader enlarges the vector drawing itself: buttons and
 * keys zoom about the centre, pinch and Ctrl-scroll about the fingers or
 * pointer, double-click about the point clicked, and a drag pans once zoomed.
 */
export class StageZoom {
  k = 1;
  x = 0;
  y = 0;
  readonly max = 6;
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
    let pinch = 0;
    stage.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      }
      if (this.k > 1 || pointers.size === 2) stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch) this.zoomAt(d / pinch, ...local({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 }));
        pinch = d;
      } else if (this.k > 1) {
        this.x += e.clientX - last.x;
        this.y += e.clientY - last.y;
        this.apply();
      }
    });
    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    new ResizeObserver(() => this.apply()).observe(stage);
  }

  /** Clamp so the drawing always covers the stage, then paint. `glide` eases discrete steps. */
  apply(glide = false): void {
    const w = this.stage.clientWidth,
      h = this.stage.clientHeight;
    this.k = Math.min(this.max, Math.max(1, this.k));
    this.x = Math.min(0, Math.max(w - w * this.k, this.x));
    this.y = Math.min(0, Math.max(h - h * this.k, this.y));
    const svg = this.stage.querySelector('svg');
    if (svg) {
      svg.classList.toggle('glide', glide);
      svg.style.transformOrigin = '0 0';
      svg.style.transform = this.k === 1 ? '' : `translate(${this.x}px, ${this.y}px) scale(${this.k})`;
    }
    this.stage.classList.toggle('zoomed', this.k > 1);
    this.changed();
  }

  /** Zoom by `factor`, keeping the stage point (px, py) still. */
  zoomAt(factor: number, px = this.stage.clientWidth / 2, py = this.stage.clientHeight / 2, glide = false): void {
    const k = Math.min(this.max, Math.max(1, this.k * factor)),
      r = k / this.k;
    this.x = px - (px - this.x) * r;
    this.y = py - (py - this.y) * r;
    this.k = k;
    this.apply(glide);
  }

  reset(glide = false): void {
    this.k = 1;
    this.x = 0;
    this.y = 0;
    this.apply(glide);
  }
}
