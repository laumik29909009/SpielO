// =============================================================
//  Spiel-Modul: Wissensduell
//  - Mehrere Runden. Pro Runde wählt reihum ein Spieler 1 von 3 Kategorien.
//  - Alle beantworten dieselben 3 Fragen gleichzeitig (4 Antworten, Zeitlimit).
//  - Richtig = 100 Punkte + bis zu 50 Bonus für Tempo. Die Rundentafel zeigt grün/rot.
//  - Allein gegen einen Computer-Gegner, zu zweit klassisches Duell, mit mehr Leuten alle gegen alle.
//  - Modus „Zufall“: Kategorie wird ausgelost. Modus „Thema“: eine Kategorie fürs ganze Spiel.
// =============================================================
const Q = require("../daten/quiz/katalog");
const FRAGEN_PRO_RUNDE = 3;
const WAHL_MS = 20000, AUFLOESUNG_MS = 2800, RUNDENENDE_MS = 3600, BOT_WAHL_MS = 1800;
const BOTS = [
  { name: "Professor Quiz", avatar: "🦉" }, { name: "Robo-Rudi", avatar: "🤖" }, { name: "Lotti Luchs", avatar: "🦊" }, { name: "Kara Kartenhai", avatar: "🦈" },
];
const einst = (raum) => raum.einstellungen.duell;

function teilnehmer(raum) {
  const d = raum.daten;
  return d.reihenfolge.map((id) => {
    const b = d.bots.find((x) => x.id === id);
    if (b) return { id, bot: true, name: b.name, avatar: b.avatar, online: true };
    const s = raum.spieler[id];
    return s ? { id, bot: false, name: s.name, avatar: s.avatar, online: s.online, afk: s.afk } : { id, bot: false, name: "Weg", avatar: "👻", online: false };
  });
}
const istBot = (d, id) => d.bots.some((b) => b.id === id);
const punkteSetzen = (raum, id, p) => { const b = raum.daten.bots.find((x) => x.id === id); if (b) b.punkte = p; else if (raum.spieler[id]) raum.spieler[id].punkte = p; };

function planen(raum, ms, fn) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const nr = ++d.planNr;
  d.endetUm = Date.now() + ms;
  d.timer = setTimeout(() => { if (raum.daten === d && d.planNr === nr) fn(); }, ms);
}

// ---------- Kategorienwahl ----------
function rundeStarten(raum, ctx) {
  const d = raum.daten;
  d.runde++;
  d.frageNr = -1;
  const modus = einst(raum).modus;
  const offen = Q.ALLE_KATEGORIEN.filter((k) => !d.genutzt.includes(k.id));
  if (modus === "thema") return kategorieGewaehlt(raum, ctx, d.thema);
  if (modus === "zufall") return kategorieGewaehlt(raum, ctx, Q.mischen(offen)[0].id);
  const ids = teilnehmer(raum).filter((t) => t.online || t.bot).map((t) => t.id);
  d.waehler = ids[(d.runde - 1) % ids.length] || d.reihenfolge[0];
  d.wahl = Q.mischen(offen).slice(0, 3).map((k) => k.id);
  d.phase = "wahl";
  const bot = istBot(d, d.waehler) || !raum.spieler[d.waehler]?.online;
  planen(raum, bot ? BOT_WAHL_MS : WAHL_MS, () => kategorieGewaehlt(raum, ctx, botWahl(d)));
  ctx.sende(raum);
}
// Bots nehmen die Kategorie, in der sie (zufällig) am stärksten sind
function botWahl(d) { return d.wahl[Math.floor(Math.random() * d.wahl.length)]; }

