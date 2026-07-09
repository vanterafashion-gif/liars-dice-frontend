import { nanoid } from 'nanoid';
import { badRequest, forbidden, notFound } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { buildTableMatchMetadata } from '../data/tableCatalog.js';
import { applyPassXpToUser, passXpSources } from '../data/passCatalog.js';
import { store } from '../store/index.js';
import { defaultProfileAvatar, normalizeProfileAvatar } from '../utils/avatarCatalog.js';
import { buildBotProfile, normalizeRoomMode, ROOM_MODE_BOTS } from '../data/botCatalog.js';

function nowIso() {
  return new Date().toISOString();
}

function addMs(ms) {
  return new Date(Date.now() + Math.max(0, Number(ms || 0))).toISOString();
}

function msUntil(isoValue) {
  if (!isoValue) return 0;
  const target = new Date(isoValue).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, target - Date.now());
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(count) {
  return Array.from({ length: count }, rollDie);
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

const DEFAULT_TURN_TIMER_SECONDS = 30;
const ALLOWED_TURN_TIMERS_SECONDS = new Set([20, 25, 30]);

function parseTimer(value) {
  const timer = Number(String(value || DEFAULT_TURN_TIMER_SECONDS).replace(/[^0-9]/g, ''));
  const normalized = Number.isFinite(timer) ? Math.trunc(timer) : DEFAULT_TURN_TIMER_SECONDS;
  return ALLOWED_TURN_TIMERS_SECONDS.has(normalized) ? normalized : DEFAULT_TURN_TIMER_SECONDS;
}

const OFFICIAL_BID_STYLE = 'Official Rules';
const FIXED_DICE_PER_ROUND = 5;
const DEFAULT_STACK_LOSS = 1;
const DEFAULT_MIN_BID_COINS = 1;
const DEFAULT_BID_COIN_STEP = 1;
const TIMEOUT_AUTO_RAISE_STEP = 1;
const SETTLEMENT_PENDING = 'pending';
const SETTLEMENT_SETTLED = 'settled';
const SETTLEMENT_REFUNDED = 'refunded';
const SETTLEMENT_FAILED = 'failed';
const SETTLEMENT_STATUSES = new Set([
  SETTLEMENT_PENDING,
  SETTLEMENT_SETTLED,
  SETTLEMENT_REFUNDED,
  SETTLEMENT_FAILED,
]);

function normalizeBidStyle() {
  return OFFICIAL_BID_STYLE;
}

function normalizeGameRules(existingRules = {}, context = {}) {
  const rules = existingRules && typeof existingRules === 'object' ? existingRules : {};

  return {
    ...rules,
    mode: 'official_rules',
    bidStyle: OFFICIAL_BID_STYLE,
    startingDice: FIXED_DICE_PER_ROUND,
    dicePerPlayer: FIXED_DICE_PER_ROUND,
    dicePerRound: FIXED_DICE_PER_ROUND,
    cupPerPlayer: 1,
    wildDice: true,
    onesAreWild: true,
    onesDisableAfterCalled: true,
    slamEnabled: false,
    rerollEnabled: false,
    diceLostOnCallLiar: 1,
    diceLostOnSlam: 2,
    rerollLimitPerRound: 0,
    winCondition: 'last_player_with_stack',
    coinBidEnabled: true,
    requiresCoinBid: true,
    minBidCoins: Math.max(1, positiveInt(rules.minBidCoins, DEFAULT_MIN_BID_COINS)),
    maxBidCoins: positiveInt(rules.maxBidCoins, 0),
    bidCoinStep: Math.max(1, positiveInt(rules.bidCoinStep, DEFAULT_BID_COIN_STEP)),
    botsEnabled: Boolean(context.botsEnabled || rules.botsEnabled),
  };
}

function setTurnTimer(match) {
  const turnTimer = parseTimer(match.turnTimer || match.gameRules?.turnTimer || 30);
  const startedAt = nowIso();
  match.turnTimer = turnTimer;
  match.turnStartedAt = startedAt;
  match.turnDeadlineAt = addMs(turnTimer * 1000);
  return match;
}

function getTurnTimeRemainingMs(match) {
  if (!match || match.status !== 'active') return 0;
  return msUntil(match.turnDeadlineAt);
}

function getMatchStartRemainingMs(match) {
  if (!match || match.status !== 'countdown') return 0;
  return msUntil(match.startsAt);
}

function nextIndex(match, fromIndex = match.turnIndex) {
  return (fromIndex + 1) % Math.max(match.players.length, 1);
}

function stackValue(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.max(0, Math.trunc(numeric));
}

function matchStartingStack(match = {}, fallback = 0) {
  const candidates = [
    match.startingStack,
    match.pricing?.startingStack,
    match.table?.startingStack,
    match.selectedTable?.startingStack,
    match.entryFee,
    fallback,
  ];

  for (const candidate of candidates) {
    const value = stackValue(candidate);
    if (value > 0) return value;
  }

  return 0;
}

function playerStack(player = {}, fallback = 0) {
  for (const key of ['stack', 'currentStack', 'coinsStack', 'matchStack']) {
    if (player[key] !== undefined && player[key] !== null) return stackValue(player[key], fallback);
  }
  return stackValue(fallback);
}

function minimumPlayableStack(match = {}) {
  return Math.max(1, minimumBidCoins(match));
}

function isBelowMinimumPlayableStack(match = {}, player = {}, stackOverride = null) {
  const stack = stackOverride === null || stackOverride === undefined
    ? playerStack(player, matchStartingStack(match))
    : stackValue(stackOverride);
  const minimumStack = minimumPlayableStack(match);
  return stack > 0 && stack < minimumStack;
}

function isPlayerEliminatedByStack(match = {}, player = {}) {
  const stack = playerStack(player, matchStartingStack(match));
  return Boolean(player?.eliminated) || stack <= 0 || isBelowMinimumPlayableStack(match, player, stack);
}

function markPlayerEliminated(player, reason = 'eliminated') {
  if (!player) return player;
  player.eliminated = true;
  player.active = false;
  player.lives = 0;
  player.diceCount = 0;
  player.dice = [];
  player.eliminatedAt = player.eliminatedAt || nowIso();
  player.eliminationReason = player.eliminationReason || reason;
  if (reason === 'below_minimum_bid') player.bustedBelowMinimumBid = true;
  return player;
}

function positiveInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.max(0, Math.trunc(numeric));
}

function normalizeSettlementStatus(value, fallback = SETTLEMENT_PENDING) {
  const status = String(value || fallback || SETTLEMENT_PENDING).toLowerCase();
  return SETTLEMENT_STATUSES.has(status) ? status : SETTLEMENT_PENDING;
}

function syncSettlementFields(match = {}) {
  const existingStatus = normalizeSettlementStatus(match.settlementStatus, SETTLEMENT_PENDING);
  const status = String(match.status || '').toLowerCase();

  if (match.entryFeesRefunded || status === 'cancelled') {
    match.settlementStatus = SETTLEMENT_REFUNDED;
  } else if (match.rewardApplied || match.potPaid || match.payoutApplied || match.settledAt) {
    match.settlementStatus = SETTLEMENT_SETTLED;
  } else if (existingStatus === SETTLEMENT_FAILED) {
    match.settlementStatus = SETTLEMENT_FAILED;
  } else {
    match.settlementStatus = SETTLEMENT_PENDING;
  }

  match.settlement = {
    ...(match.settlement || {}),
    status: match.settlementStatus,
    buyInsCharged: Boolean(match.entryFeesCharged || match.buyInsCharged),
    buyInsChargedAt: match.entryFeesChargedAt || match.buyInsChargedAt || null,
    refunded: Boolean(match.entryFeesRefunded),
    refundedAt: match.entryFeesRefundedAt || match.refundedAt || null,
    rewardApplied: Boolean(match.rewardApplied || match.potPaid || match.payoutApplied),
    settledAt: match.settledAt || match.payoutAppliedAt || null,
    failedAt: match.settlementFailedAt || null,
    failureReason: match.settlementError || null,
  };

  return match.settlementStatus;
}

function markSettlementFailed(match = {}, error, phase = 'settlement') {
  match.settlementStatus = SETTLEMENT_FAILED;
  match.settlementFailedAt = nowIso();
  match.settlementError = error?.message || String(error || 'Unknown settlement error');
  match.settlementPhase = phase;
  syncSettlementFields(match);
  return match;
}

async function listWalletTransactionsFor(userId, { referenceId = null, types = [] } = {}) {
  if (!store.listTransactions) return [];
  const wantedTypes = Array.isArray(types) ? types.filter(Boolean) : [types].filter(Boolean);
  const rows = [];

  if (wantedTypes.length) {
    for (const type of wantedTypes) {
      const result = await store.listTransactions(userId, { type, limit: 100 });
      rows.push(...(Array.isArray(result) ? result : []));
    }
  } else {
    const result = await store.listTransactions(userId, { limit: 100 });
    rows.push(...(Array.isArray(result) ? result : []));
  }

  return rows.filter((row) => {
    if (!row) return false;
    if (referenceId && String(row.referenceId || '') !== String(referenceId)) return false;
    if (wantedTypes.length && !wantedTypes.includes(row.type)) return false;
    return true;
  });
}

async function hasWalletTransaction(userId, { referenceId = null, types = [] } = {}) {
  const rows = await listWalletTransactionsFor(userId, { referenceId, types });
  return rows.length > 0;
}

function assertMatchCanAcceptGameplayAction(match) {
  if (!match) throw notFound('Match not found');
  const status = String(match.status || '').toLowerCase();
  if (status !== 'active') throw badRequest('Match is not active');
  if (match.settlementStatus === SETTLEMENT_SETTLED || match.settlementStatus === SETTLEMENT_REFUNDED) {
    throw badRequest('Match settlement is already closed');
  }
}

function assertPlayerCanAct(match, userId, { allowForfeit = false } = {}) {
  const player = (match.players || []).find((item) => item.id === userId || item.userId === userId);
  if (!player) throw forbidden('You are not a player in this match');

  const stack = playerStack(player, matchStartingStack(match));
  const belowMinimum = isBelowMinimumPlayableStack(match, player, stack);
  if (belowMinimum) markPlayerEliminated(player, 'below_minimum_bid');

  if (player.eliminated || player.active === false || stack <= 0 || belowMinimum || playerLives(player) <= 0) {
    if (allowForfeit) throw badRequest('Player already forfeited or was eliminated');
    throw forbidden(belowMinimum ? 'Player stack is below the table minimum bid' : 'Eliminated players cannot act in this match');
  }
  return player;
}

function normalizePlatformFeePercent(value, fallback = 0) {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : Number(fallback || 0);
  return Math.max(0, Math.min(100, resolved));
}

function calculatePotFromValues({ buyInAmount = 0, paidPlayerCount = 0, platformFeePercent = 0 } = {}) {
  const buyIn = positiveInt(buyInAmount, 0);
  const paidCount = positiveInt(paidPlayerCount, 0);
  const feePercent = normalizePlatformFeePercent(platformFeePercent, 0);
  const grossPot = buyIn * paidCount;
  const platformFee = Math.min(grossPot, Math.floor((grossPot * feePercent) / 100));
  const netPot = Math.max(0, grossPot - platformFee);

  return {
    currency: 'coins',
    buyInAmount: buyIn,
    paidPlayerCount: paidCount,
    grossPot,
    platformFeePercent: feePercent,
    platformFee,
    netPot,
    winnerPayout: netPot,
    potMode: 'winner_takes_all',
    payoutMode: 'winner_takes_all',
  };
}

function matchBuyInAmount(match = {}) {
  return positiveInt(
    match.buyInAmount
    ?? match.pricing?.buyInAmount
    ?? match.pricing?.entryFee
    ?? match.entryFee
    ?? match.startingStack
    ?? 0,
    0,
  );
}

function matchPlatformFeePercent(match = {}) {
  return normalizePlatformFeePercent(
    match.platformFeePercent
    ?? match.pricing?.platformFeePercent
    ?? match.table?.platformFeePercent
    ?? match.selectedTable?.platformFeePercent
    ?? 0,
    0,
  );
}

function matchPaidPlayerCount(match = {}) {
  return positiveInt(match.paidPlayerCount, humanPlayerIds(match).length);
}

function calculateMatchPot(match = {}) {
  const buyInAmount = matchBuyInAmount(match);
  const paidPlayerCount = matchPaidPlayerCount(match);
  const platformFeePercent = matchPlatformFeePercent(match);
  const computed = calculatePotFromValues({ buyInAmount, paidPlayerCount, platformFeePercent });
  const grossPot = positiveInt(match.grossPot ?? match.pot?.grossPot, computed.grossPot);
  const platformFee = positiveInt(match.platformFee ?? match.pot?.platformFee, Math.min(grossPot, Math.floor((grossPot * platformFeePercent) / 100)));
  const netPot = positiveInt(match.netPot ?? match.pot?.netPot, Math.max(0, grossPot - platformFee));
  const winnerPayout = positiveInt(match.winnerPayout ?? match.pot?.winnerPayout, netPot);
  const potMode = match.potMode || match.pricing?.potMode || match.pot?.potMode || 'winner_takes_all';
  const payoutMode = match.payoutMode || match.pricing?.payoutMode || match.pot?.payoutMode || potMode;

  return {
    currency: 'coins',
    buyInAmount,
    paidPlayerCount,
    grossPot,
    platformFeePercent,
    platformFee,
    netPot,
    winnerPayout,
    potMode,
    payoutMode,
  };
}

