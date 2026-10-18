import type { ContentIndex, Effect, EventId } from '../../content/types';
import { rngFor } from '../core/rng';
import type { GameState } from '../state/types';
import { relationKey } from '../state/types';
import { addModifierInto } from './modifiers';
import { evaluateTrigger } from './triggers';
import { declareWar } from './war';
import { pickGeneral } from '../systems/military';

export interface EffectContext {
  state: GameState;
  content: ContentIndex;
  country: string;
  province?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function spawnArmy(
  state: GameState,
  content: ContentIndex,
  tag: string,
  province: string,
  templateId: string,
  size: number,
): void {
  const template = content.armyTemplates.get(templateId);
  const country = content.countries.get(tag);
  if (!template || !country) return;
  const id = `army_${state.nextArmyId}`;
  state.nextArmyId += 1;
  state.armies[id] = {
    id,
    tag,
    name: `${country.name} ${template.name}`,
    province,
    history: [],
    movePath: [],
    moveProgress: 0,
    templateId,
    embarked: false,
    navalTarget: null,
    navalProgress: 0,
    composition: {
      infantry: template.composition.infantry * size,
      firearm: template.composition.firearm * size,
      cavalry: template.composition.cavalry * size,
      artillery: template.composition.artillery * size,
      naval: template.composition.naval * size,
    },
    organization: content.balance.military.baseOrganization,
    training: template.training,
    equipment: template.equipment,
    supply: 100,
    sourceEstate: template.sourceEstate,
    general: pickGeneral(state, content, tag),
    stance: 'hold',
  };
}

function queueEvent(state: GameState, eventId: EventId, country: string, delayDays: number): void {
  state.eventQueue.push({
    eventId,
    country,
    dueDay: Math.max(state.day, state.day + delayDays),
  });
}

export function applyEffects(effects: readonly Effect[], context: EffectContext): void {
  for (const effect of effects) applyEffect(effect, context);
}

export function applyEffect(effect: Effect, context: EffectContext): void {
  const { state, content, country } = context;
  const nation = state.countries[country];
  if (!nation) return;

  if ('addStability' in effect) nation.stability = clamp(nation.stability + effect.addStability, 0, 100);
  else if ('addMandate' in effect) nation.mandate = clamp(nation.mandate + effect.addMandate, 0, 100);
  else if ('addCorruption' in effect) nation.corruption = clamp(nation.corruption + effect.addCorruption, 0, 100);
  else if ('addAuthority' in effect) nation.authority = clamp(nation.authority + effect.addAuthority, 0, 100);
  else if ('addPoliticalPower' in effect) nation.politicalPower = Math.max(0, nation.politicalPower + effect.addPoliticalPower);
  else if ('addTreasury' in effect) {
    nation.treasury += effect.addTreasury;
    if (nation.treasury < 0) {
      nation.arrears += -nation.treasury;
      nation.treasury = 0;
    }
  } else if ('addFood' in effect) nation.food = Math.max(0, nation.food + effect.addFood);
  else if ('addManpower' in effect) nation.manpower = Math.max(0, nation.manpower + effect.addManpower);
  else if ('addArmyLoyalty' in effect) nation.armyLoyalty = clamp(nation.armyLoyalty + effect.addArmyLoyalty, 0, 100);
  else if ('addInflation' in effect) nation.inflation = clamp(nation.inflation + effect.addInflation, 0, 100);
  else if ('addFactionInfluence' in effect) {
    for (const [name, value] of Object.entries(effect.addFactionInfluence)) {
      nation.factions[name] = Math.max(0, (nation.factions[name] ?? 0) + value);
    }
  } else if ('addEstateLoyalty' in effect) {
    const estate = nation.estates[effect.addEstateLoyalty.estate];
    if (estate) estate.loyalty = clamp(estate.loyalty + effect.addEstateLoyalty.value, 0, 100);
  } else if ('addEstateInfluence' in effect) {
    const estate = nation.estates[effect.addEstateInfluence.estate];
    if (estate) estate.influence = clamp(estate.influence + effect.addEstateInfluence.value, 0, 100);
  } else if ('setTaxLaw' in effect) {
    const estate = nation.estates[effect.setTaxLaw.estate];
    const law = content.taxLaws.get(effect.setTaxLaw.law);
    if (estate && law) {
      estate.taxLaw = law.id;
      estate.effectiveRate = law.rate;
    }
  } else if ('grantPrivilege' in effect) {
    const estate = nation.estates[effect.grantPrivilege.estate];
    if (estate && !estate.privileges.includes(effect.grantPrivilege.privilege)) {
      estate.privileges.push(effect.grantPrivilege.privilege);
    }
  } else if ('revokePrivilege' in effect) {
    const estate = nation.estates[effect.revokePrivilege.estate];
    if (estate) estate.privileges = estate.privileges.filter(id => id !== effect.revokePrivilege.privilege);
  } else if ('setFlag' in effect) nation.flags[effect.setFlag] = true;
  else if ('clearFlag' in effect) delete nation.flags[effect.clearFlag];
  else if ('addModifier' in effect) addModifierInto(nation.modifiers, effect.addModifier);
  else if ('addCountryModifier' in effect) {
    const modifier = content.namedModifiers.get(effect.addCountryModifier.modifier);
    if (modifier) {
      nation.timedModifiers.push({
        id: modifier.id,
        name: modifier.name,
        modifiers: { ...modifier.modifiers },
        daysLeft: effect.addCountryModifier.days,
        source: country,
      });
    }
  } else if ('addProvinceModifier' in effect) {
    const province = state.provinces[effect.addProvinceModifier.province];
    const modifier = content.namedModifiers.get(effect.addProvinceModifier.modifier);
    if (province && modifier) {
      province.modifiers.push({
        id: modifier.id,
        name: modifier.name,
        modifiers: { ...modifier.modifiers },
        daysLeft: effect.addProvinceModifier.days,
        source: country,
      });
    }
  } else if ('changeCapital' in effect) {
    nation.capital = effect.changeCapital;
  } else if ('unlockUnit' in effect) {
    if (!nation.unlockedUnits.includes(effect.unlockUnit)) nation.unlockedUnits.push(effect.unlockUnit);
  } else if ('unlockDecision' in effect) {
    if (!nation.unlockedDecisions.includes(effect.unlockDecision)) nation.unlockedDecisions.push(effect.unlockDecision);
  } else if ('addTech' in effect) {
    if (!nation.completedTechs.includes(effect.addTech)) {
      nation.completedTechs.push(effect.addTech);
      const tech = content.techs.get(effect.addTech);
      if (tech) applyEffects(tech.effects, context);
    }
  } else if ('addCore' in effect) {
    const province = state.provinces[effect.addCore];
    if (province && !province.cores.includes(country)) province.cores.push(country);
  } else if ('addClaim' in effect) {
    const province = state.provinces[effect.addClaim];
    if (province && !province.claims.includes(country)) province.claims.push(country);
  } else if ('addRelation' in effect) {
    const key = relationKey(country, effect.addRelation.target);
    state.relations[key] = clamp((state.relations[key] ?? 0) + effect.addRelation.value, -100, 100);
  } else if ('declareWar' in effect) {
    declareWar(state, country, effect.declareWar.target, effect.declareWar.cb, content);
  } else if ('spawnArmy' in effect) {
    spawnArmy(state, content, country, effect.spawnArmy.province, effect.spawnArmy.template, effect.spawnArmy.size);
  } else if ('changeOwner' in effect) {
    const province = state.provinces[effect.changeOwner.province];
    if (province) {
      province.owner = effect.changeOwner.to;
      province.controller = effect.changeOwner.to;
      if (!province.cores.includes(effect.changeOwner.to)) province.cores.push(effect.changeOwner.to);
    }
  } else if ('triggerEvent' in effect) {
    queueEvent(state, effect.triggerEvent.id, country, effect.triggerEvent.delayDays);
  } else if ('if' in effect) {
    const branch = evaluateTrigger(effect.if.trigger, context) ? effect.if.then : effect.if.else;
    if (branch) applyEffects(branch, context);
  } else if ('randomList' in effect) {
    const rng = rngFor(state.seed, state.day, `effect:${country}`);
    const total = effect.randomList.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * total;
    for (const entry of effect.randomList) {
      roll -= entry.weight;
      if (roll <= 0) {
        applyEffects(entry.effect, context);
        break;
      }
    }
  }
}
