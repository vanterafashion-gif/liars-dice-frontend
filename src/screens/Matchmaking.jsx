import { useEffect, useState } from 'react';
import ProfileHud from '../components/ProfileHud.jsx';
import { resolveProfileAvatarSrc as resolveAvatarSrc } from '../utils/profileAvatars.js';

const asset = '/assets/liars-dice/matchmaking/';
const sparkles = Array.from({ length: 18 }, (_, index) => index + 1);
const SLOT_CLASSES_BY_PLAYERS = {
  2: ['matchmaking-slot--left-top', 'matchmaking-slot--right-top'],
  3: ['matchmaking-slot--left-top', 'matchmaking-slot--left-bottom', 'matchmaking-slot--right-top'],
  4: ['matchmaking-slot--left-top', 'matchmaking-slot--left-bottom', 'matchmaking-slot--right-top', 'matchmaking-slot--right-bottom'],
};

function TopHud({ user, wallet }) {
  return (
    <>
      <ProfileHud className="matchmaking-profile" user={user} />

      <div className="matchmaking-currency matchmaking-currency--coins">
        <img className="matchmaking-currency__icon" src={`${asset}66.png`} alt="" draggable="false" />
        <span className="matchmaking-currency__value">{wallet?.coins || '0'}</span>
        <img className="matchmaking-currency__plus" src={`${asset}88.png`} alt="" draggable="false" />
      </div>

      <div className="matchmaking-currency matchmaking-currency--gems">
        <img className="matchmaking-currency__icon" src={`${asset}77.png`} alt="" draggable="false" />
        <span className="matchmaking-currency__value">{wallet?.gems || '0'}</span>
        <img className="matchmaking-currency__plus" src={`${asset}88.png`} alt="" draggable="false" />
      </div>
    </>
  );
}

function normalizeId(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function PlayerSlot({ className = '', avatar, avatarSrc, title, subtitle, caption, tx }) {
  const isSearching = !avatar && title === 'Searching...';
  return (
    <div className={`matchmaking-slot ${className}${isSearching ? ' matchmaking-slot--searching' : ''}`}>
      <img className="matchmaking-slot__skin" src={`${asset}panal2.png`} alt="" draggable="false" />
      <div className="matchmaking-slot__inner">
        <img className="matchmaking-slot__avatar" src={avatarSrc || resolveAvatarSrc(avatar)} alt="" draggable="false" />
        <span className="matchmaking-slot__title">{tx(title)}</span>
        {subtitle ? <span className="matchmaking-slot__subtitle">{tx(subtitle)}</span> : null}
        {caption ? <span className="matchmaking-slot__caption">{caption}</span> : null}
      </div>
    </div>
  );
}

function getPlayerId(player = {}) {
  return player.id || player.userId || player._id || player.playerId || null;
}

function getMatchPlayers(playerSource, user) {
  const players = Array.isArray(playerSource?.players) ? playerSource.players : [];
  const userId = normalizeId(user?.id || user?.userId || user?._id || null);
  const viewer = players.find((player) => userId && normalizeId(getPlayerId(player)) === userId) || null;
  const opponents = players.filter((player) => !userId || normalizeId(getPlayerId(player)) !== userId);
  return { viewer, opponents, players };
}

function displayName(player, fallback) {
  return player?.displayName || player?.username || player?.name || fallback;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function firstValue(...values) {
  return values.find((value) => hasValue(value));
}

function clampPlayerCount(value, fallback = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 2) return 2;
  if (number >= 4) return 4;
  return 3;
}

function getCountdownRemainingMs(serverMatchmaking = {}, match = null, tick = Date.now()) {
  const explicit = Number(serverMatchmaking?.matchStartRemainingMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const startsAt = serverMatchmaking?.startsAt || match?.startsAt || null;
  if (!startsAt) return 0;

  const target = new Date(startsAt).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, target - tick);
}

function countdownSeconds(ms) {
  return Math.max(0, Math.ceil(Number(ms || 0) / 1000));
}

function isActiveMatchStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return ['active', 'in_progress', 'started', 'game_started'].includes(normalized);
}

function hasGameplayStarted(serverMatchmaking = {}, match = null) {
  return Boolean(
    serverMatchmaking?.shouldEnterGame
    || String(serverMatchmaking?.stage || '').toLowerCase() === 'game_started'
    || isActiveMatchStatus(serverMatchmaking?.status)
    || isActiveMatchStatus(serverMatchmaking?.matchStatus)
    || isActiveMatchStatus(match?.status)
    || isActiveMatchStatus(match?.matchStatus)
  );
}

