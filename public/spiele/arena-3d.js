// =============================================================
//  Arena 3D: ein ganzes Kolosseum als Vollbild-Welt hinter dem Spiel.
//  - vier Ränge rundherum mit Bögen, über tausend Zuschauer, Sonnensegel, Feuerschalen
//  - Kamera ist immer in Bewegung: Anflug von oben, sanftes Schwenken, Heranfahren bei Jubel
//  - Gladiator läuft mit jedem Ruhm-Punkt weiter zum Goldenen Lorbeer
//  - Glut, Rosenblätter, Goldregen und La-Ola-Welle
//  three.js wird erst geladen, wenn die Arena gebraucht wird.
// =============================================================
window.ArenaBuehne3D = (() => {
  let THREE = null, laden = null, buehne = null;
  const webglDa = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.animationen === "aus";
  const handy = () => Math.min(innerWidth, innerHeight) < 700;
  const STUFEN_FARBE = { 0: 0x6b6478, 10: 0xc0844f, 30: 0x3fc47d, 60: 0x4d8eff, 85: 0xb363ff, 100: 0xffcf3f };
  const E = 0.74; // Ellipse: Tiefe im Verhältnis zur Breite
  const weich = (k) => k * k * (3 - 2 * k);

  // ---------- Texturen (aus Canvas, keine Downloads) ----------
  function canvasTextur(w, h, malen, wiederholen) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    malen(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    if (wiederholen) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...wiederholen); }
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const sandTextur = () => canvasTextur(256, 256, (g) => {
    g.fillStyle = "#d6b37a"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) { const v = 140 + Math.random() * 100; g.fillStyle = `rgba(${v},${v * 0.8},${v * 0.55},${0.12 + Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    // Spuren im Sand
    g.strokeStyle = "rgba(120,85,45,.12)"; g.lineWidth = 3;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 60, 0, Math.PI * (0.4 + Math.random())); g.stroke(); }
  }, [5, 5]);
  const steinTextur = () => canvasTextur(256, 128, (g) => {
    g.fillStyle = "#c4a273"; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "rgba(80,52,25,.38)"; g.lineWidth = 2;
    for (let y = 0; y < 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); for (let x = (y / 16) % 2 ? 0 : 16; x < 256; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(70,45,20,${Math.random() * 0.14})`; g.fillRect(Math.random() * 256, Math.random() * 128, 3, 3); }
  }, [14, 1]);
  const himmelTextur = () => canvasTextur(16, 512, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "#07051a"); v.addColorStop(0.32, "#1d1240"); v.addColorStop(0.44, "#5a2a5c"); v.addColorStop(0.5, "#d0643f"); v.addColorStop(0.53, "#ffb35a"); v.addColorStop(0.6, "#2a1420"); v.addColorStop(1, "#120a14");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const punktTextur = () => canvasTextur(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.7)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
  const segelTextur = (farbe) => canvasTextur(64, 128, (g) => {
    g.fillStyle = farbe; g.fillRect(0, 0, 64, 128);
    g.fillStyle = "rgba(255,255,255,.12)"; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 2, 128);
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 118, 64, 10);
  });

  class Buehne {
    constructor(host) {
      this.host = host;
      this.uhr = new THREE.Clock();
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: !handy(), alpha: false, powerPreference: "high-performance" });
      r.setPixelRatio(Math.min(handy() ? 1.5 : 1.75, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(r.domElement);
      const s = this.szene = new THREE.Scene();
      s.fog = new THREE.FogExp2(0x24122a, 0.018);
      this.kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 140);
      this.punkt = punktTextur();
      this.licht();
      this.himmel();
      this.boden();
      this.kolosseum();
      this.feuerschalen();
      this.weg();
      this.gladiator = this.figur();
      s.add(this.gladiator);
      this.partikel();
      // Zustand
      this.pos = 0; this.ziel = 0; this.gehen = 0; this.jubel = 0; this.traurig = 0; this.stufe = null;
      this.fokus = 0; this.ola = -1; this.flug = 1; this.endeModus = false; this.blickX = 0;
      this.gladiator.position.set(this.xAuf(0), 0, 1.4);
      this.mengeZiel = Math.round(this.plaetze.length * 0.12);
      this.menge.count = this.mengeZiel;
      this.groesse();
      this.beobachter = new ResizeObserver(() => this.groesse()); this.beobachter.observe(host);
      const schleife = () => {
        requestAnimationFrame(schleife);
        if (document.hidden || !this.host.isConnected || this.host.offsetParent === null && getComputedStyle(this.host).position !== "fixed") return;
        this.bild();
      };
      schleife();
    }

    xAuf(anteil) { return -4.6 + anteil * 8.6; }

    licht() {
      const s = this.szene;
      s.add(new THREE.HemisphereLight(0xffd9b0, 0x2a1530, 1.15));
      const sonne = this.sonne = new THREE.DirectionalLight(0xffb070, 2.4);
      sonne.position.set(-9, 11, 7); sonne.castShadow = true;
      sonne.shadow.mapSize.set(handy() ? 1024 : 2048, handy() ? 1024 : 2048);
      Object.assign(sonne.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 40 });
      sonne.shadow.bias = -0.0006;
      s.add(sonne);
      const gegen = new THREE.DirectionalLight(0x9a6cff, 0.9); gegen.position.set(8, 5, -9); s.add(gegen);
    }

    // Himmel mit Abendrot, Sternen und ziehenden Wolkenschleiern
    himmel() {
      const s = this.szene;
      const kuppel = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ map: himmelTextur(), side: THREE.BackSide, fog: false, depthWrite: false }));
      s.add(kuppel);
      const n = 700, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const w = Math.random() * Math.PI * 2, h = 0.25 + Math.random() * 0.75;
        pos.set([Math.cos(w) * 65 * Math.sqrt(1 - h * h), h * 65, Math.sin(w) * 65 * Math.sqrt(1 - h * h)], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.sterne = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.45, map: this.punkt, transparent: true, depthWrite: false, fog: false, color: 0xfff4dd }));
      s.add(this.sterne);
      // Wolkenschleier: große, halbtransparente Ebenen, die langsam ziehen
      this.wolken = [];
      const wolkeTex = canvasTextur(256, 128, (c) => {
        for (let i = 0; i < 40; i++) {
          const x = 30 + Math.random() * 196, y = 40 + Math.random() * 48, r = 18 + Math.random() * 30;
          const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,170,130,.22)"); gr.addColorStop(1, "rgba(255,170,130,0)");
          c.fillStyle = gr; c.fillRect(0, 0, 256, 128);
        }
      });
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshBasicMaterial({ map: wolkeTex, transparent: true, depthWrite: false, fog: false, opacity: 0.7 }));
        const w = (i / 5) * Math.PI * 2;
        m.position.set(Math.cos(w) * 50, 14 + i * 2.5, Math.sin(w) * 50); m.lookAt(0, 10, 0);
        s.add(m); this.wolken.push({ m, w, r: 50, y: 14 + i * 2.5 });
      }
    }

    boden() {
      const s = this.szene;
      const sand = new THREE.Mesh(new THREE.CircleGeometry(9.2, 80), new THREE.MeshStandardMaterial({ map: sandTextur(), roughness: 1 }));
      sand.rotation.x = -Math.PI / 2; sand.scale.set(1, E, 1); sand.receiveShadow = true; s.add(sand);
      // Draußen (unter den Rängen) dunkler Boden, damit nichts „schwebt“
      const aussen = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshStandardMaterial({ color: 0x241612, roughness: 1 }));
      aussen.rotation.x = -Math.PI / 2; aussen.position.y = -0.02; s.add(aussen);
    }

    // Vier Ränge rundherum, Bögen und Säulen, oben die Außenmauer mit Masten und Sonnensegeln
    kolosseum() {
      const s = this.szene;
      const stein = new THREE.MeshStandardMaterial({ map: steinTextur(), roughness: 0.9 });
      const steinHell = new THREE.MeshStandardMaterial({ color: 0xd9bf94, roughness: 0.85 });
      const dunkel = new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 1 });
      const ring = (r, h, y, mat) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true), mat);
        m.position.y = y; m.scale.set(1, 1, E); m.material.side = THREE.DoubleSide; m.receiveShadow = true; s.add(m);
      };
      const stufe = (r1, r2, y) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 96), steinHell);
        m.rotation.x = -Math.PI / 2; m.position.y = y; m.scale.set(1, E, 1); m.receiveShadow = true; s.add(m);
      };
      // Podiumsmauer um den Sand
      ring(9.2, 1.1, 0.55, stein);
      const kante = new THREE.Mesh(new THREE.TorusGeometry(9.25, 0.12, 6, 120), steinHell);
      kante.rotation.x = Math.PI / 2; kante.scale.set(1, E, 1); kante.position.y = 1.12; s.add(kante);
      // Ränge: Stufe (Sitzfläche) + Setzstufe (Wand)
      this.raenge = [];
      for (let t = 0; t < 4; t++) {
        const r = 9.2 + t * 0.85, y = 1.1 + t * 0.95;
        stufe(r, r + 0.85, y);
        ring(r + 0.85, 0.95, y + 0.475, stein);
        this.raenge.push({ r: r + 0.42, y });
      }
      // Oberer Abschluss: Außenmauer mit Bögen (innen sichtbar)
      const rA = 9.2 + 4 * 0.85, yA = 1.1 + 4 * 0.95;
      ring(rA, 3.2, yA + 1.6, stein);
      const nBogen = 56;
      const bogenGeo = new THREE.BoxGeometry(0.5, 1.15, 0.08), saeuleGeo = new THREE.CylinderGeometry(0.1, 0.12, 3.1, 8);
      const boegen = new THREE.InstancedMesh(bogenGeo, dunkel, nBogen * 2), saeulen = new THREE.InstancedMesh(saeuleGeo, steinHell, nBogen);
      const h = new THREE.Object3D();
      for (let i = 0; i < nBogen; i++) {
        const w = (i / nBogen) * Math.PI * 2;
        for (let k = 0; k < 2; k++) {
          h.position.set(Math.cos(w) * (rA - 0.06), yA + 0.75 + k * 1.45, Math.sin(w) * (rA - 0.06) * E);
          h.scale.set(1, k ? 0.8 : 1, 1); h.lookAt(0, h.position.y, 0); h.updateMatrix(); boegen.setMatrixAt(i * 2 + k, h.matrix);
        }
        const w2 = w + Math.PI / nBogen;
        h.position.set(Math.cos(w2) * (rA - 0.16), yA + 1.55, Math.sin(w2) * (rA - 0.16) * E); h.scale.set(1, 1, 1); h.rotation.set(0, 0, 0); h.updateMatrix(); saeulen.setMatrixAt(i, h.matrix);
      }
      s.add(boegen, saeulen);
      // Masten und Sonnensegel (Velarium), rot und creme im Wechsel
      const nSegel = 28;
      this.segel = [];
      const mastGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), mastMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1c });
      const texRot = segelTextur("#a3241e"), texCreme = segelTextur("#e9d9b8");
      for (let i = 0; i < nSegel; i++) {
        const w = (i / nSegel) * Math.PI * 2;
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.set(Math.cos(w) * (rA + 0.1), yA + 4.3, Math.sin(w) * (rA + 0.1) * E); s.add(mast);
        const g = new THREE.Group();
        g.position.set(Math.cos(w) * rA, yA + 5.3, Math.sin(w) * rA * E);
        g.lookAt(0, yA + 3.4, 0);
        const breite = (2 * Math.PI * rA) / nSegel * 0.98;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(breite, 3.6, 1, 4), new THREE.MeshStandardMaterial({ map: i % 2 ? texRot : texCreme, side: THREE.DoubleSide, roughness: 0.9, transparent: true, opacity: 0.96 }));
        p.position.z = 1.8; p.rotation.x = -Math.PI / 2 + 0.38;
        g.add(p); s.add(g);
        this.segel.push({ p, phase: i * 0.7 });
      }
      // Kaiserloge im Norden: Baldachin in Purpur und Gold
      const loge = new THREE.Group();
      const purpur = new THREE.MeshStandardMaterial({ color: 0x5b1d7a, roughness: 0.6 }), gold = new THREE.MeshStandardMaterial({ color: 0xffcf3f, metalness: 0.8, roughness: 0.3 });
      const dach = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.2), purpur); dach.position.y = 1.7; loge.add(dach);
      for (const x of [-1.5, 1.5]) { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 8), gold); sl.position.set(x, 0.85, 0.5); loge.add(sl); }
      const tuch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), purpur); tuch.position.set(0, 0.4, 0.62); loge.add(tuch);
      const adler = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), gold); adler.position.set(0, 1.95, 0.4); loge.add(adler); this.adler = adler;
      loge.position.set(0, 1.12, -9.6 * E); s.add(loge);
      // Fahnen über der Loge
      this.fahnen = [];
      for (const x of [-2.4, -0.8, 0.8, 2.4]) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.2, 4, 1), new THREE.MeshStandardMaterial({ color: x < 0 === (Math.abs(x) > 1) ? 0xa3241e : 0xffcf3f, side: THREE.DoubleSide }));
        f.position.set(x, yA + 3.8, -rA * E + 0.3); s.add(f);
        this.fahnen.push(f);
      }
      // Publikum: kleine Figuren (Körper + Kopf) auf allen Rängen
      this.plaetze = [];
      const zufall = ((x) => () => (x = (x * 16807) % 2147483647) / 2147483647)(7);
      for (const { r, y } of this.raenge) {
        const n = Math.round((2 * Math.PI * r) / (handy() ? 0.27 : 0.21));
        for (let i = 0; i < n; i++) {
          const w = (i / n) * Math.PI * 2 + zufall() * 0.02;
          // Vor der Kaiserloge bleibt Platz
          if (r < 9.8 && Math.abs(Math.sin(w) + 1) < 0.02 && Math.abs(Math.cos(w)) < 0.17) continue;
          this.plaetze.push({ x: Math.cos(w) * (r + (zufall() - 0.5) * 0.15), y: y + 0.18, z: Math.sin(w) * r * E, w, phase: zufall() * 6, ordnung: zufall(), groesse: 0.85 + zufall() * 0.3 });
        }
      }
      this.plaetze.sort((a, b) => a.ordnung - b.ordnung);
      const anzahl = this.plaetze.length;
      const koerper = this.menge = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.075, 0.13, 2, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), anzahl);
      const koepfe = this.koepfe = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.7 }), anzahl);
      const farben = [0xe8524a, 0x3d7dff, 0xf2b33d, 0xf4efe6, 0x9b59ff, 0x3fbf72, 0xff8a3d, 0xd9d0c0, 0xb3261e, 0x2f9e9e];
      const haut = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
      for (let i = 0; i < anzahl; i++) {
        koerper.setColorAt(i, new THREE.Color(farben[Math.floor(zufall() * farben.length)]));
        koepfe.setColorAt(i, new THREE.Color(haut[Math.floor(zufall() * haut.length)]));
      }
      koerper.count = koepfe.count = 0;
      s.add(koerper, koepfe);
      this.hilf = new THREE.Object3D();
    }

    // Feuerschalen rund um die Arena (vier davon werfen echtes Licht)
    feuerschalen() {
      const s = this.szene;
      this.schalen = [];
      const schaleMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.4 });
      const feuerMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false });
      const kernMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, toneMapped: false });
      const n = 12;
      for (let i = 0; i < n; i++) {
        const w = (i / n) * Math.PI * 2 + 0.13;
        const g = new THREE.Group();
        const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.6, 8), schaleMat); fuss.position.y = 0.3; g.add(fuss);
        const schale = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.18, 12), schaleMat); schale.position.y = 0.65; g.add(schale);
        const feuer = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), feuerMat); feuer.position.y = 0.98; g.add(feuer);
        const kern = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), kernMat); kern.position.y = 0.88; g.add(kern);
        g.position.set(Math.cos(w) * 8.75, 0, Math.sin(w) * 8.75 * E);
        let licht = null;
        if (i % 3 === 0) { licht = new THREE.PointLight(0xff8a30, 3, 9, 1.6); licht.position.y = 1.2; g.add(licht); }
        s.add(g);
        this.schalen.push({ g, feuer, kern, licht, phase: i * 1.7 });
      }
    }

    // Weg aus Steinplatten mit Fackeln, am Ende der Goldene Lorbeer
    weg() {
      const s = this.szene;
      const platte = new THREE.MeshStandardMaterial({ color: 0xa88a62, roughness: 0.95 });
      for (let i = 0; i <= 24; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.7), platte);
        p.position.set(this.xAuf(i / 24), 0.025, 1.4); p.rotation.y = (Math.random() - 0.5) * 0.1; p.receiveShadow = true; s.add(p);
      }
      this.fackeln = [];
      const holz = new THREE.MeshStandardMaterial({ color: 0x5a3a1c });
      [0.25, 0.5, 0.75].forEach((a) => {
        const g = new THREE.Group();
        const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), holz); stab.position.y = 0.45; stab.castShadow = true; g.add(stab);
        const schale = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.4 })); schale.position.y = 0.92; g.add(schale);
        const feuer = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20, toneMapped: false })); feuer.position.y = 1.1; g.add(feuer);
        const licht = new THREE.PointLight(0xff8a30, 0, 3.5, 1.8); licht.position.y = 1.2; g.add(licht);
        g.position.set(this.xAuf(a), 0, 0.78); s.add(g);
        this.fackeln.push({ anteil: a, feuer, licht, an: false });
      });
      // Ziel: Sockel mit goldenem Lorbeerkranz
      const sockel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 0.6 }));
      sockel.position.set(this.xAuf(1) + 0.6, 0.3, 1.4); sockel.castShadow = true; sockel.receiveShadow = true; s.add(sockel);
      const gold = new THREE.MeshStandardMaterial({ color: 0xffcf3f, metalness: 0.85, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.5 });
      const kranz = this.kranz = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 32, Math.PI * 1.7), gold); ring.rotation.z = Math.PI * 0.65; kranz.add(ring);
      for (let i = 0; i < 14; i++) {
        const w = Math.PI * 0.65 + (i / 13) * Math.PI * 1.7;
        const blatt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), gold);
        blatt.scale.set(1, 0.45, 0.5); blatt.position.set(Math.cos(w) * 0.27, Math.sin(w) * 0.27, 0); blatt.rotation.z = w + 0.6; kranz.add(blatt);
      }
      kranz.position.set(this.xAuf(1) + 0.6, 1.0, 1.4);
      s.add(kranz);
      this.kranzLicht = new THREE.PointLight(0xffd76a, 1.5, 4, 1.5); this.kranzLicht.position.copy(kranz.position); s.add(this.kranzLicht);
      // Lichtsäule über dem Lorbeer (wird mit dem Fortschritt heller)
      const saeule = this.lichtSaeule = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      saeule.position.set(this.xAuf(1) + 0.6, 4.5, 1.4); s.add(saeule);
    }

    // Glut über den Feuerschalen, Staub in der Luft, Rosenblätter und Goldregen
    partikel() {
      const s = this.szene;
      const mach = (n, farbe, groesse, additiv) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        const m = new THREE.PointsMaterial({ size: groesse, map: this.punkt, vertexColors: true, transparent: true, depthWrite: false, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending, color: farbe });
        const p = new THREE.Points(g, m); p.frustumCulled = false; s.add(p);
        return p;
      };
      // Glut: steigt von den Schalen auf
      const nGlut = handy() ? 160 : 320;
      this.glut = mach(nGlut, 0xffffff, 0.09, true);
      this.glutDaten = Array.from({ length: nGlut }, () => this.neueGlut({}));
      const gc = this.glut.geometry.attributes.color;
      for (let i = 0; i < nGlut; i++) gc.setXYZ(i, 1, 0.45 + Math.random() * 0.35, 0.1);
      // Staub: schwebt langsam im Licht
      const nStaub = handy() ? 120 : 260;
      this.staub = mach(nStaub, 0xffffff, 0.05, true);
      const sp = this.staub.geometry.attributes.position, sc = this.staub.geometry.attributes.color;
      this.staubDaten = [];
      for (let i = 0; i < nStaub; i++) {
        const d = { x: (Math.random() - 0.5) * 16, y: Math.random() * 5, z: (Math.random() - 0.5) * 11, p: Math.random() * 6 };
        this.staubDaten.push(d); sp.setXYZ(i, d.x, d.y, d.z); sc.setXYZ(i, 1, 0.85, 0.6);
      }
      // Fest: Rosenblätter und Goldregen (nur bei Jubel aktiv)
      const nFest = 500;
      this.fest = mach(nFest, 0xffffff, 0.14, false);
      this.festDaten = Array.from({ length: nFest }, () => ({ aktiv: false }));
      this.festIndex = 0;
    }
    neueGlut(d) {
      const sch = this.schalen[Math.floor(Math.random() * this.schalen.length)].g.position;
      d.x = sch.x + (Math.random() - 0.5) * 0.3; d.y = 1 + Math.random() * 0.3; d.z = sch.z + (Math.random() - 0.5) * 0.3;
      d.vy = 0.5 + Math.random() * 0.9; d.leben = 1.5 + Math.random() * 2.5; d.p = Math.random() * 6;
      return d;
    }
    // Rosenblätter (aus dem Publikum zum Gladiator) oder Goldregen (von oben)
    werfen(art, anzahl) {
      const ziel = this.gladiator.position;
      const farbe = new THREE.Color();
      for (let k = 0; k < anzahl; k++) {
        const d = this.festDaten[this.festIndex]; this.festIndex = (this.festIndex + 1) % this.festDaten.length;
        d.aktiv = true; d.leben = 3.5 + Math.random() * 1.5;
        if (art === "gold") {
          d.x = ziel.x + (Math.random() - 0.5) * 9; d.y = 7 + Math.random() * 4; d.z = ziel.z + (Math.random() - 0.5) * 6;
          d.vx = (Math.random() - 0.5) * 0.3; d.vy = -0.6 - Math.random() * 0.8; d.vz = (Math.random() - 0.5) * 0.3;
          farbe.setHSL(0.11 + Math.random() * 0.04, 1, 0.55 + Math.random() * 0.3);
        } else {
          const p = this.plaetze[Math.floor(Math.random() * Math.max(1, this.menge.count))];
          d.x = p.x; d.y = p.y + 0.3; d.z = p.z;
          const zx = ziel.x + (Math.random() - 0.5) * 2, zz = ziel.z + (Math.random() - 0.5) * 2, t = 1.6 + Math.random() * 0.6;
          d.vx = (zx - d.x) / t; d.vz = (zz - d.z) / t; d.vy = (0 - d.y) / t + 4.9 * t * 0.5;
          d.schwer = true;
          farbe.setHSL(0.96 + Math.random() * 0.05, 0.85, 0.45 + Math.random() * 0.2);
        }
        d.schwer = art !== "gold";
        this.fest.geometry.attributes.color.setXYZ(this.festDaten.indexOf(d), farbe.r, farbe.g, farbe.b);
      }
      this.fest.geometry.attributes.color.needsUpdate = true;
    }

    // Gladiator aus einfachen Formen: Helm mit Kamm, Schild, Schwert, Umhang
    figur() {
      const g = new THREE.Group();
      const haut = new THREE.MeshStandardMaterial({ color: 0xe0ac7e, roughness: 0.7 });
      const metall = new THREE.MeshStandardMaterial({ color: 0xc9ccd4, metalness: 0.85, roughness: 0.3 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xe9b949, metalness: 0.8, roughness: 0.3 });
      const rot = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.6 });
      const leder = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
      const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
      this.beine = [-0.09, 0.09].map((x) => {
        const bein = new THREE.Group(); bein.position.set(0, 0.5, x);
        bein.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.42, 8), haut, 0, -0.21, 0));
        bein.add(mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.16, 8), leder, 0, -0.36, 0));
        bein.add(mesh(new THREE.BoxGeometry(0.15, 0.06, 0.09), leder, 0.03, -0.47, 0));
        g.add(bein); return bein;
      });
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 10), rot, 0, 0.5, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.34, 10), metall, 0, 0.75, 0));
      const guertel = mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), gold, 0, 0.62, 0); guertel.rotation.x = Math.PI / 2; g.add(guertel);
      const umhang = mesh(new THREE.PlaneGeometry(0.34, 0.5), rot, -0.17, 0.66, 0);
      umhang.rotation.y = Math.PI / 2; umhang.material = rot.clone(); umhang.material.side = THREE.DoubleSide; g.add(umhang); this.umhang = umhang;
      g.add(mesh(new THREE.SphereGeometry(0.11, 14, 12), haut, 0, 1.03, 0));
      g.add(mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), metall, 0, 1.05, 0));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.025, 0.24), metall, 0.02, 1.0, 0));
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.04), rot, -0.02, 1.2, 0));
      this.armL = new THREE.Group(); this.armL.position.set(0, 0.88, 0.2); g.add(this.armL);
      this.armL.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 8), haut, 0, -0.15, 0));
      const schild = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), rot, 0.06, -0.22, 0.06); schild.rotation.x = Math.PI / 2; this.armL.add(schild);
      this.armL.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), gold, 0.06, -0.22, 0.09));
      this.armL.add(mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 24), gold, 0.06, -0.22, 0.08));
      this.armR = new THREE.Group(); this.armR.position.set(0, 0.88, -0.2); g.add(this.armR);
      this.armR.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 8), haut, 0, -0.15, 0));
      const schwert = new THREE.Group(); schwert.position.set(0.04, -0.3, 0); this.armR.add(schwert);
      schwert.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), leder, 0, 0, 0));
      schwert.add(mesh(new THREE.BoxGeometry(0.03, 0.025, 0.14), gold, 0, 0.05, 0));
      schwert.add(mesh(new THREE.BoxGeometry(0.02, 0.4, 0.05), metall, 0, 0.26, 0));
      this.schwert = schwert;
      schwert.rotation.z = -1.2;
      g.scale.setScalar(1.3);
      return g;
    }

    groesse() {
      const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
      this.renderer.setSize(w, h, false);
      this.kamera.aspect = w / h;
      this.hochkant = w / h < 1;
      this.kamera.fov = w / h < 0.8 ? 72 : w / h < 1.4 ? 60 : 50;
      // Bildausschnitt nach unten verschieben: die Szene sitzt im oberen Teil, darunter liegt das Spiel
      this.kamera.setViewOffset(w, h, 0, h * (this.hochkant ? 0.14 : 0.1), w, h);
      this.kamera.updateProjectionMatrix();
    }

    // Anflug von hoch oben hinein ins Kolosseum
    anflug() { if (!ruhig()) this.flug = 0; }
    // Endbildschirm: Kamera kreist langsam um den Gladiator
    ende(an) { this.endeModus = an; }

    // Neuer Stand: Gladiator läuft weiter, Publikum füllt sich, Jubel je nach Stufe
    setzen(punkte, max, { stufe = null, sofort = false, ende = null } = {}) {
      if (ende !== null) this.endeModus = ende;
      const anteil = Math.max(0, Math.min(1, punkte / max));
      if (sofort || ruhig()) { this.pos = this.ziel = anteil; this.gladiator.position.x = this.xAuf(anteil); }
      else this.ziel = anteil;
      this.stufe = stufe;
      if (stufe !== null && !sofort) {
        this.jubel = stufe >= 85 ? 3.2 : stufe >= 30 ? 2 : stufe > 0 ? 1.2 : 0;
        if (stufe >= 30) this.fokus = 1;
        if (stufe >= 60) this.werfen("rose", stufe >= 85 ? 140 : 70);
        if (stufe >= 85) this.ola = 0;
        if (stufe >= 100) { this.werfen("gold", 260); setTimeout(() => this.werfen("gold", 200), 700); }
      }
      if (stufe === 0 && !sofort) this.traurig = 1.6;
      // Grundbesetzung 12 %, voll bei vollem Ruhm
      this.mengeZiel = Math.round((0.12 + anteil * 0.88) * this.plaetze.length);
      if (sofort) this.menge.count = this.koepfe.count = this.mengeZiel;
    }

    bild() {
      const dt = Math.min(0.05, this.uhr.getDelta());
      const t = this.uhr.elapsedTime;
      const still = ruhig();
      const g = this.gladiator;
      // ---------- Gladiator ----------
      const diff = this.ziel - this.pos;
      const laeuft = Math.abs(diff) > 0.002;
      if (laeuft) { this.pos += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.2); this.gehen += dt * 11; }
      g.position.x = this.xAuf(this.pos);
      const schwung = laeuft ? Math.sin(this.gehen) : 0;
      this.beine[0].rotation.z = schwung * 0.6; this.beine[1].rotation.z = -schwung * 0.6;
      g.position.y = laeuft ? Math.abs(Math.sin(this.gehen)) * 0.05 : 0;
      this.umhang.rotation.z = laeuft ? 0.25 + Math.sin(this.gehen * 0.5) * 0.1 : 0.05 + Math.sin(t * 1.5) * 0.04;
      g.rotation.y += ((this.endeModus && !laeuft ? -0.6 : 0) - g.rotation.y) * 0.05;
      if (this.jubel > 0 && !laeuft) {
        this.jubel -= dt;
        this.armR.rotation.z = -2.6 + Math.sin(t * 10) * 0.2;
        this.schwert.rotation.z = 0;
        g.position.y = Math.abs(Math.sin(t * 8)) * 0.12;
      } else if (this.traurig > 0 && !laeuft) {
        this.traurig -= dt;
        this.armR.rotation.z = 0.1; this.schwert.rotation.z = -1.5;
        g.rotation.x = 0.14;
      } else {
        // Leerlauf: atmet, schaut sich um, schwingt das Schwert
        this.armR.rotation.z += ((laeuft ? -schwung * 0.4 : 0.1 + Math.sin(t * 0.9) * 0.08) - this.armR.rotation.z) * 0.2;
        this.schwert.rotation.z += (-1.2 - this.schwert.rotation.z) * 0.2;
        g.rotation.x *= 0.9;
        if (!laeuft) g.scale.y = 1.3 * (1 + Math.sin(t * 2.2) * 0.012);
      }
      this.armL.rotation.z = laeuft ? schwung * 0.3 : Math.sin(t * 1.3) * 0.05;
      // ---------- Fackeln, Feuerschalen, Lorbeer ----------
      for (const f of this.fackeln) {
        f.an = this.pos >= f.anteil - 0.001;
        f.licht.intensity += ((f.an ? 3 : 0) - f.licht.intensity) * 0.1;
        f.feuer.scale.setScalar(f.an ? 1 + Math.sin(t * 14 + f.anteil * 9) * 0.14 : 0.001);
      }
      for (const s of this.schalen) {
        const fl = 1 + Math.sin(t * 13 + s.phase) * 0.12 + Math.sin(t * 7.3 + s.phase * 2) * 0.08;
        s.feuer.scale.set(1, fl, 1); s.kern.scale.set(1, 2 - fl, 1);
        if (s.licht) s.licht.intensity = 2.6 + (fl - 1) * 6 + (this.jubel > 0 ? 1.5 : 0);
      }
      this.kranz.rotation.y = t * 0.8;
      this.kranz.position.y = 1.0 + Math.sin(t * 1.6) * 0.05;
      this.kranzLicht.intensity = 0.8 + this.pos * 3 + (this.pos > 0.99 ? Math.sin(t * 6) * 1.2 : 0);
      this.lichtSaeule.material.opacity = 0.02 + this.pos * 0.14 + (this.pos > 0.99 ? 0.08 + Math.sin(t * 3) * 0.04 : 0);
      this.adler.rotation.y = t * 0.6;
      // ---------- Himmel, Segel, Fahnen ----------
      if (!still) {
        this.sterne.rotation.y = t * 0.004;
        for (const w of this.wolken) { w.w += dt * 0.006; w.m.position.set(Math.cos(w.w) * w.r, w.y, Math.sin(w.w) * w.r); w.m.lookAt(0, 10, 0); }
        for (const s of this.segel) s.p.rotation.x = -Math.PI / 2 + 0.38 + Math.sin(t * 0.9 + s.phase) * 0.035;
        this.fahnen.forEach((f, i) => { f.rotation.y = Math.sin(t * 2.2 + i) * 0.35; });
      }
      // ---------- Publikum ----------
      const ziel = this.mengeZiel;
      if (this.menge.count !== ziel) {
        const n = this.menge.count + Math.sign(ziel - this.menge.count) * Math.max(1, Math.round(Math.abs(ziel - this.menge.count) * 0.06));
        this.menge.count = this.koepfe.count = n;
      }
      if (this.ola >= 0) { this.ola += dt * 2.2; if (this.ola > Math.PI * 2 + 1) this.ola = -1; }
      const jubelnd = this.jubel > 0;
      for (let i = 0; i < this.menge.count; i++) {
        const p = this.plaetze[i];
        let hoch = still ? 0 : Math.max(0, Math.sin(t * (jubelnd ? 11 : 1.6) + p.phase)) * (jubelnd ? 0.14 : 0.025);
        if (this.ola >= 0) { const d = Math.abs(((p.w - this.ola) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < 0.35) hoch += (0.35 - d) * 0.9; }
        this.hilf.position.set(p.x, p.y + hoch, p.z);
        this.hilf.scale.setScalar(p.groesse);
        this.hilf.updateMatrix();
        this.menge.setMatrixAt(i, this.hilf.matrix);
        this.hilf.position.y += 0.19 * p.groesse;
        this.hilf.updateMatrix();
        this.koepfe.setMatrixAt(i, this.hilf.matrix);
      }
      this.menge.instanceMatrix.needsUpdate = true; this.koepfe.instanceMatrix.needsUpdate = true;
      // ---------- Partikel ----------
      if (!still) {
        const gp = this.glut.geometry.attributes.position;
        this.glutDaten.forEach((d, i) => {
          d.leben -= dt; d.y += d.vy * dt; d.x += Math.sin(t * 2 + d.p) * dt * 0.25; d.z += Math.cos(t * 1.7 + d.p) * dt * 0.2;
          if (d.leben <= 0 || d.y > 7) this.neueGlut(d);
          gp.setXYZ(i, d.x, d.y, d.z);
        });
        gp.needsUpdate = true;
        const sp = this.staub.geometry.attributes.position;
        this.staubDaten.forEach((d, i) => sp.setXYZ(i, d.x + Math.sin(t * 0.3 + d.p) * 0.4, d.y + Math.sin(t * 0.21 + d.p * 2) * 0.3, d.z + Math.cos(t * 0.25 + d.p) * 0.4));
        sp.needsUpdate = true;
      }
      const fp = this.fest.geometry.attributes.position;
      let festAktiv = false;
      this.festDaten.forEach((d, i) => {
        if (!d.aktiv) { fp.setXYZ(i, 0, -50, 0); return; }
        festAktiv = true;
        d.leben -= dt;
        if (d.schwer) d.vy -= 4.9 * dt; else { d.vx += Math.sin(t * 3 + i) * dt * 0.4; }
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y < 0.03) { d.y = 0.03; d.vx *= 0.3; d.vz *= 0.3; d.vy = 0; d.schwer = false; d.leben = Math.min(d.leben, 1.2); }
        if (d.leben <= 0) d.aktiv = false;
        fp.setXYZ(i, d.x, d.y, d.z);
      });
      if (festAktiv || this.festWarAktiv) fp.needsUpdate = true;
      this.festWarAktiv = festAktiv;
      // ---------- Kamera ----------
      this.kameraBewegen(dt, t, still);
      this.renderer.render(this.szene, this.kamera);
    }

    kameraBewegen(dt, t, still) {
      // Die Kamera bleibt immer im Sand-Oval (Tiefe nur 9,2 × 0,74 ≈ 6,8), sonst steht sie in den Rängen
      const k = this.kamera;
      const gx = this.gladiator.position.x;
      const hoch = this.hochkant;
      this.blickX += (gx * (hoch ? 0.9 : 0.55) - this.blickX) * Math.min(1, dt * 1.5);
      this.fokus = Math.max(0, this.fokus - dt * 0.28);
      const f = weich(Math.min(1, this.fokus * 1.4));
      const blick = new THREE.Vector3();
      const pos = new THREE.Vector3();
      if (still) {
        pos.set(this.blickX * 0.5, hoch ? 2.6 : 2.2, hoch ? 6.2 : 6.0);
        blick.set(this.blickX, 0.8, 1.0);
      } else if (this.endeModus) {
        // Am Ende: langsame Umrundung des Gladiators
        // Mittelpunkt zwischen Arena-Mitte und Gladiator, damit die Kamera nie in den Rängen landet
        const w = t * 0.14, r = (hoch ? 6.2 : 5.8) + Math.sin(t * 0.3) * 0.4, cx = gx * 0.4;
        pos.set(cx + Math.sin(w) * r, 2.6 + Math.sin(t * 0.23) * 0.5, 1.0 + Math.cos(w) * r * 0.85);
        blick.set(gx, 1.5, 1.4);
      } else {
        // Immer in Bewegung: schwenken, heben und senken, bei Jubel nah heran
        const w = Math.sin(t * 0.09) * 0.42 + Math.sin(t * 0.031) * 0.2;
        const r = (hoch ? 6.1 : 6.0) + Math.sin(t * 0.07) * 0.35 - f * 2.6;
        pos.set(Math.sin(w) * r + this.blickX * 0.5, (hoch ? 2.4 : 2.2) + Math.sin(t * 0.13) * 0.35 - f * 0.6, Math.cos(w) * r * 0.97);
        blick.set(this.blickX * (1 - f) + gx * f, 1.35 - f * 0.3, 0.6 + f * 0.8);
      }
      // Anflug: von hoch über der Arena durch die Öffnung im Sonnensegel hinab
      if (this.flug < 1) {
        this.flug = Math.min(1, this.flug + dt / 4.5);
        const a = weich(this.flug), w = -2.4 * (1 - a);
        const oben = new THREE.Vector3(Math.sin(w) * 2.5, 2 + 24 * (1 - a) * (1 - a), Math.cos(w) * 2.5);
        pos.lerpVectors(oben, pos, a);
        blick.lerp(new THREE.Vector3(0, 0, 0.5), (1 - a) * 0.6);
      }
      // Leichtes Wackeln der Handkamera
      if (!still) { pos.x += Math.sin(t * 1.3) * 0.025; pos.y += Math.sin(t * 1.7) * 0.02; }
      k.position.copy(pos);
      k.lookAt(blick);
    }
  }

  return {
    moeglich: webglDa,
    async einhaengen(container) {
      if (!THREE) { laden ||= import("/vendor/three.module.min.js").then((m) => { THREE = m; }); await laden; }
      if (!buehne) { const host = document.createElement("div"); host.className = "a3d"; buehne = new Buehne(host); }
      if (buehne.host.parentNode !== container) container.appendChild(buehne.host);
      buehne.groesse();
      return buehne;
    },
    get buehne() { return buehne; },
    STUFEN_FARBE,
  };
})();
