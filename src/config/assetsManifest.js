const ASSET_ROOT = '/assets/liars-dice';

export const ASSET_FOLDERS = {
  starter: `${ASSET_ROOT}/starter/`,
  loading: `${ASSET_ROOT}/loading/`,
  login: `${ASSET_ROOT}/login/`,
  mainMenu: `${ASSET_ROOT}/main-menu/`,
  roomSelect: `${ASSET_ROOT}/room-select/`,
  createRoom: `${ASSET_ROOT}/create-room/`,
  matchmaking: `${ASSET_ROOT}/matchmaking/`,
  gameplay: `${ASSET_ROOT}/gameplay/`,
  profile: `${ASSET_ROOT}/profile/`,
  profileHud: `${ASSET_ROOT}/profile-hud/`,
  dailyReward: `${ASSET_ROOT}/daily-reward/`,
  tournamentPass: `${ASSET_ROOT}/tournament-pass/`,
  specialEvent: `${ASSET_ROOT}/special-event/`,
  help: `${ASSET_ROOT}/help/`,
  win: `${ASSET_ROOT}/win/`,
  portrait: `${ASSET_ROOT}/mobile-portrait/`,
  gameplayPortrait: `${ASSET_ROOT}/mobile-portrait/gameplay/`,
  zh: `${ASSET_ROOT}/localized/zh/`,
};

function file(folder, name) {
  return `${folder}${name}`;
}

function files(folder, names) {
  return names.map((name) => file(folder, name));
}

export function uniqueAssets(list = []) {
  return [...new Set((Array.isArray(list) ? list : [])
    .filter((src) => typeof src === 'string')
    .map((src) => src.trim())
    .filter(Boolean))];
}

const profileHudAssets = files(ASSET_FOLDERS.profileHud, [
  '452.png',
  '563.png',
  'par1.png',
  'par2.png',
  ...Array.from({ length: 10 }, (_, index) => `icc${index + 1}.png`),
]);

const sharedCurrencyAssets = files(ASSET_FOLDERS.mainMenu, ['6.png', '7.png', '8.png']);

const roomCurrencyAssets = files(ASSET_FOLDERS.roomSelect, ['6.png', '7.png', '8.png']);

const roomSelectTableAssets = files(ASSET_FOLDERS.roomSelect, [
  'BG-2.png',
  'BG-3.png',
  'card-1.png',
  'card-2.png',
  'card-3.png',
  'card-4.png',
  'card-5.png',
  '213.png',
  '213124.png',
  '3323423.png',
  '3123213.png',
  '1232131.png',
  '12.png',
  '13.png',
  '14.png',
  '15.png',
  'back-button.png',
  'IC1.png',
  'IC2.png',
  'IC3.png',
  'IC4.png',
  'IC5.png',
  'IC6.png',
  'IC7.png',
]);

const createRoomSharedAssets = [
  file(ASSET_FOLDERS.roomSelect, 'BG.png'),
  file(ASSET_FOLDERS.roomSelect, 'BG-2.png'),
  file(ASSET_FOLDERS.roomSelect, 'BG-3.png'),
  ...files(ASSET_FOLDERS.createRoom, [
  'bg.png',
  'p1.png',
  'Pannal.png',
  'pana433.png',
  'pana44.png',
  '232.png',
  'b3.png',
  'b4.png',
  'b5.png',
  ]),
];

const gameplayBackgroundAssets = [
  ...files(ASSET_FOLDERS.roomSelect, ['BG.png', 'BG-2.png', 'BG-3.png']),
  ...files(ASSET_FOLDERS.gameplay, ['BG.png', 'BG-2.png', 'BG-3.png']),
  ...files(ASSET_FOLDERS.gameplayPortrait, ['mobile-BG.png', 'mobile-BG-2.png', 'mobile-BG-3.png']),
];
const gameplayDiceAssets = files(ASSET_FOLDERS.gameplay, Array.from({ length: 6 }, (_, index) => `n${index + 1}.png`));
const gameplayRedDiceAssets = files(ASSET_FOLDERS.gameplay, ['n11.png', 'n22.png', 'n33.png', 'n44.png', 'n55.png', 'n66.png']);

