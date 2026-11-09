import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../parser/validateArchitecture';
import { normalizeArchitecture } from '../../parser/normalizeArchitecture';
import { cloneInputDocument } from '../../parser/inputDocument';
import { auditArchitecture } from '../audit';
import { computeSuspectLinks, linkReviewState, stampReview } from '../suspect';
import demo from '../../../data/demoArchitecture.json';
import type { ArchitectureInput } from '../../model/ArchitectureTypes';

const base = (() => {
  const r = validateArchitecture(demo);
  if (!r.ok || !r.data) throw new Error('demo invalid');
  return r.data as ArchitectureInput;
})();
const rel = (doc: ArchitectureInput, type: string, source: string, target: string) =>
  doc.relations.find((r) => r.type === type && r.source === source && r.target === target)!;

describe('suspect links', () => {
  it('starts with every traceability link reviewed and none suspect', () => {
    const arch = normalizeArchitecture(base);
    expect(computeSuspectLinks(arch)).toEqual([]);
    expect(linkReviewState(arch, rel(arch, 'satisfies', 'eps', 'req_power')).state).toBe('reviewed');
    // Interfaces are not traceability links and are not tracked.
    expect(linkReviewState(arch, rel(arch, 'provides_power_to', 'eps', 'obc')).state).toBe('untracked');
  });

  it('a new battery capacity makes the links of the EPS that contains it suspect', () => {
    const doc = cloneInputDocument(normalizeArchitecture(base));
    const battery = doc.entities.find((e) => e.id === 'battery')!;
    battery.parameters!.find((p) => p.id === 'capacity_wh')!.value = 60;
    const arch = normalizeArchitecture(doc);
    const suspects = computeSuspectLinks(arch).map((s) => s.relationId);
    expect(suspects).toContain(rel(doc, 'satisfies', 'eps', 'req_power').id);
    expect(suspects).toContain(rel(doc, 'allocated_to', 'func_pwr_mgmt', 'eps').id);
    // A link that does not touch the EPS (or the segment above it) stays reviewed.
    expect(suspects).not.toContain(rel(doc, 'derives_from', 'req_image', 'obj_imaging').id);
    expect(auditArchitecture(arch).items.some((i) => i.kind === 'suspect-link')).toBe(true);

    // Reviewing them clears the suspicion.
    stampReview(doc, suspects);
    expect(computeSuspectLinks(normalizeArchitecture(doc))).toEqual([]);
  });

  it('a rewritten requirement makes its own links suspect from the requirement side', () => {
    const doc = cloneInputDocument(normalizeArchitecture(base));
    doc.entities.find((e) => e.id === 'req_downlink')!.requirement!.text = 'O sistema deve transmitir os dados a pelo menos 4 Mbps.';
    const suspects = computeSuspectLinks(normalizeArchitecture(doc));
    const derive = suspects.find((s) => s.relationId === rel(doc, 'derives_from', 'req_downlink', 'obj_data').id);
    expect(derive?.changed).toEqual(['source']);
  });
});
