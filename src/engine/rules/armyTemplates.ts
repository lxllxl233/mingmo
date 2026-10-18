const TEMPLATE_ORIGINS: Record<string, string> = {
  ming_guard: 'MING',
  guanning_army: 'MING',
  ming_artillery: 'MING',
  ming_navy: 'MING',
  qing_banner: 'QING',
  qing_green: 'QING',
  shun_rebel: 'SHUN',
  shun_cavalry: 'SHUN',
  xi_army: 'XI',
  sming_army: 'SMING',
  zheng_navy: 'ZHENG',
  zheng_marines: 'ZHENG',
  mongol_cavalry: 'MONGOL',
  joseon_army: 'JOSEON',
  japan_samurai: 'JAPAN',
  japan_navy: 'JAPAN',
  tibet_army: 'TIBET',
  voc_company: 'VOC',
  voc_fleet: 'VOC',
  russia_cossack: 'RUSSIA',
  neutrals_tribal: 'NEU',
};

export const FOREIGN_TRAINING_LIMIT = 2;

export function templateOrigin(templateId: string): string | null {
  return TEMPLATE_ORIGINS[templateId] ?? null;
}

export function isForeignTemplate(tag: string, templateId: string): boolean {
  const origin = templateOrigin(templateId);
  return origin !== null && origin !== tag;
}
