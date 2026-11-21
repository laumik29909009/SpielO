// =============================================================
//  Spiel-Modul: Preis-Schätzer
// =============================================================
const DATEN = require("../daten/preis-produkte.json");

const PRODUKTE = DATEN.produkte;
const KATEGORIEN = DATEN.kategorien.map((k) => ({ ...k, anzahl: PRODUKTE.filter((p) => p.kat === k.id).length }));
const MODI = ["klassisch", "nichtdrueber", "hoehertiefer", "sortieren"];
const ALLE_MODI = [...MODI, "mix"];

// Ungefähre Wechselkurse, nur um Preise in verschiedenen Währungen vergleichen zu können
const IN_EURO = { "€": 1, $: 0.87, "£": 1.15, CHF: 1.07, DM: 0.51 };
const euroWert = (p) => p.preis * (IN_EURO[p.w] || 1);

const INTRO_MS = 1800;
const VOLLTREFFER = 0.02; // max. 2 % daneben
const MAX_FAKTOR = Math.log10(10); // Faktor 10 daneben = 0 Punkte

const mischen = (liste) => {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

function oeffentlich(p, mitPreis) {
  return {
    id: p.id, name: p.name, info: p.info, emoji: p.emoji, w: p.w, kat: p.kat, bild: p.bild || null,
    preis: mitPreis ? p.preis : null,
    fakt: mitPreis ? p.fakt : null,
  };
}

// ---------- Produkte ziehen ----------
function ziehe(d, anzahl, mindestAbstand = 1) {
  const gewaehlt = [];
  const passt = (p) => gewaehlt.every((g) => {
    const v = euroWert(p) / euroWert(g);
    return Math.max(v, 1 / v) >= mindestAbstand;
  });
  for (let durchgang = 0; durchgang < 3 && gewaehlt.length < anzahl; durchgang++) {
    if (d.stapel.length < anzahl) {
      const imSpiel = new Set(gewaehlt.map((g) => g.id));
      d.stapel.push(...mischen(d.pool.filter((p) => !imSpiel.has(p.id))));
    }
    for (let i = d.stapel.length - 1; i >= 0 && gewaehlt.length < anzahl; i--) {
      if (durchgang === 2 || passt(d.stapel[i])) gewaehlt.push(...d.stapel.splice(i, 1));
    }
  }
  return gewaehlt;
}

function planeRunde(raum) {
  const d = raum.daten;
  const e = raum.einstellungen.preis;
  let modus = e.modus;
  if (modus === "mix") modus = zufall(MODI.filter((m) => m !== d.letzterModus));
  d.letzterModus = modus;
  // sekunden 0 = ohne Zeitlimit: die Runde endet, wenn alle geantwortet haben (oder der Host auflöst)
  if (modus === "hoehertiefer") return { modus, produkte: ziehe(d, 2, 1.5), sekunden: e.sekunden && Math.max(10, Math.round(e.sekunden / 2)) };
  if (modus === "sortieren") return { modus, produkte: ziehe(d, 4, 1.3), sekunden: e.sekunden && e.sekunden + 10 };
  return { modus, produkte: ziehe(d, 1), sekunden: e.sekunden };
}

// ---------- Punkte ----------
function auswerten(raum) {
  const r = raum.daten.runde;
  const ergebnisse = Object.values(raum.spieler).filter((s) => !s.zuschauer).map((s) => ({
    id: s.id, tipp: r.tipps[s.id] ? r.tipps[s.id].wert : null, punkte: 0,
  }));

  if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
    const preis = r.produkte[0].preis;
    for (const e of ergebnisse) {
      if (e.tipp === null) continue;
      e.abweichung = (e.tipp - preis) / preis;
      e.volltreffer = Math.abs(e.abweichung) <= VOLLTREFFER;
    }
    if (r.modus === "klassisch") {
      // Logarithmisch: doppelt so viel oder halb so viel ist gleich schlimm
      for (const e of ergebnisse) {
        if (e.tipp === null || e.tipp <= 0) continue;
        const fehler = Math.abs(Math.log10(e.tipp / preis));
        e.punkte = Math.round(1000 * Math.max(0, 1 - fehler / MAX_FAKTOR)) + (e.volltreffer ? 250 : 0);
      }
    } else {
      const PLATZ = [1000, 700, 500, 350, 250];
      const gueltig = ergebnisse
        .filter((e) => e.tipp !== null)
        .filter((e) => { e.drueber = e.tipp > preis * (1 + 1e-9); return !e.drueber; })
        .sort((a, b) => b.tipp - a.tipp);
      let platz = 0;
      gueltig.forEach((e, i) => {
        if (i > 0 && e.tipp !== gueltig[i - 1].tipp) platz = i;
        e.platz = platz + 1;
        e.punkte = (PLATZ[platz] ?? 200) + (e.volltreffer ? 250 : 0);
      });
    }
  } else if (r.modus === "hoehertiefer") {
    const [a, b] = r.produkte;
    r.loesung = euroWert(b) > euroWert(a) ? "hoeher" : "tiefer";
    for (const e of ergebnisse) {
      if (e.tipp === null) continue;
      e.richtig = e.tipp === r.loesung;
      if (e.richtig) {
        // Tempo-Bonus; ohne Zeitlimit zählen die ersten 20 Sekunden
        const rest = r.sekunden
          ? Math.max(0, r.endetUm - r.tipps[e.id].zeit) / (r.sekunden * 1000)
          : 1 - Math.max(0, r.tipps[e.id].zeit - r.startUm) / 20000;
        e.punkte = 500 + Math.round(500 * Math.max(0, Math.min(1, rest)));
      }
    }
  } else if (r.modus === "sortieren") {
    r.loesung = [...r.produkte].sort((x, y) => euroWert(x) - euroWert(y)).map((p) => p.id);
    for (const e of ergebnisse) {
      if (!Array.isArray(e.tipp)) continue;
      e.treffer = e.tipp.map((id, i) => id === r.loesung[i]);
      const n = e.treffer.filter(Boolean).length;
      e.punkte = n * 200 + (n === r.loesung.length ? 200 : 0);
    }
  }
  for (const e of ergebnisse) raum.spieler[e.id].punkte += e.punkte;
  merkeStatistik(raum, ergebnisse);
  return ergebnisse.sort((a, b) => b.punkte - a.punkte);
}

