// =============================================================
//  Schechingen – Hof & Handel: Browser-Teil
//  Sechseck-Karte als SVG, Bauen per Antippen, Hand, Handel, Dorfplatz
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const ROH = ["holz", "stein", "korn", "milch"];
  const ROH_INFO = { holz: ["Holz", "🪵"], stein: ["Stein", "🪨"], korn: ["Korn", "🌾"], milch: ["Milch", "🥛"] };
  const LAND = {
    wald: { name: "Wald", icon: "🌲", farbe: ["#3f9a58", "#235f36"] },
    feld: { name: "Feld", icon: "🌾", farbe: ["#f2cf5b", "#c99a24"] },
    weide: { name: "Weide", icon: "🐄", farbe: ["#a6de7c", "#5fae45"] },
    steinbruch: { name: "Steinbruch", icon: "⛏️", farbe: ["#b9c0c8", "#7d8791"] },
    dorfplatz: { name: "Dorfplatz", icon: "⛪", farbe: ["#ecd0a6", "#c79e6a"] },
  };
  const KARTEN = {
    feldhueter: ["Feldhüter", "👮", "Schick das Gewitter weiter und nimm jemandem eine Karte ab. Auch vor dem Würfeln."],
    erntedank: ["Erntedank", "🧺", "Nimm dir 2 Rohstoffe deiner Wahl."],
    wegebau: ["Wegebau", "🛤️", "Baue 2 Wege gratis."],
    viehmarkt: ["Viehmarkt", "🐮", "Jeder andere gibt dir 1 Karte des Rohstoffs, den du wählst."],
  };
  const S = 58; // Pixel pro Sechseck-Radius
  let hand = { roh: { holz: 0, stein: 0, korn: 0, milch: 0 }, karten: [], neu: [], kirchweih: 0 };
  let modus = null; // "hof" | "weg" | "gut" | null
  let auswahl = null; // Kartenwahl (Erntedank/Viehmarkt)
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
    if (GN.zustand?.spiel === "schechingen" && GN.ansicht === "schechingen-spiel") seite(GN.zustand);
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
        </div><p class="leise klein-text" style="margin-top:8px">2 bis 4 Spieler. Alleine spielst du gegen Computer.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "Bauen, handeln, Dorfplatz",
        html: `<ol class="q-regeln">
          <li><b>Start:</b> Reihum setzt jeder 2 Höfe mit je einem Weg. Der zweite Hof bringt die ersten Rohstoffe.</li>
          <li><b>Würfeln:</b> Jede Landschaft mit der gewürfelten Zahl liefert an alle angrenzenden Höfe (Gutshof: doppelt). 🌲 Holz · ⛏️ Stein · 🌾 Korn · 🐄 Milch.</li>
          <li><b>Jahreszeiten:</b> 🌱 Frühling: Weiden doppelt · ☀️ Sommer: Steinbrüche doppelt · 🍂 Herbst: Felder doppelt · ❄️ Winter: Wälder doppelt, Felder ruhen.</li>
          <li><b>Bauen:</b> Weg ${kostenHTML(meta().kosten.weg)} · Hof (1 Punkt) ${kostenHTML(meta().kosten.hof)} · Gutshof (2 Punkte) ${kostenHTML(meta().kosten.gut)} · Dorfkarte ${kostenHTML(meta().kosten.karte)}. Höfe brauchen Abstand und einen eigenen Weg.</li>
          <li><b>Dorfplatz:</b> Wer dort einen Hof oder Weg hat, darf Brunnen, Wirtshaus, Kirche und Rathaus bauen (je 2 Punkte). Ein Hof direkt am Dorfplatz gibt <b>Marktrecht</b>: 3:1 statt 4:1 tauschen.</li>
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
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (/podest/.test(GN.ansicht)) return;
      if (GN.ansicht !== "schechingen-ende") {
        if (GN.ansicht !== "schechingen-spiel") aufbauen(z);
        GN.ansicht = "schechingen-ende";
        modus = null;
        brett(z); seite(z);
        GN.stoppeTimer();
        const s = z.sieger;
        $("#scEffekt").innerHTML = `<div class="fr-knall gold"><b class="riesig">🏆 ${esc(nameVon(z, s))} ${s === ich() ? "gewinnst" : "gewinnt"}!</b><span>Dorfschultheiß von Schechingen</span></div>`;
        Ton.fanfare(); GN.konfetti(160);
        setTimeout(() => GN.zustand?.phase === "ende" && GN.ansicht === "schechingen-ende" && GN.podest("schechingen-podest", { einheit: "Punkte" }), 3500);
      }
      return;
    }
    if (GN.ansicht !== "schechingen-spiel" || !$(".sc-buehne")) aufbauen(z);
    // Automatische Bau-Modi
    if (istDran(z) && z.phase === "aufbau") modus = z.aufbauSchritt;
    else if (istDran(z) && z.zug?.modus === "wegebau") modus = "weg";
    else if (!istDran(z) || z.zug?.modus || !z.zug?.wurf) modus = null;
    if (z.zug?.modus !== "abwerfen") abwurf = {};
    brett(z);
    seite(z);
    effekte(z, vorher);
    if (!vorher || vorher.dran !== z.dran || vorher.zug?.modus !== z.zug?.modus || vorher.aufbauSchritt !== z.aufbauSchritt || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.zug?.modus === "abwerfen" ? 30000 : Math.max(z.restMs, (z.sekunden || 120) * 1000), { tickAb: 10000, tonAus: () => GN.zustand?.dran !== ich() }); }
      else GN.ohneZeitlimit();
      if (vorher && istDran(z) && vorher.dran !== ich()) { Ton.ding(); navigator.vibrate?.(40); }
    }
  }

  function aufbauen(z) {
    GN.ansicht = "schechingen-spiel";
    GN.stoppeTimer();
    letzteWurfId = z.wurfId; letzterBauT = z.letzterBau?.t || 0; letzterErtragT = z.letzterErtrag?.t || 0; letzterBonusT = z.bonusEreignis?.t || -1;
    app.innerHTML = `
      <div class="sc-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🌾 Schechingen</span>
          <span class="runden-nr" id="scSaison"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="sc-haupt">
          <div class="sc-brett-huelle">
            <svg id="scBrett" class="sc-brett" role="img" aria-label="Spielbrett"></svg>
            <div class="sc-wuerfel" id="scWuerfel"></div>
            <div class="fr-effekt" id="scEffekt" aria-live="polite"></div>
          </div>
          <aside class="sc-seite">
            <div class="sc-leute" id="scLeute"></div>
            <div class="sc-aktion" id="scAktion"></div>
            <div class="sc-hand" id="scHand"></div>
            <div class="sc-bau" id="scBau"></div>
            <details class="sc-log"><summary>📜 Dorfchronik</summary><div id="scLog"></div></details>
          </aside>
        </div>
      </div>`;
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
  const halm = (x, y) => `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-1.5 -4 M${x.toFixed(1)} ${y.toFixed(1)} l0 -5 M${x.toFixed(1)} ${y.toFixed(1)} l1.5 -4" stroke="#4f9a3a" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;

  function landschaft(typ, cx, cy, id) {
    const p = streuen(id * 7 + 3, typ === "wald" ? 10 : typ === "steinbruch" ? 6 : 4);
    const at = (f) => p.map(([x, y, g]) => f(cx + x, cy + y, g)).join("");
    if (typ === "wald") return at(baum);
    if (typ === "steinbruch") return `<path d="M${cx - 40} ${cy - 18} q12 -10 24 -4 q8 -12 22 -6" stroke="#6d757d" stroke-width="3" fill="none" opacity=".5"/>` + at(fels);
    if (typ === "weide") {
      const r = zufall(id * 13 + 1);
      const halme = Array.from({ length: 10 }, () => halm(cx + (r() - 0.5) * 72, cy + (r() - 0.5) * 66)).join("");
      return `${halme}<path d="M${cx - 38} ${cy + 24} L${cx - 12} ${cy + 34} L${cx + 14} ${cy + 32}" stroke="#7a5230" stroke-width="1.8" fill="none"/>${[-38, -25, -12, 1, 14].map((dx, i) => `<rect x="${cx + dx - 1}" y="${cy + 21 + [0, 4, 9, 10, 8][i]}" width="2" height="7" fill="#7a5230"/>`).join("")}${at(tier)}`;
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

  function brett(z) {
    const svg = $("#scBrett");
    if (!svg) return;
    const k = meta().karte;
    const E = k.ecken;
    const xs = E.map((e) => e.x * S), ys = E.map((e) => e.y * S);
    const pad = 34;
    const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
    svg.setAttribute("viewBox", vb.join(" "));
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
      h += `<g class="sc-feld ${klick ? "waehlbar" : ""} ${blockiert ? "blockiert" : ""} ${b.typ}" data-feld="${f.id}">
        <polygon points="${f.ecken.map((e) => pkt(e)).join(" ")}" fill="url(#scG_${b.typ})" class="sc-hex"/>
        <polygon points="${f.ecken.map((e) => pkt(e, 0.9, cx, cy)).join(" ")}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>
        ${landschaft(b.typ, cx, cy, f.id)}`;
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
      if (blockiert) h += wolke(cx, cy - 22);
      h += `</g>`;
    }
    // Wege
    for (const kante of k.kanten) {
      const s = z.wege[kante.id];
      if (s !== undefined) h += strasse(E, kante, farbe(s), z.letzterBau?.art === "weg" && z.letzterBau.ort === kante.id ? "neu" : "");
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
        h += hofModell(x, y, farbe(b.sp), b.typ === "gut", z.letzterBau?.ort === e.id && z.letzterBau.art !== "weg");
        if (modus === "gut" && erlaubt.has(e.id)) h += `<circle cx="${x}" cy="${y}" r="19" class="sc-ziel-ring" data-gut="${e.id}"/>`;
      } else if (modus === "hof" && erlaubt.has(e.id)) h += `<circle cx="${x}" cy="${y}" r="10" class="sc-ziel-punkt eck" data-hof="${e.id}"/>`;
    }
    svg.innerHTML = h;
    // Klicks
    $$("[data-feld]", svg).forEach((g) => g.classList.contains("waehlbar") && (g.onclick = () => { Ton.klick(); GN.aktion("gewitter", { feld: +g.dataset.feld }); }));
    $$("[data-weg]", svg).forEach((g) => (g.onclick = () => { Ton.abgeben(); GN.aktion("bauen", { art: "weg", ort: +g.dataset.weg }); if (z.phase !== "aufbau" && z.zug?.modus !== "wegebau") modus = null; }));
    $$("[data-hof]", svg).forEach((g) => (g.onclick = () => { Ton.abgeben(); GN.aktion("bauen", { art: "hof", ort: +g.dataset.hof }); if (z.phase !== "aufbau") modus = null; }));
    $$("[data-gut]", svg).forEach((g) => (g.onclick = () => { Ton.abgeben(); GN.aktion("bauen", { art: "gut", ort: +g.dataset.gut }); modus = null; }));
  }

  // ---------- Seitenleiste ----------
  function seite(z) {
    const s = meta().saison[z.saison];
    $("#scSaison").innerHTML = `${s.icon} ${s.name} · Runde ${z.runde}`;
    $("#scSaison").title = `${s.name}: ${{ weide: "Weiden", steinbruch: "Steinbrüche", feld: "Felder", wald: "Wälder" }[s.doppelt]} doppelt${s.ruht ? ", Felder ruhen" : ""}`;
    leute(z); aktion(z); handZeigen(z); bauMenue(z);
    $("#scLog").innerHTML = (z.log || []).slice().reverse().map((l) => `<div>${esc(l.text)}</div>`).join("");
  }

  function leute(z) {
    $("#scLeute").innerHTML = (z.teilnehmer || []).map((t) => `
      <div class="sc-person ${t.id === z.dran ? "dran" : ""} ${t.online ? "" : "offline"}" style="--f:${z.farben[t.id]}">
        <span class="sc-ava">${t.avatar}</span>
        <span class="sc-pname">${esc(t.id === ich() ? "Du" : t.name)}${z.kurs[t.id] === 3 ? ' <span title="Marktrecht 3:1">⚖️</span>' : ""}</span>
        <span class="sc-pinfo" title="Rohstoffkarten / Dorfkarten / Weglänge">🂠 ${z.karten[t.id]}${z.dorfkarten[t.id] ? ` · 🃏 ${z.dorfkarten[t.id]}` : ""} · <span class="${z.laengsterWeg === t.id ? "sc-bonus" : ""}" title="${z.laengsterWeg === t.id ? "Längster Weg: +2 Punkte" : "Längste Wegstrecke (ab 5 gibt es den Längsten Weg)"}">🛤️ ${z.wegLaengen?.[t.id] || 0}</span>${z.wache?.[t.id] ? ` · <span class="${z.feldwache === t.id ? "sc-bonus" : ""}" title="${z.feldwache === t.id ? "Stärkste Feldwache: +2 Punkte" : "Gespielte Feldhüter (ab 3: Stärkste Feldwache)"}">👮 ${z.wache[t.id]}</span>` : ""}</span>
        <b class="sc-punkte" title="Punkte">${z.punkteOffen[t.id] + (t.id === ich() && z.phase !== "ende" ? hand.kirchweih || 0 : 0)}<small>/${z.ziel}</small></b>
      </div>`).join("");
  }

  function aktion(z) {
    const box = $("#scAktion");
    const dran = istDran(z);
    const m = z.zug?.modus;
    const wer = `${person(z, z.dran).avatar} <b>${esc(person(z, z.dran).name)}</b>`;
    let h = "";
    if (z.phase === "ende") h = `<div class="sc-hinweis gold">🏆 ${esc(nameVon(z, z.sieger))} ${z.sieger === ich() ? "gewinnst" : "gewinnt"}!</div>`;
    else if (m === "abwerfen" && z.abwerfen[ich()]) {
      const soll = z.abwerfen[ich()];
      const n = ROH.reduce((a, r) => a + (abwurf[r] || 0), 0);
      h = `<div class="sc-hinweis rot">⛈️ Gewitter! Gib <b>${soll}</b> Karten ab.</div>
        <div class="sc-waehler">${ROH.map((r) => `<div><span>${ROH_INFO[r][1]} ${hand.roh[r]}</span><button class="mini" data-ab="${r}" data-d="-1">−</button><b>${abwurf[r] || 0}</b><button class="mini" data-ab="${r}" data-d="1">+</button></div>`).join("")}</div>
        <button class="btn voll" id="scAbgeben" ${n === soll ? "" : "disabled"}>Abgeben (${n}/${soll})</button>`;
    } else if (m === "abwerfen") h = `<div class="sc-hinweis">⛈️ Gewitter! Warte, bis alle Karten abgegeben haben${GN.wartePunkte()}</div>`;
    else if (!dran) h = `<div class="sc-hinweis">${wer} ist dran${z.phase === "aufbau" ? ` und setzt ${z.aufbauSchritt === "hof" ? "einen Hof" : "einen Weg"}` : ""}${GN.wartePunkte()}</div>`;
    else if (z.phase === "aufbau") h = `<div class="sc-hinweis gold">${z.aufbauSchritt === "hof" ? "🏠 Tippe eine leuchtende Ecke an, um deinen Hof zu setzen." : "🛤️ Setze einen Weg an deinen neuen Hof."}</div>`;
    else if (m === "gewitter") h = `<div class="sc-hinweis gold">⛈️ Tippe ein Feld an, auf das das Gewitter zieht.</div>`;
    else if (m === "stehlen") h = `<div class="sc-hinweis gold">Wem nimmst du eine Karte ab?</div><div class="sc-knoepfe">${z.zug.opfer.map((o) => `<button class="btn klein" data-stehlen="${o}">${person(z, o).avatar} ${esc(person(z, o).name)}</button>`).join("")}</div>`;
    else if (m === "wegebau") h = `<div class="sc-hinweis gold">🛤️ Baue noch ${z.zug.gratisWege} ${z.zug.gratisWege === 1 ? "Weg" : "Wege"} gratis.</div>`;
    else if (!z.zug?.wurf) h = `<button class="btn gross voll" id="scWuerfeln">🎲 Würfeln</button>`;
    else h = `<div class="sc-knoepfe">${modus ? `<button class="btn zweit" id="scAbbrechen">✕ ${{ hof: "Hof", weg: "Weg", gut: "Gutshof" }[modus]} abbrechen</button>` : ""}<button class="btn voll" id="scFertig">✓ Zug beenden</button></div>${modus ? `<div class="leise klein-text">Tippe auf dem Brett einen leuchtenden Platz an.</div>` : ""}`;
    // Tauschangebot eines anderen
    const a = z.angebot;
    if (a && a.von !== ich() && z.phase === "spielen") {
      const kann = Object.entries(a.will).every(([r, n]) => hand.roh[r] >= n);
      const abgelehnt = a.nein.includes(ich());
      h += `<div class="sc-angebot"><div>🤝 <b>${esc(person(z, a.von).name)}</b> bietet: ${tauschText(a.gib)} <br>und möchte: ${tauschText(a.will)}</div>
        ${abgelehnt ? '<span class="leise klein-text">Abgelehnt</span>' : `<div class="sc-knoepfe"><button class="btn klein" id="scAnnehmen" ${kann ? "" : "disabled"}>✓ Annehmen</button><button class="btn klein zweit" id="scAblehnen">✕</button></div>`}</div>`;
    } else if (a && a.von === ich()) {
      h += `<div class="sc-angebot">Dein Angebot: ${tauschText(a.gib)} gegen ${tauschText(a.will)} <br><span class="leise klein-text">${a.nein.length ? `${a.nein.length} abgelehnt · ` : ""}warte auf Antworten</span> <button class="btn klein zweit" id="scZurueck">Zurückziehen</button></div>`;
    }
    box.innerHTML = h;
    $("#scWuerfeln")?.addEventListener("click", () => { $("#scWuerfeln").disabled = true; GN.aktion("wuerfeln"); });
    $("#scFertig")?.addEventListener("click", () => { Ton.klick(); modus = null; GN.aktion("fertig"); });
    $("#scAbbrechen")?.addEventListener("click", () => { modus = null; brett(z); seite(z); });
    $$("[data-stehlen]", box).forEach((b) => (b.onclick = () => GN.aktion("stehlen", { opfer: b.dataset.stehlen })));
    $$("[data-ab]", box).forEach((b) => (b.onclick = () => { const r = b.dataset.ab; abwurf[r] = Math.max(0, Math.min(hand.roh[r], (abwurf[r] || 0) + +b.dataset.d)); aktion(z); }));
    $("#scAbgeben")?.addEventListener("click", () => GN.aktion("abwerfen", abwurf));
    $("#scAnnehmen")?.addEventListener("click", () => GN.aktion("annehmen"));
    $("#scAblehnen")?.addEventListener("click", () => GN.aktion("ablehnen"));
    $("#scZurueck")?.addEventListener("click", () => GN.aktion("zurueckziehen"));
  }
  const tauschText = (o) => ROH.filter((r) => o[r]).map((r) => `${o[r]}${ROH_INFO[r][1]}`).join(" ") || "–";

  function handZeigen(z) {
    const box = $("#scHand");
    const kannSpielen = istDran(z) && z.phase === "spielen" && !z.zug?.modus && !z.zug?.gespielt;
    const karten = hand.karten || [];
    const neu = [...(hand.neu || [])];
    box.innerHTML = `<div class="sc-roh">${ROH.map((r) => `<div class="sc-karte ${r}"><span>${ROH_INFO[r][1]}</span><b>${hand.roh[r]}</b><small>${ROH_INFO[r][0]}</small></div>`).join("")}</div>
      ${karten.length || hand.kirchweih ? `<div class="sc-dorfkarten">${karten.map((k, i) => {
        const frisch = neu.includes(k) && (neu.splice(neu.indexOf(k), 1), true);
        const ok = kannSpielen && !frisch && (k === "feldhueter" || z.zug?.wurf);
        return `<button class="sc-dk" data-dk="${k}" ${ok ? "" : "disabled"} title="${KARTEN[k][2]}${frisch ? " (ab nächstem Zug)" : ""}"><span>${KARTEN[k][1]}</span>${KARTEN[k][0]}</button>`;
      }).join("")}${hand.kirchweih ? `<span class="sc-dk kirchweih" title="Kirchweih: je 1 geheimer Punkt"><span>🎪</span>Kirchweih ×${hand.kirchweih}</span>` : ""}</div>` : ""}
      ${auswahl ? `<div class="sc-wahl"><div>${auswahl.k === "erntedank" ? `Wähle 2 Rohstoffe (${auswahl.wahl.length}/2):` : "Welchen Rohstoff willst du von allen?"}</div><div class="sc-knoepfe">${ROH.map((r) => `<button class="btn klein zweit" data-wahl="${r}">${ROH_INFO[r][1]} ${ROH_INFO[r][0]}</button>`).join("")}<button class="btn klein link" id="scWahlAus">Abbrechen</button></div></div>` : ""}`;
    $$("[data-dk]", box).forEach((b) => (b.onclick = () => {
      const k = b.dataset.dk;
      Ton.klick();
      if (k === "erntedank" || k === "viehmarkt") { auswahl = { k, wahl: [] }; handZeigen(z); return; }
      GN.aktion("spielen", { karte: k });
    }));
    $$("[data-wahl]", box).forEach((b) => (b.onclick = () => {
      auswahl.wahl.push(b.dataset.wahl);
      if (auswahl.k === "viehmarkt") { GN.aktion("spielen", { karte: "viehmarkt", wahl: auswahl.wahl[0] }); auswahl = null; }
      else if (auswahl.wahl.length === 2) { GN.aktion("spielen", { karte: "erntedank", wahl: auswahl.wahl }); auswahl = null; }
      handZeigen(z);
    }));
    $("#scWahlAus")?.addEventListener("click", () => { auswahl = null; handZeigen(z); });
  }

  function bauMenue(z) {
    const box = $("#scBau");
    const kann = istDran(z) && z.phase === "spielen" && z.zug?.wurf && !z.zug?.modus;
    if (!kann) { box.innerHTML = ""; return; }
    const k = meta().kosten;
    const knopf = (art, icon, titel, kosten, orte) => `<button class="sc-baukn ${modus === art ? "aktiv" : ""}" data-bau="${art}" ${hat(kosten) && (orte === null || orte.length) ? "" : "disabled"}><span>${icon}</span><b>${titel}</b><em>${kostenHTML(kosten)}</em></button>`;
    const dorf = z.amDorfplatz[ich()];
    const markt = z.kurs[ich()];
    box.innerHTML = `
      <div class="sc-titel">Bauen</div>
      <div class="sc-baugitter">
        ${knopf("weg", "🛤️", "Weg", k.weg, z.moeglich.weg)}
        ${knopf("hof", "🏠", "Hof +1", k.hof, z.moeglich.hof)}
        ${knopf("gut", "🏰", "Gutshof +2", k.gut, z.moeglich.gut)}
        ${knopf("karte", "🃏", `Dorfkarte (${z.stapel})`, k.karte, z.stapel ? null : [])}
      </div>
      <div class="sc-titel">⛪ Dorfplatz ${dorf ? "" : '<small class="leise">(erst mit Hof oder Weg am Dorfplatz)</small>'}</div>
      <div class="sc-baugitter">${Object.entries(meta().gemein).map(([was, g]) => z.gemein[was]
        ? `<div class="sc-baukn fertig" style="--f:${z.farben[z.gemein[was]]}"><span>${g.icon}</span><b>${g.name}</b><em>${esc(nameVon(z, z.gemein[was]))}</em></div>`
        : `<button class="sc-baukn" data-gemein="${was}" ${dorf && hat(g.kosten) ? "" : "disabled"}><span>${g.icon}</span><b>${g.name} +2</b><em>${kostenHTML(g.kosten)}</em></button>`).join("")}</div>
      <details class="sc-handel" ${tausch.offen ? "open" : ""}><summary>⚖️ Handeln</summary>
        <div class="sc-titel">Markt (${markt}:1)</div>
        <div class="sc-markt">
          <select id="scGib">${ROH.map((r) => `<option value="${r}" ${hand.roh[r] >= markt ? "" : "disabled"}>${markt} ${ROH_INFO[r][1]} ${ROH_INFO[r][0]}</option>`).join("")}</select>
          <span>➜</span>
          <select id="scNimm">${ROH.map((r) => `<option value="${r}">1 ${ROH_INFO[r][1]} ${ROH_INFO[r][0]}</option>`).join("")}</select>
          <button class="btn klein" id="scMarkt">Tauschen</button>
        </div>
        ${(z.teilnehmer || []).length > 1 ? `<div class="sc-titel">Mit Mitspielern</div>
        <div class="sc-tausch">${["gib", "will"].map((s) => `<div><small>${s === "gib" ? "Ich gebe" : "Ich möchte"}</small>${ROH.map((r) => `<span class="sc-tz"><button class="mini" data-t="${s}" data-r="${r}" data-d="-1">−</button>${ROH_INFO[r][1]}<b>${tausch[s][r] || 0}</b><button class="mini" data-t="${s}" data-r="${r}" data-d="1">+</button></span>`).join("")}</div>`).join("")}</div>
        <button class="btn klein voll" id="scAnbieten" ${z.angebot ? "disabled" : ""}>🤝 Anbieten</button>` : ""}
      </details>`;
    const gib = $("#scGib");
    const erste = ROH.find((r) => hand.roh[r] >= markt);
    if (erste) gib.value = erste;
    $$("[data-bau]", box).forEach((b) => (b.onclick = () => {
      Ton.klick();
      const art = b.dataset.bau;
      if (art === "karte") { GN.aktion("kaufen"); return; }
      modus = modus === art ? null : art;
      brett(z); seite(z);
      if (modus && matchMedia("(max-width: 900px)").matches) $("#scBrett").scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    $$("[data-gemein]", box).forEach((b) => (b.onclick = () => { Ton.abgeben(); GN.aktion("gemein", { was: b.dataset.gemein }); }));
    $("#scMarkt").onclick = () => GN.aktion("markt", { gib: $("#scGib").value, nimm: $("#scNimm").value });
    $(".sc-handel", box).ontoggle = (e) => { tausch.offen = e.target.open; };
    $$("[data-t]", box).forEach((b) => (b.onclick = () => {
      const s = b.dataset.t, r = b.dataset.r;
      const max = s === "gib" ? hand.roh[r] : 9;
      tausch[s][r] = Math.max(0, Math.min(max, (tausch[s][r] || 0) + +b.dataset.d));
      bauMenue(z);
    }));
    $("#scAnbieten")?.addEventListener("click", () => { GN.aktion("angebot", { gib: tausch.gib, will: tausch.will }); tausch = { gib: {}, will: {}, offen: true }; });
  }

  // ---------- Effekte ----------
  function effekte(z, vorher) {
    // Würfel
    const box = $("#scWuerfel");
    const w = z.zug?.wurf;
    const FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    if (w) {
      const neu = z.wurfId !== letzteWurfId;
      box.innerHTML = `<span class="sc-w ${neu ? "rollt" : ""}">${FACE[w[0]]}</span><span class="sc-w ${neu ? "rollt" : ""}">${FACE[w[1]]}</span><b class="${w[0] + w[1] === 7 ? "sieben" : ""}">${w[0] + w[1]}</b>`;
      if (neu) { letzteWurfId = z.wurfId; Ton.trommel(0.4); if (w[0] + w[1] === 7) setTimeout(() => { Ton.alarm(); knall("⛈️ Gewitter!", "plus2"); }, 500); }
    } else box.innerHTML = "";
    // Ertrag
    const e = z.letzterErtrag;
    if (e && e.t !== letzterErtragT) {
      letzterErtragT = e.t;
      const mein = e.wer?.[ich()];
      if (mein) setTimeout(() => { knall(`+ ${ROH.filter((r) => mein[r]).map((r) => `${mein[r]}${ROH_INFO[r][1]}`).join(" ")}`, "gold", 1500); Ton.richtig(); }, 600);
    }
    // Längster Weg / Feldwache
    const bo = z.bonusEreignis;
    if (bo && bo.t !== letzterBonusT) {
      const erstes = !letzterBonusT;
      letzterBonusT = bo.t;
      if (!erstes) { knall(`${bo.art === "weg" ? "🛤️ Längster Weg" : "👮 Stärkste Feldwache"}: ${esc(nameVon(z, bo.sp))} +2`, "gold", 2200); Ton.fanfare(); }
    }
    // Bauen
    const b = z.letzterBau;
    if (b && b.t !== letzterBauT) {
      letzterBauT = b.t;
      if (b.art === "gemein") { knall(`${meta().gemein[b.was].icon} ${esc(nameVon(z, b.sp))}: ${meta().gemein[b.was].name}!`, "gold"); Ton.volltreffer(); }
      else if (b.art === "gut") { Ton.volltreffer(); }
      else Ton.klick();
    }
  }
  function knall(html, klasse = "gold", dauer = 1700) {
    const box = $("#scEffekt");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "fr-knall " + klasse; el.innerHTML = `<b>${html}</b>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), dauer);
  }

  GN.spiele.schechingen = {
    icon: "🌾",
    titel: "Schechingen",
    kurz: "Höfe bauen, Rohstoffe tauschen, Dorfschultheiß werden.",
    beschreibung: "Das Aufbauspiel rund um den Dorfplatz von Schechingen: Höfe und Wege bauen, mit Jahreszeiten, Gewittern und Handel. Wer zuerst 10 Punkte hat, gewinnt.",
    tags: ["🗺️ Sechseck-Karte", "⚖️ Handel", "🤖 Gegen Computer", "👥 2–4 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
