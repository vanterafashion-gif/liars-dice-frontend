import ProfileHud from '../components/ProfileHud.jsx';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROFILE_AVATAR, PROFILE_AVATAR_OPTIONS, findProfileAvatarOption, resolveProfileAvatarSrc } from '../utils/profileAvatars.js';

const asset = '/assets/liars-dice/profile/';
const mainMenuAsset = '/assets/liars-dice/main-menu/';

const achievementIconFallbacks = ['ic11.png', 'ic12.png', 'ic13.png', 'ic14.png', 'ic15.png'];

const profileStatConfig = [
  { mod: 'total-wins', icon: 'ic1.png', label: 'TOTAL WINS' },
  { mod: 'diamonds', icon: 'ic2.png', label: 'DIAMONDS' },
  { mod: 'highest-bid', icon: 'ic3.png', label: 'HIGHEST BID' },
  { mod: 'wins', icon: 'ic4.png', label: 'WINS' },
  { mod: 'win-rate', icon: 'ic5.png', label: 'WIN RATE' },
  { mod: 'favorite-table', icon: 'ic6.png', label: 'FAVORITE TABLE' },
  { mod: 'highest-rank', icon: 'ic7.png', label: 'HIGHEST RANK' },
  { mod: 'best-streak', icon: 'ic8.png', label: 'BEST STREAK' },
];

const defaultAvatar = DEFAULT_PROFILE_AVATAR;
const avatarOptions = PROFILE_AVATAR_OPTIONS;

function numberValue(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(numberValue(value));
}

function formatPercent(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return 'New Player';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'New Player';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function humanizeProfileKey(value) {
  if (!value) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatProfileValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    const text = value.map((entry) => formatProfileValue(entry, '')).filter(Boolean).join(', ');
    return text || fallback;
  }

  if (typeof value === 'object') {
    const directValue = value.displayName || value.title || value.name || value.label || value.tableName ||
      value.favoriteTableName || value.selectedTableName || value.tableTitle || value.tierName ||
      value.tableTier || value.selectedTableTier || value.tableType || value.rankName || value.rank ||
      value.value || value.text;

    if (directValue && directValue !== value) return formatProfileValue(directValue, fallback);

    const keyValue = value.tableKey || value.selectedTableId || value.tableId || value.tierId || value.key || value.id;
    if (keyValue) return humanizeProfileKey(keyValue);

    return fallback;
  }

  return String(value);
}

function translateText(tx, value, fallback = '—') {
  return tx(formatProfileValue(value, fallback));
}

function formatRewardLabel(reward = {}) {
  if (!reward || typeof reward !== 'object') return '';
  const amount = reward.amount ?? reward.value ?? reward.quantity ?? reward.coins ?? reward.gems ?? reward.diamonds;
  const type = reward.type || reward.currency || (reward.gems || reward.diamonds ? 'gems' : 'coins');
  if (amount === undefined || amount === null || amount === '') return '';
  const typeLabel = String(type).toLowerCase().includes('gem') || String(type).toLowerCase().includes('diamond') ? 'Gems' : 'Coins';
  return `${formatNumber(amount)} ${typeLabel}`;
}

function normalizeAchievements(list = []) {
  if (!Array.isArray(list)) return [];

  return list.slice(0, 5).map((item, index) => {
    const target = numberValue(item.target ?? item.goal ?? item.required, 1) || 1;
    const progress = Math.min(target, numberValue(item.progress ?? item.current ?? item.count, 0));
    const claimed = Boolean(item.claimed || item.isClaimed);
    const claimable = Boolean(item.claimable || item.canClaim || (progress >= target && !claimed));
    const unlocked = Boolean(item.unlocked || item.completed || claimable || claimed || progress >= target);
    const locked = Boolean(item.locked || (!unlocked && !claimable && !claimed));
    const progressLabel = item.progressLabel || `${formatNumber(progress)}/${formatNumber(target)}`;
    const rewardLabel = item.rewardLabel || formatRewardLabel(item.reward);

    return {
      ...item,
      id: item.id || item.achievementId || item._id || item.key || `achievement-${index + 1}`,
      icon: item.icon || item.iconAsset || achievementIconFallbacks[index] || achievementIconFallbacks[0],
      label: formatProfileValue(item.label || item.name || item.title || `Achievement ${index + 1}`),
      description: formatProfileValue(item.description || item.copy || '', ''),
      progress,
      target,
      progressLabel,
      rewardLabel,
      unlocked,
      locked,
      claimed,
      claimable,
      statusLabel: claimed ? 'CLAIMED' : claimable ? 'CLAIM' : locked ? 'LOCKED' : progressLabel,
    };
  });
}