function kategorieGewaehlt(raum, ctx, kat) {
  const d = raum.daten;
  d.kategorie = kat;
  d.genutzt.push(kat);
  // Spätere Runden werden etwas schwerer
  const sMax = Math.min(5, 2 + Math.ceil((d.runde / d.runden) * 3));
  d.rundenFragen = Q.ziehen(kat, FRAGEN_PRO_RUNDE, { gesehen: d.gesehen, sMin: 1, sMax }).sort((a, b) => a.s - b.s);
  d.rundenFragen.forEach((f) => d.gesehen.add(f.id));
  d.verlauf.push({ kat, ergebnisse: Object.fromEntries(d.reihenfolge.map((id) => [id, []])) });
  frageStellen(raum, ctx);
}

// ---------- Frage ----------
function frageStellen(raum, ctx) {
  const d = raum.daten;
  d.frageNr++;
  if (d.frageNr >= d.rundenFragen.length) return rundeBeenden(raum, ctx);
  const f = d.rundenFragen[d.frageNr];
  const { antworten, richtig } = Q.vorbereiten(f);
  d.frage = { f, antworten, richtig, start: Date.now() };
  d.antworten = {};
  d.phase = "frage";
  const ms = einst(raum).sekunden * 1000;
  planen(raum, ms, () => aufloesen(raum, ctx));
  // Bots antworten nach kurzer Bedenkzeit
  for (const b of d.bots) {
    const stufe = einst(raum).stufe || "mittel";
    const p = { einfach: 0.82 - f.s * 0.1, mittel: 0.95 - f.s * 0.08, schwer: 1.02 - f.s * 0.06 }[stufe];
    const nach = Math.min(ms - 500, (1800 + Math.random() * (stufe === "schwer" ? 3500 : 6000)) * (0.7 + f.s * 0.12));
    const nr = d.planNr;
    setTimeout(() => {
      if (raum.daten !== d || d.phase !== "frage" || d.planNr !== nr || d.antworten[b.id]) return;
      const wahl = Math.random() < p ? richtig : Q.mischen([0, 1, 2, 3].filter((i) => i !== richtig))[0];
      antworten_(raum, ctx, b.id, wahl);
    }, nach);
  }
  ctx.sende(raum);
}

function antworten_(raum, ctx, id, i) {
  const d = raum.daten;
  if (d.phase !== "frage" || d.antworten[id] || !(i >= 0 && i < 4)) return;
  d.antworten[id] = { i, ms: Date.now() - d.frage.start };
  const aktive = teilnehmer(raum).filter((t) => t.bot || (t.online && !t.afk));
  if (aktive.every((t) => d.antworten[t.id])) {
    // Alle fertig: kurz warten, damit man sieht, dass der andere auch geantwortet hat
    planen(raum, 600, () => aufloesen(raum, ctx));
  }
  ctx.sende(raum);
}

function aufloesen(raum, ctx) {
  const d = raum.daten;
  if (d.phase !== "frage") return;
  const ms = einst(raum).sekunden * 1000;
  const runde = d.verlauf[d.verlauf.length - 1];
  for (const id of d.reihenfolge) {
    const a = d.antworten[id];
    const richtig = !!a && a.i === d.frage.richtig;
    runde.ergebnisse[id].push(richtig);
    if (richtig) {
      const bonus = Math.round(50 * Math.max(0, 1 - a.ms / ms));
      d.punkte[id] += 100 + bonus;
      d.richtige[id]++;
      if (raum.spieler[id]) raum.spieler[id].ohneEingabe = 0;
    }
    punkteSetzen(raum, id, d.punkte[id]);
  }
  d.phase = "aufloesung";
  planen(raum, AUFLOESUNG_MS, () => frageStellen(raum, ctx));
  ctx.sende(raum);
}

function rundeBeenden(raum, ctx) {
  const d = raum.daten;
  if (d.runde >= d.runden) return ende(raum, ctx);
  d.phase = "rundenende";
  planen(raum, RUNDENENDE_MS, () => rundeStarten(raum, ctx));
  ctx.sende(raum);
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende";
  d.endetUm = null;
  ctx.sende(raum);
}

