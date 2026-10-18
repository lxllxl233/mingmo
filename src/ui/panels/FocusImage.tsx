const MOTIFS = ['seal', 'coin', 'sword', 'ship', 'scroll', 'mountain', 'banner'] as const;
type Motif = typeof MOTIFS[number];

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

function motifOf(id: string, branch: string): Motif {
  const text = `${id}${branch}`;
  const pick = (variants: Motif[]): Motif => variants[hash(id) % variants.length] ?? 'seal';
  if (/sea|navy|trade|hai|zheng|japan/.test(text)) return pick(['ship', 'banner', 'coin']);
  if (/war|army|banner|liao|qing|mongol|russia/.test(text)) return pick(['sword', 'banner', 'mountain']);
  if (/tax|fiscal|economy|coin|salt|silver/.test(text)) return pick(['coin', 'scroll', 'seal']);
  if (/reform|law|exam|admin|govern/.test(text)) return pick(['scroll', 'seal', 'banner']);
  if (/court|central|eunuch|party|ming/.test(text)) return pick(['seal', 'scroll', 'banner']);
  if (/frontier|mountain|tibet|sichuan|west/.test(text)) return pick(['mountain', 'banner', 'sword']);
  return MOTIFS[hash(id) % MOTIFS.length] ?? 'seal';
}

function Emblem({ motif }: { motif: Motif }) {
  if (motif === 'coin') {
    return (
      <>
        <circle cx="32" cy="28" r="15" fill="none" stroke="#8b6a3f" strokeWidth="2.5" />
        <rect x="27" y="23" width="10" height="10" fill="#f7efdf" stroke="#8b6a3f" strokeWidth="2" />
        <path d="M18 46c8-6 20-6 28 0" fill="none" stroke="#9a7b4f" strokeWidth="1.5" />
      </>
    );
  }
  if (motif === 'sword') {
    return (
      <>
        <path d="M20 48L42 12l4 2-20 38z" fill="#8b6a3f" />
        <path d="M17 40l13 8M37 14l7 5" stroke="#4a3822" strokeWidth="3" />
        <path d="M12 17h15v18c0 6-4 9-7.5 10C16 44 12 41 12 35z" fill="none" stroke="#8b6a3f" strokeWidth="2" />
      </>
    );
  }
  if (motif === 'ship') {
    return (
      <>
        <path d="M10 36h44l-6 11H16z" fill="#8b6a3f" />
        <path d="M32 8v26M32 10l15 14H32z" fill="#d8c5a3" stroke="#8b6a3f" strokeWidth="2" />
        <path d="M8 51c8-4 12 2 20-1 8-3 12 2 20-1" fill="none" stroke="#6f8a86" strokeWidth="2" />
      </>
    );
  }
  if (motif === 'scroll') {
    return (
      <>
        <rect x="13" y="11" width="38" height="34" rx="2" fill="#f7efdf" stroke="#8b6a3f" strokeWidth="2" />
        <path d="M20 19h24M20 26h24M20 33h17" stroke="#7a6a54" strokeWidth="2" />
        <path d="M12 45h40" stroke="#b8892e" strokeWidth="3" />
      </>
    );
  }
  if (motif === 'mountain') {
    return (
      <>
        <circle cx="45" cy="15" r="6" fill="#b8892e" opacity=".7" />
        <path d="M7 46l14-22 10 14 7-9 13 17z" fill="#9a9a7a" />
        <path d="M19 29l7 5 5-5" fill="none" stroke="#f7efdf" strokeWidth="2" />
      </>
    );
  }
  if (motif === 'banner') {
    return (
      <>
        <path d="M18 8v42" stroke="#4a3822" strokeWidth="3" />
        <path d="M20 11h27l-6 9 6 9H20z" fill="#9e2b25" />
        <path d="M27 17h12M27 23h9" stroke="#f7efdf" strokeWidth="2" />
      </>
    );
  }
  return (
    <>
      <rect x="17" y="10" width="30" height="36" rx="3" fill="none" stroke="#8b6a3f" strokeWidth="2.5" />
      <path d="M24 20h16M24 28h16M24 36h10" stroke="#7a6a54" strokeWidth="2" />
      <circle cx="46" cy="44" r="7" fill="#9e2b25" opacity=".85" />
    </>
  );
}

export function FocusImage({ focusId, branch, size = 58 }: { focusId: string; branch: string; size?: number }) {
  const motif = motifOf(focusId, branch);
  return (
    <svg className="focus-image" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`paper-${focusId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9f1df" />
          <stop offset="1" stopColor="#e8d9bf" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="4" fill={`url(#paper-${focusId})`} stroke="#b49a73" />
      <path d="M6 6h10M6 6v10M58 6H48M58 6v10M6 58h10M6 58V48M58 58H48M58 58V48" stroke="#9e2b25" strokeWidth="1.2" opacity=".55" />
      <Emblem motif={motif} />
    </svg>
  );
}
