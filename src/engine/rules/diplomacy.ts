import type { GameState } from '../state/types';
import { relationKey } from '../state/types';

function addUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

export function areAllied(state: GameState, a: string, b: string): boolean {
  if (a === b) return false;
  return (state.alliances[a] ?? []).includes(b) && (state.alliances[b] ?? []).includes(a);
}

export function alliesOf(state: GameState, tag: string): string[] {
  return [...(state.alliances[tag] ?? [])].filter(ally => state.countries[ally]?.alive);
}

function atWar(state: GameState, a: string, b: string): boolean {
  return state.wars.some(war =>
    (war.attacker === a && war.defender === b)
    || (war.attacker === b && war.defender === a));
}

export function addAlliance(state: GameState, a: string, b: string): boolean {
  if (a === b || !state.countries[a]?.alive || !state.countries[b]?.alive) return false;
  if (areAllied(state, a, b)) return false;
  // 交战中或附庸关系未解除时不能独立结盟。
  if (atWar(state, a, b)) return false;
  if (state.vassals[a] !== undefined && state.vassals[a] !== b) return false;
  if (state.vassals[b] !== undefined && state.vassals[b] !== a) return false;
  state.alliances[a] = state.alliances[a] ?? [];
  state.alliances[b] = state.alliances[b] ?? [];
  addUnique(state.alliances[a], b);
  addUnique(state.alliances[b], a);
  return true;
}

export function removeAlliance(state: GameState, a: string, b: string): boolean {
  if (!areAllied(state, a, b)) return false;
  state.alliances[a] = (state.alliances[a] ?? []).filter(ally => ally !== b);
  state.alliances[b] = (state.alliances[b] ?? []).filter(ally => ally !== a);
  return true;
}

/** grantor 允许 grantee 的军队通过自己的领土；同盟默认互通。 */
export function hasMilitaryAccess(state: GameState, grantor: string, grantee: string): boolean {
  if (grantor === grantee) return true;
  if (areAllied(state, grantor, grantee)) return true;
  return (state.militaryAccess[grantor] ?? []).includes(grantee);
}

export function grantMilitaryAccess(state: GameState, grantor: string, grantee: string): boolean {
  if (grantor === grantee || !state.countries[grantor]?.alive || !state.countries[grantee]?.alive) return false;
  state.militaryAccess[grantor] = state.militaryAccess[grantor] ?? [];
  if (state.militaryAccess[grantor].includes(grantee)) return false;
  state.militaryAccess[grantor].push(grantee);
  return true;
}

export function revokeMilitaryAccess(state: GameState, grantor: string, grantee: string): boolean {
  const list = state.militaryAccess[grantor] ?? [];
  if (!list.includes(grantee)) return false;
  state.militaryAccess[grantor] = list.filter(entry => entry !== grantee);
  return true;
}

export function improveRelation(state: GameState, a: string, b: string, delta: number): void {
  if (a === b) return;
  const key = relationKey(a, b);
  state.relations[key] = Math.max(-100, Math.min(100, (state.relations[key] ?? 0) + delta));
}
