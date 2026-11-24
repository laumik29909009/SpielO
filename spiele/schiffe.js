// =============================================================
//  Spiel-Modul: Schiffe versenken
//  - 2 bis 4 Flotten (freie Plätze füllt der Computer), Feld 10×10
//  - Aufstellen: jeder stellt seine 5 Schiffe gleichzeitig auf (Schiffe berühren sich nicht)
//  - Kampf: reihum schießt man auf eine gegnerische Flotte. Treffer = nochmal (abschaltbar)
//  - Wessen Flotte komplett versenkt ist, scheidet aus. Die letzte Flotte gewinnt.
//  - Punkte: Treffer 10, versenktes Schiff 30, Platz 1/2/3: 150/80/40
// =============================================================
const N = 10;
const FLOTTE = [
  { typ: "traeger", name: "Flugzeugträger", laenge: 5 },
  { typ: "schlacht", name: "Schlachtschiff", laenge: 4 },
  { typ: "kreuzer", name: "Kreuzer", laenge: 3 },
  { typ: "uboot", name: "U-Boot", laenge: 3 },
  { typ: "zerstoerer", name: "Zerstörer", laenge: 2 },
];
const BOTS = [
  { name: "Käpt'n Klabauter", avatar: "🏴‍☠️" }, { name: "Admiral Ahoi", avatar: "⚓" }, { name: "Möwe Moni", avatar: "🐦" }, { name: "Hai-Lights", avatar: "🦈" },
];
const AUFSTELL_MS = 75000, BOT_ZUG_MS = 1500, NACH_SCHUSS_MS = 1900, PLATZ_PUNKTE = [150, 80, 40, 0];
const einst = (raum) => raum.einstellungen.schiffe;
const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const k = (x, y) => `${x},${y}`;
const istBot = (d, id) => d.bots.some((b) => b.id === id);

function planen(raum, ms, fn) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const nr = ++d.planNr;
  d.endetUm = ms ? Date.now() + ms : null;
  if (ms != null) d.timer = setTimeout(() => { if (raum.daten === d && d.planNr === nr) fn(); }, ms);
}

// ---------- Aufstellung prüfen und würfeln ----------
function felderVon(x, y, laenge, quer) { return Array.from({ length: laenge }, (_, i) => (quer ? [x + i, y] : [x, y + i])); }
function gueltig(schiffe, beruehren) {
  if (!Array.isArray(schiffe) || schiffe.length !== FLOTTE.length) return null;
  const belegt = new Map();
  const ergebnis = [];
  for (let i = 0; i < FLOTTE.length; i++) {
    const s = schiffe[i] || {};
    const x = +s.x, y = +s.y, quer = !!s.quer, L = FLOTTE[i].laenge;
    if (![x, y].every(Number.isInteger)) return null;
    const felder = felderVon(x, y, L, quer);
    if (felder.some(([a, b]) => a < 0 || b < 0 || a >= N || b >= N)) return null;
    for (const [a, b] of felder) {
      // Abstand: kein anderes Schiff im Feld oder (ohne „berühren“) drumherum
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (beruehren && (dx || dy)) continue;
        const o = belegt.get(k(a + dx, b + dy));
        if (o !== undefined && o !== i) return null;
      }
    }
    felder.forEach(([a, b]) => belegt.set(k(a, b), i));
    ergebnis.push({ ...FLOTTE[i], x, y, quer, felder, treffer: [], versenkt: false });
  }
  return ergebnis;
}
function zufallsFlotte(beruehren) {
  for (let versuch = 0; versuch < 500; versuch++) {
    const liste = [];
    let ok = true;
    for (let i = 0; i < FLOTTE.length && ok; i++) {
      let gesetzt = false;
      for (let t = 0; t < 200 && !gesetzt; t++) {
        const quer = Math.random() < 0.5, L = FLOTTE[i].laenge;
        const x = Math.floor(Math.random() * (quer ? N - L + 1 : N)), y = Math.floor(Math.random() * (quer ? N : N - L + 1));
        if (teilGueltig([...liste, { x, y, quer }], beruehren)) { liste.push({ x, y, quer }); gesetzt = true; }
      }
      if (!gesetzt) ok = false;
    }
    if (ok) return liste;
  }
  return [{ x: 0, y: 0, quer: true }, { x: 0, y: 2, quer: true }, { x: 0, y: 4, quer: true }, { x: 0, y: 6, quer: true }, { x: 0, y: 8, quer: true }];
}
// Prüft die ersten n Schiffe (für das Würfeln)
function teilGueltig(liste, beruehren) {
  const belegt = new Map();
  for (let i = 0; i < liste.length; i++) {
    const { x, y, quer } = liste[i];
    const felder = felderVon(x, y, FLOTTE[i].laenge, quer);
    if (felder.some(([a, b]) => a < 0 || b < 0 || a >= N || b >= N)) return false;
    for (const [a, b] of felder) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (beruehren && (dx || dy)) continue;
      if (belegt.has(k(a + dx, b + dy))) return false;
    }
    felder.forEach(([a, b]) => belegt.set(k(a, b), i));
  }
  return true;
}