function syncPotFields(match = {}) {
  const pot = calculateMatchPot(match);
  match.buyInAmount = pot.buyInAmount;
  match.paidPlayerCount = pot.paidPlayerCount;
  match.grossPot = pot.grossPot;
  match.platformFeePercent = pot.platformFeePercent;
  match.platformFee = pot.platformFee;
  match.netPot = pot.netPot;
  match.winnerPayout = pot.winnerPayout;
  match.winReward = pot.winnerPayout;
  match.potMode = pot.potMode;
  match.payoutMode = pot.payoutMode;
  match.pot = pot;
  match.pricing = {
    ...(match.pricing || {}),
    buyInAmount: pot.buyInAmount,
    entryFee: pot.buyInAmount,
    grossPot: pot.grossPot,
    platformFeePercent: pot.platformFeePercent,
    platformFee: pot.platformFee,
    netPot: pot.netPot,
    winnerPayout: pot.winnerPayout,
    winnerReward: pot.winnerPayout,
    winnerRewardMode: 'pot',
    potMode: pot.potMode,
    payoutMode: pot.payoutMode,
  };

  const pricing = match.pricing || {};
  const table = match.table || match.selectedTable || {};
  const selectedPricing = table.pricing || {};
  const minCoinBet = firstPositiveInt([
    match.minCoinBet,
    match.minBidCoins,
    pricing.minCoinBet,
    pricing.minBidCoins,
    table.minCoinBet,
    selectedPricing.minCoinBet,
  ], Math.max(1, Math.floor(Math.max(1, pot.buyInAmount) / 5)));
  const maxCoinBet = firstPositiveInt([
    match.maxCoinBet,
    match.maxBidCoins,
    pricing.maxCoinBet,
    pricing.maxBidCoins,
    table.maxCoinBet,
    selectedPricing.maxCoinBet,
  ], pot.buyInAmount || matchStartingStack(match));
  const defaultCoinBet = firstPositiveInt([
    match.defaultCoinBet,
    match.defaultBidCoins,
    pricing.defaultCoinBet,
    pricing.defaultBidCoins,
    table.defaultCoinBet,
    selectedPricing.defaultCoinBet,
  ], minCoinBet);
  const step = firstPositiveInt([
    match.bidCoinStep,
    match.coinBidStep,
    pricing.bidCoinStep,
    pricing.coinBidStep,
    table.bidCoinStep,
    selectedPricing.bidCoinStep,
  ], DEFAULT_BID_COIN_STEP);
  const coinBetOptions = Array.isArray(match.coinBetOptions) && match.coinBetOptions.length
    ? match.coinBetOptions
    : (Array.isArray(pricing.coinBetOptions) && pricing.coinBetOptions.length
      ? pricing.coinBetOptions
      : (Array.isArray(table.coinBetOptions) && table.coinBetOptions.length
        ? table.coinBetOptions
        : (Array.isArray(selectedPricing.coinBetOptions) ? selectedPricing.coinBetOptions : [])));

  match.minCoinBet = minCoinBet;
  match.maxCoinBet = maxCoinBet;
  match.defaultCoinBet = defaultCoinBet;
  match.minBidCoins = minCoinBet;
  match.maxBidCoins = maxCoinBet;
  match.defaultBidCoins = defaultCoinBet;
  match.bidCoinStep = step;
  match.coinBetOptions = coinBetOptions;
  match.pricing.minCoinBet = minCoinBet;
  match.pricing.maxCoinBet = maxCoinBet;
  match.pricing.defaultCoinBet = defaultCoinBet;
  match.pricing.minBidCoins = minCoinBet;
  match.pricing.maxBidCoins = maxCoinBet;
  match.pricing.defaultBidCoins = defaultCoinBet;
  match.pricing.bidCoinStep = step;
  match.pricing.coinBetOptions = coinBetOptions;

  return pot;
}

function firstPositiveInt(values = [], fallback = 0) {
  for (const value of values) {
    const parsed = positiveInt(value, 0);
    if (parsed > 0) return parsed;
  }
  return positiveInt(fallback, 0);
}

function applyValidatedRoomStakeOverrides(tableMeta = {}, options = {}) {
  const isValidatedRoomStake = options.privateStakeValidated === true
    || options.customStakeValidated === true
    || options.stakeValidation?.validated === true;
  if (!isValidatedRoomStake) return tableMeta;

  const buyInAmount = firstPositiveInt([
    options.buyInAmount,
    options.entryFee,
    options.pricing?.buyInAmount,
    options.pricing?.entryFee,
  ], tableMeta.buyInAmount || tableMeta.entryFee || 0);
  const startingStack = firstPositiveInt([options.startingStack, options.pricing?.startingStack], buyInAmount);
  const minCoinBet = firstPositiveInt([options.minCoinBet, options.minBidCoins, options.pricing?.minCoinBet, options.pricing?.minBidCoins], tableMeta.minCoinBet || tableMeta.minBidCoins || Math.max(1, Math.floor(Math.max(1, buyInAmount) / 5)));
  const maxCoinBet = Math.max(minCoinBet, firstPositiveInt([options.maxCoinBet, options.maxBidCoins, options.pricing?.maxCoinBet, options.pricing?.maxBidCoins], tableMeta.maxCoinBet || tableMeta.maxBidCoins || buyInAmount));
  const defaultCoinBet = Math.max(minCoinBet, Math.min(maxCoinBet, firstPositiveInt([options.defaultCoinBet, options.defaultBidCoins, options.pricing?.defaultCoinBet, options.pricing?.defaultBidCoins], tableMeta.defaultCoinBet || tableMeta.defaultBidCoins || minCoinBet)));
  const bidCoinStepValue = firstPositiveInt([options.bidCoinStep, options.coinBidStep, options.pricing?.bidCoinStep, options.pricing?.coinBidStep], tableMeta.bidCoinStep || 1);
  const coinBetOptions = Array.isArray(options.coinBetOptions) && options.coinBetOptions.length
    ? options.coinBetOptions
    : (Array.isArray(options.pricing?.coinBetOptions) ? options.pricing.coinBetOptions : tableMeta.coinBetOptions);
  const platformFeePercent = normalizePlatformFeePercent(options.platformFeePercent ?? options.pricing?.platformFeePercent ?? tableMeta.platformFeePercent ?? 0, 0);

  const pricing = {
    ...(tableMeta.pricing || {}),
    ...(options.pricing || {}),
    buyInAmount,
    entryFee: buyInAmount,
    startingStack,
    minBuyIn: positiveInt(options.minBuyIn ?? options.pricing?.minBuyIn ?? tableMeta.minBuyIn, buyInAmount),
    maxBuyIn: positiveInt(options.maxBuyIn ?? options.pricing?.maxBuyIn ?? tableMeta.maxBuyIn, buyInAmount),
    minCoinBet,
    maxCoinBet,
    defaultCoinBet,
    minBidCoins: minCoinBet,
    maxBidCoins: maxCoinBet,
    defaultBidCoins: defaultCoinBet,
    bidCoinStep: bidCoinStepValue,
    coinBetOptions,
    platformFeePercent,
    potMode: options.potMode || options.pricing?.potMode || tableMeta.potMode || 'winner_takes_all',
    payoutMode: options.payoutMode || options.pricing?.payoutMode || tableMeta.payoutMode || tableMeta.potMode || 'winner_takes_all',
    lossCondition: options.lossCondition || options.pricing?.lossCondition || tableMeta.lossCondition || 'stack_zero',
    winnerRewardMode: 'pot',
  };

  const selectedTable = {
    ...(tableMeta.selectedTable || tableMeta.table || {}),
    ...(options.selectedTable || options.table || {}),
    buyInAmount,
    entryFee: buyInAmount,
    startingStack,
    minBuyIn: pricing.minBuyIn,
    maxBuyIn: pricing.maxBuyIn,
    minCoinBet,
    maxCoinBet,
    defaultCoinBet,
    minBidCoins: minCoinBet,
    maxBidCoins: maxCoinBet,
    defaultBidCoins: defaultCoinBet,
    bidCoinStep: bidCoinStepValue,
    coinBetOptions,
    platformFeePercent,
    potMode: pricing.potMode,
    payoutMode: pricing.payoutMode,
    lossCondition: pricing.lossCondition,
    winnerRewardMode: 'pot',
    pricing,
  };

  return {
    ...tableMeta,
    buyInAmount,
    entryFee: buyInAmount,
    startingStack,
    minBuyIn: pricing.minBuyIn,
    maxBuyIn: pricing.maxBuyIn,
    minCoinBet,
    maxCoinBet,
    defaultCoinBet,
    minBidCoins: minCoinBet,
    maxBidCoins: maxCoinBet,
    defaultBidCoins: defaultCoinBet,
    bidCoinStep: bidCoinStepValue,
    coinBetOptions,
    platformFeePercent,
    potMode: pricing.potMode,
    payoutMode: pricing.payoutMode,
    lossCondition: pricing.lossCondition,
    winnerRewardMode: 'pot',
    pricing,
    table: selectedTable,
    selectedTable,
  };
}

function nullablePositiveInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function bidCoinAmountValue(bid = {}) {
  if (!bid || typeof bid !== 'object') return null;

  return nullablePositiveInt(
    bid.coinAmount
    ?? bid.bidAmount
    ?? bid.amount
    ?? bid.coins
    ?? bid.betAmount
    ?? bid.stakeAmount
    ?? bid.stake
  );
}

function bidCoinStep(match = {}) {
  return Math.max(1, firstPositiveInt([
    match.bidCoinStep,
    match.coinBidStep,
    match.pricing?.bidCoinStep,
    match.pricing?.coinBidStep,
    match.table?.bidCoinStep,
    match.table?.pricing?.bidCoinStep,
    match.selectedTable?.bidCoinStep,
    match.selectedTable?.pricing?.bidCoinStep,
    match.gameRules?.bidCoinStep,
    match.gameRules?.coinBidStep,
  ], DEFAULT_BID_COIN_STEP));
}

function minimumBidCoins(match = {}) {
  return Math.max(1, firstPositiveInt([
    match.minCoinBet,
    match.minBidCoins,
    match.minBidAmount,
    match.minimumBidCoins,
    match.pricing?.minCoinBet,
    match.pricing?.minBidCoins,
    match.pricing?.minBidAmount,
    match.pricing?.minimumBidCoins,
    match.table?.minCoinBet,
    match.table?.pricing?.minCoinBet,
    match.selectedTable?.minCoinBet,
    match.selectedTable?.pricing?.minCoinBet,
    match.gameRules?.minCoinBet,
    match.gameRules?.minBidCoins,
    match.gameRules?.minBidAmount,
  ], DEFAULT_MIN_BID_COINS));
}

function maximumBidCoins(match = {}, player = null) {
  const stack = player ? playerStack(player, matchStartingStack(match)) : matchStartingStack(match);
  const configured = firstPositiveInt([
    match.maxCoinBet,
    match.maxBidCoins,
    match.maxBidAmount,
    match.maximumBidCoins,
    match.pricing?.maxCoinBet,
    match.pricing?.maxBidCoins,
    match.pricing?.maxBidAmount,
    match.pricing?.maximumBidCoins,
    match.table?.maxCoinBet,
    match.table?.pricing?.maxCoinBet,
    match.selectedTable?.maxCoinBet,
    match.selectedTable?.pricing?.maxCoinBet,
    match.gameRules?.maxCoinBet,
    match.gameRules?.maxBidCoins,
    match.gameRules?.maxBidAmount,
  ], stack);
  const cap = configured > 0 ? Math.min(configured, stack) : stack;
  return Math.max(0, cap);
}

function normalizeCoinBid(bid = {}) {
  const amount = bidCoinAmountValue(bid);
  return {
    ...bid,
    coinAmount: amount,
    bidAmount: amount,
    amount,
    coins: amount,
    currency: 'coins',
  };
}

function getBidCoinLimits(match = {}, player = null) {
  const minCoinAmount = minimumBidCoins(match);
  const coinStep = bidCoinStep(match);
  const currentBidAmount = bidCoinAmountValue(match.currentBid) || 0;
  const nextMinCoinAmount = match.currentBid
    ? Math.max(minCoinAmount, currentBidAmount)
    : minCoinAmount;
  const maxCoinAmount = maximumBidCoins(match, player);

  return {
    currency: 'coins',
    minCoinAmount,
    coinStep,
    currentBidAmount,
    nextMinCoinAmount,
    maxCoinAmount,
    canAffordNextBid: maxCoinAmount >= nextMinCoinAmount,
    requiresHigherDiceClaim: true,
    allowSameDiceClaimWithHigherCoins: false,
    requiresCoinBetAtLeastCurrent: true,
  };
}

function compareDiceClaim(current = {}, quantity, face) {
  const currentQuantity = Number(current.quantity || 0);
  const currentFace = Number(current.face || 0);
  const nextQuantity = Number(quantity || 0);
  const nextFace = Number(face || 0);

  if (nextQuantity > currentQuantity) return 1;
  if (nextQuantity < currentQuantity) return -1;
  if (nextFace > currentFace) return 1;
  if (nextFace < currentFace) return -1;
  return 0;
}

function diceClaimIsHigherThanCurrent(current = {}, quantity, face) {
  return compareDiceClaim(current, quantity, face) > 0;
}

function diceClaimIsLowerThanCurrent(current = {}, quantity, face) {
  return compareDiceClaim(current, quantity, face) < 0;
}

function publicBid(bid = null) {
  if (!bid) return null;
  return normalizeCoinBid(bid);
}

function publicPot(match = {}) {
  const pot = calculateMatchPot(match);
  return {
    currency: pot.currency || 'coins',
    buyInAmount: pot.buyInAmount,
    entryFee: pot.buyInAmount,
    paidPlayerCount: pot.paidPlayerCount,
    grossPot: pot.grossPot,
    tablePot: pot.grossPot,
    totalPot: pot.grossPot,
    currentPot: pot.grossPot,
    platformFeePercent: pot.platformFeePercent,
    platformFee: pot.platformFee,
    netPot: pot.netPot,
    winnerPayout: pot.winnerPayout,
    potMode: pot.potMode,
    payoutMode: pot.payoutMode,
  };
}

function buildGameplayEconomyPayload(match = {}) {
  const pot = publicPot(match);
  const currentBid = publicBid(match.currentBid);
  const previousBid = publicBid(match.previousBid);
  const firstBid = publicBid(match.firstBid);
  const currentCoinBet = bidCoinAmountValue(match.currentBid) || 0;
  const previousCoinBet = bidCoinAmountValue(match.previousBid) || 0;
  const firstCoinBet = bidCoinAmountValue(match.firstBid) || 0;

  return {
    currency: 'coins',
    buyInAmount: pot.buyInAmount,
    entryFee: pot.buyInAmount,
    paidPlayerCount: pot.paidPlayerCount,
    minCoinBet: minimumBidCoins(match),
    maxCoinBet: maximumBidCoins(match),
    defaultCoinBet: firstPositiveInt([
      match.defaultCoinBet,
      match.defaultBidCoins,
      match.pricing?.defaultCoinBet,
      match.pricing?.defaultBidCoins,
    ], minimumBidCoins(match)),
    bidCoinStep: bidCoinStep(match),
    coinBetOptions: Array.isArray(match.coinBetOptions)
      ? match.coinBetOptions
      : (Array.isArray(match.pricing?.coinBetOptions) ? match.pricing.coinBetOptions : []),
    pot,
    grossPot: pot.grossPot,
    tablePot: pot.tablePot,
    totalPot: pot.totalPot,
    currentPot: pot.currentPot,
    platformFeePercent: pot.platformFeePercent,
    platformFee: pot.platformFee,
    netPot: pot.netPot,
    winnerPayout: pot.winnerPayout,
    potMode: pot.potMode,
    payoutMode: pot.payoutMode,
    currentBid,
    previousBid,
    firstBid,
    currentCoinBet,
    currentBidCoinBet: currentCoinBet,
    currentBet: currentCoinBet,
    coinBet: currentCoinBet,
    previousCoinBet,
    firstCoinBet,
    coinBidEnabled: true,
    stackMode: true,
  };
}

function playerLives(player = {}) {
  if (player?.eliminated) return 0;
  const dice = Array.isArray(player.dice) ? player.dice : [];
  const lives = Number(player.lives ?? player.diceCount ?? dice.length ?? FIXED_DICE_PER_ROUND);
  return Math.max(0, Number.isFinite(lives) ? Math.trunc(lives) : FIXED_DICE_PER_ROUND);
}

function isActiveContestant(player, match = {}) {
  if (!player || player.eliminated || player.active === false) return false;
  const stack = playerStack(player, matchStartingStack(match));
  return stack >= minimumPlayableStack(match);
}

