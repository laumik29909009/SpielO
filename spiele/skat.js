// =============================================================
//  Spiel-Modul: Kartenrunde (Jonkler) mit sechs Spielen
//  - Schwimmen (Schnautz/31): 3 Karten, tauschen mit der Mitte, 31 in einer Farbe
//  - Arschloch: Karten loswerden, gleiche Werte höher stechen, Rangtausch
//  - Durak: angreifen und verteidigen mit Trumpf, wer übrig bleibt, ist der Durak
//  - Mau-Mau: gleiche Farbe oder gleicher Wert, 7 zieht 2, 8 setzt aus, Bube wünscht
//  - 17 und 4: gegen die Bank, möglichst nah an 21 (52 Karten, Chips)
//  - Texas Hold'em: Poker mit 2 eigenen und 5 offenen Karten (52 Karten, Chips)
//  Gemeinsam: Teilnehmer (Menschen + Computer), Hände privat, Zugzeit, Statistik.
// =============================================================
const FARBEN = ["kreuz", "pik", "herz", "karo"];
const WERTE32 = ["7", "8", "9", "10", "B", "D", "K", "A"];
const WERTE36 = ["6", ...WERTE32];
const BOT_DENKEN = [900, 1700];
const AUSTEIL_MS = 3400; // so lange dauert die Austeil-Animation im Browser
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" }, { name: "Fritzi Frosch", avatar: "🐸" }, { name: "Theo Tiger", avatar: "🐯" },
];
const MAX = { schwimmen: 8, arschloch: 6, durak: 6, maumau: 6, siebzehn: 6, poker: 8 };
const MINIMUM = { schwimmen: 2, arschloch: 3, durak: 2, maumau: 2, siebzehn: 1, poker: 2 };
// Rundenzahl je Spiel (Arschloch, Mau-Mau: Runden · 17 und 4: Runden · Poker: Hände)
const RUNDEN = { arschloch: [3, 5, 8], maumau: [3, 5, 8], siebzehn: [5, 8, 12], poker: [10, 20, 30] };
const RUNDEN_STANDARD = { arschloch: 5, maumau: 5, siebzehn: 8, poker: 20 };

const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function deck(werte) {
  const k = [];
  for (const f of FARBEN) for (const w of werte) k.push({ id: f + "-" + w, farbe: f, wert: w });
  return mischen(k);
}
const einst = (raum) => raum.einstellungen.skat;
// KI-Stärke: Wie oft macht ein Computer einen unüberlegten Zug?
const FEHLER = { einfach: 0.35, mittel: 0.07, schwer: 0 };
const patzer = (raum) => Math.random() < FEHLER[einst(raum).stufe || "mittel"];
const irgendeine = (liste) => liste[Math.floor(Math.random() * liste.length)];

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

function handSenden(raum, ctx) {
  const d = raum.daten;
  for (const s of Object.values(raum.spieler)) ctx.privat(raum, s.id, "skat:hand", { karten: d.haende[s.id] || [], zug: d.zug });
}

// Nächste Person (im Uhrzeigersinn), optional nur unter "aktiven"
function nachster(d, id, aktiv = () => true) {
  const ids = d.reihenfolge;
  let i = ids.indexOf(id);
  for (let s = 0; s < ids.length; s++) {
    i = (i + 1) % ids.length;
    if (aktiv(ids[i])) return ids[i];
  }
  return id;
}

// Zugzeit: Computer denken kurz, Menschen haben die eingestellte Zeit, Abwesende werden vertreten
function zeitPlanen(raum, ctx, id, auto) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const t = teilnehmer(raum).find((x) => x.id === id);
  const sek = einst(raum).sekunden;
  let warten = null;
  // Nach dem Austeilen erst die Animation abwarten
  const austeilRest = d.letzteAktion?.typ === "austeilen" ? Math.max(0, AUSTEIL_MS - (Date.now() - d.letzteAktion.t)) : 0;
  if (!t || t.bot) warten = austeilRest + BOT_DENKEN[0] + Math.random() * (BOT_DENKEN[1] - BOT_DENKEN[0]);
  else if (!t.online) warten = 6000;
  else if (t.afk) warten = 2500;
  else if (sek) warten = sek * 1000 + austeilRest;
  d.endetUm = warten && t && !t.bot ? Date.now() + warten : null;
  if (warten) d.timer = setTimeout(() => {
    const s = raum.spieler[id];
    if (s) { s.ohneEingabe = (s.ohneEingabe || 0) + 1; if (s.ohneEingabe >= 2) s.afk = true; }
    auto();
  }, warten);
}
const aktivMensch = (raum, id) => { const s = raum.spieler[id]; if (s) s.ohneEingabe = 0; };

// =============================================================
//  SCHWIMMEN (Schnautz / 31)
//  Werte: Ass 11, Bild und 10 je 10, sonst Augen. Gezählt wird die beste Farbe.
//  Drei gleiche Werte = 30,5. Drei Asse = Feuer (sofort Ende, alle anderen verlieren ein Leben).
// =============================================================
const SW_WERT = (w) => (w === "A" ? 11 : ["K", "D", "B", "10"].includes(w) ? 10 : Number(w));
function swPunkte(hand) {
  if (hand.length !== 3) return 0;
  if (hand.every((k) => k.wert === "A")) return 33;
  if (hand.every((k) => k.wert === hand[0].wert)) return 30.5;
  let best = 0;
  for (const f of FARBEN) best = Math.max(best, hand.filter((k) => k.farbe === f).reduce((a, k) => a + SW_WERT(k.wert), 0));
  return best;
}
const Schwimmen = {
  starten(raum, ctx) {
    const d = raum.daten;
    d.leben = Object.fromEntries(d.reihenfolge.map((id) => [id, einst(raum).leben]));
    d.schwimmt = {};
    d.raus = [];
    d.runde = 0;
    this.neueRunde(raum, ctx);
  },
  imSpiel: (d) => d.reihenfolge.filter((id) => !d.raus.includes(id)),
  neueRunde(raum, ctx) {
    const d = raum.daten;
    d.runde++;
    d.stapel = deck(WERTE32);
    d.haende = {};
    for (const id of this.imSpiel(d)) d.haende[id] = d.stapel.splice(0, 3);
    d.mitte = d.stapel.splice(0, 3);
    d.geklopft = null; d.letzteZuege = null; d.schiebenInFolge = 0; d.zuegeSeitStart = 0;
    d.phase = "spielen"; d.ergebnis = null;
    const ids = this.imSpiel(d);
    d.dran = d.geber ? nachster(d, d.geber, (x) => ids.includes(x)) : ids[Math.floor(Math.random() * ids.length)];
    d.geber = d.dran;
    d.letzteAktion = { typ: "austeilen", t: Date.now() };
    // 31 oder Feuer direkt nach dem Austeilen?
    if (ids.some((id) => swPunkte(d.haende[id]) >= 31)) return this.aufdecken(raum, ctx);
    this.zug(raum, ctx);
  },
  zug(raum, ctx) {
    const d = raum.daten;
    d.zug++;
    handSenden(raum, ctx);
    zeitPlanen(raum, ctx, d.dran, () => this.bot(raum, ctx, d.dran));
    ctx.sende(raum);
  },
  bot(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    if (istBot(d, id) && patzer(raum)) return Math.random() < 0.5 ? this.aktion(raum, ctx, id, "schieben") : this.aktion(raum, ctx, id, "tauschen", { hand: irgendeine(h).id, mitte: irgendeine(d.mitte).id });
    const jetzt = swPunkte(h);
    // Bester einzelner Tausch
    let best = { p: jetzt, art: null };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const neu = [...h]; neu[i] = d.mitte[j];
      const p = swPunkte(neu);
      if (p > best.p) best = { p, art: "eins", hand: i, mitte: j };
    }
    const alle = swPunkte(d.mitte);
    if (alle > best.p + 2) best = { p: alle, art: "alle" };
    const darfKlopfen = !d.geklopft && d.zuegeSeitStart >= this.imSpiel(d).length;
    if (best.art === "eins") return this.aktion(raum, ctx, id, "tauschen", { hand: h[best.hand].id, mitte: d.mitte[best.mitte].id });
    if (best.art === "alle") return this.aktion(raum, ctx, id, "alleTauschen");
    if (darfKlopfen && jetzt >= 25) return this.aktion(raum, ctx, id, "klopfen");
    return this.aktion(raum, ctx, id, "schieben");
  },
  aktion(raum, ctx, id, typ, daten) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    if (typ === "tauschen") {
      const i = h.findIndex((k) => k.id === daten?.hand), j = d.mitte.findIndex((k) => k.id === daten?.mitte);
      if (i < 0 || j < 0) return "Bitte eine Handkarte und eine Karte aus der Mitte wählen.";
      [h[i], d.mitte[j]] = [d.mitte[j], h[i]];
      d.schiebenInFolge = 0;
      d.letzteAktion = { typ: "tauschen", spieler: id, karte: d.mitte[j], t: Date.now() };
    } else if (typ === "alleTauschen") {
      [d.haende[id], d.mitte] = [d.mitte, h];
      d.schiebenInFolge = 0;
      d.letzteAktion = { typ: "alleTauschen", spieler: id, t: Date.now() };
    } else if (typ === "schieben") {
      d.schiebenInFolge++;
      d.letzteAktion = { typ: "schieben", spieler: id, t: Date.now() };
      // Haben alle geschoben, kommt eine neue Mitte
      if (d.schiebenInFolge >= this.imSpiel(d).length && d.stapel.length >= 3) {
        d.mitte = d.stapel.splice(0, 3);
        d.schiebenInFolge = 0;
        d.letzteAktion = { typ: "neueMitte", spieler: id, t: Date.now() };
      }
    } else if (typ === "klopfen") {
      if (d.geklopft) return "Es wurde schon geklopft.";
      if (d.zuegeSeitStart < this.imSpiel(d).length) return "Klopfen geht erst ab der zweiten Runde.";
      d.geklopft = id;
      d.letzteAktion = { typ: "klopfen", spieler: id, t: Date.now() };
    } else return;
    if (!istBot(d, id)) aktivMensch(raum, id);
    d.zuegeSeitStart++;
    // 31 oder Feuer beendet sofort
    if (swPunkte(d.haende[id]) >= 31) return this.aufdecken(raum, ctx);
    d.dran = nachster(d, id, (x) => this.imSpiel(d).includes(x));
    // Nach dem Klopfen ist jeder noch einmal dran, dann wird aufgedeckt
    if (d.geklopft && d.dran === d.geklopft) return this.aufdecken(raum, ctx);
    this.zug(raum, ctx);
  },
  aufdecken(raum, ctx) {
    const d = raum.daten;
    clearTimeout(d.timer);
    const ids = this.imSpiel(d);
    const punkte = Object.fromEntries(ids.map((id) => [id, swPunkte(d.haende[id])]));
    const feuer = ids.find((id) => punkte[id] === 33);
    let verlierer;
    if (feuer) verlierer = ids.filter((id) => id !== feuer);
    else { const min = Math.min(...ids.map((id) => punkte[id])); verlierer = ids.filter((id) => punkte[id] === min); }
    const ausgeschieden = [];
    for (const id of verlierer) {
      if (d.leben[id] > 0) { d.leben[id]--; if (d.leben[id] === 0) d.schwimmt[id] = true; }
      else { d.raus.push(id); ausgeschieden.push(id); }
    }
    for (const id of verlierer) (d.statistik[id] ||= {}).verloren = ((d.statistik[id] || {}).verloren || 0) + 1;
    const gewinner = ids.reduce((a, b) => (punkte[b] > punkte[a] ? b : a));
    (d.statistik[gewinner] ||= {}).beste = ((d.statistik[gewinner] || {}).beste || 0) + 1;
    if (punkte[gewinner] >= 31) (d.statistik[gewinner].einunddreissig = (d.statistik[gewinner].einunddreissig || 0) + 1);
    d.ergebnis = { punkte, haende: Object.fromEntries(ids.map((id) => [id, d.haende[id]])), verlierer, ausgeschieden, feuer: feuer || null, gewinner };
    d.letzteAktion = { typ: "aufdecken", t: Date.now() };
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, (d.leben[t.id] ?? 0) + (d.raus.includes(t.id) ? 0 : 1) + (d.schwimmt[t.id] ? 0 : 0));
    const uebrig = this.imSpiel(d);
    if (uebrig.length <= 1) {
      d.phase = "ende";
      d.platzierung = [...uebrig, ...[...d.raus].reverse()];
      d.platzierung.forEach((id, i) => setzePunkte(raum, teilnehmer(raum).find((t) => t.id === id), d.platzierung.length - i));
      d.auszeichnungen = auszeichnungen(raum);
    } else {
      d.phase = "aufgedeckt";
      d.timer = setTimeout(() => this.neueRunde(raum, ctx), 6500);
    }
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ansicht(d) {
    return {
      mitte: d.mitte, geklopft: d.geklopft, leben: d.leben, schwimmt: Object.keys(d.schwimmt).filter((id) => d.schwimmt[id]),
      raus: d.raus, ergebnis: d.phase !== "spielen" ? d.ergebnis : null, stapelAnzahl: d.stapel.length,
      darfKlopfen: !d.geklopft && d.zuegeSeitStart >= this.imSpiel(d).length,
    };
  },
  weg(raum, ctx, id) {
    const d = raum.daten;
    if (!d.raus.includes(id)) d.raus.push(id);
    if (this.imSpiel(d).length <= 1) return this.aufdecken(raum, ctx);
    if (d.dran === id) { d.dran = nachster(d, id, (x) => this.imSpiel(d).includes(x)); this.zug(raum, ctx); }
  },
};