module.exports = {
  meta: () => ({ kategorien: Q.ALLE_KATEGORIEN, anzahl: Q.anzahl() }),
  standardEinstellungen: () => ({ runden: 4, sekunden: 20, modus: "klassisch", thema: "geografie", bots: 1 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.runden !== undefined) neu.runden = [3, 4, 6].includes(+e.runden) ? +e.runden : 4;
    if (e.sekunden !== undefined) neu.sekunden = [10, 15, 20, 30].includes(+e.sekunden) ? +e.sekunden : 20;
    if (e.modus !== undefined) neu.modus = ["klassisch", "zufall", "thema"].includes(e.modus) ? e.modus : "klassisch";
    if (e.thema !== undefined && Q.katInfo(e.thema)) neu.thema = e.thema;
    if (e.bots !== undefined) neu.bots = Math.min(3, Math.max(0, parseInt(e.bots) || 0));
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    let botAnzahl = Math.min(e.bots, 3);
    if (menschen.length + botAnzahl < 2) botAnzahl = 2 - menschen.length;
    const bots = Q.mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = Q.mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    raum.daten = {
      bots, reihenfolge, runde: 0, runden: e.modus === "thema" ? Math.min(e.runden, 4) : e.runden, frageNr: -1, phase: "wahl",
      genutzt: [], gesehen: new Set(), verlauf: [], thema: e.thema,
      punkte: Object.fromEntries(reihenfolge.map((id) => [id, 0])), richtige: Object.fromEntries(reihenfolge.map((id) => [id, 0])),
      antworten: {}, frage: null, timer: null, planNr: 0, endetUm: null,
    };
    // Im Thema-Modus darf sich die Kategorie wiederholen
    if (e.modus === "thema") raum.daten.genutzt = { push() {}, includes: () => false };
    rundeStarten(raum, ctx);
  },
  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d || !d.reihenfolge.includes(spielerId)) return;
    if (typ === "kategorie" && d.phase === "wahl" && d.waehler === spielerId && d.wahl.includes(daten)) return kategorieGewaehlt(raum, ctx, daten);
    if (typ === "antwort" && d.phase === "frage") return antworten_(raum, ctx, spielerId, parseInt(daten));
  },
  spielerZurueck() {},
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (d.phase === "wahl" && d.waehler === id) planen(raum, 1500, () => kategorieGewaehlt(raum, ctx, botWahl(d)));
    if (d.phase === "frage") {
      const aktive = teilnehmer(raum).filter((t) => t.bot || (t.online && !t.afk));
      if (aktive.length && aktive.every((t) => d.antworten[t.id])) planen(raum, 600, () => aufloesen(raum, ctx));
    }
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    const offen = d.phase === "aufloesung" || d.phase === "rundenende" || d.phase === "ende";
    const f = d.frage;
    return {
      phase: d.phase, runde: d.runde, runden: d.runden, frageNr: d.frageNr, fragenProRunde: FRAGEN_PRO_RUNDE,
      waehler: d.phase === "wahl" ? d.waehler : null, wahl: d.phase === "wahl" ? d.wahl.map(Q.katInfo) : null,
      kategorie: d.kategorie ? Q.katInfo(d.kategorie) : null,
      frage: f && d.phase !== "wahl" ? { id: f.f.id, nr: d.frageNr, text: f.f.text, antworten: f.antworten, bild: f.f.bild, s: f.f.s, richtig: offen ? f.richtig : null } : null,
      beantwortet: Object.keys(d.antworten),
      antworten: offen ? Object.fromEntries(Object.entries(d.antworten).map(([id, a]) => [id, a.i])) : null,
      verlauf: d.verlauf.map((r) => ({ kat: Q.katInfo(r.kat), ergebnisse: r.ergebnisse })),
      punkte: d.punkte, richtige: d.richtige,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden,
      teilnehmer: teilnehmer(raum),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
    };
  },
};
