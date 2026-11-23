// =============================================================
//  Baulöwe 3D: Spielbrett als echtes Brett auf dem Tisch
//  - alle 40 Felder als Textur (wie beim Original: Schrift zeigt zur jeweiligen Seite)
//  - Spielfiguren hüpfen Feld für Feld, Häuser und Hotels, Besitz-Streifen in Spielerfarbe
//  - zwei Würfel fallen auf das Brett, prallen ab und zeigen genau die gewürfelte Zahl
//  three.js wird erst geladen, wenn das Brett gebraucht wird.
// =============================================================
window.BauloweBrett3D = (() => {
  let THREE = null, laden = null;
  const webglDa = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.animationen === "aus";
  const B = 12; // Brettbreite in Welt-Einheiten
  const N = B / 12.1, C = N * 1.55; // normales Feld und Eckfeld

  // Rechteck eines Felds auf dem Brett (x nach rechts, z nach vorn zur Kamera)
  function rechteck(i) {
    const h = B / 2;
    if (i === 0) return { x0: h - C, x1: h, z0: h - C, z1: h, seite: "unten", ecke: true };
    if (i < 10) { const x1 = h - C - (i - 1) * N; return { x0: x1 - N, x1, z0: h - C, z1: h, seite: "unten" }; }
    if (i === 10) return { x0: -h, x1: -h + C, z0: h - C, z1: h, seite: "unten", ecke: true };
    if (i < 20) { const z1 = h - C - (i - 11) * N; return { x0: -h, x1: -h + C, z0: z1 - N, z1, seite: "links" }; }
    if (i === 20) return { x0: -h, x1: -h + C, z0: -h, z1: -h + C, seite: "oben", ecke: true };
    if (i < 30) { const x0 = -h + C + (i - 21) * N; return { x0, x1: x0 + N, z0: -h, z1: -h + C, seite: "oben" }; }
    if (i === 30) return { x0: h - C, x1: h, z0: -h, z1: -h + C, seite: "oben", ecke: true };
    const z0 = -h + C + (i - 31) * N; return { x0: h - C, x1: h, z0, z1: z0 + N, seite: "rechts" };
  }
  const WINKEL = { unten: 0, links: Math.PI / 2, oben: Math.PI, rechts: -Math.PI / 2 };
  const ECK_WINKEL = { 0: -Math.PI / 4, 10: Math.PI / 4, 20: (3 * Math.PI) / 4, 30: (-3 * Math.PI) / 4 };
  const mitteVon = (i) => { const r = rechteck(i); return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; };
  // Richtung zur Brettmitte (für Farbstreifen und Häuser)
  const nachInnen = { unten: [0, -1], links: [1, 0], oben: [0, 1], rechts: [-1, 0] };

  // ---------- Brett-Textur ----------
  // Brett-Textur: Auflösung nach Gerät (scharf auch am Handy), alles relativ zur Größe gezeichnet
  function brettTextur(felder, gruppen, S = 2048, anisotropie = 8) {
    const k = S / B, u = S / 2048; // u: Maßstab gegenüber der alten 2048er-Textur
    const c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d");
    const px = (x) => (x + B / 2) * k;
    const SCHRIFT = "Outfit, system-ui, sans-serif";
    const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    const font = (gew, gr) => `${gew} ${Math.round(gr * u)}px ${SCHRIFT}`;
    // Papier: Grundfarbe mit feinem Korn
    const korn = document.createElement("canvas"); korn.width = korn.height = 256;
    const kg = korn.getContext("2d"), bild = kg.createImageData(256, 256);
    for (let i = 0; i < bild.data.length; i += 4) { const v = Math.random() * 255; bild.data[i] = bild.data[i + 1] = bild.data[i + 2] = v; bild.data[i + 3] = 10; }
    kg.putImageData(bild, 0, 0);
    // Außenrand dunkelgrün, Mitte Filz mit Verlauf
    g.fillStyle = "#0d2a1d"; g.fillRect(0, 0, S, S);
    const innen = C * k;
    const verlauf = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.6);
    verlauf.addColorStop(0, "#33885c"); verlauf.addColorStop(0.6, "#22684a"); verlauf.addColorStop(1, "#154530");
    g.fillStyle = verlauf; g.fillRect(innen, innen, S - 2 * innen, S - 2 * innen);
    g.fillStyle = g.createPattern(korn, "repeat"); g.fillRect(innen, innen, S - 2 * innen, S - 2 * innen);
    // Zierrahmen innen
    g.strokeStyle = "rgba(255, 215, 106, .55)"; g.lineWidth = 5 * u;
    g.strokeRect(innen + 40 * u, innen + 40 * u, S - 2 * innen - 80 * u, S - 2 * innen - 80 * u);
    g.strokeStyle = "rgba(255, 215, 106, .25)"; g.lineWidth = 2 * u;
    g.strokeRect(innen + 56 * u, innen + 56 * u, S - 2 * innen - 112 * u, S - 2 * innen - 112 * u);
    // Logo diagonal, mit Banner
    g.save(); g.translate(S / 2, S / 2); g.rotate(-Math.PI / 4);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#b3261e"; g.beginPath(); g.roundRect(-560 * u, -150 * u, 1120 * u, 260 * u, 40 * u); g.fill();
    g.strokeStyle = "#fff8e6"; g.lineWidth = 10 * u; g.stroke();
    g.font = font(900, 200);
    g.lineWidth = 14 * u; g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeText("BAULÖWE", 0, -14 * u);
    g.fillStyle = "#fff8e6"; g.fillText("BAULÖWE", 0, -20 * u);
    g.font = font(800, 62); g.fillStyle = "#ffd76a"; g.fillText("✦ Schechingen-Edition ✦", 0, 190 * u);
    g.restore();
    // Kartenstapel-Felder
    const kartenFeld = (x, y, text, farbe, zeichne) => {
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
      const w = 440 * u, h = 270 * u;
      g.fillStyle = "rgba(0,0,0,.18)"; g.strokeStyle = farbe; g.lineWidth = 7 * u; g.setLineDash([24 * u, 14 * u]);
      g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 26 * u); g.fill(); g.stroke(); g.setLineDash([]);
      zeichne(0, -30 * u, 70 * u);
      g.fillStyle = farbe; g.font = font(800, 50); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, h / 2 + 48 * u);
      g.restore();
    };
    kartenFeld(S * 0.32, S * 0.32, "GLÜCK", "#ffb35a", (x, y, gr) => fragezeichen(g, x, y, gr, "#ffb35a"));
    kartenFeld(S * 0.68, S * 0.68, "DORFKASSE", "#7fd3ff", (x, y, gr) => truhe(g, x, y, gr));
    // Felder
    felder.forEach((f, i) => {
      const r = rechteck(i);
      const x = px(r.x0), y = px(r.z0), w = (r.x1 - r.x0) * k, h = (r.z1 - r.z0) * k;
      g.fillStyle = r.ecke ? "#efe4c6" : "#f8f0dc"; g.fillRect(x, y, w, h);
      g.fillStyle = g.createPattern(korn, "repeat"); g.fillRect(x, y, w, h);
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate(r.ecke ? ECK_WINKEL[i] : WINKEL[r.seite]);
      g.textAlign = "center"; g.textBaseline = "middle";
      const dunkel = "#1c2a22";
      if (r.ecke) {
        const gr = C * k;
        if (f.art === "start") {
          g.fillStyle = "#c62828"; g.font = font(900, 150); g.fillText("LOS", 0, -30 * u);
          pfeil(g, 0, 110 * u, 250 * u, "#c62828");
          g.fillStyle = dunkel; g.font = font(700, 30); g.fillText("+200 € beim Vorbeiziehen", 0, -160 * u);
        } else if (f.art === "knast") {
          // Wie im Original: Zellenquadrat in der Ecke, außen herum "Nur zu Besuch"
          g.rotate(-ECK_WINKEL[i]); // zurück zur Brettausrichtung
          const z = gr * 0.62, x0 = gr / 2 - z, y0 = -gr / 2;
          g.fillStyle = "#f08a24"; g.fillRect(x0, y0, z, z);
          g.strokeStyle = dunkel; g.lineWidth = 5 * u; g.strokeRect(x0, y0, z, z);
          gitter(g, x0 + z / 2, y0 + z / 2, z * 0.62);
          g.save(); g.translate(x0 + z / 2, y0 + z / 2); g.rotate(Math.PI / 4);
          g.fillStyle = dunkel; g.font = font(900, 40); g.fillText("ACHSENKNAST", 0, z * 0.42); g.restore();
          g.fillStyle = dunkel; g.font = font(900, 40);
          g.save(); g.translate(x0 - 40 * u, 0); g.rotate(Math.PI / 2); g.fillText("NUR ZU", 0, 0); g.restore();
          g.fillText("BESUCH", 0, gr / 2 - 46 * u);
        } else if (f.art === "parken") {
          brunnen(g, 0, -40 * u, 200 * u);
          g.fillStyle = dunkel; g.font = font(900, 46); zeilen(g, "DORFPLATZ", 0, 130 * u, gr, 46 * u);
          g.font = font(700, 32); g.fillText("Schechingen", 0, 180 * u);
        } else if (f.art === "geheKnast") {
          g.font = `${Math.round(150 * u)}px ${EMOJI}`; g.fillText("👮", 0, -50 * u);
          g.fillStyle = dunkel; g.font = font(900, 40); zeilen(g, "AB IN DEN ACHSENKNAST!", 0, 130 * u, gr * 0.9, 44 * u);
        }
      } else {
        const fw = N * k, fh = C * k; // Breite und Tiefe im gedrehten Feld
        const gr = f.gruppe ? gruppen[f.gruppe] : null;
        if (gr) {
          const bh = fh * 0.22;
          const band = g.createLinearGradient(0, -fh / 2, 0, -fh / 2 + bh);
          band.addColorStop(0, aufhellen(gr.farbe, 0.25)); band.addColorStop(1, gr.farbe);
          g.fillStyle = band; g.fillRect(-fw / 2, -fh / 2, fw, bh);
          g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-fw / 2, -fh / 2, fw, bh * 0.18);
          g.strokeStyle = dunkel; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(-fw / 2, -fh / 2 + bh); g.lineTo(fw / 2, -fh / 2 + bh); g.stroke();
        }
        g.fillStyle = dunkel;
        const name = f.name.replace(/^Bahnhof /, "").replace(/^Kirche /, "").toUpperCase();
        const iconY = -fh * 0.06;
        if (f.art === "bahn") { g.font = font(700, 24); g.fillText("BAHNHOF", 0, -fh / 2 + 44 * u); lok(g, 0, fh * 0.1, 112 * u); }
        else if (f.art === "werk") (f.icon === "⚡" ? blitz : wasserturm)(g, 0, iconY + 10 * u, 120 * u);
        else if (f.art === "ereignis") fragezeichen(g, 0, iconY, 120 * u, "#e07b00");
        else if (f.art === "kasse") truhe(g, 0, iconY, 110 * u);
        else if (f.art === "steuer") { g.font = `${Math.round(84 * u)}px ${EMOJI}`; g.fillText(f.icon || "🧾", 0, iconY); }
        g.fillStyle = dunkel;
        // Schrift so lange verkleinern, bis das längste Wort ins Feld passt
        let titel = (f.art === "ereignis" ? "GLÜCK" : f.art === "kasse" ? "DORFKASSE" : name).replace(/-/g, " ");
        let groesse = gr ? 30 : 28;
        g.font = font(800, groesse);
        // Zu lange Wörter an der Wortfuge trennen (OSTER- / BRUNNEN)
        titel = titel.split(" ").map((w) => (g.measureText(w).width > fw * 0.86 ? w.replace(/^(.{3,}?)(BRUNNEN|FORUM|HALLE|HAUS|SCHULE|VEREIN|SAAL|GARTEN|STEUER|STRASSE|SCHECHINGEN)$/, "$1- $2") : w)).join(" ");
        const laengstes = titel.split(/[\s-]/).reduce((a, w) => (g.measureText(w).width > g.measureText(a).width ? w : a), "");
        while (groesse > 25 && g.measureText(laengstes).width > fw * 0.86) { groesse -= 1; g.font = font(800, groesse); }
        const textY = gr ? -fh / 2 + fh * 0.22 + 70 * u : f.art === "bahn" ? -fh / 2 + 90 * u : -fh / 2 + 52 * u;
        zeilen(g, titel, 0, gr ? textY : f.art === "bahn" ? -fh / 2 + 88 * u : -fh / 2 + 50 * u, fw * 0.88, 32 * u);
        if (f.preis || f.betrag) { g.font = font(800, 32); const preis = f.art === "steuer" ? `${f.betrag} €` : `${f.preis} €`; g.fillText(preis, 0, fh / 2 - 38 * u); }
      }
      g.restore();
      // Feldlinien zuletzt, damit sie über allem liegen
      g.strokeStyle = "#22332a"; g.lineWidth = 4 * u; g.strokeRect(x, y, w, h);
    });
    // Rand um die Felder
    g.strokeStyle = "#22332a"; g.lineWidth = 8 * u; g.strokeRect(4 * u, 4 * u, S - 8 * u, S - 8 * u);
    g.strokeRect(innen, innen, S - 2 * innen, S - 2 * innen);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropie;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  const aufhellen = (hex, f) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    const m = (v) => Math.round(v + (255 - v) * f);
    return `rgb(${m(r)},${m(gg)},${m(b)})`;
  };
  // ---------- Gezeichnete Symbole (scharf in jeder Größe) ----------
  function pfeil(g, x, y, l, farbe) {
    g.save(); g.translate(x, y); g.fillStyle = farbe;
    g.beginPath(); g.moveTo(l / 2, 0); g.lineTo(l / 2 - l * 0.3, -l * 0.22); g.lineTo(l / 2 - l * 0.3, -l * 0.08); g.lineTo(-l / 2, -l * 0.08);
    g.lineTo(-l / 2, l * 0.08); g.lineTo(l / 2 - l * 0.3, l * 0.08); g.lineTo(l / 2 - l * 0.3, l * 0.22); g.closePath(); g.fill(); g.restore();
  }
  function gitter(g, x, y, gr) {
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = "#fff3dc"; g.fillRect(-gr / 2, -gr / 2, gr, gr);
    g.font = `${Math.round(gr * 0.62)}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("😬", 0, 0);
    g.strokeStyle = "#3a3a3a"; g.lineWidth = gr * 0.05;
    for (let i = 1; i < 5; i++) { const sx = -gr / 2 + (gr * i) / 5; g.beginPath(); g.moveTo(sx, -gr / 2); g.lineTo(sx, gr / 2); g.stroke(); }
    g.lineWidth = gr * 0.06; g.strokeRect(-gr / 2, -gr / 2, gr, gr);
    g.restore();
  }
  function fragezeichen(g, x, y, gr, farbe) {
    g.save(); g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 ${gr}px Outfit, system-ui, sans-serif`;
    g.lineWidth = gr * 0.08; g.strokeStyle = "#1c2a22"; g.strokeText("?", x, y);
    g.fillStyle = farbe; g.fillText("?", x, y); g.restore();
  }
  function truhe(g, x, y, gr) {
    g.save(); g.translate(x, y);
    const w = gr, h = gr * 0.62;
    g.fillStyle = "#8b5a2b"; g.strokeStyle = "#3b2412"; g.lineWidth = gr * 0.05;
    g.beginPath(); g.roundRect(-w / 2, -h * 0.1, w, h * 0.7, gr * 0.06); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-w / 2, -h * 0.1); g.quadraticCurveTo(0, -h * 0.75, w / 2, -h * 0.1); g.closePath(); g.fillStyle = "#a86f38"; g.fill(); g.stroke();
    g.fillStyle = "#ffcf3f"; g.fillRect(-w * 0.09, -h * 0.2, w * 0.18, h * 0.3); g.strokeRect(-w * 0.09, -h * 0.2, w * 0.18, h * 0.3);
    g.fillStyle = "#ffcf3f"; g.fillRect(-w / 2, h * 0.2, w, h * 0.06); g.restore();
  }
  function lok(g, x, y, gr) {
    g.save(); g.translate(x, y); g.fillStyle = "#1c2a22";
    const w = gr, h = gr * 0.55;
    g.beginPath(); g.roundRect(-w * 0.5, -h * 0.3, w * 0.62, h * 0.6, gr * 0.04); g.fill(); // Kessel
    g.fillRect(w * 0.1, -h * 0.7, w * 0.36, h); // Führerhaus
    g.fillRect(-w * 0.38, -h * 0.75, w * 0.12, h * 0.5); // Schornstein
    g.fillStyle = "#f8f0dc"; g.fillRect(w * 0.18, -h * 0.58, w * 0.2, h * 0.3);
    g.fillStyle = "#1c2a22";
    for (const rx of [-0.34, -0.06, 0.28]) { g.beginPath(); g.arc(w * rx, h * 0.42, gr * 0.13, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#f8f0dc"; for (const rx of [-0.34, -0.06, 0.28]) { g.beginPath(); g.arc(w * rx, h * 0.42, gr * 0.05, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  function blitz(g, x, y, gr) {
    g.save(); g.translate(x, y);
    g.beginPath(); g.moveTo(gr * 0.1, -gr * 0.55); g.lineTo(-gr * 0.3, gr * 0.06); g.lineTo(-gr * 0.02, gr * 0.06); g.lineTo(-gr * 0.14, gr * 0.55); g.lineTo(gr * 0.3, -gr * 0.08); g.lineTo(gr * 0.02, -gr * 0.08); g.closePath();
    g.fillStyle = "#ffcf00"; g.fill(); g.strokeStyle = "#1c2a22"; g.lineWidth = gr * 0.05; g.lineJoin = "round"; g.stroke(); g.restore();
  }
  function wasserturm(g, x, y, gr) {
    g.save(); g.translate(x, y); g.strokeStyle = "#1c2a22"; g.lineWidth = gr * 0.05;
    g.fillStyle = "#4aa3df"; g.beginPath(); g.roundRect(-gr * 0.32, -gr * 0.55, gr * 0.64, gr * 0.42, gr * 0.12); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-gr * 0.36, -gr * 0.55); g.lineTo(0, -gr * 0.78); g.lineTo(gr * 0.36, -gr * 0.55); g.closePath(); g.fillStyle = "#b3261e"; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-gr * 0.22, -gr * 0.13); g.lineTo(-gr * 0.3, gr * 0.5); g.moveTo(gr * 0.22, -gr * 0.13); g.lineTo(gr * 0.3, gr * 0.5); g.moveTo(-gr * 0.26, gr * 0.18); g.lineTo(gr * 0.26, gr * 0.18); g.stroke();
    g.restore();
  }
  function brunnen(g, x, y, gr) {
    g.save(); g.translate(x, y); g.strokeStyle = "#1c2a22"; g.lineWidth = gr * 0.035;
    g.fillStyle = "#9aa5b1"; g.beginPath(); g.ellipse(0, gr * 0.3, gr * 0.48, gr * 0.14, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#6ec6ff"; g.beginPath(); g.ellipse(0, gr * 0.27, gr * 0.38, gr * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#9aa5b1"; g.fillRect(-gr * 0.06, -gr * 0.12, gr * 0.12, gr * 0.4); g.strokeRect(-gr * 0.06, -gr * 0.12, gr * 0.12, gr * 0.4);
    g.beginPath(); g.ellipse(0, -gr * 0.12, gr * 0.22, gr * 0.06, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = "#6ec6ff"; g.lineWidth = gr * 0.03;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -gr * 0.2); g.quadraticCurveTo(s * gr * 0.3, -gr * 0.5, s * gr * 0.34, gr * 0.2); g.stroke(); }
    g.restore();
  }
  // Holzmaserung für Tisch und Brettkante
  function holzTextur(hell, dunkel, ringe, aniso) {
    const c = document.createElement("canvas"); c.width = c.height = 1024;
    const g = c.getContext("2d");
    g.fillStyle = hell; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 140; i++) {
      const y = Math.random() * 1024, a = 0.04 + Math.random() * 0.12;
      g.strokeStyle = dunkel; g.globalAlpha = a; g.lineWidth = 1 + Math.random() * 5;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / (80 + ringe * 20) + i) * (4 + ringe));
      g.stroke();
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    return t;
  }
  // Text in mehrere Zeilen umbrechen
  function zeilen(g, text, x, y, breite, hoehe) {
    const woerter = text.split(/\s+/);
    const z = []; let akt = "";
    for (const w of woerter) { const t = akt ? akt + " " + w : w; if (g.measureText(t).width > breite && akt) { z.push(akt); akt = w; } else akt = t; }
    z.push(akt);
    // Zu lange Zeilen schmaler machen statt über den Rand laufen zu lassen
    z.forEach((l, i) => {
      const ly = y + (i - (z.length - 1) / 2) * hoehe, b = g.measureText(l).width;
      if (b <= breite) return g.fillText(l, x, ly);
      g.save(); g.translate(x, ly); g.scale(breite / b, 1); g.fillText(l, 0, 0); g.restore();
    });
  }

  // ---------- Würfel ----------
  function wuerfelMaterial() {
    const PUNKTE = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.27, .23], [.73, .23], [.27, .5], [.73, .5], [.27, .77], [.73, .77]] };
    // Seiten-Reihenfolge von three.js: +x, -x, +y, -y, +z, -z
    return [3, 4, 1, 6, 2, 5].map((n) => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#fffdf6"; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
      for (const [x, y] of PUNKTE[n]) { g.beginPath(); g.arc(x * 128, y * 128, n === 1 ? 15 : 11, 0, Math.PI * 2); g.fillStyle = n === 1 ? "#c62828" : "#1a1a1a"; g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
    });
  }
  // Tempowürfel: rot, Seiten 1–3 mit weißen Augen, 4/5 Mr. Monopoly, 6 Bus
  function tempoMaterial() {
    const PUNKTE = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]] };
    const BILD = { 4: "🎩", 5: "🎩", 6: "🚌" };
    return [3, 4, 1, 6, 2, 5].map((n) => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#d32f2f"; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
      if (BILD[n]) { g.font = "76px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(BILD[n], 64, 70); }
      else for (const [x, y] of PUNKTE[n]) { g.beginPath(); g.arc(x * 128, y * 128, 12, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
    });
  }
  // Drehung, bei der die Augenzahl nach oben zeigt
  function obenDrehung(n) {
    const q = new THREE.Quaternion();
    const e = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] }[n];
    return q.setFromEuler(new THREE.Euler(...e));
  }

  // ---------- Spielfiguren: kleine Low-Poly-Modelle aus Metall, Sockel in Spielerfarbe ----------
  function figurModell(icon) {
    const g = new THREE.Group();
    const silber = new THREE.MeshStandardMaterial({ color: 0xe8ebf0, metalness: 0.35, roughness: 0.32, emissive: 0x2a2d33, emissiveIntensity: 0.25 });
    const dunkel = new THREE.MeshStandardMaterial({ color: 0x59606b, metalness: 0.3, roughness: 0.45 });
    const m = (geo, x = 0, y = 0, z = 0, mat = silber) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    switch (icon) {
      case "🎩": // Zylinder
        m(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), 0, 0.02);
        m(new THREE.CylinderGeometry(0.14, 0.15, 0.32, 18), 0, 0.2);
        m(new THREE.CylinderGeometry(0.152, 0.152, 0.05, 18), 0, 0.07, 0, dunkel);
        break;
      case "🚗": // Auto
        m(new THREE.BoxGeometry(0.46, 0.12, 0.24), 0, 0.12);
        m(new THREE.BoxGeometry(0.24, 0.11, 0.2), -0.03, 0.235);
        for (const [x, z] of [[-0.15, 0.12], [0.15, 0.12], [-0.15, -0.12], [0.15, -0.12]]) { const r = m(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12), x, 0.065, z, dunkel); r.rotation.x = Math.PI / 2; }
        break;
      case "🐕": { // Hund
        m(new THREE.BoxGeometry(0.34, 0.13, 0.14), 0, 0.2);
        m(new THREE.SphereGeometry(0.09, 10, 8), 0.2, 0.32);
        m(new THREE.BoxGeometry(0.09, 0.05, 0.06), 0.3, 0.3);
        for (const z of [-0.06, 0.06]) m(new THREE.BoxGeometry(0.03, 0.08, 0.05), 0.18, 0.4, z);
        for (const [x, z] of [[-0.12, 0.05], [-0.12, -0.05], [0.12, 0.05], [0.12, -0.05]]) m(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), x, 0.07, z);
        const sch = m(new THREE.CylinderGeometry(0.015, 0.02, 0.14, 6), -0.2, 0.3); sch.rotation.z = 0.8;
        break;
      }
      case "🚀": // Rakete
        m(new THREE.CylinderGeometry(0.08, 0.1, 0.36, 14), 0, 0.25);
        m(new THREE.ConeGeometry(0.08, 0.16, 14), 0, 0.51);
        for (let i = 0; i < 3; i++) { const f = m(new THREE.BoxGeometry(0.02, 0.14, 0.11), Math.cos((i * 2 * Math.PI) / 3) * 0.09, 0.1, Math.sin((i * 2 * Math.PI) / 3) * 0.09, dunkel); f.rotation.y = -(i * 2 * Math.PI) / 3; }
        m(new THREE.SphereGeometry(0.035, 10, 8), 0, 0.33, 0.09, dunkel);
        break;
      case "🦆": { // Ente
        const k = m(new THREE.SphereGeometry(0.15, 14, 10), 0, 0.14); k.scale.set(1.3, 0.8, 1);
        m(new THREE.SphereGeometry(0.09, 12, 10), 0.13, 0.3);
        const sn = m(new THREE.ConeGeometry(0.04, 0.1, 8), 0.24, 0.29, 0, dunkel); sn.rotation.z = -Math.PI / 2;
        const sw = m(new THREE.ConeGeometry(0.05, 0.1, 8), -0.2, 0.2); sw.rotation.z = 1;
        break;
      }
      case "👟": { // Schuh
        m(new THREE.BoxGeometry(0.42, 0.05, 0.17), 0.02, 0.03, 0, dunkel);
        const v = m(new THREE.SphereGeometry(0.11, 12, 8), 0.12, 0.09); v.scale.set(1.1, 0.6, 0.8);
        m(new THREE.BoxGeometry(0.2, 0.18, 0.15), -0.08, 0.14);
        break;
      }
      case "⛵": { // Segelboot
        const r = m(new THREE.CylinderGeometry(0.22, 0.14, 0.1, 4), 0, 0.06); r.rotation.y = Math.PI / 4; r.scale.set(1.4, 1, 0.6);
        m(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), 0, 0.33, 0, dunkel);
        const form = new THREE.Shape(); form.moveTo(0, 0); form.lineTo(0, 0.38); form.lineTo(0.2, 0); form.lineTo(0, 0);
        const segel = m(new THREE.ShapeGeometry(form), 0.01, 0.12, 0, new THREE.MeshStandardMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.5 }));
        segel.rotation.y = Math.PI / 2;
        break;
      }
      case "🎸": { // Gitarre
        const k1 = m(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), 0, 0.12); k1.rotation.x = Math.PI / 2;
        const k2 = m(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), 0, 0.27); k2.rotation.x = Math.PI / 2;
        m(new THREE.BoxGeometry(0.04, 0.32, 0.03), 0, 0.5, 0, dunkel);
        m(new THREE.BoxGeometry(0.07, 0.08, 0.03), 0, 0.69);
        const loch = m(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), 0, 0.17, 0, dunkel); loch.rotation.x = Math.PI / 2;
        break;
      }
      default: { // klassischer Spielstein
        const profil = [[0, 0], [0.16, 0], [0.12, 0.08], [0.07, 0.25], [0.1, 0.3], [0.06, 0.34], [0.09, 0.42], [0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y));
        m(new THREE.LatheGeometry(profil, 20));
      }
    }
    return g;
  }
  function spielstein(farbe, icon) {
    const g = new THREE.Group();
    // Sockel in Spielerfarbe: so weiß man sofort, wem die Figur gehört
    const sockel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 24), new THREE.MeshStandardMaterial({ color: farbe, metalness: 0.3, roughness: 0.35 }));
    sockel.position.y = 0.025; sockel.castShadow = true; g.add(sockel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.022, 8, 32), new THREE.MeshBasicMaterial({ color: farbe }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; g.add(ring);
    // Körper (wird beim Springen gestaucht und gestreckt)
    const koerper = new THREE.Group(); koerper.position.y = 0.05; g.add(koerper);
    const modell = figurModell(icon); modell.scale.setScalar(1.15); koerper.add(modell);
    g.userData.schild = ring; g.userData.koerper = koerper;
    return g;
  }
  function hausModell(hotel) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: hotel ? 0xd23b32 : 0x2fa35a, roughness: 0.5 });
    const b = hotel ? [0.34, 0.2, 0.22] : [0.17, 0.13, 0.17];
    const k = new THREE.Mesh(new THREE.BoxGeometry(...b), mat); k.position.y = b[1] / 2; k.castShadow = true; g.add(k);
    const dach = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b[0], b[2]) * 0.75, b[1] * 0.75, 4), mat);
    dach.position.y = b[1] + b[1] * 0.37; dach.rotation.y = Math.PI / 4; dach.scale.set(b[0] / Math.max(b[0], b[2]) * 1.0, 1, b[2] / Math.max(b[0], b[2])); dach.castShadow = true; g.add(dach);
    return g;
  }

  class Brett {
    constructor(host, felder, gruppen) {
      this.host = host; this.felder = felder; this.gruppen = gruppen;
      this.uhr = new THREE.Clock();
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      host.appendChild(r.domElement);
      const s = this.szene = new THREE.Scene();
      this.kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      s.add(new THREE.HemisphereLight(0xfff4e0, 0x23301f, 1.1));
      const sonne = new THREE.DirectionalLight(0xffffff, 2.2);
      sonne.position.set(-5, 12, 6); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
      Object.assign(sonne.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
      sonne.shadow.bias = -0.0005;
      s.add(sonne);
      // Tisch und Brett
      const aniso = r.capabilities.getMaxAnisotropy?.() || 8;
      const tischHolz = holzTextur("#4a2e18", "#2e1a0c", 6, aniso);
      tischHolz.repeat.set(3, 3);
      const tisch = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ map: tischHolz, roughness: 0.6, metalness: 0.05 }));
      tisch.rotation.x = -Math.PI / 2; tisch.position.y = -0.31; tisch.receiveShadow = true; s.add(tisch);
      // Brett mit Holzkante und schmaler Goldleiste
      const kante = new THREE.MeshStandardMaterial({ map: holzTextur("#7a4a22", "#4d2c12", 2, aniso), roughness: 0.45 });
      const rand = new THREE.Mesh(new THREE.BoxGeometry(B + 0.36, 0.3, B + 0.36), kante);
      rand.position.y = -0.16; rand.castShadow = true; rand.receiveShadow = true; s.add(rand);
      const leiste = new THREE.Mesh(new THREE.BoxGeometry(B + 0.08, 0.31, B + 0.08), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.3 }));
      leiste.position.y = -0.155; s.add(leiste);
      const oben = this.oben = new THREE.Mesh(new THREE.PlaneGeometry(B, B), new THREE.MeshStandardMaterial({ map: brettTextur(felder, gruppen, Math.min(4096, r.capabilities.maxTextureSize || 2048), r.capabilities.getMaxAnisotropy?.() || 8), roughness: 0.7 }));
      oben.rotation.x = -Math.PI / 2; oben.position.y = 0.001; oben.receiveShadow = true; s.add(oben);
      // Ebenen für Besitz, Hypothek, Häuser
      this.markierungen = new THREE.Group(); s.add(this.markierungen);
      this.haeuserGruppe = new THREE.Group(); s.add(this.haeuserGruppe);
      // Kartenstapel in der Mitte
      for (const [x, z, farbe] of [[-2.2, -2.2, 0xffb35a], [2.2, 2.2, 0x7fd3ff]]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.95), new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.6 }));
        st.position.set(x, 0.06, z); st.rotation.y = Math.PI / 4; st.castShadow = true; s.add(st);
      }
      // Würfel
      const wm = wuerfelMaterial();
      this.wuerfel = [0, 1].map((i) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), wm); w.castShadow = true; w.position.set(-0.5 + i, 0.275, 0.9); s.add(w); return w; });
      const tw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), tempoMaterial());
      tw.castShadow = true; tw.position.set(0.6, 0.275, 1.6); tw.visible = false; s.add(tw);
      this.wuerfel.push(tw);
      this.wurf = null;
      this.figuren = new Map();
      this.zustandDaten = null;
      this.fokusPunkt = new THREE.Vector3(0, 0, 0.9);
      this.groesse();
      new ResizeObserver(() => this.groesse()).observe(host);
      // Felder antippen
      const ray = new THREE.Raycaster(), maus = new THREE.Vector2();
      let unten = null;
      r.domElement.addEventListener("pointerdown", (e) => {
        unten = [e.clientX, e.clientY];
        // Läuft gerade etwas? Dann vorspulen statt ein Feld zu öffnen
        if (this.wurf || [...this.figuren.values()].some((f) => f.pfad.length)) { this.schnell = 5; this.gespult = true; }
      });
      r.domElement.addEventListener("pointerup", (e) => {
        if (this.gespult) { this.gespult = false; return; }
        if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 8) return;
        const b = r.domElement.getBoundingClientRect();
        maus.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(maus, this.kamera);
        const t = ray.intersectObject(this.oben)[0];
        if (!t) return;
        const i = this.feldAn(t.point.x, t.point.z);
        if (i >= 0) this.aufFeld?.(i);
      });
      // Ist das Brett nicht mehr auf der Seite (Spielende, Umschalten auf 2D), wird alles freigegeben
      const schleife = () => {
        if (this.aus) return;
        if (!this.host.isConnected) { if ((this.weg = (this.weg || 0) + 1) > 30) return this.entsorgen(); } else this.weg = 0;
        requestAnimationFrame(schleife);
        if (!document.hidden && this.host.isConnected) this.bild();
      };
      schleife();
    }
    feldAn(x, z) { for (let i = 0; i < 40; i++) { const r = rechteck(i); if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return i; } return -1; }
    groesse() {
      const w = this.host.clientWidth || 600, h = this.host.clientHeight || 600;
      this.renderer.setSize(w, h, false);
      this.kamera.aspect = w / h;
      this.kamera.fov = 38;
      this.kamera.updateProjectionMatrix();
    }

    // Stand übernehmen: Besitz, Häuser, Hypotheken, Figuren
    setze({ besitz, haeuser, hypothek, farben, figuren, dran }) {
      this.dran = dran;
      // Besitz-Streifen an der Außenkante, Hypothek abgedunkelt
      this.markierungen.clear();
      for (const [f, id] of Object.entries(besitz)) {
        const r = rechteck(+f), [ix, iz] = nachInnen[r.seite];
        const w = r.x1 - r.x0, d = r.z1 - r.z0;
        const streifen = new THREE.Mesh(new THREE.PlaneGeometry(ix ? 0.1 : w * 0.92, iz ? 0.1 : d * 0.92), new THREE.MeshBasicMaterial({ color: farben[id] }));
        streifen.rotation.x = -Math.PI / 2;
        const m = mitteVon(+f);
        streifen.position.set(m.x - ix * (w / 2 - 0.08), 0.004, m.z - iz * (d / 2 - 0.08));
        this.markierungen.add(streifen);
        if (hypothek[f]) {
          const dunkel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.96), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.45 }));
          dunkel.rotation.x = -Math.PI / 2; dunkel.position.set(m.x, 0.005, m.z); this.markierungen.add(dunkel);
        }
      }
      // Häuser auf dem Farbstreifen
      const schluessel = JSON.stringify(haeuser);
      if (schluessel !== this.haeuserSchluessel) {
        const alt = this.haeuserAlt || {};
        this.haeuserSchluessel = schluessel; this.haeuserAlt = { ...haeuser };
        this.haeuserGruppe.clear();
        for (const [f, n] of Object.entries(haeuser)) {
          if (!n) continue;
          const r = rechteck(+f), [ix, iz] = nachInnen[r.seite], m = mitteVon(+f);
          const tiefe = C * 0.39; // Mitte des Farbstreifens, von der Feldmitte aus nach innen
          const bx = m.x + ix * tiefe, bz = m.z + iz * tiefe;
          const neu = (alt[f] || 0) !== n;
          const liste = n === 5 ? [0] : Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * 0.21);
          liste.forEach((o) => {
            const hm = hausModell(n === 5);
            hm.position.set(bx + (iz ? o : 0), 0, bz + (ix ? o : 0));
            hm.rotation.y = r.seite === "links" || r.seite === "rechts" ? Math.PI / 2 : 0;
            if (neu && !ruhig()) { hm.position.y = 1.5; hm.userData.fallen = 0; }
            this.haeuserGruppe.add(hm);
          });
        }
      }
      // Figuren
      const ids = new Set(figuren.map((f) => f.id));
      for (const [id, fg] of this.figuren) if (!ids.has(id)) { this.szene.remove(fg.g); this.figuren.delete(id); }
      for (const f of figuren) {
        let fg = this.figuren.get(f.id);
        if (!fg) { fg = { g: spielstein(f.farbe, f.icon), feld: f.feld, pfad: [] }; this.szene.add(fg.g); this.figuren.set(f.id, fg); fg.g.position.copy(this.platzFuer(f.id, f.feld, figuren)); }
        fg.feld = f.feld;
        fg.dran = f.id === dran;
      }
      this.figurenListe = figuren;
      for (const [id, fg] of this.figuren) if (!fg.pfad.length) fg.ziel = this.platzFuer(id, fg.feld, figuren);
    }
    // Mehrere Figuren auf einem Feld nebeneinander
    platzFuer(id, feld, figuren) {
      const hier = figuren.filter((f) => (this.figuren.get(f.id)?.pfad.length ? this.figuren.get(f.id).pfadZiel : f.feld) === feld);
      const k = Math.max(0, hier.findIndex((f) => f.id === id)), n = Math.max(1, hier.length);
      const r = rechteck(feld), m = mitteVon(feld);
      const quer = r.seite === "links" || r.seite === "rechts";
      const versatz = (k - (n - 1) / 2) * Math.min(0.32, (N * 0.9) / n);
      const [ix, iz] = nachInnen[r.seite];
      const aussen = r.ecke ? 0 : -0.12; // etwas zur Außenkante, damit Häuser frei bleiben
      return new THREE.Vector3(m.x + (quer ? 0 : versatz) + ix * aussen, 0, m.z + (quer ? versatz : 0) + iz * aussen);
    }
    // Figur läuft Feld für Feld
    laufen(id, von, schritte, msProSchritt = 190, warte = 0) {
      const fg = this.figuren.get(id);
      if (!fg) return;
      const rich = schritte < 0 ? -1 : 1;
      const pfad = Array.from({ length: Math.abs(schritte) }, (_, k) => (von + rich * (k + 1) + 40) % 40);
      fg.pfad = pfad.map((f) => ({ feld: f }));
      fg.pfadZiel = pfad[pfad.length - 1];
      fg.schrittMs = msProSchritt; fg.schrittT = -warte / msProSchritt; fg.start = fg.g.position.clone();
    }
    // Würfel fallen auf das Brett; das Versprechen erfüllt sich, wenn sie liegen
    wuerfeln(werte) {
      return new Promise((ok) => {
        this.wuerfel[2].visible = werte.length > 2;
        const aktiv = this.wuerfel.slice(0, werte.length);
        if (ruhig()) { aktiv.forEach((w, i) => { w.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6).multiply(obenDrehung(werte[i]))); w.position.y = 0.275; }); return ok(); }
        const ziel = aktiv.map((_, i) => (i < 2 ? new THREE.Vector3(-0.55 + i * 1.1 + (Math.random() - 0.5) * 0.4, 0.275, 0.6 + (Math.random() - 0.5) * 0.6) : new THREE.Vector3(0.1 + (Math.random() - 0.5) * 0.4, 0.275, 1.55)));
        this.wurf = {
          t: 0, dauer: 1.35, ok,
          w: aktiv.map((w, i) => ({
            start: new THREE.Vector3(-1.8 + i * 1.2, 3.2, 4.4), ziel: ziel[i],
            ende: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2).multiply(obenDrehung(werte[i])),
            achse: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), dreh: Math.PI * (7 + Math.random() * 3),
          })),
        };
      });
    }
    entsorgen() {
      if (this.aus) return;
      this.aus = true;
      try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch {}
    }
    fokus(feld) { const m = mitteVon(feld); this.fokusPunkt.set(m.x * 0.12, 0, m.z * 0.12 + 0.9); }
    // Kamera-Schwenk auf das Feld, auf dem gerade etwas passiert (feste Perspektive, kein freies Drehen)
    zeigeFeld(feld, sek = 1.8) { if (!ruhig()) this.feldBlick = { feld, bis: this.uhr.elapsedTime + sek }; }

    bild() {
      const dtEcht = Math.min(0.05, this.uhr.getDelta()), t = this.uhr.elapsedTime;
      // Vorspulen endet von selbst, sobald nichts mehr läuft
      if (this.schnell && !this.wurf && ![...this.figuren.values()].some((f) => f.pfad.length)) this.schnell = 0;
      const dt = dtEcht * (this.schnell || 1);
      // Kamera: leicht schräg von vorn, wiegt sich sanft
      // Abstand nach Seitenverhältnis: immer das ganze Brett im Bild
      const a = this.kamera.aspect || 1.25;
      const abstand = 17.2 * Math.max(1, 1.36 / a), hoehe = (a < 1.1 ? 64 : 54) * Math.PI / 180;
      const ziel = new THREE.Vector3(0, abstand * Math.sin(hoehe), abstand * Math.cos(hoehe));
      if (!ruhig()) { ziel.x += Math.sin(t * 0.15) * 0.5; ziel.z += Math.sin(t * 0.11) * 0.3; }
      let blickZiel = this.fokusPunkt;
      if (this.feldBlick && t < this.feldBlick.bis) {
        const m = mitteVon(this.feldBlick.feld);
        blickZiel = new THREE.Vector3(m.x * 0.45, 0, m.z * 0.45 + 0.4);
        ziel.multiplyScalar(0.82).add(new THREE.Vector3(m.x * 0.3, 0, m.z * 0.2));
      } else this.feldBlick = null;
      this.kamera.position.lerp(ziel, 0.045);
      this.blick = (this.blick || blickZiel.clone()).lerp(blickZiel, 0.05);
      this.kamera.lookAt(this.blick);
      // Würfelwurf: fallen, zweimal aufprallen, genau auf der richtigen Seite liegen bleiben
      if (this.wurf) {
        const W = this.wurf; W.t += dt;
        const k = Math.min(1, W.t / W.dauer);
        W.w.forEach((d, i) => {
          const w = this.wuerfel[i];
          const h = 1 - Math.pow(1 - k, 2.2);
          w.position.x = d.start.x + (d.ziel.x - d.start.x) * h;
          w.position.z = d.start.z + (d.ziel.z - d.start.z) * h;
          // Höhe: Fall, Aufprall, kleiner Aufprall, liegen
          let y;
          if (k < 0.42) { const u = k / 0.42; y = d.start.y * (1 - u * u); }
          else if (k < 0.7) { const u = (k - 0.42) / 0.28; y = 0.7 * 4 * u * (1 - u); }
          else if (k < 0.86) { const u = (k - 0.7) / 0.16; y = 0.18 * 4 * u * (1 - u); }
          else y = 0;
          w.position.y = 0.275 + y;
          const rest = d.dreh * Math.pow(1 - k, 2);
          w.quaternion.copy(d.ende).multiply(new THREE.Quaternion().setFromAxisAngle(d.achse, rest));
        });
        if (k >= 1) { const ok = W.ok; this.wurf = null; ok(); }
      }
      // Figuren: hüpfen von Feld zu Feld, sonst sanft an ihren Platz
      for (const [id, fg] of this.figuren) {
        if (fg.pfad.length) {
          fg.schrittT += (dt * 1000) / fg.schrittMs;
          if (fg.schrittT >= 1) {
            const s = fg.pfad.shift();
            fg.start = this.platzFuer(id, s.feld, this.figurenListe || []);
            fg.g.position.copy(fg.start);
            fg.schrittT = 0;
            this.beiSchritt?.(id, s.feld);
            if (!fg.pfad.length) { this.zeigeFeld(s.feld); fg.ziel = this.platzFuer(id, fg.feld, this.figurenListe || []); for (const [x, o] of this.figuren) if (x !== id && !o.pfad.length) o.ziel = this.platzFuer(x, o.feld, this.figurenListe || []); }
          } else if (fg.schrittT > 0) {
            const nach = this.platzFuer(id, fg.pfad[0].feld, this.figurenListe || []);
            const u = fg.schrittT;
            const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; // langsam los, schnell, sanft bremsen
            fg.g.position.lerpVectors(fg.start, nach, e);
            fg.g.position.y = Math.sin(u * Math.PI) * 0.45;
            // Ausholen (stauchen), Strecken im Flug, Nachfedern bei der Landung
            let sy = 1;
            if (u < 0.12) sy = 1 - 0.2 * (u / 0.12);
            else if (u < 0.3) sy = 0.8 + 0.32 * ((u - 0.12) / 0.18);
            else if (u < 0.85) sy = 1.12 - 0.12 * ((u - 0.3) / 0.55);
            else sy = 1 - 0.16 * Math.sin(((u - 0.85) / 0.15) * Math.PI);
            fg.g.userData.koerper.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
            // in Laufrichtung drehen
            const winkel = Math.atan2(nach.x - fg.start.x, nach.z - fg.start.z) - Math.PI / 2;
            let d = winkel - fg.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
            fg.g.rotation.y += d * Math.min(1, dt * 14);
          }
        } else if (fg.ziel) {
          fg.g.position.lerp(fg.ziel, 0.15);
          fg.g.position.y = fg.dran && !ruhig() ? Math.abs(Math.sin(t * 2.4)) * 0.06 : 0;
          fg.g.userData.koerper.scale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
        }
        fg.g.userData.schild.scale.setScalar(fg.dran ? 1 + Math.sin(t * 3) * 0.12 : 0.85);
        fg.g.userData.schild.material.opacity = fg.dran ? 1 : 0.5;
        fg.g.userData.schild.material.transparent = true;
      }
      // Neue Häuser fallen aufs Brett
      for (const h of this.haeuserGruppe.children) if (h.userData.fallen !== undefined) {
        h.userData.fallen += dt * 3;
        const u = Math.min(1, h.userData.fallen);
        h.position.y = 1.5 * (1 - u) * (1 - u) + (u > 0.8 ? Math.sin((u - 0.8) * 15) * 0.03 : 0);
        if (u >= 1) { h.position.y = 0; delete h.userData.fallen; }
      }
      this.renderer.render(this.szene, this.kamera);
    }
  }

  return {
    moeglich: webglDa,
    async einhaengen(host, felder, gruppen) {
      if (!THREE) { laden ||= import("/vendor/three.module.min.js").then((m) => { THREE = m; }); await laden; }
      // Schrift muss geladen sein, bevor sie ins Brett gemalt wird
      try { await Promise.race([document.fonts?.load?.("800 40px Outfit"), new Promise((ok) => setTimeout(ok, 1500))]); } catch {}
      return new Brett(host, felder, gruppen);
    },
  };
})();
