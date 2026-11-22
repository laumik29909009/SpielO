// =============================================================
//  GoonO – Browser-Teil
//  Eigenes Kartendesign (SpielO), 3D-Tisch, Fächerhand, Effekte
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let hand = [];
  let letzteEffektZeit = 0;
  let austeilenBis = 0, austeilenDauer = 0; // für die Austeil-Animation der eigenen Hand

  const FARBE = { rot: "#ff3b4f", gelb: "#ffc928", gruen: "#22c46b", blau: "#2f8bff", schwarz: "#1b1424" };
  const FARBNAME = { rot: "Rot", gelb: "Gelb", gruen: "Grün", blau: "Blau" };
  const SYMBOL = { aussetzen: "⦸", richtung: "⇄", plus2: "+2", plus4: "+4", farbwahl: "" };
  const NAME = { aussetzen: "Aussetzen", richtung: "Richtungswechsel", plus2: "+2", plus4: "Farbwahl +4", farbwahl: "Farbwahl" };

  GN.socket.on("farbrausch:hand", (h) => {
    hand = h.karten || [];
    const z = GN.zustand;
    if (z?.spiel === "farbrausch" && $(".fr-buehne")) zeichneHand(z);
  });

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);

  // =============================================================
  //  Karte: eigenes Design (Raute in der Mitte, Ecken mit Wert)
  // =============================================================
  function karte(k, { klasse = "", attr = "" } = {}) {
    const schwarz = k.farbe === "schwarz";
    const zeichen = SYMBOL[k.wert] ?? k.wert;
    const mitte = schwarz
      ? `<span class="fk-raute vierfarb">${k.wert === "plus4" ? '<b class="fk-plus">+4</b>' : ""}</span>`
      : `<span class="fk-raute"><b>${zeichen}</b></span>`;
    const ecke = schwarz ? (k.wert === "plus4" ? "+4" : "★") : zeichen;
    return `<div class="fk fk-${k.farbe} ${/^\d$/.test(k.wert) ? "zahl" : "aktion"} ${klasse}" ${attr} style="--fk:${FARBE[k.farbe]}" aria-label="${schwarz ? NAME[k.wert] : `${FARBNAME[k.farbe]} ${NAME[k.wert] || k.wert}`}">
      <span class="fk-ecke o">${ecke}</span>${mitte}<span class="fk-ecke u">${ecke}</span>
      <span class="fk-marke o" aria-hidden="true"></span><span class="fk-marke u" aria-hidden="true"></span>
      ${k.gewaehlt ? `<span class="fk-gewaehlt" style="--g:${FARBE[k.gewaehlt]}"></span>` : ""}
    </div>`;
  }

  // Rückseite mit SpielO-Artwork
  const rueckseite = () => `<span class="fk-ruecken" aria-hidden="true"><span class="fk-r-stein"></span><b>Spiel<i></i></b><small>GoonO</small></span>`;
  GN.farbrauschRueckseite = rueckseite;

  // Dieselbe Karte als Bild für den 3D-Tisch
  function karteBild(k) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 376;
    const x = c.getContext("2d");
    const r = (px, py, w, h, rad) => { x.beginPath(); x.roundRect(px, py, w, h, rad); };
    x.fillStyle = "#fff"; r(0, 0, 256, 376, 26); x.fill();
    x.fillStyle = FARBE[k.farbe]; r(12, 12, 232, 352, 18); x.fill();
    x.save(); x.globalAlpha = 0.12; x.strokeStyle = "#fff"; x.lineWidth = 10;
    for (let i = -400; i < 400; i += 36) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 376, 376); x.stroke(); }
    x.restore();
    x.save(); x.translate(128, 188); x.rotate(Math.PI / 4);
    if (k.farbe === "schwarz") {
      [["rot", -1, -1], ["gelb", 1, -1], ["gruen", -1, 1], ["blau", 1, 1]].forEach(([f, sx, sy]) => { x.fillStyle = FARBE[f]; x.fillRect(sx < 0 ? -78 : 0, sy < 0 ? -78 : 0, 78, 78); });
    } else { x.fillStyle = "#fff"; r(-78, -78, 156, 156, 26); x.fill(); }
    x.restore();
    x.fillStyle = k.farbe === "schwarz" ? "#fff" : FARBE[k.farbe];
    x.font = "900 92px Outfit, system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    const z = k.farbe === "schwarz" ? (k.wert === "plus4" ? "+4" : "") : SYMBOL[k.wert] ?? k.wert;
    if (z) { x.lineWidth = 8; x.strokeStyle = k.farbe === "schwarz" ? "#1b1424" : "#fff"; x.strokeText(z, 128, 194); x.fillText(z, 128, 194); }
    x.fillStyle = "#fff"; x.font = "900 40px Outfit, system-ui, sans-serif";
    const e = k.farbe === "schwarz" ? (k.wert === "plus4" ? "+4" : "★") : z;
    x.fillText(e, 40, 46);
    // SpielO-Stein oben rechts und unten links
    for (const [mx, my] of [[214, 44], [42, 332]]) {
      const g = x.createLinearGradient(mx - 16, my - 16, mx + 16, my + 16); g.addColorStop(0, "#ffc928"); g.addColorStop(1, "#ff3b4f");
      x.fillStyle = "#fff"; x.beginPath(); x.arc(mx, my, 19, 0, Math.PI * 2); x.fill();
      x.fillStyle = g; x.beginPath(); x.arc(mx, my, 15, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(mx, my, 5, 0, Math.PI * 2); x.fill();
    }
    if (k.gewaehlt) { x.fillStyle = FARBE[k.gewaehlt]; x.beginPath(); x.arc(212, 334, 22, 0, Math.PI * 2); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 5; x.stroke(); }
    return c;
  }

  // =============================================================
  //  Lobby
  // =============================================================
  function schalter(id, an, titel, text, dis) {
    return `<button class="schalter" role="switch" aria-checked="${!!an}" data-fr-regel="${id}" ${dis}>
      <span class="schalter-text"><b>${titel}</b><span>${text}</span></span><span class="schalter-knopf"></span></button>`;
  }
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    const menschen = z.spieler.length;
    const max = GN.meta.spiele.farbrausch?.maxTeilnehmer || 8;
    const botsEcht = Math.max(menschen < 2 ? 1 : 0, Math.min(e.bots, max - menschen));
    const regelnAn = ["stapeln", "bisPasst", "siebenNull", "einwerfen"].filter((r) => e[r]).length;
    return [
      {
        id: "spieler", wichtig: true, icon: "🤖", titel: "Mitspieler", info: `${menschen} ${menschen === 1 ? "Mensch" : "Menschen"} + ${botsEcht} Computer · max. ${max}`,
        html: `<div class="unter-titel">Computer-Gegner</div>
          <div class="segment">${[0, 1, 2, 3, 4, 5].map((n) => `<button data-fr-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div>
          <p class="leise klein-text" style="margin-top:8px">${menschen > max ? `⚠️ GoonO geht mit höchstens ${max} Spielern.` : `2 bis ${max} Spieler am Tisch. Solo spielst du gegen den Computer.`}</p>`,
      },
      {
        id: "runde", wichtig: true, icon: "🎯", titel: "Spiel", info: `${e.startKarten} Startkarten · ${e.ziel ? `bis ${e.ziel} Punkte` : "1 Runde"} · ${e.sekunden ? e.sekunden + " s pro Zug" : "ohne Zeitlimit"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Startkarten</div><div class="segment">${[5, 7, 10].map((n) => `<button data-fr-start="${n}" class="${e.startKarten === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Spielziel</div><div class="segment">${[[0, "1 Runde"], [200, "200 Punkte"], [500, "500 Punkte"]].map(([n, t]) => `<button data-fr-ziel="${n}" class="${e.ziel === n ? "aktiv" : ""}" ${dis}>${t}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[15, 30, 0].map((n) => `<button data-fr-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
        </div>`,
      },
      {
        id: "hausregeln", wichtig: true, icon: "🏠", titel: "Hausregeln", info: regelnAn ? `${regelnAn} aktiv` : "Klassisch",
        html: `<div class="schalter-liste">
          ${schalter("stapeln", e.stapeln, "➕ Stapeln", "+2 auf +2 (und +4 auf +4) legen und die Strafe weiterreichen.", dis)}
          ${schalter("bisPasst", e.bisPasst, "🎣 Ziehen, bis es passt", "Wer nicht kann, zieht so lange, bis eine passende Karte kommt.", dis)}
          ${schalter("siebenNull", e.siebenNull, "🔄 7 tauscht, 0 gibt weiter", "Mit einer 7 tauschst du die Hand mit dem, der die wenigsten Karten hat. Mit einer 0 geben alle ihre Hand weiter.", dis)}
          ${schalter("einwerfen", e.einwerfen, "⚡ Einwerfen", "Hast du genau dieselbe Karte (Farbe und Wert), darfst du sie sofort legen, auch wenn du nicht dran bist.", dis)}
        </div>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "Farbe oder Zahl bedienen",
        html: `<ol class="q-regeln">
          <li>Lege eine Karte mit <b>derselben Farbe, Zahl oder demselben Symbol</b> wie die oberste Karte.</li>
          <li><b>Farbwahl</b> passt immer. Danach bestimmst du die Farbe. <b>+4</b>: Der Nächste zieht 4.</li>
          <li><b>⦸ Aussetzen</b>: Der Nächste ist raus. <b>⇄ Richtungswechsel</b>: Es geht andersherum weiter. <b>+2</b>: Der Nächste zieht 2.</li>
          <li>Kannst du nicht, ziehst du eine Karte. Passt sie, darfst du sie sofort legen.</li>
          <li>Hast du nur noch eine Karte, drück <b>„Letzte Karte!“</b>. Wer es vergisst und erwischt wird, zieht 2.</li>
          <li>Wer zuerst alle Karten los ist, gewinnt die Runde und bekommt die Punkte der anderen: Zahl = Augenzahl, Aktion = 20, Farbwahl = 50.</li>
        </ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-fr-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.frBots })));
    $$("[data-fr-start]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ startKarten: +b.dataset.frStart })));
    $$("[data-fr-ziel]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ ziel: +b.dataset.frZiel })));
    $$("[data-fr-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.frSek })));
    $$("[data-fr-regel]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ [b.dataset.frRegel]: b.getAttribute("aria-checked") !== "true" })));
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (!GN.ansicht.startsWith("farbrausch-podest")) {
        effekte(z);
        setTimeout(() => GN.zustand?.phase === "ende" && !GN.ansicht.startsWith("farbrausch-podest") && GN.podest("farbrausch-podest", { einheit: "Punkte" }), 2200);
        GN.ansicht = "farbrausch-ende";
      } else GN.rangliste($("#rangliste"));
      return;
    }
    if (!$(".fr-buehne") || !GN.ansicht.startsWith("farbrausch-spiel")) aufbauen(z);
    aktualisieren(z, vorher);
  }

  function aufbauen(z) {
    GN.ansicht = "farbrausch-spiel";
    GN.stoppeTimer();
    app.innerHTML = `
      <div class="fr-buehne q-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🌈 GoonO</span>
          <span class="runden-nr" id="frRunde"></span>
          <button class="q-3d-knopf" id="fr3dKnopf" title="Zwischen 3D-Tisch und einfacher Ansicht wechseln">${QuartettTisch3D.moeglich() ? "2D" : "3D"}</button>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="q-szene fr-szene" id="frSzene">
          <div class="q-sitze" id="frSitze"></div>
          <div class="fr-mitte" id="frMitte"></div>
          <div class="fr-effekt" id="frEffekt" aria-live="polite"></div>
        </div>
        <div class="fr-ich" id="frIch">
          <div class="fr-aktionen" id="frAktionen"></div>
          <div class="fr-hand" id="frHand" role="listbox" aria-label="Deine Karten"></div>
        </div>
      </div>`;
    $("#fr3dKnopf").onclick = () => { Ton.klick(); QuartettTisch3D.umschalten(); GN.ansicht = ""; zeige(GN.zustand, null); };
    if (QuartettTisch3D.moeglich()) {
      $("#frSzene").classList.add("drei");
      QuartettTisch3D.einhaengen($("#frSzene")).then((t) => {
        t.karteBild = karteBild;
        if (t.fr) t.fr.letzteT = 0; // Ablage neu aufbauen
        if (GN.ansicht.startsWith("farbrausch-spiel")) aktualisieren(GN.zustand, null);
      }).catch(() => $("#frSzene")?.classList.remove("drei"));
    }
  }

  function aktualisieren(z, vorher) {
    $("#frRunde").textContent = `Runde ${z.runde}${z.ziel ? ` · Ziel ${z.ziel} P.` : ""}`;
    const drei = $("#frSzene.drei") && QuartettTisch3D.tisch;
    if (drei) {
      QuartettTisch3D.tisch.karteBild ||= karteBild;
      QuartettTisch3D.tisch.aktualisieren({ ...z, spiel: "farbrausch" }, GN.ich);
      $("#frSitze").innerHTML = "";
    } else zeichneSitze(z);
    zeichneMitte(z, !drei);
    zeichneHand(z);
    effekte(z);
    // Timer
    const neuerZug = !vorher || vorher.zug !== z.zug;
    if (neuerZug || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.phase === "spielen" && z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000, tonAus: () => GN.zustand?.dran !== GN.ich }); }
      else GN.ohneZeitlimit();
      if (z.dran === GN.ich && z.phase === "spielen" && neuerZug && vorher) { Ton.ding(); navigator.vibrate?.(40); }
    }
    if (z.phase === "rundenende") rundenEnde(z);
  }

  // 2D-Ansicht: Sitze als Figuren-Chips
  function zeichneSitze(z) {
    const box = $("#frSitze");
    const andere = leute(z).filter((t) => t.id !== GN.ich);
    box.className = `q-sitze anzahl-${Math.min(andere.length, 3)} fr-sitze`;
    box.innerHTML = andere.map((t, i) => `
      <div class="q-sitz ${z.dran === t.id && z.phase === "spielen" ? "dran" : ""} ${t.online ? "" : "offline"}" data-teilnehmer="${t.id}" style="--i:${i}">
        <div class="q-figur"><span class="q-figur-schatten"></span><span class="q-figur-koerper">${t.avatar}</span>
          ${z.gerufen?.includes(t.id) && t.karten === 1 ? '<span class="q-blase">Letzte Karte!</span>' : ""}</div>
        <div class="q-schild"><b>${esc(t.name)}</b><span>🃏 ${t.karten}${z.ziel ? ` · ${t.punkte} P.` : ""}${t.bot ? " · 🤖" : ""}</span></div>
      </div>`).join("");
  }

  // Mitte: aktuelle Farbe, Richtung, Strafe und (in 2D) Stapel + Ablage
  function zeichneMitte(z, mitKarten) {
    const box = $("#frMitte");
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    box.innerHTML = `
      ${mitKarten ? `<div class="fr-stapel-reihe">
        <button class="fr-ziehstapel" id="frStapel" ${ichDran ? "" : "disabled"} aria-label="Karte ziehen">${rueckseite()}<span class="fr-stapel-zahl">${z.stapelAnzahl}</span></button>
        <div class="fr-ablage">${karte(z.oben, { klasse: "gross" })}</div>
      </div>` : ""}
      <div class="fr-status">
        <span class="fr-farbe" style="--f:${FARBE[z.farbe]}" title="Aktuelle Farbe">${FARBNAME[z.farbe] || ""}</span>
        <span class="fr-richtung ${z.richtung < 0 ? "links" : ""}" title="Spielrichtung">${z.richtung < 0 ? "↺" : "↻"}</span>
        ${z.strafe ? `<span class="fr-strafe">+${z.strafe}</span>` : ""}
      </div>
      <div class="fr-ansage">${z.phase !== "spielen" ? "" : ichDran ? (z.strafe ? `<b>Du musst ${z.strafe} ziehen</b>${z.regeln.stapeln ? " oder weiterreichen" : ""}` : "<b>Du bist dran!</b>") : `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)} ist dran${GN.wartePunkte()}`}</div>`;
    $("#frStapel")?.addEventListener("click", ziehen);
  }

  // Darf diese Karte gerade gelegt werden?
  function passt(z, k) {
    const o = z.oben;
    if (z.dran !== GN.ich) return !!(z.regeln.einwerfen && !z.strafe && k.farbe !== "schwarz" && k.farbe === o.farbe && k.wert === o.wert);
    if (z.gezogenDiesenZug && k.id !== z.gezogenDiesenZug) return false;
    if (z.strafe > 0) return z.regeln.stapeln && (o.wert === "plus4" ? k.wert === "plus4" : k.wert === "plus2" || k.wert === "plus4");
    return k.farbe === "schwarz" || k.farbe === z.farbe || k.wert === o.wert;
  }

  // Hand: Fächer, passende Karten heben sich leicht an
  function zeichneHand(z) {
    const box = $("#frHand");
    if (!box) return;
    const ich = leute(z).find((t) => t.id === GN.ich);
    if (!ich) { box.innerHTML = '<div class="q-hinweis">👀 Du schaust diese Partie zu.</div>'; $("#frAktionen").innerHTML = ""; return; }
    // Sortiert nach Farbe und Wert, damit man den Überblick behält
    const reihenfolge = { rot: 0, gelb: 1, gruen: 2, blau: 3, schwarz: 4 };
    const karten = [...hand].sort((a, b) => reihenfolge[a.farbe] - reihenfolge[b.farbe] || String(a.wert).localeCompare(String(b.wert), "de", { numeric: true }));
    const n = karten.length;
    const breite = Math.min(innerWidth - 24, 900);
    const kartenBreite = Math.min(118, Math.max(70, breite / 5.2));
    const abstand = n > 1 ? Math.min(kartenBreite * 0.62, (breite - kartenBreite) / (n - 1)) : 0;
    const winkelProKarte = Math.min(6, 60 / Math.max(1, n));
    box.style.setProperty("--kb", kartenBreite + "px");
    const austeilen = Date.now() < austeilenBis;
    box.classList.toggle("austeilen", austeilen);
    box.innerHTML = karten.map((k, i) => {
      const m = i - (n - 1) / 2;
      const ok = z.phase === "spielen" && passt(z, k);
      return `<button class="fr-handkarte ${ok ? "spielbar" : ""}" data-karte="${k.id}" ${ok ? "" : 'aria-disabled="true"'}
        style="--x:${m * abstand}px;--r:${m * winkelProKarte}deg;--y:${Math.abs(m) * Math.abs(m) * 0.9}px;--z:${i};--v:${austeilen ? Math.round(((austeilenBis - Date.now()) * 0.85 * i) / Math.max(1, n)) : 0}ms">${karte(k)}</button>`;
    }).join("");
    $$(".fr-handkarte", box).forEach((b) => (b.onclick = () => legen(b.dataset.karte)));
    // Aktionsknöpfe
    const a = $("#frAktionen");
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    const kannRufen = hand.length <= 2 && !z.gerufen?.includes(GN.ich) && z.phase === "spielen";
    const erwischbar = z.erwischbar && z.erwischbar.spieler !== GN.ich;
    a.innerHTML = `
      ${ichDran && !z.gezogenDiesenZug ? `<button class="btn zweit" id="frZiehen">🃏 ${z.strafe ? `${z.strafe} Karten ziehen` : "Karte ziehen"}</button>` : ""}
      ${ichDran && z.gezogenDiesenZug ? `<button class="btn zweit" id="frBehalten">✋ Behalten, weiter</button>` : ""}
      ${kannRufen ? `<button class="btn fr-ruf" id="frRuf">📣 Letzte Karte!</button>` : ""}
      ${erwischbar ? `<button class="btn fr-erwischt" id="frErwischt">👀 Erwischt! ${esc(person(z, z.erwischbar.spieler).name)} hat nicht gerufen</button>` : ""}
      <span class="fr-anzahl">Du hast <b>${hand.length}</b> ${hand.length === 1 ? "Karte" : "Karten"}</span>`;
    $("#frZiehen")?.addEventListener("click", ziehen);
    $("#frBehalten")?.addEventListener("click", () => { Ton.klick(); GN.aktion("behalten"); });
    $("#frRuf")?.addEventListener("click", () => { Ton.alarm(); navigator.vibrate?.([60, 40, 60]); GN.aktion("letzteKarte"); });
    $("#frErwischt")?.addEventListener("click", () => { Ton.klick(); GN.aktion("erwischt"); });
  }

  function ziehen() {
    const z = GN.zustand;
    if (z.dran !== GN.ich || z.gezogenDiesenZug) return;
    Ton.wusch();
    GN.aktion("ziehen");
  }

  async function legen(id) {
    const z = GN.zustand;
    const k = hand.find((x) => x.id === id);
    if (!k || !passt(z, k)) { Ton.falsch(); return GN.toast(z.dran === GN.ich ? "Die Karte passt nicht." : "Du bist nicht dran."); }
    let farbe = null;
    if (k.farbe === "schwarz") { farbe = await farbeWaehlen(); if (!farbe) return; }
    // Karte fliegt sofort los (der Server bestätigt gleich)
    const el = $(`.fr-handkarte[data-karte="${id}"]`);
    if (el) {
      const ziel = ($(".fr-ablage") || $("#frSzene")).getBoundingClientRect(), r = el.getBoundingClientRect();
      el.animate([{ transform: getComputedStyle(el).transform, opacity: 1 }, { transform: `translate(${ziel.left + ziel.width / 2 - r.left - r.width / 2}px, ${ziel.top + ziel.height / 2 - r.top - r.height / 2}px) rotate(${(Math.random() - 0.5) * 40}deg) scale(.7)`, opacity: 0.2 }], { duration: 380, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" });
    }
    Ton.abgeben();
    if (hand.length === 2 && !z.gerufen?.includes(GN.ich)) GN.toast("Tipp: Drück „Letzte Karte!“, sonst kann man dich erwischen!");
    GN.aktion("legen", { karte: id, farbe });
  }

  // Farbe wählen (für Farbwahl und +4)
  function farbeWaehlen() {
    return new Promise((ok) => {
      const d = document.createElement("div");
      d.className = "fr-farbwahl";
      d.innerHTML = `<div class="fr-farbwahl-karte"><b>Welche Farbe?</b>
        <div class="fr-farbwahl-raster">${Object.keys(FARBNAME).map((f) => `<button data-f="${f}" style="--f:${FARBE[f]}">${FARBNAME[f]}</button>`).join("")}</div>
        <button class="btn link" data-f="">Abbrechen</button></div>`;
      document.body.appendChild(d);
      $$("[data-f]", d).forEach((b) => (b.onclick = () => { d.remove(); if (b.dataset.f) Ton.klick(); ok(b.dataset.f || null); }));
    });
  }

  // =============================================================
  //  Effekte: Aussetzen, Richtung, +2/+4, Farbwechsel, Rufe
  // =============================================================
  function effekte(z) {
    const a = z.letzteAktion;
    if (!a || a.t === letzteEffektZeit) return;
    const erstes = !letzteEffektZeit;
    letzteEffektZeit = a.t;
    if (erstes && a.typ !== "austeilen") return;
    const box = $("#frEffekt");
    const zeige = (html, klasse = "", dauer = 1400) => {
      if (!box) return;
      const el = document.createElement("div");
      el.className = "fr-knall " + klasse;
      el.innerHTML = html;
      box.appendChild(el);
      setTimeout(() => el.remove(), dauer);
    };
    if (a.typ === "austeilen") {
      austeilenDauer = z.austeilenMs || a.dauer || 2500;
      austeilenBis = Date.now() + austeilenDauer;
      zeige(`<b>🃏 Karten werden verteilt …</b>`, "info", Math.min(2400, austeilenDauer));
      // Kartengeräusche im Takt des Austeilens
      const n = Math.min(24, (a.karten || 7) * leute(z).length);
      for (let i = 0; i < n; i++) setTimeout(() => Ton.klick(), (i * austeilenDauer * 0.85) / n);
      zeichneHand(z);
      return;
    }
    if (a.typ === "legen") {
      Ton.wusch();
      const k = a.karte;
      if (a.einwurf) zeige(`<b>⚡ Eingeworfen!</b><span>${esc(nameVon(z, a.spieler))}</span>`, "gold");
      const e = a.effekt;
      if (e?.typ === "aussetzen") { zeige(`<b class="riesig">⦸</b><span>${esc(nameVon(z, e.ziel))} ${e.ziel === GN.ich ? "setzt" : "setzt"} aus!</span>`, "stempel"); Ton.falsch(); }
      if (e?.typ === "richtung") { zeige(`<b class="riesig dreh">⇄</b><span>Richtungswechsel!</span>`, "dreh"); Ton.rundeStart(); }
      if (e?.typ === "plus2" || e?.typ === "plus4") {
        grossMoment(e.typ, e.summe || (e.typ === "plus4" ? 4 : 2), e.ziel === GN.ich
          ? (z.regeln.stapeln ? "Du musst ziehen, außer du legst nach!" : "Du ziehst und setzt aus!")
          : `${esc(nameVon(z, e.ziel))} ${z.regeln.stapeln ? "muss ziehen" : "zieht und setzt aus"}`, e.ziel === GN.ich);
        Ton.alarm();
        if (e.ziel === GN.ich) navigator.vibrate?.([120, 60, 120, 60, 200]);
      }
      if (e?.typ === "tausch") zeige(`<b>🔄 Handtausch!</b><span>${esc(nameVon(z, a.spieler))} ↔ ${esc(nameVon(z, e.ziel))}</span>`, "gold");
      if (e?.typ === "weitergeben") zeige(`<b>🔄 Alle Hände wandern weiter!</b>`, "gold");
      if (k.farbe === "schwarz" && k.gewaehlt) {
        zeige(`<b>Farbe: ${FARBNAME[k.gewaehlt]}</b>`, "farbe", 1500);
        $("#frSzene")?.style.setProperty("--welle", FARBE[k.gewaehlt]);
        $("#frSzene")?.classList.remove("farbwelle"); void $("#frSzene")?.offsetWidth; $("#frSzene")?.classList.add("farbwelle");
      }
    }
    if (a.typ === "ziehen" && a.anzahl > 1) zeige(`<b>🃏 +${a.anzahl}</b><span>${esc(nameVon(z, a.spieler))} ${a.spieler === GN.ich ? "ziehst" : "zieht"} ${a.anzahl} Karten</span>`, "info", 1200);
    if (a.typ === "ziehen" && a.anzahl === 1) Ton.klick();
    if (a.typ === "ruf") { zeige(`<b>📣 Letzte Karte!</b><span>${esc(nameVon(z, a.spieler))}</span>`, "ruf"); Ton.volltreffer(); }
    if (a.typ === "erwischt") { zeige(`<b>👀 Erwischt!</b><span>${esc(nameVon(z, a.ziel))} zieht 2 Strafkarten</span>`, "plus2"); Ton.falsch(); }
  }

  // Großer Vollbild-Moment bei +2/+4: riesige Zahl, Blitz, Wackeln
  function grossMoment(typ, summe, text, ichBinZiel) {
    const el = document.createElement("div");
    el.className = `fr-gross ${typ} ${ichBinZiel ? "ich" : ""}`;
    el.innerHTML = `<div class="fr-gross-blitz"></div><b>+${summe}</b><span>${text}</span>`;
    document.body.appendChild(el);
    $(".fr-buehne")?.animate([{ transform: "translate(0,0)" }, { transform: "translate(-10px,6px)" }, { transform: "translate(9px,-6px)" }, { transform: "translate(-6px,3px)" }, { transform: "translate(0,0)" }], { duration: 420 });
    setTimeout(() => el.remove(), ichBinZiel ? 2000 : 1500);
  }

  function rundenEnde(z) {
    const r = z.letzteRunde;
    if (!r || $(".fr-rundenende")) return;
    const sieger = person(z, r.gewinner);
    const ov = document.createElement("div");
    ov.className = "fr-rundenende";
    ov.innerHTML = `<div class="fr-rundenende-karte">
      <div class="fr-re-avatar">${sieger.avatar}</div>
      <b>${r.gewinner === GN.ich ? "Du gewinnst die Runde!" : `${esc(sieger.name)} gewinnt die Runde!`}</b>
      <span>+${r.punkte} Punkte</span>
      <div class="fr-re-liste">${[...leute(z)].sort((a, b) => b.punkte - a.punkte).map((t) => `<div><span>${t.avatar} ${esc(t.name)}</span><b>${t.punkte} P.</b></div>`).join("")}</div>
      <span class="leise klein-text">Nächste Runde startet gleich${GN.wartePunkte()}</span></div>`;
    document.body.appendChild(ov);
    GN.konfetti(r.gewinner === GN.ich ? 160 : 60);
    Ton.fanfare();
    const weg = setInterval(() => { if (GN.zustand?.phase !== "rundenende") { clearInterval(weg); ov.remove(); } }, 300);
  }

  GN.spiele.farbrausch = {
    icon: "🌈",
    titel: "GoonO",
    kurz: "Der Karten-Klassiker: Farbe oder Zahl bedienen.",
    beschreibung: "Farbe oder Zahl bedienen, Aktionskarten ausspielen und als Erster alle Karten loswerden. Am 3D-Tisch, mit Hausregeln nach eurem Geschmack.",
    tags: ["🃏 108 Karten", "🏠 Hausregeln", "🤖 Auch gegen Computer", "👥 2–8 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
