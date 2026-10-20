// ============================================================================
// DRUMEO AL-BALAD — High-Precision Web Audio Drum Synth & Metronome Engine
// Designed for 5-Piece Metal Kit (Single Kick): C, R, X, O, S, g, T1, T2, FT, B
// ============================================================================

class DrumAudioEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.isPlaying = false;
    this.bpm = 75;
    this.currentStep = 0;
    this.currentLoopCount = 0;
    this.nextNoteTime = 0.0;
    this.timerID = null;

    // Lookahead scheduler constants (Chris Wilson Web Audio clock pattern)
    this.lookaheadMs = 20.0;       // How frequently to call scheduling function (ms)
    this.scheduleAheadSec = 0.1;   // How far ahead to schedule audio (sec)

    // Metronome & Practice Controls
    this.metronomeEnabled = true;
    this.subdivisionClick = false; // Click on 'e', '&', 'a' to help feel 16ths
    this.riffEnabled = true;       // Play recognizable song guitar/piano/bass riff along with drums!
    this.countInEnabled = false;
    this.drumVolume = 0.92;
    this.clickVolume = 0.6;
    this.riffVolume = 0.46;

    // Auto Speed-Up (BPM Ladder)
    this.autoSpeedUp = false;
    this.speedUpEveryLoops = 4;
    this.speedUpIncrement = 5;
    this.targetBpm = 113;

    // Gap / Timing Trainer (Mutes click or groove on fill bar to test internal clock)
    this.gapClickMode = false;

    // Active Pattern Data
    // Each step has: { count, isBeat, isBarStart, barIndex, isFillStep, isLandingStep, drums: ['X','B'], sticking: 'R', riffNotes: [midi], riffTone: 'metal'|'piano'|'clean' }
    this.steps = [];
    this.subdivision = 4; // 4 = 16th notes per beat (1 e & a), 2 = 8th notes (1 &)

    // UI Callbacks
    this.onStepCallback = null;
    this.onLoopCallback = null;
    this.onBpmChangeCallback = null;
    this.onDrumTriggerCallback = null;

    // Active open hi-hat nodes so closed hat ('X') chokes open hat ('O')
    this.activeOpenHatGain = null;

    // Real Studio Master Audio Player (plays actual recorded song time-stretched to current BPM!)
    this.studioAudio = new Audio();
    this.studioAudio.loop = true;
    this.studioAudio.preload = 'auto';
    this.studioAudio.preservesPitch = true;
    this.studioAudio.webkitPreservesPitch = true;
    this.studioAudioReady = false;
    this.songBaseBpm = 100;
    this.onStudioAudioStateCallback = null;

    this.studioAudio.addEventListener('canplay', () => {
      this.studioAudioReady = true;
      this._syncStudioPlaybackRate();
      if (this.onStudioAudioStateCallback) this.onStudioAudioStateCallback(true);
      if (this.isPlaying && this.riffEnabled && this.studioAudio.paused) {
        this.studioAudio.play().catch(() => {});
      }
    });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this._createNoiseBuffer();
      this._createMasterBus();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Master mix bus: everything -> glue compressor -> speakers, plus a room-reverb send
  _createMasterBus() {
    const dest = this.ctx.destination;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 8;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.18;
    this.compressor.connect(dest);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.compressor);

    // Generated stereo room impulse (~1.4s) for natural space
    const len = Math.floor(this.ctx.sampleRate * 1.4);
    const impulse = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = impulse;
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 0.22;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.compressor);

    // Drums get a light touch of room
    this.master.connect(this.reverbSend);

    // Dedicated riff bus (instrument level + its own reverb amount)
    this.riffBus = this.ctx.createGain();
    this.riffBus.gain.value = 1.0;
    this.riffBus.connect(this.compressor);
    this.riffReverbSend = this.ctx.createGain();
    this.riffReverbSend.gain.value = 0.35;
    this.riffBus.connect(this.riffReverbSend);
    this.riffReverbSend.connect(this.reverb);

    // Sampled instrument cache
    this.sampleBuffers = {};
    this.sampleLoading = {};
  }

  _createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  // ==========================================================================
  // REAL SAMPLED INSTRUMENTS (Distortion Guitar, Bass, Clean Guitar, Piano)
  // ==========================================================================

  static midiToNoteName(midi) {
    const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  // Which recorded instruments play a riff note for each tone type
  _voicesForTone(toneType, midi, isChord) {
    if (toneType === 'piano') {
      return [{ inst: 'acoustic_grand_piano', midi, gain: 1.0 }];
    }
    if (toneType === 'clean') {
      return [{ inst: 'electric_guitar_clean', midi, gain: 1.0 }];
    }
    // Metal: distortion guitar power chord (root + 5th) + picked bass an octave down
    const voices = [{ inst: 'distortion_guitar', midi, gain: 0.85 }];
    if (!isChord && midi < 60) {
      voices.push({ inst: 'distortion_guitar', midi: midi + 7, gain: 0.55 });
    }
    if (midi < 55) {
      voices.push({ inst: 'electric_bass_pick', midi: midi - 12, gain: 0.7 });
    }
    return voices;
  }

  _loadSample(inst, midi) {
    if (!this.ctx || midi < 21 || midi > 108) return Promise.resolve(null);
    const key = `${inst}:${midi}`;
    if (this.sampleBuffers[key]) return Promise.resolve(this.sampleBuffers[key]);
    if (this.sampleLoading[key]) return this.sampleLoading[key];

    const note = DrumAudioEngine.midiToNoteName(midi);
    const p = fetch(`/api/sample?inst=${inst}&note=${note}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
      .then((ab) => this.ctx.decodeAudioData(ab))
      .then((buf) => {
        this.sampleBuffers[key] = buf;
        return buf;
      })
      .catch(() => null)
      .finally(() => {
        delete this.sampleLoading[key];
      });
    this.sampleLoading[key] = p;
    return p;
  }

  // Preload every sample needed by the current pattern so playback is instant
  preloadRiffSamples(steps) {
    this.init();
    const jobs = [];
    (steps || []).forEach((step) => {
      if (!step.riffNotes || step.riffNotes.length === 0) return;
      const notes = step.riffNotes.slice(0, 3);
      const isChord = notes.length > 1;
      notes.forEach((m) => {
        this._voicesForTone(step.riffTone || 'metal', m, isChord).forEach((v) => {
          jobs.push(this._loadSample(v.inst, v.midi));
        });
      });
    });
    return Promise.all(jobs);
  }

  // ==========================================================================
  // DRUM VOICES (5-Piece Metal Kit: B, S, g, T1, T2, FT, X, O, C, R)
  // ==========================================================================

  triggerDrum(code, time = null, velocity = 1.0) {
    this.init();
    const t = time !== null ? time : this.ctx.currentTime;
    const vol = Math.min(1.2, Math.max(0.1, velocity * this.drumVolume));

    switch (code) {
      case 'B':
        this._playKick(t, vol);
        break;
      case 'S':
        this._playSnare(t, vol, false);
        break;
      case 'g':
        this._playSnare(t, vol * 0.32, true); // Ghost note: soft, crisp edge tap
        break;
      case 'T1':
        this._playTom(t, vol, 215, 112, 0.28); // High Tom (10"/12" rack left)
        break;
      case 'T2':
        this._playTom(t, vol, 165, 86, 0.34);  // Mid Tom (12"/13" rack right)
        break;
      case 'FT':
      case 'F':
        this._playTom(t, vol, 112, 55, 0.46);  // Floor Tom (16" deep right)
        break;
      case 'X':
        this._playHiHat(t, vol, false);        // Closed Hi-Hat
        break;
      case 'O':
        this._playHiHat(t, vol, true);         // Open Hi-Hat (sizzle)
        break;
      case 'C':
        this._playCrash(t, vol);               // Crash Cymbal
        break;
      case 'R':
        this._playRide(t, vol);                // Ride Cymbal
        break;
      default:
        break;
    }

    // Visual trigger callback
    if (this.onDrumTriggerCallback) {
      const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000);
      setTimeout(() => {
        this.onDrumTriggerCallback(code);
      }, delayMs);
    }
  }

  // Punchy Metal Kick (Sub thump + Beater click for cutting through mixes)
  _playKick(t, vol) {
    // 1. Sub/Body Oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.065);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.28);

    gain.gain.setValueAtTime(vol * 1.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.34);

    // 2. Metal Beater Click (2.2kHz transient punch)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2200, t);
    clickOsc.frequency.exponentialRampToValueAtTime(180, t + 0.022);

    clickGain.gain.setValueAtTime(vol * 0.55, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(this.master);
    clickOsc.start(t);
    clickOsc.stop(t + 0.03);
  }

  // Rock / Nu-Metal Snare (Crack + Wire Snap; supports Ghost Notes 'g')
  _playSnare(t, vol, isGhost = false) {
    // 1. Drum Shell Tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isGhost ? 230 : 210, t);
    osc.frequency.exponentialRampToValueAtTime(125, t + 0.09);

    oscGain.gain.setValueAtTime(vol * (isGhost ? 0.45 : 0.75), t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + (isGhost ? 0.08 : 0.14));

    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);

    // 2. Snare Wires (Filtered Noise)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isGhost ? 1600 : 1100, t);

    const noiseGain = this.ctx.createGain();
    const decay = isGhost ? 0.085 : 0.22;
    noiseGain.gain.setValueAtTime(vol * (isGhost ? 0.5 : 0.9), t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.master);
    noise.start(t);
    noise.stop(t + decay + 0.02);
  }

  // Pitched Resonant Toms (T1 High, T2 Mid, FT Floor)
  _playTom(t, vol, startFreq, endFreq, decay) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + decay * 0.75);

    gain.gain.setValueAtTime(vol * 0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.02);

    // Stick attack transient on tom head
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq * 4, t);
    filter.Q.setValueAtTime(1.5, t);

    const attackGain = this.ctx.createGain();
    attackGain.gain.setValueAtTime(vol * 0.35, t);
    attackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    noise.connect(filter);
    filter.connect(attackGain);
    attackGain.connect(this.master);
    noise.start(t);
    noise.stop(t + 0.04);
  }

  // Hi-Hat (Closed 'X' chokes any ringing Open 'O')
  _playHiHat(t, vol, isOpen = false) {
    if (!isOpen && this.activeOpenHatGain) {
      try {
        this.activeOpenHatGain.gain.cancelScheduledValues(t);
        this.activeOpenHatGain.gain.setValueAtTime(0.001, t);
      } catch (_) {}
      this.activeOpenHatGain = null;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(9200, t);
    bandpass.Q.setValueAtTime(1.2, t);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(6800, t);

    const gain = this.ctx.createGain();
    const decay = isOpen ? 0.42 : 0.055;
    gain.gain.setValueAtTime(vol * (isOpen ? 0.55 : 0.48), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    if (isOpen) {
      this.activeOpenHatGain = gain;
    }

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.master);

    noise.start(t);
    noise.stop(t + decay + 0.02);
  }

  // Crash Cymbal ('C') — Explosive shimmer for Beat 1 'CB' landings
  _playCrash(t, vol) {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(3600, t);

    const peaking = this.ctx.createBiquadFilter();
    peaking.type = 'peaking';
    peaking.frequency.setValueAtTime(6200, t);
    peaking.gain.setValueAtTime(6, t);

    const gain = this.ctx.createGain();
    const decay = 1.25;
    gain.gain.setValueAtTime(vol * 0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    noise.connect(highpass);
    highpass.connect(peaking);
    peaking.connect(gain);
    gain.connect(this.master);

    noise.start(t);
    noise.stop(t + decay + 0.05);
  }

  // Ride Cymbal ('R') — Metallic bell ping + wash
  _playRide(t, vol) {
    // Bell ping
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, t);
    oscGain.gain.setValueAtTime(vol * 0.25, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(oscGain);
    oscGain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.26);

    // Shimmer wash
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(7500, t);
    filter.Q.setValueAtTime(2.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(t);
    noise.stop(t + 0.58);
  }

  // Metronome Click (Downbeat Beat 1 = High, Quarter Beat = Mid, Subdivision = Soft Tick)
  _playClick(t, type = 'beat') {
    if (!this.metronomeEnabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'downbeat') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1350, t);
      gain.gain.setValueAtTime(this.clickVolume * 0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    } else if (type === 'beat') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, t);
      gain.gain.setValueAtTime(this.clickVolume * 0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
    } else {
      // Subdivision ('e', '&', 'a')
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, t);
      gain.gain.setValueAtTime(this.clickVolume * 0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
    }

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  setStudioTrack(audioUrl, baseBpm = 100) {
    this.songBaseBpm = baseBpm || 100;
    try {
      this.studioAudio.pause();
    } catch (_) {}

    if (!audioUrl) {
      this.studioAudioReady = false;
      this.studioAudio.removeAttribute('src');
      if (this.onStudioAudioStateCallback) this.onStudioAudioStateCallback(false);
      return;
    }

    this.studioAudioReady = false;
    this.studioAudio.src = audioUrl;
    this.studioAudio.load();
  }

  _syncStudioPlaybackRate() {
    if (!this.studioAudio) return;
    const rate = Math.max(0.5, Math.min(1.5, this.bpm / Math.max(40, this.songBaseBpm || 100)));
    try {
      this.studioAudio.playbackRate = rate;
      this.studioAudio.volume = this.riffEnabled ? 0.68 : 0.0;
    } catch (_) {}
  }

  // Synchronized Guitar / Piano / Bass Riff — uses REAL Studio Audio when available, or sampled instruments for drills
  _playRiffNotes(midiNotes, durationSec, toneType = 'metal', t) {
    if (!this.riffEnabled || !midiNotes || midiNotes.length === 0) return;
    // When the real studio master audio track is loaded & ready, let the real studio recording play instead of MIDI notes!
    if (this.studioAudioReady && this.studioAudio && this.studioAudio.src) {
      return;
    }
    this.init();

    const notes = (Array.isArray(midiNotes) ? midiNotes : [midiNotes]).slice(0, 3);
    const isChord = notes.length > 1;
    const baseVol = (this.riffVolume * 1.25) / Math.sqrt(notes.length);
    const missing = [];

    notes.forEach((midi) => {
      if (!midi || midi < 21 || midi > 108) return;
      this._voicesForTone(toneType, midi, isChord).forEach((v) => {
        const buf = this.sampleBuffers[`${v.inst}:${v.midi}`];
        if (buf) {
          this._playSampleVoice(buf, v, durationSec, toneType, t, baseVol);
        } else {
          missing.push(midi);
          this._loadSample(v.inst, v.midi);
        }
      });
    });

    // Sample not ready yet (first loop only) -> soft synth placeholder
    if (missing.length > 0) {
      this._playRiffSynth([...new Set(missing)], durationSec, toneType, t);
    }
  }

  _playSampleVoice(buffer, voice, durationSec, toneType, t, baseVol) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const gain = this.ctx.createGain();
    const vol = baseVol * voice.gain;
    // Piano/clean ring longer; distorted guitar is palm-muted-tight like real riffs
    const hold =
      toneType === 'metal'
        ? Math.max(0.09, durationSec * 0.95)
        : Math.max(0.25, durationSec * 1.6);
    const release = toneType === 'metal' ? 0.06 : 0.25;

    gain.gain.setValueAtTime(vol, t);
    gain.gain.setValueAtTime(vol, t + hold);
    gain.gain.setTargetAtTime(0.0001, t + hold, release / 3);

    src.connect(gain);
    gain.connect(this.riffBus);
    src.start(t);
    src.stop(t + hold + release + 0.1);
  }

  // Fallback synth (only used while samples are downloading)
  _playRiffSynth(midiNotes, durationSec, toneType = 'metal', t) {
    if (!this.riffEnabled || !midiNotes || midiNotes.length === 0) return;

    const notes = Array.isArray(midiNotes) ? midiNotes.slice(0, 3) : [midiNotes];
    const perNoteVol = (this.riffVolume * 0.5) / Math.sqrt(notes.length);
    const dur = Math.max(0.12, Math.min(0.9, durationSec * 1.6));

    notes.forEach((midi) => {
      if (!midi || midi < 20 || midi > 108) return;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      if (toneType === 'piano' || toneType === 'clean') {
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq * 2, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2800, t);
      } else {
        // Fat Metal Guitar / Bass Power Synth (Root + 5th harmonic warmth)
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq * 1.498, t); // Power 5th
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1650, t);
        filter.Q.setValueAtTime(2.2, t);
      }

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(perNoteVol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + dur + 0.02);
      osc2.stop(t + dur + 0.02);
    });
  }

  // ==========================================================================
  // PRECISION SCHEDULER & TRANSPORT
  // ==========================================================================

  setPattern(steps, subdivision = 4) {
    this.steps = steps || [];
    this.subdivision = subdivision;
    if (this.currentStep >= this.steps.length) {
      this.currentStep = 0;
    }
    this.preloadRiffSamples(this.steps);
  }

  setBpm(newBpm) {
    this.bpm = Math.max(40, Math.min(220, Math.round(newBpm)));
    this._syncStudioPlaybackRate();
    if (this.onBpmChangeCallback) {
      this.onBpmChangeCallback(this.bpm);
    }
  }

  start() {
    this.init();
    if (this.isPlaying || this.steps.length === 0) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.currentLoopCount = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;

    if (this.studioAudioReady && this.studioAudio && this.studioAudio.src && this.riffEnabled) {
      this._syncStudioPlaybackRate();
      this.studioAudio.currentTime = 0;
      this.studioAudio.play().catch(() => {});
    }

    this.timerID = setInterval(() => this._scheduler(), this.lookaheadMs);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    if (this.studioAudio) {
      try {
        this.studioAudio.pause();
      } catch (_) {}
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  _scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadSec) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      this._advanceStep();
    }
  }

  _scheduleStep(stepIndex, time) {
    const step = this.steps[stepIndex];
    if (!step) return;

    // 1. Schedule Metronome Click
    const muteClickForGap = this.gapClickMode && step.isFillStep;
    if (!muteClickForGap) {
      if (step.isBarStart) {
        this._playClick(time, 'downbeat');
      } else if (step.isBeat) {
        this._playClick(time, 'beat');
      } else if (this.subdivisionClick) {
        this._playClick(time, 'sub');
      }
    }

    // 2. Schedule Recognizable Song Riff / Melody Notes (if present on this step)
    if (step.riffNotes && step.riffNotes.length > 0) {
      const stepDur = (60.0 / this.bpm) / this.subdivision;
      this._playRiffNotes(step.riffNotes, stepDur * (step.riffHoldSteps || 2), step.riffTone || 'metal', time);
    }

    // 3. Schedule Drum Hits in this Step
    if (Array.isArray(step.drums)) {
      step.drums.forEach((drumCode) => {
        if (drumCode && drumCode !== '-') {
          const vel = step.isLandingStep ? 1.12 : 1.0;
          this.triggerDrum(drumCode, time, vel);
        }
      });
    }

    // 4. Schedule UI Playhead Highlight synchronized to audio time
    if (this.onStepCallback) {
      const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
      const capturedStep = stepIndex;
      const capturedLoop = this.currentLoopCount;
      setTimeout(() => {
        if (this.isPlaying) {
          this.onStepCallback(capturedStep, step, capturedLoop);
        }
      }, delayMs);
    }
  }

  _advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerStep = secondsPerBeat / this.subdivision;
    this.nextNoteTime += secondsPerStep;

    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.currentStep = 0;
      this.currentLoopCount++;

      // Handle Auto Speed-Up (BPM Ladder)
      if (
        this.autoSpeedUp &&
        this.currentLoopCount > 0 &&
        this.currentLoopCount % this.speedUpEveryLoops === 0 &&
        this.bpm < this.targetBpm
      ) {
        const nextBpm = Math.min(this.targetBpm, this.bpm + this.speedUpIncrement);
        this.setBpm(nextBpm);
      }

      if (this.onLoopCallback) {
        this.onLoopCallback(this.currentLoopCount, this.bpm);
      }
    }
  }
}

window.DrumAudioEngine = DrumAudioEngine;
