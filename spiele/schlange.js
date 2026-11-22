// =============================================================
//  Spiel-Modul: Schlangengrube (Echtzeit-Arena)
//  - Alle steuern gleichzeitig eine Schlange in einer runden Arena.
//  - Futter macht länger, Sprinten kostet Länge (und hinterlässt Futter).
//  - Wer mit dem Kopf in eine andere Schlange (oder den Rand) fährt, platzt zu Futter
//    und steigt nach kurzer Pause klein wieder ein.
//  - Wertung: größte erreichte Länge in der Runde (Gleichstand: mehr Fänge).
//  Netz: Der Server rechnet 20 Ticks pro Sekunde und schickt pro Tick nur Köpfe,
//  Masse und Futter-Änderungen. Der Browser baut die Körper aus den Kopfspuren nach
//  (genau wie der Server). Ein vollständiger Stand ("sg:k") kommt beim Start und auf Anfrage.
// =============================================================
const TICK = 50, DT = TICK / 1000;
const START_MASSE = 10, RESPAWN_MS = 2600, COUNTDOWN_MS = 3200;
const TEMPO = 140, SPRINT = 260;
const MAX_SCHLANGEN = 16;
const ZELLE = 64;
const BOTS = [
  { name: "Robo-Rudi", avatar: "🤖" }, { name: "Kara Kartenhai", avatar: "🦈" }, { name: "Professor Pixel", avatar: "👾" },
  { name: "Lotti Luchs", avatar: "🦊" }, { name: "Bruno Bär", avatar: "🐼" }, { name: "Gisela Gecko", avatar: "🦎" },
  { name: "Turbo-Toni", avatar: "🐆" }, { name: "Nina Natter", avatar: "🐍" }, { name: "Olli Otter", avatar: "🦦" },
  { name: "Wanda Wurm", avatar: "🪱" }, { name: "Kalle Kobra", avatar: "🐉" }, { name: "Fritzi Frosch", avatar: "🐸" },
];
const FARBEN = 12; // Farbmuster im Browser
const einst = (raum) => raum.einstellungen.schlange;
const laenge = (m) => 40 + m * 7;
const radius = (m) => 7 + Math.min(12, Math.sqrt(m) * 0.95);
const winkelDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const r1 = (v) => Math.round(v * 10) / 10;

// ---------- Futter ----------
function futterNeu(d, x, y, v, f) {
  const id = ++d.futterNr;
  const fu = { id, x, y, v, f: f ?? Math.floor(Math.random() * FARBEN) };
  d.futter.set(id, fu);
  const k = Math.floor(x / ZELLE) * 100003 + Math.floor(y / ZELLE);
  let z = d.futterRaster.get(k); if (!z) d.futterRaster.set(k, (z = new Set()));
  z.add(fu);
  d.neuesFutter.push(fu);
  return fu;
}
function futterWeg(d, f) {
  d.futter.delete(f.id);
  d.futterRaster.get(Math.floor(f.x / ZELLE) * 100003 + Math.floor(f.y / ZELLE))?.delete(f);
}
function zufallsPunkt(R, rand = 60) {
  const w = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (R - rand);
  return [Math.cos(w) * r, Math.sin(w) * r];
}
function futterAuffuellen(d, max = 30) {
  let n = 0;
  while (d.normalFutter < d.futterZiel && n++ < max) {
    const [x, y] = zufallsPunkt(d.R, 30);
    const fu = futterNeu(d, x, y, Math.random() < 0.1 ? 1.6 : 0.8);
    fu.normal = true;
    d.normalFutter++;
  }
}

