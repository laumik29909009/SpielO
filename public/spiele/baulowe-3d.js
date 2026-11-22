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
  function brettTextur(felder, gruppen) {
    const S = 2048, k = S / B;
    const c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d");
    const px = (x) => (x + B / 2) * k;
    // Mitte: grünes Spielfeld mit Logo
    const verlauf = g.createRadialGradient(S / 2, S / 2, 50, S / 2, S / 2, S * 0.55);
    verlauf.addColorStop(0, "#2f7d55"); verlauf.addColorStop(1, "#174a33");
    g.fillStyle = "#0e2b1e"; g.fillRect(0, 0, S, S);
    g.fillStyle = verlauf; g.fillRect(C * k, C * k, S - 2 * C * k, S - 2 * C * k);
    g.save(); g.translate(S / 2, S / 2); g.rotate(-Math.PI / 4);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "900 190px Outfit, system-ui, sans-serif";
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillText("Baulöwe", 8, 14);
    g.fillStyle = "#fff8e6"; g.fillText("Baulöwe", 0, 0);
    g.font = "700 64px Outfit, system-ui, sans-serif"; g.fillStyle = "#ffd76a"; g.fillText("Schechingen-Edition", 0, 140);
    g.restore();
    // Kartenfelder in der Mitte
    const kartenFeld = (x, y, w, h, rot, text, farbe) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = "rgba(255,255,255,.08)"; g.strokeStyle = farbe; g.lineWidth = 8; g.setLineDash([22, 14]);
      g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 26); g.fill(); g.stroke(); g.setLineDash([]);
      g.fillStyle = farbe; g.font = "800 58px Outfit, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 0, 0);
      g.restore();
    };
    kartenFeld(S * 0.32, S * 0.32, 420, 260, -Math.PI / 4, "❓ Glück", "#ffb35a");
    kartenFeld(S * 0.68, S * 0.68, 420, 260, -Math.PI / 4, "💰 Dorfkasse", "#7fd3ff");
    // Felder
    felder.forEach((f, i) => {
      const r = rechteck(i);
      const x = px(r.x0), y = px(r.z0), w = (r.x1 - r.x0) * k, h = (r.z1 - r.z0) * k;
      g.fillStyle = r.ecke ? "#ece1c4" : "#f6eedb"; g.fillRect(x, y, w, h);
      g.strokeStyle = "#2a3a30"; g.lineWidth = 4; g.strokeRect(x, y, w, h);
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate(r.ecke ? ECK_WINKEL[i] : WINKEL[r.seite]);
      g.textAlign = "center"; g.textBaseline = "middle";
      if (r.ecke) {
        g.font = "150px serif"; g.fillText(f.icon || "", 0, -40);
        g.fillStyle = "#1c2a22"; g.font = "800 46px Outfit, system-ui, sans-serif";
        zeilen(g, f.name.split(" /")[0], 0, 90, C * k * 1.05, 44);
      } else {
        const fw = N * k, fh = C * k; // Breite und Tiefe im gedrehten Feld
        const gr = f.gruppe ? gruppen[f.gruppe] : null;
        if (gr) { g.fillStyle = gr.farbe; g.fillRect(-fw / 2, -fh / 2, fw, fh * 0.22); g.strokeStyle = "#2a3a30"; g.lineWidth = 3; g.strokeRect(-fw / 2, -fh / 2, fw, fh * 0.22); }
        g.fillStyle = "#1c2a22";
        const top = gr ? -fh / 2 + fh * 0.32 : -fh / 2 + fh * 0.16;
        if (f.icon) { g.font = "64px serif"; g.fillText(f.icon, 0, top + (gr ? 0 : 40)); }
        g.font = "800 34px Outfit, system-ui, sans-serif";
        zeilen(g, f.name.replace(/^Bahnhof /, "Bhf. ").replace(/^Kirche /, ""), 0, f.icon ? top + 92 : top + 40, fw * 0.92, 36);
        if (f.preis || f.betrag) { g.font = "800 36px Outfit, system-ui, sans-serif"; g.fillText(`${f.preis || f.betrag} €`, 0, fh / 2 - 36); }
      }
      g.restore();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  // Text in mehrere Zeilen umbrechen
  function zeilen(g, text, x, y, breite, hoehe) {
    const woerter = text.split(/[\s-]/);
    const z = []; let akt = "";
    for (const w of woerter) { const t = akt ? akt + " " + w : w; if (g.measureText(t).width > breite && akt) { z.push(akt); akt = w; } else akt = t; }
    z.push(akt);
    z.forEach((l, i) => g.fillText(l, x, y + (i - (z.length - 1) / 2) * hoehe));
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
  // Drehung, bei der die Augenzahl nach oben zeigt
  function obenDrehung(n) {
    const q = new THREE.Quaternion();
    const e = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] }[n];
    return q.setFromEuler(new THREE.Euler(...e));
  }

  // ---------- Figur (Spielstein) ----------
  function spielstein(farbe, icon) {
    const g = new THREE.Group();
    const profil = [[0, 0], [0.2, 0], [0.21, 0.04], [0.15, 0.08], [0.09, 0.2], [0.07, 0.32], [0.12, 0.36], [0.07, 0.4], [0.1, 0.48], [0.07, 0.55], [0, 0.56]].map(([x, y]) => new THREE.Vector2(x, y));
    const mat = new THREE.MeshStandardMaterial({ color: farbe, metalness: 0.35, roughness: 0.3 });
    const k = new THREE.Mesh(new THREE.LatheGeometry(profil, 24), mat);
    k.castShadow = true; g.add(k);
    // Emoji-Symbol schwebt über dem Stein (so erkennt man ihn sofort)
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fillStyle = "#fffdf6"; x.fill(); x.lineWidth = 8; x.strokeStyle = farbe; x.stroke();
    x.font = "76px serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(icon, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(0.42, 0.42, 1); s.position.y = 0.86; s.renderOrder = 5;
    g.add(s);
    g.userData.schild = s;
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
      const tisch = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.85 }));
      tisch.rotation.x = -Math.PI / 2; tisch.position.y = -0.31; tisch.receiveShadow = true; s.add(tisch);
      const rand = new THREE.Mesh(new THREE.BoxGeometry(B + 0.3, 0.3, B + 0.3), new THREE.MeshStandardMaterial({ color: 0x0e2b1e, roughness: 0.6 }));
      rand.position.y = -0.16; rand.castShadow = true; rand.receiveShadow = true; s.add(rand);
      const oben = this.oben = new THREE.Mesh(new THREE.PlaneGeometry(B, B), new THREE.MeshStandardMaterial({ map: brettTextur(felder, gruppen), roughness: 0.75 }));
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
      this.wurf = null;
      this.figuren = new Map();
      this.zustandDaten = null;
      this.fokusPunkt = new THREE.Vector3(0, 0, 0.9);
      this.groesse();
      new ResizeObserver(() => this.groesse()).observe(host);
      // Felder antippen
      const ray = new THREE.Raycaster(), maus = new THREE.Vector2();
      let unten = null;
      r.domElement.addEventListener("pointerdown", (e) => (unten = [e.clientX, e.clientY]));
      r.domElement.addEventListener("pointerup", (e) => {
        if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 8) return;
        const b = r.domElement.getBoundingClientRect();
        maus.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(maus, this.kamera);
        const t = ray.intersectObject(this.oben)[0];
        if (!t) return;
        const i = this.feldAn(t.point.x, t.point.z);
        if (i >= 0) this.aufFeld?.(i);
      });
      const schleife = () => { requestAnimationFrame(schleife); if (!document.hidden && this.host.isConnected) this.bild(); };
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
        if (ruhig()) { this.wuerfel.forEach((w, i) => { w.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6).multiply(obenDrehung(werte[i]))); w.position.y = 0.275; }); return ok(); }
        const ziel = this.wuerfel.map((_, i) => new THREE.Vector3(-0.55 + i * 1.1 + (Math.random() - 0.5) * 0.4, 0.275, 0.6 + (Math.random() - 0.5) * 0.6));
        this.wurf = {
          t: 0, dauer: 1.35, ok,
          w: this.wuerfel.map((w, i) => ({
            start: new THREE.Vector3(-1.8 + i * 1.2, 3.2, 4.4), ziel: ziel[i],
            ende: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2).multiply(obenDrehung(werte[i])),
            achse: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), dreh: Math.PI * (7 + Math.random() * 3),
          })),
        };
      });
    }
    fokus(feld) { const m = mitteVon(feld); this.fokusPunkt.set(m.x * 0.12, 0, m.z * 0.12 + 0.9); }

    bild() {
      const dt = Math.min(0.05, this.uhr.getDelta()), t = this.uhr.elapsedTime;
      // Kamera: leicht schräg von vorn, wiegt sich sanft
      // Abstand nach Seitenverhältnis: immer das ganze Brett im Bild
      const a = this.kamera.aspect || 1.25;
      const abstand = 17.2 * Math.max(1, 1.36 / a), hoehe = (a < 1.1 ? 64 : 54) * Math.PI / 180;
      const ziel = new THREE.Vector3(0, abstand * Math.sin(hoehe), abstand * Math.cos(hoehe));
      if (!ruhig()) { ziel.x += Math.sin(t * 0.15) * 0.5; ziel.z += Math.sin(t * 0.11) * 0.3; }
      this.kamera.position.lerp(ziel, 0.05);
      this.blick = (this.blick || this.fokusPunkt.clone()).lerp(this.fokusPunkt, 0.04);
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
            if (!fg.pfad.length) { fg.ziel = this.platzFuer(id, fg.feld, this.figurenListe || []); for (const [x, o] of this.figuren) if (x !== id && !o.pfad.length) o.ziel = this.platzFuer(x, o.feld, this.figurenListe || []); }
          } else if (fg.schrittT > 0) {
            const nach = this.platzFuer(id, fg.pfad[0].feld, this.figurenListe || []);
            fg.g.position.lerpVectors(fg.start, nach, fg.schrittT);
            fg.g.position.y = Math.sin(fg.schrittT * Math.PI) * 0.4;
          }
        } else if (fg.ziel) {
          fg.g.position.lerp(fg.ziel, 0.15);
          fg.g.position.y = fg.dran && !ruhig() ? Math.abs(Math.sin(t * 2.4)) * 0.08 : 0;
        }
        fg.g.userData.schild.scale.setScalar(fg.dran ? 0.5 + Math.sin(t * 3) * 0.03 : 0.4);
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
      return new Brett(host, felder, gruppen);
    },
  };
})();