function getTargetPlayerCount(data = {}, serverMatchmaking = {}, match = null) {
  const selectedTable = data?.selectedTable || data?.playNowTable || data?.defaultTable || {};
  const source = firstValue(
    serverMatchmaking?.requiredPlayers,
    serverMatchmaking?.targetPlayers,
    serverMatchmaking?.maxPlayers,
    serverMatchmaking?.playerLimit,
    selectedTable?.requiredPlayers,
    selectedTable?.selectedPlayers,
    selectedTable?.maxPlayers,
    selectedTable?.playerCount,
    match?.requiredPlayers,
    match?.maxPlayers,
    match?.playerCount,
  );
  return clampPlayerCount(source, 4);
}

function getFoundPlayerCount(serverMatchmaking = {}, match = null, players = [], targetPlayerCount = 4) {
  const source = firstValue(
    serverMatchmaking?.playersFound,
    serverMatchmaking?.currentPlayers,
    serverMatchmaking?.playerCount,
    match?.playerCount,
    Array.isArray(players) && players.length ? players.length : null,
  );
  const number = Number(source);
  if (Number.isFinite(number)) return Math.min(Math.max(1, Math.trunc(number)), targetPlayerCount);
  return 1;
}

function normalizeMetrics(metrics = [], playersLabel) {
  if (!Array.isArray(metrics) || !metrics.length) {
    return [{ type: 'players', icon: null, label: 'PLAYERS FOUND', value: playersLabel }];
  }

  let replaced = false;
  const next = metrics.map((item) => {
    const isPlayersMetric = item?.type === 'players' || String(item?.label || '').toUpperCase() === 'PLAYERS FOUND';
    if (!isPlayersMetric) return item;
    replaced = true;
    return { ...item, type: 'players', value: playersLabel };
  });

  if (!replaced) return [{ type: 'players', icon: null, label: 'PLAYERS FOUND', value: playersLabel }, ...next];
  return next;
}

