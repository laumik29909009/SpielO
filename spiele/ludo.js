// =============================================================
//  Spiel-Modul: Raus da! (Würfel-Laufspiel nach den klassischen Regeln)
//  - 2–4 Farben, je 4 Figuren. Mit einer 6 kommt eine Figur aus dem Haus auf das Startfeld.
//  - Bei einer 6 darf man nochmal würfeln. Sind alle Figuren im Haus (oder fest im Ziel): 3 Versuche.
//  - Das eigene Startfeld muss geräumt werden, solange noch Figuren im Haus sind.
//  - Wer auf eine fremde Figur zieht, schlägt sie: Sie muss zurück ins Haus.
//  - Im Ziel wird genau gezogen und nicht übersprungen.
//  - Gewonnen hat, wer zuerst alle 4 Figuren im Ziel hat.
//  Positionen je Figur relativ zur eigenen Farbe: -1 = Haus, 0–39 = Laufbahn, 40–43 = Ziel.
// =============================================================
const { randomInt } = require("crypto");
const MAX = 4;
const FARBEN = ["rot", "blau", "gruen", "gelb"];
const BOT_PAUSE = 1400;
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" },
];
const w6 = () => randomInt(1, 7);
const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const einst = (raum) => raum.einstellungen.ludo;
const absolut = (slot, rel) => (slot * 10 + rel) % 40;

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

// Wer steht auf einem Feld der Laufbahn (absolut)?
function belegtVon(d, abs) {
  for (const id of d.reihenfolge) {
    const slot = d.slot[id];
    const k = d.figuren[id].findIndex((r) => r >= 0 && r < 40 && absolut(slot, r) === abs);
    if (k >= 0) return { id, k };
  }
  return null;
}

// Alle erlaubten Züge mit Wurf w
function zuege(d, id, w) {
  const f = d.figuren[id], slot = d.slot[id];
  const eigene = (rel) => f.some((r) => r === rel);
  const liste = [];
  f.forEach((r, k) => {
    let ziel = null;
    if (r === -1) { if (w === 6 && !eigene(0)) ziel = 0; }
    else {
      const t = r + w;
      if (t > 43) return;
      // Im Ziel nicht überspringen, nicht auf eigene Figuren
      for (let x = Math.max(r + 1, 40); x <= t; x++) if (eigene(x)) return;
      if (t < 40 && eigene(t)) return;
      ziel = t;
    }
    if (ziel === null) return;
    let schlaegt = null;
    if (ziel < 40) { const b = belegtVon(d, absolut(slot, ziel)); if (b && b.id !== id) schlaegt = b; }
    liste.push({ k, von: r, nach: ziel, schlaegt });
  });
  // Pflichten: mit einer 6 raus, solange das Startfeld frei ist; Startfeld räumen, solange noch Figuren im Haus sind
  const imHaus = f.some((r) => r === -1);
  const raus = liste.filter((z) => z.von === -1);
  if (imHaus && raus.length) return raus;
  const vomStart = liste.filter((z) => z.von === 0);
  if (imHaus && eigene(0) && vomStart.length) return vomStart;
  if (einst2(d).schlagzwang) { const s = liste.filter((z) => z.schlaegt); if (s.length) return s; }
  return liste;
}
const einst2 = (d) => d.regeln || {};
// Darf dreimal würfeln? (keine Figur auf der Laufbahn und keine im Ziel beweglich)
function dreiVersuche(d, id) {
  const f = d.figuren[id];
  if (f.some((r) => r >= 0 && r < 40)) return false;
  // Figuren im Ziel, die noch nachrücken könnten, zählen als beweglich
  const ziel = f.filter((r) => r >= 40).sort((a, b) => b - a);
  return ziel.every((r, i) => r === 43 - i);
}

function aktion(d, a) { d.aktionNr = (d.aktionNr || 0) + 1; d.letzteAktion = { ...a, nr: d.aktionNr, t: Date.now() }; }
function log(d, text) { d.log.push(text); if (d.log.length > 20) d.log.shift(); }

