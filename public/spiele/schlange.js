// =============================================================
//  Schlangengrube – Browser-Teil
//  Canvas-Arena: Der Server schickt 20× pro Sekunde die Köpfe, der Browser baut daraus
//  die Körper nach und zeichnet mit 60 fps (Kopf wird zwischen zwei Ticks weich verschoben).
//  Steuern: Maus/Finger zeigt die Richtung, gedrückt halten / Leertaste / ⚡-Knopf = Sprint.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const TICK = 50;
  const laenge = (m) => 40 + m * 7;
  const radius = (m) => 7 + Math.min(12, Math.sqrt(m) * 0.95);
  // Farbmuster: Grundfarbe + Streifen
  const MUSTER = [
    ["#ff5a52", "#ffd1c9"], ["#4d8eff", "#cfe1ff"], ["#5fd36a", "#e0ffd0"], ["#ffcf3f", "#fff3c2"], ["#b363ff", "#ecd6ff"], ["#ff8a3d", "#ffe0c8"],
    ["#2ee6d6", "#cbfffa"], ["#ff5fb5", "#ffd3ec"], ["#9be15d", "#2f6b1f"], ["#f4f4f4", "#3a3a3a"], ["#6a5cff", "#ffcf3f"], ["#ff3b3b", "#1a1a1a"],
  ];

  // ---------- Welt im Browser ----------
  let welt = null; // { R, n, schlangen: Map(i → {...}), futter: Map }
  let lauf = null; // requestAnimationFrame-Schleife
  let eingabe = { w: 0, sprint: false, geaendert: false, zuletzt: 0 };
  let kamera = { x: 0, y: 0, z: 1 };
  let partikel = [];
  let feed = [];
  let ichTot = null, letzteTickZeit = 0, wackeln = 0;
  let futterTon = 0;

  function neueWelt(k) {
    welt = { R: k.R, n: k.n, schlangen: new Map(), futter: new Map() };
    for (const s of k.s) {
      const pfad = [];
      for (let j = 0; j < s.pfad.length; j += 2) pfad.push([s.pfad[j] / 10, s.pfad[j + 1] / 10]);
      welt.schlangen.set(s.i, { i: s.i, lebt: s.lebt, masse: s.masse / 10, a: s.a / 100, sprint: s.sprint, pfad, vorher: pfad[pfad.length - 1] || [0, 0], kopf: pfad[pfad.length - 1] || [0, 0] });
    }
    for (const f of k.f) welt.futter.set(f[0], futterObj(f));
    const ich = meine();
    if (ich?.lebt) { kamera.x = ich.kopf[0]; kamera.y = ich.kopf[1]; }
  }
  const futterObj = (f) => ({ id: f[0], x: f[1], y: f[2], v: f[3] / 10, f: f[4], geboren: performance.now(), phase: Math.random() * 6.3 });

  GN.socket.on("sg:k", (k) => { neueWelt(k); });
  GN.socket.on("sg:t", (t) => {
    if (!welt) return;
    if (t.n !== welt.n + 1) { welt.n = t.n; GN.aktion("sync"); return; }
    welt.n = t.n;
    letzteTickZeit = performance.now();
    const gesehen = new Set();
    for (const [i, x, y, a, m, sp] of t.s) {
      let s = welt.schlangen.get(i);
      if (!s) { s = { i, pfad: [] }; welt.schlangen.set(i, s); }
      if (!s.lebt) { s.pfad = []; s.lebt = true; s.neu = performance.now(); }
      const p = [x / 10, y / 10];
      s.vorher = s.pfad.length ? s.pfad[s.pfad.length - 1] : p;
      s.pfad.push(p);
      s.kopf = p; s.a = a / 100; s.masse = m / 10; s.sprint = sp;
      kuerzen(s);
      gesehen.add(i);
    }
    for (const id of t.fe) {
      const f = welt.futter.get(id);
      if (!f) continue;
      welt.futter.delete(id);
      // Futter fliegt in den Mund der nächsten Schlange
      let best = null, bd = 1e9;
      for (const s of welt.schlangen.values()) if (s.lebt) { const dd = Math.hypot(s.kopf[0] - f.x, s.kopf[1] - f.y); if (dd < bd) { bd = dd; best = s; } }
      if (best && bd < 60) {
        partikel.push({ typ: "schluck", x: f.x, y: f.y, ziel: best, t: 0, f: f.f, v: f.v });
        if (best.i === meinIndex() && performance.now() - futterTon > 70) { futterTon = performance.now(); Ton.tick?.(); }
      }
    }
    for (const f of t.fn) welt.futter.set(f[0], futterObj(f));
    for (const ev of t.ev) ereignis(ev);
  });

  function kuerzen(s) {
    const L = laenge(s.masse);
    let summe = 0;
    for (let i = s.pfad.length - 1; i > 0; i--) {
      summe += Math.hypot(s.pfad[i][0] - s.pfad[i - 1][0], s.pfad[i][1] - s.pfad[i - 1][1]);
      if (summe >= L) { if (i > 1) s.pfad.splice(0, i - 1); return; }
    }
  }

  const info = (i) => GN.zustand?.schlangen?.[i];
  const person = (i) => { const s = info(i); return s ? GN.spieler(s.id) : { name: "?", avatar: "🐍" }; };
  const meinIndex = () => GN.zustand?.schlangen?.find((s) => s.id === GN.ich)?.i ?? -1;
  const meine = () => welt?.schlangen.get(meinIndex());

  function ereignis(ev) {
    const s = welt.schlangen.get(ev.i);
    if (ev.typ === "tod") {
      if (s) {
        // Platzen: Funken entlang des Körpers
        const farbe = MUSTER[info(ev.i)?.farbe ?? 0];
        for (let k = 0; k < s.pfad.length; k += Math.max(1, Math.floor(s.pfad.length / 40))) {
          const p = s.pfad[k];
          partikel.push({ typ: "funke", x: p[0], y: p[1], vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, t: 0, dauer: 0.5 + Math.random() * 0.4, c: farbe[k % 2] });
        }
        s.lebt = false; s.pfad = [];
      }
      const ich = meinIndex();
      const opfer = person(ev.i), taeter = ev.von >= 0 ? person(ev.von) : null;
      feed.unshift({ t: performance.now(), html: taeter ? `${taeter.avatar} <b>${esc(taeter.name)}</b> hat ${opfer.avatar} ${esc(opfer.name)} gefressen` : `${opfer.avatar} ${esc(opfer.name)} ist gegen die Wand gefahren` });
      feed = feed.slice(0, 4);
      if (ev.i === ich) {
        ichTot = { von: taeter, masse: ev.masse, seit: performance.now() };
        Ton.falsch(); wackeln = 14; navigator.vibrate?.([60, 40, 90]);
      } else if (ev.von === ich) {
        (Ton.treffer || Ton.richtig)(); wackeln = 5; navigator.vibrate?.(40);
        GN.fx?.knall(`🍽️ ${esc(opfer.name)} gefressen!`, 1);
      }
    }
    if (ev.typ === "da" && ev.i === meinIndex()) { ichTot = null; const m = meine(); if (m) { kamera.x = m.kopf[0]; kamera.y = m.kopf[1]; } }
  }

  // ---------- Lobby ----------
  function abschnitte(z, host) {
    const e = z.einstellungen, dis = host ? "" : "disabled";
    return [{
      id: "arena", wichtig: true, icon: "🐍", titel: "Arena", info: `${e.bots} Bots · ${e.dauer / 60} min`,
      html: `<div class="einstellungs-zeile">
        <div><div class="unter-titel">Computer-Schlangen</div><div class="segment">${[0, 3, 6, 10].map((n) => `<button data-sg-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
        <div><div class="unter-titel">Rundenlänge</div><div class="segment">${[120, 180, 300].map((s) => `<button data-sg-dauer="${s}" class="${e.dauer === s ? "aktiv" : ""}" ${dis}>${s / 60} min</button>`).join("")}</div></div></div>`,
    }, {
      id: "regeln", icon: "📖", titel: "So geht's", info: "Fressen, wachsen, nicht anstoßen",
      html: `<ol class="q-regeln">
        <li>Deine Schlange folgt deinem <b>Finger bzw. der Maus</b>. Am PC gehen auch die Pfeiltasten.</li>
        <li>Leuchtendes <b>Futter</b> macht dich länger.</li>
        <li>Fährst du mit dem <b>Kopf</b> in eine andere Schlange oder an den Rand, platzt du zu Futter. Nach kurzer Pause geht's klein weiter.</li>
        <li>⚡ <b>Sprinten</b> (gedrückt halten, Leertaste oder Knopf) kostet Länge, ist aber perfekt, um anderen den Weg abzuschneiden.</li>
        <li>Gewertet wird deine <b>größte Länge</b> in der Runde.</li></ol>`,
    }];
  }
  function binde(el) {
    $$("[data-sg-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.sgBots })));
    $$("[data-sg-dauer]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ dauer: +b.dataset.sgDauer })));
  }

  // ---------- Spielansicht ----------
  function zeige(z) {
    if (z.phase === "ende") {
      if (/podest/.test(GN.ansicht)) return;
      if (GN.ansicht !== "sg-ende") endeZeigen(z);
      return;
    }
    if (GN.ansicht !== "sg-spiel" || !$(".sg-buehne")) aufbauen(z);
    hud(z);
  }

  function aufbauen(z) {
    GN.ansicht = "sg-spiel";
    GN.stoppeTimer();
    if (!welt) GN.aktion("sync");
    app.innerHTML = `
      <div class="sg-buehne" id="sgBuehne">
        <canvas id="sgCanvas"></canvas>
        <div class="sg-oben"><div class="sg-zeit" id="sgZeit"></div><div class="sg-feed" id="sgFeed"></div></div>
        <div class="sg-rang" id="sgRang"></div>
        <canvas class="sg-karte" id="sgKarte" width="120" height="120"></canvas>
        <div class="sg-ich" id="sgIch"></div>
        <button class="sg-sprint" id="sgSprint" aria-label="Sprinten">⚡</button>
        <div class="sg-mitte" id="sgMitte"></div>
      </div>`;
    const cv = $("#sgCanvas");
    const zeigen = (ev) => {
      const r = cv.getBoundingClientRect();
      const ich = meine();
      if (!ich) return;
      const hx = (ich.kopf[0] - kamera.x) * kamera.z + r.width / 2, hy = (ich.kopf[1] - kamera.y) * kamera.z + r.height / 2;
      const w = Math.atan2(ev.clientY - r.top - hy, ev.clientX - r.left - hx);
      if (Math.abs(w - eingabe.w) > 0.02) { eingabe.w = w; eingabe.geaendert = true; }
    };
    cv.addEventListener("pointermove", zeigen);
    cv.addEventListener("pointerdown", (ev) => { zeigen(ev); if (ev.pointerType === "mouse") sprint(true); });
    window.addEventListener("pointerup", sgPointerUp);
    const knopf = $("#sgSprint");
    knopf.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); sprint(true); });
    knopf.addEventListener("pointerup", () => sprint(false));
    knopf.addEventListener("pointercancel", () => sprint(false));
    knopf.addEventListener("pointerleave", () => sprint(false));
    window.addEventListener("keydown", sgTaste);
    window.addEventListener("keyup", sgTaste);
    if (!lauf) lauf = requestAnimationFrame(schleife);
  }
  function sgPointerUp(ev) { if (ev.pointerType === "mouse") sprint(false); }
  const tasten = {};
  function sgTaste(ev) {
    if (GN.ansicht !== "sg-spiel" || /input|textarea/i.test(ev.target.tagName)) return;
    const unten = ev.type === "keydown";
    if (ev.code === "Space") { ev.preventDefault(); sprint(unten); }
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(ev.code)) { ev.preventDefault(); tasten[ev.code] = unten; }
  }
  function sprint(an) {
    if (eingabe.sprint === an) return;
    eingabe.sprint = an; eingabe.geaendert = true;
    $("#sgSprint")?.classList.toggle("an", an);
    if (an) Ton.wusch?.();
  }
  function aufraeumen() {
    window.removeEventListener("pointerup", sgPointerUp);
    window.removeEventListener("keydown", sgTaste);
    window.removeEventListener("keyup", sgTaste);
  }

  function hud(z) {
    const rest = z.restMs, start = z.startInMs;
    $("#sgBuehne").dataset.phase = z.phase;
    hud.zeitBis = performance.now() + rest;
    hud.startBis = performance.now() + start;
  }

  // ---------- Zeichnen ----------
  let kachel = null, futterSprites = [];
  function vorbereiten() {
    if (kachel) return;
    // Sechseck-Boden als Muster
    const k = document.createElement("canvas"); k.width = 84; k.height = 48;
    const c = k.getContext("2d");
    c.fillStyle = "#141a24"; c.fillRect(0, 0, 84, 48);
    c.strokeStyle = "rgba(120, 160, 220, 0.09)"; c.lineWidth = 2;
    const sechs = (x, y) => { c.beginPath(); for (let i = 0; i < 6; i++) { const w = Math.PI / 3 * i; c.lineTo(x + Math.cos(w) * 14, y + Math.sin(w) * 14); } c.closePath(); c.stroke(); };
    sechs(0, 0); sechs(42, 0); sechs(84, 0); sechs(21, 24); sechs(63, 24); sechs(0, 48); sechs(42, 48); sechs(84, 48);
    kachel = k;
    futterSprites = MUSTER.map(([f]) => {
      const s = document.createElement("canvas"); s.width = s.height = 48;
      const g = s.getContext("2d");
      const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.18, f); grad.addColorStop(0.45, f + "88"); grad.addColorStop(1, f + "00");
      g.fillStyle = grad; g.fillRect(0, 0, 48, 48);
      return s;
    });
  }

  let letzteSendung = 0, letzterFrame = 0;
  function schleife(jetzt) {
    lauf = null;
    if (GN.zustand?.spiel !== "schlange" || !$("#sgCanvas")) { aufraeumen(); return; }
    lauf = requestAnimationFrame(schleife);
    const dt = Math.min(0.05, (jetzt - (letzterFrame || jetzt)) / 1000);
    letzterFrame = jetzt;
    // Pfeiltasten drehen die Richtung
    if (tasten.ArrowLeft || tasten.KeyA) { eingabe.w -= 3.2 * dt; eingabe.geaendert = true; }
    if (tasten.ArrowRight || tasten.KeyD) { eingabe.w += 3.2 * dt; eingabe.geaendert = true; }
    if (eingabe.geaendert && jetzt - letzteSendung > 66 && GN.zustand?.phase === "spielen") {
      eingabe.geaendert = false; letzteSendung = jetzt;
      GN.aktion("lenken", [Math.round(eingabe.w * 1000) / 1000, eingabe.sprint ? 1 : 0]);
    }
    zeichnen(jetzt, dt);
  }

  function zeichnen(jetzt, dt) {
    const cv = $("#sgCanvas");
    const dpr = Math.min(matchMedia("(pointer: coarse)").matches ? 1.5 : 2, window.devicePixelRatio || 1);
    const B = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(B * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(B * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext("2d");
    vorbereiten();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!welt) { c.fillStyle = "#0d1118"; c.fillRect(0, 0, B, H); return; }
    const alpha = Math.min(1.25, (jetzt - letzteTickZeit) / TICK);
    const kopfJetzt = (s) => s.vorher ? [s.vorher[0] + (s.kopf[0] - s.vorher[0]) * alpha, s.vorher[1] + (s.kopf[1] - s.vorher[1]) * alpha] : s.kopf;

    // Kamera folgt meinem Kopf (weich), zoomt mit der Größe heraus
    const ich = meine();
    const basis = Math.max(0.55, Math.min(1.1, Math.sqrt(B * H) / 820));
    let zielZ = basis;
    if (ich?.lebt) {
      const k = kopfJetzt(ich);
      kamera.x += (k[0] - kamera.x) * Math.min(1, dt * 9); kamera.y += (k[1] - kamera.y) * Math.min(1, dt * 9);
      zielZ = basis * Math.max(0.55, 1.08 - (radius(ich.masse) - 7) * 0.035);
    } else if (!ich) zielZ = Math.min(B, H) / (welt.R * 2.3);
    kamera.z += (zielZ - kamera.z) * Math.min(1, dt * 2);
    const z = kamera.z;
    let wx = 0, wy = 0;
    if (wackeln > 0.2) { wx = (Math.random() - 0.5) * wackeln; wy = (Math.random() - 0.5) * wackeln; wackeln *= 0.86; }
    const zuBild = (x, y) => [(x - kamera.x) * z + B / 2 + wx, (y - kamera.y) * z + H / 2 + wy];

    // Außen dunkel, innen Sechseck-Boden
    c.fillStyle = "#080a0f"; c.fillRect(0, 0, B, H);
    const [mx, my] = zuBild(0, 0);
    c.save();
    c.beginPath(); c.arc(mx, my, welt.R * z, 0, Math.PI * 2); c.clip();
    c.translate(mx, my); c.scale(z, z);
    if (!zeichnen.muster || zeichnen.musterCtx !== c) { zeichnen.muster = c.createPattern(kachel, "repeat"); zeichnen.musterCtx = c; }
    c.fillStyle = zeichnen.muster; c.fillRect(-welt.R, -welt.R, welt.R * 2, welt.R * 2);
    c.restore();
    // Rand glüht rot
    const puls = 0.55 + Math.sin(jetzt / 300) * 0.15;
    c.beginPath(); c.arc(mx, my, welt.R * z, 0, Math.PI * 2);
    c.lineWidth = 30 * z + 10; c.strokeStyle = `rgba(255, 60, 60, ${puls * 0.18})`; c.stroke();
    c.lineWidth = 8 * z + 4; c.strokeStyle = `rgba(255, 70, 70, ${puls})`; c.stroke();

    // Futter (nur was im Bild ist)
    const sichtbar = (x, y, rand) => { const [sx, sy] = zuBild(x, y); return sx > -rand && sy > -rand && sx < B + rand && sy < H + rand ? [sx, sy] : null; };
    c.globalCompositeOperation = "lighter";
    for (const f of welt.futter.values()) {
      const wob = Math.sin(jetzt / 400 + f.phase) * 2;
      const p = sichtbar(f.x + wob, f.y + Math.cos(jetzt / 500 + f.phase) * 2, 30);
      if (!p) continue;
      const rein = Math.min(1, (jetzt - f.geboren) / 300);
      const g = (8 + Math.sqrt(f.v) * 9) * z * rein * (1 + Math.sin(jetzt / 250 + f.phase) * 0.12);
      c.drawImage(futterSprites[f.f % futterSprites.length], p[0] - g, p[1] - g, g * 2, g * 2);
    }
    c.globalCompositeOperation = "source-over";

    // Schlangen: die eigene zuletzt (oben)
    const liste = [...welt.schlangen.values()].filter((s) => s.lebt && s.pfad.length).sort((a, b) => (a.i === meinIndex()) - (b.i === meinIndex()) || a.masse - b.masse);
    for (const s of liste) schlangeZeichnen(c, s, kopfJetzt(s), zuBild, z, jetzt);

    // Partikel
    partikel = partikel.filter((p) => {
      p.t += dt;
      if (p.typ === "schluck") {
        const k = p.ziel.lebt ? kopfJetzt(p.ziel) : [p.x, p.y];
        const q = Math.min(1, p.t / 0.18);
        const [sx, sy] = zuBild(p.x + (k[0] - p.x) * q, p.y + (k[1] - p.y) * q);
        const g = (6 + Math.sqrt(p.v) * 7) * z * (1 - q);
        c.globalCompositeOperation = "lighter";
        c.drawImage(futterSprites[p.f % futterSprites.length], sx - g, sy - g, g * 2, g * 2);
        c.globalCompositeOperation = "source-over";
        return q < 1;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
      const q = p.t / p.dauer;
      const [sx, sy] = zuBild(p.x, p.y);
      c.globalAlpha = Math.max(0, 1 - q); c.fillStyle = p.c;
      c.beginPath(); c.arc(sx, sy, (5 - q * 4) * z + 1, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      return q < 1;
    });

    if (jetzt - (zeichnen.hudZeit || 0) > 120) { zeichnen.hudZeit = jetzt; hudZeichnen(jetzt); }
    if (jetzt - (zeichnen.karteZeit || 0) > 100) { zeichnen.karteZeit = jetzt; minikarte(); }
  }

  function schlangeZeichnen(c, s, kopf, zuBild, z, jetzt) {
    const m = MUSTER[info(s.i)?.farbe ?? s.i % MUSTER.length];
    const r = radius(s.masse) * z;
    // Nur Punkte, die sichtbar etwas ändern (Abstand ≥ ~⅓ Radius), und nichts außerhalb des Bildes
    const pts = [];
    const B = c.canvas.clientWidth, H = c.canvas.clientHeight, rand = r * 2 + 40;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, lx = 1e9, ly = 1e9;
    const schritt = Math.max(1.5, r * 0.33);
    for (let i = 0; i < s.pfad.length - 1; i++) {
      const q = zuBild(s.pfad[i][0], s.pfad[i][1]);
      if (i > 0 && Math.abs(q[0] - lx) + Math.abs(q[1] - ly) < schritt) continue;
      pts.push(q); lx = q[0]; ly = q[1];
      if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
    }
    const kq = zuBild(kopf[0], kopf[1]);
    pts.push(kq);
    minX = Math.min(minX, kq[0]); maxX = Math.max(maxX, kq[0]); minY = Math.min(minY, kq[1]); maxY = Math.max(maxY, kq[1]);
    if (maxX < -rand || maxY < -rand || minX > B + rand || minY > H + rand) return;
    const neu = s.neu ? Math.min(1, (performance.now() - s.neu) / 400) : 1;
    // Schwanz zieht sich weich mit: erster Punkt Richtung zweitem verschieben
    const pfadZiehen = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); };
    c.lineCap = "round"; c.lineJoin = "round";
    c.globalAlpha = neu;
    if (s.sprint) { c.strokeStyle = m[0] + "30"; c.lineWidth = r * 2 + 18 * z; pfadZiehen(); c.stroke(); c.strokeStyle = m[0] + "55"; c.lineWidth = r * 2 + 8 * z; pfadZiehen(); c.stroke(); }
    // Schatten, Rand, Körper
    c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = r * 2 + 3; c.save(); c.translate(3 * z, 5 * z); pfadZiehen(); c.stroke(); c.restore();
    c.strokeStyle = "rgba(0,0,0,0.55)"; c.lineWidth = r * 2 + 3; pfadZiehen(); c.stroke();
    c.strokeStyle = m[0]; c.lineWidth = r * 2; pfadZiehen(); c.stroke();
    // Streifen: Punkte in festem Abstand ab dem Schwanz (wandern so nicht beim Wachsen)
    c.fillStyle = m[1];
    let summe = 0, naechster = r * 1.4;
    for (let i = 1; i < pts.length - 2; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      summe += Math.hypot(dx, dy);
      if (summe >= naechster) { naechster += r * 2.4; c.globalAlpha = 0.55 * neu; c.beginPath(); c.arc(pts[i][0], pts[i][1], r * 0.62, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = neu;
    // Glanzlinie
    c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = r * 0.55; c.save(); c.translate(-r * 0.28, -r * 0.32); pfadZiehen(); c.stroke(); c.restore();
    // Kopf mit Augen, die in Fahrtrichtung schauen
    const [hx, hy] = pts[pts.length - 1];
    const a = s.a;
    c.fillStyle = m[0]; c.beginPath(); c.arc(hx, hy, r * 1.08, 0, Math.PI * 2); c.fill();
    for (const seite of [-1, 1]) {
      const ex = hx + Math.cos(a + seite * 0.75) * r * 0.62, ey = hy + Math.sin(a + seite * 0.75) * r * 0.62;
      c.fillStyle = "#fff"; c.beginPath(); c.arc(ex, ey, r * 0.42, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#111"; c.beginPath(); c.arc(ex + Math.cos(a) * r * 0.16, ey + Math.sin(a) * r * 0.16, r * 0.22, 0, Math.PI * 2); c.fill();
    }
    // Name über anderen Schlangen
    if (s.i !== meinIndex() && z > 0.45) {
      const p = person(s.i);
      c.font = `800 ${Math.max(10, 12 * z)}px system-ui, sans-serif`; c.textAlign = "center";
      c.fillStyle = "rgba(255,255,255,0.75)"; c.fillText(`${p.avatar} ${p.name}`, hx, hy - r * 2.1);
    }
    c.globalAlpha = 1;
  }

  function hudZeichnen(jetzt) {
    const z = GN.zustand;
    if (!z?.schlangen) return;
    // Zeit
    const rest = Math.max(0, (hud.zeitBis || 0) - jetzt);
    const zeitTxt = `⏱️ ${Math.floor(rest / 60000)}:${String(Math.floor((rest % 60000) / 1000)).padStart(2, "0")}`;
    const ze = $("#sgZeit");
    if (ze.textContent !== zeitTxt) { ze.textContent = zeitTxt; ze.classList.toggle("knapp", rest < 15000 && z.phase === "spielen"); }
    // Rangliste nach aktueller Länge
    const rang = z.schlangen.map((s) => ({ ...s, m: welt?.schlangen.get(s.i)?.lebt ? welt.schlangen.get(s.i).masse : 0 })).sort((a, b) => b.m - a.m);
    const ichI = meinIndex();
    const meinPlatz = rang.findIndex((s) => s.i === ichI);
    const zeilen = rang.slice(0, 5);
    const rh = zeilen.map((s, k) => `<div class="${s.i === ichI ? "ich" : ""}"><span>${k + 1}.</span>${GN.spieler(s.id).avatar} <em>${esc(GN.spieler(s.id).name)}</em><b>${Math.round(s.m)}</b></div>`).join("")
      + (meinPlatz >= 5 ? `<div class="ich"><span>${meinPlatz + 1}.</span>${GN.spieler(GN.ich).avatar} <em>Du</em><b>${Math.round(rang[meinPlatz].m)}</b></div>` : "");
    const re = $("#sgRang");
    if (re.dataset.h !== rh) { re.dataset.h = rh; re.innerHTML = rh; }
    // Eigene Werte
    const ich = meine(), mi = info(ichI);
    const ih = ich?.lebt ? `<b>${Math.round(ich.masse)}</b> lang · 🍽️ ${mi?.faenge || 0} · 🏆 ${Math.max(mi?.best || 0, Math.round(ich.masse))}` : "";
    const ie = $("#sgIch");
    if (ie.dataset.h !== ih) { ie.dataset.h = ih; ie.innerHTML = ih; }
    // Feed (verblasst nach 4 s)
    feed = feed.filter((f) => jetzt - f.t < 4000);
    const fh = feed.map((f) => `<div>${f.html}</div>`).join("");
    const fe = $("#sgFeed");
    if (fe.dataset.h !== fh) { fe.dataset.h = fh; fe.innerHTML = fh; }
    // Mitte: Countdown oder "gefressen"
    let mh = "";
    if (z.phase === "countdown") {
      const s = Math.ceil(Math.max(0, (hud.startBis || 0) - jetzt) / 1000);
      mh = `<div class="sg-count" data-n="${s}">${s > 0 ? s : "Los!"}</div><div class="sg-tipp">${matchMedia("(pointer: coarse)").matches ? "Finger zeigt die Richtung · ⚡ zum Sprinten" : "Maus zeigt die Richtung · Klick oder Leertaste = Sprint"}</div>`;
      if (s !== hudZeichnen.letzteZahl) { hudZeichnen.letzteZahl = s; if (s > 0) Ton.tick?.(); }
    } else if (ichTot && mi) {
      const wie = ichTot.von ? `${ichTot.von.avatar} ${esc(ichTot.von.name)} hat dich gefressen!` : "Autsch, die Wand!";
      mh = `<div class="sg-tot"><div class="sg-tot-titel">💥 ${wie}</div><div>Du warst <b>${ichTot.masse}</b> lang. Gleich geht's weiter …</div></div>`;
    } else if (hudZeichnen.letzteZahl === 0) { hudZeichnen.letzteZahl = -1; Ton.fanfare?.(); }
    const me = $("#sgMitte");
    if (me.dataset.h !== mh) { me.dataset.h = mh; me.innerHTML = mh; }
  }

  function minikarte() {
    const k = $("#sgKarte");
    if (!k || !welt) return;
    const c = k.getContext("2d"), G = 120, s = (G / 2 - 4) / welt.R;
    c.clearRect(0, 0, G, G);
    c.fillStyle = "rgba(10, 14, 22, 0.75)"; c.beginPath(); c.arc(G / 2, G / 2, G / 2 - 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255, 80, 80, 0.7)"; c.lineWidth = 2; c.stroke();
    const ichI = meinIndex();
    for (const sch of welt.schlangen.values()) {
      if (!sch.lebt) continue;
      const m = MUSTER[info(sch.i)?.farbe ?? 0];
      const [x, y] = sch.kopf;
      const g = sch.i === ichI ? 4 : 1.5 + Math.min(3, sch.masse / 120);
      c.fillStyle = sch.i === ichI ? "#fff" : m[0];
      c.beginPath(); c.arc(G / 2 + x * s, G / 2 + y * s, g, 0, Math.PI * 2); c.fill();
    }
  }

  // ---------- Ende ----------
  function endeZeigen(z) {
    GN.ansicht = "sg-ende";
    aufraeumen();
    const r = z.rangliste || [];
    const ichI = meinIndex();
    const platz = r.findIndex((x) => x.i === ichI);
    if (platz === 0) { Ton.fanfare(); GN.konfetti(180); } else Ton.ding?.();
    app.innerHTML = `<div class="sg-ergebnis">
      <h2>🐍 Runde vorbei!</h2>
      <p class="leise">${platz >= 0 ? `Du bist auf Platz <b>${platz + 1}</b> von ${r.length}.` : ""}</p>
      <div class="sg-tabelle">${r.map((x, k) => { const p = person(x.i); const m = MUSTER[info(x.i)?.farbe ?? 0]; return `<div class="sg-zeile ${x.i === ichI ? "ich" : ""}" style="--f:${m[0]};--i:${k}"><span class="sg-platz">${k + 1}</span><span class="sg-farbe"></span>${p.avatar} <b>${esc(p.name)}</b><span class="sg-werte"><em>📏 ${x.best}</em><em>🍽️ ${x.faenge}</em><em>💥 ${x.tode}</em></span></div>`; }).join("")}</div>
    </div>`;
    setTimeout(() => GN.zustand?.phase === "ende" && GN.ansicht === "sg-ende" && GN.podest("sg-podest", { einheit: "lang" }), 6000);
  }

  GN.spiele.schlange = {
    icon: "🐍",
    titel: "Schlangengrube",
    kurz: "Fressen, wachsen, abschneiden – Echtzeit-Schlangen-Arena für alle gleichzeitig.",
    beschreibung: "Alle steuern gleichzeitig eine Schlange durch die Grube. Friss leuchtendes Futter, werde riesig und schneide den anderen den Weg ab. Wer mit dem Kopf anstößt, platzt zu Futter!",
    tags: ["⚡ Echtzeit", "📱 Handy & PC", "👥 1–16 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