// ---------- Statistik für die Auszeichnungen am Ende ----------
function merkeStatistik(raum, ergebnisse) {
  const d = raum.daten;
  const r = d.runde;
  for (const e of ergebnisse) {
    const st = (d.statistik[e.id] ||= { schaetz: 0, logSumme: 0, volltreffer: 0, zeitSumme: 0, antworten: 0, htRichtig: 0, sortTreffer: 0, besteRunde: 0, besteRundeNr: 0, drueber: 0 });
    if (e.punkte > st.besteRunde) { st.besteRunde = e.punkte; st.besteRundeNr = d.rundeNr; }
    if (e.tipp === null) continue;
    st.antworten++;
    st.zeitSumme += Math.max(0, r.tipps[e.id].zeit - r.startUm);
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const p = r.produkte[0];
      if (e.volltreffer) st.volltreffer++;
      if (e.drueber) st.drueber++;
      if (e.tipp > 0) {
        st.schaetz++;
        st.logSumme += Math.abs(Math.log10(e.tipp / p.preis));
        const faktor = e.tipp / p.preis;
        if (faktor > (st.hoch?.faktor || 1)) st.hoch = { faktor, name: p.name };
        if (1 / faktor > (st.tief?.faktor || 1)) st.tief = { faktor: 1 / faktor, name: p.name };
      }
    } else if (r.modus === "hoehertiefer") {
      if (e.richtig) st.htRichtig++;
    } else if (r.modus === "sortieren") {
      st.sortTreffer += e.treffer.filter(Boolean).length;
    }
  }
}

const zahl = (x, stellen = 0) => x.toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: stellen });
const mal = (f) => (f >= 10 ? zahl(f) : zahl(f, 1)) + "×";

