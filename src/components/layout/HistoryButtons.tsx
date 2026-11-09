import { useArchitectureStore } from '../../state/architectureStore';

/** Undo / redo for model edits made in the inspector, the Missão tab or the sweep. */
export function HistoryButtons() {
  const history = useArchitectureStore((s) => s.history);
  const future = useArchitectureStore((s) => s.future);
  const lastEditLabel = useArchitectureStore((s) => s.lastEditLabel);
  const undo = useArchitectureStore((s) => s.undo);
  const redo = useArchitectureStore((s) => s.redo);
  if (history.length === 0 && future.length === 0) return null;
  return (
    <div className="history">
      <button type="button" className="btn btn--ghost btn--sm" onClick={undo} disabled={history.length === 0} title={history.length ? `Desfazer ${lastEditLabel ?? 'a última edição'} (Ctrl+Z)` : 'Nada para desfazer'}>
        Desfazer
      </button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={redo} disabled={future.length === 0} title="Refazer (Ctrl+Shift+Z)">
        Refazer
      </button>
    </div>
  );
}
