import { useArchitectureStore } from '../../state/architectureStore';

/**
 * Modal-ish error banner shown when the loaded JSON fails validation.
 * Lists each ValidationIssue with its path and human message.
 */
export function JsonErrorPanel() {
  const issues = useArchitectureStore((s) => s.lastIssues);
  const resetToDemo = useArchitectureStore((s) => s.resetToDemo);

  if (!issues || issues.length === 0) return null;

  return (
    <div className="json-error-overlay" role="dialog" aria-live="assertive">
      <div className="json-error-card">
        <div className="json-error-card__header">
          <div className="json-error-card__title">
            JSON inválido: {issues.length} {issues.length === 1 ? 'problema encontrado' : 'problemas encontrados'}
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => resetToDemo()}>
            Voltar à demo
          </button>
        </div>
        <ul className="json-error-list">
          {issues.slice(0, 30).map((iss, i) => (
            <li key={i} className="json-error-item">
              <span className="json-error-path">{iss.path}</span>
              <span className="json-error-msg">{iss.message}</span>
            </li>
          ))}
          {issues.length > 30 && (
            <li className="json-error-item more">…e mais {issues.length - 30} problemas.</li>
          )}
        </ul>
        <div className="json-error-tip">
          Verifique se todos os ids referenciados em <code>relations</code> existem em <code>entities</code>, se cada
          tipo de relação tem <code>index</code> único, e se cada entidade declara <code>category</code> e <code>step</code>.
        </div>
      </div>
    </div>
  );
}
