// =============================================================
//  Schiffe versenken 3D: Low-Poly-Meer mit Inseln, Bojen-Rahmen und Schiffsmodellen
//  - Pro Spieler ein 10×10-Seegebiet, die Kamera fliegt zum gerade wichtigen Gebiet
//  - Schiffe: Flugzeugträger, Schlachtschiff, Kreuzer, U-Boot, Zerstörer (aus Grundformen gebaut)
//  - Schuss: Granate im Bogen mit Rauchspur, dann Wasserfontäne, Explosion mit Feuer und Rauch
//    oder (versenkt) das Schiff kippt und sinkt mit Blasen
//  three.js wird erst geladen, wenn die 3D-Ansicht gebraucht wird.
// =============================================================
window.SeeSchlacht3D = (() => {
  let THREE = null, laden = null;
  const webglDa = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
  const FARBEN = [0xff5a52, 0x3ba3ff, 0x39c46b, 0xffc533];
  const BUCH = "ABCDEFGHIJ";

  function leinwand(b, h, malen) {
    const c = document.createElement("canvas"); c.width = b; c.height = h;
    malen(c.getContext("2d"), b, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const rundTextur = (stops) => leinwand(128, 128, (g, b) => {
    const v = g.createRadialGradient(b / 2, b / 2, 0, b / 2, b / 2, b / 2);
    stops.forEach(([p, c]) => v.addColorStop(p, c));
    g.fillStyle = v; g.fillRect(0, 0, b, b);
  });

  // Wellen: Summe weniger Sinuswellen (auch für das Schaukeln der Schiffe)
  const welle = (x, z, t) => Math.sin(x * 0.35 + t * 0.9) * 0.09 + Math.sin(z * 0.42 - t * 0.7) * 0.07 + Math.sin((x + z) * 0.8 + t * 1.6) * 0.03;

  // ---------- Schiffsmodelle (Bug zeigt nach +x, Länge L Felder) ----------
  function rumpfGeo(L, breite, hoehe, { uboot = false } = {}) {
    const g = new THREE.BoxGeometry(L * 0.94, hoehe, breite, Math.max(10, L * 8), 3, 6);
    const p = g.attributes.position, farben = [];
    const oben = new THREE.Color(uboot ? 0x2c3640 : 0x66778a), unten = new THREE.Color(uboot ? 0x1b2228 : 0x8a2d24), linie = new THREE.Color(0xe8e8e8);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const u = (x + L * 0.47) / (L * 0.94); // 0 Heck … 1 Bug
      let w = 1;
      if (u > 0.68) w = 1 - Math.pow((u - 0.68) / 0.32, uboot ? 2.2 : 1.5) * 0.96;
      if (u < 0.08) w = uboot ? 0.35 + (u / 0.08) * 0.65 : 0.82 + (u / 0.08) * 0.18;
      if (y < 0) w *= uboot ? 0.75 : 0.58; // Kiel
      z *= w;
      if (!uboot && y > 0 && u > 0.78) y += (u - 0.78) * 0.35; // Bug hebt sich
      if (uboot) { const r = Math.min(1, w + 0.1); y *= r; }
      p.setXYZ(i, x, y, z);
      const c = y < -hoehe * 0.12 ? unten : y < -hoehe * 0.02 ? linie : oben;
      farben.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(farben, 3));
    g.computeVertexNormals();
    return g;
  }
  function schiffBauen(typ, L, farbe, mats) {
    const s = new THREE.Group();
    const teil = (geo, m, x, y, z, eltern = s) => { const t = new THREE.Mesh(geo, m); t.position.set(x, y, z); t.castShadow = true; t.receiveShadow = true; eltern.add(t); return t; };
    const box = (w, h, d, m, x, y, z, e) => teil(new THREE.BoxGeometry(w, h, d), m, x, y, z, e);
    const zyl = (r1, r2, h, m, x, y, z, e, seg = 12) => teil(new THREE.CylinderGeometry(r1, r2, h, seg), m, x, y, z, e);
    const uboot = typ === "uboot";
    const breite = typ === "traeger" ? 0.7 : typ === "zerstoerer" ? 0.46 : uboot ? 0.4 : 0.58;
    const hoehe = uboot ? 0.3 : 0.34;
    const rumpf = teil(rumpfGeo(L, breite, hoehe, { uboot }), mats.rumpf, 0, 0, 0);
    rumpf.userData.rumpf = true;
    const deckY = hoehe / 2;
    if (!uboot && typ !== "traeger") box(L * 0.8, 0.02, breite * 0.82, mats.deck, -L * 0.04, deckY + 0.01, 0);
    // Geschützturm mit Rohren
    const turm = (x, rohre = 2, gross = 1, dreh = 0) => {
      const g = new THREE.Group(); g.position.set(x, deckY + 0.02, 0); g.rotation.y = dreh; s.add(g);
      zyl(0.12 * gross, 0.13 * gross, 0.05, mats.grau, 0, 0.025, 0, g, 16);
      box(0.22 * gross, 0.09 * gross, 0.2 * gross, mats.grau, 0, 0.09 * gross, 0, g);
      for (let i = 0; i < rohre; i++) { const r = zyl(0.016, 0.016, 0.32 * gross, mats.dunkel, 0.24 * gross, 0.1 * gross, (i - (rohre - 1) / 2) * 0.055 * gross, g, 8); r.rotation.z = Math.PI / 2 - 0.05; }
      return g;
    };
    const bruecke = (x, stufen, w = 0.5) => {
      let y = deckY;
      for (let i = 0; i < stufen; i++) { const h = 0.13 - i * 0.015; box(w * (1 - i * 0.18), h, breite * (0.6 - i * 0.08), mats.hell, x - i * 0.02, y + h / 2, 0); y += h; }
      box(w * 0.5, 0.03, breite * 0.55, mats.fenster, x + 0.02, y - 0.04, 0);
      return y;
    };
    const mast = (x, y, h) => {
      zyl(0.012, 0.018, h, mats.dunkel, x, y + h / 2, 0);
      const quer = box(0.02, 0.02, 0.25, mats.dunkel, x, y + h * 0.75, 0);
      const radar = box(0.04, 0.05, 0.16, mats.hell, x, y + h + 0.02, 0); radar.userData.radar = true;
      const fahne = teil(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: farbe, side: THREE.DoubleSide, roughness: 0.8 }), x - 0.09, y + h * 0.9, 0);
      fahne.userData.fahne = true;
      return quer;
    };
    const schornstein = (x, y) => { const c = zyl(0.07, 0.08, 0.2, mats.grau, x, y + 0.1, 0); zyl(0.075, 0.075, 0.04, mats.dunkel, x, y + 0.2, 0); c.userData.schlot = true; return [x, y + 0.24]; };
    const schlote = [];
    if (typ === "traeger") {
      // Flugdeck mit Mittellinie, Insel an Steuerbord, ein paar Flugzeuge
      box(L * 0.96, 0.05, 0.9, mats.flugdeck, 0.05, deckY + 0.03, 0);
      for (let i = 0; i < 8; i++) box(0.22, 0.006, 0.025, mats.weiss, -L * 0.42 + i * L * 0.12, deckY + 0.058, 0);
      const ix = -0.3, iz = 0.3;
      const insel = new THREE.Group(); insel.position.z = iz; s.add(insel);
      box(0.6, 0.22, 0.16, mats.hell, ix, deckY + 0.16, 0, insel);
      box(0.3, 0.06, 0.17, mats.fenster, ix + 0.08, deckY + 0.25, 0, insel);
      const m = zyl(0.012, 0.018, 0.35, mats.dunkel, ix, deckY + 0.45, 0, insel); m.userData.radar = false;
      const radar = box(0.04, 0.05, 0.2, mats.hell, ix, deckY + 0.6, 0, insel); radar.userData.radar = true;
      const fahne = teil(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: farbe, side: THREE.DoubleSide }), ix - 0.09, deckY + 0.55, 0, insel); fahne.userData.fahne = true;
      for (const [x, z, w] of [[1.2, -0.2, 0.3], [0.6, -0.22, 0.1], [1.7, 0.05, -0.2], [-1.3, -0.2, 0.4]]) {
        const f = new THREE.Group(); f.position.set(x, deckY + 0.07, z); f.rotation.y = w; s.add(f);
        box(0.3, 0.035, 0.05, mats.flieger, 0, 0, 0, f); box(0.08, 0.02, 0.32, mats.flieger, 0.02, 0.01, 0, f); box(0.05, 0.015, 0.14, mats.flieger, -0.13, 0.01, 0, f);
      }
    } else if (typ === "schlacht") {
      turm(L * 0.32, 3, 1.15); turm(L * 0.17, 3, 1.05); turm(-L * 0.3, 3, 1.15, Math.PI);
      const y = bruecke(0.05, 4, 0.55); mast(0.1, y, 0.4); schlote.push(schornstein(-0.35, deckY));
    } else if (typ === "kreuzer") {
      turm(L * 0.3, 2, 1); turm(-L * 0.3, 2, 1, Math.PI);
      const y = bruecke(0.18, 3, 0.45); mast(0.2, y, 0.35); schlote.push(schornstein(-0.15, deckY), schornstein(-0.4, deckY));
    } else if (typ === "zerstoerer") {
      turm(L * 0.28, 1, 0.9);
      const y = bruecke(0.05, 3, 0.36); mast(0.05, y, 0.3); schlote.push(schornstein(-0.28, deckY));
      box(0.2, 0.06, 0.16, mats.grau, -L * 0.33, deckY + 0.03, 0);
    } else if (uboot) {
      // Turm mit Sehrohr, Tiefenruder
      const t = box(0.38, 0.22, 0.16, mats.uboot, 0.1, deckY + 0.05, 0); t.scale.set(1, 1, 1);
      box(0.22, 0.02, 0.36, mats.uboot, 0.18, deckY + 0.08, 0);
      zyl(0.012, 0.012, 0.25, mats.dunkel, 0.05, deckY + 0.25, 0, s, 6);
      box(0.06, 0.12, 0.02, mats.uboot, -L * 0.46, 0.02, 0);
      box(0.06, 0.02, 0.22, mats.uboot, -L * 0.46, 0.0, 0);
      const fahne = teil(new THREE.PlaneGeometry(0.14, 0.09), new THREE.MeshStandardMaterial({ color: farbe, side: THREE.DoubleSide }), -0.02, deckY + 0.3, 0); fahne.userData.fahne = true;
    }
    s.userData = { typ, L, schlote, tief: uboot ? -0.1 : -0.02, phase: Math.random() * 10 };
    return s;
  }

  class Meer {
    constructor(host) {
      this.host = host;
      this.uhr = new THREE.Clock();
      this.bretter = new Map(); // id → { g, x, z, schiffe: Map, marken: Map, ... }
      this.effekte = [];
      this.feuer = new Map();
      this.fokusId = null;
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      r.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      host.appendChild(r.domElement);
      const s = this.szene = new THREE.Scene();
      s.background = leinwand(16, 512, (g, b, h) => { const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, "#3b7fd0"); v.addColorStop(0.55, "#9cc8ee"); v.addColorStop(1, "#d8ecf7"); g.fillStyle = v; g.fillRect(0, 0, b, h); });
      s.fog = new THREE.Fog(0xb9dcf2, 34, 75);
      this.kamera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
      this.kamera.position.set(0, 22, 18);
      this.blick = new THREE.Vector3();
      this.kZiel = { pos: new THREE.Vector3(0, 22, 18), blick: new THREE.Vector3() };

      s.add(new THREE.HemisphereLight(0xcfe8ff, 0x1d4a6a, 1.1));
      const sonne = this.sonne = new THREE.DirectionalLight(0xfff1d6, 2.4);
      sonne.position.set(-14, 22, 10); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
      Object.assign(sonne.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 70 });
      sonne.shadow.bias = -0.0006;
      s.add(sonne, sonne.target);

      // Low-Poly-Meer
      const wasserGeo = new THREE.PlaneGeometry(110, 110, 84, 84); wasserGeo.rotateX(-Math.PI / 2);
      this.wasserBasis = Float32Array.from(wasserGeo.attributes.position.array);
      this.wasser = new THREE.Mesh(wasserGeo, new THREE.MeshStandardMaterial({ color: 0x1673a8, roughness: 0.28, metalness: 0.15, flatShading: true }));
      this.wasser.receiveShadow = true; s.add(this.wasser);
      const tiefe = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshBasicMaterial({ color: 0x0a3550 }));
      tiefe.rotation.x = -Math.PI / 2; tiefe.position.y = -1.2; s.add(tiefe);

      // gemeinsame Materialien
      const m = (c, rr = 0.6, mm = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rr, metalness: mm, ...extra });
      this.mats = {
        rumpf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }),
        deck: m(0x9c8a6a, 0.85, 0), grau: m(0x7d8a99, 0.5, 0.4), hell: m(0xc7cfd8, 0.5, 0.3), dunkel: m(0x2a2f36, 0.5, 0.5),
        fenster: m(0x1a2a3a, 0.2, 0.6, { emissive: 0x2a6aa0, emissiveIntensity: 0.4 }), flugdeck: m(0x3a4048, 0.8, 0.1), weiss: m(0xffffff, 0.6, 0),
        flieger: m(0x9aa6b2, 0.4, 0.5), uboot: m(0x2c3640, 0.5, 0.4),
      };
      this.texFeuer = rundTextur([[0, "rgba(255,255,220,1)"], [0.25, "rgba(255,200,60,0.95)"], [0.55, "rgba(255,90,20,0.6)"], [1, "rgba(255,40,0,0)"]]);
      this.texRauch = rundTextur([[0, "rgba(70,70,75,0.75)"], [0.6, "rgba(90,90,95,0.35)"], [1, "rgba(100,100,105,0)"]]);
      this.texGischt = rundTextur([[0, "rgba(255,255,255,1)"], [0.5, "rgba(230,245,255,0.7)"], [1, "rgba(200,230,255,0)"]]);
      this.texBlase = rundTextur([[0, "rgba(255,255,255,0)"], [0.7, "rgba(220,240,255,0.25)"], [0.85, "rgba(255,255,255,0.9)"], [1, "rgba(255,255,255,0)"]]);

      this.inselnBauen();
      this.wolken = Array.from({ length: 7 }, (_, i) => {
        const w = new THREE.Group();
        for (let j = 0; j < 4; j++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + Math.random(), 0), m(0xffffff, 1, 0, { flatShading: true })); k.position.set(j * 1.4 - 2, Math.random() * 0.5, Math.random() - 0.5); k.scale.y = 0.55; w.add(k); }
        w.position.set(-40 + i * 13, 14 + Math.random() * 4, -30 + Math.random() * 18); s.add(w); return w;
      });

      // Zielkreuz für das Zielen
      const kreuz = this.zielkreuz = new THREE.Group();
      const rahmen = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 4, 1), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.95, depthWrite: false }));
      rahmen.rotation.set(-Math.PI / 2, 0, Math.PI / 4); kreuz.add(rahmen);
      for (const [w, d] of [[0.9, 0.04], [0.04, 0.9]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.7, depthWrite: false })); l.rotation.x = -Math.PI / 2; kreuz.add(l); }
      kreuz.visible = false; s.add(kreuz);

      this.eingabe();
      this.groesse();
      this.beobachter = new ResizeObserver(() => this.groesse()); this.beobachter.observe(host);
      this.schleife = this.schleife.bind(this);
      requestAnimationFrame(this.schleife);
    }

    inselnBauen() {
      const s = this.szene;
      const m = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, ...extra });
      const insel = (x, z, gr, mitTurm) => {
        const g = new THREE.Group(); g.position.set(x, 0, z); s.add(g);
        const sand = new THREE.Mesh(new THREE.CylinderGeometry(gr * 1.15, gr * 1.35, 0.5, 9), m(0xe8d49a)); sand.position.y = 0; sand.receiveShadow = true; g.add(sand);
        const gras = new THREE.Mesh(new THREE.CylinderGeometry(gr * 0.5, gr * 1.0, 0.9, 8), m(0x5aa84a)); gras.position.y = 0.55; gras.castShadow = true; g.add(gras);
        const fels = new THREE.Mesh(new THREE.DodecahedronGeometry(gr * 0.5, 0), m(0x8a8a8a)); fels.position.set(gr * 0.4, 1.0, -gr * 0.2); fels.castShadow = true; g.add(fels);
        for (let i = 0; i < 3; i++) { // Palmen
          const p = new THREE.Group(); const w = i * 2.1 + x; p.position.set(Math.sin(w) * gr * 0.7, 0.9, Math.cos(w) * gr * 0.7); g.add(p);
          const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.4, 6), m(0x8a6a3a)); stamm.position.y = 0.7; stamm.rotation.z = 0.15; stamm.castShadow = true; p.add(stamm);
          for (let j = 0; j < 5; j++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 4), m(0x3f9a3a)); b.position.set(0.1, 1.42, 0); b.rotation.set(0, (j / 5) * Math.PI * 2, 1.25); b.translateY(0.35); b.castShadow = true; p.add(b); }
        }
        if (mitTurm) { // Leuchtturm mit rot-weißen Ringen und drehendem Licht
          const t = new THREE.Group(); t.position.set(-gr * 0.3, 0.9, gr * 0.1); g.add(t);
          for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.32 - i * 0.04 - 0.04, 0.32 - i * 0.04, 0.5, 12), m(i % 2 ? 0xffffff : 0xd8322a)); r.position.y = 0.25 + i * 0.5; r.castShadow = true; t.add(r); }
          const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), m(0xfff3b0, { emissive: 0xffd23f, emissiveIntensity: 1.2 })); kopf.position.y = 2.65; t.add(kopf);
          const dach = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 10), m(0x333333)); dach.position.y = 2.95; t.add(dach);
          const strahl = new THREE.Mesh(new THREE.ConeGeometry(0.6, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
          strahl.rotation.z = Math.PI / 2; strahl.position.x = 3; const dreh = new THREE.Group(); dreh.position.y = 2.65; dreh.add(strahl); t.add(dreh);
          this.leuchtfeuer = dreh;
        }
        return g;
      };
      this.inseln = [insel(-21, -12, 2.2, true), insel(22, -16, 1.6, false), insel(19, 12, 1.2, false), insel(-24, 10, 1.4, false)];
    }

    groesse() {
      const b = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
      this.renderer.setSize(b, h, false);
      this.kamera.aspect = b / h; this.kamera.updateProjectionMatrix();
      this.kameraSetzen();
    }

    // ---------- Seegebiete ----------
    gebiete(liste) {
      const schluessel = liste.map((b) => b.id + (b.raus ? "x" : "")).join("|");
      if (schluessel === this.gebietSchluessel) return;
      this.gebietSchluessel = schluessel;
      // Anordnung: eigenes Gebiet vorne
      const n = liste.length;
      const plaetze = n <= 2 ? [[-6.8, 0], [6.8, 0]] : n === 3 ? [[-6.8, 5.5], [6.8, 5.5], [0, -7]] : [[-6.8, 6.8], [6.8, 6.8], [-6.8, -6.8], [6.8, -6.8]];
      const sortiert = [...liste].sort((a, b) => (b.ich ? 1 : 0) - (a.ich ? 1 : 0));
      const ids = new Set(liste.map((b) => b.id));
      for (const [id, b] of this.bretter) if (!ids.has(id)) { this.szene.remove(b.g); this.bretter.delete(id); }
      sortiert.forEach((info, i) => {
        let b = this.bretter.get(info.id);
        if (!b) { b = this.gebietBauen(info, i); this.bretter.set(info.id, b); }
        const [x, z] = plaetze[i] || [0, 0];
        b.x = x; b.z = z; b.g.position.set(x, 0, z);
        b.raus = !!info.raus;
        b.gitterMat.opacity = b.raus ? 0.25 : 0.55;
        b.schild.material.map?.dispose(); b.schild.material.map = this.schildTextur(info); b.schild.material.needsUpdate = true;
      });
      this.kameraSetzen();
    }
    schildTextur(info) {
      return leinwand(512, 128, (g, b, h) => {
        g.fillStyle = info.raus ? "rgba(40,40,50,0.8)" : "rgba(8,30,60,0.82)";
        g.beginPath(); g.roundRect(4, 4, b - 8, h - 8, 40); g.fill();
        g.strokeStyle = info.ich ? "#ffc533" : "#9cc8ee"; g.lineWidth = 6; g.stroke();
        g.textBaseline = "middle"; g.font = "64px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.fillText(info.avatar || "", 26, h / 2 + 4);
        g.fillStyle = "#fff"; g.font = "900 50px Outfit, system-ui, sans-serif";
        g.fillText((info.ich ? "Deine Flotte" : info.name).slice(0, 15) + (info.raus ? " ☠" : ""), 116, h / 2 + 3);
      });
    }
    gebietBauen(info, i) {
      const g = new THREE.Group(); this.szene.add(g);
      const gitter = leinwand(1024, 1024, (c, b) => {
        const z = b / 10;
        c.fillStyle = "rgba(10,60,100,0.25)"; c.fillRect(0, 0, b, b);
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 3;
        for (let k = 0; k <= 10; k++) { c.beginPath(); c.moveTo(k * z, 0); c.lineTo(k * z, b); c.stroke(); c.beginPath(); c.moveTo(0, k * z); c.lineTo(b, k * z); c.stroke(); }
        c.lineWidth = 10; c.strokeRect(5, 5, b - 10, b - 10);
      });
      const gitterMat = new THREE.MeshBasicMaterial({ map: gitter, transparent: true, opacity: 0.55, depthWrite: false });
      const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), gitterMat);
      flaeche.rotation.x = -Math.PI / 2; flaeche.position.y = 0.16; flaeche.renderOrder = 1; g.add(flaeche);
      // Beschriftung A–J und 1–10
      const schrift = leinwand(1024, 64, (c, b, h) => { c.fillStyle = "#fff"; c.font = "900 44px Outfit, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; for (let k = 0; k < 10; k++) c.fillText(BUCH[k], (k + 0.5) * b / 10, h / 2); });
      const oben = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.62), new THREE.MeshBasicMaterial({ map: schrift, transparent: true, depthWrite: false }));
      oben.rotation.x = -Math.PI / 2; oben.position.set(0, 0.17, -5.42); g.add(oben);
      const zahlen = leinwand(64, 1024, (c, b, h) => { c.fillStyle = "#fff"; c.font = "900 40px Outfit, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; for (let k = 0; k < 10; k++) c.fillText(String(k + 1), b / 2, (k + 0.5) * h / 10); });
      const links = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 10), new THREE.MeshBasicMaterial({ map: zahlen, transparent: true, depthWrite: false }));
      links.rotation.x = -Math.PI / 2; links.position.set(-5.42, 0.17, 0); g.add(links);
      // Bojenkette als Rahmen (schaukelt mit den Wellen)
      const bojen = [];
      const bojeGeo = new THREE.SphereGeometry(0.11, 10, 8);
      const rot = new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.5 }), weiss = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      for (let k = 0; k < 40; k++) {
        const seite = Math.floor(k / 10), t = (k % 10) / 10 * 10 - 5;
        const [x, z] = [[t, -5.05], [5.05, t], [-t, 5.05], [-5.05, -t]][seite];
        const bo = new THREE.Mesh(bojeGeo, k % 2 ? rot : weiss); bo.position.set(x, 0.1, z); bo.castShadow = true; g.add(bo); bojen.push(bo);
      }
      const schild = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      schild.scale.set(4.4, 1.1, 1); schild.position.set(0, 1.25, -6.3); g.add(schild);
      const treffflaeche = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      treffflaeche.rotation.x = -Math.PI / 2; treffflaeche.position.y = 0.2; treffflaeche.userData.brett = info.id; g.add(treffflaeche);
      return { id: info.id, g, x: 0, z: 0, farbe: FARBEN[i % FARBEN.length], schiffe: new Map(), marken: new Map(), bojen, gitterMat, schild, treffflaeche };
    }
    feldPos(b, x, y) { return new THREE.Vector3(b.x - 4.5 + x, 0, b.z - 4.5 + y); }

    // Schiffe eines Gebiets abgleichen
    flotte(id, schiffe, { sinkenTyp = null } = {}) {
      const b = this.bretter.get(id);
      if (!b) return;
      const da = new Set();
      for (const s of schiffe || []) {
        const key = `${s.typ}`;
        da.add(key);
        let e = b.schiffe.get(key);
        const lage = `${s.x},${s.y},${s.quer}`;
        if (!e || e.lage !== lage) {
          if (e) b.g.remove(e.g);
          const g = schiffBauen(s.typ, s.laenge, b.farbe, this.mats);
          // Lage im Gebiet (lokal): Mittelpunkt der belegten Felder
          const mx = s.quer ? s.x + (s.laenge - 1) / 2 : s.x, mz = s.quer ? s.y : s.y + (s.laenge - 1) / 2;
          g.position.set(mx - 4.5, 0, mz - 4.5);
          g.rotation.y = s.quer ? 0 : -Math.PI / 2;
          b.g.add(g);
          e = { g, lage, versenkt: false, sinkT: 0 };
          b.schiffe.set(key, e);
          // Neu aufgestellt: kurz aus dem Wasser auftauchen lassen
          e.auftauchT = 1;
        }
        if (s.versenkt && !e.versenkt) {
          e.versenkt = true;
          e.sinkT = sinkenTyp === s.typ ? 0.0001 : 1; // 1 = schon gesunken (ohne Animation)
          e.g.traverse((o) => { if (o.material && !o.userData.dunkel) { o.material = o.material.clone(); o.material.color?.multiplyScalar(0.45); o.userData.dunkel = true; } });
        }
      }
      for (const [key, e] of b.schiffe) if (!da.has(key)) { b.g.remove(e.g); b.schiffe.delete(key); }
    }
    // Markierungen (Wasser, Treffer, versenkt, sicher Wasser) abgleichen; ausnahme = noch nicht zeigen
    marken(id, schuesse, ausnahme) {
      const b = this.bretter.get(id);
      if (!b) return;
      for (const [k, v] of Object.entries(schuesse || {})) {
        if (k === ausnahme) continue;
        const alt = b.marken.get(k);
        if (alt?.v === v) continue;
        if (alt) b.g.remove(alt.m);
        const [x, y] = k.split(",").map(Number);
        const m = this.marke(v);
        m.position.set(x - 4.5, 0, y - 4.5);
        b.g.add(m);
        b.marken.set(k, { v, m, x, y });
        if (v === "t" || v === "v") this.feuerAn(b, k, x, y, v === "v");
      }
    }
    marke(v) {
      const g = new THREE.Group();
      if (v === "w") {
        const boje = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
        boje.position.y = 0.12; boje.castShadow = true; g.add(boje);
        const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3ba3ff, roughness: 0.4 })); kappe.position.y = 0.25; g.add(kappe);
        g.userData.schwimmt = true;
      } else if (v === "r") {
        const p = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
        p.rotation.x = -Math.PI / 2; p.position.y = 0.18; g.add(p);
      } else {
        const stift = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xe0281e, roughness: 0.4, emissive: 0x6a0000, emissiveIntensity: 0.6 }));
        stift.position.y = 0.4; g.add(stift);
      }
      return g;
    }
    feuerAn(b, k, x, y, klein) {
      const key = b.id + "|" + k;
      const f = this.feuer.get(key);
      if (f) { f.klein = klein; return; }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texFeuer, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.position.set(x - 4.5, 0.55, y - 4.5); b.g.add(sprite);
      this.feuer.set(key, { b, sprite, klein, rauchT: Math.random() });
    }

    // ---------- Kamera ----------
    fokus(id) { this.fokusId = id; this.kameraSetzen(); }
    kameraSetzen() {
      const ziel = this.fokusId && this.bretter.get(this.fokusId);
      const alle = [...this.bretter.values()];
      let cx = 0, cz = 0, breite = 26;
      if (ziel) { cx = ziel.x; cz = ziel.z; breite = 12.4; }
      else if (alle.length) {
        const xs = alle.map((b) => b.x), zs = alle.map((b) => b.z);
        cx = (Math.min(...xs) + Math.max(...xs)) / 2; cz = (Math.min(...zs) + Math.max(...zs)) / 2;
        breite = Math.max(...xs) - Math.min(...xs) + 13; breite = Math.max(breite, (Math.max(...zs) - Math.min(...zs) + 13) * 0.9);
      }
      const vfov = (this.kamera.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.kamera.aspect);
      const neigung = ziel ? 1.02 : 0.95; // Winkel über dem Horizont
      const d = Math.max((breite / 2) / Math.tan(hfov / 2), (breite * 0.62) / Math.tan(vfov / 2)) * 1.02;
      this.kZiel.pos.set(cx, Math.sin(neigung) * d, cz + Math.cos(neigung) * d);
      this.kZiel.blick.set(cx, 0, cz + (ziel ? 0.3 : 0));
    }

    // ---------- Zielen ----------
    zielen(id, beiKlick) { this.zielId = id; this.beiKlick = beiKlick; if (!id) this.zielkreuz.visible = false; }
    eingabe() {
      const ray = new THREE.Raycaster(), maus = new THREE.Vector2(), el = this.renderer.domElement;
      const feld = (e) => {
        const b = this.zielId && this.bretter.get(this.zielId);
        if (!b) return null;
        const r = el.getBoundingClientRect();
        maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(maus, this.kamera);
        const t = ray.intersectObject(b.treffflaeche, false)[0];
        if (!t) return null;
        const x = Math.floor(t.point.x - b.x + 5), y = Math.floor(t.point.z - b.z + 5);
        return x >= 0 && y >= 0 && x < 10 && y < 10 ? { b, x, y } : null;
      };
      const zeigen = (f) => {
        this.zielkreuz.visible = !!f;
        if (f) { const p = this.feldPos(f.b, f.x, f.y); this.zielkreuz.position.set(p.x, 0.22, p.z); }
      };
      let unten = null;
      el.addEventListener("pointerdown", (e) => { unten = [e.clientX, e.clientY]; if (e.pointerType !== "mouse") zeigen(feld(e)); });
      el.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") zeigen(feld(e)); });
      el.addEventListener("pointerleave", () => { this.zielkreuz.visible = false; });
      el.addEventListener("pointerup", (e) => {
        if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 10) return;
        const f = feld(e);
        if (f) { zeigen(f); this.beiKlick?.(f.x, f.y); }
      });
    }

    // ---------- Schuss ----------
    schuss({ von, auf, x, y, ergebnis, typ }) {
      const ziel = this.bretter.get(auf), start = this.bretter.get(von);
      if (!ziel) return Promise.resolve();
      const zielPos = this.feldPos(ziel, x, y).setY(0.2);
      // Abschuss vom größten schwimmenden Schiff des Schützen (oder vom Rand seines Gebiets)
      let startPos = start ? new THREE.Vector3(start.x, 0.6, start.z) : zielPos.clone().add(new THREE.Vector3(0, 6, 14));
      if (start) {
        const lebend = [...start.schiffe.values()].filter((e) => !e.versenkt);
        if (lebend.length) { startPos = lebend[0].g.getWorldPosition(new THREE.Vector3()); startPos.y = 0.7; this.muendungsfeuer(startPos); }
      }
      const weite = startPos.distanceTo(zielPos);
      const hoehe = 4 + weite * 0.35;
      const dauer = 0.9 + weite * 0.035;
      const granate = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      const glanz = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texFeuer, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glanz.scale.setScalar(0.55); granate.add(glanz);
      this.szene.add(granate);
      return new Promise((fertig) => {
        let t = 0, rauchT = 0;
        this.effekte.push({
          update: (dt) => {
            t += dt / dauer;
            const p = Math.min(1, t);
            granate.position.lerpVectors(startPos, zielPos, p);
            granate.position.y += Math.sin(p * Math.PI) * hoehe;
            rauchT += dt;
            if (rauchT > 0.03) { rauchT = 0; this.rauch(granate.position.clone(), 0.35, 0.8, 0.15); }
            if (p >= 1) {
              this.szene.remove(granate);
              this.einschlag(ziel, x, y, ergebnis, typ);
              fertig();
              return false;
            }
            return true;
          },
        });
      });
    }
    muendungsfeuer(pos) {
      this.blitz(pos, 0xffb040, 12, 0.25);
      for (let i = 0; i < 5; i++) this.rauch(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4)), 0.5, 1.4, 0.4);
    }
    blitz(pos, farbe, staerke, dauer) {
      const l = new THREE.PointLight(farbe, staerke, 8, 1.6); l.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0)); this.szene.add(l);
      let t = 0;
      this.effekte.push({ update: (dt) => { t += dt / dauer; l.intensity = staerke * Math.max(0, 1 - t); if (t >= 1) { this.szene.remove(l); l.dispose(); return false; } return true; } });
    }
    teilchen(map, pos, { gr = 0.3, wachsen = 1, leben = 1, vel = new THREE.Vector3(), schwer = 0, additiv = false, deck = 1 }) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: deck, blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.position.copy(pos); s.scale.setScalar(gr); this.szene.add(s);
      let t = 0;
      this.effekte.push({
        update: (dt) => {
          t += dt / leben;
          vel.y -= schwer * dt;
          s.position.addScaledVector(vel, dt);
          s.scale.setScalar(gr * (1 + t * wachsen));
          s.material.opacity = deck * Math.max(0, 1 - t);
          if (t >= 1 || s.position.y < -0.3) { this.szene.remove(s); s.material.dispose(); return false; }
          return true;
        },
      });
    }
    rauch(pos, gr, leben, steigen = 0.5) {
      if (this.effekte.length > 220) return;
      this.teilchen(this.texRauch, pos, { gr, wachsen: 1.8, leben, vel: new THREE.Vector3((Math.random() - 0.5) * 0.2 + 0.25, steigen, (Math.random() - 0.5) * 0.2), deck: 0.5 });
    }
    welleRing(pos, gr = 1) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
      r.rotation.x = -Math.PI / 2; r.position.copy(pos).setY(0.2); this.szene.add(r);
      let t = 0;
      this.effekte.push({ update: (dt) => { t += dt / 1.4; r.scale.setScalar(1 + t * 3.5 * gr); r.material.opacity = 0.8 * (1 - t); if (t >= 1) { this.szene.remove(r); r.geometry.dispose(); r.material.dispose(); return false; } return true; } });
    }
    einschlag(b, x, y, ergebnis, typ) {
      const pos = this.feldPos(b, x, y);
      this.welleRing(pos, ergebnis === "wasser" ? 1 : 1.4);
      if (ergebnis === "wasser") {
        // Wasserfontäne
        for (let i = 0; i < 46; i++) {
          const w = Math.random() * Math.PI * 2, r = Math.random() * 0.6;
          this.teilchen(this.texGischt, pos.clone().add(new THREE.Vector3(Math.cos(w) * r * 0.3, 0.2, Math.sin(w) * r * 0.3)),
            { gr: 0.25 + Math.random() * 0.3, wachsen: 0.6, leben: 0.9 + Math.random() * 0.6, vel: new THREE.Vector3(Math.cos(w) * r, 3.2 + Math.random() * 3.4, Math.sin(w) * r), schwer: 7, deck: 0.95 });
        }
        return;
      }
      // Explosion: Blitz, Feuerball, Trümmer, Rauch
      this.blitz(pos, 0xff8a30, ergebnis === "versenkt" ? 60 : 35, 0.6);
      this.wackeln = ergebnis === "versenkt" ? 0.7 : 0.35;
      for (let i = 0; i < 14; i++) this.teilchen(this.texFeuer, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5)),
        { gr: 0.6 + Math.random() * 0.7, wachsen: 1.8, leben: 0.45 + Math.random() * 0.4, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2), additiv: true });
      const truemmerMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
      for (let i = 0; i < 12; i++) {
        const tr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.09), truemmerMat); tr.position.copy(pos).setY(0.5); this.szene.add(tr);
        const v = new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4);
        let t = 0;
        this.effekte.push({ update: (dt) => { t += dt; v.y -= 9.8 * dt; tr.position.addScaledVector(v, dt); tr.rotation.x += dt * 8; tr.rotation.z += dt * 6; if (tr.position.y < 0.05 || t > 3) { this.szene.remove(tr); tr.geometry.dispose(); if (tr.position.y < 0.1) this.welleRing(tr.position, 0.2); return false; } return true; } });
      }
      for (let i = 0; i < 6; i++) this.rauch(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6)), 0.6, 2, 0.8);
      if (ergebnis === "versenkt") {
        // Großer zweiter Knall und Blasen beim Sinken
        setTimeout(() => { if (!this.weg) { this.blitz(pos, 0xffa040, 45, 0.8); for (let i = 0; i < 18; i++) this.teilchen(this.texFeuer, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.5, (Math.random() - 0.5) * 1.6)), { gr: 0.9, wachsen: 2.2, leben: 0.7, vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5), additiv: true }); } }, 380);
      }
    }

    // ---------- Animation ----------
    schleife() {
      if (this.weg) return;
      if (!this.host.isConnected) return this.zerstoeren();
      requestAnimationFrame(this.schleife);
      if (document.hidden) return;
      const roh = this.uhr.getDelta(), dt = Math.min(0.05, roh), t = this.uhr.elapsedTime;
      // Wellen
      const pos = this.wasser.geometry.attributes.position, basis = this.wasserBasis;
      for (let i = 0; i < pos.count; i++) { const x = basis[i * 3], z = basis[i * 3 + 2]; pos.array[i * 3 + 1] = welle(x, z, t); }
      pos.needsUpdate = true;
      // Gebiete: Bojen und Wasserbojen schaukeln, Schiffe dümpeln oder sinken
      for (const b of this.bretter.values()) {
        b.bojen.forEach((bo, i) => { bo.position.y = 0.08 + welle(b.x + bo.position.x, b.z + bo.position.z, t) * 0.8; });
        for (const m of b.marken.values()) if (m.m.userData.schwimmt) { m.m.position.y = welle(b.x + m.x - 4.5, b.z + m.y - 4.5, t) * 0.8; m.m.rotation.z = Math.sin(t * 2 + m.x) * 0.12; }
        for (const e of b.schiffe.values()) {
          const g = e.g, u = g.userData;
          const wx = b.x + g.position.x, wz = b.z + g.position.z;
          const auf = e.auftauchT ? (e.auftauchT = Math.max(0, e.auftauchT - dt * 1.6)) : 0;
          if (e.versenkt) {
            if (e.sinkT < 1) e.sinkT = Math.min(1, e.sinkT + dt / 3.2);
            const s = e.sinkT, k = s * s * (3 - 2 * s);
            g.position.y = u.tief - k * 0.42 + welle(wx, wz, t) * (1 - k) * 0.6;
            g.rotation.x = k * 0.35; g.rotation.z = (u.L % 2 ? 1 : -1) * k * 0.22;
            if (s < 1 && Math.random() < dt * 22) this.teilchen(this.texBlase, new THREE.Vector3(wx + (Math.random() - 0.5) * u.L * 0.6, 0.15, wz + (Math.random() - 0.5) * 0.6), { gr: 0.12 + Math.random() * 0.12, wachsen: 0.5, leben: 0.8, vel: new THREE.Vector3(0, 0.6, 0) });
          } else {
            g.position.y = u.tief + welle(wx, wz, t) * 0.75 - auf * 0.6;
            g.rotation.x = Math.sin(t * 1.1 + u.phase) * 0.045;
            g.rotation.z = Math.sin(t * 0.8 + u.phase) * 0.02;
            // Rauch aus den Schornsteinen
            if (Math.random() < dt * 1.5) for (const [sx, sy] of u.schlote) {
              const w = new THREE.Vector3(sx, sy, 0); g.localToWorld(w);
              this.rauch(w, 0.14, 1.6, 0.35);
            }
          }
          g.traverse((o) => { if (o.userData.radar) o.rotation.y = t * 2; if (o.userData.fahne) o.rotation.y = Math.sin(t * 6 + u.phase) * 0.35; });
        }
      }
      // Feuer auf getroffenen Feldern
      for (const f of this.feuer.values()) {
        const fl = (f.klein ? 0.35 : 0.6) * (0.85 + Math.random() * 0.3);
        f.sprite.scale.set(fl, fl * 1.25, 1);
        f.sprite.material.opacity = f.klein ? 0.5 : 0.85;
        f.rauchT += dt;
        if (f.rauchT > (f.klein ? 1.1 : 0.5)) { f.rauchT = 0; const w = f.sprite.getWorldPosition(new THREE.Vector3()); this.rauch(w.add(new THREE.Vector3(0, 0.25, 0)), f.klein ? 0.22 : 0.32, 1.8, 0.6); }
      }
      // Effekte
      const dtEff = Math.min(0.1, roh);
      // Neue Effekte, die während eines Updates entstehen (z. B. Explosion beim Einschlag), nicht verlieren
      const laufend = this.effekte;
      this.effekte = [];
      const bleiben = laufend.filter((e) => e.update(dtEff) !== false);
      this.effekte = bleiben.concat(this.effekte);
      // Kulisse
      if (this.leuchtfeuer) this.leuchtfeuer.rotation.y = t * 0.8;
      this.wolken.forEach((w, i) => { w.position.x += dt * (0.3 + i * 0.05); if (w.position.x > 55) w.position.x = -55; });
      // Kamera: weich zum Ziel, leichtes Schweben, Wackeln bei Explosionen
      const kk = 1 - Math.exp(-dt * 2.2);
      this.kamera.position.lerp(this.kZiel.pos, kk);
      this.blick.lerp(this.kZiel.blick, kk);
      const schweb = new THREE.Vector3(Math.sin(t * 0.3) * 0.25, Math.sin(t * 0.4) * 0.15, 0);
      this.wackeln = Math.max(0, (this.wackeln || 0) - dt * 1.2);
      const w = this.wackeln * 0.35;
      this.kamera.lookAt(this.blick.clone().add(schweb).add(new THREE.Vector3((Math.random() - 0.5) * w, (Math.random() - 0.5) * w, 0)));
      this.renderer.render(this.szene, this.kamera);
    }
    zerstoeren() {
      if (this.weg) return;
      this.weg = true;
      this.beobachter?.disconnect();
      this.szene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }

  return {
    moeglich: webglDa,
    async einhaengen(host) {
      if (!THREE) { laden ||= import("/vendor/three.module.min.js").then((m) => { THREE = m; }); await laden; }
      try { await Promise.race([document.fonts?.load?.("900 40px Outfit"), new Promise((ok) => setTimeout(ok, 1200))]); } catch {}
      return new Meer(host);
    },
  };
})();
