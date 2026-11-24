// =============================================================
//  Spiel-Modul: Baulöwe (Brettspiel: Straßen kaufen, Häuser bauen, Miete kassieren)
//  - 2 Würfel (kryptografischer Zufall), Pasch = nochmal, dritter Pasch = Achsenknast
//  - Straßen, Haltestellen und Werke kaufen; volle Farbgruppe = doppelte Miete, dann bauen
//  - Häuser gleichmäßig bauen (bis Hotel), Hypotheken, Handel zwischen Spielern
//  - Glück- und Dorfkasse-Karten, Achsenknast, Steuern
//  - Wer nicht zahlen kann, ist pleite. Ende: einer bleibt übrig oder Rundenlimit (reichster gewinnt)
//  Spielfeld und Kartentexte: daten/baulowe.js
// =============================================================
const { randomInt } = require("crypto");
const { GRUPPEN, FELDER, EREIGNIS, KASSE, SPIELFIGUREN } = require("../daten/baulowe");

const MAX = 6;
const START_GELD = 1500, LOS_GELD = 200, KNAST_FELD = 10, KNAST_PREIS = 50;
const BOT_PAUSE = 1300, SCHRITT_MS = 170; // Computer warten, bis die Figur gelaufen ist
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" },
];
const w6 = () => randomInt(1, 7);
const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const einst = (raum) => raum.einstellungen.baulowe;
const kaufbar = (f) => ["strasse", "bahn", "werk"].includes(FELDER[f].art);
const gruppeFelder = (g) => FELDER.map((x, i) => (x.gruppe === g ? i : -1)).filter((i) => i >= 0);

function teilnehmer(raum) {
  const d = raum.daten;
  return d.reihenfolge.map((id) => {
    const bot = d.bots.find((b) => b.id === id);
    if (bot) return { id, bot: true, name: bot.name, avatar: bot.avatar, online: true };
    const s = raum.spieler[id];
    return s ? { id, bot: false, name: s.name, avatar: s.avatar, online: s.online, afk: s.afk } : { id, bot: false, name: "Weg", avatar: "👻", online: false };
  });
}
const istBot = (d, id) => d.bots.some((b) => b.id === id);
const name = (raum, id) => teilnehmer(raum).find((t) => t.id === id)?.name || "?";
const imSpiel = (d) => d.reihenfolge.filter((id) => !d.pleite.includes(id));

// ---------- Besitz und Miete ----------
const besitzVon = (d, id) => Object.keys(d.besitz).map(Number).filter((f) => d.besitz[f] === id);
function hatGruppe(d, id, g) { return gruppeFelder(g).every((f) => d.besitz[f] === id); }
function miete(d, f, augen, doppelt = false) {
  const feld = FELDER[f], b = d.besitz[f];
  if (b === undefined || d.hypothek[f]) return 0;
  if (feld.art === "strasse") {
    const h = d.haeuser[f] || 0;
    return h ? feld.miete[h] : feld.miete[0] * (hatGruppe(d, b, feld.gruppe) ? 2 : 1);
  }
  const n = besitzVon(d, b).filter((x) => FELDER[x].art === feld.art).length;
  if (feld.art === "bahn") return 25 * 2 ** (n - 1) * (doppelt ? 2 : 1);
  if (feld.art === "werk") return (doppelt || n >= 2 ? 10 : 4) * augen; // Karte „nächstes Werk“: immer 10 × Wurf
  return 0;
}
function vermoegen(d, id) {
  let v = d.geld[id];
  for (const f of besitzVon(d, id)) {
    v += d.hypothek[f] ? FELDER[f].preis / 2 : FELDER[f].preis;
    if (FELDER[f].gruppe) v += (d.haeuser[f] || 0) * GRUPPEN[FELDER[f].gruppe].haus;
  }
  return v;
}
// Was kann jemand noch flüssig machen (Häuser halb, Hypotheken)?
function fluessig(d, id) {
  let v = d.geld[id];
  for (const f of besitzVon(d, id)) {
    if (FELDER[f].gruppe) v += (d.haeuser[f] || 0) * GRUPPEN[FELDER[f].gruppe].haus / 2;
    if (!d.hypothek[f]) v += FELDER[f].preis / 2;
  }
  return v;
}

// ---------- Ablauf ----------
function log(d, text) { d.log.push({ t: Date.now(), text }); if (d.log.length > 30) d.log.shift(); }
function aktion(d, a) { d.aktionNr = (d.aktionNr || 0) + 1; d.letzteAktion = { ...a, nr: d.aktionNr, t: Date.now() }; }

function zugStarten(raum, ctx) {
  const d = raum.daten;
  d.pasch = 0; d.nochmal = false; d.schritt = "wuerfeln"; d.zugNr++;
  planen(raum, ctx);
  ctx.sende(raum);
}

// Zeitlimit für Menschen, Bedenkzeit für Computer
function planen(raum, ctx, extraMs = 0) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const id = d.angebot ? d.angebot.an : d.dran;
  const t = teilnehmer(raum).find((x) => x.id === id);
  const sek = einst(raum).sekunden;
  let warten = null;
  if (!t || t.bot) warten = BOT_PAUSE + extraMs + Math.random() * 500;
  else if (!t.online) warten = 5000 + extraMs;
  else if (t.afk) warten = 2500 + extraMs;
  else if (sek) warten = sek * 1000 + extraMs;
  d.endetUm = warten && t && !t.bot ? Date.now() + warten : null;
  if (warten) d.timer = setTimeout(() => {
    const s = raum.spieler[id];
    if (s && !t?.bot) { s.ohneEingabe = (s.ohneEingabe || 0) + 1; if (s.ohneEingabe >= 2) s.afk = true; }
    bot(raum, ctx, id);
  }, warten);
}

function geldAn(d, id, betrag) { d.geld[id] += betrag; }
// Zahlen: an = Spieler-ID oder null (Bank). Reicht das Geld nicht, muss Geld beschafft werden.
function zahlen(raum, ctx, von, an, betrag, grund) {
  const d = raum.daten;
  if (betrag <= 0) return true;
  if (d.geld[von] >= betrag) {
    d.geld[von] -= betrag;
    if (an) d.geld[an] += betrag;
    return true;
  }
  d.schulden = { von, an, betrag, grund };
  d.schritt = "zahlen";
  log(d, `${name(raum, von)} fehlen ${betrag - d.geld[von]} für ${grund}.`);
  return false;
}

