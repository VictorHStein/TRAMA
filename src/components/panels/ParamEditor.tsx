import { useArchitectureStore } from '../../state/architectureStore';
import type { EvaluatedParameter } from '../../domain/engine/evaluate';
import type { OrbitField } from '../../domain/analysis/sweep';
import { NumberField } from '../ui/NumberField';

/** Inline editor for a declared (non-formula) parameter value. Every commit is one undoable edit. */
export function ParamEditor({ param }: { param: EvaluatedParameter }) {
  const applyEdit = useArchitectureStore((s) => s.applyEdit);
  return (
    <span className="sp-param__edit">
      <NumberField
        value={param.value}
        ariaLabel={`Valor de ${param.name} (${param.unit})`}
        onCommit={(v) => applyEdit(`${param.key} = ${v}`, (doc) => {
          const e = doc.entities.find((x) => x.id === param.entityId);
          const p = e?.parameters?.find((x) => x.id === param.paramId);
          if (!p) return;
          p.value = v;
          delete p.formula;
        }, [param.key])}
      />
      {param.unit && param.unit !== '-' && <span className="sp-param__unit">{param.unit}</span>}
    </span>
  );
}

const ORBIT_LABEL: Record<OrbitField, string> = { altitudeKm: 'altitude', inclinationDeg: 'inclinação', ltanHours: 'LTAN' };

/** Inline editor for one element of mission.orbit; the whole chain recalculates. */
export function OrbitFieldEditor({ field, value, unit }: { field: OrbitField; value: number | null; unit: string }) {
  const applyEdit = useArchitectureStore((s) => s.applyEdit);
  return (
    <span className="sp-param__edit">
      <NumberField
        value={value}
        ariaLabel={`Órbita: ${ORBIT_LABEL[field]} (${unit})`}
        placeholder="—"
        onCommit={(v) => applyEdit(`órbita: ${ORBIT_LABEL[field]} = ${v}`, (doc) => {
          if (!doc.mission) return;
          doc.mission.orbit = { ...(doc.mission.orbit ?? { altitudeKm: 500, inclinationDeg: 97.4, eccentricity: 0 }), [field]: v };
        }, ['engine.orbit_*'])}
      />
      <span className="sp-param__unit">{unit}</span>
    </span>
  );
}
