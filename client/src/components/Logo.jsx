export default function Logo({ size = 56 }) {
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xl shadow-brand-500/40"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-2xl bg-white/20 blur-md animate-pulse-slow" />
      <svg
        viewBox="0 0 64 64"
        className="relative"
        style={{ width: size * 0.6, height: size * 0.6 }}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 32 h10 l4 -10 l6 20 l5 -14 l4 8 h19" />
        <circle cx="32" cy="32" r="26" strokeOpacity="0.35" />
      </svg>
    </div>
  );
}