// =============================================================
//  ARSCHLOCH
//  Rangfolge: 7 < 8 < 9 < 10 < B < D < K < A. Alle Karten werden verteilt.
//  Ausspielen: 1–4 gleiche Werte; der Nächste muss gleich viele, aber höhere legen oder passen.
//  Passen alle anderen, räumt der Letzte den Stich ab und spielt neu aus.
//  Wer zuerst fertig ist, wird König, dann Vize, … der Letzte ist das Arschloch.
//  Ab Runde 2: Arschloch gibt dem König seine 2 besten Karten und bekommt 2 schlechteste zurück
//  (Vize-Arschloch ↔ Vize-König je 1 Karte ab 4 Spielern).
// =============================================================
const AR_RANG = (w) => WERTE32.indexOf(w);
const Arschloch = {
  starten(raum, ctx) {
    const d = raum.daten;
    d.runde = 0; d.gesamt = {}; d.letzteRaenge = null;
    this.neueRunde(raum, ctx);
  },
  neueRunde(raum, ctx) {
    const d = raum.daten;
    d.runde++;
    const karten = deck(WERTE32);
    d.haende = Object.fromEntries(d.reihenfolge.map((id) => [id, []]));
    karten.forEach((k, i) => d.haende[d.reihenfolge[i % d.reihenfolge.length]].push(k));
    d.fertig = []; d.stich = null; d.stichVon = null; d.gepasst = []; d.ergebnis = null;
    d.tausch = null;
    // Kartentausch nach der Rangfolge der letzten Runde
    if (d.letzteRaenge && d.letzteRaenge.length >= 3) {
      const r = d.letzteRaenge.filter((id) => d.haende[id]);
      const paare = [[r[0], r[r.length - 1], 2]];
      if (r.length >= 4) paare.push([r[1], r[r.length - 2], 1]);
      d.tausch = [];
      for (const [koenig, arsch, n] of paare) {
        const besteArsch = [...d.haende[arsch]].sort((a, b) => AR_RANG(b.wert) - AR_RANG(a.wert)).slice(0, n);
        const schlechteKoenig = [...d.haende[koenig]].sort((a, b) => AR_RANG(a.wert) - AR_RANG(b.wert)).slice(0, n);
        d.haende[arsch] = d.haende[arsch].filter((k) => !besteArsch.includes(k)).concat(schlechteKoenig);
        d.haende[koenig] = d.haende[koenig].filter((k) => !schlechteKoenig.includes(k)).concat(besteArsch);
        d.tausch.push({ von: arsch, an: koenig, karten: besteArsch, zurueck: schlechteKoenig });
      }
      d.dran = r[r.length - 1]; // das Arschloch fängt an
    } else d.dran = d.reihenfolge.find((id) => d.haende[id].some((k) => k.id === "kreuz-7")) || d.reihenfolge[0];
    d.phase = "spielen";
    d.letzteAktion = { typ: "austeilen", t: Date.now(), tausch: d.tausch };
    this.zug(raum, ctx);
  },
  aktiv: (d) => (id) => !d.fertig.includes(id),
  zug(raum, ctx) {
    const d = raum.daten;
    d.zug++;
    handSenden(raum, ctx);
    zeitPlanen(raum, ctx, d.dran, () => this.bot(raum, ctx, d.dran));
    ctx.sende(raum);
  },
  kannLegen(d, karten) {
    if (!karten.length || karten.length > 4 || !karten.every((k) => k.wert === karten[0].wert)) return false;
    if (!d.stich) return true;
    return karten.length === d.stich.length && AR_RANG(karten[0].wert) > AR_RANG(d.stich[0].wert);
  },
  bot(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    const gruppen = {};
    for (const k of h) (gruppen[k.wert] ||= []).push(k);
    const optionen = Object.values(gruppen).flatMap((g) => {
      if (!d.stich) return [g];
      return g.length >= d.stich.length ? [g.slice(0, d.stich.length)] : [];
    }).filter((g) => this.kannLegen(d, g)).sort((a, b) => AR_RANG(a[0].wert) - AR_RANG(b[0].wert));
    if (!optionen.length) return this.aktion(raum, ctx, id, "passen");
    // Ausspielen: möglichst viele niedrige Karten; Stechen: so niedrig wie möglich, Asse sparen (außer kurz vor Schluss)
    let wahl = d.stich ? optionen[0] : optionen.sort((a, b) => b.length - a.length || AR_RANG(a[0].wert) - AR_RANG(b[0].wert))[0];
    if (istBot(d, id) && patzer(raum)) wahl = irgendeine(optionen);
    if (d.stich && wahl[0].wert === "A" && h.length > 4 && Math.random() < 0.6) return this.aktion(raum, ctx, id, "passen");
    return this.aktion(raum, ctx, id, "legen", wahl.map((k) => k.id));
  },
  aktion(raum, ctx, id, typ, daten) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    if (typ === "legen") {
      const ids = Array.isArray(daten) ? daten.map(String) : [];
      const karten = ids.map((x) => h.find((k) => k.id === x)).filter(Boolean);
      if (karten.length !== ids.length || !this.kannLegen(d, karten)) return d.stich ? `Lege ${d.stich.length} gleiche Karten, höher als ${d.stich[0].wert}, oder passe.` : "Lege 1 bis 4 gleiche Karten.";
      d.haende[id] = h.filter((k) => !ids.includes(k.id));
      d.stich = karten; d.stichVon = id; d.gepasst = [];
      d.letzteAktion = { typ: "legen", spieler: id, karten, t: Date.now() };
      (d.statistik[id] ||= {}).gelegt = ((d.statistik[id] || {}).gelegt || 0) + karten.length;
      if (karten.length >= 3) (d.statistik[id].mehrlinge = (d.statistik[id].mehrlinge || 0) + 1);
      if (!d.haende[id].length) {
        d.fertig.push(id);
        d.letzteAktion.fertig = d.fertig.length;
        if (d.reihenfolge.length - d.fertig.length <= 1) return this.rundeEnde(raum, ctx);
      }
    } else if (typ === "passen") {
      if (!d.stich) return "Du spielst aus, passen geht nicht.";
      d.gepasst.push(id);
      d.letzteAktion = { typ: "passen", spieler: id, t: Date.now() };
    } else return;
    if (!istBot(d, id)) aktivMensch(raum, id);
    // Haben alle anderen (noch aktiven) gepasst? Dann ist der Stich vorbei
    const aktive = d.reihenfolge.filter(this.aktiv(d));
    const andere = aktive.filter((x) => x !== d.stichVon);
    if (d.stich && andere.every((x) => d.gepasst.includes(x))) {
      const neu = d.fertig.includes(d.stichVon) ? nachster(d, d.stichVon, this.aktiv(d)) : d.stichVon;
      d.stich = null; d.stichVon = null; d.gepasst = [];
      d.dran = neu;
      d.letzteAktion = { ...d.letzteAktion, stichWeg: true };
    } else d.dran = nachster(d, id, this.aktiv(d));
    this.zug(raum, ctx);
  },
  rundeEnde(raum, ctx) {
    const d = raum.daten;
    clearTimeout(d.timer);
    const letzter = d.reihenfolge.find((id) => !d.fertig.includes(id));
    const raenge = [...d.fertig, letzter].filter(Boolean);
    const n = raenge.length;
    raenge.forEach((id, i) => (d.gesamt[id] = (d.gesamt[id] || 0) + (n - 1 - i)));
    raenge.forEach((id, i) => { const s = (d.statistik[id] ||= {}); if (i === 0) s.koenig = (s.koenig || 0) + 1; if (i === n - 1) s.arsch = (s.arsch || 0) + 1; });
    d.letzteRaenge = raenge;
    d.ergebnis = { raenge, titel: titelListe(n) };
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, d.gesamt[t.id] || 0);
    d.letzteAktion = { typ: "rundenende", t: Date.now() };
    if (d.runde >= einst(raum).runden) { d.phase = "ende"; d.auszeichnungen = auszeichnungen(raum); }
    else { d.phase = "rundenende"; d.timer = setTimeout(() => this.neueRunde(raum, ctx), 7000); }
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ansicht(d) {
    return {
      stich: d.stich, stichVon: d.stichVon, gepasst: d.gepasst, fertig: d.fertig, gesamt: d.gesamt,
      ergebnis: d.phase !== "spielen" ? d.ergebnis : null, tausch: d.tausch, letzteRaenge: d.letzteRaenge,
    };
  },
  weg(raum, ctx, id) {
    const d = raum.daten;
    if (!d.fertig.includes(id)) d.fertig.push(id);
    if (d.reihenfolge.length - d.fertig.length <= 1) return this.rundeEnde(raum, ctx);
    if (d.dran === id) { d.dran = nachster(d, id, this.aktiv(d)); this.zug(raum, ctx); }
  },
};
function titelListe(n) {
  const t = Array.from({ length: n }, () => "Bürger");
  t[0] = "König"; t[n - 1] = "Arschloch";
  if (n >= 4) { t[1] = "Vize-König"; t[n - 2] = "Vize-Arschloch"; }
  return t;
}

