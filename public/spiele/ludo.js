// =============================================================
//  Raus da! – Browser-Teil
//  Holzbrett in Kreuzform (SVG), glänzende Hütchen, die Feld für Feld hüpfen,
//  3D-Würfel, bewegliche Figuren pulsieren, Rausgeworfene fliegen ins Haus zurück
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const FARBE = { rot: ["#ff5a52", "#c62828"], blau: ["#5aa8ff", "#1565c0"], gruen: ["#5fd36a", "#2e7d32"], gelb: ["#ffe45c", "#f9a825"] };
  const FARBNAME = { rot: "Rot", blau: "Blau", gruen: "Grün", gelb: "Gelb" };
  const FARBEN = ["rot", "blau", "gruen", "gelb"];
  // Laufbahn (40 Felder) im 11 × 11-Raster, beginnt am Startfeld von Platz 0 (links)
  const BAHN = [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
    [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10], [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5]];
  const ZIEL = [[[1, 5], [2, 5], [3, 5], [4, 5]], [[5, 1], [5, 2], [5, 3], [5, 4]], [[9, 5], [8, 5], [7, 5], [6, 5]], [[5, 9], [5, 8], [5, 7], [5, 6]]];
  const HAUS = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[9, 0], [10, 0], [9, 1], [10, 1]], [[9, 9], [10, 9], [9, 10], [10, 10]], [[0, 9], [1, 9], [0, 10], [1, 10]]];
  const feldVon = (slot, rel, k) => (rel < 0 ? HAUS[slot][k] : rel < 40 ? BAHN[(slot * 10 + rel) % 40] : ZIEL[slot][rel - 40]);
  const mitte = ([c, r]) => [c + 0.5, r + 0.5];

  let anzeige = {}; // angezeigte Positionen (laufen den echten hinterher)
  let letzteAktion = 0, letzterWurf = 0, laeuft = 0;

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || { name: "?", avatar: "👤" };
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);
  const farbeVon = (z, id) => FARBEN[z.slot[id]];

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen, dis = host ? "" : "disabled";
    return [
      {
        id: "spieler", wichtig: true, icon: "🤖", titel: "Mitspieler & Regeln", info: `${z.spieler.length} + ${e.bots} Computer`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3].map((n) => `<button data-lu-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[15, 30, 0].map((n) => `<button data-lu-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Schlagzwang</div><div class="segment"><button data-lu-zwang="0" class="${!e.schlagzwang ? "aktiv" : ""}" ${dis}>Aus</button><button data-lu-zwang="1" class="${e.schlagzwang ? "aktiv" : ""}" ${dis}>An</button></div></div>
        </div><p class="leise klein-text" style="margin-top:8px">2 bis 4 Spieler. Freie Plätze füllt der Computer. Mit Schlagzwang musst du schlagen, wenn du kannst.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "Regeln", info: "Klassisch",
        html: `<ol class="q-regeln">
          <li>Jeder hat 4 Figuren im Haus. Mit einer <b>6</b> kommt eine Figur auf dein Startfeld.</li>
          <li>Bei einer 6 darfst du <b>nochmal würfeln</b>. Sind alle Figuren im Haus, hast du <b>3 Versuche</b>.</li>
          <li>Dein Startfeld musst du <b>räumen</b>, solange noch Figuren im Haus sind.</li>
          <li>Landest du auf einer fremden Figur, ist sie <b>raus</b> und muss zurück ins Haus.</li>
          <li>Im Ziel wird genau gezogen und nicht übersprungen. Wer zuerst alle 4 Figuren im Ziel hat, gewinnt.</li></ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-lu-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.luBots })));
    $$("[data-lu-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.luSek })));
    $$("[data-lu-zwang]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ schlagzwang: b.dataset.luZwang === "1" })));
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (!GN.ansicht.startsWith("lu-podest") && GN.ansicht !== "lu-ende") {
        GN.ansicht = "lu-ende";
        const s = z.platzierung?.[0];
        if (s) { GN.fx?.knall(`🏆 ${esc(nameVon(z, s))} ${s === GN.ich ? "gewinnst" : "gewinnt"}!`, 3); Ton.fanfare(); GN.konfetti(180); }
        setTimeout(() => GN.zustand?.phase === "ende" && GN.ansicht === "lu-ende" && GN.podest("lu-podest", { einheit: "Punkte" }), 3200);
      }
      return;
    }
    if (!$(".lu-buehne") || GN.ansicht !== "lu-spiel") aufbauen(z);
    aktualisieren(z, vorher);
  }

  function aufbauen(z) {
    GN.ansicht = "lu-spiel";
    GN.stoppeTimer();
    anzeige = JSON.parse(JSON.stringify(z.figuren));
    letzteAktion = z.letzteAktion?.nr || 0; letzterWurf = z.wurfNr; laeuft = 0;
    app.innerHTML = `
      <div class="lu-buehne">
        <div class="runden-kopf"><span class="modus-badge">🎯 Raus da!</span><span class="runden-nr" id="luInfo"></span><span class="timer-zahl" id="timerZahl"></span></div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="lu-haupt">
          <div class="lu-brett-huelle"><svg class="lu-brett" id="luBrett" viewBox="-0.35 -0.35 11.7 11.7">${brettSvg(z)}<g id="luZiele"></g><g id="luFiguren"></g></svg><div class="lu-knall" id="luKnall"></div></div>
          <div class="lu-seite">
            <div class="lu-leute" id="luLeute"></div>
            <div class="lu-aktion" id="luAktion">
              <div class="lu-w" id="luWuerfel"><div class="lu-w-kubus">${[1, 2, 3, 4, 5, 6].map((s) => `<span class="lu-w-seite s${s}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<i class="${PUNKTE[s].includes(k) ? "an" : ""}"></i>`).join("")}</span>`).join("")}</div></div>
              <div class="lu-ansage" id="luAnsage"></div>
              <button class="btn gross lu-wurf" id="luWuerfeln">🎲 Würfeln</button>
            </div>
            <div class="lu-log" id="luLog"></div>
          </div>
        </div>
      </div>`;
    $("#luWuerfeln").onclick = () => { Ton.klick(); $("#luWuerfeln").disabled = true; GN.aktion("wuerfeln"); };
    wuerfelZeigen(z.wurf || 6, true);
    figurenZeichnen(z, true);
  }

  // Brett: Holz, Laufbahn, Startfelder, Häuser und Zielreihen in den Farben der Plätze
  function brettSvg(z) {
    const belegt = new Set(Object.values(z.slot));
    // Eingelassene Mulden: dunkler Rand oben, Licht unten
    const kreis = ([c, r], fuell, rand = "#3b2a1a", extra = "") => `<g ${extra}><circle cx="${c + 0.5}" cy="${r + 0.5}" r="0.41" fill="${fuell}" stroke="${rand}" stroke-width="0.055"/><circle cx="${c + 0.5}" cy="${r + 0.5}" r="0.38" fill="url(#luMulde)"/></g>`;
    let h = `<defs>
      <radialGradient id="luHolz" cx="50%" cy="42%" r="78%"><stop offset="0" stop-color="#f6dfaf"/><stop offset=".7" stop-color="#e1b877"/><stop offset="1" stop-color="#c99a58"/></radialGradient>
      <linearGradient id="luRahmen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a86f38"/><stop offset=".5" stop-color="#7a4a22"/><stop offset="1" stop-color="#5c3517"/></linearGradient>
      <radialGradient id="luMulde" cx="50%" cy="38%" r="60%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>
      <pattern id="luMaserung" width="3" height="0.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
        <path d="M0 0.3 Q0.75 0.18 1.5 0.3 T3 0.3" fill="none" stroke="#9a6a35" stroke-width="0.025" opacity=".18"/>
        <path d="M0 0.52 Q1 0.44 2 0.54 T3 0.5" fill="none" stroke="#9a6a35" stroke-width="0.015" opacity=".12"/>
      </pattern>
      <filter id="luSchatten" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0.06" stdDeviation="0.05" flood-opacity="0.45"/></filter>
      <filter id="luGluehen" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.12"/></filter>
      ${FARBEN.map((f) => `<radialGradient id="luF_${f}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".25" stop-color="${FARBE[f][0]}"/><stop offset="1" stop-color="${FARBE[f][1]}"/></radialGradient>`).join("")}
    </defs>
    <rect x="-0.32" y="-0.32" width="11.64" height="11.64" rx="0.62" fill="url(#luRahmen)"/>
    <rect x="-0.16" y="-0.16" width="11.32" height="11.32" rx="0.5" fill="url(#luHolz)"/>
    <rect x="-0.16" y="-0.16" width="11.32" height="11.32" rx="0.5" fill="url(#luMaserung)"/>
    <rect x="-0.16" y="-0.16" width="11.32" height="11.32" rx="0.5" fill="none" stroke="#fff6e0" stroke-opacity=".35" stroke-width="0.04"/>`;
    // Ecken mit Hausfarbe; wer dran ist, dessen Haus leuchtet (Klasse wird live gesetzt)
    HAUS.forEach((felder, slot) => {
      const [c, r] = felder[0];
      h += `<rect class="lu-haus-licht" data-slot="${slot}" x="${c - 0.16}" y="${r - 0.16}" width="2.32" height="2.32" rx="0.55" fill="none" stroke="${FARBE[FARBEN[slot]][0]}" stroke-width="0.12" filter="url(#luGluehen)"/>`;
      h += `<rect x="${c - 0.1}" y="${r - 0.1}" width="2.2" height="2.2" rx="0.5" fill="${FARBE[FARBEN[slot]][0]}" opacity="${belegt.has(slot) ? 0.38 : 0.12}"/>`;
    });
    // Verbindungslinien der Laufbahn (eingefräst)
    const linie = BAHN.map((f) => mitte(f).join(",")).join(" ");
    h += `<polygon points="${linie}" fill="none" stroke="#fff3d6" stroke-width="0.13" opacity=".5" transform="translate(0 0.025)"/>`;
    h += `<polygon points="${linie}" fill="none" stroke="#7a5230" stroke-width="0.1" opacity=".55"/>`;
    // Laufrichtung: kleine Pfeile zwischen ausgewählten Feldern
    BAHN.forEach((f, i) => {
      if (i % 10 !== 5) return;
      const [x1, y1] = mitte(f), [x2, y2] = mitte(BAHN[(i + 1) % 40]);
      const w = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      h += `<path d="M-0.1 -0.1 L0.06 0 L-0.1 0.1" fill="none" stroke="#7a5230" stroke-width="0.05" stroke-linecap="round" stroke-linejoin="round" opacity=".7" transform="translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${w})"/>`;
    });
    BAHN.forEach((f, i) => {
      const slot = i % 10 === 0 ? i / 10 : -1;
      h += kreis(f, slot >= 0 ? FARBE[FARBEN[slot]][0] : "#fffaf0", slot >= 0 ? FARBE[FARBEN[slot]][1] : "#3b2a1a", `class="lu-bahn" data-i="${i}"`);
      if (slot >= 0) h += `<text x="${f[0] + 0.5}" y="${f[1] + 0.63}" class="lu-start-pfeil">A</text>`;
    });
    ZIEL.forEach((felder, slot) => felder.forEach((f, k) => (h += kreis(f, FARBE[FARBEN[slot]][0], FARBE[FARBEN[slot]][1], `opacity=".95"`) + `<text x="${f[0] + 0.5}" y="${f[1] + 0.62}" class="lu-ziel-nr">${String.fromCharCode(97 + k)}</text>`)));
    HAUS.forEach((felder, slot) => felder.forEach((f) => (h += kreis(f, "#fffaf0", FARBE[FARBEN[slot]][1]))));
    // Mitte: vier Farbdreiecke treffen sich, darauf ein Medaillon
    const M = 5.5, D = 0.5;
    const ecken = [[[M - D, M - D], [M - D, M + D]], [[M - D, M - D], [M + D, M - D]], [[M + D, M - D], [M + D, M + D]], [[M - D, M + D], [M + D, M + D]]];
    ecken.forEach(([a, b], slot) => (h += `<polygon points="${a.join(",")} ${b.join(",")} ${M},${M}" fill="url(#luF_${FARBEN[slot]})" stroke="#3b2a1a" stroke-width="0.04" opacity="${belegt.has(slot) ? 1 : 0.4}"/>`));
    h += `<circle cx="${M}" cy="${M}" r="0.27" fill="#fffaf0" stroke="#3b2a1a" stroke-width="0.04"/><path d="M${M} ${M - 0.16} L${M + 0.05} ${M - 0.05} L${M + 0.16} ${M - 0.05} L${M + 0.07} ${M + 0.03} L${M + 0.1} ${M + 0.15} L${M} ${M + 0.08} L${M - 0.1} ${M + 0.15} L${M - 0.07} ${M + 0.03} L${M - 0.16} ${M - 0.05} L${M - 0.05} ${M - 0.05}Z" fill="#ffcf3f" stroke="#a8621e" stroke-width="0.02"/>`;
    return h;
  }

  const PUNKTE = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const DREH = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  let wuerfelDrehung = 0;
  function wuerfelZeigen(w, sofort) {
    const el = $("#luWuerfel"), k = $(".lu-w-kubus", el);
    const [x, y] = DREH[w];
    wuerfelDrehung += sofort ? 0 : 720;
    k.style.transition = sofort ? "none" : "transform 0.9s cubic-bezier(.15,.85,.3,1.05)";
    k.style.transform = `rotateX(${x + wuerfelDrehung}deg) rotateY(${y + wuerfelDrehung}deg)`;
    if (!sofort) { el.classList.remove("rollt"); void el.offsetWidth; el.classList.add("rollt"); }
  }

  function aktualisieren(z, vorher) {
    const ich = z.dran === GN.ich;
    const t = person(z, z.dran);
    $("#luInfo").innerHTML = `<span class="lu-punkt" style="--f:${FARBE[farbeVon(z, z.dran)][0]}"></span>${esc(nameVon(z, z.dran))} ${ich ? "bist" : "ist"} dran`;
    // Würfel
    if (z.wurfNr !== letzterWurf && z.wurf) {
      letzterWurf = z.wurfNr;
      Ton.wusch();
      wuerfelZeigen(z.wurf, false);
      setTimeout(() => { Ton.klopf?.(); if (z.wurf === 6) { Ton.serie(); GN.fx?.funken($("#luWuerfel"), { anzahl: 12 }); } }, 900);
    }
    effekte(z);
    figurenZeichnen(z);
    leuteZeichnen(z);
    $$(".lu-haus-licht").forEach((el) => el.classList.toggle("an", +el.dataset.slot === z.slot[z.dran]));
    // Ansage und Würfeln-Knopf
    let ansage = "";
    if (z.schritt === "wuerfeln") ansage = ich ? (z.versuche > 1 ? `<b>Würfle eine 6!</b> Noch ${z.versuche} Versuche` : z.wurf === 6 ? "<b>Eine 6!</b> Nochmal würfeln" : "<b>Du bist dran!</b>") : `${t.avatar} ${esc(t.name)} würfelt${GN.wartePunkte()}`;
    else if (z.schritt === "ziehen") ansage = ich ? (z.moeglich.length > 1 ? "<b>Tippe eine leuchtende Figur an</b>" : "Deine Figur zieht …") : `${t.avatar} ${esc(t.name)} überlegt${GN.wartePunkte()}`;
    else if (z.schritt === "nichts") ansage = `Keine ${z.wurf}-er-Zug möglich`;
    else ansage = `${t.avatar} ${esc(t.name)} zieht${GN.wartePunkte()}`;
    $("#luAnsage").innerHTML = ansage;
    const knopf = $("#luWuerfeln");
    knopf.style.visibility = ich && z.schritt === "wuerfeln" ? "visible" : "hidden";
    knopf.disabled = !(ich && z.schritt === "wuerfeln");
    $("#luAktion").classList.toggle("ich", ich);
    $("#luLog").innerHTML = z.log.slice().reverse().map((l, i) => `<div style="opacity:${1 - i * 0.14}">${esc(l)}</div>`).join("");
    if (!vorher || vorher.zugNr !== z.zugNr || vorher.schritt !== z.schritt || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000, tonAus: () => GN.zustand?.dran !== GN.ich });
      else GN.ohneZeitlimit();
      if (vorher && ich && vorher.dran !== GN.ich) { Ton.ding(); navigator.vibrate?.(40); }
    }
  }

  function leuteZeichnen(z) {
    $("#luLeute").innerHTML = leute(z).map((t) => {
      const f = z.figuren[t.id] || [];
      const ziel = f.filter((r) => r >= 40).length, haus = f.filter((r) => r < 0).length;
      const farbe = farbeVon(z, t.id);
      return `<div class="lu-person ${z.dran === t.id ? "dran" : ""} ${t.id === GN.ich ? "ich" : ""}" style="--f:${FARBE[farbe][0]};--f2:${FARBE[farbe][1]}">
        <span class="lu-p-hut"></span><span class="lu-p-ava">${t.avatar}</span>
        <span class="lu-p-text"><b>${esc(t.id === GN.ich ? "Du" : t.name)}${t.bot ? " 🤖" : ""}</b><small>${FARBNAME[farbe]} · 🏠 ${haus} · 🎯 ${ziel}/4</small></span>
        <span class="lu-p-ziel">${[0, 1, 2, 3].map((i) => `<i class="${i < ziel ? "voll" : ""}"></i>`).join("")}</span>
      </div>`;
    }).join("");
  }

  // ---------- Figuren ----------
  function hutSvg(farbe) {
    return `<g class="lu-hut-form" filter="url(#luSchatten)">
      <ellipse cx="0" cy="0.18" rx="0.3" ry="0.11" fill="rgba(0,0,0,.25)"/>
      <path d="M-0.27 0.15 Q-0.27 0.04 -0.13 -0.02 L-0.08 -0.28 Q0 -0.34 0.08 -0.28 L0.13 -0.02 Q0.27 0.04 0.27 0.15 Q0 0.27 -0.27 0.15Z" fill="url(#luF_${farbe})" stroke="${FARBE[farbe][1]}" stroke-width="0.03"/>
      <circle cx="0" cy="-0.36" r="0.14" fill="url(#luF_${farbe})" stroke="${FARBE[farbe][1]}" stroke-width="0.03"/>
    </g>`;
  }
  function figurenZeichnen(z, sofort = false) {
    const box = $("#luFiguren");
    if (!box) return;
    for (const id of Object.keys(z.figuren)) {
      if (!anzeige[id]) anzeige[id] = [...z.figuren[id]];
      const farbe = farbeVon(z, id);
      z.figuren[id].forEach((r, k) => {
        let el = box.querySelector(`[data-f="${id}-${k}"]`);
        if (!el) {
          el = document.createElementNS("http://www.w3.org/2000/svg", "g");
          el.setAttribute("class", "lu-figur"); el.dataset.f = `${id}-${k}`; el.dataset.k = k;
          el.innerHTML = `<g class="lu-hut">${hutSvg(farbe)}</g>`;
          box.appendChild(el);
          el.addEventListener("click", () => { const zz = GN.zustand; if (zz.dran === GN.ich && zz.schritt === "ziehen" && id === GN.ich && zz.moeglich.some((m) => m.k === k)) { Ton.abgeben(); GN.aktion("ziehen", k); box.querySelectorAll(".kann").forEach((x) => x.classList.remove("kann")); } });
          el.addEventListener("pointerenter", () => zielZeigen(id, k));
          el.addEventListener("pointerleave", () => zielZeigen(null));
        }
        // Nicht laufende Figuren direkt an ihre Position (z. B. nach Neuverbindung)
        if (!laeuft || sofort) { if (anzeige[id][k] !== r && !laeuft) anzeige[id][k] = r; setzen(el, z.slot[id], anzeige[id][k], k); }
      });
    }
    // Wer kann ziehen? Diese Figuren pulsieren
    const meine = z.dran === GN.ich && z.schritt === "ziehen" ? z.moeglich.map((m) => m.k) : [];
    box.querySelectorAll(".lu-figur").forEach((el) => {
      const [id, k] = el.dataset.f.split("-");
      el.classList.toggle("kann", id === GN.ich && meine.includes(+k));
      el.classList.toggle("dran", id === z.dran);
    });
    // Figuren weiter unten im Bild liegen vorne
    [...box.children].sort((a, b) => +a.dataset.y - +b.dataset.y).forEach((el) => box.appendChild(el));
  }
  function setzen(el, slot, rel, k) {
    const [x, y] = mitte(feldVon(slot, rel, k));
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.dataset.y = y;
  }
  // Beim Drüberfahren: Zielfeld als Geist zeigen
  function zielZeigen(id, k) {
    const box = $("#luZiele");
    if (!box) return;
    const z = GN.zustand;
    if (!id || id !== GN.ich || z.dran !== GN.ich || z.schritt !== "ziehen") { box.innerHTML = ""; return; }
    const m = z.moeglich.find((x) => x.k === k);
    if (!m) { box.innerHTML = ""; return; }
    const [x, y] = mitte(feldVon(z.slot[id], m.nach, k));
    const von = z.figuren[id][k];
    const weg = von < 0 ? [] : Array.from({ length: m.nach - von - 1 }, (_, i) => mitte(feldVon(z.slot[id], von + i + 1, k)));
    box.innerHTML = weg.map(([wx, wy], i) => `<circle cx="${wx}" cy="${wy}" r="0.1" class="lu-weg" style="animation-delay:${i * 50}ms"/>`).join("") + `<circle cx="${x}" cy="${y}" r="0.46" class="lu-zielgeist ${m.schlaegt ? "schlag" : ""}"/>${m.schlaegt ? `<text x="${x}" y="${y + 0.2}" class="lu-zielgeist-text">💥</text>` : ""}`;
  }

  // ---------- Züge animieren: Feld für Feld hüpfen ----------
  function effekte(z) {
    const a = z.letzteAktion;
    if (!a || a.nr === letzteAktion) return;
    const erstes = !letzteAktion;
    letzteAktion = a.nr;
    if (erstes || a.typ !== "zug") return;
    $("#luZiele").innerHTML = "";
    const el = $(`#luFiguren [data-f="${a.spieler}-${a.k}"]`);
    if (!el) return;
    const slot = z.slot[a.spieler];
    const pfad = a.von === -1 ? [0] : Array.from({ length: a.nach - a.von }, (_, i) => a.von + i + 1);
    laeuft++;
    el.classList.add("hebt");
    pfad.forEach((rel, i) => setTimeout(() => {
      anzeige[a.spieler][a.k] = rel;
      setzen(el, slot, rel, a.k);
      const hut = el.firstElementChild;
      hut.classList.remove("hops"); void hut.getBoundingClientRect(); hut.classList.add("hops");
      Ton.tick();
      if (i === pfad.length - 1) setTimeout(() => {
        el.classList.remove("hebt");
        laeuft--;
        if (a.nach >= 40 && a.von < 40) {
          Ton.richtig(); GN.fx?.funken(el, { anzahl: 16 });
          const fertig = (GN.zustand.figuren[a.spieler] || []).filter((x) => x >= 40).length;
          knall(`${fertig === 4 ? "🏆" : "🎉"} ${esc(nameVon(z, a.spieler))} ${fertig === 4 ? "ist komplett im Ziel!" : `hat ${fertig}/4 im Ziel`}`, FARBE[farbeVon(z, a.spieler)][0]);
        }
        if (a.von === -1) { GN.fx?.pop(el, 1.2); Ton.wusch?.(); ring(el, farbeVon(z, a.spieler)); }
        if (a.geschlagen) rauswurf(z, a);
        figurenZeichnen(GN.zustand);
      }, 170);
    }, 120 + i * 180));
  }
  // Geschlagene Figur fliegt ins Haus zurück
  function rauswurf(z, a) {
    const g = a.geschlagen;
    const el = $(`#luFiguren [data-f="${g.id}-${g.k}"]`);
    Ton.treffer(); GN.fx?.wackeln(2);
    knall(`💥 ${esc(nameVon(z, g.id))} ${g.id === GN.ich ? "fliegst" : "fliegt"} raus!`);
    if (g.id === GN.ich) navigator.vibrate?.([80, 40, 120]);
    if (!el) return;
    anzeige[g.id][g.k] = -1;
    el.classList.add("fliegt");
    setzen(el, z.slot[g.id], -1, g.k);
    setTimeout(() => el.classList.remove("fliegt"), 700);
  }
  // Farbiger Ring breitet sich vom Feld aus (Figur kommt raus)
  function ring(el, farbe) {
    const box = $("#luZiele");
    const m = /translate\(([\d.]+)px, ([\d.]+)px\)/.exec(el.style.transform);
    if (!box || !m) return;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", m[1]); c.setAttribute("cy", m[2]); c.setAttribute("r", "0.45");
    c.setAttribute("class", "lu-ring"); c.style.setProperty("--f", FARBE[farbe][0]);
    box.appendChild(c);
    setTimeout(() => c.remove(), 700);
  }
  function knall(text, farbe) {
    const box = $("#luKnall");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "lu-knall-text"; el.innerHTML = text;
    if (farbe) el.style.borderColor = farbe;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  GN.spiele.ludo = {
    icon: "🎯",
    titel: "Raus da!",
    kurz: "Würfeln, laufen, rauswerfen – der Brettspiel-Klassiker.",
    beschreibung: "Bring deine vier Hütchen als Erster ins Ziel. Mit einer 6 kommst du raus, und wer auf dich zieht, wirft dich zurück ins Haus. Mit Computer-Gegnern für 2 bis 4 Spieler.",
    tags: ["🎲 Würfeln", "💥 Rauswerfen", "👥 2–4 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
