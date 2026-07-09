import { useState } from 'react';
import ProfileHud from '../components/ProfileHud.jsx';
import { resolveCreateRoomMusicKeyForBid } from '../config/tableMusic.js';
import { resolveCreateRoomBackgroundContract, resolveCreateRoomScreenBackgroundContract, toCssBackgroundImageValue } from '../utils/gameplayBackgrounds.js';
const asset = '/assets/liars-dice/create-room/';
const shared = '/assets/liars-dice/room-select/';

const MIN_BUY_IN = 50;
const MIN_STATIC_PER_GAME = 5;
const STATIC_PER_GAME_MODE = 'static';
const DEFAULT_PEK_PERCENTAGE = 25;
const PEK_PERCENTAGE_OPTIONS = [25, 50, 100];

function parseCoinAmount(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
}

function walletCoinAmount(wallet = {}) {
  return parseCoinAmount(
    wallet?.coins
      ?? wallet?.coinBalance
      ?? wallet?.walletCoins
      ?? wallet?.balance?.coins
      ?? wallet?.economy?.coins,
    0,
  );
}

function formatStakeOption(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number >= 1000) return `${Number((number / 1000).toFixed(1))}K`;
  return new Intl.NumberFormat('en-US').format(number);
}

function getStakeStep() {
  return 5;
}

function getPreviousStakeStep() {
  return 5;
}

function clampStakeValue(value, min = MIN_BUY_IN, max = Number.POSITIVE_INFINITY) {
  const number = parseCoinAmount(value, min);
  const safeMax = Number.isFinite(max) ? Math.max(min, max) : Number.POSITIVE_INFINITY;
  return Math.min(safeMax, Math.max(min, number || min));
}

function snapStakeValue(value, min = MIN_BUY_IN, max = Number.POSITIVE_INFINITY) {
  const amount = clampStakeValue(value, min, max);
  const snapped = Math.round(amount / 5) * 5;
  return clampStakeValue(snapped, min, max);
}

function stepStakeValue(value, direction, min = MIN_BUY_IN, max = Number.POSITIVE_INFINITY) {
  const amount = snapStakeValue(value, min, max);
  const next = direction < 0
    ? amount - getPreviousStakeStep(amount)
    : amount + getStakeStep(amount);
  return snapStakeValue(next, min, max);
}

function normalizeStake(value, fallback = MIN_BUY_IN) {
  return snapStakeValue(value || fallback, MIN_BUY_IN);
}

function normalizePerGameMode() {
  return STATIC_PER_GAME_MODE;
}

function buildStaticCoinBetOptions(amount) {
  return [snapStakeValue(amount, MIN_STATIC_PER_GAME)];
}

function normalizePerGameAmount(value, _mode, _baseAmount, buyInAmount) {
  const buyIn = normalizeStake(buyInAmount, MIN_BUY_IN);
  const fallback = Math.min(buyIn, MIN_STATIC_PER_GAME);
  return snapStakeValue(value || fallback, MIN_STATIC_PER_GAME, buyIn);
}

function normalizePekPercentage(value, fallback = 25) {
  const number = Number(String(value || '').replace(/[^0-9]/g, ''));
  if (PEK_PERCENTAGE_OPTIONS.includes(number)) return number;
  return PEK_PERCENTAGE_OPTIONS.includes(fallback) ? fallback : 25;
}

function calculateFinalPekAmount(perGameAmount, percentage) {
  const base = Number(perGameAmount) || 0;
  const percent = normalizePekPercentage(percentage, 25);
  return base + Math.floor((base * percent) / 100);
}

