import { z } from 'zod';
import { architectureSchema } from '../schema/architectureSchema';
import type { ArchitectureInput } from '../model/ArchitectureTypes';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  data?: ArchitectureInput;
  issues: ValidationIssue[];
}

/**
 * Validates a raw JSON value against the architecture schema and runs cross-reference
 * checks (entity ids referenced by relations exist, relation types exist, …).
 *
 * Errors are surfaced as ValidationIssue[] with a human-readable Portuguese message.
 */
export function validateArchitecture(raw: unknown): ValidationResult {
  // 1) Schema parse
  const parsed = architectureSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(formatZodIssue),
    };
  }

  const data = parsed.data as ArchitectureInput;

  // 2) Cross-reference checks
  const issues: ValidationIssue[] = [];
  const entityIds = new Set(data.entities.map((e) => e.id));
  const categoryIds = new Set(data.categories.map((c) => c.id));
  const relationTypeIds = new Set(data.relationTypes.map((r) => r.id));
  const relationTypeIndices = new Map<number, string>();

  for (const c of data.relationTypes) {
    const existing = relationTypeIndices.get(c.index);
    if (existing) {
      issues.push({
        path: `relationTypes/${c.id}`,
        message: `O número (index) ${c.index} está duplicado entre "${existing}" e "${c.id}". Cada tipo de relação precisa de um número único.`,
      });
    }
    relationTypeIndices.set(c.index, c.id);
  }

  // entity.category must exist
  for (const e of data.entities) {
    if (!categoryIds.has(e.category)) {
      issues.push({
        path: `entities/${e.id}/category`,
        message: `Entidade "${e.id}" usa categoria "${e.category}" que não está definida em "categories".`,
      });
    }
    if (e.parentId && !entityIds.has(e.parentId)) {
      issues.push({
        path: `entities/${e.id}/parentId`,
        message: `Entidade "${e.id}" referencia parent "${e.parentId}" que não existe em "entities".`,
      });
    }
  }

  // relation.source/target must exist; relation.type must exist
  for (const r of data.relations) {
    if (!entityIds.has(r.source)) {
      issues.push({
        path: `relations/${r.id}/source`,
        message: `Relação "${r.id}" referencia source "${r.source}", mas não existe entidade com esse id.`,
      });
    }
    if (!entityIds.has(r.target)) {
      issues.push({
        path: `relations/${r.id}/target`,
        message: `Relação "${r.id}" referencia target "${r.target}", mas não existe entidade com esse id.`,
      });
    }
    if (!relationTypeIds.has(r.type)) {
      issues.push({
        path: `relations/${r.id}/type`,
        message: `Relação "${r.id}" usa o tipo "${r.type}" que não está definido em "relationTypes".`,
      });
    }
  }

  // Duplicate ids check (entities / relations / relationTypes / categories)
  duplicateIds(data.entities, 'entities', issues);
  duplicateIds(data.relations, 'relations', issues);
  duplicateIds(data.relationTypes, 'relationTypes', issues);
  duplicateIds(data.categories, 'categories', issues);

  // verifications.requirementId must exist
  for (const v of data.verifications ?? []) {
    if (!entityIds.has(v.requirementId)) {
      issues.push({
        path: `verifications/${v.id}/requirementId`,
        message: `Verificação "${v.id}" referencia requirementId "${v.requirementId}", que não existe em "entities".`,
      });
    }
  }

  // budgets.items.entityId / rootEntityId must exist
  for (const b of data.budgets ?? []) {
    for (const item of b.items ?? []) {
      if (!entityIds.has(item.entityId)) {
        issues.push({
          path: `budgets/${b.id}/items`,
          message: `Budget "${b.id}" referencia entidade "${item.entityId}" que não existe.`,
        });
      }
    }
    if (b.rootEntityId && !entityIds.has(b.rootEntityId)) {
      issues.push({
        path: `budgets/${b.id}/rootEntityId`,
        message: `Budget "${b.id}" referencia rootEntityId "${b.rootEntityId}" que não existe.`,
      });
    }
  }

  // v2: parameters unique per entity; requirement.derivesFrom must exist
  const paramKeys = new Set<string>();
  for (const e of data.entities) {
    const seen = new Set<string>();
    for (const p of e.parameters ?? []) {
      if (seen.has(p.id)) {
        issues.push({
          path: `entities/${e.id}/parameters/${p.id}`,
          message: `Entidade "${e.id}" declara o parâmetro "${p.id}" mais de uma vez.`,
        });
      }
      seen.add(p.id);
      paramKeys.add(`${e.id}.${p.id}`);
    }
    for (const parent of e.requirement?.derivesFrom ?? []) {
      if (!entityIds.has(parent)) {
        issues.push({
          path: `entities/${e.id}/requirement/derivesFrom`,
          message: `Requisito "${e.id}" deriva de "${parent}", que não existe em "entities".`,
        });
      }
    }
  }

  // v2: modes reference existing entities / parameters
  for (const m of data.modes ?? []) {
    for (const load of m.loads) {
      if (!entityIds.has(load.entityId)) {
        issues.push({
          path: `modes/${m.id}/loads`,
          message: `Modo "${m.id}" referencia entidade "${load.entityId}" que não existe.`,
        });
      }
      if (load.parameterRef && !paramKeys.has(load.parameterRef)) {
        issues.push({
          path: `modes/${m.id}/loads`,
          message: `Modo "${m.id}" referencia o parâmetro "${load.parameterRef}", que não está declarado.`,
        });
      }
      if (load.powerW === undefined && !load.parameterRef) {
        issues.push({
          path: `modes/${m.id}/loads`,
          message: `Modo "${m.id}": a carga de "${load.entityId}" precisa de "powerW" ou "parameterRef".`,
        });
      }
    }
    for (const a of m.active ?? []) {
      if (!entityIds.has(a)) {
        issues.push({ path: `modes/${m.id}/active`, message: `Modo "${m.id}" ativa a entidade "${a}", que não existe.` });
      }
    }
  }
  duplicateIds(data.modes ?? [], 'modes', issues);

  // v2: risks and verifications pointing to entities
  for (const r of data.risks ?? []) {
    for (const eid of r.entityIds ?? []) {
      if (!entityIds.has(eid)) {
        issues.push({ path: `risks/${r.id}/entityIds`, message: `Risco "${r.id}" referencia entidade "${eid}" que não existe.` });
      }
    }
  }
  for (const v of data.verifications ?? []) {
    if (v.itemId && !entityIds.has(v.itemId)) {
      issues.push({ path: `verifications/${v.id}/itemId`, message: `Verificação "${v.id}" referencia item "${v.itemId}" que não existe.` });
    }
    if (v.verifierId && !entityIds.has(v.verifierId)) {
      issues.push({ path: `verifications/${v.id}/verifierId`, message: `Verificação "${v.id}" referencia a entidade verificadora "${v.verifierId}" que não existe.` });
    }
  }

  // v2: mission.analysis bindings must point at declared parameters or engine values
  const analysis = data.mission?.analysis;
  if (analysis) {
    const NOT_REFS = new Set(['solarActivity', 'eclipseModeId', 'entityId']);
    const check = (v: unknown, path: string) => {
      if (typeof v === 'string' && !v.startsWith('engine.') && !paramKeys.has(v)) {
        issues.push({ path, message: `A análise de missão referencia o parâmetro "${v}", que não está declarado (use "entidade.parametro" ou "engine.…").` });
      }
    };
    for (const [block, cfg] of Object.entries(analysis)) {
      if (!cfg || typeof cfg !== 'object') continue;
      for (const [k, v] of Object.entries(cfg as Record<string, unknown>)) {
        if (NOT_REFS.has(k)) continue;
        if (Array.isArray(v)) {
          v.forEach((item, i) => {
            if (!item || typeof item !== 'object') return;
            for (const [kk, vv] of Object.entries(item as Record<string, unknown>)) {
              if (!NOT_REFS.has(kk)) check(vv, `mission/analysis/${block}/${k}/${i}/${kk}`);
            }
          });
        } else {
          check(v, `mission/analysis/${block}/${k}`);
        }
      }
    }
    for (const s of analysis.data?.sources ?? []) {
      if (!entityIds.has(s.entityId)) issues.push({ path: 'mission/analysis/data/sources', message: `A análise de dados referencia a entidade "${s.entityId}", que não existe.` });
    }
    const eclipseModeId = analysis.power?.eclipseModeId;
    if (eclipseModeId && !(data.modes ?? []).some((mm) => mm.id === eclipseModeId)) {
      issues.push({ path: 'mission/analysis/power/eclipseModeId', message: `A análise de energia referencia o modo "${eclipseModeId}", que não existe em "modes".` });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, data, issues: [] };
}

function duplicateIds(arr: { id: string }[], path: string, out: ValidationIssue[]): void {
  const seen = new Set<string>();
  for (const item of arr) {
    if (seen.has(item.id)) {
      out.push({
        path: `${path}/${item.id}`,
        message: `O id "${item.id}" aparece mais de uma vez em "${path}". Cada id precisa ser único.`,
      });
    }
    seen.add(item.id);
  }
}

function formatZodIssue(issue: z.ZodIssue): ValidationIssue {
  const path = issue.path.join('/') || '(raiz)';
  return { path, message: humanizeZodMessage(issue) };
}

function humanizeZodMessage(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return `Tipo inválido em "${issue.path.join('/')}": esperado ${issue.expected}, recebido ${issue.received}.`;
    case 'too_small':
      return `Valor muito pequeno em "${issue.path.join('/')}": ${issue.message}.`;
    case 'too_big':
      return `Valor muito grande em "${issue.path.join('/')}": ${issue.message}.`;
    case 'invalid_string':
      return `String inválida em "${issue.path.join('/')}": ${issue.message}.`;
    case 'invalid_enum_value':
      return `Valor não aceito em "${issue.path.join('/')}": ${issue.message}.`;
    default:
      return issue.message;
  }
}