// =============================================================
//  DURAK (Podkidnoy: Nachlegen erlaubt)
//  36 Karten (6 bis Ass), je 6 Karten, die letzte Karte des Stapels bestimmt Trumpf.
//  Angreifer legt aus, alle außer dem Verteidiger dürfen Werte nachlegen, die schon liegen
//  (höchstens 6 Angriffe und nicht mehr als der Verteidiger Karten hat).
//  Verteidiger schlägt jede Karte: höher in derselben Farbe oder mit Trumpf.
//  Kann/will er nicht, nimmt er alles auf. Danach wird auf 6 nachgezogen (Angreifer zuerst).
//  Wer am Ende noch Karten hat, ist der Durak.
// =============================================================
const DU_RANG = (w) => WERTE36.indexOf(w);
const Durak = {
  starten(raum, ctx) {
    const d = raum.daten;
    d.stapel = deck(WERTE36);
    d.haende = Object.fromEntries(d.reihenfolge.map((id) => [id, d.stapel.splice(0, 6)]));
    d.trumpfKarte = d.stapel[d.stapel.length - 1];
    d.trumpf = d.trumpfKarte.farbe;
    d.fertig = [];
    d.tisch = []; // [{ angriff, abwehr }]
    // Wer den niedrigsten Trumpf hat, greift zuerst an
    let start = d.reihenfolge[0], niedrig = 99;
    for (const id of d.reihenfolge) for (const k of d.haende[id]) if (k.farbe === d.trumpf && DU_RANG(k.wert) < niedrig) { niedrig = DU_RANG(k.wert); start = id; }
    this.neuerAngriff(raum, ctx, start);
  },
  aktiv: (d) => (id) => !d.fertig.includes(id),
  neuerAngriff(raum, ctx, angreifer) {
    const d = raum.daten;
    d.angreifer = angreifer;
    d.verteidiger = nachster(d, angreifer, this.aktiv(d));
    d.tisch = []; d.fertigGemeldet = []; d.nimmt = false;
    d.limit = Math.min(6, d.haende[d.verteidiger].length);
    d.phase = "spielen";
    d.dran = angreifer;
    d.letzteAktion = { ...(d.letzteAktion || {}), typ: d.letzteAktion ? d.letzteAktion.typ : "austeilen", t: d.letzteAktion?.t || Date.now(), neuerAngriff: true };
    this.zug(raum, ctx);
  },
  zug(raum, ctx) {
    const d = raum.daten;
    d.zug++;
    handSenden(raum, ctx);
    // Wer muss gerade handeln? Verteidiger, wenn offene Karten liegen, sonst der Angreifer (bzw. Nachleger)
    const offen = d.tisch.some((p) => !p.abwehr);
    d.dran = offen && !d.nimmt ? d.verteidiger : d.angreifer;
    // Alles verteidigt: Mitspieler haben 6 Sekunden Zeit zum Nachlegen, danach gilt "fertig"
    if (!offen && d.tisch.length) d.nachlegenBis = Date.now() + 6000;
    zeitPlanen(raum, ctx, d.dran, () => this.bot(raum, ctx, d.dran));
    // Computer, die nicht dran sind, dürfen nachlegen bzw. "fertig" melden
    clearTimeout(d.nachlegeTimer);
    d.nachlegeTimer = setTimeout(() => this.botsNachlegen(raum, ctx), 1300);
    ctx.sende(raum);
  },
  schlaegt(d, abwehr, angriff) {
    if (abwehr.farbe === angriff.farbe) return DU_RANG(abwehr.wert) > DU_RANG(angriff.wert);
    return abwehr.farbe === d.trumpf && angriff.farbe !== d.trumpf;
  },
  werteAufTisch: (d) => new Set(d.tisch.flatMap((p) => [p.angriff.wert, p.abwehr?.wert]).filter(Boolean)),
  darfAngreifen(d, id, k) {
    if (id === d.verteidiger || d.fertig.includes(id)) return false;
    if (d.tisch.length >= d.limit) return false;
    if (!d.tisch.length) return id === d.angreifer;
    return this.werteAufTisch(d).has(k.wert);
  },
  bot(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase !== "spielen") return;
    const h = d.haende[id];
    if (id === d.verteidiger && !d.nimmt) {
      // Offene Karte mit der kleinsten passenden Karte schlagen (Trümpfe sparen)
      const offen = d.tisch.find((p) => !p.abwehr);
      if (!offen) return;
      const moeglich = h.filter((k) => this.schlaegt(d, k, offen.angriff)).sort((a, b) => (a.farbe === d.trumpf) - (b.farbe === d.trumpf) || DU_RANG(a.wert) - DU_RANG(b.wert));
      if (!moeglich.length || (moeglich[0].farbe === d.trumpf && DU_RANG(moeglich[0].wert) > DU_RANG("D") && d.stapel.length > 6 && d.tisch.length < 2)) return this.aktion(raum, ctx, id, "nehmen");
      return this.aktion(raum, ctx, id, "schlagen", { angriff: offen.angriff.id, karte: (istBot(d, id) && patzer(raum) ? irgendeine(moeglich) : moeglich[0]).id });
    }
    if (id === d.angreifer) {
      if (!d.tisch.length) {
        const k = istBot(d, id) && patzer(raum) ? irgendeine(h) : [...h].sort((a, b) => (a.farbe === d.trumpf) - (b.farbe === d.trumpf) || DU_RANG(a.wert) - DU_RANG(b.wert))[0];
        return this.aktion(raum, ctx, id, "angreifen", k.id);
      }
      const nach = h.filter((k) => this.darfAngreifen(d, id, k) && (k.farbe !== d.trumpf || d.stapel.length === 0)).sort((a, b) => DU_RANG(a.wert) - DU_RANG(b.wert))[0];
      if (d.tisch.some((p) => !p.abwehr)) return; // erst abwarten, bis verteidigt wurde
      if (nach) return this.aktion(raum, ctx, id, "angreifen", nach.id);
      return this.aktion(raum, ctx, id, "fertig");
    }
  },
  botsNachlegen(raum, ctx) {
    const d = raum.daten;
    if (!d || d.phase !== "spielen" || !d.tisch.length) return;
    for (const b of d.bots) {
      if (b.id === d.verteidiger || b.id === d.angreifer || d.fertig.includes(b.id) || d.fertigGemeldet.includes(b.id)) continue;
      const k = d.haende[b.id].filter((x) => this.darfAngreifen(d, b.id, x) && x.farbe !== d.trumpf).sort((a, c) => DU_RANG(a.wert) - DU_RANG(c.wert))[0];
      if (k && Math.random() < 0.7) return this.aktion(raum, ctx, b.id, "angreifen", k.id);
      d.fertigGemeldet.push(b.id);
    }
    // Menschen als Mitspieler: wer nichts nachlegen kann, ist automatisch fertig; sonst nach Ablauf der Frist
    const offen = d.tisch.some((p) => !p.abwehr);
    for (const id of d.reihenfolge) {
      if (istBot(d, id) || id === d.verteidiger || id === d.angreifer || d.fertig.includes(id) || d.fertigGemeldet.includes(id)) continue;
      const kann = d.haende[id].some((x) => this.darfAngreifen(d, id, x));
      if (!kann || (!offen && d.nachlegenBis && Date.now() > d.nachlegenBis)) d.fertigGemeldet.push(id);
    }
    if (this.pruefeEnde(raum, ctx)) return;
    if (!offen && d.nachlegenBis) { clearTimeout(d.nachlegeTimer); d.nachlegeTimer = setTimeout(() => this.botsNachlegen(raum, ctx), Math.max(300, d.nachlegenBis - Date.now() + 50)); }
  },
  aktion(raum, ctx, id, typ, daten) {
    const d = raum.daten;
    if (d.phase !== "spielen" || !d.haende[id]) return;
    const h = d.haende[id];
    if (typ === "angreifen") {
      const k = h.find((x) => x.id === String(daten));
      if (!k) return;
      if (!this.darfAngreifen(d, id, k)) return d.tisch.length >= d.limit ? "Mehr Karten gehen in diesem Angriff nicht." : !d.tisch.length ? "Der Angreifer legt zuerst." : "Nachlegen geht nur mit Werten, die schon liegen.";
      d.haende[id] = h.filter((x) => x !== k);
      d.tisch.push({ angriff: k, von: id });
      d.fertigGemeldet = [];
      d.letzteAktion = { typ: "angreifen", spieler: id, karte: k, t: Date.now() };
      (d.statistik[id] ||= {}).angriffe = ((d.statistik[id] || {}).angriffe || 0) + 1;
    } else if (typ === "schlagen") {
      if (id !== d.verteidiger || d.nimmt) return;
      const paar = d.tisch.find((p) => p.angriff.id === daten?.angriff && !p.abwehr);
      const k = h.find((x) => x.id === daten?.karte);
      if (!paar || !k) return;
      if (!this.schlaegt(d, k, paar.angriff)) return "Diese Karte schlägt nicht: höher in derselben Farbe oder Trumpf.";
      paar.abwehr = k;
      d.haende[id] = h.filter((x) => x !== k);
      d.letzteAktion = { typ: "schlagen", spieler: id, karte: k, gegen: paar.angriff, t: Date.now() };
      (d.statistik[id] ||= {}).abgewehrt = ((d.statistik[id] || {}).abgewehrt || 0) + 1;
    } else if (typ === "nehmen") {
      if (id !== d.verteidiger || !d.tisch.length) return;
      d.nimmt = true;
      d.letzteAktion = { typ: "nimmt", spieler: id, t: Date.now() };
      // Angreifer dürfen noch nachlegen (bis zum Limit), dann wird aufgenommen
      clearTimeout(d.timer);
      d.timer = setTimeout(() => this.aufnehmen(raum, ctx), 1800);
      if (!istBot(d, id)) aktivMensch(raum, id);
      ctx.sende(raum);
      return;
    } else if (typ === "fertig") {
      if (id === d.verteidiger) return;
      if (!d.fertigGemeldet.includes(id)) d.fertigGemeldet.push(id);
    } else return;
    if (!istBot(d, id)) aktivMensch(raum, id);
    if (this.pruefeEnde(raum, ctx)) return;
    this.zug(raum, ctx);
  },
  // Angriff vorbei? (alles geschlagen und alle Angreifer fertig, oder Limit erreicht)
  pruefeEnde(raum, ctx) {
    const d = raum.daten;
    if (d.nimmt || !d.tisch.length) return false;
    const allesGeschlagen = d.tisch.every((p) => p.abwehr);
    if (!allesGeschlagen) return false;
    const angreifer = d.reihenfolge.filter((x) => x !== d.verteidiger && !d.fertig.includes(x));
    const keinerKannMehr = d.tisch.length >= d.limit || d.haende[d.verteidiger].length === 0;
    const alleFertig = angreifer.every((x) => d.fertigGemeldet.includes(x) || d.haende[x].length === 0 || !d.haende[x].some((k) => this.darfAngreifen(d, x, k)));
    if (!(keinerKannMehr || alleFertig)) return false;
    // Erfolgreich verteidigt: Karten weg, Verteidiger greift als Nächstes an
    d.letzteAktion = { typ: "abgewehrt", spieler: d.verteidiger, t: Date.now() };
    const naechster = d.verteidiger;
    this.nachziehen(d);
    this.weiter(raum, ctx, naechster);
    return true;
  },
  aufnehmen(raum, ctx) {
    const d = raum.daten;
    if (!d || d.phase !== "spielen" || !d.nimmt) return;
    const karten = d.tisch.flatMap((p) => [p.angriff, p.abwehr]).filter(Boolean);
    d.haende[d.verteidiger].push(...karten);
    (d.statistik[d.verteidiger] ||= {}).aufgenommen = ((d.statistik[d.verteidiger] || {}).aufgenommen || 0) + karten.length;
    d.letzteAktion = { typ: "aufgenommen", spieler: d.verteidiger, anzahl: karten.length, t: Date.now() };
    const naechster = nachster(d, d.verteidiger, this.aktiv(d));
    this.nachziehen(d);
    this.weiter(raum, ctx, naechster);
  },
  nachziehen(d) {
    // Angreifer zuerst, dann die anderen, Verteidiger zuletzt
    const ordnung = [d.angreifer];
    let x = d.angreifer;
    for (let i = 0; i < d.reihenfolge.length; i++) { x = nachster(d, x); if (x !== d.verteidiger && !ordnung.includes(x)) ordnung.push(x); }
    ordnung.push(d.verteidiger);
    for (const id of ordnung) while (d.haende[id] && d.haende[id].length < 6 && d.stapel.length) d.haende[id].push(d.stapel.shift());
    d.tisch = [];
  },
  weiter(raum, ctx, naechster) {
    const d = raum.daten;
    // Wer keine Karten mehr hat (und der Stapel leer ist), ist fertig
    if (!d.stapel.length) for (const id of d.reihenfolge) if (!d.haende[id].length && !d.fertig.includes(id)) d.fertig.push(id);
    const uebrig = d.reihenfolge.filter(this.aktiv(d));
    if (uebrig.length <= 1) return this.ende(raum, ctx, uebrig[0] || null);
    if (d.fertig.includes(naechster)) naechster = nachster(d, naechster, this.aktiv(d));
    this.neuerAngriff(raum, ctx, naechster);
  },
  ende(raum, ctx, durak) {
    const d = raum.daten;
    clearTimeout(d.timer); clearTimeout(d.nachlegeTimer);
    d.phase = "ende";
    d.durak = durak;
    d.platzierung = [...d.fertig, ...(durak ? [durak] : [])];
    d.platzierung.forEach((id, i) => setzePunkte(raum, teilnehmer(raum).find((t) => t.id === id), d.platzierung.length - i));
    if (durak) (d.statistik[durak] ||= {}).durak = 1;
    d.letzteAktion = { typ: "durak", spieler: durak, t: Date.now() };
    d.auszeichnungen = auszeichnungen(raum);
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ansicht(d) {
    return {
      tisch: d.tisch, trumpf: d.trumpf, trumpfKarte: d.stapel.length ? d.trumpfKarte : null, stapelAnzahl: d.stapel.length,
      angreifer: d.angreifer, verteidiger: d.verteidiger, nimmt: d.nimmt, limit: d.limit, fertig: d.fertig,
      fertigGemeldet: d.fertigGemeldet, durak: d.durak || null,
    };
  },
  weg(raum, ctx, id) {
    const d = raum.daten;
    d.stapel.push(...(d.haende[id] || []));
    d.haende[id] = [];
    if (!d.fertig.includes(id)) d.fertig.push(id);
    const uebrig = d.reihenfolge.filter(this.aktiv(d));
    if (uebrig.length <= 1) return this.ende(raum, ctx, uebrig[0] || null);
    if (id === d.verteidiger || id === d.angreifer) { this.nachziehen(d); this.weiter(raum, ctx, nachster(d, id, this.aktiv(d))); }
  },
};

