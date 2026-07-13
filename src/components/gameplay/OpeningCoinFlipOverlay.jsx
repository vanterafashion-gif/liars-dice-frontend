import { useEffect, useMemo, useRef, useState } from 'react';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function playerName(player, fallback = 'Player') {
  return player?.displayName || player?.username || player?.name || fallback;
}

function stageLabel(stage, tx) {
  const normalized = String(stage || '').toLowerCase();
  if (normalized === 'semifinal_1') return tx('SEMI-FINAL 1');
  if (normalized === 'semifinal_2') return tx('SEMI-FINAL 2');
  if (normalized === 'semifinal') return tx('SEMI-FINAL');
  return tx('FINAL FLIP');
}

function resolveRoundPlayer(round, side, match) {
  const embedded = round?.[`${side}Player`];
  if (embedded) return embedded;

  const targetId = round?.[`${side}PlayerId`] || round?.[`${side}UserId`];
  const players = Array.isArray(match?.players) ? match.players : [];
  const found = players.find((player) => [player?.id, player?.playerId, player?.userId]
    .filter(Boolean)
    .some((value) => String(value) === String(targetId)));

  if (found) return found;
  return {
    displayName: round?.[`${side}PlayerName`] || 'Player',
    playerId: targetId || null,
  };
}

function initialRemainingMs(flip) {
  const explicit = numberValue(flip?.remainingMs, -1);
  if (explicit >= 0) return explicit;

  const endsAt = new Date(flip?.endsAt || 0).getTime();
  if (Number.isFinite(endsAt) && endsAt > 0) return Math.max(0, endsAt - Date.now());
  return numberValue(flip?.durationMs, 0);
}

export default function OpeningCoinFlipOverlay({ match, tx = (value) => value }) {
  const flip = match?.openingCoinFlip || null;
  const active = Boolean(match?.coinFlipActive || flip?.status === 'pending');
  const flipKey = `${flip?.id || match?.id || 'coin-flip'}:${flip?.startedAt || ''}`;
  const timingRef = useRef({ key: '', receivedAt: 0, remainingMs: 0 });
  const [tick, setTick] = useState(() => Date.now());

  if (timingRef.current.key !== flipKey) {
    timingRef.current = {
      key: flipKey,
      receivedAt: Date.now(),
      remainingMs: initialRemainingMs(flip),
    };
  }

  useEffect(() => {
    if (!active) return undefined;
    setTick(Date.now());
    const interval = window.setInterval(() => setTick(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, [active, flipKey]);

  const timeline = useMemo(() => {
    const durationMs = Math.max(1, numberValue(flip?.durationMs, 1));
    const elapsedSinceReceive = Math.max(0, tick - timingRef.current.receivedAt);
    const remainingMs = Math.max(0, timingRef.current.remainingMs - elapsedSinceReceive);
    const elapsedMs = Math.max(0, durationMs - remainingMs);
    const rounds = Array.isArray(flip?.rounds) ? flip.rounds : [];
    const activeRound = rounds.find((round) => elapsedMs < numberValue(round.endsAtOffsetMs, 0)) || null;
    const completedRounds = rounds.filter((round) => elapsedMs >= numberValue(round.endsAtOffsetMs, 0));
    const roundRevealed = activeRound
      ? elapsedMs >= numberValue(activeRound.revealAtOffsetMs, numberValue(activeRound.endsAtOffsetMs, 0))
      : true;

    return {
      durationMs,
      elapsedMs,
      remainingMs,
      rounds,
      activeRound,
      completedRounds,
      roundRevealed,
      showingWinner: !activeRound && rounds.length > 0,
    };
  }, [flip, tick, flipKey]);

  if (!active || !flip) return null;

  const currentRound = timeline.activeRound;
  const headsPlayer = currentRound ? resolveRoundPlayer(currentRound, 'heads', match) : null;
  const tailsPlayer = currentRound ? resolveRoundPlayer(currentRound, 'tails', match) : null;
  const result = String(currentRound?.result || '').toLowerCase();
  const winnerName = flip.winnerPlayerName || playerName(flip.winnerPlayer, tx('Player'));
  const coinResultClass = timeline.roundRevealed && currentRound ? `is-${result}` : '';

  return (
    <div className="opening-coin-flip" role="dialog" aria-modal="true" aria-live="assertive">
      <div className="opening-coin-flip__backdrop" />
      <div className="opening-coin-flip__card">
        <div className="opening-coin-flip__eyebrow">{tx('WHO GOES FIRST?')}</div>

        {timeline.showingWinner ? (
          <div className="opening-coin-flip__winner">
            <div className="opening-coin-flip__winnerCoin" aria-hidden="true">★</div>
            <div className="opening-coin-flip__winnerName">{winnerName}</div>
            <div className="opening-coin-flip__winnerText">{tx('GOES FIRST')}</div>
          </div>
        ) : currentRound ? (
          <>
            <div className="opening-coin-flip__stage">{stageLabel(currentRound.stage, tx)}</div>
            <div className="opening-coin-flip__versus">
              <div className={`opening-coin-flip__player opening-coin-flip__player--heads ${timeline.roundRevealed && result === 'heads' ? 'is-winner' : ''}`}>
                <span className="opening-coin-flip__side">{tx('HEADS')}</span>
                <strong>{playerName(headsPlayer, tx('Player'))}</strong>
              </div>

              <div className={`opening-coin-flip__coin ${timeline.roundRevealed ? 'is-revealed' : 'is-flipping'} ${coinResultClass}`} aria-label={timeline.roundRevealed ? tx(result.toUpperCase()) : tx('Flipping coin')}>
                <span className="opening-coin-flip__coinFace opening-coin-flip__coinFace--heads">H</span>
                <span className="opening-coin-flip__coinFace opening-coin-flip__coinFace--tails">T</span>
              </div>

              <div className={`opening-coin-flip__player opening-coin-flip__player--tails ${timeline.roundRevealed && result === 'tails' ? 'is-winner' : ''}`}>
                <span className="opening-coin-flip__side">{tx('TAILS')}</span>
                <strong>{playerName(tailsPlayer, tx('Player'))}</strong>
              </div>
            </div>

            <div className="opening-coin-flip__resultText">
              {timeline.roundRevealed
                ? `${currentRound.winnerPlayerName || playerName(currentRound.winnerPlayer, tx('Player'))} ${tx('WINS THE FLIP')}`
                : tx('FLIPPING...')}
            </div>
          </>
        ) : null}

        <div className="opening-coin-flip__progress" aria-hidden="true">
          {timeline.rounds.map((round, index) => {
            const completed = timeline.completedRounds.includes(round);
            const current = timeline.activeRound === round;
            return <span key={round.id || index} className={`${completed ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} />;
          })}
        </div>
      </div>
    </div>
  );
}