function TopHud({ user, wallet }) {
  return (
    <>
      <ProfileHud className="create-room-profile" user={user} />

      <div className="create-room-currency create-room-currency--coins">
        <img className="create-room-currency__icon" src={`${shared}6.png`} alt="" draggable="false" />
        <span className="create-room-currency__value">{wallet?.coins || '0'}</span>
        <img className="create-room-currency__plus" src={`${shared}8.png`} alt="" draggable="false" />
      </div>

      <div className="create-room-currency create-room-currency--gems">
        <img className="create-room-currency__icon" src={`${shared}7.png`} alt="" draggable="false" />
        <span className="create-room-currency__value">{wallet?.gems || '0'}</span>
        <img className="create-room-currency__plus" src={`${shared}8.png`} alt="" draggable="false" />
      </div>
    </>
  );
}

function OptionButton({ value, active = false, disabled = false, className = '', tx, onClick }) {
  return (
    <button className={`create-room-option ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''} ${className}`} type="button" onClick={onClick} disabled={disabled}>
      <img className="create-room-option__skin" src={`${asset}${active ? 'b2.png' : 'b1.png'}`} alt="" draggable="false" />
      <span className="create-room-option__text">{tx(value)}</span>
    </button>
  );
}

function StepperControl({
  value,
  displayValue,
  disabled = false,
  className = '',
  onDecrease,
  onIncrease,
  onValueSubmit,
  decreaseDisabled = false,
  increaseDisabled = false,
  tx,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(value ?? ''));

  const startEditing = () => {
    if (disabled || !onValueSubmit) return;
    setDraftValue(String(value ?? ''));
    setIsEditing(true);
  };

  const commitEditing = () => {
    if (!isEditing) return;
    setIsEditing(false);
    const trimmed = String(draftValue || '').trim();
    if (trimmed) onValueSubmit(trimmed);
  };

  const cancelEditing = () => {
    setDraftValue(String(value ?? ''));
    setIsEditing(false);
  };

  return (
    <div className={`create-room-stepper ${className} ${disabled ? 'is-disabled' : ''}`}>
      <button
        className="create-room-stepper__button create-room-stepper__button--minus"
        type="button"
        onClick={onDecrease}
        disabled={disabled || decreaseDisabled || isEditing}
        aria-label={tx('Decrease')}
      >
        −
      </button>
      {isEditing ? (
        <input
          className="create-room-stepper__value create-room-stepper__input"
          type="number"
          inputMode="numeric"
          min={MIN_BUY_IN}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitEditing();
            if (event.key === 'Escape') cancelEditing();
          }}
          aria-label={tx('Enter value')}
          autoFocus
        />
      ) : (
        <button
          className="create-room-stepper__value create-room-stepper__valueButton"
          type="button"
          onClick={startEditing}
          disabled={disabled || !onValueSubmit}
          aria-label={tx('Edit value')}
        >
          {displayValue ?? value}
        </button>
      )}
      <button
        className="create-room-stepper__button create-room-stepper__button--plus"
        type="button"
        onClick={onIncrease}
        disabled={disabled || increaseDisabled || isEditing}
        aria-label={tx('Increase')}
      >
        +
      </button>
    </div>
  );
}

function getVisibleRoomCode(data, settings) {
  return data?.currentRoom?.roomCode || data?.currentRoom?.code || data?.currentRoomCode || settings.roomCode || 'CREATE FIRST';
}