// =============================================================
//  MAU-MAU
//  5 Karten, gleiche Farbe oder gleicher Wert auf die Ablage.
//  7: der Nächste zieht 2 (mit einer 7 weitergeben, dann 4, 6 …) · 8: der Nächste setzt aus
//  Bube: geht auf alles (nicht auf einen Buben) und wünscht eine Farbe.
//  Vor der vorletzten Karte „Mau!“ rufen, sonst gibt es eine Strafkarte.
//  Wer zuerst fertig ist, bekommt die Punkte aller Karten, die die anderen noch haben.
// =============================================================
const FARBNAME = { kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" };
const MM_STRAFE = (w) => (w === "B" ? 20 : w === "A" ? 11 : w === "10" ? 10 : w === "K" ? 4 : w === "D" ? 3 : Number(w));
function besteFarbe(hand) {
  const n = Object.fromEntries(FARBEN.map((f) => [f, 0]));
  for (const k of hand) if (k.wert !== "B") n[k.farbe]++;
  const max = Math.max(...Object.values(n));
  const kandidaten = FARBEN.filter((f) => n[f] === max);
  return kandidaten[Math.floor(Math.random() * kandidaten.length)];
}
const MauMau = {
  starten(raum, ctx) {
    const d = raum.daten;
    d.runde = 0;
    d.gesamt = Object.fromEntries(d.reihenfolge.map((id) => [id, 0]));
    this.neueRunde(raum, ctx);
  },
  neueRunde(raum, ctx) {
    const d = raum.daten;
    d.runde++;
    d.stapel = deck(WERTE32);
    d.haende = Object.fromEntries(d.reihenfolge.map((id) => [id, d.stapel.splice(0, 5)]));
    // Die erste offene Karte ist nie eine Sonderkarte
    const i = d.stapel.findIndex((k) => !["7", "8", "B"].includes(k.wert));
    d.ablage = d.stapel.splice(i, 1);
    d.wunsch = null; d.ziehen = 0; d.gezogen = false; d.ergebnis = null;
    d.geber = d.geber && d.reihenfolge.includes(d.geber) ? nachster(d, d.geber) : d.reihenfolge[Math.floor(Math.random() * d.reihenfolge.length)];
    d.dran = nachster(d, d.geber);
    d.phase = "spielen";
    d.letzteAktion = { typ: "austeilen", t: Date.now() };
    this.zug(raum, ctx);
  },
  zug(raum, ctx) {
    const d = raum.daten;
    d.zug++;
    handSenden(raum, ctx);
    zeitPlanen(raum, ctx, d.dran, () => this.bot(raum, ctx, d.dran));
    ctx.sende(raum);
  },
  oben: (d) => d.ablage[d.ablage.length - 1],
  passt(d, k) {
    const o = this.oben(d);
    if (d.ziehen) return k.wert === "7";
    if (k.wert === "B") return o.wert !== "B";
    if (d.wunsch) return k.farbe === d.wunsch;
    return k.farbe === o.farbe || k.wert === o.wert;
  },
  ziehenKarten(d, id, n) {
    for (let i = 0; i < n; i++) {
      if (!d.stapel.length) {
        // Ablage (bis auf die oberste Karte) wird neu gemischt
        const oben = d.ablage.pop();
        d.stapel = mischen(d.ablage);
        d.ablage = [oben];
        if (!d.stapel.length) break;
      }
      d.haende[id].push(d.stapel.shift());
    }
  },
  bot(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    const moeglich = h.filter((k) => this.passt(d, k));
    if (!moeglich.length) return this.aktion(raum, ctx, id, d.gezogen ? "weiter" : "ziehen");
    const naechsterHat = d.haende[nachster(d, id)]?.length ?? 9;
    const anzahl = (f) => h.filter((k) => k.farbe === f).length;
    // Buben aufheben, 7 und 8 gegen knappe Gegner einsetzen, sonst die längste Farbe abbauen
    const nutzen = (k) => (k.wert === "B" ? -6 : 0) + (["7", "8"].includes(k.wert) && naechsterHat <= 3 ? 6 : 0) + anzahl(k.farbe) + MM_STRAFE(k.wert) / 8 + Math.random() * 0.5;
    const k = istBot(d, id) && patzer(raum) ? irgendeine(moeglich) : moeglich.sort((a, b) => nutzen(b) - nutzen(a))[0];
    const rest = h.filter((x) => x !== k);
    return this.aktion(raum, ctx, id, "legen", { karte: k.id, wunsch: besteFarbe(rest.length ? rest : h), mau: istBot(d, id) ? Math.random() < 0.88 : true });
  },
  aktion(raum, ctx, id, typ, daten) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    const st = (d.statistik[id] ||= {});
    let schritte = 1;
    if (typ === "legen") {
      const k = h.find((x) => x.id === daten?.karte);
      if (!k) return "Diese Karte hast du nicht.";
      if (!this.passt(d, k)) return d.ziehen ? `Lege eine 7 oder ziehe ${d.ziehen} Karten.` : d.wunsch ? `Gewünscht ist ${FARBNAME[d.wunsch]}.` : k.wert === "B" ? "Bube auf Bube geht nicht." : "Passt nicht: gleiche Farbe oder gleicher Wert.";
      d.haende[id] = h.filter((x) => x !== k);
      d.ablage.push(k);
      d.wunsch = null; d.gezogen = false;
      const la = { typ: "legen", spieler: id, karten: [k], t: Date.now() };
      st.gelegt = (st.gelegt || 0) + 1;
      if (k.wert === "B") { d.wunsch = FARBEN.includes(daten?.wunsch) ? daten.wunsch : besteFarbe(d.haende[id]); la.wunsch = d.wunsch; }
      if (k.wert === "7") { d.ziehen += 2; la.ziehen = d.ziehen; st.sieben = (st.sieben || 0) + 1; }
      if (k.wert === "8" && d.reihenfolge.length > 2) { schritte = 2; la.aussetzen = nachster(d, id); }
      else if (k.wert === "8") { schritte = 0; la.aussetzen = nachster(d, id); }
      if (d.haende[id].length === 1) {
        if (daten?.mau) la.mau = true;
        else { this.ziehenKarten(d, id, 1); la.vergessen = true; st.vergessen = (st.vergessen || 0) + 1; }
      }
      d.letzteAktion = la;
      if (!istBot(d, id)) aktivMensch(raum, id);
      if (!d.haende[id].length) { la.mauMau = true; return this.rundeEnde(raum, ctx, id); }
    } else if (typ === "ziehen") {
      if (d.gezogen) return "Du hast schon gezogen. Lege die Karte oder klicke auf Weiter.";
      if (!istBot(d, id)) aktivMensch(raum, id);
      if (d.ziehen) {
        const n = d.ziehen;
        this.ziehenKarten(d, id, n);
        d.ziehen = 0;
        st.strafe = (st.strafe || 0) + n;
        d.letzteAktion = { typ: "zieht", spieler: id, anzahl: n, t: Date.now() };
      } else {
        this.ziehenKarten(d, id, 1);
        d.gezogen = true;
        d.letzteAktion = { typ: "zieht", spieler: id, anzahl: 1, t: Date.now() };
        return this.zug(raum, ctx); // darf die gezogene (oder eine andere) Karte noch legen
      }
    } else if (typ === "weiter") {
      if (!d.gezogen) return "Ziehe zuerst eine Karte.";
      if (!istBot(d, id)) aktivMensch(raum, id);
      d.gezogen = false;
      d.letzteAktion = { typ: "weiter", spieler: id, t: Date.now() };
    } else return;
    let n = id;
    for (let i = 0; i < schritte; i++) n = nachster(d, n);
    d.dran = n;
    this.zug(raum, ctx);
  },
  rundeEnde(raum, ctx, gewinner) {
    const d = raum.daten;
    clearTimeout(d.timer);
    const strafe = Object.fromEntries(d.reihenfolge.map((id) => [id, d.haende[id].reduce((a, k) => a + MM_STRAFE(k.wert), 0)]));
    const summe = Object.values(strafe).reduce((a, b) => a + b, 0);
    d.gesamt[gewinner] = (d.gesamt[gewinner] || 0) + summe;
    const st = (d.statistik[gewinner] ||= {});
    st.siege = (st.siege || 0) + 1;
    d.ergebnis = { gewinner, strafe, punkte: summe, haende: Object.fromEntries(d.reihenfolge.map((id) => [id, d.haende[id]])) };
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, d.gesamt[t.id] || 0);
    if (d.runde >= einst(raum).runden) {
      d.phase = "ende";
      d.platzierung = [...d.reihenfolge].sort((a, b) => (d.gesamt[b] || 0) - (d.gesamt[a] || 0));
      d.auszeichnungen = auszeichnungen(raum);
    } else {
      d.phase = "rundenende";
      d.timer = setTimeout(() => this.neueRunde(raum, ctx), 6500);
    }
    d.dran = null;
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ansicht(d) {
    return {
      oben: d.ablage?.[d.ablage.length - 1] || null, ablageAnzahl: d.ablage?.length || 0, wunsch: d.wunsch, ziehen: d.ziehen, gezogen: d.gezogen,
      stapelAnzahl: d.stapel?.length || 0, gesamt: d.gesamt, ergebnis: d.phase !== "spielen" ? d.ergebnis : null,
    };
  },
  weg(raum, ctx, id) {
    const d = raum.daten;
    const nach = nachster(d, id);
    d.stapel.push(...(d.haende[id] || []));
    d.reihenfolge = d.reihenfolge.filter((x) => x !== id);
    delete d.haende[id];
    if (d.reihenfolge.length <= 1) return this.rundeEnde(raum, ctx, d.reihenfolge[0]);
    if (d.dran === id) { d.dran = nach; d.gezogen = false; this.zug(raum, ctx); }
  },
};

