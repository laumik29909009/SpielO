// =============================================================
//  Spiel-Modul: GoonO (Karten-Klassiker: Farbe oder Zahl bedienen)
//  Regeln (Grundspiel):
//  - 108 Karten: 4 Farben × (0 einmal, 1–9 zweimal, je 2× Aussetzen, Richtungswechsel, +2)
//    plus 4× Farbwahl und 4× Farbwahl +4
//  - Gleiche Farbe, gleiche Zahl oder gleiches Symbol darf gelegt werden, Farbwahl immer
//  - Wer nicht kann (oder will), zieht 1 Karte und darf sie sofort legen, wenn sie passt
//  - Wer nur noch 1 Karte hat, muss „Letzte Karte!“ rufen, sonst gibt es 2 Strafkarten
//  - Wer zuerst keine Karten mehr hat, gewinnt die Runde und bekommt die Punkte der anderen
//  Hausregeln (in der Lobby einstellbar): Stapeln von +2/+4, Ziehen bis es passt,
//  7 = Hand tauschen / 0 = Hände weitergeben, Einwerfen (gleiche Karte außer der Reihe),
//  Startkarten, Spielziel (1 Runde oder bis zu einer Punktzahl), Zugzeit, Computer-Gegner
// =============================================================
const FARBEN = ["rot", "gelb", "gruen", "blau"];
const MAX_TEILNEHMER = 8;
const BOT_DENKEN = [900, 1800];
const ERWISCHT_MS = 4000; // so lange kann man jemanden erwischen, der nicht gerufen hat
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" }, { name: "Fritzi Frosch", avatar: "🐸" }, { name: "Theo Tiger", avatar: "🐯" },
];

const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function neuesDeck() {
  const karten = [];
  let n = 0;
  const neu = (farbe, wert) => karten.push({ id: "k" + n++, farbe, wert });
  for (const f of FARBEN) {
    neu(f, "0");
    for (let z = 1; z <= 9; z++) { neu(f, String(z)); neu(f, String(z)); }
    for (const a of ["aussetzen", "richtung", "plus2"]) { neu(f, a); neu(f, a); }
  }
  for (let i = 0; i < 4; i++) { neu("schwarz", "farbwahl"); neu("schwarz", "plus4"); }
  return mischen(karten);
}

const punkteVon = (k) => (/^\d$/.test(k.wert) ? Number(k.wert) : k.farbe === "schwarz" ? 50 : 20);
const einst = (raum) => raum.einstellungen.farbrausch;

// ---------- Teilnehmer ----------
function teilnehmer(raum) {
  const d = raum.daten;
  return d.reihenfolge.map((id) => {
    const bot = d.bots.find((b) => b.id === id);
    if (bot) return { id, bot: true, name: bot.name, avatar: bot.avatar, online: true };
    const s = raum.spieler[id];
    return s ? { id, bot: false, name: s.name, avatar: s.avatar, online: s.online, afk: s.afk } : null;
  }).filter(Boolean);
}
const oben = (d) => d.ablage[d.ablage.length - 1];

// Darf diese Karte gerade gelegt werden?
function passt(d, k, regeln) {
  const o = oben(d);
  if (d.strafe > 0) {
    // Es läuft eine +2/+4-Kette: nur mit Stapeln weiterreichen
    if (!regeln.stapeln) return false;
    if (o.wert === "plus4") return k.wert === "plus4";
    return k.wert === "plus2" || k.wert === "plus4";
  }
  if (k.farbe === "schwarz") return true;
  return k.farbe === d.farbe || k.wert === o.wert;
}

function nachster(raum, schritte = 1) {
  const d = raum.daten;
  const ids = d.reihenfolge;
  let i = ids.indexOf(d.dran);
  for (let s = 0; s < schritte; s++) i = (i + d.richtung + ids.length) % ids.length;
  return ids[i];
}

function ziehen(raum, id, anzahl) {
  const d = raum.daten;
  const gezogen = [];
  for (let i = 0; i < anzahl; i++) {
    if (!d.stapel.length) {
      // Ablagestapel (ohne oberste Karte) wird neu gemischt
      const o = d.ablage.pop();
      d.stapel = mischen(d.ablage.map((k) => (k.farbe === "schwarz" || k.gewaehlt ? { ...k, gewaehlt: undefined } : k)));
      d.ablage = [o];
      if (!d.stapel.length) break;
    }
    const k = d.stapel.pop();
    d.haende[id].push(k);
    gezogen.push(k);
  }
  if (d.haende[id].length > 1) d.gerufen[id] = false;
  return gezogen;
}

