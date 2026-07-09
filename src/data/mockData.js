export const mockUser = {
  id: 'mock-user-001',
  username: 'EMMA',
  displayName: 'Emma',
  avatar: 'icc1.png',
  eventAvatar: 'icc1.png',
  level: 23,
  xp: 1450,
  nextLevelXp: 2500,
  rankProgress: 15,
};

export const mockWallet = {
  coins: '125,680',
  gems: '2,350',
};

export const mockMainMenuCards = {
  daily: {
    header: 'DAILY REWARDS',
    copy: 'Come back bigger\nrewards!',
    cta: 'CLAIM',
  },
  pass: {
    header: 'LUCKY PASS',
    copy: 'Jump into a quick game',
    cta: 'VIEW PASS',
  },
  tournaments: {
    header: 'TOURNAMENTS',
    copy: 'Compete for big prizes!',
    cta: 'ENTER',
  },
  events: {
    header: 'SPECIAL EVENTS',
    copy: 'Join events, win more!',
    cta: 'SEE EVENTS',
  },
};

export const mockDailyRewards = [
  { id: 'day1', key: 'day1', day: 'Day 1', card: 'd11.png', type: 'coins', amount: 500, status: 'Claimed', state: 'claimed' },
  { id: 'day2', key: 'day2', day: 'Day 2', card: 'd22.png', type: 'coins', amount: 1000, status: 'Claimed', state: 'claimed' },
  { id: 'day3', key: 'day3', day: 'Day 3', card: 'd33.png', type: 'coins', amount: 2000, status: 'Claim', state: 'claimable' },
  { id: 'day4', key: 'day4', day: 'Day 4', card: 'd44.png', type: 'coins', amount: 3500, status: 'Locked', state: 'locked' },
  { id: 'day5', key: 'day5', day: 'Day 5', card: 'd55.png', type: 'coins', amount: 5000, status: 'Locked', state: 'locked' },
  { id: 'day6', key: 'day6', day: 'Day 6', card: 'd66.png', type: 'gems', amount: 30, status: 'Locked', state: 'locked' },
  { id: 'day7', key: 'day7', day: 'Day 7', card: 'd77.png', type: 'bundle', amount: 0, coins: 7500, gems: 70, status: 'Locked', state: 'locked' },
];

export const mockDailyRewardSummary = {
  streak: 4,
  claimedToday: false,
  lastClaimAt: null,
  nextRewardAt: null,
  serverTime: null,
};

export const mockTransactions = [];

export const mockTournaments = [
  { id: 'bronze', key: 'bronze', card: 'Card1.png', button: '15.png', entry: '25,000', entryFee: 25000, prize: '100,000', prizePool: 100000, time: '02h 15m', players: '48 / 100', canEnter: true },
  { id: 'royal', key: 'royal', card: 'Card2.png', button: '13.png', entry: '100,000', entryFee: 100000, prize: '400,000', prizePool: 400000, time: '06h 45m', players: '128 / 200', canEnter: true },
  { id: 'grand', key: 'grand', card: 'Card3.png', button: '12.png', entry: '500,000', entryFee: 500000, prize: '5,000,000', prizePool: 5000000, time: '1d 12h', players: '257 / 500', canEnter: true },
];

export const mockTournamentPass = {
  xpLabel: 'PASS XP',
  passXp: 0,
  passLevel: 1,
  premiumUnlocked: false,
  premiumLocked: true,
  xpValueLabel: '0/0',
  xpText: '0/0',
  xpPercent: 0,
  levels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  premiumRewards: [
    { level: 1, track: 'premium', icon: 'ic1.png', value: '5K', locked: true, premiumLocked: true, claimable: false },
    { level: 2, track: 'premium', icon: 'ic3.png', value: '50', locked: true, premiumLocked: true, claimable: false },
    { level: 3, track: 'premium', icon: 'ic1.png', value: '7.5K', locked: true, premiumLocked: true, claimable: false },
    { level: 4, track: 'premium', icon: 'ic3.png', value: '75', locked: true, premiumLocked: true, claimable: false },
    { level: 5, track: 'premium', icon: 'ic1.png', value: '10K', locked: true, premiumLocked: true, claimable: false },
    { level: 6, track: 'premium', icon: 'ic3.png', value: '100', locked: true, premiumLocked: true, claimable: false },
    { level: 7, track: 'premium', icon: 'ic1.png', value: '15K', locked: true, premiumLocked: true, claimable: false },
    { level: 8, track: 'premium', icon: 'ic3.png', value: '125', locked: true, premiumLocked: true, claimable: false },
    { level: 9, track: 'premium', icon: 'ic1.png', value: '20K', locked: true, premiumLocked: true, claimable: false },
    { level: 10, track: 'premium', icon: 'ic3.png', value: '200', locked: true, premiumLocked: true, claimable: false },
  ],
  freeRewards: [
    { level: 1, track: 'free', icon: 'ic1.png', value: '1K', unlocked: true, locked: false, claimable: true },
    { level: 2, track: 'free', icon: 'ic3.png', value: '20', unlocked: false, locked: true, claimable: false },
    { level: 3, track: 'free', icon: 'ic1.png', value: '1.5K', unlocked: false, locked: true, claimable: false },
    { level: 4, track: 'free', icon: 'ic3.png', value: '25', unlocked: false, locked: true, claimable: false },
    { level: 5, track: 'free', icon: 'ic1.png', value: '2.5K', unlocked: false, locked: true, claimable: false },
    { level: 6, track: 'free', icon: 'ic3.png', value: '30', unlocked: false, locked: true, claimable: false },
    { level: 7, track: 'free', icon: 'ic1.png', value: '3K', unlocked: false, locked: true, claimable: false },
    { level: 8, track: 'free', icon: 'ic3.png', value: '35', unlocked: false, locked: true, claimable: false },
    { level: 9, track: 'free', icon: 'ic1.png', value: '5K', unlocked: false, locked: true, claimable: false },
    { level: 10, track: 'free', icon: 'ic3.png', value: '50', unlocked: false, locked: true, claimable: false },
  ],
};

