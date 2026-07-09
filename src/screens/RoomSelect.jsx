import { useMemo, useState } from 'react';
import ProfileHud from '../components/ProfileHud.jsx';
import { resolveGameplayBackgroundContract } from '../utils/gameplayBackgrounds.js';

const asset = '/assets/liars-dice/room-select/';
const sparkles = Array.from({ length: 20 }, (_, index) => index + 1);
const ROOM_ORDER = ['beginner', 'high-roller', 'private'];
const PLAYER_COUNT_SEQUENCE = [2, 3, 4];
const TIER_PEK_PERCENTAGES = {
  beginner: 25,
  'high-roller': 50,
  highroller: 50,
  high_roller: 50,
  private: 25,
  'private-room': 25,
};

function hasCardValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function formatCardAmount(value) {
  if (!hasCardValue(value)) return '—';
  if (typeof value === 'string' && /[a-z]/i.test(value)) return value;
  const number = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(number)) return String(value);
  if (number >= 1000000) return `${Number((number / 1000000).toFixed(1))}M`;
  if (number >= 1000) return `${Number((number / 1000).toFixed(1))}K`;
  return new Intl.NumberFormat('en-US').format(number);
}

function normalizeRoomKey(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (normalized === 'highroller' || normalized === 'high-rollers') return 'high-roller';
  if (normalized === 'private-room' || normalized === 'privet-room' || normalized === 'privet') return 'private';
  return normalized;
}

function isVisibleRoom(room = {}) {
  const key = normalizeRoomKey(room.key || room.id || room.tableId || room.tierId || room.title);
  return ROOM_ORDER.includes(key);
}

function formatCardPercent(value) {
  if (!hasCardValue(value)) return '—';
  const number = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(number)) return String(value);
  return `${Math.max(0, Math.trunc(number))}%`;
}

function firstCardValue(...values) {
  return values.find((value) => hasCardValue(value));
}

function resolveTierPekPercentage(room = {}, pricing = {}) {
  const key = normalizeRoomKey(room.key || room.id || room.tableId || room.tier || room.tableTier || room.title);
  if (key === 'private') return '25-100%';
  if (key === 'beginner') return 25;
  if (key === 'high-roller') return 50;

  const direct = firstCardValue(
    pricing.pekPercentage,
    pricing.slamPercentage,
    room.pekPercentage,
    room.slamPercentage,
    pricing.pekPercent,
    room.pekPercent,
  );
  if (hasCardValue(direct)) return direct;

  const keys = [room.key, room.id, room.tableId, room.tier, room.tableTier, room.title].map(normalizeRoomKey);
  for (const item of keys) {
    if (Object.prototype.hasOwnProperty.call(TIER_PEK_PERCENTAGES, item)) return TIER_PEK_PERCENTAGES[item];
  }

  return 25;
}

function resolveCardBet(room = {}, pricing = {}) {
  return firstCardValue(
    pricing.perGameAmount,
    pricing.roundStake,
    pricing.selectedPerGame,
    pricing.selectedPerGameAmount,
    pricing.defaultCoinBet,
    pricing.defaultBidCoins,
    pricing.minCoinBet,
    pricing.minBidCoins,
    room.perGameAmount,
    room.roundStake,
    room.selectedPerGame,
    room.defaultCoinBet,
    room.defaultBidCoins,
    room.minCoinBet,
    room.minBidCoins,
  );
}

function buildCardInfo(room = {}) {
  const pricing = room.pricing && typeof room.pricing === 'object' ? room.pricing : {};
  const rewards = room.rewards && typeof room.rewards === 'object' ? room.rewards : {};

  const buyInAmount = firstCardValue(pricing.buyInAmount, pricing.entryFee, room.buyInAmount, room.entryFee, room.fee, pricing.buyIn, room.buyIn);
  const betAmount = resolveCardBet(room, pricing);
  const pekPercentage = resolveTierPekPercentage(room, pricing);

  return [
    { label: 'Buy-in', value: formatCardAmount(buyInAmount) },
    { label: 'Bet', value: formatCardAmount(betAmount) },
    { label: 'Pek', value: typeof pekPercentage === 'string' && pekPercentage.includes('%') ? pekPercentage : formatCardPercent(pekPercentage) },
    { label: 'XP Win', value: formatCardAmount(rewards.xpWin ?? room.xpWin) },
  ];
}

function isCycleableRoom(room = {}) {
  const key = normalizeRoomKey(room.key || room.id || room.title);
  return key === 'beginner' || key === 'high-roller';
}

function clampPlayerCount(value, fallback = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 2) return 2;
  if (number >= 4) return 4;
  return 3;
}

function getInitialPlayerCount(room = {}) {
  const key = normalizeRoomKey(room.key || room.id || room.title);
  if (key === 'beginner' || key === 'high-roller') return 2;
  return clampPlayerCount(room.selectedPlayers || room.defaultPlayers || room.defaultPlayerCount || room.maxPlayers || 2);
}

