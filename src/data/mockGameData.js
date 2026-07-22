const MOCK_USER_ID = 'mock-you';
const STATIC_BET = 100;
const BUY_IN = 500;
const PEK_PERCENTAGE = 50;
const PLAYER_COUNT = 4;
const DICE_PER_PLAYER = 5;

function nowIso() {
  return new Date().toISOString();
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function playerId(player = {}) {
  return player.id || player.userId || player.playerId || player._id || null;
}

function playerName(player = {}, fallback = 'Player') {
  return player.displayName || player.username || player.name || fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeJokerMode(source = {}) {
  const rawMode = String(source.jokerMode || source.wildMode || source.onesMode || '').toLowerCase();
  if (source.fei || source.isFei || source.chai || source.isChai || rawMode === 'fei' || rawMode === 'chai' || rawMode === 'joker_on') return 'fei';
  if (source.zai || source.isZai || Number(source.face) === 1 || rawMode === 'zai' || rawMode === 'zai_locked' || rawMode === 'ones_locked' || rawMode === 'joker_off') return 'zai';
  return 'normal';
}

function countBidDice(players = [], bid = {}, match = {}) {
  const face = asNumber(bid.face, 1);
  const mode = normalizeJokerMode({ ...match, ...bid });
  const onesAreWild = mode === 'normal' || mode === 'fei';

  return players.reduce((total, player) => {
    const dice = Array.isArray(player.dice) ? player.dice : [];
    return total + dice.reduce((count, value) => {
      const die = asNumber(value, 0);
      if (die === face) return count + 1;
      if (face !== 1 && die === 1 && onesAreWild) return count + 1;
      return count;
    }, 0);
  }, 0);
}

function countWildOnes(players = [], bid = {}, match = {}) {
  const face = asNumber(bid.face, 1);
  const mode = normalizeJokerMode({ ...match, ...bid });
  if (face === 1 || !(mode === 'normal' || mode === 'fei')) return 0;
  return players.reduce((total, player) => total + (Array.isArray(player.dice) ? player.dice.filter((die) => Number(die) === 1).length : 0), 0);
}

const mockPlayers = [
  {
    id: MOCK_USER_ID,
    userId: MOCK_USER_ID,
    username: 'You',
    displayName: 'You',
    avatarId: 'icc1.png',
    dice: [3, 3, 2, 1, 5],
    diceCount: DICE_PER_PLAYER,
    lives: DICE_PER_PLAYER,
    active: true,
    stack: 5100,
  },
  {
    id: 'mock-sophie',
    userId: 'mock-sophie',
    username: 'Sophie',
    displayName: 'Sophie',
    avatarId: 'icc4.png',
    dice: [3, 1, 6, 3, 2],
    diceCount: DICE_PER_PLAYER,
    lives: DICE_PER_PLAYER,
    active: true,
    stack: 4900,
  },
  {
    id: 'mock-dragon',
    userId: 'mock-dragon',
    username: 'Dragon Bot',
    displayName: 'Dragon Bot',
    avatarId: 'icc6.png',
    dice: [4, 4, 1, 2, 6],
    diceCount: DICE_PER_PLAYER,
    lives: DICE_PER_PLAYER,
    active: true,
    isBot: true,
    botDifficulty: 'normal',
    stack: 5000,
  },
  {
    id: 'mock-gad',
    userId: 'mock-gad',
    username: 'Gad Bot',
    displayName: 'Gad Bot',
    avatarId: 'icc2.png',
    dice: [3, 5, 1, 2, 6],
    diceCount: DICE_PER_PLAYER,
    lives: DICE_PER_PLAYER,
    active: true,
    isBot: true,
    botDifficulty: 'normal',
    stack: 5000,
  },
];

function buildRevealedDice(players = mockPlayers) {
  return players.map((player) => ({
    id: player.id,
    userId: player.userId,
    username: player.username,
    displayName: player.displayName,
    avatarId: player.avatarId,
    isBot: Boolean(player.isBot),
    dice: Array.isArray(player.dice) ? [...player.dice] : [],
  }));
}

const mockCurrentBid = {
  quantity: 6,
  face: 3,
  coinBet: STATIC_BET,
  coinAmount: STATIC_BET,
  betAmount: STATIC_BET,
  playerId: 'mock-sophie',
  userId: 'mock-sophie',
  bidderUserId: 'mock-sophie',
  bidderName: 'Sophie',
  zai: true,
  isZai: true,
  fei: false,
  isFei: false,
  jokerMode: 'zai',
  jokerWildActive: false,
  createdAt: nowIso(),
};

const mockRoundResult = {
  id: 'mock-round-result-zai-transfer',
  roundNumber: 5,
  challengeType: 'call_liar',
  actionType: 'call_liar',
  challengerId: MOCK_USER_ID,
  challengerName: 'You',
  bidderId: 'mock-sophie',
  bidderName: 'Sophie',
  bidWasTrue: false,
  loserId: 'mock-sophie',
  loserName: 'Sophie',
  winnerId: MOCK_USER_ID,
  winnerName: 'You',
  challengeAmount: STATIC_BET,
  riskAmount: STATIC_BET,
  stackLost: STATIC_BET,
  lossAmount: STATIC_BET,
  stackTransferred: true,
  transferAmount: STATIC_BET,
  transferFromUserId: 'mock-sophie',
  transferFromName: 'Sophie',
  transferToUserId: MOCK_USER_ID,
  transferToName: 'You',
  winnerBeforeStack: 5000,
  winnerAfterStack: 5100,
  loserBeforeStack: 5000,
  loserAfterStack: 4900,
  walletTouched: false,
  settlementScope: 'match_stack_only',
  bid: mockCurrentBid,
  actualCount: countBidDice(mockPlayers, mockCurrentBid),
  wildOnesCount: countWildOnes(mockPlayers, mockCurrentBid),
  jokerMode: 'zai',
  jokerWildActive: false,
  zaiActive: true,
  feiActive: false,
  jokerLockedThisRound: false,
  jokerLockReason: null,
  onesWereCalledThisRound: false,
  revealedDice: buildRevealedDice(mockPlayers),
  createdAt: nowIso(),
};

function buildMockMatch(overrides = {}) {
  const players = clone(overrides.players || mockPlayers);
  const currentBid = clone(overrides.currentBid || mockCurrentBid);
  const actualCount = countBidDice(players, currentBid, { jokerMode: currentBid.jokerMode });
  const wildOnesCount = countWildOnes(players, currentBid, { jokerMode: currentBid.jokerMode });

  return {
    id: 'mock-match-static-zai-fei',
    matchId: 'mock-match-static-zai-fei',
    roomId: 'mock-room-bots-direct',
    roomCode: 'MOCK-PEK',
    status: 'active',
    matchStatus: 'ACTIVE',
    stage: 'bots_match_started',
    directStart: true,
    shouldEnterGame: true,
    skipMatchmaking: true,
    nextScreen: 'gameplay',
    roundNumber: 5,
    turnTimer: 28,
    turnTimeRemainingMs: 28000,
    turnStartedAt: nowIso(),
    totalDiceInPlay: players.reduce((total, player) => total + asNumber(player.diceCount, DICE_PER_PLAYER), 0),
    playerCount: PLAYER_COUNT,
    selectedPlayers: PLAYER_COUNT,
    requiredPlayers: PLAYER_COUNT,
    minPlayers: PLAYER_COUNT,
    maxPlayers: PLAYER_COUNT,
    dicePerPlayer: DICE_PER_PLAYER,
    startingStack: 5000,
    turnPlayerId: MOCK_USER_ID,
    activePlayerId: MOCK_USER_ID,
    myTurn: true,
    currentBid,
    previousBid: {
      quantity: 5,
      face: 2,
      coinBet: STATIC_BET,
      coinAmount: STATIC_BET,
      betAmount: STATIC_BET,
      playerId: 'mock-gad',
      bidderName: 'Gad Bot',
      jokerMode: 'normal',
      jokerWildActive: true,
    },
    coinBet: STATIC_BET,
    currentCoinBet: STATIC_BET,
    currentRoundCoinBet: STATIC_BET,
    defaultCoinBet: STATIC_BET,
    minCoinBet: STATIC_BET,
    maxCoinBet: STATIC_BET,
    coinBetOptions: [STATIC_BET],
    perGameAmount: STATIC_BET,
    perGameMode: 'static',
    totalPot: 0,
    grossPot: 0,
    table: {
      id: 'private',
      key: 'private',
      title: 'PRIVATE ROOM',
      minPlayers: 2,
      maxPlayers: 4,
      selectedPlayers: PLAYER_COUNT,
      buyInAmount: BUY_IN,
      entryFee: BUY_IN,
      defaultCoinBet: STATIC_BET,
      pekEnabled: true,
      slamEnabled: true,
      pekPercentage: PEK_PERCENTAGE,
    },
    pricing: {
      entryFee: BUY_IN,
      buyInAmount: BUY_IN,
      startingStack: 5000,
      perGameMode: 'static',
      minCoinBet: STATIC_BET,
      maxCoinBet: STATIC_BET,
      defaultCoinBet: STATIC_BET,
      coinBetOptions: [STATIC_BET],
      pekEnabled: true,
      slamEnabled: true,
      pekPercentage: PEK_PERCENTAGE,
      slamPercentage: PEK_PERCENTAGE,
      finalPekAmount: STATIC_BET + Math.floor((STATIC_BET * PEK_PERCENTAGE) / 100),
      finalSlamAmount: STATIC_BET + Math.floor((STATIC_BET * PEK_PERCENTAGE) / 100),
    },
    bidControls: {
      perGameMode: 'static',
      minCoinBet: STATIC_BET,
      maxCoinBet: STATIC_BET,
      defaultCoinBet: STATIC_BET,
      coinBetOptions: [STATIC_BET],
      openingBidRules: {
        playerCount: PLAYER_COUNT,
        minOnesQuantity: 4,
        minOpenQuantity: 6,
      },
      feiQuantityStep: 2,
      zaiEnabled: true,
      feiEnabled: true,
      jokerRulesEnabled: true,
      pekOptions: [25, 50, 100],
      selectedPekPercentage: PEK_PERCENTAGE,
    },
    openingBidRules: {
      playerCount: PLAYER_COUNT,
      minOnesQuantity: 4,
      minOpenQuantity: 6,
    },
    feiQuantityStep: 2,
    jokerMode: 'zai',
    zaiActive: true,
    feiActive: false,
    jokerWildActive: false,
    jokerLockedThisRound: false,
    jokerLockReason: null,
    onesWereCalledThisRound: false,
    wildOnesCount,
    actualCount,
    gameRules: {
      mode: 'official_rules',
      bidStyle: 'Official Rules',
      startingDice: DICE_PER_PLAYER,
      dicePerPlayer: DICE_PER_PLAYER,
      dicePerRound: DICE_PER_PLAYER,
      cupPerPlayer: 1,
      wildDice: true,
      onesAreWild: true,
      onesDisableAfterCalled: true,
      zaiEnabled: true,
      feiEnabled: true,
      feiQuantityStep: 2,
      jokerMode: 'zai',
      openingBidRules: {
        playerCount: PLAYER_COUNT,
        minOnesQuantity: 4,
        minOpenQuantity: 6,
      },
      coinBidEnabled: true,
      requiresCoinBid: true,
      perGameMode: 'static',
      minBidCoins: STATIC_BET,
      maxBidCoins: STATIC_BET,
      bidCoinStep: STATIC_BET,
      pekEnabled: true,
      slamEnabled: true,
      pekPercentage: PEK_PERCENTAGE,
      slamPercentage: PEK_PERCENTAGE,
      finalPekAmount: STATIC_BET + Math.floor((STATIC_BET * PEK_PERCENTAGE) / 100),
      finalSlamAmount: STATIC_BET + Math.floor((STATIC_BET * PEK_PERCENTAGE) / 100),
    },
    lastAction: {
      type: 'bid',
      by: 'mock-sophie',
      playerId: 'mock-sophie',
      label: 'Sophie placed 6 x 3 ZAI',
      createdAt: nowIso(),
    },
    availableActions: ['bid', 'call_liar', 'call_pek', 'pek', 'slam'],
    disabledActions: [],
    roundResult: clone(overrides.roundResult || mockRoundResult),
    me: {
      id: MOCK_USER_ID,
      userId: MOCK_USER_ID,
      username: 'You',
      displayName: 'You',
      avatarId: 'icc1.png',
    },
    viewer: {
      id: MOCK_USER_ID,
      userId: MOCK_USER_ID,
      username: 'You',
      displayName: 'You',
      avatarId: 'icc1.png',
    },
    players,
    ...overrides,
  };
}

export function createMockGameplayData(overrides = {}) {
  const match = buildMockMatch(overrides.match || {});
  return {
    user: {
      id: MOCK_USER_ID,
      userId: MOCK_USER_ID,
      username: 'You',
      displayName: 'You',
      avatarId: 'icc1.png',
      level: 23,
      xp: '1450 / 2500',
    },
    wallet: {
      coins: '125,680',
      gems: '2,350',
    },
    selectedTable: {
      id: 'private',
      key: 'private',
      title: 'PRIVATE ROOM',
      selectedPlayers: PLAYER_COUNT,
      maxPlayers: PLAYER_COUNT,
      pekPercentage: PEK_PERCENTAGE,
    },
    currentRoom: {
      id: 'mock-room-bots-direct',
      roomId: 'mock-room-bots-direct',
      roomCode: 'MOCK-PEK',
      roomMode: 'bots',
      gameMode: 'bots',
      playMode: 'bots',
      botsEnabled: true,
      botCount: PLAYER_COUNT - 1,
      status: 'in_match',
      selectedPlayers: PLAYER_COUNT,
      maxPlayers: PLAYER_COUNT,
    },
    currentRoomId: 'mock-room-bots-direct',
    currentRoomCode: 'MOCK-PEK',
    currentMatchId: match.matchId,
    roundResult: match.roundResult,
    match,
    chatMessages: [
      { id: 'mock-chat-1', userId: 'mock-sophie', username: 'Sophie', text: 'ZAI is active. 1s are not wild for this bid.', createdAt: nowIso() },
      { id: 'mock-chat-2', userId: MOCK_USER_ID, username: 'You', text: 'Call liar transfers the lost stack to the challenge winner.', createdAt: nowIso() },
    ],
    chatStatus: { loading: false, sending: false, error: null },
    ...overrides,
  };
}

function getMockViewerPlayer(match = {}) {
  return (match.players || []).find((player) => playerId(player) === MOCK_USER_ID) || match.players?.[0] || null;
}

function getMockBidderPlayer(match = {}) {
  const bid = match.currentBid || {};
  const bidRefs = [bid.playerId, bid.userId, bid.bidderUserId].filter(Boolean).map(String);
  return (match.players || []).find((player) => bidRefs.includes(String(playerId(player)))) || match.players?.find((player) => playerId(player) !== MOCK_USER_ID) || null;
}

function transferStack(players = [], fromId, toId, amount) {
  let fromBefore = 0;
  let fromAfter = 0;
  let toBefore = 0;
  let toAfter = 0;

  const nextPlayers = players.map((player) => {
    const id = playerId(player);
    if (id === fromId) {
      fromBefore = asNumber(player.stack, 0);
      fromAfter = Math.max(0, fromBefore - amount);
      return { ...player, stack: fromAfter, bustedBelowMinimumBid: fromAfter > 0 && fromAfter < STATIC_BET };
    }
    if (id === toId) {
      toBefore = asNumber(player.stack, 0);
      toAfter = toBefore + amount;
      return { ...player, stack: toAfter };
    }
    return player;
  });

  return { players: nextPlayers, fromBefore, fromAfter, toBefore, toAfter };
}

function applyMockBid(match = {}, action = {}) {
  const incomingBid = action.bid || action;
  const currentBid = {
    quantity: asNumber(incomingBid.quantity, 1),
    face: asNumber(incomingBid.face, 1),
    coinBet: asNumber(incomingBid.coinBet ?? incomingBid.coinAmount ?? incomingBid.betAmount, STATIC_BET),
    coinAmount: asNumber(incomingBid.coinAmount ?? incomingBid.coinBet ?? incomingBid.betAmount, STATIC_BET),
    betAmount: asNumber(incomingBid.betAmount ?? incomingBid.coinBet ?? incomingBid.coinAmount, STATIC_BET),
    playerId: MOCK_USER_ID,
    userId: MOCK_USER_ID,
    bidderUserId: MOCK_USER_ID,
    bidderName: 'You',
    zai: Boolean(incomingBid.zai || incomingBid.isZai),
    isZai: Boolean(incomingBid.zai || incomingBid.isZai),
    fei: Boolean(incomingBid.fei || incomingBid.isFei),
    isFei: Boolean(incomingBid.fei || incomingBid.isFei),
    jokerMode: incomingBid.jokerMode || (incomingBid.zai || incomingBid.isZai ? 'zai' : incomingBid.fei || incomingBid.isFei ? 'fei' : Number(incomingBid.face) === 1 ? 'zai' : 'normal'),
    jokerWildActive: Boolean(incomingBid.jokerWildActive ?? !(incomingBid.zai || incomingBid.isZai || Number(incomingBid.face) === 1)),
    createdAt: nowIso(),
  };
  const mode = normalizeJokerMode(currentBid);
  const actualCount = countBidDice(match.players || [], currentBid, { jokerMode: mode });
  const wildOnesCount = countWildOnes(match.players || [], currentBid, { jokerMode: mode });

  return {
    ...match,
    currentBid,
    previousBid: match.currentBid || null,
    turnPlayerId: 'mock-sophie',
    activePlayerId: 'mock-sophie',
    myTurn: false,
    jokerMode: mode,
    zaiActive: mode === 'zai',
    feiActive: mode === 'fei',
    jokerWildActive: mode === 'normal' || mode === 'fei',
    jokerLockedThisRound: false,
    onesWereCalledThisRound: false,
    wildOnesCount,
    actualCount,
    roundResult: null,
    lastAction: {
      type: 'bid',
      by: MOCK_USER_ID,
      playerId: MOCK_USER_ID,
      label: `You placed ${currentBid.quantity} x ${currentBid.face}${mode === 'zai' ? ' ZAI' : mode === 'fei' ? ' FEI' : ''}`,
      createdAt: nowIso(),
    },
  };
}

function applyMockChallenge(match = {}, action = {}) {
  const isPek = ['pek', 'call_pek', 'slam', 'call_slam'].includes(String(action.type || '').toLowerCase());
  const bid = match.currentBid || mockCurrentBid;
  const players = match.players || [];
  const viewer = getMockViewerPlayer(match);
  const bidder = getMockBidderPlayer(match);
  const actualCount = countBidDice(players, bid, match);
  const wildOnesCount = countWildOnes(players, bid, match);
  const bidWasTrue = actualCount >= asNumber(bid.quantity, 1);
  const baseAmount = isPek ? asNumber(match.pricing?.finalPekAmount ?? match.gameRules?.finalPekAmount, STATIC_BET) : asNumber(bid.coinBet ?? bid.coinAmount ?? match.coinBet, STATIC_BET);
  const loser = bidWasTrue ? viewer : bidder;
  const winner = bidWasTrue ? bidder : viewer;
  const loserId = playerId(loser);
  const winnerId = playerId(winner);
  const transfer = transferStack(players, loserId, winnerId, baseAmount);
  const roundResult = {
    id: `mock-result-${Date.now()}`,
    roundNumber: asNumber(match.roundNumber, 1),
    challengeType: isPek ? 'call_pek' : 'call_liar',
    actionType: isPek ? 'call_pek' : 'call_liar',
    isPek,
    isSlam: isPek,
    challengerId: MOCK_USER_ID,
    challengerName: 'You',
    bidderId: playerId(bidder),
    bidderName: playerName(bidder, 'Bidder'),
    bidWasTrue,
    loserId,
    loserName: playerName(loser, 'Player'),
    winnerId,
    winnerName: playerName(winner, 'Winner'),
    challengeAmount: baseAmount,
    riskAmount: baseAmount,
    stackLost: baseAmount,
    lossAmount: baseAmount,
    finalPekAmount: isPek ? baseAmount : undefined,
    stackTransferred: true,
    transferAmount: baseAmount,
    transferFromUserId: loserId,
    transferFromName: playerName(loser, 'Player'),
    transferToUserId: winnerId,
    transferToName: playerName(winner, 'Winner'),
    winnerBeforeStack: transfer.toBefore,
    winnerAfterStack: transfer.toAfter,
    loserBeforeStack: transfer.fromBefore,
    loserAfterStack: transfer.fromAfter,
    walletTouched: false,
    settlementScope: 'match_stack_only',
    bid,
    actualCount,
    wildOnesCount,
    jokerMode: normalizeJokerMode({ ...match, ...bid }),
    jokerWildActive: normalizeJokerMode({ ...match, ...bid }) === 'normal' || normalizeJokerMode({ ...match, ...bid }) === 'fei',
    zaiActive: normalizeJokerMode({ ...match, ...bid }) === 'zai',
    feiActive: normalizeJokerMode({ ...match, ...bid }) === 'fei',
    jokerLockedThisRound: false,
    jokerLockReason: null,
    onesWereCalledThisRound: false,
    revealedDice: buildRevealedDice(transfer.players),
    createdAt: nowIso(),
  };

  return {
    ...match,
    players: transfer.players,
    roundResult,
    lastRoundResult: roundResult,
    turnPlayerId: winnerId || MOCK_USER_ID,
    activePlayerId: winnerId || MOCK_USER_ID,
    myTurn: winnerId === MOCK_USER_ID,
    roundNumber: asNumber(match.roundNumber, 1) + 1,
    lastAction: {
      type: isPek ? 'call_pek' : 'call_liar',
      by: MOCK_USER_ID,
      playerId: MOCK_USER_ID,
      label: isPek ? 'You called Pek/Slam' : 'You called liar',
      createdAt: nowIso(),
    },
  };
}

export function applyMockGameAction(currentData = mockGameData, action = {}) {
  const match = currentData.match || buildMockMatch();
  const actionType = String(action.type || '').toLowerCase();

  if (actionType === 'bid') {
    const nextMatch = applyMockBid(match, action);
    return { ...currentData, match: nextMatch, roundResult: null, currentMatchId: nextMatch.matchId };
  }

  if (['call_liar', 'call_lira', 'call_pek', 'pek', 'slam', 'call_slam'].includes(actionType)) {
    const nextMatch = applyMockChallenge(match, action);
    return { ...currentData, match: nextMatch, roundResult: nextMatch.roundResult, currentMatchId: nextMatch.matchId };
  }

  return currentData;
}

export function createMockBackendActions(setMockGameData) {
  const update = (producer) => new Promise((resolve) => {
    setMockGameData((current) => {
      const next = producer(current || createMockGameplayData());
      resolve(next);
      return next;
    });
  });

  return {
    joinGameplaySocket: () => Promise.resolve(null),
    stopGameplaySocket: () => null,
    refreshMatch: () => update((current) => current),
    submitGameAction: (action) => update((current) => applyMockGameAction(current, action)),
    leaveMatch: () => update(() => createMockGameplayData()),
    loadChatHistory: () => Promise.resolve([]),
    sendChatMessage: ({ text } = {}) => update((current) => ({
      ...current,
      chatMessages: [
        ...(current.chatMessages || []),
        {
          id: `mock-chat-${Date.now()}`,
          userId: MOCK_USER_ID,
          username: 'You',
          text: String(text || '').slice(0, 200),
          createdAt: nowIso(),
        },
      ],
      chatStatus: { loading: false, sending: false, error: null },
    })),
  };
}

export const mockGameData = createMockGameplayData();

export const mockBackendActions = {
  joinGameplaySocket: () => Promise.resolve(null),
  stopGameplaySocket: () => null,
  refreshMatch: () => Promise.resolve(mockGameData),
  submitGameAction: (action) => Promise.resolve(applyMockGameAction(mockGameData, action)),
  leaveMatch: () => Promise.resolve(createMockGameplayData()),
  loadChatHistory: () => Promise.resolve([]),
  sendChatMessage: () => Promise.resolve(null),
};
