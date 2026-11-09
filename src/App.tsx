import { useEffect } from 'react';
import { useArchitectureStore } from './state/architectureStore';
import { isEditableTarget } from './lib/dom';
import { TopBar } from './components/layout/TopBar';
import { LegendPanel } from './components/layout/LegendPanel';
import { SidePanel } from './components/layout/SidePanel';
import { BottomTimeline } from './components/layout/BottomTimeline';
import { ArchitectureFlow } from './components/graph2d/ArchitectureFlow';
import { ArchitectureScene } from './components/scene3d/ArchitectureScene';
import { JsonErrorPanel } from './components/json/JsonErrorPanel';
import { TutorialView } from './components/layout/TutorialView';
import { MatricesView } from './components/matrices/MatricesView';
import { SplitCanvas } from './components/layout/SplitCanvas';
import { MissionHome } from './components/home/MissionHome';
import { GuidedTour } from './components/layout/GuidedTour';

export default function App() {
  const viewMode = useArchitectureStore((s) => s.viewMode);
  const architecture = useArchitectureStore((s) => s.architecture);
  const issues = useArchitectureStore((s) => s.lastIssues);
  const selectEntity = useArchitectureStore((s) => s.selectEntity);
  const selectRelation = useArchitectureStore((s) => s.selectRelation);
  const focusSubsystem = useArchitectureStore((s) => s.focusSubsystem);
  const legendCollapsed = useArchitectureStore((s) => s.legendCollapsed);

  // Global keyboard shortcuts.
  //
  //   • ESC → clear selection, focus, and relation selection. Works from
  //     anywhere on the page so the user can always escape into the
  //     "nothing selected" overview state.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditableTarget(e.target)) {
        selectEntity(null);
        selectRelation(null);
        focusSubsystem(null);
      }
      if ((e.ctrlKey || e.metaKey) && !isEditableTarget(e.target)) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); useArchitectureStore.getState().undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); useArchitectureStore.getState().redo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectEntity, selectRelation, focusSubsystem]);

  const isTutorial = viewMode === 'tutorial';
  const isHome = viewMode === 'home';
  // Home and builder are full-width pages: no legend, inspector or timeline.
  const isPage = isTutorial || isHome;

  return (
    <div className={`app-root${isTutorial ? ' app-root--tutorial' : ''}${isHome ? ' app-root--home' : ''}`}>
      <TopBar />

      <div className={`app-body${legendCollapsed && !isPage ? ' is-rail-collapsed' : ''}`}>
        {!isPage && <LegendPanel />}

        <main className="app-canvas">
          {!architecture && !isPage && (
            <div className="empty-state">Nenhuma arquitetura carregada.</div>
          )}

          {isTutorial && <TutorialView />}
          {isHome && architecture && <MissionHome />}
          {!isTutorial && architecture && viewMode === '2d' && <ArchitectureFlow />}
          {!isTutorial && architecture && viewMode === '3d' && <ArchitectureScene />}
          {!isTutorial && architecture && viewMode === 'split' && <SplitCanvas />}
          {!isTutorial && architecture && viewMode === 'matrices' && <MatricesView />}
        </main>

        {!isPage && <SidePanel />}
      </div>

      {!isPage && <BottomTimeline />}

      {issues.length > 0 && <JsonErrorPanel />}
      <GuidedTour />
    </div>
  );
}
