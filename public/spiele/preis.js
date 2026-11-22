// =============================================================
//  Preis-Schätzer – Browser-Teil
// =============================================================
(() => {
  const { $, $$, esc } = GN;

  const MODI = {
    mix: { icon: "🎲", titel: "Mix", text: "Jede Runde ein zufälliger Modus. Perfekt für den Spieleabend." },
    klassisch: { icon: "🎯", titel: "Klassisch", text: "Schätz den Preis. Je näher du dran bist, desto mehr Punkte." },
    nichtdrueber: { icon: "🔥", titel: "Nicht drüber!", text: "Am nächsten dran gewinnt, aber wer drüber liegt, kriegt 0 Punkte." },
    hoehertiefer: { icon: "⚖️", titel: "Teurer oder billiger?", text: "Ist das zweite Ding teurer oder billiger? Schnelle Antworten geben Bonus." },
    sortieren: { icon: "📊", titel: "Sortieren", text: "Bring 4 Dinge in die richtige Reihenfolge, von billig nach teuer." },
  };
  const EINHEITEN = [
    { label: null, faktor: 1 }, { label: "Tsd.", faktor: 1e3 }, { label: "Mio.", faktor: 1e6 },
    { label: "Mrd.", faktor: 1e9 }, { label: "Bio.", faktor: 1e12 },
  ];

  let eingabe = { einheit: 0, text: "" };
  let sortierung = [];
  const meta = () => GN.meta.spiele.preis || { kategorien: [] };
  const app = GN.app;

  // =============================================================
  //  Lobby-Einstellungen (aufklappbare Abschnitte)
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    const kats = meta().kategorien;
    const anzahl = kats.filter((k) => e.kategorien.includes(k.id)).reduce((s, k) => s + k.anzahl, 0);
    const m = MODI[e.modus];
    return [
      {
        id: "modus", wichtig: true, icon: "🎮", titel: "Spielmodus", info: `${m.icon} ${m.titel}`,
        html: `<div class="modus-gitter">
          ${Object.entries(MODI).map(([id, x]) => `
            <button class="modus-karte ${e.modus === id ? "aktiv" : ""}" data-modus="${id}" ${dis}>
              <div class="icon">${x.icon}</div><div class="titel">${x.titel}</div><div class="text">${x.text}</div>
            </button>`).join("")}
        </div>`,
      },
      {
        id: "kategorien", wichtig: true, icon: "🗂️", titel: "Kategorien",
        info: `${e.kategorien.length} von ${kats.length} · ${anzahl} Fragen`,
        html: `
          ${host ? `<div class="paket-reihe" style="margin:4px 0 12px"><button class="paket" data-alle="1">✅ Alle auswählen (ohne Ü18)</button></div>` : ""}
          <div class="kat-gitter">
          ${kats.map((k) => `
            <button class="kat-chip ${e.kategorien.includes(k.id) ? "aktiv" : ""}" data-kat="${k.id}" title="${esc(k.beschreibung)}" ${dis}>
              <span class="e">${k.emoji}</span><span><div class="n">${k.ue18 ? "🔞 " : ""}${esc(k.name)}</div><div class="z">${k.anzahl} Fragen</div></span>
            </button>`).join("")}
          </div>
          <p class="leise klein-text" style="margin-top:10px">🔞 Ü18-Kategorien sind gekennzeichnet und standardmäßig nicht ausgewählt.</p>`,
      },
      {
        id: "runden", wichtig: true, icon: "⏱️", titel: "Runden & Zeit", info: `${e.runden} Runden · ${e.sekunden ? e.sekunden + " s pro Frage" : "ohne Zeitlimit"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Runden</div>
            <div class="segment">${[5, 10, 15, 20].map((n) => `<button data-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Frage</div>
            <div class="segment">${[15, 30, 45, 60, 0].map((n) => `<button data-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis} ${n ? "" : 'title="Ohne Zeitlimit: aufgelöst wird, wenn alle getippt haben"'}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
        </div>
        ${e.sekunden ? "" : '<p class="leise klein-text" style="margin-top:10px">∞ Ohne Zeitlimit: Aufgelöst wird, sobald alle getippt haben. Der Host kann jederzeit auflösen.</p>'}`,
      },
    ];
  }

  function binde(el, z) {
    const e = z.einstellungen;
    $$("[data-modus]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ modus: b.dataset.modus })));
    $$("[data-runden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.runden })));
    $$("[data-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.sek })));
    $$("[data-kat]", el).forEach((b) => (b.onclick = () => {
      const k = b.dataset.kat;
      const neu = e.kategorien.includes(k) ? e.kategorien.filter((x) => x !== k) : [...e.kategorien, k];
      if (!neu.length) return GN.toast("Mindestens eine Kategorie muss an sein.");
      GN.einstellungen({ kategorien: neu });
    }));
    $("[data-alle]", el)?.addEventListener("click", () => GN.einstellungen({ alleKategorien: true }));
  }

  // =============================================================
  //  Anzeige je nach Phase
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "frage") {
      const key = "preis-frage-" + z.runde.nr;
      if (GN.ansicht !== key) return zeigeFrage(key, !vorher || vorher.phase !== "frage" || vorher.runde?.nr !== z.runde.nr);
      if (GN.timerNeu) { // nach Neuverbindung: Countdown mit der Restzeit vom Server weiterlaufen lassen
        GN.timerNeu = false;
        if (z.runde.sekunden) GN.starteTimer(z.runde.restMs, z.runde.sekunden * 1000, { tonAus: () => !!$(".abgegeben") });
      }
      return aktualisiereStatus();
    }
    const key = "preis-" + z.phase + "-" + z.runde.nr;
    if (GN.ansicht === key || GN.ansicht === "preis-podest-" + z.runde.nr) return GN.rangliste($("#rangliste"), rundenPunkte(z));
    if (z.phase === "ende") return zeigeEnde(key);
    zeigeAufloesung(key);
  }

  const rundenPunkte = (z) => Object.fromEntries((z.runde?.ergebnisse || []).map((e) => [e.id, e.punkte]));

  // =============================================================
  //  Frage
  // =============================================================
  function zeigeFrage(key, neueRunde) {
    GN.ansicht = key;
    const z = GN.zustand;
    const r = z.runde;
    const m = MODI[r.modus];
    eingabe = { einheit: 0, text: "" };
    sortierung = [];
    if (neueRunde) GN.intro({ oben: `Runde ${r.nr} von ${z.einstellungen.runden}`, icon: m.icon, titel: m.titel, text: m.text, dauer: Math.max(0, Math.min(1700, r.introMs - 100)) });

    const kopf = `
      <div class="runden-kopf">
        <span class="modus-badge">${m.icon} ${m.titel}</span>
        <span class="runden-nr">Runde ${r.nr} / ${z.einstellungen.runden}</span>
        <span class="timer-zahl" id="timerZahl"></span>
      </div>
      <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>`;

    let inhalt = "";
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const p = r.produkte[0];
      inhalt = `
        <div class="frage-layout">
          ${produktKarte(p)}
          <div class="karte eingabe-karte" id="eingabeBereich">
            ${r.modus === "nichtdrueber"
              ? `<div class="regel warnung">🔥 <span><b>Nicht drüber!</b> Wer über dem echten Preis liegt, bekommt 0 Punkte.</span></div>`
              : `<div class="regel">🎯 <span>Schätz den Preis. Nutze die Knöpfe für Tausend, Millionen &amp; Co.</span></div>`}
            <form id="tippForm" autocomplete="off">
              <div class="betrag">
                <input id="tippInput" inputmode="decimal" placeholder="0" aria-label="Dein Tipp" />
                <span class="waehrung" id="waehrung">${p.w}</span>
              </div>
              <div class="einheiten" style="margin-top:10px">
                ${EINHEITEN.map((e, i) => `<button type="button" data-einheit="${i}" class="${i === 0 ? "aktiv" : ""}">${e.label || p.w}</button>`).join("")}
              </div>
              <div class="vorschau" id="vorschau" style="margin:12px 0"></div>
              <button class="btn gross voll" type="submit" id="tippBtn">Tipp abgeben</button>
            </form>
          </div>
        </div>`;
    } else if (r.modus === "hoehertiefer") {
      const [a, b] = r.produkte;
      inhalt = `
        <div class="duell">
          ${produktKarte(a, `<span class="preis-etikett">${fmtPreis(a.preis, a.w)}</span>`)}
          <div class="vs">VS</div>
          ${produktKarte(b, `<span class="preis-etikett frage">??? ${b.w}</span>`)}
        </div>
        <div class="karte eingabe-karte" id="eingabeBereich" style="margin-top:14px">
          <div class="regel">⚖️ <span>Ist <b>${esc(b.name)}</b> teurer oder billiger als <b>${fmtPreis(a.preis, a.w)}</b>? Je schneller, desto mehr Punkte!</span></div>
          <div class="duell-knoepfe">
            <button class="btn" data-wahl="hoeher">⬆ Teurer</button>
            <button class="btn billiger" data-wahl="tiefer">⬇ Billiger</button>
          </div>
        </div>`;
    } else if (r.modus === "sortieren") {
      inhalt = `
        <div class="sortier-hilfe"><span>1 = am billigsten</span><span>4 = am teuersten</span></div>
        <div class="sortier-gitter">
          ${r.produkte.map((p) => `
            <button class="sortier-karte" data-id="${p.id}">
              ${bildBox(p, false)}
              <div class="t">${esc(p.name)}<div class="i">${esc(p.info)}</div></div>
            </button>`).join("")}
        </div>
        <div class="karte eingabe-karte" id="eingabeBereich" style="margin-top:14px">
          <div class="regel">📊 <span>Tippe die Karten der Reihe nach an, <b>vom billigsten zum teuersten</b>. Nochmal tippen = entfernen.</span></div>
          <div class="duell-knoepfe">
            <button class="btn zweit" id="sortReset">↺ Zurücksetzen</button>
            <button class="btn" id="sortOk" disabled>Abschicken</button>
          </div>
        </div>`;
    }

    app.innerHTML = kopf + inhalt + `<div class="status-reihe" id="statusReihe"></div><div class="host-aktion" id="hostAktion"></div>`;
    bilderEinblenden();
    verbindeFrage(r);
    aktualisiereStatus();
    GN.timerNeu = false;
    if (r.sekunden) GN.starteTimer(r.restMs, r.sekunden * 1000, { tonAus: () => !!$(".abgegeben") });
    else GN.ohneZeitlimit();
  }

  function verbindeFrage(r) {
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const w = r.produkte[0].w;
      const input = $("#tippInput");
      const aktualisieren = () => {
        eingabe.text = input.value;
        const e = EINHEITEN[eingabe.einheit];
        $("#waehrung").textContent = (e.label ? e.label + " " : "") + w;
        $$("[data-einheit]").forEach((b) => b.classList.toggle("aktiv", +b.dataset.einheit === eingabe.einheit));
        const wert = tippWert();
        $("#vorschau").innerHTML = wert === null ? "&nbsp;"
          : `= ${fmtPreis(wert, w)}${wert >= 1e6 ? ` <div class="klein">${fmtVoll(wert)} ${w}</div>` : ""}`;
      };
      input.addEventListener("input", aktualisieren);
      $$("[data-einheit]").forEach((b) => (b.onclick = () => { Ton.klick(); eingabe.einheit = +b.dataset.einheit; aktualisieren(); input.focus(); }));
      $("#tippForm").onsubmit = (ev) => {
        ev.preventDefault();
        const wert = tippWert();
        if (wert === null) return GN.toast("Gib eine Zahl ein.");
        senden(wert, fmtPreis(wert, w));
      };
      aktualisieren();
      if (matchMedia("(pointer: fine)").matches) setTimeout(() => input.focus(), 1900);
    } else if (r.modus === "hoehertiefer") {
      $$("[data-wahl]").forEach((b) => (b.onclick = () => senden(b.dataset.wahl, b.dataset.wahl === "hoeher" ? "⬆ Teurer" : "⬇ Billiger")));
    } else if (r.modus === "sortieren") {
      const zeichne = () => {
        $$(".sortier-karte").forEach((k) => {
          const pos = sortierung.indexOf(k.dataset.id);
          k.classList.toggle("gewaehlt", pos >= 0);
          k.querySelector(".rang-marke")?.remove();
          if (pos >= 0) k.insertAdjacentHTML("afterbegin", `<span class="rang-marke">${pos + 1}</span>`);
        });
        $("#sortOk").disabled = sortierung.length !== r.produkte.length;
      };
      $$(".sortier-karte").forEach((k) => (k.onclick = () => {
        if (!$("#sortOk")) return;
        const id = k.dataset.id;
        sortierung = sortierung.includes(id) ? sortierung.filter((x) => x !== id) : [...sortierung, id];
        Ton.klick();
        zeichne();
      }));
      $("#sortReset").onclick = () => { sortierung = []; zeichne(); };
      $("#sortOk").onclick = () => senden([...sortierung], "Reihenfolge abgeschickt");
    }
  }

  function tippWert() {
    let t = eingabe.text.replace(/\s/g, "");
    if (!t) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    const zahl = parseFloat(t);
    if (!isFinite(zahl) || zahl < 0) return null;
    return zahl * EINHEITEN[eingabe.einheit].faktor;
  }

  function senden(wert, anzeige) {
    GN.aktion("antwort", wert);
    Ton.abgeben();
    zeigeAbgegeben(anzeige);
  }

  function zeigeAbgegeben(anzeige) {
    const bereich = $("#eingabeBereich");
    if (!bereich) return;
    bereich.innerHTML = `<div class="abgegeben">✅ Abgegeben!${anzeige ? `<div class="gross">${esc(anzeige)}</div>` : ""}
      <div class="leise" style="margin-top:6px">Warte auf die anderen …</div></div>`;
    $$(".sortier-karte").forEach((k) => (k.style.pointerEvents = "none"));
  }

  function aktualisiereStatus() {
    const z = GN.zustand;
    const reihe = $("#statusReihe");
    if (!reihe) return;
    reihe.innerHTML = z.spieler.filter((s) => s.online && !s.zuschauer).map((s) =>
      `<span class="status ${s.fertig ? "fertig" : ""} ${s.afk && !s.fertig ? "afk" : ""}" title="${esc(s.name)}${s.afk ? " (abwesend, es wird nicht gewartet)" : ""}"><span class="avatar">${s.avatar}</span></span>`).join("");
    const ich = z.spieler.find((s) => s.id === GN.ich);
    if (ich?.fertig && !$(".abgegeben")) zeigeAbgegeben("");
    // Ohne Zeitlimit kann der Host die Runde jederzeit auflösen
    const box = $("#hostAktion");
    const offen = z.spieler.filter((s) => s.online && !s.zuschauer && !s.afk && !s.fertig).length;
    if (box) box.innerHTML = GN.istHost() && !z.runde.sekunden
      ? `<button class="btn zweit" id="aufloesenBtn">⏭ Jetzt auflösen${offen ? ` <span class="leise">(${offen} ${offen === 1 ? "tippt" : "tippen"} noch)</span>` : ""}</button>` : "";
    $("#aufloesenBtn")?.addEventListener("click", () => {
      if (offen && !confirm("Noch nicht alle haben getippt. Trotzdem auflösen?")) return;
      GN.aktion("aufloesen");
    });
  }

  // =============================================================
  //  Auflösung
  // =============================================================
  function zeigeAufloesung(key) {
    GN.ansicht = key;
    GN.stoppeTimer();
    $("#intro").classList.add("versteckt");
    const z = GN.zustand;
    const r = z.runde;
    const host = GN.istHost();

    let links = "";
    let zielPreis = null;
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const p = r.produkte[0];
      zielPreis = p;
      links = `
        <div class="karte produkt-karte" style="padding:0">
          ${bildBox(p, true)}
          <div class="produkt-text" style="padding-bottom:0">
            <div class="produkt-name">${esc(p.name)}</div>
            <div class="produkt-info">${esc(p.info)}</div>
          </div>
          <div class="preis-reveal"><div class="label">Der echte Preis</div><div class="preis-gross" id="preisGross">0</div></div>
          <div class="zahlenstrahl" id="zahlenstrahl"></div>
          <div class="fakt" id="fakt">💡 <span>${esc(p.fakt || "")}</span></div>
        </div>`;
    } else if (r.modus === "hoehertiefer") {
      const [a, b] = r.produkte;
      zielPreis = b;
      links = `
        <div class="duell">
          ${produktKarte(a, `<span class="preis-etikett">${fmtPreis(a.preis, a.w)}</span>`)}
          <div class="vs">VS</div>
          ${produktKarte(b, `<span class="preis-etikett" id="preisGross">0</span>`)}
        </div>
        <div class="urteil ${r.loesung}" id="urteil" style="visibility:hidden">${r.loesung === "hoeher" ? "⬆ TEURER!" : "⬇ BILLIGER!"}</div>
        <div class="karte fakt" id="fakt" style="margin:0">💡 <span>${esc(b.fakt || "")}</span></div>`;
    } else if (r.modus === "sortieren") {
      const nachId = Object.fromEntries(r.produkte.map((p) => [p.id, p]));
      links = `
        <div class="karte" style="padding:0">
          <div class="preis-reveal"><div class="label">Richtige Reihenfolge</div></div>
          <div class="loesung-liste">
            ${r.loesung.map((id, i) => {
              const p = nachId[id];
              return `<div class="loesung-zeile ergebnis">
                <span class="nr">${i + 1}</span>
                <span class="thumb">${p.bild ? `<img src="${esc(p.bild.url)}" alt="" loading="lazy">` : p.emoji}</span>
                <span class="n">${esc(p.name)}</span>
                <span class="p">${fmtPreis(p.preis, p.w)}</span>
              </div>`;
            }).join("")}
          </div>
          ${new Set(r.produkte.map((p) => p.w)).size > 1 ? '<div class="leise klein-text" style="padding:0 16px 14px">Verschiedene Währungen wurden umgerechnet verglichen.</div>' : ""}
        </div>`;
    }

    app.innerHTML = `
      <div class="runden-kopf">
        <span class="modus-badge">${MODI[r.modus].icon} ${MODI[r.modus].titel}</span>
        <span class="runden-nr">Runde ${r.nr} / ${z.einstellungen.runden}</span>
      </div>
      <div class="aufloesung-layout">${links}
        <div>
          <div class="abschnitt-titel" style="margin-top:0">Diese Runde</div>
          <div class="ergebnis-liste">${r.ergebnisse.map((e) => ergebnisZeile(e, r)).join("")}</div>
          <div class="abschnitt-titel">Punktestand</div>
          <div class="rangliste" id="rangliste"></div>
          <div class="start-leiste">
            ${host ? `<button class="btn gross voll" id="weiterBtn">Nächste Runde ➜</button>`
              : `<div class="warte">Warte auf den Host${GN.wartePunkte()}</div>`}
          </div>
        </div>
      </div>`;
    bilderEinblenden();
    $("#weiterBtn")?.addEventListener("click", () => GN.aktion("naechsteRunde"));
    GN.rangliste($("#rangliste"), rundenPunkte(z), true);
    (z.vorladen || []).forEach((url) => { const i = new Image(); i.src = url; });

    // Trommelwirbel → Preis zählt hoch → Ergebnisse erscheinen
    const meins = r.ergebnisse.find((e) => e.id === GN.ich);
    const dauer = zielPreis ? 1500 : 300;
    if (zielPreis) {
      Ton.trommel(dauer / 1000);
      hochzaehlen($("#preisGross"), zielPreis.preis, zielPreis.w, dauer);
    }
    setTimeout(() => {
      if (!$("#rangliste")) return;
      if (zielPreis) { Ton.ding(); $("#preisGross")?.classList.add("fertig"); }
      $("#urteil")?.style.setProperty("visibility", "visible");
      if (r.modus === "klassisch" || r.modus === "nichtdrueber") zeichneZahlenstrahl(r);
      setTimeout(() => {
        if (meins?.volltreffer) Ton.volltreffer();
        else if (meins && meins.tipp !== null) (meins.punkte > 0 ? Ton.richtig : Ton.falsch)();
      }, 250);
      $$(".ergebnis").forEach((el, i) => setTimeout(() => el.classList.add("sichtbar"), 150 + i * 110));
      setTimeout(() => $("#fakt")?.classList.add("sichtbar"), 500);
      if (meins?.volltreffer) GN.konfetti(70);
      // Je näher dran, desto stärker der Effekt: Die Stärke ist selbst die Information
      if (meins && meins.tipp !== null && meins.punkte > 0) {
        const best = Math.max(...r.ergebnisse.map((e) => e.punkte || 0));
        const staerke = meins.volltreffer ? 3 : meins.punkte >= best ? 2 : 1;
        setTimeout(() => {
          GN.fx?.knall(meins.volltreffer ? "🎯 Volltreffer!" : staerke === 2 ? "🥇 Am nächsten dran!" : `+${meins.punkte}`, staerke, staerke > 1 ? `+${meins.punkte} Punkte` : "");
          if (staerke >= 2) GN.konfetti(staerke === 3 ? 160 : 60);
          GN.fx?.teilchen($(".ergebnis.ich") || $("#preisGross"), null, staerke === 3 ? "sterne" : "funken");
        }, 350);
      }
    }, dauer);
  }

  function ergebnisZeile(e, r) {
    const s = GN.spieler(e.id);
    let detail = "";
    let tag = "";
    if (e.tipp === null) detail = "Keine Antwort";
    else if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const w = r.produkte[0].w;
      const prozent = Math.round(Math.abs(e.abweichung) * 100);
      detail = `${fmtPreis(e.tipp, w)} · ${prozent === 0 ? "exakt" : `${prozent} % ${e.abweichung > 0 ? "zu hoch" : "zu niedrig"}`}`;
      if (e.volltreffer) tag = '<span class="tag gold">VOLLTREFFER</span>';
      else if (e.drueber) tag = '<span class="tag rot">DRÜBER</span>';
      else if (e.platz === 1) tag = '<span class="tag gruen">BESTER</span>';
    } else if (r.modus === "hoehertiefer") {
      detail = e.tipp === "hoeher" ? "⬆ Teurer" : "⬇ Billiger";
      tag = e.richtig ? '<span class="tag gruen">RICHTIG</span>' : '<span class="tag rot">FALSCH</span>';
    } else if (r.modus === "sortieren") {
      detail = `<span class="mini-reihe">${e.treffer.map((t, i) => `<span class="${t ? "ok" : "nein"}">${i + 1}</span>`).join("")}</span>`;
      if (e.treffer.every(Boolean)) tag = '<span class="tag gold">PERFEKT</span>';
    }
    return `<div class="ergebnis ${e.id === GN.ich ? "ich" : ""}">
      <span class="avatar">${s.avatar}</span>
      <div><div class="name">${esc(s.name)}${tag}</div><div class="detail">${detail}</div></div>
      <span class="plus ${e.punkte ? "" : "null"}">+${e.punkte}</span>
    </div>`;
  }

  function zeichneZahlenstrahl(r) {
    const box = $("#zahlenstrahl");
    if (!box) return;
    const p = r.produkte[0];
    const tipps = r.ergebnisse.filter((e) => e.tipp > 0);
    const werte = [p.preis, ...tipps.map((e) => e.tipp)];
    const lo = Math.log10(Math.min(...werte) / 1.6);
    const hi = Math.log10(Math.max(...werte) * 1.6);
    const pos = (v) => Math.min(96, Math.max(4, ((Math.log10(v) - lo) / (hi - lo || 1)) * 100));
    const marken = tipps.map((e) => ({ e, x: pos(e.tipp) })).sort((a, b) => a.x - b.x);
    let letzteX = -100, ebene = 0;
    for (const m of marken) { ebene = m.x - letzteX < 7 ? 1 - ebene : 0; m.ebene = ebene; letzteX = m.x; }
    box.style.height = marken.some((m) => m.ebene) ? "116px" : "92px";
    box.innerHTML = `<div class="linie" style="top:40px"></div>
      <div class="ziel" style="left:${pos(p.preis)}%"><span class="fahne">${fmtPreis(p.preis, p.w)}</span><span class="stab" style="height:30px"></span></div>
      ${marken.map((m) => {
        const s = GN.spieler(m.e.id);
        return `<div class="marke ${m.e.drueber ? "drueber" : ""}" style="left:50%;top:${48 + m.ebene * 28}px" data-x="${m.x}" title="${esc(s.name)}: ${fmtPreis(m.e.tipp, p.w)}">
          <span class="avatar">${s.avatar}</span></div>`;
      }).join("")}`;
    requestAnimationFrame(() => requestAnimationFrame(() => $$(".marke", box).forEach((el) => (el.style.left = el.dataset.x + "%"))));
  }

  // =============================================================
  //  Spielende: erst letzte Auflösung, dann Podest
  // =============================================================
  function zeigeEnde(key) {
    const nr = GN.zustand.runde.nr;
    zeigeAufloesung(key);
    const leiste = $(".start-leiste");
    if (leiste) leiste.innerHTML = `<button class="btn gross voll" id="podestBtn">🏆 Zur Siegerehrung</button>`;
    $("#podestBtn").onclick = () => GN.podest("preis-podest-" + nr);
    clearTimeout(zeigeEnde.t);
    zeigeEnde.t = setTimeout(() => GN.ansicht === key && GN.podest("preis-podest-" + nr), 9000);
  }

  // =============================================================
  //  Bausteine
  // =============================================================
  // ---------- Gezeichnete Illustrationen für Fragen ohne freies Foto ----------
  // Jede Kategorie hat ein eigenes Motiv im Hintergrund, das Symbol steht groß in der Mitte.
  const MOTIVE = {
    film: `<g opacity=".5"><rect x="0" y="18" width="400" height="30" fill="#000"/><rect x="0" y="202" width="400" height="30" fill="#000"/>
      ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 30 + 6}" y="25" width="16" height="16" rx="3" fill="#fff" opacity=".7"/><rect x="${i * 30 + 6}" y="209" width="16" height="16" rx="3" fill="#fff" opacity=".7"/>`).join("")}</g>
      <path d="M200 -20 L120 250 L280 250 Z" fill="#fff" opacity=".07"/>`,
    auktion: `<rect x="110" y="40" width="180" height="170" rx="6" fill="none" stroke="#d9a74a" stroke-width="12" opacity=".8"/>
      <rect x="126" y="56" width="148" height="138" fill="#000" opacity=".25"/><path d="M200 -10 L130 60 L270 60 Z" fill="#fff" opacity=".1"/>`,
    crime: `<g transform="rotate(-12 200 125)" opacity=".85"><rect x="-40" y="185" width="480" height="34" fill="#ffd23f"/>
      ${Array.from({ length: 9 }, (_, i) => `<text x="${i * 60 - 30}" y="208" font-family="Arial Black,Arial" font-weight="900" font-size="16" fill="#111">POLICE</text>`).join("")}</g>
      <circle cx="40" cy="30" r="60" fill="#3a6bff" opacity=".25"/><circle cx="360" cy="30" r="60" fill="#ff3b3b" opacity=".25"/>`,
    nacht: `${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 37) % 400}" cy="${20 + ((i * 53) % 210)}" r="${2 + (i % 3)}" fill="${["#ff5fa8", "#ffcb47", "#5cc8ff"][i % 3]}" opacity=".8"/>`).join("")}
      <rect x="90" y="30" width="220" height="190" rx="24" fill="none" stroke="#ff5fa8" stroke-width="4" opacity=".7"/>`,
    internet: `${Array.from({ length: 40 }, (_, i) => `<rect x="${(i % 10) * 42 + 4}" y="${Math.floor(i / 10) * 64 + 8}" width="32" height="32" rx="9" fill="#fff" opacity="${0.04 + (i % 4) * 0.03}"/>`).join("")}`,
    deutschland: `<g transform="rotate(-20 200 125)" opacity=".45"><rect x="-80" y="40" width="560" height="40" fill="#000"/><rect x="-80" y="80" width="560" height="40" fill="#dd0000"/><rect x="-80" y="120" width="560" height="40" fill="#ffce00"/></g>`,
    geschichte: `<rect x="70" y="30" width="260" height="190" rx="10" fill="#e8d3a2" opacity=".25"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="95" y="${55 + i * 26}" width="${150 + ((i * 37) % 60)}" height="5" rx="2" fill="#e8d3a2" opacity=".35"/>`).join("")}`,
    tiere: `${Array.from({ length: 8 }, (_, i) => `<g transform="translate(${30 + i * 48} ${i % 2 ? 190 : 40}) rotate(${i * 25})" fill="#fff" opacity=".12"><circle r="9"/><circle cx="-10" cy="-12" r="4"/><circle cx="0" cy="-16" r="4"/><circle cx="10" cy="-12" r="4"/></g>`).join("")}`,
    luxus: `${Array.from({ length: 14 }, (_, i) => `<path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" transform="translate(${(i * 71) % 400} ${(i * 47) % 240}) scale(${1 + (i % 3)})" fill="#ffe8a3" opacity=".6"/>`).join("")}`,
    sport: `<circle cx="200" cy="125" r="150" fill="none" stroke="#fff" stroke-width="3" opacity=".12"/><circle cx="200" cy="125" r="60" fill="none" stroke="#fff" stroke-width="3" opacity=".12"/><line x1="200" y1="0" x2="200" y2="250" stroke="#fff" stroke-width="3" opacity=".12"/>`,
    essen: `<circle cx="200" cy="125" r="96" fill="#fff" opacity=".1"/><circle cx="200" cy="125" r="76" fill="#fff" opacity=".08"/>
      <rect x="70" y="60" width="8" height="130" rx="4" fill="#fff" opacity=".25"/><rect x="322" y="60" width="8" height="130" rx="4" fill="#fff" opacity=".25"/>`,
  };
  function zeichnung(p) {
    const motiv = MOTIVE[p.kat] || `${Array.from({ length: 12 }, (_, i) => `<path d="M200 125 L${200 + 300 * Math.cos(i * 0.5236)} ${125 + 300 * Math.sin(i * 0.5236)} L${200 + 300 * Math.cos(i * 0.5236 + 0.26)} ${125 + 300 * Math.sin(i * 0.5236 + 0.26)} Z" fill="#fff" opacity=".05"/>`).join("")}`;
    return `<svg class="zeichnung" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><radialGradient id="zg-${p.id}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="var(--gold)" stop-opacity=".45"/><stop offset="1" stop-color="var(--flaeche-2)" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="250" fill="var(--flaeche-2)"/>${motiv}<rect width="400" height="250" fill="url(#zg-${p.id})"/>
      <circle cx="200" cy="125" r="62" fill="var(--bg)" opacity=".55"/><circle class="z-ring" cx="200" cy="125" r="62" fill="none" stroke="var(--gold)" stroke-width="3" stroke-dasharray="8 6" opacity=".8"/>
      <g class="z-funken">${Array.from({ length: 9 }, (_, i) => `<circle cx="${40 + ((i * 47) % 330)}" cy="${30 + ((i * 71) % 190)}" r="${2 + (i % 3)}" fill="#fff" style="--i:${i}"/>`).join("")}</g>
    </svg>`;
  }

  function bildBox(p, mitCredit = true) {
    const kat = meta().kategorien.find((k) => k.id === p.kat);
    // Durchsichtige Logos und Grafiken (in den Daten mit "grafik": true markiert): heller Hintergrund, ganz zeigen statt zuschneiden
    const grafik = p.bild?.grafik;
    return `<div class="bild-box ${p.bild ? "" : "gezeichnet"} ${grafik ? "grafik" : ""}">
      ${p.bild ? "" : zeichnung(p)}
      <div class="emoji-gross">${p.emoji}</div>
      ${p.bild ? `<img src="${esc(p.bild.url)}" alt="${esc(p.name)}" decoding="async" referrerpolicy="no-referrer">` : ""}
      ${kat && mitCredit ? `<span class="kat-badge">${kat.emoji} ${esc(kat.name)}</span>` : ""}
      ${p.bild && mitCredit ? `<a class="bild-credit" href="${esc(p.bild.quelle)}" target="_blank" rel="noopener">📷 ${esc(p.bild.autor)} · ${esc(p.bild.lizenz)}</a>` : ""}
    </div>`;
  }

  function produktKarte(p, extra = "") {
    return `<div class="karte produkt-karte">
      ${bildBox(p)}
      <div class="produkt-text">
        <div class="produkt-name">${esc(p.name)}</div>
        <div class="produkt-info">${esc(p.info)}</div>
        ${extra}
      </div>
    </div>`;
  }

  function bilderEinblenden() {
    $$(".bild-box img").forEach((img) => {
      const fertig = () => img.classList.add("geladen");
      if (img.complete && img.naturalWidth) fertig();
      else {
        img.addEventListener("load", fertig, { once: true });
        img.addEventListener("error", () => img.remove(), { once: true });
      }
    });
  }

  function hochzaehlen(el, ziel, w, dauer) {
    if (!el) return;
    const start = performance.now();
    const schritt = (jetzt) => {
      if (!el.isConnected) return;
      const t = Math.min(1, (jetzt - start) / dauer);
      const k = 1 - Math.pow(1 - t, 3);
      const wert = ziel > 1000 ? Math.pow(10, Math.log10(ziel) * k) * (k > 0 ? 1 : 0) : ziel * k;
      el.textContent = fmtPreis(t >= 1 ? ziel : wert, w);
      if (t < 1) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  }

  function fmtPreis(n, w = "€") {
    if (n === null || n === undefined) return "?";
    for (const [f, name] of [[1e12, "Bio."], [1e9, "Mrd."], [1e6, "Mio."]]) {
      if (n >= f) return `${(n / f).toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${name} ${w}`;
    }
    let opt;
    if (Number.isInteger(n)) opt = { maximumFractionDigits: 0 };
    else if (n < 1) opt = { minimumFractionDigits: 2, maximumFractionDigits: 4 };
    else opt = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return `${n.toLocaleString("de-DE", opt)} ${w}`;
  }
  const fmtVoll = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

  GN.spiele.preis = {
    icon: "💰",
    titel: "Preis-Schätzer",
    kurz: "Was kostet ein Windrad? 4 Modi, 81 Fragen.",
    beschreibung: "Was kostet ein Windrad, ein Bugatti oder 1 Gramm Antimaterie? Schätzt, sortiert und zockt um Punkte.",
    tags: ["💰 137 Fragen", "🗂️ 15 Themen", "🎮 4 Modi", "🖼️ Echte Fotos"],
    abschnitte,
    binde,
    zeige,
  };
})();