function wuerfeln(raum, ctx, id) {
  const d = raum.daten;
  const w = [w6(), w6()], pasch = w[0] === w[1], summe = w[0] + w[1];
  d.wuerfel = w; d.wurfNr++;
  // Tempowürfel (dritter Würfel): 1, 2, 3, zweimal Mr. Monopoly, einmal Bus. Im Achsenknast zählt er nicht.
  d.tempo = einst(raum).tempo && d.knast[id] === undefined ? TEMPO_SEITEN[randomInt(0, 6)] : null;
  (d.statistik[id] ||= {}).wuerfe = (d.statistik[id].wuerfe || 0) + 1;
  if (pasch) d.statistik[id].pasch = (d.statistik[id].pasch || 0) + 1;
  // Im Achsenknast: Pasch befreit, sonst nach dem dritten Versuch zahlen
  if (d.knast[id] !== undefined) {
    if (pasch) {
      delete d.knast[id];
      log(d, `${name(raum, id)} würfelt einen Pasch und kommt frei.`);
      aktion(d, { typ: "wurf", spieler: id, wuerfel: w, frei: true });
      return laufen(raum, ctx, id, summe, { keinNochmal: true });
    }
    d.knast[id]++;
    if (d.knast[id] >= 3) {
      delete d.knast[id];
      log(d, `${name(raum, id)} zahlt nach drei Versuchen ${KNAST_PREIS} und kommt frei.`);
      aktion(d, { typ: "wurf", spieler: id, wuerfel: w, freiGekauft: true });
      if (!zahlen(raum, ctx, id, null, KNAST_PREIS, "den Achsenknast")) { d.nachZahlen = { laufen: summe }; planen(raum, ctx); return ctx.sende(raum); }
      return laufen(raum, ctx, id, summe, { keinNochmal: true });
    }
    log(d, `${name(raum, id)} bleibt im Achsenknast (${d.knast[id]}/3).`);
    aktion(d, { typ: "wurf", spieler: id, wuerfel: w, knastBleibt: true });
    d.schritt = "fertig";
    planen(raum, ctx, 1200);
    return ctx.sende(raum);
  }
  if (pasch) d.pasch++;
  d.nochmal = pasch && d.pasch < 3;
  if (d.pasch >= 3) {
    aktion(d, { typ: "wurf", spieler: id, wuerfel: w, dreiPasch: true });
    log(d, `${name(raum, id)}: dritter Pasch, ab in den Achsenknast!`);
    insKnast(d, id);
    d.schritt = "fertig";
    planen(raum, ctx, 1500);
    return ctx.sende(raum);
  }
  aktion(d, { typ: "wurf", spieler: id, wuerfel: w, pasch, tempo: d.tempo });
  const t = d.tempo;
  if (typeof t === "number") {
    if (t === w[0] && t === w[1]) {
      // Dreierpasch: Ziel frei wählen
      log(d, `${name(raum, id)} würfelt einen Dreierpasch und darf auf ein beliebiges Feld!`);
      d.nochmal = false;
      d.schritt = "dreier";
      planen(raum, ctx, 1500);
      return ctx.sende(raum);
    }
    return laufen(raum, ctx, id, summe + t);
  }
  if (t === "bus") {
    d.busWahl = [...new Set([w[0], w[1], summe])];
    d.schritt = "bus";
    planen(raum, ctx, 1500);
    return ctx.sende(raum);
  }
  if (t === "mr") d.mrOffen = true;
  laufen(raum, ctx, id, summe);
}

// Mr. Monopoly: zum nächsten freien Grundstück, sonst zum nächsten fremden (dort Miete zahlen)
function mrZiel(d, id) {
  const von = d.figur[id];
  for (let k = 1; k < 40; k++) { const f = (von + k) % 40; if (kaufbar(f) && d.besitz[f] === undefined) return f; }
  for (let k = 1; k < 40; k++) { const f = (von + k) % 40; if (kaufbar(f) && d.besitz[f] !== id && !d.pleite.includes(d.besitz[f]) && !d.hypothek[f]) return f; }
  return null;
}
// Bot/Zeitablauf: bestes Ziel für Bus oder Dreierpasch
function wahlWert(d, id, f) {
  if (!kaufbar(f)) return FELDER[f].art === "geheKnast" ? -500 : FELDER[f].art === "steuer" ? -FELDER[f].betrag : FELDER[f].art === "parken" ? d.topf : 0;
  const b = d.besitz[f];
  if (b === undefined) return d.geld[id] >= FELDER[f].preis ? 100 + FELDER[f].preis / 4 : 0;
  if (b === id) return 5;
  return -miete(d, f, 7);
}

const TEMPO_SEITEN = [1, 2, 3, "mr", "mr", "bus"];
function insKnast(d, id) { d.figur[id] = KNAST_FELD; d.knast[id] = 0; d.pasch = 0; (d.statistik[id] ||= {}).knast = (d.statistik[id].knast || 0) + 1; }

// Figur bewegen (vorwärts um n oder direkt zu einem Feld) und Feld auswerten
function laufen(raum, ctx, id, n, { zu = null, keinNochmal = false, doppelt = false, rueckwaerts = false } = {}) {
  const d = raum.daten;
  const von = d.figur[id];
  let nach = zu !== null ? zu : (von + n + 40) % 40;
  const schritte = zu !== null ? (zu - von + 40) % 40 : n;
  if (!rueckwaerts && (zu !== null ? nach < von || (nach === 0 && von !== 0) : von + n >= 40)) {
    const betrag = nach === 0 && einst(raum).losDoppelt ? LOS_GELD * 2 : LOS_GELD;
    geldAn(d, id, betrag);
    (d.rum ||= {})[id] = true;
    log(d, `${name(raum, id)} ${betrag > LOS_GELD ? "landet genau auf Los" : "kommt über Los"}: +${betrag}.`);
  }
  d.figur[id] = nach;
  d.bewegung = { spieler: id, von, nach, schritte: rueckwaerts ? -n : schritte, nr: (d.bewegung?.nr || 0) + 1 };
  d.keinNochmal = keinNochmal;
  feldAuswerten(raum, ctx, id, { doppelt, laufzeit: Math.abs(rueckwaerts ? n : schritte) * SCHRITT_MS });
}

