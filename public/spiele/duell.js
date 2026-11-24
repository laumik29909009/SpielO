// =============================================================
//  Wissensduell – Browser-Teil
//  Kategorie wählen (3 bunte Kacheln), 3 Fragen gleichzeitig beantworten,
//  Auflösung mit Avataren auf den Antworten, Rundentafel mit grünen/roten Punkten.
//  Bildfragen: Flaggen (SVG), Länderumrisse (aus /quiz/umrisse.json), Emoji-Rätsel.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const M = () => GN.meta?.spiele?.duell || {};
  let umrisse = null, umrisseLaden = null;
  let letztePhase = null, letzteFrage = null;
  const ladeUmrisse = () => (umrisseLaden ||= fetch("/quiz/umrisse.json").then((r) => r.json()).then((u) => (umrisse = u)).catch(() => (umrisseLaden = null)));

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);

  // ---------- Lobby ----------
  function abschnitte(z, host) {
    const e = z.einstellungen, dis = host ? "" : "disabled";
    const kats = M().kategorien || [];
    const thema = kats.find((k) => k.id === e.thema);
    return [
      {
        id: "modus", wichtig: true, icon: "🧠", titel: "Spielart", info: { klassisch: "Kategorie wählen", zufall: "Zufall", thema: `Thema: ${thema?.name || ""}` }[e.modus],
        html: `<div class="segment breit">${[["klassisch", "🎯 Kategorie wählen"], ["zufall", "🎲 Zufall"], ["thema", "📌 Ein Thema"]].map(([m, t]) => `<button data-du-modus="${m}" class="${e.modus === m ? "aktiv" : ""}" ${dis}>${t}</button>`).join("")}</div>
          <p class="leise klein-text" style="margin:6px 0 0">${{ klassisch: "Reihum wählt jeder aus drei Kategorien, alle beantworten dieselben drei Fragen.", zufall: "Die Kategorie wird jede Runde ausgelost.", thema: "Alle Runden aus einer Kategorie – wähle sie unten." }[e.modus]}</p>
          ${e.modus === "thema" ? `<div class="du-themen">${kats.map((k) => `<button data-du-thema="${k.id}" class="du-thema ${e.thema === k.id ? "aktiv" : ""}" style="--k:${k.farbe}" ${dis}><span>${k.icon}</span>${esc(k.name)}</button>`).join("")}</div>` : ""}`,
      },
      {
        id: "regeln", icon: "⚙️", titel: "Runden & Zeit", info: `${e.runden} Runden · ${e.sekunden}s · ${e.bots ? e.bots + " Computer" : "ohne Computer"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Runden</div><div class="segment">${[3, 4, 6].map((n) => `<button data-du-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Frage</div><div class="segment">${[10, 15, 20, 30].map((n) => `<button data-du-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n}s</button>`).join("")}</div></div>
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3].map((n) => `<button data-du-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n || "Keine"}</button>`).join("")}</div></div>
        </div><p class="leise klein-text" style="margin-top:8px">${M().anzahl || "Hunderte"} Fragen in ${kats.length} Kategorien, darunter Flaggen, Länderumrisse und Emoji-Rätsel. Allein spielst du gegen einen Computer.</p>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-du-modus]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ modus: b.dataset.duModus })));
    $$("[data-du-thema]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ thema: b.dataset.duThema })));
    $$("[data-du-runden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.duRunden })));
    $$("[data-du-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.duSek })));
    $$("[data-du-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.duBots })));
  }

  // ---------- Spiel ----------
  function zeige(z, vorher) {
    if (z.phase === "ende" && /podest/.test(GN.ansicht)) return;
    if (GN.ansicht !== "du-spiel" || !$(".du-buehne")) aufbauen(z);
    kopf(z);
    const neuePhase = z.phase !== letztePhase || (z.phase === "frage" && z.frage?.nr !== letzteFrage);
    if (neuePhase) {
      letztePhase = z.phase; letzteFrage = z.frage?.nr;
      if (z.phase === "wahl") wahlZeigen(z);
      else if (z.phase === "frage") frageZeigen(z);
      else if (z.phase === "rundenende" || z.phase === "ende") tafelZeigen(z);
      if (z.restMs > 0 && (z.phase === "frage" || z.phase === "wahl")) GN.starteTimer(z.restMs, z.phase === "frage" ? z.sekunden * 1000 : z.restMs, { tickAb: 5000 });
      else GN.stoppeTimer();
    }
    if (z.phase === "frage") warteAnzeige(z);
    if (z.phase === "aufloesung" && !$(".du-antworten.offen")) aufloesung(z, vorher);
    if (z.phase === "ende" && GN.ansicht === "du-spiel") {
      GN.ansicht = "du-ende";
      const rang = leute(z).slice().sort((a, b) => z.punkte[b.id] - z.punkte[a.id]);
      const sieger = rang[0];
      if (sieger) {
        GN.fx?.knall(`🏆 ${esc(nameVon(z, sieger.id))} ${sieger.id === GN.ich ? "gewinnst" : "gewinnt"}!`, 3, `${z.richtige[sieger.id]} richtige Antworten`);
        if (sieger.id === GN.ich) { Ton.fanfare(); GN.konfetti(200); } else Ton.ding?.();
      }
      setTimeout(() => GN.zustand?.phase === "ende" && GN.ansicht === "du-ende" && GN.podest("du-podest", { einheit: "Punkte" }), 5200);
    }
  }

  function aufbauen(z) {
    GN.ansicht = "du-spiel";
    letztePhase = null; letzteFrage = null;
    if (leute(z).length) ladeUmrisse();
    app.innerHTML = `
      <div class="du-buehne">
        <div class="du-kopf" id="duKopf"></div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div><span class="timer-zahl versteckt" id="timerZahl"></span>
        <div class="du-feld" id="duFeld"></div>
      </div>`;
  }

  // Spielerleiste: bei zwei Spielern links gegen rechts, sonst Reihe
  function kopf(z) {
    const l = leute(z);
    const duo = l.length === 2;
    const chip = (t, seite = "") => `<div class="du-spieler ${seite} ${t.id === GN.ich ? "ich" : ""}">
      <span class="du-ava">${t.avatar}</span><span class="du-name">${esc(nameVon(z, t.id))}${t.bot ? " 🤖" : ""}</span>
      <b class="du-punkte" data-id="${t.id}">${z.punkte[t.id] || 0}</b></div>`;
    const html = duo
      ? `${chip(l[0], "links")}<div class="du-runde"><small>Runde</small><b>${Math.max(1, z.runde)}/${z.runden}</b></div>${chip(l[1], "rechts")}`
      : `<div class="du-runde klein"><small>Runde</small><b>${Math.max(1, z.runde)}/${z.runden}</b></div><div class="du-reihe">${l.slice().sort((a, b) => z.punkte[b.id] - z.punkte[a.id]).map((t) => chip(t)).join("")}</div>`;
    const box = $("#duKopf");
    if (box.dataset.html !== html) {
      // Punkte hochzählen statt springen
      const alt = Object.fromEntries($$(".du-punkte", box).map((el) => [el.dataset.id, +el.textContent]));
      box.dataset.html = html; box.innerHTML = html;
      $$(".du-punkte", box).forEach((el) => { const a = alt[el.dataset.id]; if (a !== undefined && a !== +el.textContent) GN.fx?.zahl(el, a, +el.textContent, { dauer: 700 }); });
    }
  }

  // ---------- Kategorienwahl ----------
  function wahlZeigen(z) {
    const ich = z.waehler === GN.ich;
    const w = person(z, z.waehler);
    $("#duFeld").innerHTML = `
      <div class="du-wahl">
        <h2>${ich ? "Wähle eine Kategorie" : `${w.avatar} ${esc(w.name)} wählt eine Kategorie${GN.wartePunkte()}`}</h2>
        <div class="du-kacheln">${z.wahl.map((k, i) => `<button class="du-kachel" data-kat="${k.id}" style="--k:${k.farbe};--i:${i}" ${ich ? "" : "disabled"}>
          <span class="du-kachel-icon">${k.icon}</span><span class="du-kachel-name">${esc(k.name)}</span></button>`).join("")}</div>
      </div>`;
    if (ich) {
      Ton.ding?.(); navigator.vibrate?.(30);
      $$(".du-kachel").forEach((b) => (b.onclick = () => { Ton.klick(); $$(".du-kachel").forEach((x) => (x.disabled = true)); b.classList.add("gewaehlt"); GN.aktion("kategorie", b.dataset.kat); }));
    }
  }

  // ---------- Frage ----------
  function bildHtml(b) {
    if (!b) return "";
    if (b.typ === "flagge") return `<div class="du-bild ${b.klein ? "klein" : ""}"><img class="du-flagge" src="/quiz/flaggen/${b.wert}.svg" alt="Flagge"></div>`;
    if (b.typ === "emoji") return `<div class="du-bild"><div class="du-emoji">${esc(b.wert)}</div></div>`;
    if (b.typ === "umriss") {
      const p = umrisse?.[b.wert];
      return `<div class="du-bild"><svg class="du-umriss" viewBox="0 0 200 200" data-code="${b.wert}">${p ? `<path d="${p}"/>` : ""}</svg></div>`;
    }
    return "";
  }
  function frageZeigen(z) {
    const f = z.frage, k = z.kategorie;
    $("#duFeld").innerHTML = `
      <div class="du-frage" style="--k:${k.farbe}">
        <div class="du-kat"><span>${k.icon}</span><b>${esc(k.name)}</b><em>Frage ${f.nr + 1}/${z.fragenProRunde}</em></div>
        ${bildHtml(f.bild)}
        <div class="du-text">${esc(f.text)}</div>
        <div class="du-antworten" id="duAntworten">${f.antworten.map((a, i) => `<button class="du-antwort" data-i="${i}" style="--i:${i}"><span class="du-a-text">${esc(a)}</span><span class="du-a-wer"></span></button>`).join("")}</div>
        <div class="du-warten" id="duWarten"></div>
      </div>`;
    // Umriss nachladen, falls noch nicht da
    if (f.bild?.typ === "umriss" && !umrisse) ladeUmrisse().then(() => { const svg = $(".du-umriss"); if (svg && umrisse?.[svg.dataset.code]) svg.innerHTML = `<path d="${umrisse[svg.dataset.code]}"/>`; });
    const meine = z.beantwortet.includes(GN.ich);
    $$(".du-antwort").forEach((b) => {
      b.disabled = meine || !leute(z).some((t) => t.id === GN.ich);
      b.onclick = () => {
        Ton.klick(); navigator.vibrate?.(15);
        b.classList.add("gewaehlt");
        $$(".du-antwort").forEach((x) => (x.disabled = true));
        GN.aktion("antwort", +b.dataset.i);
      };
    });
  }
  function warteAnzeige(z) {
    const box = $("#duWarten");
    if (!box) return;
    const html = leute(z).map((t) => `<span class="${z.beantwortet.includes(t.id) ? "fertig" : ""}">${t.avatar} ${z.beantwortet.includes(t.id) ? "✓" : "…"}</span>`).join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  // ---------- Auflösung ----------
  function aufloesung(z) {
    const f = z.frage;
    const box = $("#duAntworten");
    if (!box || !f) return;
    box.classList.add("offen");
    GN.stoppeTimer();
    const meine = z.antworten?.[GN.ich];
    $$(".du-antwort", box).forEach((b) => {
      const i = +b.dataset.i;
      b.disabled = true;
      if (i === f.richtig) b.classList.add("richtig");
      else if (i === meine) b.classList.add("falsch");
      else b.classList.add("blass");
      const wer = Object.entries(z.antworten || {}).filter(([, x]) => x === i).map(([id]) => person(z, id).avatar).join("");
      $(".du-a-wer", b).textContent = wer;
    });
    $("#duWarten").innerHTML = `<button class="du-melden" id="duMelden">⚑ Frage melden</button>`;
    $("#duMelden").onclick = () => GN.frageMelden("duell", f);
    const imSpiel = leute(z).some((t) => t.id === GN.ich);
    if (!imSpiel) return;
    if (meine === f.richtig) { Ton.richtig(); GN.fx?.funken($(".du-antwort.richtig"), { anzahl: 14 }); }
    else { Ton.falsch(); if (meine === undefined) GN.toast("⏱️ Zeit abgelaufen"); GN.fx?.schuettel?.($(".du-frage")); }
  }

  // ---------- Rundentafel ----------
  function tafelZeigen(z) {
    GN.stoppeTimer();
    const l = leute(z);
    const runden = Array.from({ length: z.runden }, (_, r) => z.verlauf[r] || null);
    $("#duFeld").innerHTML = `
      <div class="du-tafel">
        <h2>${z.phase === "ende" ? "🏁 Endstand" : `Runde ${z.runde} geschafft`}</h2>
        <div class="du-tafel-gitter" style="--n:${z.runden}">
          <span></span>${runden.map((r, i) => `<span class="du-tafel-kat" style="--k:${r?.kat?.farbe || "#555"}" title="${esc(r?.kat?.name || "")}">${r ? r.kat.icon : i + 1}</span>`).join("")}<span></span>
          ${l.map((t) => `<span class="du-tafel-name">${t.avatar} ${esc(nameVon(z, t.id))}</span>
            ${runden.map((r) => `<span class="du-tafel-runde">${[0, 1, 2].map((q) => { const v = r?.ergebnisse?.[t.id]?.[q]; return `<i class="${v === true ? "ja" : v === false ? "nein" : ""}"></i>`; }).join("")}</span>`).join("")}
            <b class="du-tafel-summe">${z.richtige[t.id]}</b>`).join("")}
        </div>
        ${z.phase === "rundenende" ? '<p class="leise">Gleich geht’s weiter …</p>' : ""}
      </div>`;
    $$(".du-tafel-runde i.ja, .du-tafel-runde i.nein").forEach((el, i) => { el.style.animationDelay = `${i * 40}ms`; });
  }

  GN.spiele.duell = {
    icon: "🧠",
    titel: "Wissensduell",
    kurz: "Kategorie wählen, drei Fragen, wer weiß mehr? Mit Flaggen, Umrissen und Emoji-Rätseln.",
    beschreibung: "Das schnelle Quiz-Duell: Reihum wählt jeder eine von drei Kategorien, dann beantworten alle dieselben drei Fragen um die Wette. Über 20 Kategorien mit Bildfragen. Allein gegen den Computer, zu zweit im Duell oder alle gegen alle.",
    tags: ["🧠 Quiz", "🏳️ Bildfragen", "👥 1–10 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