function handSenden(raum, ctx) {
  const d = raum.daten;
  for (const s of Object.values(raum.spieler)) {
    ctx.privat(raum, s.id, "farbrausch:hand", { karten: d.haende[s.id] || [], zug: d.zug });
  }
}

// ---------- Zugablauf ----------
function zugStarten(raum, ctx, extra = 0) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.zug++;
  d.gezogenDiesenZug = null;
  const t = teilnehmer(raum).find((x) => x.id === d.dran);
  const sek = einst(raum).sekunden;
  let warten = null;
  if (!t || t.bot) warten = BOT_DENKEN[0] + Math.random() * (BOT_DENKEN[1] - BOT_DENKEN[0]);
  else if (!t.online) warten = 6000;
  else if (t.afk) warten = 2500;
  else if (sek) warten = sek * 1000;
  if (warten) warten += extra;
  d.endetUm = warten && t && !t.bot ? Date.now() + warten : null;
  if (warten) d.timer = setTimeout(() => automatisch(raum, ctx), warten);
  handSenden(raum, ctx);
  ctx.sende(raum);
}

// Zeit abgelaufen oder Computer am Zug
function automatisch(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "spielen") return;
  const id = d.dran;
  const mensch = raum.spieler[id];
  if (mensch) { mensch.ohneEingabe = (mensch.ohneEingabe || 0) + 1; if (mensch.ohneEingabe >= 2) mensch.afk = true; }
  // Schon gezogen und die Karte passt: legen (Computer) bzw. weiter (Zeit abgelaufen)
  if (d.gezogenDiesenZug) {
    const k = d.haende[id].find((x) => x.id === d.gezogenDiesenZug);
    if (k && !mensch) return legen(raum, ctx, id, k.id, k.farbe === "schwarz" ? beliebtesteFarbe(d.haende[id], k) : null, true);
    return weiter(raum, ctx, 1);
  }
  const wahl = botWahl(raum, id);
  if (wahl) return legen(raum, ctx, id, wahl.karte, wahl.farbe, true);
  // Nichts passt: ziehen; passt die gezogene Karte, wird sie gelegt
  const ergebnis = ziehenAktion(raum, ctx, id, true);
  if (ergebnis?.spielbar) {
    const k = ergebnis.spielbar;
    return legen(raum, ctx, id, k.id, beliebtesteFarbe(d.haende[id], k), true);
  }
  if (d.dran === id && d.phase === "spielen") weiter(raum, ctx, 1);
}

function beliebtesteFarbe(hand, ohne) {
  const z = Object.fromEntries(FARBEN.map((f) => [f, 0]));
  for (const k of hand) if (k !== ohne && k.farbe !== "schwarz") z[k.farbe]++;
  return FARBEN.reduce((a, b) => (z[b] > z[a] ? b : a), FARBEN[Math.floor(Math.random() * 4)]);
}

// Computer-Strategie: Aktionskarten, wenn der Nächste fast fertig ist; Farbwahl aufheben
function botWahl(raum, id) {
  const d = raum.daten;
  const regeln = einst(raum);
  const hand = d.haende[id];
  const moeglich = hand.filter((k) => passt(d, k, regeln));
  if (!moeglich.length) return null;
  const naechster = nachster(raum);
  const bedrohlich = (d.haende[naechster]?.length || 9) <= 2;
  const wert = (k) => {
    let w = 0;
    if (k.farbe === "schwarz") w -= 30;
    if (["plus2", "aussetzen", "richtung", "plus4"].includes(k.wert)) w += bedrohlich ? 40 : regeln.stufe === "schwer" ? -4 : 5; // schwer: Aktionskarten für den richtigen Moment aufheben
    if (k.farbe === d.farbe) w += 8;
    w += punkteVon(k) / 5; // teure Karten zuerst loswerden
    return w + Math.random() * 4;
  };
  // KI-Stärke: einfach legt oft irgendeine passende Karte, schwer spart Schwarze und zielt auf den Nächsten
  const stufe = regeln.stufe || "mittel";
  const zufall = (stufe === "einfach" && Math.random() < 0.45) || (stufe === "mittel" && Math.random() < 0.08);
  const k = zufall ? moeglich[Math.floor(Math.random() * moeglich.length)] : moeglich.sort((a, b) => wert(b) - wert(a))[0];
  const farbe = k.farbe === "schwarz" ? (stufe === "einfach" && Math.random() < 0.5 ? ["rot", "gelb", "gruen", "blau"][Math.floor(Math.random() * 4)] : beliebtesteFarbe(hand, k)) : null;
  return { karte: k.id, farbe };
}

