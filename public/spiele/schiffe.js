// =============================================================
//  Schiffe versenken – Browser-Teil
//  Aufstellen im Raster (antippen, drehen, zufällig), Kampf im 3D-Meer
//  (oder in der 2D-Ansicht mit zwei Rastern). Die eigene Flotte kommt privat vom Server.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const N = 10, BUCH = "ABCDEFGHIJ";
  const SYMBOL = { traeger: "🛳️", schlacht: "⚓", kreuzer: "🚢", uboot: "🐋", zerstoerer: "⛵" };
  let meine = { schiffe: null, bereit: false };
  let lokal = [], gewaehlt = 0, quer = true;
  let meer = null, laedt3d = false, letzteNr = 0, offen = null, mitte = null;
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.animationen === "aus";
  const will3d = () => GN.speicher("sv3d") !== "aus" && !!window.SeeSchlacht3D?.moeglich();
  const feldName = (x, y) => `${BUCH[x]}${y + 1}`;
  const person = (id) => GN.spieler(id);

  GN.socket.on("sv:flotte", (f) => {
    meine = f;
    if (f.schiffe?.length) lokal = f.schiffe.map(({ x, y, quer }) => ({ x, y, quer }));
    if (GN.zustand?.spiel === "schiffe" && GN.zustand.phase !== "lobby") zeige(GN.zustand);
  });

  // ---------- Lobby ----------
  function abschnitte(z, host) {
    const e = z.einstellungen, dis = host ? "" : "disabled";
    return [
      {
        id: "spieler", wichtig: true, icon: "⚓", titel: "Flotten & Regeln", info: `${z.spieler.length} + ${e.bots} Computer · ${e.nochmal ? "Treffer = nochmal" : "abwechselnd"}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3].map((n) => `<button data-sv-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Schuss</div><div class="segment">${[15, 30, 0].map((n) => `<button data-sv-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + " s" : "∞"}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Nach einem Treffer</div><div class="segment"><button data-sv-nochmal="1" class="${e.nochmal ? "aktiv" : ""}" ${dis}>Nochmal schießen</button><button data-sv-nochmal="0" class="${!e.nochmal ? "aktiv" : ""}" ${dis}>Abwechselnd</button></div></div>
          <div><div class="unter-titel">Schiffe dürfen sich berühren</div><div class="segment"><button data-sv-ber="0" class="${!e.beruehren ? "aktiv" : ""}" ${dis}>Nein</button><button data-sv-ber="1" class="${e.beruehren ? "aktiv" : ""}" ${dis}>Ja</button></div></div>
        </div><p class="leise klein-text" style="margin-top:8px">2 bis 4 Flotten. Freie Plätze füllt der Computer. Mit mehr als zwei Flotten wählst du, auf wen du schießt.</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So wird gespielt", info: "5 Schiffe pro Flotte",
        html: `<ol class="q-regeln">
          <li>Jeder stellt geheim seine Flotte auf: <b>Flugzeugträger (5)</b>, <b>Schlachtschiff (4)</b>, <b>Kreuzer (3)</b>, <b>U-Boot (3)</b> und <b>Zerstörer (2)</b>.</li>
          <li>Schiffe liegen gerade und ${e.beruehren ? "dürfen sich berühren" : "berühren sich nicht, auch nicht über Eck"}.</li>
          <li>Reihum schießt ihr auf ein Feld. <b>Wasser</b>, <b>Treffer</b> oder <b>versenkt</b>: Ein versenktes Schiff wird aufgedeckt.</li>
          <li>${e.nochmal ? "Wer trifft, darf nochmal schießen." : "Nach jedem Schuss ist der Nächste dran."}</li>
          <li>Ist deine ganze Flotte versenkt, bist du raus. Die letzte Flotte gewinnt.</li>
          <li>Punkte: Treffer 10, versenktes Schiff 30, dazu 150 / 80 / 40 für die Plätze 1 bis 3.</li></ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-sv-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.svBots })));
    $$("[data-sv-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.svSek })));
    $$("[data-sv-nochmal]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ nochmal: b.dataset.svNochmal === "1" })));
    $$("[data-sv-ber]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ beruehren: b.dataset.svBer === "1" })));
  }

  // ---------- Aufstellung (lokal, wie der Server prüft) ----------
  const felderVon = (x, y, L, q) => Array.from({ length: L }, (_, i) => (q ? [x + i, y] : [x, y + i]));
  function belegung(liste, flotte, ohne = -1) {
    const m = new Map();
    liste.forEach((s, i) => { if (s && i !== ohne) felderVon(s.x, s.y, flotte[i].laenge, s.quer).forEach(([a, b]) => m.set(`${a},${b}`, i)); });
    return m;
  }
  function passt(liste, flotte, i, s, beruehren) {
    const f = felderVon(s.x, s.y, flotte[i].laenge, s.quer);
    if (f.some(([a, b]) => a < 0 || b < 0 || a >= N || b >= N)) return false;
    const m = belegung(liste, flotte, i);
    for (const [a, b] of f) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (beruehren && (dx || dy)) continue;
      if (m.has(`${a + dx},${b + dy}`)) return false;
    }
    return true;
  }
  function zufall(flotte, beruehren) {
    for (let v = 0; v < 400; v++) {
      const liste = [];
      let ok = true;
      for (let i = 0; i < flotte.length && ok; i++) {
        let gesetzt = false;
        for (let t = 0; t < 150 && !gesetzt; t++) {
          const q = Math.random() < 0.5, L = flotte[i].laenge;
          const s = { x: Math.floor(Math.random() * (q ? N - L + 1 : N)), y: Math.floor(Math.random() * (q ? N : N - L + 1)), quer: q };
          if (passt(liste, flotte, i, s, beruehren)) { liste[i] = s; gesetzt = true; }
        }
        ok = gesetzt;
      }
      if (ok) return liste;
    }
    return [];
  }

  // ---------- Bühne ----------
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (/podest/.test(GN.ansicht)) return;
      if (GN.ansicht !== "sv-ende") {
        GN.ansicht = "sv-ende";
        // Erst die letzte Explosion und das Aufdecken zeigen, dann die Siegerehrung
        sync(z);
        $("#svStatus") && ($("#svStatus").innerHTML = `<b>🏁 Seeschlacht vorbei!</b> Alle Flotten werden aufgedeckt …`);
        setTimeout(() => { if (GN.zustand?.phase === "ende" && GN.ansicht === "sv-ende") GN.podest("sv-podest", { einheit: "Punkte" }); }, 3600);
      }
      return;
    }
    if (GN.ansicht !== "sv-spiel" || !$(".sv-buehne")) aufbauen(z);
    kopf(z);
    if (z.phase === "aufstellen") aufstellenPanel(z);
    else kampfPanel(z);
    sync(z);
    if (z.restMs > 0 && (z.phase === "aufstellen" || (z.phase === "kampf" && !z.wartet))) {
      const key = `${z.phase}|${z.dran}|${z.letzter?.nr || 0}`;
      if (key !== mitte) { mitte = key; $("#timer").style.visibility = "visible"; GN.starteTimer(z.restMs, z.phase === "aufstellen" ? 75000 : z.sekunden * 1000, { tickAb: 5000, tonAus: () => z.dran !== GN.ich && z.phase === "kampf" }); }
    } else if (z.phase === "kampf") { mitte = null; GN.stoppeTimer(); $("#timer").style.visibility = "hidden"; }
  }

  function aufbauen(z) {
    GN.ansicht = "sv-spiel";
    letzteNr = z.letzter?.nr || 0;
    offen = null; mitte = null;
    if (!lokal.length || lokal.length !== z.flotteInfo.length) { lokal = []; gewaehlt = 0; }
    meer?.zerstoeren?.(); meer = null;
    const drei = will3d();
    app.innerHTML = `
      <div class="sv-buehne ${drei ? "drei" : "zwei"}">
        <div class="sv-kopf">
          <div class="sv-status" id="svStatus"></div>
          <button class="sv-umschalten" id="svUmschalten" title="Ansicht wechseln">${drei ? "2D" : "3D"}</button>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div><span class="timer-zahl versteckt" id="timerZahl"></span>
        <div class="sv-haupt">
          ${drei ? '<div class="sv-3d" id="sv3d"><div class="sv-laedt">⚓ Die Flotten laufen aus …</div></div>' : ""}
          <div class="sv-panel" id="svPanel"></div>
        </div>
      </div>`;
    $("#svUmschalten").onclick = () => { Ton.klick(); GN.speicher("sv3d", drei ? "aus" : "an"); aufbauen(GN.zustand); zeige(GN.zustand); };
    if (drei && !laedt3d) {
      laedt3d = true;
      window.SeeSchlacht3D.einhaengen($("#sv3d")).then((m) => {
        laedt3d = false;
        if (!$("#sv3d")) return m.zerstoeren();
        $(".sv-laedt")?.remove();
        meer = m;
        letzteNr = GN.zustand?.letzter?.nr || 0;
        sync(GN.zustand);
      }).catch((e) => { laedt3d = false; console.warn("3D nicht möglich", e); GN.speicher("sv3d", "aus"); aufbauen(GN.zustand); zeige(GN.zustand); });
    }
  }

  function kopf(z) {
    const ich = GN.ich;
    let text = "";
    if (z.phase === "aufstellen") {
      const fertig = z.teilnehmer.filter((t) => z.flotten[t.id]?.bereit).length;
      text = meine.bereit ? `<b>⚓ Flotte steht!</b> Warte auf die anderen (${fertig}/${z.teilnehmer.length}) …` : `<b>Stell deine Flotte auf</b> · Schiff wählen, aufs Feld tippen, ↻ dreht`;
    } else if (z.phase === "kampf") {
      const dran = person(z.dran), ziel = person(z.ziel[z.dran]);
      if (z.raus.includes(ich)) text = `☠️ Deine Flotte ist gesunken. Du schaust zu.`;
      else if (z.dran === ich) text = z.wartet ? `<b>Schuss unterwegs …</b>` : `<b class="sv-dran">🎯 Du bist dran!</b> Wähle ein Feld bei ${ziel.avatar} ${esc(ziel.name)}`;
      else text = `${dran.avatar} <b>${esc(dran.name)}</b> zielt auf ${z.ziel[z.dran] === ich ? "<b class=\"sv-warn\">deine Flotte!</b>" : `${ziel.avatar} ${esc(ziel.name)}`}`;
    }
    const st = $("#svStatus");
    if (st.innerHTML !== text) st.innerHTML = text;
  }

  // ---------- Aufstellen ----------
  function aufstellenPanel(z) {
    const flotte = z.flotteInfo, ber = z.beruehren;
    const alle = lokal.filter(Boolean).length === flotte.length;
    if (meine.bereit) {
      const html = `<div class="sv-karte"><h3>⚓ Bereit zum Auslaufen</h3>
        <div class="sv-bereit-liste">${z.teilnehmer.map((t) => `<span class="${z.flotten[t.id]?.bereit ? "ok" : ""}">${t.avatar} ${esc(t.id === GN.ich ? "Du" : t.name)} ${z.flotten[t.id]?.bereit ? "✓" : "…"}</span>`).join("")}</div>
        <button class="btn zweit klein" id="svAendern">✏️ Aufstellung ändern</button></div>
        ${meer ? "" : rasterHtml(lokal, flotte, { eigen: true, fest: true })}`;
      if (offen !== html) { offen = html; $("#svPanel").innerHTML = html; $("#svAendern").onclick = () => { Ton.klick(); GN.aktion("nichtBereit"); }; }
      return;
    }
    const html = `<div class="sv-karte sv-aufstellen">
        <div class="sv-schiffe">${flotte.map((s, i) => `<button class="sv-schiff ${i === gewaehlt ? "aktiv" : ""} ${lokal[i] ? "gesetzt" : ""}" data-sv-wahl="${i}"><span class="sv-laenge">${"▮".repeat(s.laenge)}</span><b>${esc(s.name)}</b>${lokal[i] ? "<em>✓</em>" : ""}</button>`).join("")}</div>
        ${rasterHtml(lokal, flotte, { eigen: true, setzen: true })}
        <div class="sv-knoepfe">
          <button class="btn zweit klein" id="svDrehen">↻ Drehen (${quer ? "waagrecht" : "senkrecht"})</button>
          <button class="btn zweit klein" id="svZufall">🎲 Zufällig</button>
          <button class="btn zweit klein" id="svLeeren" ${lokal.some(Boolean) ? "" : "disabled"}>Leeren</button>
        </div>
        <button class="btn gross voll" id="svBereit" ${alle ? "" : "disabled"}>⚓ Flotte bereit!</button>
      </div>`;
    if (offen === html) return;
    offen = html;
    $("#svPanel").innerHTML = html;
    const neu = () => { offen = null; aufstellenPanel(GN.zustand); sync(GN.zustand); };
    $$("[data-sv-wahl]").forEach((b) => (b.onclick = () => { Ton.klick(); gewaehlt = +b.dataset.svWahl; if (lokal[gewaehlt]) quer = lokal[gewaehlt].quer; neu(); }));
    $("#svDrehen").onclick = () => {
      Ton.wusch?.(); quer = !quer;
      const s = lokal[gewaehlt];
      if (s) { const d = { ...s, quer }; if (passt(lokal, flotte, gewaehlt, d, ber)) lokal[gewaehlt] = d; else { GN.toast("So passt das Schiff hier nicht hin."); quer = !quer; } }
      neu();
    };
    $("#svZufall").onclick = () => { Ton.wusch?.(); lokal = zufall(flotte, ber); neu(); };
    $("#svLeeren").onclick = () => { Ton.klick(); lokal = []; gewaehlt = 0; neu(); };
    $("#svBereit").onclick = () => { Ton.abgeben(); GN.aktion("aufstellen", lokal); };
    const raster = $(".sv-raster");
    const vorschau = (x, y) => {
      $$(".sv-feld.vor, .sv-feld.vor-falsch", raster).forEach((f) => f.classList.remove("vor", "vor-falsch"));
      if (x == null) return;
      const s = { x, y, quer }, ok = passt(lokal, flotte, gewaehlt, s, ber);
      felderVon(x, y, flotte[gewaehlt].laenge, quer).forEach(([a, b]) => $(`.sv-feld[data-x="${a}"][data-y="${b}"]`, raster)?.classList.add(ok ? "vor" : "vor-falsch"));
    };
    $$(".sv-feld", raster).forEach((f) => {
      const x = +f.dataset.x, y = +f.dataset.y;
      f.onpointerenter = (e) => e.pointerType === "mouse" && vorschau(x, y);
      f.onclick = () => {
        // Tipp auf ein gesetztes Schiff: auswählen (zum Versetzen)
        const belegt = belegung(lokal, flotte).get(`${x},${y}`);
        if (belegt !== undefined && belegt !== gewaehlt) { Ton.klick(); gewaehlt = belegt; quer = lokal[belegt].quer; return neu(); }
        // Bei senkrecht/waagrecht so verschieben, dass das Schiff aufs Feld passt
        const L = flotte[gewaehlt].laenge;
        const s = { x: quer ? Math.min(x, N - L) : x, y: quer ? y : Math.min(y, N - L), quer };
        if (!passt(lokal, flotte, gewaehlt, s, ber)) { Ton.falsch?.(); f.classList.add("nein"); setTimeout(() => f.classList.remove("nein"), 400); return; }
        Ton.klick(); lokal[gewaehlt] = s;
        const naechstes = flotte.findIndex((_, i) => !lokal[i]);
        if (naechstes >= 0) gewaehlt = naechstes;
        neu();
      };
    });
    raster.onpointerleave = () => vorschau(null);
  }

  // Raster (für Aufstellung und 2D-Kampf)
  function rasterHtml(schiffe, flotte, { eigen = false, setzen = false, fest = false, schuesse = {}, ziel = false, versenkte = [] } = {}) {
    const m = new Map();
    (schiffe || []).forEach((s, i) => { if (s) felderVon(s.x, s.y, (s.laenge || flotte[i].laenge), s.quer).forEach(([a, b], j, alle) => m.set(`${a},${b}`, { i, kopf: j === 0, ende: j === alle.length - 1, quer: s.quer })); });
    const v = new Map();
    versenkte.forEach((s) => felderVon(s.x, s.y, s.laenge, s.quer).forEach(([a, b], j, alle) => v.set(`${a},${b}`, { kopf: j === 0, ende: j === alle.length - 1, quer: s.quer })));
    let html = `<div class="sv-raster ${ziel ? "ziel" : ""} ${setzen ? "setzen" : ""}"><span></span>${[...BUCH].map((b) => `<span class="sv-achse">${b}</span>`).join("")}`;
    for (let y = 0; y < N; y++) {
      html += `<span class="sv-achse">${y + 1}</span>`;
      for (let x = 0; x < N; x++) {
        const k = `${x},${y}`, s = m.get(k) || v.get(k), sch = schuesse[k];
        const kl = ["sv-feld"];
        if (s) kl.push("schiff", s.quer ? "q" : "s", s.kopf ? "kopf" : "", s.ende ? "ende" : "");
        if (s && setzen && s.i === gewaehlt) kl.push("gewaehlt");
        if (sch) kl.push("s-" + sch);
        html += `<button class="${kl.join(" ")}" data-x="${x}" data-y="${y}" ${fest || (!setzen && !ziel) || (ziel && sch) ? "disabled" : ""} aria-label="${feldName(x, y)}"></button>`;
      }
    }
    return html + "</div>";
  }

  // ---------- Kampf ----------
  function kampfPanel(z) {
    const ich = GN.ich, binIch = !z.raus.includes(ich) && z.teilnehmer.some((t) => t.id === ich);
    const gegner = z.teilnehmer.filter((t) => t.id !== ich && !t.raus);
    const mein = z.dran === ich && !z.wartet && binIch;
    const zielId = z.ziel[z.dran];
    const flotteHtml = z.teilnehmer.map((t) => {
      const rest = z.flotten[t.id]?.rest || [];
      return `<div class="sv-flotte ${t.raus ? "raus" : ""} ${t.id === z.dran ? "dran" : ""} ${t.id === ich ? "ich" : ""}">
        <span class="sv-wer">${t.avatar} ${esc(t.id === ich ? "Du" : t.name)}</span>
        <span class="sv-rest">${z.flotteInfo.map((s) => `<i class="${rest.includes(s.typ) ? "" : "weg"}" title="${esc(s.name)}">${"▮".repeat(s.laenge)}</i>`).join("")}</span>
        <b>${z.punkte[t.id] || 0}</b>
      </div>`;
    }).join("");
    const zielWahl = mein && gegner.length > 1 ? `<div class="sv-zielwahl"><span>Ziel:</span>${gegner.map((t) => `<button data-sv-ziel="${t.id}" class="${zielId === t.id ? "aktiv" : ""}">${t.avatar} ${esc(t.name)}</button>`).join("")}</div>` : "";
    const log = z.verlauf.slice(0, 5).map((v) => `<li>${person(v.von).avatar} → ${person(v.auf).avatar} ${v.ergebnis === "wasser" ? "💧 Wasser" : v.ergebnis === "treffer" ? "💥 Treffer" : `☠️ ${esc(v.name || "")} versenkt`}</li>`).join("");
    // 2D: eigenes Raster und das Ziel-Raster
    let raster2d = "";
    if (!meer && !laedt3d) {
      const zeigeId = binIch ? (z.dran === ich ? zielId : zielId === ich ? ich : zielId) : zielId;
      const meinRaster = binIch ? `<div class="sv-r-box"><div class="sv-r-titel">🛳️ Deine Flotte</div>${rasterHtml(meine.schiffe, z.flotteInfo, { eigen: true, fest: true, schuesse: z.schuesse[ich] })}</div>` : "";
      const zielT = z.teilnehmer.find((t) => t.id === (zeigeId === ich ? z.ziel[z.dran] : zeigeId)) || gegner[0];
      const zielRaster = zielT && zielT.id !== ich ? `<div class="sv-r-box ${mein ? "aktiv" : ""}"><div class="sv-r-titel">🎯 ${zielT.avatar} ${esc(zielT.name)}</div>${rasterHtml([], z.flotteInfo, { ziel: mein, schuesse: z.schuesse[zielT.id], versenkte: z.flotten[zielT.id]?.schiffe || [] })}</div>` : "";
      raster2d = `<div class="sv-r-paar">${zielRaster}${meinRaster}</div>`;
    }
    const html = `${raster2d}${zielWahl}<div class="sv-karte sv-flotten">${flotteHtml}</div>${log ? `<ul class="sv-log">${log}</ul>` : ""}`;
    if (offen === html) return;
    offen = html;
    $("#svPanel").innerHTML = html;
    $$("[data-sv-ziel]").forEach((b) => (b.onclick = () => { Ton.klick(); GN.aktion("ziel", b.dataset.svZiel); }));
    if (mein) $$(".sv-raster.ziel .sv-feld:not(:disabled)").forEach((f) => (f.onclick = () => schiessen(+f.dataset.x, +f.dataset.y)));
  }
  function schiessen(x, y) {
    const z = GN.zustand;
    if (!z || z.phase !== "kampf" || z.dran !== GN.ich || z.wartet) return;
    const auf = z.ziel[GN.ich];
    if (z.schuesse[auf]?.[`${x},${y}`]) return GN.toast("Da hast du schon hingeschossen.");
    Ton.abgeben();
    GN.aktion("schuss", { auf, x, y });
  }

  // ---------- 3D abgleichen und Schüsse zeigen ----------
  function sync(z) {
    if (!z || z.spiel !== "schiffe") return;
    const ich = GN.ich;
    const neuerSchuss = z.letzter && z.letzter.nr > letzteNr ? z.letzter : null;
    if (neuerSchuss) { letzteNr = neuerSchuss.nr; schussZeigen(z, neuerSchuss); }
    if (!meer) return;
    meer.gebiete(z.teilnehmer.map((t) => ({ id: t.id, name: t.name, avatar: t.avatar, ich: t.id === ich, raus: t.raus })));
    // Flotten: eigene ganz (beim Aufstellen die lokale), fremde nur versenkte (am Ende alle)
    const ausstehend = offenerSchuss;
    for (const t of z.teilnehmer) {
      let schiffe = z.flotten[t.id]?.schiffe || [];
      if (t.id === ich && z.phase !== "ende") {
        const quelle = z.phase === "aufstellen" && !meine.bereit ? lokal.map((s, i) => s && { ...z.flotteInfo[i], ...s }).filter(Boolean) : (meine.schiffe || []);
        const versenkt = new Set(schiffe.filter((s) => s.versenkt).map((s) => s.typ));
        schiffe = quelle.map((s) => ({ ...s, versenkt: versenkt.has(s.typ) }));
      }
      // Ein gerade versenktes Schiff erst nach dem Einschlag zeigen bzw. sinken lassen
      if (ausstehend && ausstehend.auf === t.id && ausstehend.ergebnis === "versenkt") schiffe = schiffe.map((s) => (s.typ === ausstehend.typ ? (t.id === ich ? { ...s, versenkt: false } : null) : s)).filter(Boolean);
      meer.flotte(t.id, schiffe, { sinkenTyp: z.letzter?.ergebnis === "versenkt" && z.letzter.auf === t.id ? z.letzter.typ : null });
      const sch = z.schuesse[t.id] || {};
      // Felder des gerade versenkten Schiffs und den neuen Einschlag noch zurückhalten
      let marken = sch;
      if (ausstehend && ausstehend.auf === t.id) {
        marken = { ...sch };
        delete marken[`${ausstehend.x},${ausstehend.y}`];
        if (ausstehend.ergebnis === "versenkt") for (const [k, v] of Object.entries(marken)) if (v === "v" || v === "r") marken[k] = v === "v" ? "t" : undefined;
        for (const k of Object.keys(marken)) if (marken[k] === undefined) delete marken[k];
      }
      meer.marken(t.id, marken);
    }
    // Kamera und Zielen
    let fokus = null;
    if (z.phase === "aufstellen") fokus = ich;
    else if (z.phase === "kampf") fokus = z.ziel[z.dran];
    if (z.phase === "kampf" && z.dran === ich && !z.wartet && !z.raus.includes(ich)) {
      meer.zielen(z.ziel[ich], (x, y) => schiessen(x, y));
    } else meer.zielen(null);
    if (!ausstehend) meer.fokus(z.phase === "ende" ? null : fokus);
  }
  let offenerSchuss = null;
  function schussZeigen(z, s) {
    const ich = GN.ich;
    const ziel = person(s.auf), von = person(s.von);
    const text = s.ergebnis === "wasser" ? "💧 Wasser" : s.ergebnis === "treffer" ? "💥 Treffer!" : `☠️ ${s.name} versenkt!`;
    const danach = () => {
      offenerSchuss = null;
      if (s.ergebnis === "wasser") Ton.wusch?.();
      else if (s.ergebnis === "treffer") { Ton.treffer?.(); if (s.auf === ich) navigator.vibrate?.(60); }
      else { Ton.volltreffer?.(); if (s.auf === ich) navigator.vibrate?.([80, 40, 160]); }
      if (s.ergebnis !== "wasser") GN.fx?.knall(`${text}`, s.ergebnis === "versenkt" ? 2 : 1);
      if (s.raus) setTimeout(() => GN.fx?.knall(s.raus === ich ? "☠️ Deine Flotte ist gesunken" : `☠️ ${person(s.raus).name} ist raus!`, 2), 900);
      if (!meer) { offen = null; if (GN.zustand?.phase === "kampf") kampfPanel(GN.zustand); }
      sync(GN.zustand);
    };
    if (!meer || ruhig()) { danach(); return; }
    offenerSchuss = s;
    meer.fokus(s.auf);
    Ton.feuerstoss?.();
    // Kurz warten, damit die Kamera ankommt, dann fliegt die Granate
    setTimeout(() => meer?.schuss(s).then(danach) ?? danach(), 350);
    // Hinweis oben
    const st = $("#svStatus");
    if (st) st.innerHTML = `${von.avatar} ${esc(s.von === ich ? "Du" : von.name)} schießt auf ${feldName(s.x, s.y)} bei ${ziel.avatar} ${esc(s.auf === ich ? "dir" : ziel.name)} …`;
  }

  GN.spiele.schiffe = {
    icon: "🚢",
    titel: "Schiffe versenken",
    kurz: "Flotte aufstellen, zielen, versenken – in 3D auf hoher See.",
    beschreibung: "Stell deine fünf Schiffe geheim auf und versenk die gegnerischen Flotten Feld für Feld. Granaten fliegen im Bogen übers Meer, Treffer brennen, versenkte Schiffe gehen unter. Für 2 bis 4 Flotten, freie Plätze übernimmt der Computer.",
    tags: ["🚢 Taktik", "💥 3D-Seeschlacht", "👥 1–4 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