function feldAuswerten(raum, ctx, id, { doppelt = false, laufzeit = 0 } = {}) {
  const d = raum.daten;
  const f = d.figur[id], feld = FELDER[f];
  d.schritt = "fertig";
  if (kaufbar(f)) {
    const b = d.besitz[f];
    if (b === undefined) {
      if (einst(raum).ersteRunde && !d.rum?.[id]) {
        log(d, `${name(raum, id)} darf erst kaufen, wenn die erste Runde geschafft ist.`);
      } else d.schritt = "kaufen";
    } else if (b !== id && einst(raum).knastKeineMiete && d.knast[b] !== undefined) {
      log(d, `🚔 ${name(raum, b)} sitzt im Achsenknast und kassiert keine Miete.`);
      aktion(d, { typ: "keineMiete", spieler: id, an: b, feld: f });
    } else if (b !== id && !d.pleite.includes(b)) {
      // Per Karte aufs Werk geschickt: neu würfeln, das Zehnfache zahlen
      const augen = doppelt && feld.art === "werk" ? w6() + w6() : d.wuerfel[0] + d.wuerfel[1];
      const m = miete(d, f, augen, doppelt);
      if (m > 0) {
        log(d, `${name(raum, id)} zahlt ${m} Miete an ${name(raum, b)} (${feld.name}).`);
        aktion(d, { typ: "miete", spieler: id, an: b, betrag: m, feld: f });
        (d.statistik[b] ||= {}).miete = (d.statistik[b].miete || 0) + m;
        zahlen(raum, ctx, id, b, m, `Miete (${feld.name})`);
      } else if (d.hypothek[f]) log(d, `${feld.name} hat eine Hypothek: keine Miete.`);
    }
  } else if (feld.art === "steuer") {
    log(d, `${name(raum, id)} zahlt ${feld.betrag} ${feld.name}.`);
    aktion(d, { typ: "steuer", spieler: id, betrag: feld.betrag, feld: f });
    d.topf += feld.betrag;
    zahlen(raum, ctx, id, null, feld.betrag, feld.name);
  } else if (feld.art === "geheKnast") {
    log(d, `${name(raum, id)} muss in den Achsenknast!`);
    insKnast(d, id);
    aktion(d, { typ: "knast", spieler: id });
    d.keinNochmal = true;
  } else if (feld.art === "parken") {
    if (einst(raum).topf && d.topf > 0) {
      log(d, `${name(raum, id)} räumt den Dorfplatz-Topf ab: +${d.topf}!`);
      aktion(d, { typ: "topf", spieler: id, betrag: d.topf });
      geldAn(d, id, d.topf); d.topf = 0;
    }
  } else if (feld.art === "ereignis" || feld.art === "kasse") {
    return karteZiehen(raum, ctx, id, feld.art, laufzeit);
  }
  planen(raum, ctx, laufzeit);
  ctx.sende(raum);
}

function karteZiehen(raum, ctx, id, stapelArt, laufzeit) {
  const d = raum.daten;
  const stapel = d.stapel[stapelArt];
  if (!stapel.length) d.stapel[stapelArt] = mischen((stapelArt === "ereignis" ? EREIGNIS : KASSE).map((_, i) => i)).filter((i) => !d.freiKarten.some((k) => k.art === stapelArt && k.i === i));
  const i = d.stapel[stapelArt].shift();
  const k = (stapelArt === "ereignis" ? EREIGNIS : KASSE)[i];
  log(d, `${name(raum, id)} zieht ${stapelArt === "ereignis" ? "Glück" : "Dorfkasse"}: „${k.text}“`);
  aktion(d, { typ: "karte", spieler: id, art: stapelArt, text: k.text, i });
  const pause = laufzeit + 2200; // Karte lesen lassen
  if (k.geld) {
    if (k.geld > 0) geldAn(d, id, k.geld);
    else { d.topf += -k.geld; zahlen(raum, ctx, id, null, -k.geld, "eine Karte"); }
  } else if (k.frei) {
    d.freiKarten.push({ spieler: id, art: stapelArt, i });
  } else if (k.knast) {
    insKnast(d, id); d.keinNochmal = true;
  } else if (k.reparatur) {
    let s = 0;
    for (const f of besitzVon(d, id)) { const h = d.haeuser[f] || 0; s += h === 5 ? k.reparatur.hotel : h * k.reparatur.haus; }
    if (s) zahlen(raum, ctx, id, null, s, "Reparaturen");
  } else if (k.vonJedem) {
    for (const x of imSpiel(d)) if (x !== id) { const b = Math.min(k.vonJedem, d.geld[x]); d.geld[x] -= b; d.geld[id] += b; }
  } else if (k.anJeden) {
    const andere = imSpiel(d).filter((x) => x !== id);
    if (d.geld[id] >= k.anJeden * andere.length) for (const x of andere) { d.geld[id] -= k.anJeden; d.geld[x] += k.anJeden; }
    else zahlen(raum, ctx, id, null, k.anJeden * andere.length, "eine Karte");
  } else if (k.zu !== undefined || k.zurueck || k.naechsteBahn || k.naechstesWerk) {
    // Nach dem Lesen der Karte weiterlaufen
    d.schritt = "karte";
    clearTimeout(d.timer);
    d.timer = setTimeout(() => {
      if (d.phase !== "spielen" || d.dran !== id) return;
      if (k.zurueck) return laufen(raum, ctx, id, k.zurueck, { zu: (d.figur[id] - k.zurueck + 40) % 40, rueckwaerts: true, keinNochmal: d.keinNochmal });
      let ziel = k.zu;
      const art = k.naechsteBahn ? "bahn" : k.naechstesWerk ? "werk" : null;
      if (art) { ziel = d.figur[id]; do ziel = (ziel + 1) % 40; while (FELDER[ziel].art !== art); }
      laufen(raum, ctx, id, 0, { zu: ziel, doppelt: !!art, keinNochmal: d.keinNochmal });
    }, pause);
    return ctx.sende(raum);
  }
  if (d.schritt !== "zahlen") d.schritt = "fertig";
  planen(raum, ctx, pause);
  ctx.sende(raum);
}

function zugBeenden(raum, ctx) {
  const d = raum.daten;
  const id = d.dran;
  d.angebot = null;
  if (d.mrOffen) {
    d.mrOffen = false;
    const ziel = d.knast[id] === undefined && !d.pleite.includes(id) ? mrZiel(d, id) : null;
    if (ziel !== null) {
      log(d, `🎩 Mr. Monopoly: ${name(raum, id)} fährt weiter zu ${FELDER[ziel].name}.`);
      aktion(d, { typ: "mr", spieler: id, feld: ziel });
      return laufen(raum, ctx, id, 0, { zu: ziel, keinNochmal: d.keinNochmal });
    }
  }
  // Pasch: nochmal würfeln (außer im Achsenknast gelandet)
  if (d.nochmal && !d.keinNochmal && d.knast[id] === undefined && !d.pleite.includes(id)) {
    d.nochmal = false;
    d.schritt = "wuerfeln";
    log(d, `${name(raum, id)} hat einen Pasch und darf nochmal.`);
    planen(raum, ctx);
    return ctx.sende(raum);
  }
  const alle = imSpiel(d);
  if (alle.length <= 1) return ende(raum, ctx);
  let i = d.reihenfolge.indexOf(id);
  do { i = (i + 1) % d.reihenfolge.length; if (i === 0) d.runde++; } while (d.pleite.includes(d.reihenfolge[i]));
  const limit = einst(raum).runden;
  if (limit && d.runde > limit) return ende(raum, ctx);
  d.dran = d.reihenfolge[i];
  zugStarten(raum, ctx);
}

