import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface AnswerEntry {
  question: string;
  text: string;
}

export function Widget() {
  const [history, setHistory] = useState<AnswerEntry[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [opacity, setOpacity] = useState(0.9);
  const [isIgnoreMouse, setIsIgnoreMouse] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.widget.onUpdate((data: { text: string; question?: string }) => {
        const q = data.question || 'Question';

        // "Generating..." is a loading state, not a real answer
        if (data.text === 'Generating answer...') {
          setIsLoading(true);
          // Add a placeholder entry for the new question
          setHistory(prev => {
            const newHistory = [{ question: q, text: '' }, ...prev];
            return newHistory;
          });
          setCurrentIdx(0);
          return;
        }

        // Real answer received
        setIsLoading(false);
        setHistory(prev => {
          const updated = [...prev];
          // Update the most recent entry (index 0) with the actual answer
          if (updated.length > 0 && updated[0].question === q) {
            updated[0] = { question: q, text: data.text };
          } else {
            // Fallback: add as new entry
            updated.unshift({ question: q, text: data.text });
          }
          return updated;
        });
        setCurrentIdx(0);

        // Scroll to top when new answer arrives
        if (contentRef.current) contentRef.current.scrollTop = 0;
      });

      (window as any).electronAPI.widget.onToggleGhost(() => {
        setIsIgnoreMouse(prev => {
          const newVal = !prev;
          (window as any).electronAPI.widget.setIgnoreMouseEvents(newVal);
          return newVal;
        });
      });

      (window as any).electronAPI.widget.onClear(() => {
        setHistory([]);
        setIsLoading(false);
      });
    }
  }, []);

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    (window as any).electronAPI.widget.setOpacity(val);
  };

  const toggleClickThrough = () => {
    setIsIgnoreMouse(prev => {
      const newVal = !prev;
      (window as any).electronAPI.widget.setIgnoreMouseEvents(newVal);
      return newVal;
    });
  };

  const current = history[currentIdx];
  const hasMultiple = history.length > 1;
  const canPrev = currentIdx < history.length - 1;
  const canNext = currentIdx > 0;

  const navBtn = (_label: string, _onClick: () => void, enabled: boolean): React.CSSProperties => ({
    background: enabled ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${enabled ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)'}`,
    borderRadius: 5,
    padding: '2px 8px',
    color: enabled ? '#c4b5fd' : 'rgba(255,255,255,0.15)',
    fontSize: '0.62rem',
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'default',
    transition: 'all 0.15s',
  });

  return (
    <div 
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: `rgba(10, 10, 15, ${opacity})`, 
        color: '#fff', 
        borderRadius: 12, 
        border: '1px solid rgba(255,255,255,0.15)', 
        overflow: 'hidden', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)'
      }}
    >
      {/* Draggable Top Bar */}
      <div 
        style={{ 
          height: 32, 
          background: 'rgba(255,255,255,0.05)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 0.75rem',
          fontSize: '0.65rem',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.05em',
          cursor: 'move',
          WebkitAppRegion: 'drag',
          flexShrink: 0
        } as any}
      >
        <span>MOCKING BIRD AI</span>
        
        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', WebkitAppRegion: 'no-drag' } as any}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>💧</span>
              <input 
                type="range" min="0.1" max="1.0" step="0.1" 
                value={opacity} 
                onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                style={{ width: 60, height: 4, cursor: 'pointer', accentColor: '#a78bfa' }}
              />
            </div>
            <button 
              onClick={() => (window as any).electronAPI.widget.forceAnswer()}
              style={{ 
                background: 'rgba(167,139,250,0.15)', 
                border: '1px solid rgba(167,139,250,0.3)', 
                borderRadius: 4, 
                padding: '2px 6px', 
                color: '#c4b5fd', 
                fontSize: '0.6rem', 
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ⚡ Force Answer
            </button>
            <button 
              onClick={toggleClickThrough}
              style={{ 
                background: isIgnoreMouse ? '#7c3aed' : 'rgba(255,255,255,0.1)', 
                border: 'none', 
                borderRadius: 4, 
                padding: '2px 6px', 
                color: '#fff', 
                fontSize: '0.6rem', 
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {isIgnoreMouse ? '👻 Ghost On' : '👻 Ghost Off'}
            </button>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Alt+G to Toggle</span>
          </div>
        )}
      </div>

      {/* Navigation bar — only shows when there are multiple answers */}
      {hasMultiple && (
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.3rem 0.75rem',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0
        } as any}>
          <button 
            onClick={() => canPrev && setCurrentIdx(i => i + 1)} 
            disabled={!canPrev}
            style={navBtn('◀', () => {}, canPrev)}
          >
            ◀ Prev
          </button>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>
            {history.length - currentIdx} / {history.length}
          </span>
          <button 
            onClick={() => canNext && setCurrentIdx(i => i - 1)} 
            disabled={!canNext}
            style={navBtn('▶', () => {}, canNext)}
          >
            Next ▶
          </button>
        </div>
      )}
      
      {/* Scrollable Content */}
      <div 
        ref={contentRef}
        className="widget-content"
        style={{ 
          flex: 1, 
          padding: '1rem', 
          overflowY: 'auto', 
          WebkitAppRegion: 'no-drag',
          lineHeight: 1.6,
          fontSize: '0.875rem',
          animation: 'fadeIn 0.8s ease-out forwards'
        } as any}
      >
        {!current && !isLoading && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
            Waiting for AI suggestions...
          </div>
        )}

        {current && (
          <>
            <div style={{ marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.55rem', fontWeight: 800, color: currentIdx === 0 ? '#a78bfa' : 'rgba(167,139,250,0.4)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
                {currentIdx === 0 ? 'CURRENT QUESTION' : `QUESTION #${history.length - currentIdx}`}
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{current.question}</div>
            </div>

            {isLoading && currentIdx === 0 ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '1rem 0' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Generating...</span>
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.9)' }}>
                <ReactMarkdown>{current.text}</ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .widget-content::-webkit-scrollbar { width: 4px; }
        .widget-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .widget-content strong { color: #c4b5fd; font-weight: 700; }
        .widget-content code { background: rgba(167,139,250,0.15); padding: 2px 4px; border-radius: 4px; color: #c4b5fd; font-family: monospace; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
