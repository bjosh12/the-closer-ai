import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export function Widget() {
  const [text, setText] = useState('Waiting for AI suggestions...');
  const [opacity, setOpacity] = useState(0.9);
  const [isIgnoreMouse, setIsIgnoreMouse] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.widget.onUpdate((newText: string) => {
        setText(newText);
      });
    }
  }, []);

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    (window as any).electronAPI.widget.setOpacity(val);
  };

  const toggleClickThrough = () => {
    const newVal = !isIgnoreMouse;
    setIsIgnoreMouse(newVal);
    (window as any).electronAPI.widget.setIgnoreMouseEvents(newVal);
  };

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
          WebkitAppRegion: 'drag'
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
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Alt+C to Toggle</span>
          </div>
        )}
      </div>
      
      {/* Scrollable Content */}
      <div 
        className="widget-content"
        style={{ 
          flex: 1, 
          padding: '1rem', 
          overflowY: 'auto', 
          WebkitAppRegion: 'no-drag',
          lineHeight: 1.6,
          fontSize: '0.875rem'
        } as any}
      >
        <div style={{ color: 'rgba(255,255,255,0.9)' }}>
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>

      <style>{`
        .widget-content::-webkit-scrollbar { width: 4px; }
        .widget-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .widget-content strong { color: #c4b5fd; font-weight: 700; }
        .widget-content code { background: rgba(167,139,250,0.15); padding: 2px 4px; border-radius: 4px; color: #c4b5fd; font-family: monospace; }
      `}</style>
    </div>
  );
}