function pleiteGehen(raum, ctx, id) {
  const d = raum.daten;
  const an = d.schulden?.von === id ? d.schulden.an : null;
  log(d, `💥 ${name(raum, id)} ist pleite!${an ? ` Alles geht an ${name(raum, an)}.` : ""}`);
  aktion(d, { typ: "pleite", spieler: id, an });
  for (const f of besitzVon(d, id)) {
    if (an) { d.besitz[f] = an; d.haeuser[f] = 0; }
    else { delete d.besitz[f]; delete d.hypothek[f]; d.haeuser[f] = 0; }
  }
  if (an) geldAn(d, an, Math.max(0, d.geld[id]));
  d.geld[id] = 0;
  d.freiKarten = d.freiKarten.filter((k) => k.spieler !== id || (an && (k.spieler = an)));
  d.pleite.push(id);
  delete d.knast[id];
  d.schulden = null;
  if (d.angebot && (d.angebot.von === id || d.angebot.an === id)) d.angebot = null;
  if (imSpiel(d).length <= 1) return ende(raum, ctx);
  if (d.dran === id) { d.nochmal = false; return zugBeenden(raum, ctx); }
  planen(raum, ctx);
  ctx.sende(raum);
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende"; d.schritt = null;
  const drin = imSpiel(d).sort((a, b) => vermoegen(d, b) - vermoegen(d, a));
  d.platzierung = [...drin, ...[...d.pleite].reverse()];
  for (const t of teilnehmer(raum)) {
    const p = d.pleite.includes(t.id) ? 0 : vermoegen(d, t.id);
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p; else if (raum.spieler[t.id]) raum.spieler[t.id].punkte = p;
  }
  d.auszeichnungen = auszeichnungen(raum);
  ctx.sende(raum);
}

function auszeichnungen(raum) {
  const d = raum.daten, alle = teilnehmer(raum), st = d.statistik, liste = [];
  const beste = (f, min) => {
    const w = alle.map((t) => [t.id, f(st[t.id] || {})]).filter(([, v]) => v >= min);
    if (!w.length) return null;
    const max = Math.max(...w.map(([, v]) => v));
    return { ids: w.filter(([, v]) => v === max).map(([id]) => id), max };
  };
  let b;
  if ((b = beste((s) => s.miete || 0, 100))) liste.push({ icon: "💰", titel: "Miethai", spieler: b.ids, text: `${b.max} Miete kassiert` });
  if ((b = beste((s) => s.gebaut || 0, 3))) liste.push({ icon: "🏗️", titel: "Baulöwe", spieler: b.ids, text: `${b.max} Häuser gebaut` });
  if ((b = beste((s) => s.knast || 0, 2))) liste.push({ icon: "🚔", titel: "Stammgast im Knast", spieler: b.ids, text: `${b.max}× im Achsenknast` });
  if ((b = beste((s) => s.pasch || 0, 3))) liste.push({ icon: "🎲", titel: "Pasch-König", spieler: b.ids, text: `${b.max} Pasche` });
  if ((b = beste((s) => s.handel || 0, 1))) liste.push({ icon: "🤝", titel: "Händler", spieler: b.ids, text: `${b.max} Geschäfte` });
  return liste;
}

// ---------- Bauen, Hypothek, Handel ----------
const HAEUSER_MAX = 32, HOTELS_MAX = 12;
function bankBestand(d) {
  let haeuser = 0, hotels = 0;
  for (const h of Object.values(d.haeuser)) { if (h === 5) hotels++; else haeuser += h || 0; }
  return { haeuser: HAEUSER_MAX - haeuser, hotels: HOTELS_MAX - hotels };
}
function kannBauen(d, id, f) {
  const feld = FELDER[f];
  if (feld?.art !== "strasse" || d.besitz[f] !== id || !hatGruppe(d, id, feld.gruppe)) return "Du brauchst erst die ganze Farbgruppe.";
  const gf = gruppeFelder(feld.gruppe);
  if (gf.some((x) => d.hypothek[x])) return "In der Gruppe ist noch eine Hypothek.";
  const h = d.haeuser[f] || 0;
  if (h >= 5) return "Hier steht schon ein Hotel.";
  if (h > Math.min(...gf.map((x) => d.haeuser[x] || 0))) return "Erst gleichmäßig bauen: die anderen Straßen der Gruppe zuerst.";
  if (d.geld[id] < GRUPPEN[feld.gruppe].haus) return "Dafür reicht dein Geld nicht.";
  if (d.limit) {
    const bank = bankBestand(d);
    if (h < 4 && bank.haeuser <= 0) return "Die Bank hat keine Häuser mehr.";
    if (h === 4 && bank.hotels <= 0) return "Die Bank hat keine Hotels mehr.";
  }
  return null;
}
function kannVerkaufen(d, id, f) {
  const feld = FELDER[f];
  if (feld?.art !== "strasse" || d.besitz[f] !== id || !(d.haeuser[f] > 0)) return "Hier steht kein Haus.";
  if (d.haeuser[f] < Math.max(...gruppeFelder(feld.gruppe).map((x) => d.haeuser[x] || 0))) return "Erst gleichmäßig verkaufen.";
  return null;
}
function hypothekAufnehmen(d, id, f) {
  if (d.besitz[f] !== id || d.hypothek[f]) return "Geht hier nicht.";
  if (FELDER[f].gruppe && gruppeFelder(FELDER[f].gruppe).some((x) => d.haeuser[x] > 0)) return "Erst alle Häuser der Gruppe verkaufen.";
  d.hypothek[f] = true; d.geld[id] += FELDER[f].preis / 2;
  return null;
}
const ausloesen = (f) => Math.ceil((FELDER[f].preis / 2) * 1.1);

// Wert eines Felds für einen Spieler (für die Computer beim Handeln)
function wertFuer(d, id, f, extraBesitz = []) {
  const feld = FELDER[f];
  let w = feld.preis + (d.haeuser[f] || 0) * (GRUPPEN[feld.gruppe]?.haus || 0);
  if (feld.gruppe) {
    const gf = gruppeFelder(feld.gruppe);
    const hat = gf.filter((x) => d.besitz[x] === id || extraBesitz.includes(x)).length;
    if (hat === gf.length) w *= 2.2; // macht die Gruppe voll
    else if (hat === gf.length - 1) w *= 1.4;
  }
  return w;
}

