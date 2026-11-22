// =============================================================
//  Spiel-Modul: Knaben von Schechingen (Aufbau & Handel)
//  Eigenes Aufbau- und Handelsspiel auf einer Sechseck-Karte rund um
//  den Dorfplatz von Schechingen.
//  - 5 Rohstoffe: Holz (Wald), Stein (Steinbruch), Korn (Feld), Milch (Weide), Obst (Streuobstwiese)
//  - Höfe (1 Punkt), Gutshöfe (2), Wege, 25 Dorfkarten
//  - Dorfplatz in der Mitte: Marktrecht 3:1, optional Gemeinschaftsbauten (je 2 Punkte)
//  - Optional Jahreszeiten: jede Runde eine andere Landschaft doppelt (Winter: Felder ruhen)
//  - Bei einer 7 zieht ein Gewitter auf: Wer viele Karten hat, verliert die Hälfte
// =============================================================
const MAX_TEILNEHMER = 4;
const BOT_PAUSE = 900;
const BOTS = [
  { name: "Bauer Bert", avatar: "👨‍🌾" }, { name: "Müllerin Mia", avatar: "👩‍🌾" }, { name: "Schmied Sepp", avatar: "🧔" }, { name: "Wirtin Wally", avatar: "👵" },
];
const FARBEN = ["#e8524a", "#3d7dff", "#f2b33d", "#3fbf72"];
const ROH = ["holz", "stein", "korn", "milch", "obst"];
const LAND = { wald: "holz", steinbruch: "stein", feld: "korn", weide: "milch", obstwiese: "obst" };
// Eigene Baukosten
const KOSTEN = {
  weg: { holz: 1, stein: 1 },
  hof: { holz: 1, korn: 1, milch: 1, obst: 1 },
  gut: { stein: 3, obst: 2 },
  karte: { korn: 1, milch: 1, obst: 1 },
};
const GEMEIN = {
  brunnen: { name: "Dorfbrunnen", icon: "⛲", kosten: { stein: 3, milch: 1, holz: 1 } },
  wirtshaus: { name: "Wirtshaus", icon: "🍺", kosten: { korn: 2, obst: 2, milch: 1 } },
  kirche: { name: "Kirche", icon: "⛪", kosten: { stein: 3, holz: 2 } },
  rathaus: { name: "Rathaus", icon: "🏛️", kosten: { holz: 2, stein: 1, korn: 1, obst: 1 } },
};
// Jahreszeiten (optional): welche Landschaft doppelt bzw. gar nichts bringt
const SAISON = [
  { name: "Frühling", icon: "🌱", doppelt: "weide", ruht: null },
  { name: "Sommer", icon: "☀️", doppelt: "feld", ruht: null },
  { name: "Herbst", icon: "🍂", doppelt: "obstwiese", ruht: null },
  { name: "Winter", icon: "❄️", doppelt: "wald", ruht: "feld" },
];
// 25 Dorfkarten
const KARTEN = { feldhueter: 12, erntedank: 3, wegebau: 3, viehmarkt: 3, kirchweih: 4 };
const INTRO_MS = 7000; // Startanimation: Karte bauen, Reihenfolge auslosen
const LIMIT = { hof: 5, gut: 4, weg: 15 };

const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const einst = (raum) => raum.einstellungen.schechingen;
const w6 = () => 1 + Math.floor(Math.random() * 6);
const pips = (z) => (z ? 6 - Math.abs(7 - z) : 0);
const summe = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const leer = () => ({ holz: 0, stein: 0, korn: 0, milch: 0, obst: 0 });

// =============================================================
//  Karte: 19 Sechsecke (spitze Oberseite), Ecken und Kanten
// =============================================================
function karteBauen() {
  const felder = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) felder.push({ q, r });
  const ecken = [], kanten = [], eckeVon = new Map(), kanteVon = new Map();
  felder.forEach((f, id) => {
    f.id = id;
    f.x = Math.sqrt(3) * (f.q + f.r / 2);
    f.y = 1.5 * f.r;
    f.ecken = [];
    for (let i = 0; i < 6; i++) {
      const w = (Math.PI / 180) * (60 * i - 30);
      const x = f.x + Math.cos(w), y = f.y + Math.sin(w);
      const k = `${Math.round(x * 100)},${Math.round(y * 100)}`;
      if (!eckeVon.has(k)) { eckeVon.set(k, ecken.length); ecken.push({ id: ecken.length, x: +x.toFixed(3), y: +y.toFixed(3), felder: [], nachbarn: [], kanten: [] }); }
      const e = ecken[eckeVon.get(k)];
      e.felder.push(id);
      f.ecken.push(e.id);
    }
    for (let i = 0; i < 6; i++) {
      const a = f.ecken[i], b = f.ecken[(i + 1) % 6];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!kanteVon.has(k)) {
        const id = kanten.length;
        kanteVon.set(k, id);
        kanten.push({ id, a: Math.min(a, b), b: Math.max(a, b) });
        ecken[a].nachbarn.push(b); ecken[b].nachbarn.push(a);
        ecken[a].kanten.push(id); ecken[b].kanten.push(id);
      }
    }
  });
  return { felder, ecken, kanten };
}
const KARTE = karteBauen();
const MITTE = KARTE.felder.find((f) => f.q === 0 && f.r === 0).id;
const DORFPLATZ_ECKEN = new Set(KARTE.felder[MITTE].ecken);
const nachbarFelder = (f) => KARTE.felder.filter((g) => g.id !== f.id && Math.abs(g.q - f.q) + Math.abs(g.r - f.r) + Math.abs(g.q + g.r - f.q - f.r) === 2);

