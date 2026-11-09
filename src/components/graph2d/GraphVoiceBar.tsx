import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useArchitectureStore } from '../../state/architectureStore';
import { parseCommand, type AnyDoc } from '../../domain/parser/commandParser';
import { toInputDocument } from '../../lib/download';
import type { ArchitectureInput } from '../../domain/model/ArchitectureTypes';
import { VoiceInput } from '../layout/VoiceInput';

/**
 * Command bar on the graph: say or type a Construtor command and watch the
 * network change in place. Goes through applyEdit, so Ctrl+Z undoes it.
 */
export function GraphVoiceBar() {
  const architecture = useArchitectureStore((s) => s.architecture);
  const applyEdit = useArchitectureStore((s) => s.applyEdit);
  const [text, setText] = useState('');
  const [live, setLive] = useState('');
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!said) return undefined;
    const t = window.setTimeout(() => setSaid(null), 3500);
    return () => window.clearTimeout(t);
  }, [said]);

  const run = (raw: string) => {
    const q = raw.trim();
    setLive('');
    if (!q || !architecture) return;
    const parsed = parseCommand(q, toInputDocument(architecture) as unknown as AnyDoc);
    const mutation = parsed.mutation;
    if (!parsed.ok || !mutation) {
      setSaid({ ok: false, text: parsed.description || `Não entendi "${q}"` });
      return;
    }
    const result = applyEdit(parsed.description, (d: ArchitectureInput) => mutation(d as unknown as AnyDoc));
    setSaid({ ok: result.ok, text: result.ok ? parsed.description : result.issues[0]?.message ?? 'O modelo recusou a mudança' });
    if (result.ok) setText('');
  };

  // VoiceInput rebuilds its recogniser when the callback changes, which would cut the sentence short.
  const runRef = useRef(run);
  runRef.current = run;
  const onSpoken = useCallback((spoken: string) => runRef.current(spoken), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(text);
  };

  return (
    <form className="graph-cmd" onSubmit={submit}>
      <input
        className="graph-cmd__input"
        value={live || text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Diga ou digite: conectar Bateria a Câmera tipo potência"
        aria-label="Comando para mudar o modelo"
      />
      <VoiceInput onResult={onSpoken} onLiveTranscript={setLive} />
      {said && <p className={`graph-cmd__said${said.ok ? ' is-ok' : ' is-fail'}`} role="status">{said.text}</p>}
    </form>
  );
}
