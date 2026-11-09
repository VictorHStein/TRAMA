import { NODE_HEIGHT, NODE_WIDTH } from './useFlowLayout';

/**
 * Edge geometry shared by the flow (which places the numbered badges for all
 * edges at once) and by ArchitectureEdge (which draws each curve). Both must
 * produce the same cubic bezier, otherwise a badge would float off its line.
 */

export type HandleId = 'top' | 'right' | 'bottom' | 'left';

export interface Point { x: number; y: number }

export interface EdgeShape {
  sx: number; sy: number;
  c1x: number; c1y: number;
  c2x: number; c2y: number;
  tx: number; ty: number;
}

export function handleNormal(h: HandleId): Point {
  switch (h) {
    case 'top': return { x: 0, y: -1 };
    case 'right': return { x: 1, y: 0 };
    case 'bottom': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
  }
}

/** Centre of the given side of a card whose top-left corner is `pos`. */
export function handlePoint(pos: Point, h: HandleId): Point {
  switch (h) {
    case 'top': return { x: pos.x + NODE_WIDTH / 2, y: pos.y };
    case 'right': return { x: pos.x + NODE_WIDTH, y: pos.y + NODE_HEIGHT / 2 };
    case 'bottom': return { x: pos.x + NODE_WIDTH / 2, y: pos.y + NODE_HEIGHT };
    case 'left': return { x: pos.x, y: pos.y + NODE_HEIGHT / 2 };
  }
}

/**
 * Cubic bezier leaving and entering each card perpendicular to its side.
 *
 * - Control-point arms grow with the distance, so long edges curve gently.
 * - Edges within one row get short arms: they arc just outside the row
 *   instead of reaching into the neighbouring lane.
 * - Parallel edges between the same pair fan out perpendicular to the chord.
 * - `obstacleShift` bows long cross-row edges through a free corridor.
 */
export function edgeShape(
  s: Point, t: Point, sh: HandleId, th: HandleId,
  pairOffset: number, obstacleShift: number, sameRow: boolean,
  /** Height multiplier for same-row arcs (free vertical room, e.g. the interfaces view). */
  arcScale = 1,
): EdgeShape {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  // Same-row arcs grow with the span, so nested arcs stay distinguishable
  // and the widest one still clears the next lane (≤ ~70 px of rise).
  const extension = sameRow
    ? Math.max(22, Math.min(distance * 0.1 * arcScale, 92 * arcScale))
    : Math.max(50, Math.min(distance * 0.42, 200));
  const sn = handleNormal(sh);
  const tn = handleNormal(th);
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const fan = pairOffset * (sameRow ? 18 : 40);
  return {
    sx: s.x, sy: s.y,
    c1x: s.x + sn.x * extension + perpX * fan + obstacleShift,
    c1y: s.y + sn.y * extension + perpY * fan,
    c2x: t.x + tn.x * extension + perpX * fan + obstacleShift,
    c2y: t.y + tn.y * extension + perpY * fan,
    tx: t.x, ty: t.y,
  };
}

export function shapePath(e: EdgeShape): string {
  return `M ${e.sx} ${e.sy} C ${e.c1x} ${e.c1y} ${e.c2x} ${e.c2y} ${e.tx} ${e.ty}`;
}

export function pointAt(e: EdgeShape, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * e.sx + b * e.c1x + c * e.c2x + d * e.tx,
    y: a * e.sy + b * e.c1y + c * e.c2y + d * e.ty,
  };
}

/* ── Badge placement ─────────────────────────────────────────────── */

export interface BadgeRequest {
  id: string;
  shape: EdgeShape;
  /** Relation type index shown in the badge. */
  index: number;
  /** Higher goes first (selected > in focus > cross-category). */
  priority: number;
}

export interface BadgePlacement { t: number; visible: boolean }

interface Box { x0: number; y0: number; x1: number; y1: number }

const BADGE_BOX = 30;          // badge (≤ 24 px, ring included up to 30) plus a little air
const CANDIDATES = [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8];

function boxAt(p: Point, scale: number): Box {
  const h = (BADGE_BOX * scale) / 2;
  return { x0: p.x - h, y0: p.y - h, x1: p.x + h, y1: p.y + h };
}

/** Smallest on-screen diameter of a resting badge, in CSS px. */
const MIN_BADGE_SCREEN_PX = 16;
const BADGE_PX = 20;