function angebotBewerten(d, a) {
  // Aus Sicht des Empfängers: was bekommt er, was gibt er ab?
  const nachher = [...besitzVon(d, a.an).filter((f) => !a.will.felder.includes(f)), ...a.gib.felder];
  let plus = a.gib.geld - a.will.geld;
  for (const f of a.gib.felder) plus += wertFuer(d, a.an, f, nachher);
  for (const f of a.will.felder) plus -= wertFuer(d, a.an, f) * 1.1;
  // Macht der Handel beim Anbieter eine Gruppe voll? Dann deutlich mehr verlangen
  const anbieterNach = [...besitzVon(d, a.von).filter((f) => !a.gib.felder.includes(f)), ...a.will.felder];
  for (const f of a.will.felder) if (FELDER[f].gruppe && gruppeFelder(FELDER[f].gruppe).every((x) => anbieterNach.includes(x))) plus -= FELDER[f].preis * 1.5;
  return plus;
}

function handelAusfuehren(raum, d, a) {
  for (const f of a.gib.felder) d.besitz[f] = a.an;
  for (const f of a.will.felder) d.besitz[f] = a.von;
  d.geld[a.von] += a.will.geld - a.gib.geld;
  d.geld[a.an] += a.gib.geld - a.will.geld;
  for (const x of [a.von, a.an]) (d.statistik[x] ||= {}).handel = (d.statistik[x].handel || 0) + 1;
  log(d, `🤝 ${name(raum, a.von)} und ${name(raum, a.an)} handeln.`);
  aktion(d, { typ: "handel", spieler: a.von, an: a.an });
}

// ---------- Versteigerung ----------
// Jeder bietet in 10er-Schritten. Nach jedem Gebot läuft die Uhr neu (8 s).
// Ende: Zeit abgelaufen oder alle außer dem Höchstbietenden haben gepasst.
const AUKTION_MS = 8000;
function auktionStarten(raum, ctx, feld) {
  const d = raum.daten;
  d.schritt = "auktion";
  d.auktion = { feld, hoechst: 0, von: null, passt: [], nr: (d.auktion?.nr || 0) + 1, endetUm: Date.now() + AUKTION_MS * 1.5 };
  log(d, `🔨 ${FELDER[feld].name} wird versteigert!`);
  aktion(d, { typ: "auktion", feld });
  clearTimeout(d.timer);
  auktionUhr(raum, ctx, AUKTION_MS * 1.5);
  botsBieten(raum, ctx);
  ctx.sende(raum);
}
function auktionUhr(raum, ctx, ms) {
  const d = raum.daten;
  clearTimeout(d.auktionTimer);
  d.auktion.endetUm = Date.now() + ms;
  const nr = d.auktion.nr;
  d.auktionTimer = setTimeout(() => { if (raum.daten === d && d.auktion?.nr === nr) auktionEnde(raum, ctx); }, ms);
}
function auktionAktion(raum, ctx, id, typ, daten) {
  const d = raum.daten, a = d.auktion;
  if (d.schritt !== "auktion" || !a || d.pleite.includes(id) || !d.reihenfolge.includes(id)) return;
  if (typ === "passen") {
    if (!a.passt.includes(id)) a.passt.push(id);
    const offen = imSpiel(d).filter((x) => !a.passt.includes(x) && x !== a.von);
    if (!offen.length) return auktionEnde(raum, ctx);
    return ctx.sende(raum);
  }
  const betrag = Math.round((parseInt(daten) || 0) / 10) * 10;
  if (a.passt.includes(id)) return "Du hast schon gepasst.";
  if (betrag <= a.hoechst) return `Biete mehr als ${a.hoechst}.`;
  if (betrag > d.geld[id]) return "So viel Geld hast du nicht.";
  a.hoechst = betrag; a.von = id;
  log(d, `🔨 ${name(raum, id)} bietet ${betrag}.`);
  auktionUhr(raum, ctx, AUKTION_MS);
  const offen = imSpiel(d).filter((x) => !a.passt.includes(x) && x !== a.von);
  if (!offen.length) return auktionEnde(raum, ctx);
  botsBieten(raum, ctx);
  ctx.sende(raum);
}
function auktionEnde(raum, ctx) {
  const d = raum.daten, a = d.auktion;
  if (!a || d.schritt !== "auktion") return;
  clearTimeout(d.auktionTimer);
  if (a.von && d.geld[a.von] >= a.hoechst) {
    d.geld[a.von] -= a.hoechst; d.besitz[a.feld] = a.von;
    log(d, `🔨 Zuschlag: ${name(raum, a.von)} ersteigert ${FELDER[a.feld].name} für ${a.hoechst}.`);
    aktion(d, { typ: "kauf", spieler: a.von, feld: a.feld, auktion: true, betrag: a.hoechst, gruppeVoll: FELDER[a.feld].gruppe && hatGruppe(d, a.von, FELDER[a.feld].gruppe) });
  } else log(d, `🔨 Niemand hat geboten, ${FELDER[a.feld].name} bleibt frei.`);
  d.auktion = { nr: a.nr };
  d.schritt = "fertig";
  planen(raum, ctx);
  ctx.sende(raum);
}
// Computer bieten bis zu einem eigenen Höchstwert, mit kleiner Bedenkzeit
function botsBieten(raum, ctx) {
  const d = raum.daten, a = d.auktion;
  const stufe = einst(raum).stufe || "mittel";
  for (const b of d.bots) {
    if (d.pleite.includes(b.id) || a.passt.includes(b.id) || a.von === b.id) continue;
    const reserve = (stufe === "schwer" ? 100 : 150) + 20 * d.runde;
    const wert = wertFuer(d, b.id, a.feld) * ({ einfach: 0.7, mittel: 0.9, schwer: 1.05 })[stufe];
    const grenze = Math.min(d.geld[b.id] - reserve, wert);
    const nr = a.nr, hoechst = a.hoechst;
    setTimeout(() => {
      if (raum.daten !== d || d.auktion?.nr !== nr || d.auktion.hoechst !== hoechst || d.schritt !== "auktion") return;
      const schritt = hoechst < 100 ? 10 : hoechst < 300 ? 20 : 50;
      const gebot = Math.ceil((hoechst + schritt) / 10) * 10;
      if (gebot <= grenze) auktionAktion(raum, ctx, b.id, "bieten", gebot);
      else auktionAktion(raum, ctx, b.id, "passen");
    }, 900 + Math.random() * 1600);
  }
}

