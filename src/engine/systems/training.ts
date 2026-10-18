import type { ContentIndex } from '../../content/types';
import type { ArmyState, GameState } from '../state/types';
import { pickGeneral } from './military';
import { FOREIGN_TRAINING_LIMIT, isForeignTemplate } from '../rules/armyTemplates';

const SILVER_PER_SIZE = 5000;
const FOOD_PER_SIZE = 600;
const MANPOWER_PER_SIZE = 1000;
const TRAINING_RATIO = 0.6;
const DAYS_PER_SIZE = 45;
const BASE_DAYS = 30;

export function trainingDaysFor(size: number): number {
  return size * DAYS_PER_SIZE + BASE_DAYS;
}

function createArmy(
  state: GameState,
  content: ContentIndex,
  tag: string,
  provinceId: string,
  templateId: string,
  size: number,
): ArmyState | null {
  const template = content.armyTemplates.get(templateId);
  if (!template) return null;
  if (state.provinces[provinceId]?.controller !== tag) return null;
  const id = `army_${state.nextArmyId}`;
  state.nextArmyId += 1;
  const army: ArmyState = {
    id,
    tag,
    name: `${content.countries.get(tag)?.name ?? tag} ${template.name}`,
    province: provinceId,
    history: [],
    movePath: [],
    moveProgress: 0,
    templateId,
    embarked: false,
    navalTarget: null,
    navalOrigin: null,
    navalProgress: 0,
    composition: {
      infantry: template.composition.infantry * size,
      firearm: template.composition.firearm * size,
      cavalry: template.composition.cavalry * size,
      artillery: template.composition.artillery * size,
      naval: template.composition.naval * size,
    },
    organization: content.balance.military.baseOrganization,
    maxStrength: (template.composition.infantry + template.composition.firearm
      + template.composition.cavalry + template.composition.artillery + template.composition.naval) * size,
    training: template.training,
    equipment: template.equipment,
    supply: 100,
    sourceEstate: template.sourceEstate,
    general: pickGeneral(state, content, tag),
    entrenchment: 0,
    stance: 'hold',
  };
  state.armies[id] = army;
  return army;
}

export function enqueueTraining(
  state: GameState,
  content: ContentIndex,
  tag: string,
  provinceId: string,
  templateId: string,
  size: number,
): boolean {
  const nation = state.countries[tag];
  const template = content.armyTemplates.get(templateId);
  const province = state.provinces[provinceId];
  if (!nation || !template || !province) return false;
  if (province.controller !== tag || size <= 0) return false;
  const costSilver = size * SILVER_PER_SIZE * TRAINING_RATIO;
  const costFood = size * FOOD_PER_SIZE * TRAINING_RATIO;
  const manpower = size * MANPOWER_PER_SIZE;
  if (nation.treasury < costSilver || nation.food < costFood || nation.manpower < manpower) {
    return false;
  }
  if (isForeignTemplate(tag, templateId)) {
    const foreignQueued = state.training.filter(entry => entry.tag === tag && isForeignTemplate(tag, entry.templateId)).length;
    const foreignActive = Object.values(state.armies).filter(army =>
      army.tag === tag && isForeignTemplate(tag, army.templateId)).length;
    if (foreignQueued + foreignActive >= FOREIGN_TRAINING_LIMIT) return false;
  }
  nation.manpower -= manpower;
  const totalDays = trainingDaysFor(size);
  const id = `training_${state.nextTrainingId}`;
  state.nextTrainingId += 1;
  state.training.push({
    id,
    tag,
    province: provinceId,
    templateId,
    size,
    daysLeft: totalDays,
    totalDays,
    costSilver,
    costFood,
    paidSilver: 0,
    paidFood: 0,
  });
  state.log.push({
    day: state.day,
    category: 'military',
    country: tag,
    text: `${template.name} ${size} 营进入训练队列（${totalDays} 日，训练耗银 ${Math.round(costSilver)} / 粮 ${Math.round(costFood)}）`,
    severity: 'info',
  });
  return true;
}

/** 训练每日扣除 60% 的钱粮；钱粮不足则训练停滞。 */
export function advanceTraining(state: GameState, content: ContentIndex): void {
  for (const item of [...state.training]) {
    const nation = state.countries[item.tag];
    if (!nation?.alive) {
      state.training = state.training.filter(entry => entry.id !== item.id);
      continue;
    }
    const silverDue = item.costSilver / item.totalDays;
    const foodDue = item.costFood / item.totalDays;
    if (nation.treasury < silverDue || nation.food < foodDue) continue;
    nation.treasury -= silverDue;
    nation.food -= foodDue;
    item.paidSilver += silverDue;
    item.paidFood += foodDue;
    item.daysLeft -= 1;
    if (item.daysLeft > 0) continue;
    const template = content.armyTemplates.get(item.templateId);
    const army = createArmy(state, content, item.tag, item.province, item.templateId, item.size);
    state.training = state.training.filter(entry => entry.id !== item.id);
    if (army) {
      state.log.push({
        day: state.day,
        category: 'military',
        country: item.tag,
        text: `${army.name} 训练完成，进驻 ${content.provinces.get(item.province)?.name ?? item.province}`,
        severity: 'info',
      });
    } else if (template) {
      state.log.push({
        day: state.day,
        category: 'military',
        country: item.tag,
        text: `${template.name} 训练完成，但兵营已失，部队解散`,
        severity: 'warning',
      });
    }
  }
}
