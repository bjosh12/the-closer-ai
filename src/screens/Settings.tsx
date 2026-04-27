import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

export function Settings() {
  const { setCurrentView, isLicensed, setCloudUser } = useStore();
  const [deepgramKey, setDeepgramKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'error' | null>(null);
  const [updateVersion, setUpdateVersion] = useState('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);

  useEffect(() => {
    if ((window as any).electronAPI) {
      const loadKeys = async () => {
        const dgKey = await (window as any).electronAPI.store.get('DEEPGRAM_API_KEY');
        const oaKey = await (window as any).electronAPI.store.get('OPENAI_API_KEY');
        if (dgKey) setDeepgramKey(dgKey);
        if (oaKey) setOpenAiKey(oaKey);
      };
      loadKeys();

      // Load app version
      (window as any).electronAPI.app.getVersion().then((v: string) => setAppVersion(v));
      (window as any).electronAPI.app.getLaunchAtStartup().then((v: boolean) => setLaunchAtStartup(v));

      // Listen for update status broadcasts from main process
      (window as any).electronAPI.app.onUpdateStatus((status: string) => {
        setLastChecked(new Date());
        if (status === 'checking') setUpdateStatus('checking');
        else if (status === 'latest') setUpdateStatus('latest');
        else if (status.startsWith('available:')) { setUpdateStatus('available'); setUpdateVersion(status.split(':')[1]); }
        else if (status.startsWith('downloading:')) setUpdateStatus('downloading');
        else if (status.startsWith('downloaded:')) { setUpdateStatus('downloaded'); setUpdateVersion(status.split(':')[1]); }
        else if (status.startsWith('error:')) setUpdateStatus('error');
      });
    }
  }, []);

  const handleSave = async () => {
    if ((window as any).electronAPI) {
      await (window as any).electronAPI.store.set('DEEPGRAM_API_KEY', deepgramKey);
      await (window as any).electronAPI.store.set('OPENAI_API_KEY', openAiKey);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Sign out of your account?')) return;
    await (window as any).electronAPI?.cloud.signOut();
    setCloudUser(null);
    setCurrentView('cloud-login');
  };

  const handleToggleStartup = async () => {
    const next = !launchAtStartup;
    await (window as any).electronAPI?.app.setLaunchAtStartup(next);
    setLaunchAtStartup(next);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem',
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#fff', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'linear-gradient(145deg, #0a0a0f 0%, #0d0d1a 100%)', padding: '2rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Settings</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Configure your AI engine and stealth preferences</p>
          </div>
          <button 
            onClick={() => setCurrentView('home')}
            style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            ← Back to Dashboard
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* API Keys Card - ONLY FOR LIFETIME LICENSED USERS */}
          {isLicensed ? (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🔑</span> API Configuration (Lifetime Mode)
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                As a Lifetime License holder, you use your own API keys. This ensures unlimited access and full privacy of your data.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Deepgram API Key</label>
                  <input type="password" value={deepgramKey} onChange={e => setDeepgramKey(e.target.value)} placeholder="sk-..." style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>OpenAI API Key</label>
                  <input type="password" value={openAiKey} onChange={e => setOpenAiKey(e.target.value)} placeholder="sk-..." style={inputStyle} />
                </div>
                <button 
                  onClick={handleSave}
                  style={{ 
                    marginTop: '1rem',
                    padding: '0.875rem', 
                    background: isSaved ? '#22c55e' : 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                    border: 'none',
                    borderRadius: 10, 
                    color: '#fff', 
                    fontWeight: 700, 
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSaved ? "✓ Settings Saved" : "Save Configuration"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 16, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>☁️</span> Cloud Managed AI
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                You are currently using our hosted AI engine. No configuration is required. 
                Your transcription and answer generation are handled automatically via your subscription.
              </p>
              <button 
                onClick={() => setCurrentView('cloud-login')}
                style={{ marginTop: '1.5rem', background: 'none', border: '1px solid rgba(196,181,253,0.3)', color: '#c4b5fd', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Switch to Lifetime License →
              </button>
            </div>
          )}

          {/* Stealth Mode Info Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.05) 0%, rgba(124,58,237,0.02) 100%)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 16, padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🕵️‍♂️</span> Stealth Mode Guide
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>Global Hotkey</div>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  Press <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, color: '#c4b5fd' }}>Alt + C</code> anywhere on your system to instantly hide or show the Copilot widget.
                </p>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>Ghost Mode</div>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  Use the ghost toggle in the widget header to enable click-through mode. This prevents accidental clicks during coding interviews.
                </p>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⌨️</span> Keyboard Shortcuts
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {[
                { keys: 'Alt + C', desc: 'Show / Hide widget', works: true },
                { keys: 'Alt + G', desc: 'Toggle Ghost Mode', works: true },
                { keys: 'Alt + S', desc: 'Start / Stop session', works: true },
                { keys: 'Alt + A', desc: 'Generate AI answer', works: true },
                { keys: 'Alt + X', desc: 'Clear transcript', works: true },
                { keys: 'Ctrl + ,', desc: 'Open Settings', works: true },
                { keys: 'Ctrl + H', desc: 'View history', works: true },
              ].map(({ keys, desc, works }) => (
                <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.5rem 0.75rem', opacity: works ? 1 : 0.45 }}>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{desc}{!works && <span style={{ fontSize: '0.65rem', color: '#f59e0b', marginLeft: 4 }}>(soon)</span>}</span>
                  <code style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '0.15rem 0.5rem', borderRadius: 5, fontSize: '0.7rem', fontWeight: 700 }}>{keys}</code>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.5rem' }}>All shortcuts are <strong style={{ color: '#22c55e' }}>Global</strong>. They work even when the app is minimized or hidden.</p>
          </div>

          {/* Preferences Card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚙️</span> Preferences
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Launch at startup toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Launch at Startup</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.15rem' }}>Start Mocking Bird AI when Windows starts</div>
                </div>
                <button
                  onClick={handleToggleStartup}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: launchAtStartup ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    left: launchAtStartup ? 23 : 3,
                  }} />
                </button>
              </div>

              {/* Sign out */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                <button
                  onClick={handleSignOut}
                  style={{ padding: '0.5rem 1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign Out
                </button>
                <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>
                  You'll need to sign in again or re-activate your license.
                </p>
              </div>

              {/* Full Exit */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Quit Application</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.15rem' }}>Fully close the app (removes from system tray)</div>
                </div>
                <button
                  onClick={() => { if ((window as any).electronAPI) (window as any).electronAPI.app.quit(); }}
                  style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Exit App
                </button>
              </div>
            </div>
          </div>

          {/* Version & Update Status Card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🚀</span> App Version & Updates
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>v{appVersion || '...'}</span>
                  {updateStatus === 'latest' && <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>✓ Up to date</span>}
                  {updateStatus === 'available' && <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>↑ v{updateVersion} available</span>}
                  {updateStatus === 'downloading' && <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>⬇ Downloading...</span>}
                  {updateStatus === 'downloaded' && <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>✓ v{updateVersion} ready</span>}
                  {updateStatus === 'checking' && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>Checking...</span>}
                  {updateStatus === 'error' && <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>Check failed</span>}
                </div>
                {lastChecked && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>Last checked: {lastChecked.toLocaleTimeString()}</span>}
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {updateStatus === 'downloaded' && (
                  <button
                    onClick={() => { if ((window as any).electronAPI) (window as any).electronAPI.app.checkForUpdates(); /* This will trigger quitAndInstall in main if already ready */ }}
                    style={{ padding: '0.4rem 1rem', background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
                  >
                    Install & Restart Now
                  </button>
                )}
                <button
                  disabled={updateChecking}
                  onClick={async () => {
                    setUpdateChecking(true);
                    setUpdateStatus('checking');
                    setLastChecked(new Date());
                    await (window as any).electronAPI?.app.checkForUpdates();
                    // Give it 3s then reset spinner (actual result comes via onUpdateStatus)
                    setTimeout(() => setUpdateChecking(false), 3000);
                  }}
                  style={{ padding: '0.4rem 0.875rem', background: updateChecking ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: updateChecking ? '#a78bfa' : 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, cursor: updateChecking ? 'default' : 'pointer', transition: 'all 0.2s' }}
                >
                  {updateChecking ? '⟳ Checking...' : 'Check for Updates'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginTop: '0.8rem' }}>
              Updates are usually automatic, but you can force a check here. Version info is pulled directly from the current build.
            </p>

        </div>
      </div>
    </div>
  </div>
  );
}
