// =============================================================
//  Spiel-Modul: Quartett (Supertrumpf-Regeln)
//  - Alle Karten werden gemischt und verteilt.
//  - Wer dran ist, wählt einen Wert seiner obersten Karte.
//  - Alle decken auf, der höchste Wert gewinnt alle Karten.
//  - Gleichstand ("Stechen"): Karten kommen in den Topf,
//    der Gewinner der nächsten Runde bekommt sie dazu.
//  - Wer keine Karten mehr hat, ist raus. Gewonnen hat, wer am
//    Ende alle Karten hat (oder nach dem Rundenlimit die meisten).
//  2–4 Teilnehmer, fehlende Plätze füllen Computer-Gegner.
// =============================================================
const fs = require("fs");
const path = require("path");
const { DECKS } = require("../daten/quartett");

// Eigene Bilder: public/quartett/bilder/<deck>/<Karten-ID>.jpg|png|webp (z. B. kungfupanda/B1.jpg)
function fotosLesen(deckId) {
  const ordner = path.join(__dirname, "..", "public", "quartett", "bilder", deckId);
  const fotos = {};
  try {
    for (const datei of fs.readdirSync(ordner)) {
      const m = datei.match(/^([A-F][1-4])\.(jpe?g|png|webp|avif)$/i);
      if (m) fotos[m[1].toUpperCase()] = `/quartett/bilder/${deckId}/${encodeURIComponent(datei)}`;
    }
  } catch {}
  return fotos;
}
const FOTOS = Object.fromEntries(Object.keys(DECKS).map((id) => [id, fotosLesen(id)]));

const MAX_TEILNEHMER = 4;
const KAMPF_MS = 5600; // so lange läuft die Kampf-Animation
const BOT_DENKEN_MS = [1400, 2600];
const OFFLINE_WARTEN_MS = 8000; // wer offline ist, wird nach dieser Zeit vertreten
const AFK_WARTEN_MS = 2500;
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" },
  { name: "Kara Kartenhai", avatar: "🦈" },
  { name: "Professor Pixel", avatar: "👾" },
];

const mischen = (liste) => {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Für den Computer: Wie gut ist ein Wert im Vergleich zum ganzen Deck? (0–1)
const RANG = {};
for (const deck of Object.values(DECKS)) {
  RANG[deck.id] = deck.werte.map((_, i) => deck.karten.map((k) => k.w[i]).sort((a, b) => a - b));
}
function staerke(deckId, karte, i) {
  const liste = RANG[deckId][i];
  const unter = liste.filter((v) => v < karte.w[i]).length;
  const gleich = liste.filter((v) => v === karte.w[i]).length;
  return (unter + gleich / 2) / liste.length;
}
function botWahl(deckId, karte) {
  const bewertet = karte.w.map((_, i) => ({ i, s: staerke(deckId, karte, i) + Math.random() * 0.08 }));
  // Meist der stärkste Wert, manchmal (15 %) der zweitbeste: Der Computer soll nicht unschlagbar sein
  bewertet.sort((a, b) => b.s - a.s);
  return Math.random() < 0.15 ? bewertet[1].i : bewertet[0].i;
}

const deckVon = (raum) => DECKS[raum.daten.deck];
const karteVon = (raum, id) => deckVon(raum).karten.find((k) => k.id === id);
const einst = (raum) => raum.einstellungen.quartett;

// Alle Teilnehmer (Menschen und Computer) in fester Reihenfolge
function teilnehmer(raum) {
  const d = raum.daten;
  return d.reihenfolge.map((id) => {
    const bot = d.bots.find((b) => b.id === id);
    if (bot) return { id, bot: true, name: bot.name, avatar: bot.avatar, online: true };
    const s = raum.spieler[id];
    return s ? { id, bot: false, name: s.name, avatar: s.avatar, online: s.online, afk: s.afk } : null;
  }).filter(Boolean);
}
const imSpiel = (raum) => teilnehmer(raum).filter((t) => (raum.daten.stapel[t.id] || []).length > 0);

function punkteAktualisieren(raum) {
  const d = raum.daten;
  for (const t of teilnehmer(raum)) {
    const n = (d.stapel[t.id] || []).length;
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = n;
    else raum.spieler[t.id].punkte = n;
  }
}

// Jeder Mensch sieht nur seine eigene oberste Karte
function handSenden(raum, ctx) {
  const d = raum.daten;
  for (const s of Object.values(raum.spieler)) {
    const stapel = d.stapel[s.id] || [];
    ctx.privat(raum, s.id, "quartett:hand", { karte: stapel[0] || null, anzahl: stapel.length, runde: d.runde });
  }
}

// ---------- Ablauf ----------
function starteWahl(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "waehlen";
  d.runde++;
  d.kampf = null;
  const waehler = teilnehmer(raum).find((t) => t.id === d.waehler);
  const sek = einst(raum).sekunden;
  let warten = null;
  if (waehler.bot) warten = BOT_DENKEN_MS[0] + Math.random() * (BOT_DENKEN_MS[1] - BOT_DENKEN_MS[0]);
  else if (!waehler.online) warten = OFFLINE_WARTEN_MS;
  else if (waehler.afk) warten = AFK_WARTEN_MS;
  else if (sek) warten = sek * 1000;
  d.endetUm = warten && !waehler.bot ? Date.now() + warten : null;
  if (warten) d.timer = setTimeout(() => automatischWaehlen(raum, ctx), warten);
  handSenden(raum, ctx);
  punkteAktualisieren(raum);
  ctx.sende(raum);
}

// Zeit abgelaufen (oder Computer ist dran): bester Wert wird gewählt
function automatischWaehlen(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "waehlen") return;
  const karte = karteVon(raum, d.stapel[d.waehler][0]);
  const s = raum.spieler[d.waehler];
  if (s) { // Mensch hat nicht gewählt → zählt als inaktiv
    s.ohneEingabe = (s.ohneEingabe || 0) + 1;
    if (s.ohneEingabe >= 2) s.afk = true;
  }
  kaempfen(raum, ctx, botWahl(d.deck, karte), !s);
}

