import { useArchitectureStore } from '../../../state/architectureStore';

/** "Rede | Satélite" switch shared by the two 3D scenes. */
export function SceneModeToggle() {
  const mode = useArchitectureStore((s) => s.sceneMode);
  const setMode = useArchitectureStore((s) => s.setSceneMode);
  return (
    <div className="segmented" role="group" aria-label="Conteúdo da cena 3D">
      <button type="button" className={`segmented__item${mode === 'network' ? ' is-on' : ''}`} aria-pressed={mode === 'network'} onClick={() => setMode('network')} title="Rede de entidades e relações">
        Rede
      </button>
      <button type="button" className={`segmented__item${mode === 'physical' ? ' is-on' : ''}`} aria-pressed={mode === 'physical'} onClick={() => setMode('physical')} title="Satélite físico em órbita, Terra, estação solo e simulação">
        Satélite
      </button>
    </div>
  );
}