// ---------- Schlangen ----------
function sichererPunkt(d) {
  let bester = null, besterAbstand = -1;
  for (let v = 0; v < 24; v++) {
    const [x, y] = zufallsPunkt(d.R, 260);
    let min = 1e9;
    for (const s of d.schlangen) if (s.lebt) for (let i = s.pfad.length - 1; i >= 0; i -= 3) { const p = s.pfad[i]; min = Math.min(min, Math.hypot(p[0] - x, p[1] - y)); }
    if (min > 320) return [x, y];
    if (min > besterAbstand) { besterAbstand = min; bester = [x, y]; }
  }
  return bester;
}
function einsetzen(d, s) {
  const [x, y] = sichererPunkt(d);
  s.x = x; s.y = y;
  s.a = Math.atan2(-y, -x) + (Math.random() - 0.5); // grob zur Mitte
  s.ziel = s.a; s.sprint = false;
  s.masse = START_MASSE; s.lebt = true; s.pfad = [];
  // Startspur hinter dem Kopf, damit die Schlange sofort ihre Länge hat
  const L = laenge(s.masse), schritte = Math.ceil(L / (TEMPO * DT));
  for (let i = schritte; i >= 0; i--) s.pfad.push([r1(x - Math.cos(s.a) * i * TEMPO * DT), r1(y - Math.sin(s.a) * i * TEMPO * DT)]);
  s.geboren = d.tick;
  s.spurLaenge = L;
}
function pfadKuerzen(s) {
  const L = laenge(s.masse);
  let summe = 0;
  for (let i = s.pfad.length - 1; i > 0; i--) {
    summe += Math.hypot(s.pfad[i][0] - s.pfad[i - 1][0], s.pfad[i][1] - s.pfad[i - 1][1]);
    if (summe >= L) { if (i > 1) s.pfad.splice(0, i - 1); return; }
  }
}

// Körperpunkte in ein Raster sortieren, damit Kollisionen schnell gehen
function rasterBauen(d) {
  const g = new Map();
  for (const s of d.schlangen) {
    if (!s.lebt) continue;
    const r = radius(s.masse);
    for (let i = 0; i < s.pfad.length; i++) {
      const p = s.pfad[i];
      const k = Math.floor(p[0] / ZELLE) * 100003 + Math.floor(p[1] / ZELLE);
      let z = g.get(k); if (!z) g.set(k, (z = []));
      z.push(p[0], p[1], s.i, r, i);
    }
  }
  d.raster = g;
}
// Liegt (x,y) in einer fremden Schlange? Gibt den Index der Schlange zurück (oder -1)
function treffer(d, x, y, eigen, extra) {
  const cx = Math.floor(x / ZELLE), cy = Math.floor(y / ZELLE);
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) {
    const z = d.raster.get(ix * 100003 + iy);
    if (!z) continue;
    for (let j = 0; j < z.length; j += 5) {
      if (z[j + 2] === eigen) continue;
      const dx = z[j] - x, dy = z[j + 1] - y, rr = z[j + 3] + extra;
      if (dx * dx + dy * dy < rr * rr) return z[j + 2];
    }
  }
  return -1;
}

function sterben(raum, ctx, s, moerder) {
  const d = raum.daten;
  s.lebt = false; s.tode++;
  s.respawnUm = d.tick + Math.round(RESPAWN_MS / TICK);
  // Körper zerfällt zu Futter (etwa 80 % der Masse)
  const n = Math.max(4, Math.min(60, Math.round(s.pfad.length / 3)));
  const wert = Math.max(0.6, (s.masse * 0.8) / n);
  for (let k = 0; k < n; k++) {
    const p = s.pfad[Math.floor((k / n) * s.pfad.length)];
    const st = radius(s.masse) * 0.8;
    const fx = p[0] + (Math.random() - 0.5) * st, fy = p[1] + (Math.random() - 0.5) * st;
    if (Math.hypot(fx, fy) < d.R - 10) futterNeu(d, fx, fy, r1(wert), s.farbe);
  }
  const m = moerder >= 0 ? d.schlangen[moerder] : null;
  if (m) { m.faenge++; m.serie = (m.serie || 0) + 1; }
  d.ereignisse.push({ typ: "tod", i: s.i, von: m ? m.i : -1, masse: Math.round(s.masse) });
  s.pfad = [];
}