function zugStarten(raum, ctx) {
  const d = raum.daten;
  d.schritt = "wuerfeln"; d.wurf = null; d.moeglich = []; d.zugNr++;
  d.versuche = dreiVersuche(d, d.dran) ? 3 : 1;
  planen(raum, ctx);
  ctx.sende(raum);
}
function planen(raum, ctx, extra = 0) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const id = d.dran;
  const t = teilnehmer(raum).find((x) => x.id === id);
  const sek = einst(raum).sekunden;
  let warten = null;
  if (!t || t.bot) warten = BOT_PAUSE + extra + Math.random() * 400;
  else if (!t.online) warten = 4000 + extra;
  else if (t.afk) warten = 1800 + extra;
  else if (sek) warten = sek * 1000 + extra;
  d.endetUm = warten && t && !t.bot ? Date.now() + warten : null;
  const nr = (d.planNr = (d.planNr || 0) + 1); // veraltete Timer tun nichts
  if (warten) d.timer = setTimeout(() => {
    if (nr !== d.planNr) return;
    const s = raum.spieler[id];
    if (s && !t?.bot) { s.ohneEingabe = (s.ohneEingabe || 0) + 1; if (s.ohneEingabe >= 2) s.afk = true; }
    bot(raum, ctx, id);
  }, warten);
}

function wuerfeln(raum, ctx, id) {
  const d = raum.daten;
  const w = w6();
  d.wurf = w; d.wurfNr++;
  (d.statistik[id] ||= {}).sechser = (d.statistik[id].sechser || 0) + (w === 6 ? 1 : 0);
  d.moeglich = zuege(d, id, w);
  aktion(d, { typ: "wurf", spieler: id, wurf: w });
  if (!d.moeglich.length) {
    d.versuche--;
    if (d.versuche > 0) { log(d, `${name(raum, id)} würfelt eine ${w} – noch ${d.versuche} Versuch${d.versuche > 1 ? "e" : ""}.`); d.wurf = w; d.schritt = "wuerfeln"; planen(raum, ctx, 900); return ctx.sende(raum); }
    log(d, `${name(raum, id)} würfelt eine ${w} und kann nicht ziehen.`);
    d.schritt = "nichts";
    ctx.sende(raum);
    clearTimeout(d.timer);
    const nr = (d.planNr = (d.planNr || 0) + 1);
    d.timer = setTimeout(() => nr === d.planNr && weiter(raum, ctx, false), 1300);
    return;
  }
  d.schritt = "ziehen";
  // Nur ein Zug möglich: nach kurzer Pause automatisch
  planen(raum, ctx, 900);
  if (d.moeglich.length === 1 && !istBot(d, id)) { clearTimeout(d.timer); const nr = (d.planNr = (d.planNr || 0) + 1); d.timer = setTimeout(() => nr === d.planNr && d.schritt === "ziehen" && ziehen(raum, ctx, id, d.moeglich[0].k), 1100); }
  ctx.sende(raum);
}

function ziehen(raum, ctx, id, k) {
  const d = raum.daten;
  if (d.schritt !== "ziehen" || d.dran !== id) return;
  const z = d.moeglich.find((x) => x.k === k);
  if (!z) return "Diese Figur kann nicht ziehen.";
  clearTimeout(d.timer);
  d.figuren[id][k] = z.nach;
  const st = (d.statistik[id] ||= {});
  let geschlagen = null;
  if (z.schlaegt) {
    d.figuren[z.schlaegt.id][z.schlaegt.k] = -1;
    geschlagen = z.schlaegt;
    st.geschlagen = (st.geschlagen || 0) + 1;
    (d.statistik[z.schlaegt.id] ||= {}).rausgeflogen = (d.statistik[z.schlaegt.id].rausgeflogen || 0) + 1;
    log(d, `💥 ${name(raum, id)} schlägt ${name(raum, z.schlaegt.id)}!`);
  }
  if (z.nach >= 40 && z.von < 40) { st.imZiel = (st.imZiel || 0) + 1; log(d, `🏠 ${name(raum, id)} bringt eine Figur ins Ziel.`); }
  aktion(d, { typ: "zug", spieler: id, k, von: z.von, nach: z.nach, wurf: d.wurf, geschlagen });
  d.moeglich = [];
  d.schritt = "laeuft";
  ctx.sende(raum);
  // Gewonnen?
  if (d.figuren[id].every((r) => r >= 40)) {
    d.fertig.push(id);
    log(d, `🏆 ${name(raum, id)} hat alle Figuren im Ziel!`);
    d.planNr = (d.planNr || 0) + 1;
    return setTimeout(() => d.phase === "spielen" && ende(raum, ctx), 1600);
  }
  const nochmal = d.wurf === 6;
  // Warten, bis die Figur gelaufen ist
  const lauf = (z.von === -1 ? 1 : d.wurf) * 180 + 500;
  const nr = (d.planNr = (d.planNr || 0) + 1);
  d.timer = setTimeout(() => nr === d.planNr && weiter(raum, ctx, nochmal), lauf);
}