function normalizeSeasons(list = []) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 4).map((item, index) => ({
    name: formatProfileValue(item.name || item.seasonName || `Season ${item.season || index + 1}`),
    rank: formatProfileValue(item.rank || item.highestRank || item.tier || '—'),
  }));
}

function normalizeRecentMatches(list = []) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 3).map((item) => {
    const rawState = String(item.state || item.result || item.outcome || item.viewerResult || '').toUpperCase();
    const state = rawState === 'WIN' || rawState === 'WON' || rawState === 'VICTORY' ? 'WIN' : 'LOSE';
    const delta = item.coins ?? item.coinDelta ?? item.coinsDelta ?? item.walletDelta ?? item.reward ?? item.amount ?? 0;
    const signedDelta = typeof delta === 'string' ? delta : `${Number(delta) >= 0 ? '+' : ''}${formatNumber(delta)}`;
    const xpValue = item.xpEarned ?? item.xp ?? item.experience ?? null;

    return {
      state,
      icon: item.icon || item.iconAsset || (state === 'WIN' ? 'ic16.png' : 'ic4.png'),
      room: formatProfileValue(item.room || item.table || item.tableName || item.mode || item.tier || item.tierName || '—'),
      coins: signedDelta,
      xp: xpValue === null || xpValue === undefined || xpValue === '' ? '' : `XP ${Number(xpValue) >= 0 ? '+' : ''}${formatNumber(xpValue)}`,
      playedAt: formatDate(item.playedAt || item.createdAt || item.finishedAt),
    };
  });
}

function findAvatarOption(avatar) {
  return findProfileAvatarOption(avatar);
}

