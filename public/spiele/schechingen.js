// =============================================================
//  Knaben von Schechingen: Browser-Teil (Spiel-ID bleibt "schechingen")
//  Sechseck-Karte als SVG, Bauen per Antippen, Hand, Handel, Dorfplatz
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const ROH = ["holz", "stein", "stroh", "ziegel", "werkzeug"];
  const ROH_INFO = { holz: ["Holz", "🪵"], stein: ["Stein", "🪨"], stroh: ["Stroh", "🌾"], ziegel: ["Ziegel", "🧱"], werkzeug: ["Werkzeug", "🔨"] };
  const LAND = {
    wald: { name: "Wald", icon: "🌲", farbe: ["#3f9a58", "#235f36"] },
    feld: { name: "Feld", icon: "🌾", farbe: ["#f2cf5b", "#c99a24"] },
    lehmgrube: { name: "Lehmgrube", icon: "🧱", farbe: ["#e39a6a", "#a85a32"] },
    steinbruch: { name: "Steinbruch", icon: "⛏️", farbe: ["#b9c0c8", "#7d8791"] },
    schmiede: { name: "Schmiede", icon: "⚒️", farbe: ["#8f9bb0", "#4d576b"] },
    dorfplatz: { name: "Dorfplatz", icon: "⛪", farbe: ["#ecd0a6", "#c79e6a"] },
  };
  const KARTEN = {
    feldhueter: ["Feldhüter", "👮", "Schick das Gewitter weiter und nimm jemandem eine Karte ab. Auch vor dem Würfeln."],
    erntedank: ["Lieferung", "🚚", "Nimm dir 2 Baustoffe deiner Wahl."],
    wegebau: ["Wegebau", "🛤️", "Baue 2 Wege gratis."],
    viehmarkt: ["Sammelbestellung", "📦", "Jeder andere gibt dir 1 Karte des Baustoffs, den du wählst."],
  };
  const S = 58; // Pixel pro Sechseck-Radius
  let hand = { roh: { holz: 0, stein: 0, stroh: 0, ziegel: 0, werkzeug: 0 }, karten: [], neu: [], kirchweih: 0 };
  let modus = null; // "hof" | "weg" | "gut" | null
  let auswahl = null; // Kartenwahl (Lieferung/Sammelbestellung)
  let abwurf = {};
  let tausch = { gib: {}, will: {} };
  let letzteWurfId = 0, letzterBauT = 0, letzterErtragT = 0, letzterBonusT = 0;

  const meta = () => GN.meta.spiele.schechingen;
  const ich = () => GN.ich;
  const istDran = (z) => z.dran === ich() && z.phase !== "ende";
  const person = (z, id) => (z.teilnehmer || []).find((t) => t.id === id) || { name: "?", avatar: "👤" };
  const nameVon = (z, id) => (id === ich() ? "Du" : person(z, id).name);
  const hat = (k) => Object.entries(k).every(([r, n]) => (hand.roh[r] || 0) >= n);
  const kostenHTML = (k) => Object.entries(k).map(([r, n]) => `<span class="sc-kosten">${n}${ROH_INFO[r][1]}</span>`).join("");

  GN.socket.on("schechingen:hand", (h) => {
    hand = h;
    if (GN.zustand?.spiel === "schechingen" && GN.ansicht === "schechingen-spiel") { dock(GN.zustand); leiste(GN.zustand); dialog(GN.zustand); }
  });

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    return [
      {
        id: "spieler", wichtig: true, icon: "🌾", titel: "Mitspieler & Zeit", info: `${z.spieler.length} + ${e.bots} Computer · ${e.ziel} Punkte zum Sieg`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer</div><div class="segment">${[0, 1, 2, 3].map((n) => `<button data-sc-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n || "Keine"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Punkte zum Sieg</div><div class="segment">${[8, 10, 12].map((n) => `<button data-sc-ziel="${n}" class="${e.ziel === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[60, 120, 180, 0].map((n) => `<button data-sc-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Dorfplatz-Gebäude</div><div class="segment"><button data-sc-geb="1" class="${e.gebaeude !== false ? "aktiv" : ""}" ${dis}>⛪ An</button><button data-sc-geb="0" class="${e.gebaeude === false ? "aktiv" : ""}" ${dis}>Aus</button></div></div>
          <div><div class="unter-titel">Jahreszeiten</div><div class="segment"><button data-sc-jz="1" class="${e.jahreszeiten !== false ? "aktiv" : ""}" ${dis}>🍂 An</button><button data-sc-jz="0" class="${e.jahreszeiten === false ? "aktiv" : ""}" ${dis}>Aus</button></div></div>
        </div><p class="leise klein-text" style="margin-top:8px">2 bis 4 Spieler. Alleine spielst du gegen Computer. Jede Partie hat eine neue, faire Zufallskarte.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "Bauen, handeln, Dorfplatz",
        html: `<ol class="q-regeln">
          <li><b>Start:</b> Reihum setzt jeder 2 Höfe mit je einem Weg. Der zweite Hof bringt die ersten Rohstoffe.</li>
          <li><b>Würfeln:</b> Jede Landschaft mit der gewürfelten Zahl liefert an alle angrenzenden Höfe (Gutshof: doppelt). 🌲 Wald → 🪵 Holz · ⛏️ Steinbruch → 🪨 Stein · 🌾 Feld → 🌾 Stroh · 🟫 Lehmgrube → 🧱 Ziegel · ⚒️ Schmiede → 🔨 Werkzeug.</li>
          <li><b>Jahreszeiten</b> (abschaltbar): 🌱 Frühling: Lehmgruben doppelt · ☀️ Sommer: Felder doppelt · 🍂 Herbst: Schmieden doppelt · ❄️ Winter: Wälder doppelt, Lehmgruben gefrieren.</li>
          <li><b>Bauen:</b> Weg ${kostenHTML(meta().kosten.weg)} · Hof (1 Punkt) ${kostenHTML(meta().kosten.hof)} · Hof zum Gutshof ausbauen (2 Punkte, nur aus einem eigenen Hof) ${kostenHTML(meta().kosten.gut)} · Dorfkarte ${kostenHTML(meta().kosten.karte)}. Höfe brauchen Abstand und einen eigenen Weg.</li>
          <li><b>Dorfplatz:</b> Ein Hof direkt am Dorfplatz gibt <b>Marktrecht</b>: 3:1 statt 4:1 tauschen. Mit den Dorfplatz-Gebäuden (abschaltbar) darf man dort außerdem Brunnen, Wirtshaus, Kirche und Rathaus bauen (je 2 Punkte).</li>
          <li><b>7 = Gewitter:</b> Wer mehr als 8 Karten hat, gibt die Hälfte ab. Dann zieht das Gewitter auf ein Feld (es liefert nichts mehr) und du nimmst jemandem dort eine Karte ab.</li>
          <li><b>Längster Weg:</b> Wer zuerst 5 zusammenhängende Wege hat, bekommt 2 Punkte. Wer danach einen längeren Weg baut, übernimmt sie. Fremde Höfe unterbrechen einen Weg.</li>
          <li><b>Stärkste Feldwache:</b> Wer zuerst 3 Feldhüter ausgespielt hat, bekommt 2 Punkte. Wer mehr ausspielt, übernimmt sie.</li>
          <li>Wer zuerst die nötigen Punkte hat, wird <b>Dorfschultheiß</b>. Kirchweih-Karten zählen heimlich je 1 Punkt.</li>
        </ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-sc-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.scBots })));
    $$("[data-sc-ziel]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ ziel: +b.dataset.scZiel })));
    $$("[data-sc-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.scSek })));
    $$("[data-sc-geb]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ gebaeude: b.dataset.scGeb === "1" })));
    $$("[data-sc-jz]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ jahreszeiten: b.dataset.scJz === "1" })));
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  // =============================================================
  //  Spielansicht: oben Spielerleiste, Mitte großes Brett, unten deine Hand
  //  mit vier Knöpfen. Entscheidungen erscheinen als großes Fenster.
  // =============================================================
  let fenster = null; // "bauen" | "handel" | "dorfplatz" | null
  let angebotGesehen = null;

  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (/podest/.test(GN.ansicht)) return;
      if (GN.ansicht !== "schechingen-ende") {
        if (GN.ansicht !== "schechingen-spiel") aufbauen(z);
        GN.ansicht = "schechingen-ende";
        modus = null; fenster = null; auswahl = null;
        brett(z); leiste(z); dock(z); status(z); dialog(z);
        GN.stoppeTimer();
        const s = z.sieger;
        knall(`🏆 ${esc(nameVon(z, s))} ${s === ich() ? "gewinnst" : "gewinnt"}!<small>Dorfschultheiß von Schechingen</small>`, "gold riesig", 3200);
        Ton.fanfare(); GN.konfetti(180);
        // Kamera zoomt auf den Gewinner, seine Gebäude leuchten nacheinander auf
        setTimeout(() => {
          const svg = $("#scBrett"), teile = $$(`g[data-sp="${s}"]`);
          if (!svg || !teile.length) return;
          const r = svg.getBoundingClientRect();
          const mx = teile.reduce((a, t) => a + t.getBoundingClientRect().left + t.getBoundingClientRect().width / 2, 0) / teile.length - r.left;
          const my = teile.reduce((a, t) => a + t.getBoundingClientRect().top + t.getBoundingClientRect().height / 2, 0) / teile.length - r.top;
          svg.style.transformOrigin = `${mx}px ${my}px`;
          svg.classList.add("sc-sieg-zoom");
          teile.forEach((t, i) => setTimeout(() => { t.classList.add("sc-sieg-leuchten"); Ton.serie(i); }, 300 + i * 260));
        }, 600);
        setTimeout(() => GN.zustand?.phase === "ende" && GN.ansicht === "schechingen-ende" && GN.podest("schechingen-podest", { einheit: "Punkte" }), 3800);
      }
      return;
    }
    if (GN.ansicht !== "schechingen-spiel" || !$(".sc-buehne")) aufbauen(z);
    // Automatische Bau-Modi
    const imIntro = z.phase === "aufbau" && z.introMs > 300;
    if (imIntro) modus = null;
    else if (istDran(z) && z.phase === "aufbau") modus = z.aufbauSchritt;
    else if (istDran(z) && z.zug?.modus === "wegebau") modus = "weg";
    else if (!istDran(z) || z.zug?.modus || !z.zug?.wurf) modus = null;
    if (z.zug?.modus !== "abwerfen") abwurf = {};
    if ((!istDran(z) || z.zug?.modus || z.phase !== "spielen") && fenster !== "dorfplatz") fenster = null;
    euleAktuell = eulePlan(z);
    brett(z); leiste(z); dock(z); status(z); dialog(z); euleZeigen(z);
    effekte(z, vorher);
    if (!vorher || vorher.dran !== z.dran || vorher.zug?.modus !== z.zug?.modus || vorher.aufbauSchritt !== z.aufbauSchritt || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.zug?.modus === "abwerfen" ? 30000 : Math.max(z.restMs, (z.sekunden || 120) * 1000), { tickAb: 10000, tonAus: () => GN.zustand?.dran !== ich() }); }
      else GN.ohneZeitlimit();
    }
    // Du bist dran / neue Jahreszeit
    if (vorher && istDran(z) && (vorher.dran !== ich() || (vorher.introMs > 300 && !imIntro)) && !imIntro) {
      GN.intro({ icon: "🌾", titel: "Du bist dran!", text: z.phase === "aufbau" ? (z.aufbauSchritt === "hof" ? "Setze einen Hof" : "Setze einen Weg") : "Würfle!", dauer: 1100 });
      navigator.vibrate?.(40);
    }
    if (vorher && z.jahreszeiten && vorher.saison !== z.saison && z.phase === "spielen") {
      const s = meta().saison[z.saison];
      setTimeout(() => { knall(`${s.icon} ${s.name}!<small>${SAISON_TEXT[z.saison]}</small>`, "saison", 2400); Ton.wusch(); }, 400);
    }
  }
  const SAISON_TEXT = ["Lehmgruben bringen doppelt Ziegel", "Felder bringen doppelt Stroh", "Schmieden bringen doppelt Werkzeug", "Wälder bringen doppelt Holz, Lehmgruben sind gefroren"];

  function aufbauen(z) {
    GN.euleNeu = () => { const z2 = GN.zustand; if (z2?.spiel === "schechingen") { brett(z2); euleZeigen(z2); } };
    GN.ansicht = "schechingen-spiel";
    GN.stoppeTimer();
    letzteWurfId = z.wurfId; letzterBauT = z.letzterBau?.t || 0; letzterErtragT = z.letzterErtrag?.t || 0; letzterBonusT = z.bonusEreignis?.t || -1;
    app.innerHTML = `
      <div class="sc-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🌾 Knaben von Schechingen</span>
          ${GN.euleKnopf()}
          <span class="runden-nr sc-saison" id="scSaison"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="sc-leiste" id="scLeiste"></div>
        <div class="sc-haupt">
          <div class="sc-brett-huelle" id="scHuelle">
            <svg id="scBrett" class="sc-brett" role="img" aria-label="Spielbrett" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="sc-banner" id="scBanner"></div>
            <div class="sc-wurf" id="scWurf"></div>
            <div class="sc-effekt" id="scEffekt" aria-live="polite"></div>
          </div>
          <aside class="sc-seite">
            <div class="sc-status" id="scStatus"></div>
            <div class="sc-eule" id="scEule"></div>
            <div class="sc-kostenkarte" id="scKosten"></div>
            <details class="sc-log" open><summary>📜 Dorfchronik</summary><div id="scLog"></div></details>
          </aside>
        </div>
        <div class="sc-dock" id="scDock"></div>
        <div class="sc-dialog versteckt" id="scDialog"></div>
      </div>`;
    if (z.phase === "aufbau" && z.introMs > 1500) setTimeout(() => startAnimation(GN.zustand), 0);
  }

  // ---------- Brett (SVG) ----------
  // Farben aufhellen/abdunkeln für Modelle
  const mix = (hex, mitWeiss) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(mitWeiss >= 0 ? v + (255 - v) * mitWeiss : v * (1 + mitWeiss)));
    return `rgb(${c.join(",")})`;
  };
  const zufall = (seed) => { let s = (seed * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  // Streupunkte im Sechseck (nicht über der Zahl in der Mitte)
  function streuen(seed, n, rMin = 22, rMax = 41) {
    const r = zufall(seed), p = [];
    for (let i = 0; i < n * 6 && p.length < n; i++) {
      const w = r() * Math.PI * 2, d = rMin + r() * (rMax - rMin);
      const x = Math.cos(w) * d, y = Math.sin(w) * d * 0.95;
      if (p.every((q) => Math.hypot(q[0] - x, q[1] - y) > 11)) p.push([x, y, r()]);
    }
    return p.sort((a, b) => a[1] - b[1]);
  }
  const baum = (x, y, g) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.85 + g * 0.35).toFixed(2)})"><ellipse cx="0" cy="3" rx="6" ry="2" fill="rgba(0,0,0,.25)"/><rect x="-1.2" y="-1" width="2.4" height="4" fill="#5a3a1c"/><path d="M0 -15 L6.5 -5 L-6.5 -5Z" fill="#2f8a4c"/><path d="M0 -11 L8 0 L-8 0Z" fill="#1f6b38"/><path d="M0 -15 L-3 -10 L0 -10Z" fill="#5fbf7a" opacity=".7"/></g>`;
  const fels = (x, y, g) => { const s = 0.8 + g * 0.6; return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><ellipse cx="0" cy="3" rx="8" ry="2.2" fill="rgba(0,0,0,.25)"/><path d="M-8 3 L-6 -4 L-1 -8 L5 -6 L8 1 L4 4Z" fill="#7d8791"/><path d="M-6 -4 L-1 -8 L5 -6 L1 -2Z" fill="#c9d0d6"/><path d="M1 -2 L5 -6 L8 1 L4 4Z" fill="#5f6871"/></g>`; };
  const tier = (x, y, g) => g > 0.5
    ? `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="0" cy="4" rx="7" ry="1.8" fill="rgba(0,0,0,.2)"/><ellipse cx="0" cy="0" rx="6" ry="4" fill="#fff"/><circle cx="-2" cy="-1" r="1.6" fill="#333"/><circle cx="2.5" cy="1" r="1.3" fill="#333"/><ellipse cx="6.5" cy="-1.5" rx="2.4" ry="2" fill="#f2c7b0"/><rect x="-4" y="3" width="1.3" height="2.5" fill="#333"/><rect x="3" y="3" width="1.3" height="2.5" fill="#333"/></g>`
    : `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="0" cy="4" rx="6" ry="1.6" fill="rgba(0,0,0,.2)"/><circle cx="-2.5" cy="0" r="3" fill="#f8f6ef"/><circle cx="1.5" cy="-1" r="3.3" fill="#f8f6ef"/><circle cx="3.5" cy="1" r="2.6" fill="#f8f6ef"/><circle cx="6" cy="-1" r="1.9" fill="#3a3a3a"/></g>`;
  const apfelbaum = (x, y, g) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.9 + g * 0.3).toFixed(2)})"><ellipse cx="0" cy="4" rx="7" ry="2" fill="rgba(0,0,0,.25)"/><rect x="-1.3" y="-3" width="2.6" height="7" fill="#6b4423"/><circle cx="0" cy="-8" r="7.5" fill="#4f9a3a"/><circle cx="-3" cy="-10" r="4.5" fill="#62b04a"/><circle cx="-3" cy="-7" r="1.4" fill="#e23b2e"/><circle cx="2.5" cy="-10" r="1.4" fill="#e23b2e"/><circle cx="3" cy="-5" r="1.4" fill="#f2b33d"/></g>`;
  const halm = (x, y) => `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-1.5 -4 M${x.toFixed(1)} ${y.toFixed(1)} l0 -5 M${x.toFixed(1)} ${y.toFixed(1)} l1.5 -4" stroke="#4f9a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;

  function landschaft(typ, cx, cy, id) {
    const p = streuen(id * 7 + 3, typ === "wald" ? 10 : typ === "steinbruch" ? 6 : 4);
    const at = (f) => p.map(([x, y, g]) => f(cx + x, cy + y, g)).join("");
    if (typ === "wald") return at(baum);
    if (typ === "steinbruch") return `<path d="M${cx - 40} ${cy - 18} q12 -10 24 -4 q8 -12 22 -6" stroke="#6d757d" stroke-width="3" fill="none" opacity=".5"/>` + at(fels);
    if (typ === "lehmgrube") {
      // Lehmgrube: ausgehobene Grube, Ziegelstapel, kleiner Brennofen
      const stapel = (x, y, g) => {
        const s = (0.8 + g * 0.4).toFixed(2);
        let z = "";
        for (let reihe = 0; reihe < 3; reihe++) for (let k = 0; k < 3 - reihe; k++) z += `<rect x="${-7 + k * 5 + reihe * 2.5}" y="${-reihe * 3}" width="4.6" height="2.6" rx=".4" fill="${["#c0522f", "#a8452a", "#d0643c"][(k + reihe) % 3]}" stroke="#6e2a17" stroke-width=".4"/>`;
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><ellipse cx="0" cy="3.5" rx="9" ry="2" fill="rgba(0,0,0,.25)"/>${z}</g>`;
      };
      return `<ellipse cx="${cx - 10}" cy="${cy + 8}" rx="34" ry="18" fill="#8a4b28" opacity=".55"/><ellipse cx="${cx - 10}" cy="${cy + 6}" rx="26" ry="12" fill="#6e3a1e" opacity=".55"/>
        <path d="M${cx - 30} ${cy + 4} q8 -6 16 0 q8 6 16 0" stroke="#b86a3e" stroke-width="1.5" fill="none" opacity=".7"/>
        <g transform="translate(${cx + 24} ${cy - 16})"><ellipse cx="0" cy="8" rx="11" ry="2.6" fill="rgba(0,0,0,.25)"/><path d="M-9 8 L-9 -2 Q0 -12 9 -2 L9 8Z" fill="#b5653a" stroke="#6e3a1e" stroke-width="1"/><path d="M-4 8 L-4 2 Q0 -2 4 2 L4 8Z" fill="#ffb347"/><rect x="3" y="-14" width="4" height="9" fill="#8a4b28" stroke="#6e3a1e" stroke-width=".8"/><circle cx="6" cy="-18" r="3" fill="#d8d2c8" opacity=".7"/><circle cx="9" cy="-23" r="3.6" fill="#d8d2c8" opacity=".5"/></g>
        ${streuen(id * 11 + 4, 4, 18, 44).map(([x, y, g]) => stapel(cx + x, cy + y, g)).join("")}`;
    }
    if (typ === "schmiede") {
      // Schmiede: Werkstatt mit Esse, Amboss, Funken
      const funke = (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.1" fill="#ffcf3f" class="sc-funke"/>`;
      const r = zufall(id * 17 + 5);
      return `<g transform="translate(${cx - 14} ${cy - 4})">
          <ellipse cx="0" cy="20" rx="30" ry="5" fill="rgba(0,0,0,.25)"/>
          <rect x="-22" y="-2" width="34" height="22" fill="#d8c8a8" stroke="#5a4630" stroke-width="1.2"/>
          <path d="M-26 -1 L-5 -18 L16 -1Z" fill="#5d6b7e" stroke="#2f3846" stroke-width="1.2"/>
          <rect x="4" y="-22" width="6" height="14" fill="#7a6a58" stroke="#3d3024" stroke-width="1"/>
          <circle cx="9" cy="-27" r="3.5" fill="#a9a39a" opacity=".6"/><circle cx="13" cy="-33" r="4.5" fill="#bdb7ae" opacity=".45"/>
          <rect x="-16" y="6" width="12" height="14" fill="#3a2a1c"/><rect x="-14" y="10" width="8" height="10" fill="#ff8a3d" opacity=".85"/>
          <rect x="0" y="6" width="8" height="7" fill="#9fc3e0" stroke="#5a4630" stroke-width=".8"/>
        </g>
        <g transform="translate(${cx + 22} ${cy + 18})"><ellipse cx="0" cy="6" rx="12" ry="2.5" fill="rgba(0,0,0,.25)"/><path d="M-10 -3 L10 -3 L8 0 L4 1 L4 4 L7 6 L-7 6 L-4 4 L-4 1 L-12 0Z" fill="#4a5361" stroke="#22272f" stroke-width=".8"/><path d="M-1 -10 L2 -10 L2 -4 L-1 -4Z" fill="#6b4a2a"/><rect x="-5" y="-13" width="10" height="4" rx="1" fill="#59616e"/></g>
        ${Array.from({ length: 6 }, () => funke(cx + 22 + (r() - 0.5) * 18, cy + 8 - r() * 14)).join("")}`;
    }
    if (typ === "feld") {
      let h = "";
      for (let i = -5; i <= 5; i++) h += `<line x1="${cx - 60}" y1="${cy + i * 9 - 20}" x2="${cx + 60}" y2="${cy + i * 9 + 20}" stroke="#d9a521" stroke-width="3.2" stroke-dasharray="1.5 3.5" stroke-linecap="round"/>`;
      return `<g clip-path="url(#scC${id})">${h}</g><g transform="translate(${cx + 26} ${cy - 24})"><ellipse cx="0" cy="5" rx="7" ry="2" fill="rgba(0,0,0,.25)"/><path d="M-7 5 Q-7 -6 0 -7 Q7 -6 7 5Z" fill="#e9c35a" stroke="#b98a1c" stroke-width="1"/><path d="M-4 0 L4 0 M-5 3 L5 3" stroke="#b98a1c" stroke-width=".8"/></g>`;
    }
    if (typ === "dorfplatz") {
      const r = zufall(99);
      let steine = "";
      for (let y = -50; y < 50; y += 7) for (let x = -50; x < 50; x += 8) steine += `<rect x="${(cx + x + (y / 7) % 2 * 4).toFixed(1)}" y="${cy + y}" width="7" height="6" rx="1.5" fill="${["#d9bd8f", "#cfb183", "#e3c99c"][Math.floor(r() * 3)]}"/>`;
      return `<g clip-path="url(#scC${id})" opacity=".85">${steine}</g>
        <g transform="translate(${cx} ${cy - 6})">
          <ellipse cx="0" cy="18" rx="22" ry="4" fill="rgba(0,0,0,.25)"/>
          <rect x="-16" y="-2" width="22" height="19" fill="#f3ead8" stroke="#8a6a44" stroke-width="1"/>
          <path d="M-19 -1 L-5 -13 L9 -1Z" fill="#b8553a" stroke="#7a3322" stroke-width="1"/>
          <rect x="6" y="-14" width="10" height="31" fill="#efe3cc" stroke="#8a6a44" stroke-width="1"/>
          <path d="M4 -13 L11 -27 L18 -13Z" fill="#9c4430" stroke="#6b2b1d" stroke-width="1"/>
          <path d="M11 -33 v7 M8.5 -30.5 h5" stroke="#d4a93a" stroke-width="1.6"/>
          <circle cx="11" cy="-6" r="2.6" fill="#d4a93a" stroke="#8a6a44" stroke-width=".6"/>
          <path d="M-10 17 v-7 a3 3 0 0 1 6 0 v7Z" fill="#6b4a2b"/>
          <rect x="-14" y="3" width="3" height="4" fill="#7fb6d9"/><rect x="0" y="3" width="3" height="4" fill="#7fb6d9"/>
        </g>
        ${baum(cx - 30, cy + 22, 0.4)}${baum(cx + 31, cy + 20, 0.2)}`;
    }
    return "";
  }

  // Straße als Holzbohlen-Weg im Spielerfarbton
  function strasse(E, kante, farbe, klasse = "") {
    const a = E[kante.a], b = E[kante.b];
    const x1 = a.x * S, y1 = a.y * S, x2 = b.x * S, y2 = b.y * S;
    const L = Math.hypot(x2 - x1, y2 - y1) * 0.78;
    const w = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const planken = [-0.3, -0.1, 0.1, 0.3].map((f) => `<line x1="${(f * L).toFixed(1)}" y1="-4.5" x2="${(f * L).toFixed(1)}" y2="4.5" stroke="${mix(farbe, -0.45)}" stroke-width="1" opacity=".6"/>`).join("");
    return `<g class="sc-strasse ${klasse}" transform="translate(${((x1 + x2) / 2).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)}) rotate(${w.toFixed(1)})">
      <rect x="${(-L / 2).toFixed(1)}" y="-3" width="${L.toFixed(1)}" height="11" rx="4" fill="rgba(0,0,0,.35)"/>
      <rect x="${(-L / 2).toFixed(1)}" y="-6" width="${L.toFixed(1)}" height="12" rx="3.5" fill="${mix(farbe, -0.5)}"/>
      <rect x="${(-L / 2 + 1).toFixed(1)}" y="-5.5" width="${(L - 2).toFixed(1)}" height="9" rx="3" fill="${farbe}"/>
      <rect x="${(-L / 2 + 2).toFixed(1)}" y="-5" width="${(L - 4).toFixed(1)}" height="3" rx="1.5" fill="${mix(farbe, 0.45)}" opacity=".85"/>
      ${planken}
    </g>`;
  }
  // Hof und Gutshof als kleine Modelle
  function hofModell(x, y, farbe, gut, neu) {
    const dach = mix(farbe, -0.45), hell = mix(farbe, 0.3);
    const inhalt = gut
      ? `<ellipse cx="0" cy="10" rx="17" ry="4" fill="rgba(0,0,0,.4)"/>
         <rect x="-15" y="-3" width="18" height="12" fill="${farbe}" stroke="#1d140b" stroke-width="1.4"/>
         <path d="M-17.5 -2 L-6 -12 L5.5 -2Z" fill="${dach}" stroke="#1d140b" stroke-width="1.4" stroke-linejoin="round"/>
         <rect x="3" y="-14" width="10" height="23" fill="${hell}" stroke="#1d140b" stroke-width="1.4"/>
         <path d="M1.5 -13 L8 -22 L14.5 -13Z" fill="${dach}" stroke="#1d140b" stroke-width="1.4" stroke-linejoin="round"/>
         <path d="M8 -22 v-6 l6 2 -6 2" fill="#fff" stroke="#1d140b" stroke-width="1"/>
         <rect x="-8" y="2" width="4.5" height="7" fill="#3a2614"/><rect x="-13" y="1" width="3.5" height="3.5" fill="#ffe9a8" stroke="#1d140b" stroke-width=".6"/>
         <rect x="6.5" y="-8" width="3" height="4" fill="#ffe9a8" stroke="#1d140b" stroke-width=".6"/><rect x="6.5" y="0" width="3" height="4" fill="#ffe9a8" stroke="#1d140b" stroke-width=".6"/>`
      : `<ellipse cx="0" cy="9" rx="12" ry="3.4" fill="rgba(0,0,0,.4)"/>
         <rect x="-8.5" y="-2" width="17" height="11" fill="${farbe}" stroke="#1d140b" stroke-width="1.4"/>
         <rect x="3" y="-13" width="3.5" height="7" fill="#7a4a2a" stroke="#1d140b" stroke-width="1"/>
         <path d="M-11 -1 L0 -11.5 L11 -1Z" fill="${dach}" stroke="#1d140b" stroke-width="1.4" stroke-linejoin="round"/>
         <path d="M-7 -3 L0 -9.5" stroke="${hell}" stroke-width="1.2" opacity=".7"/>
         <rect x="-2" y="2.5" width="4" height="6.5" fill="#3a2614"/><rect x="-6.5" y="1.5" width="3" height="3" fill="#ffe9a8" stroke="#1d140b" stroke-width=".6"/><rect x="3.5" y="1.5" width="3" height="3" fill="#ffe9a8" stroke="#1d140b" stroke-width=".6"/>`;
    return `<g class="sc-bau-g ${neu ? "neu" : ""}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${inhalt}</g>`;
  }
  const wolke = (x, y) => `<g class="sc-gewitter-g" transform="translate(${x} ${y})">
      <path d="M-4 6 L-8 16 L-3 15 L-6 24 L4 11 L-1 12 L2 6Z" fill="#ffd93b" stroke="#a6790a" stroke-width=".8" class="sc-blitz"/>
      <g fill="#59616e"><circle cx="-11" cy="0" r="8"/><circle cx="0" cy="-5" r="11"/><circle cx="12" cy="0" r="8"/><rect x="-11" y="0" width="23" height="8" rx="4"/></g>
      <g fill="#8a93a0"><circle cx="-3" cy="-8" r="6"/><circle cx="-12" cy="-2" r="4"/></g>
      <path d="M-12 12 l-2 6 M8 12 l-2 6 M14 10 l-2 6" stroke="#9cc7ff" stroke-width="1.6" stroke-linecap="round" class="sc-regen"/>
    </g>`;

  let feldOrdnung = null;
  const FELD_ORDNUNG = () => (feldOrdnung ||= new Map([...meta().karte.felder].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x)).map((f, i) => [f.id, i])));
  const LAND_ROH = { wald: "holz", steinbruch: "stein", feld: "stroh", lehmgrube: "ziegel", schmiede: "werkzeug" };
  function brett(z) {
    const svg = $("#scBrett");
    if (!svg) return;
    const k = meta().karte;
    const E = k.ecken;
    const xs = E.map((e) => e.x * S), ys = E.map((e) => e.y * S);
    const pad = 34;
    const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
    svg.setAttribute("viewBox", vb.join(" "));
    svg.classList.toggle("sc-intro", Date.now() < introBis);
    const farbe = (id) => z.farben?.[id] || "#999";
    const dran = istDran(z);
    const gewitterWahl = dran && z.zug?.modus === "gewitter";
    const erlaubt = new Set(modus && dran ? z.moeglich?.[modus] || [] : []);
    const pkt = (e, f = 1, cx = 0, cy = 0) => `${(cx + (E[e].x * S - cx) * f).toFixed(1)},${(cy + (E[e].y * S - cy) * f).toFixed(1)}`;
    let h = `<defs>${Object.entries(LAND).map(([t, l]) => `<radialGradient id="scG_${t}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${l.farbe[0]}"/><stop offset="1" stop-color="${l.farbe[1]}"/></radialGradient>`).join("")}
      <pattern id="scWellen" width="40" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 q10 -7 20 0 t20 0" stroke="rgba(255,255,255,.13)" stroke-width="2" fill="none"/></pattern>
      <radialGradient id="scSand" cx="50%" cy="50%" r="60%"><stop offset=".8" stop-color="#ead6a0"/><stop offset="1" stop-color="#c9ad6e"/></radialGradient>
      ${k.felder.map((f) => `<clipPath id="scC${f.id}"><polygon points="${f.ecken.map((e) => pkt(e)).join(" ")}"/></clipPath>`).join("")}</defs>
      <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#scWellen)"/>`;
    // Küste (Sand, etwas größer als die Felder)
    for (const f of k.felder) h += `<polygon points="${f.ecken.map((e) => pkt(e, 1.2, f.x * S, f.y * S)).join(" ")}" fill="url(#scSand)"/>`;
    for (const f of k.felder) h += `<polygon points="${f.ecken.map((e) => pkt(e, 1.06, f.x * S, f.y * S)).join(" ")}" fill="#d8c08a"/>`;
    // Landschaften
    for (const f of k.felder) {
      const b = z.belegung[f.id];
      const cx = f.x * S, cy = f.y * S;
      const klick = gewitterWahl && f.id !== z.gewitter;
      const blockiert = f.id === z.gewitter && b.typ !== "dorfplatz";
      // Jahreszeit: im Winter ist die Lehmgrube gefroren, eine Landschaft bringt doppelt
      const saison = z.jahreszeiten ? meta().saison[z.saison] : {};
      const ruht = saison.ruht === b.typ, doppelt = saison.doppelt === b.typ;
      h += `<g class="sc-feld ${klick ? "waehlbar" : ""} ${blockiert ? "blockiert" : ""} ${ruht ? "ruht" : ""} ${b.typ}" data-feld="${f.id}" style="--i:${FELD_ORDNUNG().get(f.id)}">
        <polygon points="${f.ecken.map((e) => pkt(e)).join(" ")}" fill="url(#scG_${b.typ})" class="sc-hex"/>
        <polygon points="${f.ecken.map((e) => pkt(e, 0.9, cx, cy)).join(" ")}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>
        ${landschaft(b.typ, cx, cy, f.id)}
        <title>${b.typ === "dorfplatz" ? "Dorfplatz: liefert nichts, Hof daneben = Marktrecht 3:1" : blockiert ? "⛈️ Gewitter: Dieses Feld liefert nichts, bis das Gewitter weiterzieht (bei einer 7 oder mit dem Feldhüter)." : ruht ? `${saison.icon} ${saison.name}: ${LAND[b.typ].name} ruht und liefert diese Jahreszeit nichts.` : `${LAND[b.typ].name}: liefert ${ROH_INFO[LAND_ROH[b.typ]][0]} bei einer ${b.zahl} (${Math.round((pipsVon(b.zahl) / 36) * 100)} % pro Wurf)${doppelt ? ` – im ${saison.name} doppelt!` : ""}`}</title>
        ${b.typ !== "dorfplatz" ? `<g class="sc-abz"><rect x="${cx - 17}" y="${cy - 45}" width="34" height="19" rx="9.5" fill="rgba(255,250,235,.92)" stroke="${LAND[b.typ].farbe[1]}" stroke-width="2"/><text x="${cx}" y="${cy - 31}">${ROH_INFO[LAND_ROH[b.typ]][1]}</text></g>` : ""}`;
      if (b.zahl) {
        const rot = b.zahl === 6 || b.zahl === 8;
        const punkte = 6 - Math.abs(7 - b.zahl);
        h += `<g class="sc-marke"><ellipse cx="${cx}" cy="${cy + 3}" rx="15" ry="14" fill="rgba(0,0,0,.35)"/><circle cx="${cx}" cy="${cy}" r="15" class="sc-zahl-kreis"/><circle cx="${cx}" cy="${cy}" r="12.5" fill="none" stroke="#d8c08a" stroke-width="1"/>
          <text x="${cx}" y="${cy + 4}" class="sc-zahl ${rot ? "rot" : ""}">${b.zahl}</text>
          ${Array.from({ length: punkte }, (_, i) => `<circle cx="${cx - (punkte - 1) * 2 + i * 4}" cy="${cy + 9}" r="1.2" class="sc-pip ${rot ? "rot" : ""}"/>`).join("")}</g>`;
      } else {
        h += `<g class="sc-schild"><rect x="${cx - 28}" y="${cy + 27}" width="56" height="12" rx="3" fill="#6b4a2b" stroke="#3e2a17"/><text x="${cx}" y="${cy + 36}" class="sc-dorfname">Schechingen</text></g>`;
        const g = Object.entries(z.gemein).filter(([, s]) => s);
        g.forEach(([was, s]) => { const i = Object.keys(meta().gemein).indexOf(was); const w = (Math.PI * 2 * i) / 4 + Math.PI / 4; h += `<g class="sc-gemein"><circle cx="${cx + Math.cos(w) * 33}" cy="${cy + Math.sin(w) * 28}" r="10" fill="#fff8e6" stroke="${farbe(s)}" stroke-width="3"/><text x="${cx + Math.cos(w) * 33}" y="${cy + Math.sin(w) * 28 + 4}">${meta().gemein[was].icon}</text></g>`; });
      }
      if (blockiert) h += wolke(cx, cy - 22) + `<g class="sc-feldschild gewitter"><rect x="${cx - 34}" y="${cy + 18}" width="68" height="17" rx="8.5"/><text x="${cx}" y="${cy + 30}">⛈️ liefert nichts</text></g>`;
      else if (ruht) h += `<g class="sc-feldschild ruht"><rect x="${cx - 30}" y="${cy + 18}" width="60" height="17" rx="8.5"/><text x="${cx}" y="${cy + 30}">${saison.icon} ruht</text></g>`;
      else if (doppelt && b.zahl) h += `<g class="sc-feldschild doppelt"><rect x="${cx - 16}" y="${cy + 18}" width="32" height="17" rx="8.5"/><text x="${cx}" y="${cy + 30}">×2</text></g>`;
      h += `</g>`;
    }
    // Wege
    for (const kante of k.kanten) {
      const s = z.wege[kante.id];
      // „neu“ nur beim ersten Zeichnen nach dem Bauen, sonst blinkt der Weg bei jeder Aktualisierung erneut
      if (s !== undefined) h += strasse(E, kante, farbe(s), z.letzterBau?.art === "weg" && z.letzterBau.ort === kante.id && z.letzterBau.t !== letzterBauT ? "neu" : "");
      else if (modus === "weg" && erlaubt.has(kante.id)) {
        const mx = ((E[kante.a].x + E[kante.b].x) / 2) * S, my = ((E[kante.a].y + E[kante.b].y) / 2) * S;
        h += `<g class="sc-ziel" data-weg="${kante.id}"><g opacity=".45">${strasse(E, kante, farbe(ich()))}</g><circle cx="${mx}" cy="${my}" r="9" class="sc-ziel-punkt"/></g>`;
      }
    }
    // Höfe und Gutshöfe
    for (const e of E) {
      const b = z.bauten[e.id];
      const x = e.x * S, y = e.y * S;
      if (b) {
        h += `<g data-sp="${b.sp}">${hofModell(x, y, farbe(b.sp), b.typ === "gut", z.letzterBau?.ort === e.id && z.letzterBau.art !== "weg" && z.letzterBau.t !== letzterBauT)}</g>`;
        if (modus === "gut" && erlaubt.has(e.id)) h += `<circle cx="${x}" cy="${y}" r="19" class="sc-ziel-ring" data-gut="${e.id}"/>`;
      } else if (modus === "hof" && erlaubt.has(e.id)) h += `<circle cx="${x}" cy="${y}" r="10" class="sc-ziel-punkt eck" data-hof="${e.id}"/>`;
    }
    // Eulen-Markierungen (nur für dich, wenn die Eule an ist)
    const plan = euleAktuell;
    if (plan) {
      plan.felder.forEach((f) => { const ff = k.felder[f]; h += `<g class="sc-eule-mark"><circle cx="${ff.x * S + 26}" cy="${ff.y * S - 22}" r="13" /><text x="${ff.x * S + 26}" y="${ff.y * S - 17}">🦉</text></g>`; });
      plan.ecken.forEach((e, i) => { h += `<g class="sc-eule-mark ecke"><circle cx="${E[e].x * S}" cy="${E[e].y * S - 24}" r="11"/><text x="${E[e].x * S}" y="${E[e].y * S - 20}">${["①", "②", "③"][i] || "🦉"}</text></g>`; });
      plan.kanten.forEach((kid) => { const kk = k.kanten[kid]; h += `<g class="sc-eule-mark"><circle cx="${((E[kk.a].x + E[kk.b].x) / 2) * S}" cy="${((E[kk.a].y + E[kk.b].y) / 2) * S - 18}" r="11"/><text x="${((E[kk.a].x + E[kk.b].x) / 2) * S}" y="${((E[kk.a].y + E[kk.b].y) / 2) * S - 14}">🦉</text></g>`; });
    }
    svg.innerHTML = h;
    // Klicks
    $$("[data-feld]", svg).forEach((g) => g.classList.contains("waehlbar") && (g.onclick = () => { Ton.klick(); GN.aktion("gewitter", { feld: +g.dataset.feld }); }));
    // Dorfplatz antippen: Erklärung
    const dorf = svg.querySelector(".sc-feld.dorfplatz:not(.waehlbar)");
    if (dorf) { dorf.classList.add("info"); dorf.onclick = () => { Ton.klick(); fenster = "dorfplatz"; dialog(GN.zustand); }; }
    $$("[data-weg]", svg).forEach((g) => (g.onclick = () => { Ton.abgeben(); GN.aktion("bauen", { art: "weg", ort: +g.dataset.weg }); if (z.phase !== "aufbau" && z.zug?.modus !== "wegebau") modus = null; }));
    $$("[data-hof]", svg).forEach((g) => (g.onclick = () => { Ton.abgeben(); GN.aktion("bauen", { art: "hof", ort: +g.dataset.hof }); if (z.phase !== "aufbau") modus = null; }));
    $$("[data-gut]", svg).forEach((g) => (g.onclick = () => { Ton.abgeben(); GN.aktion("bauen", { art: "gut", ort: +g.dataset.gut }); modus = null; }));
  }

  // ---------- Spielerleiste oben ----------
  function leiste(z) {
    const s = meta().saison[z.saison];
    $("#scSaison").innerHTML = z.jahreszeiten ? `${s.icon} ${s.name} · Runde ${z.runde}` : `Runde ${z.runde}`;
    $("#scSaison").title = SAISON_TEXT[z.saison];
    const pk = (id) => z.punkteOffen[id] + (id === ich() && z.phase !== "ende" ? hand.kirchweih || 0 : 0);
    const best = Math.max(...(z.teilnehmer || []).map((t) => pk(t.id)));
    let fuehrt = best > 0 ? (z.teilnehmer || []).filter((t) => pk(t.id) === best).map((t) => t.id) : [];
    if (fuehrt.length === (z.teilnehmer || []).length) fuehrt = []; // alle gleichauf: keine Krone
    $("#scLeiste").innerHTML = (z.teilnehmer || []).map((t) => {
      const p = z.punkteOffen[t.id] + (t.id === ich() && z.phase !== "ende" ? hand.kirchweih || 0 : 0);
      return `<div class="sc-spieler ${t.id === z.dran ? "dran" : ""} ${t.online ? "" : "offline"} ${t.id === ich() ? "ich" : ""}" data-sp="${t.id}" style="--f:${z.farben[t.id]}">
        <span class="sc-ava">${t.avatar}</span>
        <div class="sc-sp-text">
          <b>${esc(t.id === ich() ? "Du" : t.name)}</b>
          <small><span title="Rohstoffkarten">🂠 ${z.karten[t.id]}</span>${z.dorfkarten[t.id] ? `<span title="Dorfkarten">🃏 ${z.dorfkarten[t.id]}</span>` : ""}<span class="${z.laengsterWeg === t.id ? "sc-bonus" : ""}" title="${z.laengsterWeg === t.id ? "Längster Weg (+2)" : "Längste Wegstrecke"}">🛤️ ${z.wegLaengen?.[t.id] || 0}</span>${z.wache?.[t.id] ? `<span class="${z.feldwache === t.id ? "sc-bonus" : ""}" title="Gespielte Feldhüter">👮 ${z.wache[t.id]}</span>` : ""}${z.kurs[t.id] === 3 ? '<span title="Marktrecht 3:1">⚖️</span>' : ""}</small>
        </div>
        <div class="sc-sp-punkte">${fuehrt.includes(t.id) ? '<span class="sc-krone" title="Führt">👑</span>' : ""}<b>${p}</b><small>/${z.ziel}</small><i class="sc-sp-balken"><i style="width:${Math.min(100, (p / z.ziel) * 100)}%"></i></i></div>
      </div>`;
    }).join("");
    // Titel-Tafel als eigene Zeile unter den Spielern
    let tt = $("#scTitel");
    if (!tt) { tt = document.createElement("div"); tt.id = "scTitel"; $("#scLeiste").after(tt); }
    tt.innerHTML = titelTafel(z);
  }
  // Wer hat gerade welchen Titel (+2 Punkte)? Auf einen Blick über dem Brett
  function titelTafel(z) {
    const wer = (id) => id ? `<b style="--f:${z.farben[id]}">${(z.teilnehmer || []).find((t) => t.id === id)?.avatar || ""} ${esc(id === ich() ? "Du" : (z.teilnehmer || []).find((t) => t.id === id)?.name || "?")}</b>` : '<em>noch niemand</em>';
    const titel = [
      ["🛤️", "Längster Weg", z.laengsterWeg, z.laengsterWeg ? `${z.wegLaengen[z.laengsterWeg]} am Stück` : "ab 5 Wegen am Stück"],
      ["👮", "Feldwache", z.feldwache, z.feldwache ? `${z.wache[z.feldwache]} Feldhüter` : "ab 3 Feldhütern"],
      ...(z.gebaeude ? Object.entries(meta().gemein).map(([k, g]) => [g.icon, g.name, z.gemein[k], "am Dorfplatz"]) : []),
    ];
    return `<div class="sc-titel-tafel">${titel.map(([icon, name, id, info]) => `<div class="sc-titel-chip ${id ? "vergeben" : ""}" style="${id ? `--f:${z.farben[id]}` : ""}" title="${name}: +2 Punkte · ${info}"><span>${icon}</span><span><small>${name} <i>+2</i></small>${wer(id)}</span></div>`).join("")}</div>`;
  }

  // ---------- Status rechts: was passiert gerade? ----------
  function status(z) {
    const dran = istDran(z);
    const m = z.zug?.modus;
    const wer = `${person(z, z.dran).avatar} <b>${esc(person(z, z.dran).name)}</b>`;
    let h;
    if (z.phase === "ende") h = `<div class="sc-hinweis gold">🏆 ${esc(nameVon(z, z.sieger))} ${z.sieger === ich() ? "gewinnst" : "gewinnt"}!</div>`;
    else if (z.phase === "aufbau" && z.introMs > 300) h = `<div class="sc-hinweis">🗺️ Die Karte wird gelegt und die Reihenfolge ausgelost${GN.wartePunkte()}</div>`;
    else if (m === "abwerfen") h = `<div class="sc-hinweis rot">⛈️ Gewitter! Wer mehr als 8 Karten hat, gibt die Hälfte ab.</div>`;
    else if (!dran) h = `<div class="sc-hinweis">${wer} ist dran${z.phase === "aufbau" ? ` und setzt ${z.aufbauSchritt === "hof" ? "einen Hof" : "einen Weg"}` : ""}${GN.wartePunkte()}</div>`;
    else if (z.phase === "aufbau") h = `<div class="sc-hinweis gold">${z.aufbauSchritt === "hof" ? "🏠 Tippe eine leuchtende Ecke an: dort entsteht dein Hof. Gute Plätze grenzen an Felder mit 6 und 8." : "🛤️ Setze einen Weg an deinen neuen Hof."}</div>`;
    else if (m === "gewitter") h = `<div class="sc-hinweis gold">⛈️ Tippe ein Feld an, auf das das Gewitter zieht.</div>`;
    else if (m === "wegebau") h = `<div class="sc-hinweis gold">🛤️ Baue noch ${z.zug.gratisWege} ${z.zug.gratisWege === 1 ? "Weg" : "Wege"} gratis.</div>`;
    else if (!z.zug?.wurf) h = `<div class="sc-hinweis gold">🎲 Du bist dran! Würfle zuerst.</div>`;
    else if (modus) h = `<div class="sc-hinweis gold">Tippe auf dem Brett einen leuchtenden Platz an.</div>`;
    else h = `<div class="sc-hinweis">Bauen, handeln oder Zug beenden.</div>`;
    $("#scStatus").innerHTML = h;
    $("#scKosten").innerHTML = `<div class="sc-titel">Was liefert welches Feld?</div>
      ${["wald", "steinbruch", "feld", "lehmgrube", "schmiede"].map((t) => `<div class="sc-legende"><i style="background:linear-gradient(135deg, ${LAND[t].farbe[0]}, ${LAND[t].farbe[1]})"></i><span>${LAND[t].name}</span><b>${ROH_INFO[LAND_ROH[t]][1]} ${ROH_INFO[LAND_ROH[t]][0]}</b></div>`).join("")}
      <div class="sc-legende"><i style="background:linear-gradient(135deg, ${LAND.dorfplatz.farbe[0]}, ${LAND.dorfplatz.farbe[1]})"></i><span>Dorfplatz</span><b>⚖️ Marktrecht</b></div>
      <button class="sc-dorfknopf" id="scDorfInfo">⛪ Was ist der Dorfplatz?</button>`;
    $("#scDorfInfo").onclick = () => { Ton.klick(); fenster = "dorfplatz"; dialog(GN.zustand); };
    $("#scLog").innerHTML = (z.log || []).slice().reverse().map((l) => `<div>${esc(l.text)}</div>`).join("");
  }

  // ---------- Unten: deine Hand und die vier Knöpfe ----------
  function dock(z) {
    const box = $("#scDock");
    const dran = istDran(z) && z.phase === "spielen";
    const m = z.zug?.modus;
    const frei = dran && z.zug?.wurf && !m;
    const karten = hand.karten || [];
    const neu = [...(hand.neu || [])];
    const kannSpielen = dran && !m && !z.zug?.gespielt;
    let knoepfe;
    if (dran && !z.zug?.wurf && !m) knoepfe = `<button class="btn gross sc-k-wurf" id="scWuerfeln">🎲 Würfeln</button>`;
    else if (modus && dran) knoepfe = `<button class="btn zweit" id="scAbbrechen">✕ ${{ hof: "Hof", weg: "Weg", gut: "Ausbau" }[modus]} abbrechen</button>`;
    else knoepfe = `
      ${z.gebaeude ? `<button class="btn sc-k" id="scBauen" ${frei ? "" : "disabled"} title="Gebäude auf dem Dorfplatz">⛪<span>Dorfplatz</span></button>` : ""}
      <button class="btn sc-k" id="scHandeln" ${frei ? "" : "disabled"}>⚖️<span>Handeln</span></button>
      <button class="btn sc-k sc-k-fertig" id="scFertig" ${frei ? "" : "disabled"}>✓<span>Zug beenden</span></button>`;
    box.innerHTML = `
      <div class="sc-hand">
        ${ROH.map((r) => `<div class="sc-karte ${r}" data-roh="${r}"><span class="sc-k-icon">${ROH_INFO[r][1]}</span><b>${hand.roh[r]}</b><small>${ROH_INFO[r][0]}</small></div>`).join("")}
        ${karten.map((k) => {
          const frisch = neu.includes(k) && (neu.splice(neu.indexOf(k), 1), true);
          const ok = kannSpielen && !frisch && (k === "feldhueter" || z.zug?.wurf);
          return `<button class="sc-dk ${ok ? "spielbar" : ""}" data-dk="${k}" ${ok ? "" : "disabled"} title="${KARTEN[k][2]}${frisch ? " (ab deinem nächsten Zug)" : ""}"><span>${KARTEN[k][1]}</span><small>${KARTEN[k][0]}</small></button>`;
        }).join("")}
        ${hand.kirchweih ? `<div class="sc-dk kirchweih" title="Kirchweih: je 1 geheimer Punkt"><span>🎪</span><small>Kirchweih ×${hand.kirchweih}</small></div>` : ""}
      </div>
      <div class="sc-bauleiste">${bauLeiste(z, frei)}</div>
      <div class="sc-knoepfe-dock">${knoepfe}</div>`;
    $$("[data-schnellbau]", box).forEach((b) => (b.onclick = () => {
      const art = b.dataset.schnellbau;
      Ton.klick();
      if (art === "karte") { GN.aktion("kaufen"); return; }
      modus = modus === art ? null : art;
      brett(z); dock(z); status(z); effekte(z, z);
      if (modus && matchMedia("(max-width: 1000px)").matches) $("#scBrett").scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    $("#scWuerfeln")?.addEventListener("click", () => { $("#scWuerfeln").disabled = true; GN.aktion("wuerfeln"); });
    $("#scAbbrechen")?.addEventListener("click", () => { Ton.klick(); modus = null; brett(z); dock(z); status(z); });
    $("#scBauen")?.addEventListener("click", () => { Ton.klick(); fenster = "bauen"; dialog(z); });
    $("#scHandeln")?.addEventListener("click", () => { Ton.klick(); fenster = "handel"; dialog(z); });
    $("#scFertig")?.addEventListener("click", () => { Ton.klick(); modus = null; GN.aktion("fertig"); });
    $$("[data-dk]", box).forEach((b) => (b.onclick = () => {
      const k = b.dataset.dk;
      Ton.klick();
      if (k === "erntedank" || k === "viehmarkt") { auswahl = { k, wahl: [] }; dialog(z); return; }
      GN.aktion("spielen", { karte: k });
    }));
  }

  // Bau-Knöpfe mit Kosten: grün = hast du, rot = fehlt. Leuchtet, wenn du es jetzt bauen kannst.
  function bauLeiste(z, frei) {
    const k = meta().kosten;
    const teile = [["weg", "🛤️", "Weg", k.weg, z.moeglich?.weg], ["hof", "🏠", "Hof", k.hof, z.moeglich?.hof], ["gut", "🏰", "Hof → Gutshof", k.gut, z.moeglich?.gut], ["karte", "🃏", "Karte", k.karte, z.stapel ? null : []]];
    return teile.map(([art, icon, name, kosten, orte]) => {
      const fehlt = Object.entries(kosten).reduce((n, [r, x]) => n + Math.max(0, x - (hand.roh[r] || 0)), 0);
      const platz = orte === null || orte === undefined || orte.length > 0;
      const kann = frei && !fehlt && platz;
      const titel = !fehlt ? (platz ? `${name} bauen` : "Gerade kein freier Platz") : `Dir fehlen noch ${fehlt} Rohstoff${fehlt > 1 ? "e" : ""}`;
      return `<button class="sc-sb ${kann ? "kann" : ""} ${!fehlt ? "bezahlbar" : ""} ${modus === art ? "aktiv" : ""}" data-schnellbau="${art}" ${kann ? "" : "disabled"} title="${titel}">
        <span class="sc-sb-kopf">${icon} ${name}${fehlt ? `<em>−${fehlt}</em>` : ""}</span>
        <span class="sc-sb-kosten">${Object.entries(kosten).flatMap(([r, x]) => Array.from({ length: x }, (_, i) => `<i class="${i < (hand.roh[r] || 0) ? "ok" : "fehlt"}">${ROH_INFO[r][1]}</i>`)).join("")}</span>
      </button>`;
    }).join("");
  }

  // =============================================================
  //  Dorf-Eule: statistische Tipps (optional, jeder Spieler für sich)
  // =============================================================
  const pipsVon = (n) => (n ? 6 - Math.abs(7 - n) : 0);
  let eckeFelder = null;
  const felderAn = (e) => (eckeFelder ||= (() => { const m = {}; for (const f of meta().karte.felder) for (const x of f.ecken) (m[x] ||= []).push(f.id); return m; })())[e] || [];
  function meineRohstoffe(z) {
    const typen = new Set();
    for (const [e, b] of Object.entries(z.bauten)) if (b.sp === ich()) for (const f of felderAn(+e)) { const r = LAND_ROH[z.belegung[f].typ]; if (r) typen.add(r); }
    return typen;
  }
  function eckeWert(z, e, habe) {
    let w = 0;
    const roh = [];
    for (const f of felderAn(e)) {
      const b = z.belegung[f];
      if (b.typ === "dorfplatz") { w += 1.5; continue; }
      const p = pipsVon(b.zahl) * (f === z.gewitter ? 0.3 : 1);
      w += p;
      const r = LAND_ROH[b.typ];
      roh.push(`${ROH_INFO[r][1]}${b.zahl}`);
      if (!habe.has(r)) w += 1.5;
    }
    return { w, roh };
  }
  function einnahmen(z, sp) {
    const e = Object.fromEntries(ROH.map((r) => [r, 0]));
    for (const [ecke, b] of Object.entries(z.bauten)) if (b.sp === sp) for (const f of felderAn(+ecke)) {
      const t = z.belegung[f];
      if (!t.zahl || f === z.gewitter) continue;
      e[LAND_ROH[t.typ]] += (pipsVon(t.zahl) / 36) * (b.typ === "gut" ? 2 : 1);
    }
    return e;
  }
  // Was rät die Eule gerade? { text, ecken:[ids], felder:[ids], kanten:[ids] }
  function eulePlan(z) {
    if (!GN.euleAn() || z.phase === "ende" || (z.phase === "aufbau" && z.introMs > 300)) return null;
    const dran = istDran(z), m = z.zug?.modus;
    const habe = meineRohstoffe(z);
    const plan = { tipps: [], ecken: [], felder: [], kanten: [] };
    const besteEcken = (orte, n = 3) => orte.map((e) => ({ e, ...eckeWert(z, e, habe) })).sort((a, b) => b.w - a.w).slice(0, n);
    if (z.phase === "aufbau") {
      if (!dran) { plan.tipps.push("Wenn du dran bist, zeige ich dir die besten Startplätze."); return plan; }
      if (z.aufbauSchritt === "hof") {
        const top = besteEcken(z.moeglich.hof);
        plan.ecken = top.map((x) => x.e);
        plan.tipps.push(`Die besten Plätze sind mit 🦉 markiert. Platz ① bringt im Schnitt am meisten: ${top[0]?.roh.join(" · ") || ""}.`);
        plan.tipps.push("Achte auf viele verschiedene Rohstoffe und auf 6 und 8 (die fallen am häufigsten).");
      } else {
        // Weg Richtung des besten freien Platzes in der Nähe
        const ziele = z.moeglich.weg.map((k) => {
          const kk = meta().karte.kanten[k];
          const weiter = [kk.a, kk.b].flatMap((x) => [x, ...meta().karte.kanten.filter((q) => q.a === x || q.b === x).flatMap((q) => [q.a, q.b])]);
          const w = Math.max(...weiter.filter((x) => !z.bauten[x]).map((x) => eckeWert(z, x, habe).w));
          return { k, w };
        }).sort((a, b) => b.w - a.w);
        if (ziele[0]) plan.kanten = [ziele[0].k];
        plan.tipps.push("Der markierte Weg zeigt Richtung eines guten freien Platzes für später.");
      }
      return plan;
    }
    const ein = einnahmen(z, ich());
    const proRunde = ROH.filter((r) => ein[r] > 0.001).map((r) => `${ROH_INFO[r][1]} ${(ein[r] * (z.teilnehmer || []).length).toFixed(1)}`).join(" · ");
    const fehlend = ROH.filter((r) => ein[r] < 0.001);
    if (dran && m === "gewitter") {
      let best = null, bw = -1e9;
      z.belegung.forEach((b, f) => {
        if (f === z.gewitter) return;
        let w = 0;
        for (const e of meta().karte.felder[f].ecken) { const bau = z.bauten[e]; if (!bau) continue; const x = pipsVon(b.zahl) * (bau.typ === "gut" ? 2 : 1); w += bau.sp === ich() ? -3 * x - 5 : x + (z.punkteOffen[bau.sp] || 0) * 0.3; }
        if (w > bw) { bw = w; best = f; }
      });
      if (best !== null) plan.felder = [best];
      plan.tipps.push("Das 🦉-Feld trifft deine Gegner am stärksten und dich gar nicht.");
      return plan;
    }
    if (m === "abwerfen" && z.abwerfen?.[ich()]) {
      const ueber = ROH.filter((r) => hand.roh[r] > 0).sort((a, b) => hand.roh[b] - hand.roh[a]);
      plan.tipps.push(`Gib vor allem ab, wovon du viel hast: ${ueber.slice(0, 2).map((r) => ROH_INFO[r][1]).join(" ")}. Behalte, was dir für einen Hof fehlt.`);
      return plan;
    }
    if (!dran) {
      plan.tipps.push(proRunde ? `Pro Runde bekommst du im Schnitt: ${proRunde}.` : "Du bekommst noch nichts – deine Felder haben keine Zahlen oder das Gewitter sitzt drauf.");
      if (fehlend.length) plan.tipps.push(`Dir fehlt eine Quelle für ${fehlend.map((r) => ROH_INFO[r][1] + " " + ROH_INFO[r][0]).join(", ")}. Baue Richtung ${fehlend.map((r) => Object.keys(LAND_ROH).find((t) => LAND_ROH[t] === r)).map((t) => LAND[t].name).join(" oder ")}.`);
      return plan;
    }
    if (!z.zug?.wurf) {
      const zahlen = [...new Set(Object.entries(z.bauten).filter(([, b]) => b.sp === ich()).flatMap(([e]) => felderAn(+e)).filter((f) => f !== z.gewitter).map((f) => z.belegung[f].zahl).filter(Boolean))].sort((a, b) => a - b);
      const p = zahlen.reduce((s, n) => s + pipsVon(n), 0) / 36;
      plan.tipps.push(`Chance, dass du bei diesem Wurf etwas bekommst: <b>${Math.round(p * 100)} %</b> (deine Zahlen: ${zahlen.join(", ") || "keine"}).`);
      if (KARTEN && (hand.karten || []).includes("feldhueter") && meta().karte.felder[z.gewitter].ecken.some((e) => z.bauten[e]?.sp === ich())) plan.tipps.push("Das Gewitter sitzt auf deinem Feld: Spiele jetzt den 👮 Feldhüter, bevor du würfelst!");
      return plan;
    }
    if (m) return plan;
    // Nach dem Wurf: was lohnt sich?
    const kosten = meta().kosten;
    const kann = (c) => Object.entries(c).every(([r, x]) => hand.roh[r] >= x);
    const fehlt = (c) => Object.entries(c).flatMap(([r, x]) => Array(Math.max(0, x - hand.roh[r])).fill(r));
    if (z.moeglich.gut.length && kann(kosten.gut)) {
      const top = besteEcken(z.moeglich.gut, 1);
      plan.ecken = top.map((x) => x.e);
      plan.tipps.push("Baue einen <b>Gutshof</b> (+2, bringt doppelt). Am besten auf dem 🦉-Hof mit den stärksten Zahlen.");
    } else if (z.moeglich.hof.length && kann(kosten.hof)) {
      const top = besteEcken(z.moeglich.hof, 2);
      plan.ecken = top.map((x) => x.e);
      plan.tipps.push(`Baue einen <b>Hof</b> (+1) – der beste Platz ist mit 🦉 markiert (${top[0].roh.join(" · ")}).`);
    } else {
      const ziel = z.moeglich.hof.length ? ["Hof", kosten.hof] : z.moeglich.gut.length ? ["Gutshof", kosten.gut] : ["Weg", kosten.weg];
      const f = fehlt(ziel[1]);
      if (!f.length && ziel[0] === "Weg") plan.tipps.push("Baue Wege Richtung eines freien Platzes, damit du wieder Höfe bauen kannst.");
      else if (f.length) {
        const kurs = z.kurs[ich()];
        const zahler = ROH.filter((r) => hand.roh[r] - (ziel[1][r] || 0) >= kurs);
        if (f.length === 1 && zahler.length) plan.tipps.push(`Für einen ${ziel[0]} fehlt dir nur 1 ${ROH_INFO[f[0]][1]}. Tausche am Markt <b>${kurs}× ${ROH_INFO[zahler[0]][1]} → 1 ${ROH_INFO[f[0]][1]}</b>.`);
        else {
          const ueber = ROH.filter((r) => hand.roh[r] > (ziel[1][r] || 0)).sort((a, b) => hand.roh[b] - hand.roh[a]);
          plan.tipps.push(`Für einen ${ziel[0]} fehlt dir: ${f.map((r) => ROH_INFO[r][1]).join(" ")}.${ueber.length ? ` Biete deinen Mitspielern ${ROH_INFO[ueber[0]][1]} dafür an.` : ""}`);
        }
      }
      if (kann(kosten.karte) && z.stapel && !plan.tipps.length) plan.tipps.push("Kauf eine 🃏 Dorfkarte – Feldhüter helfen gegen das Gewitter und bringen die Stärkste Feldwache.");
    }
    if (fehlend.length) plan.tipps.push(`Du hast keine Quelle für ${fehlend.map((r) => ROH_INFO[r][1]).join(" ")} – plane deine nächsten Höfe dort.`);
    return plan;
  }
  let euleAktuell = null;
  function euleZeigen(z) {
    const box = $("#scEule");
    if (!box) return;
    const an = GN.euleAn();
    box.classList.toggle("versteckt", !an);
    if (!an) return;
    const plan = euleAktuell;
    box.innerHTML = `<div class="sc-eule-kopf"><span>🦉</span><b>Dorf-Eule</b><small>nur du siehst das</small></div>
      ${(plan?.tipps || ["Ich schaue mit. Sobald du etwas entscheiden musst, gebe ich dir einen Tipp."]).map((t) => `<p>${t}</p>`).join("")}`;
  }

  // ---------- Große Fenster in der Mitte ----------
  function dialog(z) {
    const box = $("#scDialog");
    if (!box || !z) return;
    const dran = istDran(z);
    const m = z.zug?.modus;
    const a = z.angebot;
    let h = "", klasse = "";
    const resKnopf = (r, attr, extra = "") => `<button class="sc-res ${r}" ${attr}><span>${ROH_INFO[r][1]}</span><b>${ROH_INFO[r][0]}</b>${extra}</button>`;
    if (z.phase === "ende") h = "";
    else if (m === "abwerfen" && z.abwerfen[ich()]) {
      const soll = z.abwerfen[ich()];
      const n = ROH.reduce((s, r) => s + (abwurf[r] || 0), 0);
      klasse = "rot";
      h = `<h2>⛈️ Gewitter!</h2><p>Du hast zu viele Karten. Tippe <b>${soll}</b> Karten an, die du abgibst.</p>
        <div class="sc-res-reihe">${ROH.map((r) => resKnopf(r, `data-ab="${r}" ${hand.roh[r] - (abwurf[r] || 0) > 0 && n < soll ? "" : "disabled"}`, `<em>${hand.roh[r] - (abwurf[r] || 0)}</em>`)).join("")}</div>
        <div class="sc-chips">${ROH.flatMap((r) => Array(abwurf[r] || 0).fill(r)).map((r) => `<button class="sc-chip" data-ab-weg="${r}">${ROH_INFO[r][1]} ✕</button>`).join("") || '<span class="leise">Noch nichts ausgewählt</span>'}</div>
        <button class="btn gross voll" id="scAbgeben" ${n === soll ? "" : "disabled"}>Abgeben (${n}/${soll})</button>`;
    } else if (dran && m === "stehlen") {
      h = `<h2>🫳 Wem nimmst du eine Karte ab?</h2><p>Du ziehst eine zufällige Karte.</p>
        <div class="sc-opfer">${z.zug.opfer.map((o) => `<button class="sc-opfer-k" data-stehlen="${o}" style="--f:${z.farben[o]}"><span>${person(z, o).avatar}</span><b>${esc(person(z, o).name)}</b><small>🂠 ${z.karten[o]} Karten</small></button>`).join("")}</div>`;
    } else if (auswahl) {
      h = `<h2>${auswahl.k === "erntedank" ? "🚚 Lieferung" : "📦 Sammelbestellung"}</h2>
        <p>${auswahl.k === "erntedank" ? `Wähle 2 Baustoffe (${auswahl.wahl.length}/2).` : "Welchen Baustoff sollen dir alle anderen geben?"}</p>
        <div class="sc-res-reihe">${ROH.map((r) => resKnopf(r, `data-wahl="${r}"`)).join("")}</div>
        ${auswahl.wahl.length ? `<div class="sc-chips">${auswahl.wahl.map((r) => `<span class="sc-chip">${ROH_INFO[r][1]}</span>`).join("")}</div>` : ""}
        <button class="btn link" id="scSchliessen">Abbrechen</button>`;
    } else if (a && a.von !== ich() && !a.nein.includes(ich()) && z.phase === "spielen") {
      const kann = Object.entries(a.will).every(([r, n]) => hand.roh[r] >= n);
      if (angebotGesehen !== a.id) { angebotGesehen = a.id; Ton.ding(); navigator.vibrate?.(60); }
      h = `<h2>🤝 Tauschangebot</h2><p><b>${person(z, a.von).avatar} ${esc(person(z, a.von).name)}</b> möchte mit dir tauschen:</p>
        <div class="sc-tausch-gross"><div><small>Du bekommst</small><div>${tauschIcons(a.gib)}</div></div><span>⇄</span><div><small>Du gibst</small><div>${tauschIcons(a.will)}</div></div></div>
        <div class="sc-knoepfe"><button class="btn gross" id="scAnnehmen" ${kann ? "" : "disabled"}>✓ Annehmen</button><button class="btn gross zweit" id="scAblehnen">✕ Ablehnen</button></div>
        ${kann ? "" : '<p class="leise klein-text">Dafür fehlen dir die Karten.</p>'}`;
    } else if (fenster === "bauen" && dran && z.zug?.wurf && !m) {
      const k = meta().kosten;
      const kn = (art, icon, titel, kosten, orte, text) => {
        const ok = hat(kosten) && (orte === null || orte.length);
        const grund = !hat(kosten) ? "Rohstoffe fehlen" : orte && !orte.length ? "Kein freier Platz" : text;
        return `<button class="sc-bau-gross" data-bau="${art}" ${ok ? "" : "disabled"}><span class="sc-bau-icon">${icon}</span><b>${titel}</b><span class="sc-bau-kosten">${kostenHTML(kosten)}</span><small>${grund}</small></button>`;
      };
      const dorf = z.amDorfplatz[ich()];
      h = `<h2>🔨 Bauen</h2>
        <div class="sc-bau-gitter">
          ${kn("weg", "🛤️", "Weg", k.weg, z.moeglich.weg, "Verbindet deine Höfe")}
          ${kn("hof", "🏠", "Hof · +1", k.hof, z.moeglich.hof, "An deinem Weg, mit Abstand")}
          ${kn("gut", "🏰", "Hof ausbauen · +1", k.gut, z.moeglich.gut, z.moeglich.gut.length ? "Wird zum Gutshof, bringt doppelt" : "Du brauchst erst einen eigenen Hof")}
          ${kn("karte", "🃏", "Dorfkarte", k.karte, z.stapel ? null : [], `${z.stapel} im Stapel`)}
        </div>
        ${z.gebaeude ? `<h3>⛪ Dorfplatz ${dorf ? "" : '<small>(nur mit Hof oder Weg direkt am Dorfplatz)</small>'}</h3>
        <div class="sc-bau-gitter">${Object.entries(meta().gemein).map(([was, g]) => z.gemein[was]
          ? `<div class="sc-bau-gross fertig" style="--f:${z.farben[z.gemein[was]]}"><span class="sc-bau-icon">${g.icon}</span><b>${g.name}</b><small>gebaut von ${esc(nameVon(z, z.gemein[was]))}</small></div>`
          : `<button class="sc-bau-gross" data-gemein="${was}" ${dorf && hat(g.kosten) ? "" : "disabled"}><span class="sc-bau-icon">${g.icon}</span><b>${g.name} · +2</b><span class="sc-bau-kosten">${kostenHTML(g.kosten)}</span></button>`).join("")}</div>` : ""}
        <button class="btn link" id="scSchliessen">Schließen</button>`;
    } else if (fenster === "handel" && dran && z.zug?.wurf && !m) {
      const kurs = z.kurs[ich()];
      const zahler = ROH.filter((r) => hand.roh[r] >= kurs);
      const gib = tausch.gib, will = tausch.will;
      const summe = (o) => ROH.reduce((s, r) => s + (o[r] || 0), 0);
      const mehrere = (z.teilnehmer || []).length > 1;
      h = `<h2>⚖️ Handeln</h2>
        <h3>🏪 Markt · ${kurs} gleiche gegen 1 ${kurs === 3 ? '<small>(Marktrecht!)</small>' : ""}</h3>
        ${zahler.length ? `<div class="sc-markt-liste">${zahler.map((r) => `<div class="sc-markt-zeile"><span>${kurs}× ${ROH_INFO[r][1]} ➜</span>${ROH.filter((x) => x !== r).map((x) => `<button class="sc-res klein ${x}" data-markt="${r}:${x}"><span>${ROH_INFO[x][1]}</span><b>${ROH_INFO[x][0]}</b></button>`).join("")}</div>`).join("")}</div>`
          : `<p class="leise">Du brauchst ${kurs} gleiche Karten für den Markt.</p>`}
        ${mehrere ? `<h3>🤝 Mit Mitspielern</h3>
        ${a && a.von === ich() ? `<div class="sc-angebot-mein">Dein Angebot: ${tauschIcons(a.gib)} gegen ${tauschIcons(a.will)}<br><span class="leise klein-text">${a.nein.length ? `${a.nein.length} abgelehnt · ` : ""}warte auf Antworten${GN.wartePunkte()}</span><button class="btn klein zweit" id="scZurueck">Zurückziehen</button></div>` : `
        <div class="sc-tausch-teil"><small>Ich gebe (tippe deine Karten an)</small>
          <div class="sc-res-reihe klein">${ROH.map((r) => resKnopf(r, `data-gib="${r}" ${hand.roh[r] - (gib[r] || 0) > 0 ? "" : "disabled"}`, `<em>${hand.roh[r] - (gib[r] || 0)}</em>`)).join("")}</div>
          <div class="sc-chips">${ROH.flatMap((r) => Array(gib[r] || 0).fill(r)).map((r) => `<button class="sc-chip" data-gib-weg="${r}">${ROH_INFO[r][1]} ✕</button>`).join("") || '<span class="leise">–</span>'}</div>
        </div>
        <div class="sc-tausch-teil"><small>Ich möchte</small>
          <div class="sc-res-reihe klein">${ROH.map((r) => resKnopf(r, `data-will="${r}"`)).join("")}</div>
          <div class="sc-chips">${ROH.flatMap((r) => Array(will[r] || 0).fill(r)).map((r) => `<button class="sc-chip" data-will-weg="${r}">${ROH_INFO[r][1]} ✕</button>`).join("") || '<span class="leise">–</span>'}</div>
        </div>
        <button class="btn gross voll" id="scAnbieten" ${summe(gib) && summe(will) ? "" : "disabled"}>🤝 Allen anbieten</button>`}` : ""}
        <button class="btn link" id="scSchliessen">Schließen</button>`;
    } else if (fenster === "dorfplatz") {
      const g = meta().gemein;
      h = `<h2>⛪ Der Dorfplatz von Schechingen</h2>
        <p>Die Mitte der Karte bringt keine Rohstoffe, ist aber wertvoll:</p>
        <ul class="sc-liste">
          <li><b>⚖️ Marktrecht:</b> Steht einer deiner Höfe direkt an einer Ecke des Dorfplatzes, tauschst du am Markt <b>3:1</b> statt 4:1.</li>
          <li><b>⛈️ Gewitter:</b> Zu Beginn steht das Gewitter auf dem Dorfplatz, dort schadet es niemandem.</li>
          ${z.gebaeude ? '<li><b>🏛️ Gemeinschaftsbauten:</b> Wer einen Hof oder Weg am Dorfplatz hat, darf dort bauen. Jedes Gebäude gibt es nur einmal und es bringt <b>2 Punkte</b>.</li>' : ""}
        </ul>
        ${z.gebaeude ? `<div class="sc-dorf-liste">${Object.entries(g).map(([was, x]) => `<div><span>${x.icon} ${x.name}</span><span>${kostenHTML(x.kosten)}</span><em>${z.gemein[was] ? `gebaut: ${esc(nameVon(z, z.gemein[was]))}` : "noch frei"}</em></div>`).join("")}</div>` : ""}
        <button class="btn gross voll" id="scSchliessen">Verstanden</button>`;
    }
    box.className = `sc-dialog ${h ? "" : "versteckt"}`;
    if (!h) { box.innerHTML = ""; return; }
    const neu = !box.firstElementChild;
    box.innerHTML = `<div class="sc-dialog-karte ${klasse} ${neu ? "rein" : ""}">${h}</div>`;
    const zu = () => { Ton.klick(); fenster = null; auswahl = null; dialog(GN.zustand); dock(GN.zustand); };
    $("#scSchliessen", box)?.addEventListener("click", zu);
    box.onclick = (ev) => { if (ev.target === box && (fenster || auswahl)) zu(); };
    // Abwerfen
    $$("[data-ab]", box).forEach((b) => (b.onclick = () => { Ton.klick(); abwurf[b.dataset.ab] = (abwurf[b.dataset.ab] || 0) + 1; dialog(z); }));
    $$("[data-ab-weg]", box).forEach((b) => (b.onclick = () => { abwurf[b.dataset.abWeg]--; dialog(z); }));
    $("#scAbgeben", box)?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("abwerfen", abwurf); });
    // Stehlen
    $$("[data-stehlen]", box).forEach((b) => (b.onclick = () => { Ton.wusch(); GN.aktion("stehlen", { opfer: b.dataset.stehlen }); }));
    // Kartenwahl
    $$("[data-wahl]", box).forEach((b) => (b.onclick = () => {
      Ton.klick();
      auswahl.wahl.push(b.dataset.wahl);
      if (auswahl.k === "viehmarkt") { GN.aktion("spielen", { karte: "viehmarkt", wahl: auswahl.wahl[0] }); auswahl = null; }
      else if (auswahl.wahl.length === 2) { GN.aktion("spielen", { karte: "erntedank", wahl: auswahl.wahl }); auswahl = null; }
      dialog(z);
    }));
    // Angebot beantworten
    $("#scAnnehmen", box)?.addEventListener("click", () => { Ton.wusch(); GN.aktion("annehmen"); });
    $("#scAblehnen", box)?.addEventListener("click", () => { Ton.klick(); GN.aktion("ablehnen"); });
    // Bauen
    $$("[data-bau]", box).forEach((b) => (b.onclick = () => {
      Ton.klick();
      const art = b.dataset.bau;
      fenster = null;
      if (art === "karte") GN.aktion("kaufen");
      else modus = art;
      brett(z); dock(z); status(z); dialog(z);
    }));
    $$("[data-gemein]", box).forEach((b) => (b.onclick = () => { Ton.abgeben(); fenster = null; GN.aktion("gemein", { was: b.dataset.gemein }); }));
    // Handel
    $$("[data-markt]", box).forEach((b) => (b.onclick = () => { const [gib, nimm] = b.dataset.markt.split(":"); Ton.wusch(); GN.aktion("markt", { gib, nimm }); }));
    $$("[data-gib]", box).forEach((b) => (b.onclick = () => { Ton.klick(); tausch.gib[b.dataset.gib] = (tausch.gib[b.dataset.gib] || 0) + 1; dialog(z); }));
    $$("[data-will]", box).forEach((b) => (b.onclick = () => { Ton.klick(); tausch.will[b.dataset.will] = (tausch.will[b.dataset.will] || 0) + 1; dialog(z); }));
    $$("[data-gib-weg]", box).forEach((b) => (b.onclick = () => { tausch.gib[b.dataset.gibWeg]--; dialog(z); }));
    $$("[data-will-weg]", box).forEach((b) => (b.onclick = () => { tausch.will[b.dataset.willWeg]--; dialog(z); }));
    $("#scAnbieten", box)?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("angebot", { gib: tausch.gib, will: tausch.will }); tausch = { gib: {}, will: {} }; });
    $("#scZurueck", box)?.addEventListener("click", () => GN.aktion("zurueckziehen"));
  }
  const tauschIcons = (o) => ROH.filter((r) => o[r]).map((r) => `<span class="sc-chip">${o[r]}× ${ROH_INFO[r][1]}</span>`).join(" ") || "–";

  // ---------- Effekte: große Würfel, fliegende Rohstoffe, Ansagen ----------
  const AUGEN = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const DREH = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const wuerfel3d = () => `<div class="w-wuerfel sc-w3"><span class="w-kubus"><span class="w-kern k1"></span><span class="w-kern k2"></span><span class="w-kern k3"></span>${[1, 2, 3, 4, 5, 6].map((n) => `<span class="w-seite s${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${AUGEN[n].includes(i + 1) ? "an" : ""}"></i>`).join("")}</span>`).join("")}</span></div>`;

  function wurfZeigen(z) {
    const box = $("#scWurf");
    const w = z.zug.wurf;
    const sieben = w[0] + w[1] === 7;
    box.className = "sc-wurf gross";
    box.innerHTML = `${wuerfel3d()}${wuerfel3d()}<b class="sc-summe ${sieben ? "sieben" : ""}">${w[0] + w[1]}</b>`;
    const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    $$(".w-kubus", box).forEach((k, i) => {
      const [x, y] = DREH[w[i]];
      k.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
      if (ruhig) return;
      k.animate([
        { transform: `rotateX(${x + 900 + i * 180}deg) rotateY(${y + 720}deg) rotateZ(${200 * (i ? -1 : 1)}deg)` },
        { transform: `rotateX(${x + 40}deg) rotateY(${y - 30}deg) rotateZ(-8deg)`, offset: 0.8 },
        { transform: `rotateX(${x}deg) rotateY(${y}deg)` },
      ], { duration: 1100 + i * 120, easing: "cubic-bezier(.15,.7,.3,1)" });
      k.parentElement.animate([
        { transform: `translate(${i ? 160 : -160}px, -120px) scale(.4)`, opacity: 0 },
        { transform: "translate(0, 10px) scale(1.1)", opacity: 1, offset: 0.55 },
        { transform: "translate(0, -12px)", offset: 0.75 },
        { transform: "none" },
      ], { duration: 1100 + i * 120, easing: "ease-out" });
    });
    Ton.trommel(0.9);
    setTimeout(() => { Ton.klick(); Ton.klick(); }, 700);
    setTimeout(() => { if (sieben) { Ton.alarm(); knall("⛈️ Gewitter zieht auf!", "rot", 2000); } }, 1200);
    clearTimeout(wurfZeigen.t);
    wurfZeigen.t = setTimeout(() => { if ($("#scWurf") === box) box.className = "sc-wurf klein"; }, 2300);
  }

  // Gewonnene Rohstoffe fliegen von der Landschaft zum Spieler (bei dir: in deine Hand)
  function fliegen(von, zielEl, icon, verz, fertig) {
    const zr = zielEl.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "sc-flieger"; el.textContent = icon;
    el.style.left = von.x + "px"; el.style.top = von.y + "px";
    document.body.appendChild(el);
    const dx = zr.left + zr.width / 2 - von.x, dy = zr.top + zr.height / 2 - von.y;
    el.animate([
      { transform: "translate(-50%, -50%) scale(.3)", opacity: 0 },
      { transform: "translate(-50%, -120%) scale(1.5)", opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 1 },
    ], { duration: 950, delay: verz, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" }).onfinish = () => {
      el.remove();
      zielEl.classList.remove("plus"); void zielEl.offsetWidth; zielEl.classList.add("plus");
      fertig?.();
    };
  }
  function bildschirm(x, y) {
    const svg = $("#scBrett");
    const pt = svg.createSVGPoint(); pt.x = x * S; pt.y = y * S;
    return pt.matrixTransform(svg.getScreenCTM());
  }
  function zielFuer(sp, r) { return sp === ich() ? $(`.sc-karte.${r}`) : $(`.sc-spieler[data-sp="${sp}"]`); }
  // Ertrag einer Zahl: für jeden Spieler von seinen Feldern aus
  function ertragFliegen(z, wer, n) {
    if (!$("#scBrett")) return;
    const k = meta().karte;
    let verz = 0;
    for (const [sp, gewinn] of Object.entries(wer)) {
      for (const r of ROH) {
        if (!gewinn[r]) continue;
        const f = k.felder.find((f) => z.belegung[f.id].zahl === n && LAND_ROH[z.belegung[f.id].typ] === r && f.ecken.some((e) => z.bauten[e]?.sp === sp));
        const ziel = zielFuer(sp, r);
        if (!f || !ziel) continue;
        const von = bildschirm(f.x, f.y);
        for (let i = 0; i < gewinn[r]; i++) fliegen(von, ziel, ROH_INFO[r][1], 200 + (verz++) * 120, sp === ich() ? () => Ton.klick() : null);
      }
    }
  }
  // Startrohstoffe: von den Feldern rund um den zweiten Hof zum Spieler
  function startGabeFliegen(z, g) {
    if (!$("#scBrett")) return;
    const k = meta().karte;
    let verz = 0;
    const ecke = k.ecken[g.ecke];
    for (const fid of k.felder.filter((f) => f.ecken.includes(g.ecke)).map((f) => f.id)) {
      const r = LAND_ROH[z.belegung[fid].typ];
      const ziel = r && zielFuer(g.sp, r);
      if (!ziel) continue;
      const f = k.felder[fid];
      fliegen(bildschirm(f.x, f.y), ziel, ROH_INFO[r][1], 300 + (verz++) * 260, () => Ton.klick());
    }
    if (ecke) knall(`🎁 Startrohstoffe<small>${esc(nameVon(z, g.sp))} ${g.sp === ich() ? "bekommst" : "bekommt"} ${ROH.filter((r) => g.roh[r]).map((r) => `${g.roh[r]}× ${ROH_INFO[r][1]}`).join(" ")}</small>`, "gold", 2200);
  }

  // Startanimation: Karte baut sich auf, Zahlen fallen, Reihenfolge wird ausgelost
  function startAnimation(z) {
    const ms = z.introMs;
    if (ms < 1500) return;
    const svg = $("#scBrett");
    svg.classList.add("sc-intro");
    introBis = Date.now() + ms;
    const k = meta().karte;
    const reihe = [...k.felder].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    reihe.forEach((f, i) => setTimeout(() => Ton.klick(), 200 + i * 110));
    knall("🗺️ Die Karte wird gelegt …", "leise", 2300);
    setTimeout(() => { Ton.trommel(0.8); }, 2300);
    // Reihenfolge auslosen
    setTimeout(() => {
      const box = $("#scEffekt");
      if (!box) return;
      const leute = z.teilnehmer || [];
      const el = document.createElement("div");
      el.className = "sc-los";
      el.innerHTML = `<h3>🎲 Wer beginnt?</h3><div class="sc-los-reihe">${leute.map((t, i) => `<div class="sc-los-k" style="--f:${z.farben[t.id]}; --i:${i}"><span class="sc-los-nr">${i + 1}</span><span>${t.avatar}</span><b>${esc(t.id === ich() ? "Du" : t.name)}</b></div>`).join("")}</div>`;
      box.appendChild(el);
      Ton.trommel(1.2);
      setTimeout(() => { Ton.fanfare(); $(".sc-los-k", el)?.classList.add("erster"); }, 1700);
      setTimeout(() => el.remove(), ms - 3400 > 1800 ? ms - 3400 : 1800);
    }, 3200);
    setTimeout(() => { svg.classList.remove("sc-intro"); knall(`🏠 Setzt eure ersten Höfe!<small>Reihum zwei Höfe mit je einem Weg</small>`, "gold", 2000); }, ms);
  }
  let introBis = 0;

  function effekte(z, vorher) {
    // Würfel
    const w = z.zug?.wurf;
    if (w && z.wurfId !== letzteWurfId) { letzteWurfId = z.wurfId; wurfZeigen(z); }
    else if (w && !$("#scWurf .sc-w3")) { const box = $("#scWurf"); box.className = "sc-wurf klein"; box.innerHTML = `${wuerfel3d()}${wuerfel3d()}<b class="sc-summe ${w[0] + w[1] === 7 ? "sieben" : ""}">${w[0] + w[1]}</b>`; $$(".w-kubus", box).forEach((k, i) => { const [x, y] = DREH[w[i]]; k.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`; }); }
    else if (!w) { const box = $("#scWurf"); if (box) { box.className = "sc-wurf"; box.innerHTML = ""; } }
    // Ertrag
    const e = z.letzterErtrag;
    if (e && e.t !== letzterErtragT) {
      letzterErtragT = e.t;
      const mein = e.wer?.[ich()];
      if (Object.keys(e.wer || {}).length) setTimeout(() => { ertragFliegen(z, e.wer, e.n); if (mein) Ton.richtig(); }, 1300);
      else setTimeout(() => knall("Niemand bekommt etwas", "leise", 1300), 1300);
    }
    // Startrohstoffe
    const g = z.startGabe;
    if (g && vorher && vorher.startGabe?.t !== g.t) setTimeout(() => startGabeFliegen(z, g), 400);
    // Längster Weg / Feldwache
    const bo = z.bonusEreignis;
    if (bo && bo.t !== letzterBonusT) {
      const erstes = letzterBonusT === -1 && !vorher;
      letzterBonusT = bo.t;
      if (!erstes) { knall(`${bo.art === "weg" ? "🛤️ Längster Weg" : "👮 Stärkste Feldwache"}<small>${esc(nameVon(z, bo.sp))} +2 Punkte</small>`, "gold", 2600); Ton.fanfare(); }
    }
    // Bauen
    const b = z.letzterBau;
    if (b && b.t !== letzterBauT) {
      letzterBauT = b.t;
      if (b.art === "gemein") { knall(`${meta().gemein[b.was].icon} ${meta().gemein[b.was].name}!<small>${esc(nameVon(z, b.sp))} +2 Punkte</small>`, "gold", 2400); Ton.volltreffer(); GN.konfetti(80); }
      else if (b.art === "gut") { knall(`🏰 Gutshof!<small>${esc(nameVon(z, b.sp))}</small>`, "gold", 1600); Ton.volltreffer(); }
      else if (b.art === "hof") { Ton.aufsteigen(0.3, 1.4); if (b.sp === ich()) knall("🏠 Neuer Hof!", "gold", 1200); }
      else Ton.klick();
      // Staubwolke an der Baustelle; bei anderen Spielern zeigt ein Zeiger, wo gebaut wurde
      setTimeout(() => {
        const neuEl = $(".sc-bau-g.neu, .sc-strasse.neu");
        if (!neuEl) return;
        if (b.art !== "weg") GN.fx?.teilchen(neuEl, null, "staub");
        if (b.sp !== ich()) GN.fx?.flieg($(`.sc-spieler[data-sp="${b.sp}"]`), neuEl, "👆", { dauer: 700 });
      }, 120);
    }
    // Gewitter zieht weiter: Blitz über dem Brett, kurzes Wackeln
    if (vorher && vorher.gewitter !== undefined && vorher.gewitter !== z.gewitter) {
      const brettEl = $("#scBrett");
      brettEl?.classList.remove("sc-blitz-an"); void brettEl?.offsetWidth; brettEl?.classList.add("sc-blitz-an");
      GN.fx?.wackeln(1); Ton.treffer();
    }
    // Dorfkarte gespielt
    const k = z.letzteKarte;
    if (k && vorher && vorher.letzteKarte?.t !== k.t && k.sp !== ich()) { knall(`${KARTEN[k.k]?.[1] || "🃏"} ${esc(person(z, k.sp).name)} spielt ${KARTEN[k.k]?.[0] || "eine Karte"}`, "", 1800); Ton.wusch(); }
    // Gewitter-Hinweis direkt auf dem Brett
    const banner = $("#scBanner");
    if (banner) {
      const zeig = istDran(z) && z.zug?.modus === "gewitter" ? "⛈️ Tippe ein Feld an, auf das das Gewitter zieht"
        : istDran(z) && modus ? { hof: "🏠 Tippe eine leuchtende Ecke an", weg: "🛤️ Tippe einen leuchtenden Weg an", gut: "🏰 Tippe einen deiner Höfe an" }[modus] : "";
      banner.textContent = zeig; banner.classList.toggle("an", !!zeig);
    }
  }
  function knall(html, klasse = "gold", dauer = 1700) {
    const box = $("#scEffekt");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "sc-knall " + klasse; el.innerHTML = `<b>${html}</b>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), dauer);
  }

  GN.spiele.schechingen = {
    icon: "🌾",
    titel: "Knaben von Schechingen",
    kurz: "Höfe bauen, Rohstoffe tauschen, Dorfschultheiß werden.",
    beschreibung: "Das Aufbauspiel rund um den Dorfplatz von Schechingen: Höfe und Wege bauen, mit Jahreszeiten, Gewittern und Handel. Wer zuerst 10 Punkte hat, gewinnt.",
    tags: ["🗺️ Sechseck-Karte", "⚖️ Handel", "🤖 Gegen Computer", "👥 2–4 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