// =============================================================
//  17 UND 4 (gegen die Bank)
//  52 Karten. 2–10 nach Augen, Bilder 10, Ass 11 oder 1. Ziel: näher an 21 als die Bank.
//  Jeder setzt Chips, bekommt 2 Karten und zieht so lange er will (verdoppeln mit 2 Karten möglich).
//  Die Bank zieht bis 16 und bleibt ab 17 stehen. 21 mit 2 Karten zahlt 3 zu 2.
// =============================================================
const WERTE52 = ["2", "3", "4", "5", "6", ...WERTE32];
const BJ_START = 100, BJ_MIN = 10;
const BJ_WERT = (w) => (w === "A" ? 11 : ["B", "D", "K"].includes(w) ? 10 : Number(w));
function bjPunkte(h) {
  let s = 0, asse = 0;
  for (const k of h) { if (!k) continue; s += BJ_WERT(k.wert); if (k.wert === "A") asse++; }
  while (s > 21 && asse) { s -= 10; asse--; }
  return { wert: s, weich: asse > 0 };
}
const bjNatur = (h) => h.length === 2 && bjPunkte(h).wert === 21;
const Siebzehn = {
  starten(raum, ctx) {
    const d = raum.daten;
    d.chips = Object.fromEntries(d.reihenfolge.map((id) => [id, BJ_START]));
    d.runde = 0;
    this.neueRunde(raum, ctx);
  },
  neueRunde(raum, ctx) {
    const d = raum.daten;
    d.imSpiel = d.reihenfolge.filter((id) => d.chips[id] >= BJ_MIN);
    if (!d.imSpiel.length || d.runde >= einst(raum).runden) return this.ende(raum, ctx);
    d.runde++;
    d.stapel = deck(WERTE52);
    d.haende = Object.fromEntries(d.reihenfolge.map((id) => [id, []]));
    d.einsatz = {}; d.status = {}; d.bank = []; d.bankOffen = false; d.ergebnis = null;
    d.phase = "setzen"; d.dran = null;
    d.letzteAktion = { typ: "setzen", t: Date.now() };
    // Computer setzen sofort
    for (const id of d.imSpiel) if (istBot(d, id)) {
      const wahl = [10, 10, 20, 20, 30, 50][Math.floor(Math.random() * 6)];
      this.setzen(d, id, Math.min(wahl, d.chips[id]));
    }
    clearTimeout(d.timer);
    const sek = einst(raum).sekunden;
    const menschenOnline = d.imSpiel.some((id) => raum.spieler[id]?.online && !raum.spieler[id]?.afk);
    const warten = !menschenOnline ? 2500 : sek ? Math.max(15, sek) * 1000 : null;
    d.endetUm = warten ? Date.now() + warten : null;
    if (warten) d.timer = setTimeout(() => this.setzenAblauf(raum, ctx), warten);
    handSenden(raum, ctx);
    ctx.sende(raum);
    if (this.alleGesetzt(d)) d.timer = setTimeout(() => this.austeilen(raum, ctx), 900);
  },
  setzen(d, id, betrag) {
    d.chips[id] -= betrag;
    d.einsatz[id] = betrag;
  },
  alleGesetzt: (d) => d.imSpiel.every((id) => d.einsatz[id]),
  setzenAblauf(raum, ctx) {
    const d = raum.daten;
    if (d.phase !== "setzen") return;
    for (const id of d.imSpiel) if (!d.einsatz[id]) {
      const s = raum.spieler[id];
      if (s) { s.ohneEingabe = (s.ohneEingabe || 0) + 1; if (s.ohneEingabe >= 2) s.afk = true; }
      this.setzen(d, id, BJ_MIN);
    }
    this.austeilen(raum, ctx);
  },
  austeilen(raum, ctx) {
    const d = raum.daten;
    if (d.phase !== "setzen") return;
    clearTimeout(d.timer);
    for (let r = 0; r < 2; r++) { for (const id of d.imSpiel) d.haende[id].push(d.stapel.shift()); d.bank.push(d.stapel.shift()); }
    for (const id of d.imSpiel) d.status[id] = bjNatur(d.haende[id]) ? "bj" : "spielt";
    d.phase = "spielen";
    d.letzteAktion = { typ: "austeilen", t: Date.now() };
    // Hat die Bank 21 mit zwei Karten, ist die Runde sofort vorbei
    if (bjNatur(d.bank)) return this.bankZug(raum, ctx);
    d.dran = d.imSpiel.find((id) => d.status[id] === "spielt") || null;
    if (!d.dran) return this.bankZug(raum, ctx);
    this.zug(raum, ctx);
  },
  zug(raum, ctx) {
    const d = raum.daten;
    d.zug++;
    handSenden(raum, ctx);
    zeitPlanen(raum, ctx, d.dran, () => this.bot(raum, ctx, d.dran));
    ctx.sende(raum);
  },
  bot(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const h = d.haende[id];
    const { wert, weich } = bjPunkte(h);
    const bank = BJ_WERT(d.bank[0].wert);
    if (!istBot(d, id)) return this.aktion(raum, ctx, id, "halten"); // Zeit abgelaufen: stehen bleiben
    if (h.length === 2 && (wert === 11 || (wert === 10 && bank < 10)) && d.chips[id] >= d.einsatz[id]) return this.aktion(raum, ctx, id, "verdoppeln");
    let ziehen;
    if (weich) ziehen = wert <= 17 || (wert === 18 && bank >= 9);
    else ziehen = wert <= 11 || (wert <= 16 && bank >= 7) || (wert === 12 && bank <= 3);
    return this.aktion(raum, ctx, id, ziehen ? "karte" : "halten");
  },
  aktion(raum, ctx, id, typ, daten) {
    const d = raum.daten;
    if (typ === "setzen") {
      if (d.phase !== "setzen" || !d.imSpiel.includes(id) || d.einsatz[id]) return;
      const b = parseInt(daten?.betrag);
      if (!(b >= BJ_MIN) || b > d.chips[id]) return `Setze zwischen ${BJ_MIN} und ${d.chips[id]} Chips.`;
      this.setzen(d, id, b);
      aktivMensch(raum, id);
      d.letzteAktion = { typ: "gesetzt", spieler: id, betrag: b, t: Date.now() };
      if (this.alleGesetzt(d)) return this.austeilen(raum, ctx);
      return ctx.sende(raum);
    }
    if (d.phase !== "spielen" || d.dran !== id || d.status[id] !== "spielt") return;
    const h = d.haende[id];
    if (typ === "karte") {
      h.push(d.stapel.shift());
      d.letzteAktion = { typ: "karte", spieler: id, t: Date.now() };
    } else if (typ === "halten") {
      d.status[id] = "steht";
      d.letzteAktion = { typ: "halten", spieler: id, t: Date.now() };
    } else if (typ === "verdoppeln") {
      if (h.length !== 2) return "Verdoppeln geht nur mit den ersten zwei Karten.";
      if (d.chips[id] < d.einsatz[id]) return "Dafür hast du nicht genug Chips.";
      d.chips[id] -= d.einsatz[id];
      d.einsatz[id] *= 2;
      h.push(d.stapel.shift());
      d.status[id] = "steht";
      (d.statistik[id] ||= {}).verdoppelt = ((d.statistik[id] || {}).verdoppelt || 0) + 1;
      d.letzteAktion = { typ: "verdoppeln", spieler: id, t: Date.now() };
    } else return;
    if (!istBot(d, id)) aktivMensch(raum, id);
    const w = bjPunkte(h).wert;
    if (w > 21) { d.status[id] = "drueber"; d.letzteAktion.drueber = true; }
    else if (w === 21) d.status[id] = "steht";
    if (d.status[id] !== "spielt") {
      const i = d.imSpiel.indexOf(id);
      d.dran = d.imSpiel.slice(i + 1).find((x) => d.status[x] === "spielt") || null;
      if (!d.dran) return this.bankZug(raum, ctx);
    }
    this.zug(raum, ctx);
  },
  bankZug(raum, ctx) {
    const d = raum.daten;
    clearTimeout(d.timer);
    d.phase = "bank"; d.dran = null; d.bankOffen = true; d.endetUm = null;
    d.letzteAktion = { typ: "bankAufdecken", t: Date.now() };
    const nochDrin = d.imSpiel.some((id) => d.status[id] === "steht");
    const schritt = () => {
      if (d.phase !== "bank") return;
      if (nochDrin && bjPunkte(d.bank).wert < 17) {
        d.bank.push(d.stapel.shift());
        d.letzteAktion = { typ: "bankZieht", t: Date.now() };
        ctx.sende(raum);
        d.timer = setTimeout(schritt, 950);
      } else this.abrechnen(raum, ctx);
    };
    ctx.sende(raum);
    d.timer = setTimeout(schritt, 1100);
  },
  abrechnen(raum, ctx) {
    const d = raum.daten;
    const bank = bjPunkte(d.bank).wert, bankNatur = bjNatur(d.bank);
    const res = {};
    for (const id of d.imSpiel) {
      const h = d.haende[id], e = d.einsatz[id], p = bjPunkte(h).wert, natur = bjNatur(h);
      const st = (d.statistik[id] ||= {});
      let art, auszahlung = 0;
      if (p > 21) art = "drueber";
      else if (natur && !bankNatur) { art = "bj"; auszahlung = Math.floor(e * 2.5); st.bj = (st.bj || 0) + 1; }
      else if (bankNatur && !natur) art = "verloren";
      else if (bank > 21 || p > bank) { art = "gewonnen"; auszahlung = e * 2; }
      else if (p === bank) { art = "gleich"; auszahlung = e; }
      else art = "verloren";
      d.chips[id] += auszahlung;
      if (auszahlung > e) st.siege = (st.siege || 0) + 1;
      st.bestes = Math.max(st.bestes || 0, auszahlung - e);
      res[id] = { art, plus: auszahlung - e };
    }
    d.ergebnis = { res, bank, bankNatur };
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, d.chips[t.id] || 0);
    d.letzteAktion = { typ: "abrechnung", t: Date.now() };
    const weiter = d.reihenfolge.some((id) => d.chips[id] >= BJ_MIN) && d.runde < einst(raum).runden;
    d.phase = "rundenende";
    if (weiter) d.timer = setTimeout(() => this.neueRunde(raum, ctx), 6000);
    else d.timer = setTimeout(() => this.ende(raum, ctx), 4500);
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ende(raum, ctx) {
    const d = raum.daten;
    clearTimeout(d.timer);
    d.phase = "ende";
    d.platzierung = [...d.reihenfolge].sort((a, b) => d.chips[b] - d.chips[a]);
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, d.chips[t.id] || 0);
    d.auszeichnungen = auszeichnungen(raum);
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ansicht(d) {
    const bank = d.bankOffen ? d.bank : d.bank.length ? [d.bank[0], null] : [];
    return {
      bank, bankWert: bjPunkte(bank).wert, bankOffen: d.bankOffen, chips: d.chips, einsatz: d.einsatz, status: d.status, imSpiel: d.imSpiel,
      tische: Object.fromEntries((d.imSpiel || []).map((id) => [id, { karten: d.haende[id] || [], wert: bjPunkte(d.haende[id] || []).wert }])),
      ergebnis: d.phase === "rundenende" ? d.ergebnis : null, minEinsatz: BJ_MIN,
    };
  },
  weg(raum, ctx, id) {
    const d = raum.daten;
    d.imSpiel = (d.imSpiel || []).filter((x) => x !== id);
    if (!d.imSpiel.length) return this.ende(raum, ctx);
    if (d.phase === "setzen" && this.alleGesetzt(d)) return this.austeilen(raum, ctx);
    if (d.phase === "spielen" && d.dran === id) { d.status[id] = "steht"; this.aktion(raum, ctx, id, "halten"); }
  },
};

