// =============================================================
//  Quartett – Browser-Teil
//  Karten, Lobby, Spielansicht und Kampf-Animationen
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let hand = { karten: [], anzahl: 0, runde: 0 }; // eigene Handkarten (kommen privat vom Server)
  let galerieDeck = null;

  const meta = () => GN.meta.spiele.quartett || { decks: [] };
  const deckVon = (id) => meta().decks.find((d) => d.id === id) || meta().decks[0];
  const karteVon = (deck, id) => deck.karten.find((k) => k.id === id);
  const gruppeVon = (deck, k) => deck.gruppen.find((g) => g.id === k.gruppe);
  const maxWerte = {};
  const maxWert = (deck, i) => (maxWerte[deck.id + i] ??= Math.max(...deck.karten.map((k) => k.w[i])));
  // Seltenheit: nur nach den zusammengezählten Punkten. Jeder Wert zählt im Verhältnis
  // zum besten Wert im Deck (sonst würden km/h oder Meter alles andere überragen).
  //   oberste 10 % legendär · nächste 15 % episch · 20 % selten · 25 % häufig · Rest gewöhnlich
  const STUFEN = {
    gewoehnlich: { name: "Gewöhnlich", zeichen: "●" }, haeufig: { name: "Häufig", zeichen: "◆" }, selten: { name: "Selten", zeichen: "◆◆" },
    episch: { name: "Episch", zeichen: "★★" }, legendaer: { name: "Legendär", zeichen: "★★★" },
  };
  const ANTEILE = [["legendaer", 0.1], ["episch", 0.25], ["selten", 0.45], ["haeufig", 0.7], ["gewoehnlich", 1]];
  const stufenCache = {};
  const gesamtPunkte = (deck, k) => k.w.reduce((a, v, i) => a + v / maxWert(deck, i), 0);
  function stufeVon(deck, k) {
    if (!stufenCache[deck.id]) {
      const sortiert = deck.karten.map((x) => gesamtPunkte(deck, x)).sort((a, b) => b - a);
      // Grenzwerte: die Punktzahl, ab der eine Stufe beginnt
      stufenCache[deck.id] = ANTEILE.map(([stufe, anteil]) => [stufe, sortiert[Math.max(0, Math.ceil(sortiert.length * anteil) - 1)]]);
    }
    const p = gesamtPunkte(deck, k);
    return stufenCache[deck.id].find(([, grenze]) => p >= grenze - 1e-9)?.[0] || "gewoehnlich";
  }
  // Champion: Die Karte mit dem besten Wert einer Kategorie im ganzen Deck (bei Gleichstand alle)
  const championCache = {};
  function championVon(deck, k) {
    championCache[deck.id] ||= deck.werte.map((_, i) => maxWert(deck, i));
    return championCache[deck.id].map((m, i) => (k.w[i] === m ? i : -1)).filter((i) => i >= 0);
  }
  const zahl = (v, w) => `${v.toLocaleString("de-DE")}${w.einheit ? `<small> ${w.einheit}</small>` : ""}`;
  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  GN.socket.on("quartett:hand", (h) => {
    hand = h;
    const z = GN.zustand;
    if (z?.spiel === "quartett" && (z.phase === "waehlen" || z.phase === "kontern")) zeigeHand(z);
  });

  // =============================================================
  //  Karte (HTML)
  // =============================================================
  function karte(deck, k, { klickbar = false, klasse = "" } = {}) {
    const g = gruppeVon(deck, k);
    const tag = klickbar ? "button" : "div";
    const stufe = stufeVon(deck, k);
    const champ = championVon(deck, k);
    return `
      <div class="qkarte stufe-${stufe} ${stufe === "legendaer" || stufe === "episch" ? "selten" : ""} ${champ.length ? "champion" : ""} ${klasse}" title="${STUFEN[stufe].name}: ${Math.round(gesamtPunkte(deck, k) * 20)} von 100 Gesamtpunkten" data-karte="${k.id}" style="--typ:${g.farbe};--typ2:${g.farbe2}">
        ${stufe === "legendaer" ? '<div class="qk-aura" aria-hidden="true"></div>' : ""}
        <div class="qk-innen">
          <div class="qk-kopf"><span class="qk-code">${k.id}</span><span class="qk-name">${esc(k.name)}</span><span class="qk-typ" title="${esc(g.name)}">${g.icon}</span></div>
          <div class="qk-bild ${deck.fotos?.[k.id]?.frei ? "frei" : ""}">${deck.fotos?.[k.id]
            ? `${deck.fotos[k.id].frei ? QuartettBilder.bild(deck, k, { nurSzene: true }) : ""}<img src="${deck.fotos[k.id].url}" alt="${esc(k.name)}" loading="lazy" draggable="false">`
            : QuartettBilder.bild(deck, k)}${deck.platzhalter && !deck.fotos?.[k.id] ? '<span class="qk-platzhalter">Bild folgt</span>' : ""}${stufe === "legendaer" ? '<span class="qk-funkeln" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' : ""}${champ.length ? `<span class="qk-champion" title="Bester Wert im ganzen Deck">👑 ${champ.map((i) => esc(deck.werte[i].name)).join(" & ")}-Champion</span>` : ""}</div>
          <div class="qk-unter">${esc(g.name)}${k.stil ? ` · ${esc(k.stil)}` : ""}</div>
          <div class="qk-werte">
            ${deck.werte.map((w, i) => `
              <${tag} class="qk-wert ${champ.includes(i) ? "bester" : ""}" data-wert="${i}" ${klickbar ? `aria-label="${esc(w.name)}: ${k.w[i]} wählen"` : ""}>
                <span class="qk-w-icon">${w.icon}</span><span class="qk-w-name">${esc(w.name)}</span>
                <span class="qk-w-balken"><i style="width:${Math.round((k.w[i] / maxWert(deck, i)) * 100)}%"></i></span>
                <b class="qk-w-zahl" data-ziel="${k.w[i]}">${zahl(k.w[i], w)}</b>
              </${tag}>`).join("")}
          </div>
          <div class="qk-text">${esc(k.text)}</div>
          <div class="qk-fuss"><span class="qk-stufe">${STUFEN[stufe].zeichen} ${STUFEN[stufe].name}</span><span>⚔️ ${esc(k.angriff?.name || "")}</span><span>${k.id} · ${deck.karten.length}</span></div>
        </div>
        <div class="qk-glanz" aria-hidden="true"></div>
      </div>`;
  }
  // Hinweis auf Rechte für lizenzierte Decks (Lobby & Galerie)
  const lizenzZeile = (d) => (d.lizenz ? `<span class="q-lizenz">${esc(d.lizenz)}</span>` : "");
  const rueckseite = (deck, klasse = "") => `
    <div class="qkarte rueckseite ${klasse}" style="--typ:${deck.gruppen[0].farbe};--typ2:${deck.gruppen[3].farbe}">
      <div class="qk-ruecken"><span class="qk-r-icon">${deck.icon}</span><b>SpielO</b><span>Quartett</span></div>
    </div>`;

  // Karte folgt dem Finger/der Maus (3D-Kippen und Holo-Glanz)
  function kippen(el) {
    if (!el || ruhig()) return;
    const setze = (x, y) => {
      el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    };
    el.addEventListener("pointermove", (ev) => {
      const r = el.getBoundingClientRect();
      setze((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
      el.classList.add("gekippt");
    });
    el.addEventListener("pointerleave", () => { el.classList.remove("gekippt"); setze(0.5, 0.5); });
  }

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    const deck = deckVon(e.deck);
    const menschen = z.spieler.length;
    const botsEcht = Math.max(menschen < 2 ? 1 : 0, Math.min(e.bots, 4 - menschen));
    return [
      {
        id: "deck", wichtig: true, icon: "🃏", titel: "Kartendeck", info: `${deck.icon} ${deck.name} · ${deck.karten.length} Karten`,
        html: `<div class="q-deck-wahl">
          ${meta().decks.map((d) => {
            const vorschau = [...d.karten].sort((a, b) => gesamtPunkte(d, b) - gesamtPunkte(d, a)).slice(0, 3);
            return `<button class="q-deck ${e.deck === d.id ? "aktiv" : ""}" data-deck="${d.id}" ${dis}>
              <span class="q-deck-faecher">${vorschau.map((k, i) => `<span style="--i:${i}">${karte(d, k, { klasse: "mini" })}</span>`).join("")}</span>
              <span class="q-deck-text"><b>${d.icon} ${esc(d.name)}</b><span>${esc(d.beschreibung)}</span>${lizenzZeile(d)}
                <span class="q-deck-werte">${d.werte.map((w) => `<span>${w.icon} ${esc(w.name)}</span>`).join("")}</span></span>
            </button>`;
          }).join("")}
        </div>
        <button class="btn zweit klein" data-galerie="${deck.id}" style="margin-top:10px">🔍 Alle ${deck.karten.length} Karten ansehen</button>`,
      },
      {
        id: "gegner", wichtig: true, icon: "🤖", titel: "Mitspieler", info: `${menschen} ${menschen === 1 ? "Mensch" : "Menschen"} + ${botsEcht} Computer`,
        html: `<div class="unter-titel">Computer-Gegner</div>
          <div class="segment">${[0, 1, 2, 3].map((n) => `<button data-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div>
          <p class="leise klein-text" style="margin-top:8px">${menschen > 4
            ? `⚠️ Quartett geht mit höchstens 4 Spielern. Gerade seid ihr ${menschen}.`
            : "Quartett wird zu zweit bis zu viert gespielt. Computer-Gegner füllen freie Plätze auf. Solo spielst du immer gegen den Computer."}</p>`,
      },
      {
        id: "runden", wichtig: true, icon: "⏱️", titel: "Hand, Spielende & Zeit",
        info: `${e.hand > 1 ? `${e.hand} Handkarten` : "Klassisch"} · ${e.runden ? `${e.runden} Runden` : "Bis einer alle Karten hat"} · ${e.sekunden ? `${e.sekunden} s zum Wählen` : "Wählen ohne Zeitlimit"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Karten auf der Hand</div>
            <div class="segment">${[1, 2, 3].map((n) => `<button data-qhand="${n}" class="${(e.hand || 1) === n ? "aktiv" : ""}" ${dis}>${n === 1 ? "1 (klassisch)" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Spielende</div>
            <div class="segment">${[15, 25, 40, 0].map((n) => `<button data-qrunden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n ? n + " Runden" : "Alle Karten"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit zum Wählen</div>
            <div class="segment">${[10, 20, 30, 0].map((n) => `<button data-qsek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
        </div>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "Höchster Wert gewinnt",
        html: `<ol class="q-regeln">
          <li>Alle Karten werden gemischt und verteilt. Du siehst nur deine Handkarten (1–3, je nach Einstellung).</li>
          <li>Wer dran ist, wählt eine seiner Handkarten und sagt einen Wert an, z. B. <b>Tempo</b>.</li>
          <li><b>Kontern:</b> Mit mehreren Handkarten sucht sich danach jeder aus, welche Karte er dagegen legt.</li>
          <li>Alle decken auf: <b>Der höchste Wert gewinnt</b> alle Karten der Runde und ist als Nächstes dran.</li>
          <li><b>Gleichstand?</b> Die Karten kommen in den Topf. Wer die nächste Runde gewinnt, bekommt ihn dazu.</li>
          <li>Wer keine Karten mehr hat, ist raus. Gewonnen hat, wer alle Karten hat oder nach dem Rundenlimit die meisten.</li>
        </ol>
        <p class="leise klein-text">Seltenheit nach Gesamtpunkten: <b style="color:#b9b9c6">● Gewöhnlich</b> · <b style="color:#3fbf72">◆ Häufig</b> · <b style="color:#4d8eff">◆◆ Selten</b> · <b style="color:#b363ff">★★ Episch</b> · <b style="color:#ffcf3f">★★★ Legendär</b>. Tipp: Wähle den Wert, der im Vergleich zu allen Karten am besten ist.</p>`,
      },
    ];
  }

  function binde(el, z) {
    $$("[data-deck]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ deck: b.dataset.deck })));
    $$("[data-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.bots })));
    $$("[data-qrunden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.qrunden })));
    $$("[data-qhand]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ hand: +b.dataset.qhand })));
    $$("[data-qsek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.qsek })));
  }
  // Die Galerie darf jeder öffnen (nicht nur der Host)
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest?.("[data-galerie]");
    if (b) { Ton.klick(); zeigeGalerie(b.dataset.galerie); }
  });

  function zeigeGalerie(deckId) {
    const deck = deckVon(deckId);
    galerieDeck = deck;
    let d = $("#qGalerie");
    if (!d) {
      document.body.insertAdjacentHTML("beforeend", '<dialog id="qGalerie" class="fenster q-galerie" aria-label="Alle Karten"></dialog>');
      d = $("#qGalerie");
      d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); });
    }
    d.innerHTML = `
      <div class="fenster-kopf"><b>${deck.icon} ${esc(deck.name)} · ${deck.karten.length} Karten</b><button class="icon-btn" data-schliessen aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt">
        ${deck.lizenz ? `<p class="leise klein-text" style="margin-top:0">${esc(deck.lizenz)} · Werte sind eine Fan-Einschätzung.</p>` : ""}
        ${deck.gruppen.map((g) => `
          <div class="q-gal-gruppe" style="--typ:${g.farbe}"><b>${g.icon} ${g.id} · ${esc(g.name)}</b></div>
          <div class="q-gal-reihe">${deck.karten.filter((k) => k.gruppe === g.id).map((k) => karte(deck, k, { klasse: "gal" })).join("")}</div>`).join("")}
        ${GN.zustand?.vorschau && deck.bald ? `<div class="q-gal-bald"><b>🔒 Demnächst</b> · Ideen für neue Karten, noch nicht im Spiel (nur im Vorschau-Raum sichtbar)</div>
          ${deck.bald.gruppen.map((g) => `
            <div class="q-gal-gruppe" style="--typ:${g.farbe}"><b>${g.icon} ${g.id} · ${esc(g.name)}</b></div>
            <div class="q-gal-reihe">${deck.bald.karten.filter((k) => k.gruppe === g.id).map((k) => karte({ ...deck, gruppen: [...deck.gruppen, ...deck.bald.gruppen] }, k, { klasse: "gal bald" })).join("")}</div>`).join("")}` : ""}
      </div>`;
    $("[data-schliessen]", d).onclick = () => d.close();
    $$(".qkarte", d).forEach(kippen);
    d.showModal();
  }

  // =============================================================
  //  Spielansicht: Spieltisch mit Figuren, eigene Hand unten
  // =============================================================
  let auswahl = null; // ausgewählte Handkarte
  let letzterKampf = null; // für die Reaktionen der Figuren nach dem Kampf

  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (!GN.ansicht.startsWith("quartett-podest")) {
        if (GN.ansicht.startsWith("quartett-kampf") && $(".q-kampf")) return; // Animation erst zu Ende laufen lassen
        GN.podest("quartett-podest-" + z.runde, { einheit: "Karten" });
      } else GN.rangliste($("#rangliste"));
      return;
    }
    if (z.phase === "kampf") {
      const key = "quartett-kampf-" + z.runde;
      if (GN.ansicht !== key) kampf(key, z);
      return;
    }
    // Wählen oder Kontern: Tisch
    const key = "quartett-tisch-" + z.runde;
    if (GN.ansicht !== key || !$(".q-buehne")) aufbauen(key, z);
    else { zeichneSitze(z); zeichneTischMitte(z); zeigeHand(z); }
    const phaseNeu = !vorher || vorher.phase !== z.phase || vorher.runde !== z.runde || vorher.waehler !== z.waehler;
    if (GN.timerNeu || phaseNeu) {
      GN.timerNeu = false;
      const ichBetroffen = z.phase === "waehlen" ? z.waehler === GN.ich : !z.gelegt.includes(GN.ich);
      if (z.restMs > 0) {
        $("#timer")?.classList.remove("unendlich");
        GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000, tonAus: () => !ichBetroffen });
      } else GN.ohneZeitlimit();
    }
    if (phaseNeu && z.phase === "kontern" && z.angesagt.spieler !== GN.ich) { Ton.alarm(); navigator.vibrate?.([60, 40, 60]); }
  }

  function aufbauen(key, z) {
    GN.ansicht = key;
    GN.stoppeTimer();
    const deck = deckVon(z.deck);
    app.innerHTML = `
      <div class="q-buehne" style="--deck:${deck.gruppen[0].farbe}">
        <div class="runden-kopf">
          <span class="modus-badge">${deck.icon} ${esc(deck.name)}</span>
          <span class="runden-nr">Runde ${z.runde}${z.rundenMax ? ` / ${z.rundenMax}` : ""}</span>
          <button class="q-3d-knopf" id="q3dKnopf" title="Zwischen 3D-Tisch und einfacher Ansicht wechseln">${QuartettTisch3D.moeglich() ? "2D" : "3D"}</button>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="q-szene" id="qSzene">
          <div class="q-sitze" id="qSitze"></div>
          <div class="q-tisch"><div class="q-platte"><div class="q-platte-muster"></div><div class="q-gelegt" id="qGelegt"></div></div></div>
          <div class="q-tisch-mitte" id="qMitte"></div>
        </div>
        <div class="q-ich" id="qIch"></div>
      </div>`;
    $("#q3dKnopf").onclick = () => { Ton.klick(); QuartettTisch3D.umschalten(); GN.ansicht = ""; zeige(GN.zustand, GN.zustand); };
    // 3D-Tisch (falls möglich), sonst bleibt die 2,5D-Ansicht
    if (QuartettTisch3D.moeglich()) {
      $("#qSzene").classList.add("drei");
      QuartettTisch3D.einhaengen($("#qSzene")).then(() => {
        if (GN.ansicht !== key) return;
        zeichneSitze(GN.zustand);
        reaktionenZeigen(GN.zustand);
      }).catch((e) => { console.warn("3D nicht möglich:", e); $("#qSzene")?.classList.remove("drei"); zeichneSitze(GN.zustand); });
    }
    zeichneSitze(z);
    zeichneTischMitte(z);
    zeigeHand(z);
    reaktionenZeigen(z);
  }

  // Reaktionen nach dem letzten Kampf: Gewinner jubelt, Verlierer lassen den Kopf hängen
  function reaktionenZeigen(z) {
    if (letzterKampf?.runde === z.runde - 1) {
      const k = letzterKampf.kampf;
      k.gespielt.forEach((g) => {
        const art = g.spieler === k.sieger ? "jubelt" : k.gleichstand ? "staunt" : "traurig";
        $(`.q-sitz[data-teilnehmer="${g.spieler}"]`)?.classList.add(art);
        if ($("#qSzene.drei")) QuartettTisch3D.tisch?.reaktion(g.spieler, art);
      });
      setTimeout(() => $$(".q-sitz").forEach((s) => s.classList.remove("jubelt", "traurig", "staunt")), 1800);
    }
  }

  // Sitzplätze: alle anderen gegenüber, mit großer Figur
  function zeichneSitze(z) {
    const box = $("#qSitze");
    if (!box) return;
    // 3D: Figuren und Schilder zeichnet der 3D-Tisch
    if ($("#qSzene.drei") && QuartettTisch3D.tisch) {
      const w = z.angesagt ? deckVon(z.deck).werte[z.angesagt.wert] : null;
      QuartettTisch3D.tisch.aktualisieren({ ...z, ansageText: w ? `${w.icon} ${esc(w.name)}!` : "" }, GN.ich);
      box.innerHTML = "";
      return;
    }
    const andere = leute(z).filter((t) => t.id !== GN.ich);
    box.className = `q-sitze anzahl-${andere.length}`;
    box.innerHTML = andere.map((t, i) => {
      const dran = (z.phase === "waehlen" && z.waehler === t.id) || (z.phase === "kontern" && !z.gelegt.includes(t.id) && t.karten);
      const fertig = z.phase === "kontern" && z.gelegt.includes(t.id) && z.angesagt.spieler !== t.id;
      return `
      <div class="q-sitz ${t.karten ? "" : "raus"} ${dran ? "dran" : ""} ${t.online ? "" : "offline"}" data-teilnehmer="${t.id}" style="--i:${i}">
        <div class="q-figur"><span class="q-figur-schatten"></span><span class="q-figur-koerper">${t.avatar}</span>
          ${z.phase === "kontern" && z.angesagt.spieler === t.id ? `<span class="q-blase">${deckVon(z.deck).werte[z.angesagt.wert].icon} ${esc(deckVon(z.deck).werte[z.angesagt.wert].name)}!</span>` : ""}
          ${fertig ? '<span class="q-haken">✓</span>' : ""}
          ${z.phase === "waehlen" && z.waehler === t.id ? `<span class="q-denkt">${GN.wartePunkte()}</span>` : ""}
        </div>
        <div class="q-schild"><b>${esc(t.name)}</b><span>${t.karten ? `🃏 ${t.karten}` : "raus"}${t.bot ? " · 🤖" : ""}${t.afk ? " · 💤" : ""}</span></div>
      </div>`;
    }).join("");
  }

  // Tischmitte: Ansage, Topf und verdeckt gelegte Karten
  function zeichneTischMitte(z) {
    const deck = deckVon(z.deck);
    const mitte = $("#qMitte"), gelegt = $("#qGelegt");
    if (!mitte) return;
    const ichDran = z.waehler === GN.ich;
    let text = "";
    if (z.phase === "waehlen") {
      text = ichDran ? `<b class="gross">Du bist dran!</b><span>${z.hand > 1 ? "Wähle eine Karte und dann einen Wert." : "Tippe auf deinen stärksten Wert."}</span>`
        : `<b>${person(z, z.waehler).avatar} ${esc(person(z, z.waehler).name)} wählt …</b>`;
    } else if (z.phase === "kontern") {
      const w = deck.werte[z.angesagt.wert];
      const ansager = z.angesagt.spieler === GN.ich ? "Du sagst" : `${esc(person(z, z.angesagt.spieler).name)} sagt`;
      text = `<span>${ansager} an:</span><b class="q-ansage-wert">${w.icon} ${esc(w.name)}</b>`;
    }
    mitte.innerHTML = `<div class="q-ansage">${text}</div>${z.topf ? `<div class="q-topf" title="Gewinnt die nächste Runde dazu">🪙 Topf: <b>${z.topf}</b></div>` : ""}`;
    // Verdeckte Karten auf dem Tisch für alle, die schon gelegt haben
    const alle = leute(z);
    gelegt.innerHTML = z.gelegt.map((id) => {
      const pos = id === GN.ich ? alle.length : alle.filter((t) => t.id !== GN.ich).findIndex((t) => t.id === id);
      return `<div class="q-tischkarte" data-von="${id}" style="--p:${pos};--n:${alle.length - 1}">${rueckseite(deck, "mini")}</div>`;
    }).join("");
  }

  // Eigene Hand: kleine Karten zum Auswählen, die gewählte groß mit Werten
  function zeigeHand(z) {
    const box = $("#qIch");
    if (!box) return;
    const deck = deckVon(z.deck);
    const ich = leute(z).find((t) => t.id === GN.ich);
    if (!ich) { box.innerHTML = `<div class="q-hinweis">👀 Du schaust diese Partie zu. Bei der nächsten bist du dabei!</div>`; return; }
    if (!ich.karten) { box.innerHTML = `<div class="q-hinweis">😵 Du hast keine Karten mehr. Schau zu, wer gewinnt!</div>`; return; }
    const karten = (hand.karten || []).map((id) => karteVon(deck, id)).filter(Boolean);
    if (!karten.length) return;
    if (!karten.some((k) => k.id === auswahl)) auswahl = karten[0].id;
    const ansage = z.phase === "kontern" ? z.angesagt.wert : null;
    const binIchAnsager = z.phase === "kontern" && z.angesagt.spieler === GN.ich;
    const gelegt = z.phase === "kontern" && z.gelegt.includes(GN.ich);
    const darfWaehlen = z.phase === "waehlen" && z.waehler === GN.ich;
    const darfKontern = z.phase === "kontern" && !gelegt;
    const sig = [karten.map((k) => k.id).join(), auswahl, z.phase, darfWaehlen, darfKontern, gelegt, ich.karten].join("|");
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const k = karteVon(deck, auswahl);
    let hinweis = "";
    if (darfKontern) hinweis = `<div class="q-konter-hinweis">Welche Karte legst du gegen <b>${deck.werte[ansage].icon} ${esc(deck.werte[ansage].name)}</b>?</div>`;
    else if (gelegt && !binIchAnsager) hinweis = `<div class="q-konter-hinweis fertig">✓ Gelegt! Warte auf die anderen${GN.wartePunkte()}</div>`;
    else if (binIchAnsager) hinweis = `<div class="q-konter-hinweis fertig">Die anderen suchen ihre Konter-Karte${GN.wartePunkte()}</div>`;
    // Fächer: gewählte Karte groß in der Mitte, die anderen schräg dahinter (links/rechts)
    const sel = karten.findIndex((x) => x.id === auswahl);
    const lage = (i) => {
      if (i === sel) return { x: 0, r: 0, z: 10 };
      const seite = i < sel ? -1 : 1, abstand = Math.abs(i - sel);
      return { x: seite * (0.5 + (abstand - 1) * 0.2), r: seite * (12 + (abstand - 1) * 7), z: 6 - abstand };
    };
    box.innerHTML = `
      ${hinweis}
      <div class="q-hand anzahl-${karten.length}" role="listbox" aria-label="Deine Handkarten">
        ${karten.map((x, i) => {
          const l = lage(i);
          const gew = x.id === auswahl;
          return `<div class="q-handkarte ${gew ? "gewaehlt" : ""}" data-hand="${x.id}" role="option" tabindex="${gew ? -1 : 0}" aria-selected="${gew}" aria-label="${esc(x.name)}"
              style="--x:${l.x};--r:${l.r}deg;--z:${l.z}">
            ${karte(deck, x, { klickbar: gew && darfWaehlen, klasse: gew ? "gross neu" : "" })}
            ${ansage !== null && !gew ? `<span class="q-hand-wert">${deck.werte[ansage].icon} ${x.w[ansage].toLocaleString("de-DE")}</span>` : ""}
          </div>`;
        }).join("")}
      </div>
      ${darfKontern ? `<button class="btn gross voll q-legen" id="legenBtn">🃏 Diese Karte legen</button>` : ""}
      <div class="q-mein-stapel">🃏 Du hast <b>${ich.karten}</b> ${ich.karten === 1 ? "Karte" : "Karten"}${z.hand > 1 ? ` · ${karten.length} auf der Hand` : ""}</div>`;
    const el = $(".q-handkarte.gewaehlt .qkarte", box);
    $(".q-handkarte.gewaehlt", box)?.classList.toggle("dran", darfWaehlen);
    $(".q-handkarte.gewaehlt", box)?.classList.toggle("kontern", darfKontern);
    kippen(el);
    if (ansage !== null) $(`.qk-wert[data-wert="${ansage}"]`, el)?.classList.add("angesagt");
    // Andere Handkarte nach vorn holen (Tippen oder Enter)
    const holen = (id) => { if (id === auswahl || gelegt || binIchAnsager) return; Ton.klick(); auswahl = id; box.dataset.sig = ""; zeigeHand(GN.zustand); };
    $$(".q-handkarte:not(.gewaehlt)", box).forEach((b) => {
      b.onclick = () => holen(b.dataset.hand);
      b.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); holen(b.dataset.hand); } };
    });
    if (darfWaehlen) {
      $$(".qk-wert", el).forEach((b) => (b.onclick = () => {
        if (el.classList.contains("gewaehlt")) return;
        el.classList.add("gewaehlt");
        b.classList.add("gewaehlt");
        Ton.abgeben();
        navigator.vibrate?.(30);
        GN.aktion("waehlen", { karte: auswahl, wert: +b.dataset.wert });
      }));
    }
    $("#legenBtn")?.addEventListener("click", () => {
      Ton.abgeben();
      navigator.vibrate?.(30);
      $("#legenBtn").disabled = true;
      GN.aktion("kontern", auswahl);
    });
  }

  // =============================================================
  //  Kampf-Animation (beide Seiten greifen an)
  //  0,0 s  Karten fliegen verdeckt rein   0,5 s aufdecken
  //  1,1 s  angesagter Wert leuchtet       1,3 s Zahlen zählen hoch
  //  2,5 s  ALLE Karten feuern ihren Spezialangriff zur Mitte
  //  3,3 s  Zusammenprall: der stärkere Angriff bricht durch und trifft
  //  4,4 s  Ergebnis                       5,2 s Karten fliegen zum Gewinner
  // =============================================================
  function kampf(key, z) {
    GN.ansicht = key;
    GN.stoppeTimer();
    $("#intro").classList.add("versteckt");
    const deck = deckVon(z.deck);
    const k = z.kampf;
    const w = deck.werte[k.wert];
    letzterKampf = { runde: z.runde, kampf: k };
    if (!$(".q-buehne")) aufbauen(key, z);
    GN.ansicht = key;
    if ($("#qIch")) $("#qIch").dataset.sig = "";
    const schnell = ruhig();
    const gespielt = k.gespielt.map((g) => ({ ...g, k: karteVon(deck, g.karte) }));
    gespielt.sort((a, b) => (b.spieler === GN.ich) - (a.spieler === GN.ich));
    const maxWert = Math.max(...gespielt.map((g) => g.k.w[k.wert]));

    const ov = document.createElement("div");
    ov.className = `q-kampf anzahl-${gespielt.length} ${schnell ? "schnell" : ""}`;
    ov.innerHTML = `
      <div class="q-kampf-titel"><span class="q-kampf-wer">${person(z, k.waehler).avatar} ${esc(nameVon(z, k.waehler))} ${k.waehler === GN.ich ? "sagst" : "sagt"} an</span>
        <span class="q-kampf-wert">${w.icon} ${esc(w.name)}!</span></div>
      <div class="q-kampf-feld">
        ${gespielt.map((g, i) => {
          const p = person(z, g.spieler);
          return `<div class="q-kaempfer ${g.spieler === GN.ich ? "ich" : ""}" data-spieler="${g.spieler}" style="--i:${i}">
            <div class="q-kaempfer-name">${p.avatar} ${esc(nameVon(z, g.spieler))}</div>
            <div class="q-dreh">
              <div class="q-vorne">${karte(deck, g.k, { klasse: "kampf" })}</div>
              <div class="q-hinten">${rueckseite(deck)}</div>
            </div>
            <div class="q-angriff-name" style="--farbe:${g.k.angriff.farbe || gruppeVon(deck, g.k).farbe2}">${esc(g.k.angriff.name)}!</div>
          </div>`;
        }).join("")}
        <div class="q-vs" aria-hidden="true">VS</div>
      </div>
      <div class="q-ergebnis" role="status"></div>`;
    document.body.appendChild(ov);
    const zeitplan = [];
    const spaeter = (ms, fn) => zeitplan.push(setTimeout(() => { if (ov.isConnected) fn(); }, schnell ? Math.min(ms, 400) : ms));
    const weg = () => { zeitplan.forEach(clearTimeout); ov.classList.add("raus"); setTimeout(() => ov.remove(), 400); };
    const beobachter = setInterval(() => { if (GN.ansicht !== key && !GN.ansicht.startsWith("quartett-podest")) { clearInterval(beobachter); weg(); } }, 200);
    const el = (id) => $(`.q-kaempfer[data-spieler="${id}"]`, ov);
    const kartenMitte = (e) => mitte($(".qkarte", e) || e);
    const feldMitte = () => mitte($(".q-kampf-feld", ov));

    requestAnimationFrame(() => ov.classList.add("rein"));
    if (!schnell) Ton.wusch();
    spaeter(500, () => { $$(".q-kaempfer", ov).forEach((e) => e.classList.add("offen")); Ton.klick(); });
    spaeter(1100, () => {
      ov.classList.add("wert-zeigen");
      $$(`.q-kaempfer .qk-wert[data-wert="${k.wert}"]`, ov).forEach((e) => e.classList.add("aktiv"));
      $$(`.q-kaempfer .qk-wert:not([data-wert="${k.wert}"])`, ov).forEach((e) => e.classList.add("leise"));
    });
    spaeter(1300, () => {
      $$(`.q-kaempfer .qk-wert[data-wert="${k.wert}"] .qk-w-zahl`, ov).forEach((e) => hochzaehlen(e, w, schnell ? 0 : 1000));
      if (!schnell) for (let i = 0; i < 8; i++) setTimeout(() => ov.isConnected && Ton.tick(), i * 120);
    });
    // Beide (alle) Seiten greifen gleichzeitig zur Mitte an
    spaeter(2500, () => {
      const ziel = feldMitte();
      gespielt.forEach((g) => {
        const e = el(g.spieler);
        e.classList.add("greift-an");
        const [x, y] = kartenMitte(e);
        // Nahkampf-Arten springen sichtbar nach vorn
        if (["sprung", "krallen", "schlag", "beben", "peitsche"].includes(g.k.angriff.art)) {
          $(".q-dreh", e).animate([{ transform: "none" }, { transform: `translate(${(ziel[0] - x) * 0.25}px, ${(ziel[1] - y) * 0.25 - 16}px) scale(1.05)` }, { transform: "none" }], { duration: 700, easing: "cubic-bezier(.3,.7,.3,1)" });
        }
        QuartettAngriffe.spiele(ov, g.k.angriff.art, { von: [x, y], nach: ziel, farbe: g.k.angriff.farbe || gruppeVon(deck, g.k).farbe2, objekt: g.k.angriff.objekt, kraft: 0.55 + 0.45 * (g.k.w[k.wert] / maxWert) });
      });
      angriffsTon(gespielt.map((g) => g.k.angriff.art));
    });
    // Zusammenprall in der Mitte
    spaeter(3300, () => {
      const m = feldMitte();
      const knall = document.createElement("i");
      knall.className = "q-knall";
      knall.style.cssText = `left:${m[0]}px;top:${m[1]}px`;
      ov.appendChild(knall);
      setTimeout(() => knall.remove(), 700);
      if (k.gleichstand) {
        ov.classList.add("stechen");
        Ton.klirr(); Ton.treffer();
        funkenAn(ov, m, "#ffe14d", 24);
        return;
      }
      Ton.treffer();
      GN.fx?.stopp(120); GN.fx?.wackeln(1);
      const s = el(k.sieger);
      const g = gespielt.find((x) => x.spieler === k.sieger);
      s.classList.add("sieger");
      // Der stärkere Angriff bricht durch und trifft alle anderen
      gespielt.filter((x) => x.spieler !== k.sieger).forEach((v, i) => setTimeout(() => {
        if (!ov.isConnected) return;
        const ve = el(v.spieler);
        QuartettAngriffe.spiele(ov, g.k.angriff.art, { von: m, nach: kartenMitte(ve), farbe: g.k.angriff.farbe || gruppeVon(deck, g.k).farbe2, objekt: g.k.angriff.objekt, kraft: 0.9 });
        setTimeout(() => ov.isConnected && treffer(ov, ve, g.k.angriff.farbe || "#ff4f6d"), 420);
      }, i * 200));
    });
    spaeter(4400, () => {
      const box = $(".q-ergebnis", ov);
      const n = k.gespielt.length + (k.topfGewonnen || 0);
      if (k.gleichstand) box.innerHTML = `<b>⚔️ STECHEN!</b><span>Gleichstand: Die Karten kommen in den Topf.</span>`;
      else if (k.sieger === GN.ich) box.innerHTML = `<b>🏆 Du gewinnst ${n} Karten!</b>${k.topfGewonnen ? `<span>inklusive ${k.topfGewonnen} aus dem Topf</span>` : ""}`;
      else box.innerHTML = `<b>${person(z, k.sieger).avatar} ${esc(person(z, k.sieger).name)} gewinnt ${n} Karten</b>${k.topfGewonnen ? `<span>inklusive ${k.topfGewonnen} aus dem Topf</span>` : ""}`;
      box.classList.add("zeigen");
      if (k.sieger === GN.ich) { Ton.serie(); GN.fx?.funken(box, { anzahl: 18, weite: 110 }); GN.fx?.pop(box, 0.6); if (k.topfGewonnen) GN.konfetti(80); }
      else if (k.gespielt.some((x) => x.spieler === GN.ich) && !k.gleichstand) Ton.falsch();
    });
    spaeter(5200, () => {
      let ziel = null;
      if (!k.gleichstand) ziel = k.sieger === GN.ich ? $("#qIch") : $(`.q-sitz[data-teilnehmer="${k.sieger}"]`);
      const zr = ziel?.getBoundingClientRect();
      $$(".q-kaempfer", ov).forEach((e, i) => {
        const r = e.getBoundingClientRect();
        const dx = zr ? zr.left + zr.width / 2 - (r.left + r.width / 2) : 0;
        const dy = zr ? zr.top + Math.min(zr.height, 200) / 2 - (r.top + r.height / 2) : 0;
        e.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(${(i % 2 ? 1 : -1) * 25}deg)`, opacity: 0 }],
          { duration: 650, delay: i * 70, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
      });
      $(".q-ergebnis", ov).classList.add("weg");
      if (!schnell) Ton.wusch();
    });
    spaeter(6000, () => {
      clearInterval(beobachter);
      weg();
      setTimeout(() => {
        if (GN.zustand?.phase === "ende" && GN.ansicht === key) GN.podest("quartett-podest-" + GN.zustand.runde, { einheit: "Karten" });
      }, 450);
    });
  }

  function angriffsTon(arten) {
    if (arten.includes("blitz")) Ton.feuerstoss("blitz");
    else if (arten.includes("eis")) Ton.feuerstoss("eis");
    if (arten.some((a) => ["strahl", "feuerball", "nebel", "wirbel"].includes(a))) Ton.feuerstoss("feuer");
    if (arten.some((a) => ["sprung", "krallen", "schlag", "peitsche", "werfen"].includes(a))) Ton.wusch();
    if (arten.includes("beben")) Ton.treffer();
  }

  function hochzaehlen(el, w, dauer) {
    const ziel = Number(el.dataset.ziel);
    const start = performance.now();
    const schritt = (t) => {
      const p = dauer ? Math.min(1, (t - start) / dauer) : 1;
      el.innerHTML = zahl(Math.round(ziel * (1 - Math.pow(1 - p, 3))), w);
      if (p < 1 && el.isConnected) requestAnimationFrame(schritt);
      else el.closest(".qk-wert")?.classList.add("fertig");
    };
    requestAnimationFrame(schritt);
  }

  const mitte = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  function treffer(ov, el, farbe) {
    el.classList.add("getroffen");
    Ton.treffer();
    navigator.vibrate?.(60);
    const m = mitte($(".qkarte", el) || el);
    funkenAn(ov, m, farbe, 14);
    const ring = document.createElement("i");
    ring.className = "q-ring";
    ring.style.cssText = `left:${m[0]}px;top:${m[1]}px;border-color:${farbe}`;
    ov.appendChild(ring);
    setTimeout(() => ring.remove(), 700);
  }

  function funkenAn(ov, [x, y], farbe, n) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.className = "q-funke";
      p.style.cssText = `left:${x}px;top:${y}px;background:${farbe}`;
      ov.appendChild(p);
      const a = (i / n) * Math.PI * 2, d = 50 + Math.random() * 80;
      p.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
        { duration: 550 + Math.random() * 250, easing: "cubic-bezier(.1,.8,.3,1)" }).onfinish = () => p.remove();
    }
  }

  GN.spiele.quartett = {
    icon: "🃏",
    titel: "Quartett",
    kurz: "Karten-Duelle mit Kung Fu Panda und Dragons.",
    beschreibung: "Das Karten-Duell: Wähle den stärksten Wert und schnapp dir die Karten der anderen. Mit animierten Kämpfen und Holo-Karten.",
    tags: ["🃏 2 Decks · 61 Karten", "⚔️ Kampf-Animationen", "🤖 Auch gegen Computer", "👥 1–4 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
