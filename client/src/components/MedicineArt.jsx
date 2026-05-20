export default function MedicineArt({ genericName, className = '' }) {
  const Art = ART_BY_GENERIC[genericName] || DefaultPill;
  return <Art className={className} />;
}

const ART_BY_GENERIC = {
  paracetamol: ParacetamolBlister,
  'oral rehydration salts': OrsSachet,
  bandage: AdhesiveBandage,
  'ascorbic acid': VitaminOrange,
};

function ParacetamolBlister({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="foil" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f5f7fa" />
          <stop offset="1" stopColor="#c4cbd6" />
        </linearGradient>
      </defs>
      <rect x="12" y="20" width="72" height="56" rx="10" fill="url(#foil)" stroke="#94a3b8" strokeWidth="1.2" />
      {[0, 1].map((row) =>
        [0, 1, 2].map((col) => (
          <g key={`${row}-${col}`} transform={`translate(${22 + col * 18}, ${32 + row * 18})`}>
            <rect x="-7" y="-6" width="14" height="12" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <line x1="-4" y1="0" x2="4" y2="0" stroke="#e2e8f0" strokeWidth="1" />
          </g>
        ))
      )}
    </svg>
  );
}

function OrsSachet({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sachet" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path d="M22 22 h52 l-4 4 v48 a4 4 0 0 1 -4 4 H30 a4 4 0 0 1 -4 -4 V26 z" fill="url(#sachet)" stroke="#0284c7" strokeWidth="1.2" />
      <rect x="24" y="20" width="48" height="6" fill="#0284c7" opacity="0.55" />
      <path d="M28 22 L30 16 H34 L32 22 M64 22 L66 16 H70 L68 22" fill="#bae6fd" />
      <text x="48" y="58" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="12" fill="#0c4a6e">ORS</text>
      <line x1="30" y1="68" x2="66" y2="68" stroke="#0c4a6e" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function AdhesiveBandage({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <g transform="translate(48 48) rotate(-30)">
        <rect x="-38" y="-11" width="76" height="22" rx="11" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" />
        <rect x="-14" y="-9" width="28" height="18" rx="3" fill="#fef3c7" />
        {[-18, -8, 2, 12, 22, -28].map((x, i) => (
          <circle key={i} cx={x} cy={i % 2 === 0 ? -4 : 4} r="1.2" fill="#b45309" opacity="0.55" />
        ))}
        {[-18, -8, 2, 12, 22, -28].map((x, i) => (
          <circle key={`b${i}`} cx={x} cy={i % 2 === 0 ? 4 : -4} r="1.2" fill="#b45309" opacity="0.55" />
        ))}
      </g>
    </svg>
  );
}

function VitaminOrange({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="peel" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fed7aa" />
          <stop offset="1" stopColor="#f97316" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="30" fill="url(#peel)" stroke="#c2410c" strokeWidth="1.5" />
      <g stroke="#fff7ed" strokeWidth="1.5" opacity="0.85">
        {[0, 45, 90, 135].map((deg) => (
          <line
            key={deg}
            x1={48 - 26 * Math.cos((deg * Math.PI) / 180)}
            y1={48 - 26 * Math.sin((deg * Math.PI) / 180)}
            x2={48 + 26 * Math.cos((deg * Math.PI) / 180)}
            y2={48 + 26 * Math.sin((deg * Math.PI) / 180)}
          />
        ))}
      </g>
      <circle cx="48" cy="48" r="6" fill="#fff7ed" stroke="#c2410c" strokeWidth="1" />
      <path d="M46 20 C 48 14 52 14 54 18 L 52 22 Z" fill="#16a34a" />
    </svg>
  );
}

function DefaultPill({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <g transform="translate(48 48) rotate(-30)">
        <rect x="-26" y="-10" width="52" height="20" rx="10" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="-26" y="-10" width="26" height="20" rx="10" fill="#fef3c7" stroke="#94a3b8" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
