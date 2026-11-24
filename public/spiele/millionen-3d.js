// =============================================================
//  Die Millionenfrage 3D: rundes Fernsehstudio
//  - Bühne mit Leuchtboden, Lichterkranz und zwei Pulten (Moderator ↔ Kandidat)
//  - Figuren aus einfachen Formen, die atmen, schauen, gestikulieren und jubeln
//  - Publikum auf Rängen, große LED-Wand, Lichttraverse mit schwenkenden Kegeln
//  - Stimmungen: ruhe, auswahl, publikum, telefon, spannung, gold, rot, million
//  three.js wird erst geladen, wenn das Studio gebraucht wird.
// =============================================================
window.MiStudio3D = (() => {
  let THREE = null, laden = null;
  const webglDa = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };

  // Farben je Stimmung: [Licht, Kranz, Boden-Glühen]
  const STIMMUNG = {
    ruhe: [0x6f86ff, 0x7f8cff, 0x2a3cff],
    auswahl: [0xa070ff, 0xb48cff, 0x6a2cff],
    publikum: [0x4fd6ff, 0x8fe3ff, 0x1a8cff],
    telefon: [0xb070ff, 0xc89bff, 0x5a2cc8],
    spannung: [0xff9a1f, 0xffb347, 0xff6a00],
    gold: [0xffd23f, 0xffe27a, 0xffb000],
    rot: [0xff3b3b, 0xff5a5a, 0xc80000],
    million: [0xffd23f, 0xfff3b0, 0xffb000],
  };
  const HEMDEN = [0xe94f4f, 0x3ba3ff, 0x39c46b, 0xf2b52e, 0xa36bff, 0xff7ab6, 0x2ec4b6, 0xff8a3d];
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  function leinwand(b, h, malen) {
    const c = document.createElement("canvas"); c.width = b; c.height = h;
    malen(c.getContext("2d"), b, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  // Bühnenboden: Strahlen und Ringe wie ein Sternenrad
  const bodenTextur = () => leinwand(1024, 1024, (g, b) => {
    const m = b / 2;
    const v = g.createRadialGradient(m, m, 0, m, m, m);
    v.addColorStop(0, "#1d2a8a"); v.addColorStop(0.55, "#0c1250"); v.addColorStop(1, "#060926");
    g.fillStyle = v; g.fillRect(0, 0, b, b);
    g.translate(m, m);
    for (let i = 0; i < 32; i++) {
      g.rotate(Math.PI / 16);
      const s = g.createLinearGradient(0, 0, 0, -m);
      s.addColorStop(0, "rgba(140,160,255,0.0)"); s.addColorStop(0.35, "rgba(140,160,255,0.22)"); s.addColorStop(1, "rgba(140,160,255,0.02)");
      g.fillStyle = s; g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 0); g.lineTo(i % 2 ? 10 : 22, -m); g.lineTo(i % 2 ? -10 : -22, -m); g.fill();
    }
    for (const [r, a, w] of [[0.18, 0.7, 6], [0.42, 0.45, 3], [0.7, 0.55, 4], [0.95, 0.9, 8]]) {
      g.strokeStyle = `rgba(170,185,255,${a})`; g.lineWidth = w; g.beginPath(); g.arc(0, 0, m * r, 0, Math.PI * 2); g.stroke();
    }
    const kern = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.18);
    kern.addColorStop(0, "rgba(220,230,255,0.55)"); kern.addColorStop(1, "rgba(120,140,255,0)");
    g.fillStyle = kern; g.beginPath(); g.arc(0, 0, m * 0.18, 0, Math.PI * 2); g.fill();
  });
  // Rückwand: dunkel mit senkrechten Lichtleisten
  const wandTextur = () => leinwand(2048, 512, (g, b, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "#03041a"); v.addColorStop(0.6, "#0b1048"); v.addColorStop(1, "#050722");
    g.fillStyle = v; g.fillRect(0, 0, b, h);
    for (let x = 0; x < b; x += 64) {
      const s = g.createLinearGradient(0, h * 0.15, 0, h);
      s.addColorStop(0, "rgba(120,140,255,0)"); s.addColorStop(0.5, "rgba(120,140,255,0.35)"); s.addColorStop(1, "rgba(120,140,255,0)");
      g.fillStyle = s; g.fillRect(x + 28, h * 0.15, 6, h * 0.85);
    }
  });
  // Lichtkegel: oben hell, unten durchsichtig
  const kegelTextur = () => leinwand(8, 256, (g, b, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "rgba(255,255,255,0.0)"); v.addColorStop(0.15, "rgba(255,255,255,0.55)"); v.addColorStop(1, "rgba(255,255,255,0.0)");
    g.fillStyle = v; g.fillRect(0, 0, b, h);
  });
  function schildTextur(avatar, name, unter) {
    return leinwand(512, 140, (g, b, h) => {
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "#1c2670"); v.addColorStop(1, "#070b33");
      g.fillStyle = v; g.fillRect(0, 0, b, h);
      g.strokeStyle = "#ffcf3f"; g.lineWidth = 6; g.strokeRect(3, 3, b - 6, h - 6);
      g.textBaseline = "middle"; g.textAlign = "left";
      g.font = "64px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.fillText(avatar || "", 22, h / 2 + 4);
      g.fillStyle = "#fff"; g.font = "900 46px Outfit, system-ui, sans-serif";
      g.fillText(String(name).slice(0, 14), 112, unter ? h / 2 - 14 : h / 2 + 2);
      if (unter) { g.fillStyle = "#ffcf3f"; g.font = "700 28px Outfit, system-ui, sans-serif"; g.fillText(unter, 114, h / 2 + 30); }
    });
  }

  // ---------- Figur (sitzend, Blick nach +z) ----------
  function figur({ anzug, hemd, krawatte, haut = 0xf0c09a, haar = 0x2b1a10, frau = false }) {
    const mat = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const mAnzug = mat(anzug, 0.55), mHaut = mat(haut, 0.7), mHemd = mat(hemd, 0.6), mHaar = mat(haar, 0.85), mSchuh = mat(0x111111, 0.35);
    const g = new THREE.Group();
    const teil = (geo, m, x, y, z, eltern = g) => { const t = new THREE.Mesh(geo, m); t.position.set(x, y, z); t.castShadow = true; eltern.add(t); return t; };
    // Becken und Beine
    teil(new THREE.BoxGeometry(0.34, 0.14, 0.26), mAnzug, 0, 0.83, 0.02);
    for (const s of [-1, 1]) {
      const ober = teil(new THREE.CapsuleGeometry(0.075, 0.34, 6, 12), mAnzug, s * 0.095, 0.84, 0.22); ober.rotation.x = Math.PI / 2;
      teil(new THREE.CapsuleGeometry(0.065, 0.36, 6, 12), mAnzug, s * 0.1, 0.6, 0.43);
      teil(new THREE.BoxGeometry(0.1, 0.07, 0.22), mSchuh, s * 0.1, 0.37, 0.5);
    }
    // Oberkörper (atmet), Hemd und Krawatte
    const rumpf = new THREE.Group(); rumpf.position.y = 0.9; g.add(rumpf);
    const brust = teil(new THREE.CapsuleGeometry(0.19, 0.3, 8, 16), mAnzug, 0, 0.26, 0, rumpf); brust.scale.z = 0.72;
    teil(new THREE.BoxGeometry(0.11, 0.24, 0.02), mHemd, 0, 0.36, 0.135, rumpf);
    if (krawatte != null) teil(new THREE.BoxGeometry(0.045, 0.2, 0.02), mat(krawatte, 0.4), 0, 0.33, 0.148, rumpf);
    teil(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 12), mHaut, 0, 0.53, 0, rumpf);
    // Kopf mit Haaren und Augen
    const kopf = new THREE.Group(); kopf.position.set(0, 0.66, 0); rumpf.add(kopf);
    const schaedel = teil(new THREE.SphereGeometry(0.13, 24, 18), mHaut, 0, 0.02, 0, kopf); schaedel.scale.set(0.95, 1.12, 1);
    const kappe = teil(new THREE.SphereGeometry(0.138, 24, 12, 0, Math.PI * 2, 0, Math.PI * (frau ? 0.62 : 0.5)), mHaar, 0, 0.04, -0.01, kopf); kappe.scale.set(0.98, 1.1, 1.02);
    if (frau) { const zopf = teil(new THREE.CapsuleGeometry(0.07, 0.18, 6, 10), mHaar, 0, -0.08, -0.1, kopf); zopf.rotation.x = 0.3; }
    const auge = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (const s of [-1, 1]) teil(new THREE.SphereGeometry(0.016, 8, 8), auge, s * 0.045, 0.03, 0.12, kopf);
    teil(new THREE.SphereGeometry(0.022, 8, 8), mHaut, 0, -0.01, 0.13, kopf);
    // Arme: Schulter → Ellbogen → Hand
    const arme = [-1, 1].map((s) => {
      const schulter = new THREE.Group(); schulter.position.set(s * 0.25, 0.43, 0); rumpf.add(schulter);
      const ober = teil(new THREE.CapsuleGeometry(0.055, 0.22, 6, 10), mAnzug, 0, -0.14, 0, schulter);
      const ell = new THREE.Group(); ell.position.y = -0.29; schulter.add(ell);
      teil(new THREE.CapsuleGeometry(0.05, 0.2, 6, 10), mAnzug, 0, -0.12, 0, ell);
      teil(new THREE.SphereGeometry(0.048, 10, 10), mHaut, 0, -0.27, 0, ell);
      ober.userData.s = s;
      return { schulter, ell, s };
    });
    g.userData = { rumpf, kopf, arme, pose: "sitzen", phase: Math.random() * 10, ziel: { kopfY: 0, kopfX: 0 } };
    return g;
  }
  // Pose je Zustand (Winkel in Radiant), weich überblendet
  const POSEN = {
    sitzen: { o: [-0.55, 0.12], e: [-1.15, 0], kopfX: 0 },
    reden: { o: [-0.75, 0.25], e: [-1.4, 0.3], kopfX: 0 },
    denken: { o: [-0.9, 0.35], e: [-2.3, 0.1], kopfX: 0.12 },
    jubel: { o: [-2.9, 0.35], e: [-0.25, 0], kopfX: -0.25 },
    traurig: { o: [-0.25, 0.05], e: [-0.6, 0], kopfX: 0.45 },
  };
  function figurBewegen(f, t, dt) {
    const u = f.userData, p = POSEN[u.pose] || POSEN.sitzen;
    const k = 1 - Math.exp(-dt * 5);
    u.rumpf.scale.y = 1 + Math.sin(t * 1.6 + u.phase) * 0.012;
    u.kopf.rotation.y += ((u.ziel.kopfY + Math.sin(t * 0.5 + u.phase) * 0.12) - u.kopf.rotation.y) * k;
    u.kopf.rotation.x += ((p.kopfX + u.ziel.kopfX) - u.kopf.rotation.x) * k;
    u.arme.forEach(({ schulter, ell, s }, i) => {
      // Denken und Reden nur mit einer Hand, die andere bleibt auf dem Pult
      const eigen = (u.pose === "denken" && i === 1) || (u.pose === "reden" && i === 0) || ["jubel", "traurig", "sitzen"].includes(u.pose);
      const q = eigen ? p : POSEN.sitzen;
      let ox = q.o[0], ez = q.e[0];
      if (u.pose === "reden" && eigen) { ox += Math.sin(t * 3 + u.phase) * 0.18; ez += Math.sin(t * 2.3) * 0.2; }
      if (u.pose === "jubel") ox += Math.sin(t * 9 + i) * 0.12;
      schulter.rotation.x += (ox - schulter.rotation.x) * k;
      schulter.rotation.z += (s * q.o[1] - schulter.rotation.z) * k;
      ell.rotation.x += (ez - ell.rotation.x) * k;
      ell.rotation.z += (-s * q.e[1] - ell.rotation.z) * k;
    });
  }

  // ---------- Pult und Hocker ----------
  function pult(mGlas, mChrom, mLeiste) {
    const g = new THREE.Group();
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.95, 6, 1), mChrom); fuss.position.y = 0.475; fuss.scale.z = 0.55; fuss.castShadow = true; g.add(fuss);
    const leiste = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.02), mLeiste); leiste.position.set(0, 0.75, 0.24); g.add(leiste);
    const platte = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 40, 1, false, -0.95, 1.9), mGlas); platte.position.set(0, 0.97, -0.38); platte.castShadow = true; g.add(platte);
    const rand = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 40, 1.9), mLeiste); rand.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.95); rand.position.set(0, 0.99, -0.38); g.add(rand);
    // Bildschirm zum Sitzenden hin geneigt
    const schirm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ color: 0x3c5cff }));
    schirm.position.set(0, 1.08, -0.02); schirm.rotation.x = -0.9; schirm.rotation.y = Math.PI; g.add(schirm);
    const schild = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.153), new THREE.MeshBasicMaterial({ color: 0xffffff })); schild.position.set(0, 0.58, 0.215); g.add(schild);
    g.userData = { schild, schirm, leiste };
    return g;
  }
  function hocker(mChrom, mSitz) {
    const g = new THREE.Group();
    const teil = (geo, m, y) => { const t = new THREE.Mesh(geo, m); t.position.y = y; t.castShadow = true; g.add(t); return t; };
    teil(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 28), mChrom, 0.015);
    teil(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 10), mChrom, 0.38);
    const ring = teil(new THREE.TorusGeometry(0.17, 0.012, 6, 28), mChrom, 0.34); ring.rotation.x = Math.PI / 2;
    teil(new THREE.CylinderGeometry(0.24, 0.22, 0.07, 28), mSitz, 0.75);
    const lehne = teil(new THREE.BoxGeometry(0.4, 0.34, 0.05), mSitz, 1.0); lehne.position.z = -0.21;
    return g;
  }

  class Studio {
    constructor(host) {
      this.host = host;
      this.uhr = new THREE.Clock();
      this.stimmungName = "ruhe";
      this.kameraModus = "total";
      this.blitzT = 0;
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      r.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
      host.appendChild(r.domElement);
      const s = this.szene = new THREE.Scene();
      s.background = new THREE.Color(0x03041a);
      s.fog = new THREE.Fog(0x03041a, 12, 26);
      this.kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
      this.kamera.position.set(0, 3.2, 9);
      this.blick = new THREE.Vector3(0, 1.1, 0);

      // Licht
      this.hemi = new THREE.HemisphereLight(0x8090ff, 0x100830, 0.55); s.add(this.hemi);
      const haupt = new THREE.SpotLight(0xffffff, 60, 18, 0.55, 0.5, 1.4);
      haupt.position.set(0, 8, 4); haupt.target.position.set(0, 0.8, 0); haupt.castShadow = true; haupt.shadow.mapSize.set(1024, 1024); haupt.shadow.bias = -0.0004;
      s.add(haupt, haupt.target); this.haupt = haupt;
      this.farbLichter = [[-5, 5, -3], [5, 5, -3]].map(([x, y, z]) => {
        const l = new THREE.SpotLight(0x6f86ff, 45, 20, 0.7, 0.6, 1.3); l.position.set(x, y, z); l.target.position.set(0, 1, 0); s.add(l, l.target); return l;
      });
      this.glut = new THREE.PointLight(0x2a3cff, 6, 6, 1.5); this.glut.position.set(0, 0.4, 0); s.add(this.glut);

      // Boden, Bühne, Ringe, Strahlen
      const boden = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x050720, roughness: 0.3, metalness: 0.6 }));
      boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; s.add(boden);
      this.ringe = [];
      for (const [ri, ra, o] of [[3.0, 3.06, 0.8], [4.4, 4.44, 0.45], [6.0, 6.03, 0.3], [7.6, 7.63, 0.2]]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(ri, ra, 96), new THREE.MeshBasicMaterial({ color: 0x7f8cff, transparent: true, opacity: o, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; s.add(ring); this.ringe.push(ring);
      }
      const buehne = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.85, 0.2, 72), [
        new THREE.MeshStandardMaterial({ color: 0x0c1250, roughness: 0.3, metalness: 0.5, emissive: 0x1a2aa0, emissiveIntensity: 0.35 }),
        new THREE.MeshStandardMaterial({ map: bodenTextur(), roughness: 0.25, metalness: 0.35, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }),
        new THREE.MeshStandardMaterial({ color: 0x050720 }),
      ]);
      buehne.position.y = 0.1; buehne.receiveShadow = true; s.add(buehne); this.buehne = buehne;
      // Lichterkranz um die Bühne
      const n = 56;
      this.kranz = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { const w = (i / n) * Math.PI * 2; m4.makeTranslation(Math.sin(w) * 2.88, 0.21, Math.cos(w) * 2.88); this.kranz.setMatrixAt(i, m4); this.kranz.setColorAt(i, new THREE.Color(0x7f8cff)); }
      s.add(this.kranz);

      // Rückwand und LED-Wand
      const wand = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 10, 64, 1, true, Math.PI - 2.2, 4.4), new THREE.MeshBasicMaterial({ map: wandTextur(), side: THREE.BackSide }));
      wand.position.y = 4.6; s.add(wand);
      this.ledLeinwand = document.createElement("canvas"); this.ledLeinwand.width = 1024; this.ledLeinwand.height = 320;
      this.ledTextur = new THREE.CanvasTexture(this.ledLeinwand); this.ledTextur.colorSpace = THREE.SRGBColorSpace;
      const led = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: this.ledTextur, toneMapped: false }));
      led.position.set(0, 5.3, -10.6); s.add(led);
      const rahmen = new THREE.Mesh(new THREE.BoxGeometry(7.3, 2.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1f50, metalness: 0.8, roughness: 0.3 }));
      rahmen.position.set(0, 5.3, -10.7); s.add(rahmen);
      this.bildschirm("DIE MILLIONENFRAGE", "");

      // Publikum auf Rängen (hinter der Bühne, im Halbkreis)
      const mRang = new THREE.MeshStandardMaterial({ color: 0x0b0f38, roughness: 0.8 });
      const kante = new THREE.MeshBasicMaterial({ color: 0x3a4cff, transparent: true, opacity: 0.55 });
      const leute = [];
      for (let reihe = 0; reihe < 4; reihe++) {
        const rad = 7.4 + reihe * 1.0, hoehe = 0.35 + reihe * 0.42;
        const stufe = new THREE.Mesh(new THREE.CylinderGeometry(rad + 0.5, rad + 0.5, hoehe, 72, 1, false, Math.PI - 1.75, 3.5), mRang);
        stufe.position.y = hoehe / 2; stufe.receiveShadow = true; s.add(stufe);
        const leiste = new THREE.Mesh(new THREE.TorusGeometry(rad - 0.5, 0.018, 4, 80, 3.5), kante);
        // Torus liegt in der x/y-Ebene: erst um z drehen (Bogen nach hinten), dann flach legen
        leiste.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - 1.75); leiste.position.y = hoehe + 0.01; s.add(leiste);
        const anzahl = 26 + reihe * 4;
        for (let i = 0; i < anzahl; i++) {
          const w = Math.PI - 1.62 + (i + 0.5) / anzahl * 3.24 + (Math.random() - 0.5) * 0.03;
          leute.push([Math.sin(w) * (rad + 0.1), hoehe, Math.cos(w) * (rad + 0.1), w]);
        }
      }
      this.leute = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), leute.length);
      this.koepfe = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), leute.length);
      const farben = [0x7a2a3a, 0x2a4a7a, 0x3a6a3a, 0x6a5a2a, 0x4a2a6a, 0x2a2a2a, 0x8a6a5a, 0x5a3a2a];
      const haut = [0xf0c09a, 0xd9a27a, 0xa8734d, 0x7a4f32, 0xf5d0b0];
      this.leuteDaten = leute.map(([x, y, z, w], i) => {
        this.leute.setColorAt(i, new THREE.Color(farben[i % farben.length]).multiplyScalar(0.7 + Math.random() * 0.5));
        this.koepfe.setColorAt(i, new THREE.Color(haut[Math.floor(Math.random() * haut.length)]));
        return { x, y, z, p: Math.random() * 10, hoch: 0 };
      });
      s.add(this.leute, this.koepfe);
      this.leuteSetzen(0);

      // Lichttraverse mit Scheinwerfern und sichtbaren Lichtkegeln
      const mChrom = new THREE.MeshStandardMaterial({ color: 0x9aa3c8, metalness: 0.9, roughness: 0.25 });
      const traverse = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.07, 8, 80), mChrom); traverse.rotation.x = Math.PI / 2; traverse.position.y = 6; s.add(traverse);
      const traverse2 = traverse.clone(); traverse2.position.y = 5.75; s.add(traverse2);
      const kegelMat = new THREE.MeshBasicMaterial({ map: kegelTextur(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0x6f86ff, opacity: 0.2 });
      this.kegelMat = kegelMat;
      this.scheinwerfer = Array.from({ length: 8 }, (_, i) => {
        const w = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const kopf = new THREE.Group(); kopf.position.set(Math.sin(w) * 3.4, 5.75, Math.cos(w) * 3.4); s.add(kopf);
        const gehaeuse = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.32, 14), new THREE.MeshStandardMaterial({ color: 0x15183a, metalness: 0.6, roughness: 0.4 }));
        gehaeuse.rotation.x = Math.PI / 2; kopf.add(gehaeuse);
        const kegel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.85, 6, 24, 1, true), kegelMat);
        kegel.rotation.x = Math.PI / 2; kegel.position.z = 3.1; kopf.add(kegel);
        return { kopf, w, ziel: new THREE.Vector3() };
      });

      // Pulte, Hocker, Moderator und Kandidat
      const mGlas = new THREE.MeshStandardMaterial({ color: 0x1b2a8a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85, emissive: 0x1a2aa0, emissiveIntensity: 0.25 });
      const mPultChrom = new THREE.MeshStandardMaterial({ color: 0x20265e, metalness: 0.85, roughness: 0.3 });
      this.mLeiste = new THREE.MeshBasicMaterial({ color: 0x7f8cff });
      const mSitz = new THREE.MeshStandardMaterial({ color: 0x0d0f22, roughness: 0.5 });
      const platz = (x, dreh) => { const g = new THREE.Group(); g.position.set(x, 0.2, 0); g.rotation.y = dreh; s.add(g); return g; };
      // Moderator links, Kandidat rechts; beide schauen sich an und leicht zur Kamera
      this.platzMod = platz(-1.75, Math.PI / 2 - 0.42);
      this.platzKand = platz(1.75, -Math.PI / 2 + 0.42);
      for (const p of [this.platzMod, this.platzKand]) {
        p.add(hocker(mChrom, mSitz));
        const pu = pult(mGlas, mPultChrom, this.mLeiste); pu.position.z = 0.75; p.add(pu); p.userData.pult = pu;
      }
      this.moderator = figur({ anzug: 0x1a1d2e, hemd: 0xf4f4f4, krawatte: 0x2a3aa0, haar: 0x6b6b6b });
      this.platzMod.add(this.moderator);
      this.schild(this.platzMod, "🎙️", "Moderator", "");
      this.kandidatFigur = null;
      this.kandidat(null);

      this.groesse();
      this.beobachter = new ResizeObserver(() => this.groesse()); this.beobachter.observe(host);
      this.stimmung("ruhe");
      this.schleife = this.schleife.bind(this);
      requestAnimationFrame(this.schleife);
    }

    groesse() {
      const b = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
      this.renderer.setSize(b, h, false);
      this.kamera.aspect = b / h; this.kamera.updateProjectionMatrix();
      this.weit = b / h < 1.2 ? Math.min(1.9, 1.35 / (b / h) + 0.3) : 1; // Hochformat: weiter weg
    }
    schild(platz, avatar, name, unter) {
      const s = platz.userData.pult.userData.schild;
      s.material.map?.dispose(); s.material.map = schildTextur(avatar, name, unter); s.material.needsUpdate = true;
    }
    leuteSetzen(t) {
      const m4 = new THREE.Matrix4();
      const jubel = this.stimmungName === "gold" || this.stimmungName === "million";
      this.leuteDaten.forEach((l, i) => {
        const hoch = jubel ? Math.abs(Math.sin(t * 7 + l.p)) * 0.14 : this.stimmungName === "publikum" ? Math.sin(t * 2 + l.p) * 0.02 : 0;
        m4.makeTranslation(l.x, l.y + 0.33 + hoch, l.z); this.leute.setMatrixAt(i, m4);
        m4.makeTranslation(l.x, l.y + 0.68 + hoch, l.z); this.koepfe.setMatrixAt(i, m4);
      });
      this.leute.instanceMatrix.needsUpdate = true; this.koepfe.instanceMatrix.needsUpdate = true;
    }

    // ---------- öffentliche Befehle ----------
    kandidat(k) {
      if (this.kandidatFigur) { this.platzKand.remove(this.kandidatFigur); this.kandidatFigur = null; }
      this.kandidatId = k?.id || null;
      if (!k) { this.schild(this.platzKand, "❓", "Wer kommt?", "Auswahlrunde"); return; }
      const h = hash(k.id);
      this.kandidatFigur = figur({ anzug: [0x2b3245, 0x3a2a1e, 0x1f3a2c, 0x45263a][h % 4], hemd: HEMDEN[h % HEMDEN.length], krawatte: null,
        haut: [0xf0c09a, 0xd9a27a, 0xa8734d, 0x7a4f32, 0xf5d0b0][(h >> 3) % 5], haar: [0x2b1a10, 0x6b4a2a, 0xd8b060, 0x111111, 0x8a3a1a][(h >> 5) % 5], frau: (h >> 7) % 2 === 1 });
      this.kandidatFigur.userData.anzugHemd = true;
      this.platzKand.add(this.kandidatFigur);
      this.schild(this.platzKand, k.avatar, k.name, k.unter || "");
    }
    bildschirm(oben, unten) {
      const c = this.ledLeinwand, g = c.getContext("2d");
      const v = g.createLinearGradient(0, 0, 0, c.height);
      v.addColorStop(0, "#0a1460"); v.addColorStop(1, "#030828");
      g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
      // feines LED-Raster
      g.fillStyle = "rgba(255,255,255,0.035)";
      for (let x = 0; x < c.width; x += 8) g.fillRect(x, 0, 2, c.height);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#ffcf3f"; g.shadowBlur = 24;
      g.fillStyle = "#ffcf3f"; g.font = `900 ${unten ? 64 : 84}px Outfit, system-ui, sans-serif`;
      g.fillText(oben, c.width / 2, unten ? 115 : c.height / 2);
      if (unten) { g.shadowColor = "#7f8cff"; g.fillStyle = "#fff"; g.font = "800 92px Outfit, system-ui, sans-serif"; g.fillText(unten, c.width / 2, 225); }
      this.ledTextur.needsUpdate = true;
    }
    stimmung(name) {
      if (!STIMMUNG[name]) name = "ruhe";
      if (name !== this.stimmungName && ["gold", "rot", "million"].includes(name)) this.blitzT = 1;
      this.stimmungName = name;
      const [licht, kranz, glut] = STIMMUNG[name];
      this.zielFarben = { licht: new THREE.Color(licht), kranz: new THREE.Color(kranz), glut: new THREE.Color(glut) };
      // Kamera und Posen passend zur Stimmung
      const kand = this.kandidatFigur?.userData, mod = this.moderator.userData;
      mod.pose = { ruhe: "reden", auswahl: "reden", telefon: "reden", spannung: "sitzen", gold: "jubel", million: "jubel", rot: "sitzen", publikum: "reden" }[name] || "sitzen";
      if (kand) kand.pose = { spannung: "denken", gold: "jubel", million: "jubel", rot: "traurig", telefon: "denken" }[name] || "sitzen";
      this.kameraModus = { spannung: "kandidat", rot: "kandidat", publikum: "publikum", million: "jubel", gold: "jubel", telefon: "kandidat" }[name] || "total";
      this.modusSeit = this.uhr.elapsedTime;
    }
    vorstellen() { this.kameraModus = "vorstellung"; this.modusSeit = this.uhr.elapsedTime; this.kamera.position.set(0, 7, 11); this.blitzT = 1; }

    // ---------- Animation ----------
    schleife() {
      if (this.weg) return;
      if (!this.host.isConnected) return this.zerstoeren();
      requestAnimationFrame(this.schleife);
      if (document.hidden) return;
      const dt = Math.min(0.05, this.uhr.getDelta()), t = this.uhr.elapsedTime;
      const k = 1 - Math.exp(-dt * 2.2);
      // Farben weich angleichen
      const z = this.zielFarben;
      this.kegelMat.color.lerp(z.licht, k);
      this.kegelMat.opacity += ((["gold", "million", "auswahl"].includes(this.stimmungName) ? 0.3 : this.stimmungName === "spannung" ? 0.26 : 0.18) + this.blitzT * 0.15 - this.kegelMat.opacity) * k;
      this.farbLichter.forEach((l) => l.color.lerp(z.licht, k));
      this.glut.color.lerp(z.glut, k);
      this.mLeiste.color.lerp(z.kranz, k);
      this.ringe.forEach((r) => r.material.color.lerp(z.kranz, k));
      this.buehne.material[0].emissive.lerp(z.glut, k);
      this.blitzT = Math.max(0, this.blitzT - dt * 1.4);
      this.hemi.intensity = 0.55 + this.blitzT * 0.9;
      this.haupt.intensity = (this.stimmungName === "spannung" ? 40 : 60) + this.blitzT * 40;
      // Lichterkranz: Lauflicht, bei Spannung schneller, bei Gold/Rot alle an
      const n = this.kranz.count, c = new THREE.Color();
      const tempo = this.stimmungName === "spannung" ? 9 : this.stimmungName === "auswahl" ? 6 : 2.5;
      for (let i = 0; i < n; i++) {
        const welle = ["gold", "rot", "million"].includes(this.stimmungName) ? (Math.sin(t * 10) > 0 ? 1 : 0.55) : 0.25 + 0.75 * Math.max(0, Math.sin(i * 0.45 - t * tempo)) ** 3;
        c.copy(z.kranz).multiplyScalar(welle);
        this.kranz.setColorAt(i, c);
      }
      this.kranz.instanceColor.needsUpdate = true;
      // Scheinwerfer: schwenken in Ruhe, zielen bei Spannung auf den Kandidaten
      const kandPos = new THREE.Vector3(1.75, 1.2, 0);
      this.scheinwerfer.forEach((sw, i) => {
        let ziel;
        if (this.stimmungName === "spannung" || this.stimmungName === "rot") ziel = kandPos.clone().add(new THREE.Vector3(Math.sin(i) * 0.3, 0, Math.cos(i) * 0.3));
        else if (this.stimmungName === "publikum") ziel = new THREE.Vector3(Math.sin(i * 0.8 + t * 0.6) * 7, 1, -8 + Math.cos(t * 0.5 + i) * 1.5);
        else {
          const sp = this.stimmungName === "auswahl" || this.stimmungName === "million" ? 1.6 : 0.45;
          ziel = new THREE.Vector3(Math.sin(t * sp + i * 1.7) * 3.2, 0, Math.cos(t * sp * 0.8 + i * 2.3) * 3.2);
        }
        sw.ziel.lerp(ziel, 1 - Math.exp(-dt * 3));
        sw.kopf.lookAt(sw.ziel);
      });
      // Publikum
      this.leuteSetzen(t);
      // Figuren
      const kf = this.kandidatFigur;
      this.moderator.userData.ziel.kopfY = this.stimmungName === "publikum" ? -0.9 : 0.05;
      figurBewegen(this.moderator, t, dt);
      if (kf) { kf.userData.ziel.kopfY = this.stimmungName === "spannung" ? -0.35 : 0; figurBewegen(kf, t, dt); }
      // Kamera
      const w = this.weit || 1, seit = t - (this.modusSeit || 0);
      let pos, blick;
      switch (this.kameraModus) {
        case "kandidat": { // langsame Fahrt über die Schulter des Moderators auf den Kandidaten
          const n2 = Math.min(1, seit / 9);
          pos = new THREE.Vector3(-0.9 - (1 - n2) * 0.8, 2.0 - n2 * 0.2, 3.4 + (1 - n2) * 1.2).multiplyScalar(w > 1 ? 1.15 : 1);
          blick = new THREE.Vector3(1.6, 1.45, 0); break;
        }
        case "publikum": pos = new THREE.Vector3(Math.sin(t * 0.2) * 1.5, 2.6, 4.5 * w); blick = new THREE.Vector3(0, 1.6, -8); break;
        case "jubel": { const a = 0.5 + Math.sin(seit * 0.3) * 0.5; pos = new THREE.Vector3(Math.sin(a) * 6.8 * w, 3.4, Math.cos(a) * 6.8 * w); blick = new THREE.Vector3(0.6, 1.2, 0); break; }
        case "vorstellung": { const n2 = Math.min(1, seit / 4); pos = new THREE.Vector3(1.8 - n2 * 0.6, 6 - n2 * 4, 9 - n2 * 5.2).multiplyScalar(w > 1 ? 1 + (w - 1) * 0.6 : 1); blick = new THREE.Vector3(1.75, 1.3, 0); break; }
        default: { const a = Math.sin(t * 0.07) * 0.5; pos = new THREE.Vector3(Math.sin(a) * 8.2 * w, 3.1 + Math.sin(t * 0.11) * 0.3, Math.cos(a) * 8.2 * w); blick = new THREE.Vector3(0, 1.05, 0); }
      }
      const kk = 1 - Math.exp(-dt * (this.kameraModus === "vorstellung" ? 3 : 1.3));
      this.kamera.position.lerp(pos, kk);
      this.blick.lerp(blick, kk);
      this.kamera.lookAt(this.blick);
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
      return new Studio(host);
    },
  };
})();