// ---------- Computer (und Vertretung für abwesende Menschen) ----------
function bot(raum, ctx, id) {
  const d = raum.daten;
  if (d.phase !== "spielen") return;
  if (d.angebot && d.angebot.an === id) {
    const ok = istBot(d, id) && (einst(raum).stufe === "einfach" ? angebotBewerten(d, d.angebot) > -80 : angebotBewerten(d, d.angebot) > (einst(raum).stufe === "schwer" ? 80 : 30));
    return handle(raum, ctx, id, ok ? "annehmen" : "ablehnen");
  }
  if (d.dran !== id) return;
  const stufe = einst(raum).stufe || "mittel";
  const reserve = (stufe === "schwer" ? 120 : 150) + 30 * d.runde;
  const dumm = () => Math.random() < ({ einfach: 0.45, mittel: 0.06, schwer: 0 })[stufe];
  if (d.schritt === "zahlen") {
    geldBeschaffen(d, id, d.schulden.betrag);
    return handle(raum, ctx, id, d.geld[id] >= d.schulden.betrag ? "bezahlen" : "aufgeben");
  }
  if (d.schritt === "wuerfeln") {
    if (d.knast[id] !== undefined) {
      if (d.freiKarten.some((k) => k.spieler === id)) return handle(raum, ctx, id, "freikarte");
      // Früh im Spiel lieber freikaufen, später im Achsenknast sitzen und Miete kassieren
      if (d.runde < 12 && d.geld[id] > 400) return handle(raum, ctx, id, "freikaufen");
    }
    return handle(raum, ctx, id, "wuerfeln");
  }
  if (d.schritt === "bus") {
    const von = d.figur[id];
    const n = [...d.busWahl].sort((a, b) => wahlWert(d, id, (von + b) % 40) - wahlWert(d, id, (von + a) % 40))[0];
    return handle(raum, ctx, id, "bus", n);
  }
  if (d.schritt === "dreier") {
    const ziele = FELDER.map((_, f) => f).filter((f) => f !== d.figur[id]);
    const f = ziele.sort((a, b) => wahlWert(d, id, b) - wahlWert(d, id, a))[0];
    return handle(raum, ctx, id, "dreier", f);
  }
  if (d.schritt === "kaufen") {
    const f = d.figur[id], preis = FELDER[f].preis;
    const vervollstaendigt = FELDER[f].gruppe && gruppeFelder(FELDER[f].gruppe).filter((x) => x !== f).every((x) => d.besitz[x] === id);
    let kaufen = istBot(d, id) && d.geld[id] >= preis && (d.geld[id] - preis >= reserve || (vervollstaendigt && d.geld[id] - preis >= 50));
    if (istBot(d, id) && dumm()) kaufen = d.geld[id] >= preis && Math.random() < 0.5;
    return handle(raum, ctx, id, kaufen ? "kaufen" : "nichtKaufen");
  }
  if (d.schritt === "fertig" && istBot(d, id)) {
    // Hypotheken auslösen, dann bauen (billigste zuerst)
    for (const f of besitzVon(d, id)) if (d.hypothek[f] && d.geld[id] - ausloesen(f) > reserve + 200) { d.geld[id] -= ausloesen(f); delete d.hypothek[f]; }
    let gebaut = true;
    while (gebaut) {
      gebaut = false;
      const kandidaten = besitzVon(d, id).filter((f) => !kannBauen(d, id, f)).sort((a, b) => (d.haeuser[a] || 0) - (d.haeuser[b] || 0) || FELDER[b].preis - FELDER[a].preis);
      for (const f of kandidaten) {
        if (d.geld[id] - GRUPPEN[FELDER[f].gruppe].haus < reserve || dumm()) continue;
        handle(raum, ctx, id, "bauen", f, true); gebaut = true; break;
      }
    }
  }
  if (d.schritt === "fertig" || d.schritt === "karte") return d.schritt === "fertig" ? handle(raum, ctx, id, "zugEnde") : null;
}
function geldBeschaffen(d, id, ziel) {
  // Häuser verkaufen (teuerste Gruppe zuletzt), dann Hypotheken
  let schleife = 50;
  while (d.geld[id] < ziel && schleife--) {
    const haus = besitzVon(d, id).filter((f) => !kannVerkaufen(d, id, f)).sort((a, b) => FELDER[a].preis - FELDER[b].preis)[0];
    if (haus !== undefined) { d.haeuser[haus]--; d.geld[id] += GRUPPEN[FELDER[haus].gruppe].haus / 2; continue; }
    const frei = besitzVon(d, id).filter((f) => !d.hypothek[f]).sort((a, b) => FELDER[a].preis - FELDER[b].preis)[0];
    if (frei === undefined) break;
    hypothekAufnehmen(d, id, frei);
  }
}

