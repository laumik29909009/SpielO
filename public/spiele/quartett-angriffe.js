// =============================================================
//  Quartett: Spezialangriffe (Effekte mit DOM-Partikeln + Web Animations)
//  QuartettAngriffe.spiele(ov, art, { von, nach, farbe, objekt, kraft })
//  von/nach: [x, y] in Bildschirm-Pixeln, kraft: 0.4–1.2 (Größe/Dichte)
//  Jede Art ist ein eigener Effekt; Farbe und Objekt machen jede Karte einzigartig.
// =============================================================
const QuartettAngriffe = (() => {
  const DAUER = 700;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function teil(ov, x, y, css, klasse = "") {
    const el = document.createElement("i");
    el.className = "qa " + klasse;
    el.style.cssText = `left:${x}px;top:${y}px;${css}`;
    ov.appendChild(el);
    return el;
  }
  const ab = (el, frames, opt) => { el.animate(frames, { fill: "forwards", ...opt }).onfinish = () => el.remove(); };
  const tr = (dx, dy, s = 1, r = 0) => `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${s}) rotate(${r}deg)`;
  const glanz = (f) => `background:${f};box-shadow:0 0 12px ${f},0 0 24px ${f}`;

  const ARTEN = {
    // Dichter Strahl aus vielen Partikeln
    strahl(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      const n = Math.round(30 * kraft);
      for (let i = 0; i < n; i++) {
        const g = rnd(10, 24) * kraft, st = rnd(-14, 14);
        const el = teil(ov, von[0], von[1], `width:${g}px;height:${g}px;border-radius:50%;${glanz(i % 3 ? farbe : "#fff")};mix-blend-mode:screen;filter:blur(1px)`);
        ab(el, [{ transform: tr(0, 0, 0.3), opacity: 1 }, { transform: tr(dx + st, dy + st, 1.6), opacity: 0 }], { duration: 480, delay: i * 14, easing: "linear" });
      }
      return 480 + n * 14;
    },
    // Große Kugel mit Schweif
    feuerball(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      const g = 46 * kraft;
      const k = teil(ov, von[0], von[1], `width:${g}px;height:${g}px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,${farbe} 45%,transparent 72%);box-shadow:0 0 30px ${farbe}`);
      ab(k, [{ transform: tr(0, 0, 0.4) }, { transform: tr(dx, dy, 1.3) }], { duration: DAUER, easing: "cubic-bezier(.5,0,.8,.6)" });
      for (let i = 0; i < 14; i++) {
        setTimeout(() => {
          if (!ov.isConnected) return;
          const t = i / 14;
          const el = teil(ov, von[0] + dx * t, von[1] + dy * t, `width:${g * 0.5}px;height:${g * 0.5}px;border-radius:50%;${glanz(farbe)};opacity:.7`);
          ab(el, [{ transform: tr(0, 0, 1), opacity: 0.7 }, { transform: tr(rnd(-10, 10), rnd(-10, 10), 0.1), opacity: 0 }], { duration: 400 });
        }, i * 45);
      }
      return DAUER;
    },
    // Salve aus spitzen Geschossen
    stacheln(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      const w = (Math.atan2(dy, dx) * 180) / Math.PI;
      const n = Math.round(9 * kraft) + 3;
      for (let i = 0; i < n; i++) {
        const st = rnd(-30, 30);
        const el = teil(ov, von[0], von[1], `width:26px;height:6px;clip-path:polygon(0 0,100% 50%,0 100%,18% 50%);background:linear-gradient(90deg,transparent,${farbe},#fff);filter:drop-shadow(0 0 4px ${farbe})`);
        ab(el, [{ transform: tr(0, 0, 1, w) }, { transform: tr(dx + st, dy + st, 1, w) }], { duration: 420, delay: i * 50, easing: "cubic-bezier(.3,0,.8,1)" });
      }
      return 420 + n * 50;
    },
    // Zuckender Blitz
    blitz(ov, { von, nach, farbe }) {
      for (let r = 0; r < 3; r++) {
        setTimeout(() => {
          if (!ov.isConnected) return;
          const p = [von];
          for (let i = 1; i < 8; i++) { const t = i / 8; p.push([von[0] + (nach[0] - von[0]) * t + rnd(-30, 30), von[1] + (nach[1] - von[1]) * t + rnd(-30, 30)]); }
          p.push(nach);
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "qa-svg");
          const pts = p.map((q) => q.join(",")).join(" ");
          svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${farbe}" stroke-width="12" opacity=".4" stroke-linejoin="round"/><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>`;
          svg.style.filter = `drop-shadow(0 0 8px ${farbe})`;
          ov.appendChild(svg);
          ab(svg, [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }, { opacity: 0 }], { duration: 260 });
        }, r * 180);
      }
      return 620;
    },
    // Druck- oder Schallwelle (Bögen, die sich ausbreiten)
    welle(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      const w = (Math.atan2(dy, dx) * 180) / Math.PI;
      for (let i = 0; i < 5; i++) {
        const el = teil(ov, von[0], von[1], `width:${70 * kraft}px;height:${110 * kraft}px;border-radius:50%;border:5px solid ${farbe};border-left-color:transparent;border-top-color:transparent;border-bottom-color:transparent;filter:drop-shadow(0 0 6px ${farbe})`);
        ab(el, [{ transform: tr(0, 0, 0.4, w), opacity: 1 }, { transform: tr(dx, dy, 1.6, w), opacity: 0.1 }], { duration: 560, delay: i * 90, easing: "ease-out" });
      }
      return 560 + 4 * 90;
    },
    // Wirbel, der sich dreht und auf das Ziel zuschießt
    wirbel(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      for (let i = 0; i < 3; i++) {
        const g = (40 + i * 18) * kraft;
        const el = teil(ov, von[0], von[1], `width:${g}px;height:${g}px;border-radius:50%;border:4px dashed ${farbe};border-color:${farbe} transparent ${farbe} transparent;filter:drop-shadow(0 0 6px ${farbe})`);
        ab(el, [{ transform: tr(0, 0, 0.3, 0), opacity: 1 }, { transform: tr(dx, dy, 1, 900 + i * 120), opacity: 0.9 }, { transform: tr(dx, dy, 1.4, 1100), opacity: 0 }], { duration: 760, easing: "ease-in" });
      }
      return 760;
    },
    // Drei Kratzer erscheinen auf dem Ziel
    krallen(ov, { nach, farbe }) {
      for (let i = 0; i < 3; i++) {
        const el = teil(ov, nach[0] + (i - 1) * 22, nach[1], `width:9px;height:120px;border-radius:99px;background:linear-gradient(${farbe},#fff,${farbe});box-shadow:0 0 14px ${farbe}`);
        ab(el, [{ transform: tr(0, 0, 1, 25) + " scaleY(0)", opacity: 1, offset: 0 }, { transform: tr(0, 0, 1, 25), opacity: 1, offset: 0.4 }, { transform: tr(0, 0, 1, 25), opacity: 0 }],
          { duration: 600, delay: 150 + i * 70, easing: "ease-out" });
      }
      return 750;
    },
    // Sprung-Angriff: Aufprall-Stern am Ziel (die Karte selbst springt über die Hauptanimation)
    sprung(ov, { nach, farbe, kraft }) {
      const el = teil(ov, nach[0], nach[1], `width:${140 * kraft}px;height:${140 * kraft}px;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);background:radial-gradient(#fff,${farbe})`);
      ab(el, [{ transform: tr(0, 0, 0.1, -20), opacity: 1 }, { transform: tr(0, 0, 1.2, 10), opacity: 1, offset: 0.5 }, { transform: tr(0, 0, 1.5, 20), opacity: 0 }], { duration: 520, delay: 260, easing: "ease-out" });
      return 780;
    },
    // Viele kleine Geschosse fallen von oben auf das Ziel
    regen(ov, { nach, farbe, objekt, kraft }) {
      const n = Math.round(16 * kraft);
      for (let i = 0; i < n; i++) {
        const x = nach[0] + rnd(-80, 80);
        const el = objekt
          ? teil(ov, x, nach[1] - 260, `font-size:22px;line-height:1;filter:drop-shadow(0 0 4px ${farbe})`, "qa-text")
          : teil(ov, x, nach[1] - 260, `width:5px;height:22px;border-radius:99px;${glanz(farbe)}`);
        if (objekt) el.textContent = objekt;
        ab(el, [{ transform: tr(0, 0, 1, objekt ? 0 : 15), opacity: 0 }, { transform: tr(-20, 130, 1, objekt ? 90 : 15), opacity: 1, offset: 0.5 }, { transform: tr(-40, 260, 1, objekt ? 180 : 15), opacity: 0 }],
          { duration: 520, delay: i * 35, easing: "ease-in" });
      }
      return 520 + n * 35;
    },
    // Eiskristalle schießen los und frieren das Ziel ein
    eis(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      for (let i = 0; i < Math.round(14 * kraft); i++) {
        const g = rnd(10, 22);
        const el = teil(ov, von[0], von[1], `width:${g}px;height:${g}px;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:linear-gradient(135deg,#fff,${farbe});filter:drop-shadow(0 0 6px ${farbe})`);
        ab(el, [{ transform: tr(0, 0, 0.3, 0) }, { transform: tr(dx + rnd(-25, 25), dy + rnd(-25, 25), 1.2, 360) }], { duration: 520, delay: i * 30, easing: "ease-out" });
      }
      const frost = teil(ov, nach[0], nach[1], `width:160px;height:160px;border-radius:30%;background:radial-gradient(${farbe}cc,transparent 70%);mix-blend-mode:screen`);
      ab(frost, [{ opacity: 0, transform: tr(0, 0, 0.5) }, { opacity: 1, transform: tr(0, 0, 1), offset: 0.6 }, { opacity: 0, transform: tr(0, 0, 1.2) }], { duration: 900, delay: 350 });
      return 900;
    },
    // Wolke zieht hinüber, dann ein Funke (Gas, Rauch, Nebel)
    nebel(ov, { von, nach, farbe, kraft }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      for (let i = 0; i < 10; i++) {
        const g = rnd(40, 80) * kraft;
        const el = teil(ov, von[0], von[1], `width:${g}px;height:${g}px;border-radius:50%;background:${farbe};filter:blur(10px);opacity:.6`);
        ab(el, [{ transform: tr(0, 0, 0.3), opacity: 0 }, { transform: tr(dx * 0.6, dy * 0.6, 1, 0), opacity: 0.6, offset: 0.5 }, { transform: tr(dx + rnd(-30, 30), dy + rnd(-30, 30), 1.5), opacity: 0 }],
          { duration: 760, delay: i * 30, easing: "ease-out" });
      }
      const knall = teil(ov, nach[0], nach[1], `width:120px;height:120px;border-radius:50%;background:radial-gradient(#fff,#ffcf4a 40%,transparent 70%)`);
      ab(knall, [{ transform: tr(0, 0, 0.1), opacity: 1 }, { transform: tr(0, 0, 1.6), opacity: 0 }], { duration: 400, delay: 620 });
      return 1000;
    },
    // Schnelle Schlagfolge: mehrere kleine Treffer hintereinander
    schlag(ov, { nach, farbe }) {
      for (let i = 0; i < 5; i++) {
        const el = teil(ov, nach[0] + rnd(-50, 50), nach[1] + rnd(-60, 60), `width:46px;height:46px;border-radius:50%;border:4px solid ${farbe};box-shadow:0 0 12px ${farbe}`);
        ab(el, [{ transform: tr(0, 0, 0.2), opacity: 1 }, { transform: tr(0, 0, 1.4), opacity: 0 }], { duration: 300, delay: 100 + i * 110 });
      }
      return 750;
    },
    // Boden bebt: Felsbrocken schießen unter dem Ziel hervor
    beben(ov, { nach, farbe, kraft }) {
      document.querySelector(".q-kampf-feld")?.animate([{ transform: "translate(0,0)" }, { transform: "translate(-6px,3px)" }, { transform: "translate(6px,-3px)" }, { transform: "translate(0,0)" }], { duration: 160, iterations: 4 });
      for (let i = 0; i < Math.round(9 * kraft); i++) {
        const g = rnd(14, 30);
        const el = teil(ov, nach[0] + rnd(-90, 90), nach[1] + 120, `width:${g}px;height:${g}px;clip-path:polygon(20% 0,90% 15%,100% 70%,40% 100%,0 60%);background:${farbe}`);
        ab(el, [{ transform: tr(0, 0, 1, 0), opacity: 1 }, { transform: tr(rnd(-30, 30), -rnd(140, 220), 1, rnd(-200, 200)), opacity: 1, offset: 0.6 }, { transform: tr(rnd(-40, 40), -80, 1, 300), opacity: 0 }],
          { duration: 700, delay: i * 40, easing: "cubic-bezier(.2,.8,.4,1)" });
      }
      return 800;
    },
    // Peitsche: geschwungene Linie, die zum Ziel schnalzt
    peitsche(ov, { von, nach, farbe }) {
      const mx = (von[0] + nach[0]) / 2 + rnd(-60, 60), my = Math.min(von[1], nach[1]) - 120;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "qa-svg");
      svg.innerHTML = `<path d="M${von[0]} ${von[1]} Q${mx} ${my} ${nach[0]} ${nach[1]}" fill="none" stroke="${farbe}" stroke-width="9" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`;
      svg.style.filter = `drop-shadow(0 0 8px ${farbe})`;
      ov.appendChild(svg);
      const pfad = svg.querySelector("path");
      pfad.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.55 }, { strokeDashoffset: -1 }], { duration: 650, fill: "forwards", easing: "ease-in-out" }).onfinish = () => svg.remove();
      return 650;
    },
    // Ein Gegenstand wird geworfen und dreht sich dabei
    werfen(ov, { von, nach, objekt = "⭐", farbe }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      for (let i = 0; i < 3; i++) {
        const el = teil(ov, von[0], von[1], `font-size:${44 - i * 8}px;line-height:1;filter:drop-shadow(0 0 8px ${farbe})`, "qa-text");
        el.textContent = objekt;
        ab(el, [{ transform: tr(0, 0, 0.5, 0) }, { transform: tr(dx / 2, dy / 2 - 120, 1.2, 360), offset: 0.5 }, { transform: tr(dx + rnd(-20, 20), dy, 1, 720) }],
          { duration: 700, delay: i * 120, easing: "linear" });
      }
      return 940;
    },
    // Chi-Spirale mit Blättern oder Lichtpunkten
    chi(ov, { von, nach, farbe, objekt }) {
      const [dx, dy] = [nach[0] - von[0], nach[1] - von[1]];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const el = objekt
          ? teil(ov, von[0], von[1], "font-size:20px;line-height:1", "qa-text")
          : teil(ov, von[0], von[1], `width:12px;height:12px;border-radius:50%;${glanz(farbe)}`);
        if (objekt) el.textContent = objekt;
        ab(el, [
          { transform: tr(Math.cos(a) * 20, Math.sin(a) * 20, 0.5, 0), opacity: 0 },
          { transform: tr(Math.cos(a + 2) * 70 + dx * 0.3, Math.sin(a + 2) * 70 + dy * 0.3, 1, 180), opacity: 1, offset: 0.45 },
          { transform: tr(dx, dy, 0.6, 360), opacity: 0 },
        ], { duration: 820, delay: i * 18, easing: "ease-in-out" });
      }
      return 900;
    },
  };

  return {
    arten: Object.keys(ARTEN),
    spiele(ov, art, opt) {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
      const f = ARTEN[art] || ARTEN.strahl;
      return f(ov, { kraft: 1, farbe: "#ffd23f", ...opt });
    },
  };
})();
