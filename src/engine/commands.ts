import type { ContentIndex } from '../content/types';
import { evaluateTrigger } from './rules/triggers';
import { applyEffects } from './rules/effects';
import { declareWar, makePeace } from './rules/war';
import type { GameState } from './state/types';
import { startFocus } from './systems/focus';
import { startResearch } from './systems/research';
import { startTaxReform } from './systems/tax';
import { chooseEventOption } from './systems/events';
import { setArmyPath } from './systems/military';
import { enqueueTraining } from './systems/training';

export type Command =
  | { type: 'focus.start'; focusId: string }
  | { type: 'event.choose'; eventId: string; optionId: string }
  | { type: 'research.start'; techId: string }
  | { type: 'tax.setLaw'; estate: string; lawId: string }
  | { type: 'decision.take'; decisionId: string }
  | { type: 'army.recruit'; province: string; template: string; size: number }
  | { type: 'army.move'; armyId: string; path: string[] }
  | { type: 'army.navalMove'; armyId: string; portId: string }
  | { type: 'army.stop'; armyId: string }
  | { type: 'army.assignGeneral'; armyId: string; generalId: string | null }
  | { type: 'diplomacy.declareWar'; target: string; cb: string }
  | { type: 'diplomacy.makePeace'; warId: string };

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
    case 'event.choose':
      if (!chooseEventOption(state, content, command.eventId, command.optionId)) {
        throw new CommandError('event option unavailable');
      }
      break;
    case 'research.start':
      if (!startResearch(state, content, tag, command.techId)) throw new CommandError('research unavailable');
      break;
    case 'tax.setLaw':
      if (!startTaxReform(state, content, tag, command.estate, command.lawId, 50)) {
        throw new CommandError('tax reform unavailable');
      }
      break;
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
      const fleet = Object.values(state.armies).some(entry =>
        entry.tag === tag && entry.province === army.province && entry.composition.naval > 0);
      if (!fleet) throw new CommandError('no warships in port');
      army.embarked = true;
      army.navalTarget = command.portId;
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
      army.navalProgress = 0;
      army.stance = 'hold';
      break;
    }
    case 'diplomacy.declareWar':
      if (!declareWar(state, tag, command.target, command.cb, content)) {
        throw new CommandError('cannot declare war');
      }
      break;
    case 'diplomacy.makePeace':
      if (!makePeace(state, command.warId, content)) throw new CommandError('cannot make peace');
      break;
    default: {
      const exhaustive: never = command;
      throw new CommandError(`unknown command ${String(exhaustive)}`);
    }
  }
  return state;
}