function ziehenAktion(raum, ctx, id, auto = false) {
  const d = raum.daten;
  const regeln = einst(raum);
  if (d.phase !== "spielen" || d.dran !== id || d.gezogenDiesenZug) return null;
  // Strafkarten einer +2/+4-Kette
  if (d.strafe > 0) {
    const n = d.strafe;
    ziehen(raum, id, n);
    d.strafe = 0;
    d.letzteAktion = { typ: "ziehen", spieler: id, anzahl: n, strafe: true, t: Date.now() };
    weiter(raum, ctx, 1);
    return null;
  }
  let gezogen = ziehen(raum, id, 1);
  if (regeln.bisPasst) {
    while (gezogen.length && !passt(d, gezogen[gezogen.length - 1], regeln) && d.haende[id].length < 60) {
      const neu = ziehen(raum, id, 1);
      if (!neu.length) break;
      gezogen = gezogen.concat(neu);
    }
  }
  const letzte = gezogen[gezogen.length - 1];
  d.letzteAktion = { typ: "ziehen", spieler: id, anzahl: gezogen.length, t: Date.now() };
  if (letzte && passt(d, letzte, regeln)) {
    d.gezogenDiesenZug = letzte.id; // darf gelegt werden, sonst "Weiter"
    if (!auto) { handSenden(raum, ctx); ctx.sende(raum); }
    return { spielbar: letzte };
  }
  if (!auto) weiter(raum, ctx, 1);
  return {};
}

function legen(raum, ctx, id, karteId, farbe, auto = false) {
  const d = raum.daten;
  const regeln = einst(raum);
  const hand = d.haende[id];
  const i = hand.findIndex((k) => k.id === karteId);
  if (i < 0) return "Diese Karte hast du nicht.";
  const k = hand[i];
  const einwurf = d.dran !== id;
  if (einwurf) {
    // Einwerfen: exakt gleiche Karte (Farbe und Wert), auch wenn man nicht dran ist
    const o = oben(d);
    if (!regeln.einwerfen || d.strafe > 0 || k.farbe === "schwarz" || k.farbe !== o.farbe || k.wert !== o.wert) return "Du bist nicht dran.";
  } else {
    if (d.gezogenDiesenZug && d.gezogenDiesenZug !== karteId) return "Du darfst nur die gezogene Karte legen.";
    if (!passt(d, k, regeln)) return "Die Karte passt nicht.";
  }
  if (k.farbe === "schwarz" && !FARBEN.includes(farbe)) return "Bitte eine Farbe wählen.";
  clearTimeout(d.timer);
  hand.splice(i, 1);
  d.ablage.push({ ...k, gewaehlt: k.farbe === "schwarz" ? farbe : undefined });
  d.farbe = k.farbe === "schwarz" ? farbe : k.farbe;
  if (einwurf) d.dran = id;
  d.letzteAktion = { typ: "legen", spieler: id, karte: d.ablage[d.ablage.length - 1], einwurf, t: Date.now() };
  merke(d, id, k);

  // Letzte Karte: Computer rufen meistens, Menschen müssen selbst drücken
  if (hand.length === 1) {
    const bot = d.bots.some((b) => b.id === id);
    if (bot && Math.random() < 0.88) d.gerufen[id] = true;
    if (!d.gerufen[id]) d.erwischbar = { spieler: id, bis: Date.now() + ERWISCHT_MS };
  } else if (hand.length > 1) d.gerufen[id] = false;
  if (!hand.length) return rundeEnde(raum, ctx, id);

  let schritte = 1;
  if (k.wert === "aussetzen") { schritte = 2; d.letzteAktion.effekt = { typ: "aussetzen", ziel: nachster(raum) }; }
  if (k.wert === "richtung") {
    d.richtung *= -1;
    d.letzteAktion.effekt = { typ: "richtung" };
    if (d.reihenfolge.length === 2) schritte = 2; // zu zweit wirkt Richtungswechsel wie Aussetzen
  }
  if (k.wert === "plus2" || k.wert === "plus4") {
    d.strafe += k.wert === "plus2" ? 2 : 4;
    d.letzteAktion.effekt = { typ: k.wert, ziel: nachster(raum), summe: d.strafe };
    if (!regeln.stapeln) {
      // Ohne Stapeln zieht der Nächste sofort und setzt aus
      const opfer = nachster(raum);
      ziehen(raum, opfer, d.strafe);
      d.strafe = 0;
      schritte = 2;
    }
  }
  if (regeln.siebenNull && k.wert === "7" && hand.length) {
    // 7: Hand mit dem Spieler tauschen, der die wenigsten Karten hat (Computer-Logik, bei Menschen ebenso)
    const ziel = d.reihenfolge.filter((x) => x !== id).sort((a, b) => d.haende[a].length - d.haende[b].length)[0];
    if (ziel) { [d.haende[id], d.haende[ziel]] = [d.haende[ziel], d.haende[id]]; d.letzteAktion.effekt = { typ: "tausch", ziel }; }
  }
  if (regeln.siebenNull && k.wert === "0") {
    // 0: Alle geben ihre Hand in Spielrichtung weiter
    const ids = d.richtung === 1 ? d.reihenfolge : [...d.reihenfolge].reverse();
    const alt = ids.map((x) => d.haende[x]);
    ids.forEach((x, j) => (d.haende[x] = alt[(j - 1 + ids.length) % ids.length]));
    d.letzteAktion.effekt = { typ: "weitergeben" };
  }
  if (auto === false && raum.spieler[id]) raum.spieler[id].ohneEingabe = 0;
  weiter(raum, ctx, schritte);
  return null;
}