// Faire Zufallskarte: jede Partie neu, aber nie übermächtig
//  1. 6 und 8 nie nebeneinander, gleiche Zahlen nie nebeneinander
//  2. 2 und 12 nicht nebeneinander (sonst entsteht eine "tote" Ecke)
//  3. Keine Ecke ist zu stark: höchstens 12 Würfelpunkte (Pips) an einer Ecke
//  4. Die vier roten Zahlen (6, 8) liegen auf mindestens drei verschiedenen Landschaften
//  5. Jede Landschaft bekommt im Schnitt ähnlich gute Zahlen (Unterschied höchstens 0,9 Pips)
//  6. Keine Landschaft klumpt: kein Feld hat zwei Nachbarn derselben Art
const NACHBARN = new Map();
function nachbarn(f) { if (!NACHBARN.has(f.id)) NACHBARN.set(f.id, nachbarFelder(f).map((g) => g.id)); return NACHBARN.get(f.id); }
function karteFair(belegung, streuung = 0.9) {
  for (const f of KARTE.felder) {
    const b = belegung[f.id];
    if (!b.zahl) continue;
    let gleicheArt = 0;
    for (const n of nachbarn(f)) {
      const c = belegung[n];
      if (c.typ === b.typ) gleicheArt++;
      if (!c.zahl) continue;
      if (c.zahl === b.zahl) return false;
      if ([6, 8].includes(b.zahl) && [6, 8].includes(c.zahl)) return false;
      if ([2, 12].includes(b.zahl) && [2, 12].includes(c.zahl)) return false;
    }
    if (gleicheArt >= 2) return false;
  }
  for (const e of KARTE.ecken) if (e.felder.reduce((s, f) => s + pips(belegung[f].zahl), 0) > 12) return false;
  const rot = new Set(belegung.filter((b) => b.zahl === 6 || b.zahl === 8).map((b) => b.typ));
  if (rot.size < 3) return false;
  const schnitt = Object.keys(LAND).map((t) => { const l = belegung.filter((b) => b.typ === t); return l.reduce((s, b) => s + pips(b.zahl), 0) / l.length; });
  return Math.max(...schnitt) - Math.min(...schnitt) <= streuung;
}
function landschaftVerteilen() {
  const typen = [...Array(4).fill("wald"), ...Array(4).fill("feld"), ...Array(4).fill("weide"), ...Array(3).fill("steinbruch"), ...Array(3).fill("obstwiese")];
  const zahlen = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  let letzte = null;
  for (let versuch = 0; versuch < 20000; versuch++) {
    const t = mischen(typen), z = mischen(zahlen);
    const belegung = KARTE.felder.map((f) => (f.id === MITTE ? { typ: "dorfplatz", zahl: null } : { typ: t.pop(), zahl: z.pop() }));
    letzte = belegung;
    // Nach vielen Versuchen die Zahlen-Streuung etwas lockern (alle anderen Regeln bleiben)
    if (karteFair(belegung, versuch < 12000 ? 0.9 : 1.3)) return belegung;
  }
  return letzte; // kommt praktisch nie vor
}

// =============================================================
//  Hilfen
// =============================================================
function teilnehmer(raum) {
  const d = raum.daten;
  return d.reihenfolge.map((id, i) => {
    const bot = d.bots.find((b) => b.id === id);
    if (bot) return { id, bot: true, name: bot.name, avatar: bot.avatar, online: true, farbe: FARBEN[i] };
    const s = raum.spieler[id];
    return s ? { id, bot: false, name: s.name, avatar: s.avatar, online: s.online, afk: s.afk, farbe: FARBEN[i] } : null;
  }).filter(Boolean);
}
const istBot = (d, id) => d.bots.some((b) => b.id === id);
const hat = (hand, kosten) => Object.entries(kosten).every(([r, n]) => (hand[r] || 0) >= n);
const bezahlen = (hand, kosten) => { for (const [r, n] of Object.entries(kosten)) hand[r] -= n; };
const anzahl = (d, id, typ) => Object.values(d.bauten).filter((b) => b.sp === id && b.typ === typ).length;
const wegAnzahl = (d, id) => Object.values(d.wege).filter((s) => s === id).length;
const amDorfplatz = (d, id) => [...DORFPLATZ_ECKEN].some((e) => d.bauten[e]?.sp === id) || KARTE.kanten.some((k) => d.wege[k.id] === id && (DORFPLATZ_ECKEN.has(k.a) || DORFPLATZ_ECKEN.has(k.b)));
const marktrecht = (d, id) => [...DORFPLATZ_ECKEN].some((e) => d.bauten[e]?.sp === id);
const kurs = (d, id) => (marktrecht(d, id) ? 3 : 4);

function punkte(d, id, mitGeheim = true) {
  let p = 0;
  for (const b of Object.values(d.bauten)) if (b.sp === id) p += b.typ === "gut" ? 2 : 1;
  for (const g of Object.values(d.gemein)) if (g === id) p += 2;
  if (d.laengsterWeg === id) p += 2;
  if (d.feldwache === id) p += 2;
  if (mitGeheim) p += d.kirchweih[id] || 0;
  return p;
}
// ---------- Längster Weg (wie im Grundspiel) ----------
// Längste zusammenhängende Strecke eigener Wege; fremde Höfe unterbrechen sie.
function wegLaenge(d, id) {
  const meine = KARTE.kanten.filter((k) => d.wege[k.id] === id);
  let best = 0;
  const benutzt = new Set();
  const lauf = (ecke, laenge) => {
    best = Math.max(best, laenge);
    if (laenge > 0 && d.bauten[ecke] && d.bauten[ecke].sp !== id) return; // fremder Hof: hier ist Schluss
    for (const kid of KARTE.ecken[ecke].kanten) {
      if (d.wege[kid] !== id || benutzt.has(kid)) continue;
      const k = KARTE.kanten[kid];
      benutzt.add(kid);
      lauf(k.a === ecke ? k.b : k.a, laenge + 1);
      benutzt.delete(kid);
    }
  };
  const starts = new Set(meine.flatMap((k) => [k.a, k.b]));
  for (const e of starts) lauf(e, 0);
  return best;
}
// Nach jedem Weg oder Hof neu prüfen: Wer hat den längsten Weg (mindestens 5)?
function laengsterWegPruefen(raum) {
  const d = raum.daten;
  const l = Object.fromEntries(d.reihenfolge.map((id) => [id, wegLaenge(d, id)]));
  d.wegLaengen = l;
  const alt = d.laengsterWeg || null;
  const max = Math.max(...Object.values(l));
  if (alt && l[alt] >= 5 && l[alt] === max) return;
  const kandidaten = d.reihenfolge.filter((id) => l[id] === max && max >= 5);
  const neu = kandidaten.length === 1 ? kandidaten[0] : null;
  if (neu !== alt) {
    d.laengsterWeg = neu;
    if (neu) { log(d, `🛤️ ${name(raum, neu)} hat jetzt den Längsten Weg (${max}) und bekommt 2 Punkte!`); d.bonusEreignis = { art: "weg", sp: neu, t: Date.now() }; }
    else log(d, "🛤️ Der Längste Weg ist gerade an niemanden vergeben.");
  }
}
function feldwachePruefen(raum, id) {
  const d = raum.daten;
  const n = (d.wache[id] = (d.wache[id] || 0) + 1);
  const alt = d.feldwache;
  if (n >= 3 && id !== alt && (!alt || n > d.wache[alt])) {
    d.feldwache = id;
    log(d, `👮 ${name(raum, id)} hat jetzt die Stärkste Feldwache und bekommt 2 Punkte!`);
    d.bonusEreignis = { art: "wache", sp: id, t: Date.now() };
  }
}

function punkteSetzen(raum) {
  const d = raum.daten;
  for (const t of teilnehmer(raum)) {
    const p = punkte(d, t.id, d.phase === "ende");
    if (t.bot) d.bots.find((b) => b.id === t.id).punkte = p;
    else if (raum.spieler[t.id]) raum.spieler[t.id].punkte = p;
  }
}
function log(d, text) { d.log.push({ t: Date.now(), text }); if (d.log.length > 30) d.log.shift(); }
const name = (raum, id) => teilnehmer(raum).find((t) => t.id === id)?.name || "?";