export const mockSpecialEvents = [
  {
    id: 'golden', key: 'golden', skin: 'Card1.png', ribbon: 'LIMITED', ribbonClass: 'special-event-ribbon--limited',
    title: 'GOLDEN DICE RUSH', copy: 'Roll big, win bigger! Collect dice\nand claim amazing gold rewards.', time: '2d 14h',
    rewardLabel: 'FEATURED REWARD', rewardIcon: 'ic1.png', reward: '50,500', buttonSkin: '15.png', buttonClass: 'special-event-play--green',
  },
  {
    id: 'dragon', key: 'dragon', skin: 'Card2.png', ribbon: 'HOT', ribbonClass: 'special-event-ribbon--hot',
    title: 'DRAGON FORTUNE WEEK', copy: '', time: '5d 18h', rewardLabel: '', rewardIcon: 'ic2.png', reward: 'DRAGON CHEST',
    buttonSkin: '12.png', buttonClass: 'special-event-play--red',
  },
  {
    id: 'foxfire', key: 'foxfire', skin: 'Card3.png', ribbon: 'NEW', ribbonClass: 'special-event-ribbon--new',
    title: 'FOXFIRE FESTIVAL', copy: '', time: '1d 09h', rewardLabel: '', rewardIcon: 'ic3.png', reward: 'FOXFIRE PET',
    buttonSkin: '14.png', buttonClass: 'special-event-play--blue',
  },
];

export const mockEventMissions = [
  { id: 'win', key: 'win', icon: 'ic7.png', label: 'Win 3 Matches', progress: '2 / 3', coins: '2,000', fill: 66 },
  { id: 'call', key: 'call', icon: 'ic5.png', label: 'Call Lair 5 times', progress: '3 / 5', coins: '2,500', fill: 60 },
  { id: 'coin', key: 'coin', icon: 'ic4.png', label: 'Collect 100 coin', progress: '68 / 100', coins: '3,000', fill: 68 },
];