// =============================================================
//  TEXAS HOLD'EM (Poker)
//  Jeder 1000 Chips, 2 verdeckte Karten, 5 Gemeinschaftskarten (Flop, Turn, River).
//  Setzrunden: passen, schieben, mitgehen, erhöhen, alles setzen. Blinds steigen alle 6 Hände.
//  Beste 5 aus 7 gewinnt, Nebentöpfe bei All-in. Ende nach der eingestellten Zahl an Händen
//  oder wenn nur noch einer Chips hat.
// =============================================================
const PK_START = 1000;
const PK_BLINDS = [20, 30, 50, 80, 120, 200, 300, 500, 800];
const PK_RANG = (w) => WERTE52.indexOf(w) + 2;
const PK_NAMEN = ["Höchste Karte", "Paar", "Zwei Paare", "Drilling", "Straße", "Flush", "Full House", "Vierling", "Straight Flush"];
function pkFuenf(k) {
  const r = k.map((x) => PK_RANG(x.wert)).sort((a, b) => b - a);
  const flush = k.every((x) => x.farbe === k[0].farbe);
  let strasse = 0;
  if (new Set(r).size === 5) { if (r[0] - r[4] === 4) strasse = r[0]; else if (r[0] === 14 && r[1] === 5) strasse = 5; }
  const anz = {};
  for (const x of r) anz[x] = (anz[x] || 0) + 1;
  const g = Object.entries(anz).map(([w, n]) => [n, +w]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const werte = g.map((x) => x[1]);
  if (strasse && flush) return [8, strasse];
  if (g[0][0] === 4) return [7, ...werte];
  if (g[0][0] === 3 && g[1][0] === 2) return [6, ...werte];
  if (flush) return [5, ...r];
  if (strasse) return [4, strasse];
  if (g[0][0] === 3) return [3, ...werte];
  if (g[0][0] === 2 && g[1][0] === 2) return [2, ...werte];
  if (g[0][0] === 2) return [1, ...werte];
  return [0, ...r];
}
function pkVergleich(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = (a[i] || 0) - (b[i] || 0); if (x) return x; }
  return 0;
}
// Beste Wertung aus 5 bis 7 Karten
function pkBeste(k) {
  if (k.length <= 5) return pkFuenf(k);
  let best = null;
  const n = k.length;
  for (let i = 0; i < n; i++) for (let j = n === 6 ? i : i + 1; j < n; j++) {
    const fuenf = k.filter((_, x) => x !== i && x !== j);
    if (fuenf.length !== 5) continue;
    const w = pkFuenf(fuenf);
    if (!best || pkVergleich(w, best) > 0) best = w;
  }
  return best;
}
const pkName = (w) => (w[0] === 8 && w[1] === 14 ? "Royal Flush" : PK_NAMEN[w[0]]);
const ALLE52 = FARBEN.flatMap((f) => WERTE52.map((w) => ({ id: f + "-" + w, farbe: f, wert: w })));
// Gewinnchance per Simulation (für die Computer-Gegner)
function pkChance(hand, board, gegner, sims = 160) {
  const bekannt = new Set([...hand, ...board].map((k) => k.id));
  const rest = ALLE52.filter((k) => !bekannt.has(k.id));
  const brauche = 5 - board.length + 2 * gegner;
  let sieg = 0;
  for (let s = 0; s < sims; s++) {
    const r = rest.slice();
    for (let i = 0; i < brauche; i++) { const j = i + Math.floor(Math.random() * (r.length - i)); [r[i], r[j]] = [r[j], r[i]]; }
    const b = board.concat(r.slice(0, 5 - board.length));
    const ich = pkBeste([...hand, ...b]);
    let vorn = true, gleich = 0;
    for (let g = 0; g < gegner; g++) {
      const o = 5 - board.length + 2 * g;
      const c = pkVergleich(pkBeste([r[o], r[o + 1], ...b]), ich);
      if (c > 0) { vorn = false; break; }
      if (c === 0) gleich++;
    }
    if (vorn) sieg += 1 / (gleich + 1);
  }
  return sieg / sims;
}
const Poker = {
  starten(raum, ctx) {
    const d = raum.daten;
    d.chips = Object.fromEntries(d.reihenfolge.map((id) => [id, PK_START]));
    d.raus = []; d.runde = 0;
    d.dealer = d.reihenfolge[Math.floor(Math.random() * d.reihenfolge.length)];
    this.neueHand(raum, ctx, true);
  },
  imSpiel: (d) => d.reihenfolge.filter((id) => !d.raus.includes(id)),
  kannHandeln(d, id) { return this.imSpiel(d).includes(id) && !d.gefoldet.includes(id) && !d.allin.includes(id); },
  pot: (d) => Object.values(d.beitrag).reduce((a, b) => a + b, 0),
  zahle(d, id, betrag) {
    const b = Math.max(0, Math.min(betrag, d.chips[id]));
    d.chips[id] -= b;
    d.runBet[id] = (d.runBet[id] || 0) + b;
    d.beitrag[id] = (d.beitrag[id] || 0) + b;
    if (d.chips[id] === 0 && !d.allin.includes(id)) d.allin.push(id);
    return b;
  },
  neueHand(raum, ctx, erste) {
    const d = raum.daten;
    for (const id of d.reihenfolge) if (d.chips[id] <= 0 && !d.raus.includes(id)) d.raus.push(id);
    const ids = this.imSpiel(d);
    if (ids.length <= 1 || d.runde >= einst(raum).runden) return this.ende(raum, ctx);
    d.runde++;
    d.bb = PK_BLINDS[Math.min(PK_BLINDS.length - 1, Math.floor((d.runde - 1) / 6))];
    d.stapel = deck(WERTE52);
    d.haende = Object.fromEntries(d.reihenfolge.map((id) => [id, ids.includes(id) ? d.stapel.splice(0, 2) : []]));
    d.board = []; d.beitrag = {}; d.runBet = {}; d.gefoldet = []; d.allin = []; d.gehandelt = []; d.strasse = 0; d.ergebnis = null;
    if (!erste || !ids.includes(d.dealer)) d.dealer = nachster(d, d.dealer, (x) => ids.includes(x));
    const imSpiel = (x) => ids.includes(x);
    d.sb = ids.length === 2 ? d.dealer : nachster(d, d.dealer, imSpiel);
    d.bbSpieler = nachster(d, d.sb, imSpiel);
    this.zahle(d, d.sb, d.bb / 2);
    this.zahle(d, d.bbSpieler, d.bb);
    d.einsatzHoehe = d.bb; d.minRaise = d.bb;
    d.phase = "spielen";
    d.letzteAktion = { typ: "austeilen", t: Date.now() };
    d.dran = nachster(d, d.bbSpieler, (x) => this.kannHandeln(d, x));
    if (!this.kannHandeln(d, d.dran) || ids.filter((x) => this.kannHandeln(d, x)).length === 0) return this.weiter(raum, ctx, d.bbSpieler);
    this.zug(raum, ctx);
  },
  zug(raum, ctx) {
    const d = raum.daten;
    d.zug++;
    handSenden(raum, ctx);
    zeitPlanen(raum, ctx, d.dran, () => this.bot(raum, ctx, d.dran));
    ctx.sende(raum);
  },
  bot(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id) return;
    const zu = d.einsatzHoehe - (d.runBet[id] || 0);
    if (!istBot(d, id)) return this.aktion(raum, ctx, id, zu > 0 ? "passen" : "schieben"); // Zeit abgelaufen
    const gegner = this.imSpiel(d).filter((x) => x !== id && !d.gefoldet.includes(x)).length;
    const chance = pkChance(d.haende[id], d.board, Math.max(1, gegner));
    const fair = 1 / (gegner + 1);
    const pot = this.pot(d);
    const r = Math.random();
    const erhoehen = (faktor) => {
      let ziel = d.einsatzHoehe + Math.max(d.minRaise, Math.round((pot * faktor) / 10) * 10);
      if (ziel - (d.runBet[id] || 0) >= d.chips[id]) return this.aktion(raum, ctx, id, "allin");
      return this.aktion(raum, ctx, id, "erhoehen", { betrag: ziel });
    };
    if (zu <= 0) {
      if ((chance > fair * 1.5 && r < 0.6) || r < 0.07) return erhoehen(chance > 0.8 ? 0.9 : 0.55);
      return this.aktion(raum, ctx, id, "schieben");
    }
    const potQuote = zu / (pot + zu);
    if (chance < potQuote - 0.04 && r > 0.05) return this.aktion(raum, ctx, id, "passen");
    if (chance > fair * 1.9 && r < 0.45 && d.gehandelt.length < 6) return erhoehen(0.6);
    if (zu >= d.chips[id]) return this.aktion(raum, ctx, id, chance > 0.5 ? "allin" : "passen");
    return this.aktion(raum, ctx, id, "mitgehen");
  },
  aktion(raum, ctx, id, typ, daten) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== id || !this.kannHandeln(d, id)) return;
    const zu = d.einsatzHoehe - (d.runBet[id] || 0);
    const st = (d.statistik[id] ||= {});
    let la = { typ, spieler: id, t: Date.now() };
    if (typ === "passen") {
      d.gefoldet.push(id);
    } else if (typ === "schieben") {
      if (zu > 0) return `Du musst ${zu} mitgehen, erhöhen oder passen.`;
    } else if (typ === "mitgehen") {
      if (zu <= 0) la.typ = "schieben";
      else la.betrag = this.zahle(d, id, zu);
    } else if (typ === "erhoehen" || typ === "allin") {
      const vorher = d.runBet[id] || 0;
      let ziel = typ === "allin" ? vorher + d.chips[id] : parseInt(daten?.betrag);
      if (!(ziel > 0)) return "Ungültiger Betrag.";
      if (ziel >= vorher + d.chips[id]) { ziel = vorher + d.chips[id]; la.typ = "allin"; }
      else if (ziel < d.einsatzHoehe + d.minRaise) return `Erhöhe mindestens auf ${d.einsatzHoehe + d.minRaise}.`;
      this.zahle(d, id, ziel - vorher);
      la.betrag = ziel;
      if (ziel > d.einsatzHoehe) {
        if (ziel - d.einsatzHoehe >= d.minRaise) d.minRaise = ziel - d.einsatzHoehe;
        d.einsatzHoehe = ziel;
        d.gehandelt = [];
        st.erhoeht = (st.erhoeht || 0) + 1;
      }
      if (la.typ === "allin") st.allin = (st.allin || 0) + 1;
    } else return;
    if (!d.gehandelt.includes(id)) d.gehandelt.push(id);
    if (!istBot(d, id)) aktivMensch(raum, id);
    d.letzteAktion = la;
    this.weiter(raum, ctx, id);
  },
  weiter(raum, ctx, letzter) {
    const d = raum.daten;
    const imHand = this.imSpiel(d).filter((x) => !d.gefoldet.includes(x));
    if (imHand.length === 1) return this.showdown(raum, ctx, true);
    const handelnd = imHand.filter((x) => !d.allin.includes(x));
    const fertig = handelnd.every((x) => d.gehandelt.includes(x) && (d.runBet[x] || 0) === d.einsatzHoehe);
    if (!fertig) {
      d.dran = nachster(d, letzter, (x) => this.kannHandeln(d, x));
      return this.zug(raum, ctx);
    }
    // Setzrunde vorbei: nächste Straße oder Showdown
    if (d.strasse >= 3 || handelnd.length <= 1) {
      // Alle (bis auf höchstens einen) sind all-in: restliche Karten offen legen
      if (d.board.length < 5) d.durchgelaufen = true;
      while (d.board.length < 5) d.board.push(d.stapel.shift());
      return this.showdown(raum, ctx, false);
    }
    d.strasse++;
    d.board.push(...d.stapel.splice(0, d.strasse === 1 ? 3 : 1));
    d.runBet = {}; d.einsatzHoehe = 0; d.minRaise = d.bb; d.gehandelt = [];
    d.letzteAktion = { typ: "strasse", name: ["", "Flop", "Turn", "River"][d.strasse], t: Date.now() };
    d.dran = nachster(d, d.dealer, (x) => this.kannHandeln(d, x));
    this.zug(raum, ctx);
  },
  showdown(raum, ctx, ohneAufdecken) {
    const d = raum.daten;
    clearTimeout(d.timer);
    const imHand = this.imSpiel(d).filter((x) => !d.gefoldet.includes(x));
    const wertung = {};
    if (!ohneAufdecken) for (const id of imHand) wertung[id] = pkBeste([...d.haende[id], ...d.board]);
    // Töpfe nach Einsatzhöhe (Nebentöpfe bei All-in)
    const stufen = [...new Set(Object.values(d.beitrag).filter((b) => b > 0))].sort((a, b) => a - b);
    const toepfe = [];
    let vorher = 0;
    for (const s of stufen) {
      let betrag = 0;
      for (const b of Object.values(d.beitrag)) betrag += Math.max(0, Math.min(b, s) - vorher);
      let berechtigt = imHand.filter((id) => (d.beitrag[id] || 0) >= s);
      if (!berechtigt.length) berechtigt = imHand;
      vorher = s;
      let gewinner = berechtigt;
      if (!ohneAufdecken) {
        const best = berechtigt.reduce((a, id) => (!a || pkVergleich(wertung[id], a) > 0 ? wertung[id] : a), null);
        gewinner = berechtigt.filter((id) => pkVergleich(wertung[id], best) === 0);
      }
      const letzter = toepfe[toepfe.length - 1];
      if (letzter && letzter.gewinner.join() === gewinner.join()) letzter.betrag += betrag;
      else toepfe.push({ betrag, gewinner });
    }
    const gewinne = {};
    for (const t of toepfe) {
      const anteil = Math.floor(t.betrag / t.gewinner.length);
      t.gewinner.forEach((id, i) => (gewinne[id] = (gewinne[id] || 0) + anteil + (i === 0 ? t.betrag - anteil * t.gewinner.length : 0)));
    }
    for (const [id, g] of Object.entries(gewinne)) {
      d.chips[id] += g;
      const st = (d.statistik[id] ||= {});
      st.siege = (st.siege || 0) + 1;
      st.groessterPot = Math.max(st.groessterPot || 0, g);
    }
    for (const id of imHand) if (wertung[id]) { const st = (d.statistik[id] ||= {}); if (!st.besteHand || pkVergleich(wertung[id], st.besteHand) > 0) st.besteHand = wertung[id]; }
    d.ergebnis = {
      ohneAufdecken, gewinne, toepfe, durchgelaufen: !!d.durchgelaufen,
      haende: ohneAufdecken ? {} : Object.fromEntries(imHand.map((id) => [id, d.haende[id]])),
      namen: Object.fromEntries(Object.entries(wertung).map(([id, w]) => [id, pkName(w)])),
    };
    d.durchgelaufen = false;
    d.phase = "rundenende"; d.dran = null; d.endetUm = null;
    d.letzteAktion = { typ: "showdown", t: Date.now() };
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, d.chips[t.id] || 0);
    d.timer = setTimeout(() => this.neueHand(raum, ctx), ohneAufdecken ? 4000 : 7000);
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ende(raum, ctx) {
    const d = raum.daten;
    clearTimeout(d.timer);
    d.phase = "ende";
    const drin = this.imSpiel(d).sort((a, b) => d.chips[b] - d.chips[a]);
    d.platzierung = [...drin, ...[...d.raus].reverse()];
    for (const t of teilnehmer(raum)) setzePunkte(raum, t, d.chips[t.id] || 0);
    d.auszeichnungen = auszeichnungen(raum);
    handSenden(raum, ctx);
    ctx.sende(raum);
  },
  ansicht(d) {
    return {
      board: d.board, pot: d.beitrag ? this.pot(d) : 0, chips: d.chips, runBet: d.runBet, einsatzHoehe: d.einsatzHoehe, minRaise: d.minRaise,
      gefoldet: d.gefoldet, allin: d.allin, raus: d.raus, dealer: d.dealer, sb: d.sb, bbSpieler: d.bbSpieler, bb: d.bb,
      strasse: d.strasse, ergebnis: d.phase === "rundenende" ? d.ergebnis : null,
    };
  },
  weg(raum, ctx, id) {
    const d = raum.daten;
    if (d.phase === "spielen" && !d.gefoldet.includes(id)) d.gefoldet.push(id);
    if (!d.raus.includes(id)) d.raus.push(id);
    if (this.imSpiel(d).length <= 1) return d.phase === "spielen" ? this.showdown(raum, ctx, true) : this.ende(raum, ctx);
    if (d.phase === "spielen" && d.dran === id) this.weiter(raum, ctx, id);
  },
};

