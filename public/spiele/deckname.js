// =============================================================
//  Deckname – Browser-Teil
//  25 Wortkarten, die sich beim Aufdecken umdrehen. Chefs sehen die Farben dezent,
//  Ermittler markieren gemeinsam (Avatare auf der Karte) und decken mit zweitem Tippen auf.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let karte = null; // Farben (nur für Chefs bzw. am Ende)
  let letzteAktion = 0;
  const TEAM = { rot: { name: "Rot", icon: "🟥" }, blau: { name: "Blau", icon: "🟦" } };
  const FARBTEXT = { rot: "Team Rot", blau: "Team Blau", neutral: "Unbeteiligt", attentaeter: "Attentäter" };

  GN.socket.on("deckname:karte", ({ farben }) => {
    karte = farben;
    if (GN.zustand?.spiel === "deckname" && $(".dn-buehne")) zeichnen(GN.zustand, null);
  });

  const person = (id) => GN.spieler(id);
  function meineRolle(z) {
    for (const t of ["rot", "blau"]) { if (z.chef[t] === GN.ich) return { team: t, chef: true }; if (z.teams[t].includes(GN.ich)) return { team: t, chef: false }; }
    return null;
  }

  function abschnitte(z, host) {
    const e = z.einstellungen, dis = host ? "" : "disabled";
    const n = z.spieler.length;
    return [
      {
        id: "modus", wichtig: true, icon: "🕵️", titel: "So wird gespielt", info: n >= 4 ? "Rot gegen Blau" : "Gemeinsam",
        html: `<p>${n >= 4 ? `<b>Rot gegen Blau:</b> Ihr werdet in zwei Teams aufgeteilt, jedes Team bekommt einen Chef.` : `<b>Gemeinsam gegen das Brett</b> (bei 2–3 Spielern): Einer ist Chef, die anderen raten. Findet alle 9 Wörter mit höchstens 8 Hinweisen. Ab 4 Spielern geht es Rot gegen Blau.`}</p>
          <div class="einstellungs-zeile" style="margin-top:8px">
            <div><div class="unter-titel">Zeit für den Hinweis</div><div class="segment">${[0, 60, 120, 180].map((s) => `<button data-dn-hz="${s}" class="${e.sekundenHinweis === s ? "aktiv" : ""}" ${dis}>${s ? s / 60 + " min" : "∞"}</button>`).join("")}</div></div>
            <div><div class="unter-titel">Zeit zum Raten</div><div class="segment">${[0, 60, 120, 180].map((s) => `<button data-dn-rz="${s}" class="${e.sekundenRaten === s ? "aktiv" : ""}" ${dis}>${s ? s / 60 + " min" : "∞"}</button>`).join("")}</div></div>
          </div>`,
      },
      {
        id: "regeln", icon: "📖", titel: "Regeln", info: "Ein Wort, eine Zahl",
        html: `<ol class="q-regeln">
          <li>Auf dem Tisch liegen <b>25 Wörter</b>. Nur die <b>Chefs</b> wissen, welche Wörter zu welchem Team gehören.</li>
          <li>Der Chef gibt einen <b>Hinweis: ein Wort und eine Zahl</b>, z. B. „Wasser – 2“. Wörter vom Brett (und Zusammensetzungen) sind verboten.</li>
          <li>Das Team <b>tippt ein Wort an</b> (alle sehen die Markierung) und deckt es mit einem zweiten Tippen auf.</li>
          <li>Eigenes Wort: weiter raten (bis Zahl + 1). Fremdes oder <b>unbeteiligtes</b> Wort: Zug vorbei.</li>
          <li>💀 Wer den <b>Attentäter</b> aufdeckt, verliert sofort. Wer zuerst alle eigenen Wörter findet, gewinnt.</li></ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-dn-hz]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekundenHinweis: +b.dataset.dnHz })));
    $$("[data-dn-rz]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekundenRaten: +b.dataset.dnRz })));
  }

  function zeige(z, vorher) {
    if (z.phase === "ende" && /podest/.test(GN.ansicht)) return;
    if (!$(".dn-buehne") || !GN.ansicht.startsWith("dn-")) aufbauen(z);
    zeichnen(z, vorher);
    if (z.phase === "ende" && GN.ansicht !== "dn-ende") {
      GN.ansicht = "dn-ende";
      const r = meineRolle(z);
      const gewonnen = z.modus === "gemeinsam" ? z.sieger === "rot" : r && r.team === z.sieger;
      GN.fx?.knall(z.modus === "gemeinsam" ? (gewonnen ? "🎉 Geschafft!" : "😵 Leider verloren") : `${TEAM[z.sieger].icon} Team ${TEAM[z.sieger].name} gewinnt!`, 3, esc(z.grund || ""));
      if (gewonnen) { Ton.fanfare(); GN.konfetti(180); } else Ton.falsch();
      setTimeout(() => GN.zustand?.phase === "ende" && GN.ansicht === "dn-ende" && GN.podest("dn-podest", { einheit: "Punkte" }), 5500);
    }
  }

  function aufbauen(z) {
    GN.ansicht = "dn-spiel";
    GN.stoppeTimer();
    letzteAktion = z.letzteAktion?.nr || 0;
    app.innerHTML = `
      <div class="dn-buehne">
        <div class="runden-kopf"><span class="modus-badge">🕵️ Deckname</span><span class="runden-nr" id="dnKopf"></span><span class="timer-zahl" id="timerZahl"></span></div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="dn-stand" id="dnStand"></div>
        <div class="dn-rolle" id="dnRolle"></div>
        <div class="dn-hinweis" id="dnHinweis"></div>
        <div class="dn-gitter" id="dnGitter">${z.woerter.map((w, i) => `<button class="dn-karte" data-i="${i}" style="--i:${i}"><span class="dn-innen"><span class="dn-vorne"><span class="dn-wort">${esc(w)}</span><span class="dn-marken"></span></span><span class="dn-hinten"><span class="dn-wort">${esc(w)}</span></span></span></button>`).join("")}</div>
        <div class="dn-unten"><div class="dn-teams" id="dnTeams"></div><div class="dn-verlauf" id="dnVerlauf"></div></div>
      </div>`;
    $$(".dn-karte").forEach((b) => (b.onclick = () => { Ton.klick(); GN.aktion("tippen", +b.dataset.i); }));
  }

  function zeichnen(z, vorher) {
    const r = meineRolle(z);
    const dran = z.dran;
    const istChef = r?.chef, meinZug = r && r.team === dran;
    $("#dnKopf").innerHTML = z.phase === "ende" ? "Spiel vorbei" : z.modus === "gemeinsam" ? `Noch ${z.hinweiseUebrig} Hinweis${z.hinweiseUebrig === 1 ? "" : "e"}` : `${TEAM[dran].icon} Team ${TEAM[dran].name} ist dran`;
    $("#dnStand").innerHTML = z.modus === "gemeinsam"
      ? `<div class="dn-zaehler rot"><b>${9 - z.uebrig.rot}</b>/9 gefunden</div><div class="dn-zaehler grau"><b>${z.hinweiseUebrig}</b> Hinweise übrig</div>`
      : ["rot", "blau"].map((t) => `<div class="dn-zaehler ${t} ${dran === t && z.phase !== "ende" ? "dran" : ""}">${TEAM[t].icon} <b>${z.uebrig[t]}</b> übrig</div>`).join('<span class="dn-gegen">gegen</span>');
    $("#dnRolle").innerHTML = !r ? "👀 Du schaust zu."
      : istChef ? `🎩 Du bist <b>Chef</b>${z.modus === "teams" ? ` von Team ${TEAM[r.team].name}` : ""}. Nur du siehst die Farben – verrate nichts!`
      : `🔎 Du bist <b>Ermittler</b>${z.modus === "teams" ? ` in Team ${TEAM[r.team].name}` : ""}.`;
    $("#dnRolle").className = `dn-rolle ${r ? r.team : ""}`;

    // Hinweis-Bereich
    const box = $("#dnHinweis");
    let html = "";
    if (z.phase === "ende") html = `<div class="dn-ende-text">${esc(z.grund || "")}</div>`;
    else if (z.phase === "hinweis") {
      if (istChef && meinZug) {
        html = `<form class="dn-hinweis-form" id="dnForm" autocomplete="off">
          <input class="feld" id="dnWort" maxlength="24" placeholder="Ein Wort als Hinweis …" enterkeyhint="send" autocapitalize="sentences">
          <div class="dn-zahlen">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-zahl="${n}">${n}</button>`).join("")}</div>
          <button class="btn" id="dnGeben" disabled>💬 Hinweis geben</button></form>`;
      } else html = `<div class="dn-warten">🎩 ${esc(person(z.chef[dran]).name)} überlegt sich einen Hinweis${GN.wartePunkte()}</div>`;
    } else if (z.hinweis) {
      const kannRaten = meinZug && !istChef && z.phase === "raten";
      html = `<div class="dn-aktuell ${z.hinweis.team}"><span>Hinweis</span><b>„${esc(z.hinweis.wort)}“</b><em>${z.hinweis.zahl}</em></div>
        <div class="dn-info">${z.phase === "wechselt" ? "…" : kannRaten ? `Noch <b>${z.rest}</b> Versuch${z.rest === 1 ? "" : "e"} · Tippe ein Wort an, nochmal tippen deckt auf` : istChef && meinZug ? "Dein Team rät jetzt – keine Tipps geben 🤐" : `Team ${TEAM[dran].name} rät${GN.wartePunkte()}`}</div>
        ${kannRaten && z.rest <= z.hinweis.zahl ? '<button class="btn zweit klein" id="dnFertig">✋ Zug beenden</button>' : ""}`;
    }
    if (box.dataset.html !== html) {
      box.dataset.html = html; box.innerHTML = html;
      const form = $("#dnForm");
      if (form) {
        let zahl = 0;
        const pruefen = () => ($("#dnGeben").disabled = !($("#dnWort").value.trim() && zahl));
        $$("[data-zahl]", form).forEach((b) => (b.onclick = () => { Ton.klick(); zahl = +b.dataset.zahl; $$("[data-zahl]", form).forEach((x) => x.classList.toggle("aktiv", x === b)); pruefen(); }));
        $("#dnWort").oninput = pruefen;
        form.onsubmit = (ev) => { ev.preventDefault(); if (!zahl) return GN.toast("Wähle noch eine Zahl."); Ton.abgeben(); GN.aktion("hinweis", { wort: $("#dnWort").value.trim(), zahl }); };
        setTimeout(() => $("#dnWort")?.focus({ preventScroll: true }), 50);
      }
      $("#dnFertig")?.addEventListener("click", () => { Ton.klick(); GN.aktion("fertig"); });
    }

    // Karten
    $$(".dn-karte").forEach((b) => {
      const i = +b.dataset.i;
      const offen = z.aufgedeckt[i];
      const geheim = karte?.[i];
      b.className = `dn-karte ${offen ? `offen ${offen}` : ""} ${!offen && geheim && (istChef || z.phase === "ende") ? `chef ${geheim}` : ""} ${!offen && meinZug && !istChef && z.phase === "raten" ? "waehlbar" : ""}`;
      const m = z.markiert[i] || [];
      const marken = $(".dn-marken", b);
      const mh = m.map((id) => `<span title="${esc(person(id).name)}">${person(id).avatar}</span>`).join("");
      if (marken.innerHTML !== mh) marken.innerHTML = mh;
      b.classList.toggle("markiert", m.length > 0);
      b.classList.toggle("meine", m.includes(GN.ich));
      b.disabled = !!offen || !(meinZug && !istChef && z.phase === "raten");
    });

    // Teams und Verlauf
    $("#dnTeams").innerHTML = (z.modus === "teams" ? ["rot", "blau"] : ["rot"]).map((t) => `<div class="dn-team ${t}"><b>${z.modus === "teams" ? `${TEAM[t].icon} Team ${TEAM[t].name}` : "👥 Euer Team"}</b>
      <span class="dn-mitglied chef">${person(z.chef[t]).avatar} ${esc(person(z.chef[t]).name)} <em>🎩 Chef</em></span>
      ${z.teams[t].map((id) => `<span class="dn-mitglied">${person(id).avatar} ${esc(id === GN.ich ? "Du" : person(id).name)}</span>`).join("")}</div>`).join("");
    $("#dnVerlauf").innerHTML = z.verlauf.length ? `<b>Hinweise</b>${z.verlauf.slice().reverse().map((h) => `<span class="dn-v ${h.team}">„${esc(h.wort)}“ ${h.zahl}</span>`).join("")}` : "";

    effekte(z, r);
    if (!vorher || vorher.phase !== z.phase || vorher.hinweis?.wort !== z.hinweis?.wort || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) GN.starteTimer(z.restMs, z.restMs, { tickAb: 10000 }); else GN.ohneZeitlimit();
      if (vorher && vorher.phase !== z.phase && ((z.phase === "hinweis" && istChef && meinZug) || (z.phase === "raten" && meinZug && !istChef))) { Ton.ding(); navigator.vibrate?.(40); }
    }
  }

  // Aufdecken: Karte dreht sich, Ton und Wackeln je nach Farbe
  function effekte(z, r) {
    const a = z.letzteAktion;
    if (!a || a.nr === letzteAktion) return;
    const erstes = !letzteAktion;
    letzteAktion = a.nr;
    if (erstes) return;
    if (a.typ === "hinweis") { Ton.wusch(); GN.fx?.pop($(".dn-aktuell"), 1); }
    if (a.typ === "aufgedeckt") {
      const b = $(`.dn-karte[data-i="${a.i}"]`);
      const richtig = a.farbe === a.team;
      if (a.farbe === "attentaeter") { Ton.alarm(); GN.fx?.stopp(200).then(() => GN.fx?.wackeln(3)); }
      else if (richtig) { Ton.serie(); GN.fx?.funken(b, { anzahl: 14, farben: a.farbe === "rot" ? ["#ff5a52", "#ffd0c8"] : ["#4d8eff", "#cfe1ff"] }); }
      else { Ton.falsch(); GN.fx?.wackeln(1); }
    }
    if (a.typ === "wechsel" && z.modus === "teams") GN.fx?.knall(`${TEAM[a.team].icon} Team ${TEAM[a.team].name} ist dran`, 1);
  }

  GN.spiele.deckname = {
    icon: "🕵️",
    titel: "Deckname",
    kurz: "Ein Wort, eine Zahl – findet eure Agenten, bevor ihr den Attentäter erwischt.",
    beschreibung: "Das Team-Wortspiel: Euer Chef gibt Hinweise aus einem einzigen Wort, ihr ratet, welche der 25 Karten gemeint sind. Ab 4 Spielern Rot gegen Blau, zu zweit oder dritt gemeinsam gegen das Brett.",
    tags: ["🗣️ Wörter", "👥 Teams", "👥 2–10 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
