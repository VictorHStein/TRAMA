import type { NormalizedArchitecture } from '../model/ArchitectureTypes';

/**
 * Which entities feel a change, and how far from it: breadth-first over the
 * parameter dependency graph, then the rules that read those parameters.
 * Seeds are parameter keys ("battery.capacity_wh") or prefixes with a
 * trailing "*" for engine values ("engine.orbit_*").
 *
 * Returns entity id → distance (0 = the edited entity itself).
 */
export function computeRipple(arch: NormalizedArchitecture, seeds: string[]): Record<string, number> {
  const levels: Record<string, number> = {};
  const exact = new Set(seeds.filter((s) => !s.endsWith('*')));
  const prefixes = seeds.filter((s) => s.endsWith('*')).map((s) => s.slice(0, -1));
  const matches = (key: string) => exact.has(key) || prefixes.some((p) => key.startsWith(p));
  const params = arch.evaluation.params;

  const paramLevel = new Map<string, number>();
  const queue: [string, number][] = [];
  for (const p of Object.values(params)) {
    if (exact.has(p.key)) queue.push([p.key, 0]);
    else if (p.dependencies.some(matches)) queue.push([p.key, 1]);
  }
  // A change in the orbit or in an engine value starts at the mission entity.
  if (prefixes.length) {
    const mission = arch.entities.find((e) => e.category === 'mission');
    if (mission) levels[mission.id] = 0;
  }
  while (queue.length) {
    const [key, lvl] = queue.shift()!;
    const known = paramLevel.get(key);
    if (known !== undefined && known <= lvl) continue;
    paramLevel.set(key, lvl);
    const p = params[key];
    if (!p) continue;
    levels[p.entityId] = Math.min(levels[p.entityId] ?? Infinity, lvl);
    for (const d of p.dependents) queue.push([d, lvl + 1]);
  }

  let deepest = 0;
  for (const v of paramLevel.values()) deepest = Math.max(deepest, v);
  // Engine values a rule may read: budgets roll up a parameter id, modes read parameter refs.
  const affectedParamIds = new Set([...paramLevel.keys()].map((k) => params[k]?.paramId).filter(Boolean));
  const budgetHit = (arch.budgets ?? []).some((b) => b.parameter && affectedParamIds.has(b.parameter));
  const modeHit = (arch.modes ?? []).some((md) => md.loads.some((l) => l.parameterRef && paramLevel.has(l.parameterRef)));
  for (const r of Object.values(arch.evaluation.rules)) {
    const hits = r.dependencies.map((d) => paramLevel.get(d)).filter((x): x is number => x !== undefined);
    const viaEngine = r.dependencies.some((d) => matches(d)
      || (budgetHit && d.startsWith('engine.budget_'))
      || (modeHit && (d.startsWith('engine.mode_') || d === 'engine.orbit_average_power_w')));
    if (hits.length === 0 && !viaEngine) continue;
    const lvl = (hits.length ? Math.min(...hits) : deepest) + 1;
    levels[r.entityId] = Math.min(levels[r.entityId] ?? Infinity, lvl);
  }
  return levels;
}
