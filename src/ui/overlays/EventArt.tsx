import type { EventDef } from '../../content/types';

type Motif = 'battle' | 'famine' | 'court' | 'sea' | 'trade' | 'default';

function motifOf(event: EventDef): Motif {
  const text = `${event.id}${event.title}${event.desc}`;
  if (/海|船|港|台湾|长崎|郑|澎湖|迁界|贸易|商路/.test(text)) return 'sea';
  if (/饥|灾|旱|蝗|疫|粮|流民|荒|赈/.test(text)) return 'famine';
  if (/战|兵|围|关|城|军|剿|掠|攻|守/.test(text)) return 'battle';
  if (/银|税|商|市|盐|漕|贸|财/.test(text)) return 'trade';
  if (/朝|党|宗|礼|官|帝|臣|议|嗣/.test(text)) return 'court';
  return 'default';
}

const GLYPHS: Record<Motif, string> = {
  battle: '战',
  famine: '灾',
  court: '朝',
  sea: '海',
  trade: '商',
  default: '变',
};

export function EventArt({ event, accent = '#9e2b25' }: { event: EventDef; accent?: string }) {
  const motif = motifOf(event);
  const glyph = GLYPHS[motif];
  return (
    <svg className="event-art" viewBox="0 0 160 220" role="img" aria-label={`${event.title} 木刻插图`}>
      <rect width="160" height="220" fill="#efe4cc" />
      <rect x="5" y="5" width="150" height="210" fill="none" stroke="#241c18" strokeWidth="1.4" />
      <rect x="9" y="9" width="142" height="202" fill="none" stroke="#8b6a3f" strokeWidth="0.5" />
      <circle cx="118" cy="42" r="19" fill={accent} opacity="0.16" />
      <circle cx="118" cy="42" r="19" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.45" />
      <path d="M0 160 L28 120 L48 142 L72 104 L98 138 L122 112 L160 154 L160 220 L0 220 Z" fill="#5c5244" opacity="0.16" />
      <path d="M0 178 L34 146 L58 166 L86 132 L110 164 L138 142 L160 174 L160 220 L0 220 Z" fill="#241c18" opacity="0.13" />
      {motif === 'sea' && (
        <>
          <path d="M8 176 Q28 168 48 176 T88 176 T128 176 T152 176" fill="none" stroke="#2b4a6f" strokeWidth="1.2" opacity="0.7" />
          <path d="M8 186 Q28 178 48 186 T88 186 T128 186 T152 186" fill="none" stroke="#2b4a6f" strokeWidth="0.9" opacity="0.55" />
          <path d="M80 154 L96 172 H64 Z" fill="#241c18" opacity="0.35" />
          <path d="M80 154 V132 M80 136 H94 L80 144" fill="none" stroke="#241c18" strokeWidth="1.4" opacity="0.55" />
        </>
      )}
      {motif === 'battle' && (
        <>
          <path d="M28 190 L42 152 M52 190 L42 152 M42 152 L42 128" fill="none" stroke="#241c18" strokeWidth="2" opacity="0.55" />
          <path d="M116 190 L130 148 M140 190 L130 148 M130 148 L130 122" fill="none" stroke="#241c18" strokeWidth="2" opacity="0.55" />
          <path d="M60 68 L100 68 L96 78 L64 78 Z" fill="#241c18" opacity="0.2" />
        </>
      )}
      {motif === 'famine' && (
        <>
          {[20, 38, 56].map(x => <path key={x} d={`M${x} 100 L${x - 8} 140`} stroke="#8b6a3f" strokeWidth="1.2" opacity="0.5" />)}
          <path d="M118 150 Q130 132 144 150 Q130 144 118 150 Z" fill="#8b6a3f" opacity="0.4" />
        </>
      )}
      {motif === 'court' && (
        <>
          <path d="M28 196 H132 M38 196 V158 H122 V196 M52 158 V126 H108 V158" fill="none" stroke="#241c18" strokeWidth="1.4" opacity="0.5" />
          <path d="M44 126 L80 104 L116 126 Z" fill="#241c18" opacity="0.22" />
        </>
      )}
      {motif === 'trade' && (
        <>
          <path d="M22 172 H138 L126 196 H34 Z" fill="#241c18" opacity="0.2" />
          <path d="M42 172 L54 136 H106 L118 172 M66 136 V112 H94 V136" fill="none" stroke="#241c18" strokeWidth="1.3" opacity="0.5" />
        </>
      )}
      <text
        x="80"
        y="132"
        textAnchor="middle"
        fontFamily="'Noto Serif SC','Source Han Serif SC','Songti SC',serif"
        fontSize="64"
        fill={accent}
        opacity="0.88"
      >
        {glyph}
      </text>
      <g transform="translate(112 184)">
        <rect width="30" height="22" fill="#9e2b25" opacity="0.9" />
        <text x="15" y="15" textAnchor="middle" fontSize="10" fill="#f2ead8">甲申</text>
      </g>
      <path d="M14 14 H146 M14 206 H146" stroke="#241c18" strokeWidth="0.6" opacity="0.35" />
    </svg>
  );
}
