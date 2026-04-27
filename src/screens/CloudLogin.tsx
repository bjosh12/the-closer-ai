import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function CloudLogin() {
  const { setCurrentView, setLicensed, setCloudUser, cloudUser } = useStore();
  const [activeTab, setActiveTab] = useState<'login' | 'license' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if ((window as any).electronAPI) {
        // 1. Check for stored license first
        const storedLicense = await (window as any).electronAPI.store.get('LICENSE_KEY');
        if (storedLicense) {
          const hwId = await (window as any).electronAPI.license.getMachineId();
          const { data } = await (window as any).electronAPI.cloud.verifyLicense(storedLicense, hwId);
          if (data?.success) {
            setLicensed(true, storedLicense);
            // Schedule periodic re-verification every 30 minutes
            const interval = setInterval(async () => {
              const recheckHwId = await (window as any).electronAPI.license.getMachineId();
              const { data: recheckData } = await (window as any).electronAPI.cloud.verifyLicense(storedLicense, recheckHwId);
              if (!recheckData?.success) {
                // License revoked — clear and force re-login
                await (window as any).electronAPI.store.set('LICENSE_KEY', null);
                setLicensed(false, '');
                setCurrentView('cloud-login');
                clearInterval(interval);
              }
            }, 30 * 60 * 1000);
            setCurrentView('home');
            return;
          } else {
            // License is revoked or invalid — clear it immediately
            await (window as any).electronAPI.store.set('LICENSE_KEY', null);
            setLicensed(false, '');
          }
        }

      // 2. Check for cloud session
      const user = await (window as any).electronAPI.cloud.getUser();
      if (user) {
        setCloudUser(user);
        if (!cloudUser) {
          setCurrentView('home');
          return;
        } else {
          setActiveTab('license');
        }
      } else {
        setCloudUser(null);
      }
    }
    setChecking(false);
  };
  check();
}, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user, error } = await (window as any).electronAPI.cloud.signIn(email, password);
      if (error) {
        setError(error.message);
      } else if (user) {
        setCloudUser(user);
        setCurrentView('home');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Pass extra data to metadata
      const { user, error, session } = await (window as any).electronAPI.cloud.signUp(email, password, { 
        full_name: fullName, 
        goal_role: currentRole 
      });
      if (error) {
        setError(error.message);
      } else if (user && !session) {
        // Verification email sent, but no session yet
        setError('Success! Please check your email to verify your account.');
        setActiveTab('login');
        setPassword('');
      } else if (user) {
        setCloudUser(user);
        setCurrentView('home');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const hwId = await (window as any).electronAPI.license.getMachineId();
      let userId = cloudUser?.id ?? null;

      // If not signed in, create an account first then activate
      if (!userId) {
        if (!email || !password) {
          setError('Please enter your email and password to link your license to an account.');
          setLoading(false);
          return;
        }

        // Try sign up first
        const { user: newUser, session, error: signUpError } = await (window as any).electronAPI.cloud.signUp(email, password, {
          full_name: fullName || email.split('@')[0],
          goal_role: currentRole || 'Professional',
        });

        if (signUpError && !signUpError.message?.includes('already registered')) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // If already registered, sign in instead
        if (signUpError?.message?.includes('already registered') || (!session && newUser)) {
          const { user: existingUser, error: signInError } = await (window as any).electronAPI.cloud.signIn(email, password);
          if (signInError) {
            setError('Account exists but wrong password. Please sign in first.');
            setActiveTab('login');
            setLoading(false);
            return;
          }
          userId = existingUser?.id ?? null;
          if (existingUser) setCloudUser(existingUser);
        } else if (newUser) {
          userId = newUser.id;
          setCloudUser(newUser);
        }
      }

      // Now activate the license
      const { data, error: licError } = await (window as any).electronAPI.cloud.verifyLicense(licenseKey, hwId, userId);
      if (licError) throw licError;

      if (!data.success) {
        setError(data.message);
      } else {
        await (window as any).electronAPI.store.set('LICENSE_KEY', licenseKey);
        setLicensed(true, licenseKey);
        setCurrentView('home');
      }
    } catch (err: any) {
      setError(err.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ animation: 'pulse 2s infinite' }}>Initializing Secure Session...</div>
      </div>
    );
  }

  const inputGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.85rem' };
  const labelStyle = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '0.35rem', textTransform: 'uppercase' as const };
  const inputStyle = { width: '100%', padding: '0.7rem 0.875rem', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' as const, WebkitAppRegion: 'no-drag' as any };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1a1a2e 0%, #0a0a0f 100%)', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 1rem', boxShadow: '0 8px 25px rgba(124,58,237,0.3)' }}>🎯</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Mocking Bird AI</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginTop: '0.4rem' }}>Setup your professional interview environment.</p>
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.2rem', marginBottom: '1.25rem' }}>
          <button 
            onClick={() => setActiveTab('login')}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 7, border: 'none', background: (activeTab === 'login' || activeTab === 'signup') ? '#7c3aed' : 'transparent', color: (activeTab === 'login' || activeTab === 'signup') ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            Subscription
          </button>
          <button 
            onClick={() => setActiveTab('license')}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 7, border: 'none', background: activeTab === 'license' ? '#7c3aed' : 'transparent', color: activeTab === 'license' ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            Lifetime Key
          </button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem', backdropFilter: 'blur(20px)' }}>
          {error && (
            <div style={{ background: error.includes('activated') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${error.includes('activated') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: error.includes('activated') ? '#22c55e' : '#ef4444', padding: '0.75rem', borderRadius: 10, fontSize: '0.78rem', marginBottom: '1.25rem', fontWeight: 500 }}>
              {error.includes('activated') ? '✓' : '⚠️'} {error}
            </div>
          )}

          {activeTab === 'login' && (
            <form onSubmit={handleLogin} style={inputGroupStyle}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />
              </div>
              <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.8rem', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }}>
                {loading ? 'Authenticating...' : 'Sign In →'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setActiveTab('signup')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>Don't have an account? Sign up</button>
              </div>
            </form>
          )}

          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} style={inputGroupStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Current Goal/Role</label>
                  <input type="text" value={currentRole} onChange={e => setCurrentRole(e.target.value)} placeholder="Software Eng" style={inputStyle} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />
              </div>
              <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.8rem', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }}>
                {loading ? 'Creating Account...' : 'Complete Setup →'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setActiveTab('login')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>Already have an account? Login</button>
              </div>
            </form>
          )}
          {activeTab === 'license' && (
            <form onSubmit={handleLicense} style={inputGroupStyle}>
              <div>
                <label style={labelStyle}>License Key</label>
                <input type="text" value={licenseKey} onChange={e => setLicenseKey(e.target.value)} placeholder="IC-XXXX-XXXX-XXXX" style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }} required />
              </div>

              {!cloudUser && (
                <>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      🔗 Link this license to your account — new or existing.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                      <div>
                        <label style={labelStyle}>Full Name</label>
                        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Role / Goal</label>
                        <input type="text" value={currentRole} onChange={e => setCurrentRole(e.target.value)} placeholder="Software Eng" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.6rem' }}>
                      <label style={labelStyle}>Email Address</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Password</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />
                    </div>
                  </div>
                </>
              )}

              {cloudUser && (
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  ✓ Signed in as <strong style={{ color: '#a78bfa' }}>{cloudUser.email}</strong>. This license will be linked to your account.
                </p>
              )}

              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1.5, margin: '0.25rem 0' }}>
                🔒 Hardware-locked to this machine. Contact support to transfer.
              </p>

              <button type="submit" disabled={loading} style={{ padding: '0.875rem', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }}>
                {loading ? 'Activating...' : '🔑 Activate License →'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button type="button" onClick={() => setActiveTab('login')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>
                  Already have an account? Sign in instead
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            onClick={() => setCurrentView('home')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Continue in Offline Mode (Demo)
          </button>
        </div>
      </div>
    </div>
  );
}
