// =============================================================
//  Baulöwe – Browser-Teil
//  Spielbrett (11 × 11), Figuren laufen Feld für Feld, 3D-Würfel,
//  Straßenkarten mit Bauen/Hypothek, Handel, Ereigniskarten
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const M = () => GN.meta.spiele.baulowe || {};
  const F = () => M().felder || [];
  const G = () => M().gruppen || {};
  let figurPos = {}; // angezeigte Position je Spieler (läuft der echten hinterher)
  let laufNr = 0, letzteAktion = 0, letzterWurf = 0;
  let wuerfelLaeuft = false;

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || { name: "?", avatar: "👤" };
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);
  const geldText = (n) => `${Number(n || 0).toLocaleString("de-DE")} €`;
  // Farbe je Spieler (für Besitz-Markierung)
  const SPIELERFARBEN = ["#ff5d8f", "#3fb6ff", "#ffcf3f", "#5ee08a", "#b98cff", "#ff9a3c"];
  const farbeVon = (z, id) => SPIELERFARBEN[Math.max(0, leute(z).findIndex((t) => t.id === id)) % SPIELERFARBEN.length];

  // Feld-Index → Gitterplatz (Los unten rechts, im Uhrzeigersinn)
  function platz(i) {
    if (i <= 10) return { r: 11, c: 11 - i, seite: "unten" };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, seite: "links" };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), seite: "oben" };
    return { r: 1 + (i - 30), c: 11, seite: "rechts" };
  }
  const ecke = (i) => i % 10 === 0;

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    return [
      {
        id: "spieler", wichtig: true, icon: "🤖", titel: "Mitspieler & Zeit", info: `${z.spieler.length} + ${e.bots} Computer`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3, 4, 5].map((n) => `<button data-bl-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Runden</div><div class="segment">${[20, 30, 50].map((n) => `<button data-bl-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[30, 60, 0].map((n) => `<button data-bl-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Dorfplatz-Topf</div><div class="segment"><button data-bl-topf="1" class="${e.topf ? "aktiv" : ""}" ${dis}>An</button><button data-bl-topf="0" class="${!e.topf ? "aktiv" : ""}" ${dis}>Aus</button></div></div>
        </div>
        <p class="leise klein-text" style="margin-top:8px">Nach der letzten Runde gewinnt, wer das größte Vermögen hat (Geld + Straßen + Häuser). Mit Topf: Steuern und Strafen landen auf dem Dorfplatz.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "Regeln", info: "Kaufen, bauen, kassieren",
        html: `<ol class="q-regeln">
          <li>Würfle mit zwei Würfeln und lauf los. Über <b>Los</b> gibt es 200.</li>
          <li>Freie Straßen, Haltestellen und Werke kannst du <b>kaufen</b>. Wer auf deinem Feld landet, zahlt dir <b>Miete</b>.</li>
          <li>Hast du eine <b>ganze Farbgruppe</b>, verdoppelt sich die Miete und du darfst <b>Häuser bauen</b> (gleichmäßig, bis zum Hotel).</li>
          <li><b>Pasch</b>: nochmal würfeln. Der dritte Pasch in Folge bringt dich ins Gefängnis.</li>
          <li>Raus aus dem Gefängnis: 50 zahlen, Frei-Karte oder einen Pasch würfeln (3 Versuche).</li>
          <li>Knapp bei Kasse? <b>Hypotheken</b> aufnehmen oder Häuser verkaufen. <b>Handeln</b> geht in deinem Zug.</li>
          <li>Wer nicht zahlen kann, ist <b>pleite</b>.</li></ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-bl-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.blBots })));
    $$("[data-bl-runden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.blRunden })));
    $$("[data-bl-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.blSek })));
    $$("[data-bl-topf]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ topf: b.dataset.blTopf === "1" })));
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (!GN.ansicht.startsWith("bl-podest")) {
        GN.ansicht = "bl-ende";
        setTimeout(() => GN.zustand?.phase === "ende" && !GN.ansicht.startsWith("bl-podest") && GN.podest("bl-podest", { einheit: "€" }), 2500);
        GN.toast("🏁 Spiel vorbei! Es zählt das Vermögen.");
      }
      return;
    }
    if (!$(".bl-buehne") || GN.ansicht !== "bl-spiel") aufbauen(z);
    aktualisieren(z, vorher);
  }

  function aufbauen(z) {
    GN.ansicht = "bl-spiel";
    GN.stoppeTimer();
    figurPos = { ...z.figur };
    laufNr = z.bewegung?.nr || 0;
    letzteAktion = z.letzteAktion?.nr || 0;
    letzterWurf = z.wurfNr;
    const felder = F();
    app.innerHTML = `
      <div class="bl-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🎩 Baulöwe</span>
          <span class="runden-nr" id="blRunde"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="bl-leute" id="blLeute"></div>
        <div class="bl-brett-huelle">
          <div class="bl-brett" id="blBrett">
            ${felder.map((f, i) => feldHtml(f, i)).join("")}
            <div class="bl-mitte">
              <div class="bl-logo">Bau<span>löwe</span></div>
              <div class="bl-wuerfel-reihe" id="blWuerfel">${wuerfelHtml(1)}${wuerfelHtml(2)}</div>
              <div class="bl-panel" id="blPanel"></div>
              <div class="bl-log" id="blLog"></div>
            </div>
            <div class="bl-figuren" id="blFiguren"></div>
          </div>
        </div>
      </div>`;
    $("#blBrett").addEventListener("click", (ev) => { const f = ev.target.closest("[data-feld]"); if (f) { Ton.klick(); feldInfo(+f.dataset.feld); } });
    wuerfelSetzen(z.wuerfel, true);
  }

  function feldHtml(f, i) {
    const p = platz(i);
    const g = f.gruppe ? G()[f.gruppe] : null;
    const kurz = f.name.replace(/straße$/i, "str.").replace(/^Kirche /, "").replace(/^Gewerbegebiet /, "").replace(/^Neubaugebiet /, "").replace(/ FC Schechingen$/, "");
    return `<button class="bl-feld ${p.seite} ${ecke(i) ? "ecke" : ""} art-${f.art}" data-feld="${i}" style="grid-row:${p.r};grid-column:${p.c};${g ? `--g:${g.farbe}` : ""}" aria-label="${esc(f.name)}">
      ${g ? '<span class="bl-band"></span>' : ""}
      <span class="bl-feld-inhalt">${f.icon ? `<span class="bl-icon">${f.icon}</span>` : ""}<span class="bl-name">${esc(ecke(i) ? f.name.split(" /")[0] : kurz)}</span>${f.preis ? `<span class="bl-preis">${f.preis}</span>` : ""}</span>
      <span class="bl-haeuser"></span><span class="bl-besitzer"></span>
    </button>`;
  }
  const PUNKTE = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const wuerfelHtml = (n) => `<div class="bl-w" data-w="${n}"><div class="bl-w-kubus">${[1, 2, 3, 4, 5, 6].map((s) => `<span class="bl-w-seite s${s}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<i class="${PUNKTE[s].includes(k) ? "an" : ""}"></i>`).join("")}</span>`).join("")}</div></div>`;
  // Drehung, die die Augenzahl nach vorn zeigt
  const DREH = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  function wuerfelSetzen(w, sofort) {
    $$(".bl-w", $("#blWuerfel")).forEach((el, i) => {
      const k = $(".bl-w-kubus", el);
      const [x, y] = DREH[w[i]];
      const extra = sofort ? 0 : 720 + 360 * i;
      k.style.transition = sofort ? "none" : "transform 1s cubic-bezier(.2,.8,.25,1)";
      k.style.transform = `rotateX(${x + extra}deg) rotateY(${y + extra}deg)`;
      if (!sofort) { el.classList.remove("rollt"); void el.offsetWidth; el.classList.add("rollt"); }
    });
  }

  function aktualisieren(z, vorher) {
    const ich = z.dran === GN.ich;
    $("#blRunde").textContent = `Runde ${z.runde} / ${z.rundenLimit}${z.topf ? ` · ⛲ ${z.topf}` : ""}`;
    // Würfel
    if (z.wurfNr !== letzterWurf) {
      letzterWurf = z.wurfNr;
      Ton.wusch(); wuerfelLaeuft = true;
      wuerfelSetzen(z.wuerfel, false);
      setTimeout(() => { wuerfelLaeuft = false; Ton.klick(); }, 1000);
      if (z.wuerfel[0] === z.wuerfel[1]) setTimeout(() => GN.fx?.funken($("#blWuerfel"), { anzahl: 14 }), 950);
    }
    felderZeichnen(z);
    leuteZeichnen(z, vorher);
    figurenZeichnen(z);
    panelZeichnen(z);
    logZeichnen(z);
    effekte(z);
    angebotZeigen(z);
    if (!vorher || vorher.zugNr !== z.zugNr || vorher.schritt !== z.schritt || (vorher.angebot?.nr !== z.angebot?.nr) || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000, tonAus: () => GN.zustand?.dran !== GN.ich });
      else GN.ohneZeitlimit();
      if (vorher && ich && vorher.dran !== GN.ich) { Ton.ding(); navigator.vibrate?.(40); }
    }
  }

  function felderZeichnen(z) {
    $$(".bl-feld").forEach((el) => {
      const i = +el.dataset.feld;
      const b = z.besitz[i];
      el.classList.toggle("besessen", b !== undefined);
      el.classList.toggle("hypothek", !!z.hypothek[i]);
      el.classList.toggle("meins", b === GN.ich);
      el.style.setProperty("--b", b !== undefined ? farbeVon(z, b) : "transparent");
      $(".bl-besitzer", el).textContent = b !== undefined ? person(z, b).avatar : "";
      const h = z.haeuser[i] || 0;
      const hEl = $(".bl-haeuser", el);
      const html = h === 5 ? '<i class="hotel">🏨</i>' : "<i>🏠</i>".repeat(h);
      if (hEl.innerHTML !== html) { hEl.innerHTML = html; if (h) GN.fx?.pop(hEl, 0.8); }
    });
  }

  function leuteZeichnen(z, vorher) {
    const box = $("#blLeute");
    box.innerHTML = leute(z).map((t) => {
      const pleite = z.pleite.includes(t.id);
      const n = Object.values(z.besitz).filter((x) => x === t.id).length;
      return `<div class="bl-person ${z.dran === t.id ? "dran" : ""} ${pleite ? "pleite" : ""} ${t.id === GN.ich ? "ich" : ""}" style="--b:${farbeVon(z, t.id)}">
        <span class="bl-p-ava">${t.avatar}<em>${z.figurIcon[t.id]}</em></span>
        <span class="bl-p-text"><b>${esc(t.id === GN.ich ? "Du" : t.name)}</b><small class="bl-geld" data-geld="${t.id}">${pleite ? "pleite" : geldText(z.geld[t.id])}</small></span>
        <span class="bl-p-info">${n ? `🏷️${n}` : ""}${z.knast[t.id] !== undefined ? " 🚔" : ""}${z.freiKarten.includes(t.id) ? " 🎫" : ""}${t.bot ? " 🤖" : ""}</span>
      </div>`;
    }).join("");
    // Geld zählt sichtbar hoch/runter
    if (vorher) for (const t of leute(z)) {
      const alt = vorher.geld?.[t.id], neu = z.geld[t.id];
      if (alt !== undefined && alt !== neu && !z.pleite.includes(t.id)) {
        const el = $(`[data-geld="${t.id}"]`, box);
        GN.fx?.zahl(el, alt, neu, { dauer: 700, format: geldText });
        el?.classList.add(neu > alt ? "plus" : "minus");
      }
    }
  }

  // Figuren: laufen Feld für Feld zur neuen Position
  function figurenZeichnen(z) {
    const box = $("#blFiguren");
    const brett = $("#blBrett").getBoundingClientRect();
    const mitte = (i, k, n) => {
      const el = $(`.bl-feld[data-feld="${i}"]`);
      const r = el.getBoundingClientRect();
      const versatz = n > 1 ? ((k - (n - 1) / 2) * Math.min(r.width, r.height)) / (n + 1.2) : 0;
      return { x: r.left - brett.left + r.width / 2 + versatz, y: r.top - brett.top + r.height / 2 + versatz * 0.4 };
    };
    const aktive = leute(z).filter((t) => !z.pleite.includes(t.id));
    for (const t of leute(z)) if (z.pleite.includes(t.id)) $(`.bl-figur[data-f="${t.id}"]`, box)?.remove();
    aktive.forEach((t, k) => {
      let el = $(`.bl-figur[data-f="${t.id}"]`, box);
      if (!el) { el = document.createElement("div"); el.className = "bl-figur"; el.dataset.f = t.id; el.innerHTML = `<span>${z.figurIcon[t.id]}</span>`; el.style.setProperty("--b", farbeVon(z, t.id)); box.appendChild(el); }
      el.classList.toggle("dran", z.dran === t.id);
      el.dataset.k = k;
    });
    const setze = (id, feld) => {
      const el = $(`.bl-figur[data-f="${id}"]`, box);
      if (!el) return;
      const k = +el.dataset.k;
      const hier = aktive.filter((t) => figurPos[t.id] === feld);
      const p = mitte(feld, hier.findIndex((t) => t.id === id), hier.length);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      void k;
    };
    // Neue Bewegung? Dann Schritt für Schritt laufen lassen
    const bw = z.bewegung;
    if (bw && bw.nr !== laufNr) {
      laufNr = bw.nr;
      const id = bw.spieler;
      const schritte = Math.abs(bw.schritte), rich = bw.schritte < 0 ? -1 : 1;
      const start = figurPos[id] ?? bw.von;
      const warte = wuerfelLaeuft ? 1000 : 0;
      for (let s = 1; s <= schritte; s++) {
        setTimeout(() => {
          figurPos[id] = (start + rich * s + 40) % 40;
          const el = $(`.bl-figur[data-f="${id}"]`, box);
          el?.classList.remove("hops"); void el?.offsetWidth; el?.classList.add("hops");
          Ton.tick();
          for (const t of aktive) setze(t.id, figurPos[t.id]);
          if (s === schritte) setTimeout(() => { figurPos = { ...GN.zustand.figur }; for (const t of aktive) setze(t.id, figurPos[t.id]); }, 300);
        }, warte + s * 170);
      }
      if (!schritte) { figurPos[id] = bw.nach; }
    } else if (!wuerfelLaeuft) {
      // Sprünge ohne Laufen (z. B. ins Gefängnis)
      for (const t of aktive) if (figurPos[t.id] !== z.figur[t.id] && !box.dataset.laeuft) figurPos[t.id] = z.figur[t.id];
    }
    for (const t of aktive) { if (figurPos[t.id] === undefined) figurPos[t.id] = z.figur[t.id]; setze(t.id, figurPos[t.id]); }
  }
  addEventListener("resize", () => GN.zustand?.spiel === "baulowe" && $("#blFiguren") && figurenZeichnen(GN.zustand));

  // Mitte: was ist jetzt zu tun?
  function panelZeichnen(z) {
    const box = $("#blPanel");
    const ich = z.dran === GN.ich;
    const f = F()[z.figur[GN.ich]];
    let html = "";
    const wer = `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)}`;
    if (z.angebot) html = `<div class="bl-ansage">🤝 Handel läuft${GN.wartePunkte()}</div>`;
    else if (!ich) html = `<div class="bl-ansage">${wer} ist dran${GN.wartePunkte()}</div>`;
    else if (z.schritt === "wuerfeln") {
      const knast = z.knast[GN.ich] !== undefined;
      html = `<div class="bl-ansage"><b>Du bist dran!</b>${knast ? ` Im Gefängnis (Versuch ${z.knast[GN.ich] + 1}/3)` : z.pasch ? " Pasch – nochmal!" : ""}</div>
        <div class="bl-knoepfe"><button class="btn gross" data-a="wuerfeln">🎲 Würfeln</button>
        ${knast ? `<button class="btn zweit" data-a="freikaufen" ${z.geld[GN.ich] < 50 ? "disabled" : ""}>💶 50 zahlen</button>${z.freiKarten.includes(GN.ich) ? '<button class="btn zweit" data-a="freikarte">🎫 Frei-Karte</button>' : ""}` : ""}
        <button class="btn zweit klein" data-a="handel">🤝 Handeln</button></div>`;
    } else if (z.schritt === "kaufen") {
      const feld = F()[z.figur[GN.ich]];
      html = `${kleineKarte(z, z.figur[GN.ich])}
        <div class="bl-knoepfe"><button class="btn" data-a="kaufen" ${z.geld[GN.ich] < feld.preis ? "disabled" : ""}>🏷️ Kaufen für ${feld.preis}</button><button class="btn zweit" data-a="nichtKaufen">Nicht kaufen</button></div>`;
    } else if (z.schritt === "zahlen") {
      const s = z.schulden;
      const fehlt = s.betrag - z.geld[GN.ich];
      html = `<div class="bl-ansage warnung"><b>${esc(s.grund)}: ${geldText(s.betrag)}</b><br>${fehlt > 0 ? `Dir fehlen ${geldText(fehlt)}. Tippe auf deine Straßen: Häuser verkaufen oder Hypothek aufnehmen.` : "Jetzt reicht es!"}</div>
        <div class="bl-knoepfe"><button class="btn" data-a="bezahlen" ${fehlt > 0 ? "disabled" : ""}>💶 Bezahlen</button><button class="btn zweit" data-a="aufgeben">🏳️ Pleite gehen</button></div>`;
    } else if (z.schritt === "fertig") {
      html = `<div class="bl-ansage">${f ? `Du stehst auf <b>${esc(f.name)}</b>.` : ""} Bauen? Tippe auf eine Straße.</div>
        <div class="bl-knoepfe"><button class="btn" data-a="zugEnde">${z.nochmal ? "🎲 Pasch: weiter" : "✅ Zug beenden"}</button><button class="btn zweit klein" data-a="handel">🤝 Handeln</button></div>`;
    } else if (z.schritt === "karte") html = `<div class="bl-ansage">🃏 Karte${GN.wartePunkte()}</div>`;
    if (box.dataset.html !== html) {
      box.dataset.html = html; box.innerHTML = html;
      $$("[data-a]", box).forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        if (a === "handel") return handelOeffnen(z);
        if (a === "aufgeben" && !confirm("Wirklich pleite gehen? Du scheidest aus.")) return;
        Ton[a === "wuerfeln" ? "klick" : a === "kaufen" ? "richtig" : "klick"]();
        if (a === "kaufen") GN.fx?.funken(b);
        GN.aktion(a, a === "aufgeben" ? { sicher: true } : undefined);
      }));
    }
  }

  function logZeichnen(z) {
    $("#blLog").innerHTML = z.log.slice(-4).reverse().map((l, i) => `<div style="opacity:${1 - i * 0.22}">${esc(l.text)}</div>`).join("");
  }

  // Kleine Straßenkarte (für Kaufen und Info)
  function kleineKarte(z, i) {
    const f = F()[i], g = f.gruppe ? G()[f.gruppe] : null;
    let tabelle = "";
    if (f.art === "strasse") tabelle = `<table class="bl-miete">${["Miete", "Mit 1 Haus", "Mit 2 Häusern", "Mit 3 Häusern", "Mit 4 Häusern", "Mit Hotel"].map((n, k) => `<tr class="${(z.haeuser[i] || 0) === k && z.besitz[i] !== undefined ? "jetzt" : ""}"><td>${n}</td><td>${f.miete[k]}</td></tr>`).join("")}</table>
      <div class="bl-karte-fuss">Volle Farbgruppe: doppelte Miete ohne Haus · Haus ${g.haus} · Hypothek ${f.preis / 2}</div>`;
    else if (f.art === "bahn") tabelle = `<table class="bl-miete">${[25, 50, 100, 200].map((m, k) => `<tr><td>${k + 1} Vereinsheim${k ? "e" : ""}</td><td>${m}</td></tr>`).join("")}</table><div class="bl-karte-fuss">Hypothek ${f.preis / 2}</div>`;
    else if (f.art === "werk") tabelle = `<p class="klein-text">Eins davon: 4 × Augenzahl<br>Beide Gebiete: 10 × Augenzahl</p><div class="bl-karte-fuss">Hypothek ${f.preis / 2}</div>`;
    else tabelle = `<p class="klein-text">${{ start: "Wer über Los kommt, bekommt 200.", ereignis: "Ziehe eine Glück-Karte.", kasse: "Ziehe eine Dorfkasse-Karte.", steuer: `Zahle ${f.betrag}.`, knast: "Nur zu Besuch – oder sitzt hier fest.", parken: z.topf ? `Hier liegt der Topf: ${z.topf}` : "Eine Runde Pause auf dem Dorfplatz.", geheKnast: "Direkt ins Gefängnis, ohne über Los." }[f.art] || ""}</p>`;
    return `<div class="bl-karte ${z.hypothek[i] ? "hypothek" : ""}" style="${g ? `--g:${g.farbe}` : ""}">
      <div class="bl-karte-kopf">${g ? "" : `<span>${f.icon || ""}</span>`}<b>${esc(f.name)}</b>${f.preis ? `<small>Preis ${f.preis}</small>` : ""}</div>
      ${tabelle}
      ${z.besitz[i] !== undefined ? `<div class="bl-karte-besitzer">Gehört ${person(z, z.besitz[i]).avatar} ${esc(nameVon(z, z.besitz[i]))}${z.hypothek[i] ? " · <b>Hypothek</b>" : ""}</div>` : ""}
    </div>`;
  }

  // Feld antippen: Karte mit Bau- und Hypothek-Knöpfen
  function feldInfo(i) {
    const z = GN.zustand;
    const f = F()[i];
    let d = $("#blFeldFenster");
    if (!d) { d = document.createElement("dialog"); d.id = "blFeldFenster"; d.className = "fenster bl-fenster"; document.body.appendChild(d); d.addEventListener("click", (ev) => ev.target === d && d.close()); }
    const meins = z.besitz[i] === GN.ich, ichDran = z.dran === GN.ich;
    const g = f.gruppe ? G()[f.gruppe] : null;
    const h = z.haeuser[i] || 0;
    const gruppe = g ? F().map((x, j) => (x.gruppe === f.gruppe ? j : -1)).filter((j) => j >= 0) : [];
    const voll = g && gruppe.every((j) => z.besitz[j] === GN.ich) && !gruppe.some((j) => z.hypothek[j]);
    const gleich = g && h <= Math.min(...gruppe.map((j) => z.haeuser[j] || 0));
    const bauGrund = !g ? "" : !voll ? "Erst die ganze Farbgruppe sammeln" : !gleich ? "Erst gleichmäßig bauen" : h >= 5 ? "Hotel steht schon" : z.geld[GN.ich] < g.haus ? "Zu wenig Geld" : "";
    const knoepfe = meins && (ichDran || z.schulden?.von === GN.ich) ? `
      ${f.art === "strasse" ? `<button class="btn" data-f="bauen" ${!ichDran || bauGrund ? "disabled" : ""}>🏠 ${h === 4 ? "Hotel" : "Haus"} bauen (${g.haus})</button>${bauGrund ? `<small class="leise bl-grund">${bauGrund}</small>` : ""}
      <button class="btn zweit" data-f="verkaufen" ${h ? "" : "disabled"}>Haus verkaufen (+${g.haus / 2})</button>` : ""}
      ${z.hypothek[i] ? `<button class="btn zweit" data-f="ausloesen" ${ichDran ? "" : "disabled"}>Hypothek auslösen (${Math.ceil(f.preis / 2 * 1.1)})</button>` : f.preis ? `<button class="btn zweit" data-f="hypothek">Hypothek (+${f.preis / 2})</button>` : ""}` : "";
    d.innerHTML = `<div class="fenster-kopf"><h2>${f.icon || "🏠"} ${esc(f.name)}</h2><button class="icon-btn klein" data-schliessen aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt">${kleineKarte(z, i)}${knoepfe ? `<div class="bl-knoepfe spalte">${knoepfe}</div>` : ""}
      ${!meins && z.besitz[i] !== undefined && f.miete ? `<p class="leise klein-text">Aktuelle Miete: ${z.miete[i]}</p>` : ""}</div>`;
    $("[data-schliessen]", d).onclick = () => d.close();
    $$("[data-f]", d).forEach((b) => (b.onclick = () => { Ton.klick(); GN.aktion(b.dataset.f, i); if (b.dataset.f === "bauen") GN.fx?.funken(b); setTimeout(() => d.open && feldInfo(i), 250); }));
    if (!d.open) d.showModal();
  }

  // ---------- Handel ----------
  function handelOeffnen(z) {
    const andere = leute(z).filter((t) => t.id !== GN.ich && !z.pleite.includes(t.id));
    if (!andere.length) return;
    let mit = andere[0].id;
    let d = $("#blHandel");
    if (!d) { d = document.createElement("dialog"); d.id = "blHandel"; d.className = "fenster bl-fenster"; document.body.appendChild(d); }
    const handelbar = (id) => Object.entries(z.besitz).filter(([f, b]) => b === id).map(([f]) => +f).filter((f) => { const g = F()[f].gruppe; return !(z.haeuser[f] > 0) && !(g && F().some((x, j) => x.gruppe === g && z.haeuser[j] > 0)); });
    const liste = (id, name) => handelbar(id).map((f) => `<label class="bl-h-feld" style="--g:${G()[F()[f].gruppe]?.farbe || "#888"}"><input type="checkbox" name="${name}" value="${f}"><span>${esc(F()[f].name)}</span></label>`).join("") || '<p class="leise klein-text">Nichts zum Handeln</p>';
    const zeichnen = () => {
      d.innerHTML = `<div class="fenster-kopf"><h2>🤝 Handeln</h2><button class="icon-btn klein" data-schliessen aria-label="Schließen">✕</button></div>
        <div class="fenster-inhalt">
          <div class="segment bl-h-mit">${andere.map((t) => `<button data-mit="${t.id}" class="${t.id === mit ? "aktiv" : ""}">${t.avatar} ${esc(t.name)}</button>`).join("")}</div>
          <div class="bl-h-spalten">
            <div><div class="unter-titel">Du gibst</div>${liste(GN.ich, "gib")}<label class="bl-h-geld">💶 <input type="number" min="0" max="${z.geld[GN.ich]}" step="10" value="0" id="blGibGeld"></label></div>
            <div><div class="unter-titel">Du willst</div>${liste(mit, "will")}<label class="bl-h-geld">💶 <input type="number" min="0" step="10" value="0" id="blWillGeld"></label></div>
          </div>
          <button class="btn voll" id="blAnbieten">📨 Angebot schicken</button>
        </div>`;
      $("[data-schliessen]", d).onclick = () => d.close();
      $$("[data-mit]", d).forEach((b) => (b.onclick = () => { mit = b.dataset.mit; zeichnen(); }));
      $("#blAnbieten", d).onclick = () => {
        const werte = (n) => $$(`input[name="${n}"]:checked`, d).map((x) => +x.value);
        Ton.abgeben();
        GN.aktion("anbieten", { an: mit, gibFelder: werte("gib"), willFelder: werte("will"), gibGeld: +$("#blGibGeld", d).value || 0, willGeld: +$("#blWillGeld", d).value || 0 });
        d.close();
      };
    };
    zeichnen();
    d.showModal();
  }
  function angebotZeigen(z) {
    const a = z.angebot;
    let ov = $("#blAngebot");
    if (!a || (a.an !== GN.ich && a.von !== GN.ich)) { ov?.remove(); return; }
    const key = `${a.nr}-${a.von}`;
    if (ov?.dataset.key === key) return;
    ov?.remove();
    ov = document.createElement("div");
    ov.id = "blAngebot"; ov.className = "bl-angebot"; ov.dataset.key = key;
    const teil = (seite) => `${seite.felder.map((f) => `<span class="bl-h-chip" style="--g:${G()[F()[f].gruppe]?.farbe || "#888"}">${esc(F()[f].name)}</span>`).join("")}${seite.geld ? `<span class="bl-h-chip geld">${geldText(seite.geld)}</span>` : ""}` || "<em>nichts</em>";
    const fuerMich = a.an === GN.ich;
    ov.innerHTML = `<div class="bl-angebot-karte"><b>🤝 ${fuerMich ? `${esc(person(z, a.von).name)} bietet dir an` : `Dein Angebot an ${esc(person(z, a.an).name)}`}</b>
      <div class="bl-h-spalten"><div><div class="unter-titel">${fuerMich ? "Du bekommst" : "Du gibst"}</div>${teil(a.gib)}</div><div><div class="unter-titel">${fuerMich ? "Du gibst" : "Du bekommst"}</div>${teil(a.will)}</div></div>
      <div class="bl-knoepfe">${fuerMich ? '<button class="btn" data-h="annehmen">✅ Annehmen</button><button class="btn zweit" data-h="ablehnen">❌ Ablehnen</button>' : `<span class="leise">Warte auf Antwort${GN.wartePunkte()}</span><button class="btn zweit klein" data-h="zurueckziehen">Zurückziehen</button>`}</div></div>`;
    document.body.appendChild(ov);
    if (fuerMich) { Ton.ding(); navigator.vibrate?.(60); }
    $$("[data-h]", ov).forEach((b) => (b.onclick = () => { Ton.klick(); GN.aktion(b.dataset.h); }));
  }

  // ---------- Effekte: Karten, Miete, Kauf, Pleite ----------
  function effekte(z) {
    const a = z.letzteAktion;
    if (!a || a.nr === letzteAktion) return;
    const erstes = !letzteAktion;
    letzteAktion = a.nr;
    if (erstes) return;
    const verz = (a.typ === "karte" || a.typ === "miete" || a.typ === "kauf" || a.typ === "steuer" || a.typ === "topf") && z.bewegung ? 1000 + Math.abs(z.bewegung.schritte) * 170 : 0;
    setTimeout(() => {
      if (GN.ansicht !== "bl-spiel") return;
      const wer = esc(nameVon(z, a.spieler));
      if (a.typ === "karte") {
        Ton.wusch();
        const ov = document.createElement("div");
        ov.className = `bl-ereignis ${a.art}`;
        ov.innerHTML = `<div class="bl-ereignis-karte"><div class="bl-ereignis-kopf">${a.art === "ereignis" ? "❓ Glück" : "💰 Dorfkasse"}</div><p>${esc(a.text)}</p><small>${wer}</small></div>`;
        document.body.appendChild(ov);
        setTimeout(() => ov.classList.add("weg"), 2300);
        setTimeout(() => ov.remove(), 2700);
        ov.onclick = () => ov.remove();
      }
      if (a.typ === "miete") { (a.spieler === GN.ich ? Ton.falsch : a.an === GN.ich ? Ton.richtig : Ton.klick)(); knall(`💸 ${a.betrag}`, `${wer} → ${esc(nameVon(z, a.an))}`); }
      if (a.typ === "kauf") { Ton.richtig(); knall("🏷️ Gekauft!", `${wer}: ${esc(F()[a.feld].name)}`); if (a.gruppeVoll) setTimeout(() => { Ton.volltreffer(); knall("🎉 Farbgruppe komplett!", "Jetzt kann gebaut werden"); if (a.spieler === GN.ich) GN.konfetti(80); }, 900); }
      if (a.typ === "bauen") { Ton.abgeben(); knall(a.hotel ? "🏨 Hotel!" : "🏠 Neues Haus", `${wer}: ${esc(F()[a.feld].name)}`); }
      if (a.typ === "knast" || (a.typ === "wurf" && a.dreiPasch)) { Ton.alarm(); knall("🚔 Ab ins Gefängnis!", wer); }
      if (a.typ === "topf") { Ton.volltreffer(); knall(`⛲ +${a.betrag}`, `${wer} räumt den Topf ab`); GN.konfetti(60); }
      if (a.typ === "pleite") { Ton.falsch(); knall("💥 Pleite!", wer); }
      if (a.typ === "handel") { Ton.richtig(); knall("🤝 Handel!", `${wer} & ${esc(nameVon(z, a.an))}`); }
      if (a.typ === "abgelehnt" && a.an === GN.ich) GN.toast(`❌ ${wer} lehnt dein Angebot ab.`);
    }, verz);
  }
  function knall(titel, text) {
    const box = $(".bl-mitte");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "bl-knall"; el.innerHTML = `<b>${titel}</b><span>${text}</span>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  GN.spiele.baulowe = {
    icon: "🎩",
    titel: "Baulöwe",
    kurz: "Straßen kaufen, Häuser bauen, Miete kassieren.",
    beschreibung: "Das Brettspiel für lange Abende: Würfeln, Straßen kaufen, ganze Farbgruppen sammeln, Häuser und Hotels bauen und mit den anderen handeln. Wer am Ende am reichsten ist, gewinnt.",
    tags: ["🎲 Würfeln", "🏠 Bauen", "🤝 Handeln", "👥 2–6 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
