// =============================================================
//  Spiel-Modul: Würfelglück (Würfelspiel mit 5 Würfeln und Punkteblock)
//  - Pro Zug bis zu 3 Würfe, Würfel dürfen festgehalten werden
//  - Danach muss ein freies Feld eingetragen (oder gestrichen = 0) werden
//  - 13 Felder: Einser–Sechser (Bonus 35 ab 63), Dreierpasch, Viererpasch,
//    Full House (25), Kleine Straße (30), Große Straße (40), Fünfling (50), Chance
//  - Jeder weitere Fünfling bringt 50 Bonuspunkte
// =============================================================
const MAX_TEILNEHMER = 8;
const BOT_PAUSE = [3000, 3600]; // Zeit zwischen den Würfen der Computer: die Wurf-Animation dauert gut 2,5 s
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" }, { name: "Fritzi Frosch", avatar: "🐸" }, { name: "Theo Tiger", avatar: "🐯" },
];
const OBEN = ["einser", "zweier", "dreier", "vierer", "fuenfer", "sechser"];
const UNTEN = ["dreierpasch", "viererpasch", "fullhouse", "kleinestrasse", "grossestrasse", "fuenfling", "chance"];
const FELDER = [...OBEN, ...UNTEN];

const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const w6 = () => 1 + Math.floor(Math.random() * 6);
const einst = (raum) => raum.einstellungen.wuerfel;

// Punkte, die diese Würfel in einem Feld bringen würden
function punkte(feld, w) {
  const anz = [0, 0, 0, 0, 0, 0, 0];
  for (const x of w) anz[x]++;
  const summe = w.reduce((a, b) => a + b, 0);
  const max = Math.max(...anz);
  const hat = (...z) => z.every((x) => anz[x] > 0);
  const i = OBEN.indexOf(feld);
  if (i >= 0) return anz[i + 1] * (i + 1);
  switch (feld) {
    case "dreierpasch": return max >= 3 ? summe : 0;
    case "viererpasch": return max >= 4 ? summe : 0;
    case "fullhouse": return (anz.includes(3) && anz.includes(2)) || max === 5 ? 25 : 0;
    case "kleinestrasse": return hat(1, 2, 3, 4) || hat(2, 3, 4, 5) || hat(3, 4, 5, 6) ? 30 : 0;
    case "grossestrasse": return hat(1, 2, 3, 4, 5) || hat(2, 3, 4, 5, 6) ? 40 : 0;
    case "fuenfling": return max === 5 ? 50 : 0;
    case "chance": return summe;
  }
  return 0;
}

function summen(blatt, extra = 0) {
  const oben = OBEN.reduce((a, f) => a + (blatt[f] || 0), 0);
  const bonus = oben >= 63 ? 35 : 0;
  const unten = UNTEN.reduce((a, f) => a + (blatt[f] || 0), 0);
  return { oben, bonus, unten, extra, gesamt: oben + bonus + unten + extra };
}

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

function punkteSetzen(raum) {
  const d = raum.daten;
  for (const t of teilnehmer(raum)) {
    const p = summen(d.blaetter[t.id], d.extra[t.id]).gesamt;
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p;
    else raum.spieler[t.id].punkte = p;
  }
}

// ---------- Ablauf ----------
function zugStarten(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.zug++;
  d.wurf = 0;
  d.wuerfel = [1, 2, 3, 4, 5];
  d.gehalten = [false, false, false, false, false];
  const t = teilnehmer(raum).find((x) => x.id === d.dran);
  const sek = einst(raum).sekunden;
  d.endetUm = null;
  if (!t || t.bot) d.timer = setTimeout(() => botZug(raum, ctx), 900);
  else {
    let warten = !t.online ? 6000 : t.afk ? 2500 : sek ? sek * 1000 : null;
    if (warten) { d.endetUm = Date.now() + warten; d.timer = setTimeout(() => automatisch(raum, ctx), warten); }
  }
  ctx.sende(raum);
}

