// =============================================================
//  Baulöwe – Browser-Teil
//  3D-Brett mit Figuren, Häusern und fallenden Würfeln (Rückfall: 2D-Brett),
//  Seitenleiste mit Guthaben, eigenen Karten, Karten der anderen, Übersicht,
//  Besitzrechtkarten wie im Original, einfacher Handel direkt über die Karte
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const M = () => GN.meta.spiele.baulowe || {};
  const F = () => M().felder || [];
  const G = () => M().gruppen || {};
  let figurPos = {}; // 2D: angezeigte Position je Spieler (läuft der echten hinterher)
  let laufNr = 0, letzteAktion = 0, letzterWurf = 0;
  let wuerfelLaeuft = false;
  let brett3d = null; // 3D-Brett, sobald geladen
  let mit3d = false;

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || { name: "?", avatar: "👤" };
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);
  const geldText = (n) => `${Number(n || 0).toLocaleString("de-DE")} €`;
  const SPIELERFARBEN = ["#ff5d8f", "#3fb6ff", "#ffcf3f", "#5ee08a", "#b98cff", "#ff9a3c"];
  const farbeVon = (z, id) => SPIELERFARBEN[Math.max(0, leute(z).findIndex((t) => t.id === id)) % SPIELERFARBEN.length];
  const kaufbar = (f) => ["strasse", "bahn", "werk"].includes(f.art);
  // Gruppen in Brett-Reihenfolge, dazu Bahnhöfe und Werke
  const GRUPPEN_REIHE = () => [...new Set(F().filter((f) => f.gruppe).map((f) => f.gruppe)), "bahn", "werk"];
  const felderDerGruppe = (g) => F().map((f, i) => ({ f, i })).filter(({ f }) => (g === "bahn" || g === "werk" ? f.art === g : f.gruppe === g)).map(({ i }) => i);
  const gruppenFarbe = (g) => (g === "bahn" ? "#3b3b46" : g === "werk" ? "#8f9aa8" : G()[g]?.farbe || "#888");

  // 2D: Feld-Index → Gitterplatz (Los unten rechts, im Uhrzeigersinn)
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
        <p class="leise klein-text" style="margin-top:8px">Nach der letzten Runde gewinnt, wer das größte Vermögen hat (Geld + Besitz + Häuser). Mit Topf: Steuern und Strafen landen auf dem Dorfplatz.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "Regeln", info: "Kaufen, bauen, kassieren",
        html: `<ol class="q-regeln">
          <li>Würfle mit zwei Würfeln und lauf los. Über <b>Los</b> gibt es 200 €.</li>
          <li>Freie Felder, Bahnhöfe und Werke kannst du <b>kaufen</b>. Wer auf deinem Feld landet, zahlt dir <b>Miete</b>.</li>
          <li>Hast du eine <b>ganze Farbgruppe</b>, verdoppelt sich die Miete und du darfst <b>Häuser bauen</b> (gleichmäßig, bis zum Hotel).</li>
          <li>Bahnhöfe: 25 / 50 / 100 / 200 € je nachdem, wie viele du hast. Werke: 4-fache Augenzahl, mit beiden Werken 10-fache.</li>
          <li><b>Pasch</b>: nochmal würfeln. Der dritte Pasch in Folge bringt dich ins Gefängnis.</li>
          <li>Raus aus dem Gefängnis: 50 € zahlen, Frei-Karte oder einen Pasch würfeln (3 Versuche).</li>
          <li>Knapp bei Kasse? <b>Hypothek</b> (halber Kaufpreis) aufnehmen oder Häuser verkaufen. Zurückzahlen kostet 10 % Zinsen.</li>
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
    mit3d = !!window.BauloweBrett3D?.moeglich();
    brett3d = null;
    app.innerHTML = `
      <div class="bl-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🎩 Baulöwe</span>
          <span class="runden-nr" id="blRunde"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="bl-haupt">
          <div class="bl-links">
            <div class="bl-brettbox ${mit3d ? "drei" : ""}" id="blBrettBox">
              ${mit3d ? '<div class="bl-3d" id="bl3d"><div class="bl-laedt">Brett wird aufgebaut …</div></div>' : brett2dHtml()}
              <div class="bl-knallbox" id="blKnallBox"></div>
            </div>
            <div class="bl-aktion" id="blPanel"></div>
          </div>
          <div class="bl-rechts">
            <div class="bl-konto" id="blKonto"></div>
            <div class="bl-leute" id="blLeute"></div>
            <div class="bl-reihe"><button class="btn zweit klein" id="blUebersicht">📋 Alle Felder</button><button class="btn zweit klein" id="blHandelBtn">🤝 Tauschen</button></div>
            <details class="bl-log-box" open><summary>📜 Verlauf</summary><div class="bl-log" id="blLog"></div></details>
          </div>
        </div>
      </div>`;
    $("#blUebersicht").onclick = () => { Ton.klick(); uebersicht(); };
    $("#blHandelBtn").onclick = () => { Ton.klick(); handelOeffnen(GN.zustand); };
    if (mit3d) {
      BauloweBrett3D.einhaengen($("#bl3d"), F(), G()).then((b) => {
        if (!$("#bl3d")) return;
        $(".bl-laedt", $("#bl3d"))?.remove();
        brett3d = b;
        b.aufFeld = (i) => { Ton.klick(); feldInfo(i); };
        b.beiSchritt = () => Ton.tick();
        brett3dSetzen(GN.zustand);
      }).catch(() => { mit3d = false; $("#blBrettBox").classList.remove("drei"); $("#blBrettBox").insertAdjacentHTML("afterbegin", brett2dHtml()); $("#bl3d")?.remove(); bind2d(); aktualisieren(GN.zustand, null); });
    } else bind2d();
  }
  function brett2dHtml() {
    return `<div class="bl-brett" id="blBrett">
      ${F().map((f, i) => feldHtml(f, i)).join("")}
      <div class="bl-mitte"><div class="bl-logo">Bau<span>löwe</span></div><div class="bl-wuerfel-reihe" id="blWuerfel">${wuerfelHtml(1)}${wuerfelHtml(2)}</div></div>
      <div class="bl-figuren" id="blFiguren"></div>
    </div>`;
  }
  function bind2d() {
    $("#blBrett")?.addEventListener("click", (ev) => { const f = ev.target.closest("[data-feld]"); if (f) { Ton.klick(); feldInfo(+f.dataset.feld); } });
    wuerfelSetzen(GN.zustand.wuerfel, true);
  }

  function feldHtml(f, i) {
    const p = platz(i);
    const g = f.gruppe ? G()[f.gruppe] : null;
    const kurz = f.name.replace(/straße$/i, "str.").replace(/^Bahnhof /, "Bhf. ").replace(/^Kirche /, "");
    return `<button class="bl-feld ${p.seite} ${ecke(i) ? "ecke" : ""} art-${f.art}" data-feld="${i}" style="grid-row:${p.r};grid-column:${p.c};${g ? `--g:${g.farbe}` : ""}" aria-label="${esc(f.name)}">
      ${g ? '<span class="bl-band"></span>' : ""}
      <span class="bl-feld-inhalt">${f.icon ? `<span class="bl-icon">${f.icon}</span>` : ""}<span class="bl-name">${esc(ecke(i) ? f.name.split(" /")[0] : kurz)}</span>${f.preis ? `<span class="bl-preis">${f.preis}</span>` : ""}</span>
      <span class="bl-haeuser"></span><span class="bl-besitzer"></span>
    </button>`;
  }
  const PUNKTE = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const wuerfelHtml = (n) => `<div class="bl-w" data-w="${n}"><div class="bl-w-kubus">${[1, 2, 3, 4, 5, 6].map((s) => `<span class="bl-w-seite s${s}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<i class="${PUNKTE[s].includes(k) ? "an" : ""}"></i>`).join("")}</span>`).join("")}</div></div>`;
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
    $("#blRunde").textContent = `Runde ${z.runde} / ${z.rundenLimit}${z.topf ? ` · ⛲ ${z.topf} €` : ""}`;
    // Würfel
    if (z.wurfNr !== letzterWurf) {
      letzterWurf = z.wurfNr;
      Ton.wusch(); wuerfelLaeuft = true;
      const pasch = z.wuerfel[0] === z.wuerfel[1];
      if (mit3d && brett3d) brett3d.wuerfeln(z.wuerfel).then(() => { wuerfelLaeuft = false; Ton.klopf?.(); if (pasch) GN.fx?.knall("🎲 Pasch!", 1); });
      else { wuerfelSetzen(z.wuerfel, false); setTimeout(() => { wuerfelLaeuft = false; Ton.klick(); }, 1000); if (pasch) setTimeout(() => GN.fx?.funken($("#blWuerfel"), { anzahl: 14 }), 950); }
    }
    if (mit3d) brett3dSetzen(z); else { felderZeichnen(z); figurenZeichnen(z); }
    kontoZeichnen(z, vorher);
    leuteZeichnen(z);
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

  // 3D: Stand ans Brett geben, neue Bewegung als Lauf starten
  function brett3dSetzen(z) {
    if (!brett3d || !z) return;
    const aktive = leute(z).filter((t) => !z.pleite.includes(t.id));
    const bw = z.bewegung;
    if (bw && bw.nr !== laufNr) {
      laufNr = bw.nr;
      const warte = wuerfelLaeuft ? 1400 : 150;
      if (bw.schritte) brett3d.laufen(bw.spieler, bw.von, bw.schritte, 200, warte);
    }
    brett3d.setze({
      besitz: z.besitz, haeuser: z.haeuser, hypothek: z.hypothek, dran: z.dran,
      farben: Object.fromEntries(leute(z).map((t) => [t.id, farbeVon(z, t.id)])),
      figuren: aktive.map((t) => ({ id: t.id, feld: z.figur[t.id], icon: z.figurIcon[t.id], farbe: farbeVon(z, t.id) })),
    });
    brett3d.fokus(z.figur[z.dran] ?? 0);
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

  // ---------- Mein Konto: großes Guthaben, eigene Karten nach Farben ----------
  function kontoZeichnen(z, vorher) {
    const box = $("#blKonto");
    if (!box) return;
    const ich = leute(z).find((t) => t.id === GN.ich);
    if (!ich) { box.innerHTML = '<div class="leise">👀 Du schaust zu.</div>'; return; }
    const meine = Object.keys(z.besitz).map(Number).filter((f) => z.besitz[f] === GN.ich);
    const gruppen = GRUPPEN_REIHE().map((g) => ({ g, felder: felderDerGruppe(g) })).filter(({ felder }) => felder.some((f) => meine.includes(f)));
    box.innerHTML = `
      <div class="bl-konto-kopf" style="--b:${farbeVon(z, GN.ich)}">
        <span class="bl-konto-figur">${z.figurIcon[GN.ich]}</span>
        <div><small>Dein Guthaben</small><b id="blGuthaben">${geldText(z.geld[GN.ich])}</b><small>Vermögen ${geldText(z.vermoegen?.[GN.ich])}${z.freiKarten.includes(GN.ich) ? " · 🎫 Frei-Karte" : ""}${z.knast[GN.ich] !== undefined ? " · 🚔 im Gefängnis" : ""}</small></div>
      </div>
      <div class="bl-meine">${gruppen.length ? gruppen.map(({ g, felder }) => `
        <div class="bl-meine-gruppe">${felder.map((f) => {
          const mein = z.besitz[f] === GN.ich;
          return `<button class="bl-mini ${mein ? "mein" : "fremd"} ${z.hypothek[f] ? "hypothek" : ""}" data-info="${f}" style="--g:${gruppenFarbe(g)}" title="${esc(F()[f].name)}">
            <span class="bl-mini-kopf"></span><span class="bl-mini-name">${esc(F()[f].name.replace(/^Bahnhof /, "Bhf. "))}</span>
            <span class="bl-mini-info">${mein ? (z.haeuser[f] === 5 ? "🏨" : z.haeuser[f] ? "🏠".repeat(z.haeuser[f]) : `${z.miete?.[f] ?? ""} €`) : z.besitz[f] !== undefined ? person(z, z.besitz[f]).avatar : "frei"}</span></button>`;
        }).join("")}</div>`).join("") : '<p class="leise klein-text">Noch keine Karten. Lande auf einem freien Feld und kaufe es!</p>'}</div>`;
    $$("[data-info]", box).forEach((b) => (b.onclick = () => { Ton.klick(); feldInfo(+b.dataset.info); }));
    if (vorher && vorher.geld?.[GN.ich] !== undefined && vorher.geld[GN.ich] !== z.geld[GN.ich]) {
      const el = $("#blGuthaben");
      GN.fx?.zahl(el, vorher.geld[GN.ich], z.geld[GN.ich], { dauer: 800, format: geldText });
      el.classList.add(z.geld[GN.ich] > vorher.geld[GN.ich] ? "plus" : "minus");
    }
  }

  // ---------- Mitspieler: Geld und Besitz als Farbkästchen ----------
  function leuteZeichnen(z) {
    const box = $("#blLeute");
    box.innerHTML = leute(z).filter((t) => t.id !== GN.ich).map((t) => {
      const pleite = z.pleite.includes(t.id);
      const besitz = Object.keys(z.besitz).map(Number).filter((f) => z.besitz[f] === t.id);
      return `<div class="bl-person ${z.dran === t.id ? "dran" : ""} ${pleite ? "pleite" : ""}" style="--b:${farbeVon(z, t.id)}">
        <span class="bl-p-ava">${t.avatar}<em>${z.figurIcon[t.id]}</em></span>
        <span class="bl-p-text"><b>${esc(t.name)}${t.bot ? " 🤖" : ""}${z.knast[t.id] !== undefined ? " 🚔" : ""}</b><small>${pleite ? "pleite" : geldText(z.geld[t.id])}</small></span>
        <span class="bl-p-besitz">${besitz.sort((a, b) => a - b).map((f) => `<i data-info="${f}" style="--g:${gruppenFarbe(F()[f].gruppe || F()[f].art)}" title="${esc(F()[f].name)}${z.haeuser[f] ? ` (${z.haeuser[f] === 5 ? "Hotel" : z.haeuser[f] + " Häuser"})` : ""}">${z.haeuser[f] === 5 ? "H" : z.haeuser[f] || ""}</i>`).join("")}</span>
      </div>`;
    }).join("");
    $$("[data-info]", box).forEach((b) => (b.onclick = () => { Ton.klick(); feldInfo(+b.dataset.info); }));
  }

  // ---------- 2D-Figuren ----------
  function figurenZeichnen(z) {
    const box = $("#blFiguren");
    if (!box) return;
    const brett = $("#blBrett").getBoundingClientRect();
    const mitte = (i, k, n) => {
      const el = $(`.bl-feld[data-feld="${i}"]`);
      const r = el.getBoundingClientRect();
      const versatz = n > 1 ? ((k - (n - 1) / 2) * Math.min(r.width, r.height)) / (n + 1.2) : 0;
      return { x: r.left - brett.left + r.width / 2 + versatz, y: r.top - brett.top + r.height / 2 + versatz * 0.4 };
    };
    const aktive = leute(z).filter((t) => !z.pleite.includes(t.id));
    for (const t of leute(z)) if (z.pleite.includes(t.id)) $(`.bl-figur[data-f="${t.id}"]`, box)?.remove();
    aktive.forEach((t) => {
      let el = $(`.bl-figur[data-f="${t.id}"]`, box);
      if (!el) { el = document.createElement("div"); el.className = "bl-figur"; el.dataset.f = t.id; el.innerHTML = `<span>${z.figurIcon[t.id]}</span>`; el.style.setProperty("--b", farbeVon(z, t.id)); box.appendChild(el); }
      el.classList.toggle("dran", z.dran === t.id);
    });
    const setze = (id, feld) => {
      const el = $(`.bl-figur[data-f="${id}"]`, box);
      if (!el) return;
      const hier = aktive.filter((t) => figurPos[t.id] === feld);
      const p = mitte(feld, hier.findIndex((t) => t.id === id), hier.length);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
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
      if (!schritte) figurPos[id] = bw.nach;
    } else if (!wuerfelLaeuft) {
      for (const t of aktive) if (figurPos[t.id] !== z.figur[t.id]) figurPos[t.id] = z.figur[t.id];
    }
    for (const t of aktive) { if (figurPos[t.id] === undefined) figurPos[t.id] = z.figur[t.id]; setze(t.id, figurPos[t.id]); }
  }
  addEventListener("resize", () => GN.zustand?.spiel === "baulowe" && !mit3d && $("#blFiguren") && figurenZeichnen(GN.zustand));

  // ---------- Aktionsleiste unter dem Brett: was ist jetzt zu tun? ----------
  function panelZeichnen(z) {
    const box = $("#blPanel");
    const ich = z.dran === GN.ich;
    let html = "";
    const wer = `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)}`;
    if (z.angebot) html = `<div class="bl-ansage">🤝 Handel läuft${GN.wartePunkte()}</div>`;
    else if (!ich) html = `<div class="bl-ansage">${wer} ist dran${GN.wartePunkte()}</div>`;
    else if (z.schritt === "wuerfeln") {
      const knast = z.knast[GN.ich] !== undefined;
      html = `<div class="bl-ansage"><b>Du bist dran!</b>${knast ? ` Im Gefängnis (Versuch ${z.knast[GN.ich] + 1}/3)` : z.pasch ? " Pasch – nochmal würfeln!" : ""}</div>
        <div class="bl-knoepfe"><button class="btn gross bl-wurf-knopf" data-a="wuerfeln">🎲 Würfeln</button>
        ${knast ? `<button class="btn zweit" data-a="freikaufen" ${z.geld[GN.ich] < 50 ? "disabled" : ""}>💶 50 € zahlen</button>${z.freiKarten.includes(GN.ich) ? '<button class="btn zweit" data-a="freikarte">🎫 Frei-Karte</button>' : ""}` : ""}</div>`;
    } else if (z.schritt === "kaufen") {
      const i = z.figur[GN.ich], feld = F()[i];
      html = `<div class="bl-kauf">${besitzKarte(z, i, true)}
        <div class="bl-knoepfe spalte"><button class="btn gross" data-a="kaufen" ${z.geld[GN.ich] < feld.preis ? "disabled" : ""}>🏷️ Kaufen für ${geldText(feld.preis)}</button><button class="btn zweit" data-a="nichtKaufen">Nicht kaufen</button>
        <small class="leise">Danach hast du ${geldText(z.geld[GN.ich] - feld.preis)}</small></div></div>`;
    } else if (z.schritt === "zahlen") {
      const s = z.schulden;
      const fehlt = s.betrag - z.geld[GN.ich];
      html = `<div class="bl-ansage warnung"><b>${esc(s.grund)}: ${geldText(s.betrag)}</b><br>${fehlt > 0 ? `Dir fehlen ${geldText(fehlt)}. Tippe rechts auf deine Karten: Häuser verkaufen oder Hypothek aufnehmen.` : "Jetzt reicht es!"}</div>
        <div class="bl-knoepfe"><button class="btn gross" data-a="bezahlen" ${fehlt > 0 ? "disabled" : ""}>💶 Bezahlen</button><button class="btn zweit" data-a="aufgeben">🏳️ Pleite gehen</button></div>`;
    } else if (z.schritt === "fertig") {
      const f = F()[z.figur[GN.ich]];
      html = `<div class="bl-ansage">${f ? `Du stehst auf <b>${esc(f.name)}</b>.` : ""} Bauen? Tippe auf deine Karten.</div>
        <div class="bl-knoepfe"><button class="btn gross" data-a="zugEnde">${z.nochmal ? "🎲 Pasch: weiter" : "✅ Zug beenden"}</button></div>`;
    } else if (z.schritt === "karte") html = `<div class="bl-ansage">🃏 Karte${GN.wartePunkte()}</div>`;
    if (box.dataset.html !== html) {
      box.dataset.html = html; box.innerHTML = html;
      box.classList.toggle("ich", ich && !z.angebot);
      $$("[data-info]", box).forEach((b) => (b.onclick = () => { Ton.klick(); feldInfo(+b.dataset.info); }));
      $$("[data-a]", box).forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        if (a === "aufgeben" && !confirm("Wirklich pleite gehen? Du scheidest aus.")) return;
        Ton[a === "kaufen" ? "richtig" : "klick"]();
        if (a === "kaufen") GN.fx?.funken(b);
        if (a === "wuerfeln") b.disabled = true;
        GN.aktion(a, a === "aufgeben" ? { sicher: true } : undefined);
      }));
    }
  }

  function logZeichnen(z) {
    $("#blLog").innerHTML = z.log.slice(-8).reverse().map((l, i) => `<div style="opacity:${Math.max(0.35, 1 - i * 0.1)}">${esc(l.text)}</div>`).join("");
  }

  // =============================================================
  //  Besitzrechtkarte wie im Original
  // =============================================================
  function besitzKarte(z, i, kompakt = false) {
    const f = F()[i], g = f.gruppe ? G()[f.gruppe] : null;
    const h = z.haeuser[i] || 0, b = z.besitz[i];
    const jetzt = (k) => (b !== undefined && h === k ? "jetzt" : "");
    let inhalt = "";
    if (f.art === "strasse" && kompakt) {
      inhalt = `<div class="bk-zeile gross"><span>Miete</span><b>${f.miete[0]} €</b></div>
        <div class="bk-zeile"><span>Mit Hotel</span><b>${f.miete[5]} €</b></div>
        <div class="bk-zeile klein"><span>Häuser kosten je</span><b>${g.haus} €</b></div>
        <button class="bk-mehr" data-info="${i}">Ganze Karte ansehen</button>`;
    } else if (f.art === "strasse") {
      const voll = b !== undefined && F().every((x, j) => x.gruppe !== f.gruppe || z.besitz[j] === b);
      inhalt = `
        <div class="bk-zeile gross ${b !== undefined && !h && !voll ? "jetzt" : ""}"><span>Miete</span><b>${f.miete[0]} €</b></div>
        <div class="bk-zeile ${b !== undefined && !h && voll ? "jetzt" : ""}"><span>Mit ganzer Farbgruppe</span><b>${f.miete[0] * 2} €</b></div>
        ${["Mit 1 Haus", "Mit 2 Häusern", "Mit 3 Häusern", "Mit 4 Häusern"].map((t, k) => `<div class="bk-zeile ${jetzt(k + 1)}"><span>${t}</span><b>${f.miete[k + 1]} €</b></div>`).join("")}
        <div class="bk-zeile ${jetzt(5)}"><span>Mit Hotel</span><b>${f.miete[5]} €</b></div>
        <div class="bk-trenn"></div>
        <div class="bk-zeile klein"><span>Hypothekenwert</span><b>${f.preis / 2} €</b></div>
        <div class="bk-zeile klein"><span>Häuser kosten je</span><b>${g.haus} €</b></div>
        <div class="bk-zeile klein"><span>Hotels kosten je</span><b>${g.haus} € + 4 Häuser</b></div>
        ${kompakt ? "" : '<p class="bk-hinweis">Besitzt ein Spieler alle Straßen einer Farbgruppe, verdoppelt sich die Miete auf den unbebauten Feldern dieser Gruppe.</p>'}`;
    } else if (f.art === "bahn") {
      const n = b !== undefined ? Object.keys(z.besitz).filter((x) => z.besitz[x] === b && F()[x].art === "bahn").length : 0;
      inhalt = [25, 50, 100, 200].map((m, k) => `<div class="bk-zeile ${n === k + 1 ? "jetzt" : ""}"><span>${k ? `Wenn ${k + 1} Bahnhöfe im Besitz` : "Miete"}</span><b>${m} €</b></div>`).join("")
        + `<div class="bk-trenn"></div><div class="bk-zeile klein"><span>Hypothekenwert</span><b>${f.preis / 2} €</b></div>`;
    } else if (f.art === "werk") {
      inhalt = `<p class="bk-text">Besitzt man <b>ein</b> Werk, beträgt die Miete das <b>4-Fache</b> der gewürfelten Augen.</p>
        <p class="bk-text">Besitzt man <b>beide</b> Werke, beträgt die Miete das <b>10-Fache</b> der gewürfelten Augen.</p>
        <div class="bk-trenn"></div><div class="bk-zeile klein"><span>Hypothekenwert</span><b>${f.preis / 2} €</b></div>`;
    } else {
      inhalt = `<p class="bk-text">${{ start: "Wer über Los kommt oder darauf landet, bekommt 200 €.", ereignis: "Ziehe eine Glück-Karte.", kasse: "Ziehe eine Dorfkasse-Karte.", steuer: `Zahle ${f.betrag} €.`, knast: "Nur zu Besuch – oder du sitzt hier fest.", parken: z.topf ? `Hier liegt der Topf: ${z.topf} €` : "Eine Runde Pause auf dem Dorfplatz.", geheKnast: "Direkt ins Gefängnis, ohne über Los." }[f.art] || ""}</p>`;
    }
    const kopfFarbe = g ? g.farbe : f.art === "bahn" ? "#e9e2cf" : f.art === "werk" ? "#e9e2cf" : "#e9dfc4";
    return `<div class="bl-besitzkarte ${z.hypothek[i] ? "hypothek" : ""} ${kompakt ? "kompakt" : ""}" style="--g:${kopfFarbe}">
      <div class="bk-kopf">${!g && f.icon ? `<span class="bk-icon">${f.icon}</span>` : ""}<small>${kaufbar(f) ? "Besitzrechtkarte" : "Feld"}</small><b>${esc(f.name)}</b>${f.preis ? `<em>Kaufpreis ${f.preis} €</em>` : ""}</div>
      <div class="bk-inhalt">${inhalt}</div>
      ${b !== undefined ? `<div class="bk-besitzer" style="--b:${farbeVon(z, b)}">Gehört ${person(z, b).avatar} <b>${esc(nameVon(z, b))}</b>${z.hypothek[i] ? " · <b>mit Hypothek</b>" : ""}</div>` : kaufbar(f) ? '<div class="bk-besitzer frei">Noch frei</div>' : ""}
    </div>`;
  }

  // Feld antippen: Besitzrechtkarte mit Bauen, Hypothek und einfachem Handel
  function feldInfo(i) {
    const z = GN.zustand;
    const f = F()[i];
    let d = $("#blFeldFenster");
    if (!d) { d = document.createElement("dialog"); d.id = "blFeldFenster"; d.className = "fenster bl-fenster"; document.body.appendChild(d); d.addEventListener("click", (ev) => ev.target === d && d.close()); }
    const b = z.besitz[i], meins = b === GN.ich, ichDran = z.dran === GN.ich;
    const g = f.gruppe ? G()[f.gruppe] : null;
    const h = z.haeuser[i] || 0;
    const gruppe = g ? F().map((x, j) => (x.gruppe === f.gruppe ? j : -1)).filter((j) => j >= 0) : [];
    const voll = g && gruppe.every((j) => z.besitz[j] === GN.ich) && !gruppe.some((j) => z.hypothek[j]);
    const gleich = g && h <= Math.min(...gruppe.map((j) => z.haeuser[j] || 0));
    const bauGrund = !g ? "" : !voll ? "Erst die ganze Farbgruppe sammeln" : !gleich ? "Erst gleichmäßig bauen" : h >= 5 ? "Hotel steht schon" : z.geld[GN.ich] < g.haus ? "Zu wenig Geld" : "";
    const handelbar = b !== undefined && !(gruppe.some((j) => z.haeuser[j] > 0)) && !z.pleite.includes(b);
    const kannHandeln = ichDran && ["wuerfeln", "fertig"].includes(z.schritt) && !z.angebot;
    const vorschlag = Math.round((f.preis || 0) * (b === GN.ich ? 1.1 : 1.2) / 10) * 10;
    let aktionen = "";
    if (meins && (ichDran || z.schulden?.von === GN.ich)) {
      aktionen += `${f.art === "strasse" ? `<button class="btn" data-f="bauen" ${!ichDran || bauGrund ? "disabled" : ""}>🏠 ${h === 4 ? "Hotel" : "Haus"} bauen (${g.haus} €)</button>${bauGrund ? `<small class="leise bl-grund">${bauGrund}</small>` : ""}
        <button class="btn zweit" data-f="verkaufen" ${h ? "" : "disabled"}>Haus verkaufen (+${g.haus / 2} €)</button>` : ""}
        ${z.hypothek[i] ? `<button class="btn zweit" data-f="ausloesen" ${ichDran ? "" : "disabled"}>Hypothek zurückzahlen (${Math.ceil(f.preis / 2 * 1.1)} €)</button>` : f.preis ? `<button class="btn zweit" data-f="hypothek" ${h ? "disabled" : ""}>Hypothek aufnehmen (+${f.preis / 2} €)</button>` : ""}`;
    }
    // Einfacher Handel: fremdes Feld kaufen oder eigenes verkaufen, nur mit Geld
    if (handelbar && b !== GN.ich && leute(z).some((t) => t.id === GN.ich)) {
      aktionen += `<div class="bl-schnellhandel"><b>💰 ${esc(person(z, b).name)} ein Kaufangebot machen</b>
        <div class="bl-sh-zeile"><input type="number" id="blShPreis" min="10" step="10" value="${Math.min(vorschlag, z.geld[GN.ich])}"><span>€</span><button class="btn" id="blShKaufen" ${kannHandeln ? "" : "disabled"}>Anbieten</button></div>
        ${kannHandeln ? "" : '<small class="leise">Handeln geht in deinem Zug (vor dem Würfeln oder danach).</small>'}</div>`;
    }
    if (handelbar && meins) {
      const andere = leute(z).filter((t) => t.id !== GN.ich && !z.pleite.includes(t.id));
      if (andere.length) aktionen += `<div class="bl-schnellhandel"><b>🏷️ Verkaufen an</b>
        <div class="bl-sh-zeile"><select id="blShAn">${andere.map((t) => `<option value="${t.id}">${t.avatar} ${esc(t.name)}</option>`).join("")}</select>
        <input type="number" id="blShVerkauf" min="10" step="10" value="${vorschlag}"><span>€</span><button class="btn" id="blShVerkaufen" ${kannHandeln ? "" : "disabled"}>Anbieten</button></div></div>`;
    }
    d.innerHTML = `<div class="fenster-kopf"><h2>${f.icon || "🏠"} ${esc(f.name)}</h2><button class="icon-btn klein" data-schliessen aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt">${besitzKarte(z, i)}
      ${b !== undefined && b !== GN.ich && kaufbar(f) ? `<p class="bl-jetzt-miete">Wer hier landet, zahlt gerade <b>${f.art === "werk" ? `${z.miete[i] / 7}× die Augenzahl` : `${z.miete[i]} €`}</b></p>` : ""}
      ${aktionen ? `<div class="bl-knoepfe spalte">${aktionen}</div>` : ""}</div>`;
    $("[data-schliessen]", d).onclick = () => d.close();
    $$("[data-f]", d).forEach((x) => (x.onclick = () => { Ton.klick(); GN.aktion(x.dataset.f, i); if (x.dataset.f === "bauen") GN.fx?.funken(x); setTimeout(() => d.open && feldInfo(i), 250); }));
    $("#blShKaufen", d)?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("anbieten", { an: b, gibFelder: [], willFelder: [i], gibGeld: +$("#blShPreis", d).value || 0, willGeld: 0 }); d.close(); });
    $("#blShVerkaufen", d)?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("anbieten", { an: $("#blShAn", d).value, gibFelder: [i], willFelder: [], gibGeld: 0, willGeld: +$("#blShVerkauf", d).value || 0 }); d.close(); });
    if (!d.open) d.showModal();
  }

  // ---------- Übersicht: alle Felder, wem sie gehören, was noch frei ist ----------
  function uebersicht() {
    const z = GN.zustand;
    let d = $("#blUebersichtFenster");
    if (!d) { d = document.createElement("dialog"); d.id = "blUebersichtFenster"; d.className = "fenster bl-fenster breit"; document.body.appendChild(d); d.addEventListener("click", (ev) => ev.target === d && d.close()); }
    const frei = F().filter((f, i) => kaufbar(f) && z.besitz[i] === undefined).length;
    d.innerHTML = `<div class="fenster-kopf"><h2>📋 Alle Felder</h2><button class="icon-btn klein" data-schliessen aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt"><p class="leise klein-text">${frei} von 28 Feldern sind noch frei. Tippe ein Feld für die Besitzrechtkarte.</p>
      <div class="bl-ueb">${GRUPPEN_REIHE().map((g) => `<div class="bl-ueb-gruppe" style="--g:${gruppenFarbe(g)}">
        <div class="bl-ueb-titel">${g === "bahn" ? "🚆 Bahnhöfe" : g === "werk" ? "⚡ Werke" : G()[g].name}</div>
        ${felderDerGruppe(g).map((i) => { const b = z.besitz[i]; return `<button class="bl-ueb-feld" data-info="${i}"><span>${esc(F()[i].name)}</span><em>${F()[i].preis} €</em><b style="${b !== undefined ? `--b:${farbeVon(z, b)}` : ""}" class="${b !== undefined ? "besetzt" : "frei"}">${b !== undefined ? `${person(z, b).avatar} ${esc(nameVon(z, b))}${z.haeuser[i] ? ` · ${z.haeuser[i] === 5 ? "🏨" : "🏠" + z.haeuser[i]}` : ""}` : "frei"}</b></button>`; }).join("")}
      </div>`).join("")}</div></div>`;
    $("[data-schliessen]", d).onclick = () => d.close();
    $$("[data-info]", d).forEach((b) => (b.onclick = () => { Ton.klick(); d.close(); feldInfo(+b.dataset.info); }));
    d.showModal();
  }

  // ---------- Tauschen (mehrere Felder und Geld) ----------
  function handelOeffnen(z) {
    const andere = leute(z).filter((t) => t.id !== GN.ich && !z.pleite.includes(t.id));
    if (!andere.length) return;
    let mit = andere[0].id;
    let d = $("#blHandel");
    if (!d) { d = document.createElement("dialog"); d.id = "blHandel"; d.className = "fenster bl-fenster"; document.body.appendChild(d); }
    const handelbar = (id) => Object.entries(z.besitz).filter(([, b]) => b === id).map(([f]) => +f).filter((f) => { const g = F()[f].gruppe; return !(z.haeuser[f] > 0) && !(g && F().some((x, j) => x.gruppe === g && z.haeuser[j] > 0)); });
    const liste = (id, name) => handelbar(id).map((f) => `<label class="bl-h-feld" style="--g:${gruppenFarbe(F()[f].gruppe || F()[f].art)}"><input type="checkbox" name="${name}" value="${f}"><span>${esc(F()[f].name)}</span></label>`).join("") || '<p class="leise klein-text">Nichts zum Tauschen</p>';
    const kann = z.dran === GN.ich && ["wuerfeln", "fertig"].includes(z.schritt) && !z.angebot;
    const zeichnen = () => {
      d.innerHTML = `<div class="fenster-kopf"><h2>🤝 Tauschen</h2><button class="icon-btn klein" data-schliessen aria-label="Schließen">✕</button></div>
        <div class="fenster-inhalt">
          <p class="leise klein-text">Tipp: Für ein einzelnes Feld einfach auf die Karte tippen und ein Kaufangebot machen.</p>
          <div class="segment bl-h-mit">${andere.map((t) => `<button data-mit="${t.id}" class="${t.id === mit ? "aktiv" : ""}">${t.avatar} ${esc(t.name)}</button>`).join("")}</div>
          <div class="bl-h-spalten">
            <div><div class="unter-titel">Du gibst</div>${liste(GN.ich, "gib")}<label class="bl-h-geld">💶 <input type="number" min="0" max="${z.geld[GN.ich]}" step="10" value="0" id="blGibGeld"></label></div>
            <div><div class="unter-titel">Du willst</div>${liste(mit, "will")}<label class="bl-h-geld">💶 <input type="number" min="0" step="10" value="0" id="blWillGeld"></label></div>
          </div>
          <button class="btn voll" id="blAnbieten" ${kann ? "" : "disabled"}>📨 Angebot schicken</button>
          ${kann ? "" : '<p class="leise klein-text">Tauschen geht in deinem Zug (vor dem Würfeln oder danach).</p>'}
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
    const teil = (seite) => `${seite.felder.map((f) => `<span class="bl-h-chip" style="--g:${gruppenFarbe(F()[f].gruppe || F()[f].art)}">${esc(F()[f].name)}</span>`).join("")}${seite.geld ? `<span class="bl-h-chip geld">${geldText(seite.geld)}</span>` : ""}` || "<em>nichts</em>";
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
    const verz = (a.typ === "karte" || a.typ === "miete" || a.typ === "kauf" || a.typ === "steuer" || a.typ === "topf") && z.bewegung ? 1400 + Math.abs(z.bewegung.schritte) * 200 : 0;
    setTimeout(() => {
      if (GN.ansicht !== "bl-spiel") return;
      const wer = esc(nameVon(z, a.spieler));
      if (a.typ === "karte") {
        Ton.wusch();
        const ov = document.createElement("div");
        ov.className = `bl-ereignis ${a.art}`;
        ov.innerHTML = `<div class="bl-ereignis-karte"><div class="bl-ereignis-kopf">${a.art === "ereignis" ? "❓ Glück" : "💰 Dorfkasse"}</div><p>${esc(a.text)}</p><small>${wer}</small></div>`;
        document.body.appendChild(ov);
        setTimeout(() => ov.classList.add("weg"), 2600);
        setTimeout(() => ov.remove(), 3000);
        ov.onclick = () => ov.remove();
      }
      if (a.typ === "miete") { (a.spieler === GN.ich ? Ton.falsch : a.an === GN.ich ? Ton.richtig : Ton.klick)(); knall(`💸 ${a.betrag} € Miete`, `${wer} → ${esc(nameVon(z, a.an))}`); }
      if (a.typ === "kauf") { Ton.richtig(); knall("🏷️ Gekauft!", `${wer}: ${esc(F()[a.feld].name)}`); if (a.gruppeVoll) setTimeout(() => { Ton.volltreffer(); knall("🎉 Farbgruppe komplett!", "Jetzt kann gebaut werden"); if (a.spieler === GN.ich) GN.konfetti(80); }, 900); }
      if (a.typ === "bauen") { Ton.abgeben(); knall(a.hotel ? "🏨 Hotel!" : "🏠 Neues Haus", `${wer}: ${esc(F()[a.feld].name)}`); }
      if (a.typ === "knast" || (a.typ === "wurf" && a.dreiPasch)) { Ton.alarm(); knall("🚔 Ab ins Gefängnis!", wer); }
      if (a.typ === "topf") { Ton.volltreffer(); knall(`⛲ +${a.betrag} €`, `${wer} räumt den Topf ab`); GN.konfetti(60); }
      if (a.typ === "pleite") { Ton.falsch(); knall("💥 Pleite!", wer); }
      if (a.typ === "handel") { Ton.richtig(); knall("🤝 Handel!", `${wer} & ${esc(nameVon(z, a.an))}`); }
      if (a.typ === "abgelehnt" && a.an === GN.ich) GN.toast(`❌ ${wer} lehnt dein Angebot ab.`);
    }, verz);
  }
  function knall(titel, text) {
    const box = $("#blKnallBox");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "bl-knall"; el.innerHTML = `<b>${titel}</b><span>${text}</span>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  GN.spiele.baulowe = {
    icon: "🎩",
    titel: "Baulöwe",
    kurz: "Straßen kaufen, Häuser bauen, Miete kassieren.",
    beschreibung: "Das Brettspiel für lange Abende, als Schechingen-Edition: Würfeln, Felder kaufen, ganze Farbgruppen sammeln, Häuser und Hotels bauen und mit den anderen handeln. Wer am Ende am reichsten ist, gewinnt.",
    tags: ["🎲 Würfeln", "🏠 Bauen", "🤝 Handeln", "👥 2–6 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