const SPIELE = { schwimmen: Schwimmen, arschloch: Arschloch, durak: Durak, maumau: MauMau, siebzehn: Siebzehn, poker: Poker };
// Glücksspiele (17 und 4, Poker) sind vorerst ausgeblendet: Code bleibt, wird später überarbeitet (Casino)
const AUSGEBLENDET = ["siebzehn", "poker"];
const waehlbar = (m) => !!SPIELE[m] && !AUSGEBLENDET.includes(m);

function setzePunkte(raum, t, p) {
  if (!t) return;
  const d = raum.daten;
  if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p;
  else if (raum.spieler[t.id]) raum.spieler[t.id].punkte = p;
}

function auszeichnungen(raum) {
  const d = raum.daten;
  const alle = teilnehmer(raum);
  const st = d.statistik;
  const liste = [];
  const beste = (f, min) => {
    const w = alle.map((t) => [t.id, f(st[t.id] || {})]).filter(([, v]) => v >= min);
    if (!w.length) return null;
    const max = Math.max(...w.map(([, v]) => v));
    const ids = w.filter(([, v]) => v === max).map(([id]) => id);
    return ids.length < alle.length ? { ids, max } : null;
  };
  let b;
  if (d.modus === "schwimmen") {
    if ((b = beste((s) => s.einunddreissig || 0, 1))) liste.push({ icon: "🎯", titel: "31-Profi", spieler: b.ids, text: `${b.max}× genau 31 (oder Feuer)` });
    if ((b = beste((s) => s.beste || 0, 2))) liste.push({ icon: "🏊", titel: "Bester Schwimmer", spieler: b.ids, text: `${b.max}× das beste Blatt` });
  }
  if (d.modus === "arschloch") {
    if ((b = beste((s) => s.koenig || 0, 1))) liste.push({ icon: "👑", titel: "Dauerkönig", spieler: b.ids, text: `${b.max}× König` });
    if ((b = beste((s) => s.mehrlinge || 0, 2))) liste.push({ icon: "🃏", titel: "Mehrlings-Meister", spieler: b.ids, text: `${b.max}× drei oder vier Gleiche gelegt` });
    if ((b = beste((s) => s.arsch || 0, 2))) liste.push({ icon: "💩", titel: "Stammgast ganz unten", spieler: b.ids, text: `${b.max}× Arschloch` });
  }
  if (d.modus === "durak") {
    if ((b = beste((s) => s.abgewehrt || 0, 3))) liste.push({ icon: "🛡️", titel: "Bollwerk", spieler: b.ids, text: `${b.max} Karten abgewehrt` });
    if ((b = beste((s) => s.angriffe || 0, 3))) liste.push({ icon: "⚔️", titel: "Angriffslustig", spieler: b.ids, text: `${b.max} Angriffskarten gelegt` });
    if ((b = beste((s) => s.aufgenommen || 0, 4))) liste.push({ icon: "🎒", titel: "Sammler", spieler: b.ids, text: `${b.max} Karten aufgenommen` });
  }
  if (d.modus === "maumau") {
    if ((b = beste((s) => s.siege || 0, 1))) liste.push({ icon: "🏁", titel: "Mau-Mau-Meister", spieler: b.ids, text: `${b.max} Runde${b.max > 1 ? "n" : ""} gewonnen` });
    if ((b = beste((s) => s.sieben || 0, 2))) liste.push({ icon: "7️⃣", titel: "Sieben-Schleuder", spieler: b.ids, text: `${b.max}× eine 7 gelegt` });
    if ((b = beste((s) => s.strafe || 0, 4))) liste.push({ icon: "🎒", titel: "Kartensammler", spieler: b.ids, text: `${b.max} Strafkarten gezogen` });
    if ((b = beste((s) => s.vergessen || 0, 1))) liste.push({ icon: "🤐", titel: "Mau vergessen", spieler: b.ids, text: `${b.max}× nicht „Mau!“ gerufen` });
  }
  if (d.modus === "siebzehn") {
    if ((b = beste((s) => s.bj || 0, 1))) liste.push({ icon: "🎯", titel: "Glückshand", spieler: b.ids, text: `${b.max}× 21 mit zwei Karten` });
    if ((b = beste((s) => s.bestes || 0, 30))) liste.push({ icon: "💰", titel: "Großer Gewinn", spieler: b.ids, text: `+${b.max} Chips in einer Runde` });
    if ((b = beste((s) => s.verdoppelt || 0, 2))) liste.push({ icon: "✌️", titel: "Mutig", spieler: b.ids, text: `${b.max}× verdoppelt` });
  }
  if (d.modus === "poker") {
    if ((b = beste((s) => s.groessterPot || 0, 1))) liste.push({ icon: "💰", titel: "Größter Pot", spieler: b.ids, text: `${b.max} Chips auf einmal` });
    if ((b = beste((s) => (s.besteHand ? s.besteHand[0] * 100 + (s.besteHand[1] || 0) : 0), 200))) {
      const h = d.statistik[b.ids[0]].besteHand;
      liste.push({ icon: "🃏", titel: "Beste Hand", spieler: b.ids, text: pkName(h) });
    }
    if ((b = beste((s) => s.allin || 0, 2))) liste.push({ icon: "🔥", titel: "All-in-König", spieler: b.ids, text: `${b.max}× alles gesetzt` });
  }
  return liste;
}