function activePlayers(match) {
  return (match.players || []).filter((player) => isActiveContestant(player, match));
}

function nextActiveIndex(match, fromIndex = match.turnIndex) {
  const players = Array.isArray(match.players) ? match.players : [];
  if (!players.length) return -1;

  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (Number(fromIndex || 0) + offset + players.length) % players.length;
    if (isActiveContestant(players[index], match)) return index;
  }

  return -1;
}

function getActivePlayer(match) {
  const players = Array.isArray(match.players) ? match.players : [];
  if (!players.length) return null;

  const safeTurnIndex = Math.max(0, Math.min(Number(match.turnIndex || 0), players.length - 1));
  if (isActiveContestant(players[safeTurnIndex], match)) return players[safeTurnIndex];

  const fallbackIndex = nextActiveIndex(match, safeTurnIndex - 1);
  return fallbackIndex >= 0 ? players[fallbackIndex] : null;
}

function isBotId(playerId) {
  return String(playerId || '').startsWith('bot_');
}

function isHumanPlayer(player) {
  return player && !player.isBot && !isBotId(player.id);
}

function humanPlayerIds(match) {
  return Array.from(new Set((match.players || []).filter(isHumanPlayer).map((player) => player.id)));
}

function getNextHumanOpponent(match, actingUserId) {
  const players = Array.isArray(match.players) ? match.players : [];
  if (!players.length) return null;

  const startIndex = Math.max(0, Number(match.turnIndex || 0));
  for (let offset = 1; offset <= players.length; offset += 1) {
    const player = players[(startIndex + offset) % players.length];
    if (isHumanPlayer(player) && player.id !== actingUserId) return player;
  }

  return players.find((player) => isHumanPlayer(player) && player.id !== actingUserId) || null;
}

function tableSummary(match) {
  const selectedTable = match.selectedTable || match.table || null;
  const pot = calculateMatchPot(match);
  return {
    tableId: match.tableId || match.selectedTableId || selectedTable?.tableId || selectedTable?.id || 'unknown',
    selectedTableId: match.selectedTableId || match.tableId || selectedTable?.selectedTableId || selectedTable?.tableId || selectedTable?.id || 'unknown',
    tableKey: match.tableKey || selectedTable?.tableKey || selectedTable?.key || null,
    tableName: match.tableName || match.selectedTableName || selectedTable?.tableName || selectedTable?.name || 'Unknown Table',
    selectedTableName: match.selectedTableName || match.tableName || selectedTable?.selectedTableName || selectedTable?.tableName || selectedTable?.name || 'Unknown Table',
    tableTitle: match.tableTitle || selectedTable?.tableTitle || selectedTable?.title || null,
    tableTier: match.tableTier || match.selectedTableTier || selectedTable?.tableTier || selectedTable?.tier || null,
    selectedTableTier: match.selectedTableTier || match.tableTier || selectedTable?.selectedTableTier || selectedTable?.tableTier || selectedTable?.tier || null,
    tableType: match.tableType || selectedTable?.tableType || selectedTable?.type || null,
    table: selectedTable,
    pricing: {
      ...(match.pricing || {}),
      buyInAmount: pot.buyInAmount,
      entryFee: pot.buyInAmount,
      grossPot: pot.grossPot,
      platformFeePercent: pot.platformFeePercent,
      platformFee: pot.platformFee,
      netPot: pot.netPot,
      winnerPayout: pot.winnerPayout,
      winnerReward: pot.winnerPayout,
      winnerRewardMode: 'pot',
      potMode: pot.potMode,
      payoutMode: pot.payoutMode,
    },
    rewards: {
      winnerReward: pot.winnerPayout,
      winnerPayout: pot.winnerPayout,
      winnerRewardMode: 'pot',
      xpWin: Number(match.xpWin || match.xpRewards?.xpWin || 0),
      xpLose: Number(match.xpLose || match.xpRewards?.xpLose || 0),
    },
    pot,
  };
}

function resultTableFields(match) {
  const summary = tableSummary(match);
  return {
    tableId: summary.tableId,
    selectedTableId: summary.selectedTableId,
    tableKey: summary.tableKey,
    tableName: summary.tableName,
    selectedTableName: summary.selectedTableName,
    tableTitle: summary.tableTitle,
    tableTier: summary.tableTier,
    selectedTableTier: summary.selectedTableTier,
    tableType: summary.tableType,
    table: summary.table,
    pricing: summary.pricing,
    rewards: summary.rewards,
    pot: summary.pot,
    buyInAmount: summary.pot.buyInAmount,
    grossPot: summary.pot.grossPot,
    platformFeePercent: summary.pot.platformFeePercent,
    platformFee: summary.pot.platformFee,
    netPot: summary.pot.netPot,
    winnerPayout: summary.pot.winnerPayout,
  };
}

function totalExactFaceCount(match, face) {
  return activePlayers(match).reduce((total, player) => {
    const dice = Array.isArray(player.dice) ? player.dice : [];
    return total + dice.filter((value) => Number(value) === Number(face)).length;
  }, 0);
}

function getFirstBidFace(match) {
  const face = Number(match?.firstBidFace ?? match?.firstBid?.face);
  return Number.isInteger(face) && face >= 1 && face <= 6 ? face : null;
}

function getOnesWereCalledThisRound(match) {
  return Boolean(
    match?.onesWereCalledThisRound
    || match?.onesCalledThisRound
    || (Array.isArray(match?.actionLog) && match.actionLog.some((entry) => Number(entry?.bid?.face) === 1 && Number(entry?.roundNumber || entry?.bid?.roundNumber || match.roundNumber) === Number(match.roundNumber || 1)))
  );
}

function markOnesCalledIfNeeded(match, bid) {
  if (Number(bid?.face) !== 1) return match;
  match.onesWereCalledThisRound = true;
  match.onesCalledThisRound = true;
  match.onesCalledAtBid = { ...bid };
  match.onesCalledRoundNumber = Math.max(1, Number(match.roundNumber || 1));
  return match;
}

function shouldCountOnesAsWild(match, face) {
  const targetFace = Number(face);
  if (!match?.gameRules?.wildDice) return false;
  if (targetFace === 1) return false;
  return !getOnesWereCalledThisRound(match);
}

function countBidFace(match, face) {
  const targetFace = Number(face);
  const exactCount = totalExactFaceCount(match, targetFace);
  const onesWereCalledThisRound = getOnesWereCalledThisRound(match);
  const wildOnesCount = shouldCountOnesAsWild(match, targetFace) ? totalExactFaceCount(match, 1) : 0;

  return {
    actualCount: exactCount + wildOnesCount,
    exactCount,
    wildOnesCount,
    onesCountAsWild: wildOnesCount > 0,
    onesWereCalledThisRound,
    onesAreWildThisBid: wildOnesCount > 0 || (Boolean(match?.gameRules?.wildDice) && targetFace !== 1 && !onesWereCalledThisRound),
    wildDice: Boolean(match?.gameRules?.wildDice),
    firstBidFace: getFirstBidFace(match),
  };
}

function totalDiceInPlay(match) {
  return activePlayers(match).reduce((sum, player) => sum + playerLives(player), 0);
}

function avatarValue(user = {}) {
  return normalizeProfileAvatar(user.avatar || user.avatarId || user.profileAvatar || user.profile?.avatar || user.eventAvatar, defaultProfileAvatar);
}

function avatarUrlValue(user = {}) {
  return normalizeProfileAvatar(user.avatarUrl || user.profile?.avatarUrl || user.imageUrl || user.photoUrl || avatarValue(user), defaultProfileAvatar);
}

function buildPlayerProfilePayload(user = {}) {
  const username = user.username || user.displayName || 'Player';
  const displayName = user.displayName || username;
  const avatar = avatarValue(user);
  const avatarUrl = avatarUrlValue(user);

  return {
    userId: user.id,
    playerId: user.id,
    username,
    displayName,
    name: displayName,
    avatar,
    avatarId: user.avatarId || avatar,
    avatarUrl,
    eventAvatar: user.eventAvatar || avatar,
    title: user.title || null,
    level: Number(user.level || 1),
    xp: Number(user.xp || 0),
    rankProgress: Number(user.rankProgress || 0),
    isGuest: Boolean(user.isGuest),
  };
}

function normalizePlayerRuntime(player, match = null) {
  if (!player) return player;

  const runtimeMatch = match || {};
  const startingStack = matchStartingStack(runtimeMatch, player.startingStack ?? player.stack ?? player.currentStack ?? 0);
  const normalizedStack = playerStack(player, startingStack);
  const belowMinimum = isBelowMinimumPlayableStack(runtimeMatch, player, normalizedStack);
  const eliminated = Boolean(player.eliminated) || normalizedStack <= 0 || belowMinimum;

  player.startingStack = stackValue(player.startingStack, startingStack);
  player.stack = normalizedStack;
  player.currentStack = player.stack;
  player.matchStack = player.stack;
  player.coinsStack = player.stack;
  player.stackLost = Math.max(0, Number(player.stackLost || player.startingStack - player.stack || 0));

  player.lives = eliminated ? 0 : FIXED_DICE_PER_ROUND;
  player.diceCount = eliminated ? 0 : FIXED_DICE_PER_ROUND;
  player.eliminated = eliminated;
  player.active = !eliminated;
  if (belowMinimum) {
    player.bustedBelowMinimumBid = true;
    player.eliminationReason = player.eliminationReason || 'below_minimum_bid';
    player.eliminatedAt = player.eliminatedAt || nowIso();
  }

  const dice = Array.isArray(player.dice) ? player.dice : [];
  if (player.eliminated) {
    player.dice = [];
  } else if (dice.length !== FIXED_DICE_PER_ROUND) {
    player.dice = rollDice(FIXED_DICE_PER_ROUND);
  }

  player.usedRerollThisRound = Boolean(player.usedRerollThisRound);
  player.rerollsUsedThisRound = Number(player.rerollsUsedThisRound || (player.usedRerollThisRound ? 1 : 0));
  return player;
}

function normalizeMatchRuntime(match) {
  if (!match) return match;
  const startingStack = matchStartingStack(match, Number(match.entryFee || 0));
  match.startingStack = startingStack;
  match.stackMode = true;
  match.dicePerRound = FIXED_DICE_PER_ROUND;
  match.players = Array.isArray(match.players) ? match.players.map((player) => normalizePlayerRuntime(player, match)) : [];
  syncPotFields(match);
  syncSettlementFields(match);
  match.roundNumber = Math.max(1, Number(match.roundNumber || 1));
  match.bidStyle = normalizeBidStyle();
  match.startingDice = FIXED_DICE_PER_ROUND;
  match.startingCups = FIXED_DICE_PER_ROUND;
  match.firstBidFace = getFirstBidFace(match);
  match.onesWereCalledThisRound = Boolean(match.onesWereCalledThisRound || match.onesCalledThisRound);
  match.onesCalledThisRound = Boolean(match.onesCalledThisRound || match.onesWereCalledThisRound);
  match.gameRules = normalizeGameRules(match.gameRules, {
    bidStyle: match.bidStyle,
    wildDice: match.gameRules?.wildDice,
    advancedRules: match.gameRules?.advancedRules,
    rulesMode: match.gameRules?.mode,
    botsEnabled: match.botsEnabled,
  });
  match.bidStyle = OFFICIAL_BID_STYLE;

  if (match.status === 'active' && !match.turnDeadlineAt) setTurnTimer(match);

  const activeIndex = getActivePlayer(match) ? match.players.findIndex((player) => player.id === getActivePlayer(match).id) : -1;
  if (activeIndex >= 0) match.turnIndex = activeIndex;
  return match;
}

function playerCanAct(match, viewerId) {
  const activePlayer = getActivePlayer(match);
  return Boolean(activePlayer && activePlayer.id === viewerId && match.status === 'active');
}

function availableActionsFor(match, viewerId) {
  if (!playerCanAct(match, viewerId)) return [];

  const actions = match.currentBid ? ['raise_bid', 'bid'] : ['bid'];

  if (match.currentBid && match.currentBid.playerId !== viewerId) {
    actions.push('call_liar', 'challenge');
  }

  return actions;
}

function sanitizePlayer(player, viewerId, match = {}) {
  const isViewer = player.id === viewerId || player.userId === viewerId;
  const dice = Array.isArray(player.dice) ? player.dice : [];
  const stack = playerStack(player, matchStartingStack(match));
  const lives = playerLives(player);
  const eliminated = isPlayerEliminatedByStack(match, player);

  return {
    id: player.id,
    userId: player.userId || player.id,
    playerId: player.playerId || player.userId || player.id,
    username: player.username,
    displayName: player.displayName || player.username,
    name: player.name || player.displayName || player.username,
    avatar: player.avatar || player.avatarId || null,
    avatarId: player.avatarId || player.avatar || null,
    avatarUrl: player.avatarUrl || player.avatar || player.avatarId || null,
    eventAvatar: player.eventAvatar || player.avatar || null,
    title: player.title || null,
    level: Number(player.level || 1),
    xp: Number(player.xp || 0),
    rankProgress: Number(player.rankProgress || 0),
    isGuest: Boolean(player.isGuest),
    isBot: Boolean(player.isBot),
    stack,
    currentStack: stack,
    matchStack: stack,
    coinsStack: stack,
    startingStack: stackValue(player.startingStack, stack),
    stackLost: Math.max(0, Number(player.stackLost || 0)),
    diceCount: eliminated ? 0 : FIXED_DICE_PER_ROUND,
    dice: isViewer || player.revealed ? dice : [],
    revealed: Boolean(player.revealed),
    usedRerollThisRound: Boolean(player.usedRerollThisRound),
    rerollsUsedThisRound: Number(player.rerollsUsedThisRound || 0),
    lives,
    eliminated,
    active: false,
    minPlayableStack: minimumPlayableStack(match),
    minBidCoins: minimumBidCoins(match),
    bustedBelowMinimumBid: Boolean(player.bustedBelowMinimumBid || isBelowMinimumPlayableStack(match, player, stack)),
    eliminationReason: player.eliminationReason || (isBelowMinimumPlayableStack(match, player, stack) ? 'below_minimum_bid' : null),
  };
}

