import type { CountryDef } from '../../content/types';

const MARKS: Record<string, string> = {
  MING: '明', QING: '清', SHUN: '顺', XI: '西', SMING: '南', ZHENG: '郑',
  MONGOL: '蒙', JOSEON: '朝', JAPAN: '日', TIBET: '藏', VOC: '荷',
  RUSSIA: '俄', NEU: '藩',
};

export function CountryFlag({ country, width = 72 }: { country: CountryDef; width?: number }) {
  const mark = MARKS[country.tag] ?? country.tag.slice(0, 1);
  return (
    <svg
      viewBox="0 0 120 80"
      width={width}
      height={width * (80 / 120)}
      role="img"
      aria-label={`${country.name}旗帜`}
      style={{ display: 'block', border: '1px solid rgba(31,28,24,.35)', borderRadius: 2, flex: '0 0 auto' }}
    >
      <rect width="120" height="80" fill={country.color} />
      <path d="M0 0 L120 0 L120 12 L0 52 Z" fill="#f2ead8" opacity="0.22" />
      <path d="M0 80 L120 80 L120 68 L0 28 Z" fill="#1f1c18" opacity="0.16" />
      <rect x="4" y="4" width="112" height="72" fill="none" stroke="#f2ead8" strokeWidth="2" opacity="0.8" />
      <rect x="8" y="8" width="104" height="64" fill="none" stroke="#1f1c18" strokeWidth="1" opacity="0.55" />
      <circle cx="60" cy="40" r="22" fill="#f2ead8" opacity="0.92" stroke="#1f1c18" strokeWidth="1.5" />
      <text
        x="60"
        y="50"
        textAnchor="middle"
        fontFamily="'Noto Serif SC','Songti SC',serif"
        fontSize="30"
        fontWeight="700"
        fill="#1f1c18"
      >
        {mark}
      </text>
    </svg>
  );
}
