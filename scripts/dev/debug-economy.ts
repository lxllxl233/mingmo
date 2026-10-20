import { loadContentFromDirectory } from '../../src/content/loader/node';
import { createInitialState } from '../../src/engine/state/initial';
import { runMonthlyEconomy } from '../../src/engine/systems/economy';

const content = loadContentFromDirectory();
const state = createInitialState(content, '1627', 42, 'MING');
const ming = state.countries['MING']!;
ming.inflation = 0;
ming.foodPurchasePct = 0;
ming.arrears = 0;
ming.wageArrears = 0;
console.log('before treasury', ming.treasury, 'arrears', ming.arrears, 'troops', Object.values(state.armies).filter(a => a.tag === 'MING').length);
runMonthlyEconomy(state, content);
const r = ming.lastReport!;
const identity = r.income - (r.corruptionLoss ?? 0) - (r.loyaltyCost ?? 0) - (r.expenseCourt ?? 0) - (r.expenseArmyPaid ?? 0) - (r.foodPurchaseSilver ?? 0) - (r.expenseTraining ?? 0);
console.log({
  income: r.income,
  tax: r.taxIncome,
  corruptionLoss: r.corruptionLoss,
  loyaltyCost: r.loyaltyCost,
  pressure: r.expenseCourt,
  armyPay: r.expenseArmy,
  armyPaid: r.expenseArmyPaid,
  wageShortfall: r.wageShortfall,
  foodPurchase: r.foodPurchaseSilver,
  training: r.expenseTraining,
  net: r.net,
  identity,
  diff: identity - r.net,
  arrearsAfter: ming.arrears,
  treasuryAfter: ming.treasury,
});