function buildBidControls(match, viewerId, activePlayer = getActivePlayer(match)) {
  const viewerPlayer = (match.players || []).find((player) => player.id === viewerId || player.userId === viewerId) || null;
  const activeLimits = getBidCoinLimits(match, activePlayer);
  const viewerLimits = getBidCoinLimits(match, viewerPlayer || activePlayer);
  const totalDice = Math.max(1, totalDiceInPlay(match));

  return {
    currency: 'coins',
    requiresCoinAmount: true,
    allowSameDiceClaimWithHigherCoins: false,
    requiresHigherDiceClaim: true,
    quantityMin: 1,
    quantityMax: totalDice,
    faceMin: 1,
    faceMax: 6,
    minCoinAmount: activeLimits.minCoinAmount,
    nextMinCoinAmount: activeLimits.nextMinCoinAmount,
    maxCoinAmount: activeLimits.maxCoinAmount,
    minCoinBet: activeLimits.minCoinAmount,
    currentCoinBet: activeLimits.currentBidAmount,
    maxCoinBet: activeLimits.maxCoinAmount,
    coinBetOptions: Array.isArray(match.coinBetOptions)
      ? match.coinBetOptions
      : (Array.isArray(match.pricing?.coinBetOptions) ? match.pricing.coinBetOptions : []),
    viewerMaxCoinAmount: viewerLimits.maxCoinAmount,
    coinStep: activeLimits.coinStep,
    currentBidAmount: activeLimits.currentBidAmount,
    canAffordNextBid: activeLimits.canAffordNextBid,
    activePlayerStack: activePlayer ? playerStack(activePlayer, matchStartingStack(match)) : 0,
    viewerStack: viewerPlayer ? playerStack(viewerPlayer, matchStartingStack(match)) : 0,
  };
}

function publicMatch(match, viewerId) {
  normalizeMatchRuntime(match);
  const activePlayer = getActivePlayer(match);
  const activePlayerId = activePlayer?.id || null;
  const availableActions = availableActionsFor(match, viewerId);
  const supportedActions = ['bid', 'raise_bid', 'call_liar', 'challenge'];
  const economyPayload = buildGameplayEconomyPayload(match);

  return {
    ...match,
    players: match.players.map((player) => ({
      ...sanitizePlayer(player, viewerId, match),
      active: player.id === activePlayerId,
      canAct: player.id === viewerId && playerCanAct(match, viewerId),
    })),
    requiredPlayers: Number(match.requiredPlayers || match.maxPlayers || match.players.length || 2),
    maxPlayers: Number(match.maxPlayers || match.requiredPlayers || match.players.length || 2),
    selectedPlayers: Number(match.selectedPlayers || match.maxPlayers || match.requiredPlayers || match.players.length || 2),
    playersCount: Number(match.playersCount || match.maxPlayers || match.requiredPlayers || match.players.length || 2),
    playerCount: match.players.length,
    activePlayerId,
    turnPlayerId: activePlayerId,
    turnPlayer: activePlayer ? sanitizePlayer(activePlayer, viewerId, match) : null,
    myTurn: activePlayerId === viewerId && match.status === 'active',
    canAct: playerCanAct(match, viewerId),
    availableActions,
    supportedActions,
    disabledActions: supportedActions.filter((action) => !availableActions.includes(action)),
    settlementStatus: match.settlementStatus || SETTLEMENT_PENDING,
    settlement: match.settlement || null,
    entryFeesCharged: Boolean(match.entryFeesCharged || match.buyInsCharged),
    entryFeesRefunded: Boolean(match.entryFeesRefunded),
    rewardApplied: Boolean(match.rewardApplied),
    ...economyPayload,
    bidControls: buildBidControls(match, viewerId, activePlayer),
    bidRules: buildBidControls(match, viewerId, activePlayer),
    coinBidEnabled: true,
    totalDiceInPlay: totalDiceInPlay(match),
    dicePerRound: FIXED_DICE_PER_ROUND,
    fixedDicePerRound: true,
    startingStack: matchStartingStack(match),
    activePlayersCount: activePlayers(match).length,
    totalStackInPlay: activePlayers(match).reduce((sum, player) => sum + playerStack(player), 0),
    roundNumber: Math.max(1, Number(match.roundNumber || 1)),
    turnStartedAt: match.turnStartedAt || null,
    turnDeadlineAt: match.turnDeadlineAt || null,
    turnTimeRemainingMs: getTurnTimeRemainingMs(match),
    matchStartDelayMs: Number(match.matchStartDelayMs || 0),
    countdownStartedAt: match.countdownStartedAt || null,
    startsAt: match.startsAt || null,
    matchStartRemainingMs: getMatchStartRemainingMs(match),
    serverTime: nowIso(),
    roundResult: match.roundResult || null,
    lastRoundResult: match.lastRoundResult || match.roundResult || null,
    gameRules: match.gameRules,
    result: match.result || null,
  };
}

function buildHumanPlayer(user, diceCount, startingStack = 0) {
  return {
    id: user.id,
    ...buildPlayerProfilePayload(user),
    isBot: false,
    dice: rollDice(FIXED_DICE_PER_ROUND),
    diceCount: FIXED_DICE_PER_ROUND,
    lives: FIXED_DICE_PER_ROUND,
    startingStack: stackValue(startingStack),
    stack: stackValue(startingStack),
    currentStack: stackValue(startingStack),
    matchStack: stackValue(startingStack),
    coinsStack: stackValue(startingStack),
    stackLost: 0,
    active: true,
    eliminated: false,
    revealed: false,
    usedRerollThisRound: false,
    rerollsUsedThisRound: 0,
  };
}

function buildBotPlayer(index, diceCount, usedNames = [], startingStack = 0) {
  const profile = buildBotProfile(index, usedNames);
  return {
    ...profile,
    dice: rollDice(FIXED_DICE_PER_ROUND),
    diceCount: FIXED_DICE_PER_ROUND,
    lives: FIXED_DICE_PER_ROUND,
    startingStack: stackValue(startingStack),
    stack: stackValue(startingStack),
    currentStack: stackValue(startingStack),
    matchStack: stackValue(startingStack),
    coinsStack: stackValue(startingStack),
    stackLost: 0,
    active: true,
    eliminated: false,
    revealed: false,
    usedRerollThisRound: false,
    rerollsUsedThisRound: 0,
    botState: {
      difficulty: 'normal',
      canSeeHiddenDice: false,
      strategy: 'basic',
    },
  };
}

function extractBid(action = {}) {
  const source = action.bid || action.payload || action;
  const coinAmount = source.coinAmount
    ?? source.bidAmount
    ?? source.amount
    ?? source.coins
    ?? source.betAmount
    ?? source.stakeAmount
    ?? source.stake;

  return {
    quantity: source.quantity ?? source.count ?? source.diceCount,
    face: source.face ?? source.value ?? source.diceValue,
    coinAmount,
    bidAmount: coinAmount,
    amount: coinAmount,
    coins: coinAmount,
  };
}

function assertPlayerTurn(match, userId) {
  const active = getActivePlayer(match);
  if (!active || active.id !== userId) throw forbidden('It is not your turn');
}

function assertPlayerInMatch(match, userId) {
  const exists = match.players.some((player) => player.id === userId);
  if (!exists) throw forbidden('You are not a player in this match');
}

function assertBidIsValid(match, rawBid, options = {}) {
  const quantity = Number(rawBid.quantity);
  const face = Number(rawBid.face);
  const activePlayer = getActivePlayer(match);
  const amount = bidCoinAmountValue(rawBid);
  const limits = getBidCoinLimits(match, activePlayer);

  if (!Number.isInteger(quantity) || quantity < 1) throw badRequest('Bid quantity must be a positive integer');
  if (!Number.isInteger(face) || face < 1 || face > 6) throw badRequest('Bid face must be between 1 and 6');
  if (quantity > Math.max(1, totalDiceInPlay(match))) throw badRequest('Bid quantity cannot be higher than total dice in play');
  if (amount === null) throw badRequest('Bid coin amount is required');
  if (amount < limits.minCoinAmount) throw badRequest(`Bid coin amount must be at least ${limits.minCoinAmount}`);
  if (amount > limits.maxCoinAmount) throw forbidden('Bid coin amount cannot be higher than player stack');

  if (match.currentBid) {
    const current = match.currentBid;
    const currentAmount = bidCoinAmountValue(current) || 0;

    if (!diceClaimIsHigherThanCurrent(current, quantity, face)) {
      throw badRequest('Dice bid must be higher than the current bid');
    }

    if (amount < currentAmount) {
      throw badRequest('Bid coin amount cannot be lower than the current bid');
    }
  }

  return normalizeCoinBid({ quantity, face, coinAmount: amount });
}

function pushLog(match, entry) {
  match.actionLog = Array.isArray(match.actionLog) ? match.actionLog : [];
  match.actionLog.push({ at: nowIso(), ...entry });
  match.updatedAt = nowIso();
}

function nextBid(match) {
  const activePlayer = getActivePlayer(match);
  const limits = getBidCoinLimits(match, activePlayer);
  if (limits.nextMinCoinAmount > limits.maxCoinAmount) return null;

  if (!match.currentBid) {
    return normalizeCoinBid({ quantity: 1, face: rollDie(), coinAmount: limits.nextMinCoinAmount });
  }

  const totalDice = Math.max(1, totalDiceInPlay(match));
  const current = match.currentBid;
  if (current.face < 6) return normalizeCoinBid({ quantity: current.quantity, face: current.face + 1, coinAmount: limits.nextMinCoinAmount });
  if (Number(current.quantity || 0) < totalDice) return normalizeCoinBid({ quantity: Number(current.quantity || 0) + 1, face: 1, coinAmount: limits.nextMinCoinAmount });
  return null;
}

function diceFaceCounts(dice = []) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const value of dice || []) {
    const face = Number(value);
    if (face >= 1 && face <= 6) counts[face] += 1;
  }
  return counts;
}

function legalBidAfter(match, preferred = {}) {
  const activePlayer = getActivePlayer(match);
  const limits = getBidCoinLimits(match, activePlayer);
  if (limits.nextMinCoinAmount > limits.maxCoinAmount) return null;

  const totalDice = Math.max(1, totalDiceInPlay(match));
  const preferredFace = clampInt(preferred.face, rollDie(), 1, 6);
  const preferredQuantity = clampInt(preferred.quantity, 1, 1, totalDice);
  const preferredAmount = bidCoinAmountValue(preferred) ?? limits.nextMinCoinAmount;
  const coinAmount = Math.max(limits.nextMinCoinAmount, Math.min(preferredAmount, limits.maxCoinAmount));

  if (!match.currentBid) {
    return normalizeCoinBid({ quantity: preferredQuantity, face: preferredFace, coinAmount });
  }

  const current = match.currentBid;
  if (diceClaimIsHigherThanCurrent(current, preferredQuantity, preferredFace)) {
    return normalizeCoinBid({ quantity: preferredQuantity, face: preferredFace, coinAmount });
  }

  if (current.face < 6) return normalizeCoinBid({ quantity: current.quantity, face: current.face + 1, coinAmount });
  if (current.quantity < totalDice) return normalizeCoinBid({ quantity: current.quantity + 1, face: preferredFace, coinAmount });
  return null;
}


function timeoutAutoRaiseFailureReason(match) {
  const activePlayer = getActivePlayer(match);
  if (!activePlayer) return 'no_active_player_for_timeout_auto_raise';

  const limits = getBidCoinLimits(match, activePlayer);
  if (!match.currentBid) {
    return limits.minCoinAmount > limits.maxCoinAmount
      ? 'insufficient_stack_for_timeout_minimum_bid'
      : null;
  }

  const totalDice = Math.max(1, totalDiceInPlay(match));
  const current = normalizeCoinBid(match.currentBid);
  const currentAmount = bidCoinAmountValue(current) || limits.minCoinAmount;
  if (currentAmount > limits.maxCoinAmount) return 'insufficient_stack_for_timeout_auto_raise';
  if (Number(current.quantity || 1) >= totalDice) return 'maximum_dice_quantity_reached';
  return null;
}

function autoRaiseBidForTimeout(match) {
  const activePlayer = getActivePlayer(match);
  if (!activePlayer) return null;

  const limits = getBidCoinLimits(match, activePlayer);

  if (!match.currentBid) {
    if (limits.minCoinAmount > limits.maxCoinAmount) return null;
    const dice = Array.isArray(activePlayer.dice) ? activePlayer.dice : [];
    const face = dice.length ? dice[0] : rollDie();
    return normalizeCoinBid({ quantity: 1, face, coinAmount: limits.minCoinAmount });
  }

  const totalDice = Math.max(1, totalDiceInPlay(match));
  const current = normalizeCoinBid(match.currentBid);
  const currentQuantity = Number(current.quantity || 1);
  const currentAmount = bidCoinAmountValue(current) || limits.minCoinAmount;

  if (currentAmount > limits.maxCoinAmount) return null;
  if (currentQuantity >= totalDice) return null;

  return normalizeCoinBid({
    quantity: currentQuantity + TIMEOUT_AUTO_RAISE_STEP,
    face: Number(current.face || 1),
    coinAmount: currentAmount,
  });
}

function applyBidToMatch(match, player, bid, meta = {}) {
  const normalizedBid = assertBidIsValid(match, bid, { allowSameCoinAmount: Boolean(meta.allowSameCoinAmount) });
  match.previousBid = match.currentBid;
  match.currentBid = {
    ...normalizedBid,
    playerId: player.id,
    userId: player.userId || player.id,
    username: player.username,
    isBot: Boolean(player.isBot),
    roundNumber: Math.max(1, Number(match.roundNumber || 1)),
    at: nowIso(),
    ...(meta.autoRaised ? {
      autoRaised: true,
      autoRaiseBy: meta.autoRaiseBy || 'server',
      autoRaiseReason: meta.autoRaiseReason || 'turn_timeout',
    } : {}),
  };

  if (!match.previousBid) {
    match.firstBidFace = normalizedBid.face;
    match.firstBid = { ...match.currentBid };
  }

  markOnesCalledIfNeeded(match, match.currentBid);
  match.roundResult = null;
  match.roundPhase = 'bidding';

  const nextTurnIndex = nextActiveIndex(match, match.turnIndex);
  if (nextTurnIndex < 0) throw badRequest('No next active player found');
  match.turnIndex = nextTurnIndex;
  setTurnTimer(match);
  return match;
}

function getStrongestKnownFace(botPlayer = {}) {
  const counts = diceFaceCounts(Array.isArray(botPlayer.dice) ? botPlayer.dice : []);
  let bestFace = rollDie();
  let bestCount = -1;
  for (const [faceKey, count] of Object.entries(counts)) {
    const face = Number(faceKey);
    if (count > bestCount || (count === bestCount && face > bestFace)) {
      bestFace = face;
      bestCount = count;
    }
  }
  return { face: bestFace, count: Math.max(0, bestCount) };
}

function buildBotBid(match, botPlayer) {
  const totalDice = Math.max(1, totalDiceInPlay(match));
  const strongest = getStrongestKnownFace(botPlayer);
  const current = match.currentBid || null;

  if (!current) {
    const cautiousQuantity = Math.max(1, Math.min(totalDice, strongest.count || 1));
    return legalBidAfter(match, { quantity: cautiousQuantity, face: strongest.face });
  }

  const sameFaceConfidence = strongest.face === Number(current.face) ? strongest.count : 0;
  const quantityNudge = sameFaceConfidence >= 2 && current.quantity < totalDice ? 1 : 0;
  const preferredQuantity = Math.min(totalDice, Number(current.quantity || 1) + quantityNudge);
  return legalBidAfter(match, { quantity: preferredQuantity, face: strongest.face });
}

