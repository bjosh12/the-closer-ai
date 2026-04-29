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
  const { currentView, setDocuments, setCurrentView, setCloudUser, setProfile } = useStore();
  const [isWidget, setIsWidget] = useState(false);
  const [whatsNew, setWhatsNew] = useState<{ version: string } | null>(null);
  const [isBooting, setIsBooting] = useState(true); // show nothing while restoring session

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.db.getDocuments().then(setDocuments);

      // ── STEP 1: Try to restore an existing Supabase session ─────────────
      (window as any).electronAPI.cloud.getUser().then(async (user: any) => {
        if (user) {
          // Already logged in — skip login & onboarding entirely
          setCloudUser(user);
          setCurrentView('home');
        } else {
          // Not logged in — check if this is a first-ever launch
          const isFirst = await (window as any).electronAPI.app.isFirstRun();
          setCurrentView(isFirst ? 'onboarding' : 'cloud-login');
        }

        // Always restore local profile as a fallback (cloud sync in HomeDashboard will
        // override with the cloud version if the user is online and signed in)
        try {
          const localProfile = await (window as any).electronAPI.db.getProfile('user_1');
          if (localProfile) setProfile(localProfile);
        } catch (_e) {}

        setIsBooting(false);
      }).catch(() => {
        setCurrentView('cloud-login');
        setIsBooting(false);
      });

      // ── STEP 2: What's New after an update ───────────────────────────────
      (window as any).electronAPI.app.getWhatsNew().then(
        ({ isNew, version }: { isNew: boolean; version: string }) => {
          if (isNew) setWhatsNew({ version });
        }
      );

      // ── STEP 3: Shortcut Listeners ──────────────────────────────────────
      (window as any).electronAPI.app.onShortcut('shortcut:open-settings', () => {
        setCurrentView('settings');
      });
      (window as any).electronAPI.app.onShortcut('shortcut:open-history', () => {
        setCurrentView('history');
      });
    } else {
      // Running in browser (dev without Electron) — skip straight to login
      setIsBooting(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash === '#widget') setIsWidget(true);
  }, []);

  if (isWidget) return <Widget />;

  // Show nothing while we're checking the session — prevents flash of login screen
  if (isBooting) {
    return (
      <div style={{ height: '100vh', width: '100vw', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Loading Mocking Bird AI...</span>
        </div>
      </div>
    );
  }

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
