const CHANGELOG: Record<string, string[]> = {
  '2.0.5': [
    '🔑 Improved license activation — create account and activate in one step',
    '🔒 License revocation now immediately downgrades user plan',
    '🔄 Auto-updates — app silently downloads and installs new versions',
    '📍 System tray — app lives in tray, never fully closes',
    '💾 Window position remembered between sessions',
    '🚀 Launch at startup option added to Settings',
    '⚠️ Blank window on "Switch to Lifetime License" fixed',
  ],
  '2.0.4': [
    '🛡️ Admin dashboard hardened with RLS policy fixes',
    '⏱️ Session timer with upgrade modal at limit',
    '📋 Copy Answer button in AI panel',
    '🎉 Stripe upgrade success banner',
  ],
};

interface Props {
  version: string;
  onClose: () => void;
}

export function WhatsNewModal({ version, onClose }: Props) {
  const changes = CHANGELOG[version] ?? [`Version ${version} — improvements and bug fixes.`];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(145deg, #0f0f1a, #0a0a12)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: 20, padding: '2rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 1rem',
          }}>🎉</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            What's New in v{version}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
            Here's what changed in this update
          </p>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {changes.map((item, i) => (
            <li key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '0.65rem 1rem',
              fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5,
            }}>
              {item}
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '0.875rem',
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            border: 'none', borderRadius: 10, color: '#fff',
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          Got it, let's go →
        </button>
      </div>
    </div>
  );
}
