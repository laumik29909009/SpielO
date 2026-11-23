// =============================================================
//  Spiel-Modul: Die Millionenfrage
//  - 15 Fragen bis zur Million, zwei Sicherheitsstufen (500 € und 16.000 €)
//  - Joker: 50:50, Publikum (die anderen Spieler stimmen wirklich ab), Telefon (ein Mitspieler hilft)
//  - Auswahlrunde: Wer vier Begriffe am schnellsten richtig sortiert, wird Kandidat
//  - Wer nicht spielt, ist Publikum und tippt bei jeder Frage mit (Publikumspunkte)
//  - Allein: du bist direkt Kandidat, Publikum und Telefonjoker übernimmt der Computer
// =============================================================
const Q = require("../daten/quiz/katalog");
const SORTIEREN = require("../daten/quiz/sortieren");
const LEITER = [50, 100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 500000, 1000000];
const SICHER = [4, 9]; // Index der Sicherheitsstufen (500 €, 16.000 €)
const STUFE_S = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]; // Schwierigkeit je Frage
const AUSWAHL_MS = 30000, PUBLIKUM_MS = 12000, TELEFON_MS = 30000, ZWISCHEN_MS = 7000;
const einst = (raum) => raum.einstellungen.millionen;

const menschen = (raum) => Object.values(raum.spieler).filter((s) => s.online && !s.zuschauer);
const name = (raum, id) => raum.spieler[id]?.name || "?";

function planen(raum, ms, fn) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const nr = ++d.planNr;
  d.endetUm = ms ? Date.now() + ms : null;
  if (ms) d.timer = setTimeout(() => { if (raum.daten === d && d.planNr === nr) fn(); }, ms);
}
const gewinnBeiStufe = (stufe) => (stufe <= 0 ? 0 : LEITER[stufe - 1]); // stufe = Anzahl richtig beantworteter Fragen
const gesichert = (stufe) => { let g = 0; for (const i of SICHER) if (stufe > i) g = LEITER[i]; return g; };

// ---------- Auswahlrunde ----------
function naechsterKandidat(raum, ctx) {
  const d = raum.daten;
  const offen = menschen(raum).filter((s) => !d.gespielt.includes(s.id));
  if (!offen.length || d.gespielt.length >= d.kandidatenMax) return ende(raum, ctx);
  if (offen.length === 1) return kandidatStart(raum, ctx, offen[0].id, null);
  const [aufgabe, reihe] = SORTIEREN[Math.floor(Math.random() * SORTIEREN.length)];
  const gemischt = Q.mischen(reihe.map((_, i) => i));
  if (gemischt.every((x, i) => x === i)) gemischt.reverse();
  d.auswahl = { aufgabe, reihe, gemischt, start: Date.now(), abgaben: {}, teilnehmer: offen.map((s) => s.id) };
  d.phase = "auswahl";
  planen(raum, AUSWAHL_MS, () => auswahlAuswerten(raum, ctx));
  ctx.sende(raum);
}
function auswahlAuswerten(raum, ctx) {
  const d = raum.daten, a = d.auswahl;
  if (d.phase !== "auswahl") return;
  const ergebnisse = a.teilnehmer.map((id) => {
    const x = a.abgaben[id];
    const richtig = !!x && x.folge.every((orig, pos) => a.gemischt[orig] === pos);
    return { id, richtig, ms: x ? x.ms : null };
  });
  const gewinner = ergebnisse.filter((e) => e.richtig).sort((x, y) => x.ms - y.ms)[0];
  a.ergebnisse = ergebnisse;
  const id = gewinner ? gewinner.id : a.teilnehmer[Math.floor(Math.random() * a.teilnehmer.length)];
  kandidatStart(raum, ctx, id, gewinner ? gewinner.ms : null);
}

// ---------- Kandidat ----------
function kandidatStart(raum, ctx, id, auswahlMs) {
  const d = raum.daten;
  d.kandidat = id;
  d.gespielt.push(id);
  d.stufe = 0;
  d.joker = { fifty: true, publikum: true, telefon: true };
  d.weg = []; // durch 50:50 entfernte Antworten
  d.publikum = null; d.telefon = null;
  d.auswahlInfo = { id, ms: auswahlMs };
  d.bildFragen = 0;
  d.phase = "vorstellung";
  planen(raum, 3800, () => frageStellen(raum, ctx));
  ctx.sende(raum);
}

