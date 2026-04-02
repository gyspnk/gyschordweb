// --- 15. Media Session API + Wake Lock ---
// Provides OS-level media controls (lock screen, notification shade, hardware keys)
// and screen wake lock while MIDI audio is playing.
// Also handles AudioContext resume on page-visibility restore for stable background playback.

(function () {
  'use strict';

  // ─── Internal state ──────────────────────────────────────────────────────────
  let _wakeLockSentinel = null;
  let _lastKnownTitle = '';
  let _mediaSessionActive = false;
  let _silentAudio = null; // HTMLAudioElement used to activate Media Session on mobile

  // ─── Silent audio element ────────────────────────────────────────────────────
  // Mobile browsers (Android Chrome, iOS Safari) require an active HTMLMediaElement
  // for Media Session notifications (lock screen / notification shade controls).
  // Tone.js uses the Web Audio API which doesn't trigger the browser's media UI.
  // We create a tiny silent WAV that loops while MIDI is playing.

  function _createSilentAudio() {
    if (_silentAudio) return _silentAudio;
    // Minimal valid WAV: 1 channel, 8000 Hz, 8-bit, 1 second of silence
    const sampleRate = 8000;
    const numSamples = sampleRate; // 1 second
    const headerSize = 44;
    const dataSize = numSamples;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    _writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    _writeString(view, 8, 'WAVE');
    // fmt  sub-chunk
    _writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);       // sub-chunk size
    view.setUint16(20, 1, true);        // PCM
    view.setUint16(22, 1, true);        // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // byte rate
    view.setUint16(32, 1, true);        // block align
    view.setUint16(34, 8, true);        // bits per sample
    // data sub-chunk
    _writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    // samples: 128 = silence for 8-bit unsigned PCM
    const samples = new Uint8Array(buffer, headerSize, dataSize);
    samples.fill(128);

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    _silentAudio = new Audio(url);
    _silentAudio.loop = true;
    _silentAudio.volume = 0.01; // near-silent but non-zero so browsers don't skip it
    // Prevent the silent audio from interfering with audio focus unnecessarily
    _silentAudio.setAttribute('playsinline', '');
    return _silentAudio;
  }

  function _writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /** Start the silent audio to activate Media Session on mobile. */
  function _playSilentAudio() {
    const audio = _createSilentAudio();
    if (audio.paused) {
      audio.play().catch(() => {}); // may fail without user gesture, that's OK
    }
  }

  /** Pause the silent audio when MIDI stops. */
  function _pauseSilentAudio() {
    if (_silentAudio && !_silentAudio.paused) {
      _silentAudio.pause();
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Current song title from the viewer element. */
  function _getTitle() {
    return document.getElementById('pdf-viewer-title')?.textContent?.trim() || 'GYS Pujian';
  }

  /** Current song number label, used as "artist" in the notification. */
  function _getArtist() {
    return document.getElementById('pdf-viewer-number')?.textContent?.trim() || 'GYS Chord Book';
  }

  /** Whether MidiTimeAuthority reports playback is active. */
  function _isPlaying() {
    return typeof MidiTimeAuthority !== 'undefined' && !!MidiTimeAuthority._playing;
  }

  /** Whether a MIDI sequence with non-zero duration is loaded. */
  function _hasSong() {
    const dur =
      (typeof MidiTimeAuthority !== 'undefined'
        ? MidiTimeAuthority.getDuration()
        : 0) || window._midiKnownDuration || 0;
    return dur > 0;
  }

  /** Current playback position in seconds. */
  function _getPosition() {
    return typeof MidiTimeAuthority !== 'undefined' ? MidiTimeAuthority.getTime() : 0;
  }

  /** Current sequence duration in seconds. */
  function _getDuration() {
    return (
      (typeof MidiTimeAuthority !== 'undefined'
        ? MidiTimeAuthority.getDuration()
        : 0) || window._midiKnownDuration || 0
    );
  }

  // ─── Wake Lock ───────────────────────────────────────────────────────────────

  async function _requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (_wakeLockSentinel) return; // already held
    try {
      _wakeLockSentinel = await navigator.wakeLock.request('screen');
      _wakeLockSentinel.addEventListener('release', () => {
        _wakeLockSentinel = null;
      });
    } catch (_e) {
      // Silently ignore — wake lock is best-effort (fails when page is not visible)
    }
  }

  function _releaseWakeLock() {
    if (_wakeLockSentinel) {
      _wakeLockSentinel.release().catch(() => {});
      _wakeLockSentinel = null;
    }
  }

  // ─── AudioContext background resume ──────────────────────────────────────────
  // iOS Safari and some Android browsers suspend the AudioContext when the tab
  // goes to the background. Resuming it on visibility-restore keeps playback stable.

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;

    // Re-acquire wake lock if still playing (OS releases it when screen turns off)
    if (_isPlaying()) {
      await _requestWakeLock();
    }

    // Resume AudioContext (critical for iOS Safari)
    if (window.Tone && window.Tone.context) {
      const ctx = window.Tone.context;
      if (ctx.state !== 'running') {
        try { await ctx.resume(); } catch (_e) {}
      }
    }

    // Re-sync Media Session state after coming back to foreground
    _updatePlaybackState();
    _updatePositionState();
  });

  // ─── Media Session metadata ───────────────────────────────────────────────────

  function _updateMetadata() {
    if (!('mediaSession' in navigator) || !_hasSong()) return;
    const title = _getTitle();
    // Only update DOM-impacting call when title actually changed
    if (title === _lastKnownTitle && _mediaSessionActive) return;
    _lastKnownTitle = title;
    _mediaSessionActive = true;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: _getArtist(),
      album: 'GYS Chord Book',
      // No artwork: the app has no server-hosted icon images.
      // Browsers fall back to the favicon or a generic music icon.
      artwork: [],
    });
  }

  // ─── Playback state ───────────────────────────────────────────────────────────

  function _updatePlaybackState(explicitState) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState =
      explicitState || (_isPlaying() ? 'playing' : (_hasSong() ? 'paused' : 'none'));
  }

  // ─── Position state ───────────────────────────────────────────────────────────

  function _updatePositionState() {
    if (!('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    const dur = _getDuration();
    if (dur <= 0) return;
    const pos = Math.min(Math.max(_getPosition(), 0), dur);
    try {
      navigator.mediaSession.setPositionState({
        duration: dur,
        playbackRate: 1.0,
        position: pos,
      });
    } catch (_e) {}
  }

  // ─── Full sync (called after song/state changes) ──────────────────────────────

  function _fullSync() {
    _updateMetadata();
    _updatePlaybackState();
    _updatePositionState();
    // Keep silent audio in sync with MIDI playback state
    if (_isPlaying()) {
      _playSilentAudio();
    } else {
      _pauseSilentAudio();
    }
  }

  // ─── Action handlers ──────────────────────────────────────────────────────────

  function _setupActionHandlers() {
    if (!('mediaSession' in navigator)) return;

    // Play
    navigator.mediaSession.setActionHandler('play', async () => {
      if (!_isPlaying() && typeof window.toggleMidiPlayback === 'function') {
        await window.toggleMidiPlayback();
      }
      _playSilentAudio();
      _updatePlaybackState('playing');
      await _requestWakeLock();
    });

    // Pause
    navigator.mediaSession.setActionHandler('pause', async () => {
      if (_isPlaying() && typeof window.toggleMidiPlayback === 'function') {
        await window.toggleMidiPlayback();
      }
      _pauseSilentAudio();
      _updatePlaybackState('paused');
      _releaseWakeLock();
    });

    // Previous track
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (typeof onPrevSong === 'function') onPrevSong(true, true);
    });

    // Next track
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (typeof onNextSong === 'function') onNextSong(true);
    });

    // Seek to absolute position
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (!_hasSong() || details.seekTime == null) return;
      const dur = _getDuration();
      if (dur <= 0) return;
      const seekTime = Math.min(Math.max(details.seekTime, 0), dur);
      if (typeof MidiTimeAuthority !== 'undefined') {
        MidiTimeAuthority.setTime(seekTime, dur);
      }
      // Trigger the existing seekbar change handler so MIDI position actually jumps
      const bar = document.getElementById('custom-seekbar');
      if (bar) {
        bar.value = seekTime;
        bar.dispatchEvent(new Event('change'));
      }
      _updatePositionState();
    });

    // Seek backward (e.g. double-tap rewind on headphones)
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skip = (details && details.seekOffset) || 10;
      const newTime = Math.max(_getPosition() - skip, 0);
      if (typeof MidiTimeAuthority !== 'undefined') {
        MidiTimeAuthority.setTime(newTime, _getDuration());
      }
      const bar = document.getElementById('custom-seekbar');
      if (bar) { bar.value = newTime; bar.dispatchEvent(new Event('change')); }
      _updatePositionState();
    });

    // Seek forward
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skip = (details && details.seekOffset) || 10;
      const dur = _getDuration();
      const newTime = Math.min(_getPosition() + skip, dur);
      if (typeof MidiTimeAuthority !== 'undefined') {
        MidiTimeAuthority.setTime(newTime, dur);
      }
      const bar = document.getElementById('custom-seekbar');
      if (bar) { bar.value = newTime; bar.dispatchEvent(new Event('change')); }
      _updatePositionState();
    });
  }

  // ─── Patch window.toggleMidiPlayback ────────────────────────────────────────
  // Wraps the function defined in 05-events.js so that every play/pause
  // automatically updates Media Session state and the Wake Lock.

  function _patchToggleMidi() {
    const orig = window.toggleMidiPlayback;
    if (typeof orig !== 'function') {
      // Not yet defined — retry after init() has run (DOMContentLoaded fires it)
      setTimeout(_patchToggleMidi, 50);
      return;
    }
    // Avoid double-patching
    if (orig._mediaSessionPatched) return;

    window.toggleMidiPlayback = async function (...args) {
      await orig.apply(this, args);
      const playing = _isPlaying();
      // Sync silent audio element to activate/deactivate browser media controls
      if (playing) {
        _playSilentAudio();
      } else {
        _pauseSilentAudio();
      }
      _updatePlaybackState(playing ? 'playing' : 'paused');
      _updatePositionState();
      if (playing) {
        await _requestWakeLock();
      } else {
        _releaseWakeLock();
      }
    };
    window.toggleMidiPlayback._mediaSessionPatched = true;
  }

  // ─── Polling ─────────────────────────────────────────────────────────────────
  // Keeps position state and playback state fresh at 1 Hz.
  // Metadata is updated only when the title changes (via MutationObserver below).

  setInterval(() => {
    if (!_hasSong()) return;
    _updatePositionState();
    _updatePlaybackState();
  }, 1000);

  // ─── MutationObserver on song title ─────────────────────────────────────────
  // Fires immediately when openPdfViewer changes #pdf-viewer-title,
  // so the notification shows the correct song name without delay.

  function _observeTitleChanges() {
    const titleEl = document.getElementById('pdf-viewer-title');
    if (!titleEl) return;
    const obs = new MutationObserver(() => {
      _lastKnownTitle = ''; // force refresh
      _fullSync();
    });
    obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────────
  // DOMContentLoaded fires after all deferred scripts + init() have run.

  document.addEventListener('DOMContentLoaded', () => {
    _setupActionHandlers();
    _observeTitleChanges();
    _patchToggleMidi();
    _fullSync();
  });

})();
