// WebAudio synth for Port Solana: every sound is generated live (beeps, noise
// bursts, engine buzz, siren tones) — there are no audio files.
export function createAudio() {
  let ctx = null;
  let muted = false;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function beep(freq, dur, type, vol, slide) {
    if (muted) return;
    try {
      const a = ac();
      const o = a.createOscillator(); const g = a.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
      g.gain.value = vol || 0.06; g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
    } catch { /* audio unavailable */ }
  }
  function noise(dur, vol) {
    if (muted) return;
    try {
      const a = ac();
      const len = Math.floor(a.sampleRate * dur);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource(); src.buffer = buf;
      const g = a.createGain(); g.gain.value = vol;
      src.connect(g); g.connect(a.destination); src.start();
    } catch { /* audio unavailable */ }
  }
  // Two-note success jingle used on mission completion.
  function jingle() { beep(880, 0.18, 'square', 0.07); setTimeout(() => beep(1320, 0.22, 'square', 0.07), 120); }
  return {
    beep, noise, jingle,
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
  };
}
