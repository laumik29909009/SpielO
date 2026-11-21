// =============================================================
//  Spiel-Modul: Kartenrunde (Skat-Blatt) mit drei Spielen
//  - Schwimmen (Schnautz/31): 3 Karten, tauschen mit der Mitte, 31 in einer Farbe
//  - Arschloch: Karten loswerden, gleiche Werte höher stechen, Rangtausch
//  - Durak: angreifen und verteidigen mit Trumpf, wer übrig bleibt, ist der Durak
//  Gemeinsam: Teilnehmer (Menschen + Computer), Hände privat, Zugzeit, Statistik.
// =============================================================
const FARBEN = ["kreuz", "pik", "herz", "karo"];
const WERTE32 = ["7", "8", "9", "10", "B", "D", "K", "A"];
const WERTE36 = ["6", ...WERTE32];
const BOT_DENKEN = [900, 1700];
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" }, { name: "Fritzi Frosch", avatar: "🐸" }, { name: "Theo Tiger", avatar: "🐯" },
];
const MAX = { schwimmen: 8, arschloch: 6, durak: 6 };

const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function deck(werte) {
  const k = [];
  for (const f of FARBEN) for (const w of werte) k.push({ id: f + "-" + w, farbe: f, wert: w });
  return mischen(k);
}
const einst = (raum) => raum.einstellungen.skat;

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
  if (!t || t.bot) warten = BOT_DENKEN[0] + Math.random() * (BOT_DENKEN[1] - BOT_DENKEN[0]);
  else if (!t.online) warten = 6000;
  else if (t.afk) warten = 2500;
  else if (sek) warten = sek * 1000;
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
      return this.aktion(raum, ctx, id, "schlagen", { angriff: offen.angriff.id, karte: moeglich[0].id });
    }
    if (id === d.angreifer) {
      if (!d.tisch.length) {
        const k = [...h].sort((a, b) => (a.farbe === d.trumpf) - (b.farbe === d.trumpf) || DU_RANG(a.wert) - DU_RANG(b.wert))[0];
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

const SPIELE = { schwimmen: Schwimmen, arschloch: Arschloch, durak: Durak };

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
  return liste;
}

// ---------- Schnittstelle ----------
module.exports = {
  meta: () => ({ max: MAX }),
  standardEinstellungen: () => ({ modus: "schwimmen", bots: 2, sekunden: 30, leben: 3, runden: 5 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (SPIELE[e.modus]) neu.modus = e.modus;
    if (e.bots !== undefined) neu.bots = Math.min(7, Math.max(0, parseInt(e.bots) || 0));
    if (e.leben !== undefined) neu.leben = [2, 3, 4].includes(parseInt(e.leben)) ? parseInt(e.leben) : 3;
    if (e.runden !== undefined) neu.runden = [3, 5, 8].includes(parseInt(e.runden)) ? parseInt(e.runden) : 5;
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = s === 0 ? 0 : Math.min(60, Math.max(10, s || 30)); }
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const max = MAX[e.modus];
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > max) return `${e.modus[0].toUpperCase() + e.modus.slice(1)} geht mit höchstens ${max} Spielern.`;
    let botAnzahl = Math.min(e.bots, max - menschen.length);
    const minimum = e.modus === "arschloch" ? 3 : 2;
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
  _intern: { swPunkte, Schwimmen, Arschloch, Durak },
};