export const ASSET_GROUPS = {
  starter: [
    file(ASSET_FOLDERS.portrait, 'starter-mainmenu-bg.png'),
    file(ASSET_FOLDERS.starter, 'BG.png'),
    file(ASSET_FOLDERS.starter, 'B!.png'),
    file(ASSET_FOLDERS.starter, 'B2.png'),
  ],

  loading: [
    file(ASSET_FOLDERS.portrait, 'loading-portrait-bg.jpg'),
    file(ASSET_FOLDERS.portrait, 'starter-mainmenu-bg.png'),
    file(ASSET_FOLDERS.starter, 'BG.png'),
    ...files(ASSET_FOLDERS.loading, ['1.png', '2.png', '3.png']),
  ],

  login: [
    file(ASSET_FOLDERS.portrait, 'starter-mainmenu-bg.png'),
    file(ASSET_FOLDERS.login, 'bg.png'),
    ...files(ASSET_FOLDERS.login, ['LOGO.png', 'PANAL.png', 'CR1.png', 'B1.png', 'B2.png', 'B3.png', '1.png', '2.png']),
  ],

  mainmenu: [
    file(ASSET_FOLDERS.portrait, 'starter-mainmenu-bg.png'),
    file(ASSET_FOLDERS.mainMenu, 'BG1.png'),
    ...profileHudAssets,
    ...files(ASSET_FOLDERS.mainMenu, [
      '6.png',
      '7.png',
      '8.png',
      '11.png',
      '22.png',
      '33.png',
      '44.png',
      '55.png',
      '66.png',
      '77.png',
      '88.png',
      'B1.png',
      'B2.png',
      'B3.png',
      'B4.png',
    ]),
  ],

  roomselect: [
    file(ASSET_FOLDERS.roomSelect, 'BG.png'),
    ...profileHudAssets,
    ...roomCurrencyAssets,
    ...files(ASSET_FOLDERS.roomSelect, ['B2.png', 'select-title.png', 'bottom-play.png', 'bottom-create.png']),
    ...roomSelectTableAssets,
  ],

  createroom: [
    ...createRoomSharedAssets,
    ...roomCurrencyAssets,
  ],

  joinroom: [
    ...createRoomSharedAssets,
    ...roomCurrencyAssets,
  ],

  roomlobby: [
    ...createRoomSharedAssets,
    ...roomCurrencyAssets,
  ],

  matchmaking: [
    file(ASSET_FOLDERS.roomSelect, 'BG.png'),
    file(ASSET_FOLDERS.roomSelect, 'bottom-play.png'),
    ...files(ASSET_FOLDERS.matchmaking, [
      '1.png',
      '2.png',
      '3.png',
      '4.png',
      '5.png',
      '6.png',
      '7.png',
      '8.png',
      '42.png',
      '54.png',
      '66.png',
      '77.png',
      '88.png',
      '213.png',
      'b1.png',
      'panal.png',
      'panal2.png',
    ]),
  ],

  gameplay: [
    ...gameplayBackgroundAssets,
    file(ASSET_FOLDERS.gameplay, 'chat-button-red.png'),
    file(ASSET_FOLDERS.gameplay, 'leave-button-red.png'),
    file(ASSET_FOLDERS.gameplay, 'cup.png'),
    file(ASSET_FOLDERS.zh, 'gameplay-bid-panel.png'),
    ...profileHudAssets,
    ...gameplayDiceAssets,
    ...gameplayRedDiceAssets,
    ...files(ASSET_FOLDERS.gameplay, [
      '11.png',
      '4.png',
      'BGBB.png',
      'Panal.png',
      'PP22.png',
      'p1.png',
      'p2.png',
      'p3.png',
      'p4.png',
      'coin.png',
      'quantity-selected.png',
      'tt.png',
      'bb1.png',
      'bb2.png',
      'bb3.png',
      'B!.png',
      'B2.png',
      'B3.png',
    ]),
  ],

  win: [
    file(ASSET_FOLDERS.win, 'BG.png'),
    ...files(ASSET_FOLDERS.win, [
      '6.png',
      '7.png',
      '8.png',
      '10.png',
      'B1.png',
      'bt1.png',
      'bt2.png',
      'Pannal.png',
      'tr.png',
      'vic.png',
      'defeat.png',
      '223432432.png',
      '1232132131.png',
      '23423423432.png',
      '123214.png',
      '12415124.png',
      '12312414312.png',
      '1242352523.png',
      '123125151234.png',
      '12312452312.png',
      'A3.png',
      'icc2.png',
      'icc3.png',
      'icc4.png',
    ]),
  ],

  profile: [
    file(ASSET_FOLDERS.roomSelect, 'BG.png'),
    ...sharedCurrencyAssets,
    ...profileHudAssets,
    ...files(ASSET_FOLDERS.profile, [
      'logo.png',
      'll.png',
      'panel2.png',
      'panel3.png',
      'panel 1.png',
      'B2.png',
      'ic1.png',
      'ic2.png',
      'ic3.png',
      'ic4.png',
      'ic5.png',
      'ic6.png',
      'ic7.png',
      'ic8.png',
      'ic9.png',
      'ic10.png',
      'ic11.png',
      'ic12.png',
      'ic13.png',
      'ic14.png',
      'ic15.png',
      'ic16.png',
    ]),
  ],

  dailyreward: [
    file(ASSET_FOLDERS.dailyReward, 'BG.png'),
    file(ASSET_FOLDERS.zh, 'daily-banner.png'),
    ...files(ASSET_FOLDERS.dailyReward, [
      '8.png',
      'B2.png',
      'pbaer.png',
      'd11.png',
      'd22.png',
      'd33.png',
      'd44.png',
      'd55.png',
      'd66.png',
      'd77.png',
      'ic1.png',
      'ic2.png',
      'ic3.png',
      'ic4.png',
      'ic5.png',
      'ic6.png',
      'ic7.png',
      'ic8.png',
    ]),
  ],

  tournamentpass: [
    file(ASSET_FOLDERS.tournamentPass, 'BG.png'),
    ...files(ASSET_FOLDERS.tournamentPass, [
      '6.png',
      '8.png',
      '15.png',
      'B2.png',
      'Ppanel.png',
      'Tpanle.png',
      'clo.png',
      'Card1.png',
      'Card2.png',
      'Card3.png',
      'ic1.png',
      'ic2.png',
      'ic3.png',
      'ic4.png',
      'ic5.png',
      'ic6.png',
      'ic7.png',
    ]),
  ],

  specialevent: [
    file(ASSET_FOLDERS.specialEvent, 'BG.png'),
    ...files(ASSET_FOLDERS.specialEvent, [
      '6.png',
      '8.png',
      'B2.png',
      'clo.png',
      'panel.png',
      'ic1.png',
      'ic2.png',
      'ic3.png',
      'ic4.png',
      'ic5.png',
      'ic6.png',
      'ic7.png',
      'Card1.png',
      'Card2.png',
      'Card3.png',
      '12.png',
      '14.png',
      '15.png',
    ]),
  ],

  help: [
    file(ASSET_FOLDERS.help, 'BGH.png'),
    file(ASSET_FOLDERS.help, 'how-to-play-en.png'),
    file(ASSET_FOLDERS.help, 'how-to-play-zh.png'),
    file(ASSET_FOLDERS.help, 'B2.png'),
    file(ASSET_FOLDERS.zh, 'help-background.png'),
  ],
};