// Die eigene Flotte geht nur an den Besitzer (der Spielstand selbst ist für alle gleich)
function flotteSenden(raum, ctx, id) {
  const f = raum.daten?.flotten[id];
  if (!f || !raum.spieler[id]) return;
  ctx.privat(raum, id, "sv:flotte", { schiffe: (f.schiffe || []).map(({ typ, name, laenge, x, y, quer }) => ({ typ, name, laenge, x, y, quer })), bereit: f.bereit });
}

// ---------- Ablauf ----------
const lebt = (d, id) => d.flotten[id]?.schiffe.some((s) => !s.versenkt);
const imSpiel = (d) => d.reihenfolge.filter((id) => !d.raus.includes(id));

function kampfStarten(raum, ctx) {
  const d = raum.daten;
  const beruehren = einst(raum).beruehren;
  // Wer nicht fertig wurde, bekommt eine zufällige Aufstellung
  for (const id of d.reihenfolge) {
    const f = d.flotten[id];
    if (!f.schiffe) f.schiffe = gueltig(zufallsFlotte(beruehren), beruehren);
    f.bereit = true;
    flotteSenden(raum, ctx, id);
  }
  d.phase = "kampf";
  d.dran = d.reihenfolge[Math.floor(Math.random() * d.reihenfolge.length)];
  zugStarten(raum, ctx);
}
function zugStarten(raum, ctx) {
  const d = raum.daten;
  const gegner = imSpiel(d).filter((id) => id !== d.dran);
  if (!gegner.includes(d.ziel?.[d.dran])) d.ziel[d.dran] = gegner[0];
  const ms = einst(raum).sekunden * 1000;
  const mensch = !istBot(d, d.dran) && raum.spieler[d.dran]?.online;
  if (!mensch) planen(raum, BOT_ZUG_MS + Math.random() * 700, () => botSchiessen(raum, ctx));
  else if (ms) planen(raum, ms, () => botSchiessen(raum, ctx, true)); // Zeit um: der Computer schießt für dich
  else planen(raum, null);
  ctx.sende(raum);
}
function naechster(raum, ctx) {
  const d = raum.daten;
  const alle = d.reihenfolge;
  let i = alle.indexOf(d.dran);
  for (let n = 0; n < alle.length; n++) {
    i = (i + 1) % alle.length;
    if (!d.raus.includes(alle[i])) { d.dran = alle[i]; break; }
  }
  zugStarten(raum, ctx);
}

