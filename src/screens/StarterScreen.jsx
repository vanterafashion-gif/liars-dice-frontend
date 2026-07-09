const asset = '/assets/liars-dice/starter/';

const sparkles = Array.from({ length: 24 }, (_, index) => index + 1);

export default function StarterScreen({ navigation, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const languageLabel = i18n?.t?.('languageToggleText', 'EN / 中文') || 'EN / 中文';
  const ariaLabel = i18n?.t?.('languageToggleLabel', 'Change Language') || 'Change Language';

  return (
    <section className="screen starter-screen" aria-label={tx('Starter Screen')}>
      <div className="starter-vfx starter-vfx--vignette" aria-hidden="true" />
      <div className="starter-vfx starter-vfx--chandelierGlow" aria-hidden="true" />
      <div className="starter-vfx starter-vfx--logoShine" aria-hidden="true" />
      <div className="starter-vfx starter-vfx--tableGlow" aria-hidden="true" />
      <div className="starter-vfx starter-vfx--leftCharacterGlow" aria-hidden="true" />
      <div className="starter-vfx starter-vfx--rightCharacterGlow" aria-hidden="true" />
      <div className="starter-sparkles" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span className={`starter-sparkle starter-sparkle--${sparkle}`} key={sparkle} />
        ))}
      </div>

      <button className="starter-language-toggle" type="button" onClick={i18n?.toggleLanguage} aria-label={ariaLabel}>
        <span>{languageLabel}</span>
      </button>

      <button className="image-button starter-button starter-button--play" type="button" onClick={navigation.goLogin}>
        <img className="image-button__skin" src={`${asset}B!.png`} alt="" draggable="false" />
        <span className="image-button__text">{tx('PLAY NOW')}</span>
      </button>

      <button className="image-button starter-button starter-button--login" type="button" onClick={navigation.goLogin}>
        <img className="image-button__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="image-button__text">{tx('LOG IN')}</span>
      </button>
    </section>
  );
}
