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
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sttSystem = useRef<DeepgramProvider | null>(null);
  const sttMic = useRef<DeepgramProvider | null>(null);
  const llm = useRef<OpenAIProvider | null>(null);
  const audioSystem = useRef<AudioRecorder | null>(null);
  const audioMic = useRef<AudioRecorder | null>(null);
  const autoAnswerTimer = useRef<NodeJS.Timeout | null>(null);
  const questionBufferRef = useRef<string[]>([]);

  useEffect(() => {
    if ((window as any).electronAPI) {
      const loadKeys = async () => {
        let dgKey = await (window as any).electronAPI.store.get('DEEPGRAM_API_KEY');
        let oaKey = await (window as any).electronAPI.store.get('OPENAI_API_KEY');
        
        const state = useStore.getState();
        if (!state.isLicensed && state.cloudUser) {
          try {
            const session = await (window as any).electronAPI.cloud.getAuthSession();
            if (session?.access_token) {
              // Fetch proxy config from web app
              const res = await fetch('https://project-vw750.vercel.app/api/desktop/config', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
              });
              if (res.ok) {
                const config = await res.json();
                dgKey = config.deepgram_key;
                // Use JWT for OpenAI proxy
                oaKey = `ey-${session.access_token}`; // Prefix so we know it's a proxy token
              } else {
                alert(`Failed to connect to Cloud Proxy (Status: ${res.status}). Ensure you have an internet connection and the service is up.`);
              }
            }
          } catch (e: any) {
            console.error('Failed to load cloud proxy config', e);
            alert(`Failed to reach Cloud Proxy at project-vw750.vercel.app: ${e.message}`);
          }
        }
        
        const lang = currentSession?.language || 'en';
        sttSystem.current = new DeepgramProvider(dgKey || 'mock_key', lang);
        sttMic.current = new DeepgramProvider(dgKey || 'mock_key', lang);
        llm.current = new OpenAIProvider(oaKey || 'mock_key');
      };
      loadKeys();
      (window as any).electronAPI.widget.open();
    }
    return () => { if (autoAnswerTimer.current) clearTimeout(autoAnswerTimer.current); };
  }, []);

  // Session timer
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
      await Promise.all([sttSystem.current.connect(), sttMic.current.connect()]);
      let ongoingSysId = Date.now().toString() + '-sys';
      let ongoingMicId = Date.now().toString() + '-mic';

      sttSystem.current.onTranscript((text, isFinal) => {
        addTranscript({ id: ongoingSysId, session_id: currentSession!.id, speaker: 'Interviewer', text, start_time: Date.now(), end_time: Date.now(), is_final: isFinal });
        if (isFinal) {
          ongoingSysId = Date.now().toString() + '-sys';
          
          // Fragmentation fix: Buffer the text and check for punctuation
          questionBufferRef.current.push(text.trim());
          const endsCleanly = /[?.!]$/.test(text.trim());

          if (autoAnswerTimer.current) clearTimeout(autoAnswerTimer.current);

          const fireAnswer = () => {
            const fullQuestion = questionBufferRef.current.join(' ');
            questionBufferRef.current = []; // Clear for next round
            if (fullQuestion.length > 15) {
              handleAnswerNow(fullQuestion);
            }
          };

          if (endsCleanly) {
            fireAnswer();
          } else {
            autoAnswerTimer.current = setTimeout(fireAnswer, 5000);
          }
        }
      });

      sttMic.current.onTranscript((text, isFinal, analytics) => {
        addTranscript({ id: ongoingMicId, session_id: currentSession!.id, speaker: 'You', text, start_time: Date.now(), end_time: Date.now(), is_final: isFinal });
        if (analytics) setMicAnalytics(prev => ({ wpm: isFinal ? analytics.wpm : prev.wpm, fillers: prev.fillers + analytics.fillers }));
        if (isFinal) ongoingMicId = Date.now().toString() + '-mic';
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
    if (!freshSession || !llm.current) return;

    setIsGenerating(true);
    if ((window as any).electronAPI) (window as any).electronAPI.widget.update('Generating answer...');

    const question = specificQuestion || (freshTranscripts.length > 0 ? freshTranscripts[freshTranscripts.length - 1].text : 'Tell me about yourself.');
    const resumeText = freshProfile?.resume_text || '';

    const prompt = buildPrompt(resumeText, freshSession.job_description, freshTranscripts.slice(-5).map(t => t.text), question, freshSession.interview_type as any, freshSession.language, freshDocs);
    const generated = await llm.current.generateAnswer(question, prompt);

    if ((window as any).electronAPI) (window as any).electronAPI.widget.update(generated);
    const newAnswer = { id: Date.now().toString(), session_id: freshSession.id, trigger_transcript_id: freshTranscripts[freshTranscripts.length - 1]?.id || 'none', generated_text: generated, mode: 'Concise', created_at: new Date().toISOString() };
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
            {answers.map((ans, i) => (
              <div key={i} style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 1rem', borderBottom: '1px solid rgba(167,139,250,0.1)', background: 'rgba(167,139,250,0.05)' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,250,0.6)' }}>✦ {ans.mode.toUpperCase()} ANSWER #{answers.length - i}</span>
                  <button onClick={() => copyAnswer(ans.generated_text, i)}
                    style={{ padding: '0.2rem 0.6rem', borderRadius: 5, border: `1px solid ${copyIdx === i ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, background: copyIdx === i ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', color: copyIdx === i ? '#22c55e' : 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                    {copyIdx === i ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
                <div style={{ padding: '1rem', fontSize: '0.875rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.85)' }}>
                  <div className="prose prose-sm dark:prose-invert">
                    <ReactMarkdown>{ans.generated_text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
      `}</style>
    </div>
  );
}
