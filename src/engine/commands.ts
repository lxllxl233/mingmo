import type { ContentIndex } from '../content/types';
import { evaluateTrigger } from './rules/triggers';
import { applyEffects } from './rules/effects';
import { areAtWar, declareWar, makePeace } from './rules/war';
import { demandTribute } from './rules/vassals';
import { addAlliance, grantMilitaryAccess, improveRelation, removeAlliance, revokeMilitaryAccess } from './rules/diplomacy';
import type { GameState } from './state/types';
import { cancelFocus, startFocus } from './systems/focus';
import { cancelResearch, startResearch } from './systems/research';
import { startTaxReform } from './systems/tax';
import { chooseEventOption } from './systems/events';
import { setArmyPath } from './systems/military';
import { enqueueTraining } from './systems/training';
import { startCoreIntegration } from './systems/core';
import { startBuilding } from './systems/buildings';

export type Command =
  | { type: 'focus.start'; focusId: string }
  | { type: 'focus.cancel' }
  | { type: 'event.choose'; eventId: string; optionId: string }
  | { type: 'research.start'; techId: string }
  | { type: 'research.cancel'; techId: string }
  | { type: 'tax.setLaw'; estate: string; lawId: string }
  | { type: 'economy.setAllocation'; estate: string; value: number }
  | { type: 'economy.setFoodPurchasePct'; value: number }
  | { type: 'decision.take'; decisionId: string }
  | { type: 'army.recruit'; province: string; template: string; size: number }
  | { type: 'army.move'; armyId: string; path: string[] }
  | { type: 'army.navalMove'; armyId: string; portId: string }
  | { type: 'army.stop'; armyId: string }
  | { type: 'army.disband'; armyId: string }
  | { type: 'army.forceMarch'; armyId: string }
  | { type: 'province.integrateCore'; provinceId: string }
  | { type: 'province.build'; provinceId: string; buildingId: string }
  | { type: 'army.assignGeneral'; armyId: string; generalId: string | null }
  | { type: 'diplomacy.declareWar'; target: string; cb: string }
  | { type: 'diplomacy.gift'; target: string; amount?: number }
  | { type: 'diplomacy.alliance'; target: string }
  | { type: 'diplomacy.breakAlliance'; target: string }
  | { type: 'diplomacy.grantAccess'; target: string }
  | { type: 'diplomacy.revokeAccess'; target: string }
  | { type: 'diplomacy.demandTribute'; vassal: string }
  | { type: 'diplomacy.makePeace'; warId: string; terms?: 'white' | 'status' | 'demand'; provinceIds?: string[] }
  | { type: 'diplomacy.rejectPeaceOffer'; offerId: string };

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandError';
  }
}

function takeDecision(state: GameState, content: ContentIndex, decisionId: string): void {
  const nation = state.countries[state.playerTag];
  const decision = content.decisions.get(decisionId);
  if (!nation || !decision) throw new CommandError('unknown decision');
  if (decision.country !== nation.tag) throw new CommandError('decision belongs to another country');
  if ((nation.cooldowns[decision.id] ?? 0) > 0) throw new CommandError('decision on cooldown');
  if (decision.visible && !evaluateTrigger(decision.visible, { state, content, country: nation.tag })) {
    throw new CommandError('decision not visible');
  }
  if (decision.available && !evaluateTrigger(decision.available, { state, content, country: nation.tag })) {
    throw new CommandError('decision not available');
  }
  const cost = decision.cost;
  if ((cost.treasury ?? 0) > nation.treasury) throw new CommandError('not enough treasury');
  if ((cost.politicalPower ?? 0) > nation.politicalPower) throw new CommandError('not enough political power');
  if ((cost.food ?? 0) > nation.food) throw new CommandError('not enough food');
  nation.treasury -= cost.treasury ?? 0;
  nation.politicalPower -= cost.politicalPower ?? 0;
  nation.food -= cost.food ?? 0;
  nation.cooldowns[decision.id] = decision.cooldownDays;
  applyEffects(decision.effect, { state, content, country: nation.tag });
  state.log.push({
    day: state.day,
    category: 'politics',
    country: nation.tag,
    text: `决议：${decision.name}`,
    severity: 'info',
  });
}

