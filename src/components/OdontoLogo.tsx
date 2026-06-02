export function OdontoLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="OdontoClinic"
    >
      <defs>
        <linearGradient id="oc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c82e8" />
          <stop offset="100%" stopColor="#3b5bdb" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#oc-grad)" />
      {/* Three orbital ellipses */}
      <ellipse cx="20" cy="20" rx="11" ry="4.5" fill="none" stroke="white" strokeWidth="1.6" opacity="0.92" />
      <ellipse cx="20" cy="20" rx="11" ry="4.5" fill="none" stroke="white" strokeWidth="1.6" opacity="0.92" transform="rotate(60 20 20)" />
      <ellipse cx="20" cy="20" rx="11" ry="4.5" fill="none" stroke="white" strokeWidth="1.6" opacity="0.92" transform="rotate(-60 20 20)" />
      {/* Nucleus */}
      <circle cx="20" cy="20" r="3" fill="white" />
    </svg>
  );
}