// ---------- Gültige Orte ----------
function eckeFrei(d, e) { return !d.bauten[e] && KARTE.ecken[e].nachbarn.every((n) => !d.bauten[n]); }
function hofOrte(d, id) {
  if (d.phase === "aufbau") return KARTE.ecken.filter((e) => eckeFrei(d, e.id)).map((e) => e.id);
  if (anzahl(d, id, "hof") >= LIMIT.hof) return [];
  return KARTE.ecken.filter((e) => eckeFrei(d, e.id) && e.kanten.some((k) => d.wege[k] === id)).map((e) => e.id);
}
function wegOrte(d, id) {
  if (wegAnzahl(d, id) >= LIMIT.weg) return [];
  if (d.phase === "aufbau") return d.aufbauSchritt !== "weg" ? [] : KARTE.ecken[d.letzterHof].kanten.filter((k) => d.wege[k] === undefined);
  return KARTE.kanten.filter((k) => d.wege[k.id] === undefined && [k.a, k.b].some((e) => {
    if (d.bauten[e]?.sp === id) return true;
    if (d.bauten[e] && d.bauten[e].sp !== id) return false; // fremder Hof unterbricht
    return KARTE.ecken[e].kanten.some((k2) => k2 !== k.id && d.wege[k2] === id);
  })).map((k) => k.id);
}
const gutOrte = (d, id) => (anzahl(d, id, "gut") >= LIMIT.gut ? [] : Object.entries(d.bauten).filter(([, b]) => b.sp === id && b.typ === "hof").map(([e]) => +e));

// =============================================================
//  Ablauf
// =============================================================
function senden(raum, ctx) {
  const d = raum.daten;
  punkteSetzen(raum);
  ctx.sende(raum);
  for (const t of teilnehmer(raum)) if (!t.bot) ctx.privat(raum, t.id, "schechingen:hand", { roh: d.hand[t.id], karten: d.karten[t.id], neu: d.zug?.gekauft?.length && d.dran === t.id ? d.zug.gekauft : [], kirchweih: d.kirchweih[t.id] || 0 });
}

function zeitSetzen(raum, ctx, ms) {
  const d = raum.daten;
  clearTimeout(d.zeitTimer);
  const t = teilnehmer(raum).find((x) => x.id === d.dran);
  const sek = einst(raum).sekunden;
  if (t?.bot) { d.endetUm = null; return; }
  const warten = !t ? 3000 : ms ?? (!t.online ? 8000 : t.afk ? 4000 : sek ? sek * 1000 : null);
  d.endetUm = warten ? Date.now() + warten : null;
  if (warten) d.zeitTimer = setTimeout(() => zeitAbgelaufen(raum, ctx), warten);
}

function zugStarten(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.botTimer);
  d.zug = { wurf: null, gespielt: false, gekauft: [], modus: null, gratisWege: 0, zurueck: null };
  d.angebot = null;
  zeitSetzen(raum, ctx);
  if (istBot(d, d.dran)) d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE);
  senden(raum, ctx);
}

function wuerfeln(raum, ctx) {
  const d = raum.daten;
  if (d.zug.wurf || d.zug.modus) return "Du hast schon gewürfelt.";
  const w = [w6(), w6()];
  d.zug.wurf = w;
  d.wurfId++;
  const n = w[0] + w[1];
  if (n === 7) {
    log(d, `${name(raum, d.dran)} würfelt 7: Ein Gewitter zieht auf! ⛈️`);
    d.abwerfen = {};
    for (const t of teilnehmer(raum)) { const c = summe(d.hand[t.id]); if (c > 8) d.abwerfen[t.id] = Math.floor(c / 2); }
    if (Object.keys(d.abwerfen).length) {
      d.zug.modus = "abwerfen";
      for (const id of Object.keys(d.abwerfen)) if (istBot(d, id)) abwerfen(raum, ctx, id, botAbwurf(d.hand[id], d.abwerfen[id]));
      if (d.zug.modus === "abwerfen") {
        // Wer nicht rechtzeitig wählt, gibt automatisch die häufigsten Karten ab
        clearTimeout(d.zeitTimer);
        d.endetUm = Date.now() + 30000;
        d.zeitTimer = setTimeout(() => { if (d.zug?.modus === "abwerfen") for (const [x, k] of Object.entries(d.abwerfen)) abwerfen(raum, ctx, x, botAbwurf(d.hand[x], k)); }, 30000);
      }
    } else d.zug.modus = "gewitter";
  } else ertrag(raum, n);
  if (istBot(d, d.dran)) d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE);
  senden(raum, ctx);
}

function ertrag(raum, n) {
  const d = raum.daten;
  const s = d.jahreszeiten ? SAISON[d.saison] : { doppelt: null, ruht: null };
  const bekommt = {};
  d.belegung.forEach((b, fid) => {
    if (b.zahl !== n || fid === d.gewitter || b.typ === s.ruht) return;
    const faktor = b.typ === s.doppelt ? 2 : 1;
    for (const e of KARTE.felder[fid].ecken) {
      const bau = d.bauten[e];
      if (!bau) continue;
      const menge = (bau.typ === "gut" ? 2 : 1) * faktor;
      d.hand[bau.sp][LAND[b.typ]] += menge;
      (bekommt[bau.sp] ||= leer())[LAND[b.typ]] += menge;
    }
  });
  d.letzterErtrag = { n, wer: bekommt, t: Date.now() };
}

function abwerfen(raum, ctx, id, auswahl) {
  const d = raum.daten;
  if (d.zug?.modus !== "abwerfen" || !d.abwerfen[id]) return;
  const soll = d.abwerfen[id];
  const a = Object.fromEntries(ROH.map((r) => [r, Math.max(0, parseInt(auswahl?.[r]) || 0)]));
  if (summe(a) !== soll || !hat(d.hand[id], a)) return `Wähle genau ${soll} Karten zum Abgeben.`;
  bezahlen(d.hand[id], a);
  delete d.abwerfen[id];
  log(d, `${name(raum, id)} verliert ${soll} Karten im Gewitter.`);
  if (!Object.keys(d.abwerfen).length) { d.zug.modus = "gewitter"; zeitSetzen(raum, ctx); if (istBot(d, d.dran)) d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE); }
  senden(raum, ctx);
}