function weiter(raum, ctx, schritte) {
  const d = raum.daten;
  d.dran = nachster(raum, schritte);
  zugStarten(raum, ctx);
}

function merke(d, id, k) {
  const s = (d.statistik[id] ||= { gelegt: 0, aktionen: 0, plus: 0, gezogen: 0, erwischt: 0, gerufen: 0 });
  s.gelegt++;
  if (/^(aussetzen|richtung|plus2|plus4|farbwahl)$/.test(k.wert)) s.aktionen++;
  if (k.wert === "plus4" || k.wert === "plus2") s.plus += k.wert === "plus4" ? 4 : 2;
}

function rundeEnde(raum, ctx, gewinner) {
  const d = raum.daten;
  clearTimeout(d.timer);
  let summe = 0;
  for (const [id, hand] of Object.entries(d.haende)) if (id !== gewinner) summe += hand.reduce((a, k) => a + punkteVon(k), 0);
  d.punkte[gewinner] = (d.punkte[gewinner] || 0) + summe;
  d.rundenSieger.push(gewinner);
  d.letzteRunde = { gewinner, punkte: summe, haende: Object.fromEntries(Object.entries(d.haende).map(([id, h]) => [id, h.length])) };
  punkteAktualisieren(raum);
  const ziel = einst(raum).ziel;
  const fertig = !ziel || d.punkte[gewinner] >= ziel;
  d.phase = fertig ? "ende" : "rundenende";
  d.erwischbar = null;
  if (fertig) d.auszeichnungen = auszeichnungen(raum);
  else d.timer = setTimeout(() => neueRunde(raum, ctx), 7000);
  handSenden(raum, ctx);
  ctx.sende(raum);
}

function punkteAktualisieren(raum) {
  const d = raum.daten;
  const ziel = einst(raum).ziel;
  for (const t of teilnehmer(raum)) {
    // Bei "eine Runde": Platzierung über Punkte der Runde, sonst Gesamtpunkte
    const p = d.punkte[t.id] || 0;
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p;
    else raum.spieler[t.id].punkte = p;
  }
  if (!ziel) return;
}

