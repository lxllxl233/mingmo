export interface MusicTrack {
  id: string;
  name: string;
  root: number;
  mode: 'minor' | 'major';
  notes: number[];
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

function makeTrack(id: string, name: string, root: number, mode: 'minor' | 'major', pattern: number[]): MusicTrack {
  const scale = mode === 'minor' ? MINOR : MAJOR;
  return {
    id,
    name,
    root,
    mode,
    notes: pattern.map(step => root * Math.pow(2, scale[step % scale.length]! / 12)),
  };
}

export const START_MUSIC: MusicTrack[] = [
  makeTrack('start_1', '山河入梦', 196, 'minor', [0, 3, 5, 2, 0, 4, 2, 1]),
  makeTrack('start_2', '甲申前夜', 174.6, 'minor', [0, 2, 4, 6, 4, 2, 0, 1]),
];

const FACTION_MUSIC: Record<string, MusicTrack[]> = {
  MING: [
    makeTrack('ming_1', '崇祯悲歌', 196, 'minor', [0, 3, 5, 4, 2, 0, 2, 1]),
    makeTrack('ming_2', '江南烟雨', 220, 'major', [0, 2, 4, 3, 2, 4, 5, 2]),
    makeTrack('ming_3', '九边烽火', 164.8, 'minor', [0, 1, 3, 4, 3, 1, 0, 2]),
  ],
  QING: [
    makeTrack('qing_1', '八旗猎猎', 174.6, 'minor', [0, 2, 3, 5, 3, 2, 0, 1]),
    makeTrack('qing_2', '关外风雷', 146.8, 'minor', [0, 3, 4, 6, 4, 3, 2, 0]),
  ],
  SHUN: [
    makeTrack('shun_1', '闯王鼓', 196, 'minor', [0, 2, 3, 2, 5, 3, 2, 0]),
    makeTrack('shun_2', '流民图', 164.8, 'minor', [0, 1, 2, 4, 2, 1, 0, 1]),
  ],
  XI: [makeTrack('xi_1', '蜀道惊雷', 174.6, 'minor', [0, 2, 4, 3, 1, 3, 2, 0])],
  SMING: [
    makeTrack('sming_1', '永历孤忠', 196, 'minor', [0, 3, 5, 6, 5, 3, 2, 0]),
    makeTrack('sming_2', '西南残照', 174.6, 'minor', [0, 2, 3, 4, 3, 2, 1, 0]),
  ],
  ZHENG: [
    makeTrack('zheng_1', '海上明月', 220, 'major', [0, 2, 4, 5, 4, 2, 1, 2]),
    makeTrack('zheng_2', '潮起鹿耳门', 196, 'minor', [0, 3, 5, 4, 2, 3, 2, 1]),
  ],
  MONGOL: [
    makeTrack('mongol_1', '草原长调', 146.8, 'minor', [0, 2, 4, 2, 5, 4, 2, 0]),
    makeTrack('mongol_2', '盟旗之风', 164.8, 'minor', [0, 3, 4, 5, 4, 3, 1, 0]),
  ],
  JOSEON: [
    makeTrack('joseon_1', '汉江朝雾', 196, 'major', [0, 2, 4, 3, 2, 4, 2, 0]),
    makeTrack('joseon_2', '北望', 174.6, 'minor', [0, 3, 5, 3, 2, 1, 0, 2]),
  ],
  JAPAN: [
    makeTrack('japan_1', '樱花锁国', 220, 'major', [0, 2, 3, 5, 3, 2, 4, 2]),
    makeTrack('japan_2', '远海', 164.8, 'minor', [0, 2, 4, 5, 4, 2, 1, 0]),
  ],
  TIBET: [makeTrack('tibet_1', '雪山梵音', 146.8, 'minor', [0, 3, 4, 3, 5, 4, 2, 0])],
  VOC: [makeTrack('voc_1', '东印度风', 196, 'major', [0, 2, 4, 5, 6, 5, 4, 2])],
  RUSSIA: [makeTrack('russia_1', '顿河雪原', 146.8, 'minor', [0, 2, 3, 2, 4, 3, 2, 0])],
  NEU: [makeTrack('neu_1', '雨林深处', 164.8, 'minor', [0, 2, 3, 4, 3, 2, 0, 1])],
};

const SCENARIO_MUSIC: Record<string, MusicTrack> = {
  '1627': makeTrack('scenario_1627', '崇祯元年', 174.6, 'minor', [0, 3, 5, 2, 0, 4, 2, 1]),
  '1644': makeTrack('scenario_1644', '甲申国变', 196, 'minor', [0, 1, 3, 5, 3, 2, 0, 1]),
  '1650': makeTrack('scenario_1650', '永历播迁', 164.8, 'minor', [0, 2, 3, 4, 3, 1, 0, 2]),
};

export function musicForFaction(tag: string, scenarioId = ''): MusicTrack[] {
  const scenario = SCENARIO_MUSIC[scenarioId];
  return [...(scenario ? [scenario] : []), ...(FACTION_MUSIC[tag] ?? FACTION_MUSIC.MING ?? START_MUSIC)];
}
