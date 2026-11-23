// =============================================================
//  Quartett: 3D-Spieltisch (Three.js, wird erst bei Bedarf geladen)
//  - runder Holztisch mit Filz, warmes Licht, weiche Schatten
//  - jede Person sitzt als eigene Toon-Figur passend zu ihrem Avatar
//    (eigene, stilisierte Tierfiguren aus Grundformen, keine Filmfiguren)
//  - Figuren atmen, denken, jubeln, sind traurig; gelegte Karten fliegen auf den Tisch
//  Fällt WebGL aus, nutzt das Spiel automatisch die 2,5D-Ansicht.
// =============================================================
const QuartettTisch3D = (() => {
  let THREE = null;
  let laden = null;
  const aus = () => { try { return localStorage.getItem("q3d") === "aus"; } catch { return false; } };

  function webglDa() {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
  }

  // ---------- Baupläne der Figuren (pro Avatar) ----------
  // fell, bauch, ohren, schnauze, extra
  const PLAENE = {
    "🦊": { fell: 0xe8742a, bauch: 0xfff1e0, ohren: "spitz", schnauze: "lang", schwanz: "buschig" },
    "🐼": { fell: 0xf4f4f0, bauch: 0xf4f4f0, ohren: "rund", ohrFarbe: 0x222226, schnauze: "kurz", extra: ["augenflecken", "dunkleArme"] },
    "🐸": { fell: 0x5cbf4a, bauch: 0xd8f5b0, ohren: "keine", schnauze: "keine", extra: ["froschaugen"] },
    "🦁": { fell: 0xf0b13c, bauch: 0xffe6a8, ohren: "rund", schnauze: "kurz", extra: ["maehne"], schwanz: "quaste" },
    "🐙": { fell: 0xe2557a, bauch: 0xf7a3ba, ohren: "keine", schnauze: "keine", extra: ["tentakel"], ohneBeine: true },
    "🦄": { fell: 0xf7f3ff, bauch: 0xffffff, ohren: "spitz", schnauze: "lang", extra: ["horn", "regenbogenmaehne"] },
    "🐵": { fell: 0x8a5a3a, bauch: 0xf1c9a0, ohren: "seitlich", schnauze: "kurz", schwanz: "lang" },
    "🐯": { fell: 0xf08a24, bauch: 0xfff4e4, ohren: "rund", schnauze: "kurz", extra: ["streifen"], schwanz: "lang" },
    "🐨": { fell: 0x9aa3ad, bauch: 0xdfe4ea, ohren: "gross", schnauze: "nase" },
    "🦖": { fell: 0x4fae5a, bauch: 0xc9f0a8, ohren: "keine", schnauze: "lang", extra: ["rueckenzacken"], schwanz: "dick" },
    "🐧": { fell: 0x22242c, bauch: 0xf6f6f6, ohren: "keine", schnauze: "schnabel", extra: ["fluegelchen"] },
    "🦉": { fell: 0x8a6440, bauch: 0xe8d2b0, ohren: "federn", schnauze: "schnabel", extra: ["grosseAugen"] },
    "🐝": { fell: 0xffc928, bauch: 0xffe27a, ohren: "fuehler", schnauze: "keine", extra: ["bienenstreifen", "fluegel"] },
    "🐳": { fell: 0x3c8de0, bauch: 0xcfe8ff, ohren: "keine", schnauze: "keine", extra: ["flosse"], ohneBeine: true },
    "🦩": { fell: 0xff8fb8, bauch: 0xffc4d9, ohren: "keine", schnauze: "schnabel", extra: ["duenneBeine"] },
    "🐲": { fell: 0x3fb06a, bauch: 0xd6f5a0, ohren: "hoerner", schnauze: "lang", extra: ["rueckenzacken", "fluegel"], schwanz: "dick" },
    "🦈": { fell: 0x7d8ea3, bauch: 0xeef3f8, ohren: "keine", schnauze: "keine", extra: ["rueckenflosse", "zaehne"], ohneBeine: true },
    "🤖": { roboter: true, fell: 0xb8c4d4 },
    "👾": { fell: 0x8a5cff, bauch: 0xb69cff, ohren: "fuehler", schnauze: "keine", extra: ["pixel"] },
  };

  // Toon-Material mit 3 Helligkeitsstufen (Comic-Look)
  let stufen = null;
  const mat = (farbe, opt = {}) => new THREE.MeshToonMaterial({ color: farbe, gradientMap: stufen, ...opt });

  function figur(avatar) {
    const p = PLAENE[avatar] || { fell: 0x9aa3ad, bauch: 0xe5e8ee, ohren: "rund", schnauze: "kurz" };
    const g = new THREE.Group();
    const teile = {};
    const kugel = (r, farbe, x, y, z, sx = 1, sy = 1, sz = 1, eltern = g) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), typeof farbe === "number" ? mat(farbe) : farbe);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; eltern.add(m); return m;
    };
    const kegel = (r, h, farbe, x, y, z, rx = 0, rz = 0, eltern = g) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat(farbe));
      m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; eltern.add(m); return m;
    };

    if (p.roboter) {
      const box = (w, h, d, farbe, x, y, z, eltern = g) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(farbe)); m.position.set(x, y, z); m.castShadow = true; eltern.add(m); return m;
      };
      teile.koerper = box(0.8, 0.8, 0.6, p.fell, 0, 0.62, 0);
      box(0.4, 0.25, 0.05, 0x4fd1ff, 0, 0.68, 0.31);
      teile.kopf = new THREE.Group(); teile.kopf.position.set(0, 1.35, 0); g.add(teile.kopf);
      box(0.7, 0.55, 0.55, p.fell, 0, 0, 0, teile.kopf);
      box(0.14, 0.14, 0.05, 0xffffff, -0.15, 0.05, 0.28, teile.kopf); box(0.14, 0.14, 0.05, 0xffffff, 0.15, 0.05, 0.28, teile.kopf);
      kugel(0.05, 0x1a1a2e, -0.15, 0.05, 0.31, 1, 1, 1, teile.kopf); kugel(0.05, 0x1a1a2e, 0.15, 0.05, 0.31, 1, 1, 1, teile.kopf);
      box(0.3, 0.05, 0.05, 0xff5a5a, 0, -0.15, 0.28, teile.kopf);
      box(0.04, 0.25, 0.04, 0x888888, 0, 0.38, 0, teile.kopf); kugel(0.07, 0xff4d4d, 0, 0.53, 0, 1, 1, 1, teile.kopf);
      teile.armL = box(0.16, 0.5, 0.16, 0x8f9cb0, -0.5, 0.65, 0); teile.armR = box(0.16, 0.5, 0.16, 0x8f9cb0, 0.5, 0.65, 0);
      box(0.22, 0.3, 0.22, 0x8f9cb0, -0.2, 0.15, 0); box(0.22, 0.3, 0.22, 0x8f9cb0, 0.2, 0.15, 0);
      return { g, teile };
    }

    // Körper und Bauch
    teile.koerper = kugel(0.5, p.fell, 0, 0.62, 0, 1, 1.12, 0.92);
    kugel(0.36, p.bauch, 0, 0.58, 0.18, 1, 1.1, 0.75);
    // Beine / Füße
    if (!p.ohneBeine) {
      const bein = p.extra?.includes("duenneBeine") ? 0.05 : 0.17;
      const fuss = p.schnauze === "schnabel" ? 0xffa53a : p.extra?.includes("dunkleArme") ? 0x222226 : p.fell;
      kugel(bein, fuss, -0.2, 0.12, 0.1, 1, 0.8, 1.3); kugel(bein, fuss, 0.2, 0.12, 0.1, 1, 0.8, 1.3);
    } else if (p.extra?.includes("tentakel")) {
      for (let i = 0; i < 8; i++) {
        const w = (i / 8) * Math.PI * 2;
        kugel(0.11, p.fell, Math.cos(w) * 0.38, 0.12, Math.sin(w) * 0.32, 1, 0.7, 1.8).rotation.y = -w;
      }
    }
    // Arme
    const armFarbe = p.extra?.includes("dunkleArme") ? 0x222226 : p.fell;
    teile.armL = kugel(0.13, armFarbe, -0.48, 0.66, 0.05, 1, 1.8, 1);
    teile.armR = kugel(0.13, armFarbe, 0.48, 0.66, 0.05, 1, 1.8, 1);
    teile.armL.rotation.z = 0.35; teile.armR.rotation.z = -0.35;

    // Kopf
    teile.kopf = new THREE.Group();
    teile.kopf.position.set(0, 1.32, 0.02);
    g.add(teile.kopf);
    const k = teile.kopf;
    kugel(0.44, p.fell, 0, 0, 0, 1.08, 0.98, 1, k);
    // Augen
    const augeGr = p.extra?.includes("grosseAugen") || p.extra?.includes("froschaugen") ? 0.13 : 0.085;
    const augeY = p.extra?.includes("froschaugen") ? 0.3 : 0.06;
    for (const s of [-1, 1]) {
      if (p.extra?.includes("augenflecken")) kugel(0.13, 0x222226, s * 0.17, 0.05, 0.33, 1, 1.25, 0.5, k).rotation.z = s * 0.5;
      if (p.extra?.includes("froschaugen")) kugel(0.15, p.fell, s * 0.2, 0.26, 0.2, 1, 1, 1, k);
      kugel(augeGr, 0xffffff, s * 0.17, augeY, 0.37, 1, 1.1, 0.6, k);
      kugel(augeGr * 0.55, 0x1a1420, s * 0.17, augeY, 0.42, 1, 1.15, 0.6, k);
      kugel(augeGr * 0.18, 0xffffff, s * 0.17 + 0.02, augeY + 0.03, 0.45, 1, 1, 1, k);
    }
    // Schnauze
    if (p.schnauze === "kurz") { kugel(0.17, p.bauch, 0, -0.12, 0.36, 1.25, 0.8, 0.8, k); kugel(0.05, 0x2a1a1a, 0, -0.06, 0.48, 1.4, 1, 1, k); }
    if (p.schnauze === "lang") { kugel(0.17, p.bauch, 0, -0.1, 0.42, 1, 0.75, 1.3, k); kugel(0.05, 0x2a1a1a, 0, -0.04, 0.62, 1.3, 1, 1, k); }
    if (p.schnauze === "nase") kugel(0.11, 0x3a3a44, 0, -0.08, 0.42, 1, 1.3, 0.8, k);
    if (p.schnauze === "schnabel") kegel(0.09, 0.2, 0xffa53a, 0, -0.08, 0.46, Math.PI / 2, 0, k);
    // Ohren
    const ohrFarbe = p.ohrFarbe ?? p.fell;
    for (const s of [-1, 1]) {
      if (p.ohren === "rund") kugel(0.13, ohrFarbe, s * 0.3, 0.32, -0.02, 1, 1, 0.5, k);
      if (p.ohren === "gross") kugel(0.2, ohrFarbe, s * 0.38, 0.25, -0.02, 1, 1, 0.45, k);
      if (p.ohren === "seitlich") kugel(0.12, p.bauch, s * 0.46, 0.02, 0, 0.5, 1, 1, k);
      if (p.ohren === "spitz") kegel(0.12, 0.3, ohrFarbe, s * 0.24, 0.42, 0, 0, -s * 0.35, k);
      if (p.ohren === "federn") kegel(0.08, 0.22, ohrFarbe, s * 0.26, 0.42, 0, 0, -s * 0.5, k);
      if (p.ohren === "hoerner") kegel(0.06, 0.26, 0xf3e6c8, s * 0.2, 0.44, -0.05, -0.3, -s * 0.3, k);
      if (p.ohren === "fuehler") {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3), mat(0x222226));
        f.position.set(s * 0.15, 0.5, 0); f.rotation.z = -s * 0.3; k.add(f);
        kugel(0.06, avatar === "👾" ? 0x8a5cff : 0x222226, s * 0.2, 0.65, 0, 1, 1, 1, k);
      }
    }
    // Extras
    const ex = p.extra || [];
    if (ex.includes("maehne")) for (let i = 0; i < 12; i++) { const w = (i / 12) * Math.PI * 2; kugel(0.16, 0xa8551e, Math.cos(w) * 0.42, Math.sin(w) * 0.4, -0.08, 1, 1, 0.7, k); }
    if (ex.includes("horn")) kegel(0.06, 0.34, 0xffd23f, 0, 0.5, 0.18, -0.4, 0, k);
    if (ex.includes("regenbogenmaehne")) [0xff6b9d, 0xffd23f, 0x6be0ff, 0xb07cff].forEach((c, i) => kugel(0.1, c, 0, 0.32 - i * 0.14, -0.38 - i * 0.03, 1, 1, 1, k));
    if (ex.includes("streifen")) for (const y of [0.25, 0.12]) for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), mat(0x2a1a10)); st.position.set(s * 0.32, y, 0.22); st.rotation.z = s * 0.4; k.add(st);
    }
    if (ex.includes("streifen")) for (const y of [0.85, 0.65, 0.45]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 6, 24, Math.PI * 0.6), mat(0x2a1a10)); st.position.set(0, y, 0); st.rotation.set(Math.PI / 2, 0, Math.PI * 0.2); g.add(st); }
    if (ex.includes("bienenstreifen")) for (const y of [0.45, 0.72]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.06, 8, 32), mat(0x222226)); st.position.set(0, y, 0); st.rotation.x = Math.PI / 2; st.scale.set(1, 0.95, 1); g.add(st); }
    if (ex.includes("fluegel")) for (const s of [-1, 1]) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshToonMaterial({ color: avatar === "🐝" ? 0xe8f7ff : p.fell, transparent: avatar === "🐝", opacity: 0.7, gradientMap: stufen }));
      fl.position.set(s * 0.45, 0.95, -0.3); fl.scale.set(1.3, 0.6, 0.15); fl.rotation.z = s * 0.5; g.add(fl); (teile.fluegel ||= []).push(fl);
    }
    if (ex.includes("rueckenzacken")) for (let i = 0; i < 4; i++) kegel(0.07, 0.18, 0xd6f5a0, 0, 1.0 - i * 0.2, -0.45 + i * 0.02, -0.6, 0);
    if (ex.includes("fluegelchen")) for (const s of [-1, 1]) teile[s < 0 ? "armL" : "armR"].scale.set(0.7, 2, 0.8);
    if (ex.includes("flosse") || ex.includes("rueckenflosse")) kegel(0.14, 0.3, p.fell, 0, 0.5, -0.1, -0.3, 0, k);
    if (ex.includes("zaehne")) for (let i = -2; i <= 2; i++) kegel(0.025, 0.06, 0xffffff, i * 0.06, -0.18, 0.4, Math.PI, 0, k);
    if (ex.includes("pixel")) for (const s of [-1, 1]) kugel(0.1, p.fell, s * 0.5, 0.3, 0, 1, 1, 1, k);
    // Schwanz
    if (p.schwanz) {
      const lang = p.schwanz === "lang" ? 0.9 : p.schwanz === "dick" ? 0.7 : 0.55;
      const sw = kugel(p.schwanz === "buschig" ? 0.17 : 0.09, p.fell, 0.25, 0.3, -0.5, 1, 1, lang * 3);
      sw.rotation.set(-0.6, 0.6, 0);
      if (p.schwanz === "buschig") kugel(0.12, 0xffffff, 0.48, 0.48, -0.85, 1, 1, 1);
      if (p.schwanz === "quaste") kugel(0.1, 0xa8551e, 0.45, 0.45, -0.85, 1, 1, 1);
      teile.schwanz = sw;
    }
    return { g, teile };
  }

  // ---------- Texturen ----------
  function holzTextur() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    const x = c.getContext("2d");
    x.fillStyle = "#6b3f22"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(${40 + Math.random() * 30},${20 + Math.random() * 15},10,${0.15 + Math.random() * 0.25})`;
      x.lineWidth = 1 + Math.random() * 3;
      x.beginPath(); const y = Math.random() * 512; x.moveTo(0, y);
      for (let k = 0; k <= 512; k += 32) x.lineTo(k, y + Math.sin(k / 60 + i) * 6);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function filzTextur(farbe) {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
    const x = c.getContext("2d"); x.scale(2, 2);
    const g = x.createRadialGradient(256, 256, 40, 256, 256, 256);
    g.addColorStop(0, farbe); g.addColorStop(1, "#0b2418");
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1, 1); }
    x.strokeStyle = "rgba(255,230,160,.35)"; x.lineWidth = 4; x.setLineDash([14, 12]);
    x.beginPath(); x.arc(256, 256, 170, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]); x.font = "bold 46px Outfit, sans-serif"; x.fillStyle = "rgba(255,230,160,.22)"; x.textAlign = "center"; x.fillText("SpielO", 256, 272);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // Kartenrückseite mit SpielO-Artwork: dunkler Grund, Strahlen, großer Spielstein, Schriftzug
  function rueckenTextur() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 752;
    const x = c.getContext("2d"); x.scale(2, 2);
    x.fillStyle = "#fff"; x.beginPath(); x.roundRect(0, 0, 256, 376, 24); x.fill();
    const g = x.createLinearGradient(0, 0, 256, 376); g.addColorStop(0, "#2a1450"); g.addColorStop(1, "#120a24");
    x.fillStyle = g; x.beginPath(); x.roundRect(12, 12, 232, 352, 18); x.fill();
    x.save(); x.translate(128, 170); x.globalAlpha = 0.14;
    for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.fillStyle = i % 2 ? "#ffc928" : "#ff3b4f"; x.beginPath(); x.moveTo(0, 0); x.lineTo(-22, -260); x.lineTo(22, -260); x.fill(); }
    x.restore();
    const s = x.createLinearGradient(80, 120, 176, 216); s.addColorStop(0, "#ffc928"); s.addColorStop(1, "#ff3b4f");
    x.fillStyle = "#fff"; x.beginPath(); x.arc(128, 168, 56, 0, Math.PI * 2); x.fill();
    x.fillStyle = s; x.beginPath(); x.arc(128, 168, 48, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(128, 168, 15, 0, Math.PI * 2); x.fill();
    x.font = "900 44px Outfit, system-ui, sans-serif"; x.fillStyle = "#fff"; x.textAlign = "center"; x.fillText("SpielO", 128, 284);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------- Tisch ----------
  class Tisch {
    constructor(host) {
      this.host = host;
      this.figuren = new Map();
      this.karten = new Map(); // gelegte Karten pro Spieler
      this.topf = [];
      this.uhr = new THREE.Clock();
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(r.domElement);
      this.schilder = document.createElement("div"); this.schilder.className = "q3d-schilder"; host.appendChild(this.schilder);
      const s = this.szene = new THREE.Scene();
      s.fog = new THREE.Fog(0x120a1a, 9, 18);
      this.kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
      this.kamera.position.set(0, 4.4, 6.4);
      this.kamera.lookAt(0, 0.9, -0.4);
      // Licht: warmes Hauptlicht, kühles Gegenlicht, weiche Umgebung
      s.add(new THREE.HemisphereLight(0xffe9d0, 0x1a0f24, 1.1));
      const sonne = new THREE.DirectionalLight(0xffe2b8, 2.2);
      sonne.position.set(3, 7, 5); sonne.castShadow = true;
      sonne.shadow.mapSize.set(1024, 1024); sonne.shadow.camera.left = -6; sonne.shadow.camera.right = 6; sonne.shadow.camera.top = 6; sonne.shadow.camera.bottom = -6; sonne.shadow.bias = -0.0008;
      s.add(sonne);
      const rand = new THREE.DirectionalLight(0xb07cff, 1.4); rand.position.set(-4, 3, -6); s.add(rand);
      this.lampe = new THREE.PointLight(0xffc46b, 18, 9, 1.6); this.lampe.position.set(0, 3.6, 0); s.add(this.lampe);
      // Boden
      const boden = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x1c1026, roughness: 0.95 }));
      boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; s.add(boden);
      // Tisch: Holzrand, Filz, Fuß
      const holz = new THREE.MeshStandardMaterial({ map: holzTextur(), roughness: 0.55, metalness: 0.05 });
      const platte = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.0, 0.22, 64), holz);
      platte.position.y = 0.78; platte.castShadow = platte.receiveShadow = true; s.add(platte);
      const rand2 = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.09, 12, 64), holz);
      rand2.rotation.x = Math.PI / 2; rand2.position.y = 0.9; rand2.castShadow = true; s.add(rand2);
      this.filz = new THREE.Mesh(new THREE.CylinderGeometry(2.78, 2.78, 0.03, 64), new THREE.MeshStandardMaterial({ map: filzTextur("#1f6a45"), roughness: 1 }));
      this.filz.position.y = 0.9; this.filz.rotation.y = Math.PI / 2; this.filz.receiveShadow = true; s.add(this.filz);
      const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 0.7, 24), holz); fuss.position.y = 0.35; fuss.castShadow = true; s.add(fuss);
      this.kartenGeo = new THREE.BoxGeometry(0.42, 0.015, 0.6);
      this.kartenMat = [0, 0, new THREE.MeshStandardMaterial({ map: rueckenTextur(), roughness: 0.5 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: 0xf5eedc }));
      this.groesse();
      this.beobachter = new ResizeObserver(() => this.groesse()); this.beobachter.observe(host);
      this.laeuft = true;
      const schleife = () => {
        if (!this.laeuft) return;
        requestAnimationFrame(schleife);
        if (document.hidden || !this.host.isConnected) return;
        this.bild();
      };
      schleife();
    }

    groesse() {
      const w = this.host.clientWidth || 600, h = this.host.clientHeight || 340;
      this.renderer.setSize(w, h, false);
      this.kamera.aspect = w / h;
      // Schmale Bildschirme: Kamera weiter weg, damit alle Figuren ins Bild passen
      const verh = w / h;
      const weite = verh < 0.8 ? 1.6 : verh < 1.2 ? 1.4 : 1;
      this.kamera.position.set(0, 4.4 * weite, 6.4 * weite);
      this.kamera.lookAt(0, 0.9, -0.4);
      this.kamera.updateProjectionMatrix();
    }

    platz(i, n) {
      // Gegner sitzen auf der gegenüberliegenden Tischhälfte, du selbst unten (nicht sichtbar)
      const winkel = n === 1 ? [0] : n === 2 ? [-0.5, 0.5] : n === 3 ? [-0.85, 0, 0.85]
        : Array.from({ length: n }, (_, k) => -1.45 + (2.9 * k) / (n - 1));
      const w = winkel[i] ?? 0;
      return { w, x: Math.sin(w) * 3.75, z: -Math.cos(w) * 3.75 };
    }

    // Zustand übernehmen: wer sitzt wo, wer ist dran, wer hat gelegt
    aktualisieren(z, ich) {
      const andere = (z.teilnehmer || []).filter((t) => t.id !== ich);
      const fr = z.spiel === "farbrausch" || z.spiel === "skat";
      const ids = new Set(andere.map((t) => t.id));
      for (const [id, f] of this.figuren) if (!ids.has(id)) { this.szene.remove(f.g); f.schild.remove(); this.figuren.delete(id); }
      andere.forEach((t, i) => {
        let f = this.figuren.get(t.id);
        if (!f || f.avatar !== t.avatar) {
          if (f) { this.szene.remove(f.g); f.schild.remove(); }
          const neu = figur(t.avatar);
          f = { ...neu, avatar: t.avatar, phase: Math.random() * 6, reaktion: null };
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffb23d, transparent: true, opacity: 0 }));
          ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; f.g.add(ring); f.ring = ring;
          f.schild = document.createElement("div");
          f.schild.className = "q-sitz q3d-schild";
          this.schilder.appendChild(f.schild);
          this.szene.add(f.g);
          this.figuren.set(t.id, f);
        }
        const p = this.platz(i, andere.length);
        f.g.position.set(p.x, 0, p.z);
        f.g.scale.setScalar(1.25);
        f.g.lookAt(0, 0, 0.8);
        f.platz = p;
        const fr = z.spiel === "farbrausch" || z.spiel === "skat";
        const dran = fr ? z.phase === "spielen" && z.dran === t.id : (z.phase === "waehlen" && z.waehler === t.id) || (z.phase === "kontern" && !z.gelegt?.includes(t.id) && t.karten > 0);
        f.dran = dran; f.denkt = fr ? dran : z.phase === "waehlen" && z.waehler === t.id; f.raus = fr ? false : !t.karten;
        f.karten = t.karten;
        const ansage = z.phase === "kontern" && z.angesagt?.spieler === t.id;
        f.schild.dataset.teilnehmer = t.id;
        f.schild.classList.toggle("dran", dran);
        f.schild.classList.toggle("raus", !t.karten);
        f.schild.innerHTML = `${ansage ? `<span class="q-blase">${z.ansageText || ""}</span>` : ""}
          ${z.phase === "kontern" && z.gelegt?.includes(t.id) && !ansage ? '<span class="q-haken">✓</span>' : ""}
          ${fr && z.gerufen?.includes(t.id) && t.karten === 1 ? '<span class="q-blase">Letzte Karte!</span>' : ""}
          <span class="q-schild"><b>${t.name.replace(/[<>&]/g, "")}</b><span>${t.karten || fr ? `🃏 ${t.karten}` : "raus"}${fr && z.ziel ? ` · ${t.punkte} P.` : ""}${t.bot ? " · 🤖" : ""}${t.afk ? " · 💤" : ""}</span></span>`;
      });
      if (z.spiel === "farbrausch") return this.farbrausch(z, ich);
      if (fr) return;
      // Gelegte Karten (verdeckt) auf den Tisch
      const gelegt = new Set(z.phase === "kontern" ? z.gelegt : []);
      for (const [id, m] of this.karten) if (!gelegt.has(id)) { this.szene.remove(m); this.karten.delete(id); }
      for (const id of gelegt) {
        if (this.karten.has(id)) continue;
        const m = new THREE.Mesh(this.kartenGeo, this.kartenMat);
        m.castShadow = true;
        const f = this.figuren.get(id);
        const start = f ? new THREE.Vector3(f.platz.x, 1.9, f.platz.z) : new THREE.Vector3(0, 2.2, 4.5);
        const ziel = f ? new THREE.Vector3(Math.sin(f.platz.w) * 1.7, 0.93, -Math.cos(f.platz.w) * 1.7) : new THREE.Vector3(0, 0.93, 1.6);
        m.position.copy(start);
        m.userData = { start, ziel, t0: this.uhr.getElapsedTime(), dreh: (Math.random() - 0.5) * 0.6 };
        this.szene.add(m); this.karten.set(id, m);
      }
      // Topf in der Mitte
      const n = Math.min(12, z.topf || 0);
      while (this.topf.length > n) this.szene.remove(this.topf.pop());
      while (this.topf.length < n) {
        const m = new THREE.Mesh(this.kartenGeo, this.kartenMat);
        m.position.set((Math.random() - 0.5) * 0.08, 0.93 + this.topf.length * 0.018, (Math.random() - 0.5) * 0.08);
        m.rotation.y = Math.random() * Math.PI; m.castShadow = true;
        this.szene.add(m); this.topf.push(m);
      }
    }

    // ---------- GoonO (Farbrausch): Ablage, Stapel, Handfächer, Richtung, Farbe ----------
    farbrausch(z, ich) {
      const THREE_ = THREE;
      if (!this.fr) {
        this.fr = { ablage: [], handFaecher: new Map(), letzteT: 0, karteGeo: new THREE_.BoxGeometry(0.5, 0.012, 0.74) };
        // Ziehstapel
        this.fr.stapel = new THREE_.Group();
        this.fr.stapel.position.set(-0.85, 0.92, 0.05);
        this.szene.add(this.fr.stapel);
        // Richtungsring aus Pfeilen auf dem Filz
        const ring = new THREE_.Group();
        for (let i = 0; i < 6; i++) {
          const pf = new THREE_.Mesh(new THREE_.ConeGeometry(0.09, 0.22, 3), new THREE_.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
          const w = (i / 6) * Math.PI * 2;
          pf.position.set(Math.cos(w) * 1.75, 0.93, Math.sin(w) * 1.75);
          pf.rotation.set(Math.PI / 2, 0, -w);
          ring.add(pf);
        }
        this.fr.ring = ring; this.szene.add(ring);
        // Farbschein auf dem Filz (aktuelle Farbe)
        this.fr.schein = new THREE_.Mesh(new THREE_.RingGeometry(2.0, 2.7, 64), new THREE_.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE_.DoubleSide }));
        this.fr.schein.rotation.x = -Math.PI / 2; this.fr.schein.position.y = 0.925; this.szene.add(this.fr.schein);
      }
      const fr = this.fr;
      fr.richtung = z.richtung || 1;
      const FARBE = { rot: 0xff3b4f, gelb: 0xffc928, gruen: 0x2ecc71, blau: 0x2f8bff };
      fr.schein.material.color.setHex(FARBE[z.farbe] || 0xffffff);
      fr.zielOpacity = 0.32;
      // Ziehstapel-Höhe
      const n = Math.min(14, Math.ceil((z.stapelAnzahl || 0) / 6));
      while (fr.stapel.children.length > n) fr.stapel.remove(fr.stapel.children[fr.stapel.children.length - 1]);
      while (fr.stapel.children.length < n) {
        const m = new THREE_.Mesh(fr.karteGeo, this.kartenMat);
        m.position.y = fr.stapel.children.length * 0.014; m.rotation.y = (Math.random() - 0.5) * 0.08; m.castShadow = true;
        fr.stapel.add(m);
      }
      // Handfächer vor jeder Figur (verdeckt)
      for (const [id, f] of this.figuren) {
        let fach = fr.handFaecher.get(id);
        if (!fach) { fach = new THREE_.Group(); this.szene.add(fach); fr.handFaecher.set(id, fach); }
        const anzahl = Math.min(9, f.karten || 0);
        if (fach.userData.n !== anzahl) {
          fach.clear();
          for (let i = 0; i < anzahl; i++) {
            const m = new THREE_.Mesh(new THREE_.BoxGeometry(0.26, 0.38, 0.008), [0, 0, 0, 0, this.kartenMat[2], this.kartenMat[2]].map((x) => x || this.kartenMat[0]));
            const w = (i - (anzahl - 1) / 2) * 0.16;
            m.position.set(Math.sin(w) * 0.5, 1.25 + Math.cos(w) * 0.12, 0.35);
            m.rotation.set(-0.25, 0, -w);
            fach.add(m);
          }
          fach.userData.n = anzahl;
        }
        fach.position.copy(f.g.position);
        fach.rotation.y = Math.atan2(-f.g.position.x, 0.8 - f.g.position.z);
      }
      // Neue Aktion: Karte fliegt auf die Ablage bzw. Karten fliegen vom Stapel
      const a = z.letzteAktion;
      if (a && a.t !== fr.letzteT) {
        const erstesMal = !fr.letzteT;
        fr.letzteT = a.t;
        if (a.typ === "austeilen" || erstesMal) {
          fr.ablage.forEach((m) => this.szene.remove(m)); fr.ablage = [];
          if (a.typ === "austeilen" && !erstesMal && a.karten) {
            // Reihum austeilen: jede Person bekommt nacheinander ihre Karten
            const plaetze = [...this.figuren.keys(), "ich"];
            const schritt = Math.max(0.05, ((a.dauer || 2500) / 1000 - 0.6) / (a.karten * plaetze.length));
            let n = 0;
            for (let k = 0; k < a.karten; k++) for (const p of plaetze) this.kartenFlug(p, n++ * schritt);
            const t0 = n * schritt;
            setTimeout(() => this.ablageKarte(z.oben, null, false), t0 * 1000 + 200);
          } else this.ablageKarte(z.oben, null, true);
        } else if (a.typ === "legen") {
          this.ablageKarte(a.karte, a.spieler === ich ? "ich" : a.spieler, false);
        } else if (a.typ === "ziehen" || a.typ === "erwischt") {
          const ziel = a.typ === "erwischt" ? a.ziel : a.spieler;
          for (let i = 0; i < Math.min(6, a.anzahl || 2); i++) this.kartenFlug(ziel === ich ? "ich" : ziel, i * 0.09);
        }
      }
    }

    // Eine Karte (mit Vorderseite) landet auf dem Ablagestapel
    ablageKarte(karte, von, sofort) {
      const fr = this.fr;
      if (!karte || !this.karteBild) return;
      const tex = new THREE.CanvasTexture(this.karteBild(karte)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const vorne = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
      const m = new THREE.Mesh(fr.karteGeo, [this.kartenMat[0], this.kartenMat[0], vorne, this.kartenMat[2], this.kartenMat[0], this.kartenMat[0]]);
      m.castShadow = true;
      const ziel = new THREE.Vector3((Math.random() - 0.5) * 0.12 + 0.25, 0.925 + fr.ablage.length * 0.013, (Math.random() - 0.5) * 0.12);
      const f = von && von !== "ich" ? this.figuren.get(von) : null;
      const start = sofort ? ziel.clone() : f ? new THREE.Vector3(f.g.position.x, 1.8, f.g.position.z) : new THREE.Vector3(0, 2.4, 4.6);
      m.position.copy(start);
      m.userData = { flug: { start, ziel, t0: this.uhr.getElapsedTime(), dauer: sofort ? 0.01 : 0.55, drehEnde: (Math.random() - 0.5) * 0.9, drehStart: (Math.random() - 0.5) * 4 } };
      this.szene.add(m);
      fr.ablage.push(m);
      if (fr.ablage.length > 8) this.szene.remove(fr.ablage.shift());
    }

    // Verdeckte Karte fliegt vom Stapel zu einer Person
    kartenFlug(nach, verzoegerung = 0) {
      const fr = this.fr;
      const m = new THREE.Mesh(fr.karteGeo, this.kartenMat);
      const f = nach !== "ich" ? this.figuren.get(nach) : null;
      const start = fr.stapel.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      const ziel = f ? new THREE.Vector3(f.g.position.x, 1.6, f.g.position.z) : new THREE.Vector3(0, 2.2, 4.8);
      m.position.copy(start);
      m.userData = { flug: { start, ziel, t0: this.uhr.getElapsedTime() + verzoegerung, dauer: 0.5, drehEnde: 0, drehStart: 3, weg: true } };
      this.szene.add(m);
      (fr.fluege ||= []).push(m);
    }

    reaktion(id, art) {
      const f = this.figuren.get(id);
      if (f) f.reaktion = { art, t0: this.uhr.getElapsedTime() };
    }

    bild() {
      const t = this.uhr.getElapsedTime();
      for (const f of this.figuren.values()) {
        const { g, teile } = f;
        const atem = Math.sin(t * 2 + f.phase);
        let y = 0, kippen = 0, drehen = 0, kopfNeigen = 0, armeHoch = 0;
        if (f.denkt) { kopfNeigen = Math.sin(t * 2.4) * 0.25; y = Math.abs(Math.sin(t * 3)) * 0.06; }
        else if (f.dran) y = Math.abs(Math.sin(t * 4)) * 0.12;
        if (f.raus) { kippen = 1.2; y = -0.2; }
        const r = f.reaktion;
        if (r) {
          const d = t - r.t0;
          if (d > 1.8) f.reaktion = null;
          else if (r.art === "jubelt") { y = Math.abs(Math.sin(d * 7)) * 0.6 * (1 - d / 1.8); drehen = d * 7; armeHoch = 1; }
          else if (r.art === "traurig") { kopfNeigen = 0; teile.kopf.rotation.x = Math.min(0.6, d * 1.2); y = -0.08; }
          else if (r.art === "staunt") drehen = Math.sin(d * 18) * 0.25;
        }
        g.position.y = y;
        g.rotation.z = kippen * 0.2;
        teile.koerper.scale.y = (teile.koerper.userData.sy ??= teile.koerper.scale.y) * (1 + atem * 0.025);
        if (!r || r.art !== "traurig") teile.kopf.rotation.x = atem * 0.03;
        teile.kopf.rotation.z = kopfNeigen;
        teile.kopf.rotation.y = drehen ? 0 : Math.sin(t * 0.7 + f.phase) * 0.15;
        if (drehen) g.rotation.y = Math.atan2(-g.position.x, 0.8 - g.position.z) + drehen;
        else g.lookAt(0, 0, 0.8);
        if (teile.armL) { teile.armL.rotation.z = 0.35 + armeHoch * 2.2 + atem * 0.05; teile.armR.rotation.z = -0.35 - armeHoch * 2.2 - atem * 0.05; }
        if (teile.fluegel) teile.fluegel.forEach((fl, i) => (fl.rotation.y = Math.sin(t * 18) * 0.3 * (i ? 1 : -1)));
        if (teile.schwanz) teile.schwanz.rotation.y = 0.6 + Math.sin(t * 2.5 + f.phase) * 0.3;
        f.ring.material.opacity = f.dran ? 0.55 + Math.sin(t * 5) * 0.3 : 0;
      }
      // Karten fliegen auf den Tisch
      for (const m of this.karten.values()) {
        const u = m.userData, p = Math.min(1, (t - u.t0) / 0.6), e = 1 - Math.pow(1 - p, 3);
        m.position.lerpVectors(u.start, u.ziel, e);
        m.position.y += Math.sin(p * Math.PI) * 0.6;
        m.rotation.set(0, u.dreh + (1 - e) * 3, 0);
      }
      if (this.fr) {
        const fr = this.fr;
        fr.ring.rotation.y -= 0.004 * fr.richtung;
        fr.schein.material.opacity += ((fr.zielOpacity || 0) + Math.sin(t * 2) * 0.06 - fr.schein.material.opacity) * 0.1;
        const fliegt = (m) => {
          const u = m.userData.flug;
          if (!u) return false;
          const p = Math.max(0, Math.min(1, (t - u.t0) / u.dauer)), e = 1 - Math.pow(1 - p, 3);
          m.position.lerpVectors(u.start, u.ziel, e);
          m.position.y += Math.sin(p * Math.PI) * 0.7;
          m.rotation.set(0, u.drehEnde + (1 - e) * u.drehStart, 0);
          if (p >= 1) { if (u.weg) { this.szene.remove(m); return true; } m.userData.flug = null; }
          return false;
        };
        fr.ablage.forEach(fliegt);
        if (fr.fluege) fr.fluege = fr.fluege.filter((m) => !fliegt(m));
      }
      this.lampe.intensity = 16 + Math.sin(t * 1.3) * 1.5;
      this.renderer.render(this.szene, this.kamera);
      // Namensschilder über den Köpfen
      const w = this.host.clientWidth, h = this.host.clientHeight, v = new THREE.Vector3();
      for (const f of this.figuren.values()) {
        f.teile.kopf.getWorldPosition(v); v.y += 0.85; v.project(this.kamera);
        f.schild.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    }
  }

  let tisch = null;
  return {
    // Soll der 3D-Tisch genutzt werden? (WebGL da, nicht abgeschaltet)
    moeglich: () => !aus() && webglDa(),
    umschalten() { try { localStorage.setItem("q3d", aus() ? "an" : "aus"); } catch {} return !aus(); },
    // Tisch in einen Container hängen (wird wiederverwendet, damit nichts neu geladen werden muss)
    async einhaengen(container) {
      if (!THREE) {
        laden ||= import("/vendor/three.module.min.js").then((m) => {
          THREE = m;
          stufen = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
          stufen.minFilter = stufen.magFilter = THREE.NearestFilter; stufen.needsUpdate = true;
        });
        await laden;
      }
      if (!tisch) {
        const host = document.createElement("div");
        host.className = "q3d";
        tisch = new Tisch(host);
      }
      container.appendChild(tisch.host);
      tisch.groesse();
      return tisch;
    },
    get tisch() { return tisch; },
  };
})();
