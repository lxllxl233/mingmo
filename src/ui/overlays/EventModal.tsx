import { useEffect } from 'react';
import { evaluateTrigger } from '../../engine/rules/triggers';
import { sound } from '../../app/audio/sound';
import { useGameStore } from '../state/store';
import { effectsSummary, formatNumber } from '../format';
import { EventArt } from './EventArt';
import type { Effect } from '../../content/types';
import type { CountryState } from '../../engine/state/types';

function sumEffect(effects: Effect[], pick: (effect: Effect) => number | undefined): number {
  return effects.reduce((sum, effect) => sum + (pick(effect) ?? 0), 0);
}

interface PreviewLine {
  label: string;
  text: string;
  danger: boolean;
}

/** 选项代价预览：把效果叠加到当前数值上，避免玩家只看到“+6 万”却不知道余额够不够。 */
function previewLines(effects: Effect[], country: CountryState): PreviewLine[] {
  const rows: Array<[string, number, number]> = [
    ['国库', country.treasury, sumEffect(effects, effect => ('addTreasury' in effect ? effect.addTreasury : undefined))],
    ['粮储', country.food, sumEffect(effects, effect => ('addFood' in effect ? effect.addFood : undefined))],
    ['兵源', country.manpower, sumEffect(effects, effect => ('addManpower' in effect ? effect.addManpower : undefined))],
    ['稳定', country.stability, sumEffect(effects, effect => ('addStability' in effect ? effect.addStability : undefined))],
  ];
  return rows
    .filter(([, , delta]) => delta !== 0)
    .map(([label, current, delta]) => {
      const projected = current + delta;
      return {
        label,
        text: `${label} ${formatNumber(current)} → ${formatNumber(projected)}（${delta > 0 ? '+' : ''}${formatNumber(delta)}）`,
        danger: projected < 0,
      };
    });
}

/** 选项可负担性：扣粮/扣兵源的效果若会让对应资源变负，则不可选。
 *  扣银（addTreasury 负值）不在此列——银不足会转成欠饷（债务），仍可选，预览已标红提醒，
 *  否则国库为 0 时所有「扣银」选项都会被锁死、事件弹窗无法关闭。 */
function affordability(effects: Effect[], country: CountryState): { ok: boolean; reason: string } {
  const food = country.food + sumEffect(effects, effect => ('addFood' in effect ? effect.addFood : undefined));
  if (food < 0) return { ok: false, reason: '粮食不足' };
  const manpower = country.manpower + sumEffect(effects, effect => ('addManpower' in effect ? effect.addManpower : undefined));
  if (manpower < 0) return { ok: false, reason: '兵源不足' };
  return { ok: true, reason: '' };
}

export function EventModal() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const command = useGameStore(state => state.command);
  const setSpeed = useGameStore(state => state.setSpeed);
  const pending = game?.pendingEvents.find(event => event.country === game.playerTag);
  const event = pending ? content.events.get(pending.eventId) : undefined;

  useEffect(() => {
    if (pending) {
      setSpeed(0);
      sound.play('event');
    }
  }, [pending, setSpeed]);

  if (!game || !pending || !event) return null;
  const accent = content.countries.get(pending.country)?.color ?? '#9e2b25';
  const country = game.countries[pending.country];

  return (
    <div className="overlay">
      <div className="modal event-modal">
        <div className="event-art-col">
          <EventArt event={event} accent={accent} />
        </div>
        <div className="event-copy">
          <h2>{event.title}</h2>
          {event.historicalContext && <div className="context">{event.historicalContext}</div>}
          <div className="desc">{event.desc}</div>
          <div style={{ marginTop: 18 }}>
            {event.options.map(option => {
              const available = !option.trigger || evaluateTrigger(option.trigger, {
                state: game,
                content,
                country: pending.country,
                ...(pending.province === undefined ? {} : { province: pending.province }),
              });
              const cost = country ? affordability(option.effect, country) : { ok: true, reason: '' };
              const preview = country ? previewLines(option.effect, country) : [];
              return (
                <button
                  key={option.id}
                  className="option"
                  disabled={!available || !cost.ok}
                  title={!available ? '当前条件不满足，无法选择该选项'
                    : !cost.ok ? `${cost.reason}，无法选择该选项` : undefined}
                  onClick={() => {
                    sound.play('choice');
                    command({ type: 'event.choose', eventId: event.id, optionId: option.id });
                  }}
                >
                  <div className="opt-name">{option.name}</div>
                  {option.tooltip && <div className="opt-tip">{option.tooltip}</div>}
                  <div className="opt-tip">{effectsSummary(option.effect)}</div>
                  {preview.length > 0 && (
                    <div className="opt-deltas">
                      {preview.map(line => (
                        <span key={line.label} className={line.danger ? 'danger' : ''}>{line.text}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