function gewitterSetzen(raum, ctx, feld) {
  const d = raum.daten;
  feld = parseInt(feld);
  if (d.zug.modus !== "gewitter" || !(feld >= 0 && feld < 19)) return;
  if (feld === d.gewitter) return "Das Gewitter muss weiterziehen.";
  d.gewitter = feld;
  const opfer = [...new Set(KARTE.felder[feld].ecken.map((e) => d.bauten[e]?.sp).filter((s) => s && s !== d.dran && summe(d.hand[s]) > 0))];
  log(d, `⛈️ Gewitter über ${d.belegung[feld].typ === "dorfplatz" ? "dem Dorfplatz" : `${{ wald: "einem Wald", feld: "einem Feld", weide: "einer Weide", steinbruch: "einem Steinbruch", obstwiese: "einer Streuobstwiese" }[d.belegung[feld].typ]} (${d.belegung[feld].zahl})`}.`);
  if (opfer.length === 1) return stehlen(raum, ctx, opfer[0], true);
  if (opfer.length > 1) { d.zug.modus = "stehlen"; d.zug.opfer = opfer; }
  else fertigMitGewitter(d);
  if (istBot(d, d.dran)) d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE);
  senden(raum, ctx);
}
function stehlen(raum, ctx, opfer, direkt = false) {
  const d = raum.daten;
  if (!direkt && (d.zug.modus !== "stehlen" || !d.zug.opfer.includes(opfer))) return;
  const karten = ROH.flatMap((r) => Array(d.hand[opfer][r]).fill(r));
  if (karten.length) {
    const r = karten[Math.floor(Math.random() * karten.length)];
    d.hand[opfer][r]--; d.hand[d.dran][r]++;
    log(d, `${name(raum, d.dran)} nimmt ${name(raum, opfer)} eine Karte ab.`);
  }
  fertigMitGewitter(d);
  if (istBot(d, d.dran)) d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE);
  senden(raum, ctx);
}
function fertigMitGewitter(d) { d.zug.modus = d.zug.zurueck || null; d.zug.zurueck = null; d.zug.opfer = null; }

// ---------- Bauen ----------
function bauen(raum, ctx, id, art, ort) {
  const d = raum.daten;
  ort = parseInt(ort);
  if (d.phase === "aufbau") return aufbauSetzen(raum, ctx, id, art, ort);
  if (d.dran !== id || !d.zug.wurf || (d.zug.modus && d.zug.modus !== "wegebau")) return "Erst würfeln.";
  if (art === "weg") {
    if (!wegOrte(d, id).includes(ort)) return "Hier kannst du keinen Weg bauen.";
    const gratis = d.zug.modus === "wegebau";
    if (!gratis && !hat(d.hand[id], KOSTEN.weg)) return "Dafür fehlen dir Rohstoffe.";
    if (!gratis) bezahlen(d.hand[id], KOSTEN.weg);
    d.wege[ort] = id;
    laengsterWegPruefen(raum);
    if (gratis && --d.zug.gratisWege <= 0) d.zug.modus = null;
  } else if (art === "hof") {
    if (d.zug.modus) return;
    if (!hofOrte(d, id).includes(ort)) return "Hier kannst du keinen Hof bauen.";
    if (!hat(d.hand[id], KOSTEN.hof)) return "Dafür fehlen dir Rohstoffe.";
    bezahlen(d.hand[id], KOSTEN.hof);
    d.bauten[ort] = { sp: id, typ: "hof" };
    laengsterWegPruefen(raum); // ein Hof kann einen fremden Weg unterbrechen
    log(d, `🏠 ${name(raum, id)} baut einen Hof${DORFPLATZ_ECKEN.has(ort) ? " am Dorfplatz (Marktrecht!)" : ""}.`);
  } else if (art === "gut") {
    if (d.zug.modus) return;
    if (!gutOrte(d, id).includes(ort)) return "Nur ein eigener Hof kann zum Gutshof werden.";
    if (!hat(d.hand[id], KOSTEN.gut)) return "Dafür fehlen dir Rohstoffe.";
    bezahlen(d.hand[id], KOSTEN.gut);
    d.bauten[ort].typ = "gut";
    log(d, `🏰 ${name(raum, id)} baut einen Gutshof.`);
  } else return;
  d.letzterBau = { art, ort, sp: id, t: Date.now() };
  if (pruefeSieg(raum, ctx)) return;
  if (istBot(d, id)) return;
  senden(raum, ctx);
}

function gemeinBauen(raum, ctx, id, was) {
  const d = raum.daten;
  const g = GEMEIN[was];
  if (!g || !d.gebaeude || d.dran !== id || !d.zug.wurf || d.zug.modus) return;
  if (d.gemein[was]) return "Das steht schon.";
  if (!amDorfplatz(d, id)) return "Du brauchst einen Hof oder Weg am Dorfplatz.";
  if (!hat(d.hand[id], g.kosten)) return "Dafür fehlen dir Rohstoffe.";
  bezahlen(d.hand[id], g.kosten);
  d.gemein[was] = id;
  d.letzterBau = { art: "gemein", was, sp: id, t: Date.now() };
  log(d, `${g.icon} ${name(raum, id)} baut ${g.name === "Kirche" ? "die" : "das"} ${g.name} (+2).`);
  if (pruefeSieg(raum, ctx)) return;
  if (!istBot(d, id)) senden(raum, ctx);
}

// ---------- Dorfkarten ----------
function karteKaufen(raum, ctx, id) {
  const d = raum.daten;
  if (d.dran !== id || !d.zug.wurf || d.zug.modus) return;
  if (!d.stapel.length) return "Keine Dorfkarten mehr übrig.";
  if (!hat(d.hand[id], KOSTEN.karte)) return "Dafür fehlen dir Rohstoffe.";
  bezahlen(d.hand[id], KOSTEN.karte);
  const k = d.stapel.pop();
  if (k === "kirchweih") { d.kirchweih[id] = (d.kirchweih[id] || 0) + 1; log(d, `${name(raum, id)} kauft eine Dorfkarte.`); if (pruefeSieg(raum, ctx)) return; }
  else { d.karten[id].push(k); d.zug.gekauft.push(k); log(d, `${name(raum, id)} kauft eine Dorfkarte.`); }
  if (!istBot(d, id)) senden(raum, ctx);
  return k;
}
function karteSpielen(raum, ctx, id, k, wahl) {
  const d = raum.daten;
  if (d.dran !== id || d.zug.modus || d.zug.gespielt) return d.zug.gespielt ? "Nur eine Dorfkarte pro Zug." : undefined;
  const i = d.karten[id].indexOf(k);
  const frisch = d.zug.gekauft.filter((x) => x === k).length;
  if (i < 0 || d.karten[id].filter((x) => x === k).length <= frisch) return "Diese Karte kannst du erst ab deinem nächsten Zug spielen.";
  if (k !== "feldhueter" && !d.zug.wurf) return "Diese Karte spielst du nach dem Würfeln.";
  if (k === "erntedank") {
    const a = [].concat(wahl || []).filter((r) => ROH.includes(r)).slice(0, 2);
    if (a.length !== 2) return "Wähle zwei Rohstoffe.";
    a.forEach((r) => d.hand[id][r]++);
  } else if (k === "viehmarkt") {
    if (!ROH.includes(wahl)) return "Wähle einen Rohstoff.";
    let n = 0;
    for (const t of teilnehmer(raum)) if (t.id !== id && d.hand[t.id][wahl] > 0) { d.hand[t.id][wahl]--; n++; }
    d.hand[id][wahl] += n;
  } else if (k === "wegebau") {
    if (!wegOrte(d, id).length) return "Du kannst gerade keinen Weg bauen.";
    d.zug.modus = "wegebau"; d.zug.gratisWege = 2;
  } else if (k === "feldhueter") {
    d.zug.zurueck = null;
    d.zug.modus = "gewitter";
    feldwachePruefen(raum, id);
  } else return;
  d.karten[id].splice(i, 1);
  d.zug.gespielt = true;
  log(d, `🃏 ${name(raum, id)} spielt ${KARTEN_NAME[k]}.`);
  d.letzteKarte = { k, sp: id, t: Date.now() };
  if (pruefeSieg(raum, ctx)) return;
  if (!istBot(d, id)) senden(raum, ctx);
}
const KARTEN_NAME = { feldhueter: "den Feldhüter", erntedank: "Erntedank", wegebau: "Wegebau", viehmarkt: "Viehmarkt", kirchweih: "Kirchweih" };