// ---------- Computer-Gegner ----------
function botDenken(d, s) {
  const stufe = d.stufe;
  const takt = stufe === "einfach" ? 3 : stufe === "mittel" ? 2 : 1;
  if ((d.tick + s.i) % takt) return;
  const r = radius(s.masse);
  const weit = (stufe === "einfach" ? 55 : stufe === "mittel" ? 105 : 150) + r * 2;
  // Ziel: lohnendes Futter in der Nähe
  if (!s.beute || !d.futter.has(s.beute) || d.tick % 20 === s.i % 20) {
    let best = null, bw = -1;
    for (const f of d.futter.values()) {
      const dist = Math.hypot(f.x - s.x, f.y - s.y);
      if (dist > 520) continue;
      const vorne = Math.cos(winkelDiff(s.a, Math.atan2(f.y - s.y, f.x - s.x)));
      const w = (f.v + 0.4) / (dist + 40) * (1.3 + vorne);
      if (w > bw) { bw = w; best = f; }
    }
    s.beute = best ? best.id : null;
  }
  let wunsch = s.a + (Math.random() - 0.5) * 0.3;
  const beute = s.beute && d.futter.get(s.beute);
  if (beute) wunsch = Math.atan2(beute.y - s.y, beute.x - s.x);
  else wunsch = Math.atan2(-s.y, -s.x) + Math.sin(d.tick / 30 + s.i) * 1.2;
  // Schwer: kleineren Gegnern den Weg abschneiden
  s.jagt = false;
  if (stufe === "schwer" && s.masse > 22) {
    for (const o of d.schlangen) {
      if (o === s || !o.lebt || o.masse > s.masse * 0.9) continue;
      const dist = Math.hypot(o.x - s.x, o.y - s.y);
      if (dist < 260) {
        const vx = o.x + Math.cos(o.a) * 110, vy = o.y + Math.sin(o.a) * 110;
        wunsch = Math.atan2(vy - s.y, vx - s.x); s.jagt = true; break;
      }
    }
  }
  // Hindernisse abtasten: mehrere Strahlen, der freieste in Wunschrichtung gewinnt
  const strahlen = stufe === "einfach" ? 5 : 9;
  let besterWinkel = wunsch, besteWertung = -1e9, vorneFrei = weit;
  for (let k = 0; k < strahlen; k++) {
    const w = s.a + (k / (strahlen - 1) - 0.5) * Math.PI * (stufe === "einfach" ? 1.1 : 1.5);
    let frei = weit;
    for (let t = r + 6; t <= weit; t += 14) {
      const x = s.x + Math.cos(w) * t, y = s.y + Math.sin(w) * t;
      if (Math.hypot(x, y) > d.R - r - 6 || treffer(d, x, y, s.i, r + 3) >= 0) { frei = t; break; }
    }
    if (Math.abs(k - (strahlen - 1) / 2) < 0.6) vorneFrei = frei;
    const wert = frei * 1.2 + Math.cos(winkelDiff(w, wunsch)) * 45 - (frei < weit ? 120 : 0);
    if (wert > besteWertung) { besteWertung = wert; besterWinkel = w; }
  }
  // Einfach-Bots übersehen manchmal etwas
  s.ziel = stufe === "einfach" && Math.random() < 0.12 ? wunsch : vorneFrei < weit || besteWertung < 0 ? besterWinkel : wunsch;
  const nahBeute = beute && Math.hypot(beute.x - s.x, beute.y - s.y) < 140 && beute.v >= 2;
  s.sprint = s.masse > 18 && vorneFrei >= weit && ((s.jagt) || (nahBeute && stufe !== "einfach") || (stufe === "schwer" && Math.random() < 0.01));
}

