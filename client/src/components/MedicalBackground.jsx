import { useTheme } from '../context/ThemeContext.jsx';

const MEDICAL_ICONS = [
  // heartbeat / ECG
  { d: 'M2,12 h4 l2,-6 4,12 3,-8 2,2 h5', type: 'path' },
  // heart
  { d: 'M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z', type: 'path' },
  // medical cross
  { rect: true },
  // DNA
  { d: 'M5 3c4 4 10 4 14 0M5 21c4-4 10-4 14 0M6 8h12M6 16h12M8 12h8', type: 'path' },
  // stethoscope
  { d: 'M5 3v6a4 4 0 008 0V3M9 13v3a5 5 0 0010 0v-2M19 11m-2 0a2 2 0 104 0 2 2 0 00-4 0', type: 'path' },
  // shield + cross
  { d: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3zM12 9v6M9 12h6', type: 'path' },
];

const FLOATERS = [
  { icon: 0, top: '7%',  left: '5%',  size: 52, delay: 0,   dur: 14, colD: '#22d3ee', colL: '#0ea5e9' },
  { icon: 1, top: '15%', left: '85%', size: 60, delay: 2,   dur: 18, colD: '#f87171', colL: '#ef4444' },
  { icon: 2, top: '60%', left: '3%',  size: 56, delay: 1,   dur: 16, colD: '#34d399', colL: '#10b981' },
  { icon: 3, top: '80%', left: '88%', size: 50, delay: 3,   dur: 15, colD: '#818cf8', colL: '#6366f1' },
  { icon: 4, top: '40%', left: '92%', size: 44, delay: 4.5, dur: 20, colD: '#22d3ee', colL: '#0ea5e9' },
  { icon: 5, top: '72%', left: '50%', size: 48, delay: 2.5, dur: 17, colD: '#34d399', colL: '#10b981' },
  { icon: 0, top: '88%', left: '20%', size: 40, delay: 6,   dur: 13, colD: '#f87171', colL: '#ef4444' },
  { icon: 2, top: '5%',  left: '55%', size: 42, delay: 3.5, dur: 19, colD: '#818cf8', colL: '#6366f1' },
  { icon: 1, top: '50%', left: '12%', size: 36, delay: 5,   dur: 12, colD: '#22d3ee', colL: '#0ea5e9' },
  { icon: 3, top: '30%', left: '70%', size: 54, delay: 1.5, dur: 16, colD: '#34d399', colL: '#10b981' },
];

// ECG waveform — one cycle in a 400×120 box, baseline y=60
const ECG = 'M0,60 L90,60 L100,53 L120,60 L150,60 L158,74 L163,7 L169,77 L182,60 L202,60 L212,50 L236,60 L400,60';

function EcgStrip({ yOffset, opacity, speed, startDelay, color }) {
  // 5 tiled copies = 2000px wide; animation shifts 400px left to loop
  const tiles = [0,1,2,3,4].map((i) =>
    ECG
      .replace(/^M\d+/, `M${i*400}`)
      .replace(/L(\d+),/g, (_, n) => `L${+n + i*400},`)
  );

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: `${yOffset}%`,
        width: '125%',
        height: '120px',
        overflow: 'visible',
        opacity,
        animation: `ecgMove ${speed}s linear infinite`,
        animationDelay: `${startDelay}s`,
      }}
      viewBox="0 0 2000 120"
      preserveAspectRatio="none"
    >
      <path d={tiles.join(' ')} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function MedIcon({ icon, size, color, delay, dur, top, left }) {
  const { d, type, rect } = MEDICAL_ICONS[icon % MEDICAL_ICONS.length];
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: size,
        height: size,
        opacity: 0.18,
        color,
        animation: `medFloat ${dur}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {rect ? (
          <>
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M12 8v8M8 12h8" />
          </>
        ) : (
          <path d={d} />
        )}
      </svg>
    </div>
  );
}

export default function MedicalBackground() {
  const { isDark } = useTheme();

  const ecgColor  = isDark ? '#00e5a0' : '#0ea5e9';
  const bgFrom    = isDark ? '#030d1c' : '#e8f5ff';
  const bgMid     = isDark ? '#061528' : '#ddeeff';
  const bgTo      = isDark ? '#0a1f3a' : '#cde8ff';
  const blobA     = isDark ? 'rgba(6,182,212,0.08)' : 'rgba(14,165,233,0.12)';
  const blobB     = isDark ? 'rgba(52,211,153,0.06)' : 'rgba(16,185,129,0.10)';
  const blobC     = isDark ? 'rgba(129,140,248,0.06)' : 'rgba(99,102,241,0.08)';
  const gridColor = isDark ? '#1e3a5f' : '#93c5fd';

  return (
    <>
      <style>{`
        @keyframes ecgMove  { from { transform: translateX(0) }    to { transform: translateX(-400px) } }
        @keyframes medFloat { 0%,100% { transform: translateY(0px) rotate(0deg); }  50% { transform: translateY(-16px) rotate(4deg); } }
        @keyframes blobDrift { 0%,100% { transform: scale(1) translate(0,0); } 33% { transform: scale(1.08) translate(20px,-15px); } 66% { transform: scale(0.95) translate(-15px,20px); } }
        @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.6); opacity: 0; } }
      `}</style>

      <div
        className="fixed inset-0 overflow-hidden"
        style={{ zIndex: 0, background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgMid} 55%, ${bgTo} 100%)` }}
      >
        {/* Large soft blobs */}
        {[
          { left: '-8%', top: '-10%', size: 420, bg: blobA, delay: 0,   dur: 18 },
          { left: '75%', top: '60%',  size: 380, bg: blobB, delay: 4,   dur: 22 },
          { left: '40%', top: '30%',  size: 300, bg: blobC, delay: 8,   dur: 16 },
          { left: '80%', top: '-5%',  size: 260, bg: blobA, delay: 2,   dur: 20 },
          { left: '-5%', top: '65%',  size: 320, bg: blobB, delay: 6,   dur: 14 },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: b.left, top: b.top,
            width: b.size, height: b.size, borderRadius: '50%',
            background: b.bg, filter: 'blur(60px)',
            animation: `blobDrift ${b.dur}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
          }} />
        ))}

        {/* Subtle grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
          <defs>
            <pattern id="medgrid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M44 0H0V44" fill="none" stroke={gridColor} strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#medgrid)" />
        </svg>

        {/* ECG strips at different vertical positions */}
        <EcgStrip yOffset={15}  opacity={0.28} speed={8}  startDelay={0}   color={ecgColor} />
        <EcgStrip yOffset={45}  opacity={0.16} speed={10} startDelay={3}   color={ecgColor} />
        <EcgStrip yOffset={72}  opacity={0.12} speed={13} startDelay={6}   color={ecgColor} />

        {/* Floating medical icons */}
        {FLOATERS.map((f, i) => (
          <MedIcon
            key={i}
            icon={f.icon}
            size={f.size}
            color={isDark ? f.colD : f.colL}
            delay={f.delay}
            dur={f.dur}
            top={f.top}
            left={f.left}
          />
        ))}

        {/* Pulsing origin dot (heartbeat source) */}
        <div style={{ position: 'absolute', left: '2%', top: '44%' }}>
          {[0, 0.8, 1.6].map((d, i) => (
            <div key={i} style={{
              position: 'absolute', width: 20, height: 20,
              borderRadius: '50%', border: `1.5px solid ${ecgColor}`,
              animation: `pulseRing 2.4s ease-out infinite`,
              animationDelay: `${d}s`, opacity: 0.7,
              transform: 'translate(-50%,-50%)',
            }} />
          ))}
          <div style={{
            position: 'absolute', width: 8, height: 8,
            borderRadius: '50%', background: ecgColor,
            transform: 'translate(-50%,-50%)',
          }} />
        </div>

        {/* DNA ladder — left edge */}
        <svg
          style={{ position: 'absolute', left: 0, top: '5%', height: '90%', width: '50px', opacity: isDark ? 0.15 : 0.12 }}
          viewBox="0 0 50 700" preserveAspectRatio="none"
        >
          <line x1="8"  y1="0" x2="8"  y2="700" stroke={ecgColor} strokeWidth="1.5" />
          <line x1="42" y1="0" x2="42" y2="700" stroke={ecgColor} strokeWidth="1.5" />
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i}
              x1="8" y1={i * 35} x2="42" y2={i * 35 + 17}
              stroke={ecgColor} strokeWidth="1"
            />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i + 20}
              x1="42" y1={i * 35 + 17} x2="8" y2={i * 35 + 35}
              stroke={ecgColor} strokeWidth="1"
            />
          ))}
        </svg>

        {/* DNA ladder — right edge */}
        <svg
          style={{ position: 'absolute', right: 0, top: '5%', height: '90%', width: '50px', opacity: isDark ? 0.12 : 0.10 }}
          viewBox="0 0 50 700" preserveAspectRatio="none"
        >
          <line x1="8"  y1="0" x2="8"  y2="700" stroke={ecgColor} strokeWidth="1.5" />
          <line x1="42" y1="0" x2="42" y2="700" stroke={ecgColor} strokeWidth="1.5" />
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i}
              x1="8" y1={i * 35 + 17} x2="42" y2={i * 35}
              stroke={ecgColor} strokeWidth="1"
            />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i + 20}
              x1="42" y1={i * 35 + 35} x2="8" y2={i * 35 + 17}
              stroke={ecgColor} strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    </>
  );
}