export const PRELOAD_PHASES = {
  starterShell: ['starter', 'loading', 'login'],
  playFlow: ['loading', 'mainmenu', 'roomselect', 'matchmaking', 'gameplay', 'win'],
  secondaryScreens: ['login', 'createroom', 'joinroom', 'roomlobby', 'profile', 'dailyreward', 'tournamentpass', 'specialevent', 'help'],
};

export const SCREEN_ASSET_GROUPS = {
  starter: ['starter'],
  login: ['login'],
  loading: ['loading'],
  mainmenu: ['loading', 'mainmenu', 'roomselect'],
  roomselect: ['loading', 'roomselect'],
  createroom: ['createroom'],
  joinroom: ['joinroom'],
  roomlobby: ['roomlobby'],
  profile: ['profile'],
  matchmaking: ['matchmaking'],
  gameplay: ['gameplay'],
  mockgame: ['gameplay'],
  win: ['win'],
  help: ['help'],
  specialevent: ['specialevent'],
  dailyreward: ['dailyreward'],
  tournamentpass: ['tournamentpass'],
};

export function getAssetsForGroups(groupNames = []) {
  return uniqueAssets(groupNames.flatMap((groupName) => ASSET_GROUPS[groupName] || []));
}

export function getAssetGroup(groupName) {
  return uniqueAssets(ASSET_GROUPS[groupName] || []);
}

export function getAssetsForScreen(screenName) {
  return getAssetsForGroups(SCREEN_ASSET_GROUPS[screenName] || [screenName]);
}

export function getAssetsForPhase(phaseName) {
  return getAssetsForGroups(PRELOAD_PHASES[phaseName] || []);
}

export function getAllManifestAssets() {
  return getAssetsForGroups(Object.keys(ASSET_GROUPS));
}

export default ASSET_GROUPS;
