// =============================================================
//  SpielO-Beat: der eigene SpielO-Song (public/musik/spielo-beat.mp3)
//  Läuft über Web Audio als nahtlose Schleife: Stille am Anfang und Ende
//  wird beim Laden erkannt und übersprungen, damit es beim Wiederholen nicht hakt.
//  Gleiche Schnittstelle wie der frühere, im Browser erzeugte Beat (beat-alt.js):
//    SpielOBeat.start(audioCtx, ziel, { vonVorn })  ·  SpielOBeat.stop()  ·  SpielOBeat.laeuft
// =============================================================
const SpielOBeat = (() => {
  const DATEI = "/musik/spielo-beat.mp3";
  const PEGEL = 4; // die Datei ist leise abgemischt (Spitze −20 dB): etwa +12 dB anheben
  const SCHWELLE = 0.004; // darunter gilt als Stille (für die Schleifenpunkte)

  let ctx = null, puffer = null, laden = null;
  let quelle = null, lautheit = null;
  let gewollt = false, startZeit = 0, versatz = 0;
  let schleife = { start: 0, ende: 0 };

  // Erste und letzte hörbare Stelle finden
  function schleifenpunkte(b) {
    const k = b.getChannelData(0), k2 = b.numberOfChannels > 1 ? b.getChannelData(1) : k;
    const laut = (i) => Math.abs(k[i]) > SCHWELLE || Math.abs(k2[i]) > SCHWELLE;
    let a = 0, e = k.length - 1;
    while (a < e && !laut(a)) a++;
    while (e > a && !laut(e)) e--;
    // Kaum Stille gefunden oder Datei seltsam: ganze Datei nehmen
    if (e - a < b.sampleRate * 5) return { start: 0, ende: b.duration };
    return { start: a / b.sampleRate, ende: (e + 1) / b.sampleRate };
  }

  function laden_(audioCtx) {
    if (puffer && ctx === audioCtx) return Promise.resolve(puffer);
    if (laden && ctx === audioCtx) return laden;
    ctx = audioCtx;
    laden = fetch(DATEI)
      .then((r) => { if (!r.ok) throw new Error("Beat nicht gefunden"); return r.arrayBuffer(); })
      .then((daten) => new Promise((ok, fehler) => ctx.decodeAudioData(daten, ok, fehler)))
      .then((b) => { puffer = b; schleife = schleifenpunkte(b); return b; })
      .catch((e) => { laden = null; throw e; });
    return laden;
  }

  function abspielen(ziel) {
    if (!gewollt || !puffer || quelle) return;
    lautheit = ctx.createGain();
    lautheit.gain.setValueAtTime(0.0001, ctx.currentTime);
    lautheit.gain.exponentialRampToValueAtTime(PEGEL, ctx.currentTime + 0.6); // sanft einblenden
    lautheit.connect(ziel);
    quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    quelle.loop = true;
    quelle.loopStart = schleife.start;
    quelle.loopEnd = schleife.ende;
    quelle.connect(lautheit);
    const laenge = schleife.ende - schleife.start;
    const ab = schleife.start + (((versatz % laenge) + laenge) % laenge);
    quelle.start(0, ab);
    startZeit = ctx.currentTime - (ab - schleife.start);
  }

  return {
    get laeuft() { return gewollt && !!quelle; },
    start(audioCtx, ziel, { vonVorn = false } = {}) {
      if (vonVorn) versatz = 0;
      gewollt = true;
      if (quelle && ctx === audioCtx) return;
      laden_(audioCtx).then(() => abspielen(ziel)).catch(() => { gewollt = false; });
    },
    stop() {
      gewollt = false;
      if (!quelle) return;
      // Stelle merken, damit es nach einer Pause dort weitergeht
      versatz = ctx.currentTime - startZeit;
      const q = quelle, l = lautheit, t = ctx.currentTime;
      quelle = null; lautheit = null;
      try {
        l.gain.cancelScheduledValues(t);
        l.gain.setValueAtTime(Math.max(0.0001, l.gain.value), t);
        l.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        q.stop(t + 0.3);
      } catch { try { q.stop(); } catch {} }
      setTimeout(() => { try { l.disconnect(); } catch {} }, 400);
    },
  };
})();
