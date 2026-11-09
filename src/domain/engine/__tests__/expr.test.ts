import { describe, expect, it } from 'vitest';
import { collectDependencies, evaluate, parse, type ModelShape } from '../expr';

const shape: ModelShape = {
  children: (id) => (id === 'eps' ? ['battery', 'solar'] : id === 'sat' ? ['eps', 'obc'] : []),
  descendants: (id) => (id === 'sat' ? ['eps', 'obc', 'battery', 'solar'] : id === 'eps' ? ['battery', 'solar'] : []),
  allEntities: () => ['sat', 'eps', 'obc', 'battery', 'solar'],
  hasParam: (e, p) => {
    const table: Record<string, string[]> = {
      sat: ['mass_total'],
      eps: ['mass', 'power'],
      obc: ['mass', 'power'],
      battery: ['mass', 'capacity'],
      solar: ['mass'],
    };
    return (table[e] ?? []).includes(p);
  },
};
const values: Record<string, number> = {
  'eps.mass': 3.2, 'eps.power': 56, 'obc.mass': 1.1, 'obc.power': 7,
  'battery.mass': 1.5, 'battery.capacity': 84, 'solar.mass': 1.2, 'sat.mass_total': 0,
};
const ctx = (self = 'sat') => ({ shape, selfEntityId: self, lookup: (k: string) => values[k] });

describe('expression language', () => {
  it('parses arithmetic with the right precedence', () => {
    expect(evaluate(parse('1 + 2 * 3 ^ 2'), ctx())).toBe(19);
    expect(evaluate(parse('(1 + 2) * 3'), ctx())).toBe(9);
    expect(evaluate(parse('2 ^ 3 ^ 2'), ctx())).toBe(512);
    expect(evaluate(parse('-2 ^ 2'), ctx())).toBe(-4);
  });

  it('resolves dotted references and self', () => {
    expect(evaluate(parse('eps.mass + obc.mass'), ctx())).toBeCloseTo(4.3);
    expect(evaluate(parse('self.mass * 2'), ctx('obc'))).toBeCloseTo(2.2);
    expect(evaluate(parse('mass * 2'), ctx('obc'))).toBeCloseTo(2.2);
    expect(evaluate(parse('param("eps", "power")'), ctx())).toBe(56);
  });

  it('aggregates over structural functions', () => {
    expect(evaluate(parse('sum(children("eps", "mass"))'), ctx())).toBeCloseTo(2.7);
    expect(evaluate(parse('sum(leaves("sat", "mass"))'), ctx())).toBeCloseTo(1.1 + 1.5 + 1.2);
    expect(evaluate(parse('sum(total("mass"))'), ctx())).toBeCloseTo(1.1 + 1.5 + 1.2);
    expect(evaluate(parse('max(descendants("sat", "power"))'), ctx())).toBe(56);
    expect(evaluate(parse('count(children("eps", "mass"))'), ctx())).toBe(2);
    expect(evaluate(parse('rss(3, 4)'), ctx())).toBe(5);
  });

  it('supports comparisons, logic and if()', () => {
    expect(evaluate(parse('eps.mass <= 4 and obc.power < 10'), ctx())).toBe(true);
    expect(evaluate(parse('eps.mass > 4 or obc.power < 10'), ctx())).toBe(true);
    expect(evaluate(parse('not (eps.mass > 4)'), ctx())).toBe(true);
    expect(evaluate(parse('if(eps.mass > 4, 1, 0)'), ctx())).toBe(0);
  });

  it('applies ECSS margins and dB helpers', () => {
    expect(evaluate(parse('ecssMargin(10, "new")'), ctx())).toBeCloseTo(12);
    expect(evaluate(parse('withMargin(10, 0.05)'), ctx())).toBeCloseTo(10.5);
    expect(evaluate(parse('db(100)'), ctx())).toBeCloseTo(20);
    expect(evaluate(parse('fromDb(30)'), ctx())).toBeCloseTo(1000);
  });

  it('collects static dependencies, expanding structural calls', () => {
    const deps = collectDependencies(parse('sum(children("eps","mass")) + obc.power + self.mass_total'), { shape, selfEntityId: 'sat' });
    expect(deps.sort()).toEqual(['battery.mass', 'obc.power', 'sat.mass_total', 'solar.mass'].sort());
  });

  it('reports readable errors', () => {
    expect(() => parse('1 +')).toThrow(/incompleta/);
    expect(() => parse('1 $ 2')).toThrow(/inesperado/);
    expect(() => evaluate(parse('ghost.mass'), ctx())).toThrow(/não existe/);
    expect(() => evaluate(parse('1 / 0'), ctx())).toThrow(/zero/);
    expect(() => evaluate(parse('foo(1)'), ctx())).toThrow(/desconhecida/);
  });
});
