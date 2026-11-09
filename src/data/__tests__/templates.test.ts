import { describe, expect, it } from 'vitest';
import { validateArchitecture } from '../../domain/parser/validateArchitecture';
import { normalizeArchitecture } from '../../domain/parser/normalizeArchitecture';
import { auditArchitecture } from '../../domain/analysis/audit';
import { getMissionReport } from '../../domain/analysis/mission';
import { TEMPLATES } from '../templates';

describe('starter templates', () => {
  for (const t of TEMPLATES) {
    it(`${t.name} validates, evaluates and analyses without errors`, () => {
      const r = validateArchitecture(t.data);
      expect(r.issues).toEqual([]);
      expect(r.ok).toBe(true);
      const arch = normalizeArchitecture(r.data!);
      expect(arch.evaluation.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(Object.values(arch.evaluation.rules).every((x) => x.result === 'pass')).toBe(true);
      const report = getMissionReport(arch);
      expect(report).not.toBeNull();
      expect(report!.link?.status).toBe('ok');
      expect(report!.power?.status).toBe('ok');
      expect(report!.power?.batteryStatus).toBe('ok');
      const audit = auditArchitecture(arch);
      expect(audit.items.filter((i) => i.severity === 'error')).toEqual([]);
    });
  }
});
