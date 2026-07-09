import ProfileHud from '../components/ProfileHud.jsx';
const asset = '/assets/liars-dice/tournament-pass/';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function TopProfile({ navigation, user, tx }) {
  return <ProfileHud className="tournament-pass-profile" user={user} onClick={navigation.goProfile} ariaLabel={tx('Open Profile')} />;
}

function Currency({ type, icon, value }) {
  return (
    <div className={`tournament-pass-currency tournament-pass-currency--${type}`}>
      <img className="tournament-pass-currency__icon" src={`${asset}${icon}`} alt="" draggable="false" />
      <span className="tournament-pass-currency__value">{value}</span>
      <img className="tournament-pass-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
    </div>
  );
}

function TournamentCard({ tournament, onEnter, tx, loading }) {
  const isDisabled = Boolean(loading || tournament.canEnter === false || tournament.isFull || tournament.entered);
  const statusLabel = tournament.entered
    ? tx('ENTERED')
    : tournament.isFull
      ? tx('FULL')
      : tournament.status && tournament.status !== 'open'
        ? tx(String(tournament.status).toUpperCase())
        : null;

  const handleEnter = () => {
    if (isDisabled) return;
    onEnter?.(tournament);
  };

  return (
    <article className={cx(
      'tournament-pass-card',
      `tournament-pass-card--${tournament.key}`,
      isDisabled && 'tournament-pass-card--disabled',
      tournament.entered && 'tournament-pass-card--entered',
    )}>
      <img className="tournament-pass-card__skin" src={`${asset}${tournament.card}`} alt="" draggable="false" />
      {statusLabel && <div className="tournament-pass-card__status">{statusLabel}</div>}
      <div className="tournament-pass-card__stats">
        <div><span>{tx('Entry Fee')}</span><img src={`${asset}6.png`} alt="" draggable="false" /><b>{tournament.entry}</b></div>
        <div><span>{tx('Prize pool')}</span><img src={`${asset}6.png`} alt="" draggable="false" /><b>{tournament.prize}</b></div>
        <div><span className="tournament-pass-card__clock"><img src={`${asset}clo.png`} alt="" draggable="false" /></span><b>{tournament.time}</b></div>
        <div><span>{tx('Players')}</span><b>{tournament.players}</b></div>
      </div>
      <button className="tournament-pass-enter" type="button" onClick={handleEnter} disabled={isDisabled} aria-disabled={isDisabled}>
        <img src={`${asset}${tournament.button}`} alt="" draggable="false" />
        <span>{loading ? tx('WAIT') : tournament.entered ? tx('ENTERED') : tx('ENTER')}</span>
      </button>
    </article>
  );
}

function getRewardState(reward = {}, type = 'free') {
  const premiumLocked = Boolean(reward.premiumLocked || (type === 'premium' && reward.requiresPremium !== false && reward.locked));
  const claimed = Boolean(reward.claimed);
  const claimable = Boolean(reward.claimable && !claimed && !reward.locked && !premiumLocked);
  const locked = Boolean(reward.locked || premiumLocked || (!reward.unlocked && !claimed && !claimable));

  if (claimed) return 'claimed';
  if (premiumLocked) return 'premium-locked';
  if (claimable) return 'claimable';
  if (locked) return 'locked';
  return 'unlocked';
}

function PassReward({ reward, index, type, onClaim, tx, loading }) {
  const state = getRewardState(reward, type);
  const isClaimable = state === 'claimable';
  const isDisabled = Boolean(loading || !isClaimable);
  const level = reward.level || index + 1;
  const title = state === 'claimed'
    ? tx('Claimed')
    : state === 'premium-locked'
      ? tx('Premium locked')
      : state === 'locked'
        ? tx('Locked')
        : isClaimable
          ? tx('Claim reward')
          : tx('Unlocked');

  const handleClaim = () => {
    if (!isClaimable || loading) return;
    onClaim?.({ level, type });
  };

  return (
    <button
      className={cx(
        'tournament-pass-reward',
        `tournament-pass-reward--${type}`,
        `tournament-pass-reward--${index + 1}`,
        `tournament-pass-reward--${state}`,
      )}
      type="button"
      onClick={handleClaim}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={`${type} level ${level}: ${reward.value}. ${title}`}
      title={title}
    >
      <img src={`${asset}${reward.icon}`} alt="" draggable="false" />
      <span className="tournament-pass-reward__value">{reward.value}</span>
      {(state === 'locked' || state === 'premium-locked') && <span className="tournament-pass-reward__lock" aria-hidden="true">🔒</span>}
      {state === 'claimed' && <span className="tournament-pass-reward__claimed" aria-hidden="true">✓</span>}
      {state === 'claimable' && <span className="tournament-pass-reward__claim">{tx('CLAIM')}</span>}
    </button>
  );
}

