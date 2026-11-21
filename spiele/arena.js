// =============================================================
//  Spiel-Modul: Arena (Tages-Quiz mit freien Antworten)
//  - Pro Aufgabe tippt jeder eine Antwort ein (25 Sekunden)
//  - Je seltener eine richtige Antwort, desto mehr Ruhm:
//    Fußvolk 10 · Krieger 30 · Champion 60 · Legende 85 · Goldener Lorbeer 100
//  - Tagesarena: 7 Aufgaben pro Tag, für alle gleich, mit Tages-Rangliste
//  - Freies Spiel: zufällige Aufgaben, so oft man will
// =============================================================
const fs = require("fs");
const os = require("os");
const path = require("path");
const { AUFGABEN } = require("../daten/arena");

const MAX_TEILNEHMER = 10;
const PRO_TAG = 7;
const STUFEN = [10, 30, 60, 85, 100];
const START = "2026-11-21"; // Tagesarena #1
const AUFLOESUNG_MS = 12000;
const BOTS = [
  { name: "Maximus", avatar: "🦁" }, { name: "Spartaka", avatar: "🐺" }, { name: "Brutus Bot", avatar: "🤖" },
  { name: "Lucia Luchs", avatar: "🦊" }, { name: "Tiberius", avatar: "🐯" },
];
const mischen = (a, zufall = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const einst = (raum) => raum.einstellungen.arena;

// ---------- Antworten erkennen ----------
const norm = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
  .replace(/^(der|die|das|ein|eine|einen|the|le|la|il)\s+/, "").replace(/[^a-z0-9]/g, "");
const stamm = (s) => (s.length >= 5 ? s.replace(/(en|er|n|e|s)$/, "") : s);
function abstand(a, b, grenze) {
  if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
  let vorvor = null, vor = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const neu = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      neu[j] = Math.min(vor[j] + 1, neu[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (vorvor && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) neu[j] = Math.min(neu[j], vorvor[j - 2] + 1); // Buchstabendreher
      min = Math.min(min, neu[j]);
    }
    if (min > grenze) return grenze + 1;
    vorvor = vor; vor = neu;
  }
  return vor[b.length];
}

// Antwortliste einer Aufgabe vorbereiten (einmal beim Start)
const LISTEN = new Map();
function liste(a) {
  if (LISTEN.has(a.id)) return LISTEN.get(a.id);
  const l = [];
  for (const s of STUFEN) {
    const eintraege = s === 100 ? [a.gold] : a.stufen[s];
    for (const e of eintraege) {
      const formen = e.split("|").map((x) => x.trim()).filter(Boolean);
      l.push({ stufe: s, anzeige: formen[0], formen: formen.map(norm) });
    }
  }
  LISTEN.set(a.id, l);
  return l;
}
function bewerten(aufgabe, text) {
  const n = norm(text);
  if (n.length < 2) return null;
  const l = liste(aufgabe);
  for (const e of l) if (e.formen.includes(n)) return e;
  const st = stamm(n);
  for (const e of l) if (e.formen.some((f) => stamm(f) === st)) return e;
  const grenze = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0;
  if (!grenze) return null;
  let bester = null, bestA = grenze + 1;
  for (const e of l) for (const f of e.formen) {
    if (f.length < 4) continue;
    const d = abstand(n, f, grenze);
    if (d < bestA) { bestA = d; bester = e; }
  }
  return bester;
}

// ---------- Tagesarena ----------
// Tag in deutscher Zeit (Wechsel um Mitternacht)
const heute = (zeit = Date.now()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(zeit));
const tagNr = (datum) => Math.round((Date.parse(datum + "T12:00:00Z") - Date.parse(START + "T12:00:00Z")) / 864e5) + 1;
function seedZufall(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Jede Aufgabe kommt einmal dran, bevor sich etwas wiederholt (Zyklen aus gemischten Aufgaben)
function tagesAufgaben(datum) {
  const n = tagNr(datum) - 1;
  const proZyklus = Math.floor(AUFGABEN.length / PRO_TAG);
  const zyklus = Math.floor(n / proZyklus), platz = ((n % proZyklus) + proZyklus) % proZyklus;
  const reihe = mischen(AUFGABEN.map((_, i) => i), seedZufall(9973 + zyklus * 7919));
  return reihe.slice(platz * PRO_TAG, platz * PRO_TAG + PRO_TAG).map((i) => AUFGABEN[i]);
}

// Tages-Rangliste (überlebt einen Neustart in einer Datei; Spieler melden ihr Ergebnis sonst beim nächsten Besuch neu)
const DATEI = process.env.ARENA_DATEI || path.join(os.tmpdir(), "spielo-arena.json");
let TAGE = {};
try { TAGE = JSON.parse(fs.readFileSync(DATEI, "utf8")) || {}; } catch {}
let speichernTimer = null;
function speichern() {
  clearTimeout(speichernTimer);
  speichernTimer = setTimeout(() => {
    const behalten = Object.keys(TAGE).sort().slice(-3);
    TAGE = Object.fromEntries(behalten.map((k) => [k, TAGE[k]]));
    fs.writeFile(DATEI, JSON.stringify(TAGE), () => {});
  }, 1500);
}
function ergebnisMelden({ geraet, name, avatar, datum, stufen }) {
  geraet = String(geraet || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
  if (!geraet || datum !== heute() || !Array.isArray(stufen) || stufen.length !== PRO_TAG) return false;
  if (!stufen.every((s) => s === 0 || STUFEN.includes(s))) return false;
  const tag = (TAGE[datum] ||= {});
  if (tag[geraet]) return false; // erstes Ergebnis des Tages zählt
  if (Object.keys(tag).length >= 5000) return false;
  tag[geraet] = { name: String(name || "?").slice(0, 16), avatar: String(avatar || "🙂").slice(0, 8), punkte: stufen.reduce((a, b) => a + b, 0), stufen, t: Date.now() };
  speichern();
  return true;
}
function tagesStand(geraet) {
  const datum = heute();
  const tag = Object.entries(TAGE[datum] || {}).map(([id, e]) => ({ ...e, ich: id === geraet })).sort((a, b) => b.punkte - a.punkte || a.t - b.t);
  const meinPlatz = tag.findIndex((e) => e.ich);
  return {
    datum, nr: tagNr(datum), anzahl: tag.length,
    schnitt: tag.length ? Math.round(tag.reduce((a, e) => a + e.punkte, 0) / tag.length) : 0,
    top: tag.slice(0, 15).map(({ name, avatar, punkte, stufen, ich }) => ({ name, avatar, punkte, stufen, ich })),
    meinPlatz: meinPlatz >= 0 ? meinPlatz + 1 : null,
    gespielt: meinPlatz >= 0,
    morgenIn: (() => { const j = new Date(); const b = new Date(j.toLocaleString("en-US", { timeZone: "Europe/Berlin" })); return ((24 - b.getHours()) * 3600 - b.getMinutes() * 60 - b.getSeconds()) * 1000; })(),
  };
}

// ---------- Ablauf im Raum ----------
function teilnehmer(raum) {
  const d = raum.daten;
  return d.reihenfolge.map((id) => {
    const bot = d.bots.find((b) => b.id === id);
    if (bot) return { id, bot: true, name: bot.name, avatar: bot.avatar, online: true };
    const s = raum.spieler[id];
    return s ? { id, bot: false, name: s.name, avatar: s.avatar, online: s.online, afk: s.afk } : null;
  }).filter(Boolean);
}
const istBot = (d, id) => d.bots.some((b) => b.id === id);
const menschen = (raum) => teilnehmer(raum).filter((t) => !t.bot && t.online && !t.afk);

function frageStarten(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.bots.forEach((b) => clearTimeout(b.timer));
  d.nr++;
  d.phase = "frage";
  d.antworten = {};
  d.weiter = new Set();
  const ms = einst(raum).sekunden * 1000;
  d.endetUm = Date.now() + ms;
  d.timer = setTimeout(() => aufloesen(raum, ctx), ms + 400);
  // Computer tippen nach ein paar Sekunden
  const aufgabe = d.aufgaben[d.nr - 1];
  for (const b of d.bots) {
    b.timer = setTimeout(() => {
      if (d.phase !== "frage") return;
      const r = Math.random();
      const stufe = r < 0.2 ? 0 : r < 0.55 ? 10 : r < 0.8 ? 30 : r < 0.92 ? 60 : r < 0.985 ? 85 : 100;
      const pool = stufe === 0 ? null : stufe === 100 ? [aufgabe.gold] : aufgabe.stufen[stufe];
      const text = pool ? pool[Math.floor(Math.random() * pool.length)].split("|")[0] : ["Keine Ahnung", "Äh …", "Hmm"][Math.floor(Math.random() * 3)];
      antworten(raum, ctx, b.id, text);
    }, 3000 + Math.random() * Math.min(15000, ms - 4000));
  }
  ctx.sende(raum);
}

function antworten(raum, ctx, id, text) {
  const d = raum.daten;
  if (d.phase !== "frage" || d.antworten[id]) return;
  text = String(text || "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!text) return "Gib zuerst eine Antwort ein.";
  const treffer = bewerten(d.aufgaben[d.nr - 1], text);
  d.antworten[id] = { text, stufe: treffer ? treffer.stufe : 0, erkannt: treffer ? treffer.anzeige : null, t: Date.now() };
  if (!istBot(d, id) && raum.spieler[id]) raum.spieler[id].ohneEingabe = 0;
  // Alle (aktiven) Menschen und Computer fertig? Dann sofort auflösen
  const fehlt = teilnehmer(raum).filter((t) => (t.bot || (t.online && !t.afk)) && !d.antworten[t.id]);
  if (!fehlt.length) return aufloesen(raum, ctx);
  ctx.sende(raum);
}

function aufloesen(raum, ctx) {
  const d = raum.daten;
  if (d.phase !== "frage") return;
  clearTimeout(d.timer);
  d.bots.forEach((b) => clearTimeout(b.timer));
  d.phase = "aufloesung";
  const ids = new Set();
  for (const t of teilnehmer(raum)) {
    const a = d.antworten[t.id] || { text: "", stufe: 0, erkannt: null, leer: true };
    d.antworten[t.id] = a;
    d.verlauf[t.id].push({ stufe: a.stufe, text: a.text, erkannt: a.erkannt });
    if (!t.bot && !a.leer) ids.add(t.id);
  }
  ctx.mitgemacht(raum, ids);
  punkteSetzen(raum);
  d.endetUm = Date.now() + AUFLOESUNG_MS;
  d.timer = setTimeout(() => weiter(raum, ctx), AUFLOESUNG_MS);
  ctx.sende(raum);
}

function weiter(raum, ctx) {
  const d = raum.daten;
  if (d.phase !== "aufloesung") return;
  if (d.nr >= d.aufgaben.length) return ende(raum, ctx);
  frageStarten(raum, ctx);
}

function punkteSetzen(raum) {
  const d = raum.daten;
  for (const t of teilnehmer(raum)) {
    const p = d.verlauf[t.id].reduce((a, v) => a + v.stufe, 0);
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p;
    else if (raum.spieler[t.id]) raum.spieler[t.id].punkte = p;
  }
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende";
  d.endetUm = null;
  punkteSetzen(raum);
  // Tagesarena: erstes Ergebnis jedes Spielers in die Tages-Rangliste
  if (d.modus === "tag" && d.datum === heute()) {
    d.gezaehlt = {};
    for (const t of teilnehmer(raum)) {
      if (t.bot) continue;
      const s = raum.spieler[t.id];
      d.gezaehlt[t.id] = ergebnisMelden({ geraet: t.id, name: s?.name, avatar: s?.avatar, datum: d.datum, stufen: d.verlauf[t.id].map((v) => v.stufe) });
    }
  }
  // Auszeichnungen
  const alle = teilnehmer(raum);
  const liste = [];
  const zaehle = (id, f) => d.verlauf[id].filter(f).length;
  const beste = (f, min) => {
    const w = alle.map((t) => [t.id, f(t.id)]).filter(([, v]) => v >= min);
    if (!w.length) return null;
    const max = Math.max(...w.map(([, v]) => v));
    const ids = w.filter(([, v]) => v === max).map(([id]) => id);
    return ids.length < alle.length || alle.length === 1 ? { ids, max } : null;
  };
  let b;
  if ((b = beste((id) => zaehle(id, (v) => v.stufe === 100), 1))) liste.push({ icon: "🌿", titel: "Goldener Lorbeer", spieler: b.ids, text: `${b.max}× die seltenste Antwort gefunden` });
  if ((b = beste((id) => zaehle(id, (v) => v.stufe >= 85), 2))) liste.push({ icon: "🏛️", titel: "Legendenjäger", spieler: b.ids, text: `${b.max} Antworten aus Legende oder besser` });
  if ((b = beste((id) => zaehle(id, (v) => v.stufe > 0), d.aufgaben.length))) liste.push({ icon: "🛡️", titel: "Unbesiegt", spieler: b.ids, text: "Jede Aufgabe richtig beantwortet" });
  if ((b = beste((id) => { const r = d.verlauf[id].filter((v) => v.stufe > 0); return r.length >= 3 ? Math.round(r.reduce((a, v) => a + v.stufe, 0) / r.length) : 0; }, 45))) liste.push({ icon: "🎯", titel: "Querdenker", spieler: b.ids, text: `Ø ${b.max} Ruhm pro richtiger Antwort` });
  if (alle.length > 1 && (b = beste((id) => zaehle(id, (v) => v.stufe === 0), 3))) liste.push({ icon: "🥀", titel: "Vom Löwen gefressen", spieler: b.ids, text: `${b.max} Antworten ohne Ruhm` });
  d.auszeichnungen = liste.slice(0, 5);
  ctx.sende(raum);
}

// Nur die Spieler sehen, wer schon geantwortet hat; Antworten erst bei der Auflösung
function beispiele(aufgabe) {
  const l = liste(aufgabe);
  return Object.fromEntries(STUFEN.map((s) => [s, l.filter((e) => e.stufe === s).map((e) => e.anzeige)]));
}

// ---------- Schnittstelle ----------
module.exports = {
  meta: () => ({ max: MAX_TEILNEHMER, proTag: PRO_TAG, stufen: STUFEN, anzahlAufgaben: AUFGABEN.length, start: START }),
  standardEinstellungen: () => ({ modus: "tag", runden: 7, sekunden: 25, bots: 0 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.modus === "tag" || e.modus === "frei") neu.modus = e.modus;
    if (e.runden !== undefined) neu.runden = [5, 7, 10, 15].includes(+e.runden) ? +e.runden : 7;
    if (e.sekunden !== undefined) neu.sekunden = [15, 25, 40].includes(+e.sekunden) ? +e.sekunden : 25;
    if (e.bots !== undefined) neu.bots = Math.min(4, Math.max(0, parseInt(e.bots) || 0));
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const online = Object.values(raum.spieler).filter((s) => s.online);
    if (online.length > MAX_TEILNEHMER) return `Arena geht mit höchstens ${MAX_TEILNEHMER} Spielern.`;
    const datum = heute();
    let aufgaben;
    if (e.modus === "tag") aufgaben = tagesAufgaben(datum);
    else {
      const heutige = new Set(tagesAufgaben(datum).map((a) => a.id)); // keine Spoiler für die Tagesarena
      aufgaben = mischen(AUFGABEN.filter((a) => !heutige.has(a.id))).slice(0, e.runden);
    }
    const bots = mischen(BOTS).slice(0, Math.min(e.bots, MAX_TEILNEHMER - online.length)).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = [...online.map((s) => s.id), ...bots.map((b) => b.id)];
    raum.daten = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), modus: e.modus, datum, tagNr: tagNr(datum), aufgaben, bots, reihenfolge, nr: 0, phase: "frage",
      antworten: {}, weiter: new Set(), verlauf: Object.fromEntries(reihenfolge.map((id) => [id, []])),
      timer: null, endetUm: null, auszeichnungen: [],
    };
    frageStarten(raum, ctx);
  },
  beenden(raum) { const d = raum.daten; if (d) { clearTimeout(d.timer); d.bots.forEach((b) => clearTimeout(b.timer)); } },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d.verlauf[spielerId]) return;
    if (typ === "antwort") return antworten(raum, ctx, spielerId, daten) || undefined;
    if (typ === "weiter" && d.phase === "aufloesung") {
      d.weiter.add(spielerId);
      if (menschen(raum).every((t) => d.weiter.has(t.id))) return weiter(raum, ctx);
      ctx.sende(raum);
    }
  },
  spielerZurueck(raum, id, ctx) {
    const d = raum.daten;
    // Neu im Raum, während eine Arena läuft: ab der nächsten Aufgabe dabei (mit 0 für verpasste)
    if (d && d.phase !== "ende" && !d.verlauf[id] && raum.spieler[id]) {
      d.verlauf[id] = d.aufgaben.slice(0, d.phase === "frage" ? d.nr - 1 : d.nr).map(() => ({ stufe: 0, text: "", erkannt: null }));
      d.reihenfolge.push(id);
      raum.spieler[id].zuschauer = false;
    }
  },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (!raum.spieler[id]) { d.reihenfolge = d.reihenfolge.filter((x) => x !== id); delete d.verlauf[id]; }
    if (d.phase === "frage") {
      const fehlt = teilnehmer(raum).filter((t) => (t.bot || (t.online && !t.afk)) && !d.antworten[t.id]);
      if (!fehlt.length && menschen(raum).length) return aufloesen(raum, ctx);
    }
    if (d.phase === "aufloesung" && menschen(raum).length && menschen(raum).every((t) => d.weiter.has(t.id))) return weiter(raum, ctx);
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    const aufgabe = d.aufgaben[d.nr - 1];
    const offen = d.phase !== "frage";
    return {
      spielId: d.id, phase: d.phase, modus: d.modus, datum: d.datum, tagNr: d.tagNr, nr: d.nr, gesamt: d.aufgaben.length,
      frage: aufgabe?.frage, sekunden: einst(raum).sekunden,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0,
      teilnehmer: teilnehmer(raum),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      beantwortet: Object.keys(d.antworten),
      antworten: offen ? d.antworten : null,
      weiter: [...d.weiter],
      beispiele: offen && aufgabe ? beispiele(aufgabe) : null,
      verlauf: d.verlauf, // enthält nur schon aufgelöste Aufgaben
      alleFragen: d.phase === "ende" ? d.aufgaben.map((a) => ({ frage: a.frage, gold: a.gold.split("|")[0] })) : null,
      gezaehlt: d.gezaehlt || null,
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
  // Für Startseite und Statistik (Socket-Ereignisse in server.js)
  tagesStand,
  ergebnisMelden,
  _intern: { bewerten, norm, tagesAufgaben, heute, tagNr, liste, AUFGABEN },
};
