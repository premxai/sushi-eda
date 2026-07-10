/** Vector recreation of the supplied Sushi analytics mark. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Sushi">
      <circle cx="32" cy="32" r="29" fill="#101A1C" />
      <circle cx="32" cy="32" r="19.5" fill="#FFF7EA" />
      <path d="M20 31.5A12 12 0 0 1 31.5 20v11.5H20Z" fill="#E87A62" />
      <path d="M20.2 35h8.2v5.6h-6.1a12 12 0 0 1-2.1-5.6Z" fill="#D86645" />
      <path d="M30.6 35v5.6h-5.8V35h5.8Z" fill="#C9504D" />
      <path d="M31.5 43.8a12 12 0 0 1-7.1-2.3h7.1v2.3Z" fill="#D86645" />
      <path d="M35 35h11.3A12 12 0 0 1 35 46.3V35Z" fill="#9ABC58" />
      <rect x="35" y="28.4" width="3.6" height="3.1" fill="#E87A62" />
      <rect x="40.4" y="24.5" width="3.8" height="7" fill="#D9534F" />
      <rect x="46" y="20.5" width="3.8" height="11" fill="#9ABC58" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
