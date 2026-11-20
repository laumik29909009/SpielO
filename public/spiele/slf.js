// =============================================================
//  Stadt Land Fluss – Browser-Teil
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const meta = () => GN.meta.spiele.slf || { gruppen: [], pakete: [], punkte: {} };

  let entwurf = {};
  let sendeTimer = null;
  let letzterGesendet = "";

  // Eigene Antworten nach Verbindungsabbruch zurückbekommen
  GN.socket.on("slf:entwurf", (d) => {
    entwurf = { ...d };
    $$("[data-feld]").forEach((i) => { i.value = entwurf[i.dataset.feld] || ""; pruefeFeld(i); });
    aktualisiereStoppKnopf();
  });

  // =============================================================
  //  Lobby-Einstellungen
  // =============================================================
  function lobby(el, z, host) {
    const e = z.einstellungen;
    const m = meta();
    const dis = host ? "" : "disabled";
    const aktiv = new Set(e.kategorien.map((k) => k.id));
    const p = m.punkte;

    el.innerHTML = `
      <div class="abschnitt-titel">Kategorien <span class="normal">· ${e.kategorien.length}/${m.maxKategorien} · 3 bis 8 sind ideal</span></div>
      <div class="gewaehlt-liste">
        ${e.kategorien.map((k) => `
          <span class="gewaehlt-chip">${k.emoji} ${esc(k.name)}${k.frei ? ' <span class="mini-tag">kreativ</span>' : ""}
            ${host ? `<button data-weg="${k.id}" aria-label="${esc(k.name)} entfernen">✕</button>` : ""}</span>`).join("")}
      </div>
      ${host ? `
        <div class="paket-reihe">
          ${m.pakete.map((x) => `<button class="paket" data-paket="${x.id}">${x.emoji} ${esc(x.name)}</button>`).join("")}
          <button class="paket" data-zufall="1">🎲 Zufall</button>
        </div>
        <details class="kat-auswahl" ${GN.speicher("slfAuswahlOffen") === "1" ? "open" : ""}>
          <summary>Alle Kategorien anzeigen</summary>
          ${m.gruppen.map((g) => `
            <div class="gruppe-titel">${esc(g.name)}</div>
            <div class="chip-reihe">
              ${g.kategorien.map((k) => `<button class="auswahl-chip ${aktiv.has(k.id) ? "aktiv" : ""}" data-kat="${k.id}">${k.emoji} ${esc(k.name)}</button>`).join("")}
            </div>`).join("")}
        </details>
        <form class="eigene-zeile" id="eigeneForm" autocomplete="off">
          <input class="feld" id="eigeneInput" maxlength="32" placeholder="Eigene Kategorie, z. B. „Etwas Rundes“" />
          <label class="check"><input type="checkbox" id="eigeneFrei"> kreativ</label>
          <button class="btn zweit" type="submit">＋</button>
        </form>
        <p class="leise klein-text">„kreativ“ heißt: Jede passende Antwort zählt, z. B. bei Sprüchen oder Ausreden.</p>` : ""}

      <div class="einstellungs-zeile">
        <div><div class="abschnitt-titel">Runden</div>
          <div class="segment">${[3, 5, 8, 10].map((n) => `<button data-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
        <div><div class="abschnitt-titel">Zeit pro Runde</div>
          <div class="segment">${[60, 90, 120, 180].map((n) => `<button data-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n < 120 ? n + "s" : n / 60 + " min"}</button>`).join("")}</div></div>
      </div>

      <div class="abschnitt-titel">Regeln</div>
      <div class="schalter-liste">
        ${schalter("stopp", e.stopp, "🛑 Stopp-Knopf", "Wer alles ausgefüllt hat, kann Stopp drücken. Dann haben alle noch 10 Sekunden.", dis)}
        ${schalter("schwer", e.schwer, "🧨 Schwere Buchstaben", "C, J, Q, X und Y kommen auch vor.", dis)}
        ${schalter("ki", e.ki && m.kiVerfuegbar, "🤖 KI-Schiedsrichter", m.kiVerfuegbar
          ? "Claude prüft jede Antwort und erklärt kurz, warum sie zählt oder nicht."
          : "Nicht eingerichtet: Es wird mit Wortlisten geprüft. (Anleitung im README)", m.kiVerfuegbar ? dis : "disabled")}
      </div>

      <div class="punkte-info">
        <div><b>${p.allein}</b><span>Nur du hast eine gültige Antwort</span></div>
        <div><b>${p.einzigartig}</b><span>Deine Antwort hat sonst keiner</span></div>
        <div><b>${p.doppelt}</b><span>Jemand hat dasselbe</span></div>
        <div><b>+${p.stern}</b><span>pro ⭐ für kreative Antworten</span></div>
      </div>`;

    if (!host) return;
    $$("[data-weg]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ umschalten: b.dataset.weg })));
    $$("[data-kat]", el).forEach((b) => (b.onclick = () => {
      if (!aktiv.has(b.dataset.kat) && e.kategorien.length >= m.maxKategorien) return GN.toast(`Maximal ${m.maxKategorien} Kategorien.`);
      GN.einstellungen({ umschalten: b.dataset.kat });
    }));
    $$("[data-paket]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ paket: b.dataset.paket })));
    $("[data-zufall]", el).onclick = () => GN.einstellungen({ zufall: true });
    $(".kat-auswahl", el).addEventListener("toggle", (ev) => GN.speicher("slfAuswahlOffen", ev.target.open ? "1" : "0"));
    $("#eigeneForm", el).onsubmit = (ev) => {
      ev.preventDefault();
      const name = $("#eigeneInput").value.trim();
      if (name.length < 2) return GN.toast("Der Name ist zu kurz.");
      if (e.kategorien.length >= m.maxKategorien) return GN.toast(`Maximal ${m.maxKategorien} Kategorien.`);
      $("#eigeneInput").value = "";
      GN.einstellungen({ eigene: name, frei: $("#eigeneFrei").checked });
    };
    $$("[data-runden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.runden })));
    $$("[data-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.sek })));
    $$("[data-schalter]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ [b.dataset.schalter]: b.getAttribute("aria-checked") !== "true" })));
  }

  function schalter(id, an, titel, text, dis) {
    return `<button class="schalter" role="switch" aria-checked="${!!an}" data-schalter="${id}" ${dis}>
      <span class="schalter-text"><b>${titel}</b><span>${text}</span></span><span class="schalter-knopf"></span></button>`;
  }

  // =============================================================
  //  Anzeige je nach Phase
  // =============================================================
  function zeige(z, vorher) {
    const key = `slf-${z.rundeNr}-`;
    const p = z.phase;
    if (p === "buchstabe") {
      if (GN.ansicht !== key + "rad") zeigeRad(key + "rad");
      return;
    }
    if (p === "schreiben" || p === "stopp") {
      if (GN.ansicht !== key + "schreiben") zeigeSchreiben(key + "schreiben");
      else aktualisiereSchreiben(z, vorher);
      return;
    }
    if (p === "pruefen") {
      if (GN.ansicht !== key + "pruefen") {
        sendeEntwurf(true); // letzter Stand sofort an den Server
        zeigePruefen(key + "pruefen");
      }
      return;
    }
    if (p === "bewerten") {
      const neu = GN.ansicht !== key + "bewerten";
      return zeigeBewerten(key + "bewerten", neu);
    }
    if (p === "ende") {
      if (!GN.ansicht.startsWith("slf-podest")) GN.podest("slf-podest-" + z.rundeNr);
      else GN.rangliste($("#rangliste"));
    }
  }

  // =============================================================
  //  1) Buchstaben-Glücksrad
  // =============================================================
  function zeigeRad(key) {
    GN.ansicht = key;
    GN.stoppeTimer();
    const z = GN.zustand;
    entwurf = {};
    letzterGesendet = "";
    const schritt = 360 / ALPHABET.length;
    const ziel = ALPHABET.indexOf(z.buchstabe);
    const drehung = 360 * 5 - ziel * schritt;
    const dauer = Math.max(800, z.restMs - 700);

    app.innerHTML = `
      <div class="rad-buehne">
        <div class="runden-nr">Runde ${z.rundeNr} von ${z.rundenGesamt}</div>
        <div class="rad-rahmen">
          <div class="rad-zeiger">▼</div>
          <div class="rad" id="rad">
            ${ALPHABET.map((b, i) => `<span class="rad-buchstabe" style="transform:rotate(${i * schritt}deg) translateY(-118px)">${b}</span>`).join("")}
          </div>
          <div class="rad-mitte" id="radMitte">?</div>
        </div>
        <div class="rad-kategorien">${z.kategorien.map((k) => `<span>${k.emoji} ${esc(k.name)}</span>`).join("")}</div>
      </div>`;

    const rad = $("#rad");
    rad.style.transition = `transform ${dauer}ms cubic-bezier(.12,.75,.15,1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => (rad.style.transform = `rotate(${drehung}deg)`)));

    // Klick-Geräusche, die langsamer werden
    let t = 0, abstand = 50;
    while (t < dauer - 200) { setTimeout(() => GN.ansicht === key && Ton.tick(), t); t += abstand; abstand *= 1.09; }
    setTimeout(() => {
      if (GN.ansicht !== key) return;
      const mitte = $("#radMitte");
      mitte.textContent = z.buchstabe;
      mitte.classList.add("fertig");
      Ton.ding();
    }, dauer);
  }

  // =============================================================
  //  2) Schreiben
  // =============================================================
  function zeigeSchreiben(key) {
    const z = GN.zustand;
    const vomRad = GN.ansicht.endsWith("rad");
    GN.ansicht = key;
    const b = z.buchstabe;

    app.innerHTML = `
      <div class="runden-kopf">
        <span class="buchstabe-badge">${b}</span>
        <span class="runden-nr">Runde ${z.rundeNr} / ${z.rundenGesamt}</span>
        <span class="timer-zahl" id="timerZahl"></span>
      </div>
      <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
      <div class="stopp-banner versteckt" id="stoppBanner"></div>
      <form class="felder" id="felder" autocomplete="off" onsubmit="return false">
        ${z.kategorien.map((k, i) => `
          <label class="feld-karte" style="animation-delay:${i * 50}ms">
            <span class="feld-kopf">${k.emoji} ${esc(k.name)}${k.frei ? ' <span class="mini-tag">kreativ</span>' : ""}</span>
            <span class="feld-zeile">
              <input data-feld="${k.id}" maxlength="50" placeholder="${b} …" autocapitalize="sentences" spellcheck="false" enterkeyhint="next" value="${esc(entwurf[k.id] || "")}" />
              <span class="feld-status"></span>
            </span>
          </label>`).join("")}
      </form>
      ${z.stoppErlaubt ? `<button class="btn gross voll stopp-knopf" id="stoppBtn" disabled>🛑 STOPP!</button>` : ""}
      <div class="fortschritt-reihe" id="fortschritt"></div>`;

    const felder = $$("[data-feld]");
    felder.forEach((input, i) => {
      pruefeFeld(input);
      input.addEventListener("input", () => {
        entwurf[input.dataset.feld] = input.value;
        pruefeFeld(input);
        aktualisiereStoppKnopf();
        clearTimeout(sendeTimer);
        sendeTimer = setTimeout(() => sendeEntwurf(), 700);
      });
      input.addEventListener("blur", () => sendeEntwurf());
      input.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        (felder[i + 1] || input).focus();
        if (!felder[i + 1]) input.blur();
      });
    });
    $("#stoppBtn")?.addEventListener("click", () => {
      sendeEntwurf(true);
      GN.aktion("stopp", entwurf);
    });
    if (vomRad && matchMedia("(pointer: fine)").matches) felder[0]?.focus();
    aktualisiereStoppKnopf();
    aktualisiereSchreiben(z, null);
  }

  function aktualisiereSchreiben(z, vorher) {
    const gesamt = z.kategorien.length;
    $("#fortschritt").innerHTML = z.spieler.filter((s) => s.online).map((s) => `
      <span class="fortschritt ${s.fortschritt === gesamt ? "voll" : ""}" title="${esc(s.name)}">
        <span class="avatar">${s.avatar}</span><span>${s.fortschritt || 0}/${gesamt}</span>
      </span>`).join("");

    const stoppNeu = z.phase === "stopp" && (!vorher || vorher.phase !== "stopp");
    if (z.phase === "stopp") {
      const wer = GN.spieler(z.stoppVon);
      const banner = $("#stoppBanner");
      banner.innerHTML = z.stoppVon === GN.ich
        ? "🛑 Du hast STOPP gerufen! Die anderen haben noch ein paar Sekunden."
        : `🛑 <b>${esc(wer.name)}</b> hat STOPP gerufen! Schnell fertig schreiben!`;
      banner.classList.remove("versteckt");
      $("#stoppBtn")?.remove();
      if (stoppNeu) {
        Ton.alarm();
        if (z.stoppVon !== GN.ich) GN.intro({ icon: "🛑", titel: "STOPP!", text: `${esc(wer.name)} ist fertig. Noch ${Math.ceil(z.restMs / 1000)} Sekunden!`, dauer: 1300, ton: false });
        document.body.classList.add("wackeln");
        setTimeout(() => document.body.classList.remove("wackeln"), 500);
      }
    }
    if (!vorher || vorher.phase !== z.phase || stoppNeu || GN.timerNeu) {
      GN.starteTimer(z.restMs, z.phase === "stopp" ? 10000 : z.sekunden * 1000, { tickAb: z.phase === "stopp" ? 10000 : 10000 });
    }
  }

  function pruefeFeld(input) {
    const z = GN.zustand;
    const t = input.value.trim();
    const zustand = !t ? "" : beginntMit(t, z.buchstabe) ? "ok" : "falsch";
    input.closest(".feld-karte")?.setAttribute("data-zustand", zustand);
    const status = input.parentElement.querySelector(".feld-status");
    if (status) status.textContent = zustand === "ok" ? "✓" : zustand === "falsch" ? `≠ ${z.buchstabe}` : "";
  }

  function beginntMit(text, b) {
    const n = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(der|die|das|the|ein|eine)\s+/, "").trim();
    return n.startsWith(b.toLowerCase()) || text.trim().toLowerCase().startsWith(b.toLowerCase());
  }

  function aktualisiereStoppKnopf() {
    const knopf = $("#stoppBtn");
    if (!knopf) return;
    const z = GN.zustand;
    knopf.disabled = !z.kategorien.every((k) => (entwurf[k.id] || "").trim() && beginntMit(entwurf[k.id], z.buchstabe));
  }

  function sendeEntwurf(sofort) {
    clearTimeout(sendeTimer);
    const json = JSON.stringify(entwurf);
    if (!sofort && json === letzterGesendet) return;
    letzterGesendet = json;
    GN.aktion("entwurf", entwurf);
  }

  // =============================================================
  //  3) Schiedsrichter prüft
  // =============================================================
  function zeigePruefen(key) {
    GN.ansicht = key;
    GN.stoppeTimer();
    const z = GN.zustand;
    Ton.abgeben();
    app.innerHTML = `
      <div class="pruefen-buehne">
        <div class="lupe">${z.kiAktiv ? "🤖" : "📚"}</div>
        <h2>${z.kiAktiv ? "Die KI prüft eure Antworten" : "Antworten werden geprüft"}${GN.wartePunkte()}</h2>
        <p class="leise">${z.kiAktiv ? "Gibt es das wirklich? Passt es zur Kategorie? Hat jemand dasselbe?" : "Wortlisten, Anfangsbuchstaben und doppelte Antworten"}</p>
        <div class="scan"><span></span></div>
      </div>`;
  }

  // =============================================================
  //  4) Bewerten & Abstimmen
  // =============================================================
  const QUELLE = { liste: "📚", ki: "🤖", regel: "📏", abstimmung: "🗳️", host: "👑" };
  const ART = { allein: "nur du!", einzigartig: "einzigartig", doppelt: "doppelt", ungueltig: "" };

  function zeigeBewerten(key, neu) {
    const z = GN.zustand;
    const host = GN.istHost();
    const letzte = z.rundeNr >= z.rundenGesamt;
    const scroll = scrollY;
    GN.ansicht = key;
    GN.stoppeTimer();
    $("#intro").classList.add("versteckt");

    const ichBereit = GN.spieler(GN.ich).bereit;
    const bereitAnzahl = z.spieler.filter((s) => s.online && s.bereit).length;
    const online = z.spieler.filter((s) => s.online).length;

    app.innerHTML = `
      <div class="runden-kopf">
        <span class="buchstabe-badge">${z.buchstabe}</span>
        <span class="runden-nr">Runde ${z.rundeNr} / ${z.rundenGesamt} · Auswertung</span>
        <span></span>
      </div>
      <div class="hinweis-box">
        <span>👍 👎 Stimmt ab, wenn ihr eine Entscheidung anders seht. Die Mehrheit gewinnt.
        ⭐ gibt +${meta().punkte.stern} für besonders kreative Antworten.${host ? " Als Host 👑 kannst du jede Antwort endgültig entscheiden." : ""}</span>
      </div>
      ${z.kiFehler ? `<div class="hinweis-box warnung">⚠️ ${esc(z.kiFehler)}</div>` : ""}
      <div class="bewerten-layout">
        <div class="kategorie-liste">
          ${z.bewertung.map((k, i) => kategorieKarte(k, i, neu, host)).join("")}
        </div>
        <div class="seitenleiste">
          <div class="abschnitt-titel" style="margin-top:0">Punktestand</div>
          <div class="rangliste" id="rangliste"></div>
          <div class="start-leiste">
            <div class="bereit-reihe">${z.spieler.filter((s) => s.online).map((s) => `<span class="status ${s.bereit ? "fertig" : ""}" title="${esc(s.name)}"><span class="avatar">${s.avatar}</span></span>`).join("")}</div>
            <div class="leise klein-text" style="text-align:center">${bereitAnzahl}/${online} sind fertig mit Prüfen</div>
            ${host
              ? `<button class="btn gross voll" id="weiterBtn">${letzte ? "🏆 Zur Siegerehrung" : "Nächste Runde ➜"}</button>`
              : `<button class="btn ${ichBereit ? "zweit" : ""} gross voll" id="bereitBtn">${ichBereit ? "↩ Doch nicht fertig" : "✅ Fertig geprüft"}</button>`}
          </div>
        </div>
      </div>`;

    GN.rangliste($("#rangliste"), z.rundenPunkte || {}, neu);
    $("#weiterBtn")?.addEventListener("click", () => GN.aktion("weiter"));
    $("#bereitBtn")?.addEventListener("click", () => { Ton.klick(); GN.aktion("bereit"); });
    $$("[data-abstimmen]").forEach((b) => (b.onclick = () => {
      const [typ, kat, spieler, wert] = b.dataset.abstimmen.split("|");
      Ton.klick();
      GN.aktion(typ, { kat, spieler, wert: wert || null });
    }));

    if (neu) {
      Ton.ding();
      const meine = z.rundenPunkte?.[GN.ich] || 0;
      setTimeout(() => (meine >= z.kategorien.length * 10 ? Ton.volltreffer() : meine > 0 ? Ton.richtig() : Ton.falsch()), 600);
      scrollTo(0, 0);
    } else {
      scrollTo(0, scroll);
    }
  }

  function kategorieKarte(k, i, neu, host) {
    return `
      <div class="kategorie-karte ${neu ? "rein" : ""}" style="animation-delay:${i * 90}ms">
        <div class="kategorie-kopf">${k.emoji} ${esc(k.name)}</div>
        ${k.eintraege.map((e) => eintragZeile(k, e, host)).join("")}
      </div>`;
  }

  function eintragZeile(k, e, host) {
    const s = GN.spieler(e.spielerId);
    const meins = e.spielerId === GN.ich;
    const leer = e.status === "leer";
    const symbol = leer ? "–" : e.gilt ? (e.status === "unsicher" && e.durch !== "abstimmung" && e.durch !== "host" ? "?" : "✓") : "✗";
    const klasse = leer ? "leer" : e.gilt ? (symbol === "?" ? "unsicher" : "gilt") : "gilt-nicht";
    const grund = e.durch === "abstimmung" ? `Abstimmung: ${e.fuer.length} dafür, ${e.gegen.length} dagegen`
      : e.durch === "host" ? `Vom Host ${e.gilt ? "anerkannt" : "abgelehnt"}`
      : e.grund;
    const ichFuer = e.fuer.includes(GN.ich), ichGegen = e.gegen.includes(GN.ich), ichStern = e.sterne.includes(GN.ich);
    const id = `${k.id}|${e.spielerId}`;

    return `
      <div class="eintrag ${klasse} ${meins ? "ich" : ""}">
        <span class="avatar klein" title="${esc(s.name)}">${s.avatar}</span>
        <div class="eintrag-mitte">
          <div class="eintrag-text">${leer ? '<span class="leise">keine Antwort</span>' : esc(e.text)}
            ${e.sterne.length ? `<span class="sterne">${"⭐".repeat(Math.min(5, e.sterne.length))}</span>` : ""}</div>
          <div class="eintrag-grund">${esc(s.name)} · ${QUELLE[e.durch] || ""} ${esc(grund || "")}</div>
          ${!leer ? `<div class="abstimm-reihe">
            ${meins ? "" : `
              <button class="mini-btn ${ichFuer ? "an" : ""}" data-abstimmen="stimme|${id}|${ichFuer ? "" : "fuer"}" title="Zählt">👍 ${e.fuer.length || ""}</button>
              <button class="mini-btn ${ichGegen ? "an" : ""}" data-abstimmen="stimme|${id}|${ichGegen ? "" : "gegen"}" title="Zählt nicht">👎 ${e.gegen.length || ""}</button>
              <button class="mini-btn stern ${ichStern ? "an" : ""}" data-abstimmen="stern|${id}" title="Kreativ! +${meta().punkte.stern}">⭐ ${e.sterne.length || ""}</button>`}
            ${host ? `
              <button class="mini-btn host ${e.host === "ok" ? "an" : ""}" data-abstimmen="host|${id}|${e.host === "ok" ? "" : "ok"}" title="Host: zählt">👑✓</button>
              <button class="mini-btn host ${e.host === "falsch" ? "an" : ""}" data-abstimmen="host|${id}|${e.host === "falsch" ? "" : "falsch"}" title="Host: zählt nicht">👑✗</button>` : ""}
          </div>` : ""}
        </div>
        <div class="eintrag-punkte">
          <span class="symbol">${symbol}</span>
          <span class="pkt">${e.punkte + e.sternPunkte}</span>
          <span class="art">${ART[e.art] || ""}</span>
        </div>
      </div>`;
  }

  GN.spiele.slf = {
    icon: "🌍",
    titel: "Stadt Land Fluss",
    kurz: "Der Klassiker mit eigenen Kategorien und KI-Schiedsrichter.",
    lobby,
    zeige,
  };
})();