function getSelectedPlayerCount(room = {}, selectedPlayerCounts = {}) {
  const key = normalizeRoomKey(room.key || room.id || room.title);
  return clampPlayerCount(selectedPlayerCounts[key] ?? getInitialPlayerCount(room));
}

function getNextPlayerCount(currentCount) {
  const currentIndex = PLAYER_COUNT_SEQUENCE.indexOf(clampPlayerCount(currentCount));
  return PLAYER_COUNT_SEQUENCE[(currentIndex + 1) % PLAYER_COUNT_SEQUENCE.length];
}

function buildRoomRows(room = {}, selectedPlayers = 2) {
  const key = normalizeRoomKey(room.key || room.id || room.title);
  const rows = Array.isArray(room.rows) ? room.rows : [];
  const filteredRows = rows.filter((row) => {
    const text = String(row?.text || row?.label || row || '').trim().toLowerCase();
    return text && text !== 'official rules';
  });

  const playerRow = key === 'private'
    ? { icon: 'IC1.png', text: '2 - 4 Players' }
    : { icon: 'IC1.png', text: `${selectedPlayers} Players` };

  const featureRows = filteredRows
    .filter((row) => !/players/i.test(String(row?.text || row?.label || row || '')))
    .slice(0, 2);

  return [playerRow, ...featureRows].slice(0, 3);
}

function normalizeDisplayRoom(room = {}, selectedPlayerCounts = {}) {
  const key = normalizeRoomKey(room.key || room.id || room.tableId || room.tierId || room.title);
  const selectedPlayers = getSelectedPlayerCount({ ...room, key }, selectedPlayerCounts);
  const pricing = room.pricing && typeof room.pricing === 'object' ? room.pricing : {};
  const backgroundContract = resolveGameplayBackgroundContract([{ ...room, key }], {
    fallbackKey: key === 'private' ? 'private_room' : key === 'high-roller' ? 'table_buyin_5000' : 'table_buyin_500',
  });
  const pekPercentage = resolveTierPekPercentage({ ...room, key }, pricing);
  const pekNumber = Number(String(pekPercentage).replace(/[^0-9.-]/g, '')) || (key === 'high-roller' ? 50 : 25);

  return {
    ...room,
    ...backgroundContract,
    key,
    selectedPlayers,
    minPlayers: key === 'private' ? 2 : selectedPlayers,
    maxPlayers: key === 'private' ? clampPlayerCount(room.maxPlayers || 4, 4) : selectedPlayers,
    requiredPlayers: key === 'private' ? undefined : selectedPlayers,
    pricing: {
      ...pricing,
      pekEnabled: true,
      slamEnabled: true,
      pekPercentage: key === 'private' ? pricing.pekPercentage ?? 25 : pekNumber,
      slamPercentage: key === 'private' ? pricing.slamPercentage ?? 25 : pekNumber,
    },
    rows: buildRoomRows({ ...room, key }, selectedPlayers),
  };
}

