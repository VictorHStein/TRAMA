import { describe, expect, it } from 'vitest';
import { corridorShift, edgeShape, placeBadges, pointAt, type BadgeRequest } from './edgeGeometry';
import { NODE_WIDTH } from './useFlowLayout';

const straight = (x0: number, y0: number, x1: number, y1: number) =>
  edgeShape({ x: x0, y: y0 }, { x: x1, y: y1 }, 'bottom', 'top', 0, 0, false);

describe('placeBadges', () => {
  it('separates badges of edges that share the same path', () => {
    const shape = straight(0, 0, 0, 400);
    const reqs: BadgeRequest[] = [
      { id: 'a', shape, index: 3, priority: 1 },
      { id: 'b', shape, index: 4, priority: 1 },
    ];
    const out = placeBadges(reqs, []);
    const pa = pointAt(shape, out.get('a')!.t);
    const pb = pointAt(shape, out.get('b')!.t);
    expect(out.get('a')!.visible && out.get('b')!.visible).toBe(true);
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeGreaterThanOrEqual(24);
  });

  it('hides a badge only when the sole collision is the same number', () => {
    // Very short edges: every candidate position collides.
    const shape = straight(0, 0, 0, 20);
    const out = placeBadges([
      { id: 'a', shape, index: 3, priority: 1 },
      { id: 'b', shape, index: 3, priority: 1 },
    ], []);
    const visible = [...out.values()].filter((p) => p.visible).length;
    expect(visible).toBe(1);
  });

  it('keeps badges off the cards', () => {
    const shape = straight(0, 0, 0, 400);
    const card = { x: -NODE_WIDTH / 2, y: 180 };     // card sitting on the midpoint
    const out = placeBadges([{ id: 'a', shape, index: 1, priority: 1 }], [card]);
    const p = pointAt(shape, out.get('a')!.t);
    expect(p.y < 180 - 12 || p.y > 180 + 56 + 12).toBe(true);
  });
});

describe('corridorShift', () => {
  it('is zero when nothing blocks the straight path', () => {
    expect(corridorShift({ x: 0, row: 0 }, { x: 0, row: 3 }, [{ x: 600, row: 1 }])).toBe(0);
  });

  it('bows through the gap between cards instead of around the whole row', () => {
    const rows = [
      { x: -NODE_WIDTH, row: 1 }, { x: 40, row: 1 },     // gap of 40 px around x = 20
      { x: -NODE_WIDTH, row: 2 }, { x: 40, row: 2 },
    ];
    const shift = corridorShift({ x: -NODE_WIDTH / 2 - 60, row: 0 }, { x: -NODE_WIDTH / 2 - 60, row: 3 }, rows);
    const mid = -60 + shift * 0.75;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(40);
  });
});