// Wer bekommt welche Auszeichnung? (beste Werte gewinnen, Gleichstand = geteilt)
function berechneAuszeichnungen(raum) {
  const st = raum.daten.statistik;
  const ids = Object.keys(st).filter((id) => raum.spieler[id]);
  const mehrere = ids.length > 1;
  const kandidaten = [];
  const beste = (wert, { min = -Infinity, klein = false } = {}) => {
    const werte = ids.map((id) => [id, wert(st[id])]).filter(([, w]) => w !== null && isFinite(w) && w >= min);
    if (!werte.length) return null;
    const ziel = klein ? Math.min(...werte.map(([, w]) => w)) : Math.max(...werte.map(([, w]) => w));
    return { wert: ziel, spieler: werte.filter(([, w]) => Math.abs(w - ziel) < 1e-9).map(([id]) => id) };
  };
  const neu = (icon, titel, b, text) => b && kandidaten.push({ icon, titel, spieler: b.spieler, wert: b.wert, text: text(b.wert, st[b.spieler[0]]) });

  // Scharfschütze nur, wenn wirklich gut geschätzt wurde (im Schnitt höchstens 50 % daneben)
  neu("🎯", "Scharfschütze", beste((s) => (s.schaetz >= 2 && s.logSumme / s.schaetz <= Math.log10(1.5) ? s.logSumme / s.schaetz : null), { klein: true }),
    (w) => `im Schnitt nur ${zahl(Math.max(0, (Math.pow(10, w) - 1) * 100))} % daneben`);
  neu("💎", "Volltreffer", beste((s) => s.volltreffer, { min: 1 }), (w) => `${w}× fast exakt getroffen (±2 %)`);
  neu("🎈", "Höhenflug", beste((s) => s.hoch?.faktor ?? null, { min: 2 }), (w, s) => `„${s.hoch.name}“ ${mal(w)} zu teuer geschätzt`);
  neu("🧊", "Schnäppchenjäger", beste((s) => s.tief?.faktor ?? null, { min: 2 }), (w, s) => `„${s.tief.name}“ ${mal(w)} zu billig geschätzt`);
  if (mehrere) neu("⚡", "Blitzmerker", beste((s) => (s.antworten >= 3 ? s.zeitSumme / s.antworten : null), { klein: true }),
    (w) => `antwortet im Schnitt nach ${zahl(w / 1000, 1)} s`);
  neu("🔮", "Hellseher", beste((s) => s.htRichtig, { min: 2 }), (w) => `${w}× teurer oder billiger richtig`);
  neu("📊", "Ordnungsprofi", beste((s) => s.sortTreffer, { min: 4 }), (w) => `${w} Dinge richtig einsortiert`);
  neu("🔥", "Beste Runde", beste((s) => s.besteRunde, { min: 1 }), (w, s) => `${zahl(w)} Punkte in Runde ${s.besteRundeNr}`);
  if (mehrere) neu("🐢", "Die Ruhe selbst", beste((s) => (s.antworten >= 3 ? s.zeitSumme / s.antworten : null)),
    (w) => `nimmt sich im Schnitt ${zahl(w / 1000, 1)} s Zeit`);
  return auswaehlen(mehrere ? kandidaten.filter((k) => k.spieler.length < ids.length) : kandidaten); // alle gleich → sagt nichts aus
}

// Höchstens 6 Auszeichnungen, niemand bekommt mehr als 2 (damit möglichst viele etwas abbekommen)
function auswaehlen(kandidaten) {
  const anzahl = {};
  const liste = [];
  for (const k of kandidaten) {
    if (liste.length >= 6) break;
    if (k.spieler.length === 1 && (anzahl[k.spieler[0]] || 0) >= 2) continue;
    // "Die Ruhe selbst" nur, wenn sich wirklich jemand deutlich mehr Zeit lässt als der Schnellste
    const blitz = kandidaten.find((x) => x.titel === "Blitzmerker");
    if (k.titel === "Die Ruhe selbst" && (!blitz || k.wert < Math.max(blitz.wert * 1.5, blitz.wert + 3000))) continue;
    if (k.spieler.length === 1) anzahl[k.spieler[0]] = (anzahl[k.spieler[0]] || 0) + 1;
    liste.push(k);
  }
  return liste;
}

// ---------- Ablauf ----------
function starteRunde(raum, ctx) {
  const d = raum.daten;
  const plan = d.naechste || planeRunde(raum);
  d.naechste = null;
  d.rundeNr++;
  d.phase = "frage";
  ctx.neueRunde(raum); // Zuschauer steigen jetzt ein
  const dauer = INTRO_MS + plan.sekunden * 1000;
  d.runde = { ...plan, tipps: {}, startUm: Date.now() + INTRO_MS, endetUm: plan.sekunden ? Date.now() + dauer : null, ergebnisse: null };
  clearTimeout(d.timer);
  if (plan.sekunden) d.timer = setTimeout(() => beendeRunde(raum, ctx), dauer + 300);
  ctx.sende(raum);
}

function beendeRunde(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "frage") return;
  clearTimeout(d.timer);
  d.runde.ergebnisse = auswerten(raum);
  ctx.mitgemacht(raum, new Set(Object.keys(d.runde.tipps)), 2); // 2 Runden ohne Tipp → 💤
  const letzte = d.rundeNr >= raum.einstellungen.preis.runden;
  d.phase = letzte ? "ende" : "aufloesung";
  if (!letzte) d.naechste = planeRunde(raum);
  else d.auszeichnungen = berechneAuszeichnungen(raum);
  ctx.sende(raum);
}

function alleFertig(raum, ctx) {
  // Gewartet wird nur auf Aktive: Zuschauer und Abwesende (💤) halten niemanden auf
  const aktive = ctx.aktive(raum);
  return aktive.length > 0 && aktive.every((s) => raum.daten.runde.tipps[s.id]);
}

