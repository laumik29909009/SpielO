// =============================================================
//  Würfelglück – Browser-Teil
//  3D-Würfel (CSS 3D), Würfelbecher, Halteleiste, Punkteblock, Effekte
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let letzteWurfId = 0;
  let letzteT = 0;
  const NAMEN = {
    einser: ["Einser", "Summe aller Einsen"], zweier: ["Zweier", "Summe aller Zweien"], dreier: ["Dreier", "Summe aller Dreien"],
    vierer: ["Vierer", "Summe aller Vieren"], fuenfer: ["Fünfer", "Summe aller Fünfen"], sechser: ["Sechser", "Summe aller Sechsen"],
    dreierpasch: ["Dreierpasch", "3 Gleiche: alle Augen"], viererpasch: ["Viererpasch", "4 Gleiche: alle Augen"],
    fullhouse: ["Full House", "3 + 2 Gleiche: 25"], kleinestrasse: ["Kleine Straße", "4 in Folge: 30"],
    grossestrasse: ["Große Straße", "5 in Folge: 40"], fuenfling: ["Fünfling", "5 Gleiche: 50"], chance: ["Chance", "Alle Augen"],
  };
  // Drehung, damit die gewünschte Zahl nach vorn zeigt
  const DREH = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const PUNKTE = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);

  // =============================================================
  //  Würfel (CSS 3D)
  // =============================================================
  const seite = (n) => `<span class="w-seite s${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${PUNKTE[n].includes(i + 1) ? "an" : ""}"></i>`).join("")}</span>`;
  const wuerfelHTML = (i) => `<button class="w-wuerfel" data-i="${i}" aria-label="Würfel ${i + 1}"><span class="w-kubus">${[1, 2, 3, 4, 5, 6].map(seite).join("")}</span></button>`;
  function zeigeZahl(el, n, extraX = 0, extraY = 0) {
    const [x, y] = DREH[n];
    el.style.transform = `rotateX(${x + extraX}deg) rotateY(${y + extraY}deg)`;
  }

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    return [
      {
        id: "spieler", wichtig: true, icon: "🤖", titel: "Mitspieler & Zeit", info: `${z.spieler.length} + ${e.bots} Computer · ${e.sekunden ? e.sekunden + " s pro Zug" : "ohne Zeitlimit"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3, 4].map((n) => `<button data-w-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[30, 60, 0].map((n) => `<button data-w-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
        </div><p class="leise klein-text" style="margin-top:8px">1 bis 8 Spieler. Solo spielst du auf Rekordjagd oder gegen den Computer.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "13 Felder, 3 Würfe",
        html: `<ol class="q-regeln">
          <li>Du hast pro Zug <b>bis zu 3 Würfe</b>. Tippe Würfel an, um sie <b>festzuhalten</b>.</li>
          <li>Danach trägst du dein Ergebnis in ein <b>freies Feld</b> ein. Passt nichts, streichst du ein Feld (0 Punkte).</li>
          <li><b>Oben:</b> Einser bis Sechser. Ab 63 Punkten gibt es <b>35 Bonus</b>.</li>
          <li><b>Unten:</b> Dreierpasch und Viererpasch (alle Augen), Full House 25, Kleine Straße 30, Große Straße 40, <b>Fünfling 50</b>, Chance.</li>
          <li>Jeder weitere Fünfling bringt <b>50 Extrapunkte</b>. Nach 13 Runden gewinnt die höchste Summe.</li>
        </ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-w-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.wBots })));
    $$("[data-w-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.wSek })));
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (!GN.ansicht.startsWith("wuerfel-podest")) {
        GN.ansicht = "wuerfel-ende";
        if ($(".w-buehne")) zeichneBlock(z);
        setTimeout(() => GN.zustand?.phase === "ende" && !GN.ansicht.startsWith("wuerfel-podest") && GN.podest("wuerfel-podest", { einheit: "Punkte" }), 1800);
      }
      return;
    }
    if (!$(".w-buehne") || GN.ansicht !== "wuerfel-spiel") aufbauen(z);
    aktualisieren(z, vorher);
  }

  function aufbauen(z) {
    GN.ansicht = "wuerfel-spiel";
    GN.stoppeTimer();
    letzteWurfId = z.wurfId;
    app.innerHTML = `
      <div class="w-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🎲 Würfelglück</span>
          <span class="runden-nr" id="wRunde"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="w-oben">
          <div class="w-tisch">
            <div class="w-wer" id="wWer"></div>
            <div class="w-halte" id="wHalte"><span class="w-halte-text">Festgehalten</span></div>
            <div class="w-teller" id="wTeller">
              <div class="w-becher" id="wBecher" aria-hidden="true"><span></span></div>
              <div class="w-reihe" id="wReihe">${[0, 1, 2, 3, 4].map(wuerfelHTML).join("")}</div>
              <div class="fr-effekt" id="wEffekt" aria-live="polite"></div>
            </div>
            <div class="w-knoepfe" id="wKnoepfe"></div>
          </div>
        </div>
        <div class="w-block-huelle"><table class="w-block" id="wBlock"></table></div>
      </div>`;
    $$(".w-wuerfel").forEach((b) => (b.onclick = () => halten(+b.dataset.i)));
    // Startstellung der Würfel
    $$(".w-kubus").forEach((k, i) => zeigeZahl(k, z.wuerfel[i]));
  }

  function aktualisieren(z, vorher) {
    $("#wRunde").textContent = `Runde ${Math.min(13, z.runde)} / 13`;
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    $("#wWer").innerHTML = ichDran ? `<b>Du bist dran!</b> ${z.wurf ? `Wurf ${z.wurf} von 3` : "Schüttel den Becher"}` : `${person(z, z.dran).avatar} <b>${esc(person(z, z.dran).name)}</b> würfelt${z.wurf ? ` · Wurf ${z.wurf}/3` : GN.wartePunkte()}`;
    // Würfel: neu gewürfelt? Dann Animation, sonst nur Halten aktualisieren
    if (z.wurfId !== letzteWurfId) { wurfAnimation(z, z.wurfId > letzteWurfId && letzteWurfId !== undefined); letzteWurfId = z.wurfId; }
    else if (!vorher || vorher.zug !== z.zug) zuruecksetzen(z);
    $$(".w-wuerfel").forEach((b, i) => {
      b.classList.toggle("gehalten", !!(z.wurf && z.gehalten[i]));
      b.classList.toggle("leer", !z.wurf);
      b.disabled = !(ichDran && z.wurf > 0 && z.wurf < 3);
    });
    ordneWuerfel(z);
    knoepfe(z);
    zeichneBlock(z);
    effekte(z);
    if (!vorher || vorher.zug !== z.zug || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.restMs, { tickAb: 8000, tonAus: () => GN.zustand?.dran !== GN.ich }); }
      else GN.ohneZeitlimit();
      if (vorher && ichDran && vorher.dran !== GN.ich) { Ton.ding(); navigator.vibrate?.(40); }
    }
  }

  // Festgehaltene Würfel wandern auf die Halteleiste
  function ordneWuerfel(z) {
    const reihe = $("#wReihe"), halte = $("#wHalte");
    $$(".w-wuerfel").forEach((b, i) => {
      const ziel = z.wurf && z.gehalten[i] ? halte : reihe;
      if (b.parentElement !== ziel) {
        const vorher = b.getBoundingClientRect();
        ziel.appendChild(b);
        const nachher = b.getBoundingClientRect();
        b.animate([{ transform: `translate(${vorher.left - nachher.left}px, ${vorher.top - nachher.top}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,1.2,.4,1)" });
      }
    });
    // Reihenfolge nach Index beibehalten
    for (const box of [reihe, halte]) [...box.querySelectorAll(".w-wuerfel")].sort((a, b) => a.dataset.i - b.dataset.i).forEach((b) => box.appendChild(b));
  }

  function zuruecksetzen(z) {
    $$(".w-kubus").forEach((k, i) => { k.style.transition = "none"; zeigeZahl(k, z.wuerfel[i]); });
  }

  // Wurf: Becher schütteln, Würfel fliegen heraus, überschlagen sich und landen auf ihrer Zahl
  function wurfAnimation(z) {
    const becher = $("#wBecher");
    const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    becher?.classList.remove("schuetteln"); void becher?.offsetWidth; becher?.classList.add("schuetteln");
    Ton.trommel(0.45);
    setTimeout(() => {
      $$(".w-wuerfel").forEach((b) => {
        const i = +b.dataset.i;
        if (z.gehalten[i] && z.wurf > 1) return;
        const k = $(".w-kubus", b);
        const [x, y] = DREH[z.wuerfel[i]];
        const spinX = 360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
        const spinY = 360 * (1 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
        const dauer = ruhig ? 1 : 900 + Math.random() * 450;
        k.style.transition = "none";
        k.animate([
          { transform: `rotateX(${x + spinX}deg) rotateY(${y + spinY}deg) rotateZ(${Math.random() * 90}deg)` },
          { transform: `rotateX(${x}deg) rotateY(${y}deg) rotateZ(0deg)` },
        ], { duration: dauer, easing: "cubic-bezier(.15,.75,.3,1)" });
        zeigeZahl(k, z.wuerfel[i]);
        // Flugbahn: aus dem Becher, hoch, aufprallen, ausrollen
        const r = b.getBoundingClientRect(), br = becher?.getBoundingClientRect();
        const dx = br ? br.left + br.width / 2 - (r.left + r.width / 2) : -120;
        const dy = br ? br.top + br.height / 2 - (r.top + r.height / 2) : 0;
        if (!ruhig) b.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 },
          { transform: `translate(${dx * 0.45}px, -70px) scale(1.15)`, opacity: 1, offset: 0.35 },
          { transform: "translate(0, 0) scale(1)", offset: 0.62 },
          { transform: "translate(0, -14px) scale(1.03)", offset: 0.76 },
          { transform: "translate(0, 0) scale(1)", offset: 0.88 },
          { transform: "translate(0, -3px)", offset: 0.94 },
          { transform: "none" },
        ], { duration: dauer, easing: "ease-out" });
        setTimeout(() => Ton.klick(), dauer * 0.62);
      });
    }, ruhig ? 0 : 380);
  }

  function halten(i) {
    const z = GN.zustand;
    if (z.dran !== GN.ich || !z.wurf || z.wurf >= 3) return;
    Ton.klick();
    GN.aktion("halten", i);
  }

  function knoepfe(z) {
    const box = $("#wKnoepfe");
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    if (!ichDran) { box.innerHTML = ""; return; }
    box.innerHTML = z.wurf < 3
      ? `<button class="btn gross w-wurf" id="wWuerfeln">🎲 ${z.wurf ? `Nochmal würfeln (${3 - z.wurf} übrig)` : "Würfeln!"}</button>${z.wurf ? '<span class="leise klein-text">Tippe Würfel zum Festhalten an oder trage unten ein.</span>' : ""}`
      : '<span class="w-hinweis">Wähle unten ein Feld zum Eintragen.</span>';
    $("#wWuerfeln")?.addEventListener("click", () => { $("#wWuerfeln").disabled = true; GN.aktion("wuerfeln"); });
  }

  // Punkteblock: Zeilen = Felder, Spalten = Spieler
  function zeichneBlock(z) {
    const t = $("#wBlock");
    if (!t) return;
    const ichDran = z.dran === GN.ich && z.phase === "spielen" && z.wurf > 0;
    const alle = leute(z);
    const kopf = `<thead><tr><th class="w-feldname">Feld</th>${alle.map((p) => `<th class="${p.id === z.dran ? "dran" : ""} ${p.id === GN.ich ? "ich" : ""}"><span class="w-ava">${p.avatar}</span><small>${esc(p.id === GN.ich ? "Du" : p.name)}</small></th>`).join("")}</tr></thead>`;
    const zeile = (f) => `<tr data-feld="${f}"><td class="w-feldname"><b>${NAMEN[f][0]}</b><small>${NAMEN[f][1]}</small></td>${alle.map((p) => {
      const v = z.blaetter[p.id]?.[f];
      if (v !== null && v !== undefined) return `<td class="voll ${v === 0 ? "null" : ""} ${z.letzteAktion?.typ === "eintragen" && z.letzteAktion.spieler === p.id && z.letzteAktion.feld === f ? "neu" : ""}">${v === 0 ? "–" : v}</td>`;
      if (p.id === GN.ich && ichDran) { const vs = z.vorschau[f]; return `<td><button class="w-eintragen ${vs ? "" : "streichen"}" data-eintragen="${f}" title="${vs ? `${vs} Punkte eintragen` : "Feld streichen (0)"}">${vs || "✕"}</button></td>`; }
      return `<td class="frei">${p.id === z.dran && z.vorschau && z.vorschau[f] ? `<span class="w-geist">${z.vorschau[f]}</span>` : ""}</td>`;
    }).join("")}</tr>`;
    const summe = (label, key, klasse = "") => `<tr class="w-summe ${klasse}"><td class="w-feldname"><b>${label}</b></td>${alle.map((p) => `<td>${key === "bonus" ? (z.summen[p.id]?.bonus ? "+35" : `<small>${z.summen[p.id]?.oben || 0}/63</small>`) : z.summen[p.id]?.[key] ?? 0}</td>`).join("")}</tr>`;
    const meta = GN.meta.spiele.wuerfel;
    t.innerHTML = `${kopf}<tbody>${meta.oben.map(zeile).join("")}${summe("Summe oben", "oben")}${summe("Bonus (ab 63)", "bonus", "bonus")}
      ${meta.unten.map(zeile).join("")}${alle.some((p) => z.extra?.[p.id]) ? summe("Fünfling-Extra", "extra") : ""}${summe("Gesamt", "gesamt", "gesamt")}</tbody>`;
    $$("[data-eintragen]", t).forEach((b) => (b.onclick = () => {
      const f = b.dataset.eintragen;
      if (!GN.zustand.vorschau[f] && !confirm(`${NAMEN[f][0]} streichen (0 Punkte)?`)) return;
      Ton.abgeben();
      GN.aktion("eintragen", f);
    }));
  }

  // Effekte für besondere Würfe und Einträge
  function effekte(z) {
    const a = z.letzteAktion;
    if (!a || a.t === letzteT) return;
    const erstes = !letzteT;
    letzteT = a.t;
    if (erstes) return;
    const box = $("#wEffekt");
    const zeige = (html, klasse = "gold", dauer = 1700) => {
      if (!box) return;
      const el = document.createElement("div");
      el.className = "fr-knall " + klasse; el.innerHTML = html; box.appendChild(el);
      setTimeout(() => el.remove(), dauer);
    };
    if (a.typ === "wurf" && a.fuenfling) setTimeout(() => { zeige(`<b class="riesig">🎲 FÜNFLING!</b><span>${esc(nameVon(z, a.spieler))}</span>`, "gold", 2200); Ton.fanfare(); GN.konfetti(200); }, 1300);
    if (a.typ === "eintragen") {
      const wer = esc(nameVon(z, a.spieler));
      const gross = { fullhouse: "🏠 Full House!", grossestrasse: "🛣️ Große Straße!", kleinestrasse: "🛤️ Kleine Straße!", fuenfling: "🎲 Fünfling!" }[a.feld];
      if (gross && a.punkte) { zeige(`<b class="riesig">${gross}</b><span>${wer} +${a.punkte}</span>`); Ton.volltreffer(); if (a.feld === "fuenfling") GN.konfetti(160); }
      else if (!a.punkte) { zeige(`<b>✕ ${NAMEN[a.feld][0]} gestrichen</b><span>${wer}</span>`, "plus2", 1200); Ton.falsch(); }
      else Ton.richtig();
      if (a.bonus) setTimeout(() => { zeige(`<b class="riesig">⭐ +35 Bonus!</b><span>${wer} hat oben 63 geschafft</span>`); Ton.fanfare(); }, 900);
      if (a.bonusFuenfling) setTimeout(() => zeige(`<b class="riesig">+50 Extra!</b><span>Noch ein Fünfling</span>`), 600);
    }
  }

  GN.spiele.wuerfel = {
    icon: "🎲",
    titel: "Würfelglück",
    kurz: "Der Würfelklassiker mit 5 Würfeln und Punkteblock.",
    beschreibung: "Fünf Würfel, drei Würfe, 13 Felder: Full House, Straßen und der Fünfling. Mit 3D-Würfeln, Becher und Punkteblock.",
    tags: ["🎲 3D-Würfel", "📝 Punkteblock", "🤖 Auch gegen Computer", "👥 1–8 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
