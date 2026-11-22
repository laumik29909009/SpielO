// =============================================================
//  Sounds – komplett im Browser erzeugt (Web Audio), keine Dateien nötig
// =============================================================
const Ton = (() => {
  let ctx = null, master = null;
  let an = true, lautstaerke = 0.8;
  try { an = localStorage.getItem("ton") !== "aus"; const l = parseFloat(localStorage.getItem("lautstaerke")); if (l >= 0 && l <= 1) lautstaerke = l; } catch {}
  let serieZaehler = 0, serieZeit = 0;

  function kontext() {
    if (!an) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // Alle Töne laufen über einen gemeinsamen Regler (Lautstärke) und einen sanften Begrenzer
      const begrenzer = ctx.createDynamicsCompressor();
      begrenzer.threshold.value = -10; begrenzer.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = lautstaerke;
      master.connect(begrenzer).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Ein einzelner Ton mit kurzer Hüllkurve
  function ton(freq, dauer, { typ = "sine", laut = 0.15, start = 0, gleitenZu = null } = {}) {
    const c = kontext();
    if (!c) return;
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(freq, t);
    if (gleitenZu) osc.frequency.exponentialRampToValueAtTime(gleitenZu, t + dauer);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(laut, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dauer + 0.05);
  }

  function rauschen(dauer, laut = 0.08, start = 0) {
    const c = kontext();
    if (!c) return;
    const puffer = c.createBuffer(1, c.sampleRate * dauer, c.sampleRate);
    const d = puffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const quelle = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    gain.gain.value = laut;
    quelle.buffer = puffer;
    quelle.connect(filter).connect(gain).connect(master);
    quelle.start(c.currentTime + start);
  }

  return {
    get an() { return an; },
    get lautstaerke() { return lautstaerke; },
    set lautstaerke(v) {
      lautstaerke = Math.max(0, Math.min(1, v));
      try { localStorage.setItem("lautstaerke", String(lautstaerke)); } catch {}
      if (master) master.gain.setTargetAtTime(lautstaerke, ctx.currentTime, 0.03);
    },
    umschalten() {
      an = !an;
      try { localStorage.setItem("ton", an ? "an" : "aus"); } catch {}
      if (an) this.klick();
      return an;
    },
    entsperren() { kontext(); },
    // Klick mit minimaler Zufallsstimmung, damit viele Klicks nicht maschinell klingen
    klick() { ton(660 * (0.97 + Math.random() * 0.06), 0.06, { typ: "triangle", laut: 0.08 }); },
    // Serie: jeder Erfolg kurz hintereinander klingt einen Halbton höher (bis 12 Stufen)
    serie(n = null) {
      const jetzt = Date.now();
      serieZaehler = n ?? (jetzt - serieZeit < 4000 ? serieZaehler + 1 : 0);
      serieZeit = jetzt;
      // Dur-Tonleiter ab C: jede weitere Stufe der Serie klingt einen Ton höher
      const SKALA = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
      const f = 523.25 * Math.pow(2, SKALA[Math.min(SKALA.length - 1, serieZaehler)] / 12);
      ton(f, 0.12, { typ: "triangle", laut: 0.1 });
      ton(f * 1.5, 0.18, { typ: "sine", laut: 0.06, start: 0.05 });
      return serieZaehler;
    },
    tick() { ton(1200, 0.05, { typ: "square", laut: 0.04 }); },
    abgeben() { ton(520, 0.08, { typ: "triangle" }); ton(780, 0.12, { typ: "triangle", start: 0.07 }); },
    rundeStart() { ton(300, 0.35, { typ: "sawtooth", laut: 0.05, gleitenZu: 900 }); rauschen(0.3, 0.05); },
    trommel(sek = 1.4) {
      // Trommelwirbel: viele kurze Rauschimpulse, immer schneller
      let t = 0, abstand = 0.09;
      while (t < sek) { rauschen(0.05, 0.12, t); t += abstand; abstand = Math.max(0.035, abstand * 0.94); }
    },
    ding() { ton(880, 0.5, { typ: "sine", laut: 0.2 }); ton(1320, 0.6, { typ: "sine", laut: 0.12, start: 0.05 }); },
    richtig() { [523, 659, 784].forEach((f, i) => ton(f, 0.18, { typ: "triangle", start: i * 0.08 })); },
    falsch() { ton(220, 0.35, { typ: "sawtooth", laut: 0.08, gleitenZu: 110 }); },
    volltreffer() { [784, 988, 1175, 1568].forEach((f, i) => ton(f, 0.2, { typ: "square", laut: 0.06, start: i * 0.07 })); },
    alarm() {
      for (let i = 0; i < 3; i++) ton(880, 0.16, { typ: "square", laut: 0.07, start: i * 0.22, gleitenZu: 660 });
    },
    // Auszeichnung erscheint: kurzes Glitzern, mit jeder Karte etwas höher
    auszeichnung(stufe = 0) {
      const basis = 660 * Math.pow(2, (stufe % 6) * 2 / 12);
      ton(basis, 0.14, { typ: "triangle", laut: 0.09 });
      ton(basis * 1.5, 0.22, { typ: "sine", laut: 0.08, start: 0.06 });
      ton(basis * 2, 0.3, { typ: "sine", laut: 0.04, start: 0.12 });
    },
    // Podest-Säule wächst: aufsteigender Ton
    aufsteigen(dauer = 0.6, hoch = 1) { ton(180 * hoch, dauer, { typ: "triangle", laut: 0.06, gleitenZu: 520 * hoch }); },
    // Quartett: Karte fliegt, Treffer, Schwerter klirren, Drachenatem
    wusch() { rauschen(0.25, 0.06); ton(500, 0.22, { typ: "sine", laut: 0.03, gleitenZu: 1400 }); },
    treffer() { ton(150, 0.25, { typ: "sine", laut: 0.3, gleitenZu: 50 }); rauschen(0.12, 0.14); },
    klirr() { [1568, 2093, 2637].forEach((f, i) => ton(f, 0.5, { typ: "triangle", laut: 0.05, start: i * 0.02 })); rauschen(0.1, 0.1); },
    feuerstoss(element = "feuer") {
      if (element === "blitz") { for (let i = 0; i < 4; i++) ton(1800 - i * 300, 0.06, { typ: "square", laut: 0.05, start: i * 0.05 }); rauschen(0.3, 0.1); return; }
      if (element === "eis") { [2400, 3000, 2700].forEach((f, i) => ton(f, 0.25, { typ: "sine", laut: 0.04, start: i * 0.06 })); rauschen(0.35, 0.05); return; }
      rauschen(0.5, 0.16);
      ton(120, 0.45, { typ: "sawtooth", laut: 0.05, gleitenZu: 60 });
    },
    // Zwei kurze Klopfer auf den Tisch
    klopf() { ton(140, 0.08, { typ: "sine", laut: 0.35, gleitenZu: 70 }); rauschen(0.05, 0.12); ton(140, 0.08, { typ: "sine", laut: 0.35, start: 0.16, gleitenZu: 70 }); rauschen(0.05, 0.12, 0.16); },
    // Publikum jubelt: je höher die Stufe (1–5), desto länger und lauter
    jubel(staerke = 1) {
      const s = Math.max(1, Math.min(5, staerke));
      for (let i = 0; i < 3 + s * 2; i++) rauschen(0.35 + s * 0.12, 0.03 + s * 0.022, i * 0.07);
    },
    fanfare() {
      const noten = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.75], [659, 1.0], [784, 1.15], [1047, 1.35]];
      noten.forEach(([f, s]) => ton(f, 0.25, { typ: "square", laut: 0.06, start: s }));
    },
  };
})();
