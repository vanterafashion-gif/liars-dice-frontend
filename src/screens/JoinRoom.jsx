import { useMemo, useState } from 'react';
import ProfileHud from '../components/ProfileHud.jsx';

const asset = '/assets/liars-dice/create-room/';
const shared = '/assets/liars-dice/room-select/';

function TopHud({ user, wallet }) {
  return (
    <>
      <ProfileHud className="join-room-profile" user={user} />

      <div className="join-room-currency join-room-currency--coins">
        <img className="join-room-currency__icon" src={`${shared}6.png`} alt="" draggable="false" />
        <span className="join-room-currency__value">{wallet?.coins || '0'}</span>
        <img className="join-room-currency__plus" src={`${shared}8.png`} alt="" draggable="false" />
      </div>

      <div className="join-room-currency join-room-currency--gems">
        <img className="join-room-currency__icon" src={`${shared}7.png`} alt="" draggable="false" />
        <span className="join-room-currency__value">{wallet?.gems || '0'}</span>
        <img className="join-room-currency__plus" src={`${shared}8.png`} alt="" draggable="false" />
      </div>
    </>
  );
}

function normalizeRoomCode(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

function RecentRoom({ room, tx, onJoin }) {
  return (
    <button className="join-room-recent" type="button" onClick={() => onJoin(room.code)}>
      <span className="join-room-recent__code">{room.code}</span>
      <span className="join-room-recent__name">{tx(room.name)}</span>
      <span className="join-room-recent__players">{room.players}</span>
      <span className="join-room-recent__summary">{tx(room.betSummary)}</span>
      <span className="join-room-recent__join">{tx('JOIN')}</span>
    </button>
  );
}

function getRoomJoinCode(room = {}) {
  return room.roomCode || room.code || room.roomId || room.id || null;
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

function buildBetSummary(room = {}) {
  const buyIn = readNumber(room.buyInAmount ?? room.entryFee ?? room.pricing?.buyInAmount);
  const perGame = readNumber(room.perGameAmount ?? room.roundStake ?? room.defaultCoinBet ?? room.pricing?.perGameAmount ?? room.pricing?.roundStake);
  const pekEnabled = Boolean(room.pekEnabled ?? room.slamEnabled ?? room.pricing?.pekEnabled ?? room.pricing?.slamEnabled ?? false);
  const percentage = readNumber(room.pekPercentage ?? room.slamPercentage ?? room.pricing?.pekPercentage ?? room.pricing?.slamPercentage, 100);
  const safePercentage = [25, 50, 100].includes(percentage) ? percentage : 100;
  const finalPek = readNumber(room.finalPekAmount ?? room.finalSlamAmount ?? room.pricing?.finalPekAmount ?? room.pricing?.finalSlamAmount, perGame ? perGame + Math.floor((perGame * safePercentage) / 100) : undefined);
  const parts = [];
  if (Number.isFinite(buyIn)) parts.push(`Buy-in ${formatAmount(buyIn)}`);
  if (Number.isFinite(perGame)) parts.push(`Game ${formatAmount(perGame)}`);
  parts.push(pekEnabled ? `Pek ${safePercentage}% / ${formatAmount(finalPek)}` : 'Pek OFF');
  return parts.join(' • ');
}


function normalizeAvailableRoom(room = {}) {
  if (!room || typeof room !== 'object') return null;

  const status = String(room.status || 'waiting').toLowerCase();
  const visibility = String(room.visibility || '').toLowerCase();
  if (room.isPrivate === true || visibility === 'private') return null;
  if (!['waiting', 'ready', 'open'].includes(status)) return null;

  const code = getRoomJoinCode(room);
  if (!code) return null;

  const players = Array.isArray(room.players) ? room.players : [];
  const playerIds = Array.isArray(room.playerIds) ? room.playerIds : [];
  const playerCount = Number(room.playerCount ?? players.length ?? playerIds.length ?? 0);
  const maxPlayers = Number(room.maxPlayers || room.selectedPlayers || 4);
  if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) return null;
  if (Number.isFinite(playerCount) && playerCount >= maxPlayers) return null;

  return {
    code,
    name: room.name || room.title || 'Private Room',
    players: `${Number.isFinite(playerCount) ? playerCount : 0} / ${Number.isFinite(maxPlayers) ? maxPlayers : 4}`,
    betSummary: buildBetSummary(room),
  };
}

function mergeAvailableRooms(...lists) {
  const uniqueRooms = new Map();

  lists.flat().forEach((room) => {
    const normalized = normalizeAvailableRoom(room);
    if (!normalized) return;
    const key = String(normalized.code).toUpperCase();
    if (!uniqueRooms.has(key)) uniqueRooms.set(key, normalized);
  });

  return Array.from(uniqueRooms.values()).slice(0, 12);
}

export default function JoinRoom({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const joinRoomData = data?.joinRoom || {};
  const availableRooms = useMemo(() => mergeAvailableRooms(
    data?.publicRooms || [],
    data?.activeRooms || [],
  ), [data?.publicRooms, data?.activeRooms]);
  const [roomCode, setRoomCode] = useState(joinRoomData.defaultCode || '');

  const cleanCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode]);
  const canJoin = cleanCode.length >= 4;
  const isJoining = backendStatus?.loading && backendStatus?.lastAction === 'rooms.join';
  const isRefreshing = backendStatus?.loading && backendStatus?.lastAction === 'rooms.refresh';
  const joinError = backendStatus?.lastAction === 'rooms.join' ? backendStatus?.error : null;

  const submitJoin = (code = cleanCode) => {
    const nextCode = normalizeRoomCode(code);
    if (nextCode.length < 4) return;
    backendActions?.joinRoom?.({ id: nextCode, key: nextCode, code: nextCode }) || navigation.goMatchmaking();
  };

  const pasteCode = async () => {
    try {
      const clipboardText = await navigator.clipboard?.readText?.();
      const pastedCode = normalizeRoomCode(clipboardText);
      if (pastedCode) setRoomCode(pastedCode);
    } catch (_error) {
      /* Clipboard access can be blocked by the browser. The input remains editable. */
    }
  };

  return (
    <section className="screen join-room-screen" aria-label={tx('Join Room')}>
      <TopHud user={user} wallet={wallet} />

      <div className="join-room-board">
        <img className="join-room-board__skin" src={`${asset}Pannal.png`} alt="" draggable="false" />
        <img className="join-room-character" src={`${asset}p1.png`} alt="" draggable="false" />

        <div className="join-room-form">
          <h1 className="join-room-title">{tx('JOIN ROOM')}</h1>
          <p className="join-room-subtitle">{tx('Enter the private room code to join your friends')}</p>

          <div className="join-room-codeBlock">
            <span className="join-room-label">{tx('ROOM CODE')}</span>
            <div className="join-room-codeWrap">
              <img className="join-room-codeWrap__skin" src={`${asset}pana433.png`} alt="" draggable="false" />
              <input
                className="join-room-codeWrap__field"
                type="text"
                value={roomCode}
                onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
                placeholder="LD-4729"
                aria-label={tx('ROOM CODE')}
                maxLength={12}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="go"
              />
              <button className="join-room-paste" type="button" onClick={pasteCode} aria-label={tx('Paste room code')}>
                <img src={`${asset}b5.png`} alt="" draggable="false" />
              </button>
            </div>
          </div>

          <span className="join-room-or">{tx('OR')}</span>

          <div className="join-room-recentBlock">
            <span className="join-room-label join-room-label--recent">{tx('AVAILABLE ROOMS')}</span>
            <div className="join-room-recentList">
              {availableRooms.length
                ? availableRooms.map((room) => <RecentRoom key={room.code} room={room} tx={tx} onJoin={submitJoin} />)
                : <span className="join-room-empty">{tx('No open rooms available')}</span>}
            </div>
          </div>

          <span className="join-room-helper">{joinError || tx('Use a valid room code like LD-4729')}</span>
        </div>

        <div className="join-room-actions" aria-label={tx('Join room actions')}>
          <button
            className={`join-room-bottom join-room-bottom--join ${canJoin ? 'is-ready' : 'is-disabled'}`}
            type="button"
            onClick={() => submitJoin()}
            disabled={!canJoin || isJoining}
          >
            <img className="join-room-bottom__skin" src={`${asset}b3.png`} alt="" draggable="false" />
            <span className="join-room-bottom__text">{tx(isJoining ? 'JOINING...' : 'JOIN ROOM')}</span>
          </button>

          <button
            className="join-room-bottom join-room-bottom--refresh"
            type="button"
            onClick={() => backendActions?.refreshRooms?.()}
            disabled={isRefreshing}
          >
            <img className="join-room-bottom__skin" src={`${asset}232.png`} alt="" draggable="false" />
            <span className="join-room-bottom__text">{tx(isRefreshing ? 'REFRESHING...' : 'REFRESH')}</span>
          </button>

          <button className="join-room-bottom join-room-bottom--back" type="button" onClick={navigation.goMainMenu}>
            <img className="join-room-bottom__skin" src={`${asset}232.png`} alt="" draggable="false" />
            <span className="join-room-bottom__text">{tx('BACK')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
