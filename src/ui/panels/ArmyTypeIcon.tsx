import type { ArmyState } from '../../engine/state/types';

type Composition = ArmyState['composition'];

function primaryType(composition: Composition): { key: string; label: string } {
  const entries: Array<[string, number, string]> = [
    ['naval', composition.naval, '水师'],
    ['cavalry', composition.cavalry, '骑兵'],
    ['artillery', composition.artillery, '炮兵'],
    ['firearm', composition.firearm, '火器'],
    ['infantry', composition.infantry, '步兵'],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return top ? { key: top[0], label: top[2] } : { key: 'infantry', label: '步兵' };
}

function Glyph({ kind }: { kind: string }) {
  if (kind === 'naval') {
    return <><path d="M8 30h30l-5 9H14z" /><path d="M22 5l12 14H22z" /><path d="M10 43c6-4 10 2 16-1 6-3 9 2 15-1" fill="none" strokeWidth="2" /></>;
  }
  if (kind === 'cavalry') {
    return <><path d="M14 21c2-8 9-12 16-9l7-4-3 9 5 7-6 4-5-5-7 2-2 9h-5l-3-9z" /><path d="M14 36h22" fill="none" strokeWidth="2" /></>;
  }
  if (kind === 'artillery') {
    return <><path d="M9 22h25l8 5-8 5H9z" /><circle cx="17" cy="35" r="6" /><circle cx="34" cy="35" r="6" /></>;
  }
  if (kind === 'firearm') {
    return <><path d="M8 17h31v5H22l-5 7H8z" /><path d="M14 29l-3 9M30 22l4 4" fill="none" strokeWidth="2" /></>;
  }
  return <><path d="M24 5l14 6v12c0 10-7 15-14 18-7-3-14-8-14-18V11z" /><path d="M24 12v20M16 20h16" fill="none" strokeWidth="2" /></>;
}

export function ArmyTypeIcon({ composition, size = 32 }: { composition: Composition; size?: number }) {
  const type = primaryType(composition);
  return (
    <div className="army-type" title={`军队类型：${type.label}`} style={{ minWidth: size }}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-label={type.label}>
        <rect x="1" y="1" width="46" height="46" rx="4" fill="#f4ead7" stroke="#8b6a3f" strokeWidth="1" />
        <g fill="#4a3822" stroke="#4a3822" strokeWidth="1">
          <Glyph kind={type.key} />
        </g>
      </svg>
      <span>{type.label}</span>
    </div>
  );
}