function neueRunde(raum, ctx) {
  const d = raum.daten;
  d.runde++;
  d.stapel = neuesDeck();
  d.haende = Object.fromEntries(d.reihenfolge.map((id) => [id, []]));
  for (const id of d.reihenfolge) ziehen(raum, id, einst(raum).startKarten);
  // Erste Karte: eine Zahlenkarte
  let k;
  do { k = d.stapel.pop(); if (!/^\d$/.test(k.wert)) d.stapel.unshift(k); } while (!/^\d$/.test(k.wert));
  d.ablage = [k];
  d.farbe = k.farbe;
  d.richtung = 1;
  d.strafe = 0;
  d.gerufen = {};
  d.erwischbar = null;
  d.phase = "spielen";
  // Wer die letzte Runde gewonnen hat, beginnt; sonst zufällig
  d.dran = d.rundenSieger[d.rundenSieger.length - 1] || d.reihenfolge[Math.floor(Math.random() * d.reihenfolge.length)];
  if (!d.reihenfolge.includes(d.dran)) d.dran = d.reihenfolge[0];
  // Austeilen dauert einen Moment (Animation), erst danach beginnt der erste Zug
  const dauer = Math.min(4200, 700 + d.reihenfolge.length * einst(raum).startKarten * 75);
  d.austeilenBis = Date.now() + dauer;
  d.letzteAktion = { typ: "austeilen", t: Date.now(), dauer, karten: einst(raum).startKarten };
  zugStarten(raum, ctx, dauer);
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
  let b = beste((s) => s.aktionen || 0, 3);
  if (b) liste.push({ icon: "⚡", titel: "Aktionsheld", spieler: b.ids, text: `${b.max} Aktionskarten gelegt` });
  b = beste((s) => s.plus || 0, 4);
  if (b) liste.push({ icon: "😈", titel: "Fiesling", spieler: b.ids, text: `${b.max} Strafkarten verteilt` });
  b = beste((s) => s.erwischt || 0, 1);
  if (b) liste.push({ icon: "👀", titel: "Adlerauge", spieler: b.ids, text: `${b.max}× jemanden ohne „Letzte Karte!“ erwischt` });
  b = beste((s) => s.gerufen || 0, 1);
  if (b) liste.push({ icon: "📣", titel: "Lautsprecher", spieler: b.ids, text: `${b.max}× rechtzeitig „Letzte Karte!“ gerufen` });
  const siege = {};
  d.rundenSieger.forEach((id) => (siege[id] = (siege[id] || 0) + 1));
  const [sid, sn] = Object.entries(siege).sort((x, y) => y[1] - x[1])[0] || [];
  if (sn >= 2) liste.push({ icon: "🏁", titel: "Rundenkönig", spieler: [sid], text: `${sn} Runden gewonnen` });
  return liste.slice(0, 6);
}

