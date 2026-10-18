import type { General, LeaderDef } from '../../content/types';
import { LeaderPortrait } from './LeaderPortrait';

export function GenericGeneralPortrait({ size = 96, accent = '#b8892e' }: { size?: number; accent?: string }) {
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={size * 1.15}
      role="img"
      aria-label="通用将领头像"
      style={{ display: 'block', borderRadius: 4, border: '1px solid rgba(31,28,24,.25)' }}
    >
      <rect width="120" height="140" fill="#e9e1d0" />
      <circle cx="60" cy="62" r="46" fill={accent} opacity="0.14" />
      <path d="M16 140 Q20 112 44 102 L60 116 L76 102 Q100 112 104 140 Z" fill="#5b5043" stroke="#241c18" strokeWidth="1.6" />
      <path d="M44 104 L60 116 L76 104 L80 112 L60 126 L40 112 Z" fill={accent} opacity="0.9" />
      <rect x="52" y="96" width="16" height="18" rx="5" fill="#cbbfa9" />
      <circle cx="60" cy="76" r="27" fill="#cbbfa9" stroke="#241c18" strokeWidth="1.4" />
      <path d="M31 68 Q34 40 60 38 Q86 40 89 68 Q78 56 60 58 Q42 56 31 68 Z" fill="#4a4034" stroke="#241c18" strokeWidth="1.2" />
      <path d="M28 64 Q60 50 92 64 L86 72 Q60 60 34 72 Z" fill="#4a4034" stroke="#241c18" strokeWidth="1.2" />
      <path d="M60 22 L60 18" stroke={accent} strokeWidth="3" />
      <circle cx="60" cy="16" r="3.5" fill={accent} stroke="#241c18" strokeWidth="0.8" />
      <ellipse cx="49" cy="78" rx="3" ry="2" fill="#241c18" opacity="0.65" />
      <ellipse cx="71" cy="78" rx="3" ry="2" fill="#241c18" opacity="0.65" />
      <path d="M48 95 Q60 101 72 95" stroke="#241c18" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="1" y="1" width="118" height="138" fill="none" stroke="#241c18" strokeWidth="2" />
    </svg>
  );
}

export function GeneralPortrait({
  general,
  countryColor,
  size = 96,
}: {
  general: General | null | undefined;
  countryColor: string;
  size?: number;
}) {
  if (!general || general.generic) return <GenericGeneralPortrait size={size} accent={countryColor} />;
  const leader: LeaderDef = {
    name: general.name,
    title: '将领',
    style: 'general',
    trait: general.traits.length > 0 ? general.traits.join(' · ') : '行伍出身',
    skin: '#d9b08c',
    hair: '#241c18',
    robe: countryColor,
    accent: '#b8892e',
  };
  return <LeaderPortrait leader={leader} size={size} />;
}
