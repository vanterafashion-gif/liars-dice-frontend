import { useState } from 'react';

const asset = '/assets/liars-dice/login/';

const sparkles = Array.from({ length: 18 }, (_, index) => index + 1);

const initialForm = {
  username: '',
  email: '',
  password: '',
};

export default function LoginScreen({ navigation, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [localError, setLocalError] = useState('');
  const [localStatus, setLocalStatus] = useState('');

  const isRegisterMode = authMode === 'register';
  const isSubmitting = backendStatus?.loading && ['auth.login', 'auth.register', 'auth.guest'].includes(backendStatus.lastAction);
  const backendError = ['auth.login', 'auth.register', 'auth.guest'].includes(backendStatus?.lastAction) ? backendStatus?.error : null;
  const visibleError = localError || backendError;

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setLocalError('');
    setLocalStatus('');
  };

  const switchMode = (nextMode) => {
    setAuthMode(nextMode);
    setLocalError('');
    setLocalStatus('');
  };

  const buildCredentials = () => {
    const identifier = form.email.trim();

    return {
      identifier,
      email: identifier,
      password: form.password,
    };
  };

  const validateAuthForm = () => {
    const email = form.email.trim();
    const password = form.password;
    const username = form.username.trim();

    if (isRegisterMode && username.length < 3) {
      setLocalError(tx('Username must be at least 3 characters'));
      return false;
    }

    if (!email) {
      setLocalError(tx(isRegisterMode ? 'Email is required' : 'Email or username is required'));
      return false;
    }

    if (!password || password.length < 4) {
      setLocalError(tx('Password must be at least 4 characters'));
      return false;
    }

    return true;
  };

  const submitAuth = async () => {
    setLocalError('');
    setLocalStatus('');

    if (!validateAuthForm()) return;

    if (isRegisterMode) {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      };

      const registerResult = await backendActions?.register?.(payload);

      if (registerResult) {
        setLocalStatus(tx('Account created.'));
      }
      return;
    }

    await backendActions?.login?.(buildCredentials());
  };

  return (
    <section className={`screen login-screen ${isRegisterMode ? 'login-screen--register' : 'login-screen--login'}`} aria-label={tx(isRegisterMode ? 'Register Screen' : 'Login Screen')}>
      <div className="login-vfx login-vfx--vignette" aria-hidden="true" />
      <div className="login-vfx login-vfx--chandelierGlow" aria-hidden="true" />
      <div className="login-vfx login-vfx--logoShine" aria-hidden="true" />
      <div className="login-vfx login-vfx--panelGlow" aria-hidden="true" />
      <div className="login-vfx login-vfx--characterGlow" aria-hidden="true" />
      <div className="login-vfx login-vfx--cupSpark" aria-hidden="true" />
      <div className="login-sparkles" aria-hidden="true">
        {sparkles.map((sparkle) => (
          <span className={`login-sparkle login-sparkle--${sparkle}`} key={sparkle} />
        ))}
      </div>

      <img className="ld-logo login-logo" src={`${asset}LOGO.png`} alt={tx("Liar's Dice")} draggable="false" />
      <img className="login-panel" src={`${asset}PANAL.png`} alt="" draggable="false" />
      <img className="login-character" src={`${asset}CR1.png`} alt={tx('Cat character')} draggable="false" />

      <h1 className="login-subtitle">{tx(isRegisterMode ? 'Create your account' : 'Bluff, Bid, and Win Big')}</h1>

      {isRegisterMode ? (
        <label className="login-field login-field--username">
          <img className="login-field__skin" src={`${asset}1.png`} alt="" draggable="false" />
          <input
            className="login-field__input"
            type="text"
            placeholder={tx('USERNAME')}
            value={form.username}
            onChange={updateField('username')}
            autoComplete="username"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="next"
          />
        </label>
      ) : null}

      <label className="login-field login-field--email">
        <img className="login-field__skin" src={`${asset}1.png`} alt="" draggable="false" />
        <input
          className="login-field__input"
          type={isRegisterMode ? 'email' : 'text'}
          placeholder={tx(isRegisterMode ? 'EMAIL' : 'EMAIL OR USERNAME')}
          value={form.email}
          onChange={updateField('email')}
          autoComplete={isRegisterMode ? 'email' : 'username'}
          inputMode={isRegisterMode ? 'email' : 'text'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="next"
        />
      </label>

      <label className="login-field login-field--password">
        <img className="login-field__skin" src={`${asset}2.png`} alt="" draggable="false" />
        <input
          className="login-field__input"
          type="password"
          placeholder={tx('PASSWORD')}
          value={form.password}
          onChange={updateField('password')}
          autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="go"
        />
      </label>

      {!isRegisterMode ? <button className="login-forgot" type="button">{tx('Forgot Password?')}</button> : null}

      {visibleError ? <p className="login-auth-message login-auth-message--error" role="alert">{visibleError}</p> : null}
      {localStatus && !visibleError ? <p className="login-auth-message login-auth-message--success" role="status">{localStatus}</p> : null}

      <button className="login-register-toggle" type="button" onClick={() => switchMode(isRegisterMode ? 'login' : 'register')} disabled={isSubmitting}>
        {tx(isRegisterMode ? 'Already have an account? Log in' : 'Create account')}
      </button>

      <button className="image-button login-button login-button--login" type="button" onClick={submitAuth} disabled={isSubmitting}>
        <img className="image-button__skin" src={`${asset}B1.png`} alt="" draggable="false" />
        <span className="image-button__text">{tx(isSubmitting ? 'CONNECTING...' : isRegisterMode ? 'REGISTER' : 'LOG IN')}</span>
      </button>

      <div className="login-or" aria-hidden="true"><span></span><b>{tx('OR')}</b><span></span></div>

      <button className="image-button login-button login-button--guest" type="button" onClick={() => backendActions?.loginAsGuest?.() || navigation.goLoading()} disabled={isSubmitting}>
        <img className="image-button__skin" src={`${asset}B3.png`} alt="" draggable="false" />
        <span className="image-button__text">{tx('PLAY AS GUEST')}</span>
      </button>

      <button className="image-button login-button login-button--back" type="button" onClick={navigation.goStarter} disabled={isSubmitting}>
        <img className="image-button__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span className="image-button__text login-button__back-text">{tx('BACK')}</span>
      </button>
    </section>
  );
}
