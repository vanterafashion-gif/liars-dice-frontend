export default function AssetBootScreen({ data, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const assetLoading = data?.assetLoading || {};
  const progress = Math.max(1, Math.min(100, Number(assetLoading.progress || 1)));
  const loaded = Number(assetLoading.loaded || 0);
  const total = Number(assetLoading.total || 0);
  const hasCounter = total > 0;

  return (
    <section className="screen asset-boot-screen" aria-label={tx('Loading assets')}>
      <div className="asset-boot-screen__glow" aria-hidden="true" />
      <div className="asset-boot-screen__panel" role="status" aria-live="polite">
        <div className="asset-boot-screen__eyebrow">LIAR&apos;S DICE</div>
        <h1 className="asset-boot-screen__title">{tx('Loading start screen')}</h1>
        <div className="asset-boot-screen__bar" aria-hidden="true">
          <span className="asset-boot-screen__bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="asset-boot-screen__progress">
          {progress}%{hasCounter ? `  ·  ${loaded}/${total}` : ''}
        </p>
      </div>
    </section>
  );
}
