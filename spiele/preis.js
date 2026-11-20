// =============================================================
//  Spiel-Modul: Preis-Schätzer
// =============================================================
const DATEN = require("../daten/preis-produkte.json");

const PRODUKTE = DATEN.produkte;
const KATEGORIEN = DATEN.kategorien.map((k) => ({ ...k, anzahl: PRODUKTE.filter((p) => p.kat === k.id).length }));
const MODI = ["klassisch", "nichtdrueber", "hoehertiefer", "sortieren"];
const ALLE_MODI = [...MODI, "mix"];

// Ungefähre Wechselkurse, nur um Preise in verschiedenen Währungen vergleichen zu können
const IN_EURO = { "€": 1, $: 0.87, "£": 1.15, CHF: 1.07 };
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
  if (modus === "hoehertiefer") return { modus, produkte: ziehe(d, 2, 1.5), sekunden: Math.max(10, Math.round(e.sekunden / 2)) };
  if (modus === "sortieren") return { modus, produkte: ziehe(d, 4, 1.3), sekunden: e.sekunden + 10 };
  return { modus, produkte: ziehe(d, 1), sekunden: e.sekunden };
}

// ---------- Punkte ----------
function auswerten(raum) {
  const r = raum.daten.runde;
  const ergebnisse = Object.values(raum.spieler).map((s) => ({
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
        const rest = Math.max(0, r.endetUm - r.tipps[e.id].zeit) / (r.sekunden * 1000);
        e.punkte = 500 + Math.round(500 * Math.min(1, rest));
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
  return ergebnisse.sort((a, b) => b.punkte - a.punkte);
}

// ---------- Ablauf ----------
function starteRunde(raum, ctx) {
  const d = raum.daten;
  const plan = d.naechste || planeRunde(raum);
  d.naechste = null;
  d.rundeNr++;
  d.phase = "frage";
  const dauer = INTRO_MS + plan.sekunden * 1000;
  d.runde = { ...plan, tipps: {}, endetUm: Date.now() + dauer, ergebnisse: null };
  clearTimeout(d.timer);
  d.timer = setTimeout(() => beendeRunde(raum, ctx), dauer + 300);
  ctx.sende(raum);
}

function beendeRunde(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "frage") return;
  clearTimeout(d.timer);
  d.runde.ergebnisse = auswerten(raum);
  const letzte = d.rundeNr >= raum.einstellungen.preis.runden;
  d.phase = letzte ? "ende" : "aufloesung";
  if (!letzte) d.naechste = planeRunde(raum);
  ctx.sende(raum);
}

function alleFertig(raum, ctx) {
  const online = ctx.onlineSpieler(raum);
  return online.length > 0 && online.every((s) => raum.daten.runde.tipps[s.id]);
}

// ---------- Schnittstelle für den Server-Kern ----------
module.exports = {
  meta: () => ({ kategorien: KATEGORIEN, modi: ALLE_MODI }),

  standardEinstellungen: () => ({ modus: "mix", runden: 10, sekunden: 30, kategorien: KATEGORIEN.map((k) => k.id) }),

  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (ALLE_MODI.includes(e.modus)) neu.modus = e.modus;
    if (e.runden !== undefined) neu.runden = Math.min(30, Math.max(3, parseInt(e.runden) || 10));
    if (e.sekunden !== undefined) neu.sekunden = Math.min(90, Math.max(10, parseInt(e.sekunden) || 30));
    if (Array.isArray(e.kategorien)) {
      const gueltig = e.kategorien.filter((k) => KATEGORIEN.some((x) => x.id === k));
      if (gueltig.length) neu.kategorien = gueltig;
    }
    return neu;
  },

  starten(raum, ctx) {
    const pool = PRODUKTE.filter((p) => raum.einstellungen.preis.kategorien.includes(p.kat));
    raum.daten = { phase: "frage", pool, stapel: mischen(pool), rundeNr: 0, runde: null, naechste: null, letzterModus: null, timer: null };
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
        restMs: d.phase === "frage" ? Math.max(0, r.endetUm - Date.now()) : 0,
        produkte: r.produkte.map((p, i) => oeffentlich(p, offen || (r.modus === "hoehertiefer" && i === 0))),
        ergebnisse: offen ? r.ergebnisse : null,
        loesung: offen ? r.loesung ?? null : null,
      },
      vorladen: d.phase === "aufloesung" && d.naechste ? d.naechste.produkte.map((p) => p.bild?.url).filter(Boolean) : [],
    };
  },
};