// ---------- Handel ----------
function bankTausch(raum, ctx, id, gib, nimm) {
  const d = raum.daten;
  if (d.dran !== id || !d.zug.wurf || d.zug.modus || !ROH.includes(gib) || !ROH.includes(nimm) || gib === nimm) return;
  const k = kurs(d, id);
  if (d.hand[id][gib] < k) return `Du brauchst ${k} gleiche Karten.`;
  d.hand[id][gib] -= k; d.hand[id][nimm]++;
  log(d, `${name(raum, id)} tauscht ${k} ${ROH_NAME[gib]} gegen 1 ${ROH_NAME[nimm]} beim Markt.`);
  if (!istBot(d, id)) senden(raum, ctx);
}
const ROH_NAME = { holz: "Holz", stein: "Stein", korn: "Korn", milch: "Milch" };
function angebotMachen(raum, ctx, id, gib, will) {
  const d = raum.daten;
  if (d.dran !== id || !d.zug.wurf || d.zug.modus) return;
  const g = Object.fromEntries(ROH.map((r) => [r, Math.max(0, parseInt(gib?.[r]) || 0)]));
  const w = Object.fromEntries(ROH.map((r) => [r, Math.max(0, parseInt(will?.[r]) || 0)]));
  if (!summe(g) || !summe(w) || !hat(d.hand[id], g)) return "Ungültiges Angebot.";
  d.angebot = { von: id, gib: g, will: w, nein: [], id: Date.now() };
  log(d, `🤝 ${name(raum, id)} bietet einen Tausch an.`);
  senden(raum, ctx);
  // Computer prüfen das Angebot
  const aid = d.angebot.id;
  setTimeout(() => {
    if (raum.daten !== d || d.angebot?.id !== aid) return;
    for (const b of d.bots) if (b.id !== id && botNimmtAn(d, b.id, d.angebot)) return angebotAnnehmen(raum, ctx, b.id);
    for (const b of d.bots) if (b.id !== id && !d.angebot.nein.includes(b.id)) d.angebot.nein.push(b.id);
    if (d.bots.length) senden(raum, ctx);
  }, 1200);
}
function angebotAnnehmen(raum, ctx, id) {
  const d = raum.daten;
  const a = d.angebot;
  if (!a || a.von === id || !d.hand[id]) return;
  if (!hat(d.hand[id], a.will)) return "Dafür fehlen dir die Karten.";
  if (!hat(d.hand[a.von], a.gib)) { d.angebot = null; senden(raum, ctx); return; }
  bezahlen(d.hand[a.von], a.gib); bezahlen(d.hand[id], a.will);
  for (const r of ROH) { d.hand[id][r] += a.gib[r]; d.hand[a.von][r] += a.will[r]; }
  log(d, `🤝 ${name(raum, a.von)} und ${name(raum, id)} tauschen.`);
  d.angebot = null;
  senden(raum, ctx);
}

// ---------- Zugende, Sieg ----------
function zugEnde(raum, ctx) {
  const d = raum.daten;
  if (d.phase !== "spielen" || !d.zug.wurf || d.zug.modus) return;
  clearTimeout(d.botTimer);
  const ids = d.reihenfolge;
  const i = ids.indexOf(d.dran);
  d.dran = ids[(i + 1) % ids.length];
  if (d.dran === ids[0]) {
    d.runde++;
    if (d.jahreszeiten) { d.saison = (d.saison + 1) % 4; log(d, `${SAISON[d.saison].icon} Es wird ${SAISON[d.saison].name}.`); }
  }
  zugStarten(raum, ctx);
}

function pruefeSieg(raum, ctx) {
  const d = raum.daten;
  if (punkte(d, d.dran) < einst(raum).ziel) return false;
  ende(raum, ctx, d.dran);
  return true;
}

function ende(raum, ctx, sieger) {
  const d = raum.daten;
  clearTimeout(d.zeitTimer); clearTimeout(d.botTimer);
  d.phase = "ende";
  d.sieger = sieger;
  d.endetUm = null;
  log(d, `🏆 ${name(raum, sieger)} ist Dorfschultheiß von Schechingen!`);
  const alle = teilnehmer(raum);
  const liste = [];
  const beste = (f, min, icon, titel, text) => {
    const w = alle.map((t) => [t.id, f(t.id)]).filter(([, v]) => v >= min);
    if (!w.length) return;
    const max = Math.max(...w.map(([, v]) => v));
    const ids = w.filter(([, v]) => v === max).map(([id]) => id);
    if (ids.length < alle.length || alle.length === 1) liste.push({ icon, titel, spieler: ids, text: text(max) });
  };
  if (d.laengsterWeg) liste.push({ icon: "🛤️", titel: "Längster Weg", spieler: [d.laengsterWeg], text: `${d.wegLaengen[d.laengsterWeg]} Wege am Stück` });
  if (d.feldwache) liste.push({ icon: "👮", titel: "Stärkste Feldwache", spieler: [d.feldwache], text: `${d.wache[d.feldwache]} Feldhüter ausgespielt` });
  beste((id) => anzahl(d, id, "gut"), 2, "🏰", "Gutsherr", (n) => `${n} Gutshöfe`);
  beste((id) => Object.values(d.gemein).filter((g) => g === id).length, 1, "⛪", "Ehrenbürger", (n) => `${n}× am Dorfplatz gebaut`);
  beste((id) => d.kirchweih[id] || 0, 1, "🎪", "Festwirt", (n) => `${n} Kirchweih-Karten`);
  d.auszeichnungen = liste.slice(0, 5);
  punkteSetzen(raum);
  senden(raum, ctx);
}