// ---------- Ein Tick ----------
function tick(raum, ctx) {
  const d = raum.daten;
  if (!d || d.phase !== "spielen") return;
  d.tick++;
  d.ereignisse = []; d.neuesFutter = []; d.gefressen = [];
  rasterBauen(d);
  for (const s of d.schlangen) {
    if (!s.lebt) {
      if (d.tick >= s.respawnUm && (s.bot || raum.spieler[s.id]?.online)) { einsetzen(d, s); d.ereignisse.push({ typ: "da", i: s.i }); }
      continue;
    }
    if (s.bot) botDenken(d, s);
    // Lenken mit begrenzter Drehrate (dicke Schlangen sind träger)
    const r = radius(s.masse);
    const dreh = (4.6 - (r - 7) * 0.13) * DT;
    const diff = winkelDiff(s.a, s.ziel);
    s.a += Math.max(-dreh, Math.min(dreh, diff));
    const sprintet = s.sprint && s.masse > START_MASSE + 2;
    const v = (sprintet ? SPRINT : TEMPO) * DT;
    s.x += Math.cos(s.a) * v; s.y += Math.sin(s.a) * v;
    if (sprintet) {
      s.masse -= 0.11;
      s.spurFutter = (s.spurFutter || 0) + 0.11;
      if (s.spurFutter >= 0.5 && s.pfad.length > 2) { s.spurFutter = 0; const p = s.pfad[0]; futterNeu(d, p[0], p[1], 0.4, s.farbe); }
    }
    s.pfad.push([r1(s.x), r1(s.y)]);
    pfadKuerzen(s);
    s.best = Math.max(s.best, s.masse);
  }
  // Kollisionen (nach der Bewegung, gegen das Raster vom Tick-Anfang + neue Köpfe)
  rasterBauen(d);
  const tote = [];
  for (const s of d.schlangen) {
    if (!s.lebt) continue;
    const r = radius(s.masse);
    if (Math.hypot(s.x, s.y) > d.R - r * 0.6) { tote.push([s, -1]); continue; }
    if (d.tick - s.geboren < 30) continue; // kurzer Schutz nach dem Einsteigen
    const t = treffer(d, s.x, s.y, s.i, r * 0.55);
    if (t >= 0) {
      const o = d.schlangen[t];
      if (o.lebt && d.tick - o.geboren >= 30) tote.push([s, t]);
      else if (o.lebt === false) { /* nichts */ }
    }
  }
  // Kopf an Kopf (beide treffen sich gegenseitig): nur die kleinere platzt, bei Gleichstand der Zufall
  const trifft = new Map(tote.map(([s, von]) => [s.i, von]));
  const verschont = new Set();
  for (const [s, von] of tote) {
    if (von < 0 || trifft.get(von) !== s.i || verschont.has(s.i) || verschont.has(von)) continue;
    const o = d.schlangen[von];
    const sieger = s.masse > o.masse ? s : o.masse > s.masse ? o : Math.random() < 0.5 ? s : o;
    verschont.add(sieger.i);
  }
  for (const [s, von] of tote) if (s.lebt && !verschont.has(s.i)) sterben(raum, ctx, s, von);
  // Fressen
  for (const s of d.schlangen) {
    if (!s.lebt) continue;
    const reich = radius(s.masse) + 14;
    const cx = Math.floor(s.x / ZELLE), cy = Math.floor(s.y / ZELLE);
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) {
      const zelle = d.futterRaster.get(ix * 100003 + iy);
      if (!zelle) continue;
      for (const f of zelle) {
        if (!d.futter.has(f.id)) continue;
        const dx = f.x - s.x, dy = f.y - s.y;
        if (dx * dx + dy * dy < reich * reich) {
          s.masse += f.v; futterWeg(d, f); d.gefressen.push(f.id);
          if (f.normal) d.normalFutter--;
        }
      }
    }
  }
  // Altes Sprint-Futter verschwindet irgendwann
  if (d.futter.size > d.futterZiel * 3) {
    for (const f of d.futter.values()) { if (!f.normal && d.futter.size > d.futterZiel * 2.5) { futterWeg(d, f); d.gefressen.push(f.id); } }
  }
  futterAuffuellen(d);
  // Paket an alle
  ctx.funk(raum, "sg:t", {
    n: d.tick,
    s: d.schlangen.filter((s) => s.lebt).map((s) => [s.i, Math.round(s.x * 10), Math.round(s.y * 10), Math.round(s.a * 100), Math.round(s.masse * 10), s.sprint && s.masse > START_MASSE + 2 ? 1 : 0]),
    fe: d.gefressen,
    fn: d.neuesFutter.map((f) => [f.id, Math.round(f.x), Math.round(f.y), Math.round(f.v * 10), f.f]),
    ev: d.ereignisse,
  });
  if (d.ereignisse.length) ctx.sende(raum); // Fänge und Tode aktualisieren die Rangliste
  if (Date.now() >= d.endetUm) ende(raum, ctx);
}

function vollstaendig(d) {
  return {
    n: d.tick, R: d.R,
    s: d.schlangen.map((s) => ({ i: s.i, lebt: s.lebt, masse: Math.round(s.masse * 10), a: Math.round(s.a * 100), sprint: s.sprint ? 1 : 0, pfad: s.lebt ? s.pfad.flatMap((p) => [Math.round(p[0] * 10), Math.round(p[1] * 10)]) : [] })),
    f: [...d.futter.values()].map((f) => [f.id, Math.round(f.x), Math.round(f.y), Math.round(f.v * 10), f.f]),
  };
}

function ende(raum, ctx) {
  const d = raum.daten;
  clearInterval(d.intervall); clearTimeout(d.startTimer);
  d.phase = "ende";
  for (const s of d.schlangen) {
    const punkte = Math.round(s.best);
    if (s.bot) d.bots.find((b) => b.id === s.id).punkte = punkte;
    else if (raum.spieler[s.id]) raum.spieler[s.id].punkte = punkte;
  }
  const rang = [...d.schlangen].sort((a, b) => b.best - a.best || b.faenge - a.faenge);
  d.rangliste = rang.map((s) => ({ i: s.i, best: Math.round(s.best), faenge: s.faenge, tode: s.tode }));
  ctx.sende(raum);
}

