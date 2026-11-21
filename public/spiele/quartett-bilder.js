// =============================================================
//  Quartett: Kartenbilder (alles SVG, im Browser gezeichnet)
//  - Szene pro Element (Feuer, Eis, Blitz, Stein, Wasser, Schatten, Wind, Licht)
//  - Platzhalter: Symbol (Twemoji, CC-BY 4.0) vor einer Szene im Gruppen-Element,
//    bis die offiziellen Bilder in public/quartett/bilder/ liegen
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

  // ---------- Platzhalter-Bild ----------
  function meister(k, gruppe, { nurSzene = false } = {}) {
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
      ${nurSzene ? "" : `<image href="/quartett/tiere/${k.tier}.svg" x="52" y="30" width="96" height="96"/>`}
    </svg>`;
  }

  return {
    bild(deck, k, opt = {}) {
      const gruppe = deck.gruppen.find((g) => g.id === k.gruppe);
      // Neutrales Symbol als Platzhalter, bis echte Bilder im Ordner liegen
      return meister(k, gruppe, opt);
    },
  };
})();
