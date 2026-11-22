// =============================================================
//  Kiffel – Browser-Teil
//  3D-Würfel (CSS 3D), Becher mit Einsammeln/Schütteln/Ausschütten,
//  Halteleiste, Punkteblock und die Würfel-Eule als Live-Helfer
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let letzteWurfId = 0;
  let letzteT = 0;
  let animiertBis = 0;
  let nachAnimation = null;
  const NAMEN = {
    einser: ["Einser", "Summe aller Einsen"], zweier: ["Zweier", "Summe aller Zweien"], dreier: ["Dreier", "Summe aller Dreien"],
    vierer: ["Vierer", "Summe aller Vieren"], fuenfer: ["Fünfer", "Summe aller Fünfen"], sechser: ["Sechser", "Summe aller Sechsen"],
    dreierpasch: ["Dreierpasch", "3 Gleiche: alle Augen"], viererpasch: ["Viererpasch", "4 Gleiche: alle Augen"],
    fullhouse: ["Full House", "3 + 2 Gleiche: 25"], kleinestrasse: ["Kleine Straße", "4 in Folge: 30"],
    grossestrasse: ["Große Straße", "5 in Folge: 40"], fuenfling: ["Fünfling", "5 Gleiche: 50"], chance: ["Chance", "Alle Augen"],
  };
  const OBEN = ["einser", "zweier", "dreier", "vierer", "fuenfer", "sechser"];
  // Drehung, damit die gewünschte Zahl nach vorn zeigt
  const DREH = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const PUNKTE = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // =============================================================
  //  Punkte (wie auf dem Server) – für die Würfel-Eule
  // =============================================================
  function punkte(feld, w) {
    const anz = [0, 0, 0, 0, 0, 0, 0];
    for (const x of w) anz[x]++;
    const summe = w.reduce((a, b) => a + b, 0);
    const max = Math.max(...anz);
    const hat = (...z) => z.every((x) => anz[x] > 0);
    const i = OBEN.indexOf(feld);
    if (i >= 0) return anz[i + 1] * (i + 1);
    switch (feld) {
      case "dreierpasch": return max >= 3 ? summe : 0;
      case "viererpasch": return max >= 4 ? summe : 0;
      case "fullhouse": return (anz.includes(3) && anz.includes(2)) || max === 5 ? 25 : 0;
      case "kleinestrasse": return hat(1, 2, 3, 4) || hat(2, 3, 4, 5) || hat(3, 4, 5, 6) ? 30 : 0;
      case "grossestrasse": return hat(1, 2, 3, 4, 5) || hat(2, 3, 4, 5, 6) ? 40 : 0;
      case "fuenfling": return max === 5 ? 50 : 0;
      case "chance": return summe;
    }
    return 0;
  }
  const zaehle = (w) => { const a = [0, 0, 0, 0, 0, 0, 0]; for (const x of w) a[x]++; return a; };
  const haeufigste = (w) => { const a = zaehle(w); let b = 6; for (let z = 6; z >= 1; z--) if (a[z] > a[b]) b = z; return b; };

  // Welche Würfel halten, um ein Ziel zu erreichen? (gibt Indizes zurück)
  function halteFuer(ziel, w) {
    const a = zaehle(w);
    if (["fuenfling", "viererpasch", "dreierpasch"].includes(ziel)) { const z = haeufigste(w); return w.map((x, i) => (x === z ? i : -1)).filter((i) => i >= 0); }
    if (OBEN.includes(ziel)) { const z = OBEN.indexOf(ziel) + 1; return w.map((x, i) => (x === z ? i : -1)).filter((i) => i >= 0); }
    if (ziel === "fullhouse") {
      const sort = [1, 2, 3, 4, 5, 6].filter((z) => a[z]).sort((x, y) => a[y] - a[x] || y - x);
      const erlaubt = { [sort[0]]: 3, [sort[1]]: 2 };
      const n = {};
      return w.map((x, i) => (erlaubt[x] && (n[x] = (n[x] || 0) + 1) <= erlaubt[x] ? i : -1)).filter((i) => i >= 0);
    }
    if (ziel === "grossestrasse" || ziel === "kleinestrasse") {
      const reihen = ziel === "grossestrasse" ? [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]] : [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
      const beste = reihen.reduce((b, r) => (r.filter((z) => a[z]).length > b.filter((z) => a[z]).length ? r : b));
      const gesehen = new Set();
      return w.map((x, i) => (beste.includes(x) && !gesehen.has(x) && gesehen.add(x) ? i : -1)).filter((i) => i >= 0);
    }
    return [];
  }
  // Wahrscheinlichkeit, das Ziel mit den restlichen Würfen zu schaffen (Simulation)
  function chance(ziel, w, rest, laeufe = 1200) {
    let ok = 0;
    for (let n = 0; n < laeufe; n++) {
      let x = [...w];
      for (let r = 0; r < rest; r++) {
        if (punkte(ziel, x) > 0 && !OBEN.includes(ziel)) break;
        const halt = new Set(halteFuer(ziel, x));
        x = x.map((v, i) => (halt.has(i) ? v : 1 + Math.floor(Math.random() * 6)));
      }
      if (punkte(ziel, x) > 0) ok++;
    }
    return ok / laeufe;
  }

  // =============================================================
  //  Würfel (CSS 3D)
  // =============================================================
  const seite = (n) => `<span class="w-seite s${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${PUNKTE[n].includes(i + 1) ? "an" : ""}"></i>`).join("")}</span>`;
  const kern = '<span class="w-kern k1"></span><span class="w-kern k2"></span><span class="w-kern k3"></span>';
  const wuerfelHTML = (i) => `<button class="w-wuerfel" data-i="${i}" aria-label="Würfel ${i + 1}"><span class="w-kubus">${kern}${[1, 2, 3, 4, 5, 6].map(seite).join("")}</span></button>`;
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
        </div><p class="leise klein-text" style="margin-top:8px">1 bis 8 Spieler. Solo spielst du auf Rekordjagd oder gegen den Computer. Die Würfel-Eule 🦉 hilft dir mit Tipps.</p>`,
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
        setTimeout(() => GN.zustand?.phase === "ende" && !GN.ansicht.startsWith("wuerfel-podest") && GN.podest("wuerfel-podest", { einheit: "Punkte" }), 2600);
      }
      return;
    }
    if (!$(".w-buehne") || GN.ansicht !== "wuerfel-spiel") aufbauen(z);
    aktualisieren(z, vorher);
  }

  function aufbauen(z) {
    GN.euleNeu = () => GN.zustand?.spiel === "wuerfel" && eule(GN.zustand);
    GN.ansicht = "wuerfel-spiel";
    GN.stoppeTimer();
    letzteWurfId = z.wurfId;
    app.innerHTML = `
      <div class="w-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">🎲 Würfelglück</span>
          ${GN.euleKnopf()}
          <span class="runden-nr" id="wRunde"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="w-oben">
          <div class="w-tisch">
            <div class="w-wer" id="wWer"></div>
            <div class="w-halte" id="wHalte"><span class="w-halte-text">Festgehalten</span>${[0, 1, 2, 3, 4].map((i) => `<span class="w-platz" data-p="${i}"></span>`).join("")}</div>
            <div class="w-teller" id="wTeller">
              <div class="w-becher" id="wBecher" aria-hidden="true"><span class="w-becher-koerper"></span><span class="w-becher-rand"></span></div>
              <div class="w-reihe" id="wReihe">${[0, 1, 2, 3, 4].map((i) => `<span class="w-platz" data-p="${i}">${wuerfelHTML(i)}</span>`).join("")}</div>
              <div class="fr-effekt" id="wEffekt" aria-live="polite"></div>
            </div>
            <div class="w-knoepfe" id="wKnoepfe"></div>
          </div>
          <aside class="w-eule" id="wEule" aria-live="polite"></aside>
        </div>
        <div class="w-block-huelle"><table class="w-block" id="wBlock"></table></div>
      </div>`;
    $$(".w-wuerfel").forEach((b) => (b.onclick = () => halten(+b.dataset.i)));
    $$(".w-wuerfel").forEach((b) => zeigeZahl($(".w-kubus", b), z.wuerfel[+b.dataset.i]));
  }
  // Wichtig: Würfel immer über ihre feste Nummer (data-i) ansprechen, nie über die
  // Reihenfolge auf der Seite – die ändert sich, sobald ein Würfel nach oben wandert.

  function aktualisieren(z, vorher) {
    $("#wRunde").textContent = `Runde ${Math.min(13, z.runde)} / 13`;
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    $("#wWer").innerHTML = ichDran ? `<b>Du bist dran!</b> ${z.wurf ? `Wurf ${z.wurf} von 3` : "Schüttel den Becher"}` : `${person(z, z.dran).avatar} <b>${esc(person(z, z.dran).name)}</b> würfelt${z.wurf ? ` · Wurf ${z.wurf}/3` : GN.wartePunkte()}`;
    if (z.wurfId !== letzteWurfId) { letzteWurfId = z.wurfId; wurfAnimation(z); }
    else if (!vorher || vorher.zug !== z.zug) zuruecksetzen(z);
    const laeuft = Date.now() < animiertBis;
    if (!laeuft) wuerfelZustand(z);
    const rest = () => { wuerfelZustand(z); ordneWuerfel(z); knoepfe(z); zeichneBlock(z); eule(z); effekte(z); };
    clearTimeout(nachAnimation);
    if (laeuft) { knoepfe(z, true); nachAnimation = setTimeout(() => GN.zustand === z && rest(), animiertBis - Date.now()); }
    else rest();
    if (!vorher || vorher.zug !== z.zug || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.restMs, { tickAb: 8000, tonAus: () => GN.zustand?.dran !== GN.ich }); }
      else GN.ohneZeitlimit();
      if (vorher && ichDran && vorher.dran !== GN.ich) { Ton.ding(); navigator.vibrate?.(40); }
    }
  }

  function wuerfelZustand(z) {
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    $$(".w-wuerfel").forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle("gehalten", !!(z.wurf && z.gehalten[i]));
      b.classList.toggle("leer", !z.wurf);
      b.disabled = !(ichDran && z.wurf > 0 && z.wurf < 3);
    });
  }

  // Festgehaltene Würfel wandern auf die Halteleiste. Jeder Würfel hat oben und unten
  // seinen festen Platz – die anderen Würfel rutschen dabei nicht nach.
  function ordneWuerfel(z) {
    const reihe = $("#wReihe"), halte = $("#wHalte");
    $$(".w-wuerfel").forEach((b) => {
      const i = +b.dataset.i;
      const ziel =(z.wurf && z.gehalten[i] ? halte : reihe).querySelector(`.w-platz[data-p="${i}"]`);
      if (!ziel || b.parentElement === ziel) return;
      const vorher = b.getBoundingClientRect();
      ziel.appendChild(b);
      const nachher = b.getBoundingClientRect();
      b.animate([{ transform: `translate(${vorher.left - nachher.left}px, ${vorher.top - nachher.top}px)` }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(.2,1,.4,1)" });
    });
  }

  function zuruecksetzen(z) {
    $$(".w-wuerfel").forEach((b) => { const k = $(".w-kubus", b); k.getAnimations().forEach((a) => a.cancel()); zeigeZahl(k, z.wuerfel[+b.dataset.i]); });
  }

  // Wurf in drei Teilen: Würfel springen in den Becher → Becher wird geschüttelt → Würfel rollen über den Filz
  function wurfAnimation(z) {
    const becher = $("#wBecher");
    const teller = $("#wTeller");
    const freie = $$(".w-wuerfel").filter((b) => !(z.gehalten[+b.dataset.i] && z.wurf > 1));
    $$(".w-wuerfel").forEach((b) => b.classList.remove("leer"));
    if (ruhig() || !becher) { freie.forEach((b) => zeigeZahl($(".w-kubus", b), z.wuerfel[+b.dataset.i])); animiertBis = 0; return; }
    const EIN = 420, SCHUETTELN = 900, ROLLEN = 1100;
    animiertBis = Date.now() + EIN + SCHUETTELN + ROLLEN + 150;
    const mitte = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    // 1) Einsammeln (nur Würfel, die auf dem Tisch liegen)
    const [bx, by] = mitte(becher);
    const ein = freie.map((b, n) => {
      const [x, y] = mitte(b);
      return b.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${(bx - x) * 0.6}px, ${by - y - 50}px) scale(.8)`, opacity: 1, offset: 0.55 }, { transform: `translate(${bx - x}px, ${by - y - 10}px) scale(.35)`, opacity: 0 }],
        { duration: EIN, delay: n * 40, easing: "cubic-bezier(.5,0,.7,.4)", fill: "forwards" });
    });
    if (z.wurf > 1 || freie.some((b) => !b.classList.contains("leer"))) setTimeout(() => Ton.klick(), EIN * 0.8);
    // 2) Schütteln
    setTimeout(() => {
      becher.classList.remove("schuetteln", "kippen"); void becher.offsetWidth; becher.classList.add("schuetteln");
      Ton.trommel(SCHUETTELN / 1000);
      navigator.vibrate?.([30, 40, 30, 40, 30]);
    }, EIN);
    // 3) Ausschütten und Rollen
    setTimeout(() => {
      becher.classList.remove("schuetteln"); becher.classList.add("kippen");
      const [bx2, by2] = mitte(becher);
      freie.forEach((b, n) => {
        const i = +b.dataset.i;
        const k = $(".w-kubus", b);
        ein[n].cancel();
        const [x, y] = mitte(b);
        const dx = bx2 + 30 - x, dy = by2 - 10 - y;
        const sx = 360 * (2 + n % 2) * (n % 2 ? -1 : 1), sy = 360 * (2 + (n + 1) % 2);
        const [rx, ry] = DREH[z.wuerfel[i]];
        const dauer = ROLLEN - n * 60;
        k.getAnimations().forEach((a) => a.cancel());
        zeigeZahl(k, z.wuerfel[i]);
        k.animate([
          { transform: `rotateX(${rx + sx}deg) rotateY(${ry + sy}deg) rotateZ(${120 + n * 40}deg)` },
          { transform: `rotateX(${rx + sx * 0.35}deg) rotateY(${ry + sy * 0.3}deg) rotateZ(${40}deg)`, offset: 0.55 },
          { transform: `rotateX(${rx + 25}deg) rotateY(${ry - 15}deg) rotateZ(-6deg)`, offset: 0.82 },
          { transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(0deg)` },
        ], { duration: dauer, delay: n * 70, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
        b.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0 },
          { transform: `translate(${dx * 0.75}px, ${dy * 0.6 - 28}px) scale(1.05)`, opacity: 1, offset: 0.18 },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.25}px) scale(1)`, offset: 0.42 },
          { transform: `translate(${dx * 0.18}px, ${dy * 0.1 - 14}px)`, offset: 0.58 },
          { transform: `translate(${dx * 0.05}px, 0)`, offset: 0.74 },
          { transform: "translate(0, -4px)", offset: 0.86 },
          { transform: "none" },
        ], { duration: dauer, delay: n * 70, easing: "cubic-bezier(.3,.6,.4,1)", fill: "backwards" });
        setTimeout(() => Ton.klick(), n * 70 + dauer * 0.42);
        setTimeout(() => Ton.klick(), n * 70 + dauer * 0.74);
      });
      setTimeout(() => becher.classList.remove("kippen"), ROLLEN);
    }, EIN + SCHUETTELN);
  }

  function halten(i) {
    const z = GN.zustand;
    if (z.dran !== GN.ich || !z.wurf || z.wurf >= 3 || Date.now() < animiertBis) return;
    Ton.klick();
    GN.aktion("halten", i);
  }

  function knoepfe(z, warten = false) {
    const box = $("#wKnoepfe");
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    if (!ichDran) { box.innerHTML = ""; return; }
    if (warten) { box.innerHTML = '<span class="w-hinweis leise">🎲 Die Würfel rollen …</span>'; return; }
    box.innerHTML = z.wurf < 3
      ? `<button class="btn gross w-wurf" id="wWuerfeln">🎲 ${z.wurf ? `Nochmal würfeln (${3 - z.wurf} übrig)` : "Würfeln!"}</button>${z.wurf ? '<span class="leise klein-text">Tippe Würfel zum Festhalten an oder trage unten ein.</span>' : ""}`
      : '<span class="w-hinweis">Wähle unten ein Feld zum Eintragen.</span>';
    $("#wWuerfeln")?.addEventListener("click", () => { $("#wWuerfeln").disabled = true; GN.aktion("wuerfeln"); });
  }

  // =============================================================
  //  Würfel-Eule: Live-Helfer mit Punkten, Chancen und Tipp
  // =============================================================
  function eule(z) {
    const box = $("#wEule");
    if (!box) return;
    $$(".w-wuerfel.tipp").forEach((b) => b.classList.remove("tipp"));
    const an = GN.euleAn();
    box.classList.toggle("versteckt", !an);
    $(".w-oben")?.classList.toggle("ohne-eule", !an);
    if (!an) return;
    const blatt = z.blaetter[GN.ich];
    if (!blatt) { box.innerHTML = ""; return; }
    const frei = Object.keys(NAMEN).filter((f) => blatt[f] === null);
    const oben = OBEN.reduce((a, f) => a + (blatt[f] || 0), 0);
    const obenFrei = OBEN.filter((f) => blatt[f] === null);
    const soll = obenFrei.reduce((a, f) => a + (OBEN.indexOf(f) + 1) * 3, 0);
    const bonusText = oben >= 63 ? "⭐ Bonus geschafft!" : `Bonus: ${oben}/63 ${oben + soll >= 63 ? `· im Plan` : `· es fehlen ${63 - oben - soll} über dem Plan`}`;
    const kopf = `<div class="w-eule-kopf"><span class="w-eule-ava">🦉</span><div><b>Würfel-Eule</b><small>${bonusText}</small></div></div>`;
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    if (!ichDran) { box.innerHTML = `${kopf}<p class="w-eule-text">Ich schaue mit zu. Wenn du dran bist, zeige ich dir, was die Würfel wert sind und worauf du gehen solltest.</p>`; return; }
    if (!z.wurf) { box.innerHTML = `${kopf}<p class="w-eule-text">Schüttel den Becher! Noch ${frei.length} ${frei.length === 1 ? "Feld" : "Felder"} frei.</p>`; return; }
    const w = z.wuerfel;
    const rest = 3 - z.wurf;
    // Jetzt eintragbar
    const jetzt = frei.map((f) => [f, punkte(f, w)]).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    // Chancen auf die großen Ziele
    const ziele = ["fuenfling", "grossestrasse", "kleinestrasse", "fullhouse", "viererpasch"].filter((f) => frei.includes(f));
    const WERT = { fuenfling: 50, grossestrasse: 40, kleinestrasse: 30, fullhouse: 25, viererpasch: 18 };
    const chancen = rest ? ziele.map((f) => ({ f, p: punkte(f, w) ? 1 : chance(f, w, rest) })) : [];
    // Tipp
    let tipp, halte = [];
    const gross = ["fuenfling", "grossestrasse", "fullhouse"].find((f) => frei.includes(f) && punkte(f, w) > 0);
    if (gross) tipp = `Sofort eintragen: <b>${NAMEN[gross][0]}</b> für ${punkte(gross, w)} Punkte!`;
    else if (!rest) {
      const best = besteFeld(blatt, w);
      tipp = `Keine Würfe mehr. Am besten: <b>${NAMEN[best][0]}</b> (${punkte(best, w) || "streichen, 0"}).`;
    } else if (frei.includes("kleinestrasse") && punkte("kleinestrasse", w) && frei.includes("grossestrasse")) {
      // Kleine Straße steht: die vier halten (bleibt sicher) und auf die Große gehen
      halte = halteFuer("kleinestrasse", w).slice(0, 4);
      const p = chancen.find((c) => c.f === "grossestrasse")?.p || 0;
      tipp = `Die <b>Kleine Straße</b> (30) hast du sicher. Halte ${halte.map((i) => w[i]).sort((a, b) => a - b).join(", ")} und versuch die <b>Große Straße</b> (${Math.round(p * 100)} %).`;
    } else if (frei.includes("viererpasch") && punkte("viererpasch", w) && frei.includes("fuenfling")) {
      halte = halteFuer("fuenfling", w);
      tipp = `Der <b>Viererpasch</b> steht. Halte die vier ${w[halte[0]]}er und versuch den <b>Fünfling</b> (${Math.round((chancen.find((c) => c.f === "fuenfling")?.p || 0) * 100)} %).`;
    } else {
      const kandidaten = chancen.filter((c) => c.p < 1).map((c) => ({ ...c, ev: c.p * WERT[c.f] }));
      // Oben: die häufigste Zahl sammeln
      const h = haeufigste(w), feldOben = OBEN[h - 1];
      if (blatt[feldOben] === null) kandidaten.push({ f: feldOben, p: null, ev: zaehle(w)[h] * h * 0.9 + rest * h * 0.5 + (h >= 4 ? 4 : 0) });
      kandidaten.sort((a, b) => b.ev - a.ev);
      const ziel = kandidaten[0];
      if (ziel) {
        halte = halteFuer(ziel.f, w);
        const werte = halte.map((i) => w[i]).sort((a, b) => a - b);
        tipp = `Geh auf <b>${NAMEN[ziel.f][0]}</b>${ziel.p !== null ? ` (${Math.round(ziel.p * 100)} %)` : ""}. ${werte.length ? `Halte ${werte.join(", ")} und würfle den Rest.` : "Würfle alle neu."}`;
      } else tipp = "Würfle nochmal und schau, was kommt.";
    }
    box.innerHTML = `${kopf}
      <div class="w-eule-tipp">💡 ${tipp}</div>
      ${jetzt.length ? `<div class="w-eule-titel">Jetzt eintragbar</div><div class="w-eule-liste">${jetzt.map(([f, p]) => `<div><span>${NAMEN[f][0]}</span><b>${p}</b></div>`).join("")}</div>` : ""}
      ${chancen.length ? `<div class="w-eule-titel">Chancen mit ${rest} ${rest === 1 ? "Wurf" : "Würfen"}</div><div class="w-eule-chancen">${chancen.map((c) => `<div><span>${NAMEN[c.f][0]}</span><i><b style="width:${Math.round(c.p * 100)}%"></b></i><em>${c.p === 1 ? "✓" : Math.round(c.p * 100) + " %"}</em></div>`).join("")}</div>` : ""}`;
    halte.forEach((i) => $(`.w-wuerfel[data-i="${i}"]`)?.classList.add("tipp"));
  }
  // Bestes freies Feld (wie die Computer-Gegner)
  function besteFeld(blatt, w) {
    const frei = Object.keys(NAMEN).filter((f) => blatt[f] === null);
    const wert = (f) => {
      let p = punkte(f, w);
      const i = OBEN.indexOf(f);
      if (i >= 0) p += p >= (i + 1) * 3 ? 12 : -4;
      if (f === "chance") p -= 12;
      if (f === "fuenfling" && !punkte(f, w)) p -= 8;
      if (!punkte(f, w)) p -= ({ einser: 0, zweier: 2, fuenfling: 4, dreierpasch: 6, viererpasch: 3, grossestrasse: 6, kleinestrasse: 8, fullhouse: 7, chance: 20 })[f] ?? 10;
      return p;
    };
    return frei.sort((a, b) => wert(b) - wert(a))[0];
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
      // Streichen (0 Punkte): erst nachfragen – direkt im Feld, ohne Browser-Fenster
      if (!GN.zustand.vorschau[f] && !b.classList.contains("sicher")) {
        $$(".w-eintragen.sicher", t).forEach((x) => { x.classList.remove("sicher"); x.textContent = "✕"; });
        b.classList.add("sicher");
        b.textContent = "Streichen?";
        b.title = `Nochmal tippen: ${NAMEN[f][0]} mit 0 Punkten streichen`;
        Ton.klick();
        navigator.vibrate?.(30);
        clearTimeout(b._t);
        b._t = setTimeout(() => { if (b.isConnected) { b.classList.remove("sicher"); b.textContent = "✕"; } }, 4000);
        return;
      }
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
    if (a.typ === "wurf" && a.fuenfling) { zeige(`<b class="riesig">🎲 FÜNFLING!</b><span>${esc(nameVon(z, a.spieler))}</span>`, "gold", 2200); Ton.fanfare(); GN.konfetti(200); }
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
    beschreibung: "Fünf Würfel, drei Würfe, 13 Felder: Full House, Straßen und der Fünfling. Mit 3D-Würfeln, Becher, Punkteblock und der Würfel-Eule als Helfer.",
    tags: ["🎲 3D-Würfel", "🦉 Live-Helfer", "🤖 Auch gegen Computer", "👥 1–8 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