function wuerfeln(raum, ctx, id) {
  const d = raum.daten;
  if (d.phase !== "spielen" || d.dran !== id || d.wurf >= 3) return "Du hast schon dreimal gewürfelt.";
  if (d.wurf > 0 && d.gehalten.every(Boolean)) return "Alle Würfel sind festgehalten.";
  d.wuerfel = d.wuerfel.map((x, i) => (d.gehalten[i] && d.wurf > 0 ? x : w6()));
  d.wurf++;
  d.wurfId = (d.wurfId || 0) + 1;
  d.letzteAktion = { typ: "wurf", spieler: id, wurf: d.wurf, t: Date.now() };
  if (d.wuerfel.every((x) => x === d.wuerfel[0])) d.letzteAktion.fuenfling = true;
  ctx.sende(raum);
}

function eintragen(raum, ctx, id, feld) {
  const d = raum.daten;
  if (d.phase !== "spielen" || d.dran !== id) return;
  if (!d.wurf) return "Erst würfeln!";
  const blatt = d.blaetter[id];
  if (!FELDER.includes(feld) || blatt[feld] !== null) return "Dieses Feld ist schon belegt.";
  clearTimeout(d.timer);
  const p = punkte(feld, d.wuerfel);
  // Weiterer Fünfling, wenn das Fünfling-Feld schon mit 50 belegt ist: +50 Bonus
  const fuenf = d.wuerfel.every((x) => x === d.wuerfel[0]);
  if (fuenf && blatt.fuenfling === 50) d.extra[id] += 50;
  blatt[feld] = p;
  const st = (d.statistik[id] ||= { fuenflinge: 0, strassen: 0, nullen: 0, fullhouse: 0 });
  if (fuenf) st.fuenflinge++;
  if ((feld === "kleinestrasse" || feld === "grossestrasse") && p) st.strassen++;
  if (feld === "fullhouse" && p) st.fullhouse++;
  if (!p) st.nullen++;
  d.letzteAktion = { typ: "eintragen", spieler: id, feld, punkte: p, bonusFuenfling: fuenf && feld !== "fuenfling" && blatt.fuenfling === 50, t: Date.now() };
  const vorher = summen({ ...blatt, [feld]: null }).bonus;
  if (!vorher && summen(blatt).bonus) d.letzteAktion.bonus = true;
  punkteSetzen(raum);
  if (!istBot(d, id) && raum.spieler[id]) raum.spieler[id].ohneEingabe = 0;
  // Nächster Spieler (oder Ende, wenn alle Blöcke voll sind)
  const ids = d.reihenfolge;
  if (ids.every((x) => FELDER.every((f) => d.blaetter[x][f] !== null))) return ende(raum, ctx);
  const i = ids.indexOf(id);
  d.dran = ids[(i + 1) % ids.length];
  if ((i + 1) % ids.length === 0) d.runde++;
  zugStarten(raum, ctx);
}

// Zeit abgelaufen: würfeln (falls noch nicht) und das beste freie Feld nehmen
function automatisch(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "spielen") return;
  const id = d.dran;
  const s = raum.spieler[id];
  if (s) { s.ohneEingabe = (s.ohneEingabe || 0) + 1; if (s.ohneEingabe >= 2) s.afk = true; }
  if (!d.wurf) wuerfeln(raum, ctx, id);
  eintragen(raum, ctx, id, besteFeld(d.blaetter[id], d.wuerfel));
}

// Bestes freies Feld (mit etwas Strategie: oben lieber genug für den Bonus, Fünfling/Chance nicht verschwenden)
function besteFeld(blatt, w) {
  const frei = FELDER.filter((f) => blatt[f] === null);
  const wert = (f) => {
    let p = punkte(f, w);
    const i = OBEN.indexOf(f);
    if (i >= 0) p += (p >= (i + 1) * 3 ? 12 : -4); // oben: mindestens 3 gleiche anstreben (Bonus)
    if (f === "chance") p -= 12; // Chance für später aufheben
    if (f === "fuenfling" && !punkte(f, w)) p -= 8;
    if (!punkte(f, w)) p -= ({ einser: 0, zweier: 2, fuenfling: 4, dreierpasch: 6, viererpasch: 3, grossestrasse: 6, kleinestrasse: 8, fullhouse: 7, chance: 20 })[f] ?? 10;
    return p;
  };
  return frei.sort((a, b) => wert(b) - wert(a))[0];
}