export default function Matchmaking({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const matchmaking = data?.matchmaking || {};
  const serverMatchmaking = data?.serverMatchmaking || {};
  const match = data?.match || null;
  const currentMatchId = data?.currentMatchId || match?.id || match?.matchId || serverMatchmaking?.matchId || null;
  const currentQueueId = data?.currentQueueId || serverMatchmaking?.queueId || serverMatchmaking?.id || null;
  const rawQueueStatus = String(serverMatchmaking?.status || serverMatchmaking?.matchStatus || match?.status || '').toLowerCase();
  const [clockTick, setClockTick] = useState(() => Date.now());
  const countdownMs = getCountdownRemainingMs(serverMatchmaking, match, clockTick);
  const countdown = countdownSeconds(countdownMs);
  const isCountdown = Boolean(currentMatchId && (rawQueueStatus.includes('starting') || rawQueueStatus.includes('countdown') || match?.status === 'countdown') && countdown > 0);
  const gameStarted = Boolean(currentMatchId && hasGameplayStarted(serverMatchmaking, match));
  const canEnterGameplay = Boolean(currentMatchId && gameStarted && !isCountdown);
  const signalTitle = String(serverMatchmaking?.quality || serverMatchmaking?.matchQuality || 'EXCELLENT').toUpperCase();
  const signalSub = serverMatchmaking?.ping ? `${serverMatchmaking.ping}ms` : '45ms';
  const filters = matchmaking.filters || [];
  const steps = matchmaking.steps || [];
  const isStarting = backendStatus?.loading && backendStatus.lastAction === 'matchmaking.start';
  const hasMatchmakingError = Boolean(backendStatus?.error && String(backendStatus?.lastAction || '').startsWith('matchmaking.'));
  const isInsufficientFunds = hasMatchmakingError && String(backendStatus?.lastAction || '').includes('insufficient_funds');
  const isSearching = Boolean(currentQueueId && !currentMatchId && !['cancelled', 'matched', 'match_found'].includes(rawQueueStatus) && !hasMatchmakingError);
  const queuedPlayerSource = !match && Array.isArray(serverMatchmaking?.players) ? { players: serverMatchmaking.players } : null;
  const { viewer, opponents, players } = getMatchPlayers(match || queuedPlayerSource, user);
  const targetPlayerCount = getTargetPlayerCount(data, serverMatchmaking, match);
  const foundPlayerCount = getFoundPlayerCount(serverMatchmaking, match, players, targetPlayerCount);
  const metrics = normalizeMetrics(matchmaking.metrics || [], `${foundPlayerCount} / ${targetPlayerCount}`);
  const slotClasses = SLOT_CLASSES_BY_PLAYERS[targetPlayerCount] || SLOT_CLASSES_BY_PLAYERS[4];

  useEffect(() => {
    if (!isCountdown) return undefined;
    const interval = window.setInterval(() => setClockTick(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isCountdown]);

  const centerTitle = hasMatchmakingError
    ? isInsufficientFunds
      ? 'NOT ENOUGH CHIPS'
      : 'MATCHMAKING ERROR'
    : currentMatchId
      ? canEnterGameplay
        ? 'MATCH STARTED'
        : isCountdown
          ? `MATCH STARTS IN ${countdown}`
          : 'MATCH FOUND'
      : 'FINDING OPPONENTS';
  const centerCopy = hasMatchmakingError
    ? backendStatus.error
    : currentMatchId
      ? canEnterGameplay
        ? 'Gameplay is ready. Entering the table.'
        : isCountdown
          ? 'Entry fee charged. Waiting for server start.'
          : 'Table found. Waiting for game start signal.'
      : 'Looking for players with similar skill';

  const buildOpponentSlot = (index, className) => {
    const opponent = opponents[index];

    return {
      className,
      avatar: opponent || null,
      avatarSrc: opponent ? resolveAvatarSrc(opponent) : resolveAvatarSrc(null),
      title: opponent ? displayName(opponent, 'Player') : 'Searching...',
      subtitle: opponent ? 'READY' : '',
      caption: opponent ? '' : '•••',
    };
  };

  const viewerProfile = viewer || user;
  const playerSlots = [
    {
      className: slotClasses[0],
      avatar: viewerProfile,
      avatarSrc: resolveAvatarSrc(viewerProfile),
      title: displayName(viewerProfile, user.displayName || user.username || 'YOU'),
      subtitle: 'YOU',
    },
    ...slotClasses.slice(1).map((className, index) => buildOpponentSlot(index, className)),
  ];

  const startOrEnterMatch = () => {
    if (hasMatchmakingError && isInsufficientFunds) return;
    if (currentMatchId) {
      if (canEnterGameplay) navigation.goGameplay();
      return;
    }
    if (isStarting || isSearching) return;
    backendActions?.startMatchmaking?.({});
  };

  const primaryActionTitle = currentMatchId
    ? isCountdown
      ? `STARTING IN ${countdown}`
      : canEnterGameplay
        ? 'ENTER MATCH'
        : 'WAITING FOR START'
    : hasMatchmakingError
      ? isInsufficientFunds
        ? 'NOT ENOUGH CHIPS'
        : 'RETRY'
      : isStarting
        ? 'MATCHING...'
        : isSearching
          ? 'KEEP SEARCHING'
          : 'FIND MATCH';

  const primaryActionSubtitle = currentMatchId
    ? isCountdown
      ? 'Starting automatically'
      : canEnterGameplay
        ? 'Match is ready'
        : 'Server is preparing the table'
    : hasMatchmakingError
      ? isInsufficientFunds
        ? 'Go back and choose a cheaper table'
        : 'Try matchmaking again'
      : isSearching
        ? 'Waiting for real players'
        : "We'll find you the best table";

  return (
    <section className={`screen matchmaking-screen matchmaking-screen--players-${targetPlayerCount}`} aria-label={tx('Matchmaking')}>
      <div className="matchmaking-vfx matchmaking-vfx--vignette" aria-hidden="true" />
      <div className="matchmaking-vfx matchmaking-vfx--lightRays" aria-hidden="true" />
      <div className="matchmaking-vfx matchmaking-vfx--panelGlow" aria-hidden="true" />
      <div className="matchmaking-sparkles" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span className={`matchmaking-sparkle matchmaking-sparkle--${sparkle}`} key={sparkle} />
        ))}
      </div>

      <TopHud user={user} wallet={wallet} />

      <div className="matchmaking-panel">
        <img className="matchmaking-panel__skin" src={`${asset}panal.png`} alt="" draggable="false" />

        <div className="matchmaking-filters">
          {filters.map((item) => (
            <div className="matchmaking-filter" key={tx(item.label)}>
              <img className="matchmaking-filter__icon" src={`${asset}${item.icon}`} alt="" draggable="false" />
              <span className="matchmaking-filter__label">{tx(item.label)}</span>
              <span className="matchmaking-filter__value">{tx(item.value)}</span>
            </div>
          ))}

          <div className="matchmaking-signal">
            <img className="matchmaking-signal__icon" src={`${asset}6.png`} alt="" draggable="false" />
            <span className="matchmaking-signal__title">{tx(signalTitle)}</span>
            <span className="matchmaking-signal__sub">{tx(signalSub)}</span>
          </div>
        </div>

        <div className="matchmaking-center">
          <div className="matchmaking-center__ringWrap">
            <img className="matchmaking-center__ring" src={`${asset}42.png`} alt="" draggable="false" />
            <img className="matchmaking-center__cup" src={`${asset}213.png`} alt="" draggable="false" />
          </div>
          <span className="matchmaking-center__title">{tx(centerTitle)}</span>
          {isCountdown ? <strong className="matchmaking-center__countdown" aria-live="polite">{countdown}</strong> : null}
          <span className="matchmaking-center__copy">{tx(centerCopy)}</span>
          <div className="matchmaking-center__stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <img key={i} src={`${asset}8.png`} alt="" draggable="false" />
            ))}
          </div>
        </div>

        {slotClasses.map((className) => (
          <img key={`link-${className}`} className={`matchmaking-link ${className.replace('matchmaking-slot', 'matchmaking-link')}`} src={`${asset}54.png`} alt="" draggable="false" />
        ))}

        {playerSlots.map((slot) => (
          <PlayerSlot key={slot.className} {...slot} tx={tx} />
        ))}

        <div className="matchmaking-metrics">
          {metrics.map((item) => (
            <div className={`matchmaking-metric matchmaking-metric--${item.type}`} key={tx(item.label)}>
              <div className="matchmaking-metric__head">
                {item.icon ? <img className="matchmaking-metric__icon" src={`${asset}${item.icon}`} alt="" draggable="false" /> : <span className="matchmaking-metric__iconGap" />}
                <span className="matchmaking-metric__label">{tx(item.label)}</span>
              </div>
              {item.type === 'quality' ? (
                <div className="matchmaking-stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <img key={i} src={`${asset}8.png`} alt="" draggable="false" />
                  ))}
                </div>
              ) : null}
              <span className="matchmaking-metric__value">{tx(item.value)}</span>
            </div>
          ))}
        </div>

        <div className="matchmaking-steps">
          {steps.map((step, index) => (
            <div className="matchmaking-step" key={step.text || step.label || index}>
              <span className="matchmaking-step__badge" aria-hidden="true">{step.badge || index + 1}</span>
              <span className="matchmaking-step__text">{tx(step.text || step.label)}</span>
              <span className="matchmaking-step__sub">{step.sub}</span>
              {index < steps.length - 1 ? <span className="matchmaking-step__line" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </div>

      <button className="matchmaking-action matchmaking-action--keep" type="button" onClick={startOrEnterMatch} disabled={isStarting || isCountdown || isInsufficientFunds || Boolean(currentMatchId && !canEnterGameplay)}>
        <img className="matchmaking-action__skin" src={'/assets/liars-dice/room-select/bottom-play.png'} alt="" draggable="false" />
        <span className="matchmaking-action__title">{tx(primaryActionTitle)}</span>
        <span className="matchmaking-action__subtitle">{tx(primaryActionSubtitle)}</span>
      </button>

      <button className="matchmaking-action matchmaking-action--cancel" type="button" onClick={() => (currentQueueId ? backendActions?.cancelMatchmaking?.() : navigation.goRoomSelect())} disabled={backendStatus?.loading && backendStatus.lastAction === 'matchmaking.cancel'}>
        <img className="matchmaking-action__skin" src={`${asset}b1.png`} alt="" draggable="false" />
        <span className="matchmaking-action__title">{tx('CANCEL')}</span>
      </button>

      {backendStatus?.error ? <div className="matchmaking-status matchmaking-status--error">{backendStatus.error}</div> : null}
    </section>
  );
}