export const mockRooms = [
  {
    id: 'beginner', key: 'beginner', title: 'BEGINNER', card: 'card-1.png', tableArt: '213.png', button: '15.png',
    pricing: { entryFee: 50, buyInAmount: 50, minCoinBet: 5, maxCoinBet: 5, defaultCoinBet: 5, coinBetOptions: [5], perGameMode: 'static', pekEnabled: true, slamEnabled: true, pekPercentage: 25, slamPercentage: 25 },
    rewards: { xpWin: 50, xpLose: 15, rewardMultiplier: 1 },
    entryFee: 50, buyInAmount: 50, minCoinBet: 5, maxCoinBet: 5, defaultCoinBet: 5, coinBetOptions: [5], perGameMode: 'static', xpWin: 50, xpLose: 15, rewardMultiplier: 1, pekEnabled: true, slamEnabled: true, pekPercentage: 25, slamPercentage: 25, minPlayers: 2, maxPlayers: 4, selectedPlayers: 2,
    rows: [{ icon: 'IC1.png', text: '2 Players' }, { icon: 'IC3.png', text: 'PEK 25%' }, { icon: 'IC5.png', text: 'Bet 5' }],
  },
  {
    id: 'high-roller', key: 'high-roller', title: 'HIGH ROLLER', card: 'card-3.png', tableArt: '3323423.png', button: '12.png',
    pricing: { entryFee: 250, buyInAmount: 250, minCoinBet: 50, maxCoinBet: 50, defaultCoinBet: 50, coinBetOptions: [50], perGameMode: 'static', pekEnabled: true, slamEnabled: true, pekPercentage: 50, slamPercentage: 50 },
    rewards: { xpWin: 180, xpLose: 55, rewardMultiplier: 2 },
    entryFee: 250, buyInAmount: 250, minCoinBet: 50, maxCoinBet: 50, defaultCoinBet: 50, coinBetOptions: [50], perGameMode: 'static', xpWin: 180, xpLose: 55, rewardMultiplier: 2, pekEnabled: true, slamEnabled: true, pekPercentage: 50, slamPercentage: 50, minPlayers: 2, maxPlayers: 4, selectedPlayers: 2,
    rows: [{ icon: 'IC1.png', text: '2 Players' }, { icon: 'IC3.png', text: 'PEK 50%' }, { icon: 'IC5.png', text: 'Bet 50' }],
  },
  {
    id: 'private', key: 'private', title: 'PRIVATE ROOM', card: 'card-5.png', tableArt: '1232131.png', button: 'back-button.png',
    pricing: { entryFee: 500, buyInAmount: 500, minCoinBet: 100, maxCoinBet: 100, defaultCoinBet: 100, coinBetOptions: [100], perGameMode: 'static', pekEnabled: true, slamEnabled: true, pekPercentage: 25, slamPercentage: 25, pekOptions: [25, 50, 100] },
    rewards: { xpWin: 50, xpLose: 15, rewardMultiplier: 1 },
    entryFee: 500, buyInAmount: 500, minCoinBet: 100, maxCoinBet: 100, defaultCoinBet: 100, coinBetOptions: [100], perGameMode: 'static', xpWin: 50, xpLose: 15, rewardMultiplier: 1, pekEnabled: true, slamEnabled: true, pekPercentage: 25, slamPercentage: 25, pekOptions: [25, 50, 100], minPlayers: 2, maxPlayers: 4, selectedPlayers: 2,
    rows: [{ icon: 'IC1.png', text: '2 - 4 Players' }, { icon: 'IC3.png', text: 'PEK 25-100%' }, { icon: 'IC5.png', text: 'Bet 100' }],
  },
];

export const mockCreateRoomSettings = {
  roomName: 'Emma’s Room',
  players: ['2', '3', '4'],
  selectedPlayers: '2',
  cups: ['5'],
  selectedCups: '5',
  timers: ['20s', '25s', '30s'],
  selectedTimer: '30s',
  roomModes: ['normal', 'bots'],
  selectedRoomMode: 'bots',
  roomMode: 'bots',
  buyIn: 500,
  selectedBuyIn: 500,
  bet: 100,
  selectedBet: 100,
  pekOptions: [25, 50, 100],
  pekPercentage: 25,
  selectedPekPercentage: 25,
  perGameMode: 'static',
  isPrivate: true,
  roomCode: 'LD-4729',
  rulesCopy: 'Rules: 5 dice each • ZAI/CHAI enabled • PEK/SLAM always on • static bet only',
};


export const mockJoinRoom = {
  defaultCode: '',
  recentRooms: [
    { code: 'LD-4729', name: 'Emma’s Room', players: '3 / 4' },
    { code: 'LD-2814', name: 'Noah’s Room', players: '2 / 4' },
    { code: 'LD-9031', name: 'Luca’s Room', players: '1 / 4' },
  ],
};

export const mockMatchmaking = {
  filters: [
    { icon: '1.png', label: 'SELECTED MODE', value: 'QUICK MATCH' },
    { icon: '4.png', label: 'REGION', value: 'GLOBAL' },
    { icon: '5.png', label: 'EST. WAIT TIME', value: '7s' },
  ],
  metrics: [
    { type: 'players', icon: null, label: 'PLAYERS FOUND', value: '2 / 4' },
    { type: 'quality', icon: '8.png', label: 'MATCH QUALITY', value: 'EXCELLENT' },
    { type: 'fair', icon: '7.png', label: 'FAIR PLAY', value: 'Real players only' },
    { type: 'skill', icon: '6.png', label: 'SKILL BALANCE', value: 'GREAT MATCH' },
  ],
  steps: [
    { icon: '11.png', text: 'FINDING TABLE', sub: '✓' },
    { icon: '22.png', text: 'MATCHING PLAYERS', sub: '••••' },
    { icon: '33.png', text: 'JOINING ROOM', sub: '•••' },
  ],
};

export const initialGameData = {
  user: mockUser,
  wallet: mockWallet,
  mainMenuCards: mockMainMenuCards,
  dailyRewards: mockDailyRewards,
  dailyRewardSummary: mockDailyRewardSummary,
  transactions: mockTransactions,
  tournaments: mockTournaments,
  tournamentPass: mockTournamentPass,
  specialEvents: mockSpecialEvents,
  eventMissions: mockEventMissions,
  rooms: mockRooms,
  activeRooms: [],
  publicRooms: [],
  myRoom: null,
  currentRoom: null,
  currentRoomId: null,
  currentRoomCode: null,
  currentMatchId: null,
  match: null,
  createRoom: mockCreateRoomSettings,
  joinRoom: mockJoinRoom,
  matchmaking: mockMatchmaking,
};
