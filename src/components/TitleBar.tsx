import { useState } from 'react';

export function TitleBar() {
  const [isHovered, setIsHovered] = useState(false);

  const handleDoubleClick = () => {
    if ((window as any).electronAPI && (window as any).electronAPI.windowAPI) {
      (window as any).electronAPI.windowAPI.toggleMaximize();
    }
  };

  return (
    <div 
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="h-8 w-full bg-background flex items-center px-4 select-none z-50 border-b border-white/5"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className={`text-xs font-semibold tracking-widest transition-colors duration-300 ${isHovered ? 'text-primary' : 'text-white/30'}`}>
        MOCKING BIRD AI
      </div>
      
      {/* We add an empty spacer here so the native window controls overlay (minimize, close) has space to click without dragging */}
      <div className="ml-auto w-32 h-full" style={{ WebkitAppRegion: 'no-drag' } as any}></div>
    </div>
  );
}