function schiessen(raum, ctx, von, auf, x, y) {
  const d = raum.daten;
  if (d.phase !== "kampf" || d.dran !== von || d.wartet) return "Gerade nicht.";
  if (von === auf || d.raus.includes(auf) || !d.flotten[auf]) return "Ungültiges Ziel.";
  if (![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < N)) return;
  const brett = d.schuesse[auf];
  if (brett[k(x, y)]) return "Da hast du schon hingeschossen.";
  const ziel = d.flotten[auf];
  const schiff = ziel.schiffe.find((s) => s.felder.some(([a, b]) => a === x && b === y));
  const st = d.stats[von];
  st.schuesse++;
  let ergebnis = "wasser";
  if (schiff) {
    schiff.treffer.push(k(x, y));
    st.treffer++;
    punkte(raum, von, 10);
    ergebnis = "treffer";
    brett[k(x, y)] = "t";
    if (schiff.treffer.length >= schiff.laenge) {
      schiff.versenkt = true;
      ergebnis = "versenkt";
      st.versenkt++;
      punkte(raum, von, 30);
      schiff.felder.forEach(([a, b]) => (brett[k(a, b)] = "v"));
      // Felder rund um ein versenktes Schiff sind sicher Wasser (ohne „berühren“-Regel)
      if (!einst(raum).beruehren) for (const [a, b] of schiff.felder) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const xx = a + dx, yy = b + dy;
        if (xx >= 0 && yy >= 0 && xx < N && yy < N && !brett[k(xx, yy)]) brett[k(xx, yy)] = "r";
      }
    }
  } else brett[k(x, y)] = "w";
  d.schussNr++;
  d.letzter = { nr: d.schussNr, von, auf, x, y, ergebnis, typ: schiff?.typ || null, name: ergebnis === "versenkt" ? schiff.name : null, felder: ergebnis === "versenkt" ? schiff.felder : null };
  d.verlauf.unshift({ von, auf, ergebnis, name: d.letzter.name });
  d.verlauf.length = Math.min(d.verlauf.length, 12);
  // Ausgeschieden?
  if (!lebt(d, auf)) {
    d.raus.push(auf);
    d.letzter.raus = auf;
  }
  // Pause für die Animation, dann geht es weiter
  d.wartet = true;
  planen(raum, NACH_SCHUSS_MS + (ergebnis === "versenkt" ? 900 : 0), () => {
    d.wartet = false;
    if (imSpiel(d).length <= 1) return ende(raum, ctx);
    if (ergebnis !== "wasser" && einst(raum).nochmal) zugStarten(raum, ctx);
    else naechster(raum, ctx);
  });
  ctx.sende(raum);
}
function punkte(raum, id, p) {
  const d = raum.daten;
  d.punkte[id] = (d.punkte[id] || 0) + p;
  const b = d.bots.find((x) => x.id === id);
  if (b) b.punkte = d.punkte[id];
  else if (raum.spieler[id]) raum.spieler[id].punkte = d.punkte[id];
}
function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  // Platzierung: Sieger zuerst, dann rückwärts in der Reihenfolge des Ausscheidens
  const platz = [...imSpiel(d), ...[...d.raus].reverse()];
  platz.forEach((id, i) => punkte(raum, id, PLATZ_PUNKTE[i] || 0));
  d.platz = platz;
  d.phase = "ende";
  d.endetUm = null;
  ctx.sende(raum);
}

