import type { LeaderDef } from '../../content/types';

function seedOf(text: string): number {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  return seed;
}

function Hat({ leader }: { leader: LeaderDef }) {
  const hair = leader.hair;
  const accent = leader.accent;
  switch (leader.style) {
    case 'emperor':
      return (
        <>
          <path d="M32 40 Q60 22 88 40 L84 52 Q60 40 36 52 Z" fill={hair} stroke="#241c18" strokeWidth="1.4" />
          <path d="M26 42 L34 46 M94 42 L86 46" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="52" y="28" width="16" height="9" rx="2" fill={accent} stroke="#241c18" strokeWidth="1" />
          <path d="M60 24 L60 17" stroke={accent} strokeWidth="2" />
          <circle cx="60" cy="15" r="3" fill={accent} stroke="#241c18" strokeWidth="0.8" />
        </>
      );
    case 'khan':
    case 'tsar':
      return (
        <>
          <ellipse cx="60" cy="38" rx="32" ry="13" fill={leader.style === 'tsar' ? '#6a4a32' : hair} stroke="#241c18" strokeWidth="1.4" />
          <rect x="32" y="36" width="56" height="8" rx="3" fill={leader.style === 'tsar' ? '#8a6a4a' : '#3a2a1a'} stroke="#241c18" strokeWidth="1" />
          <path d="M30 42 Q22 60 26 76 L36 72 Q34 56 40 46" fill={hair} stroke="#241c18" strokeWidth="1.2" />
          <path d="M90 42 Q98 60 94 76 L84 72 Q86 56 80 46" fill={hair} stroke="#241c18" strokeWidth="1.2" />
          <circle cx="60" cy="24" r="4" fill={accent} />
        </>
      );
    case 'shogun':
      return (
        <>
          <path d="M32 48 Q60 30 88 48 Q82 58 60 54 Q38 58 32 48 Z" fill={hair} stroke="#241c18" strokeWidth="1.2" />
          <rect x="55" y="24" width="10" height="18" rx="3" fill={hair} stroke="#241c18" strokeWidth="1" />
          <path d="M48 68 Q44 52 50 44 M72 68 Q76 52 70 44" stroke={hair} strokeWidth="4" fill="none" />
        </>
      );
    case 'king':
      return (
        <>
          <path d="M34 44 L40 24 L50 38 L60 18 L70 38 L80 24 L86 44 Z" fill={accent} stroke="#241c18" strokeWidth="1.4" />
          <rect x="30" y="42" width="60" height="8" rx="2" fill={accent} stroke="#241c18" strokeWidth="1.2" />
          <circle cx="60" cy="34" r="3" fill="#8a2b2b" />
        </>
      );
    case 'lama':
      return (
        <>
          <path d="M32 46 Q34 22 60 18 Q86 22 88 46 Q74 38 60 40 Q46 38 32 46 Z" fill={accent} stroke="#241c18" strokeWidth="1.3" />
          <path d="M38 46 Q60 54 82 46" stroke="#8a2b2b" strokeWidth="2" fill="none" />
          <circle cx="60" cy="20" r="3" fill="#8a2b2b" />
        </>
      );
    case 'director':
      return (
        <>
          <ellipse cx="60" cy="38" rx="40" ry="9" fill="#241c18" />
          <path d="M34 38 Q40 22 60 20 Q80 22 86 38" fill="#241c18" />
          <rect x="42" y="30" width="36" height="7" rx="2" fill={accent} />
        </>
      );
    case 'rebel':
      return (
        <>
          <path d="M30 44 Q60 34 90 44 L88 52 Q60 44 32 52 Z" fill={accent} stroke="#241c18" strokeWidth="1.2" />
          <path d="M88 48 L100 54 L90 58" fill={accent} stroke="#241c18" strokeWidth="1" />
          <path d="M34 52 Q30 64 34 72 M86 52 Q90 64 86 72" stroke={hair} strokeWidth="5" fill="none" />
        </>
      );
    case 'general':
    default:
      return (
        <>
          <path d="M30 46 Q38 24 60 22 Q82 24 90 46 Q76 40 60 42 Q44 40 30 46 Z" fill="#4a4a4a" stroke="#241c18" strokeWidth="1.3" />
          <path d="M60 20 Q64 8 72 4" stroke={accent} strokeWidth="4" fill="none" />
          <rect x="52" y="38" width="16" height="6" rx="2" fill={accent} />
        </>
      );
  }
}