function kaempfen(raum, ctx, wertIndex, vonBot = true) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const dabei = imSpiel(raum);
  const gespielt = dabei.map((t) => ({ spieler: t.id, karte: d.stapel[t.id].shift() }));
  const werte = gespielt.map((g) => karteVon(raum, g.karte).w[wertIndex]);
  const max = Math.max(...werte);
  const sieger = gespielt.filter((_, i) => werte[i] === max).map((g) => g.spieler);
  const ids = gespielt.map((g) => g.karte);
  const st = d.statistik;
  const merk = (id) => (st[id] ||= { siege: 0, serie: 0, besteSerie: 0, minKarten: Infinity, stechen: 0 });

  if (sieger.length === 1) {
    const w = sieger[0];
    // Gewinner legt alle Karten (und den Topf) unter seinen Stapel, eigene Karte zuerst
    const eigene = gespielt.find((g) => g.spieler === w).karte;
    d.stapel[w].push(eigene, ...mischen(ids.filter((k) => k !== eigene)), ...d.topf);
    d.kampf = { wert: wertIndex, gespielt, sieger: w, gleichstand: false, topfGewonnen: d.topf.length, waehler: d.waehler, vonBot };
    d.topf = [];
    d.waehler = w;
    const m = merk(w);
    m.siege++; m.serie++; m.besteSerie = Math.max(m.besteSerie, m.serie);
    d.kartenSiege[eigene] = (d.kartenSiege[eigene] || 0) + 1;
    for (const g of gespielt) if (g.spieler !== w) merk(g.spieler).serie = 0;
  } else {
    d.topf.push(...ids);
    d.kampf = { wert: wertIndex, gespielt, sieger: null, gleichstand: true, gleich: sieger, waehler: d.waehler, vonBot };
    for (const g of gespielt) merk(g.spieler).stechen++;
    // Bei Gleichstand wählt dieselbe Person nochmal (falls sie noch Karten hat)
  }
  for (const t of teilnehmer(raum)) {
    const m = merk(t.id);
    m.minKarten = Math.min(m.minKarten, d.stapel[t.id].length);
  }
  d.phase = "kampf";
  d.endetUm = null;
  punkteAktualisieren(raum);
  ctx.sende(raum);
  d.timer = setTimeout(() => nachDemKampf(raum, ctx), KAMPF_MS + Math.max(0, gespielt.length - 2) * 500);
}

