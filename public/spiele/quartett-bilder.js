// =============================================================
//  Quartett: Kartenbilder (alles SVG, im Browser gezeichnet)
//  - Szene pro Element (Feuer, Eis, Blitz, Stein, Wasser, Schatten, Wind, Licht)
//  - Drachen werden aus Bauteilen zusammengesetzt (Form, Flügel, Hörner, Schweif, Muster)
//  - Kung-Fu-Meister: Tier (Twemoji, CC-BY 4.0) vor ihrem Tempel
// =============================================================
const QuartettBilder = (() => {
  let zaehler = 0;

  // Gleicher Zufall für dieselbe Karte (damit Bilder immer gleich aussehen)
  function zufall(text) {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  const f = (n) => Math.round(n * 10) / 10;

  // Farbe aufhellen/abdunkeln (#rrggbb, -1..1)
  function ton(hex, wert) {
    const n = parseInt(hex.slice(1), 16);
    const k = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
      Math.round(wert >= 0 ? c + (255 - c) * wert : c * (1 + wert)));
    return "#" + k.map((c) => c.toString(16).padStart(2, "0")).join("");
  }

  // ---------- Hintergrund-Szene ----------
  const HIMMEL = {
    feuer: ["#2a0806", "#7a1d0c"], eis: ["#0b2440", "#3d7fb0"], blitz: ["#140a2e", "#4b2a8a"],
    stein: ["#2a2118", "#6b5440"], wasser: ["#03213a", "#0d6f8f"], schatten: ["#0a0614", "#2d1b4e"],
    wind: ["#08281f", "#2e8f6f"], licht: ["#3a2a05", "#c98d12"],
  };

  function szene(element, farbe, id, r) {
    const [oben, unten] = HIMMEL[element] || HIMMEL.schatten;
    let deko = "";
    const punkte = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join("");
    switch (element) {
      case "feuer":
        deko = `<path d="M0 150 L0 112 L38 92 L58 60 L72 58 L92 96 L130 104 L150 84 L200 110 L200 150Z" fill="#160403" opacity=".9"/>
          <path d="M58 60 L65 50 L72 58" fill="#ff6a2a" opacity=".8"/>
          ${punkte(16, () => `<circle cx="${f(r() * 200)}" cy="${f(r() * 120)}" r="${f(0.6 + r() * 1.6)}" fill="${r() > 0.5 ? "#ffb23d" : "#ff5a36"}" opacity="${f(0.4 + r() * 0.6)}"/>`)}`;
        break;
      case "eis":
        deko = `<path d="M0 150 L0 104 L30 70 L46 84 L74 46 L104 88 L126 66 L160 96 L180 78 L200 92 L200 150Z" fill="#dff3ff" opacity=".18"/>
          <path d="M74 46 L84 60 L78 58 L70 64 L64 58Z M30 70 L36 78 L26 80Z" fill="#fff" opacity=".5"/>
          ${punkte(18, () => `<circle cx="${f(r() * 200)}" cy="${f(r() * 140)}" r="${f(0.5 + r() * 1.3)}" fill="#fff" opacity="${f(0.3 + r() * 0.6)}"/>`)}`;
        break;
      case "blitz":
        deko = `<g fill="#0c0620" opacity=".75"><ellipse cx="40" cy="22" rx="46" ry="16"/><ellipse cx="150" cy="16" rx="60" ry="18"/><ellipse cx="100" cy="28" rx="40" ry="12"/></g>
          <path d="M160 26 L150 52 L158 52 L146 80 L168 46 L160 46 L170 26Z" fill="#ffe14d" opacity=".85"/>
          <path d="M30 34 L24 50 L30 50 L22 66 L38 46 L32 46 L38 34Z" fill="#ffe14d" opacity=".5"/>`;
        break;
      case "stein":
        deko = `<path d="M0 150 L0 96 L22 88 L30 64 L52 70 L60 100 L140 104 L152 72 L176 66 L186 90 L200 94 L200 150Z" fill="#140f0a" opacity=".85"/>
          ${punkte(7, () => { const x = r() * 200, y = 20 + r() * 60, s = 2 + r() * 4; return `<path d="M${f(x)} ${f(y)} l${f(s)} ${f(-s / 2)} l${f(s / 2)} ${f(s)} l${f(-s)} ${f(s / 2)}Z" fill="#c9a77c" opacity=".55"/>`; })}`;
        break;
      case "wasser":
        deko = `<path d="M0 118 Q25 108 50 118 T100 118 T150 118 T200 118 L200 150 L0 150Z" fill="#7ff0d8" opacity=".2"/>
          <path d="M0 128 Q25 118 50 128 T100 128 T150 128 T200 128 L200 150 L0 150Z" fill="#0a4f6a" opacity=".8"/>
          ${punkte(14, () => `<circle cx="${f(r() * 200)}" cy="${f(10 + r() * 100)}" r="${f(1 + r() * 2.5)}" fill="none" stroke="#bff" stroke-width=".7" opacity="${f(0.3 + r() * 0.5)}"/>`)}`;
        break;
      case "schatten":
        deko = `<circle cx="158" cy="30" r="16" fill="#f4ecff" opacity=".85"/><circle cx="165" cy="26" r="14" fill="${oben}"/>
          ${punkte(22, () => `<circle cx="${f(r() * 200)}" cy="${f(r() * 110)}" r="${f(0.4 + r() * 0.9)}" fill="#fff" opacity="${f(0.3 + r() * 0.7)}"/>`)}`;
        break;
      case "wind":
        deko = `${punkte(5, (i) => `<path d="M${f(-10 + r() * 60)} ${f(20 + i * 22)} q30 -10 60 0 t60 0" fill="none" stroke="#c8ffe9" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>`)}
          ${punkte(8, () => { const x = r() * 200, y = r() * 120; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="3" ry="1.4" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})" fill="#8ff0b5" opacity=".6"/>`; })}`;
        break;
      case "licht":
        deko = `<g opacity=".25" fill="#fff6c8">${punkte(12, (i) => `<path d="M100 40 L${f(100 + Math.cos(i * 0.5236) * 160)} ${f(40 + Math.sin(i * 0.5236) * 160)} L${f(100 + Math.cos(i * 0.5236 + 0.12) * 160)} ${f(40 + Math.sin(i * 0.5236 + 0.12) * 160)}Z"/>`)}</g>`;
        break;
    }
    return `<defs>
        <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${oben}"/><stop offset="1" stop-color="${unten}"/></linearGradient>
        <radialGradient id="${id}g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${farbe}" stop-opacity=".75"/><stop offset="1" stop-color="${farbe}" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="200" height="150" fill="url(#${id}h)"/>
      ${deko}
      <ellipse cx="100" cy="78" rx="92" ry="70" fill="url(#${id}g)"/>`;
  }

  // ---------- Hilfen für Drachen ----------
  // Weiche Kurve durch Punkte (Catmull-Rom) als dichte Punktliste
  function spline(p, schritte = 10) {
    const aus = [];
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      for (let s = 0; s < schritte; s++) {
        const t = s / schritte, t2 = t * t, t3 = t2 * t;
        aus.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    aus.push(p[p.length - 1]);
    return aus;
  }
  // Schlauch, der dünner wird (Schweif, Schlangenkörper, Hals)
  function rohr(punkte, b1, b2) {
    const n = punkte.length, links = [], rechts = [];
    punkte.forEach((p, i) => {
      const a = punkte[Math.max(0, i - 1)], c = punkte[Math.min(n - 1, i + 1)];
      const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const b = (b1 + (b2 - b1) * (i / (n - 1))) / 2;
      links.push([p[0] - (dy / l) * b, p[1] + (dx / l) * b]);
      rechts.push([p[0] + (dy / l) * b, p[1] - (dx / l) * b]);
    });
    const pts = [...links, ...rechts.reverse()];
    return "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L") + "Z";
  }

  function schweifSpitze(art, x, y, winkel, farbe, farbe2) {
    const t = `transform="translate(${f(x)} ${f(y)}) rotate(${f(winkel)})"`;
    switch (art) {
      case "keule": return `<g ${t}><circle r="7" fill="${farbe2}"/><path d="M0 -12 L3 -6 L-3 -6Z M10 -4 L5 1 L5 -5Z M-10 -4 L-5 -5 L-5 1Z" fill="#f3e6c8"/></g>`;
      case "flosse": return `<path ${t} d="M0 0 C6 -10 16 -14 22 -12 C16 -6 16 6 22 12 C14 14 6 10 0 0Z" fill="${farbe2}" opacity=".9"/>`;
      case "flamme": return `<g ${t}><path d="M0 0 C4 -8 2 -14 8 -20 C8 -12 14 -10 12 -2 C16 -6 18 -2 16 4 C12 10 2 8 0 0Z" fill="#ffb23d"/><path d="M2 0 C6 -4 6 -8 9 -11 C9 -6 12 -4 10 1 C8 4 4 4 2 0Z" fill="#fff1a8"/></g>`;
      case "blitz": return `<path ${t} d="M0 0 L8 -10 L5 -3 L14 -8 L4 6 L7 0Z" fill="#ffe14d"/>`;
      default: return `<path ${t} d="M0 0 L8 -9 L16 0 L8 9Z" fill="${farbe2}"/>`;
    }
  }

  function fluegel(art, d, id) {
    const haut = d.haut2, membran = ton(d.haut, 0.15);
    const halb = (skala = 1, dy = 0) => {
      if (art === "feder") {
        const federn = Array.from({ length: 7 }, (_, i) => {
          const w = -40 + i * 13, rad = (w * Math.PI) / 180, l = (46 - i * 3) * skala;
          const x = 20 + Math.cos(rad) * 26 * skala, y = -10 + dy + Math.sin(rad) * 26 * skala;
          return `<ellipse cx="${f(x + Math.cos(rad) * l / 2)}" cy="${f(y + Math.sin(rad) * l / 2)}" rx="${f(l / 2)}" ry="${f(6 * skala)}" transform="rotate(${f(w)} ${f(x + Math.cos(rad) * l / 2)} ${f(y + Math.sin(rad) * l / 2)})" fill="${i % 2 ? membran : ton(d.haut, 0.35)}" stroke="${haut}" stroke-width=".6"/>`;
        }).join("");
        return federn;
      }
      if (art === "flossen") {
        return `<path d="M18 ${-6 + dy} C40 ${-40 + dy} 70 ${-44 + dy} 86 ${-34 + dy} C74 ${-20 + dy} 70 ${-4 + dy} 74 ${14 + dy} C56 ${8 + dy} 36 ${10 + dy} 18 ${16 + dy}Z" transform="scale(${skala})" fill="${membran}" opacity=".75" stroke="${haut}" stroke-width="1.2"/>
          ${[0, 1, 2, 3].map((i) => `<path d="M20 ${4 + dy} L${f((86 - i * 4) * skala)} ${f((-34 + i * 15) * skala + dy * (1 - skala))}" stroke="${haut}" stroke-width="1" opacity=".7"/>`).join("")}`;
      }
      // Fledermaus-Flügel: Arm, Finger, Haut dazwischen
      const s = skala;
      const P = (x, y) => `${f(x * s)} ${f(y * s + dy)}`;
      return `<path d="M${P(16, -14)} L${P(58, -52)} L${P(98, -58)} Q${P(84, -40)} ${P(94, -26)} Q${P(76, -20)} ${P(82, 2)} Q${P(62, -2)} ${P(62, 22)} Q${P(42, 6)} ${P(20, 16)}Z" fill="${membran}" stroke="${haut}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M${P(16, -14)} L${P(58, -52)} L${P(98, -58)} M${P(58, -52)} L${P(94, -26)} M${P(58, -52)} L${P(82, 2)} M${P(58, -52)} L${P(62, 22)}" fill="none" stroke="${haut}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="${f(58 * s)}" cy="${f(-52 * s + dy)}" r="2.4" fill="#f3e6c8"/>`;
    };
    const paar = (inhalt) => `<g>${inhalt}</g><g transform="scale(-1 1)">${inhalt}</g>`;
    if (art === "keine") return "";
    if (art === "klein") return paar(halb(0.55, 4).replace(/stroke-width="2.4"/g, 'stroke-width="2"'));
    if (art === "vier") return paar(halb(1, -4)) + paar(halb(0.7, 26));
    return paar(halb(1, 0));
  }

  function kopf(d, id, skala = 1, baby = false) {
    const augenGr = baby ? 1.5 : 1;
    const horn = (i) => {
      const seite = i % 2 ? -1 : 1, reihe = Math.floor(i / 2);
      const bx = seite * (12 + reihe * 7), by = -22 + reihe * 5, l = 18 - reihe * 4;
      return `<path d="M${bx - seite * 3} ${by + 2} Q${bx + seite * (6 + reihe * 4)} ${by - l * 0.7} ${bx + seite * (10 + reihe * 6)} ${by - l} Q${bx + seite * 2} ${by - l * 0.4} ${bx + seite * 4} ${by + 2}Z" fill="url(#${id}horn)" stroke="${ton(d.haut2, -0.2)}" stroke-width=".6"/>`;
    };
    const auge = (seite) => `<g transform="translate(${seite * 11} -7) rotate(${seite * 14}) scale(${augenGr})">
        <path d="M-6 0 Q0 -6 6 0 Q0 4.5 -6 0Z" fill="${d.augen}"/>
        <ellipse rx="1.3" ry="${baby ? 2.6 : 3.2}" fill="#140a1c"/><circle cx="1.6" cy="-1.6" r="1" fill="#fff"/>
      </g>
      <path d="M${seite * 4} -13 Q${seite * 11} -17 ${seite * 18} -12" fill="none" stroke="${d.haut2}" stroke-width="3" stroke-linecap="round"/>`;
    return `<g transform="scale(${skala})">
      ${Array.from({ length: d.hoerner || 0 }, (_, i) => horn(i)).join("")}
      <path d="M-27 -10 L-38 -20 L-30 -2Z M27 -10 L38 -20 L30 -2Z" fill="${d.haut2}"/>
      <path d="M-26 -12 C-28 -30 28 -30 26 -12 C25 2 15 14 11 23 C7 30 -7 30 -11 23 C-15 14 -25 2 -26 -12Z" fill="url(#${id}koerper)" stroke="${ton(d.haut2, -0.3)}" stroke-width=".8"/>
      <ellipse cx="0" cy="17" rx="10.5" ry="8" fill="${ton(d.haut, 0.18)}"/>
      <ellipse cx="-4" cy="18" rx="1.6" ry="1.1" fill="${d.haut2}"/><ellipse cx="4" cy="18" rx="1.6" ry="1.1" fill="${d.haut2}"/>
      <path d="M-8 25 Q0 29 8 25" fill="none" stroke="${d.haut2}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M-6 25.5 L-5 28.5 L-4 25.8Z M6 25.5 L5 28.5 L4 25.8Z" fill="#fff"/>
      ${auge(-1)}${auge(1)}
      <path d="M-5 -22 L0 -30 L5 -22Z" fill="${d.haut2}"/>
      ${d.krone ? `<path d="M-14 -23 L-10 -34 L-5 -25 L0 -38 L5 -25 L10 -34 L14 -23Z" fill="#ffd23f" stroke="#b8860b" stroke-width=".8"/><circle cx="0" cy="-29" r="2" fill="${d.augen}"/>` : ""}
    </g>`;
  }

  function muster(d, form) {
    const r = zufall(d.haut + form);
    const in_ = (fn, n) => Array.from({ length: n }, () => fn()).join("");
    switch (d.muster) {
      case "kristall": return in_(() => { const x = -22 + r() * 44, y = -26 + r() * 56; return `<path d="M${f(x)} ${f(y)} l3 -6 l3 6 l-3 5Z" fill="#fff" opacity=".55"/>`; }, 7);
      case "streifen": return [-22, -10, 2].map((y) => `<path d="M-30 ${y} Q-20 ${y + 6} -12 ${y + 2} M30 ${y} Q20 ${y + 6} 12 ${y + 2}" stroke="${d.bauch}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`).join("");
      case "punkte": return in_(() => `<circle cx="${f(-26 + r() * 52)}" cy="${f(-24 + r() * 50)}" r="${f(1 + r() * 1.6)}" fill="${d.bauch}" opacity=".9"/>`, 10);
      case "risse": return `<path d="M-24 -18 L-14 -8 L-18 4 L-8 14 M22 -20 L14 -6 L20 6 L12 18" stroke="#ff7a1a" stroke-width="1.8" fill="none" opacity=".95"/>`;
      case "platten": return in_(() => { const x = -26 + r() * 52, y = -26 + r() * 50; return `<path d="M${f(x)} ${f(y)} l5 -2 l4 4 l-2 5 l-6 0Z" fill="${d.haut2}" opacity=".6"/>`; }, 8);
      default: return "";
    }
  }

  function drache(k, gruppe) {
    const d = k.d;
    const id = "qd" + k.id + (++zaehler);
    const r = zufall(k.id);
    const form = d.form;
    const skala = { klein: 0.82, baby: 0.72, schwer: 1.02, koenig: 1.06 }[form] || 0.95;
    const breite = form === "schwer" ? 1.22 : form === "koenig" ? 1.1 : 1;
    const defs = `<defs>
      <radialGradient id="${id}koerper" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${ton(d.haut, 0.25)}"/><stop offset=".6" stop-color="${d.haut}"/><stop offset="1" stop-color="${ton(d.haut, -0.35)}"/></radialGradient>
      <linearGradient id="${id}horn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e9dcc0"/><stop offset="1" stop-color="#fffaf0"/></linearGradient>
      <filter id="${id}geist"><feGaussianBlur stdDeviation="1.2"/></filter>
    </defs>`;

    let koerper;
    if (form === "schlange") {
      // Langer, gewundener Körper ohne Beine
      const pfad = spline([[-70, 52], [-30, 58], [20, 46], [42, 18], [18, -6], [-12, -12], [-6, -36], [0, -52]], 8);
      const zacken = pfad.filter((_, i) => i % 4 === 2 && i < pfad.length - 6).map(([x, y], i) => `<circle cx="${f(x)}" cy="${f(y - 8 + i * 0.1)}" r="2.4" fill="${d.haut2}"/>`).join("");
      koerper = `${fluegel(d.fluegel, d, id).replace(/<g>/, '<g transform="translate(0 -18)">').replace(/<g transform="scale\(-1 1\)">/, '<g transform="translate(0 -18) scale(-1 1)">')}
        <path d="${rohr(pfad, 8, 24)}" fill="url(#${id}koerper)" stroke="${ton(d.haut2, -0.2)}" stroke-width=".8"/>
        <path d="${rohr(pfad.map(([x, y]) => [x + 2, y + 2]), 3, 9)}" fill="${d.bauch}" opacity=".8"/>
        ${zacken}
        ${schweifSpitze(d.schweif, -70, 52, 180, d.haut, d.haut2)}
        <g transform="translate(0 -62)">${kopf(d, id, 0.85)}</g>`;
    } else {
      const baby = form === "baby";
      const schweifPfad = spline([[18, 36], [48, 50], [72, 40], [80, 16], [74, -2]], 8);
      const n = schweifPfad.length, a = schweifPfad[n - 2], b = schweifPfad[n - 1];
      const winkel = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const kopfY = baby ? -54 : -62;
      const koepfe = d.koepfe === 2
        ? `<path d="${rohr(spline([[-8, -30], [-18, -50], [-30, -62]], 6), 16, 11)}" fill="${d.haut}"/>
           <path d="${rohr(spline([[8, -30], [18, -50], [30, -62]], 6), 16, 11)}" fill="${d.haut}"/>
           <g transform="translate(-30 -70) rotate(-12)">${kopf(d, id, 0.7)}</g><g transform="translate(30 -70) rotate(12)">${kopf(d, id, 0.7)}</g>`
        : `<g transform="translate(0 ${kopfY})">${kopf(d, id, baby ? 1.18 : 1, baby)}</g>`;
      const ruecken = Array.from({ length: 4 }, (_, i) => `<path d="M${-6 + i * 4} ${-38 + i * 2} l2 -7 l2 7Z" fill="${d.haut2}"/>`).join("");
      koerper = `${fluegel(d.fluegel, d, id)}
        <path d="${rohr(schweifPfad, 16, 4)}" fill="url(#${id}koerper)" stroke="${ton(d.haut2, -0.2)}" stroke-width=".8"/>
        ${schweifSpitze(d.schweif, b[0], b[1], winkel, d.haut, d.haut2)}
        <g transform="scale(${breite} 1)">
          <ellipse cx="-27" cy="34" rx="13" ry="15" fill="${ton(d.haut, -0.12)}"/><ellipse cx="27" cy="34" rx="13" ry="15" fill="${ton(d.haut, -0.12)}"/>
          <path d="M0 -40 C26 -40 38 -10 36 14 C34 38 18 46 0 46 C-18 46 -34 38 -36 14 C-38 -10 -26 -40 0 -40Z" fill="url(#${id}koerper)" stroke="${ton(d.haut2, -0.3)}" stroke-width=".8"/>
          <path d="M0 -26 C14 -26 20 -6 20 12 C20 30 12 40 0 40 C-12 40 -20 30 -20 12 C-20 -6 -14 -26 0 -26Z" fill="${d.bauch}"/>
          ${[-14, -5, 4, 13, 22, 31].map((y) => `<path d="M-${f(17 - Math.abs(y - 8) * 0.25)} ${y} Q0 ${y + 3} ${f(17 - Math.abs(y - 8) * 0.25)} ${y}" stroke="${ton(d.bauch, -0.25)}" stroke-width=".9" fill="none"/>`).join("")}
          ${muster(d, form)}
          <ellipse cx="-31" cy="48" rx="12" ry="5" fill="${ton(d.haut, -0.25)}"/><ellipse cx="31" cy="48" rx="12" ry="5" fill="${ton(d.haut, -0.25)}"/>
          <path d="M-40 49 l2 4 l2 -4 M-34 50 l2 4 l2 -4 M-28 50 l2 4 l2 -4 M24 50 l2 4 l2 -4 M30 50 l2 4 l2 -4 M36 49 l2 4 l2 -4" stroke="#f3e6c8" stroke-width="1.4" fill="none"/>
          <path d="M-22 -8 Q-34 6 -26 20" stroke="${ton(d.haut, -0.15)}" stroke-width="8" fill="none" stroke-linecap="round"/>
          <path d="M22 -8 Q34 6 26 20" stroke="${ton(d.haut, -0.15)}" stroke-width="8" fill="none" stroke-linecap="round"/>
        </g>
        ${ruecken}${koepfe}`;
    }
    const basisY = form === "schlange" ? 92 : 96;
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      ${defs}${szene(gruppe.element, gruppe.farbe, id, r)}
      <ellipse cx="100" cy="140" rx="${form === "schlange" ? 60 : 46}" ry="6" fill="#000" opacity=".35"/>
      <g transform="translate(100 ${basisY}) scale(${f(skala * 0.82)})" ${d.geist ? `opacity=".82"` : ""}>
        ${d.geist ? `<g filter="url(#${id}geist)" opacity=".5">${koerper}</g>` : ""}${koerper}
      </g>
    </svg>`;
  }

  // ---------- Kung-Fu-Meister ----------
  function meister(k, gruppe) {
    const id = "qk" + k.id + (++zaehler);
    const r = zufall(k.id);
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      ${szene(gruppe.element, gruppe.farbe, id, r)}
      <g opacity=".55" fill="#000">
        <path d="M14 112 L14 92 L6 92 L24 80 L42 92 L34 92 L34 112Z M156 112 L156 86 L146 86 L170 70 L194 86 L184 86 L184 112Z"/>
        <path d="M150 74 Q170 60 190 74 M8 86 Q24 74 40 86" stroke="#000" stroke-width="3" fill="none"/>
      </g>
      <rect x="0" y="112" width="200" height="38" fill="#000" opacity=".35"/>
      <path d="M0 112 L200 112" stroke="${gruppe.farbe2}" stroke-width=".8" opacity=".5"/>
      <circle cx="100" cy="76" r="50" fill="none" stroke="${gruppe.farbe2}" stroke-width="1.5" stroke-dasharray="2 5" opacity=".7"/>
      <circle cx="100" cy="76" r="42" fill="${gruppe.farbe}" opacity=".18"/>
      <path d="M28 64 q16 -6 30 0 M30 76 q12 -4 24 0 M142 64 q16 -6 30 0 M146 76 q12 -4 24 0" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".45"/>
      <ellipse cx="100" cy="130" rx="40" ry="6" fill="#000" opacity=".45"/>
      <image href="/quartett/tiere/${k.tier}.svg" x="52" y="30" width="96" height="96"/>
    </svg>`;
  }

  return {
    bild(deck, k) {
      const gruppe = deck.gruppen.find((g) => g.id === k.gruppe);
      // Lizenzierte Decks: neutrales Symbol als Platzhalter, bis echte Bilder im Ordner liegen
      return k.d ? drache(k, gruppe) : meister(k, gruppe);
    },
  };
})();