export default function ProfileScreen({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const [displayName, setDisplayName] = useState(user.username || user.displayName || 'Player');
  const [draftName, setDraftName] = useState(user.username || user.displayName || 'Player');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || user.avatarId || defaultAvatar);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const currentAvatar = useMemo(() => findAvatarOption(selectedAvatar), [selectedAvatar]);
  const profileUser = useMemo(() => ({
    ...user,
    username: displayName,
    displayName,
    avatar: currentAvatar.src,
    avatarId: currentAvatar.id,
  }), [currentAvatar, displayName, user]);

  const profileStats = useMemo(() => {
    const stats = user.stats || {};
    const gamesPlayed = numberValue(stats.gamesPlayed);
    const wins = numberValue(stats.wins);
    const losses = numberValue(stats.losses);
    const totalGames = gamesPlayed || wins + losses;
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    const bestStreak = Math.max(
      numberValue(stats.bestStreak),
      numberValue(stats.longestWinStreak),
      numberValue(user.bestStreak),
      numberValue(user.longestWinStreak),
    );
    const valuesByMod = {
      'total-wins': formatNumber(stats.coinsWon ?? 0),
      diamonds: formatNumber(wallet.gems ?? 0),
      'highest-bid': formatNumber(stats.highestBid ?? user.highestBid ?? 0),
      wins: formatNumber(wins),
      'win-rate': formatPercent(winRate),
      'favorite-table': formatProfileValue(user.favoriteTable || stats.favoriteTable || '—'),
      'highest-rank': formatProfileValue(user.highestRank || user.rank || user.title || '—'),
      'best-streak': `${formatNumber(bestStreak)} Wins`,
    };

    return profileStatConfig.map((item) => ({
      ...item,
      value: valuesByMod[item.mod] ?? '0',
    }));
  }, [user, wallet]);

  useEffect(() => {
    const nextName = user.username || user.displayName || 'Player';
    setDisplayName(nextName);
    setDraftName(nextName);
  }, [user.username, user.displayName]);

  useEffect(() => {
    setSelectedAvatar(user.avatar || user.avatarId || defaultAvatar);
  }, [user.avatar, user.avatarId]);

  const profileNameClassName = useMemo(() => {
    const length = String(displayName || '').length;
    if (length > 18) return 'profile-name-card__name profile-name-card__name--tiny';
    if (length > 11) return 'profile-name-card__name profile-name-card__name--small';
    return 'profile-name-card__name';
  }, [displayName]);

  const achievements = useMemo(() => normalizeAchievements(data?.achievements || user.achievements || []), [data?.achievements, user.achievements]);
  const seasons = useMemo(() => normalizeSeasons(data?.seasons || user.seasons || []), [data?.seasons, user.seasons]);
  const matches = useMemo(() => normalizeRecentMatches(data?.recentMatches || user.recentMatches || user.matchHistory || []), [data?.recentMatches, user.recentMatches, user.matchHistory]);
  const favorites = data?.favorites || user.favorites || {};
  const favoriteCupName = favorites.cupName || favorites.favoriteCup || favorites.cup || '—';
  const favoriteDiceName = favorites.diceName || favorites.favoriteDice || favorites.dice || '—';
  const favoriteCupIcon = favorites.cupIcon || favorites.cupAsset || 'ic9.png';
  const favoriteDiceIcon = favorites.diceIcon || favorites.diceAsset || 'ic10.png';

  const startEditName = () => {
    setDraftName(displayName);
    setNameError('');
    setIsEditingName(true);
  };

  const cancelEditName = () => {
    setDraftName(displayName);
    setNameError('');
    setIsEditingName(false);
  };

  const saveProfileName = async () => {
    const nextName = draftName.trim();

    if (!nextName) {
      setNameError(tx('Name is required'));
      return;
    }

    setIsSavingName(true);
    setNameError('');

    try {
      const result = await backendActions?.updateProfile?.({ username: nextName });
      if (result === null) throw new Error(tx('Failed to update name'));
      setDisplayName(nextName);
      setDraftName(nextName);
      setIsEditingName(false);
    } catch (error) {
      setNameError(error?.message || tx('Failed to update name'));
    } finally {
      setIsSavingName(false);
    }
  };

  const openAvatarPicker = () => {
    setAvatarError('');
    setIsAvatarPickerOpen(true);
  };

  const closeAvatarPicker = () => {
    if (isSavingAvatar) return;
    setAvatarError('');
    setIsAvatarPickerOpen(false);
  };

  const saveAvatar = async (avatar) => {
    const previousAvatar = selectedAvatar;
    setSelectedAvatar(avatar.id);
    setIsSavingAvatar(true);
    setAvatarError('');

    try {
      const result = await backendActions?.updateProfile?.({ avatar: avatar.id, avatarId: avatar.id });
      if (result === null) throw new Error(tx('Failed to update avatar'));
      setIsAvatarPickerOpen(false);
    } catch (error) {
      setSelectedAvatar(previousAvatar);
      setAvatarError(error?.message || tx('Failed to update avatar'));
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await backendActions?.logout?.();
  };

  return (
    <section className="screen profile-screen" aria-label={tx('Profile Screen')}>
      <ProfileHud className="profile-mini" user={profileUser} name={displayName} />

      <img className="profile-logo" src={`${asset}logo.png`} alt={tx('PROFILE')} draggable="false" />

      <div className="profile-wallet profile-wallet--coins">
        <img className="profile-wallet__icon profile-wallet__icon--coin" src={`${mainMenuAsset}6.png`} alt="" draggable="false" />
        <span className="profile-wallet__value">{wallet.coins || '0'}</span>
        <img className="profile-wallet__plus" src={`${mainMenuAsset}8.png`} alt="" draggable="false" />
      </div>

      <div className="profile-wallet profile-wallet--diamonds">
        <img className="profile-wallet__icon profile-wallet__icon--diamond" src={`${mainMenuAsset}7.png`} alt="" draggable="false" />
        <span className="profile-wallet__value">{wallet.gems || '0'}</span>
        <img className="profile-wallet__plus" src={`${mainMenuAsset}8.png`} alt="" draggable="false" />
      </div>

      <img className="profile-main-panel" src={`${asset}panel2.png`} alt="" draggable="false" />

      <button className="profile-avatar-button" type="button" onClick={openAvatarPicker} aria-label={tx('Change Avatar')}>
        <img className="profile-player-art" src={`${asset}ll.png`} alt="" draggable="false" />
        <span className="profile-current-avatar-wrap">
          <img className="profile-current-avatar" src={currentAvatar.src} alt="" draggable="false" />
        </span>
        <span className="profile-avatar-button__label">{tx('CHANGE AVATAR')}</span>
      </button>

      <div className="profile-name-card">
        {isEditingName ? (
          <div className="profile-name-editor">
            <input
              className="profile-name-editor__input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={18}
              aria-label={tx('Avatar name')}
              autoFocus
            />
            <button className="profile-name-editor__save" type="button" onClick={saveProfileName} disabled={isSavingName}>
              {tx(isSavingName ? 'SAVING...' : 'SAVE')}
            </button>
            <button className="profile-name-editor__cancel" type="button" onClick={cancelEditName} disabled={isSavingName}>
              {tx('CANCEL')}
            </button>
          </div>
        ) : (
          <>
            <span className={profileNameClassName} title={displayName}>{displayName}</span>
            <button className="profile-edit-name-button" type="button" onClick={startEditName}>
              {tx('EDIT NAME')}
            </button>
          </>
        )}
        {nameError ? <span className="profile-name-editor__error" role="alert">{nameError}</span> : null}
        <img className="profile-name-card__crown" src={`${asset}ic16.png`} alt="" draggable="false" />
        <span className="profile-name-card__rank">{translateText(tx, user.title || user.rank || '—')}</span>
        <span className="profile-name-card__bio">{tx(user.isGuest ? 'Guest Player' : 'Joined since')}<br />{tx(formatDate(user.createdAt))}</span>
      </div>

      <div className="profile-stats">
        {profileStats.map((item) => (
          <div className={`profile-stat profile-stat--${item.mod}`} key={item.mod}>
            <img className="profile-stat__icon" src={`${asset}${item.icon}`} alt="" draggable="false" />
            <span className="profile-stat__label">{translateText(tx, item.label)}</span>
            <span className="profile-stat__value">{translateText(tx, item.value)}</span>
          </div>
        ))}
      </div>

      <div className="profile-seasons">
        {seasons.length ? seasons.map((item, index) => (
          <div className={`profile-season profile-season--${index + 1}`} key={`${formatProfileValue(item.name)}-${index}`}>
            <span className="profile-season__name">{translateText(tx, item.name)}</span>
            <img className="profile-season__icon" src={`${asset}ic7.png`} alt="" draggable="false" />
            <span className="profile-season__rank">{translateText(tx, item.rank)}</span>
          </div>
        )) : <span className="profile-empty profile-empty--seasons">{tx('Season rankings will appear here soon')}</span>}
      </div>

      <div className="profile-bottom profile-bottom--achievements">
        <img className="profile-bottom__panel profile-bottom__panel--achievements" src={`${asset}panel3.png`} alt="" draggable="false" />
        <span className="profile-bottom__title">{tx('ACHIEVEMENTS')}</span>
        {achievements.length ? achievements.map((item, index) => {
          const disabled = !item.claimable || backendStatus?.loading;
          return (
            <button
              className={`profile-achievement profile-achievement--${index + 1} ${item.claimed ? 'profile-achievement--claimed' : ''} ${item.claimable ? 'profile-achievement--claimable' : ''} ${item.locked ? 'profile-achievement--locked' : ''}`}
              key={`${formatProfileValue(item.label)}-${index}`}
              type="button"
              onClick={() => backendActions?.claimAchievement?.(item)}
              disabled={disabled}
              aria-disabled={disabled}
              title={item.description || item.label}
            >
              <img className="profile-achievement__icon" src={`${asset}${item.icon}`} alt="" draggable="false" />
              <span className="profile-achievement__label">{translateText(tx, item.label)}</span>
              <span className="profile-achievement__progress">{item.progressLabel}</span>
              {item.rewardLabel ? <span className="profile-achievement__reward">{translateText(tx, item.rewardLabel)}</span> : null}
              <span className="profile-achievement__status">{tx(item.statusLabel)}</span>
            </button>
          );
        }) : <span className="profile-empty profile-empty--achievements">{tx('Play matches to unlock achievements')}</span>}
      </div>

      <div className="profile-bottom profile-bottom--recent">
        <img className="profile-bottom__panel profile-bottom__panel--recent" src={`${asset}panel 1.png`} alt="" draggable="false" />
        <span className="profile-bottom__title">{tx('RECENT MATCHES')}</span>
        {matches.length ? matches.map((item, index) => (
          <div className={`profile-match profile-match--${index + 1}`} key={`${item.state}-${formatProfileValue(item.room)}-${index}`}>
            <span className={`profile-match__state profile-match__state--${item.state.toLowerCase()}`}>{tx(item.state)}</span>
            <img className="profile-match__roomIcon" src={`${asset}${item.icon}`} alt="" draggable="false" />
            <span className="profile-match__room">{translateText(tx, item.room)}</span>
            <img className="profile-match__coin" src={`${asset}ic1.png`} alt="" draggable="false" />
            <span className="profile-match__coins">{item.coins}</span>
            {item.xp ? <span className="profile-match__xp">{item.xp}</span> : null}
          </div>
        )) : <span className="profile-empty profile-empty--matches">{tx('Your recent matches will appear here')}</span>}
      </div>

      <div className="profile-bottom profile-bottom--favorite">
        <img className="profile-bottom__panel profile-bottom__panel--favorite" src={`${asset}panel3.png`} alt="" draggable="false" />
        <span className="profile-bottom__title">{tx('MY FAVORITE')}</span>
        <span className="profile-favorite__label profile-favorite__label--cup">{tx('FAVORITE CUP')}</span>
        <span className="profile-favorite__label profile-favorite__label--dice">{tx('FAVORITE DICE')}</span>
        <img className="profile-favorite__cup" src={`${asset}${favoriteCupIcon}`} alt="" draggable="false" />
        <img className="profile-favorite__dice" src={`${asset}${favoriteDiceIcon}`} alt="" draggable="false" />
        <span className="profile-favorite__name profile-favorite__name--cup">{translateText(tx, favoriteCupName)}</span>
        <span className="profile-favorite__name profile-favorite__name--dice">{translateText(tx, favoriteDiceName)}</span>
      </div>

      <button className="profile-back" type="button" onClick={navigation.goMainMenu}>
        <img className="profile-back__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="profile-back__text">{tx('BACK')}</span>
      </button>

      <button className="profile-logout" type="button" onClick={handleLogout}>
        <img className="profile-logout__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="profile-logout__text">{tx('LOG OUT')}</span>
      </button>

      {isAvatarPickerOpen ? (
        <div className="profile-avatar-modal" role="dialog" aria-modal="true" aria-label={tx('Choose Avatar')}>
          <button className="profile-avatar-modal__scrim" type="button" onClick={closeAvatarPicker} aria-label={tx('Close')} />
          <div className="profile-avatar-modal__panel">
            <span className="profile-avatar-modal__title">{tx('CHOOSE AVATAR')}</span>
            <div className="profile-avatar-modal__grid">
              {avatarOptions.map((avatar) => (
                <button
                  className={`profile-avatar-option ${currentAvatar.id === avatar.id ? 'is-selected' : ''}`}
                  type="button"
                  key={avatar.id}
                  onClick={() => saveAvatar(avatar)}
                  disabled={isSavingAvatar}
                  aria-pressed={currentAvatar.id === avatar.id}
                >
                  <img className="profile-avatar-option__image" src={avatar.src} alt="" draggable="false" />
                  <span className="profile-avatar-option__label">{tx(avatar.label)}</span>
                </button>
              ))}
            </div>
            {avatarError ? <span className="profile-avatar-modal__error" role="alert">{avatarError}</span> : null}
            <button className="profile-avatar-modal__close" type="button" onClick={closeAvatarPicker} disabled={isSavingAvatar}>
              {tx(isSavingAvatar ? 'SAVING...' : 'CLOSE')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