// ---------- Schnittstelle ----------
module.exports = {
  meta: () => ({ max: MAX, runden: RUNDEN, ausgeblendet: AUSGEBLENDET }),
  standardEinstellungen: () => ({ modus: "schwimmen", bots: 2, sekunden: 30, leben: 3, runden: 5 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (waehlbar(e.modus)) {
      neu.modus = e.modus;
      if (RUNDEN[neu.modus] && !RUNDEN[neu.modus].includes(neu.runden)) neu.runden = RUNDEN_STANDARD[neu.modus];
    }
    if (e.bots !== undefined) neu.bots = Math.min(7, Math.max(0, parseInt(e.bots) || 0));
    if (e.leben !== undefined) neu.leben = [2, 3, 4].includes(parseInt(e.leben)) ? parseInt(e.leben) : 3;
    if (e.runden !== undefined) { const r = parseInt(e.runden); neu.runden = (RUNDEN[neu.modus] || [3, 5, 8]).includes(r) ? r : RUNDEN_STANDARD[neu.modus] || 5; }
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = s === 0 ? 0 : Math.min(60, Math.max(10, s || 30)); }
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    if (!waehlbar(e.modus)) e.modus = "schwimmen";
    const max = MAX[e.modus];
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    const NAMEN = { schwimmen: "Schwimmen", arschloch: "Arschloch", durak: "Durak", maumau: "Mau-Mau", siebzehn: "17 und 4", poker: "Texas Hold'em" };
    if (menschen.length > max) return `${NAMEN[e.modus]} geht mit höchstens ${max} Spielern.`;
    if (RUNDEN[e.modus] && !RUNDEN[e.modus].includes(e.runden)) e.runden = RUNDEN_STANDARD[e.modus];
    let botAnzahl = Math.min(e.bots, max - menschen.length);
    const minimum = MINIMUM[e.modus] || 2;
    if (menschen.length + botAnzahl < minimum) botAnzahl = minimum - menschen.length;
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    raum.daten = { modus: e.modus, bots, reihenfolge: mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]), zug: 0, statistik: {}, haende: {}, timer: null, phase: "spielen", auszeichnungen: [] };
    SPIELE[e.modus].starten(raum, ctx);
  },
  beenden(raum) { if (raum.daten) { clearTimeout(raum.daten.timer); clearTimeout(raum.daten.nachlegeTimer); } },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d.haende[spielerId] && d.modus !== "schwimmen") return;
    const f = SPIELE[d.modus].aktion(raum, ctx, spielerId, typ, daten);
    return typeof f === "string" ? f : undefined;
  },
  spielerZurueck(raum, id, ctx) { const d = raum.daten; if (d) ctx.privat(raum, id, "skat:hand", { karten: d.haende[id] || [], zug: d.zug }); },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (!raum.spieler[id] && d.reihenfolge.includes(id)) SPIELE[d.modus].weg(raum, ctx, id);
    else if (d.dran === id && d.phase === "spielen") zeitPlanen(raum, ctx, id, () => SPIELE[d.modus].bot(raum, ctx, id));
  },
  spielerInfo: (raum, s) => ({ karten: raum.daten?.haende[s.id]?.length || 0 }),
  ansicht(raum) {
    const d = raum.daten;
    return {
      modus: d.modus, phase: d.phase, zug: d.zug, runde: d.runde || 1, dran: d.dran,
      sekunden: einst(raum).sekunden, restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0,
      letzteAktion: d.letzteAktion,
      teilnehmer: teilnehmer(raum).map((t) => ({ ...t, karten: d.haende[t.id]?.length || 0 })),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      rundenGesamt: einst(raum).runden,
      platzierung: d.platzierung || null,
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
      ...SPIELE[d.modus].ansicht(d),
    };
  },
  // für Tests
  _intern: { swPunkte, Schwimmen, Arschloch, Durak, MauMau, Siebzehn, Poker, pkBeste, pkName, pkVergleich, bjPunkte, pkChance },
};