function getXpText(pass = {}) {
  return pass.xpValueLabel || pass.xpText || pass.xpProgress?.label || pass.progress?.label || `${pass.passXp || 0}/${pass.levelTargetXp || pass.xpToNextLevel || 0}`;
}

export default function TournamentPass({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const tournaments = data?.tournaments || [];
  const pass = data?.tournamentPass || {};
  const premiumRewards = pass.premiumRewards || [];
  const freeRewards = pass.freeRewards || [];
  const passActionLoading = Boolean(backendStatus?.loading && String(backendStatus?.lastAction || '').startsWith('pass.'));
  const tournamentActionLoading = Boolean(backendStatus?.loading && String(backendStatus?.lastAction || '').startsWith('tournaments.'));
  const xpText = getXpText(pass);

  return (
    <section className="screen tournament-pass-screen" aria-label={tx('Tournaments and Lucky Pass')}>
      <TopProfile navigation={navigation} user={user} tx={tx} />
      <Currency type="coins" icon="6.png" value={wallet.coins || '0'} />
      <Currency type="gems" icon="7.png" value={wallet.gems || '0'} />

      <section className="tournament-pass-tournaments" aria-label={tx('Tournaments')}>
        <img className="tournament-pass-tournaments__panel" src={`${asset}Tpanle.png`} alt="" draggable="false" />
        <div className="tournament-pass-tournaments__cards">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.key}
              tournament={tournament}
              onEnter={backendActions?.enterTournament}
              tx={tx}
              loading={tournamentActionLoading}
            />
          ))}
        </div>
      </section>

      <section className="tournament-pass-lucky" aria-label={tx('LUCKY PASS')}>
        <img className="tournament-pass-lucky__panel" src={`${asset}Ppanel.png`} alt="" draggable="false" />
        <div className="tournament-pass-xp-label">
          <b>{xpText}</b>
        </div>
        <div className="tournament-pass-xp-bar" aria-label={`${tx(pass.xpLabel || 'PASS XP')} ${xpText}`}>
          <span style={{ width: `${Math.max(0, Math.min(100, Number(pass.xpPercent || 0)))}%` }} />
        </div>
        <div className="tournament-pass-rewards tournament-pass-rewards--premium">
          {premiumRewards.map((reward, index) => (
            <PassReward
              key={`premium-${reward.level || index}`}
              reward={reward}
              index={index}
              type="premium"
              onClaim={backendActions?.claimPassReward}
              tx={tx}
              loading={passActionLoading}
            />
          ))}
        </div>
        <div className="tournament-pass-rewards tournament-pass-rewards--free">
          {freeRewards.map((reward, index) => (
            <PassReward
              key={`free-${reward.level || index}`}
              reward={reward}
              index={index}
              type="free"
              onClaim={backendActions?.claimPassReward}
              tx={tx}
              loading={passActionLoading}
            />
          ))}
        </div>
        <button
          className="tournament-pass-upgrade"
          type="button"
          onClick={backendActions?.upgradePass}
          disabled={passActionLoading || Boolean(pass.premiumUnlocked)}
          aria-disabled={passActionLoading || Boolean(pass.premiumUnlocked)}
        >
          <img src={`${asset}15.png`} alt="" draggable="false" />
          <span>{pass.premiumUnlocked ? tx('PASS ACTIVE') : tx('UPGRADE PASS')}</span>
        </button>
      </section>

      {backendStatus?.error && <div className="tournament-pass-message" role="alert">{backendStatus.error}</div>}

      <button className="tournament-pass-back" type="button" onClick={navigation.goMainMenu}>
        <img className="tournament-pass-back__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span>{tx('BACK')}</span>
      </button>
    </section>
  );
}
