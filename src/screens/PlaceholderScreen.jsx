export default function PlaceholderScreen({ name, navigation, i18n }) {
  const tx = i18n?.tx || ((value) => value);

  return (
    <section className="screen placeholder-screen">
      <div className="placeholder-card">
        <h1>{tx(name.toUpperCase())}</h1>
        <p>{tx('This screen is reserved for the next phases.')}</p>
        <button type="button" onClick={navigation.goStarter}>{tx('Back to Starter')}</button>
      </div>
    </section>
  );
}