// ---------- Aufbauphase (je 2 Höfe mit Weg) ----------
function aufbauSetzen(raum, ctx, id, art, ort) {
  const d = raum.daten;
  if (d.dran !== id) return;
  if (d.aufbauSchritt === "hof" && art === "hof") {
    if (!hofOrte(d, id).includes(ort)) return "Hier ist kein Platz (Abstand zu anderen Höfen).";
    d.bauten[ort] = { sp: id, typ: "hof" };
    d.letzterHof = ort;
    d.aufbauSchritt = "weg";
    // Zweiter Hof: Startrohstoffe aus den angrenzenden Landschaften
    if (d.aufbauNr >= d.reihenfolge.length) {
      const gabe = leer();
      for (const f of KARTE.ecken[ort].felder) { const t = d.belegung[f].typ; if (LAND[t]) { d.hand[id][LAND[t]]++; gabe[LAND[t]]++; } }
      d.startGabe = { sp: id, ecke: ort, roh: gabe, t: Date.now() };
      log(d, `🎁 ${name(raum, id)} bekommt Startrohstoffe.`);
    }
  } else if (d.aufbauSchritt === "weg" && art === "weg") {
    if (!wegOrte(d, id).includes(ort)) return "Der Weg muss an deinem neuen Hof liegen.";
    d.wege[ort] = id;
    d.wegLaengen = Object.fromEntries(d.reihenfolge.map((x) => [x, wegLaenge(d, x)]));
    d.aufbauNr++;
    const folge = [...d.reihenfolge, ...[...d.reihenfolge].reverse()];
    if (d.aufbauNr >= folge.length) {
      d.phase = "spielen";
      d.dran = d.reihenfolge[0];
      log(d, d.jahreszeiten ? `${SAISON[0].icon} Der Frühling beginnt. Viel Glück!` : "Das Spiel beginnt. Viel Glück!");
      return zugStarten(raum, ctx);
    }
    d.dran = folge[d.aufbauNr];
    d.aufbauSchritt = "hof";
  } else return;
  d.letzterBau = { art, ort, sp: id, t: Date.now() };
  zeitSetzen(raum, ctx);
  if (istBot(d, d.dran)) { clearTimeout(d.botTimer); d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE); }
  senden(raum, ctx);
}

// ---------- Zeit abgelaufen: automatisch weiterspielen ----------
function zeitAbgelaufen(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase === "ende") return;
  const s = raum.spieler[d.dran];
  if (s) { s.ohneEingabe = (s.ohneEingabe || 0) + 1; if (s.ohneEingabe >= 2) s.afk = true; }
  autoZug(raum, ctx);
}
// Für Computer und abwesende Spieler: einen Schritt machen
function autoZug(raum, ctx) {
  const d = raum.daten;
  const id = d.dran;
  if (d.phase === "aufbau") {
    if (d.aufbauSchritt === "hof") return aufbauSetzen(raum, ctx, id, "hof", besteEcke(d, id, hofOrte(d, id)));
    return aufbauSetzen(raum, ctx, id, "weg", besterWeg(d, id, wegOrte(d, id)));
  }
  if (!d.zug.wurf && !d.zug.modus) wuerfeln(raum, ctx);
  if (d.zug.modus === "abwerfen") return; // eigener Timer fürs Abwerfen läuft
  if (d.zug.modus === "gewitter") gewitterSetzen(raum, ctx, gewitterZiel(d, id));
  if (d.zug.modus === "stehlen") stehlen(raum, ctx, d.zug.opfer[0]);
  if (d.zug.modus === "wegebau") { d.zug.modus = null; d.zug.gratisWege = 0; }
  if (d.phase === "spielen" && !d.zug.modus) zugEnde(raum, ctx);
}

// =============================================================
//  Computer-Gegner
// =============================================================
function eckeWert(d, id, e) {
  const typen = new Set();
  let w = 0;
  for (const f of KARTE.ecken[e].felder) {
    const b = d.belegung[f];
    if (b.typ === "dorfplatz") { w += 2; continue; }
    w += pips(b.zahl) * (d.gewitter === f ? 0.4 : 1);
    typen.add(b.typ);
  }
  // Vielfalt: fehlende Rohstoffe sind mehr wert
  const meine = new Set(Object.entries(d.bauten).filter(([, b]) => b.sp === id).flatMap(([x]) => KARTE.ecken[x].felder.map((f) => d.belegung[f].typ)));
  for (const t of typen) w += meine.has(t) ? 0.5 : 2;
  return w;
}
const besteEcke = (d, id, orte) => orte.reduce((best, e) => (eckeWert(d, id, e) + Math.random() * 0.3 > (best === null ? -1 : eckeWert(d, id, best)) ? e : best), null);
function besterWeg(d, id, orte) {
  // Weg Richtung einer guten freien Ecke
  let best = orte[0], bw = -1;
  for (const k of orte) {
    const kk = KARTE.kanten[k];
    for (const e of [kk.a, kk.b]) {
      const w = eckeFrei(d, e) ? eckeWert(d, id, e) : KARTE.ecken[e].nachbarn.filter((n) => eckeFrei(d, n)).reduce((m, n) => Math.max(m, eckeWert(d, id, n) * 0.7), 0);
      if (w + Math.random() * 0.2 > bw) { bw = w; best = k; }
    }
  }
  return best;
}
function gewitterZiel(d, id) {
  // Das Feld, das den anderen am meisten schadet und mir nicht
  let best = null, bw = -99;
  d.belegung.forEach((b, f) => {
    if (f === d.gewitter) return;
    let w = b.zahl ? pips(b.zahl) * 0.2 : -1;
    for (const e of KARTE.felder[f].ecken) { const bau = d.bauten[e]; if (!bau) continue; const m = bau.typ === "gut" ? 2 : 1; w += bau.sp === id ? -4 * m : pips(b.zahl) * m + punkte(d, bau.sp, false) * 0.3; }
    if (w > bw) { bw = w; best = f; }
  });
  return best;
}
function botAbwurf(hand, n) {
  const h = { ...hand }, a = leer();
  for (let i = 0; i < n; i++) { const r = ROH.reduce((m, x) => (h[x] > h[m] ? x : m), ROH[0]); h[r]--; a[r]++; }
  return a;
}
function botNimmtAn(d, id, a) {
  if (!hat(d.hand[id], a.will)) return false;
  if (summe(a.gib) < summe(a.will)) return false;
  // Nur wenn ich etwas bekomme, das mir fehlt
  return ROH.some((r) => a.gib[r] > 0 && d.hand[id][r] === 0) && Math.random() < 0.8;
}
// Was fehlt mir für ein Ziel? Ein Tausch beim Markt, wenn es damit klappt
function botMarkt(raum, ctx, id, ziel) {
  const d = raum.daten;
  const h = d.hand[id];
  const k = kurs(d, id);
  const fehlt = ROH.filter((r) => (h[r] || 0) < (ziel[r] || 0));
  const menge = fehlt.reduce((a, r) => a + ziel[r] - h[r], 0);
  if (!fehlt.length || menge > 2) return false;
  // Überschuss (was über das Ziel hinausgeht) gegen den ersten fehlenden Rohstoff
  const geber = ROH.filter((r) => h[r] - (ziel[r] || 0) >= k).sort((a, b) => h[b] - h[a])[0];
  if (!geber) return false;
  bankTausch(raum, ctx, id, geber, fehlt[0]);
  return true;
}

