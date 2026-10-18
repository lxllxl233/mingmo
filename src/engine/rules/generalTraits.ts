export interface GeneralTraitBonus {
  attackPct: number;
  defensePct: number;
  siegePct: number;
  movePct: number;
  organizationPct: number;
  upkeepPct: number;
}

export interface GeneralTraitInfo extends GeneralTraitBonus {
  desc: string;
}

export const GENERAL_TRAIT_INFO: Record<string, GeneralTraitInfo> = {
  骁勇: { desc: '冲锋陷阵，攻击 +8%', attackPct: 8, defensePct: -2, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  善守: { desc: '坚壁拒敌，防御 +10%', attackPct: -2, defensePct: 10, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  谨慎: { desc: '持重不轻进，防御 +5%，攻击 -2%', attackPct: -2, defensePct: 5, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  跋扈: { desc: '骄横难制，攻击 +5%，军费 +5%', attackPct: 5, defensePct: -2, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 5 },
  水战: { desc: '长于舟师，水师作战与海运更稳', attackPct: 2, defensePct: 4, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  骑将: { desc: '精于骑战，攻击 +5%，行军 +10%', attackPct: 5, defensePct: 0, siegePct: 0, movePct: 10, organizationPct: 0, upkeepPct: 0 },
  火器: { desc: '善用火器，攻击 +6%', attackPct: 6, defensePct: 0, siegePct: 2, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  攻城: { desc: '擅长攻坚，围城 +15%', attackPct: 0, defensePct: 0, siegePct: 15, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  严明: { desc: '号令严整，组织恢复 +15%，防御 +4%', attackPct: 0, defensePct: 4, siegePct: 0, movePct: 0, organizationPct: 15, upkeepPct: 0 },
  贪财: { desc: '克扣军饷，军费 +8%，攻击 -2%', attackPct: -2, defensePct: 0, siegePct: 0, movePct: 0, organizationPct: -5, upkeepPct: 8 },
  忠勇: { desc: '忠勇可恃，攻击 +4%，防御 +4%', attackPct: 4, defensePct: 4, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  机敏: { desc: '用兵灵活，行军 +8%', attackPct: 0, defensePct: 0, siegePct: 0, movePct: 8, organizationPct: 0, upkeepPct: 0 },
  刚烈: { desc: '宁折不弯，攻击 +5%，防御 -2%', attackPct: 5, defensePct: -2, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
  行伍出身: { desc: '行伍出身，无额外加成', attackPct: 0, defensePct: 0, siegePct: 0, movePct: 0, organizationPct: 0, upkeepPct: 0 },
};

export function generalTraitBonus(traits: string[]): GeneralTraitBonus {
  const total: GeneralTraitBonus = {
    attackPct: 0,
    defensePct: 0,
    siegePct: 0,
    movePct: 0,
    organizationPct: 0,
    upkeepPct: 0,
  };
  for (const trait of traits) {
    const info = GENERAL_TRAIT_INFO[trait];
    if (!info) continue;
    total.attackPct += info.attackPct;
    total.defensePct += info.defensePct;
    total.siegePct += info.siegePct;
    total.movePct += info.movePct;
    total.organizationPct += info.organizationPct;
    total.upkeepPct += info.upkeepPct;
  }
  return total;
}
