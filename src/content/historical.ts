const HISTORICAL_PREFIXES = [
  'ming_liaodong_',
  'ming_court_',
  'ming_fiscal_',
  'qing_entry_',
  'qing_banner_',
  'shun_east_',
  'shun_food_',
  'xi_sichuan_',
  'zheng_taiwan_',
  'zheng_resist_',
  'sming_',
  'japan_sakoku_',
  'joseon_tribute_',
  'mongol_unite_',
  'tibet_dharma_',
  'voc_trade_',
  'russia_expand_',
];

export function isHistoricalFocus(focusId: string): boolean {
  return HISTORICAL_PREFIXES.some(prefix => focusId.startsWith(prefix));
}