export function LeaderPortrait({ leader, size = 120 }: { leader: LeaderDef; size?: number }) {
  const seed = seedOf(leader.name);
  const hatchId = `hatch-${seed}`;
  const faceWidth = 25 + (seed % 5);
  const eyeY = 74 + (seed % 3);
  const beard = seed % 4;
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={size * 1.15}
      role="img"
      aria-label={`${leader.title} ${leader.name} 的画像`}
      style={{ display: 'block', borderRadius: 4, border: '1px solid rgba(31,28,24,.25)' }}
    >
      <defs>
        <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <path d="M0 5 L5 0" stroke="#241c18" strokeWidth="0.7" opacity="0.24" />
        </pattern>
      </defs>
      <rect width="120" height="140" fill="#efe4cc" />
      <rect width="120" height="140" fill={`url(#${hatchId})`} opacity="0.5" />
      <circle cx="60" cy="68" r="48" fill={leader.accent} opacity="0.14" />
      <path d="M14 140 Q18 112 42 102 L60 116 L78 102 Q102 112 106 140 Z" fill={leader.robe} stroke="#241c18" strokeWidth="1.6" />
      <path d="M14 140 Q18 112 42 102 L60 116 L78 102 Q102 112 106 140 Z" fill={`url(#${hatchId})`} opacity="0.6" />
      <path d="M44 104 L60 116 L76 104 L80 112 L60 126 L40 112 Z" fill={leader.accent} opacity="0.85" />
      <rect x="51" y="94" width="18" height="20" rx="6" fill={leader.skin} />
      <ellipse cx="60" cy="78" rx={faceWidth} ry="32" fill={leader.skin} stroke="#241c18" strokeWidth="1.5" />
      <circle cx="34" cy="80" r="6" fill={leader.skin} stroke="#241c18" strokeWidth="1.2" />
      <circle cx="86" cy="80" r="6" fill={leader.skin} stroke="#241c18" strokeWidth="1.2" />
      <path d={`M34 70 Q36 44 60 42 Q84 44 86 70 L80 60 Q70 50 60 52 Q50 50 40 60 Z`} fill={leader.hair} />
      <Hat leader={leader} />
      <ellipse cx={60 - 12} cy={eyeY} rx="3.2" ry="2.2" fill="#241c18" />
      <ellipse cx={60 + 12} cy={eyeY} rx="3.2" ry="2.2" fill="#241c18" />
      <path d={`M${60 - 20} ${eyeY - 9} Q${60 - 12} ${eyeY - 13} ${60 - 6} ${eyeY - 9}`} stroke="#3a2a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={`M${60 + 6} ${eyeY - 9} Q${60 + 12} ${eyeY - 13} ${60 + 20} ${eyeY - 9}`} stroke="#3a2a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={`M60 ${eyeY + 4} L57 ${eyeY + 13} Q60 ${eyeY + 16} 63 ${eyeY + 13}`} stroke="#8a5a42" strokeWidth="1.8" fill="none" />
      <path d={`M52 ${eyeY + 22} Q60 ${eyeY + 27} 68 ${eyeY + 22}`} stroke="#6b2f2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {beard >= 1 && (
        <path d={`M46 ${eyeY + 18} Q42 ${eyeY + 34} 60 ${eyeY + 40} Q78 ${eyeY + 34} 74 ${eyeY + 18} Q68 ${eyeY + 26} 60 ${eyeY + 27} Q52 ${eyeY + 26} 46 ${eyeY + 18} Z`} fill={leader.hair} opacity="0.9" />
      )}
      {beard === 2 && (
        <path d={`M50 ${eyeY + 18} Q54 ${eyeY + 24} 60 ${eyeY + 25} Q66 ${eyeY + 24} 70 ${eyeY + 18}`} stroke={leader.hair} strokeWidth="3" fill="none" />
      )}
      <circle cx="33" cy="92" r="2.5" fill={leader.accent} />
      <circle cx="87" cy="92" r="2.5" fill={leader.accent} />
      <rect x="1" y="1" width="118" height="138" fill="none" stroke="#241c18" strokeWidth="2" />
      <rect x="5" y="5" width="110" height="130" fill="none" stroke="#8b6a3f" strokeWidth="0.7" opacity="0.8" />
      <rect x="92" y="112" width="18" height="14" fill="#9e2b25" opacity="0.9" />
      <text x="101" y="122" textAnchor="middle" fontSize="9" fill="#f2ead8" fontFamily="serif">印</text>
    </svg>
  );
}
