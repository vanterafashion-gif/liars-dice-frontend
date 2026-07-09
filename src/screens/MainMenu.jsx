import ProfileHud from '../components/ProfileHud.jsx';
const asset = '/assets/liars-dice/main-menu/';
const sparkles = Array.from({ length: 22 }, (_, index) => index + 1);

export default function MainMenu({ navigation, data, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const cards = data?.mainMenuCards || {};
  const rewards = data?.dailyRewards || [];
  const dailySummary = data?.dailyRewardSummary || {};
  const dailyCta = rewards.some((reward) => reward.state === 'claimable')
    ? 'CLAIM'
    : dailySummary.claimedToday
      ? 'CLAIMED'
      : (cards.daily?.cta || 'CLAIM');

  return (
    <section className="screen main-menu-screen" aria-label={tx('Main Menu')}>
      <div className="main-menu-vfx main-menu-vfx--vignette" aria-hidden="true" />
      <div className="main-menu-vfx main-menu-vfx--lightRays" aria-hidden="true" />
      <div className="main-menu-vfx main-menu-vfx--bannerShine" aria-hidden="true" />
      <div className="main-menu-sparkles" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span className={`main-menu-sparkle main-menu-sparkle--${sparkle}`} key={sparkle} />
        ))}
      </div>

      <ProfileHud className="main-menu-profile" user={user} onClick={navigation.goProfile} ariaLabel={tx('Open Profile')} />

      <div className="main-menu-currency main-menu-currency--coins">
        <img className="main-menu-currency__icon" src={`${asset}6.png`} alt="" draggable="false" />
        <span className="main-menu-currency__value">{wallet.coins || '0'}</span>
        <img className="main-menu-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
      </div>

      <div className="main-menu-currency main-menu-currency--gems">
        <img className="main-menu-currency__icon" src={`${asset}7.png`} alt="" draggable="false" />
        <span className="main-menu-currency__value">{wallet.gems || '0'}</span>
        <img className="main-menu-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
      </div>

      <button className="main-menu-action main-menu-action--play" type="button" onClick={navigation.goRoomSelect}>
        <img className="main-menu-action__skin" src={`${asset}B1.png`} alt="" draggable="false" />
        <span className="main-menu-action__title">{tx('PLAY NOW')}</span>
        <span className="main-menu-action__subtitle">{tx('Jump into a quick game')}</span>
      </button>

      <button className="main-menu-action main-menu-action--create" type="button" onClick={navigation.goCreateRoom}>
        <img className="main-menu-action__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="main-menu-action__title">{tx('CREATE ROOM')}</span>
        <span className="main-menu-action__subtitle">{tx('Invite friends &amp; play')}</span>
      </button>

      <button className="main-menu-action main-menu-action--join" type="button" onClick={navigation.goJoinRoom}>
        <img className="main-menu-action__skin" src={`${asset}B3.png`} alt="" draggable="false" />
        <span className="main-menu-action__title">{tx('JOIN ROOM')}</span>
        <span className="main-menu-action__subtitle">{tx('Enter a room code')}</span>
      </button>

      <button className="main-menu-action main-menu-action--help" type="button" onClick={navigation.goHelp}>
        <img className="main-menu-action__skin" src={`${asset}B4.png`} alt="" draggable="false" />
        <span className="main-menu-action__title">{tx('HOW TO PLAY')}</span>
        <span className="main-menu-action__subtitle">{tx('Learn the rules')}</span>
      </button>

      <button className="main-menu-card main-menu-card--daily" type="button" onClick={navigation.goDailyReward}>
        <img className="main-menu-card__skin" src={`${asset}11.png`} alt="" draggable="false" />
        <span className="main-menu-card__header">{tx(cards.daily?.header || 'DAILY REWARDS')}</span>
        <img className="main-menu-card__art main-menu-card__art--chest" src={`${asset}88.png`} alt="" draggable="false" />
        <span className="main-menu-card__copy main-menu-card__copy--daily">{tx(cards.daily?.copy || 'Come back bigger\nrewards!').split('\n').map((line, index) => (
          <span key={line}>{line}{index === 0 ? <br /> : null}</span>
        ))}</span>
        <span className="main-menu-card__cta main-menu-card__cta--daily">{tx(dailyCta)}</span>
      </button>

      <button className="main-menu-card main-menu-card--pass" type="button" onClick={navigation.goTournamentPass}>
        <img className="main-menu-card__skin" src={`${asset}22.png`} alt="" draggable="false" />
        <span className="main-menu-card__header">{tx(cards.pass?.header || 'LUCKY PASS')}</span>
        <img className="main-menu-card__art main-menu-card__art--pass" src={`${asset}77.png`} alt="" draggable="false" />
        <span className="main-menu-card__copy main-menu-card__copy--pass">{tx(cards.pass?.copy || 'Jump into a quick game')}</span>
        <span className="main-menu-card__cta main-menu-card__cta--pass">{tx(cards.pass?.cta || 'VIEW PASS')}</span>
      </button>

      <button className="main-menu-card main-menu-card--tournaments" type="button" onClick={navigation.goTournamentPass}>
        <img className="main-menu-card__skin" src={`${asset}33.png`} alt="" draggable="false" />
        <span className="main-menu-card__header">{tx(cards.tournaments?.header || 'TOURNAMENTS')}</span>
        <img className="main-menu-card__art main-menu-card__art--cup" src={`${asset}66.png`} alt="" draggable="false" />
        <span className="main-menu-card__copy main-menu-card__copy--tournaments">{tx(cards.tournaments?.copy || 'Compete for big prizes!')}</span>
        <span className="main-menu-card__cta main-menu-card__cta--tournaments">{tx(cards.tournaments?.cta || 'ENTER')}</span>
      </button>

      <button className="main-menu-card main-menu-card--events" type="button" onClick={navigation.goSpecialEvent}>
        <img className="main-menu-card__skin" src={`${asset}44.png`} alt="" draggable="false" />
        <span className="main-menu-card__header">{tx(cards.events?.header || 'SPECIAL EVENTS')}</span>
        <img className="main-menu-card__art main-menu-card__art--gift" src={`${asset}55.png`} alt="" draggable="false" />
        <span className="main-menu-card__copy main-menu-card__copy--events">{tx(cards.events?.copy || 'Join events, win more!')}</span>
        <span className="main-menu-card__cta main-menu-card__cta--events">{tx(cards.events?.cta || 'SEE EVENTS')}</span>
      </button>
    </section>
  );
}