/**
 * Counter-scale for badges when the graph is zoomed out: below the zoom at
 * which a 20 px badge would drop under 16 px on screen, badges grow in flow
 * units so the number stays readable. Quantized to 0.1 so zooming does not
 * re-place badges on every frame; capped so badges never swamp the cards.
 */
export function badgeScaleForZoom(zoom: number): number {
  const s = MIN_BADGE_SCREEN_PX / (BADGE_PX * Math.max(zoom, 0.01));
  return Math.round(Math.min(2.2, Math.max(1, s)) * 10) / 10;
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Greedy, deterministic label placement. Each badge tries a few positions
 * along its own curve and keeps the first that touches neither a card nor a
 * badge already placed. When every position collides it takes the least bad
 * one, except when the only collision is a badge with the same number: then
 * the badge is hidden, because the number on screen already says the same.
 */
export function placeBadges(requests: BadgeRequest[], cards: Point[], scale = 1): Map<string, BadgePlacement> {
  const cardBoxes: Box[] = cards.map((c) => ({ x0: c.x - 2, y0: c.y - 2, x1: c.x + NODE_WIDTH + 2, y1: c.y + NODE_HEIGHT + 2 }));
  const placed: Array<{ box: Box; index: number }> = [];
  const out = new Map<string, BadgePlacement>();

  const chord = (r: BadgeRequest) => Math.hypot(r.shape.tx - r.shape.sx, r.shape.ty - r.shape.sy);
  const order = [...requests].sort((a, b) => (b.priority - a.priority) || (chord(a) - chord(b)) || a.id.localeCompare(b.id));

  for (const r of order) {
    let best: { t: number; cost: number; sameOnly: boolean } | null = null;
    for (const t of CANDIDATES) {
      const box = boxAt(pointAt(r.shape, t), scale);
      let cost = 0;
      let sameOnly = true;
      for (const c of cardBoxes) {
        const o = overlap(box, c);
        if (o > 0) { cost += o * 2; sameOnly = false; }
      }
      for (const p of placed) {
        const o = overlap(box, p.box);
        if (o > 0) { cost += o; if (p.index !== r.index) sameOnly = false; }
      }
      if (cost === 0) { best = { t, cost, sameOnly: false }; break; }
      if (!best || cost < best.cost) best = { t, cost, sameOnly };
    }
    const chosen = best ?? { t: 0.5, cost: 0, sameOnly: false };
    const visible = chosen.cost === 0 || !chosen.sameOnly || r.priority >= 3;
    out.set(r.id, { t: chosen.t, visible });
    if (visible) placed.push({ box: boxAt(pointAt(r.shape, chosen.t), scale), index: r.index });
  }
  return out;
}

/**
 * Horizontal control-point shift that lets a cross-row edge pass through a
 * free corridor of the rows between source and target. Occupied intervals of
 * all intermediate rows are merged first, so the corridor is free in every
 * one of them. Returns 0 when the straight path is already clear.
 */
export function corridorShift(
  src: { x: number; row: number } | undefined,
  tgt: { x: number; row: number } | undefined,
  positions: Iterable<{ x: number; row: number }>,
): number {
  if (!src || !tgt || Math.abs(src.row - tgt.row) < 2) return 0;
  const lo = Math.min(src.row, tgt.row);
  const hi = Math.max(src.row, tgt.row);
  const midX = (src.x + tgt.x) / 2 + NODE_WIDTH / 2;

  const spans: Array<[number, number]> = [];
  for (const p of positions) {
    if (p.row > lo && p.row < hi) spans.push([p.x - 6, p.x + NODE_WIDTH + 6]);
  }
  if (spans.length === 0) return 0;
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  if (!merged.some(([a, b]) => midX >= a && midX <= b)) return 0;

  const MIN_CORRIDOR = 24;
  const gaps: number[] = [];
  for (let i = 0; i < merged.length - 1; i++) {
    if (merged[i + 1][0] - merged[i][1] >= MIN_CORRIDOR) gaps.push((merged[i][1] + merged[i + 1][0]) / 2);
  }
  gaps.push(merged[0][0] - 40, merged[merged.length - 1][1] + 40);
  let best = gaps[0];
  for (const g of gaps) if (Math.abs(g - midX) < Math.abs(best - midX)) best = g;
  // The bezier midpoint moves about 75 % of a shift applied to both control points.
  return (best - midX) / 0.75;
}
