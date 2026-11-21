// =============================================================
//  Quartett – Browser-Teil
//  Karten, Lobby, Spielansicht und Kampf-Animationen
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let hand = { karte: null, anzahl: 0, runde: 0 }; // eigene oberste Karte (kommt privat vom Server)
  let galerieDeck = null;

  const meta = () => GN.meta.spiele.quartett || { decks: [] };
  const deckVon = (id) => meta().decks.find((d) => d.id === id) || meta().decks[0];
  const karteVon = (deck, id) => deck.karten.find((k) => k.id === id);
  const gruppeVon = (deck, k) => deck.gruppen.find((g) => g.id === k.gruppe);
  const maxWerte = {};
  const maxWert = (deck, i) => (maxWerte[deck.id + i] ??= Math.max(...deck.karten.map((k) => k.w[i])));
  const zahl = (v, w) => `${v.toLocaleString("de-DE")}${w.einheit ? `<small> ${w.einheit}</small>` : ""}`;
  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  GN.socket.on("quartett:hand", (h) => {
    hand = h;
    const z = GN.zustand;
    if (z?.spiel === "quartett" && z.phase === "waehlen") zeigeMeineKarte(z);
  });

  // =============================================================
  //  Karte (HTML)
  // =============================================================
  function karte(deck, k, { klickbar = false, klasse = "" } = {}) {
    const g = gruppeVon(deck, k);
    const tag = klickbar ? "button" : "div";
    return `
      <div class="qkarte ${k.selten ? "selten" : ""} ${klasse}" data-karte="${k.id}" style="--typ:${g.farbe};--typ2:${g.farbe2}">
        <div class="qk-innen">
          <div class="qk-kopf"><span class="qk-code">${k.id}</span><span class="qk-name">${esc(k.name)}</span><span class="qk-typ" title="${esc(g.name)}">${g.icon}</span></div>
          <div class="qk-bild">${QuartettBilder.bild(deck, k)}${k.selten ? '<span class="qk-selten">★ selten</span>' : ""}</div>
          <div class="qk-unter">${esc(g.name)}${k.stil ? ` · ${esc(k.stil)}` : ""}</div>
          <div class="qk-werte">
            ${deck.werte.map((w, i) => `
              <${tag} class="qk-wert" data-wert="${i}" ${klickbar ? `aria-label="${esc(w.name)}: ${k.w[i]} wählen"` : ""}>
                <span class="qk-w-icon">${w.icon}</span><span class="qk-w-name">${esc(w.name)}</span>
                <span class="qk-w-balken"><i style="width:${Math.round((k.w[i] / maxWert(deck, i)) * 100)}%"></i></span>
                <b class="qk-w-zahl" data-ziel="${k.w[i]}">${zahl(k.w[i], w)}</b>
              </${tag}>`).join("")}
          </div>
          <div class="qk-text">${esc(k.text)}</div>
        </div>
        <div class="qk-glanz" aria-hidden="true"></div>
      </div>`;
  }
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
            const vorschau = d.karten.filter((k) => k.selten).slice(0, 3);
            return `<button class="q-deck ${e.deck === d.id ? "aktiv" : ""}" data-deck="${d.id}" ${dis}>
              <span class="q-deck-faecher">${vorschau.map((k, i) => `<span style="--i:${i}">${karte(d, k, { klasse: "mini" })}</span>`).join("")}</span>
              <span class="q-deck-text"><b>${d.icon} ${esc(d.name)}</b><span>${esc(d.beschreibung)}</span>
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
        id: "runden", wichtig: true, icon: "⏱️", titel: "Spielende & Zeit",
        info: `${e.runden ? `${e.runden} Runden` : "Bis einer alle Karten hat"} · ${e.sekunden ? `${e.sekunden} s zum Wählen` : "Wählen ohne Zeitlimit"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Spielende</div>
            <div class="segment">${[15, 25, 40, 0].map((n) => `<button data-qrunden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n ? n + " Runden" : "Alle Karten"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit zum Wählen</div>
            <div class="segment">${[10, 20, 30, 0].map((n) => `<button data-qsek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
        </div>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "Höchster Wert gewinnt",
        html: `<ol class="q-regeln">
          <li>Alle Karten werden gemischt und verteilt. Du siehst nur deine oberste Karte.</li>
          <li>Wer dran ist, wählt einen Wert, z. B. <b>Tempo</b>.</li>
          <li>Alle decken auf: <b>Der höchste Wert gewinnt</b> alle Karten der Runde und ist als Nächstes dran.</li>
          <li><b>Gleichstand?</b> Die Karten kommen in den Topf. Wer die nächste Runde gewinnt, bekommt ihn dazu.</li>
          <li>Wer keine Karten mehr hat, ist raus. Gewonnen hat, wer alle Karten hat oder nach dem Rundenlimit die meisten.</li>
        </ol>
        <p class="leise klein-text">★ Seltene Karten sind stärker, haben aber auch eine Schwäche. Tipp: Wähle den Wert, der im Vergleich zu allen Karten am besten ist.</p>`,
      },
    ];
  }

  function binde(el, z) {
    $$("[data-deck]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ deck: b.dataset.deck })));
    $$("[data-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.bots })));
    $$("[data-qrunden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.qrunden })));
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
        ${deck.gruppen.map((g) => `
          <div class="q-gal-gruppe" style="--typ:${g.farbe}"><b>${g.icon} ${g.id} · ${esc(g.name)}</b></div>
          <div class="q-gal-reihe">${deck.karten.filter((k) => k.gruppe === g.id).map((k) => karte(deck, k, { klasse: "gal" })).join("")}</div>`).join("")}
      </div>`;
    $("[data-schliessen]", d).onclick = () => d.close();
    $$(".qkarte", d).forEach(kippen);
    d.showModal();
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
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
    // Wählen
    const key = "quartett-wahl-" + z.runde;
    if (GN.ansicht !== key || !$(".q-buehne")) aufbauen(key, z);
    else { zeichneGegner(z); zeigeArena(z); zeigeMeineKarte(z); }
    if (GN.timerNeu || !vorher || vorher.phase !== z.phase || vorher.runde !== z.runde || vorher.waehler !== z.waehler) {
      GN.timerNeu = false;
      if (z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, (z.sekunden || 8) * 1000, { tickAb: 5000, tonAus: () => z.waehler !== GN.ich }); }
      else GN.ohneZeitlimit();
    }
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
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="q-gegner" id="qGegner"></div>
        <div class="q-arena" id="qArena"></div>
        <div class="q-meins" id="qMeins"></div>
      </div>`;
    zeichneGegner(z);
    zeigeArena(z);
    zeigeMeineKarte(z);
  }

  function zeichneGegner(z) {
    const box = $("#qGegner");
    if (!box) return;
    box.innerHTML = leute(z).filter((t) => t.id !== GN.ich).map((t) => `
      <div class="q-spieler ${t.karten ? "" : "raus"} ${z.waehler === t.id && z.phase === "waehlen" ? "dran" : ""} ${t.online ? "" : "offline"}" data-teilnehmer="${t.id}">
        <span class="avatar">${t.avatar}</span>
        <span class="q-sp-text"><b>${esc(t.name)}</b><span>${t.karten ? `${t.karten} ${t.karten === 1 ? "Karte" : "Karten"}` : "raus"}${t.bot ? " · 🤖" : ""}${t.afk ? " · 💤" : ""}</span></span>
        <span class="q-stapel" aria-hidden="true">${"<i></i>".repeat(Math.min(5, Math.ceil(t.karten / 3)))}</span>
      </div>`).join("");
  }

  function zeigeArena(z) {
    const box = $("#qArena");
    if (!box) return;
    const ichDran = z.waehler === GN.ich;
    const w = person(z, z.waehler);
    box.innerHTML = `
      <div class="q-ansage ${ichDran ? "ich" : ""}">
        ${ichDran ? "<b>Du bist dran!</b><span>Tippe auf deinen stärksten Wert.</span>"
          : `<b>${w.avatar} ${esc(w.name)} wählt</b><span>einen Wert${GN.wartePunkte()}</span>`}
      </div>
      ${z.topf ? `<div class="q-topf" title="Gewinnt die nächste Runde dazu">🪙 Im Topf: <b>${z.topf}</b> ${z.topf === 1 ? "Karte" : "Karten"}</div>` : ""}`;
  }

  function zeigeMeineKarte(z) {
    const box = $("#qMeins");
    if (!box) return;
    const deck = deckVon(z.deck);
    const ich = leute(z).find((t) => t.id === GN.ich);
    if (!ich) {
      box.innerHTML = `<div class="q-hinweis">👀 Du schaust diese Partie zu. Bei der nächsten bist du dabei!</div>`;
      return;
    }
    if (!ich.karten) {
      box.innerHTML = `<div class="q-hinweis">😵 Du hast keine Karten mehr. Schau zu, wer gewinnt!</div>`;
      return;
    }
    const k = hand.karte && karteVon(deck, hand.karte);
    if (!k) return;
    const dran = z.waehler === GN.ich && z.phase === "waehlen";
    // Nicht neu zeichnen, wenn sich nichts geändert hat (sonst flackert die Karte)
    const sig = `${k.id}|${dran}|${ich.karten}`;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = `
      <div class="q-meine-karte ${dran ? "dran" : ""}">${karte(deck, k, { klickbar: dran, klasse: "gross neu" })}</div>
      <div class="q-mein-stapel">🃏 Du hast <b>${ich.karten}</b> ${ich.karten === 1 ? "Karte" : "Karten"}</div>`;
    const el = $(".qkarte", box);
    kippen(el);
    if (dran) {
      $$(".qk-wert", el).forEach((b) => (b.onclick = () => {
        if (el.classList.contains("gewaehlt")) return;
        el.classList.add("gewaehlt");
        b.classList.add("gewaehlt");
        Ton.abgeben();
        navigator.vibrate?.(30);
        GN.aktion("waehlen", +b.dataset.wert);
      }));
    }
  }

  // =============================================================
  //  Kampf-Animation
  //  0,0 s  Karten fliegen verdeckt rein   0,5 s aufdecken
  //  1,1 s  gewählter Wert leuchtet        1,3 s Zahlen zählen hoch
  //  2,5 s  Angriff: Drachen speien, Meister springen zu
  //  3,4 s  Ergebnis-Banner                4,3 s Karten fliegen zum Gewinner
  // =============================================================
  const ELEMENT_FARBEN = {
    feuer: ["#ffef9a", "#ffb23d", "#ff5a36"], eis: ["#ffffff", "#bff3ff", "#5ec8f2"], blitz: ["#fffbe0", "#ffe14d", "#a35cff"],
    stein: ["#e2cfa6", "#a88a63", "#6b5440"], wasser: ["#e0fffa", "#7ff0d8", "#1fa6ff"], schatten: ["#ffd1ec", "#b07cff", "#3b1f6b"],
    wind: ["#ffffff", "#b6f5d8", "#20c997"], licht: ["#fffbe0", "#ffe58a", "#f5b700"],
  };

  function kampf(key, z) {
    GN.ansicht = key;
    GN.stoppeTimer();
    $("#intro").classList.add("versteckt");
    const deck = deckVon(z.deck);
    const k = z.kampf;
    const w = deck.werte[k.wert];
    const waehler = person(z, k.waehler);
    if (!$(".q-buehne")) aufbauen(key, z); // z. B. nach Neuladen mitten im Kampf
    GN.ansicht = key;
    $("#qMeins").dataset.sig = "";
    const schnell = ruhig();
    const gespielt = k.gespielt.map((g) => ({ ...g, k: karteVon(deck, g.karte) }));
    // Meine Karte zuerst (unten), dann die anderen
    gespielt.sort((a, b) => (b.spieler === GN.ich) - (a.spieler === GN.ich));

    const ov = document.createElement("div");
    ov.className = `q-kampf anzahl-${gespielt.length} ${schnell ? "schnell" : ""}`;
    ov.innerHTML = `
      <div class="q-kampf-titel"><span class="q-kampf-wer">${waehler.avatar} ${esc(nameVon(z, k.waehler))} ${k.waehler === GN.ich ? "wählst" : "wählt"}</span>
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
          </div>`;
        }).join("")}
        <div class="q-vs" aria-hidden="true">VS</div>
      </div>
      <div class="q-ergebnis" role="status"></div>`;
    document.body.appendChild(ov);
    const zeitplan = [];
    const spaeter = (ms, fn) => zeitplan.push(setTimeout(() => { if (ov.isConnected) fn(); }, schnell ? Math.min(ms, 400) : ms));
    const weg = () => { zeitplan.forEach(clearTimeout); ov.classList.add("raus"); setTimeout(() => ov.remove(), 400); };
    // Neue Ansicht (nächste Runde, Lobby, ...) → Overlay sauber entfernen
    const beobachter = setInterval(() => { if (GN.ansicht !== key && !GN.ansicht.startsWith("quartett-podest")) { clearInterval(beobachter); weg(); } }, 200);

    requestAnimationFrame(() => ov.classList.add("rein"));
    if (!schnell) Ton.wusch();
    spaeter(500, () => { $$(".q-kaempfer", ov).forEach((el) => el.classList.add("offen")); Ton.klick(); });
    spaeter(1100, () => {
      ov.classList.add("wert-zeigen");
      $$(`.q-kaempfer .qk-wert[data-wert="${k.wert}"]`, ov).forEach((el) => el.classList.add("aktiv"));
      $$(`.q-kaempfer .qk-wert:not([data-wert="${k.wert}"])`, ov).forEach((el) => el.classList.add("leise"));
    });
    spaeter(1300, () => {
      $$(`.q-kaempfer .qk-wert[data-wert="${k.wert}"] .qk-w-zahl`, ov).forEach((el) => hochzaehlen(el, w, schnell ? 0 : 1000));
      if (!schnell) for (let i = 0; i < 8; i++) setTimeout(() => ov.isConnected && Ton.tick(), i * 120);
    });

    const siegerEl = () => $(`.q-kaempfer[data-spieler="${k.sieger}"]`, ov);
    const verliererEls = () => $$(".q-kaempfer", ov).filter((el) => el.dataset.spieler !== k.sieger);
    spaeter(2500, () => {
      if (k.gleichstand) {
        ov.classList.add("stechen");
        $$(".q-kaempfer", ov).filter((el) => k.gleich.includes(el.dataset.spieler)).forEach((el) => el.classList.add("prall"));
        Ton.klirr();
        funken(ov, ov.querySelector(".q-vs"), "#ffe14d");
        return;
      }
      const s = siegerEl();
      const g = gespielt.find((x) => x.spieler === k.sieger);
      const element = gruppeVon(deck, g.k).element;
      s.classList.add("sieger");
      verliererEls().forEach((v, i) => setTimeout(() => angriff(ov, s, v, element, deck.id === "drachen"), i * 260));
    });
    spaeter(3400, () => {
      const box = $(".q-ergebnis", ov);
      const n = k.gespielt.length + (k.topfGewonnen || 0);
      if (k.gleichstand) box.innerHTML = `<b>⚔️ STECHEN!</b><span>Gleichstand: Die Karten kommen in den Topf.</span>`;
      else if (k.sieger === GN.ich) box.innerHTML = `<b>🏆 Du gewinnst ${n} Karten!</b>${k.topfGewonnen ? `<span>inklusive ${k.topfGewonnen} aus dem Topf</span>` : ""}`;
      else box.innerHTML = `<b>${person(z, k.sieger).avatar} ${esc(person(z, k.sieger).name)} gewinnt ${n} Karten</b>${k.topfGewonnen ? `<span>inklusive ${k.topfGewonnen} aus dem Topf</span>` : ""}`;
      box.classList.add("zeigen");
      if (k.sieger === GN.ich) { Ton.richtig(); if (k.topfGewonnen) GN.konfetti(80); }
      else if (k.gespielt.some((x) => x.spieler === GN.ich) && !k.gleichstand) Ton.falsch();
    });
    spaeter(4300, () => {
      // Karten fliegen zum Gewinner (oder in den Topf in der Mitte)
      let ziel = null;
      if (!k.gleichstand) ziel = k.sieger === GN.ich ? $("#qMeins") : $(`[data-teilnehmer="${k.sieger}"]`);
      const zr = ziel?.getBoundingClientRect();
      $$(".q-kaempfer", ov).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const dx = zr ? zr.left + zr.width / 2 - (r.left + r.width / 2) : 0;
        const dy = zr ? zr.top + zr.height / 2 - (r.top + r.height / 2) : 0;
        el.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(${(i % 2 ? 1 : -1) * 25}deg)`, opacity: 0 }],
          { duration: 650, delay: i * 70, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
      });
      $(".q-ergebnis", ov).classList.add("weg");
      if (!schnell) Ton.wusch();
    });
    spaeter(5200, () => {
      clearInterval(beobachter);
      weg();
      // Spiel vorbei? Dann zur Siegerehrung (die Nachricht kann kurz vor oder nach diesem Moment kommen)
      setTimeout(() => {
        if (GN.zustand?.phase === "ende" && GN.ansicht === key) GN.podest("quartett-podest-" + GN.zustand.runde, { einheit: "Karten" });
      }, 450);
    });
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

  // Angriff: Drachen speien ihr Element, Kung-Fu-Meister springen und schlagen zu
  function angriff(ov, von, nach, element, drache) {
    const [x1, y1] = mitte(von), [x2, y2] = mitte(nach);
    const dx = x2 - x1, dy = y2 - y1;
    const farben = ELEMENT_FARBEN[element] || ELEMENT_FARBEN.feuer;
    if (drache) {
      Ton.feuerstoss(element);
      const n = element === "blitz" ? 10 : 28;
      for (let i = 0; i < n; i++) {
        const p = document.createElement("i");
        p.className = `q-partikel ${element}`;
        const gr = 10 + Math.random() * 18;
        p.style.cssText = `left:${x1}px;top:${y1}px;width:${gr}px;height:${gr}px;background:${farben[i % 3]}`;
        ov.appendChild(p);
        const streu = (Math.random() - 0.5) * 60;
        p.animate([
          { transform: "translate(-50%,-50%) scale(.3)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.5 + streu}px), calc(-50% + ${dy * 0.5 - streu / 2}px)) scale(1.2)`, opacity: 1, offset: 0.5 },
          { transform: `translate(calc(-50% + ${dx + streu / 2}px), calc(-50% + ${dy + streu / 3}px)) scale(${element === "eis" ? 0.6 : 1.8})`, opacity: 0 },
        ], { duration: 520, delay: i * 18, easing: "ease-out" }).onfinish = () => p.remove();
      }
      if (element === "blitz") blitzstrahl(ov, x1, y1, x2, y2);
      setTimeout(() => treffer(ov, nach, farben), 380);
    } else {
      // Sprung zum Gegner und zurück
      von.animate([
        { transform: "none" },
        { transform: `translate(${dx * 0.08}px, ${dy * 0.08 - 20}px) scale(1.06) rotate(-4deg)`, offset: 0.35 },
        { transform: `translate(${dx * 0.42}px, ${dy * 0.42}px) scale(1.1) rotate(6deg)`, offset: 0.55 },
        { transform: "none" },
      ], { duration: 720, easing: "cubic-bezier(.3,.7,.3,1)" });
      Ton.wusch();
      setTimeout(() => {
        treffer(ov, nach, farben);
        const wort = document.createElement("span");
        wort.className = "q-kampfschrei";
        wort.textContent = ["HIYAA!", "WUSCH!", "KRACH!", "ZACK!"][Math.floor(Math.random() * 4)];
        wort.style.cssText = `left:${x2}px;top:${y2 - 30}px;--farbe:${farben[1]}`;
        ov.appendChild(wort);
        setTimeout(() => wort.remove(), 1100);
      }, 380);
    }
  }

  function treffer(ov, el, farben) {
    el.classList.add("getroffen");
    Ton.treffer();
    navigator.vibrate?.(60);
    funken(ov, el, farben[1]);
    const ring = document.createElement("i");
    ring.className = "q-ring";
    const [x, y] = mitte(el);
    ring.style.cssText = `left:${x}px;top:${y}px;border-color:${farben[1]}`;
    ov.appendChild(ring);
    setTimeout(() => ring.remove(), 700);
  }

  function funken(ov, el, farbe) {
    if (!el) return;
    const [x, y] = mitte(el);
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("i");
      p.className = "q-funke";
      p.style.cssText = `left:${x}px;top:${y}px;background:${farbe}`;
      ov.appendChild(p);
      const a = (i / 14) * Math.PI * 2, d = 50 + Math.random() * 70;
      p.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
        { duration: 550 + Math.random() * 250, easing: "cubic-bezier(.1,.8,.3,1)" }).onfinish = () => p.remove();
    }
  }

  function blitzstrahl(ov, x1, y1, x2, y2) {
    const punkte = [[x1, y1]];
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      punkte.push([x1 + (x2 - x1) * t + (Math.random() - 0.5) * 40, y1 + (y2 - y1) * t + (Math.random() - 0.5) * 40]);
    }
    punkte.push([x2, y2]);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "q-blitz");
    svg.innerHTML = `<polyline points="${punkte.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      <polyline points="${punkte.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#ffe14d" stroke-width="10" stroke-linejoin="round" opacity=".45"/>`;
    ov.appendChild(svg);
    svg.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0 }], { duration: 500 }).onfinish = () => svg.remove();
  }

  GN.spiele.quartett = {
    icon: "🃏",
    titel: "Quartett",
    kurz: "Karten-Duelle mit Drachen und Kung-Fu-Meistern.",
    beschreibung: "Das Karten-Duell: Wähle den stärksten Wert und schnapp dir die Karten der anderen. Mit animierten Kämpfen und Holo-Karten.",
    tags: ["🃏 2 Decks · 48 Karten", "⚔️ Kampf-Animationen", "🤖 Auch gegen Computer", "👥 1–4 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