function frageStellen(raum, ctx) {
  const d = raum.daten;
  const s = STUFE_S[d.stufe];
  const mitBild = d.bildFragen < 2 && Math.random() < 0.18;
  const f = Q.frageMitStufe(s, d.gesehen, { mitBild }) || Q.frageMitStufe(s, new Set(), { mitBild: true });
  if (f.bild && f.bild.typ !== "emoji") d.bildFragen++;
  d.gesehen.add(f.id);
  const { antworten, richtig } = Q.vorbereiten(f);
  d.frage = { f, antworten, richtig };
  d.weg = []; d.publikum = null; d.telefon = null; d.eingeloggt = null;
  d.tipps = {};
  d.phase = "frage";
  const sek = einst(raum).sekunden;
  // Ohne Zeitlimit wartet das Spiel; mit Zeitlimit hört der Kandidat bei Ablauf automatisch auf
  planen(raum, sek ? sek * 1000 + 2500 : 0, () => aufhoeren(raum, ctx, true));
  ctx.sende(raum);
}

function einloggen(raum, ctx, i) {
  const d = raum.daten;
  if (d.phase !== "frage" || d.weg.includes(i)) return;
  d.eingeloggt = i;
  d.phase = "eingeloggt";
  // Je höher die Stufe, desto länger die Spannung
  const pause = 1800 + Math.min(4200, d.stufe * 300);
  planen(raum, pause, () => aufloesen(raum, ctx));
  ctx.sende(raum);
}

function aufloesen(raum, ctx) {
  const d = raum.daten;
  const richtig = d.eingeloggt === d.frage.richtig;
  // Publikum: Punkte für richtige Tipps
  for (const [id, i] of Object.entries(d.tipps)) if (i === d.frage.richtig) d.publikumPunkte[id] = (d.publikumPunkte[id] || 0) + 1;
  d.phase = "aufloesung";
  d.letztesErgebnis = richtig;
  if (richtig) {
    d.stufe++;
    if (d.stufe >= LEITER.length) return kandidatEnde(raum, ctx, LEITER[LEITER.length - 1], "million");
    planen(raum, 3200, () => frageStellen(raum, ctx));
  } else {
    planen(raum, 3800, () => kandidatEnde(raum, ctx, gesichert(d.stufe), "falsch"));
  }
  ctx.sende(raum);
}

function aufhoeren(raum, ctx, zeit = false) {
  const d = raum.daten;
  if (d.phase !== "frage") return;
  d.phase = "aufloesung";
  d.eingeloggt = null;
  d.letztesErgebnis = null;
  planen(raum, 3800, () => kandidatEnde(raum, ctx, gewinnBeiStufe(d.stufe), zeit ? "zeit" : "aufgehoert"));
  ctx.sende(raum);
}

function kandidatEnde(raum, ctx, gewinn, grund) {
  const d = raum.daten;
  d.gewinne[d.kandidat] = gewinn;
  d.ergebnisse.push({ id: d.kandidat, gewinn, grund, stufe: d.stufe });
  if (raum.spieler[d.kandidat]) raum.spieler[d.kandidat].punkte = gewinn;
  d.phase = "zwischen";
  d.zwischen = { id: d.kandidat, gewinn, grund };
  planen(raum, ZWISCHEN_MS, () => naechsterKandidat(raum, ctx));
  ctx.sende(raum);
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende";
  d.endetUm = null;
  ctx.sende(raum);
}