// ---------- Aktionen ----------
function handle(raum, ctx, id, typ, daten, still = false) {
  const d = raum.daten;
  if (d.phase !== "spielen") return;
  if (!istBot(d, id) && raum.spieler[id]) raum.spieler[id].ohneEingabe = 0;
  // Antwort auf ein Handelsangebot
  if (typ === "annehmen" || typ === "ablehnen") {
    if (d.angebot?.an !== id) return;
    const a = d.angebot;
    if (typ === "annehmen") {
      if (d.geld[a.an] < a.will.geld) return "Dafür reicht dein Geld nicht.";
      if (d.geld[a.von] < a.gib.geld) { d.angebot = null; return "Der andere hat das Geld nicht mehr."; }
      handelAusfuehren(raum, d, a);
    } else { log(d, `${name(raum, a.an)} lehnt das Angebot ab.`); aktion(d, { typ: "abgelehnt", spieler: a.an, an: a.von }); }
    d.angebot = null;
    planen(raum, ctx);
    return ctx.sende(raum);
  }
  // Was jederzeit im eigenen Zug geht: bauen, verkaufen, Hypothek, Handel anbieten
  const f = parseInt(daten);
  if (typ === "bauen") {
    if (d.dran !== id || !["fertig", "wuerfeln", "zahlen"].includes(d.schritt)) return "Bauen geht nur in deinem Zug.";
    const fehler = kannBauen(d, id, f);
    if (fehler) return fehler;
    d.geld[id] -= GRUPPEN[FELDER[f].gruppe].haus;
    d.haeuser[f] = (d.haeuser[f] || 0) + 1;
    (d.statistik[id] ||= {}).gebaut = (d.statistik[id].gebaut || 0) + 1;
    log(d, `🏠 ${name(raum, id)} baut ${d.haeuser[f] === 5 ? "ein Hotel" : "ein Haus"} auf ${FELDER[f].name}.`);
    aktion(d, { typ: "bauen", spieler: id, feld: f, hotel: d.haeuser[f] === 5 });
    if (!still) ctx.sende(raum);
    return;
  }
  if (typ === "verkaufen") {
    if (d.dran !== id && d.schulden?.von !== id) return "Nur in deinem Zug.";
    const fehler = kannVerkaufen(d, id, f);
    if (fehler) return fehler;
    d.haeuser[f]--; d.geld[id] += GRUPPEN[FELDER[f].gruppe].haus / 2;
    log(d, `${name(raum, id)} verkauft ein Haus auf ${FELDER[f].name}.`);
    return ctx.sende(raum);
  }
  if (typ === "hypothek") {
    if (d.dran !== id && d.schulden?.von !== id) return "Nur in deinem Zug.";
    const fehler = hypothekAufnehmen(d, id, f);
    if (fehler) return fehler;
    log(d, `${name(raum, id)} nimmt eine Hypothek auf ${FELDER[f].name} auf (+${FELDER[f].preis / 2}).`);
    return ctx.sende(raum);
  }
  if (typ === "ausloesen") {
    if (d.dran !== id) return "Nur in deinem Zug.";
    if (d.besitz[f] !== id || !d.hypothek[f]) return "Geht hier nicht.";
    if (d.geld[id] < ausloesen(f)) return `Du brauchst ${ausloesen(f)}.`;
    d.geld[id] -= ausloesen(f); delete d.hypothek[f];
    log(d, `${name(raum, id)} löst die Hypothek auf ${FELDER[f].name} aus.`);
    return ctx.sende(raum);
  }
  if (typ === "anbieten") {
    if (d.dran !== id || !["wuerfeln", "fertig"].includes(d.schritt)) return "Handeln geht in deinem Zug (vor dem Würfeln oder danach).";
    if (d.angebot) return "Es läuft schon ein Angebot.";
    const a = daten || {};
    const an = String(a.an || "");
    if (!imSpiel(d).includes(an) || an === id) return "Mit wem willst du handeln?";
    const liste = (x) => [...new Set((Array.isArray(x) ? x : []).map(Number))];
    const gib = { felder: liste(a.gibFelder), geld: Math.max(0, parseInt(a.gibGeld) || 0) };
    const will = { felder: liste(a.willFelder), geld: Math.max(0, parseInt(a.willGeld) || 0) };
    if (gib.felder.some((x) => d.besitz[x] !== id) || will.felder.some((x) => d.besitz[x] !== an)) return "Das gehört euch so nicht.";
    if ([...gib.felder, ...will.felder].some((x) => (d.haeuser[x] || 0) > 0 || (FELDER[x].gruppe && gruppeFelder(FELDER[x].gruppe).some((y) => d.haeuser[y] > 0)))) return "Straßen mit Häusern (in der Gruppe) kann man nicht handeln.";
    if (gib.geld > d.geld[id]) return "So viel Geld hast du nicht.";
    if (!gib.felder.length && !will.felder.length) return "Ein Handel braucht mindestens eine Straße.";
    d.angebot = { von: id, an, gib, will, nr: (d.angebot?.nr || 0) + 1 };
    log(d, `📨 ${name(raum, id)} macht ${name(raum, an)} ein Angebot.`);
    aktion(d, { typ: "angebot", spieler: id, an });
    planen(raum, ctx);
    return ctx.sende(raum);
  }
  if (typ === "zurueckziehen") {
    if (d.angebot?.von !== id) return;
    d.angebot = null; planen(raum, ctx); return ctx.sende(raum);
  }
  // Versteigerung: alle dürfen mitbieten, nicht nur wer dran ist
  if (typ === "bieten" || typ === "passen") return auktionAktion(raum, ctx, id, typ, daten);
  if (d.dran !== id) return;
  if (d.angebot) return "Warte auf die Antwort zum Angebot.";
  switch (typ) {
    case "wuerfeln":
      if (d.schritt !== "wuerfeln") return;
      return wuerfeln(raum, ctx, id);
    case "bus": {
      const n = parseInt(daten);
      if (d.dran !== id || d.schritt !== "bus" || !d.busWahl.includes(n)) return;
      log(d, `🚌 ${name(raum, id)} fährt mit dem Bus ${n} Felder.`);
      return laufen(raum, ctx, id, n);
    }
    case "dreier": {
      const f = parseInt(daten);
      if (d.dran !== id || d.schritt !== "dreier" || !(f >= 0 && f < 40)) return;
      log(d, `${name(raum, id)} springt nach ${FELDER[f].name}.`);
      return laufen(raum, ctx, id, 0, { zu: f, keinNochmal: true });
    }
    case "freikaufen":
      if (d.schritt !== "wuerfeln" || d.knast[id] === undefined) return;
      if (d.geld[id] < KNAST_PREIS) return `Du brauchst ${KNAST_PREIS}.`;
      d.geld[id] -= KNAST_PREIS; d.topf += KNAST_PREIS; delete d.knast[id];
      log(d, `${name(raum, id)} kauft sich frei (${KNAST_PREIS}).`);
      aktion(d, { typ: "frei", spieler: id });
      planen(raum, ctx);
      return ctx.sende(raum);
    case "freikarte": {
      if (d.schritt !== "wuerfeln" || d.knast[id] === undefined) return;
      const k = d.freiKarten.findIndex((x) => x.spieler === id);
      if (k < 0) return "Du hast keine Frei-Karte.";
      d.freiKarten.splice(k, 1); delete d.knast[id];
      log(d, `${name(raum, id)} nutzt die Frei-Karte.`);
      aktion(d, { typ: "frei", spieler: id });
      planen(raum, ctx);
      return ctx.sende(raum);
    }
    case "kaufen": {
      if (d.schritt !== "kaufen") return;
      const ff = d.figur[id], preis = FELDER[ff].preis;
      if (d.geld[id] < preis) return "Dafür reicht dein Geld nicht.";
      d.geld[id] -= preis; d.besitz[ff] = id;
      log(d, `🏷️ ${name(raum, id)} kauft ${FELDER[ff].name} für ${preis}.`);
      aktion(d, { typ: "kauf", spieler: id, feld: ff, gruppeVoll: FELDER[ff].gruppe && hatGruppe(d, id, FELDER[ff].gruppe) });
      d.schritt = "fertig";
      planen(raum, ctx);
      return ctx.sende(raum);
    }
    case "nichtKaufen":
      if (d.schritt !== "kaufen") return;
      if (einst(raum).auktion && imSpiel(d).length > 1) return auktionStarten(raum, ctx, d.figur[id]);
      d.schritt = "fertig";
      planen(raum, ctx);
      return ctx.sende(raum);
    case "bezahlen": {
      if (d.schritt !== "zahlen") return;
      const s = d.schulden;
      if (d.geld[id] < s.betrag) return `Dir fehlen noch ${s.betrag - d.geld[id]}. Verkaufe Häuser oder nimm Hypotheken auf.`;
      d.geld[id] -= s.betrag; if (s.an) d.geld[s.an] += s.betrag;
      d.schulden = null;
      if (d.nachZahlen) { const n = d.nachZahlen.laufen; d.nachZahlen = null; return laufen(raum, ctx, id, n, { keinNochmal: true }); }
      d.schritt = "fertig";
      planen(raum, ctx);
      return ctx.sende(raum);
    }
    case "aufgeben":
      if (d.schritt !== "zahlen" && !daten?.sicher) return;
      if (d.schritt === "zahlen" && fluessig(d, id) >= d.schulden.betrag && !istBot(d, id) && !daten?.sicher) return "Du könntest noch Häuser verkaufen oder Hypotheken aufnehmen.";
      return pleiteGehen(raum, ctx, id);
    case "zugEnde":
      if (d.schritt !== "fertig") return;
      return zugBeenden(raum, ctx);
  }
}