// Computer: würfeln, sinnvoll festhalten, eintragen
function botZug(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "spielen" || !istBot(d, d.dran)) return;
  const id = d.dran;
  const blatt = d.blaetter[id];
  if (d.wurf === 0) { wuerfeln(raum, ctx, id); d.timer = setTimeout(() => botZug(raum, ctx), BOT_PAUSE[0] + Math.random() * (BOT_PAUSE[1] - BOT_PAUSE[0])); return; }
  const w = d.wuerfel;
  // Schon etwas Großes? Sofort eintragen
  const sofort = ["fuenfling", "grossestrasse", "fullhouse", "kleinestrasse"].find((f) => blatt[f] === null && punkte(f, w) > 0);
  if (sofort && (sofort !== "kleinestrasse" || d.wurf === 3 || blatt.grossestrasse !== null)) return eintragen(raum, ctx, id, sofort);
  if (d.wurf >= 3) return eintragen(raum, ctx, id, besteFeld(blatt, w));
  // Festhalten: entweder auf Straße spielen oder die häufigste (hohe) Zahl
  const anz = [0, 0, 0, 0, 0, 0, 0];
  for (const x of w) anz[x]++;
  const verschiedene = new Set(w).size;
  if (verschiedene >= 4 && (blatt.grossestrasse === null || blatt.kleinestrasse === null)) {
    const gesehen = new Set();
    d.gehalten = w.map((x) => { if (gesehen.has(x) || (x === 1 && w.includes(6) && !w.includes(2))) return false; gesehen.add(x); return true; });
  } else {
    let ziel = 6;
    for (let z = 6; z >= 1; z--) if (anz[z] > anz[ziel] || (anz[z] === anz[ziel] && blatt[OBEN[z - 1]] === null && blatt[OBEN[ziel - 1]] !== null)) ziel = z;
    d.gehalten = w.map((x) => x === ziel);
  }
  if (d.gehalten.every(Boolean)) return eintragen(raum, ctx, id, besteFeld(blatt, w));
  d.letzteAktion = { typ: "halten", spieler: id, t: Date.now() };
  ctx.sende(raum);
  d.timer = setTimeout(() => { wuerfeln(raum, ctx, id); d.timer = setTimeout(() => botZug(raum, ctx), BOT_PAUSE[0] + Math.random() * (BOT_PAUSE[1] - BOT_PAUSE[0])); }, 1000);
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende";
  punkteSetzen(raum);
  const alle = teilnehmer(raum);
  const st = d.statistik;
  const liste = [];
  const beste = (f, min) => {
    const w = alle.map((t) => [t.id, f(t.id)]).filter(([, v]) => v >= min);
    if (!w.length) return null;
    const max = Math.max(...w.map(([, v]) => v));
    const ids = w.filter(([, v]) => v === max).map(([id]) => id);
    return ids.length < alle.length || alle.length === 1 ? { ids, max } : null;
  };
  let b;
  if ((b = beste((id) => st[id]?.fuenflinge || 0, 1))) liste.push({ icon: "🎲", titel: "Fünfling-Held", spieler: b.ids, text: `${b.max}× fünf Gleiche` });
  if ((b = beste((id) => summen(d.blaetter[id]).oben, 63))) liste.push({ icon: "⭐", titel: "Bonusjäger", spieler: b.ids, text: `${b.max} Punkte oben (Bonus geschafft)` });
  if ((b = beste((id) => st[id]?.strassen || 0, 2))) liste.push({ icon: "🛣️", titel: "Straßenkönig", spieler: b.ids, text: `${b.max} Straßen gewürfelt` });
  if ((b = beste((id) => d.blaetter[id].chance || 0, 25))) liste.push({ icon: "🍀", titel: "Glückspilz", spieler: b.ids, text: `${b.max} Punkte in der Chance` });
  if ((b = beste((id) => st[id]?.nullen || 0, 3)) && alle.length > 1) liste.push({ icon: "🙈", titel: "Pechvogel", spieler: b.ids, text: `${b.max} Felder gestrichen` });
  d.auszeichnungen = liste.slice(0, 6);
  d.letzteAktion = { typ: "ende", t: Date.now() };
  ctx.sende(raum);
}

