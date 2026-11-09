import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Textures for the satellite, drawn on a canvas so the app stays offline and
 * adds no image files. Both are purely visual: the sizes of the parts still
 * come from the model (see satelliteDims in PhysicalScene).
 */

/** Small deterministic generator: the foil looks the same on every load. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function toTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** One repeating tile of 4 × 4 solar cells: dark blue, thin busbars, lighter gaps. */
export function solarCellTexture(): CanvasTexture {
  const size = 512;
  const cells = 4;
  const pitch = size / cells;
  const [c, g] = canvas(size);
  const rnd = random(7);
  g.fillStyle = '#2b333f';
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const px = x * pitch + 2;
      const py = y * pitch + 2;
      const side = pitch - 4;
      // Cells differ slightly in tone, as real strings do.
      const shade = rnd() * 0.06;
      const grad = g.createLinearGradient(px, py, px + side, py + side);
      grad.addColorStop(0, `rgb(${16 + shade * 80}, ${30 + shade * 120}, ${82 + shade * 220})`);
      grad.addColorStop(1, `rgb(${9 + shade * 60}, ${17 + shade * 90}, ${52 + shade * 180})`);
      g.fillStyle = grad;
      g.fillRect(px, py, side, side);
      g.strokeStyle = 'rgba(190, 205, 225, 0.28)';
      g.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        const lx = px + (side * i) / 3;
        g.beginPath();
        g.moveTo(lx, py);
        g.lineTo(lx, py + side);
        g.stroke();
      }
      g.strokeStyle = 'rgba(190, 205, 225, 0.07)';
      for (let i = 1; i < 12; i++) {
        const ly = py + (side * i) / 12;
        g.beginPath();
        g.moveTo(px, ly);
        g.lineTo(px + side, ly);
        g.stroke();
      }
    }
  }
  return toTexture(c);
}

/**
 * Crumpled foil: a few long facets and creases. Many small ones read as cork,
 * not as metal. The same seed draws colour and relief, so they line up.
 */
function foil(base: string, light: string, dark: string, facetAlpha: number, creaseAlpha: number): HTMLCanvasElement {
  const size = 512;
  const [c, g] = canvas(size);
  const rnd = random(23);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 70 + rnd() * 190;
    const a = rnd() * Math.PI * 2;
    const w = 12 + rnd() * 42;
    const tone = rnd() > 0.5 ? light : dark;
    g.fillStyle = `rgba(${tone}, ${facetAlpha * (0.5 + rnd())})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.lineTo(x + Math.cos(a) * r * 0.6 - Math.sin(a) * w, y + Math.sin(a) * r * 0.6 + Math.cos(a) * w);
    g.closePath();
    g.fill();
  }
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 50 + rnd() * 170;
    const a = rnd() * Math.PI * 2;
    g.strokeStyle = `rgba(${rnd() > 0.5 ? light : dark}, ${creaseAlpha})`;
    g.lineWidth = 0.5 + rnd() * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  return c;
}

/** Multi-layer insulation: gold foil. */
export function mliTexture(): CanvasTexture {
  return toTexture(foil('#b47c24', '255, 216, 128', '92, 54, 12', 0.1, 0.22));
}

/** Relief of the foil, for the highlights to break up on. */
export function mliBumpTexture(): CanvasTexture {
  const t = toTexture(foil('#808080', '255, 255, 255', '0, 0, 0', 0.12, 0.3));
  t.colorSpace = NoColorSpace;
  return t;
}
