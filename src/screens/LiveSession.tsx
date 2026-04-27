import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '@/store/useStore';
import { AudioRecorder } from '@/lib/audio';
import { DeepgramProvider } from '@/lib/stt';
import { OpenAIProvider, buildPrompt } from '@/lib/llm';

export function LiveSession() {
  const { currentSession, transcripts, answers, addTranscript, addAnswer, setCurrentView } = useStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [micAnalytics, setMicAnalytics] = useState({ wpm: 0, fillers: 0 });
  const [copyIdx, setCopyIdx] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [keysReady, setKeysReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sttSystem = useRef<DeepgramProvider | null>(null);
  const sttMic = useRef<DeepgramProvider | null>(null);
  const llm = useRef<OpenAIProvider | null>(null);
  const audioSystem = useRef<AudioRecorder | null>(null);
  const audioMic = useRef<AudioRecorder | null>(null);
  const autoAnswerTimer = useRef<NodeJS.Timeout | null>(null);
  const questionBufferRef = useRef<string[]>([]);
  const lastAnswerTime = useRef<number>(0);

  useEffect(() => {
    if ((window as any).electronAPI) {
      const loadKeys = async () => {
        let dgKey = await (window as any).electronAPI.store.get('DEEPGRAM_API_KEY');
        let oaKey = await (window as any).electronAPI.store.get('OPENAI_API_KEY');
        
        const state = useStore.getState();
        const hasLocalKeys = dgKey && dgKey !== 'mock_key' && oaKey && oaKey !== 'mock_key';
        
        // If user has no local API keys AND is signed into a cloud account, use the cloud proxy.
        // This works for both Pro subscribers and users who switched from Lifetime back to cloud.
        if (!hasLocalKeys && state.cloudUser) {
          console.log('[LiveSession] No local API keys found, attempting cloud proxy for user:', state.cloudUser.email);
          try {
            const session = await (window as any).electronAPI.cloud.getAuthSession();
            if (session?.access_token) {
              console.log('[LiveSession] Attempting to fetch config from project-vw750.vercel.app...');
              let res = await fetch('https://project-vw750.vercel.app/api/desktop/config', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
              }).catch(err => {
                console.warn('[LiveSession] Primary domain failed, trying fallback...', err);
                return fetch('https://mocking-bird-ai-web.vercel.app/api/desktop/config', {
                  headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
              });

              console.log('[LiveSession] Proxy Response Status:', res.status);
              
              if (res.ok) {
                const config = await res.json();
                const receivedKey = String(config.deepgram_key || '').trim();
                console.log('[LiveSession] Proxy Data Received, key length:', receivedKey.length);
                
                if (receivedKey.length < 5) {
                  alert(`Warning: The server responded, but the Deepgram Key is empty or too short (Length: ${receivedKey.length}). Please check your Vercel Environment Variables.`);
                }
                
                dgKey = receivedKey.replace(/["']/g, '');
                oaKey = `ey-${session.access_token}`;
                console.log('[LiveSession] Cloud proxy keys loaded successfully');
              } else {
                const errBody = await res.text().catch(() => 'No body');
                console.error(`[LiveSession] Cloud proxy returned ${res.status}:`, errBody);
                alert(`Cloud AI Proxy Error (Status: ${res.status}). Error: ${errBody}`);
              }
            } else {
              console.error('[LiveSession] No auth session/access_token found. User may need to re-login.');
              alert('Your session has expired. Please sign out and sign back in.');
            }
          } catch (e: any) {
            console.error('[LiveSession] Failed to load cloud proxy config:', e);
            alert(`Failed to reach Cloud AI Proxy: ${e.message}`);
          }
        } else if (hasLocalKeys) {
          console.log('[LiveSession] Using local API keys (Lifetime mode)');
        } else if (!state.cloudUser) {
          console.warn('[LiveSession] No API keys found and no cloud user. AI features will not work.');
        } else {
          console.warn('[LiveSession] Cloud user detected but failed to load proxy config. User may need to re-login.');
        }
        
        const lang = currentSession?.language || 'en';
        sttSystem.current = new DeepgramProvider(dgKey || 'mock_key', lang);
        sttMic.current = new DeepgramProvider(dgKey || 'mock_key', lang);
        llm.current = new OpenAIProvider(oaKey || 'mock_key');
        setKeysReady(true);
      };
      if (!keysReady) {
        loadKeys();
      }
      (window as any).electronAPI.widget.open();

      (window as any).electronAPI.app.onShortcut('shortcut:toggle-session', () => {
        toggleRecording();
      });

      (window as any).electronAPI.app.onShortcut('shortcut:generate-answer', () => {
        handleAnswerNow();
      });

      (window as any).electronAPI.app.onShortcut('shortcut:clear-transcript', () => {
        const { clearTranscripts } = useStore.getState();
        clearTranscripts();
        if ((window as any).electronAPI) (window as any).electronAPI.widget.update('Waiting for AI suggestions...');
      });
    }
    return () => { 
      if (autoAnswerTimer.current) clearTimeout(autoAnswerTimer.current);
      if ((window as any).electronAPI) {
        (window as any).electronAPI.app.removeShortcutListeners('shortcut:toggle-session');
        (window as any).electronAPI.app.removeShortcutListeners('shortcut:generate-answer');
        (window as any).electronAPI.app.removeShortcutListeners('shortcut:clear-transcript');
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggleRecording = async () => {
    if (!sttSystem.current || !sttMic.current) return;
    if (isRecording) {
      audioSystem.current?.stop();
      audioMic.current?.stop();
      sttSystem.current.disconnect();
      sttMic.current.disconnect();
      setIsRecording(false);
      if (autoAnswerTimer.current) clearTimeout(autoAnswerTimer.current);
      questionBufferRef.current = [];
    } else {
      try {
        await Promise.all([sttSystem.current.connect(), sttMic.current.connect()]);
      } catch (err: any) {
        console.error('Failed to connect to Deepgram:', err);
        alert(`Transcription Connection Error: ${err.message}. Ensure your API keys are valid.`);
        return;
      }
      
      let ongoingSysId = Date.now().toString() + '-sys';
      let ongoingMicId = Date.now().toString() + '-mic';

      sttSystem.current.onTranscript((text, isFinal) => {
        addTranscript({ id: ongoingSysId, session_id: currentSession!.id, speaker: 'Interviewer', text, start_time: Date.now(), end_time: Date.now(), is_final: isFinal });
        if (isFinal) {
          ongoingSysId = Date.now().toString() + '-sys';
          const trimmed = text.trim();
          if (!trimmed) return;

          // --- DEDUP: skip if this text is very similar to the last buffered entry ---
          const lastEntry = questionBufferRef.current[questionBufferRef.current.length - 1] || '';
          const isSimilar = (a: string, b: string) => {
            if (!a || !b) return false;
            const shorter = a.length < b.length ? a : b;
            const longer = a.length < b.length ? b : a;
            return longer.toLowerCase().includes(shorter.toLowerCase().slice(0, Math.max(10, shorter.length * 0.6)));
          };
          if (isSimilar(lastEntry, trimmed)) {
            console.log('[AutoAnswer] Duplicate skipped:', trimmed);
            // Still reset the timer (interviewer is still talking)
            if (autoAnswerTimer.current) clearTimeout(autoAnswerTimer.current);
            autoAnswerTimer.current = setTimeout(fireAutoAnswer, 7000);
            return;
          }

          questionBufferRef.current.push(trimmed);
          console.log('[AutoAnswer] Buffered:', questionBufferRef.current);

          // Reset debounce timer on every new fragment
          if (autoAnswerTimer.current) clearTimeout(autoAnswerTimer.current);
          autoAnswerTimer.current = setTimeout(fireAutoAnswer, 7000);
        }
      });

      function fireAutoAnswer() {
        const fullQuestion = questionBufferRef.current.join(' ');
        console.log('[AutoAnswer] Timer fired. Buffer:', fullQuestion);

        // --- COOLDOWN: don't auto-generate if we just generated an answer ---
        const cooldown = 20000; // 20 seconds
        if (Date.now() - lastAnswerTime.current < cooldown) {
          console.log('[AutoAnswer] Cooldown active — skipping. Try "Force Answer" instead.');
          questionBufferRef.current = [];
          return;
        }

        // --- QUESTION DETECTION: only fire for actual questions (has ?) ---
        const containsQuestion = /\?/.test(fullQuestion);
        if (fullQuestion.length > 15 && containsQuestion) {
          console.log('[AutoAnswer] Question detected — generating answer');
          questionBufferRef.current = [];
          lastAnswerTime.current = Date.now();
          handleAnswerNow(fullQuestion);
        } else {
          console.log('[AutoAnswer] No question detected — keeping in buffer');
        }
      }

      sttMic.current.onTranscript((text, isFinal, analytics) => {
        addTranscript({ id: ongoingMicId, session_id: currentSession!.id, speaker: 'You', text, start_time: Date.now(), end_time: Date.now(), is_final: isFinal });
        if (analytics) setMicAnalytics(prev => ({ wpm: isFinal ? analytics.wpm : prev.wpm, fillers: prev.fillers + analytics.fillers }));
        if (isFinal) {
          ongoingMicId = Date.now().toString() + '-mic';
        }
      });

      audioSystem.current = new AudioRecorder(data => sttSystem.current!.sendAudio(data), 'system');
      audioMic.current = new AudioRecorder(data => sttMic.current!.sendAudio(data), 'mic');
      await Promise.all([audioSystem.current.start(), audioMic.current.start()]);
      setIsRecording(true);
    }
  };

  const handleAnswerNow = async (specificQuestion?: string) => {
    // Always read fresh state from Zustand to avoid stale closures
    const { profile: freshProfile, currentSession: freshSession, documents: freshDocs, transcripts: freshTranscripts } = useStore.getState();
    if (!freshSession || !llm.current || !keysReady) {
      console.warn('[LiveSession] handleAnswerNow blocked: session=', !!freshSession, 'llm=', !!llm.current, 'keysReady=', keysReady);
      return;
    }

    setIsGenerating(true);
    const questionToUse = specificQuestion || (freshTranscripts.length > 0 ? freshTranscripts[freshTranscripts.length - 1].text : 'Tell me about yourself.');
    
    if ((window as any).electronAPI) (window as any).electronAPI.widget.update({ text: 'Generating answer...', question: questionToUse });

    const resumeText = freshProfile?.resume_text || '';

    const prompt = buildPrompt(resumeText, freshSession.job_description, freshTranscripts.slice(-5).map(t => t.text), questionToUse, freshSession.interview_type as any, freshSession.language, freshDocs);
    const generated = await llm.current.generateAnswer(questionToUse, prompt);

    if ((window as any).electronAPI) (window as any).electronAPI.widget.update({ text: generated, question: questionToUse });
    const newAnswer = { 
      id: Date.now().toString(), 
      session_id: freshSession.id, 
      trigger_transcript_id: freshTranscripts[freshTranscripts.length - 1]?.id || 'none', 
      question_text: questionToUse,
      generated_text: generated, 
      mode: 'Concise', 
      created_at: new Date().toISOString() 
    };
    addAnswer(newAnswer);
    setIsGenerating(false);
    if ((window as any).electronAPI) (window as any).electronAPI.db.saveAnswer(newAnswer);
  };

  const handleEndSession = async () => {
    if (isRecording) toggleRecording();
    if ((window as any).electronAPI) {
      const minutesUsed = Math.ceil(elapsedSeconds / 60);
      const user = await (window as any).electronAPI.cloud.getUser();
      if (user && minutesUsed > 0) {
        await (window as any).electronAPI.cloud.incrementMinutes(user.id, minutesUsed);
      }
      (window as any).electronAPI.widget.close();
    }
    setCurrentView('scorecard');
  };

  const copyAnswer = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => { setCopyIdx(idx); setTimeout(() => setCopyIdx(null), 2000); });
  };

  const chipStyle = (active: boolean, warn: boolean): React.CSSProperties => ({
    fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem',
    color: warn ? '#ef4444' : active ? '#a78bfa' : 'rgba(255,255,255,0.3)',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(145deg, #09090f 0%, #0d0d1a 100%)' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: 58, borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(9,9,15,0.95)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        {/* Left: session info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎯</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff', lineHeight: 1.2 }}>{currentSession?.job_title} <span style={{ color: 'rgba(255,255,255,0.35)' }}>@</span> {currentSession?.company_name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isRecording ? '#22c55e' : 'rgba(255,255,255,0.2)', display: 'inline-block', boxShadow: isRecording ? '0 0 6px #22c55e' : 'none', transition: 'all 0.3s' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isRecording ? '#22c55e' : 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>{isRecording ? 'LIVE' : 'STANDBY'}</span>
              {isRecording && <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginLeft: '0.25rem' }}>{fmtTime(elapsedSeconds)}</span>}
            </div>
          </div>
        </div>

        {/* Center: analytics */}
        {isRecording && (
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.4rem 1.25rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.1rem' }}>PACE</div>
              <div style={chipStyle(true, micAnalytics.wpm > 160)}>{micAnalytics.wpm} <span style={{ fontSize: '0.6rem', fontWeight: 500 }}>WPM</span></div>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.1rem' }}>FILLERS</div>
              <div style={chipStyle(true, micAnalytics.fillers > 5)}>{micAnalytics.fillers}</div>
            </div>
          </div>
        )}

        {/* Right: controls */}
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={toggleRecording}
            style={{
              padding: '0.5rem 1.125rem', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
              background: isRecording ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
              color: isRecording ? '#ef4444' : '#fff',
              border: isRecording ? '1px solid rgba(239,68,68,0.3)' : 'none',
              boxShadow: isRecording ? 'none' : '0 0 16px rgba(124,58,237,0.3)',
              transition: 'all 0.2s',
            } as any}>
            {isRecording ? '⏹ Stop Listening' : '🎙 Listen to Meeting'}
          </button>
          <button onClick={handleEndSession}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
            End Session
          </button>
        </div>
      </header>

      {/* Main panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Transcript */}
        <div style={{ width: '36%', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>LIVE TRANSCRIPT</span>
            {isRecording && <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 700, letterSpacing: '0.06em', animation: 'pulse 2s infinite' }}>● LISTENING</span>}
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {transcripts.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '3rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.4 }}>🎙</div>
                Waiting for audio...
              </div>
            )}
            {transcripts.map((t, i) => (
              <div key={i} style={{ padding: '0.5rem 0.625rem', borderRadius: 8, background: t.speaker === 'Interviewer' ? 'rgba(167,139,250,0.06)' : 'rgba(34,197,94,0.05)', border: `1px solid ${t.speaker === 'Interviewer' ? 'rgba(167,139,250,0.12)' : 'rgba(34,197,94,0.1)'}` }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', color: t.speaker === 'Interviewer' ? '#a78bfa' : '#22c55e', marginBottom: '0.2rem' }}>{t.speaker.toUpperCase()}</div>
                <div style={{ fontSize: '0.82rem', color: t.is_final ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)', lineHeight: 1.5, fontStyle: t.is_final ? 'normal' : 'italic' }}>{t.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI Answers */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#09090f' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>✦ AI SUGGESTED ANSWERS</span>
              {isGenerating && (
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', opacity: 0.7, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              )}
            </div>
            <button onClick={() => handleAnswerNow()} disabled={isGenerating || !isRecording}
              style={{ padding: '0.375rem 0.75rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: isGenerating || !isRecording ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, cursor: isRecording && !isGenerating ? 'pointer' : 'not-allowed' }}>
              Force Answer
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {answers.length === 0 && !isGenerating && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '0.75rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>✦</div>
                <div style={{ fontSize: '0.82rem', maxWidth: 300 }}>AI answers will appear here automatically when the interviewer asks a question</div>
              </div>
            )}

            {/* Latest answer — displayed prominently */}
            {answers.length > 0 && (() => {
              const latest = answers[0];
              return (
                <div style={{ 
                  background: 'rgba(167,139,250,0.08)', 
                  border: '1px solid rgba(167,139,250,0.2)', 
                  borderRadius: 12, 
                  overflow: 'hidden',
                  animation: 'fadeIn 0.6s ease-out forwards'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 1rem', borderBottom: '1px solid rgba(167,139,250,0.1)', background: 'rgba(167,139,250,0.06)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: '#a78bfa' }}>LATEST ANSWER</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>{latest.question_text}</span>
                    </div>
                    <button onClick={() => copyAnswer(latest.generated_text, 0)}
                      style={{ padding: '0.2rem 0.6rem', borderRadius: 5, border: `1px solid ${copyIdx === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, background: copyIdx === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', color: copyIdx === 0 ? '#22c55e' : 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      {copyIdx === 0 ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <div style={{ padding: '1.25rem', fontSize: '0.9rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.9)' }}>
                    <div className="prose prose-sm dark:prose-invert">
                      <ReactMarkdown>{latest.generated_text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Older answers — compact, collapsed by default */}
            {answers.length > 1 && (
              <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', padding: '0.5rem 0', marginBottom: '0.25rem' }}>
                  PREVIOUS ({answers.length - 1})
                </div>
                {answers.slice(1).map((ans, i) => {
                  const realIdx = i + 1;
                  return (
                    <details key={realIdx} style={{ marginBottom: '0.5rem' }}>
                      <summary style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem', borderRadius: 8,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer', listStyle: 'none', fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.5)', fontWeight: 500
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em', color: 'rgba(167,139,250,0.35)', minWidth: 16 }}>#{answers.length - realIdx}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 350 }}>{ans.question_text}</span>
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); copyAnswer(ans.generated_text, realIdx); }}
                          style={{ padding: '0.15rem 0.5rem', borderRadius: 4, border: `1px solid ${copyIdx === realIdx ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`, background: copyIdx === realIdx ? 'rgba(34,197,94,0.1)' : 'transparent', color: copyIdx === realIdx ? '#22c55e' : 'rgba(255,255,255,0.25)', fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                          {copyIdx === realIdx ? '✓' : '📋'}
                        </button>
                      </summary>
                      <div style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.01)', borderRadius: '0 0 8px 8px', borderLeft: '2px solid rgba(167,139,250,0.15)', marginTop: 2 }}>
                        <div className="prose prose-sm dark:prose-invert">
                          <ReactMarkdown>{ans.generated_text}</ReactMarkdown>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {/* Debug Status Bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 12px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1rem', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 100 }}>
        <span>MIC: {audioMic.current ? `ACTIVE (${audioMic.current.getVolume()})` : 'OFF'}</span>
        <span>SYS: {audioSystem.current ? `ACTIVE (${audioSystem.current.getVolume()})` : 'OFF'}</span>
        <span>STT: {sttSystem.current ? `${sttSystem.current.getStats().sent} (S:${sttSystem.current.getStats().state}) ${sttSystem.current.getStats().error || ''}` : 'OFF'}</span>
        <span>REC: {isRecording ? 'ON' : 'OFF'}</span>
        <button onClick={() => window.location.reload()} style={{ pointerEvents: 'auto', background: 'none', border: 'none', color: '#a78bfa', textDecoration: 'underline', cursor: 'pointer' }}>Re-Sync</button>
        <span style={{ marginLeft: 'auto' }}>SESS: {currentSession?.id?.slice(0,5)}</span>
      </div>
    </div>
  );
}
