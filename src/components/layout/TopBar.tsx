import { useArchitectureStore } from '../../state/architectureStore';
import { JsonUploadPanel } from '../json/JsonUploadPanel';
import { ViewModeTabs } from './ViewModeTabs';
import { EntitySearch } from './EntitySearch';
import { ExportMenu } from './ExportMenu';
import { TemplateMenu } from './TemplateMenu';
import { HistoryButtons } from './HistoryButtons';

function Mark() {
  // Woven mark: two warp threads and two weft threads, over and under, the
  // network the tool is named after. The weft takes the accent.
  return (
    <svg className="top-bar__mark" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <g strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M8 3 V19" stroke="var(--ink-2)" />
        <path d="M14 3 V19" stroke="var(--ink-2)" />
        <path d="M3 8 H19" stroke="var(--accent)" />
        <path d="M3 14 H19" stroke="var(--accent)" />
        {/* Warp passes over the weft at alternate crossings. */}
        <path d="M8 6.2 V9.8" stroke="var(--panel)" strokeWidth="4.4" strokeLinecap="butt" />
        <path d="M8 5.6 V10.4" stroke="var(--ink-2)" />
        <path d="M14 12.2 V15.8" stroke="var(--panel)" strokeWidth="4.4" strokeLinecap="butt" />
        <path d="M14 11.6 V16.4" stroke="var(--ink-2)" />
      </g>
    </svg>
  );
}

function ThemeToggle() {
  const theme = useArchitectureStore((s) => s.theme);
  const setTheme = useArchitectureStore((s) => s.setTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Usar tema claro (projetor e impressão)' : 'Usar tema escuro';
  return (
    <button type="button" className="btn btn--ghost btn--icon" onClick={() => setTheme(next)} aria-label={label} title={label}>
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
        </svg>
      )}
    </button>
  );
}

export function TopBar() {
  const architecture = useArchitectureStore((s) => s.architecture);
  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <Mark />
        <div className="top-bar__title">
          <span className="top-bar__product">Trama</span>
          <span className="top-bar__project">{architecture?.metadata.projectName ?? 'Nenhum modelo'}</span>
        </div>
      </div>

      <div className="top-bar__center">
        <ViewModeTabs />
        <EntitySearch />
      </div>

      <div className="top-bar__actions">
        <HistoryButtons />
        <ThemeToggle />
        <TemplateMenu />
        <ExportMenu />
        <JsonUploadPanel />
      </div>
    </header>
  );
}
