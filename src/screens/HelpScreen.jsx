const asset = '/assets/liars-dice/help/';

const helpPortraitPosterByLanguage = {
  en: `${asset}how-to-play-en.png`,
  zh: `${asset}how-to-play-zh.png`,
};

const helpLandscapePosterByLanguage = {
  en: `${asset}BGH.png`,
  zh: '/assets/liars-dice/localized/zh/help-background.png',
};

export default function HelpScreen({ navigation, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const language = i18n?.language === 'zh' ? 'zh' : 'en';
  const portraitPosterSrc = helpPortraitPosterByLanguage[language] || helpPortraitPosterByLanguage.en;
  const landscapePosterSrc = helpLandscapePosterByLanguage[language] || helpLandscapePosterByLanguage.en;

  return (
    <section className={`screen help-screen help-screen--${language}`} aria-label={tx('Learn the rules')}>
      <img
        className="help-rules-backdrop help-rules-backdrop--portrait"
        src={portraitPosterSrc}
        alt=""
        aria-hidden="true"
        draggable="false"
        loading="eager"
        fetchPriority="high"
      />

      <img
        className="help-rules-backdrop help-rules-backdrop--landscape"
        src={landscapePosterSrc}
        alt=""
        aria-hidden="true"
        draggable="false"
        loading="eager"
        fetchPriority="high"
      />

      <img
        className="help-rules-poster help-rules-poster--portrait"
        src={portraitPosterSrc}
        alt={language === 'zh' ? '如何玩骰子游戏' : 'How to Play'}
        draggable="false"
        loading="eager"
        fetchPriority="high"
      />

      <img
        className="help-rules-poster help-rules-poster--landscape"
        src={landscapePosterSrc}
        alt={language === 'zh' ? '如何玩骰子游戏' : 'How to Play'}
        draggable="false"
        loading="eager"
        fetchPriority="high"
      />

      <button className="help-back-button" type="button" onClick={navigation.goMainMenu}>
        <img className="help-back-button__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="help-back-button__text">{tx('BACK')}</span>
      </button>
    </section>
  );
}