// ---------- Schnittstelle ----------
module.exports = {
  meta: () => ({ maxTeilnehmer: MAX_TEILNEHMER, farben: FARBEN }),

  standardEinstellungen: () => ({ bots: 2, startKarten: 7, ziel: 0, sekunden: 30, stapeln: true, bisPasst: false, siebenNull: false, einwerfen: false }),

  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(7, Math.max(0, parseInt(e.bots) || 0));
    if (e.startKarten !== undefined) neu.startKarten = [5, 7, 10].includes(parseInt(e.startKarten)) ? parseInt(e.startKarten) : 7;
    if (e.ziel !== undefined) neu.ziel = [0, 200, 500].includes(parseInt(e.ziel)) ? parseInt(e.ziel) : 0;
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = s === 0 ? 0 : Math.min(60, Math.max(10, s || 30)); }
    for (const r of ["stapeln", "bisPasst", "siebenNull", "einwerfen"]) if (typeof e[r] === "boolean") neu[r] = e[r];
    return neu;
  },

  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > MAX_TEILNEHMER) return `GoonO geht mit höchstens ${MAX_TEILNEHMER} Spielern. Gerade seid ihr ${menschen.length}.`;
    let botAnzahl = Math.min(e.bots, MAX_TEILNEHMER - menschen.length);
    if (menschen.length + botAnzahl < 2) botAnzahl = 1;
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    raum.daten = {
      bots, reihenfolge: mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]),
      runde: 0, zug: 0, punkte: {}, rundenSieger: [], statistik: {}, haende: {}, stapel: [], ablage: [],
      gerufen: {}, timer: null, phase: "spielen", auszeichnungen: [],
    };
    neueRunde(raum, ctx);
  },

  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",

  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (d.phase !== "spielen" || !d.haende[spielerId]) return;
    if (d.austeilenBis && Date.now() < d.austeilenBis) return "Moment, es wird noch ausgeteilt.";
    if (typ === "legen") {
      const f = legen(raum, ctx, spielerId, String(daten?.karte), daten?.farbe);
      return f || undefined;
    }
    if (typ === "ziehen") { ziehenAktion(raum, ctx, spielerId); return; }
    if (typ === "behalten") { // gezogene, passende Karte nicht legen
      if (d.dran === spielerId && d.gezogenDiesenZug) weiter(raum, ctx, 1);
      return;
    }
    if (typ === "letzteKarte") {
      const h = d.haende[spielerId];
      if (h.length <= 2 && !d.gerufen[spielerId]) {
        d.gerufen[spielerId] = true;
        (d.statistik[spielerId] ||= { gelegt: 0, aktionen: 0, plus: 0, gezogen: 0, erwischt: 0, gerufen: 0 }).gerufen++;
        if (d.erwischbar?.spieler === spielerId) d.erwischbar = null;
        d.letzteAktion = { typ: "ruf", spieler: spielerId, t: Date.now() };
        ctx.sende(raum);
      }
      return;
    }
    if (typ === "erwischt") {
      const e = d.erwischbar;
      if (!e || e.spieler === spielerId || Date.now() > e.bis || d.haende[e.spieler].length !== 1) return;
      ziehen(raum, e.spieler, 2);
      d.erwischbar = null;
      (d.statistik[spielerId] ||= { gelegt: 0, aktionen: 0, plus: 0, gezogen: 0, erwischt: 0, gerufen: 0 }).erwischt++;
      d.letzteAktion = { typ: "erwischt", spieler: spielerId, ziel: e.spieler, t: Date.now() };
      handSenden(raum, ctx);
      ctx.sende(raum);
    }
  },

  spielerZurueck(raum, id, ctx) {
    const d = raum.daten;
    if (d) ctx.privat(raum, id, "farbrausch:hand", { karten: d.haende[id] || [], zug: d.zug });
  },

  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (!raum.spieler[id] && d.haende[id]) {
      // Entfernt: Karten zurück unter den Stapel, Platz verschwindet
      d.stapel.unshift(...d.haende[id]);
      delete d.haende[id];
      const warDran = d.dran === id;
      if (warDran) d.dran = nachster(raum);
      d.reihenfolge = d.reihenfolge.filter((x) => x !== id);
      if (d.reihenfolge.length < 2) return rundeEnde(raum, ctx, d.reihenfolge[0]);
      if (warDran) zugStarten(raum, ctx);
      return;
    }
    if (d.dran === id && d.phase === "spielen") { d.zug--; zugStarten(raum, ctx); }
  },

  spielerInfo(raum, s) {
    return { karten: raum.daten?.haende[s.id]?.length || 0 };
  },

  ansicht(raum) {
    const d = raum.daten;
    const e = einst(raum);
    return {
      phase: d.phase,
      runde: d.runde,
      zug: d.zug,
      dran: d.dran,
      richtung: d.richtung,
      farbe: d.farbe,
      oben: oben(d),
      ablageAnzahl: d.ablage.length,
      stapelAnzahl: d.stapel.length,
      strafe: d.strafe,
      sekunden: e.sekunden,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0,
      austeilenMs: d.austeilenBis ? Math.max(0, d.austeilenBis - Date.now()) : 0,
      gezogenDiesenZug: d.gezogenDiesenZug,
      erwischbar: d.erwischbar && Date.now() < d.erwischbar.bis ? { spieler: d.erwischbar.spieler, restMs: d.erwischbar.bis - Date.now() } : null,
      gerufen: Object.keys(d.gerufen).filter((id) => d.gerufen[id]),
      letzteAktion: d.letzteAktion,
      letzteRunde: d.letzteRunde || null,
      teilnehmer: teilnehmer(raum).map((t) => ({ ...t, karten: d.haende[t.id]?.length || 0, punkte: d.punkte[t.id] || 0 })),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: d.punkte[b.id] || 0, online: true, bot: true })),
      ziel: e.ziel,
      regeln: { stapeln: e.stapeln, bisPasst: e.bisPasst, siebenNull: e.siebenNull, einwerfen: e.einwerfen },
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
};
