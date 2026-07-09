import { useEffect, useMemo, useState } from 'react';
import ProfileHud from '../components/ProfileHud.jsx';

const asset = '/assets/liars-dice/create-room/';
const shared = '/assets/liars-dice/room-select/';

function TopHud({ user, wallet }) {
  return (
    <>
      <ProfileHud className="room-lobby-profile" user={user} />

      <div className="room-lobby-currency room-lobby-currency--coins">
        <img className="room-lobby-currency__icon" src={`${shared}6.png`} alt="" draggable="false" />
        <span className="room-lobby-currency__value">{wallet?.coins || '0'}</span>
        <img className="room-lobby-currency__plus" src={`${shared}8.png`} alt="" draggable="false" />
      </div>

      <div className="room-lobby-currency room-lobby-currency--gems">
        <img className="room-lobby-currency__icon" src={`${shared}7.png`} alt="" draggable="false" />
        <span className="room-lobby-currency__value">{wallet?.gems || '0'}</span>
        <img className="room-lobby-currency__plus" src={`${shared}8.png`} alt="" draggable="false" />
      </div>
    </>
  );
}

function normalizeId(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function getPlayerId(player) {
  if (typeof player === 'string') return player;
  return player?.id || player?.userId || player?._id || player?.playerId || player?.username || null;
}

function getPlayerLabel(player, index, user) {
  const playerId = getPlayerId(player);
  const userId = user?.id || user?.userId || user?._id;
  if (playerId && normalizeId(playerId) === normalizeId(userId)) return user?.displayName || user?.username || 'You';
  return player?.displayName || player?.username || player?.name || `Player ${index + 1}`;
}

function getStartsAtMs(room = {}, match = null) {
  const value = room?.startsAt || match?.startsAt || null;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getCountdownSeconds(room = {}, match = null, tick = Date.now()) {
  const startsAt = getStartsAtMs(room, match);
  if (!startsAt) return 0;
  return Math.max(0, Math.ceil((startsAt - tick) / 1000));
}

function playerReady(room = {}, playerId) {
  const readyPlayers = Array.isArray(room.readyPlayers) ? room.readyPlayers : [];
  return readyPlayers.some((id) => normalizeId(id) === normalizeId(playerId));
}

function readNumber(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') return fallback;
  const sanitized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  const number = Number(sanitized);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function formatAmount(value, fallback = '—') {
  const number = readNumber(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toLocaleString('en-US');
}

function getRoomPerGameAmount(room = {}) {
  return readNumber(
    room.perGameAmount ?? room.perGameCoins ?? room.roundStake ?? room.selectedPerGame ?? room.selectedPerGameAmount ?? room.defaultCoinBet ?? room.defaultBidCoins ?? room.pricing?.perGameAmount ?? room.pricing?.roundStake ?? room.pricing?.selectedPerGame ?? room.pricing?.selectedPerGameAmount,
    undefined,
  );
}

function getRoomCoinBetOptions(room = {}) {
  const rawOptions = Array.isArray(room.coinBetOptions) && room.coinBetOptions.length
    ? room.coinBetOptions
    : (Array.isArray(room.pricing?.coinBetOptions) && room.pricing.coinBetOptions.length
      ? room.pricing.coinBetOptions
      : (Array.isArray(room.perGameOptions) && room.perGameOptions.length ? room.perGameOptions : room.pricing?.perGameOptions));

  if (!Array.isArray(rawOptions)) return [];
  return Array.from(new Set(rawOptions.map((value) => readNumber(value)).filter((value) => Number.isFinite(value) && value > 0)))
    .sort((left, right) => left - right)
    .slice(0, 3);
}

function getRoomPerGameMode(room = {}) {
  const mode = String(room.perGameMode || room.coinBetMode || room.pricing?.perGameMode || room.pricing?.coinBetMode || '').toLowerCase();
  return mode === 'range' ? 'range' : 'static';
}

function getRoomPerGameSummary(room = {}) {
  const mode = getRoomPerGameMode(room);
  const selected = getRoomPerGameAmount(room);
  if (mode === 'range') {
    const options = getRoomCoinBetOptions(room);
    const optionCopy = options.length ? options.map((value) => formatAmount(value)).join(' / ') : formatAmount(selected);
    return selected ? `Range ${optionCopy} • Pick ${formatAmount(selected)}` : `Range ${optionCopy}`;
  }
  return `Static ${formatAmount(selected)}`;
}

function getRoomBuyInAmount(room = {}) {
  return readNumber(room.buyInAmount ?? room.entryFee ?? room.buyInCoins ?? room.pricing?.buyInAmount ?? room.pricing?.entryFee, undefined);
}

function getRoomPek(room = {}) {
  const perGameAmount = getRoomPerGameAmount(room) || 0;
  const percentage = readNumber(room.pekPercentage ?? room.slamPercentage ?? room.pricing?.pekPercentage ?? room.pricing?.slamPercentage, 25);
  const safePercentage = [25, 50, 100].includes(percentage) ? percentage : 25;
  const enabled = Boolean(room.pekEnabled ?? room.slamEnabled ?? room.pricing?.pekEnabled ?? room.pricing?.slamEnabled ?? false);
  const finalAmount = readNumber(room.finalPekAmount ?? room.finalSlamAmount ?? room.pricing?.finalPekAmount ?? room.pricing?.finalSlamAmount, perGameAmount + Math.floor((perGameAmount * safePercentage) / 100));
  return { enabled, percentage: safePercentage, finalAmount };
}

function getRoomRulesSummary(room = {}) {
  const buyInAmount = getRoomBuyInAmount(room);
  const pek = getRoomPek(room);
  return `Rules: 5 dice each • Buy-in ${formatAmount(buyInAmount)} • ${getRoomPerGameSummary(room)}${pek.enabled ? ` • Pek ${pek.percentage}% = ${formatAmount(pek.finalAmount)}` : ' • Pek OFF'}`;
}

export default function RoomLobby({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const room = data?.currentRoom || data?.myRoom || null;
  const players = room?.players?.length ? room.players : (room?.playerIds || []);
  const playerIds = players.map(getPlayerId).filter(Boolean);
  const roomCode = room?.roomCode || room?.code || data?.currentRoomCode || data?.createRoom?.roomCode;
  const userId = user?.id || user?.userId || user?._id;
  const hostId = room?.ownerId || room?.hostUserId || room?.createdBy || playerIds[0] || null;
  const isHost = Boolean(userId && hostId && normalizeId(userId) === normalizeId(hostId));
  const viewerReady = playerReady(room || {}, userId);
  const isFull = playerIds.length >= Number(room?.maxPlayers || 0);
  const allReady = playerIds.length > 0 && playerIds.every((playerId) => playerReady(room || {}, playerId));
  const roomStatus = String(room?.status || 'waiting').toLowerCase();
  const matchId = data?.currentMatchId || room?.matchId || data?.match?.id || data?.match?.matchId || null;
  const [clockTick, setClockTick] = useState(() => Date.now());
  const countdown = getCountdownSeconds(room || {}, data?.match || null, clockTick);
  const isCountdown = Boolean(matchId && (roomStatus === 'countdown' || data?.match?.status === 'countdown' || countdown > 0) && countdown > 0);
  const isStarting = backendStatus?.loading && backendStatus?.lastAction === 'rooms.start';
  const isLeaving = backendStatus?.loading && backendStatus?.lastAction === 'rooms.leave';
  const isReadyLoading = backendStatus?.loading && backendStatus?.lastAction === 'rooms.ready';
  const isRefreshing = backendStatus?.loading && ['rooms.get', 'rooms.my', 'rooms.refresh'].includes(backendStatus?.lastAction);
  const canStart = Boolean(room?.roomId || room?.id || roomCode) && isHost && isFull && allReady && !isCountdown;
  const roomId = room?.roomId || room?.id || roomCode || null;
  const perGameSummary = getRoomPerGameSummary(room || {});
  const roomRulesSummary = getRoomRulesSummary(room || {});
  const pekInfo = getRoomPek(room || {});

  const startButtonText = useMemo(() => {
    if (isCountdown) return `STARTING IN ${countdown}`;
    if (isStarting) return 'STARTING...';
    if (!isHost) return 'WAITING HOST';
    if (!isFull) return 'WAITING PLAYERS';
    if (!allReady) return 'WAITING READY';
    return 'START MATCH';
  }, [allReady, countdown, isCountdown, isFull, isHost, isStarting]);

  useEffect(() => {
    if (!roomId) return undefined;
    const interval = window.setInterval(() => {
      backendActions?.refreshRoom?.(room || roomId);
    }, isCountdown ? 1000 : 2500);
    return () => window.clearInterval(interval);
    // backendActions is intentionally omitted because App recreates it every render.
  }, [roomId, isCountdown]);

  useEffect(() => {
    if (!isCountdown) return undefined;
    const interval = window.setInterval(() => setClockTick(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isCountdown]);

  useEffect(() => {
    if (!matchId) return;
    if (isCountdown) return;
    if (roomStatus === 'countdown' || roomStatus === 'in_match' || data?.match?.status === 'active') {
      navigation.goGameplay();
    }
  }, [data?.match?.status, isCountdown, matchId, navigation, roomStatus]);

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard?.writeText?.(roomCode);
    } catch (_error) {
      // Clipboard can be blocked. The visible code is still copyable manually.
    }
  };

  if (!room) {
    return (
      <section className="screen room-lobby-screen" aria-label={tx('Room Lobby')}>
        <TopHud user={user} wallet={wallet} />
        <div className="room-lobby-board">
          <img className="room-lobby-board__skin" src={`${asset}Pannal.png`} alt="" draggable="false" />
          <img className="room-lobby-character" src={`${asset}p1.png`} alt="" draggable="false" />
          <div className="room-lobby-panel">
            <h1 className="room-lobby-title">{tx('ROOM LOBBY')}</h1>
            <p className="room-lobby-subtitle">{tx('No active room loaded yet')}</p>
            <button className="room-lobby-action room-lobby-action--primary" type="button" onClick={navigation.goCreateRoom}>
              <img className="room-lobby-action__skin" src={`${asset}b3.png`} alt="" draggable="false" />
              <span className="room-lobby-action__text">{tx('CREATE ROOM')}</span>
            </button>
            <button className="room-lobby-action room-lobby-action--secondary" type="button" onClick={navigation.goJoinRoom}>
              <img className="room-lobby-action__skin" src={`${asset}232.png`} alt="" draggable="false" />
              <span className="room-lobby-action__text">{tx('JOIN ROOM')}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen room-lobby-screen" aria-label={tx('Room Lobby')}>
      <TopHud user={user} wallet={wallet} />

      <div className="room-lobby-board">
        <img className="room-lobby-board__skin" src={`${asset}Pannal.png`} alt="" draggable="false" />
        <img className="room-lobby-character" src={`${asset}p1.png`} alt="" draggable="false" />

        <div className="room-lobby-panel">
          <h1 className="room-lobby-title">{tx('ROOM LOBBY')}</h1>
          <p className="room-lobby-subtitle">{tx(room.name || 'Liar’s Dice Room')}</p>

          <div className="room-lobby-codeBlock">
            <span className="room-lobby-label">{tx('ROOM CODE')}</span>
            <div className="room-lobby-codeWrap">
              <img className="room-lobby-codeWrap__skin" src={`${asset}pana433.png`} alt="" draggable="false" />
              <span className="room-lobby-codeWrap__text">{roomCode || '—'}</span>
              <button className="room-lobby-copy" type="button" onClick={copyCode} aria-label={tx('Copy room code')}>
                <img src={`${asset}b5.png`} alt="" draggable="false" />
              </button>
            </div>
          </div>

          <div className="room-lobby-infoGrid">
            <div className="room-lobby-info"><span>{tx('PLAYERS')}</span><strong>{room.playerCount || players.length || 1} / {room.maxPlayers || 4}</strong></div>
            <div className="room-lobby-info"><span>{tx('STATUS')}</span><strong>{tx(isCountdown ? `STARTING ${countdown}` : String(room.status || 'waiting').toUpperCase())}</strong></div>
            <div className="room-lobby-info"><span>{tx('READY')}</span><strong>{(room.readyPlayers || []).length} / {room.maxPlayers || 4}</strong></div>
            <div className="room-lobby-info"><span>{tx('TIMER')}</span><strong>{room.turnTimer || room.selectedTimer || '30s'}</strong></div>
            <div className="room-lobby-info"><span>{tx('BUY-IN')}</span><strong>{formatAmount(getRoomBuyInAmount(room || {}))}</strong></div>
            <div className="room-lobby-info"><span>{tx('PER GAME')}</span><strong>{tx(perGameSummary)}</strong></div>
            <div className="room-lobby-info"><span>{tx('PEK / SLAM')}</span><strong>{pekInfo.enabled ? `${pekInfo.percentage}% / ${formatAmount(pekInfo.finalAmount)}` : tx('OFF')}</strong></div>
          </div>

          <div className="room-lobby-rulesSummary">{tx(roomRulesSummary)}</div>

          {isCountdown ? (
            <div className="room-lobby-countdown" aria-live="polite">
              <span className="room-lobby-countdown__label">{tx('MATCH STARTS IN')}</span>
              <strong className="room-lobby-countdown__number">{countdown}</strong>
            </div>
          ) : null}

          <div className="room-lobby-playerList">
            <span className="room-lobby-label room-lobby-label--players">{tx('PLAYERS IN ROOM')}</span>
            {(players.length ? players : [user]).slice(0, Number(room.maxPlayers || 4)).map((player, index) => {
              const playerId = getPlayerId(player);
              const isPlayerHost = normalizeId(playerId) === normalizeId(hostId);
              const isPlayerReady = playerReady(room, playerId);
              return (
                <div className="room-lobby-player" key={`${playerId || getPlayerLabel(player, index, user)}-${index}`}>
                  <span className="room-lobby-player__slot">{index + 1}</span>
                  <span className="room-lobby-player__name">{getPlayerLabel(player, index, user)}</span>
                  <span className={`room-lobby-player__status ${isPlayerReady ? 'is-ready' : 'is-waiting'}`}>
                    {tx(isPlayerHost ? (isPlayerReady ? 'HOST READY' : 'HOST') : (isPlayerReady ? 'READY' : 'NOT READY'))}
                  </span>
                </div>
              );
            })}
          </div>

          {backendStatus?.error ? <span className="room-lobby-error">{backendStatus.error}</span> : null}

          <button
            className={`room-lobby-action room-lobby-action--primary ${canStart ? '' : 'is-disabled'}`}
            type="button"
            onClick={() => backendActions?.startRoomMatch?.(room)}
            disabled={!canStart || isStarting}
          >
            <img className="room-lobby-action__skin" src={`${asset}b3.png`} alt="" draggable="false" />
            <span className="room-lobby-action__text">{tx(startButtonText)}</span>
          </button>

          <button
            className={`room-lobby-action room-lobby-action--ready ${viewerReady ? 'is-ready' : ''}`}
            type="button"
            onClick={() => backendActions?.setRoomReady?.(room, !viewerReady)}
            disabled={isReadyLoading || isCountdown}
          >
            <img className="room-lobby-action__skin" src={`${asset}b3.png`} alt="" draggable="false" />
            <span className="room-lobby-action__text">{tx(isReadyLoading ? 'SAVING...' : viewerReady ? 'UNREADY' : 'READY')}</span>
          </button>

          <button
            className="room-lobby-refresh"
            type="button"
            onClick={() => backendActions?.refreshRoom?.(room)}
            disabled={isRefreshing}
          >
            {tx(isRefreshing ? 'REFRESHING...' : 'REFRESH')}
          </button>

          <button
            className="room-lobby-action room-lobby-action--secondary"
            type="button"
            onClick={() => backendActions?.leaveRoom?.(room) || navigation.goRoomSelect()}
            disabled={isLeaving || isCountdown}
          >
            <img className="room-lobby-action__skin" src={`${asset}232.png`} alt="" draggable="false" />
            <span className="room-lobby-action__text">{tx(isLeaving ? 'LEAVING...' : 'LEAVE')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