function shouldBotChallenge(match, botPlayer) {
  const current = match.currentBid;
  if (!current || current.playerId === botPlayer.id) return false;

  const myDice = Array.isArray(botPlayer.dice) ? botPlayer.dice : [];
  const totalDice = Math.max(1, totalDiceInPlay(match));
  const ownFaceCount = myDice.filter((value) => Number(value) === Number(current.face)).length;
  const unknownDice = Math.max(0, totalDice - myDice.length);

  // Bot AI is intentionally imperfect: it only uses its own dice plus probability,
  // never hidden dice from human players or other bots.
  const expectedCount = ownFaceCount + (unknownDice / 6);
  const bidQuantity = Number(current.quantity || 0);
  const pressure = bidQuantity / totalDice;
  const margin = bidQuantity - expectedCount;
  const randomRisk = Math.random() * 0.85;

  if (bidQuantity >= totalDice && margin >= 0.25) return true;
  if (pressure >= 0.72 && margin >= 0.65 - randomRisk) return true;
  if (margin >= 1.45 - randomRisk) return true;
  return false;
}

function shouldBotReroll(match, botPlayer) {
  if (match.gameRules?.rerollEnabled !== true) return false;
  if (match.currentBid) return false;
  if (botPlayer.usedRerollThisRound || Number(botPlayer.rerollsUsedThisRound || 0) >= Number(match.gameRules?.rerollLimitPerRound || 1)) return false;
  const strongest = getStrongestKnownFace(botPlayer);
  return strongest.count <= 1 && Math.random() < 0.18;
}

function buildBotTurnAction(match, botPlayer) {
  normalizeMatchRuntime(match);

  if (shouldBotReroll(match, botPlayer)) {
    return { type: 'reroll', reason: 'bot_low_confidence_reroll' };
  }

  if (shouldBotChallenge(match, botPlayer)) {
    const allowSlam = match.gameRules?.slamEnabled === true && playerLives(botPlayer) >= 2;
    const totalDice = Math.max(1, totalDiceInPlay(match));
    const pressure = Number(match.currentBid?.quantity || 0) / totalDice;
    if (allowSlam && pressure >= 0.82 && Math.random() < 0.22) return { type: 'slam', reason: 'bot_high_pressure_slam' };
    return { type: 'call_liar', reason: 'bot_suspects_bluff' };
  }

  const bid = buildBotBid(match, botPlayer);
  if (bid) return { type: 'bid', bid, reason: 'bot_raise_bid' };

  return { type: 'call_liar', reason: 'bot_no_legal_bid' };
}

function applyBotBid(match, botPlayer, action = {}) {
  applyBidToMatch(match, botPlayer, action.bid || action);
  match.lastAction = { type: 'bid', by: botPlayer.id, username: botPlayer.username, isBot: true, bid: match.currentBid, reason: action.reason || null };
  pushLog(match, match.lastAction);
  return match;
}

export function isBotTurn(match = {}) {
  if (!match || match.status !== 'active') return false;
  const active = (match.players || [])[Number(match.turnIndex || 0)];
  return Boolean(active && (active.isBot || isBotId(active.id)));
}

export async function applyBotTurn(match, options = {}) {
  if (!match) throw notFound('Match not found');
  if (match.status !== 'active') throw badRequest('Match is not active');
  normalizeMatchRuntime(match);

  const botPlayer = getActivePlayer(match);
  if (!botPlayer || !(botPlayer.isBot || isBotId(botPlayer.id))) {
    throw badRequest('Active player is not a bot');
  }

  const action = options.action || buildBotTurnAction(match, botPlayer);
  const type = String(action.type || action.action || '').toLowerCase();
  match.botActionCount = Number(match.botActionCount || 0) + 1;

  if (type === 'bid' || type === 'raise_bid' || type === 'confirm') {
    return store.saveMatch(applyBotBid(match, botPlayer, action));
  }

  if (type === 'reroll') {
    const rerolledMatch = applyReroll(match, botPlayer.id);
    rerolledMatch.lastAction = {
      ...(rerolledMatch.lastAction || {}),
      isBot: true,
      reason: action.reason || rerolledMatch.lastAction?.reason || null,
    };
    return store.saveMatch(rerolledMatch);
  }

  if (type === 'slam') {
    const resolvedMatch = resolveSlamRound(match, botPlayer.id);
    if (resolvedMatch.status === 'finished') return finalizeMatch(resolvedMatch, botPlayer, { reason: 'last_player_with_stack' });
    return store.saveMatch(resolvedMatch);
  }

  if (type === 'call_lira' || type === 'call_liar' || type === 'challenge' || type === 'call') {
    const resolvedMatch = resolveCallLiarRound(match, botPlayer.id);
    if (resolvedMatch.status === 'finished') return finalizeMatch(resolvedMatch, botPlayer, { reason: 'last_player_with_stack' });
    return store.saveMatch(resolvedMatch);
  }

  throw badRequest(`Unsupported bot action: ${action.type || action.action || 'unknown'}`);
}

function revealedDiceSnapshot(match) {
  return (match.players || []).map((player) => ({
    id: player.id,
    userId: player.userId || player.id,
    playerId: player.playerId || player.id,
    username: player.username,
    displayName: player.displayName || player.username,
    avatar: player.avatar || player.avatarId || null,
    avatarId: player.avatarId || player.avatar || null,
    avatarUrl: player.avatarUrl || player.avatar || player.avatarId || null,
    dice: Array.isArray(player.dice) ? [...player.dice] : [],
    diceCount: player.eliminated ? 0 : FIXED_DICE_PER_ROUND,
    lives: player.eliminated ? 0 : FIXED_DICE_PER_ROUND,
    stack: playerStack(player),
    currentStack: playerStack(player),
    startingStack: stackValue(player.startingStack, playerStack(player)),
    stackLost: Math.max(0, Number(player.stackLost || 0)),
    eliminated: Boolean(player.eliminated),
  }));
}

function currentRoundStackPenalty(match, requestedAmount = null) {
  const raw = requestedAmount
    ?? match?.currentBid?.coinAmount
    ?? match?.currentBid?.bidAmount
    ?? match?.currentBid?.amount
    ?? match?.currentBid?.coins
    ?? match?.roundStake
    ?? DEFAULT_STACK_LOSS;
  return Math.max(DEFAULT_STACK_LOSS, Math.trunc(Number(raw) || DEFAULT_STACK_LOSS));
}

function applyStackLoss(match, loserId, amount = null) {
  const loser = match.players.find((player) => player.id === loserId);
  if (!loser) throw badRequest('Invalid round loser');

  const beforeStack = playerStack(loser, matchStartingStack(match));
  const stackLost = Math.min(beforeStack, currentRoundStackPenalty(match, amount));
  const afterStack = Math.max(0, beforeStack - stackLost);
  const minPlayableStack = minimumPlayableStack(match);
  const bustedBelowMinimumBid = isBelowMinimumPlayableStack(match, loser, afterStack);
  const eliminated = afterStack <= 0 || bustedBelowMinimumBid;

  loser.stack = afterStack;
  loser.currentStack = afterStack;
  loser.matchStack = afterStack;
  loser.coinsStack = afterStack;
  loser.stackLost = Math.max(0, Number(loser.stackLost || 0)) + stackLost;
  loser.eliminated = eliminated;
  loser.active = !eliminated;
  loser.lives = eliminated ? 0 : FIXED_DICE_PER_ROUND;
  loser.diceCount = eliminated ? 0 : FIXED_DICE_PER_ROUND;
  loser.dice = eliminated ? [] : rollDice(FIXED_DICE_PER_ROUND);
  if (bustedBelowMinimumBid) {
    loser.bustedBelowMinimumBid = true;
    loser.eliminationReason = loser.eliminationReason || 'below_minimum_bid';
    loser.eliminatedAt = loser.eliminatedAt || nowIso();
  }

  return {
    loser,
    beforeStack,
    afterStack,
    stackLost,
    beforeLives: beforeStack >= minPlayableStack ? FIXED_DICE_PER_ROUND : 0,
    afterLives: eliminated ? 0 : FIXED_DICE_PER_ROUND,
    diceLost: 0,
    eliminated,
    minPlayableStack,
    minBidCoins: minimumBidCoins(match),
    bustedBelowMinimumBid,
    eliminationReason: bustedBelowMinimumBid ? 'below_minimum_bid' : (eliminated ? 'stack_zero' : null),
  };
}

function applyDiceLoss(match, loserId, diceLost = 1) {
  // Patch 2 compatibility: the old code path still calls applyDiceLoss,
  // but match survival is now stack-based and dice must stay fixed at 5 per round.
  return applyStackLoss(match, loserId, currentRoundStackPenalty(match, null));
}

function checkMatchWinner(match) {
  const remaining = activePlayers(match);
  return remaining.length === 1 ? remaining[0] : null;
}

function startNextRound(match, preferredStarterId = null) {
  const previousBid = match.currentBid ? { ...match.currentBid } : null;
  match.previousBid = previousBid;
  match.currentBid = null;
  match.firstBidFace = null;
  match.firstBid = null;
  match.onesWereCalledThisRound = false;
  match.onesCalledThisRound = false;
  match.onesCalledAtBid = null;
  match.onesCalledRoundNumber = null;
  match.roundNumber = Math.max(1, Number(match.roundNumber || 1)) + 1;
  match.roundStartedAt = nowIso();
  match.roundPhase = 'dice_ready';
  match.cupShaken = true;
  match.cupShakenAt = match.roundStartedAt;
  match.dicePerRound = FIXED_DICE_PER_ROUND;

  for (const player of match.players) {
    normalizePlayerRuntime(player, match);
    player.revealed = false;
    player.usedRerollThisRound = false;
    player.rerollsUsedThisRound = 0;
    if (isActiveContestant(player, match)) {
      player.dice = rollDice(FIXED_DICE_PER_ROUND);
      player.diceCount = FIXED_DICE_PER_ROUND;
      player.lives = FIXED_DICE_PER_ROUND;
    }
  }

  const preferredIndex = match.players.findIndex((player) => player.id === preferredStarterId);
  if (preferredIndex >= 0 && isActiveContestant(match.players[preferredIndex], match)) {
    match.turnIndex = preferredIndex;
  } else {
    const nextIndexFromLoser = nextActiveIndex(match, preferredIndex >= 0 ? preferredIndex : Number(match.turnIndex || 0));
    match.turnIndex = nextIndexFromLoser >= 0 ? nextIndexFromLoser : 0;
  }

  if (match.status === 'active') setTurnTimer(match);
  return match;
}

function buildFinalResult(match, winner, loser, reason, extra = {}) {
  const pot = syncPotFields(match);
  const loserIds = (match.players || [])
    .filter((player) => isHumanPlayer(player) && player.id !== winner.id)
    .map((player) => player.id);

  match.status = 'finished';
  match.winnerId = winner.id;
  match.loserId = loser?.id || loserIds[0] || null;
  for (const player of match.players) player.revealed = true;

  match.result = {
    matchId: match.id,
    status: 'finished',
    outcome: winner.id,
    winnerId: winner.id,
    winnerName: winner.username,
    loserId: match.loserId,
    loserName: loser?.username || null,
    loserIds,
    eliminatedIds: loserIds,
    reward: isBotId(winner.id) ? 0 : pot.winnerPayout,
    winnerPayout: isBotId(winner.id) ? 0 : pot.winnerPayout,
    grossPot: pot.grossPot,
    platformFee: pot.platformFee,
    netPot: pot.netPot,
    pot,
    winCondition: 'last_player_with_stack',
    winnerStack: playerStack(winner),
    xpWin: match.xpWin || 0,
    xpLose: match.xpLose || 0,
    roundNumber: match.roundNumber,
    roundResult: match.roundResult || null,
    ...extra,
    ...resultTableFields(match),
    reason,
    playerResults: {},
    finishedAt: nowIso(),
  };

  return match;
}

function resolveChallengeRound(match, challengerId, challengeType = 'call_liar') {
  normalizeMatchRuntime(match);
  if (!match.currentBid) throw badRequest('There is no bid to challenge');

  const normalizedChallengeType = challengeType === 'slam' ? 'slam' : 'call_liar';
  const challenger = match.players.find((player) => player.id === challengerId);
  const bidder = match.players.find((player) => player.id === match.currentBid.playerId);
  if (!challenger || !bidder) throw badRequest('Invalid challenge state');
  if (bidder.id === challenger.id) throw badRequest('You cannot challenge your own bid');

  const diceLostOnCallLiar = Math.max(1, Number(match.gameRules?.diceLostOnCallLiar || 1));
  const diceLostOnSlam = Math.max(2, Number(match.gameRules?.diceLostOnSlam || 2));
  const penaltyDice = normalizedChallengeType === 'slam' ? diceLostOnSlam : diceLostOnCallLiar;

  if (normalizedChallengeType === 'slam' && match.gameRules?.slamEnabled !== true) {
    throw badRequest('Slam is disabled in official rules');
  }

  if (normalizedChallengeType === 'slam' && playerLives(challenger) < 2) {
    throw badRequest('Slam requires at least 2 dice');
  }

  const challengedBid = { ...match.currentBid };
  const revealedDice = revealedDiceSnapshot(match);
  const countBreakdown = countBidFace(match, challengedBid.face);
  const actualCount = countBreakdown.actualCount;
  const bidWasTrue = actualCount >= challengedBid.quantity;
  const loser = bidWasTrue ? challenger : bidder;
  const roundWinner = bidWasTrue ? bidder : challenger;
  const loss = applyDiceLoss(match, loser.id, penaltyDice);

  const roundResult = {
    matchId: match.id,
    roundNumber: Math.max(1, Number(match.roundNumber || 1)),
    challengeType: normalizedChallengeType,
    bid: challengedBid,
    bidderUserId: bidder.id,
    bidderName: bidder.username,
    challengerUserId: challenger.id,
    challengerName: challenger.username,
    actualCount,
    bidWasTrue,
    winnerUserId: roundWinner.id,
    winnerName: roundWinner.username,
    loserUserId: loser.id,
    loserName: loser.username,
    diceLost: loss.diceLost,
    requestedDiceLost: penaltyDice,
    beforeLives: loss.beforeLives,
    afterLives: loss.afterLives,
    stackLost: loss.stackLost,
    beforeStack: loss.beforeStack,
    afterStack: loss.afterStack,
    eliminated: loss.eliminated,
    minPlayableStack: loss.minPlayableStack,
    minBidCoins: loss.minBidCoins,
    bustedBelowMinimumBid: loss.bustedBelowMinimumBid,
    eliminationReason: loss.eliminationReason,
    revealedDice,
    wildDice: countBreakdown.wildDice,
    exactCount: countBreakdown.exactCount,
    wildOnesCount: countBreakdown.wildOnesCount,
    onesCountAsWild: countBreakdown.onesCountAsWild,
    firstBidFace: countBreakdown.firstBidFace,
    onesWereCalledThisRound: countBreakdown.onesWereCalledThisRound,
    onesAreWildThisBid: countBreakdown.onesAreWildThisBid,
    nextRoundStartsInMs: 0,
    createdAt: nowIso(),
  };

  match.roundResult = roundResult;
  match.lastRoundResult = roundResult;
  match.lastAction = { type: normalizedChallengeType, by: challengerId, roundResult };
  pushLog(match, match.lastAction);

  const matchWinner = checkMatchWinner(match);
  if (matchWinner) {
    buildFinalResult(match, matchWinner, loser, 'last_player_with_stack', {
      challenge: normalizedChallengeType,
      bid: challengedBid,
      actualCount,
      bidWasTrue,
    });
    return match;
  }

  startNextRound(match, loser.id);
  return match;
}