export function dispatch(state: GameState, command: Command, content: ContentIndex): GameState {
  const tag = state.playerTag;
  const nation = state.countries[tag];
  if (!nation) throw new CommandError('player country missing');

  switch (command.type) {
    case 'focus.start':
      if (!startFocus(state, content, tag, command.focusId)) throw new CommandError('focus unavailable');
      break;
    case 'focus.cancel':
      if (!cancelFocus(state, tag)) throw new CommandError('no active focus');
      break;
    case 'event.choose':
      if (!chooseEventOption(state, content, command.eventId, command.optionId)) {
        throw new CommandError('event option unavailable');
      }
      break;
    case 'research.start':
      if (!startResearch(state, content, tag, command.techId)) throw new CommandError('research unavailable');
      break;
    case 'research.cancel':
      if (!cancelResearch(state, tag, command.techId)) throw new CommandError('research not active');
      break;
    case 'tax.setLaw':
      if (!startTaxReform(state, content, tag, command.estate, command.lawId, 50)) {
        throw new CommandError('tax reform unavailable');
      }
      break;
    case 'economy.setAllocation': {
      const nation = state.countries[tag];
      if (!nation || !nation.estates[command.estate]) throw new CommandError('estate not found');
      nation.allocation[command.estate] = Math.max(0, Math.min(100, command.value));
      break;
    }
    case 'economy.setFoodPurchasePct': {
      const nation = state.countries[tag];
      if (!nation) throw new CommandError('country not found');
      nation.foodPurchasePct = Math.max(0, Math.min(100, command.value));
      break;
    }
    case 'decision.take':
      takeDecision(state, content, command.decisionId);
      break;
    case 'army.recruit': {
      const template = content.armyTemplates.get(command.template);
      const province = content.provinces.get(command.province);
      if (template && template.composition.naval > 0 && !province?.isPort) {
        throw new CommandError('warships require a port');
      }
      if (!enqueueTraining(state, content, tag, command.province, command.template, command.size)) {
        throw new CommandError('training queue failed');
      }
      break;
    }
    case 'army.move':
      if (state.armies[command.armyId]?.tag !== tag) throw new CommandError('army not found');
      if (!setArmyPath(state, content, command.armyId, command.path)) {
        throw new CommandError('invalid army path');
      }
      break;
    case 'army.navalMove': {
      const army = state.armies[command.armyId];
      if (!army || army.tag !== tag) throw new CommandError('army not found');
      const origin = content.provinces.get(army.province);
      const target = content.provinces.get(command.portId);
      if (!origin?.isPort || !target?.isPort || command.portId === army.province) {
        throw new CommandError('naval move requires two ports');
      }
      if (state.provinces[command.portId]?.controller !== tag) {
        throw new CommandError('naval move requires a friendly port');
      }
      const fleet = Object.values(state.armies).some(entry =>
        entry.tag === tag && entry.province === army.province && entry.composition.naval > 0);
      if (!fleet) throw new CommandError('no warships in port');
      army.embarked = true;
      army.navalTarget = command.portId;
      army.navalOrigin = army.province;
      army.navalProgress = 0;
      army.movePath = [];
      army.stance = 'move';
      state.log.push({
        day: state.day,
        category: 'military',
        country: tag,
        text: `${army.name} 由 ${origin.name} 登船，驶向 ${target.name}`,
        severity: 'info',
      });
      break;
    }
    case 'army.assignGeneral': {
      const army = state.armies[command.armyId];
      if (!army || army.tag !== tag) throw new CommandError('army not found');
      if (command.generalId) {
        const general = content.generals.get(command.generalId);
        if (!general || general.country !== army.tag) throw new CommandError('general unavailable');
        const used = Object.values(state.armies).some(entry =>
          entry.id !== army.id && entry.general === command.generalId);
        if (used) throw new CommandError('general already assigned');
        army.general = command.generalId;
      } else {
        army.general = null;
      }
      state.log.push({
        day: state.day,
        category: 'military',
        country: tag,
        text: `${army.name} ${command.generalId ? '更换将领' : '解除将领'}`,
        severity: 'info',
      });
      break;
    }
    case 'army.stop': {
      const army = state.armies[command.armyId];
      if (!army || army.tag !== tag) throw new CommandError('army not found');
      army.movePath = [];
      army.embarked = false;
      army.navalTarget = null;
      army.navalOrigin = null;
      army.navalProgress = 0;
      army.stance = 'hold';
      break;
    }
    case 'army.disband': {
      const army = state.armies[command.armyId];
      if (!army || army.tag !== tag) throw new CommandError('army not found');
      delete state.armies[command.armyId];
      state.log.push({
        day: state.day,
        category: 'military',
        country: tag,
        text: `解散军团：${army.name}`,
        severity: 'info',
      });
      break;
    }
    case 'army.forceMarch': {
      const army = state.armies[command.armyId];
      if (!army || army.tag !== tag) throw new CommandError('army not found');
      army.forcedMarch = !army.forcedMarch;
      state.log.push({
        day: state.day,
        category: 'military',
        country: tag,
        text: `${army.name} ${army.forcedMarch ? '进入急行军' : '解除急行军'}`,
        severity: 'info',
      });
      break;
    }
    case 'province.integrateCore': {
      if (!startCoreIntegration(state, tag, command.provinceId)) {
        throw new CommandError('无法收买该地区人心');
      }
      break;
    }
    case 'province.build': {
      if (!startBuilding(state, content, tag, command.provinceId, command.buildingId)) {
        throw new CommandError('无法在该地区修建');
      }
      break;
    }
    case 'diplomacy.declareWar':
      if (!declareWar(state, tag, command.target, command.cb, content)) {
        throw new CommandError('cannot declare war');
      }
      break;
    case 'diplomacy.makePeace':
      if (!makePeace(state, command.warId, content, command.terms ?? 'status', command.provinceIds)) {
        throw new CommandError('cannot make peace');
      }
      state.peaceOffers = state.peaceOffers.filter(offer => offer.warId !== command.warId);
      break;
    case 'diplomacy.rejectPeaceOffer': {
      const offer = state.peaceOffers.find(entry => entry.id === command.offerId);
      if (!offer) throw new CommandError('peace offer not found');
      state.peaceOffers = state.peaceOffers.filter(entry => entry.id !== offer.id);
      const proposer = state.countries[offer.proposer];
      if (proposer) proposer.cooldowns[`peace-${offer.warId}`] = state.day + 180;
      break;
    }
    case 'diplomacy.demandTribute': {
      const result = demandTribute(state, content, tag, command.vassal);
      if (!result.ok) throw new CommandError(result.reason);
      break;
    }
    case 'diplomacy.gift': {
      const nation = state.countries[tag];
      const target = state.countries[command.target];
      if (!nation || !target?.alive || command.target === tag) throw new CommandError('无效的赠礼对象');
      const amount = Math.max(1000, Math.min(100000, Math.round(command.amount ?? 10000)));
      if (nation.treasury < amount) throw new CommandError('国库不足以赠礼');
      nation.treasury -= amount;
      improveRelation(state, tag, command.target, Math.max(3, Math.round(amount / 800)));
      state.log.push({
        day: state.day,
        category: 'diplomacy',
        country: tag,
        text: `向 ${content.countries.get(command.target)?.name ?? command.target} 赠礼 ${amount} 两`,
        severity: 'info',
      });
      break;
    }
    case 'diplomacy.alliance': {
      const target = state.countries[command.target];
      if (!target?.alive || command.target === tag) throw new CommandError('无效的结盟对象');
      if (areAtWar(state, tag, command.target)) throw new CommandError('交战中无法结盟');
      if (state.vassals[command.target] === tag || state.vassals[tag] === command.target) {
        throw new CommandError('宗主与藩属不能结盟');
      }
      const relation = state.relations[[tag, command.target].sort().join('|')] ?? 0;
      if (relation < 50) throw new CommandError('关系不足 50，无法结盟');
      if (!addAlliance(state, tag, command.target)) throw new CommandError('已经结盟');
      state.log.push({
        day: state.day,
        category: 'diplomacy',
        country: tag,
        text: `与 ${content.countries.get(command.target)?.name ?? command.target} 缔结同盟`,
        severity: 'info',
      });
      break;
    }
    case 'diplomacy.breakAlliance': {
      if (!removeAlliance(state, tag, command.target)) throw new CommandError('没有同盟关系');
      improveRelation(state, tag, command.target, -10);
      state.log.push({
        day: state.day,
        category: 'diplomacy',
        country: tag,
        text: `与 ${content.countries.get(command.target)?.name ?? command.target} 解除同盟`,
        severity: 'warning',
      });
      break;
    }
    case 'diplomacy.grantAccess': {
      if (command.target === tag) throw new CommandError('无效的军通对象');
      if (!grantMilitaryAccess(state, tag, command.target)) throw new CommandError('无法授予军通');
      improveRelation(state, tag, command.target, 4);
      state.log.push({
        day: state.day,
        category: 'diplomacy',
        country: tag,
        text: `允许 ${content.countries.get(command.target)?.name ?? command.target} 军队过境`,
        severity: 'info',
      });
      break;
    }
    case 'diplomacy.revokeAccess': {
      if (!revokeMilitaryAccess(state, tag, command.target)) throw new CommandError('没有军通关系');
      state.log.push({
        day: state.day,
        category: 'diplomacy',
        country: tag,
        text: `撤销 ${content.countries.get(command.target)?.name ?? command.target} 的军通`,
        severity: 'warning',
      });
      break;
    }
    default: {
      const exhaustive: never = command;
      throw new CommandError(`unknown command ${String(exhaustive)}`);
    }
  }
  return state;
}


