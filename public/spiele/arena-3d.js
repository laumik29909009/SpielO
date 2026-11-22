// =============================================================
//  Arena 3D: Kolosseum mit Gladiator, der mit jedem Ruhm-Punkt
//  weiter zum Goldenen Lorbeer läuft. Das Publikum füllt die Ränge.
//  three.js wird erst geladen, wenn die Arena gebraucht wird.
// =============================================================
window.ArenaBuehne3D = (() => {
  let THREE = null, laden = null, buehne = null;
  const webglDa = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STUFEN_FARBE = { 0: 0x6b6478, 10: 0xc0844f, 30: 0x3fc47d, 60: 0x4d8eff, 85: 0xb363ff, 100: 0xffcf3f };

  // Sandtextur (Rauschen) für den Arenaboden
  function sandTextur() {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#d9b77e"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { const v = 150 + Math.random() * 90; g.fillStyle = `rgba(${v},${v * 0.8},${v * 0.55},${0.15 + Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function steinTextur() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#c9a878"; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "rgba(90,60,30,.35)"; g.lineWidth = 2;
    for (let y = 0; y < 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); for (let x = (y / 16) % 2 ? 0 : 16; x < 256; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(80,50,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 128, 3, 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  class Buehne {
    constructor(host) {
      this.host = host;
      this.uhr = new THREE.Clock();
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      r.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(r.domElement);
      const s = this.szene = new THREE.Scene();
      s.fog = new THREE.Fog(0x170f1f, 12, 26);
      this.kamera = new THREE.PerspectiveCamera(34, 3, 0.1, 60);
      // Licht: Abendsonne + Fackeln
      s.add(new THREE.HemisphereLight(0xffe2c0, 0x2a1830, 1.2));
      const sonne = new THREE.DirectionalLight(0xffc98a, 2.6);
      sonne.position.set(-4, 8, 6); sonne.castShadow = true;
      sonne.shadow.mapSize.set(1024, 1024);
      Object.assign(sonne.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6 });
      sonne.shadow.bias = -0.0008;
      s.add(sonne);
      const gegenlicht = new THREE.DirectionalLight(0xb07cff, 1.0); gegenlicht.position.set(5, 3, -6); s.add(gegenlicht);
      // Boden aus Sand
      const sand = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ map: sandTextur(), roughness: 1 }));
      sand.rotation.x = -Math.PI / 2; sand.scale.set(1, 0.62, 1); sand.receiveShadow = true; s.add(sand);
      this.kolosseum();
      this.weg();
      this.gladiator = this.figur();
      s.add(this.gladiator);
      this.pos = 0; this.ziel = 0; this.gehen = 0; this.jubel = 0; this.stufe = null;
      this.gladiator.position.set(this.xAuf(0), 0, 1.25);
      this.groesse();
      this.beobachter = new ResizeObserver(() => this.groesse()); this.beobachter.observe(host);
      const schleife = () => {
        requestAnimationFrame(schleife);
        if (document.hidden || !this.host.isConnected) return;
        this.bild();
      };
      schleife();
    }

    xAuf(anteil) { return -4.2 + anteil * 8.0; }

    // Ränge mit Bögen und Säulen (hintere Hälfte), Publikum als viele kleine Figuren
    kolosseum() {
      const s = this.szene;
      const stein = new THREE.MeshStandardMaterial({ map: steinTextur(), roughness: 0.9 });
      const dunkel = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 });
      const grad = (r, h, y) => {
        const g = new THREE.CylinderGeometry(r, r, h, 72, 1, true, Math.PI * 0.5, Math.PI);
        const m = new THREE.Mesh(g, stein); m.position.y = y; m.scale.set(1, 1, 0.62); m.material.side = THREE.DoubleSide; m.receiveShadow = true; s.add(m);
        return m;
      };
      // drei Stockwerke mit Bögen
      [[8.6, 1.4, 0.7], [9.3, 1.3, 2.05], [10, 1.2, 3.3]].forEach(([r, h, y], stock) => {
        grad(r, h, y);
        const n = 22 - stock * 2;
        for (let i = 0; i <= n; i++) {
          const w = Math.PI * 0.5 + (Math.PI * i) / n;
          const x = Math.sin(w) * (r - 0.05), z = Math.cos(w) * (r - 0.05) * 0.62;
          if (z > -0.5) continue;
          const bogen = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.62, 0.1), dunkel);
          bogen.position.set(x, y - h * 0.1, z); bogen.lookAt(0, y, 0); s.add(bogen);
          const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, h, 8), stein);
          const w2 = w + Math.PI / n / 2;
          saeule.position.set(Math.sin(w2) * (r - 0.15), y, Math.cos(w2) * (r - 0.15) * 0.62); s.add(saeule);
        }
      });
      // Brüstung vorn an der Arena (niedrige Mauer)
      const mauer = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.18, 8, 80, Math.PI), stein);
      mauer.rotation.x = Math.PI / 2; mauer.rotation.z = Math.PI; mauer.scale.set(1, 0.62, 1); mauer.position.y = 0.2; s.add(mauer);
      // Publikum: viele kleine Köpfe und Körper auf den Rängen
      const anzahl = 420;
      const geo = new THREE.CapsuleGeometry(0.07, 0.12, 2, 6);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
      const menge = this.menge = new THREE.InstancedMesh(geo, mat, anzahl);
      const farben = [0xe8524a, 0x3d7dff, 0xf2b33d, 0xffffff, 0x9b59ff, 0x3fbf72, 0xff8a3d, 0xd9d0c0];
      this.plaetze = [];
      const zufall = ((x) => () => (x = (x * 16807) % 2147483647) / 2147483647)(42);
      for (let i = 0; i < anzahl; i++) {
        const reihe = Math.floor(zufall() * 3);
        const r = [8.85, 9.55, 10.2][reihe], y = [1.45, 2.75, 3.95][reihe];
        const w = Math.PI * 0.56 + zufall() * Math.PI * 0.88;
        this.plaetze.push({ x: Math.sin(w) * r, y, z: Math.cos(w) * r * 0.62 + 0.15, phase: zufall() * 6, ordnung: zufall() });
        menge.setColorAt(i, new THREE.Color(farben[Math.floor(zufall() * farben.length)]));
      }
      // Wer zuerst kommt, sitzt vorn: sortiert nach Zufallsordnung
      this.plaetze.sort((a, b) => a.ordnung - b.ordnung);
      menge.count = 0;
      s.add(menge);
      this.hilf = new THREE.Object3D();
      // Kaiserloge mit Lorbeer am Ziel
    }

    // Weg aus Steinplatten mit Fackeln, am Ende der Goldene Lorbeer
    weg() {
      const s = this.szene;
      const platte = new THREE.MeshStandardMaterial({ color: 0xa88a62, roughness: 0.95 });
      for (let i = 0; i <= 20; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.62), platte);
        p.position.set(this.xAuf(i / 20), 0.02, 1.25); p.rotation.y = (Math.random() - 0.5) * 0.1; p.receiveShadow = true; s.add(p);
      }
      this.fackeln = [];
      const holz = new THREE.MeshStandardMaterial({ color: 0x5a3a1c });
      const feuerMat = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 2.2 });
      [0.25, 0.5, 0.75].forEach((a) => {
        const g = new THREE.Group();
        const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), holz); stab.position.y = 0.45; stab.castShadow = true; g.add(stab);
        const schale = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.4 })); schale.position.y = 0.92; g.add(schale);
        const feuer = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 8), feuerMat.clone()); feuer.position.y = 1.08; g.add(feuer);
        const licht = new THREE.PointLight(0xff8a30, 0, 3, 1.8); licht.position.y = 1.15; g.add(licht);
        g.position.set(this.xAuf(a), 0, 0.62); s.add(g);
        this.fackeln.push({ anteil: a, feuer, licht, an: false });
      });
      // Ziel: Sockel mit goldenem Lorbeerkranz
      const sockel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.55, 20), new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 0.6 }));
      sockel.position.set(this.xAuf(1) + 0.55, 0.27, 1.25); sockel.castShadow = true; s.add(sockel);
      const gold = new THREE.MeshStandardMaterial({ color: 0xffcf3f, metalness: 0.85, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.4 });
      const kranz = this.kranz = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 32, Math.PI * 1.7), gold); ring.rotation.z = Math.PI * 0.65; kranz.add(ring);
      for (let i = 0; i < 14; i++) {
        const w = Math.PI * 0.65 + (i / 13) * Math.PI * 1.7;
        const blatt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), gold);
        blatt.scale.set(1, 0.45, 0.5); blatt.position.set(Math.cos(w) * 0.27, Math.sin(w) * 0.27, 0); blatt.rotation.z = w + 0.6; kranz.add(blatt);
      }
      kranz.position.set(this.xAuf(1) + 0.55, 0.95, 1.25);
      s.add(kranz);
      this.kranzLicht = new THREE.PointLight(0xffd76a, 1.5, 3, 1.5); this.kranzLicht.position.copy(kranz.position); s.add(this.kranzLicht);
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
      // Beine (drehen beim Gehen um die Hüfte)
      this.beine = [-0.09, 0.09].map((x) => {
        const bein = new THREE.Group(); bein.position.set(0, 0.5, x);
        bein.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.42, 8), haut, 0, -0.21, 0));
        bein.add(mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.16, 8), leder, 0, -0.36, 0));
        bein.add(mesh(new THREE.BoxGeometry(0.15, 0.06, 0.09), leder, 0.03, -0.47, 0));
        g.add(bein); return bein;
      });
      // Rock und Oberkörper mit Brustpanzer
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 10), rot, 0, 0.5, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.34, 10), metall, 0, 0.75, 0));
      const guertel = mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), gold, 0, 0.62, 0); guertel.rotation.x = Math.PI / 2; g.add(guertel);
      // Umhang
      const umhang = mesh(new THREE.PlaneGeometry(0.34, 0.5), rot, -0.17, 0.66, 0);
      umhang.rotation.y = Math.PI / 2; umhang.material = rot.clone(); umhang.material.side = THREE.DoubleSide; g.add(umhang); this.umhang = umhang;
      // Kopf und Helm mit rotem Kamm
      g.add(mesh(new THREE.SphereGeometry(0.11, 14, 12), haut, 0, 1.03, 0));
      const helm = mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), metall, 0, 1.05, 0); g.add(helm);
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.025, 0.24), metall, 0.02, 1.0, 0));
      const kamm = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.04), rot, -0.02, 1.2, 0); g.add(kamm);
      // Arme: links Schild, rechts Schwert
      this.armL = new THREE.Group(); this.armL.position.set(0, 0.88, 0.2); g.add(this.armL);
      this.armL.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 8), haut, 0, -0.15, 0));
      const schild = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), rot, 0.06, -0.22, 0.06); schild.rotation.x = Math.PI / 2; this.armL.add(schild);
      const buckel = mesh(new THREE.SphereGeometry(0.06, 10, 8), gold, 0.06, -0.22, 0.09); this.armL.add(buckel);
      const schildRand = mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 24), gold, 0.06, -0.22, 0.08); this.armL.add(schildRand);
      this.armR = new THREE.Group(); this.armR.position.set(0, 0.88, -0.2); g.add(this.armR);
      this.armR.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 8), haut, 0, -0.15, 0));
      const schwert = new THREE.Group(); schwert.position.set(0.04, -0.3, 0); this.armR.add(schwert);
      schwert.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), leder, 0, 0, 0));
      schwert.add(mesh(new THREE.BoxGeometry(0.03, 0.025, 0.14), gold, 0, 0.05, 0));
      schwert.add(mesh(new THREE.BoxGeometry(0.02, 0.4, 0.05), metall, 0, 0.26, 0));
      this.schwert = schwert;
      schwert.rotation.z = -1.2;
      g.scale.setScalar(1.15);
      g.rotation.y = 0; // schaut nach rechts (in Laufrichtung +x)
      return g;
    }

    groesse() {
      const w = this.host.clientWidth || 600, h = this.host.clientHeight || 200;
      this.renderer.setSize(w, h, false);
      this.kamera.aspect = w / h;
      // Breite Bühne: Kamera so weit weg, dass der ganze Weg sichtbar ist
      const schmal = w / h < 2;
      this.kamera.fov = schmal ? 48 : 30;
      this.kamera.position.set(0, schmal ? 3.6 : 2.6, schmal ? 9.2 : 8.4);
      this.kamera.lookAt(0, schmal ? 1.0 : 1.1, 0);
      this.kamera.updateProjectionMatrix();
    }

    // Neuer Stand: Gladiator läuft weiter, Publikum füllt sich
    setzen(punkte, max, { stufe = null, sofort = false } = {}) {
      const anteil = Math.max(0, Math.min(1, punkte / max));
      if (sofort || ruhig()) { this.pos = this.ziel = anteil; this.gladiator.position.x = this.xAuf(anteil); }
      else this.ziel = anteil;
      this.stufe = stufe;
      if (stufe !== null && !sofort) this.jubel = stufe >= 60 ? 2.2 : stufe > 0 ? 1.2 : 0;
      if (stufe === 0 && !sofort) this.traurig = 1.2;
      this.mengeZiel = Math.round(anteil * this.plaetze.length);
      if (sofort) this.menge.count = this.mengeZiel;
    }

    bild() {
      const dt = Math.min(0.05, this.uhr.getDelta());
      const t = this.uhr.elapsedTime;
      const g = this.gladiator;
      // Laufen
      const diff = this.ziel - this.pos;
      const laeuft = Math.abs(diff) > 0.002;
      if (laeuft) { this.pos += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.22); this.gehen += dt * 11; }
      g.position.x = this.xAuf(this.pos);
      const schwung = laeuft ? Math.sin(this.gehen) : 0;
      this.beine[0].rotation.z = schwung * 0.6; this.beine[1].rotation.z = -schwung * 0.6;
      g.position.y = laeuft ? Math.abs(Math.sin(this.gehen)) * 0.05 : 0;
      this.umhang.rotation.z = laeuft ? 0.25 + Math.sin(this.gehen * 0.5) * 0.1 : 0.05 + Math.sin(t * 1.5) * 0.03;
      // Jubeln: Schwert hoch, kleiner Sprung
      if (this.jubel > 0 && !laeuft) {
        this.jubel -= dt;
        this.armR.rotation.z = -2.6 + Math.sin(t * 10) * 0.2;
        this.schwert.rotation.z = 0;
        g.position.y = Math.abs(Math.sin(t * 8)) * 0.12;
      } else if (this.traurig > 0 && !laeuft) {
        this.traurig -= dt;
        this.armR.rotation.z = 0.1; this.schwert.rotation.z = -1.5;
        g.rotation.x = 0.12;
      } else {
        this.armR.rotation.z += ((laeuft ? -schwung * 0.4 : 0.1) - this.armR.rotation.z) * 0.2;
        this.schwert.rotation.z += (-1.2 - this.schwert.rotation.z) * 0.2;
        g.rotation.x *= 0.9;
      }
      this.armL.rotation.z = laeuft ? schwung * 0.3 : Math.sin(t * 1.3) * 0.04;
      // Fackeln gehen an, wenn der Gladiator vorbeikommt
      for (const f of this.fackeln) {
        const an = this.pos >= f.anteil - 0.001;
        if (an && !f.an) { f.an = true; }
        if (!an) f.an = false;
        f.licht.intensity += ((f.an ? 2.4 : 0) - f.licht.intensity) * 0.1;
        f.feuer.scale.setScalar(f.an ? 1 + Math.sin(t * 14 + f.anteil * 9) * 0.12 : 0.001);
      }
      // Lorbeer dreht sich und leuchtet stärker, je näher der Gladiator kommt
      this.kranz.rotation.y = t * 0.8;
      this.kranzLicht.intensity = 0.6 + this.pos * 2.4 + (this.pos > 0.99 ? Math.sin(t * 6) : 0);
      // Publikum füllt sich nach und nach und hüpft beim Jubeln
      if (this.menge.count !== this.mengeZiel) this.menge.count += Math.sign(this.mengeZiel - this.menge.count) * Math.max(1, Math.round(Math.abs(this.mengeZiel - this.menge.count) * 0.08));
      const hoch = this.jubel > 0 ? 0.12 : 0.02;
      for (let i = 0; i < this.menge.count; i++) {
        const p = this.plaetze[i];
        this.hilf.position.set(p.x, p.y + Math.max(0, Math.sin(t * (this.jubel > 0 ? 12 : 2) + p.phase)) * hoch, p.z);
        this.hilf.updateMatrix();
        this.menge.setMatrixAt(i, this.hilf.matrix);
      }
      this.menge.instanceMatrix.needsUpdate = true;
      this.renderer.render(this.szene, this.kamera);
    }
  }

  return {
    moeglich: webglDa,
    async einhaengen(container) {
      if (!THREE) { laden ||= import("/vendor/three.module.min.js").then((m) => { THREE = m; }); await laden; }
      if (!buehne) { const host = document.createElement("div"); host.className = "a3d"; buehne = new Buehne(host); }
      container.appendChild(buehne.host);
      buehne.groesse();
      return buehne;
    },
    get buehne() { return buehne; },
    STUFEN_FARBE,
  };
})();