function nachDemKampf(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "kampf") return;
  const dabei = imSpiel(raum);
  const limit = einst(raum).runden;
  if (dabei.length <= 1 || (limit && d.runde >= limit)) return beenden(raum, ctx);
  // Wer wählt? Gewinner bzw. bei Gleichstand dieselbe Person; ist sie raus, der Nächste mit Karten
  if (!dabei.some((t) => t.id === d.waehler)) {
    const alle = teilnehmer(raum).map((t) => t.id);
    const start = alle.indexOf(d.waehler);
    for (let i = 1; i <= alle.length; i++) {
      const id = alle[(start + i) % alle.length];
      if (dabei.some((t) => t.id === id)) { d.waehler = id; break; }
    }
  }
  starteWahl(raum, ctx);
}

function beenden(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  // Übrig gebliebener Topf (z. B. nach Stechen in der letzten Runde) geht an den mit den meisten Karten
  if (d.topf.length) {
    const fuehrender = teilnehmer(raum).sort((a, b) => d.stapel[b.id].length - d.stapel[a.id].length)[0];
    if (fuehrender) d.stapel[fuehrender.id].push(...d.topf);
    d.topf = [];
  }
  punkteAktualisieren(raum);
  d.phase = "ende";
  d.auszeichnungen = auszeichnungen(raum);
  handSenden(raum, ctx);
  ctx.sende(raum);
}

function auszeichnungen(raum) {
  const d = raum.daten;
  const alle = teilnehmer(raum);
  const st = d.statistik;
  const liste = [];
  const beste = (f, min) => {
    const werte = alle.map((t) => [t.id, f(st[t.id] || {})]).filter(([, w]) => w >= min);
    if (!werte.length) return null;
    const max = Math.max(...werte.map(([, w]) => w));
    const ids = werte.filter(([, w]) => w === max).map(([id]) => id);
    return ids.length < alle.length ? { ids, max } : null; // alle gleich → sagt nichts
  };
  let b = beste((s) => s.siege || 0, 2);
  if (b) liste.push({ icon: "⚔️", titel: "Kampfmaschine", spieler: b.ids, text: `${b.max} Duelle gewonnen` });
  b = beste((s) => s.besteSerie || 0, 3);
  if (b) liste.push({ icon: "🔥", titel: "Siegesserie", spieler: b.ids, text: `${b.max} Duelle am Stück gewonnen` });
  // Comeback: war fast raus (höchstens 2 Karten) und hat am Ende mehr als ein Viertel aller Karten
  const gesamt = deckVon(raum).karten.length;
  const comeback = alle.filter((t) => (st[t.id]?.minKarten ?? 99) <= 2 && d.stapel[t.id].length >= gesamt / 4);
  if (comeback.length) liste.push({ icon: "📈", titel: "Comeback", spieler: comeback.map((t) => t.id), text: "Fast raus und trotzdem zurückgekommen" });
  b = beste((s) => s.stechen || 0, 2);
  if (b) liste.push({ icon: "🤝", titel: "Stech-Profi", spieler: b.ids, text: `${b.max}× im Gleichstand` });
  // Stärkste Karte des Spiels
  const [kid, siege] = Object.entries(d.kartenSiege).sort((a, b2) => b2[1] - a[1])[0] || [];
  if (siege >= 2) {
    const k = karteVon(raum, kid);
    const besitzer = alle.filter((t) => d.stapel[t.id].includes(kid)).map((t) => t.id);
    liste.push({ icon: "🃏", titel: "Karte des Spiels", spieler: besitzer, karte: kid, text: `${k.name} gewann ${siege} Duelle` });
  }
  return liste.slice(0, 6);
}

