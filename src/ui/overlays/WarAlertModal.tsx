import { useEffect } from 'react';
import { sound } from '../../app/audio/sound';
import { useGameStore } from '../state/store';

export function WarAlertModal() {
  const game = useGameStore(state => state.game);
  const content = useGameStore(state => state.content);
  const acknowledge = useGameStore(state => state.acknowledgeWarAlert);
  const openCountry = useGameStore(state => state.openCountry);
  const alert = game?.warAlerts[0];
  useEffect(() => {
    if (alert) sound.play('event');
  }, [alert?.warId]);
  if (!game || game.warAlerts.length === 0) return null;
  if (!alert) return null;
  const attacker = content.countries.get(alert.attacker);
  const defender = content.countries.get(alert.defender);
  return (
    <div className="event-overlay">
      <div className="event-modal war-alert-modal">
        <p className="eyebrow">急报 · 宣战</p>
        <h2>{attacker?.name ?? alert.attacker} 向 {defender?.name ?? alert.defender} 宣战</h2>
        <p className="war-alert-goal">战争目标：{alert.goal || '边境争端'}</p>
        <p className="muted">
          {attacker?.name ?? alert.attacker} 的使节已递上战书。边境烽火已起，朝廷必须立即应对。
        </p>
        <div className="war-alert-actions">
          <button onClick={() => { openCountry(alert.attacker); acknowledge(); }}>查看敌国</button>
          <button className="primary" onClick={acknowledge}>整军迎战</button>
        </div>
      </div>
    </div>
  );
}
