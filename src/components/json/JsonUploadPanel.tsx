import { useRef, useState } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';

/**
 * "Carregar JSON / Resetar demo" controls in the top bar. Validation errors
 * are shown by JsonErrorPanel.
 */
export function JsonUploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const loadArchitectureFromJson = useArchitectureStore((s) => s.loadArchitectureFromJson);
  const jsonSourceName = useArchitectureStore((s) => s.jsonSourceName);

  const onFile = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      try {
        loadArchitectureFromJson(JSON.parse(text), file.name);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : 'JSON inválido';
        useArchitectureStore.setState({
          lastIssues: [{ path: '(raiz)', message: `Não foi possível ler o arquivo como JSON: ${msg}` }],
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao ler o arquivo';
      useArchitectureStore.setState({ lastIssues: [{ path: '(arquivo)', message: msg }] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="json-upload">
      {jsonSourceName && <span className="json-upload__source support-label" title={jsonSourceName}>{jsonSourceName}</span>}
      <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? 'Carregando…' : 'Carregar JSON'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        aria-label="Arquivo JSON da arquitetura"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
