// =============================================================
//  Raus da! 3D: Holzbrett auf dem Tisch, gedrechselte Spielfiguren,
//  ein Würfel, der aufs Brett fällt, Figuren hüpfen Feld für Feld,
//  Rausgeworfene fliegen im hohen Bogen zurück ins Haus.
//  Die Brettgrafik ist dieselbe wie in 2D (SVG), nur hochaufgelöst als Textur.
//  three.js wird erst geladen, wenn die 3D-Ansicht gewählt ist.
// =============================================================
window.LudoBrett3D = (() => {
  let THREE = null, laden = null;
  const webglDa = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.animationen === "aus";
  const FARBE = { rot: [0xff5a52, 0xc62828], blau: [0x5aa8ff, 0x1565c0], gruen: [0x5fd36a, 0x2e7d32], gelb: [0xffe45c, 0xf9a825] };
  // Rasterfeld (Spalte, Reihe) → Weltkoordinaten; Brett von -5.85 bis 5.85
  const welt = ([c, r]) => new THREE.Vector3(c - 5, 0, r - 5);

  // SVG-Brett in eine scharfe Textur verwandeln
  function svgTextur(svgInnen, groesse, aniso) {
    // CSS-Klassen der 2D-Ansicht gibt es im Bild nicht: Schrift direkt setzen, Leuchtrahmen weglassen
    const innen = svgInnen
      .replace(/<rect class="lu-haus-licht"[^>]*\/>/g, "")
      .replace(/class="lu-start-pfeil"/g, 'font-size="0.36" font-weight="900" fill="#fff" text-anchor="middle" font-family="Outfit, system-ui, sans-serif"')
      .replace(/class="lu-ziel-nr"/g, 'font-size="0.26" font-weight="900" fill="#fff" fill-opacity=".75" text-anchor="middle" font-family="Outfit, system-ui, sans-serif"');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.35 -0.35 11.7 11.7" width="${groesse}" height="${groesse}">${innen}</svg>`;
    return new Promise((ok) => {
      const bild = new Image();
      bild.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = groesse;
        c.getContext("2d").drawImage(bild, 0, 0, groesse, groesse);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
        ok(t);
      };
      bild.onerror = () => ok(null);
      bild.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  function holzTextur(hell, dunkel, aniso) {
    const c = document.createElement("canvas"); c.width = c.height = 1024;
    const g = c.getContext("2d");
    g.fillStyle = hell; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 140; i++) {
      const y = Math.random() * 1024;
      g.strokeStyle = dunkel; g.globalAlpha = 0.04 + Math.random() * 0.12; g.lineWidth = 1 + Math.random() * 5;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + i) * 8);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    return t;
  }
  // Würfel wie bei Baulöwe
  function wuerfelMaterial() {
    const P = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.27, .23], [.73, .23], [.27, .5], [.73, .5], [.27, .77], [.73, .77]] };
    return [3, 4, 1, 6, 2, 5].map((n) => {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const g = c.getContext("2d");
      g.fillStyle = "#fffdf6"; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 12; g.strokeRect(6, 6, 244, 244);
      for (const [x, y] of P[n]) { g.beginPath(); g.arc(x * 256, y * 256, n === 1 ? 30 : 22, 0, Math.PI * 2); g.fillStyle = n === 1 ? "#c62828" : "#1a1a1a"; g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 });
    });
  }
  const obenDrehung = (n) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...{ 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] }[n]));

  // Klassische Spielfigur: Fuß, Körper, Hals, Kugelkopf (gedrechselt)
  function figurGeometrie() {
    const p = [[0, 0], [0.3, 0], [0.31, 0.03], [0.28, 0.07], [0.2, 0.1], [0.17, 0.2], [0.13, 0.38], [0.09, 0.5], [0.12, 0.53], [0.12, 0.56], [0.07, 0.58]].map(([x, y]) => new THREE.Vector2(x, y));
    const koerper = new THREE.LatheGeometry(p, 32);
    const kopf = new THREE.SphereGeometry(0.135, 28, 20);
    kopf.translate(0, 0.68, 0);
    koerper.scale(1.3, 1.3, 1.3); kopf.scale(1.3, 1.3, 1.3);
    return { koerper, kopf };
  }

  class Brett {
    constructor(host, textur, aniso) {
      this.host = host;
      this.uhr = new THREE.Clock();
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      host.appendChild(r.domElement);
      const s = this.szene = new THREE.Scene();
      this.kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      s.add(new THREE.HemisphereLight(0xfff4e0, 0x2a1d12, 1.15));
      const sonne = new THREE.DirectionalLight(0xffffff, 2.3);
      sonne.position.set(-5, 13, 7); sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048);
      Object.assign(sonne.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
      sonne.shadow.bias = -0.0005; sonne.shadow.radius = 4;
      s.add(sonne);
      // Tisch, Brettkante, Brett
      const tischHolz = holzTextur("#4a2e18", "#2e1a0c", aniso); tischHolz.repeat.set(3, 3);
      const tisch = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ map: tischHolz, roughness: 0.6 }));
      tisch.rotation.x = -Math.PI / 2; tisch.position.y = -0.36; tisch.receiveShadow = true; s.add(tisch);
      const kante = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.34, 11.9), new THREE.MeshStandardMaterial({ map: holzTextur("#8a5a2b", "#5c3517", aniso), roughness: 0.45 }));
      kante.position.y = -0.18; kante.castShadow = true; kante.receiveShadow = true; s.add(kante);
      const oben = new THREE.Mesh(new THREE.PlaneGeometry(11.7, 11.7), new THREE.MeshStandardMaterial({ map: textur, roughness: 0.62 }));
      oben.rotation.x = -Math.PI / 2; oben.position.y = 0.001; oben.receiveShadow = true; s.add(oben);
      this.oben = oben;
      // Leuchtring um das Haus des Spielers am Zug
      this.hausRing = new THREE.Mesh(new THREE.RingGeometry(1.24, 1.36, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false }));
      this.hausRing.rotation.x = -Math.PI / 2; this.hausRing.position.y = 0.01; s.add(this.hausRing);
      // Zielvorschau (Geist)
      this.geist = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      this.geist.rotation.x = -Math.PI / 2; this.geist.position.y = 0.012; this.geist.visible = false; s.add(this.geist);
      // Würfel
      this.wuerfel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), wuerfelMaterial());
      this.wuerfel.castShadow = true; this.wuerfel.position.set(0, 0.31, 0); this.wuerfel.visible = false; s.add(this.wuerfel);
      this.wurf = null;
      this.geo = figurGeometrie();
      this.figuren = new Map(); // "id-k" → { g, pfad, … }
      this.ringe = [];
      this.groesse();
      new ResizeObserver(() => this.groesse()).observe(host);
      // Figuren antippen (und mit der Maus darüberfahren: Ziel zeigen)
      const ray = new THREE.Raycaster(), maus = new THREE.Vector2();
      const getroffen = (e) => {
        const b = r.domElement.getBoundingClientRect();
        maus.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(maus, this.kamera);
        const liste = [...this.figuren.values()].map((f) => f.huelle);
        const t = ray.intersectObjects(liste, false)[0];
        return t ? t.object.userData.schluessel : null;
      };
      let unten = null;
      r.domElement.addEventListener("pointerdown", (e) => {
        unten = [e.clientX, e.clientY];
        if (this.wurf || [...this.figuren.values()].some((f) => f.pfad.length || f.flug)) { this.schnell = 4; }
      });
      r.domElement.addEventListener("pointerup", (e) => {
        if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 8) return;
        const s = getroffen(e);
        if (s) this.aufFigur?.(s);
      });
      r.domElement.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const s = getroffen(e);
        if (s !== this.ueber) { this.ueber = s; this.beimUeberfahren?.(s); }
        r.domElement.style.cursor = s && this.figuren.get(s)?.kann ? "pointer" : "default";
      });
      const schleife = () => {
        if (this.aus) return;
        if (!this.host.isConnected) { if ((this.weg = (this.weg || 0) + 1) > 30) return this.entsorgen(); } else this.weg = 0;
        requestAnimationFrame(schleife);
        if (!document.hidden && this.host.isConnected) this.bild();
      };
      schleife();
    }
    groesse() {
      const w = this.host.clientWidth || 600, h = this.host.clientHeight || 600;
      this.renderer.setSize(w, h, false);
      this.kamera.aspect = w / h; this.kamera.updateProjectionMatrix();
    }
    entsorgen() { if (this.aus) return; this.aus = true; try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch {} }

    // Figur anlegen oder holen
    figur(schluessel, farbe) {
      let f = this.figuren.get(schluessel);
      if (f) return f;
      const [hell, dunkel] = FARBE[farbe];
      const mat = new THREE.MeshPhysicalMaterial({ color: hell, roughness: 0.18, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, emissive: dunkel, emissiveIntensity: 0.08 });
      const g = new THREE.Group();
      const k = new THREE.Mesh(this.geo.koerper, mat), kopf = new THREE.Mesh(this.geo.kopf, mat);
      k.castShadow = kopf.castShadow = true;
      g.add(k, kopf);
      // Unsichtbare Hülle zum Antippen (größer als die Figur, damit man sie am Handy trifft)
      const huelle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.25, 12), new THREE.MeshBasicMaterial({ visible: false }));
      huelle.position.y = 0.6; huelle.userData.schluessel = schluessel; g.add(huelle);
      this.szene.add(g);
      f = { g, mat, huelle, pfad: [], kann: false, ziel: null, flug: null };
      this.figuren.set(schluessel, f);
      return f;
    }
    // Stand übernehmen: Figuren, die gerade nicht laufen, stehen auf ihrem Feld
    setze({ figuren, dranZelle, dranFarbe, kann }) {
      for (const x of figuren) {
        const f = this.figur(x.schluessel, x.farbe);
        f.ziel = welt(x.zelle);
        if (!f.pfad.length && !f.flug && !f.gesetzt) { f.g.position.copy(f.ziel); f.gesetzt = true; }
        f.kann = kann.includes(x.schluessel);
      }
      if (dranZelle) {
        const m = welt(dranZelle);
        this.hausRing.position.set(m.x + 0.5, 0.01, m.z + 0.5);
        this.hausRing.material.color.setHex(FARBE[dranFarbe][0]);
        this.hausZiel = 0.85;
      } else this.hausZiel = 0;
    }
    // Figur läuft über die angegebenen Felder (Hüpfer pro Feld)
    laufen(schluessel, zellen, ms = 180) {
      const f = this.figuren.get(schluessel);
      if (!f) return Promise.resolve();
      return new Promise((ok) => {
        f.pfad = zellen.map((z) => welt(z));
        f.schrittMs = ms; f.t = 0; f.start = f.g.position.clone(); f.fertig = ok;
      });
    }
    // Rausgeworfen: hoher Bogen zurück ins Haus
    fliegen(schluessel, zelle) {
      const f = this.figuren.get(schluessel);
      if (!f) return;
      f.flug = { von: f.g.position.clone(), nach: welt(zelle), t: 0 };
    }
    ring(zelle, farbe) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 40), new THREE.MeshBasicMaterial({ color: FARBE[farbe][0], transparent: true, opacity: 1, depthWrite: false }));
      const p = welt(zelle); m.position.set(p.x, 0.015, p.z); m.rotation.x = -Math.PI / 2;
      this.szene.add(m); this.ringe.push({ m, t: 0 });
    }
    zielZeigen(zelle, schlag) {
      if (!zelle) { this.geist.visible = false; return; }
      const p = welt(zelle);
      this.geist.position.set(p.x, 0.012, p.z);
      this.geist.material.color.setHex(schlag ? 0xff3b3b : 0xffffff);
      this.geist.visible = true;
    }
    wuerfeln(w) {
      return new Promise((ok) => {
        this.wuerfel.visible = true;
        const ende = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2).multiply(obenDrehung(w));
        if (ruhig()) { this.wuerfel.quaternion.copy(ende); this.wuerfel.position.set(0, 0.31, 0); return ok(); }
        this.wurf = { t: 0, dauer: 1.1, ok, ende, start: new THREE.Vector3(-2.5, 3.4, 4), ziel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.31, (Math.random() - 0.5) * 0.5),
          achse: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), dreh: Math.PI * (6 + Math.random() * 3) };
      });
    }

    bild() {
      const dtEcht = Math.min(0.05, this.uhr.getDelta()), t = this.uhr.elapsedTime;
      if (this.schnell && !this.wurf && ![...this.figuren.values()].some((f) => f.pfad.length || f.flug)) this.schnell = 0;
      const dt = dtEcht * (this.schnell || 1);
      // Kamera: leicht schräg, ganzes Brett im Bild, wiegt sich sanft
      const a = this.kamera.aspect || 1;
      const abstand = 18.8 * Math.max(1, 1.05 / a), hoehe = (a < 1 ? 64 : 58) * Math.PI / 180;
      const ziel = new THREE.Vector3(0, abstand * Math.sin(hoehe), abstand * Math.cos(hoehe));
      if (!ruhig()) { ziel.x += Math.sin(t * 0.13) * 0.4; ziel.z += Math.sin(t * 0.1) * 0.25; }
      if (!this.kameraDa) { this.kamera.position.copy(ziel); this.kameraDa = true; } else this.kamera.position.lerp(ziel, 0.05);
      this.kamera.lookAt(0, 0, 0.35);
      // Hausring pulsiert
      const zielOp = (this.hausZiel || 0) * (0.65 + Math.sin(t * 3) * 0.35);
      this.hausRing.material.opacity += (zielOp - this.hausRing.material.opacity) * 0.15;
      this.geist.rotation.z += dt * 1.5;
      // Würfel
      if (this.wurf) {
        const W = this.wurf; W.t += dt;
        const k = Math.min(1, W.t / W.dauer);
        const h = 1 - Math.pow(1 - k, 2.2);
        this.wuerfel.position.x = W.start.x + (W.ziel.x - W.start.x) * h;
        this.wuerfel.position.z = W.start.z + (W.ziel.z - W.start.z) * h;
        let y;
        if (k < 0.42) { const u = k / 0.42; y = W.start.y * (1 - u * u); }
        else if (k < 0.7) { const u = (k - 0.42) / 0.28; y = 0.7 * 4 * u * (1 - u); }
        else if (k < 0.86) { const u = (k - 0.7) / 0.16; y = 0.18 * 4 * u * (1 - u); }
        else y = 0;
        this.wuerfel.position.y = 0.31 + y;
        this.wuerfel.quaternion.copy(W.ende).multiply(new THREE.Quaternion().setFromAxisAngle(W.achse, W.dreh * Math.pow(1 - k, 2)));
        if (k >= 1) { const ok = W.ok; this.wurf = null; ok(); }
      }
      // Figuren
      for (const f of this.figuren.values()) {
        const p = f.g.position;
        if (f.pfad.length) {
          f.t += (dt * 1000) / f.schrittMs;
          const ziel = f.pfad[0];
          const u = Math.min(1, f.t);
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          p.x = f.start.x + (ziel.x - f.start.x) * e;
          p.z = f.start.z + (ziel.z - f.start.z) * e;
          p.y = Math.sin(u * Math.PI) * 0.45;
          // Stauchen beim Landen, Strecken in der Luft
          const sq = u > 0.85 ? 1 - (1 - (u - 0.85) / 0.15) * 0.18 : 1 + Math.sin(u * Math.PI) * 0.08;
          f.g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
          if (u >= 1) {
            f.pfad.shift(); f.t = 0; f.start = p.clone(); p.y = 0;
            this.beiSchritt?.();
            if (!f.pfad.length) { f.g.scale.setScalar(1); const ok = f.fertig; f.fertig = null; ok?.(); }
          }
        } else if (f.flug) {
          const F = f.flug; F.t += dt / 0.8;
          const u = Math.min(1, F.t), e = 1 - Math.pow(1 - u, 2);
          p.lerpVectors(F.von, F.nach, e);
          p.y = Math.sin(u * Math.PI) * 3.2;
          f.g.rotation.x = u * Math.PI * 4; f.g.rotation.z = u * Math.PI * 2;
          if (u >= 1) { f.flug = null; f.g.rotation.set(0, 0, 0); p.copy(F.nach); }
        } else if (f.ziel) {
          p.lerp(f.ziel, 0.25);
          // Bewegliche Figuren wippen
          p.y = f.kann ? Math.abs(Math.sin(t * 5)) * 0.18 : 0;
          f.mat.emissiveIntensity = f.kann ? 0.25 + Math.sin(t * 5) * 0.12 : 0.08;
        }
      }
      // Ringe (Figur kommt raus)
      this.ringe = this.ringe.filter((r) => {
        r.t += dt / 0.7;
        r.m.scale.setScalar(1 + r.t * 2.2); r.m.material.opacity = Math.max(0, 1 - r.t);
        if (r.t >= 1) { this.szene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; }
        return true;
      });
      this.renderer.render(this.szene, this.kamera);
    }
  }

  return {
    moeglich: webglDa,
    async einhaengen(host, svgInnen) {
      if (!THREE) { laden ||= import("/vendor/three.module.min.js").then((m) => { THREE = m; }); await laden; }
      try { await Promise.race([document.fonts?.load?.("900 40px Outfit"), new Promise((ok) => setTimeout(ok, 1500))]); } catch {}
      const probe = document.createElement("canvas").getContext("webgl2") ? 4096 : 2048;
      const textur = await svgTextur(svgInnen, probe, 8);
      if (!textur) throw new Error("Brett-Textur fehlt");
      return new Brett(host, textur, 8);
    },
  };
})();
