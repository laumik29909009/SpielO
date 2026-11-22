// =============================================================
//  Qualität: Effekt-Werkzeugkasten (GN.fx), Knopf-Feedback und Einstellungen
//  - GN.fx.zahl:    Zahl zählt sichtbar hoch
//  - GN.fx.pop:     Element springt kurz auf
//  - GN.fx.funken:  Funkenregen an einer Stelle
//  - GN.fx.flug:    ein Inhalt fliegt von A nach B
//  - GN.fx.schuettel: Element wackelt (Fehler)
//  - Einstellungen: Lautstärke, Animationen, Farbsicht-Hilfe, Vibration (auf diesem Gerät)
// =============================================================
(() => {
  const { $, $$ } = GN;
  const html = document.documentElement;
  const wenigBewegung = () => html.dataset.animationen === "aus" || matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Einstellungen laden ----------
  const EIN = { animationen: "an", farbsicht: "aus", vibration: "an" };
  for (const k of Object.keys(EIN)) { const v = GN.speicher("e_" + k); if (v) EIN[k] = v; }
  function anwenden() {
    html.dataset.animationen = EIN.animationen;
    html.dataset.farbsicht = EIN.farbsicht;
  }
  anwenden();

  // Vibration zentral abschaltbar (alle Spiele rufen navigator.vibrate auf)
  const vibrierenOriginal = navigator.vibrate?.bind(navigator);
  if (vibrierenOriginal) navigator.vibrate = (muster) => (EIN.vibration === "an" ? vibrierenOriginal(muster) : false);

  // Konfetti bei reduzierten Animationen sparsamer
  const konfettiOriginal = GN.konfetti;
  if (konfettiOriginal) GN.konfetti = (n, ...rest) => konfettiOriginal(wenigBewegung() ? Math.min(n || 0, 18) : n, ...rest);

  // =============================================================
  //  Effekt-Werkzeugkasten
  // =============================================================
  const fx = (GN.fx = {
    // Zahl in el zählt von „von“ bis „bis“ (mit Abbremsen am Ende)
    zahl(el, von, bis, { dauer = 900, format = (n) => Math.round(n).toLocaleString("de-DE") } = {}) {
      if (!el) return;
      if (wenigBewegung() || von === bis) { el.textContent = format(bis); return; }
      const start = performance.now();
      const schritt = (t) => {
        const k = Math.min(1, (t - start) / dauer);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = format(von + (bis - von) * e);
        if (k < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    },
    // Kurzes Aufspringen
    pop(el, staerke = 1) {
      if (!el || wenigBewegung()) return;
      el.animate([{ transform: "scale(1)" }, { transform: `scale(${1 + 0.18 * staerke})`, offset: 0.35 }, { transform: "scale(0.97)", offset: 0.7 }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.2,1.4,.4,1)" });
    },
    // Wackeln bei Fehlern
    schuettel(el) {
      if (!el) return;
      if (wenigBewegung()) { el.animate([{ outline: "3px solid #ff5a6a" }, { outline: "3px solid transparent" }], { duration: 500 }); return; }
      el.animate([0, -8, 7, -5, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 380, easing: "ease-out" });
    },
    // Funkenregen an einem Element oder an einer Position {x, y}
    funken(ziel, { anzahl = 14, farben = ["#ffcf3f", "#ff7a3d", "#fff1a8", "#b363ff"], weite = 70 } = {}) {
      if (wenigBewegung()) return;
      const r = ziel instanceof Element ? ziel.getBoundingClientRect() : { left: ziel.x, top: ziel.y, width: 0, height: 0 };
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      for (let i = 0; i < anzahl; i++) {
        const f = document.createElement("i");
        f.className = "fx-funke";
        const w = (i / anzahl) * Math.PI * 2 + Math.random() * 0.5, d = weite * (0.5 + Math.random() * 0.7);
        f.style.cssText = `left:${x}px;top:${y}px;background:${farben[i % farben.length]}`;
        document.body.appendChild(f);
        f.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(w) * d}px), calc(-50% + ${Math.sin(w) * d + 20}px)) scale(0.2)`, opacity: 0 }],
          { duration: 550 + Math.random() * 350, easing: "cubic-bezier(.15,.7,.3,1)" }).onfinish = () => f.remove();
      }
    },
    // Ein Stück HTML fliegt von einem Element zu einem anderen (z. B. Punkte zur Anzeige)
    flug(von, zu, inhalt, { dauer = 700 } = {}) {
      if (!von || !zu || wenigBewegung()) return Promise.resolve();
      const a = von.getBoundingClientRect(), b = zu.getBoundingClientRect();
      const el = document.createElement("div");
      el.className = "fx-flug"; el.innerHTML = inhalt;
      el.style.cssText = `left:${a.left + a.width / 2}px;top:${a.top + a.height / 2}px`;
      document.body.appendChild(el);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      return new Promise((ok) => {
        el.animate([{ transform: "translate(-50%,-50%) scale(1)" }, { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(1.25)`, offset: 0.5 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0.6 }],
          { duration: dauer, easing: "cubic-bezier(.4,0,.2,1)" }).onfinish = () => { el.remove(); fx.pop(zu); ok(); };
      });
    },
  });

  // ---------- Vollständiger Baukasten mit festen Regeln ----------
  // Zahl zählt hoch, mit leisen Tick-Tönen (höchstens alle 70 ms)
  fx.zaehle = (el, von, bis, opt = {}) => {
    fx.zahl(el, von, bis, opt);
    if (wenigBewegung() || von === bis) return;
    const dauer = opt.dauer || 900, ende = performance.now() + dauer * 0.85;
    const tick = () => { if (performance.now() < ende) { Ton.tick(); setTimeout(tick, 70 + (performance.now() + dauer - ende) / 25); } };
    tick();
  };
  // Einheitliche Einblendung in drei Stufen: 1 klein, 2 mittel, 3 groß (mit Wackeln und Funken)
  fx.knall = (text, staerke = 1, unter = "") => {
    const el = document.createElement("div");
    el.className = `fx-knall s${staerke}`;
    el.innerHTML = `<b>${text}</b>${unter ? `<span>${unter}</span>` : ""}`;
    document.body.appendChild(el);
    const dauer = [0, 1100, 1500, 2100][staerke] || 1300;
    if (staerke >= 3) { fx.wackeln(2); fx.teilchen(el, null, "sterne"); }
    setTimeout(() => el.classList.add("weg"), dauer - 300);
    setTimeout(() => el.remove(), dauer);
    return el;
  };
  // Bildschirm wackelt: 1 = Kleinigkeit, 2 = Treffer, 3 = nur beim Sieg
  fx.wackeln = (staerke = 1) => {
    if (wenigBewegung()) return;
    const a = [0, 3, 7, 13][Math.min(3, staerke)] || 3;
    GN.app.animate([0, -a, a * 0.8, -a * 0.5, a * 0.25, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? a * 0.3 : 0}px)` })), { duration: 260 + staerke * 90, easing: "ease-out" });
    if (staerke >= 2) navigator.vibrate?.(staerke >= 3 ? [30, 40, 60] : 25);
  };
  // Teilchen an einer Stelle: Funken, Sterne oder Münzen
  fx.teilchen = (ort, y = null, art = "funken") => {
    if (art === "funken") return fx.funken(ort instanceof Element ? ort : { x: ort, y }, { anzahl: 16 });
    if (wenigBewegung()) return;
    const r = ort instanceof Element ? ort.getBoundingClientRect() : { left: ort, top: y, width: 0, height: 0 };
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const zeichen = art === "muenzen" ? ["🪙"] : art === "staub" ? ["💨", "☁️"] : ["⭐", "✨", "🌟"];
    for (let i = 0; i < 12; i++) {
      const t = document.createElement("i");
      t.className = "fx-teil"; t.textContent = zeichen[i % zeichen.length];
      t.style.cssText = `left:${x0}px;top:${y0}px`;
      document.body.appendChild(t);
      const w = (i / 12) * Math.PI * 2, d = 60 + Math.random() * 70;
      t.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(w) * d}px), calc(-50% + ${Math.sin(w) * d - 30}px)) scale(1)`, opacity: 1, offset: 0.6 }, { transform: `translate(calc(-50% + ${Math.cos(w) * d * 1.1}px), calc(-50% + ${Math.sin(w) * d + 40}px)) scale(.6)`, opacity: 0 }],
        { duration: 900 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => t.remove();
    }
  };
  // Gegenstand fliegt von A nach B
  fx.flieg = (von, nach, icon, opt) => fx.flug(von, nach, `<span class="fx-flieg-icon">${icon}</span>`, opt);
  // Hit-Stop: alles friert kurz ein (mit Blitz), danach geht es weiter
  fx.stopp = (ms = 140) => new Promise((ok) => {
    if (wenigBewegung()) return ok();
    document.body.classList.add("fx-stopp");
    const blitz = document.createElement("div"); blitz.className = "fx-blitz"; document.body.appendChild(blitz);
    setTimeout(() => { document.body.classList.remove("fx-stopp"); blitz.remove(); ok(); }, ms);
  });

  // =============================================================
  //  Knopf-Feedback: kleine Welle an der Stelle, an der getippt wurde
  // =============================================================
  document.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest?.(".btn, .modus-karte, .segment button, .icon-btn");
    if (!b || b.disabled || wenigBewegung()) return;
    const r = b.getBoundingClientRect();
    const w = document.createElement("span");
    w.className = "fx-welle";
    const g = Math.max(r.width, r.height) * 2.2;
    w.style.cssText = `width:${g}px;height:${g}px;left:${ev.clientX - r.left - g / 2}px;top:${ev.clientY - r.top - g / 2}px`;
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.classList.add("fx-welle-huelle");
    b.appendChild(w);
    w.animate([{ transform: "scale(0)", opacity: 0.35 }, { transform: "scale(1)", opacity: 0 }], { duration: 520, easing: "ease-out" }).onfinish = () => w.remove();
    if (b.matches(".btn.gross, #startBtn, .btn:not(.zweit):not(.link):not(.klein)")) navigator.vibrate?.(8);
  }, { passive: true });

  // =============================================================
  //  Karten neigen sich zur Maus und glänzen (nur mit Maus, nicht am Handy)
  // =============================================================
  let neigEl = null, neigRaf = 0;
  const neigAus = () => { if (neigEl) { neigEl.classList.remove("fx-neig"); neigEl.style.removeProperty("--tw"); neigEl = null; } };
  document.addEventListener("pointermove", (ev) => {
    if (ev.pointerType !== "mouse" || wenigBewegung()) return;
    const el = ev.target.closest?.(".fr-handkarte .fk, .sk-handkarte .sk, .q-gal-reihe .qkarte, .q-meine-karte .qkarte");
    if (el !== neigEl) neigAus();
    if (!el) return;
    neigEl = el;
    cancelAnimationFrame(neigRaf);
    neigRaf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
      el.classList.add("fx-neig");
      el.style.setProperty("--ax", (-y).toFixed(3)); el.style.setProperty("--ay", x.toFixed(3));
      el.style.setProperty("--tw", `${Math.min(14, Math.hypot(x, y) * 26).toFixed(1)}deg`);
      el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(0)}%`); el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(0)}%`);
    });
  }, { passive: true });
  document.addEventListener("pointerleave", neigAus);

  // =============================================================
  //  Einstellungen-Fenster (⚙️ oben rechts)
  // =============================================================
  const knopf = $("#einstellungenBtn");
  function fenster() {
    let d = $("#einstellungenFenster");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "einstellungenFenster"; d.className = "fenster e-fenster"; d.setAttribute("aria-label", "Einstellungen");
      document.body.appendChild(d);
      d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); });
    }
    const schalter = (k, titel, text, an = "an", aus = "aus") => `
      <label class="e-zeile"><span><b>${titel}</b><small>${text}</small></span>
        <input type="checkbox" class="e-schalter" data-e="${k}" data-an="${an}" data-aus="${aus}" ${EIN[k] === an ? "checked" : ""}></label>`;
    const laut = Math.round((Ton.lautstaerke ?? 1) * 100);
    d.innerHTML = `
      <div class="fenster-kopf"><h2>⚙️ Einstellungen</h2><button class="icon-btn klein" data-schliessen aria-label="Schließen">✕</button></div>
      <div class="e-liste">
        <div class="e-zeile"><span><b>🔊 Soundeffekte</b><small>Lautstärke der Spielgeräusche</small></span>
          <span class="e-laut"><button class="icon-btn klein" id="eTonAus" aria-label="Soundeffekte an/aus">${Ton.an ? "🔊" : "🔇"}</button><input type="range" id="eLaut" min="0" max="100" step="5" value="${laut}" aria-label="Lautstärke"><em id="eLautZahl">${laut}%</em></span></div>
        ${schalter("animationen", "✨ Animationen", "Aus: weniger Bewegung, kein Wackeln, schlichte Übergänge")}
        ${schalter("farbsicht", "🎨 Farbsicht-Hilfe", "Zusätzliche Formen auf farbigen Karten (z. B. GoonO)", "an", "aus")}
        ${schalter("vibration", "📳 Vibration", "Kurzes Vibrieren, wenn du dran bist (nur Handy)")}
        <div class="e-zeile"><span><b>🎵 Hintergrundmusik</b><small>Stücke und Lautstärke wählst du über den Notenknopf oben</small></span><button class="btn zweit klein" id="eMusik">Öffnen</button></div>
      </div>
      <p class="leise klein-text e-fuss">Gilt nur auf diesem Gerät.</p>`;
    $("[data-schliessen]", d).onclick = () => d.close();
    $$(".e-schalter", d).forEach((c) => (c.onchange = () => {
      EIN[c.dataset.e] = c.checked ? c.dataset.an : c.dataset.aus;
      GN.speicher("e_" + c.dataset.e, EIN[c.dataset.e]);
      anwenden();
      Ton.klick();
      if (c.dataset.e === "vibration" && c.checked) navigator.vibrate?.(40);
    }));
    const regler = $("#eLaut", d);
    regler.oninput = () => { Ton.lautstaerke = regler.value / 100; $("#eLautZahl", d).textContent = regler.value + "%"; };
    regler.onchange = () => Ton.serie(3);
    $("#eTonAus", d).onclick = (ev) => { const an = Ton.umschalten(); ev.currentTarget.textContent = an ? "🔊" : "🔇"; const t = $("#tonBtn"); if (t) t.textContent = an ? "🔊" : "🔇"; };
    $("#eMusik", d).onclick = () => { d.close(); $("#musikBtn")?.click(); };
    return d;
  }
  if (knopf) knopf.onclick = () => { Ton.klick(); const d = fenster(); d.showModal(); };
  GN.einstellungenOeffnen = () => knopf?.click();
})();
