/** 3 年矩阵冒烟：每个剧本 × 每个可玩势力，检查不崩、无 NaN。 */
import { loadContentFromDirectory } from '../src/content/loader/node';
import { createInitialState } from '../src/engine/state/initial';
import { advanceDay } from '../src/engine/tick';
import { chooseEventOption } from '../src/engine/systems/events';

const content = loadContentFromDirectory();
let failures = 0;
for (const scenario of content.scenarios.values()) {
  for (const tag of scenario.playableTags) {
    try {
      const state = createInitialState(content, scenario.id, 42, tag);
      for (let day = 0; day < 365 * 3; day += 1) {
        advanceDay(state, content);
        for (let guard = 0; guard < 8; guard += 1) {
          const pending = state.pendingEvents.find(event => event.country === tag);
          if (!pending) break;
          const event = content.events.get(pending.eventId);
          if (!event) {
            state.pendingEvents = state.pendingEvents.filter(entry => entry !== pending);
            continue;
          }
          const option = event.options.find(entry => entry.id === event.aiChoice) ?? event.options[0];
          if (!option) break;
          chooseEventOption(state, content, event.id, option.id);
        }
      }
      const country = state.countries[tag];
      for (const value of [country?.treasury ?? 0, country?.food ?? 0, country?.stability ?? 0, country?.arrears ?? 0]) {
        if (!Number.isFinite(value)) throw new Error('NaN resource');
      }
      for (const province of Object.values(state.provinces)) {
        if (!Number.isFinite(province.population) || province.population < 0) throw new Error(`bad population ${province.id}`);
      }
      console.log(`ok ${scenario.id}/${tag} day=${state.day} treasury=${Math.round(country?.treasury ?? 0)} provinces=${Object.values(state.provinces).filter(province => province.owner === tag).length}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${scenario.id}/${tag}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
if (failures > 0) process.exit(1);
console.log('matrix: ok');