function resolveCallLiarRound(match, challengerId) {
  return resolveChallengeRound(match, challengerId, 'call_liar');
}

function resolveSlamRound(match, challengerId) {
  return resolveChallengeRound(match, challengerId, 'slam');
}


function applyReroll(match, userId) {
  normalizeMatchRuntime(match);
  assertPlayerTurn(match, userId);

  const player = match.players.find((item) => item.id === userId);
  if (!player || !isActiveContestant(player, match)) throw badRequest('Invalid reroll player');
  if (match.gameRules?.rerollEnabled !== true) throw badRequest('Reroll is disabled in official rules');
  if (player.usedRerollThisRound || Number(player.rerollsUsedThisRound || 0) >= Number(match.gameRules?.rerollLimitPerRound || 1)) {
    throw badRequest('Reroll already used this round');
  }

  const lives = FIXED_DICE_PER_ROUND;
  player.dice = rollDice(FIXED_DICE_PER_ROUND);
  player.diceCount = FIXED_DICE_PER_ROUND;
  player.lives = FIXED_DICE_PER_ROUND;
  player.usedRerollThisRound = true;
  player.rerollsUsedThisRound = Number(player.rerollsUsedThisRound || 0) + 1;
  player.revealed = false;

  match.roundResult = null;
  match.lastAction = {
    type: 'reroll',
    by: userId,
    username: player.username,
    roundNumber: Math.max(1, Number(match.roundNumber || 1)),
    diceCount: lives,
    rerollsUsedThisRound: player.rerollsUsedThisRound,
  };
  pushLog(match, match.lastAction);
  setTurnTimer(match);
  return match;
}

function applyForfeit(match, userId, reason = 'player_left') {
  normalizeMatchRuntime(match);
  const player = match.players.find((item) => item.id === userId);
  if (!player) throw forbidden('You are not a player in this match');
  if (player.eliminated || player.active === false || playerLives(player) <= 0) {
    throw badRequest('Player already forfeited this match');
  }

  const playerIndex = match.players.findIndex((item) => item.id === userId);
  const beforeLives = playerLives(player);
  const beforeStack = playerStack(player);
  player.stack = 0;
  player.currentStack = 0;
  player.matchStack = 0;
  player.coinsStack = 0;
  player.stackLost = Math.max(0, Number(player.stackLost || 0)) + beforeStack;
  player.lives = 0;
  player.diceCount = 0;
  player.dice = [];
  player.eliminated = true;
  player.forfeited = true;
  player.forfeitedAt = nowIso();
  player.forfeitReason = reason;
  player.active = false;
  player.revealed = true;

  const roundResult = {
    matchId: match.id,
    roundNumber: Math.max(1, Number(match.roundNumber || 1)),
    challengeType: 'forfeit',
    loserUserId: player.id,
    loserName: player.username,
    diceLost: 0,
    beforeLives,
    afterLives: 0,
    stackLost: beforeStack,
    beforeStack,
    afterStack: 0,
    eliminated: true,
    reason,
    revealedDice: revealedDiceSnapshot(match),
    createdAt: nowIso(),
  };

  match.roundResult = roundResult;
  match.lastRoundResult = roundResult;
  match.lastAction = { type: 'forfeit', by: userId, roundResult };
  pushLog(match, match.lastAction);

  const winner = checkMatchWinner(match);
  if (winner) {
    buildFinalResult(match, winner, player, reason, { roundResult });
    return match;
  }

  match.currentBid = null;
  match.previousBid = null;
  startNextRound(match, match.players[playerIndex]?.id);
  return match;
}


function resolveTurnTimeoutRound(match, timedOutPlayerId) {
  normalizeMatchRuntime(match);
  const timedOutPlayer = match.players.find((item) => item.id === timedOutPlayerId);
  if (!timedOutPlayer) throw forbidden('You are not a player in this match');
  assertPlayerTurn(match, timedOutPlayerId);

  const bidBeforeTimeout = match.currentBid ? normalizeCoinBid({ ...match.currentBid }) : null;
  const timeoutFallbackReason = timeoutAutoRaiseFailureReason(match) || 'no_legal_timeout_auto_raise';
  const autoBid = autoRaiseBidForTimeout(match);

  if (!autoBid) {
    if (match.currentBid) {
      const resolved = resolveChallengeRound(match, timedOutPlayerId, 'call_liar');
      if (resolved.roundResult) {
        resolved.roundResult = {
          ...resolved.roundResult,
          challengeType: 'timeout_auto_challenge',
          timeoutAutoAction: true,
          timeoutFallbackReason,
        };
        resolved.lastRoundResult = resolved.roundResult;
        if (resolved.result?.roundResult) resolved.result.roundResult = resolved.roundResult;
        resolved.lastAction = {
          type: 'timeout_auto_challenge',
          by: timedOutPlayerId,
          username: timedOutPlayer.username,
          reason: timeoutFallbackReason,
          roundResult: resolved.roundResult,
        };
        pushLog(resolved, resolved.lastAction);
      }
      return resolved;
    }

    match.lastAction = {
      type: 'timeout_auto_raise_failed',
      by: timedOutPlayerId,
      username: timedOutPlayer.username,
      reason: timeoutFallbackReason,
      currentBid: bidBeforeTimeout,
      activePlayerStack: playerStack(timedOutPlayer, matchStartingStack(match)),
      roundNumber: Math.max(1, Number(match.roundNumber || 1)),
    };
    pushLog(match, match.lastAction);
    throw forbidden('No legal timeout auto raise is available');
  }

  applyBidToMatch(match, timedOutPlayer, autoBid, {
    autoRaised: true,
    autoRaiseBy: 'server',
    autoRaiseReason: 'turn_timeout',
    allowSameCoinAmount: true,
  });

  match.lastAction = {
    type: 'timeout_auto_raise',
    by: timedOutPlayerId,
    username: timedOutPlayer.username,
    reason: 'turn_timeout',
    bidBeforeTimeout,
    bid: match.currentBid,
    autoRaiseStep: TIMEOUT_AUTO_RAISE_STEP,
    autoRaiseTarget: 'dice_quantity',
    roundNumber: Math.max(1, Number(match.roundNumber || 1)),
  };
  pushLog(match, match.lastAction);
  return match;
}

async function loadUniqueUsers(userIds = []) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = [];
  for (const userId of uniqueIds) {
    users.push(await store.requireUser(userId));
  }
  return users;
}

async function chargeEntryFees({ matchId, humanUsers, entryFee, mode, roomId, tableId = null, tableName = null, tableTier = null, tableType = null, tournamentId = null, tournamentName = null }) {
  if (!entryFee || entryFee <= 0) {
    return { chargedUsers: humanUsers, chargeResults: {}, chargedPlayerIds: [], entryFeesCharged: false };
  }

  const uniqueUsers = Array.from(new Map((humanUsers || []).map((user) => [user.id, user])).values());

  for (const user of uniqueUsers) {
    const alreadyCharged = await hasWalletTransaction(user.id, { referenceId: matchId, types: ['match_buy_in', 'match_entry_fee'] });
    if (!alreadyCharged && Number(user.wallet?.coins || 0) < entryFee) {
      throw forbidden(`Not enough coins for ${user.username}. Required: ${entryFee}`);
    }
  }

  const chargedUsers = [];
  const chargeResults = {};

  for (const user of uniqueUsers) {
    const existingCharge = await listWalletTransactionsFor(user.id, { referenceId: matchId, types: ['match_buy_in', 'match_entry_fee'] });
    if (existingCharge.length) {
      chargedUsers.push(user);
      chargeResults[user.id] = {
        coins: entryFee,
        alreadyCharged: true,
        transactionIds: existingCharge.map((row) => row.id).filter(Boolean),
        wallet: store.walletView ? store.walletView(user) : user.wallet,
      };
      continue;
    }

    const walletUpdate = await store.adjustWallet(user.id, {
      coins: -entryFee,
      type: 'match_buy_in',
      reason: 'Match buy-in',
      referenceId: matchId,
      metadata: { matchId, mode: mode || 'quick', roomId: roomId || null, tableId, tableName, tableTier, tableType, tournamentId, tournamentName },
    });
    const chargedUser = walletUpdate.user;
    chargedUser.stats = chargedUser.stats || {};
    chargedUser.stats.coinsSpent = Number(chargedUser.stats.coinsSpent || 0) + entryFee;
    const savedUser = await store.saveUser(chargedUser);
    chargedUsers.push(savedUser);
    chargeResults[user.id] = {
      coins: entryFee,
      alreadyCharged: false,
      transactionIds: (walletUpdate.transactions || []).map((row) => row.id).filter(Boolean),
      wallet: walletUpdate.wallet || (store.walletView ? store.walletView(savedUser) : savedUser.wallet),
    };
  }

  return {
    chargedUsers,
    chargeResults,
    chargedPlayerIds: chargedUsers.map((user) => user.id),
    entryFeesCharged: true,
  };
}