function weiter(raum, ctx, nochmal) {
  const d = raum.daten;
  if (d.phase !== "spielen") return;
  if (!nochmal) {
    const i = d.reihenfolge.indexOf(d.dran);
    d.dran = d.reihenfolge[(i + 1) % d.reihenfolge.length];
  } else log(d, `🎲 ${name(raum, d.dran)} hat eine 6 und darf nochmal.`);
  zugStarten(raum, ctx);
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende";
  // Platzierung: Sieger zuerst, dann nach Fortschritt
  const fortschritt = (id) => d.figuren[id].reduce((a, r) => a + (r < 0 ? 0 : r + 1), 0);
  d.platzierung = [...d.fertig, ...d.reihenfolge.filter((id) => !d.fertig.includes(id)).sort((a, b) => fortschritt(b) - fortschritt(a))];
  const n = d.platzierung.length;
  for (const t of teilnehmer(raum)) {
    const p = (n - d.platzierung.indexOf(t.id)) * 10 + Math.round(fortschritt(t.id) / 4);
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p; else if (raum.spieler[t.id]) raum.spieler[t.id].punkte = p;
  }
  const st = d.statistik, alle = teilnehmer(raum), liste = [];
  const beste = (f, min) => { const w = alle.map((t) => [t.id, f(st[t.id] || {})]).filter(([, v]) => v >= min); if (!w.length) return null; const m = Math.max(...w.map(([, v]) => v)); return { ids: w.filter(([, v]) => v === m).map(([id]) => id), max: m }; };
  let b;
  if ((b = beste((s) => s.geschlagen || 0, 1))) liste.push({ icon: "💥", titel: "Rausschmeißer", spieler: b.ids, text: `${b.max}× geschlagen` });
  if ((b = beste((s) => s.rausgeflogen || 0, 2))) liste.push({ icon: "😤", titel: "Pechvogel", spieler: b.ids, text: `${b.max}× rausgeflogen` });
  if ((b = beste((s) => s.sechser || 0, 3))) liste.push({ icon: "🎲", titel: "Sechser-König", spieler: b.ids, text: `${b.max} Sechsen gewürfelt` });
  d.auszeichnungen = liste;
  ctx.sende(raum);
}

// Computer: bewertet jeden möglichen Zug
function bot(raum, ctx, id) {
  const d = raum.daten;
  if (d.phase !== "spielen" || d.dran !== id) return;
  if (d.schritt === "wuerfeln") return wuerfeln(raum, ctx, id);
  if (d.schritt !== "ziehen" || !d.moeglich.length) return;
  const stufe = einst(raum).stufe || "mittel";
  if (!istBot(d, id) || (stufe === "einfach" && Math.random() < 0.45)) return ziehen(raum, ctx, id, d.moeglich[Math.floor(Math.random() * d.moeglich.length)].k);
  const slot = d.slot[id];
  // Ist ein Feld bedroht? (fremde Figur 1–6 Felder dahinter)
  const bedroht = (rel) => {
    if (rel < 0 || rel >= 40) return false;
    const abs = absolut(slot, rel);
    return d.reihenfolge.some((o) => o !== id && d.figuren[o].some((r) => r >= 0 && r < 40 && ((abs - absolut(d.slot[o], r) + 40) % 40) >= 1 && ((abs - absolut(d.slot[o], r) + 40) % 40) <= 6));
  };
  const wert = (z) => {
    let w = z.nach - Math.max(0, z.von) * 0.2;
    if (z.schlaegt) w += 60;
    if (z.von === -1) w += 35;
    if (z.nach >= 40 && z.von < 40) w += 40;
    if (bedroht(z.von)) w += 22;
    if (bedroht(z.nach)) w -= stufe === "schwer" ? 30 : 18;
    if (z.nach === 0) w -= 5;
    return w + Math.random() * (stufe === "schwer" ? 1 : 6);
  };
  const best = [...d.moeglich].sort((a, b) => wert(b) - wert(a))[0];
  ziehen(raum, ctx, id, best.k);
}