// ---------- Computer ----------
// einfach: zufällig, mittel: jagt angeschossene Schiffe, schwer: zusätzlich Wahrscheinlichkeitskarte
function botSchiessen(raum, ctx, fuerMensch = false) {
  const d = raum.daten;
  if (d.phase !== "kampf" || d.wartet) return;
  const von = d.dran;
  const stufe = fuerMensch ? "einfach" : einst(raum).stufe || "mittel";
  const gegner = imSpiel(d).filter((id) => id !== von);
  // Ziel: wer angeschossene, nicht versenkte Schiffe hat, sonst der Stärkste
  const offeneTreffer = (id) => Object.entries(d.schuesse[id]).filter(([, v]) => v === "t").length;
  let auf = d.ziel[von];
  if (!fuerMensch) auf = [...gegner].sort((a, b) => offeneTreffer(b) - offeneTreffer(a) || (d.punkte[b] || 0) - (d.punkte[a] || 0))[0];
  const [x, y] = botFeld(d, auf, stufe, einst(raum).beruehren);
  schiessen(raum, ctx, von, auf, x, y);
}
function botFeld(d, auf, stufe, beruehren) {
  const brett = d.schuesse[auf];
  const frei = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!brett[k(x, y)]) frei.push([x, y]);
  const zufall = () => frei[Math.floor(Math.random() * frei.length)];
  if (stufe === "einfach" && Math.random() < 0.6) return zufall();
  // Jagd: an angeschossenen Feldern weitermachen, in Linie bevorzugt
  const treffer = Object.entries(brett).filter(([, v]) => v === "t").map(([s]) => s.split(",").map(Number));
  if (treffer.length) {
    const kandidaten = new Map();
    for (const [a, b] of treffer) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = a + dx, y = b + dy;
      if (x < 0 || y < 0 || x >= N || y >= N || brett[k(x, y)]) continue;
      // in einer Linie mit einem zweiten Treffer: viel wahrscheinlicher
      const linie = brett[k(a - dx, b - dy)] === "t" ? 5 : 1;
      kandidaten.set(k(x, y), (kandidaten.get(k(x, y)) || 0) + linie);
    }
    if (kandidaten.size) {
      const best = Math.max(...kandidaten.values());
      const liste = [...kandidaten].filter(([, w]) => w === best).map(([s]) => s.split(",").map(Number));
      if (stufe !== "einfach" || Math.random() < 0.5) return liste[Math.floor(Math.random() * liste.length)];
    }
  }
  if (stufe !== "schwer") {
    // Schachbrettmuster: jedes zweite Feld reicht, um alle Schiffe zu finden
    const muster = frei.filter(([x, y]) => (x + y) % 2 === 0);
    return (muster.length && Math.random() < 0.8 ? muster : frei)[Math.floor(Math.random() * (muster.length && Math.random() < 0.8 ? muster.length : frei.length))] || zufall();
  }
  // Wahrscheinlichkeitskarte über alle noch schwimmenden Schiffslängen
  const rest = d.flotten[auf].schiffe.filter((s) => !s.versenkt).map((s) => s.laenge);
  const w = new Map();
  for (const L of rest) for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (const quer of [true, false]) {
    const f = felderVon(x, y, L, quer);
    if (f.some(([a, b]) => a >= N || b >= N || ["w", "v", "r"].includes(brett[k(a, b)]))) continue;
    for (const [a, b] of f) if (!brett[k(a, b)]) w.set(k(a, b), (w.get(k(a, b)) || 0) + 1);
  }
  if (!w.size) return zufall();
  const best = Math.max(...w.values());
  const liste = [...w].filter(([, v]) => v >= best * 0.92).map(([s]) => s.split(",").map(Number));
  return liste[Math.floor(Math.random() * liste.length)];
}

