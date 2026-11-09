import { useState } from 'react';

/**
 * Compact "Atalhos" pill that lives in the canvas bottom-left. Tap to
 * expand a card with the full keyboard map. Collapsed by default so it
 * doesn't intrude on the canvas.
 */
export function NavHint({ mode }: { mode: '2d' | '3d' }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="nav-hint nav-hint--chip"
        onClick={() => setOpen(true)}
        title="Mostrar atalhos de teclado"
      >
        ⌨ Atalhos
      </button>
    );
  }

  return (
    <div className="nav-hint" role="status">
      <div className="nav-hint__row">
        <span className="nav-hint__title">Atalhos de teclado</span>
        <button className="nav-hint__close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
      </div>
      {mode === '3d' ? (
        <>
          <div className="nav-hint__line">
            <Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd>
            <span className="nav-hint__sep">mover no plano</span>
          </div>
          <div className="nav-hint__line">
            <Kbd>Q</Kbd> <Kbd>E</Kbd>
            <span className="nav-hint__sep">descer / subir</span>
          </div>
          <div className="nav-hint__line">
            <Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd>
            <span className="nav-hint__sep">girar em torno do alvo</span>
          </div>
          <div className="nav-hint__line">
            <Kbd>Shift</Kbd>
            <span className="nav-hint__sep">3× mais rápido</span>
          </div>
          <div className="nav-hint__line nav-hint__line--mouse">
            Mouse: arrasto gira, rolagem aproxima, arrasto com o botão direito desloca
          </div>
        </>
      ) : (
        <>
          <div className="nav-hint__line">
            <Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd>
            <span className="nav-hint__sep">pan</span>
          </div>
          <div className="nav-hint__line">
            <Kbd>Q</Kbd> / <Kbd>−</Kbd>
            <span className="nav-hint__sep">zoom out</span>
            <Kbd>E</Kbd> / <Kbd>+</Kbd>
            <span className="nav-hint__sep">zoom in</span>
          </div>
          <div className="nav-hint__line">
            <Kbd>Shift</Kbd>
            <span className="nav-hint__sep">3× mais rápido</span>
          </div>
          <div className="nav-hint__line nav-hint__line--mouse">
            Mouse: arrasto desloca, rolagem aproxima. Com algo selecionado, a aproximação centraliza nele.
          </div>
        </>
      )}
      <div className="nav-hint__line nav-hint__sub">
        <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> busca; <Kbd>Esc</Kbd> limpa a seleção
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="nav-hint__kbd">{children}</kbd>;
}