module.exports = {
  meta: () => ({ max: MAX, farben: FARBEN }),
  standardEinstellungen: () => ({ bots: 3, sekunden: 30, schlagzwang: false }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(3, Math.max(0, parseInt(e.bots) || 0));
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = s === 0 ? 0 : Math.min(60, Math.max(15, s || 30)); }
    if (e.schlagzwang !== undefined) neu.schlagzwang = !!e.schlagzwang;
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > MAX) return `Raus da! geht mit höchstens ${MAX} Spielern.`;
    let botAnzahl = Math.min(e.bots, MAX - menschen.length);
    if (menschen.length + botAnzahl < 2) botAnzahl = 2 - menschen.length;
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    // Bei zwei Spielern sitzen sie sich gegenüber
    const plaetze = reihenfolge.length === 2 ? [0, 2] : reihenfolge.length === 3 ? [0, 1, 2] : [0, 1, 2, 3];
    raum.daten = {
      bots, reihenfolge, dran: reihenfolge[0], zugNr: 0, wurfNr: 0, wurf: null, versuche: 1, moeglich: [], schritt: "wuerfeln",
      slot: Object.fromEntries(reihenfolge.map((id, i) => [id, plaetze[i]])),
      figuren: Object.fromEntries(reihenfolge.map((id) => [id, [-1, -1, -1, -1]])),
      regeln: { schlagzwang: e.schlagzwang }, fertig: [], log: ["Los geht's! Mit einer 6 kommst du raus."], statistik: {}, timer: null, phase: "spielen", auszeichnungen: [],
    };
    zugStarten(raum, ctx);
  },
  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d || d.phase !== "spielen" || d.dran !== spielerId) return;
    if (raum.spieler[spielerId]) raum.spieler[spielerId].ohneEingabe = 0;
    if (typ === "wuerfeln" && d.schritt === "wuerfeln") return void wuerfeln(raum, ctx, spielerId);
    if (typ === "ziehen" && d.schritt === "ziehen") { const f = ziehen(raum, ctx, spielerId, parseInt(daten)); return typeof f === "string" ? f : undefined; }
  },
  spielerZurueck() {},
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase !== "spielen") return;
    if (!raum.spieler[id] && d.reihenfolge.includes(id)) {
      // Figuren verschwinden, der Platz bleibt frei
      const war = d.dran === id;
      const i = d.reihenfolge.indexOf(id);
      d.reihenfolge = d.reihenfolge.filter((x) => x !== id);
      delete d.figuren[id];
      if (d.reihenfolge.length < 2) { if (d.reihenfolge[0]) d.fertig.push(d.reihenfolge[0]); return ende(raum, ctx); }
      if (war) { d.dran = d.reihenfolge[i % d.reihenfolge.length]; zugStarten(raum, ctx); }
      return;
    }
    if (d.dran === id) planen(raum, ctx);
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    return {
      phase: d.phase, dran: d.dran, zugNr: d.zugNr, wurfNr: d.wurfNr, wurf: d.wurf, versuche: d.versuche, schritt: d.schritt,
      moeglich: d.moeglich.map((z) => ({ k: z.k, nach: z.nach, schlaegt: !!z.schlaegt })),
      slot: d.slot, figuren: d.figuren, log: d.log.slice(-6), letzteAktion: d.letzteAktion || null,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden,
      teilnehmer: teilnehmer(raum),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      platzierung: d.platzierung || null, auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
  _intern: { zuege, absolut },
};
