import React from 'react';

const GAMEPLAY_ASSET_ROOT = '/assets/liars-dice/gameplay/';

export function GameplayPlayersLayer({ panelItems, renderPlayerPanel }) {
  return (
    <div className="gameplay-players-layer" data-ui-section="players">
      {panelItems.map(renderPlayerPanel)}
    </div>
  );
}

export function GameplayUtilityControls({
  tx,
  currentMatchId,
  isBusy,
  isFinished,
  onLeave,
  canUseChat,
  chatOpen,
  chatCount,
  onToggleChat,
  canUseVoice,
  voiceState,
  onToggleVoice,
  musicPanelOpen,
  onToggleMusicPanel,
  musicVolume,
  musicMuted,
  onMusicVolumeChange,
  onToggleMusicMuted,
}) {
  return (
    <div className="gameplay-utility-controls" data-ui-section="utility-controls">
      <button className="gameplay-leave" type="button" onClick={onLeave} disabled={!currentMatchId || isBusy || isFinished}>
        <img className="gameplay-leave__skin" src={`${GAMEPLAY_ASSET_ROOT}leave-button-red.png`} alt="" draggable="false" />
        <span className="gameplay-leave__title">{tx('LEAVE')}</span>
        <span className="gameplay-leave__subtitle">{tx('Forfeit match')}</span>
      </button>

      {canUseChat ? (
        <button
          className={`gameplay-chat-button ${chatOpen ? 'is-open' : ''}`}
          type="button"
          onClick={onToggleChat}
          aria-expanded={chatOpen}
          aria-controls="gameplay-chat-drawer"
        >
          <img className="gameplay-chat-button__skin" src={`${GAMEPLAY_ASSET_ROOT}chat-button-red.png`} alt="" draggable="false" />
          <span className="gameplay-chat-button__title">{tx('CHAT')}</span>
          <span className="gameplay-chat-button__count">{chatCount}</span>
        </button>
      ) : null}

      {canUseVoice ? (
        <button
          className={`gameplay-voice-button ${voiceState.connected ? 'is-connected' : ''} ${voiceState.muted ? 'is-muted' : ''} ${voiceState.connected && !voiceState.muted ? 'is-live' : ''} ${voiceState.connecting ? 'is-connecting' : ''}`}
          type="button"
          onClick={onToggleVoice}
          disabled={voiceState.connecting}
          aria-pressed={voiceState.connected && !voiceState.muted}
          title={voiceState.connected ? tx(voiceState.muted ? 'Mic muted' : 'Mic live') : tx('Join voice chat')}
        >
          <img className="gameplay-voice-button__skin" src={`${GAMEPLAY_ASSET_ROOT}chat-button-red.png`} alt="" draggable="false" />
          <span className="gameplay-voice-button__icon" aria-hidden="true">🎙</span>
          <span className="gameplay-voice-button__title">
            {voiceState.connecting ? tx('CONNECTING') : tx(voiceState.connected ? (voiceState.muted ? 'MUTED' : 'LIVE') : 'VOICE')}
          </span>
        </button>
      ) : null}

      {canUseVoice && voiceState.error ? (
        <div className="gameplay-voice-status gameplay-voice-status--error">{voiceState.error}</div>
      ) : null}

      <div className={`gameplay-music-control ${musicPanelOpen ? 'is-open' : ''}`}>
        <button
          className="gameplay-music-button"
          type="button"
          onClick={onToggleMusicPanel}
          aria-expanded={musicPanelOpen}
          aria-controls="gameplay-music-volume-panel"
          title={tx('Music volume')}
        >
          <img className="gameplay-music-button__skin" src={`${GAMEPLAY_ASSET_ROOT}chat-button-red.png`} alt="" draggable="false" />
          <span className="gameplay-music-button__icon" aria-hidden="true">🔊</span>
          <span className="gameplay-music-button__title">{tx('SOUND')}</span>
        </button>

        {musicPanelOpen ? (
          <div id="gameplay-music-volume-panel" className="gameplay-music-panel" role="group" aria-label={tx('Music volume')}>
            <div className="gameplay-music-panel__label">{tx('MUSIC')}</div>
            <div className="gameplay-music-panel__row">
              <input
                className="gameplay-music-panel__slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={musicVolume}
                onChange={onMusicVolumeChange}
                aria-label={tx('Music volume')}
              />
              <button
                className={`gameplay-music-panel__mute ${musicMuted ? 'is-muted' : ''}`}
                type="button"
                onClick={onToggleMusicMuted}
                aria-pressed={musicMuted}
                aria-label={tx(musicMuted ? 'Unmute music' : 'Mute music')}
              >
                {tx(musicMuted ? 'UNMUTE' : 'MUTE')}
              </button>
            </div>
            <div className="gameplay-music-panel__value">{musicMuted ? tx('Muted') : `${musicVolume}%`}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GameplayChatDrawer({
  visible,
  tx,
  voiceState,
  chatListRef,
  chatStatus,
  messages,
  renderMessage,
  onClose,
  onSubmit,
  draft,
  onDraftChange,
}) {
  if (!visible) return null;

  return (
    <aside id="gameplay-chat-drawer" className="gameplay-chat-drawer" aria-label={tx('Match Chat')} data-ui-section="chat">
      <div className="gameplay-chat-drawer__header">
        <div>
          <div className="gameplay-chat-drawer__title">{tx('MATCH CHAT')}</div>
          <div className="gameplay-chat-drawer__subtitle">{tx('Normal mode only')} · {tx('Voice')}: {tx(voiceState.connected ? (voiceState.muted ? 'Muted' : 'Live') : 'Off')}</div>
        </div>
        <button className="gameplay-chat-drawer__close" type="button" onClick={onClose} aria-label={tx('Close chat')}>×</button>
      </div>

      <div className="gameplay-chat-drawer__messages" ref={chatListRef}>
        {chatStatus.loading ? (
          <div className="gameplay-chat-drawer__empty">{tx('Loading chat...')}</div>
        ) : messages.length ? (
          messages.map(renderMessage)
        ) : (
          <div className="gameplay-chat-drawer__empty">{tx('No messages yet')}</div>
        )}
      </div>

      {chatStatus.error ? <div className="gameplay-chat-drawer__error">{chatStatus.error}</div> : null}

      <form className="gameplay-chat-drawer__form" onSubmit={onSubmit}>
        <input
          className="gameplay-chat-drawer__input"
          type="text"
          value={draft}
          maxLength={200}
          placeholder={tx('Type a message')}
          onChange={onDraftChange}
          disabled={chatStatus.sending}
        />
        <button className="gameplay-chat-drawer__send" type="submit" disabled={!draft.trim() || chatStatus.sending}>
          {chatStatus.sending ? tx('SENDING...') : tx('SEND')}
        </button>
      </form>
    </aside>
  );
}

export function GameplayStatusLayer({
  tx,
  currentMatchId,
  backendError,
  isBusy,
  viewerEliminated,
  isFinished,
  minimumBidLabel,
}) {
  return (
    <div className="gameplay-status-layer" data-ui-section="status">
      {!currentMatchId ? (
        <div className="gameplay-status gameplay-status--warning">{tx('No active match. Start matchmaking first.')}</div>
      ) : null}
      {backendError ? <div className="gameplay-status gameplay-status--error">{backendError}</div> : null}
      {isBusy ? <div className="gameplay-status gameplay-status--loading">{tx('Updating match...')}</div> : null}
      {viewerEliminated && !isFinished ? (
        <div className="gameplay-status gameplay-status--warning">
          {tx('You are eliminated. Stack is below minimum bid')} ({minimumBidLabel})
        </div>
      ) : null}
    </div>
  );
}