// ---------- Schnittstelle ----------
module.exports = {
  meta: () => ({ felder: FELDER, oben: OBEN, unten: UNTEN, max: MAX_TEILNEHMER }),
  standardEinstellungen: () => ({ bots: 1, sekunden: 60 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(7, Math.max(0, parseInt(e.bots) || 0));
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = s === 0 ? 0 : Math.min(120, Math.max(20, s || 60)); }
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > MAX_TEILNEHMER) return `Würfelglück geht mit höchstens ${MAX_TEILNEHMER} Spielern.`;
    const botAnzahl = Math.min(e.bots, MAX_TEILNEHMER - menschen.length);
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    raum.daten = {
      bots, reihenfolge, dran: reihenfolge[0], runde: 1, zug: 0, wurf: 0, wurfId: 0,
      wuerfel: [1, 2, 3, 4, 5], gehalten: [false, false, false, false, false],
      blaetter: Object.fromEntries(reihenfolge.map((id) => [id, Object.fromEntries(FELDER.map((f) => [f, null]))])),
      extra: Object.fromEntries(reihenfolge.map((id) => [id, 0])),
      statistik: {}, timer: null, phase: "spielen", auszeichnungen: [],
    };
    zugStarten(raum, ctx);
  },
  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (d.phase !== "spielen" || d.dran !== spielerId) return;
    if (typ === "wuerfeln") return wuerfeln(raum, ctx, spielerId) || undefined;
    if (typ === "halten") {
      const i = parseInt(daten);
      if (!d.wurf || d.wurf >= 3 || !(i >= 0 && i < 5)) return;
      d.gehalten[i] = !d.gehalten[i];
      ctx.sende(raum);
      return;
    }
    if (typ === "eintragen") return eintragen(raum, ctx, spielerId, String(daten)) || undefined;
  },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase !== "spielen") return;
    if (!raum.spieler[id] && d.reihenfolge.includes(id)) {
      const warDran = d.dran === id;
      const i = d.reihenfolge.indexOf(id);
      d.reihenfolge = d.reihenfolge.filter((x) => x !== id);
      delete d.blaetter[id];
      if (!d.reihenfolge.length) return;
      if (d.reihenfolge.every((x) => FELDER.every((f) => d.blaetter[x][f] !== null))) return ende(raum, ctx);
      if (warDran) { d.dran = d.reihenfolge[i % d.reihenfolge.length]; zugStarten(raum, ctx); }
      return;
    }
    if (d.dran === id) { d.zug--; zugStarten(raum, ctx); }
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    return {
      phase: d.phase, dran: d.dran, runde: d.runde, zug: d.zug, wurf: d.wurf, wurfId: d.wurfId,
      wuerfel: d.wuerfel, gehalten: d.gehalten,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden,
      blaetter: d.blaetter, extra: d.extra,
      summen: Object.fromEntries(d.reihenfolge.map((id) => [id, summen(d.blaetter[id], d.extra[id])])),
      vorschau: d.wurf ? Object.fromEntries(FELDER.map((f) => [f, punkte(f, d.wuerfel)])) : null,
      teilnehmer: teilnehmer(raum),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      letzteAktion: d.letzteAktion || null,
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
  _intern: { punkte, summen, FELDER },
};