module.exports = {
  standardEinstellungen: () => ({ bots: 1, sekunden: 30, nochmal: true, beruehren: false }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(3, Math.max(0, parseInt(e.bots) || 0));
    if (e.sekunden !== undefined) neu.sekunden = [15, 30, 0].includes(+e.sekunden) ? +e.sekunden : 30;
    if (e.nochmal !== undefined) neu.nochmal = !!e.nochmal;
    if (e.beruehren !== undefined) neu.beruehren = !!e.beruehren;
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online && !s.zuschauer).slice(0, 4);
    if (!menschen.length) return "Niemand da.";
    let botAnzahl = Math.min(e.bots, 4 - menschen.length);
    if (menschen.length + botAnzahl < 2) botAnzahl = 2 - menschen.length;
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    raum.daten = {
      phase: "aufstellen", reihenfolge, bots, raus: [], dran: null, ziel: {}, wartet: false,
      flotten: Object.fromEntries(reihenfolge.map((id) => [id, { schiffe: null, bereit: false }])),
      schuesse: Object.fromEntries(reihenfolge.map((id) => [id, {}])),
      stats: Object.fromEntries(reihenfolge.map((id) => [id, { schuesse: 0, treffer: 0, versenkt: 0 }])),
      punkte: Object.fromEntries(reihenfolge.map((id) => [id, 0])),
      letzter: null, verlauf: [], schussNr: 0, timer: null, planNr: 0, endetUm: null, platz: null,
    };
    for (const b of bots) raum.daten.flotten[b.id] = { schiffe: gueltig(zufallsFlotte(e.beruehren), e.beruehren), bereit: true };
    planen(raum, AUFSTELL_MS, () => kampfStarten(raum, ctx));
  },
  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d || !d.reihenfolge.includes(spielerId)) return;
    const e = einst(raum);
    if (typ === "aufstellen" && d.phase === "aufstellen") {
      const schiffe = gueltig(daten, e.beruehren);
      if (!schiffe) return "Die Aufstellung passt nicht: Schiffe müssen ganz aufs Feld und dürfen sich nicht berühren.";
      d.flotten[spielerId] = { schiffe, bereit: true };
      flotteSenden(raum, ctx, spielerId);
      if (d.reihenfolge.every((id) => d.flotten[id].bereit || (!istBot(d, id) && !raum.spieler[id]?.online))) planen(raum, 1200, () => kampfStarten(raum, ctx));
      return ctx.sende(raum);
    }
    if (typ === "nichtBereit" && d.phase === "aufstellen") { d.flotten[spielerId].bereit = false; flotteSenden(raum, ctx, spielerId); return ctx.sende(raum); }
    if (typ === "ziel" && d.phase === "kampf" && imSpiel(d).includes(daten) && daten !== spielerId) { d.ziel[spielerId] = daten; return ctx.sende(raum); }
    if (typ === "schuss" && d.phase === "kampf") return schiessen(raum, ctx, spielerId, daten?.auf, parseInt(daten?.x), parseInt(daten?.y));
  },
  spielerZurueck(raum, id, ctx) { if (raum.daten) flotteSenden(raum, ctx, id); },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (d.phase === "aufstellen" && d.reihenfolge.filter((x) => !istBot(d, x)).every((x) => d.flotten[x].bereit || !raum.spieler[x]?.online)) planen(raum, 1200, () => kampfStarten(raum, ctx));
    if (d.phase === "kampf" && d.dran === id && !d.wartet) planen(raum, BOT_ZUG_MS, () => botSchiessen(raum, ctx, true));
  },
  spielerInfo: () => ({}),
  // Öffentlich: Schüsse und versenkte Schiffe. Die eigene Flotte kommt privat (sv:flotte).
  // Am Ende werden alle Flotten aufgedeckt.
  ansicht(raum) {
    const d = raum.daten;
    const flotten = {};
    for (const id of d.reihenfolge) {
      const f = d.flotten[id];
      const eigen = d.phase === "ende";
      flotten[id] = {
        bereit: f.bereit,
        schiffe: (f.schiffe || []).filter((s) => eigen || s.versenkt).map((s) => ({ typ: s.typ, name: s.name, laenge: s.laenge, x: s.x, y: s.y, quer: s.quer, versenkt: s.versenkt, treffer: s.treffer.length })),
        rest: (f.schiffe || FLOTTE).filter((s) => !s.versenkt).map((s) => s.typ),
      };
    }
    const tn = d.reihenfolge.map((id) => {
      const b = d.bots.find((x) => x.id === id);
      const s = raum.spieler[id];
      return { id, bot: !!b, name: b ? b.name : s?.name || "Weg", avatar: b ? b.avatar : s?.avatar || "👻", online: b ? true : !!s?.online, raus: d.raus.includes(id) };
    });
    return {
      phase: d.phase, n: N, flotteInfo: FLOTTE, teilnehmer: tn, dran: d.dran, ziel: d.ziel, wartet: d.wartet,
      flotten, schuesse: d.schuesse, letzter: d.letzter, verlauf: d.verlauf, stats: d.stats, punkte: d.punkte, raus: d.raus, platz: d.platz,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden, nochmal: einst(raum).nochmal, beruehren: einst(raum).beruehren,
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
    };
  },
  // für Tests
  _intern: { gueltig, zufallsFlotte, botFeld, FLOTTE },
};
