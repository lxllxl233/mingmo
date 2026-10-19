import { useEffect } from 'react';
import { evaluateTrigger } from '../../engine/rules/triggers';
import { sound } from '../../app/audio/sound';
import { useGameStore } from '../state/store';
import { effectsSummary } from '../format';
import { EventArt } from './EventArt';

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
              return (
                <button
                  key={option.id}
                  className="option"
                  disabled={!available}
                  onClick={() => {
                    sound.play('choice');
                    command({ type: 'event.choose', eventId: event.id, optionId: option.id });
                  }}
                >
                  <div className="opt-name">{option.name}</div>
                  {option.tooltip && <div className="opt-tip">{option.tooltip}</div>}
                  <div className="opt-tip">{effectsSummary(option.effect)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