async function createMatchForUsers(humanUsers, options = {}) {
  const uniqueHumanUsers = Array.from(new Map(humanUsers.map((user) => [user.id, user])).values());
  if (uniqueHumanUsers.length < 1) throw badRequest('At least one human player is required');

  let tableMeta = buildTableMatchMetadata(options);
  tableMeta = applyValidatedRoomStakeOverrides(tableMeta, options);
  const roomMode = normalizeRoomMode(
    options.roomMode,
    options.gameMode,
    options.playMode,
    options.matchMode,
    options.botsEnabled ? ROOM_MODE_BOTS : null,
  );
  const botsEnabled = roomMode === ROOM_MODE_BOTS && options.disableBots !== true && options.noBots !== true;
  const requestedMaxPlayers = options.maxPlayers || options.selectedPlayers || options.requiredPlayers || options.playersCount || uniqueHumanUsers.length || tableMeta.maxPlayers || 4;
  const maxPlayers = clampInt(requestedMaxPlayers, tableMeta.maxPlayers || 4, tableMeta.minPlayers || 2, 4);
  const requestedRequiredHumanPlayers = options.requiredHumanPlayers || options.requiredPlayers || maxPlayers;
  const requiredHumanPlayers = botsEnabled
    ? 1
    : clampInt(requestedRequiredHumanPlayers, maxPlayers, tableMeta.minPlayers || 2, maxPlayers);
  const realPlayersOnly = !botsEnabled;

  if (uniqueHumanUsers.length < requiredHumanPlayers) {
    throw badRequest(`Match requires ${requiredHumanPlayers} real player${requiredHumanPlayers === 1 ? '' : 's'}`);
  }

  const startingCups = FIXED_DICE_PER_ROUND;
  const bidStyle = normalizeBidStyle();
  const turnTimer = parseTimer(tableMeta.turnTimer);
  const entryFee = Math.max(0, Number(tableMeta.buyInAmount ?? tableMeta.entryFee ?? env.matchEntryFee) || 0);
  const startingStack = stackValue(tableMeta.startingStack ?? entryFee, entryFee);
  const minCoinBet = firstPositiveInt([
    options.minCoinBet,
    options.minBidCoins,
    tableMeta.minCoinBet,
    tableMeta.minBidCoins,
    tableMeta.pricing?.minCoinBet,
    tableMeta.selectedTable?.minCoinBet,
  ], Math.max(1, Math.floor(Math.max(1, startingStack) / 5)));
  const maxCoinBet = Math.max(minCoinBet, firstPositiveInt([
    options.maxCoinBet,
    options.maxBidCoins,
    tableMeta.maxCoinBet,
    tableMeta.maxBidCoins,
    tableMeta.pricing?.maxCoinBet,
    tableMeta.selectedTable?.maxCoinBet,
  ], startingStack));
  const defaultCoinBet = Math.max(minCoinBet, Math.min(maxCoinBet, firstPositiveInt([
    options.defaultCoinBet,
    options.defaultBidCoins,
    tableMeta.defaultCoinBet,
    tableMeta.defaultBidCoins,
    tableMeta.pricing?.defaultCoinBet,
    tableMeta.selectedTable?.defaultCoinBet,
  ], minCoinBet)));
  const bidCoinStepValue = firstPositiveInt([
    options.bidCoinStep,
    options.coinBidStep,
    tableMeta.bidCoinStep,
    tableMeta.pricing?.bidCoinStep,
    tableMeta.selectedTable?.bidCoinStep,
  ], DEFAULT_BID_COIN_STEP);
  const coinBetOptions = Array.isArray(options.coinBetOptions) && options.coinBetOptions.length
    ? options.coinBetOptions
    : (Array.isArray(tableMeta.coinBetOptions) && tableMeta.coinBetOptions.length
      ? tableMeta.coinBetOptions
      : (Array.isArray(tableMeta.pricing?.coinBetOptions) ? tableMeta.pricing.coinBetOptions : []));
  const platformFeePercent = normalizePlatformFeePercent(tableMeta.platformFeePercent ?? options.platformFeePercent ?? 0, 0);
  const xpWin = Math.max(0, Number(options.xpWin ?? tableMeta.xpWin ?? 120) || 0);
  const xpLose = Math.max(0, Number(options.xpLose ?? tableMeta.xpLose ?? 40) || 0);
  const matchId = `match_${nanoid(12)}`;
  const mode = options.mode || tableMeta.tableKey || 'quick';
  const roomId = options.roomId || null;
  const tournamentId = options.tournamentId || options.tournament?.id || null;
  const tournamentName = options.tournamentName || options.tournament?.name || options.tournament?.title || null;
  const eventId = options.eventId || options.event?.id || null;
  const eventTitle = options.eventTitle || options.event?.title || options.event?.name || null;

  const chargeState = options.skipEntryFee
    ? { chargedUsers: uniqueHumanUsers, chargeResults: {}, chargedPlayerIds: [], entryFeesCharged: false }
    : await chargeEntryFees({
      matchId,
      humanUsers: uniqueHumanUsers,
      entryFee,
      mode,
      roomId,
      tableId: tableMeta.tableId,
      tableName: tableMeta.tableName,
      tableTier: tableMeta.tableTier,
      tableType: tableMeta.tableType,
      tournamentId,
      tournamentName,
    });
  const chargedUsers = chargeState.chargedUsers || uniqueHumanUsers;

  const humanPlayers = chargedUsers.slice(0, maxPlayers).map((user) => buildHumanPlayer(user, startingCups, startingStack));
  const usedNames = humanPlayers.map((player) => String(player.displayName || player.username || '').toLowerCase());
  const botCount = botsEnabled ? Math.max(0, maxPlayers - humanPlayers.length) : 0;
  const botPlayers = Array.from({ length: botCount }, (_, index) => buildBotPlayer(index, startingCups, usedNames, startingStack));
  const players = [...humanPlayers, ...botPlayers];
  const paidPlayerCount = options.skipEntryFee ? 0 : chargedUsers.length;
  const matchPot = calculatePotFromValues({ buyInAmount: entryFee, paidPlayerCount, platformFeePercent });
  const winReward = matchPot.winnerPayout;
  const initialStatus = options.initialStatus || options.status || 'active';
  const matchStartDelayMs = Math.max(0, Number(options.matchStartDelayMs || 0));
  const createdAt = nowIso();

  const match = {
    id: matchId,
    roomId,
    mode,
    roomMode,
    gameMode: roomMode,
    playMode: roomMode,
    tournamentId,
    tournamentName,
    tournament: options.tournament || null,
    eventId,
    eventTitle,
    event: options.event || null,
    tableId: tableMeta.tableId,
    selectedTableId: tableMeta.selectedTableId,
    tableKey: tableMeta.tableKey,
    tableName: tableMeta.tableName,
    selectedTableName: tableMeta.selectedTableName,
    tableTitle: tableMeta.tableTitle,
    tableTier: tableMeta.tableTier,
    selectedTableTier: tableMeta.selectedTableTier,
    tableType: tableMeta.tableType,
    table: tableMeta.table,
    selectedTable: tableMeta.selectedTable,
    buyInAmount: entryFee,
    paidPlayerCount,
    grossPot: matchPot.grossPot,
    platformFeePercent,
    platformFee: matchPot.platformFee,
    netPot: matchPot.netPot,
    winnerPayout: matchPot.winnerPayout,
    potMode: tableMeta.potMode || 'winner_takes_all',
    payoutMode: tableMeta.payoutMode || tableMeta.potMode || 'winner_takes_all',
    lossCondition: tableMeta.lossCondition || 'stack_zero',
    settlementStatus: SETTLEMENT_PENDING,
    settlement: {
      status: SETTLEMENT_PENDING,
      buyInsCharged: Boolean(chargeState.entryFeesCharged),
      buyInsChargedAt: chargeState.entryFeesCharged ? createdAt : null,
      refunded: false,
      rewardApplied: false,
      settledAt: null,
    },
    entryFeesCharged: Boolean(chargeState.entryFeesCharged),
    entryFeesChargedAt: chargeState.entryFeesCharged ? createdAt : null,
    buyInsCharged: Boolean(chargeState.entryFeesCharged),
    buyInsChargedAt: chargeState.entryFeesCharged ? createdAt : null,
    buyInChargedPlayerIds: chargeState.chargedPlayerIds || [],
    buyInChargeResults: chargeState.chargeResults || {},
    potPaid: false,
    payoutApplied: false,
    payoutAppliedAt: null,
    settledAt: null,
    pot: matchPot,
    pricing: {
      stakes: tableMeta.stakes,
      buyIn: tableMeta.buyIn,
      buyInRange: tableMeta.buyInRange,
      minBuyIn: tableMeta.minBuyIn,
      maxBuyIn: tableMeta.maxBuyIn,
      buyInAmount: entryFee,
      entryFee,
      startingStack,
      paidPlayerCount,
      grossPot: matchPot.grossPot,
      platformFeePercent,
      platformFee: matchPot.platformFee,
      netPot: matchPot.netPot,
      winnerPayout: matchPot.winnerPayout,
      minCoinBet,
      maxCoinBet,
      defaultCoinBet,
      minBidCoins: minCoinBet,
      maxBidCoins: maxCoinBet,
      defaultBidCoins: defaultCoinBet,
      bidCoinStep: bidCoinStepValue,
      coinBetOptions,
      winnerReward: winReward,
      winnerRewardMode: 'pot',
      potMode: tableMeta.potMode || 'winner_takes_all',
      payoutMode: tableMeta.payoutMode || tableMeta.potMode || 'winner_takes_all',
      lossCondition: tableMeta.lossCondition || 'stack_zero',
    },
    xpRewards: { xpWin, xpLose },
    startingStack,
    stackMode: true,
    dicePerRound: FIXED_DICE_PER_ROUND,
    fixedDicePerRound: true,
    minCoinBet,
    maxCoinBet,
    defaultCoinBet,
    minBidCoins: minCoinBet,
    maxBidCoins: maxCoinBet,
    defaultBidCoins: defaultCoinBet,
    bidCoinStep: bidCoinStepValue,
    coinBetOptions,
    coinBidEnabled: true,
    roundPhase: initialStatus === 'active' ? 'dice_ready' : 'waiting_to_start',
    cupShaken: initialStatus === 'active',
    cupShakenAt: initialStatus === 'active' ? createdAt : null,
    status: initialStatus,
    players,
    requiredPlayers: maxPlayers,
    maxPlayers,
    selectedPlayers: maxPlayers,
    playersCount: maxPlayers,
    realPlayersOnly,
    botsEnabled,
    botCount,
    botPlayerIds: botPlayers.map((player) => player.id),
    hostUserId: options.hostUserId || chargedUsers[0].id,
    turnIndex: 0,
    roundNumber: 1,
    roundStartedAt: initialStatus === 'active' ? createdAt : null,
    startedAt: initialStatus === 'active' ? createdAt : null,
    countdownStartedAt: initialStatus === 'countdown' ? createdAt : null,
    startsAt: initialStatus === 'countdown' ? addMs(matchStartDelayMs) : null,
    matchStartDelayMs,
    turnStartedAt: null,
    turnDeadlineAt: null,
    currentBid: null,
    previousBid: null,
    roundResult: null,
    lastRoundResult: null,
    gameRules: normalizeGameRules({
      ...(options.gameRules || {}),
      minCoinBet,
      maxCoinBet,
      defaultCoinBet,
      minBidCoins: minCoinBet,
      maxBidCoins: maxCoinBet,
      defaultBidCoins: defaultCoinBet,
      bidCoinStep: bidCoinStepValue,
    }, {
      bidStyle,
      botsEnabled,
    }),
    firstBidFace: null,
    firstBid: null,
    onesWereCalledThisRound: false,
    onesCalledThisRound: false,
    onesCalledAtBid: null,
    onesCalledRoundNumber: null,
    lastAction: null,
    actionLog: [],
    turnTimer,
    bidStyle,
    entryFee,
    winReward,
    xpWin,
    xpLose,
    winnerId: null,
    loserId: null,
    result: null,
    rewardApplied: false,
    statsApplied: false,
    entryFeesRefunded: false,
    createdAt,
    updatedAt: createdAt,
  };

  if (match.status === 'active') setTurnTimer(match);

  return store.saveMatch(match);
}

export async function createMatchForUser(user, options = {}) {
  const humanUsers = options.humanUserIds
    ? await loadUniqueUsers(options.humanUserIds)
    : [await store.requireUser(user.id)];

  return createMatchForUsers(humanUsers, {
    ...options,
    hostUserId: user.id,
  });
}

export async function createMatchFromRoom(room, requesterUser, options = {}) {
  if (!room) throw notFound('Room not found');
  if (!room.players?.includes(requesterUser.id)) throw forbidden('You are not inside this room');

  if (room.matchId) {
    const existingMatch = await store.getMatch(room.matchId);
    if (existingMatch && ['active', 'countdown'].includes(existingMatch.status)) return existingMatch;
  }

  const humanPlayerIds = (room.players || []).filter((playerId) => !isBotId(playerId));
  const humanUsers = await loadUniqueUsers(humanPlayerIds);
  const roomMode = normalizeRoomMode(room.roomMode, room.gameMode, room.playMode, room.botsEnabled ? ROOM_MODE_BOTS : null, options.roomMode, options.gameMode, options.playMode);
  const roomMaxPlayers = Math.max(2, Math.min(Number(room.maxPlayers || room.requiredPlayers || room.selectedPlayers || 2), 4));

  if (roomMode !== ROOM_MODE_BOTS && humanUsers.length < roomMaxPlayers) {
    throw badRequest(`Room requires ${roomMaxPlayers} players before starting`);
  }

  const match = await createMatchForUsers(humanUsers, {
    ...options,
    mode: options.mode || 'room',
    roomMode,
    gameMode: roomMode,
    playMode: roomMode,
    roomId: room.id,
    tableId: room.tableId || room.catalogId || options.tableId,
    catalogId: room.catalogId || room.tableId || options.catalogId,
    isPrivate: room.isPrivate,
    privateStakeValidated: room.privateStakeValidated,
    customStakeValidated: room.customStakeValidated,
    customStake: room.customStake,
    stakeValidation: room.stakeValidation,
    buyInAmount: room.buyInAmount ?? room.entryFee,
    entryFee: room.entryFee,
    startingStack: room.startingStack ?? room.entryFee,
    minBuyIn: room.minBuyIn,
    maxBuyIn: room.maxBuyIn,
    minCoinBet: room.minCoinBet ?? room.minBidCoins,
    maxCoinBet: room.maxCoinBet ?? room.maxBidCoins,
    defaultCoinBet: room.defaultCoinBet ?? room.defaultBidCoins,
    bidCoinStep: room.bidCoinStep,
    coinBetOptions: room.coinBetOptions,
    platformFeePercent: room.platformFeePercent,
    potMode: room.potMode,
    payoutMode: room.payoutMode,
    lossCondition: room.lossCondition,
    winReward: room.winnerReward,
    xpWin: room.xpWin,
    xpLose: room.xpLose,
    hostUserId: room.ownerId || requesterUser.id,
    maxPlayers: roomMaxPlayers,
    requiredPlayers: roomMaxPlayers,
    selectedPlayers: roomMaxPlayers,
    playersCount: roomMaxPlayers,
    startingCups: room.startingCups,
    turnTimer: room.turnTimer,
    bidStyle: room.bidStyle,
    requiredHumanPlayers: roomMode === ROOM_MODE_BOTS ? 1 : roomMaxPlayers,
    realPlayersOnly: roomMode !== ROOM_MODE_BOTS,
    disableBots: roomMode !== ROOM_MODE_BOTS,
    noBots: roomMode !== ROOM_MODE_BOTS,
  });

  if (store.saveRoom) {
    await store.saveRoom({
      ...room,
      status: match.status === 'countdown' ? 'countdown' : 'in_match',
      matchId: match.id,
      countdownStartedAt: match.countdownStartedAt || null,
      startsAt: match.startsAt || null,
      matchStartDelayMs: Number(match.matchStartDelayMs || 0),
      updatedAt: nowIso(),
    });
  }

  return match;
}


function ensureStats(user) {
  user.stats = user.stats || {};
  user.stats.tableStats = user.stats.tableStats || {};
  return user.stats;
}

function updateFavoriteTable(stats) {
  const entries = Object.entries(stats.tableStats || {});
  if (!entries.length) return;
  const [favoriteTableId, favoriteStats] = entries.reduce((best, current) => {
    const bestPlayed = Number(best[1]?.played || 0);
    const currentPlayed = Number(current[1]?.played || 0);
    return currentPlayed > bestPlayed ? current : best;
  });
  stats.favoriteTableId = favoriteTableId;
  stats.favoriteTableName = favoriteStats.tableName || favoriteTableId;
}

function applyLevelProgress(user, xpEarned) {
  user.xp = Number(user.xp || 0) + Number(xpEarned || 0);
  user.level = Math.max(1, Number(user.level || 1));
  user.nextLevelXp = Math.max(1, Number(user.nextLevelXp || 2500));

  while (user.xp >= user.nextLevelXp) {
    user.xp -= user.nextLevelXp;
    user.level += 1;
    user.nextLevelXp = Math.max(1, Math.round(user.nextLevelXp * 1.25));
  }

  user.rankProgress = Math.max(0, Math.min(100, Math.round((user.xp / Math.max(1, user.nextLevelXp)) * 100)));
}

function normalizeTableStat(match, previous = {}) {
  const table = tableSummary(match);
  return {
    tableId: table.tableId,
    selectedTableId: table.selectedTableId,
    tableKey: table.tableKey,
    tableName: table.tableName,
    selectedTableName: table.selectedTableName,
    tableTitle: table.tableTitle,
    tableTier: table.tableTier,
    selectedTableTier: table.selectedTableTier,
    tableType: table.tableType,
    played: Number(previous.played || 0),
    wins: Number(previous.wins || 0),
    losses: Number(previous.losses || 0),
    coinsWon: Number(previous.coinsWon || 0),
    coinsSpent: Number(previous.coinsSpent || 0),
    xpEarned: Number(previous.xpEarned || 0),
    entryFeeTotal: Number(previous.entryFeeTotal || previous.coinsSpent || 0),
    lastPlayedAt: previous.lastPlayedAt || null,
    lastResult: previous.lastResult || null,
  };
}

function applyTableStats(user, match, won, xpEarned, rewardAmount = 0) {
  const stats = ensureStats(user);
  const table = tableSummary(match);
  const tableId = table.tableId || 'unknown';
  const previous = normalizeTableStat(match, stats.tableStats[tableId] || {});
  const entryFee = Math.max(0, Number(match.entryFee || table.pricing?.entryFee || 0));

  previous.played += 1;
  previous.wins += won ? 1 : 0;
  previous.losses += won ? 0 : 1;
  previous.coinsWon += won ? Number(rewardAmount || 0) : 0;
  previous.coinsSpent += entryFee;
  previous.entryFeeTotal += entryFee;
  previous.xpEarned += Number(xpEarned || 0);
  previous.lastPlayedAt = nowIso();
  previous.lastResult = won ? 'win' : 'loss';

  stats.tableStats[tableId] = previous;
  updateFavoriteTable(stats);
  return previous;
}

