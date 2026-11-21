// =============================================================
//  Sounds – komplett im Browser erzeugt (Web Audio), keine Dateien nötig
// =============================================================
const Ton = (() => {
  let ctx = null;
  let an = true;
  try { an = localStorage.getItem("ton") !== "aus"; } catch {}

  function kontext() {
    if (!an) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
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
    osc.connect(gain).connect(c.destination);
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
    quelle.connect(filter).connect(gain).connect(c.destination);
    quelle.start(c.currentTime + start);
  }

  return {
    get an() { return an; },
    umschalten() {
      an = !an;
      try { localStorage.setItem("ton", an ? "an" : "aus"); } catch {}
      if (an) this.klick();
      return an;
    },
    entsperren() { kontext(); },
    klick() { ton(660, 0.06, { typ: "triangle", laut: 0.08 }); },
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
    fanfare() {
      const noten = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.75], [659, 1.0], [784, 1.15], [1047, 1.35]];
      noten.forEach(([f, s]) => ton(f, 0.25, { typ: "square", laut: 0.06, start: s }));
    },
  };
})();