function buildMatchmakingPayload(room = {}) {
  const pricing = room.pricing && typeof room.pricing === 'object' ? room.pricing : {};
  const rewards = room.rewards && typeof room.rewards === 'object' ? room.rewards : {};
  const key = normalizeRoomKey(room.key || room.id || room.tableId || room.tierId || room.title);
  const selectedPlayers = clampPlayerCount(room.selectedPlayers || room.requiredPlayers || room.maxPlayers || room.playersCount || (key === 'private' ? 2 : getSelectedPlayerCount(room)));
  const buyInAmount = pricing.buyInAmount ?? pricing.entryFee ?? room.buyInAmount ?? room.entryFee ?? room.fee ?? undefined;
  const backgroundContract = resolveGameplayBackgroundContract([{ ...room, key, buyInAmount }], {
    fallbackKey: key === 'private' ? 'private_room' : key === 'high-roller' ? 'table_buyin_5000' : 'table_buyin_500',
  });
  const pekPercentage = Number(String(resolveTierPekPercentage(room, pricing)).replace(/[^0-9.-]/g, '')) || (key === 'high-roller' ? 50 : 25);
  const pekEnabled = true;
  const normalizedPricing = {
    ...pricing,
    paidPlayerCountPreview: selectedPlayers,
    pekEnabled,
    slamEnabled: pekEnabled,
    pekPercentage,
    slamPercentage: pekPercentage,
  };

  return {
    ...backgroundContract,
    tierId: room.tierId || room.id || room.key,
    tableId: room.tableId || room.id || room.key,
    key,
    mode: room.mode || key || room.title,
    title: room.title || room.name || room.label,
    pricing: normalizedPricing,
    rewards,
    buyIn: pricing.buyIn || pricing.buyInRange || room.buyIn || room.buyInLabel || room.entryFeeLabel || undefined,
    buyInAmount,
    buyInCoins: buyInAmount,
    minBuyIn: pricing.minBuyIn ?? room.minBuyIn,
    maxBuyIn: pricing.maxBuyIn ?? room.maxBuyIn,
    maxPlayers: selectedPlayers,
    minPlayers: selectedPlayers,
    selectedPlayers,
    requiredPlayers: selectedPlayers,
    playerCount: selectedPlayers,
    entryFee: buyInAmount,
    minCoinBet: pricing.minCoinBet ?? pricing.minBidCoins ?? room.minCoinBet ?? room.minBidCoins ?? undefined,
    minBidCoins: pricing.minCoinBet ?? pricing.minBidCoins ?? room.minCoinBet ?? room.minBidCoins ?? undefined,
    maxCoinBet: pricing.maxCoinBet ?? pricing.maxBidCoins ?? room.maxCoinBet ?? room.maxBidCoins ?? undefined,
    maxBidCoins: pricing.maxCoinBet ?? pricing.maxBidCoins ?? room.maxCoinBet ?? room.maxBidCoins ?? undefined,
    defaultCoinBet: pricing.defaultCoinBet ?? pricing.defaultBidCoins ?? room.defaultCoinBet ?? room.defaultBidCoins ?? undefined,
    defaultBidCoins: pricing.defaultCoinBet ?? pricing.defaultBidCoins ?? room.defaultCoinBet ?? room.defaultBidCoins ?? undefined,
    bidCoinStep: pricing.bidCoinStep ?? room.bidCoinStep ?? undefined,
    coinBetOptions: pricing.coinBetOptions ?? room.coinBetOptions ?? undefined,
    pekEnabled,
    slamEnabled: pekEnabled,
    pekPercentage,
    slamPercentage: pekPercentage,
    potMode: pricing.potMode ?? room.potMode ?? undefined,
    payoutMode: pricing.payoutMode ?? room.payoutMode ?? undefined,
    xpWin: rewards.xpWin ?? room.xpWin ?? undefined,
    xpLose: rewards.xpLose ?? room.xpLose ?? undefined,
    rewardMultiplier: rewards.rewardMultiplier ?? room.rewardMultiplier ?? room.multiplier ?? undefined,
    region: room.region || room.serverRegion || undefined,
    rows: Array.isArray(room.rows) ? room.rows : [],
  };
}

function RoomCard({ room, onPlay, onCreatePrivate, onCyclePlayers, tx }) {
  const cardInfo = buildCardInfo(room);
  const rows = Array.isArray(room.rows) ? room.rows : [];
  const isPrivate = room.key === 'private';
  const cycleable = isCycleableRoom(room);
  const handleCardClick = () => {
    if (isPrivate) onCreatePrivate?.();
  };
  const handleCardKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleCardClick();
  };
  const handlePlayersClick = (event) => {
    event.stopPropagation();
    onCyclePlayers?.(room);
  };
  const handlePlayClick = (event) => {
    event.stopPropagation();
    if (isPrivate) onCreatePrivate?.();
    else onPlay?.(room);
  };

  return (
    <article
      className={`room-select-card room-select-card--${room.key} room-select-card--players-${room.selectedPlayers || room.maxPlayers || 2}${cycleable ? ' room-select-card--cycleable' : ''}`}
      data-background-key={room.backgroundKey || undefined}
      data-background-url={room.backgroundUrl || undefined}
      role={isPrivate ? 'button' : undefined}
      tabIndex={isPrivate ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={cycleable ? `${tx(room.title)} ${room.selectedPlayers} ${tx('Players')}` : tx(room.title)}
    >
      <img className="room-select-card__skin" src={`${asset}${room.card}`} alt="" draggable="false" />
      <span className="room-select-card__title">{tx(room.title)}</span>
      <img className={`room-select-card__art room-select-card__art--${room.key}`} src={`${asset}${room.tableArt}`} alt="" draggable="false" />
      <span className="room-select-card__stats">
        {cardInfo.map((item) => (
          <span className="room-select-card__stat" key={`${room.key}-${item.label}`}>
            <span className="room-select-card__statLabel">{tx(item.label)}</span>
            <span className="room-select-card__statValue">{item.value}</span>
          </span>
        ))}
      </span>
      {cycleable ? (
        <button className="room-select-card__playersButton" type="button" onClick={handlePlayersClick} aria-label={`${tx('PLAYERS')} ${room.selectedPlayers || 2}`}>
          <span className="room-select-card__playersButtonLabel">{tx('PLAYERS')}</span>
          <span className="room-select-card__playersButtonValue">{room.selectedPlayers || 2}P</span>
        </button>
      ) : null}
      <span className="room-select-card__rules">
        {rows.map((row) => (
          <span className="room-select-card__rule" key={`${room.key}-${row.text}`}>
            <img src={`${asset}${row.icon}`} alt="" draggable="false" />
            <span>{tx(row.text)}</span>
          </span>
        ))}
      </span>
      <button className="room-select-card__playSkinWrap" type="button" onClick={handlePlayClick} disabled={room.disabled}>
        <img className="room-select-card__playSkin" src={`${asset}${room.button}`} alt="" draggable="false" />
        <span className="room-select-card__playText">{tx('PLAY')}</span>
      </button>
    </article>
  );
}