export default function CreateRoom({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const settings = data?.createRoom || {};
  const players = settings.players?.length ? settings.players : ['2', '3', '4'];
  const timers = settings.timers || [];
  const isCreating = backendStatus?.loading && ['rooms.create', 'bots.start'].includes(backendStatus?.lastAction);

  const initialBuyIn = normalizeStake(settings.buyInAmount || settings.buyInCoins || settings.customBuyIn || settings.customStake || settings.entryFee, MIN_BUY_IN);
  const initialPerGameMode = normalizePerGameMode();
  const initialPerGameBase = initialBuyIn;

  const [roomName, setRoomName] = useState(settings.roomName || `${user?.displayName || user?.username || 'Player'}’s Room`);
  const [selectedPlayers, setSelectedPlayers] = useState(settings.selectedPlayers || '2');
  const [selectedTimer, setSelectedTimer] = useState(settings.selectedTimer || '30s');
  const [selectedRoomMode, setSelectedRoomMode] = useState(String(settings.selectedRoomMode || settings.roomMode || 'normal').toLowerCase() === 'bots' ? 'bots' : 'normal');
  const [selectedBuyIn, setSelectedBuyIn] = useState(initialBuyIn);
  const [perGameMode] = useState(initialPerGameMode);
  const [perGameBase, setPerGameBase] = useState(initialPerGameBase);
  const [selectedPerGame, setSelectedPerGame] = useState(() => normalizePerGameAmount(
    settings.selectedPerGame || settings.perGameAmount || settings.roundStake || settings.perGameCoins || settings.defaultCoinBet || settings.defaultBidCoins,
    initialPerGameMode,
    initialPerGameBase,
    initialBuyIn,
  ));
  const pekEnabled = true;
  const [selectedPekPercentage, setSelectedPekPercentage] = useState(() => normalizePekPercentage(
    settings.pekPercentage || settings.slamPercentage || settings.pekPercent || settings.slamPercent,
    DEFAULT_PEK_PERCENTAGE,
  ));
  const [isPrivate, setIsPrivate] = useState(settings.isPrivate ?? true);

  const isBotsMode = selectedRoomMode === 'bots';
  const safeSelectedPerGame = normalizePerGameAmount(selectedPerGame, perGameMode, perGameBase, selectedBuyIn);
  const coinBetOptionsForStake = buildStaticCoinBetOptions(safeSelectedPerGame);
  const finalPekAmount = calculateFinalPekAmount(safeSelectedPerGame, selectedPekPercentage);
  const perGameInvalid = safeSelectedPerGame > selectedBuyIn;
  const pekRiskInvalid = false;
  const walletCoins = walletCoinAmount(wallet);
  const insufficientFunds = walletCoins > 0 && selectedBuyIn > walletCoins;
  const pekRiskError = '';
  const insufficientFundsError = insufficientFunds
    ? `Buy-in ${formatStakeOption(selectedBuyIn)} is higher than wallet ${formatStakeOption(walletCoins)}`
    : '';
  const localCreateError = pekRiskError || insufficientFundsError;
  const createDisabled = isCreating || perGameInvalid || pekRiskInvalid || insufficientFunds;
  const perGameCopy = `Bet ${formatStakeOption(safeSelectedPerGame)}`;
  const selectedRulesCopy = `Rules: 5 dice each • Buy-in ${formatStakeOption(selectedBuyIn)} • ${perGameCopy} • Pek/Slam ${selectedPekPercentage}%`;
  const gameplayBackgroundContract = resolveCreateRoomBackgroundContract({ buyInAmount: selectedBuyIn });
  const screenBackgroundContract = resolveCreateRoomScreenBackgroundContract();
  const selectedMusicKey = resolveCreateRoomMusicKeyForBid(selectedBuyIn);

  const currentSettings = {
    ...settings,
    ...gameplayBackgroundContract,
    roomName,
    musicKey: selectedMusicKey,
    tableMusicKey: selectedMusicKey,
    selectedPlayers,
    maxPlayers: Number(selectedPlayers),
    playersCount: Number(selectedPlayers),
    selectedCups: '5',
    startingCups: 5,
    startingDice: 5,
    dicePerPlayer: 5,
    selectedTimer,
    turnTimer: Number(String(selectedTimer).replace(/[^0-9]/g, '')) || 30,
    buyInAmount: selectedBuyIn,
    buyInCoins: selectedBuyIn,
    customBuyIn: selectedBuyIn,
    customStake: selectedBuyIn,
    entryFee: selectedBuyIn,
    perGameMode,
    coinBetMode: perGameMode,
    perGameBase: safeSelectedPerGame,
    selectedPerGame: safeSelectedPerGame,
    perGameAmount: safeSelectedPerGame,
    perGameCoins: safeSelectedPerGame,
    roundStake: safeSelectedPerGame,
    minCoinBet: safeSelectedPerGame,
    minBidCoins: safeSelectedPerGame,
    maxCoinBet: safeSelectedPerGame,
    maxBidCoins: safeSelectedPerGame,
    defaultCoinBet: safeSelectedPerGame,
    defaultBidCoins: safeSelectedPerGame,
    bidCoinStep: getStakeStep(safeSelectedPerGame),
    coinBetOptions: coinBetOptionsForStake,
    pekEnabled,
    slamEnabled: pekEnabled,
    pekPercentage: selectedPekPercentage,
    slamPercentage: selectedPekPercentage,
    finalPekAmount,
    finalSlamAmount: finalPekAmount,
    requiredPekCoverAmount: finalPekAmount,
    maxChallengeAmount: finalPekAmount,
    pricing: {
      buyInAmount: selectedBuyIn,
      buyInCoins: selectedBuyIn,
      entryFee: selectedBuyIn,
      startingStack: selectedBuyIn,
      minBuyIn: MIN_BUY_IN,
      maxBuyIn: 0,
      perGameMode,
      coinBetMode: perGameMode,
      perGameBase: safeSelectedPerGame,
      perGameOptions: coinBetOptionsForStake,
      selectedPerGame: safeSelectedPerGame,
      selectedPerGameAmount: safeSelectedPerGame,
      perGameAmount: safeSelectedPerGame,
      perGameCoins: safeSelectedPerGame,
      roundStake: safeSelectedPerGame,
      minCoinBet: safeSelectedPerGame,
      minBidCoins: safeSelectedPerGame,
      maxCoinBet: safeSelectedPerGame,
      maxBidCoins: safeSelectedPerGame,
      defaultCoinBet: safeSelectedPerGame,
      defaultBidCoins: safeSelectedPerGame,
      coinBetOptions: coinBetOptionsForStake,
      pekEnabled,
      slamEnabled: pekEnabled,
      pekPercentage: selectedPekPercentage,
      slamPercentage: selectedPekPercentage,
      finalPekAmount,
      finalSlamAmount: finalPekAmount,
      requiredPekCoverAmount: finalPekAmount,
      maxChallengeAmount: finalPekAmount,
      pekMultiplier: 1 + (selectedPekPercentage / 100),
    },
    stakeValidationClient: {
      validated: true,
      source: 'frontend_create_room',
      buyInAmount: selectedBuyIn,
      perGameMode,
      perGameBase: safeSelectedPerGame,
      coinBetOptions: coinBetOptionsForStake,
      selectedPerGame: safeSelectedPerGame,
      perGameAmount: safeSelectedPerGame,
      pekEnabled,
      pekPercentage: selectedPekPercentage,
      finalPekAmount,
    },
    bidStyle: 'Official Rules',
    selectedRoomMode,
    roomMode: selectedRoomMode,
    gameMode: selectedRoomMode,
    playMode: selectedRoomMode,
    botsEnabled: isBotsMode,
    playWithBots: isBotsMode,
    withBots: isBotsMode,
    isPrivate,
  };

  const roomCode = getVisibleRoomCode(data, settings);
  const createSelectedHandler = (setter, value) => () => setter(value);
  const handleBuyInStep = (direction) => () => {
    const nextBuyIn = stepStakeValue(selectedBuyIn, direction, MIN_BUY_IN);
    setSelectedBuyIn(nextBuyIn);
    setPerGameBase(nextBuyIn);
    setSelectedPerGame((current) => normalizePerGameAmount(current, STATIC_PER_GAME_MODE, nextBuyIn, nextBuyIn));
  };

  const handleBuyInValueSubmit = (value) => {
    const nextBuyIn = snapStakeValue(value, MIN_BUY_IN);
    setSelectedBuyIn(nextBuyIn);
    setPerGameBase(nextBuyIn);
    setSelectedPerGame((current) => normalizePerGameAmount(current, STATIC_PER_GAME_MODE, nextBuyIn, nextBuyIn));
  };

  const handleStaticPerGameStep = (direction) => () => {
    setSelectedPerGame((current) => stepStakeValue(current, direction, MIN_STATIC_PER_GAME, selectedBuyIn));
  };

  const handleStaticPerGameValueSubmit = (value) => {
    setSelectedPerGame(snapStakeValue(value, MIN_STATIC_PER_GAME, selectedBuyIn));
  };


  const copyCode = async () => {
    if (!roomCode || roomCode === 'CREATE FIRST') return;
    try {
      await navigator.clipboard?.writeText?.(roomCode);
    } catch (_error) {
      // Clipboard can be unavailable. The code remains visible for manual copy.
    }
  };

  return (
    <section
      className="screen create-room-screen"
      style={{ '--create-room-background-image': toCssBackgroundImageValue(screenBackgroundContract.backgroundUrl) }}
      data-background-key={screenBackgroundContract.backgroundKey}
      data-background-url={screenBackgroundContract.backgroundUrl}
      aria-label={tx('Create Room')}
    >
      <TopHud user={user} wallet={wallet} />

      <div className="create-room-board">
        <img className="create-room-board__skin" src={`${asset}Pannal.png`} alt="" draggable="false" />

        <img className="create-room-character" src={`${asset}p1.png`} alt="" draggable="false" />

        <div className="create-room-form">
          <div className="create-room-block create-room-block--name">
            <span className="create-room-label">{tx('ROOM NAME')}</span>
            <div className="create-room-input create-room-input--name">
              <img className="create-room-input__skin" src={`${asset}pana44.png`} alt="" draggable="false" />
              <input
                className="create-room-input__field"
                type="text"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                aria-label={tx('ROOM NAME')}
                maxLength={22}
                inputMode="text"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck="false"
                enterKeyHint="done"
              />
            </div>
          </div>

          <div className="create-room-block create-room-block--players">
            <span className="create-room-label">{tx('PLAYERS')}</span>
            <div className="create-room-optionRow create-room-optionRow--players">
              {players.map((value) => <OptionButton key={value} value={value} active={value === selectedPlayers} tx={tx} onClick={createSelectedHandler(setSelectedPlayers, value)} />)}
            </div>
          </div>



          <div className="create-room-block create-room-block--timer">
            <span className="create-room-label">{tx('TURN TIMER')}</span>
            <div className="create-room-optionRow create-room-optionRow--timer">
              {timers.map((value) => <OptionButton key={value} value={value} active={value === selectedTimer} tx={tx} onClick={createSelectedHandler(setSelectedTimer, value)} />)}
            </div>
          </div>

          <div className="create-room-block create-room-block--bid">
            <span className="create-room-label">{tx('BUY-IN')}</span>
            <StepperControl
              className="create-room-stepper--buyIn"
              value={selectedBuyIn}
              displayValue={formatStakeOption(selectedBuyIn)}
              tx={tx}
              onDecrease={handleBuyInStep(-1)}
              onIncrease={handleBuyInStep(1)}
              onValueSubmit={handleBuyInValueSubmit}
              decreaseDisabled={selectedBuyIn <= MIN_BUY_IN}
            />
          </div>

          <div className="create-room-block create-room-block--perGame">
            <span className="create-room-label">{tx('BET')}</span>
            <StepperControl
              className="create-room-stepper--perGame create-room-stepper--staticPerGame"
              value={safeSelectedPerGame}
              displayValue={formatStakeOption(safeSelectedPerGame)}
              tx={tx}
              onDecrease={handleStaticPerGameStep(-1)}
              onIncrease={handleStaticPerGameStep(1)}
              onValueSubmit={handleStaticPerGameValueSubmit}
              decreaseDisabled={safeSelectedPerGame <= MIN_STATIC_PER_GAME}
              increaseDisabled={safeSelectedPerGame >= selectedBuyIn}
            />
          </div>

          <div className="create-room-block create-room-block--pekPercent">
            <span className="create-room-label">{tx('PEK / SLAM')}</span>
            <div className="create-room-optionRow create-room-optionRow--pekPercent">
              {PEK_PERCENTAGE_OPTIONS.map((value) => (
                <OptionButton
                  key={value}
                  value={`${value}%`}
                  active={value === selectedPekPercentage}
                  className="create-room-option--pekPercent"
                  tx={tx}
                  onClick={() => setSelectedPekPercentage(value)}
                />
              ))}
            </div>
            <span className="create-room-pekPreview">{tx('PEK amount')} {formatStakeOption(finalPekAmount)}</span>
          </div>

          <div className="create-room-block create-room-block--mode">
            <span className="create-room-label">{tx('ROOM MODE')}</span>
            <div className="create-room-optionRow create-room-optionRow--mode">
              <OptionButton value="NORMAL" active={selectedRoomMode === 'normal'} className="create-room-option--mode" tx={tx} onClick={createSelectedHandler(setSelectedRoomMode, 'normal')} />
              <OptionButton value="BOTS" active={selectedRoomMode === 'bots'} className="create-room-option--mode" tx={tx} onClick={createSelectedHandler(setSelectedRoomMode, 'bots')} />
            </div>
          </div>

          <div className="create-room-block create-room-block--private">
            <span className="create-room-label">{tx('PRIVATE ROOM')}</span>
            <button
              className={`create-room-privateToggle ${isPrivate ? 'is-on' : 'is-off'}`}
              type="button"
              onClick={() => setIsPrivate((value) => !value)}
              aria-pressed={isPrivate}
              aria-label={isPrivate ? tx('Private room on') : tx('Private room off')}
            >
              <img src={`${asset}${isPrivate ? 'on.png' : 'off.png'}`} alt="" draggable="false" />
            </button>
          </div>

          <div className="create-room-block create-room-block--code">
            <span className="create-room-label">{tx('ROOM CODE')}</span>
            <div className="create-room-codeWrap">
              <img className="create-room-codeWrap__skin" src={`${asset}pana433.png`} alt="" draggable="false" />
              <span className="create-room-codeWrap__text">{roomCode}</span>
              <button className="create-room-copy" type="button" onClick={copyCode} aria-label={tx('Copy room code')}>
                <img src={`${asset}b5.png`} alt="" draggable="false" />
              </button>
            </div>
          </div>

          <span className="create-room-rules">{tx(isBotsMode ? 'Bots mode starts immediately with Bots.' : selectedRulesCopy)}</span>

          {localCreateError ? <span className="create-room-rules create-room-rules--error">{tx(localCreateError)}</span> : null}

          {backendStatus?.error && ['rooms.create', 'bots.start', 'bots.start.error'].includes(backendStatus?.lastAction) ? <span className="create-room-rules create-room-rules--error create-room-rules--backendError">{backendStatus.error}</span> : null}

          <button
            className="create-room-bottom create-room-bottom--create"
            type="button"
            onClick={() => {
              if (createDisabled) return;
              if (isBotsMode && backendActions?.startBotsMatch) {
                backendActions.startBotsMatch(currentSettings);
                return;
              }
              backendActions?.createRoom?.(currentSettings) || navigation.goRoomLobby();
            }}
            disabled={createDisabled}
          >
            <img className="create-room-bottom__skin" src={`${asset}b3.png`} alt="" draggable="false" />
            <span className="create-room-bottom__text">{tx(isCreating ? 'CREATING...' : isBotsMode ? 'START SOLO' : 'CREATE ROOM')}</span>
          </button>

          <button className="create-room-bottom create-room-bottom--back" type="button" onClick={navigation.goMainMenu}>
            <img className="create-room-bottom__skin" src={`${asset}232.png`} alt="" draggable="false" />
            <span className="create-room-bottom__text">{tx('BACK')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