// ---------- Schnittstelle für den Server-Kern ----------
module.exports = {
  meta: () => ({
    decks: Object.values(DECKS).map((d) => ({ ...d, fotos: FOTOS[d.id] })),
    maxTeilnehmer: MAX_TEILNEHMER,
    kampfMs: KAMPF_MS,
  }),

  standardEinstellungen: () => ({ deck: "kungfupanda", bots: 1, runden: 0, sekunden: 20 }),

  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (typeof e.deck === "string" && DECKS[e.deck]) neu.deck = e.deck;
    if (e.bots !== undefined) neu.bots = Math.min(3, Math.max(0, parseInt(e.bots) || 0));
    if (e.runden !== undefined) {
      const r = parseInt(e.runden);
      neu.runden = r === 0 ? 0 : Math.min(60, Math.max(5, r || 20)); // 0 = bis einer alle Karten hat
    }
    if (e.sekunden !== undefined) {
      const s = parseInt(e.sekunden);
      neu.sekunden = s === 0 ? 0 : Math.min(60, Math.max(10, s || 20));
    }
    return neu;
  },

  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > MAX_TEILNEHMER) return `Quartett ist für höchstens ${MAX_TEILNEHMER} Spieler. Gerade seid ihr ${menschen.length}.`;
    let botAnzahl = Math.min(e.bots, MAX_TEILNEHMER - menschen.length);
    if (menschen.length + botAnzahl < 2) botAnzahl = 1; // solo: immer gegen den Computer
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    const deck = DECKS[e.deck];
    const karten = mischen(deck.karten.map((k) => k.id));
    const stapel = Object.fromEntries(reihenfolge.map((id) => [id, []]));
    karten.forEach((k, i) => stapel[reihenfolge[i % reihenfolge.length]].push(k));
    raum.daten = {
      deck: deck.id, bots, reihenfolge, stapel, topf: [], runde: 0, phase: "waehlen",
      waehler: reihenfolge.find((id) => !id.startsWith("bot")) || reihenfolge[0],
      kampf: null, timer: null, endetUm: null, statistik: {}, kartenSiege: {}, auszeichnungen: [],
    };
    starteWahl(raum, ctx);
  },

  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",

  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (typ === "waehlen") {
      if (d.phase !== "waehlen" || d.waehler !== spielerId) return;
      const i = parseInt(daten);
      if (!(i >= 0 && i < deckVon(raum).werte.length)) return;
      kaempfen(raum, ctx, i, false);
    }
  },

  // Wieder verbunden: eigene Karte nochmal schicken
  spielerZurueck(raum, spielerId, ctx) {
    const d = raum.daten;
    if (!d) return;
    const stapel = d.stapel[spielerId] || [];
    ctx.privat(raum, spielerId, "quartett:hand", { karte: stapel[0] || null, anzahl: stapel.length, runde: d.runde });
  },

  // Offline oder entfernt
  spielerWeg(raum, spielerId, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (!raum.spieler[spielerId] && d.stapel[spielerId]) {
      // Entfernt/gegangen: Karten kommen in den Topf, der Platz verschwindet
      d.topf.push(...d.stapel[spielerId]);
      delete d.stapel[spielerId];
      d.reihenfolge = d.reihenfolge.filter((id) => id !== spielerId);
      if (imSpiel(raum).length <= 1) return beenden(raum, ctx);
      if (d.waehler === spielerId) {
        d.waehler = imSpiel(raum)[0].id;
        if (d.phase === "waehlen") { d.runde--; return starteWahl(raum, ctx); }
      }
      return;
    }
    // Nur offline: Wählt er gerade, übernimmt bald der Computer
    if (d.phase === "waehlen" && d.waehler === spielerId) { d.runde--; starteWahl(raum, ctx); }
  },

  spielerInfo(raum, s) {
    const d = raum.daten;
    return { karten: (d?.stapel[s.id] || []).length };
  },

  ansicht(raum) {
    const d = raum.daten;
    const e = einst(raum);
    return {
      phase: d.phase,
      deck: d.deck,
      runde: d.runde,
      rundenMax: e.runden,
      sekunden: e.sekunden,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0,
      waehler: d.waehler,
      topf: d.topf.length,
      teilnehmer: teilnehmer(raum).map((t) => ({ ...t, karten: (d.stapel[t.id] || []).length })),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      kampf: d.kampf,
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
};