export default function RoomSelect({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const rooms = data?.rooms || [];
  const [selectedPlayerCounts, setSelectedPlayerCounts] = useState({});
  const isStarting = backendStatus?.loading && backendStatus?.lastAction === 'matchmaking.start';

  const displayRooms = useMemo(() => rooms
    .filter(isVisibleRoom)
    .map((room) => normalizeDisplayRoom(room, selectedPlayerCounts))
    .sort((a, b) => ROOM_ORDER.indexOf(a.key) - ROOM_ORDER.indexOf(b.key)), [rooms, selectedPlayerCounts]);

  const startTableMatchmaking = (room) => {
    const payload = buildMatchmakingPayload(room);
    backendActions?.startMatchmaking?.(payload);
  };

  const cyclePlayerCount = (room) => {
    const key = normalizeRoomKey(room.key || room.id || room.title);
    if (!isCycleableRoom({ ...room, key })) return;
    setSelectedPlayerCounts((current) => ({
      ...current,
      [key]: getNextPlayerCount(current[key] ?? getSelectedPlayerCount(room, current)),
    }));
  };

  return (
    <section className="screen room-select-screen" aria-label={tx('Room Select')}>
      <div className="room-select-vfx room-select-vfx--vignette" aria-hidden="true" />
      <div className="room-select-vfx room-select-vfx--lightRays" aria-hidden="true" />
      <div className="room-select-vfx room-select-vfx--titleShine" aria-hidden="true" />
      <div className="room-select-sparkles" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span className={`room-select-sparkle room-select-sparkle--${sparkle}`} key={sparkle} />
        ))}
      </div>

      <ProfileHud className="room-select-profile" user={user} />

      <div className="room-select-currency room-select-currency--coins">
        <img className="room-select-currency__icon" src={`${asset}6.png`} alt="" draggable="false" />
        <span className="room-select-currency__value">{wallet.coins || '0'}</span>
        <img className="room-select-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
      </div>

      <div className="room-select-currency room-select-currency--gems">
        <img className="room-select-currency__icon" src={`${asset}7.png`} alt="" draggable="false" />
        <span className="room-select-currency__value">{wallet.gems || '0'}</span>
        <img className="room-select-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
      </div>

      <img className="room-select-titleArt" src={`${asset}select-title.png`} alt={tx('Select Table')} draggable="false" />

      <div className="room-select-cards room-select-cards--three" aria-label={tx('Available tables')} aria-busy={isStarting}>
        {displayRooms.map((room) => (
          <RoomCard
            key={room.key || room.id}
            room={room}
            onPlay={startTableMatchmaking}
            onCreatePrivate={navigation.goCreateRoom}
            onCyclePlayers={cyclePlayerCount}
            tx={tx}
          />
        ))}
      </div>

      {!displayRooms.length ? (
        <div className="room-select-empty">{tx('No backend tables available')}</div>
      ) : null}

      {backendStatus?.error && String(backendStatus?.lastAction || '').startsWith('matchmaking.') ? (
        <div className="room-select-empty room-select-error">{tx(backendStatus.error)}</div>
      ) : null}

      <button className="room-select-bottom room-select-bottom--play" type="button" onClick={() => backendActions?.startMatchmaking?.({})} disabled={isStarting}>
        <img className="room-select-bottom__skin" src={`${asset}bottom-play.png`} alt="" draggable="false" />
        <span className="room-select-bottom__title">{tx(isStarting ? 'MATCHING...' : 'PLAY NOW')}</span>
        <span className="room-select-bottom__subtitle">{tx('Jump into a quick game')}</span>
      </button>

      <button className="room-select-bottom room-select-bottom--create" type="button" onClick={navigation.goCreateRoom}>
        <img className="room-select-bottom__skin" src={`${asset}bottom-create.png`} alt="" draggable="false" />
        <span className="room-select-bottom__title">{tx('CREATE ROOM')}</span>
        <span className="room-select-bottom__subtitle">{tx('Invite friends &amp; play')}</span>
      </button>

      <button className="room-select-back" type="button" onClick={navigation.goMainMenu}>
        <img className="room-select-back__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="room-select-back__text">{tx('BACK')}</span>
      </button>
    </section>
  );
}
