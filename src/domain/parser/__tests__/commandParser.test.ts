import { describe, expect, it } from 'vitest';
import { parseCommand, type AnyDoc } from '../commandParser';

function doc(): AnyDoc {
  return {
    categories: [
      { id: 'mission', label: 'Missão', color: '#a855f7' },
      { id: 'subsystem', label: 'Subsistema', color: '#22c55e' },
      { id: 'component', label: 'Componente', color: '#eab308' },
    ],
    relationTypes: [
      { id: 'satisfies', index: 1, label: 'Satisfaz requisito', color: '#2563eb' },
      { id: 'provides_power_to', index: 3, label: 'Fornece potência', color: '#f59e0b' },
    ],
    entities: [
      { id: 'mission', name: 'Missão X', category: 'mission', step: 1 },
      { id: 'eps', name: 'EPS', category: 'subsystem', step: 6 },
      { id: 'obc', name: 'OBC', category: 'subsystem', step: 6 },
    ],
    relations: [],
  };
}

function apply(cmd: string, d: AnyDoc = doc()) {
  const r = parseCommand(cmd, d);
  if (r.ok && r.mutation) r.mutation(d);
  return { r, d };
}

type Rel = { type: string; source: string; target: string; step: number };
type Ent = { id: string; name: string; category: string; parentId?: string };

describe('parseCommand - relations', () => {
  it('understands "conectar X a Y tipo Z" (the sample chip in the Construtor)', () => {
    const { r, d } = apply('conectar EPS a OBC tipo potência');
    expect(r.ok).toBe(true);
    expect(d.relations).toHaveLength(1);
    const rel = d.relations?.[0] as Rel;
    expect(rel.type).toBe('provides_power_to');
    expect(rel.source).toBe('eps');
    expect(rel.target).toBe('obc');
    expect(rel.step).toBe(6);
  });

  it('falls back to the first relation type when none is given (never an empty type)', () => {
    const { r, d } = apply('criar relação EPS para OBC');
    expect(r.ok).toBe(true);
    expect((d.relations?.[0] as Rel).type).toBe('satisfies');
  });

  it('refuses an unknown relation type instead of guessing', () => {
    const { r, d } = apply('conectar EPS a OBC tipo fluxo hidráulico');
    expect(r.ok).toBe(false);
    expect(r.description).toContain('não existe');
    expect(d.relations).toHaveLength(0);
  });

  it('refuses unknown endpoints', () => {
    expect(apply('conectar EPS a Radiador').r.ok).toBe(false);
  });

  it('renames the mission everywhere when the mission entity is renamed', () => {
    const d = { ...doc(), mission: { id: 'mission', name: 'Missão X' }, metadata: { projectName: 'Minha Arquitetura' } } as AnyDoc;
    const { r } = apply('renomear Missão X para Vigia Amazônia', d);
    expect(r.ok).toBe(true);
    expect(d.mission).toMatchObject({ name: 'Vigia Amazônia' });
    expect(d.metadata).toMatchObject({ projectName: 'Vigia Amazônia' });
  });

  it('handles a name that holds the connector word', () => {
    const d = doc();
    (d.entities as Array<Record<string, unknown>>).push({ id: 'foto', name: 'Fotografar a floresta', category: 'subsystem', step: 6 });
    const { r } = apply('conectar Fotografar a floresta a EPS tipo potência', d);
    expect(r.ok).toBe(true);
    expect((d.relations as Array<Record<string, unknown>>)[0]).toMatchObject({ source: 'foto', target: 'eps' });
  });
});

describe('parseCommand - entities', () => {
  it('adds a typed entity under a parent', () => {
    const { r, d } = apply('adicione um subsistema chamado Bateria sob EPS');
    expect(r.ok).toBe(true);
    const e = d.entities?.[d.entities.length - 1] as Ent;
    expect(e.id).toBe('bateria');
    expect(e.category).toBe('subsystem');
    expect(e.parentId).toBe('eps');
  });

  it('uses the first category when none is given (never an empty category)', () => {
    const { r, d } = apply('adicione entidade chamada Painel');
    expect(r.ok).toBe(true);
    expect((d.entities?.[d.entities.length - 1] as Ent).category).toBe('mission');
  });

  it('refuses an unknown category', () => {
    const { r } = apply('adicione um bloco chamado Painel');
    expect(r.ok).toBe(false);
    expect(r.description).toContain('bloco');
  });

  it('removes an entity and its relations', () => {
    const d = doc();
    apply('conectar EPS a OBC tipo potência', d);
    const { r } = apply('remover OBC', d);
    expect(r.ok).toBe(true);
    expect(d.entities?.some((e) => (e as Ent).id === 'obc')).toBe(false);
    expect(d.relations).toHaveLength(0);
  });

  it('renames an entity', () => {
    const { d } = apply('renomear EPS para Subsistema Elétrico');
    expect((d.entities?.[1] as Ent).name).toBe('Subsistema Elétrico');
  });
});

describe('parseCommand - categories and colours', () => {
  it('creates a category with an explicit colour', () => {
    const { r, d } = apply('criar categoria Verificação cor #ef4444');
    expect(r.ok).toBe(true);
    const c = d.categories?.[d.categories.length - 1] as { id: string; color: string };
    expect(c.id).toBe('verificacao');
    expect(c.color).toBe('#ef4444');
  });

  it('only accepts 3- or 6-digit hex colours', () => {
    expect(apply('mudar cor da subsystem para #abcdef').r.ok).toBe(true);
    expect(apply('mudar cor da subsystem para #abcd').r.ok).toBe(false);
  });

  it('answers help without mutating', () => {
    const r = parseCommand('ajuda', doc());
    expect(r.ok).toBe(true);
    expect(r.mutation).toBeNull();
  });
});
