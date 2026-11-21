// =============================================================
//  SpielO-Beat: eigene Hintergrundmusik, komplett im Browser erzeugt
//  (Web Audio, keine Datei). Einfach und zum Mitsummen:
//  C – G – Am – F, 100 BPM, Kick/Clap/Hi-Hat, hüpfender Bass,
//  weiches Pad und eine Melodie, die sich festsetzt.
//
//  Ablauf (16 Takte, dann von vorn):
//    A  Hook          A' Hook mit Schluss
//    B  höher, Frage-Antwort   A' Hook mit Schluss
//  Ab dem 2. Durchgang kommt ein leises Glitzer-Arpeggio dazu.
// =============================================================
const SpielOBeat = (() => {
  const BPM = 100;
  const SCHRITT = 60 / BPM / 4; // eine Sechzehntel
  const VORLAUF = 0.15; // so weit im Voraus wird geplant (Sekunden)
  const PEGEL = 0.75; // Gesamtlautstärke vor dem Regler

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  // Notennamen → MIDI (C5 = 72)
  const N = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84 };

  // Akkorde pro Takt: Grundton (Bass) und Töne (Pad)
  const AKKORDE = [
    { bass: 36, toene: [N.C4, N.E4, N.G4] }, // C
    { bass: 43, toene: [N.D4, N.G4, N.B4] }, // G
    { bass: 45, toene: [N.C4, N.E4, N.A4] }, // Am
    { bass: 41, toene: [N.C4, N.F4, N.A4] }, // F
  ];

  // Melodie in Achteln ("-" = Ton klingt weiter, null = Pause)
  const A = [
    ["E5", "G5", "A5", "G5", "E5", "-", "C5", "-"],
    ["D5", "G5", "B5", "A5", "G5", "-", "D5", "-"],
    ["C5", "E5", "A5", "G5", "E5", "-", "C5", "-"],
    ["A5", "G5", "F5", "E5", "D5", "-", "-", null],
  ];
  const A2 = [A[0], A[1], A[2], ["F5", "E5", "D5", "E5", "C5", "-", "-", null]];
  const B = [
    ["C6", "-", "C6", "B5", "C6", "-", "G5", "-"],
    ["B5", "-", "B5", "A5", "B5", "-", "G5", "-"],
    ["A5", "-", "A5", "G5", "A5", "-", "E5", "-"],
    ["F5", "G5", "A5", "B5", "C6", "-", "-", null],
  ];
  const SONG = [...A, ...A2, ...B, ...A2]; // 16 Takte

  // Länge jeder Melodienote in Achteln vorberechnen
  const MELODIE = SONG.map((takt) => takt.map((n, i) => {
    if (!n || n === "-") return null;
    let laenge = 1;
    while (takt[i + laenge] === "-") laenge++;
    return { midi: N[n], laenge };
  }));

  let ctx = null, ausgang = null, master = null, echo = null, rauschen = null;
  let timer = null, schritt = 0, naechsteZeit = 0, laeuft = false;

  function aufbauen(audioCtx, ziel) {
    if (ctx === audioCtx && master) return;
    ctx = audioCtx;
    ausgang = ziel;
    master = ctx.createGain();
    master.gain.value = 0;
    const kompressor = ctx.createDynamicsCompressor();
    kompressor.threshold.value = -16;
    kompressor.ratio.value = 4;
    kompressor.attack.value = 0.005;
    kompressor.release.value = 0.2;
    master.connect(kompressor).connect(ausgang);
    // Echo für die Melodie (punktierte Achtel)
    echo = ctx.createDelay(1);
    echo.delayTime.value = SCHRITT * 3;
    const rueck = ctx.createGain();
    rueck.gain.value = 0.28;
    const nass = ctx.createGain();
    nass.gain.value = 0.22;
    const daempfer = ctx.createBiquadFilter();
    daempfer.type = "lowpass";
    daempfer.frequency.value = 2200;
    echo.connect(daempfer).connect(rueck).connect(echo);
    daempfer.connect(nass).connect(master);
    // Rauschen einmal erzeugen (für Clap und Hi-Hat)
    rauschen = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = rauschen.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ---------- Instrumente ----------
  function huelle(g, t, { laut, attack = 0.005, dauer, release = 0.08 }) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, laut * 0.55), t + attack + dauer * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + release);
  }

  function kick(t, laut = 0.8) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(laut, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.35);
  }

  function geraeusch(t, { typ, freq, q = 1, laut, dauer }) {
    const q1 = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    q1.buffer = rauschen;
    f.type = typ; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(laut, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q1.connect(f).connect(g).connect(master);
    q1.start(t, Math.random() * 0.3); q1.stop(t + dauer + 0.02);
  }
  const clap = (t) => {
    // drei schnelle Schläge klingen wie Klatschen
    [0, 0.012, 0.024].forEach((v, i) => geraeusch(t + v, { typ: "bandpass", freq: 1400, q: 0.9, laut: i === 2 ? 0.45 : 0.3, dauer: i === 2 ? 0.16 : 0.03 }));
  };
  const hihat = (t, laut = 0.07, offen = false) => geraeusch(t, { typ: "highpass", freq: 7500, laut, dauer: offen ? 0.22 : 0.035 });

  function bass(t, midi, dauer) {
    const o = ctx.createOscillator(), sub = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; sub.type = "sine";
    o.frequency.value = hz(midi); sub.frequency.value = hz(midi);
    f.type = "lowpass"; f.Q.value = 2.5;
    f.frequency.setValueAtTime(650, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    huelle(g, t, { laut: 0.2, dauer, release: 0.05 });
    o.connect(f); sub.connect(f); f.connect(g).connect(master);
    o.start(t); sub.start(t); o.stop(t + dauer + 0.1); sub.stop(t + dauer + 0.1);
  }

  function melodie(t, midi, dauer) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "square"; o2.type = "triangle";
    o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 1.003;
    f.type = "lowpass"; f.frequency.value = 2600;
    huelle(g, t, { laut: 0.15, attack: 0.008, dauer, release: 0.12 });
    o.connect(f); o2.connect(f); f.connect(g);
    g.connect(master); g.connect(echo);
    o.start(t); o2.start(t); o.stop(t + dauer + 0.2); o2.stop(t + dauer + 0.2);
  }

  function glitzer(t, midi) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = hz(midi + 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(master); g.connect(echo);
    o.start(t); o.stop(t + 0.2);
  }

  function pad(t, toene, dauer) {
    for (const midi of toene) {
      for (const verstimmt of [-6, 6]) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = "sawtooth"; o.frequency.value = hz(midi); o.detune.value = verstimmt;
        f.type = "lowpass"; f.frequency.value = 750;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.022, t + 0.25);
        g.gain.setValueAtTime(0.022, t + dauer - 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.1);
        o.connect(f).connect(g).connect(master);
        o.start(t); o.stop(t + dauer + 0.15);
      }
    }
  }

  // ---------- Ein Sechzehntel spielen ----------
  const BASS_MUSTER = { 0: 0, 3: 0, 6: 12, 8: 0, 11: 0, 14: 12 }; // hüpfend, mit Oktavsprung
  function spieleSchritt(n, t) {
    const takt = Math.floor(n / 16) % SONG.length;
    const durchgang = Math.floor(n / (16 * SONG.length));
    const s = n % 16;
    const akkord = AKKORDE[takt % 4];
    const intro = n < 32; // die ersten 2 Takte: nur Beat und Bass
    const teilB = takt >= 8 && takt < 12;

    // Schlagzeug
    if (s === 0 || s === 8 || (s === 10 && takt % 2 === 1)) kick(t, s === 10 ? 0.5 : 0.8);
    if ((s === 4 || s === 12) && !(intro && n < 16)) clap(t);
    if (s % 2 === 0) hihat(t, s % 4 === 2 ? 0.08 : 0.045, s === 14 && takt % 2 === 1);
    if (teilB && s % 2 === 1) hihat(t, 0.025);
    // Bass
    if (BASS_MUSTER[s] !== undefined) bass(t, akkord.bass + BASS_MUSTER[s], SCHRITT * (s === 14 || s === 6 ? 1.6 : 2.4));
    if (intro) return;
    // Pad (ganzer Takt)
    if (s === 0) pad(t, akkord.toene, SCHRITT * 16);
    // Melodie (in Achteln)
    if (s % 2 === 0) {
      const note = MELODIE[takt][s / 2];
      if (note) melodie(t, note.midi, SCHRITT * 2 * note.laenge * 0.9);
    }
    // Glitzer-Arpeggio ab dem 2. Durchgang (nicht im B-Teil, damit es nicht zu voll wird)
    if (durchgang > 0 && !teilB && s % 2 === 1) glitzer(t, akkord.toene[((s - 1) / 2) % 3]);
  }

  function planen() {
    if (!laeuft) return;
    while (naechsteZeit < ctx.currentTime + VORLAUF) {
      spieleSchritt(schritt, naechsteZeit);
      naechsteZeit += SCHRITT;
      schritt++;
    }
  }

  return {
    get laeuft() { return laeuft; },
    // audioCtx: der AudioContext, ziel: Knoten, an den der Beat angeschlossen wird (z. B. Lautstärkeregler)
    start(audioCtx, ziel, { vonVorn = false } = {}) {
      aufbauen(audioCtx, ziel);
      if (laeuft) return;
      laeuft = true;
      if (vonVorn) schritt = 0;
      naechsteZeit = ctx.currentTime + 0.06;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(PEGEL, ctx.currentTime + 0.6);
      planen();
      timer = setInterval(planen, 25);
    },
    stop() {
      if (!laeuft) return;
      laeuft = false;
      clearInterval(timer);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.25);
      // beim nächsten Start am Taktanfang weitermachen
      schritt = Math.ceil(schritt / 16) * 16;
    },
    // Für Tests: den Beat in einen OfflineAudioContext rendern
    _offline(offCtx, sekunden) {
      const merke = { ctx, ausgang, master, echo, rauschen };
      ctx = null; master = null;
      aufbauen(offCtx, offCtx.destination);
      master.gain.value = PEGEL;
      let n = 0;
      for (let t = 0.05; t < sekunden; t += SCHRITT) spieleSchritt(n++, t);
      ({ ctx, ausgang, master, echo, rauschen } = merke);
    },
  };
})();