// ---------- Schnittstelle ----------
module.exports = {
  meta: () => ({ felder: FELDER, gruppen: GRUPPEN, max: MAX, startGeld: START_GELD, figuren: SPIELFIGUREN }),
  standardEinstellungen: () => ({ bots: 2, sekunden: 60, runden: 30, topf: true, startGeld: 1500, losDoppelt: false, tempo: false, auktion: true, knastKeineMiete: false, haeuserLimit: false, ersteRunde: false }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(5, Math.max(0, parseInt(e.bots) || 0));
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = s === 0 ? 0 : Math.min(120, Math.max(30, s || 60)); }
    if (e.runden !== undefined) neu.runden = [20, 30, 50].includes(parseInt(e.runden)) ? parseInt(e.runden) : 30;
    if (e.topf !== undefined) neu.topf = !!e.topf;
    if (e.startGeld !== undefined) neu.startGeld = [1000, 1500, 2000].includes(+e.startGeld) ? +e.startGeld : 1500;
    if (e.losDoppelt !== undefined) neu.losDoppelt = !!e.losDoppelt;
    if (e.tempo !== undefined) neu.tempo = !!e.tempo;
    for (const k of ["auktion", "knastKeineMiete", "haeuserLimit", "ersteRunde"]) if (e[k] !== undefined) neu[k] = !!e[k];
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > MAX) return `Baulöwe geht mit höchstens ${MAX} Spielern.`;
    let botAnzahl = Math.min(e.bots, MAX - menschen.length);
    if (menschen.length + botAnzahl < 2) botAnzahl = 2 - menschen.length;
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    // Wunschfiguren: Wer zuerst gewählt hat, bekommt sie; der Rest wird verteilt
    const frei = mischen(SPIELFIGUREN);
    const figurIcon = {};
    for (const id of reihenfolge) {
      const w = raum.spieler[id]?.wunsch?.figur;
      if (w && frei.includes(w)) { figurIcon[id] = w; frei.splice(frei.indexOf(w), 1); }
    }
    for (const id of reihenfolge) if (!figurIcon[id]) figurIcon[id] = frei.shift() || "🎩";
    const startGeld = e.startGeld || START_GELD;
    raum.daten = {
      bots, reihenfolge, dran: reihenfolge[0], runde: 1, zugNr: 0, wurfNr: 0, pasch: 0, wuerfel: [1, 1],
      geld: Object.fromEntries(reihenfolge.map((id) => [id, startGeld])),
      figur: Object.fromEntries(reihenfolge.map((id) => [id, 0])),
      figurIcon, tempo: null, mrOffen: false, limit: !!e.haeuserLimit, rum: {}, auktion: null,
      besitz: {}, haeuser: {}, hypothek: {}, knast: {}, freiKarten: [], pleite: [], topf: 0,
      stapel: { ereignis: mischen(EREIGNIS.map((_, i) => i)), kasse: mischen(KASSE.map((_, i) => i)) },
      schritt: "wuerfeln", schulden: null, angebot: null, log: [], statistik: {}, timer: null, phase: "spielen", auszeichnungen: [],
    };
    log(raum.daten, `Los geht's! Jeder startet mit ${startGeld}.${e.tempo ? " Mit Tempowürfel!" : ""}`);
    aktion(raum.daten, { typ: "start" });
    zugStarten(raum, ctx);
  },
  beenden(raum) { if (raum.daten) { clearTimeout(raum.daten.timer); clearTimeout(raum.daten.auktionTimer); } },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d || !d.reihenfolge.includes(spielerId) || d.pleite.includes(spielerId)) return;
    const f = handle(raum, ctx, spielerId, typ, daten);
    return typeof f === "string" ? f : undefined;
  },
  spielerZurueck() {},
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase !== "spielen") return;
    if (!raum.spieler[id] && d.reihenfolge.includes(id) && !d.pleite.includes(id)) {
      d.schulden = d.dran === id ? d.schulden : null;
      return pleiteGehen(raum, ctx, id);
    }
    if (d.dran === id || d.angebot?.an === id) planen(raum, ctx);
  },
  spielerInfo: (raum, s) => ({ geld: raum.daten?.geld?.[s.id] ?? null }),
  ansicht(raum) {
    const d = raum.daten;
    return {
      phase: d.phase, dran: d.dran, runde: d.runde, rundenLimit: einst(raum).runden, zugNr: d.zugNr, schritt: d.schritt,
      wuerfel: d.wuerfel, wurfNr: d.wurfNr, pasch: d.pasch, tempo: d.tempo, busWahl: d.schritt === "bus" ? d.busWahl : null, mrOffen: !!d.mrOffen, mitTempo: !!einst(raum).tempo, nochmal: !!(d.nochmal && !d.keinNochmal && d.knast[d.dran] === undefined),
      geld: d.geld, figur: d.figur, figurIcon: d.figurIcon, besitz: d.besitz, haeuser: d.haeuser, hypothek: d.hypothek,
      knast: d.knast, freiKarten: d.freiKarten.map((k) => k.spieler), pleite: d.pleite, topf: d.topf,
      schulden: d.schulden, angebot: d.angebot, bewegung: d.bewegung || null,
      auktion: d.schritt === "auktion" && d.auktion ? { feld: d.auktion.feld, hoechst: d.auktion.hoechst, von: d.auktion.von, passt: d.auktion.passt, restMs: Math.max(0, d.auktion.endetUm - Date.now()), nr: d.auktion.nr } : null,
      bank: d.limit ? bankBestand(d) : null, regeln: { auktion: !!einst(raum).auktion, knastKeineMiete: !!einst(raum).knastKeineMiete, ersteRunde: !!einst(raum).ersteRunde },
      miete: Object.fromEntries(Object.keys(d.besitz).map((f) => [f, miete(d, +f, 7)])),
      vermoegen: Object.fromEntries(d.reihenfolge.map((id) => [id, vermoegen(d, id)])),
      log: d.log.slice(-12), letzteAktion: d.letzteAktion || null,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden,
      teilnehmer: teilnehmer(raum),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      platzierung: d.platzierung || null,
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
  _intern: { miete, vermoegen, angebotBewerten, FELDER },
};