// ---------- Joker ----------
function fifty(raum, ctx) {
  const d = raum.daten;
  if (!d.joker.fifty || d.phase !== "frage") return;
  d.joker.fifty = false;
  d.weg = Q.mischen([0, 1, 2, 3].filter((i) => i !== d.frage.richtig)).slice(0, 2);
  ctx.sende(raum);
}
// Computer-Publikum: Je leichter die Frage, desto klarer liegt die richtige Antwort vorne
function computerPublikum(d) {
  const s = d.frage.f.s;
  const moeglich = [0, 1, 2, 3].filter((i) => !d.weg.includes(i));
  const werte = moeglich.map((i) => (i === d.frage.richtig ? 60 - s * 9 + Math.random() * 20 : 8 + Math.random() * (10 + s * 4)));
  return Object.fromEntries(moeglich.map((i, k) => [i, werte[k]]));
}
function publikumStart(raum, ctx) {
  const d = raum.daten;
  if (!d.joker.publikum || d.phase !== "frage") return;
  d.joker.publikum = false;
  d.publikum = { stimmen: {}, offen: true };
  const anderen = menschen(raum).filter((s) => s.id !== d.kandidat);
  d.phase = "publikum";
  planen(raum, anderen.length ? PUBLIKUM_MS : 2600, () => publikumEnde(raum, ctx));
  ctx.sende(raum);
}
function publikumEnde(raum, ctx) {
  const d = raum.daten;
  if (d.phase !== "publikum") return;
  // Echte Stimmen zählen stark, das Computer-Publikum füllt auf
  const roh = computerPublikum(d);
  const echt = Object.values(d.publikum.stimmen);
  for (const i of echt) roh[i] = (roh[i] || 0) + 100 / Math.max(1, echt.length) * 1.5;
  const summe = Object.values(roh).reduce((a, b) => a + b, 0);
  const prozent = Object.fromEntries(Object.entries(roh).map(([i, v]) => [i, Math.round((v / summe) * 100)]));
  d.publikum = { ergebnis: prozent, echt: echt.length };
  d.phase = "frage";
  const sek = einst(raum).sekunden;
  planen(raum, sek ? sek * 1000 : 0, () => aufhoeren(raum, ctx, true));
  ctx.sende(raum);
}
function telefonStart(raum, ctx, an) {
  const d = raum.daten;
  if (!d.joker.telefon || d.phase !== "frage") return;
  const freund = menschen(raum).find((s) => s.id === an && s.id !== d.kandidat);
  d.joker.telefon = false;
  d.telefon = { an: freund ? freund.id : null, name: freund ? freund.name : "Opa Erwin", avatar: freund ? freund.avatar : "👴", antwort: null };
  d.phase = "telefon";
  planen(raum, freund ? TELEFON_MS : 4200, () => telefonEnde(raum, ctx, null));
  ctx.sende(raum);
}
function telefonEnde(raum, ctx, wahl) {
  const d = raum.daten;
  if (d.phase !== "telefon") return;
  const t = d.telefon;
  if (wahl) { t.antwort = wahl.i; t.sicher = wahl.sicher; }
  else if (!t.an) {
    // Opa Erwin weiß bei leichten Fragen fast alles, bei schweren rät er
    const s = d.frage.f.s;
    const weiss = Math.random() < 1 - s * 0.14;
    const moeglich = [0, 1, 2, 3].filter((i) => !d.weg.includes(i));
    t.antwort = weiss ? d.frage.richtig : moeglich[Math.floor(Math.random() * moeglich.length)];
    t.sicher = weiss ? (s <= 3 ? "sicher" : "ziemlich") : "geraten";
  } else { t.antwort = null; t.sicher = "keine"; }
  d.phase = "frage";
  const sek = einst(raum).sekunden;
  planen(raum, sek ? sek * 1000 : 0, () => aufhoeren(raum, ctx, true));
  ctx.sende(raum);
}

