import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../validateArchitecture';
import demo from '../../../data/demoArchitecture.json';

function minimal() {
  return {
    metadata: { projectName: 'T', version: '1.0' },
    categories: [{ id: 'mission', label: 'Missão', color: '#a855f7' }],
    relationTypes: [{ id: 'satisfies', index: 1, label: 'Satisfaz', color: '#2563eb', description: 'x' }],
    entities: [
      { id: 'm', name: 'M', category: 'mission', step: 1 },
      { id: 'n', name: 'N', category: 'mission', step: 1 },
    ],
    relations: [{ id: 'r1', type: 'satisfies', source: 'm', target: 'n', step: 1 }],
  };
}

describe('validateArchitecture', () => {
  it('accepts the bundled demo', () => {
    const r = validateArchitecture(demo);
    expect(r.ok).toBe(true);
    expect(r.data?.entities).toHaveLength(36);
    expect(r.data?.relations).toHaveLength(55);
  });

  it('accepts a minimal document', () => {
    expect(validateArchitecture(minimal()).ok).toBe(true);
  });

  it('flags a relation pointing to a missing entity', () => {
    const doc = minimal();
    doc.relations[0].target = 'ghost';
    const r = validateArchitecture(doc);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path === 'relations/r1/target')).toBe(true);
  });

  it('flags duplicated entity ids', () => {
    const doc = minimal();
    doc.entities[1].id = 'm';
    const r = validateArchitecture(doc);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path === 'entities/m')).toBe(true);
  });

  it('flags a category that is not declared', () => {
    const doc = minimal();
    doc.entities[0].category = 'segment';
    const r = validateArchitecture(doc);
    expect(r.issues.some((i) => i.path === 'entities/m/category')).toBe(true);
  });

  it('rejects malformed colours with a readable message', () => {
    const doc = minimal();
    doc.categories[0].color = '#abcd';
    const r = validateArchitecture(doc);
    expect(r.ok).toBe(false);
    expect(r.issues[0].path).toBe('categories/0/color');
  });
});