function botSchritt(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase === "ende" || !istBot(d, d.dran)) return;
  const id = d.dran;
  const weiter = (ms = BOT_PAUSE) => { d.botTimer = setTimeout(() => botSchritt(raum, ctx), ms); };
  if (d.phase === "aufbau") return autoZug(raum, ctx);
  const h = d.hand[id];
  // Feldhüter vor dem Wurf, wenn das Gewitter auf mir sitzt
  if (!d.zug.wurf && !d.zug.gespielt && d.karten[id].includes("feldhueter") && d.zug.gekauft.filter((k) => k === "feldhueter").length < d.karten[id].filter((k) => k === "feldhueter").length
    && KARTE.felder[d.gewitter].ecken.some((e) => d.bauten[e]?.sp === id)) { karteSpielen(raum, ctx, id, "feldhueter"); senden(raum, ctx); return weiter(); }
  if (!d.zug.wurf && !d.zug.modus) return wuerfeln(raum, ctx);
  if (d.zug.modus === "abwerfen") return;
  if (d.zug.modus === "gewitter") return gewitterSetzen(raum, ctx, gewitterZiel(d, id));
  if (d.zug.modus === "stehlen") return stehlen(raum, ctx, d.zug.opfer.reduce((m, o) => (summe(d.hand[o]) > summe(d.hand[m]) ? o : m)));
  if (d.zug.modus === "wegebau") { const o = wegOrte(d, id); if (o.length) { bauen(raum, ctx, id, "weg", besterWeg(d, id, o)); senden(raum, ctx); return weiter(); } d.zug.modus = null; }
  // Karten spielen (nicht die gerade gekauften)
  const spielbar = (k) => !d.zug.gespielt && d.karten[id].filter((x) => x === k).length > d.zug.gekauft.filter((x) => x === k).length;
  if (spielbar("erntedank")) { const fehlt = ROH.filter((r) => h[r] < (KOSTEN.hof[r] || 0)); karteSpielen(raum, ctx, id, "erntedank", [fehlt[0] || "stein", fehlt[1] || fehlt[0] || "obst"]); senden(raum, ctx); return weiter(); }
  if (spielbar("wegebau") && wegOrte(d, id).length && !hofOrte(d, id).length) { karteSpielen(raum, ctx, id, "wegebau"); senden(raum, ctx); return weiter(); }
  if (spielbar("viehmarkt")) { const r = ROH.reduce((m, x) => (h[x] < h[m] ? x : m), "stein"); karteSpielen(raum, ctx, id, "viehmarkt", r); senden(raum, ctx); return weiter(); }
  // Bauen: Gutshof > Hof > Dorfplatz > Weg > Dorfkarte
  const gut = gutOrte(d, id), hof = hofOrte(d, id);
  if (gut.length && hat(h, KOSTEN.gut)) { bauen(raum, ctx, id, "gut", besteEcke(d, id, gut)); if (d.phase === "ende") return; senden(raum, ctx); return weiter(); }
  if (hof.length && hat(h, KOSTEN.hof)) { bauen(raum, ctx, id, "hof", besteEcke(d, id, hof)); if (d.phase === "ende") return; senden(raum, ctx); return weiter(); }
  const g = d.gebaeude && Object.keys(GEMEIN).find((x) => !d.gemein[x] && amDorfplatz(d, id) && hat(h, GEMEIN[x].kosten));
  if (g) { gemeinBauen(raum, ctx, id, g); if (d.phase === "ende") return; senden(raum, ctx); return weiter(); }
  const wegLohnt = !hof.length || (summe(h) >= 6 && (d.wegLengenBot = (d.wegLaengen?.[id] || 0)) >= 3 && d.laengsterWeg !== id);
  if (wegLohnt && wegOrte(d, id).length && hat(h, KOSTEN.weg)) { bauen(raum, ctx, id, "weg", besterWeg(d, id, wegOrte(d, id))); senden(raum, ctx); return weiter(); }
  // Markt: ein Tausch pro Ziel und Zug
  if ((d.zug.botTausche || 0) < 3) {
    const ziele = [hof.length && KOSTEN.hof, gut.length && KOSTEN.gut, d.gebaeude && amDorfplatz(d, id) && Object.keys(GEMEIN).filter((x) => !d.gemein[x]).map((x) => GEMEIN[x].kosten)[0], !hof.length && KOSTEN.weg, KOSTEN.karte].filter(Boolean);
    for (const ziel of ziele) if (botMarkt(raum, ctx, id, ziel)) { d.zug.botTausche = (d.zug.botTausche || 0) + 1; senden(raum, ctx); return weiter(); }
  }
  if (d.stapel.length && hat(h, KOSTEN.karte) && (summe(h) >= 5 || !hof.length)) { karteKaufen(raum, ctx, id); if (d.phase === "ende") return; senden(raum, ctx); return weiter(); }
  zugEnde(raum, ctx);
}

