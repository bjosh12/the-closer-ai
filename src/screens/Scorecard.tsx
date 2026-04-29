import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { OpenAIProvider, AnthropicProvider } from '@/lib/llm';
import ReactMarkdown from 'react-markdown';

export function Scorecard() {
  const {
    currentSession,
    transcripts: storeTranscripts,
    profile,
    setCurrentView,
    clearSessionData,
    selectedModel,
  } = useStore();

  const [scorecard, setScorecard] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [answers, setAnswers] = useState<any[]>([]);
  const [copyDone, setCopyDone] = useState(false);
  const [expandedQA, setExpandedQA] = useState(false);

  useEffect(() => {
    if (!currentSession || !profile) return;

    const generate = async () => {
      // ── Load transcripts: prefer DB (handles history review) ──────────────
      let transcriptsToUse: any[] = [];
      if ((window as any).electronAPI) {
        try {
          const dbTranscripts = await (window as any).electronAPI.db.getTranscripts(currentSession.id);
          if (dbTranscripts?.length > 0) transcriptsToUse = dbTranscripts;
        } catch (_e) {}
      }
      // Fallback: in-memory store transcripts for the current session (live path)
      if (transcriptsToUse.length === 0) {
        transcriptsToUse = storeTranscripts.filter(t => t.session_id === currentSession.id);
      }
      // Last resort: all in-memory transcripts (legacy live path before DB save)
      if (transcriptsToUse.length === 0) {
        transcriptsToUse = storeTranscripts;
      }

      // ── Load saved Q&A answers for the history panel ──────────────────────
      if ((window as any).electronAPI) {
        try {
          const dbAnswers = await (window as any).electronAPI.db.getAnswers(currentSession.id);
          if (dbAnswers?.length > 0) setAnswers(dbAnswers);
        } catch (_e) {}
      }

      // ── Resolve the LLM key ───────────────────────────────────────────────
      let oaKey = 'mock_key';
      let anthropicKey = '';

      if ((window as any).electronAPI) {
        const localOAKey = await (window as any).electronAPI.store.get('OPENAI_API_KEY');
        const localAnKey = await (window as any).electronAPI.store.get('ANTHROPIC_API_KEY');
        if (localOAKey && localOAKey !== 'mock_key') oaKey = localOAKey;
        if (localAnKey && localAnKey !== 'mock_key') anthropicKey = localAnKey;

        // Cloud proxy fallback for OpenAI
        if (oaKey === 'mock_key') {
          const state = useStore.getState();
          if (state.cloudUser) {
            try {
              const session = await (window as any).electronAPI.cloud.getAuthSession();
              if (session?.access_token) oaKey = `ey-${session.access_token}`;
            } catch (_e) {}
          }
        }
      }

      if (oaKey === 'mock_key' && !anthropicKey) {
        setScorecard(
          'Error: No API key found. Add your OpenAI or Anthropic key in Settings, or sign in to your cloud account.'
        );
        setIsGenerating(false);
        return;
      }

      // ── Pick provider matching the selected model ─────────────────────────
      const useAnthropic = selectedModel.startsWith('claude-') && !!anthropicKey;
      const llm = useAnthropic
        ? new AnthropicProvider(anthropicKey)
        : new OpenAIProvider(oaKey);

      const result = await llm.generateScorecard(
        profile.resume_text,
        currentSession.job_description,
        transcriptsToUse
      );
      setScorecard(result);
      setIsGenerating(false);
    };

    generate();
  }, [currentSession?.id]);

  const handleFinish = () => {
    clearSessionData();
    setCurrentView('home');
  };

  const copyScorecard = () => {
    if (!scorecard) return;
    navigator.clipboard.writeText(scorecard).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  };

  if (!currentSession) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090f', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
        No session data.{' '}
        <button onClick={() => setCurrentView('home')} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: 700 }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'linear-gradient(145deg, #0a0a0f 0%, #0d0d1a 100%)', padding: '2rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* ── Header ────────────────────���────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Interview Scorecard
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa' }} />
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{currentSession.job_title}</span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>@</span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{currentSession.company_name}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {scorecard && !isGenerating && (
              <button onClick={copyScorecard}
                style={{ padding: '0.5rem 1rem', background: copyDone ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${copyDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: copyDone ? '#22c55e' : 'rgba(255,255,255,0.6)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                {copyDone ? '✓ Copied' : '📋 Copy'}
              </button>
            )}
            <button onClick={handleFinish}
              style={{ padding: '0.5rem 1.125rem', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 16px rgba(124,58,237,0.25)' }}>
              ← Dashboard
            </button>
          </div>
        </div>

        {/* ── Scorecard card ──────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.1), rgba(124,58,237,0.04))', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>AI Performance Evaluation</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
                Based on your transcript and the job description
              </div>
            </div>
          </div>
          <div style={{ padding: '1.75rem 2rem' }}>
            {isGenerating ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 0', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', animation: `scorePulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Generating your scorecard…</div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>
                  Evaluating your answers against the job description
                </div>
              </div>
            ) : (
              <div className="scorecard-content">
                <ReactMarkdown>{scorecard || 'Failed to generate scorecard.'}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* ── Q&A History panel ───────────────────────────────────────────── */}
        {answers.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedQA(v => !v)}
              style={{ width: '100%', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1rem' }}>💬</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
                  AI Answers from this Session
                </span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.5rem', borderRadius: 20 }}>
                  {answers.length}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                {expandedQA ? '▲ collapse' : '▼ expand'}
              </span>
            </button>
            {expandedQA && (
              <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {answers.map((a, i) => (
                  <div key={a.id || i} style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.1)', borderRadius: 10, padding: '0.875rem 1rem' }}>
                    {a.question_text && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', marginBottom: '0.5rem' }}>
                        Q: {a.question_text}
                      </div>
                    )}
                    <div className="answer-content">
                      <ReactMarkdown>{a.generated_text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scorePulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
        .scorecard-content { color: rgba(255,255,255,0.85); line-height: 1.8; font-size: 0.9rem; }
        .scorecard-content h1 { color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0 0 0.75rem; }
        .scorecard-content h2 { color: #c4b5fd; font-size: 1rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
        .scorecard-content h3 { color: rgba(255,255,255,0.8); font-size: 0.9rem; font-weight: 700; margin: 1rem 0 0.35rem; }
        .scorecard-content ul { padding-left: 1.25rem; margin: 0 0 0.75rem; }
        .scorecard-content li { margin-bottom: 0.35rem; }
        .scorecard-content strong { color: #e2e8f0; }
        .scorecard-content p { margin: 0 0 0.75rem; }
        .answer-content { font-size: 0.82rem; color: rgba(255,255,255,0.75); line-height: 1.7; }
        .answer-content p { margin: 0 0 0.4rem; }
        .answer-content ul { padding-left: 1.25rem; margin: 0; }
        .answer-content li { margin-bottom: 0.2rem; }
      `}</style>
    </div>
  );
}