module.exports = {
  meta: () => ({ leiter: LEITER, sicher: SICHER }),
  standardEinstellungen: () => ({ kandidaten: 1, sekunden: 0 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.kandidaten !== undefined) neu.kandidaten = [1, 2, 3, 10].includes(+e.kandidaten) ? +e.kandidaten : 1;
    if (e.sekunden !== undefined) neu.sekunden = [0, 60, 120].includes(+e.sekunden) ? +e.sekunden : 0;
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    raum.daten = {
      phase: "auswahl", kandidat: null, gespielt: [], kandidatenMax: e.kandidaten, stufe: 0, gesehen: new Set(),
      joker: {}, weg: [], publikum: null, telefon: null, frage: null, eingeloggt: null, tipps: {}, publikumPunkte: {},
      gewinne: {}, ergebnisse: [], timer: null, planNr: 0, endetUm: null,
    };
    naechsterKandidat(raum, ctx);
  },
  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d) return;
    const istKandidat = spielerId === d.kandidat;
    if (typ === "sortieren" && d.phase === "auswahl" && d.auswahl.teilnehmer.includes(spielerId) && !d.auswahl.abgaben[spielerId]) {
      const folge = Array.isArray(daten) ? daten.map(Number) : [];
      if (folge.length !== 4 || new Set(folge).size !== 4 || folge.some((x) => !(x >= 0 && x < 4))) return;
      d.auswahl.abgaben[spielerId] = { folge, ms: Date.now() - d.auswahl.start };
      if (d.auswahl.teilnehmer.every((id) => d.auswahl.abgaben[id] || !raum.spieler[id]?.online)) planen(raum, 800, () => auswahlAuswerten(raum, ctx));
      return void ctx.sende(raum);
    }
    if (istKandidat) {
      if (typ === "antwort") return einloggen(raum, ctx, parseInt(daten));
      if (typ === "aufhoeren") return aufhoeren(raum, ctx);
      if (typ === "fifty") return fifty(raum, ctx);
      if (typ === "publikum") return publikumStart(raum, ctx);
      if (typ === "telefon") return telefonStart(raum, ctx, daten);
      return;
    }
    // Publikum
    if (typ === "tipp" && (d.phase === "frage" || d.phase === "telefon") && !(spielerId in d.tipps)) { const i = parseInt(daten); if (i >= 0 && i < 4) { d.tipps[spielerId] = i; ctx.sende(raum); } return; }
    if (typ === "stimme" && d.phase === "publikum") { const i = parseInt(daten); if (i >= 0 && i < 4 && !d.weg.includes(i)) { d.publikum.stimmen[spielerId] = i; ctx.sende(raum); } return; }
    if (typ === "anruf" && d.phase === "telefon" && d.telefon.an === spielerId && daten) {
      const i = parseInt(daten.i);
      if (i >= 0 && i < 4) return telefonEnde(raum, ctx, { i, sicher: ["sicher", "ziemlich", "geraten"].includes(daten.sicher) ? daten.sicher : "ziemlich" });
    }
  },
  spielerZurueck() {},
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    // Kandidat geht: er hört mit dem aktuellen Gewinn auf
    if (id === d.kandidat && !raum.spieler[id] && ["frage", "publikum", "telefon"].includes(d.phase)) { d.phase = "frage"; aufhoeren(raum, ctx); }
    if (d.phase === "telefon" && d.telefon?.an === id) telefonEnde(raum, ctx, null);
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    const f = d.frage;
    const offen = d.phase === "aufloesung" || d.phase === "zwischen";
    return {
      phase: d.phase, kandidat: d.kandidat, stufe: d.stufe, leiter: LEITER, sicher: SICHER,
      gesichert: gesichert(d.stufe), aktuell: gewinnBeiStufe(d.stufe),
      auswahl: d.phase === "auswahl" ? { aufgabe: d.auswahl.aufgabe, begriffe: d.auswahl.gemischt.map((i) => d.auswahl.reihe[i]), abgegeben: Object.keys(d.auswahl.abgaben), teilnehmer: d.auswahl.teilnehmer } : null,
      auswahlInfo: d.auswahlInfo || null,
      frage: f && ["frage", "eingeloggt", "aufloesung", "publikum", "telefon"].includes(d.phase) ? { text: f.f.text, antworten: f.antworten, bild: f.f.bild, richtig: offen ? f.richtig : null, kat: Q.katInfo(f.f.kat) } : null,
      eingeloggt: d.eingeloggt, ergebnis: d.phase === "aufloesung" ? d.letztesErgebnis : null,
      weg: d.weg, joker: d.joker, publikum: d.publikum ? (d.publikum.ergebnis ? { ergebnis: d.publikum.ergebnis, echt: d.publikum.echt } : { abgestimmt: Object.keys(d.publikum.stimmen || {}) }) : null,
      telefon: d.telefon ? { an: d.telefon.an, name: d.telefon.name, avatar: d.telefon.avatar, antwort: d.telefon.antwort, sicher: d.telefon.sicher } : null,
      tipps: Object.keys(d.tipps), publikumPunkte: d.publikumPunkte,
      zwischen: d.phase === "zwischen" ? d.zwischen : null, ergebnisse: d.ergebnisse, gewinne: d.gewinne,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden,
    };
  },
};
