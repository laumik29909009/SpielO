// =============================================================
//  Hintergrundmusik: 🎵-Knopf oben rechts
//  - 🎹 SpielO-Beat: eigener Song (beat.js spielt public/musik/spielo-beat.mp3 als Schleife), läuft standardmäßig
//  - weitere Musikrichtungen kommen vom Server (/api/musik),
//    der die Ordner in public/musik/ ausliest
//  Browser erlauben Ton erst nach dem ersten Tippen/Klicken.
//  Deshalb startet die Musik sofort, wenn der Browser es erlaubt,
//  sonst beim ersten Tipp irgendwo auf der Seite.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const audio = new Audio();
  audio.preload = "none";

  const BEAT = { id: "spielo", name: "SpielO-Beat", symbol: "🎹", eingebaut: true, titel: [{ name: "SpielO-Beat · eigener Song" }] };
  let richtungen = [BEAT];
  let richtung = null; // aktuelle Musikrichtung
  let reihenfolge = []; // Indizes der Lieder in Abspielreihenfolge
  let pos = 0;
  let zufall = GN.speicher("musikZufall") !== "0";
  let lautstaerke = Number(GN.speicher("musikLautstaerke") ?? 35);
  if (!isFinite(lautstaerke)) lautstaerke = 35;
  let beatPausiert = false; // vom Nutzer pausiert (nicht nur wegen Tab im Hintergrund)

  // Lautstärke über Web Audio: funktioniert auch auf dem iPhone (dort ignoriert Safari audio.volume)
  let ctx = null, regler = null;
  function audioVerbinden() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      regler = ctx.createGain();
      regler.connect(ctx.destination);
      ctx.createMediaElementSource(audio).connect(regler);
      ctx.onstatechange = zeichne;
    } catch { ctx = null; regler = null; }
    setzeLautstaerke(lautstaerke);
  }
  function setzeLautstaerke(wert) {
    lautstaerke = Math.max(0, Math.min(100, wert));
    const v = Math.pow(lautstaerke / 100, 2); // fühlt sich natürlicher an als linear
    if (regler) regler.gain.value = v;
    else audio.volume = v;
    GN.speicher("musikLautstaerke", String(lautstaerke));
  }

  const istBeat = () => !!richtung?.eingebaut;
  const lied = () => (richtung ? richtung.titel[reihenfolge[pos]] : null);
  const laeuftGerade = () => (istBeat() ? SpielOBeat.laeuft && ctx?.state === "running" : !!richtung && !audio.paused);
  const mischen = (n) => {
    const a = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  function waehleRichtung(id) {
    const neu = richtungen.find((r) => r.id === id) || null;
    GN.speicher("musikRichtung", neu ? neu.id : "aus");
    SpielOBeat.stop();
    audio.pause();
    richtung = neu;
    beatPausiert = false;
    if (!neu) return zeichne();
    reihenfolge = zufall && !neu.eingebaut ? mischen(neu.titel.length) : [...neu.titel.keys()];
    pos = 0;
    spiele();
  }

  function spiele() {
    if (!richtung) return;
    audioVerbinden();
    ctx?.resume?.().catch(() => {});
    if (istBeat()) {
      beatPausiert = false;
      if (ctx) SpielOBeat.start(ctx, regler);
    } else {
      const l = lied();
      if (!l) return;
      if (!audio.src.endsWith(l.datei)) audio.src = l.datei;
      audio.play().catch(() => {});
    }
    zeichne();
  }
  function pause() {
    if (istBeat()) { SpielOBeat.stop(); beatPausiert = true; }
    else audio.pause();
    zeichne();
  }
  function weiter(schritt = 1) {
    if (!richtung || istBeat()) return;
    pos = (pos + schritt + reihenfolge.length) % reihenfolge.length;
    spiele();
  }

  // Tab im Hintergrund: Beat pausieren (Browser bremsen Zeitgeber dort aus), beim Zurückkommen weiter
  document.addEventListener("visibilitychange", () => {
    if (istBeat()) {
      if (document.hidden) SpielOBeat.stop();
      else if (!beatPausiert && ctx) { ctx.resume?.().catch(() => {}); SpielOBeat.start(ctx, regler); }
      return zeichne();
    }
    if (!document.hidden && ctx && !audio.paused) ctx.resume?.();
  });
  audio.addEventListener("ended", () => weiter(1));
  audio.addEventListener("error", () => { if (richtung && !istBeat() && richtung.titel.length > 1) setTimeout(() => weiter(1), 800); });
  audio.addEventListener("play", zeichne);
  audio.addEventListener("pause", zeichne);

  // ---------- Oberfläche ----------
  const knopf = $("#musikBtn");
  const panel = $("#musikPanel");

  function zeichne() {
    const laeuft = laeuftGerade();
    knopf.classList.toggle("spielt", laeuft);
    knopf.setAttribute("aria-expanded", String(!panel.classList.contains("versteckt")));
    if (panel.classList.contains("versteckt")) return; // nur zeichnen, wenn sichtbar
    const l = lied();
    const beat = istBeat();
    panel.innerHTML = `
      <div class="musik-kopf"><b>🎵 Hintergrundmusik</b><button class="icon-btn klein" data-zu aria-label="Schließen">✕</button></div>
      <div class="musik-richtungen">
        <button class="musik-richtung ${!richtung ? "aktiv" : ""}" data-richtung="aus">🔇 Aus</button>
        ${richtungen.map((r) => `<button class="musik-richtung ${richtung?.id === r.id ? "aktiv" : ""}" data-richtung="${esc(r.id)}">${r.symbol} ${esc(r.name)}${r.eingebaut ? "" : ` <span>${r.titel.length}</span>`}</button>`).join("")}
      </div>
      ${richtung ? `
        <div class="musik-titel">
          <span class="wellen ${laeuft ? "an" : ""}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="musik-name" title="${esc(l?.name || "")}">${esc(l?.name || "")}</span>
          ${beat ? "" : `<span class="musik-nr">${pos + 1}/${reihenfolge.length}</span>`}
        </div>
        <div class="musik-steuerung">
          ${beat ? "" : '<button class="icon-btn" data-musik="zurueck" aria-label="Vorheriges Lied">⏮</button>'}
          <button class="icon-btn gross" data-musik="pause" aria-label="${laeuft ? "Pause" : "Abspielen"}">${laeuft ? "⏸" : "▶"}</button>
          ${beat ? "" : `<button class="icon-btn" data-musik="weiter" aria-label="Nächstes Lied">⏭</button>
            <button class="icon-btn ${zufall ? "an" : ""}" data-musik="zufall" aria-label="Zufallswiedergabe" title="Zufallswiedergabe">🔀</button>`}
        </div>
        ${beat ? '<p class="leise klein-text musik-notiz">Unser eigener Beat, live im Browser erzeugt. Läuft automatisch, bis du „Aus“ wählst.</p>' : ""}` : ""}
      <label class="musik-lautstaerke">
        <span aria-hidden="true">${lautstaerke == 0 ? "🔇" : lautstaerke < 50 ? "🔉" : "🔊"}</span>
        <input type="range" min="0" max="100" step="1" value="${lautstaerke}" id="musikRegler" aria-label="Lautstärke der Musik" />
        <span class="musik-prozent">${Math.round(lautstaerke)}%</span>
      </label>`;

    $("[data-zu]", panel).onclick = () => schliessen();
    $$("[data-richtung]", panel).forEach((b) => (b.onclick = () => { Ton.klick(); waehleRichtung(b.dataset.richtung); }));
    $$("[data-musik]", panel).forEach((b) => (b.onclick = () => {
      const was = b.dataset.musik;
      if (was === "pause") laeuftGerade() ? pause() : spiele();
      if (was === "weiter") weiter(1);
      if (was === "zurueck") audio.currentTime > 4 ? (audio.currentTime = 0) : weiter(-1);
      if (was === "zufall") {
        zufall = !zufall;
        GN.speicher("musikZufall", zufall ? "1" : "0");
        const aktuell = reihenfolge[pos];
        reihenfolge = zufall ? mischen(richtung.titel.length) : [...richtung.titel.keys()];
        pos = Math.max(0, reihenfolge.indexOf(aktuell));
        zeichne();
      }
    }));
    const r = $("#musikRegler", panel);
    r.oninput = () => {
      setzeLautstaerke(Number(r.value));
      $(".musik-prozent", panel).textContent = `${r.value}%`;
      $(".musik-lautstaerke span", panel).textContent = r.value == 0 ? "🔇" : r.value < 50 ? "🔉" : "🔊";
    };
  }

  function oeffnen() { panel.classList.remove("versteckt"); zeichne(); }
  function schliessen() { panel.classList.add("versteckt"); zeichne(); }
  knopf.onclick = (ev) => {
    ev.stopPropagation();
    Ton.klick();
    panel.classList.contains("versteckt") ? oeffnen() : schliessen();
  };
  document.addEventListener("pointerdown", (ev) => {
    if (!panel.classList.contains("versteckt") && !panel.contains(ev.target) && ev.target !== knopf) schliessen();
  });

  // ---------- Automatisch starten ----------
  // Gewünscht ist die zuletzt gewählte Richtung, beim ersten Besuch der SpielO-Beat.
  const gewuenscht = GN.speicher("musikRichtung") || BEAT.id;
  function beimErstenTipp() {
    const los = () => {
      ["pointerdown", "keydown"].forEach((e) => document.removeEventListener(e, los, true));
      knopf.classList.remove("wartet");
      if (!richtung || beatPausiert) return;
      if (istBeat()) { ctx?.resume?.().catch(() => {}); zeichne(); }
      else if (audio.paused) spiele();
    };
    ["pointerdown", "keydown"].forEach((e) => document.addEventListener(e, los, true));
  }
  if (gewuenscht !== "aus") {
    knopf.classList.add("wartet");
    beimErstenTipp();
    if (gewuenscht === BEAT.id) {
      // Beat sofort vorbereiten: Erlaubt der Browser Ton schon, läuft er direkt los
      richtung = BEAT; reihenfolge = [0]; pos = 0;
      audioVerbinden();
      if (ctx) { SpielOBeat.start(ctx, regler, { vonVorn: true }); ctx.resume?.().then(zeichne).catch(() => {}); }
      if (ctx?.state === "running") knopf.classList.remove("wartet");
    }
  }

  // Weitere Musikrichtungen vom Server laden
  fetch("/api/musik").then((r) => r.json()).then((d) => {
    richtungen = [BEAT, ...(d.richtungen || [])];
    if (!richtung && gewuenscht !== "aus" && gewuenscht !== BEAT.id) {
      const r = richtungen.find((x) => x.id === gewuenscht);
      if (r) { richtung = r; reihenfolge = zufall ? mischen(r.titel.length) : [...r.titel.keys()]; pos = 0; }
      else knopf.classList.remove("wartet");
    }
    zeichne();
  }).catch(() => {});
  zeichne();
})();
