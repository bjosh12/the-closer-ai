import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function HomeDashboard() {
  const { 
    setCurrentView, 
    setCurrentSession, 
    setProfile, 
    setDocuments, 
    setCloudUser, 
    setLicensed,
    isLicensed 
  } = useStore();
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewType, setInterviewType] = useState('behavioral');
  const [language, setLanguage] = useState('en');
  const [templates, setTemplates] = useState<any[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState('');
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudResume, setCloudResume] = useState<{ filename: string; text: string } | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [cloudDocCount, setCloudDocCount] = useState(0);
  const [sessionMinutesUsed, setSessionMinutesUsed] = useState(0);
  const [userPlan, setUserPlan] = useState('free');
  const [nextReset, setNextReset] = useState<string | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [recentSessions] = useState<any[]>([]);

  useEffect(() => {
    // If licensed, set plan to lifetime immediately
    if (isLicensed) {
      setUserPlan('lifetime');
    }

    // Load local templates
    if ((window as any).electronAPI) {
      (window as any).electronAPI.db.getTemplates().then(setTemplates);
    }

    // Sync cloud resume + documents on mount
    const syncCloud = async () => {
      if (!(window as any).electronAPI?.cloud) return;
      setCloudSyncing(true);
      try {
        const user = await (window as any).electronAPI.cloud.getUser();
        if (!user) { setCloudSyncing(false); return; }

        // Perform 12-hour trial reset check
        const resetData = await (window as any).electronAPI.cloud.checkTrial(user.id);
        if (resetData) {
          setNextReset(resetData.next_reset);
        }

        // Fetch resume from cloud profiles table
        const cloudProfile = await (window as any).electronAPI.cloud.getProfile(user.id);
        if (cloudProfile) {
          setSessionMinutesUsed(cloudProfile.total_session_minutes || 0);
          // Only override plan if NOT licensed locally
          if (!isLicensed) {
            setUserPlan(cloudProfile.plan || 'free');
          }

          if (cloudProfile.resume_text) {
            setCloudResume({ filename: cloudProfile.resume_filename || 'Cloud Resume', text: cloudProfile.resume_text });
            // Auto-load into store so the AI uses it immediately
            setProfile({ id: user.id, user_id: user.id, resume_text: cloudProfile.resume_text, parsed_resume: '', default_style: 'concise' });
            setResumeLoaded(true);
          }
        }

        // Fetch documents from cloud and merge into store + local db
        const cloudDocs = await (window as any).electronAPI.cloud.getDocuments(user.id);
        if (cloudDocs?.length > 0) {
          setCloudDocCount(cloudDocs.length);
          setDocuments(cloudDocs);
          // Persist to local DB too
          for (const doc of cloudDocs) {
            await (window as any).electronAPI.db.saveDocument(doc);
          }
        }
      } catch (e) {
        console.error('Cloud sync error:', e);
      } finally {
        setCloudSyncing(false);
      }
    };

    syncCloud();
  }, [isLicensed]);

  useEffect(() => {
    if (!nextReset || userPlan !== 'free') return;
    const interval = setInterval(() => {
      const diff = new Date(nextReset).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('Ready now!');
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeftStr(`Resets in ${h}h ${m}m`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [nextReset, userPlan]);

  const handleApplyTemplate = (templateId: string) => {
    const t = templates.find(x => x.id === templateId);
    if (t) { setJobTitle(t.title); setCompanyName(t.company); setJobDescription(t.jd_text); }
  };

  const handleFetchUrl = async () => {
    if (!importUrl) return;
    setIsFetchingUrl(true);
    try {
      if ((window as any).electronAPI?.url) {
        const text = await (window as any).electronAPI.url.fetch(importUrl);
        setJobDescription(text);
        setImportUrl('');
      }
    } catch (err: any) {
      alert('Failed to fetch job description: ' + err.message);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const [templateSaved, setTemplateSaved] = useState(false);



  const handleStartSession = async () => {
    if (!jobTitle || !companyName) return;
    if (saveAsTemplate && (window as any).electronAPI) {
      await (window as any).electronAPI.db.saveTemplate({ id: Date.now().toString(), title: jobTitle, company: companyName, jd_text: jobDescription, created_at: Date.now() });
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 3000);
      // Refresh templates list
      (window as any).electronAPI.db.getTemplates().then(setTemplates);
    }
    const newSession = { id: Date.now().toString(), user_id: 'user_1', job_title: jobTitle, company_name: companyName, job_description: jobDescription, interview_type: interviewType, language, created_at: new Date().toISOString() };
    setCurrentSession(newSession);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.db.createSession(newSession);
      const cloudUser = await (window as any).electronAPI.cloud.getUser();
      if (cloudUser) (window as any).electronAPI.cloud.syncSession(newSession, cloudUser.id);
    }
    setCurrentView('live-session');
  };

  const canStart = jobTitle && companyName;

  // Styles
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem',
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: '0.875rem',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'auto' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', textTransform: 'uppercase' };

  const navBtn = (id: string, label: string, icon: string, view: string) => (
    <button key={id} onMouseEnter={() => setHoveredBtn(id)} onMouseLeave={() => setHoveredBtn('')}
      onClick={() => setCurrentView(view as any)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.875rem', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: hoveredBtn === id ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', color: hoveredBtn === id ? '#c4b5fd' : 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
      <span>{icon}</span> {label}
    </button>
  );

  const handleLogout = async () => {
    if ((window as any).electronAPI) {
      await (window as any).electronAPI.cloud.signOut();
      await (window as any).electronAPI.store.set('LICENSE_KEY', null);
      setCloudUser(null);
      setLicensed(false, null);
      setCurrentView('cloud-login');
    }
  };

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'linear-gradient(145deg, #0a0a0f 0%, #0d0d1a 100%)', padding: '1.5rem', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🎯</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em', color: '#fff' }}>Mocking Bird AI</div>
            <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.3)' }}>AI-Powered Interview Assistant</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {navBtn('kb', 'Knowledge Base', '📚', 'knowledge-base')}
          {navBtn('history', 'History', '🕐', 'history')}
          {navBtn('settings', 'Settings', '⚙️', 'settings')}
          <button 
            onClick={handleLogout}
            style={{ marginLeft: '0.5rem', padding: '0.45rem', borderRadius: 7, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            title="Sign Out"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Cloud Sync Status Bar */}
      <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        {cloudSyncing ? (
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', animation: 'ping 1.5s infinite' }} />
            Syncing from cloud...
          </span>
        ) : resumeLoaded ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>✓</span>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Resume:</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c4b5fd', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cloudResume?.filename}</span>
            </div>
            {cloudDocCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>✓</span>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{cloudDocCount} knowledge doc{cloudDocCount !== 1 ? 's' : ''} loaded</span>
              </div>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
            ⚠ No cloud resume found — the AI will answer without your resume context.{' '}
            <button onClick={() => setCurrentView('settings')} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: 0 }}>Upload in web app →</button>
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Sessions', value: recentSessions.length >= 5 ? '5+' : recentSessions.length, icon: '🎙️' },
          { label: 'Cloud Documents', value: cloudDocCount, icon: '📄' },
          { label: 'Plan Status', value: userPlan.toUpperCase(), icon: '💎', color: userPlan === 'free' ? '#94a3b8' : '#fbbf24' },
          { label: 'Time Status', value: userPlan === 'free' ? `${Math.max(0, 15 - sessionMinutesUsed)} min left` : 'Unlimited Usage', subValue: timeLeftStr, icon: '⏱️' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
              <span style={{ fontSize: '1rem' }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: (s as any).color || '#fff' }}>{s.value}</div>
            {s.subValue && <div style={{ fontSize: '0.6rem', color: '#a78bfa', fontWeight: 600 }}>{s.subValue}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Form */}
        <div>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.1), rgba(124,58,237,0.04))', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✦</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>New Interview Session</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>Configure your next interview</div>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              {/* Template Selector */}
              {templates.length > 0 && (
                <div style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.12)', borderRadius: 9, padding: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={labelStyle}>Load Saved Template</label>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>{templates.length} saved</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select onChange={e => handleApplyTemplate(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                      <option value="" style={{ background: '#111118', color: '#fff' }}>Select a template...</option>
                      {templates.map(t => <option key={t.id} value={t.id} style={{ background: '#111118', color: '#fff' }}>{t.title} @ {t.company}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Job Title + Company */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Job Title <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Company Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Stripe" style={inputStyle} />
                </div>
              </div>

              {/* Type + Language */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Interview Type</label>
                  <select value={interviewType} onChange={e => setInterviewType(e.target.value)} style={selectStyle}>
                    <option value="behavioral" style={{ background: '#111118', color: '#fff' }}>🧠 Behavioral (Standard)</option>
                    <option value="technical" style={{ background: '#111118', color: '#fff' }}>💻 Technical / Coding</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle}>
                    <option value="en" style={{ background: '#111118', color: '#fff' }}>🇺🇸 English</option>
                    <option value="es" style={{ background: '#111118', color: '#fff' }}>🇪🇸 Spanish</option>
                    <option value="fr" style={{ background: '#111118', color: '#fff' }}>🇫🇷 French</option>
                    <option value="de" style={{ background: '#111118', color: '#fff' }}>🇩🇪 German</option>
                  </select>
                </div>
              </div>

              {/* Job Description */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Job Description <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontSize: '0.75rem' }}>(optional but recommended)</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Paste job URL..." style={{ ...inputStyle, width: 200, fontSize: '0.72rem', padding: '0.35rem 0.6rem' }} />
                    <button onClick={handleFetchUrl} disabled={isFetchingUrl || !importUrl}
                      style={{ padding: '0.35rem 0.75rem', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 6, color: '#c4b5fd', fontSize: '0.72rem', fontWeight: 700, cursor: importUrl ? 'pointer' : 'not-allowed', opacity: !importUrl || isFetchingUrl ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                      {isFetchingUrl ? '⏳ Scraping...' : '⬆ Import URL'}
                    </button>
                  </div>
                </div>
                <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the job requirements here, or import from a URL above..."
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, minHeight: 110 }}
                />
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                    <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: '#a78bfa', cursor: 'pointer' }} />
                    Save as reusable template
                  </label>
                  {templateSaved && <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700 }}>✓ Saved!</span>}
                </div>
                <button onClick={handleStartSession} disabled={!canStart || (userPlan === 'free' && sessionMinutesUsed >= 15)}
                  style={{ padding: '0.7rem 1.875rem', background: (canStart && (userPlan !== 'free' || sessionMinutesUsed < 15)) ? 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 9, color: (canStart && (userPlan !== 'free' || sessionMinutesUsed < 15)) ? '#fff' : 'rgba(255,255,255,0.2)', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.01em', cursor: (canStart && (userPlan !== 'free' || sessionMinutesUsed < 15)) ? 'pointer' : 'not-allowed', boxShadow: (canStart && (userPlan !== 'free' || sessionMinutesUsed < 15)) ? '0 0 20px rgba(124,58,237,0.3)' : 'none', transition: 'all 0.2s' }}>
                  {userPlan === 'free' && sessionMinutesUsed >= 15 ? `🔒 ${timeLeftStr || 'Upgrade to Continue'}` : '🚀 Launch Mocking Bird AI'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Recent Activity</span>
              <button onClick={() => setCurrentView('history')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>View All</button>
            </div>
            
            {recentSessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentSessions.map(s => (
                  <div key={s.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.job_title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.25rem' }}>{s.company_name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem' }}>
                No recent sessions found.
              </div>
            )}
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(124,58,237,0.05))', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 14, padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '3rem', opacity: 0.1 }}>💡</div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#c4b5fd', marginBottom: '0.5rem' }}>Pro Tip</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Use the "STAR Method" (Situation, Task, Action, Result) for the best results during behavioral interviews.
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)' }}>
        System audio captures the interviewer's voice · API keys set in Settings
      </div>

      <style>{`
        select option { background: #111118 !important; color: #ffffff !important; }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}
