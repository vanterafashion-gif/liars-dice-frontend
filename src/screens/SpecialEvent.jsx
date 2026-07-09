import ProfileHud from '../components/ProfileHud.jsx';
const asset = '/assets/liars-dice/special-event/';

function TopProfile({ navigation, user, tx }) {
  return <ProfileHud className="special-event-profile" user={user} onClick={navigation.goProfile} ariaLabel={tx('Open Profile')} />;
}

function Currency({ type, icon, value }) {
  return (
    <div className={`special-event-currency special-event-currency--${type}`}>
      <img className="special-event-currency__icon" src={`${asset}${icon}`} alt="" draggable="false" />
      <span className="special-event-currency__value">{value}</span>
      <img className="special-event-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
    </div>
  );
}

function EventCard({ event, onPlay, tx }) {
  return (
    <article className={`special-event-card special-event-card--${event.key}`}>
      <img className="special-event-card__skin" src={`${asset}${event.skin}`} alt="" draggable="false" />
      <span className={`special-event-ribbon ${event.ribbonClass}`}>{tx(event.ribbon)}</span>
      <h2 className="special-event-card__title">{tx(event.title)}</h2>
      {event.copy ? <p className="special-event-card__copy">{tx(event.copy)}</p> : null}
      <div className="special-event-timer">
        <img className="special-event-timer__icon" src={`${asset}clo.png`} alt="" draggable="false" />
        <span>{event.time}</span>
      </div>
      {event.rewardLabel ? <span className="special-event-card__rewardLabel">{tx(event.rewardLabel)}</span> : null}
      <div className="special-event-reward">
        <img className="special-event-reward__icon" src={`${asset}${event.rewardIcon}`} alt="" draggable="false" />
        <span className="special-event-reward__value">{tx(event.reward)}</span>
      </div>
      <button className={`special-event-play ${event.buttonClass}`} type="button" onClick={() => onPlay?.(event)}>
        <img className="special-event-play__skin" src={`${asset}${event.buttonSkin}`} alt="" draggable="false" />
        <span>{tx('PLAY')}</span>
      </button>
    </article>
  );
}

function Mission({ mission, tx }) {
  return (
    <div className={`special-event-mission special-event-mission--${mission.key}`}>
      <img className="special-event-mission__icon" src={`${asset}${mission.icon}`} alt="" draggable="false" />
      <span className="special-event-mission__label">{tx(mission.label)}</span>
      <div className="special-event-mission__bar"><span style={{ width: `${mission.fill}%` }} /></div>
      <span className="special-event-mission__progress">{mission.progress}</span>
      <img className="special-event-mission__coinIcon" src={`${asset}6.png`} alt="" draggable="false" />
      <span className="special-event-mission__coins">{mission.coins}</span>
    </div>
  );
}

export default function SpecialEvent({ navigation, data, backendActions, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const eventCards = data?.specialEvents || [];
  const missions = data?.eventMissions || [];

  return (
    <section className="screen special-event-screen" aria-label={tx('Special Event')}>
      <TopProfile navigation={navigation} user={user} tx={tx} />
      <Currency type="coins" icon="6.png" value={wallet.coins || '0'} />
      <Currency type="gems" icon="7.png" value={wallet.gems || '0'} />

      <div className="special-event-cards" aria-label={tx('Event cards')}>
        {eventCards.map((event, index) => (
          <EventCard
            key={`${event.id || event.key || event.title || 'event'}-${index}`}
            event={event}
            onPlay={backendActions?.playSpecialEvent}
            tx={tx}
          />
        ))}
      </div>

      <div className="special-event-missions">
        <img className="special-event-missions__panel" src={`${asset}panel.png`} alt="" draggable="false" />
        <img className="special-event-missions__badge" src={`${asset}ic6.png`} alt="" draggable="false" />
        {missions.map((mission, index) => (
          <Mission
            key={`${mission.id || mission.key || mission.label || 'mission'}-${index}`}
            mission={mission}
            tx={tx}
          />
        ))}
      </div>

      <button className="special-event-back" type="button" onClick={navigation.goMainMenu}>
        <img className="special-event-back__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span>{tx('BACK')}</span>
      </button>
    </section>
  );
}
