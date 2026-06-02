// Web Audio API engine

const AudioEngine = (() => {
  let ctx = null;
  let timbre = 'sawtooth';
  let volume = 0.0375;
  let clickEnabled = true;

  // Currently held preview nodes
  let previewGain = null;
  let previewOscs = [];
  let previewStartTime = -1; // AC time when preview started

  // Currently playing scheduled nodes (for full playback)
  let scheduledOscs = [];

  // Minimum sounding time before release (prevents click on very brief tap)
  const MIN_PREVIEW_DUR = 0.08; // 80ms
  const RELEASE_DUR     = 0.10; // 100ms fade-out

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function setTimbre(t) { timbre = t; }
  function setVolume(v) { volume = v; }
  function setClick(enabled) { clickEnabled = enabled; }

  function playClick(time, isDownbeat, ac) {
    const peak = volume * (isDownbeat ? 8 : 4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    g.connect(ac.destination);

    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = isDownbeat ? 1200 : 800;
    osc.connect(g);
    osc.start(time);
    osc.stop(time + 0.05);
    scheduledOscs.push(osc);
  }

  // ── Preview (mousedown → hold → mouseup to stop) ──────────────────────────

  // Play a single MIDI note (for piano key clicks)
  function startSingleNote(midi) {
    stopPreview();
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    const now = ac.currentTime;
    previewStartTime = now;
    previewGain = ac.createGain();
    previewGain.gain.setValueAtTime(0.001, now);
    const boost = (timbre === 'sine' || timbre === 'triangle') ? 1.6 : 1.0;
    previewGain.gain.exponentialRampToValueAtTime(volume * 0.5 * boost, now + 0.02);
    if (timbre === 'sine' || timbre === 'triangle') {
      const hpf = ac.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 180;
      hpf.Q.value = 0.7;
      previewGain.connect(hpf);
      hpf.connect(ac.destination);
    } else {
      previewGain.connect(ac.destination);
    }
    const osc = ac.createOscillator();
    osc.type = timbre;
    osc.frequency.value = midiToHz(midi);
    osc.connect(previewGain);
    osc.start(now);
    previewOscs = [osc];
  }

  function startPreview(root, type, bass) {
    stopPreview();
    if (!root || !type) return;

    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();

    const freqs = getChordFreqs(root, type, bass);
    const now = ac.currentTime;
    previewStartTime = now;

    previewGain = ac.createGain();
    previewGain.gain.setValueAtTime(0.001, now);
    const timbreBoost = (timbre === 'sine' || timbre === 'triangle') ? 1.6 : 1.0;
    previewGain.gain.exponentialRampToValueAtTime(volume * 0.5 * timbreBoost / Math.sqrt(freqs.length), now + 0.03);
    if (timbre === 'sine' || timbre === 'triangle') {
      const hpf = ac.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 180;
      hpf.Q.value = 0.7;
      previewGain.connect(hpf);
      hpf.connect(ac.destination);
    } else {
      previewGain.connect(ac.destination);
    }

    previewOscs = freqs.map(freq => {
      const osc = ac.createOscillator();
      osc.type = timbre;
      osc.frequency.value = freq;
      if (timbre === 'sawtooth' || timbre === 'square') {
        osc.detune.value = Math.random() * 4 - 2;
      }
      osc.connect(previewGain);
      osc.start(now);
      return osc;
    });
  }

  function stopPreview() {
    if (!previewGain) return;
    const ac = getCtx();
    const now = ac.currentTime;

    // Ensure minimum sounding time to avoid click on very brief tap
    const releaseStart = Math.max(now, previewStartTime + MIN_PREVIEW_DUR);

    const g = previewGain.gain;
    if (g.cancelAndHoldAtTime) {
      // Holds at the naturally interpolated value at releaseStart, then fades out.
      // Never reads gain.value, so no spike risk.
      g.cancelAndHoldAtTime(releaseStart);
    } else {
      // Fallback: rather than reading gain.value (unreliable mid-ramp),
      // clamp to near-zero — may shorten the sound slightly but is always safe.
      g.cancelScheduledValues(now);
      g.setValueAtTime(0.0001, now);
      if (releaseStart > now) g.setValueAtTime(0.0001, releaseStart);
    }
    g.linearRampToValueAtTime(0.0001, releaseStart + RELEASE_DUR);

    const oscs = previewOscs;
    previewGain = null;
    previewOscs = [];

    const stopDelay = (releaseStart - now + RELEASE_DUR) * 1000 + 20;
    setTimeout(() => {
      for (const o of oscs) try { o.stop(); } catch (_) {}
    }, stopDelay);
  }

  // ── Full playback ──────────────────────────────────────────────────────────

  function stopScheduled() {
    for (const o of scheduledOscs) try { o.stop(); } catch (_) {}
    scheduledOscs = [];
  }

  // acStartTime: 省略時は ac.currentTime + 0.05 で即座にスケジュール
  // onEnd(acEndTime): 実際の終了 LOOP_LEAD 秒前に発火し、次ループ開始時刻を渡す
  const LOOP_LEAD = 0.15; // 150ms 前倒しで onEnd を発火
  function schedulePlayback(beats, bpm, onBeat, onEnd, acStartTime) {
    stopScheduled();
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();

    const beatDur = 60 / bpm;
    let t = acStartTime ?? (ac.currentTime + 0.05);
    const timeouts = [];

    let globalBeat = 0;
    for (let i = 0; i < beats.length; i++) {
      const { chord } = beats[i];
      const dur = beats[i].duration ?? 1;
      const startTime = t;

      // Fire onBeat for every individual beat within this entry
      for (let d = 0; d < dur; d++) {
        const beatTime = t + beatDur * d;
        const beatIdx = globalBeat + d;
        const delay = (beatTime - ac.currentTime) * 1000;
        timeouts.push(setTimeout(() => onBeat(beatIdx), delay));
        if (clickEnabled) playClick(beatTime, beatIdx % 4 === 0, ac);
      }
      globalBeat += dur;

      if (chord && chord !== 'rest') {
        const freqs = getChordFreqs(chord.root, chord.type, chord.bass);
        playFreqs(freqs, startTime, beatDur * dur - 0.01, ac);
      }

      t += beatDur * dur;
    }

    // onEnd を終了 LOOP_LEAD 秒前に発火し、次スケジュールの開始 AC 時刻を渡す
    const preEndDelay = Math.max(0, (t - ac.currentTime - LOOP_LEAD)) * 1000;
    timeouts.push(setTimeout(() => onEnd(t), preEndDelay));

    return () => {
      timeouts.forEach(clearTimeout);
      stopScheduled();
    };
  }

  function playFreqs(freqs, startTime, duration, ac) {
    const gain = ac.createGain();
    const timbreBoostPb = (timbre === 'sine' || timbre === 'triangle') ? 1.6 : 1.0;
    const peak = (volume * 0.5 * timbreBoostPb) / Math.sqrt(freqs.length);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.02);
    gain.gain.setValueAtTime(peak, startTime + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    if (timbre === 'sine' || timbre === 'triangle') {
      const hpf = ac.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 180;
      hpf.Q.value = 0.7;
      gain.connect(hpf);
      hpf.connect(ac.destination);
    } else {
      gain.connect(ac.destination);
    }

    for (const freq of freqs) {
      const osc = ac.createOscillator();
      osc.type = timbre;
      osc.frequency.value = freq;
      if (timbre === 'sawtooth' || timbre === 'square') {
        osc.detune.value = Math.random() * 4 - 2;
      }
      osc.connect(gain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
      scheduledOscs.push(osc);
    }
  }

  return { setTimbre, setVolume, setClick, startSingleNote, startPreview, stopPreview, schedulePlayback, stopScheduled, getCtx };
})();
