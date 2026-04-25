import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { Onboarding } from './screens/Onboarding';
import { HomeDashboard } from './screens/HomeDashboard';
import { LiveSession } from './screens/LiveSession';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { Scorecard } from './screens/Scorecard';
import { Widget } from './screens/Widget';
import { TitleBar } from './components/TitleBar';
import { KnowledgeBase } from './screens/KnowledgeBase';
import { CloudLogin } from './screens/CloudLogin';
import { WhatsNewModal } from './components/WhatsNewModal';

function App() {
  const { currentView, setDocuments, setCurrentView } = useStore();
  const [isWidget, setIsWidget] = useState(false);
  const [whatsNew, setWhatsNew] = useState<{ version: string } | null>(null);

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.db.getDocuments().then(setDocuments);

      // First-run detection → show onboarding before login
      (window as any).electronAPI.app.isFirstRun().then((isFirst: boolean) => {
        if (isFirst && currentView === 'cloud-login') {
          setCurrentView('onboarding');
        }
      });

      // What's New after update
      (window as any).electronAPI.app.getWhatsNew().then(
        ({ isNew, version }: { isNew: boolean; version: string }) => {
          if (isNew) setWhatsNew({ version });
        }
      );
    }
  }, []);

  useEffect(() => {
    if (window.location.hash === '#widget') setIsWidget(true);
  }, []);

  if (isWidget) return <Widget />;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <TitleBar />
      <div className="flex-1 overflow-y-auto">
        {currentView === 'cloud-login' && <CloudLogin />}
        {currentView === 'onboarding' && <Onboarding />}
        {currentView === 'home' && <HomeDashboard />}
        {currentView === 'live-session' && <LiveSession />}
        {currentView === 'history' && <History />}
        {currentView === 'settings' && <Settings />}
        {currentView === 'scorecard' && <Scorecard />}
        {currentView === 'knowledge-base' && <KnowledgeBase />}
      </div>

      {/* What's New modal — shown once after each update */}
      {whatsNew && (
        <WhatsNewModal
          version={whatsNew.version}
          onClose={() => setWhatsNew(null)}
        />
      )}
    </div>
  );
}

export default App;