export async function finalizeMatch(match, actingUser, options = {}) {
  if (!match) throw notFound('Match not found');
  assertPlayerInMatch(match, actingUser.id);
  const pot = syncPotFields(match);
  syncSettlementFields(match);

  if (match.settlementStatus === SETTLEMENT_REFUNDED) {
    throw badRequest('Refunded matches cannot be finalized');
  }

  if (match.status !== 'finished') {
    for (const player of match.players) player.revealed = true;

    const actingPlayer = match.players.find((player) => player.id === actingUser.id);
    const requestedWinnerId = options.winnerId || null;
    let winner = requestedWinnerId ? match.players.find((player) => player.id === requestedWinnerId) : null;

    if (!winner) {
      if (options.outcome === 'loss') winner = getNextHumanOpponent(match, actingUser.id) || actingPlayer;
      else winner = actingPlayer;
    }

    const loser = options.outcome === 'loss'
      ? actingPlayer
      : match.players.find((player) => isHumanPlayer(player) && player.id !== winner.id) || actingPlayer;
    match.status = 'finished';
    match.winnerId = winner.id;
    match.loserId = loser.id;
    match.result = {
      matchId: match.id,
      status: 'finished',
      outcome: winner.id === actingUser.id ? 'win' : 'loss',
      tournamentId: match.tournamentId || null,
      tournamentName: match.tournamentName || null,
      eventId: match.eventId || null,
      eventTitle: match.eventTitle || null,
      winnerId: winner.id,
      winnerName: winner.username,
      loserId: loser.id,
      loserName: loser.username,
      reward: isBotId(winner.id) ? 0 : pot.winnerPayout,
      xpWin: match.xpWin || 0,
      xpLose: match.xpLose || 0,
      ...resultTableFields(match),
      reason: options.reason || 'manual_result',
      playerResults: {},
      finishedAt: nowIso(),
    };
    match.lastAction = { type: 'finish', by: actingUser.id, result: match.result };
    pushLog(match, match.lastAction);
  }

  if (match.settlementStatus === SETTLEMENT_SETTLED || match.potPaid || match.payoutApplied) {
    match.rewardApplied = true;
  }

  if (!match.rewardApplied && match.winnerId && !isBotId(match.winnerId)) {
    const winnerUser = await store.requireUser(match.winnerId);
    const rewardAmount = Math.max(0, Number(syncPotFields(match).winnerPayout || 0));
    try {
      const existingPayout = await listWalletTransactionsFor(winnerUser.id, { referenceId: match.id, types: ['match_pot_win', 'match_win_reward'] });
      if (rewardAmount > 0 && existingPayout.length === 0) {
        const walletUpdate = await store.adjustWallet(winnerUser.id, {
          coins: rewardAmount,
          type: 'match_pot_win',
          reason: 'Match pot win',
          referenceId: match.id,
          metadata: {
            matchId: match.id,
            mode: match.mode || 'quick',
            roomId: match.roomId || null,
            tableId: match.tableId || null,
            tableName: match.tableName || null,
            tableTier: match.tableTier || null,
            tableType: match.tableType || null,
            buyInAmount: match.buyInAmount || 0,
            paidPlayerCount: match.paidPlayerCount || 0,
            grossPot: match.grossPot || 0,
            platformFeePercent: match.platformFeePercent || 0,
            platformFee: match.platformFee || 0,
            netPot: match.netPot || 0,
            winnerPayout: match.winnerPayout || 0,
            tournamentId: match.tournamentId || null,
            tournamentName: match.tournamentName || null,
            eventId: match.eventId || null,
            eventTitle: match.eventTitle || null,
          },
        });
        const updatedWinner = walletUpdate.user;
        updatedWinner.stats = updatedWinner.stats || {};
        updatedWinner.stats.coinsWon = Number(updatedWinner.stats.coinsWon || 0) + rewardAmount;
        await store.saveUser(updatedWinner);
        match.payoutTransactionIds = (walletUpdate.transactions || []).map((row) => row.id).filter(Boolean);
      } else if (existingPayout.length > 0) {
        match.payoutTransactionIds = existingPayout.map((row) => row.id).filter(Boolean);
        match.payoutAlreadyApplied = true;
      }
      match.rewardApplied = true;
      match.potPaid = true;
      match.payoutApplied = true;
      match.payoutAppliedAt = match.payoutAppliedAt || nowIso();
      match.settledAt = match.settledAt || match.payoutAppliedAt;
      match.settlementStatus = SETTLEMENT_SETTLED;
      syncSettlementFields(match);
    } catch (error) {
      markSettlementFailed(match, error, 'winner_payout');
      await store.saveMatch(match);
      throw error;
    }
  }

  if (!match.rewardApplied && match.winnerId && isBotId(match.winnerId)) {
    match.rewardApplied = true;
    match.potPaid = true;
    match.payoutApplied = true;
    match.payoutAppliedAt = match.payoutAppliedAt || nowIso();
    match.settledAt = match.settledAt || match.payoutAppliedAt;
    match.settlementStatus = SETTLEMENT_SETTLED;
    syncSettlementFields(match);
  }

  if (!match.statsApplied) {
    const winnerId = match.winnerId;
    for (const userId of humanPlayerIds(match)) {
      const user = await store.requireUser(userId);
      const stats = ensureStats(user);
      const won = userId === winnerId;
      const xpEarned = Number(won ? match.xpWin || 0 : match.xpLose || 0);
      const rewardAmount = won && !isBotId(userId) ? Number(syncPotFields(match).winnerPayout || 0) : 0;

      stats.gamesPlayed = Number(stats.gamesPlayed || 0) + 1;
      if (match.mode === 'tournament' || match.tournamentId) {
        stats.tournamentMatches = Number(stats.tournamentMatches || 0) + 1;
        if (won) stats.tournamentWins = Number(stats.tournamentWins || 0) + 1;
      }
      if (won) {
        stats.wins = Number(stats.wins || 0) + 1;
        stats.currentWinStreak = Number(stats.currentWinStreak || 0) + 1;
        stats.longestWinStreak = Math.max(Number(stats.longestWinStreak || stats.bestStreak || 0), Number(stats.currentWinStreak || 0));
        stats.bestStreak = stats.longestWinStreak;
      } else {
        stats.losses = Number(stats.losses || 0) + 1;
        stats.currentWinStreak = 0;
      }
      stats.xpEarned = Number(stats.xpEarned || 0) + xpEarned;
      const tableStats = applyTableStats(user, match, won, xpEarned, rewardAmount);
      applyLevelProgress(user, xpEarned);
      applyPassXpToUser(user, won ? passXpSources.winMatch : passXpSources.playMatch, won ? 'match_win' : 'match_play', {
        matchId: match.id,
        mode: match.mode || 'quick',
        tableId: match.tableId || null,
        tableName: match.tableName || null,
      });

      match.result = match.result || {};
      match.result.playerResults = match.result.playerResults || {};
      match.result.playerResults[userId] = {
        userId,
        username: user.username,
        outcome: won ? 'win' : 'loss',
        xpEarned,
        reward: rewardAmount,
        currentWinStreak: Number(stats.currentWinStreak || 0),
        longestWinStreak: Number(stats.longestWinStreak || 0),
        favoriteTableId: stats.favoriteTableId || null,
        favoriteTableName: stats.favoriteTableName || null,
        tableStats,
      };

      await store.saveUser(user);
    }
    match.statsApplied = true;
  }

  match.result = {
    ...(match.result || {}),
    matchId: match.id,
    status: 'finished',
    winnerId: match.winnerId,
    loserId: match.loserId,
    tournamentId: match.tournamentId || null,
    tournamentName: match.tournamentName || null,
    eventId: match.eventId || null,
    eventTitle: match.eventTitle || null,
    rewardApplied: Boolean(match.rewardApplied),
    statsApplied: Boolean(match.statsApplied),
    reward: match.winnerId && !isBotId(match.winnerId) ? Number(match.winnerPayout || 0) : 0,
    pot: match.pot || calculateMatchPot(match),
    grossPot: match.grossPot || 0,
    platformFee: match.platformFee || 0,
    netPot: match.netPot || 0,
    winnerPayout: match.winnerPayout || 0,
    settlementStatus: match.settlementStatus || SETTLEMENT_PENDING,
    settlement: match.settlement || null,
    ...resultTableFields(match),
  };

  syncSettlementFields(match);

  const savedMatch = await store.saveMatch(match);

  if (match.roomId && store.saveRoom) {
    const room = await store.findRoom(match.roomId);
    if (room) {
      await store.saveRoom({
        ...room,
        status: 'finished',
        matchId: match.id,
        updatedAt: nowIso(),
      });
    }
  }

  return savedMatch;
}


export async function activateCountdownMatch(match) {
  if (!match) throw notFound('Match not found');
  if (match.status === 'active') return match;
  if (match.status !== 'countdown') throw badRequest('Match is not waiting to start');
  syncSettlementFields(match);
  if (match.settlementStatus === SETTLEMENT_REFUNDED || match.settlementStatus === SETTLEMENT_SETTLED) {
    throw badRequest('Closed settlements cannot be activated');
  }

  match.status = 'active';
  match.startedAt = nowIso();
  match.roundStartedAt = match.startedAt;
  match.countdownFinishedAt = match.startedAt;
  match.settlementStatus = SETTLEMENT_PENDING;
  syncSettlementFields(match);
  match.roundPhase = 'dice_ready';
  match.cupShaken = true;
  match.cupShakenAt = match.startedAt;
  match.dicePerRound = FIXED_DICE_PER_ROUND;
  for (const player of match.players || []) normalizePlayerRuntime(player, match);
  match.roundResult = null;
  match.lastRoundResult = null;
  setTurnTimer(match);
  pushLog(match, { type: 'match_started', by: 'system' });
  return store.saveMatch(match);
}

export async function cancelPendingMatchAndRefund(match, cancelledByUserId, reason = 'matchmaking_cancelled_before_start') {
  if (!match) throw notFound('Match not found');
  syncSettlementFields(match);
  if (match.status !== 'countdown') throw badRequest('Only countdown matches can be cancelled with refund');
  if (match.rewardApplied || match.potPaid || match.settlementStatus === SETTLEMENT_SETTLED) {
    throw badRequest('Settled matches cannot be refunded');
  }

  const entryFee = Math.max(0, Number(match.entryFee || match.pricing?.entryFee || 0));
  const refundResults = {};

  if (!match.entryFeesRefunded && match.settlementStatus !== SETTLEMENT_REFUNDED && entryFee > 0) {
    for (const userId of humanPlayerIds(match)) {
      const alreadyRefunded = await listWalletTransactionsFor(userId, { referenceId: match.id, types: ['match_buy_in_refund', 'match_entry_refund'] });
      if (alreadyRefunded.length) {
        const user = await store.requireUser(userId);
        refundResults[userId] = {
          coins: entryFee,
          alreadyRefunded: true,
          transactionIds: alreadyRefunded.map((row) => row.id).filter(Boolean),
          wallet: store.walletView ? store.walletView(user) : user.wallet,
        };
        continue;
      }

      const walletUpdate = await store.adjustWallet(userId, {
        coins: entryFee,
        type: 'match_buy_in_refund',
        reason: 'Match buy-in refund before start',
        referenceId: match.id,
        metadata: {
          matchId: match.id,
          cancelledByUserId,
          reason,
          tableId: match.tableId || null,
          tableName: match.tableName || null,
          tableTier: match.tableTier || null,
        },
      });
      const refundedUser = walletUpdate.user;
      refundedUser.stats = refundedUser.stats || {};
      refundedUser.stats.coinsSpent = Math.max(0, Number(refundedUser.stats.coinsSpent || 0) - entryFee);
      await store.saveUser(refundedUser);
      refundResults[userId] = {
        coins: entryFee,
        alreadyRefunded: false,
        transactionIds: (walletUpdate.transactions || []).map((row) => row.id).filter(Boolean),
        wallet: walletUpdate.wallet || (store.walletView ? store.walletView(refundedUser) : refundedUser.wallet),
      };
    }
  }

  match.status = 'cancelled';
  match.cancelledAt = nowIso();
  match.cancelledBy = cancelledByUserId || null;
  match.cancelledReason = reason;
  match.entryFeesRefunded = true;
  match.entryFeesRefundedAt = nowIso();
  match.refundedAt = match.entryFeesRefundedAt;
  match.settlementStatus = SETTLEMENT_REFUNDED;
  match.refundResults = refundResults;
  syncSettlementFields(match);
  match.lastAction = { type: 'cancelled_before_start', by: cancelledByUserId || 'system', reason, refundResults };
  pushLog(match, match.lastAction);

  const savedMatch = await store.saveMatch(match);

  for (const userId of humanPlayerIds(savedMatch)) {
    if (store.setLatestMatchForUser) await store.setLatestMatchForUser(userId, null);
  }

  return savedMatch;
}

export async function applyMatchAction(match, user, action = {}) {
  normalizeMatchRuntime(match);
  assertMatchCanAcceptGameplayAction(match);
  assertPlayerInMatch(match, user.id);

  const type = String(action.type || action.action || '').toLowerCase();
  user.stats = user.stats || {};

  if (type === 'raise_bid' || type === 'confirm' || type === 'bid') {
    assertPlayerCanAct(match, user.id);
    assertPlayerTurn(match, user.id);
    applyBidToMatch(match, { ...user, id: user.id, userId: user.id, isBot: false }, extractBid(action));
    match.lastAction = { type: 'bid', by: user.id, bid: match.currentBid };

    user.stats.bidsPlaced = Number(user.stats.bidsPlaced || 0) + 1;
    pushLog(match, match.lastAction);
    await store.saveUser(user);

    return store.saveMatch(match);
  }

  if (type === 'call_lira' || type === 'call_liar' || type === 'challenge' || type === 'call') {
    assertPlayerCanAct(match, user.id);
    assertPlayerTurn(match, user.id);
    user.stats.liarCalls = Number(user.stats.liarCalls || 0) + 1;
    await store.saveUser(user);

    const resolvedMatch = resolveCallLiarRound(match, user.id);
    if (resolvedMatch.status === 'finished') {
      return finalizeMatch(resolvedMatch, user, { reason: 'last_player_with_stack' });
    }

    return store.saveMatch(resolvedMatch);
  }

  if (type === 'timeout' || type === 'turn_timeout') {
    assertPlayerCanAct(match, user.id);
    assertPlayerTurn(match, user.id);
    const resolvedMatch = resolveTurnTimeoutRound(match, user.id);
    if (resolvedMatch.status === 'finished') {
      return finalizeMatch(resolvedMatch, user, { reason: 'last_player_with_stack' });
    }
    return store.saveMatch(resolvedMatch);
  }

  if (type === 'slam') {
    assertPlayerCanAct(match, user.id);
    assertPlayerTurn(match, user.id);
    if (match.gameRules?.slamEnabled !== true) throw badRequest('Slam is disabled in official rules');
    user.stats.slams = Number(user.stats.slams || 0) + 1;
    await store.saveUser(user);

    const resolvedMatch = resolveSlamRound(match, user.id);
    if (resolvedMatch.status === 'finished') {
      return finalizeMatch(resolvedMatch, user, { reason: 'last_player_with_stack' });
    }

    return store.saveMatch(resolvedMatch);
  }

  if (type === 'reroll') {
    assertPlayerCanAct(match, user.id);
    assertPlayerTurn(match, user.id);
    const rerolledMatch = applyReroll(match, user.id);
    return store.saveMatch(rerolledMatch);
  }

  if (type === 'finish' || type === 'result') {
    throw forbidden('Client-side match result actions are disabled. Results must be produced by server gameplay logic.');
  }

  if (type === 'leave' || type === 'forfeit') {
    assertPlayerCanAct(match, user.id, { allowForfeit: true });
    const resolvedMatch = applyForfeit(match, user.id, action.reason || 'player_left');
    if (resolvedMatch.status === 'finished') {
      const finalizedMatch = await finalizeMatch(resolvedMatch, user, { reason: action.reason || 'player_left' });
      if (store.setLatestMatchForUser) await store.setLatestMatchForUser(user.id, null);
      return finalizedMatch;
    }

    const savedMatch = await store.saveMatch(resolvedMatch);
    if (store.setLatestMatchForUser) await store.setLatestMatchForUser(user.id, null);
    return savedMatch;
  }

  throw badRequest(`Unsupported match action: ${action.type || action.action || 'unknown'}`);
}

export async function forceFinishMatch() {
  throw forbidden('Forced match results are disabled. Finish matches through call liar, timeout, forfeit, or stack-zero server logic.');
}

export function serializeMatch(match, viewerId) {
  return publicMatch(match, viewerId);
}