function starten(raum, ctx) {
  const e = einst(raum);
  const menschen = Object.values(raum.spieler).filter((s) => s.online);
  if (menschen.length > MAX_SCHLANGEN) return `Schlangengrube geht mit höchstens ${MAX_SCHLANGEN} Spielern.`;
  const botAnzahl = Math.max(menschen.length < 2 ? 1 : 0, Math.min(e.bots, MAX_SCHLANGEN - menschen.length));
  const bots = mischen(BOTS).slice(0, botAnzahl).map((b, i) => ({ ...b, id: "bot" + (i + 1), punkte: 0, online: true, bot: true }));
  const farben = mischen([...Array(FARBEN).keys()]);
  const alle = [...menschen.map((s) => ({ id: s.id, bot: false })), ...bots.map((b) => ({ id: b.id, bot: true }))];
  const n = alle.length;
  const R = Math.round(Math.min(2300, 900 + n * 110));
  const d = raum.daten = {
    phase: "countdown", tick: 0, R, stufe: e.stufe || "mittel", bots,
    futter: new Map(), futterRaster: new Map(), futterNr: 0, normalFutter: 0, futterZiel: Math.round(110 + (R * R) / 11000),
    neuesFutter: [], gefressen: [], ereignisse: [], raster: new Map(),
    schlangen: alle.map((a, i) => ({ i, id: a.id, bot: a.bot, farbe: farben[i % FARBEN], best: START_MASSE, faenge: 0, tode: 0, lebt: false, pfad: [], masse: START_MASSE, x: 0, y: 0, a: 0, ziel: 0 })),
    startUm: Date.now() + COUNTDOWN_MS, endetUm: Date.now() + COUNTDOWN_MS + e.dauer * 1000,
  };
  futterAuffuellen(d, 1e4);
  for (const s of d.schlangen) einsetzen(d, s);
  d.neuesFutter = [];
  ctx.funk(raum, "sg:k", vollstaendig(d));
  d.startTimer = setTimeout(() => {
    if (raum.daten !== d) return;
    d.phase = "spielen";
    ctx.sende(raum);
    d.intervall = setInterval(() => { try { tick(raum, ctx); } catch (err) { console.error("Schlangengrube:", err); } }, TICK);
  }, COUNTDOWN_MS);
}

module.exports = {
  meta: () => ({ max: MAX_SCHLANGEN }),
  standardEinstellungen: () => ({ bots: 6, dauer: 180 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.bots !== undefined) neu.bots = Math.min(10, Math.max(0, parseInt(e.bots) || 0));
    if (e.dauer !== undefined) neu.dauer = [120, 180, 300].includes(+e.dauer) ? +e.dauer : 180;
    return neu;
  },
  starten,
  beenden(raum) { const d = raum.daten; if (d) { clearInterval(d.intervall); clearTimeout(d.startTimer); } },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d) return;
    const s = d.schlangen.find((x) => x.id === spielerId);
    if (typ === "sync") return void ctx.privat(raum, spielerId, "sg:k", vollstaendig(d));
    if (!s || typ !== "lenken" || !Array.isArray(daten)) return;
    const w = Number(daten[0]);
    if (Number.isFinite(w)) s.ziel = w;
    s.sprint = !!daten[1];
    if (raum.spieler[spielerId]) raum.spieler[spielerId].ohneEingabe = 0;
  },
  spielerZurueck(raum, id, ctx) { if (raum.daten) ctx.privat(raum, id, "sg:k", vollstaendig(raum.daten)); },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || raum.spieler[id]) return; // nur kurz weg: die Schlange fährt geradeaus weiter
    const s = d.schlangen.find((x) => x.id === id);
    if (s && s.lebt && d.phase === "spielen") sterben(raum, ctx, s, -1);
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    return {
      phase: d.phase, R: d.R,
      schlangen: d.schlangen.map((s) => ({ i: s.i, id: s.id, farbe: s.farbe, bot: s.bot, faenge: s.faenge, tode: s.tode, best: Math.round(s.best) })),
      bots: d.bots,
      startInMs: Math.max(0, d.startUm - Date.now()), restMs: Math.max(0, d.endetUm - Date.now()),
      rangliste: d.rangliste || null,
    };
  },
  _intern: { tick, laenge, radius },
};