// =============================================================
//  Schnittstelle
// =============================================================
module.exports = {
  meta: () => ({
    max: MAX_TEILNEHMER, kosten: KOSTEN, gemein: GEMEIN, saison: SAISON, farben: FARBEN, limit: LIMIT,
    karte: { felder: KARTE.felder.map(({ id, q, r, x, y, ecken }) => ({ id, q, r, x, y, ecken })), ecken: KARTE.ecken.map(({ id, x, y }) => ({ id, x, y })), kanten: KARTE.kanten },
    dorfplatzEcken: [...DORFPLATZ_ECKEN],
  }),
  standardEinstellungen: () => ({ bots: 2, sekunden: 120, ziel: 10, gebaeude: true, jahreszeiten: true }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(3, Math.max(0, parseInt(e.bots) || 0));
    if (e.sekunden !== undefined) { const s = parseInt(e.sekunden); neu.sekunden = [0, 60, 120, 180].includes(s) ? s : 120; }
    if (e.ziel !== undefined) { const z = parseInt(e.ziel); neu.ziel = [8, 10, 12].includes(z) ? z : 10; }
    if (e.gebaeude !== undefined) neu.gebaeude = !!e.gebaeude;
    if (e.jahreszeiten !== undefined) neu.jahreszeiten = !!e.jahreszeiten;
    return neu;
  },
  starten(raum, ctx) {
    const e = einst(raum);
    const menschen = Object.values(raum.spieler).filter((s) => s.online);
    if (menschen.length > MAX_TEILNEHMER) return `Knaben von Schechingen gehen mit höchstens ${MAX_TEILNEHMER} Spielern.`;
    const botAnzahl = Math.min(e.bots, MAX_TEILNEHMER - menschen.length);
    if (menschen.length + botAnzahl < 2) return "Knaben von Schechingen brauchen mindestens 2 Spieler. Nimm einen Computer dazu!";
    const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0 }));
    const reihenfolge = mischen([...menschen.map((s) => s.id), ...bots.map((b) => b.id)]);
    raum.daten = {
      bots, reihenfolge, dran: reihenfolge[0], phase: "aufbau", aufbauNr: 0, aufbauSchritt: "hof", letzterHof: null,
      belegung: landschaftVerteilen(), gewitter: MITTE, bauten: {}, wege: {}, gemein: { brunnen: null, wirtshaus: null, kirche: null, rathaus: null },
      hand: Object.fromEntries(reihenfolge.map((id) => [id, leer()])), karten: Object.fromEntries(reihenfolge.map((id) => [id, []])), kirchweih: {},
      laengsterWeg: null, wegLaengen: {}, feldwache: null, wache: {},
      stapel: mischen(Object.entries(KARTEN).flatMap(([k, n]) => Array(n).fill(k))),
      saison: 0, runde: 1, wurfId: 0, zug: null, abwerfen: {}, angebot: null, log: [], auszeichnungen: [],
      gebaeude: e.gebaeude !== false, jahreszeiten: e.jahreszeiten !== false, introBis: Date.now() + INTRO_MS, startGabe: null,
    };
    log(raum.daten, "Jeder setzt reihum zwei Höfe mit je einem Weg.");
    const d = raum.daten;
    d.zeitTimer = setTimeout(() => { if (raum.daten !== d) return; zeitSetzen(raum, ctx); if (istBot(d, d.dran)) d.botTimer = setTimeout(() => botSchritt(raum, ctx), BOT_PAUSE); senden(raum, ctx); }, INTRO_MS);
    senden(raum, ctx);
  },
  beenden(raum) { const d = raum.daten; if (d) { clearTimeout(d.zeitTimer); clearTimeout(d.botTimer); } },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId: id }, typ, daten, ctx) {
    const d = raum.daten;
    if (d.phase === "ende" || !d.hand[id] || Date.now() < d.introBis) return; // während der Startanimation noch nichts
    if (raum.spieler[id]) raum.spieler[id].ohneEingabe = 0;
    const x = daten && typeof daten === "object" ? daten : {};
    if (typ === "abwerfen") return abwerfen(raum, ctx, id, x) || undefined;
    if (typ === "annehmen") return angebotAnnehmen(raum, ctx, id) || undefined;
    if (typ === "ablehnen") { if (d.angebot && d.angebot.von !== id && !d.angebot.nein.includes(id)) { d.angebot.nein.push(id); senden(raum, ctx); } return; }
    if (d.dran !== id) return;
    let r;
    switch (typ) {
      case "wuerfeln": r = d.phase === "spielen" ? wuerfeln(raum, ctx) : undefined; break;
      case "bauen": r = bauen(raum, ctx, id, x.art, x.ort); break;
      case "gemein": r = gemeinBauen(raum, ctx, id, x.was); break;
      case "kaufen": r = karteKaufen(raum, ctx, id); if (typeof r === "string" && !["Keine", "Dafür"].some((w) => r.startsWith(w))) r = undefined; break;
      case "spielen": r = karteSpielen(raum, ctx, id, x.karte, x.wahl); break;
      case "gewitter": r = gewitterSetzen(raum, ctx, x.feld); break;
      case "stehlen": r = stehlen(raum, ctx, x.opfer); break;
      case "markt": r = bankTausch(raum, ctx, id, x.gib, x.nimm); break;
      case "angebot": r = angebotMachen(raum, ctx, id, x.gib, x.will); break;
      case "zurueckziehen": d.angebot = null; senden(raum, ctx); break;
      case "fertig": r = zugEnde(raum, ctx); break;
    }
    return typeof r === "string" ? r : undefined;
  },
  spielerZurueck(raum, id, ctx) { if (raum.daten?.hand?.[id]) setTimeout(() => raum.daten && senden(raum, ctx), 50); },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    if (d.dran === id) zeitSetzen(raum, ctx, 8000);
    if (d.zug?.modus === "abwerfen" && d.abwerfen[id] && !raum.spieler[id]?.online) abwerfen(raum, ctx, id, botAbwurf(d.hand[id], d.abwerfen[id]));
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    const id = d.dran;
    const offen = d.phase !== "ende";
    return {
      phase: d.phase, dran: d.dran, runde: d.runde, saison: d.saison, aufbauSchritt: d.aufbauSchritt,
      belegung: d.belegung, gewitter: d.gewitter, bauten: d.bauten, wege: d.wege, gemein: d.gemein,
      zug: d.zug ? { wurf: d.zug.wurf, modus: d.zug.modus, gespielt: d.zug.gespielt, gratisWege: d.zug.gratisWege, opfer: d.zug.opfer || null } : null,
      wurfId: d.wurfId, letzterErtrag: d.letzterErtrag || null, letzterBau: d.letzterBau || null, letzteKarte: d.letzteKarte || null,
      abwerfen: d.zug?.modus === "abwerfen" ? d.abwerfen : {},
      moeglich: offen ? { hof: hofOrte(d, id), weg: wegOrte(d, id), gut: d.phase === "spielen" ? gutOrte(d, id) : [] } : null,
      kurs: Object.fromEntries(d.reihenfolge.map((x) => [x, kurs(d, x)])),
      amDorfplatz: Object.fromEntries(d.reihenfolge.map((x) => [x, amDorfplatz(d, x)])),
      karten: Object.fromEntries(d.reihenfolge.map((x) => [x, summe(d.hand[x])])),
      dorfkarten: Object.fromEntries(d.reihenfolge.map((x) => [x, d.karten[x].length])),
      punkteOffen: Object.fromEntries(d.reihenfolge.map((x) => [x, punkte(d, x, d.phase === "ende")])),
      kirchweihEnde: d.phase === "ende" ? d.kirchweih : null,
      laengsterWeg: d.laengsterWeg, wegLaengen: d.wegLaengen, feldwache: d.feldwache, wache: d.wache, bonusEreignis: d.bonusEreignis || null,
      stapel: d.stapel.length, angebot: d.angebot, ziel: einst(raum).ziel,
      gebaeude: d.gebaeude, jahreszeiten: d.jahreszeiten, startGabe: d.startGabe, introMs: Math.max(0, d.introBis - Date.now()),
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0, sekunden: einst(raum).sekunden,
      teilnehmer: teilnehmer(raum),
      farben: Object.fromEntries(d.reihenfolge.map((x, i) => [x, FARBEN[i]])),
      bots: d.bots.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, punkte: b.punkte, online: true, bot: true })),
      log: d.log.slice(-8), sieger: d.sieger || null,
      auszeichnungen: d.phase === "ende" ? d.auszeichnungen : null,
    };
  },
  _intern: { landschaftVerteilen, karteFair, wegLaenge, KARTE, MITTE, hofOrte, wegOrte, punkte, botSchritt },
};
