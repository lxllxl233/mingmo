import type { ArmyTemplate } from '../../content/types';

export function ArmyIcon({ template, size = 44 }: { template: ArmyTemplate; size?: number }) {
  const c = template.composition;
  const total = Math.max(1, c.infantry + c.firearm + c.cavalry + c.artillery + c.naval);
  const naval = c.naval / total > 0.35;
  const cavalry = c.cavalry / total > 0.35;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-label={`${template.name}兵种图标`} style={{ flex: '0 0 auto' }}>
      <rect x="1" y="1" width="62" height="62" rx="6" fill="#efe2c8" stroke="#3a3226" strokeWidth="1.4" />
      <path d="M6 50 L58 50" stroke="#9a7b4f" strokeWidth="1.4" opacity=".55" />
      {naval ? (
        <>
          <path d="M14 38 L50 38 L43 49 L21 49 Z" fill="#5a4a32" stroke="#241c18" strokeWidth="1.3" />
          <path d="M32 14 L32 38" stroke="#241c18" strokeWidth="2" />
          <path d="M33 16 L49 30 L33 34 Z" fill="#f2ead8" stroke="#241c18" strokeWidth="1.4" />
          <path d="M12 52 Q24 57 32 52 Q40 47 52 52" fill="none" stroke="#3f6f8a" strokeWidth="2" />
        </>
      ) : cavalry ? (
        <>
          <path d="M16 45 Q20 30 32 30 L43 27 L50 38 L43 49 L24 49 Z" fill="#5a4a32" stroke="#241c18" strokeWidth="1.4" />
          <circle cx="47" cy="28" r="5" fill="#5a4a32" stroke="#241c18" strokeWidth="1.2" />
          <path d="M22 46 L19 56 M41 46 L44 56" stroke="#241c18" strokeWidth="2.4" />
          <path d="M30 26 L35 12 L40 26" fill="#9e2b25" stroke="#241c18" strokeWidth="1.2" />
        </>
      ) : c.artillery > c.infantry ? (
        <>
          <circle cx="20" cy="43" r="8" fill="#5a4a32" stroke="#241c18" strokeWidth="1.4" />
          <circle cx="20" cy="43" r="3" fill="#efe2c8" />
          <path d="M26 38 L52 25 L55 30 L29 43 Z" fill="#3a3226" stroke="#241c18" strokeWidth="1.3" />
          <path d="M14 52 L50 52" stroke="#241c18" strokeWidth="2" />
        </>
      ) : (
        <>
          <circle cx="32" cy="19" r="7" fill="#d8b48a" stroke="#241c18" strokeWidth="1.4" />
          <path d="M22 30 Q32 24 42 30 L44 46 L20 46 Z" fill="#9e2b25" stroke="#241c18" strokeWidth="1.4" />
          <path d="M24 46 L22 56 M40 46 L42 56" stroke="#241c18" strokeWidth="2.6" />
          <path d="M42 28 L55 12" stroke="#241c18" strokeWidth="2" />
          <path d="M43 13 L56 11 L55 20" fill="none" stroke="#b8892e" strokeWidth="2" />
        </>
      )}
      <text x="32" y="61" textAnchor="middle" fontFamily="serif" fontSize="8" fill="#3a3226">
        {template.name.slice(0, 2)}
      </text>
    </svg>
  );
}
