import { emitSocketEventWithAck, getConnectedGameSocket } from './socketService.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function normalizeError(error) {
  if (!error) return 'Voice chat error';
  if (typeof error === 'string') return error;
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'Microphone permission was denied';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'No microphone was found';
  return error.message || error.reason || 'Voice chat error';
}

function hasMediaSupport() {
  return Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined');
}

function createRemoteAudioElement(userId, stream) {
  if (typeof document === 'undefined') return null;

  const audioId = `voice-chat-audio-${userId}`;
  let audio = document.getElementById(audioId);
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = audioId;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = 'none';
    document.body.appendChild(audio);
  }

  audio.srcObject = stream;
  const playPromise = audio.play?.();
  if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
  return audio;
}

export function startVoiceChatSession({ matchId, muted = false, onState, onError } = {}) {
  let socket = null;
  let localStream = null;
  let connected = false;
  let connecting = false;
  let stopped = false;
  let selfUserId = null;
  let currentMuted = Boolean(muted);
  let participants = [];

  const peers = new Map();
  const remoteAudio = new Map();

  const emitState = (patch = {}) => {
    onState?.({
      connected,
      connecting,
      muted: currentMuted,
      participants,
      error: null,
      ...patch,
    });
  };

  const emitError = (error) => {
    const message = normalizeError(error);
    onError?.(message);
    onState?.({ connected, connecting, muted: currentMuted, participants, error: message });
    return message;
  };

  const setLocalMute = (nextMuted, shouldEmit = true) => {
    currentMuted = Boolean(nextMuted);
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        track.enabled = !currentMuted;
      }
    }

    if (shouldEmit && connected) {
      emitSocketEventWithAck('voice:mute', { matchId, muted: currentMuted }).catch(emitError);
    }

    emitState();
    return currentMuted;
  };

  const destroyPeer = (userId) => {
    const peer = peers.get(userId);
    if (peer) {
      try { peer.close(); } catch (_) {}
      peers.delete(userId);
    }

    const audio = remoteAudio.get(userId);
    if (audio) {
      try { audio.pause?.(); } catch (_) {}
      audio.srcObject = null;
      audio.remove?.();
      remoteAudio.delete(userId);
    }
  };

  const sendSignal = (toUserId, signal) => {
    if (!toUserId || !signal || stopped) return;
    emitSocketEventWithAck('voice:signal', { matchId, toUserId, signal }).catch(emitError);
  };

  const createPeer = (remoteUserId) => {
    if (!remoteUserId || String(remoteUserId) === String(selfUserId)) return null;
    if (peers.has(remoteUserId)) return peers.get(remoteUserId);

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.set(remoteUserId, peer);

    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        peer.addTrack(track, localStream);
      }
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(remoteUserId, { type: 'ice', candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams || [];
      if (stream) createRemoteAudioElement(remoteUserId, stream);
    };

    peer.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
        if (peer.connectionState === 'failed') peer.restartIce?.();
      }
    };

    return peer;
  };

  const makeOffer = async (remoteUserId) => {
    const peer = createPeer(remoteUserId);
    if (!peer) return;
    const offer = await peer.createOffer({ offerToReceiveAudio: true });
    await peer.setLocalDescription(offer);
    sendSignal(remoteUserId, { type: 'offer', sdp: peer.localDescription });
  };

  const handleSignal = async (payload = {}) => {
    try {
      if (String(payload.matchId || '') !== String(matchId || '')) return;
      const fromUserId = payload.fromUserId || payload.userId || payload.senderId;
      const signal = payload.signal || {};
      if (!fromUserId || String(fromUserId) === String(selfUserId) || !signal.type) return;

      const peer = createPeer(fromUserId);
      if (!peer) return;

      if (signal.type === 'offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendSignal(fromUserId, { type: 'answer', sdp: peer.localDescription });
        return;
      }

      if (signal.type === 'answer') {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        return;
      }

      if (signal.type === 'ice' && signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      emitError(error);
    }
  };

  const handleState = (payload = {}) => {
    if (String(payload.matchId || '') !== String(matchId || '')) return;
    participants = Array.isArray(payload.participants) ? payload.participants : participants;
    emitState();
  };

  const handlePeerJoined = (payload = {}) => {
    if (String(payload.matchId || '') !== String(matchId || '')) return;
    participants = Array.isArray(payload.participants) ? payload.participants : participants;
    emitState();
  };

  const handlePeerLeft = (payload = {}) => {
    if (String(payload.matchId || '') !== String(matchId || '')) return;
    const userId = payload.userId || payload.leftUserId;
    if (userId) destroyPeer(userId);
    participants = Array.isArray(payload.participants)
      ? payload.participants
      : participants.filter((participant) => String(participant.userId) !== String(userId));
    emitState();
  };

  const handleMuteState = (payload = {}) => {
    if (String(payload.matchId || '') !== String(matchId || '')) return;
    const userId = payload.userId;
    participants = participants.map((participant) => (
      String(participant.userId) === String(userId)
        ? { ...participant, muted: Boolean(payload.muted) }
        : participant
    ));
    emitState();
  };

  const bindSocketEvents = () => {
    socket.on('voice:signal', handleSignal);
    socket.on('voice:state', handleState);
    socket.on('voice:peer_joined', handlePeerJoined);
    socket.on('voice:peer_left', handlePeerLeft);
    socket.on('voice:mute_state', handleMuteState);
    socket.on('voice:error', emitError);
  };

  const unbindSocketEvents = () => {
    if (!socket) return;
    socket.off('voice:signal', handleSignal);
    socket.off('voice:state', handleState);
    socket.off('voice:peer_joined', handlePeerJoined);
    socket.off('voice:peer_left', handlePeerLeft);
    socket.off('voice:mute_state', handleMuteState);
    socket.off('voice:error', emitError);
  };

  const start = async () => {
    if (connected || connecting) return connected;
    if (!matchId) {
      emitError('No active match for voice chat');
      return false;
    }
    if (!hasMediaSupport()) {
      emitError('Voice chat is not supported in this browser');
      return false;
    }

    connecting = true;
    stopped = false;
    emitState({ connecting: true, error: null });

    try {
      socket = getConnectedGameSocket();
      bindSocketEvents();

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      setLocalMute(currentMuted, false);

      const response = await emitSocketEventWithAck('voice:join', { matchId, muted: currentMuted });
      if (response?.success === false) throw new Error(response.message || 'Unable to join voice chat');

      selfUserId = response.selfUserId || response.userId || null;
      participants = Array.isArray(response.participants) ? response.participants : [];
      connected = true;
      connecting = false;
      emitState({ connected: true, connecting: false, error: null });

      const remoteParticipants = participants.filter((participant) => String(participant.userId) !== String(selfUserId));
      for (const participant of remoteParticipants) {
        await makeOffer(participant.userId);
      }

      return true;
    } catch (error) {
      connecting = false;
      connected = false;
      unbindSocketEvents();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
      }
      emitError(error);
      return false;
    }
  };

  const stop = () => {
    stopped = true;
    if (connected) {
      emitSocketEventWithAck('voice:leave', { matchId }).catch(() => {});
    }
    unbindSocketEvents();
    for (const userId of Array.from(peers.keys())) destroyPeer(userId);
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    connected = false;
    connecting = false;
    participants = [];
    emitState({ connected: false, connecting: false, muted: true, participants: [], error: null });
  };

  const toggleMute = () => {
    if (!connected) return currentMuted;
    return setLocalMute(!currentMuted, true);
  };

  return {
    start,
    stop,
    toggleMute,
    setMuted: (nextMuted) => setLocalMute(nextMuted, true),
    getState: () => ({ connected, connecting, muted: currentMuted, participants }),
  };
}