// ---------- Schnittstelle für den Server-Kern ----------
module.exports = {
  meta: () => ({ kategorien: KATEGORIEN, modi: ALLE_MODI }),

  standardEinstellungen: () => ({
    modus: "mix", runden: 10, sekunden: 30,
    kategorien: KATEGORIEN.filter((k) => !k.ue18).map((k) => k.id),
  }),

  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    const erlaubt = (id) => KATEGORIEN.some((x) => x.id === id);
    if (ALLE_MODI.includes(e.modus)) neu.modus = e.modus;
    if (e.runden !== undefined) neu.runden = Math.min(30, Math.max(3, parseInt(e.runden) || 10));
    if (e.sekunden !== undefined) {
      const sek = parseInt(e.sekunden);
      neu.sekunden = sek === 0 ? 0 : Math.min(90, Math.max(10, sek || 30)); // 0 = ohne Zeitlimit
    }
    if (Array.isArray(e.kategorien)) {
      const gueltig = e.kategorien.filter(erlaubt);
      if (gueltig.length) neu.kategorien = gueltig;
    }
    if (e.alleKategorien) neu.kategorien = KATEGORIEN.filter((k) => !k.ue18).map((k) => k.id); // "Alle" ohne Ü18
    return neu;
  },

  starten(raum, ctx) {
    const e = raum.einstellungen.preis;
    const pool = PRODUKTE.filter((p) => e.kategorien.includes(p.kat));
    if (pool.length < 4) return "Wähle mehr Kategorien aus (mindestens 4 Fragen).";
    raum.daten = { phase: "frage", pool, stapel: mischen(pool), rundeNr: 0, runde: null, naechste: null, letzterModus: null, timer: null, statistik: {}, auszeichnungen: [] };
    starteRunde(raum, ctx);
  },

  beenden(raum) {
    if (raum.daten) clearTimeout(raum.daten.timer);
  },

  istVorbei: (raum) => raum.daten?.phase === "ende",

  aktion(raum, { spielerId, istHost }, typ, wert, ctx) {
    const d = raum.daten;
    if (typ === "naechsteRunde") {
      if (istHost && d.phase === "aufloesung") starteRunde(raum, ctx);
      return;
    }
    if (typ === "aufloesen") { // Host beendet die Runde, z. B. ohne Zeitlimit
      if (istHost && d.phase === "frage" && Date.now() > d.runde.startUm) beendeRunde(raum, ctx);
      return;
    }
    if (typ !== "antwort" || d.phase !== "frage" || d.runde.tipps[spielerId]) return;
    const r = d.runde;
    let ok = null;
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const zahl = Number(wert);
      if (isFinite(zahl) && zahl >= 0 && zahl < 1e16) ok = zahl;
    } else if (r.modus === "hoehertiefer") {
      if (wert === "hoeher" || wert === "tiefer") ok = wert;
    } else if (r.modus === "sortieren") {
      const ids = r.produkte.map((p) => p.id);
      if (Array.isArray(wert) && wert.length === ids.length && ids.every((id) => wert.includes(id))) ok = wert.map(String);
    }
    if (ok === null) return "Ungültige Antwort.";
    r.tipps[spielerId] = { wert: ok, zeit: Date.now() };
    if (alleFertig(raum, ctx)) beendeRunde(raum, ctx);
    else ctx.sende(raum);
  },

  spielerWeg(raum, _id, ctx) {
    if (raum.daten?.phase === "frage" && alleFertig(raum, ctx)) beendeRunde(raum, ctx);
  },

  spielerInfo(raum, s) {
    const d = raum.daten;
    return { fertig: d?.phase === "frage" ? !!d.runde.tipps[s.id] : false };
  },

  ansicht(raum) {
    const d = raum.daten;
    const r = d.runde;
    const offen = d.phase === "aufloesung" || d.phase === "ende";
    return {
      phase: d.phase,
      rundeNr: d.rundeNr,
      runde: {
        nr: d.rundeNr,
        modus: r.modus,
        sekunden: r.sekunden,
        restMs: d.phase === "frage" && r.endetUm ? Math.max(0, r.endetUm - Date.now()) : 0,
        introMs: d.phase === "frage" ? Math.max(0, r.startUm - Date.now()) : 0,
        produkte: r.produkte.map((p, i) => oeffentlich(p, offen || (r.modus === "hoehertiefer" && i === 0))),
        ergebnisse: offen ? r.ergebnisse : null,
        loesung: offen ? r.loesung ?? null : null,
      },
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
      vorladen: d.phase === "aufloesung" && d.naechste ? d.naechste.produkte.map((p) => p.bild?.url).filter(Boolean) : [],
    };
  },
};
