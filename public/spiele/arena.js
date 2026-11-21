// =============================================================
//  Arena – Browser-Teil
//  Tagesarena (7 Aufgaben für alle gleich), freie Antworten nach Seltenheit,
//  Ruhm-Anzeige (Zuschauer im Kolosseum), Statistik-Speicher auf dem Gerät
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;

  // ---------- Stufen ----------
  const STUFE = {
    0: { name: "Ausgebuht", kurz: "0", icon: "💨", farbe: "#6b6478", emoji: "⬛" },
    10: { name: "Fußvolk", kurz: "10", icon: "🛡️", farbe: "#c0844f", emoji: "🟫" },
    30: { name: "Krieger", kurz: "30", icon: "⚔️", farbe: "#3fc47d", emoji: "🟩" },
    60: { name: "Champion", kurz: "60", icon: "🏆", farbe: "#4d8eff", emoji: "🟦" },
    85: { name: "Legende", kurz: "85", icon: "👑", farbe: "#b363ff", emoji: "🟪" },
    100: { name: "Goldener Lorbeer", kurz: "100", icon: "🌿", farbe: "#ffcf3f", emoji: "🟨" },
  };
  const STUFEN = [10, 30, 60, 85, 100];
  // Titel nach Anteil am möglichen Ruhm
  const TITEL = [[0, "Sandkorn", "🏖️"], [0.12, "Rekrut", "🪖"], [0.25, "Gladiator", "⚔️"], [0.38, "Veteran", "🛡️"], [0.5, "Held der Arena", "🦁"], [0.62, "Titan", "⚡"], [0.75, "Imperator", "🏛️"]];
  const titelFuer = (punkte, max) => { let t = TITEL[0]; for (const x of TITEL) if (punkte / max >= x[0]) t = x; return { name: t[1], icon: t[2] }; };
  const fmt = (n) => Math.round(n).toLocaleString("de-DE");
  const zuschauer = (p) => fmt(p * 100);
  const datumText = (d) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  // =============================================================
  //  Statistik-Speicher (auf diesem Gerät)
  // =============================================================
  const SCHLUESSEL = "arenaStatistik";
  const leer = () => ({ v: 1, tage: {}, frei: { spiele: 0, ruhm: 0, antworten: 0, rekord: 0 }, stufen: { 0: 0, 10: 0, 30: 0, 60: 0, 85: 0, 100: 0 }, lorbeeren: [] });
  function laden() {
    try { const d = JSON.parse(GN.speicher(SCHLUESSEL) || "null"); if (d && d.v === 1) return { ...leer(), ...d }; } catch {}
    return leer();
  }
  const sichern = (d) => GN.speicher(SCHLUESSEL, JSON.stringify(d));
  const tagPlus = (datum, n) => { const t = new Date(datum + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const heuteLokal = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

  function auswerten(d = laden()) {
    const tage = Object.keys(d.tage).sort();
    const punkte = tage.map((t) => d.tage[t].punkte);
    // Serie: zusammenhängende Tage bis heute (oder bis gestern, falls heute noch offen)
    let serie = 0, beste = 0, lauf = 0, vorher = null;
    for (const t of tage) { lauf = vorher && tagPlus(vorher, 1) === t ? lauf + 1 : 1; beste = Math.max(beste, lauf); vorher = t; }
    const h = heuteLokal();
    if (vorher === h || vorher === tagPlus(h, -1)) serie = lauf;
    return {
      gespielt: tage.length, serie, besteSerie: beste,
      rekord: punkte.length ? Math.max(...punkte) : 0,
      schnitt: punkte.length ? Math.round(punkte.reduce((a, b) => a + b, 0) / punkte.length) : 0,
      tage, heute: d.tage[h] || null,
    };
  }

  // Ergebnis eines fertigen Spiels speichern (genau einmal pro Spiel)
  function ergebnisSpeichern(z) {
    const d = laden();
    const verlauf = z.verlauf?.[GN.ich];
    if (!verlauf || (d.zuletzt === z.spielId)) return { neu: false };
    d.zuletzt = z.spielId;
    const punkte = verlauf.reduce((a, v) => a + v.stufe, 0);
    let neu = false;
    if (z.modus === "tag" && !d.tage[z.datum]) {
      d.tage[z.datum] = { nr: z.tagNr, punkte, stufen: verlauf.map((v) => v.stufe), antworten: verlauf.map((v, i) => ({ f: z.alleFragen[i].frage, a: v.text, e: v.erkannt, s: v.stufe })), t: Date.now() };
      neu = true;
    } else {
      d.frei.spiele++; d.frei.ruhm += punkte; d.frei.antworten += verlauf.length;
      d.frei.rekord = Math.max(d.frei.rekord || 0, Math.round((punkte / verlauf.length) * 7));
    }
    verlauf.forEach((v, i) => {
      d.stufen[v.stufe] = (d.stufen[v.stufe] || 0) + 1;
      if (v.stufe === 100) d.lorbeeren.unshift({ datum: z.datum, frage: z.alleFragen[i].frage, antwort: v.erkannt || v.text });
    });
    d.lorbeeren = d.lorbeeren.slice(0, 60);
    sichern(d);
    return { neu, punkte };
  }

  function teilenText(nr, stufen) {
    const p = stufen.reduce((a, b) => a + b, 0);
    const t = titelFuer(p, stufen.length * 100);
    return `SpielO Arena #${nr} 🏛️\n${t.icon} ${p} Ruhm · ${t.name}\n${stufen.map((s) => STUFE[s].emoji).join("")}\n${location.origin}`;
  }
  async function teilen(text) {
    Ton.klick();
    try { if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); GN.toast("Ergebnis kopiert. Einfach einfügen!", true); }
    catch { prompt("Zum Kopieren:", text); }
  }

  // =============================================================
  //  Bausteine
  // =============================================================
  // Kolosseum-Anzeige: Halbkreis füllt sich mit Ruhm, innen die Zuschauerzahl
  function ruhmAnzeige(punkte, max, { klein = false } = {}) {
    const anteil = Math.max(0, Math.min(1, punkte / max));
    const t = titelFuer(punkte, max);
    const r = 80, umfang = Math.PI * r;
    return `<div class="a-ruhm ${klein ? "klein" : ""}">
      <svg viewBox="0 0 200 112" class="a-bogen" aria-hidden="true">
        <defs><linearGradient id="aGold" x1="0" x2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".55" stop-color="#ffcf3f"/><stop offset="1" stop-color="#fff1a8"/></linearGradient></defs>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => { const w = Math.PI * (i / 8); const x1 = 100 - Math.cos(w) * 66, y1 = 100 - Math.sin(w) * 66, x2 = 100 - Math.cos(w) * 96, y2 = 100 - Math.sin(w) * 96; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="a-saeule"/>`; }).join("")}
        <path d="M20 100 A80 80 0 0 1 180 100" class="a-bahn"/>
        <path d="M20 100 A80 80 0 0 1 180 100" class="a-fuell" stroke="url(#aGold)" style="stroke-dasharray:${umfang};stroke-dashoffset:${umfang * (1 - anteil)}"/>
      </svg>
      <div class="a-ruhm-text"><b class="a-ruhm-zahl" data-ziel="${punkte}">${fmt(punkte)}</b><span>Ruhm</span></div>
      <div class="a-ruhm-unter">${t.icon} <b>${t.name}</b> · ${zuschauer(punkte)} Zuschauer</div>
    </div>`;
  }
  const schilde = (stufen, gesamt) => `<div class="a-schilde">${Array.from({ length: gesamt }, (_, i) => {
    const s = stufen[i];
    return `<span class="a-schild ${s === undefined ? "offen" : "s" + s}" title="${s === undefined ? `Aufgabe ${i + 1}` : `${STUFE[s].name} · ${s}`}">${s === undefined ? i + 1 : STUFE[s].icon}</span>`;
  }).join("")}</div>`;
  const pille = (s) => `<span class="a-pille s${s}">${STUFE[s].icon} ${STUFE[s].name}${s ? ` · ${s}` : ""}</span>`;

  // =============================================================
  //  Statistik-Fenster
  // =============================================================
  function zeigeStatistik() {
    Ton.klick();
    const d = laden();
    const a = auswerten(d);
    const letzte = Array.from({ length: 14 }, (_, i) => tagPlus(heuteLokal(), i - 13));
    const maxS = Math.max(1, ...Object.values(d.stufen));
    const alleAntw = Object.values(d.stufen).reduce((x, y) => x + y, 0);
    let fenster = $("#aStatistik");
    if (!fenster) { fenster = document.createElement("dialog"); fenster.id = "aStatistik"; fenster.className = "fenster a-fenster"; document.body.appendChild(fenster); }
    fenster.innerHTML = `
      <div class="fenster-kopf"><b>📊 Deine Arena-Statistik</b><button class="icon-btn" data-schliessen aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt">
        <div class="a-kacheln">
          <div><b>${a.gespielt}</b><span>Arenen</span></div>
          <div><b>${a.serie}${a.serie ? " 🔥" : ""}</b><span>Serie</span></div>
          <div><b>${a.besteSerie}</b><span>Beste Serie</span></div>
          <div><b>${a.rekord}</b><span>Rekord</span></div>
          <div><b>${a.schnitt}</b><span>Ø Ruhm</span></div>
        </div>
        <div class="a-zwischen">Letzte 14 Tage</div>
        <div class="a-verlauf">${letzte.map((t) => { const e = d.tage[t]; const h = e ? Math.max(4, (e.punkte / 700) * 100) : 0; return `<div class="a-tag ${e ? "" : "leer"} ${t === heuteLokal() ? "heute" : ""}" title="${datumText(t)}${e ? `: ${e.punkte} Ruhm` : ""}"><i style="height:${h}%"></i><small>${Number(t.slice(8))}.</small></div>`; }).join("")}</div>
        <div class="a-zwischen">Deine Antworten nach Stufe <small class="leise">(${alleAntw} insgesamt)</small></div>
        <div class="a-verteilung">${[100, 85, 60, 30, 10, 0].map((s) => `<div class="a-vt"><span>${STUFE[s].icon} ${STUFE[s].name}</span><i><b class="s${s}" style="width:${(d.stufen[s] / maxS) * 100}%"></b></i><em>${d.stufen[s] || 0}</em></div>`).join("")}</div>
        <div class="a-zwischen">🌿 Goldene Lorbeeren <small class="leise">(${d.lorbeeren.length})</small></div>
        ${d.lorbeeren.length ? `<ul class="a-lorbeeren">${d.lorbeeren.slice(0, 20).map((l) => `<li><b>${esc(l.antwort)}</b><span>${esc(l.frage)}</span></li>`).join("")}</ul>` : '<p class="leise klein-text">Noch keiner. Die seltenste Antwort jeder Aufgabe bringt 100 Ruhm und landet hier.</p>'}
        ${a.tage.length ? `<div class="a-zwischen">Vergangene Arenen</div><div class="a-archiv">${a.tage.slice(-10).reverse().map((t) => { const e = d.tage[t]; return `<details><summary><span>#${e.nr} · ${new Date(t + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}</span><span>${e.stufen.map((s) => STUFE[s].emoji).join("")}</span><b>${e.punkte}</b></summary>
          <ul>${(e.antworten || []).map((x) => `<li><span>${esc(x.f)}</span><b>${esc(x.a || "–")}</b>${pille(x.s)}</li>`).join("")}</ul></details>`; }).join("")}</div>` : ""}
        <div class="a-zwischen">Freies Spiel</div>
        <p class="klein-text">${d.frei.spiele} Spiele · ${fmt(d.frei.ruhm)} Ruhm gesammelt${d.frei.spiele ? ` · bestes Spiel ≈ ${d.frei.rekord} Ruhm auf 7 Aufgaben` : ""}</p>
        <div class="a-sichern">
          <button class="btn klein zweit" id="aExport">💾 Sichern</button>
          <button class="btn klein zweit" id="aImport">📥 Wiederherstellen</button>
        </div>
        <p class="leise klein-text">Deine Statistik wird auf diesem Gerät gespeichert. Mit „Sichern“ bekommst du einen Code, den du auf einem anderen Gerät wiederherstellen kannst.</p>
      </div>`;
    fenster.querySelector("[data-schliessen]").onclick = () => fenster.close();
    fenster.onclick = (ev) => { if (ev.target === fenster) fenster.close(); };
    $("#aExport", fenster).onclick = async () => {
      const code = "ARENA1:" + btoa(unescape(encodeURIComponent(JSON.stringify(laden()))));
      try { await navigator.clipboard.writeText(code); GN.toast("Sicherungs-Code kopiert.", true); } catch { prompt("Dein Sicherungs-Code:", code); }
    };
    $("#aImport", fenster).onclick = () => {
      const code = prompt("Sicherungs-Code einfügen:");
      if (!code) return;
      try {
        const neu = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^ARENA1:/, "")))));
        if (neu.v !== 1 || typeof neu.tage !== "object") throw 0;
        const alt = laden();
        // Zusammenführen: Tage aus beiden behalten
        const zusammen = { ...alt, ...neu, tage: { ...neu.tage, ...alt.tage }, lorbeeren: [...alt.lorbeeren, ...neu.lorbeeren].slice(0, 60) };
        sichern(zusammen); GN.toast("Statistik wiederhergestellt.", true); zeigeStatistik();
      } catch { GN.toast("Der Code ist ungültig."); }
    };
    if (!fenster.open) fenster.showModal();
  }
  GN.arenaStatistik = zeigeStatistik;

  // =============================================================
  //  Startseite: Tagesarena-Block
  // =============================================================
  let tagesStand = null;
  GN.socket.on("arenaTag", (s) => { tagesStand = s; zeichneStartBlock(); });
  function startseite(box) {
    box.innerHTML = `<section class="kapitel a-start rein" data-farbe="arena" style="--d:1.55s" id="aStart"><div class="a-start-lade">🏛️ Arena wird geladen${GN.wartePunkte()}</div></section>`;
    const a = auswerten();
    const h = a.heute;
    GN.socket.emit("arenaTag", { geraet: GN.ich, ergebnis: h ? { name: GN.speicher("name") || "?", datum: heuteLokal(), stufen: h.stufen } : null });
    if (tagesStand) zeichneStartBlock();
  }
  function zeichneStartBlock() {
    const el = $("#aStart");
    if (!el || !tagesStand) return;
    const s = tagesStand;
    const a = auswerten();
    const h = a.heute;
    const std = Math.floor(s.morgenIn / 36e5), min = Math.floor((s.morgenIn % 36e5) / 6e4);
    el.innerHTML = `
      <div class="a-start-kopf">
        <div><div class="a-start-titel">🏛️ Tagesarena <span>#${s.nr}</span></div><div class="leise klein-text">${datumText(s.datum)} · 7 Aufgaben · für alle gleich</div></div>
        ${a.serie ? `<div class="a-serie" title="Tage in Folge">🔥 ${a.serie}</div>` : ""}
      </div>
      ${h ? `
        <div class="a-start-ergebnis">
          ${ruhmAnzeige(h.punkte, 700, { klein: true })}
          ${schilde(h.stufen, 7)}
          <div class="klein-text">${s.meinPlatz ? `Platz <b>${s.meinPlatz}</b> von ${s.anzahl}` : ""} · Ø heute ${s.schnitt} · neue Arena in ${std} h ${min} min</div>
        </div>
        <div class="a-start-knoepfe"><button class="btn" id="aTeilen">📤 Teilen</button><button class="btn zweit" id="aStat">📊 Statistik</button></div>`
      : `
        <p class="a-start-text">Nenne Antworten, auf die sonst keiner kommt. Je seltener, desto mehr Ruhm. Heute ${s.anzahl === 1 ? "war 1 Gladiator" : `waren ${s.anzahl} Gladiatoren`} in der Arena.</p>
        <div class="a-start-knoepfe"><button class="btn gross" id="aLos">⚔️ Arena betreten</button><button class="btn zweit" id="aStat">📊 Statistik</button></div>`}
      ${s.top.length ? `<details class="a-tagesliste" ${h ? "open" : ""}><summary>🏆 Rangliste heute</summary><ol>${s.top.slice(0, 10).map((e) => `<li class="${e.ich ? "ich" : ""}"><span>${esc(e.avatar)} ${esc(e.name)}</span><span class="a-mini">${e.stufen.map((x) => STUFE[x].emoji).join("")}</span><b>${e.punkte}</b></li>`).join("")}</ol></details>` : ""}`;
    $("#aStat", el).onclick = zeigeStatistik;
    $("#aTeilen", el)?.addEventListener("click", () => teilen(teilenText(s.nr, h.stufen)));
    $("#aLos", el)?.addEventListener("click", () => {
      try { sessionStorage.setItem("arenaDirekt", "1"); } catch {}
      if (!GN.raumMitSpiel("arena")) try { sessionStorage.removeItem("arenaDirekt"); } catch {}
    });
  }

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    const a = auswerten();
    return [
      {
        id: "modus", wichtig: true, icon: "🏛️", titel: "Modus", info: e.modus === "tag" ? "Tagesarena: 7 Aufgaben von heute" : `Freies Spiel: ${e.runden} Aufgaben`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Modus</div><div class="segment">
            <button data-a-modus="tag" class="${e.modus === "tag" ? "aktiv" : ""}" ${dis}>☀️ Tagesarena</button>
            <button data-a-modus="frei" class="${e.modus === "frei" ? "aktiv" : ""}" ${dis}>🎲 Freies Spiel</button></div></div>
          ${e.modus === "frei" ? `<div><div class="unter-titel">Aufgaben</div><div class="segment">${[5, 7, 10, 15].map((n) => `<button data-a-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>` : ""}
          <div><div class="unter-titel">Zeit pro Aufgabe</div><div class="segment">${[15, 25, 40].map((n) => `<button data-a-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n}s</button>`).join("")}</div></div>
          <div><div class="unter-titel">Computer</div><div class="segment">${[0, 1, 2, 3].map((n) => `<button data-a-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n || "Keine"}</button>`).join("")}</div></div>
        </div>
        <p class="leise klein-text" style="margin-top:8px">${e.modus === "tag"
          ? (a.heute ? `Du hast die Tagesarena heute schon gespielt (${a.heute.punkte} Ruhm). Eine weitere Runde ist nur Übung.` : "Dein erstes Ergebnis von heute kommt in die Tages-Rangliste und deine Statistik.")
          : "Zufällige Aufgaben (ohne die von heute), so oft ihr wollt."}</p>
        <button class="btn klein zweit" data-a-statistik style="margin-top:8px">📊 Meine Statistik</button>`,
      },
      {
        id: "regeln", icon: "📖", titel: "So geht's", info: "Seltene Antworten = mehr Ruhm",
        html: `<ol class="q-regeln">
          <li>Jede Aufgabe ist eine Kategorie, z. B. <b>„Nenne eine Nudelsorte“</b>. Du hast eine Antwort und ${e.sekunden} Sekunden.</li>
          <li>Je <b>seltener</b> deine richtige Antwort, desto mehr Ruhm bekommst du:</li>
        </ol>
        <div class="a-stufen-info">${STUFEN.map((s) => `<div>${pille(s)}<span>${{ 10: "Darauf kommt jeder", 30: "Gut, aber bekannt", 60: "Nicht schlecht!", 85: "Darauf kommen nur wenige", 100: "Die eine besondere Antwort" }[s]}</span></div>`).join("")}</div>
        <ol class="q-regeln" start="3">
          <li>Falsch oder nicht gewusst gibt 0. Kleine Tippfehler sind kein Problem.</li>
          <li>Dein Ruhm füllt das Kolosseum: Jeder Punkt bringt 100 Zuschauer.</li>
          <li>Die <b>Tagesarena</b> ist jeden Tag neu und für alle gleich. Sammle eine Serie!</li>
        </ol>`,
      },
    ];
  }
  function binde(el) {
    $$("[data-a-modus]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ modus: b.dataset.aModus })));
    $$("[data-a-runden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.aRunden })));
    $$("[data-a-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.aSek })));
    $$("[data-a-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.aBots })));
  }
  function lobbyFertig(z, host) {
    $$("[data-a-statistik]").forEach((b) => (b.onclick = zeigeStatistik));
    let direkt = false;
    try { direkt = sessionStorage.getItem("arenaDirekt") === "1"; sessionStorage.removeItem("arenaDirekt"); } catch {}
    if (direkt && host && z.spiel === "arena") {
      if (z.einstellungen.modus !== "tag") GN.einstellungen({ modus: "tag" });
      setTimeout(() => GN.socket.emit("spielStarten"), 150);
    }
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  let schluessel = "";
  let gesehenAufloesung = "";
  const meinVerlauf = (z) => (z.verlauf?.[GN.ich] || []).map((v) => v.stufe);

  function zeige(z, vorher) {
    if (z.phase === "ende") return zeigeEnde(z);
    const k = `${z.spielId}-${z.nr}-${z.phase}`;
    if (!$(".a-buehne") || GN.ansicht !== "arena-spiel") aufbauen(z);
    if (k !== schluessel) { schluessel = k; z.phase === "frage" ? frageZeigen(z) : aufloesungZeigen(z); timerStarten(z); }
    leuteZeigen(z);
  }

  function aufbauen(z) {
    GN.ansicht = "arena-spiel";
    GN.stoppeTimer();
    schluessel = "";
    app.innerHTML = `
      <div class="a-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">${z.modus === "tag" ? `🏛️ Tagesarena #${z.tagNr}` : "🎲 Freies Spiel"}</span>
          <span class="runden-nr" id="aNr"></span>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="a-kopf" id="aKopf"></div>
        <div id="aInhalt"></div>
        <div class="a-leute" id="aLeute"></div>
      </div>`;
  }

  function kopf(z, stufen) {
    const p = stufen.reduce((a, b) => a + b, 0);
    $("#aKopf").innerHTML = `${ruhmAnzeige(p, z.gesamt * 100, { klein: true })}${schilde(stufen, z.gesamt)}`;
  }

  function timerStarten(z) {
    if (z.restMs > 0) GN.starteTimer(z.restMs, z.phase === "frage" ? z.sekunden * 1000 : 12000, { tickAb: z.phase === "frage" ? 5000 : 0, tonAus: () => GN.zustand?.phase !== "frage" || GN.zustand.beantwortet.includes(GN.ich) });
    else GN.stoppeTimer();
  }

  function frageZeigen(z) {
    $("#aNr").textContent = `Aufgabe ${z.nr} / ${z.gesamt}`;
    kopf(z, meinVerlauf(z).slice(0, z.nr - 1));
    const schon = z.beantwortet.includes(GN.ich);
    $("#aInhalt").innerHTML = `
      <div class="a-karte rein-a">
        <div class="a-karte-nr">Aufgabe ${z.nr}</div>
        <h2 class="a-frage">${esc(z.frage)}</h2>
        <form class="a-eingabe ${schon ? "fertig" : ""}" id="aForm" autocomplete="off">
          <input id="aAntwort" class="feld" maxlength="40" placeholder="Deine Antwort …" enterkeyhint="send" autocapitalize="sentences" ${schon ? "disabled" : ""} aria-label="Antwort">
          <button class="btn gross" id="aSenden" ${schon ? "disabled" : ""}>⚔️ Los</button>
        </form>
        <div class="a-status" id="aStatus">${schon ? "✓ Antwort abgegeben. Warte auf die anderen" + GN.wartePunkte() : "Eine Antwort. Je seltener, desto mehr Ruhm."}</div>
      </div>`;
    GN.intro({ oben: `Aufgabe ${z.nr} von ${z.gesamt}`, icon: "🏛️", titel: esc(z.frage), dauer: 1300 });
    const input = $("#aAntwort");
    setTimeout(() => !schon && input && document.activeElement !== input && input.focus({ preventScroll: true }), 1350);
    $("#aForm").onsubmit = (ev) => {
      ev.preventDefault();
      const text = input.value.trim();
      if (!text) { input.classList.add("fehlt"); setTimeout(() => input.classList.remove("fehlt"), 600); return; }
      Ton.abgeben();
      GN.aktion("antwort", text);
      input.disabled = true; $("#aSenden").disabled = true;
      $("#aForm").classList.add("fertig");
      $("#aStatus").innerHTML = `✓ „${esc(text)}“ abgegeben. Warte auf die anderen${GN.wartePunkte()}`;
    };
  }

  function aufloesungZeigen(z) {
    $("#aNr").textContent = `Aufgabe ${z.nr} / ${z.gesamt}`;
    const ich = z.antworten[GN.ich];
    const stufen = meinVerlauf(z);
    kopf(z, stufen.slice(0, -1));
    const s = ich ? ich.stufe : 0;
    const andere = (z.teilnehmer || []).filter((t) => t.id !== GN.ich);
    const beispiele = z.beispiele;
    $("#aInhalt").innerHTML = `
      <div class="a-karte a-ergebnis s${s}">
        <div class="a-karte-nr">${esc(z.frage)}</div>
        ${ich ? `
          <div class="a-medaille s${s}"><span>${STUFE[s].icon}</span></div>
          <div class="a-stufe-name">${STUFE[s].name}</div>
          <div class="a-deine">${ich.leer ? "Keine Antwort abgegeben" : `„${esc(ich.text)}“${ich.erkannt && ich.erkannt.toLowerCase() !== ich.text.toLowerCase() ? ` <small>erkannt als ${esc(ich.erkannt)}</small>` : ""}${!ich.erkannt ? " <small>nicht in unserer Liste</small>" : ""}`}</div>
          <div class="a-plus">+${s} Ruhm</div>` : '<div class="a-deine">Du schaust bei dieser Aufgabe zu.</div>'}
      </div>
      ${andere.length ? `<div class="a-andere">${andere.map((t) => { const a = z.antworten[t.id] || { stufe: 0, leer: true }; return `<div class="a-anderer s${a.stufe}"><span class="a-ava">${t.avatar}</span><span class="a-wer">${esc(t.name)}</span><span class="a-was">${a.leer ? "–" : `„${esc(a.text)}“`}</span>${pille(a.stufe)}</div>`; }).join("")}</div>` : ""}
      <div class="a-liste">
        <div class="a-zwischen">Mögliche Antworten</div>
        ${[100, 85, 60, 30, 10].map((st) => { const l = beispiele[st] || []; const zeigen = st === 100 ? l : l.slice(0, 6); return `<div class="a-liste-zeile s${st}"><span class="a-liste-stufe">${STUFE[st].icon}<b>${st}</b></span><span class="a-liste-namen">${zeigen.map((x) => `<span class="${ich?.erkannt === x ? "meins" : ""}">${esc(x)}</span>`).join("")}${l.length > zeigen.length ? `<em>+${l.length - zeigen.length} weitere</em>` : ""}</span></div>`; }).join("")}
      </div>
      <div class="a-weiter" id="aWeiter"></div>`;
    // Effekt für die eigene Stufe
    if (ich && gesehenAufloesung !== schluessel) {
      gesehenAufloesung = schluessel;
      const med = $(".a-medaille");
      med?.classList.add("knall");
      setTimeout(() => kopf(z, stufen), 650);
      if (s === 100) { Ton.fanfare(); GN.konfetti(220); navigator.vibrate?.([60, 40, 120]); }
      else if (s >= 85) { Ton.volltreffer(); GN.konfetti(90); navigator.vibrate?.(60); }
      else if (s >= 30) Ton.richtig();
      else if (s > 0) Ton.ding();
      else Ton.falsch();
    } else kopf(z, stufen);
    weiterKnopf(z);
  }

  function weiterKnopf(z) {
    const box = $("#aWeiter");
    if (!box) return;
    const menschen = (z.teilnehmer || []).filter((t) => !t.bot && t.online && !t.afk);
    const bereit = z.weiter.filter((id) => menschen.some((t) => t.id === id)).length;
    const ich = z.weiter.includes(GN.ich);
    const letzte = z.nr >= z.gesamt;
    box.innerHTML = `<button class="btn gross voll" id="aWeiterBtn" ${ich ? "disabled" : ""}>${ich ? "✓ Bereit" : letzte ? "🏁 Zum Ergebnis" : "Weiter ➜"}</button>${menschen.length > 1 ? `<span class="leise klein-text">${bereit} von ${menschen.length} bereit · geht gleich automatisch weiter</span>` : ""}`;
    $("#aWeiterBtn").onclick = () => { Ton.klick(); GN.aktion("weiter"); $("#aWeiterBtn").disabled = true; };
  }

  function leuteZeigen(z) {
    const box = $("#aLeute");
    if (!box) return;
    const alle = z.teilnehmer || [];
    if (z.phase === "aufloesung") weiterKnopf(z);
    if (alle.length < 2) { box.innerHTML = ""; return; }
    box.innerHTML = alle.map((t) => {
      const p = GN.alle(z).find((x) => x.id === t.id)?.punkte ?? 0;
      const fertig = z.phase === "frage" ? z.beantwortet.includes(t.id) : z.weiter.includes(t.id);
      return `<span class="a-person ${fertig ? "fertig" : ""} ${t.id === GN.ich ? "ich" : ""} ${t.online ? "" : "offline"}"><span>${t.avatar}</span><b>${esc(t.id === GN.ich ? "Du" : t.name)}</b><em>${p}</em>${fertig ? "<i>✓</i>" : ""}</span>`;
    }).join("");
  }

  // =============================================================
  //  Ergebnis
  // =============================================================
  let endeFuer = "";
  function zeigeEnde(z) {
    if (/podest/.test(GN.ansicht)) return;
    if (GN.ansicht === "arena-ende" && endeFuer === z.spielId) { GN.rangliste($("#rangliste")); return endeKnoepfe(z); }
    GN.ansicht = "arena-ende";
    endeFuer = z.spielId;
    GN.stoppeTimer();
    $("#intro").classList.add("versteckt");
    const v = z.verlauf[GN.ich] || [];
    const stufen = v.map((x) => x.stufe);
    const punkte = stufen.reduce((a, b) => a + b, 0);
    const { neu } = ergebnisSpeichern(z);
    const stat = auswerten();
    const tag = z.modus === "tag";
    const gezaehlt = tag && (z.gezaehlt?.[GN.ich] || neu);
    const mehrere = (z.teilnehmer || []).length > 1;
    app.innerHTML = `
      <div class="max-breite a-ende">
        <div class="a-ende-titel">${tag ? `🏛️ Tagesarena #${z.tagNr} geschlagen!` : "🎲 Freies Spiel beendet"}</div>
        ${ruhmAnzeige(punkte, z.gesamt * 100)}
        ${schilde(stufen, z.gesamt)}
        <div class="a-ende-info">${tag ? (gezaehlt ? `✓ Zählt für die Tages-Rangliste${stat.serie > 1 ? ` · 🔥 ${stat.serie} Tage in Folge!` : ""}` : "Übungsrunde: Dein erstes Ergebnis von heute zählt.") : ""}</div>
        <div class="a-ende-knoepfe">
          ${tag ? '<button class="btn" id="aTeilenEnde">📤 Ergebnis teilen</button>' : ""}
          <button class="btn zweit" id="aStatEnde">📊 Statistik</button>
          ${mehrere ? '<button class="btn zweit" id="aPodest">🏆 Siegerehrung</button>' : ""}
        </div>
        <div class="abschnitt-titel">Deine Antworten</div>
        <div class="a-rueckblick">${z.alleFragen.map((f, i) => { const x = v[i] || { stufe: 0, text: "" }; return `<div class="a-rb s${x.stufe}"><span class="a-rb-icon">${STUFE[x.stufe].icon}</span><div><div class="a-rb-frage">${esc(f.frage)}</div><div class="a-rb-antwort">${x.text ? `„${esc(x.text)}“` : "–"} <b>+${x.stufe}</b></div><div class="a-rb-gold">🌿 Goldener Lorbeer: ${esc(f.gold)}</div></div></div>`; }).join("")}</div>
        ${mehrere ? '<div class="abschnitt-titel">Endstand</div><div class="rangliste" id="rangliste"></div>' : ""}
        <div class="start-leiste" id="aEndeLeiste"></div>
      </div>`;
    GN.rangliste($("#rangliste"));
    $("#aTeilenEnde")?.addEventListener("click", () => teilen(teilenText(z.tagNr, stufen)));
    $("#aStatEnde").onclick = zeigeStatistik;
    $("#aPodest")?.addEventListener("click", () => GN.podest("arena-podest", { einheit: "Ruhm" }));
    endeKnoepfe(z);
    // Ruhm zählt hoch
    const zahl = $(".a-ende .a-ruhm-zahl");
    const start = performance.now();
    const lauf = (t) => { const k = Math.min(1, (t - start) / 1400); zahl.textContent = fmt(punkte * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(lauf); };
    requestAnimationFrame(lauf);
    Ton.trommel(1.1);
    setTimeout(() => { Ton.fanfare(); GN.konfetti(punkte >= z.gesamt * 40 ? 200 : 90); }, 1300);
  }
  function endeKnoepfe(z) {
    const box = $("#aEndeLeiste");
    if (!box) return;
    box.innerHTML = `${GN.istHost()
      ? `<button class="btn gross voll" id="aNochmal">🔁 ${z.modus === "tag" ? "Nochmal (Übung)" : "Nochmal spielen"}</button>
         <button class="btn zweit voll" id="aLobby">🎮 ${z.modus === "tag" ? "Freies Spiel / andere Spiele" : "Anderes Spiel / Einstellungen"}</button>`
      : `<div class="warte">Der Host entscheidet, wie es weitergeht${GN.wartePunkte()}</div>`}
      <button class="btn link" id="aVerlassen">Raum verlassen</button>`;
    $("#aNochmal")?.addEventListener("click", () => GN.socket.emit("spielStarten"));
    $("#aLobby")?.addEventListener("click", () => GN.socket.emit("zurLobby"));
    $("#aVerlassen").onclick = GN.verlassen;
  }

  GN.spiele.arena = {
    icon: "🏛️",
    titel: "Arena",
    kurz: "Das Tages-Quiz: Je seltener deine Antwort, desto mehr Ruhm.",
    beschreibung: "Jeden Tag 7 neue Aufgaben für alle. Nenne Antworten, auf die sonst keiner kommt, und fülle das Kolosseum. Mit Serie, Rangliste und Statistik.",
    tags: ["☀️ Täglich neu", "🌿 Seltene Antworten", "📊 Statistik", "👥 1–10 Spieler"],
    abschnitte,
    binde,
    lobbyFertig,
    startseite,
    zeige,
  };
})();
