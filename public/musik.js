// =============================================================
//  Hintergrundmusik: 🎵-Knopf oben rechts
//  Musikrichtungen und Lieder kommen vom Server (/api/musik),
//  der die Ordner in public/musik/ ausliest.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const audio = new Audio();
  audio.preload = "none";

  let richtungen = [];
  let richtung = null; // aktuelle Musikrichtung
  let reihenfolge = []; // Indizes der Lieder in Abspielreihenfolge
  let pos = 0;
  let zufall = GN.speicher("musikZufall") !== "0";
  let lautstaerke = Number(GN.speicher("musikLautstaerke") ?? 35);
  if (!isFinite(lautstaerke)) lautstaerke = 35;

  // Lautstärke über Web Audio: funktioniert auch auf dem iPhone (dort ignoriert Safari audio.volume)
  let ctx = null, regler = null;
  function audioVerbinden() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      regler = ctx.createGain();
      ctx.createMediaElementSource(audio).connect(regler).connect(ctx.destination);
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

  const lied = () => (richtung ? richtung.titel[reihenfolge[pos]] : null);
  const mischen = (n) => {
    const a = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  function waehleRichtung(id) {
    const neu = richtungen.find((r) => r.id === id) || null;
    GN.speicher("musikRichtung", neu ? neu.id : "aus");
    if (!neu) { audio.pause(); richtung = null; return zeichne(); }
    richtung = neu;
    reihenfolge = zufall ? mischen(neu.titel.length) : [...neu.titel.keys()];
    pos = 0;
    spiele();
  }

  function spiele() {
    const l = lied();
    if (!l) return;
    audioVerbinden();
    ctx?.resume?.();
    if (!audio.src.endsWith(l.datei)) audio.src = l.datei;
    audio.play().catch(() => {});
    zeichne();
  }
  function weiter(schritt = 1) {
    if (!richtung) return;
    pos = (pos + schritt + reihenfolge.length) % reihenfolge.length;
    spiele();
  }

  // Manche Browser pausieren den Ton im Hintergrund: beim Zurückkommen fortsetzen
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ctx && !audio.paused) ctx.resume?.(); });
  audio.addEventListener("ended", () => weiter(1));
  audio.addEventListener("error", () => { if (richtung && richtung.titel.length > 1) setTimeout(() => weiter(1), 800); });
  audio.addEventListener("play", zeichne);
  audio.addEventListener("pause", zeichne);

  // ---------- Oberfläche ----------
  const knopf = $("#musikBtn");
  const panel = $("#musikPanel");

  function zeichne() {
    const laeuft = !audio.paused && !!richtung;
    knopf.classList.toggle("spielt", laeuft);
    knopf.setAttribute("aria-expanded", String(!panel.classList.contains("versteckt")));
    const l = lied();
    panel.innerHTML = `
      <div class="musik-kopf"><b>🎵 Hintergrundmusik</b><button class="icon-btn klein" data-zu aria-label="Schließen">✕</button></div>
      ${richtungen.length ? `
        <div class="musik-richtungen">
          <button class="musik-richtung ${!richtung ? "aktiv" : ""}" data-richtung="aus">🔇 Aus</button>
          ${richtungen.map((r) => `<button class="musik-richtung ${richtung?.id === r.id ? "aktiv" : ""}" data-richtung="${esc(r.id)}">${r.symbol} ${esc(r.name)} <span>${r.titel.length}</span></button>`).join("")}
        </div>
        ${richtung ? `
          <div class="musik-titel">
            <span class="wellen ${laeuft ? "an" : ""}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span class="musik-name" title="${esc(l?.name || "")}">${esc(l?.name || "")}</span>
            <span class="musik-nr">${pos + 1}/${reihenfolge.length}</span>
          </div>
          <div class="musik-steuerung">
            <button class="icon-btn" data-musik="zurueck" aria-label="Vorheriges Lied">⏮</button>
            <button class="icon-btn gross" data-musik="pause" aria-label="${laeuft ? "Pause" : "Abspielen"}">${laeuft ? "⏸" : "▶"}</button>
            <button class="icon-btn" data-musik="weiter" aria-label="Nächstes Lied">⏭</button>
            <button class="icon-btn ${zufall ? "an" : ""}" data-musik="zufall" aria-label="Zufallswiedergabe" title="Zufallswiedergabe">🔀</button>
          </div>` : ""}
        <label class="musik-lautstaerke">
          <span aria-hidden="true">${lautstaerke == 0 ? "🔇" : lautstaerke < 50 ? "🔉" : "🔊"}</span>
          <input type="range" min="0" max="100" step="1" value="${lautstaerke}" id="musikRegler" aria-label="Lautstärke der Musik" />
          <span class="musik-prozent">${Math.round(lautstaerke)}%</span>
        </label>`
      : `<p class="leise klein-text">Noch keine Lieder hochgeladen. Lege Musik in den Ordner <b>public/musik/jazz</b>, dann erscheint sie hier.</p>`}`;

    $("[data-zu]", panel).onclick = () => schliessen();
    $$("[data-richtung]", panel).forEach((b) => (b.onclick = () => { Ton.klick(); waehleRichtung(b.dataset.richtung); }));
    $$("[data-musik]", panel).forEach((b) => (b.onclick = () => {
      const was = b.dataset.musik;
      if (was === "pause") audio.paused ? spiele() : audio.pause();
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
    if (r) r.oninput = () => {
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

  // Lieder laden; die zuletzt gewählte Richtung wird erst nach einem Klick gestartet (Browser-Regel)
  fetch("/api/musik").then((r) => r.json()).then((d) => {
    richtungen = d.richtungen || [];
    knopf.classList.toggle("ohne-musik", !richtungen.length);
    const letzte = GN.speicher("musikRichtung");
    if (letzte && letzte !== "aus" && richtungen.some((r) => r.id === letzte)) {
      knopf.classList.add("wartet");
      document.addEventListener("pointerdown", function start() {
        document.removeEventListener("pointerdown", start);
        knopf.classList.remove("wartet");
        if (!richtung) waehleRichtung(letzte);
      });
    }
    zeichne();
  }).catch(() => {});
})();
