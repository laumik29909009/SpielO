// =============================================================
//  Game Night – gemeinsamer Kern im Browser
//  Startseite, Lobby, Spielerliste, Podest und Hilfsfunktionen.
//  Die Spiele selbst liegen in /spiele/*.js und melden sich
//  über GN.spiele.<id> an.
// =============================================================

// ★ Hier kannst du die Seite personalisieren ★
const SEITE = {
  name: "SpielO",
  slogan: "Partyspiele für dich und deine Freunde. Ein Link, alle sind dabei.",
};

const GN = (window.GN = {
  spiele: {},
  meta: { spiele: {}, maxSpieler: 10 },
  zustand: null,
  ansicht: "",
});

const socket = io({ transports: ["websocket", "polling"] });
const app = document.getElementById("app");
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
GN.$ = $;
GN.$$ = $$;
GN.app = app;
GN.socket = socket;

// ---------- Speicher (kann im privaten Modus fehlen) ----------
function speicher(key, wert) {
  try {
    if (wert === undefined) return localStorage.getItem(key);
    if (wert === null) localStorage.removeItem(key);
    else localStorage.setItem(key, wert);
  } catch { return null; }
}
GN.speicher = speicher;
let spielerId = speicher("spielerId");
if (!spielerId) {
  spielerId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  speicher("spielerId", spielerId);
}
GN.ich = spielerId;

GN.aktion = (typ, daten) => socket.emit("aktion", typ, daten);
GN.istHost = () => GN.zustand?.hostId === spielerId;
// Alle, die mitspielen: Menschen und (bei Quartett) Computer-Gegner
GN.alle = (z = GN.zustand) => [...(z?.spieler || []), ...(z?.bots || [])];
GN.spieler = (id) => GN.alle().find((s) => s.id === id) || { name: "?", avatar: "👤" };

// =============================================================
//  Verbindung
// =============================================================
socket.on("meta", (m) => {
  // Neue Version auf dem Server (z. B. nach einem Update)? Dann einmal neu laden
  if (m.version && window.SPIELO_VERSION && m.version !== window.SPIELO_VERSION) {
    try { if (sessionStorage.getItem("neuGeladen") !== m.version) { sessionStorage.setItem("neuGeladen", m.version); return location.reload(); } } catch {}
  }
  GN.meta = m;
  if (!GN.zustand) zeigeStart();
});

// "SpielO wird gestartet": erscheint, wenn der Server nach dem Schlafen erst aufwachen muss
let startHinweisTimer = setTimeout(() => { if (!socket.connected) $("#startHinweis").classList.remove("versteckt"); }, 1800);
socket.on("connect", () => { clearTimeout(startHinweisTimer); $("#startHinweis").classList.add("versteckt"); });
socket.on("disconnect", () => {
  if (pausiert) return; // Sparmodus zeigt seinen eigenen Hinweis
  clearTimeout(startHinweisTimer);
  startHinweisTimer = setTimeout(() => { if (!socket.connected && !pausiert) $("#startHinweis").classList.remove("versteckt"); }, 4000);
});

// Offline-Kopie der Seite (zeigt die Seite sofort, auch wenn der Server noch aufwacht)
if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// Wartungsmodus: Seite neu laden, dann erscheint die Wartungsseite
socket.on("connect_error", (err) => { if (err.message === "wartung") location.reload(); });

socket.on("connect", () => {
  GN.timerNeu = true; // nach (Neu-)Verbindung den Countdown neu starten
  const raum = speicher("raum");
  if (raum) socket.emit("raumBeitreten", { code: raum, name: speicher("name"), spielerId });
});

socket.on("beigetreten", ({ code }) => {
  speicher("raum", code);
  history.replaceState(null, "", "?raum=" + code);
});

// Beitritt abgelehnt (Raum weg, voll) oder vom Host entfernt: sauber zurück zur Startseite
function zurueckZumStart(text) {
  speicher("raum", null);
  GN.zustand = null;
  history.replaceState(null, "", "/");
  if ($("#raumFenster").open) $("#raumFenster").close();
  $("#afkHinweis").classList.add("versteckt");
  $("#intro").classList.add("versteckt");
  zeigeStart();
  toast(text);
}
socket.on("abgelehnt", zurueckZumStart);
socket.on("rausgeworfen", zurueckZumStart);

socket.on("fehler", (text) => {
  if (!GN.zustand) { speicher("raum", null); if (GN.ansicht !== "start") zeigeStart(); }
  toast(text);
});

// Handy: Statusleiste in der Farbe des aktuellen Spiels
function farbeStatusleiste() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const farbe = getComputedStyle(document.body).getPropertyValue("--bg").trim();
  if (meta && farbe) meta.setAttribute("content", farbe);
}
new MutationObserver(farbeStatusleiste).observe(document.body, { attributes: true, attributeFilter: ["data-spiel"] });

// Weicher Übergang, sobald eine neue Ansicht erscheint
let letzteArt = "";
// Ladebildschirm vor dem Spielstart: Spiel-Symbol, Name, ruhiger Ladebalken
let ladeEl = null, ladeSeit = 0;
socket.on("spielLaedt", ({ spiel, ms }) => {
  const s = GN.spiele[spiel] || {};
  ladeEl?.remove();
  ladeEl = document.createElement("div");
  ladeEl.className = "laden-ov";
  ladeEl.style.setProperty("--ms", ms + "ms");
  ladeEl.innerHTML = `<div class="laden-karte"><div class="laden-icon">${s.icon || "🎮"}</div><b>${esc(s.titel || "Spiel")}</b><small>wird vorbereitet …</small><div class="laden-balken"><i></i></div></div>`;
  document.body.appendChild(ladeEl);
  ladeSeit = Date.now();
  Ton.klick();
  setTimeout(ladenEnde, ms + 4000); // Sicherheitsnetz, falls der Start scheitert
});
socket.on("fehler", () => ladenEnde());
function ladenEnde() {
  if (!ladeEl) return;
  const el = ladeEl; ladeEl = null;
  setTimeout(() => { el.classList.add("weg"); setTimeout(() => el.remove(), 600); }, Math.max(0, 400 - (Date.now() - ladeSeit)));
}
function seitenWechsel() {
  // Großer Wechsel (Lobby ↔ Spiel ↔ Siegerehrung): kurzer Vorhang, sonst nur sanftes Einblenden
  const art = /podest/.test(GN.ansicht) ? "podest" : GN.ansicht === "lobby" ? "lobby" : "spiel";
  // Großer Wechsel: der Ladebildschirm blendet ruhig aus (statt Vorhang)
  if (art !== "lobby") ladenEnde();
  letzteArt = art;
  app.classList.remove("seite-rein");
  void app.offsetWidth; // Animation neu starten
  app.classList.add("seite-rein");
}

// =============================================================
//  Emoji-Reaktionen: Leiste unten links, Emojis fliegen bei allen hoch
// =============================================================
const REAKTIONEN = ["😂", "🔥", "😱", "👏", "😡", "❤️", "🤯", "🎉"];
(() => {
  const box = $("#reaktionen"), leiste = $("#reaktionLeiste"), knopf = $("#reaktionKnopf");
  leiste.innerHTML = REAKTIONEN.map((e) => `<button data-r="${e}" aria-label="${e}">${e}</button>`).join("");
  const auf = (an) => { box.classList.toggle("offen", an); knopf.setAttribute("aria-expanded", String(an)); };
  knopf.onclick = () => { Ton.klick(); auf(!box.classList.contains("offen")); };
  let sperre = 0;
  leiste.onclick = (ev) => {
    const b = ev.target.closest("[data-r]");
    if (!b || Date.now() < sperre) return;
    sperre = Date.now() + 450;
    socket.emit("reaktion", b.dataset.r);
    b.classList.remove("tipp"); void b.offsetWidth; b.classList.add("tipp");
  };
  document.addEventListener("pointerdown", (ev) => { if (!box.contains(ev.target)) auf(false); });
})();
socket.on("reaktion", ({ id, e }) => {
  if (document.documentElement.dataset.reaktionen === "aus") return;
  const flug = $("#reaktionFlug");
  if (flug.childElementCount > 24) return; // nicht zuschütten
  const p = GN.spieler(id);
  const el = document.createElement("div");
  el.className = "reaktion-teil";
  el.style.left = `${8 + Math.random() * 30}%`;
  el.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
  el.style.setProperty("--dreh", `${(Math.random() - 0.5) * 40}deg`);
  el.innerHTML = `<span class="r-emoji">${e}</span><span class="r-wer">${p.avatar || ""}</span>`;
  flug.appendChild(el);
  setTimeout(() => el.remove(), 2600);
  if (id !== spielerId) Ton.tick?.();
});

socket.on("zustand", (z) => {
  const alteAnsicht = GN.ansicht;
  verarbeiteZustand(z);
  if (GN.ansicht !== alteAnsicht) seitenWechsel();
});

function verarbeiteZustand(z) {
  const vorher = GN.zustand;
  GN.zustand = z;
  document.body.dataset.spiel = z.spiel;
  $("#raumChip").textContent = z.code;
  $("#raumChip").classList.remove("versteckt");
  $("#reaktionen").classList.remove("versteckt");
  $("#stoppSpielBtn").classList.toggle("versteckt", !(GN.istHost() && z.phase !== "lobby"));
  const ich = z.spieler.find((s) => s.id === spielerId);
  const warAfk = vorher?.spieler.find((s) => s.id === spielerId)?.afk;
  $("#afkHinweis").classList.toggle("versteckt", !(ich?.afk && z.phase !== "lobby"));
  if (ich?.afk && !warAfk && z.phase !== "lobby") navigator.vibrate?.(200);
  if ($("#raumFenster").open) zeichneRaumSpieler();
  if (z.phase === "lobby") return zeigeLobby();
  // Später eingestiegen: zuschauen, bis die nächste Runde beginnt
  if (ich?.zuschauer && z.spiel !== "quartett") return zeigeZuschauer(z); // Quartett zeigt Zuschauern die Kämpfe
  // Bin ich gerade neuer Host geworden? Dann Ansichten mit Host-Knöpfen neu aufbauen
  if (vorher && vorher.hostId !== z.hostId && z.hostId === spielerId) {
    if (/podest/.test(GN.ansicht)) return GN.podest(GN.ansicht);
    if (z.phase === "aufloesung") GN.ansicht = "";
  }
  GN.spiele[z.spiel].zeige(z, vorher);
}

// =============================================================
//  Logo
// =============================================================
GN.logo = (klasse = "") => `
  <span class="spielo-logo ${klasse}" aria-label="${esc(SEITE.name)}">
    ${[..."Spiel"].map((b, i) => `<span class="b" style="--i:${i}">${b}</span>`).join("")}<span class="o-chip" style="--i:5"><span class="o-zeichnen"><span class="o-ring"></span></span><span class="o-punkt"></span></span>
  </span>`;

// Spiele, die noch im Aufbau sind (config.json "imAufbau"): ausgegraut,
// außer im Vorschau-Raum (Link mit ?vorschau=1)
GN.imAufbau = [];
const imAufbau = (id) => (GN.meta.imAufbau || []).includes(id);
try { if (new URLSearchParams(location.search).get("vorschau") === "1") sessionStorage.setItem("vorschau", "1"); } catch {}
const vorschauModus = () => { try { return sessionStorage.getItem("vorschau") === "1"; } catch { return false; } };
function aufbauKarte(s, klein = false) {
  return `
    <div class="spiel-gross im-aufbau" aria-disabled="true">
      <span class="spiel-bild"><span class="spiel-icon">${s.icon}</span><span class="aufbau-marke">🚧 Im Aufbau</span></span>
      <span class="spiel-text">
        <span class="spiel-titel">${s.titel}</span>
        <span class="spiel-beschreibung">${s.beschreibung}</span>
        ${klein ? "" : `<button class="btn zweit voll" disabled>Bald verfügbar</button>`}
      </span>
    </div>`;
}

// Titelbilder der Spiele: Muster im Hintergrund, Lichtstrahlen, Hauptmotiv und schwebende Nebenmotive
const COVER = {
  baulowe: { muster: "raster", akzente: ["🏠", "🎲", "💶"] },
  skat: { muster: "karten", akzente: ["♠️", "♥️", "👑"] },
  ludo: { muster: "punkte", akzente: ["🎲", "🔴", "🟡"] },
  slf: { muster: "linien", akzente: ["✏️", "🏙️", "🦊"] },
  quartett: { muster: "karten", akzente: ["🐼", "🐉", "🃏"] },
  farbrausch: { muster: "punkte", akzente: ["🟥", "🟦", "🟨"] },
  schlange: { muster: "hex", akzente: ["🍏", "⚡", "✨"] },
  schechingen: { muster: "hex", akzente: ["🏡", "🌲", "🧱"] },
  wuerfel: { muster: "punkte", akzente: ["🎲", "🎯", "🦉"] },
  preis: { muster: "linien", akzente: ["💶", "🚗", "📱"] },
  duell: { muster: "raster", akzente: ["🏳️", "🗺️", "⚡"] },
  millionen: { muster: "strahlen", akzente: ["💎", "📞", "👥"] },
  schiffe: { muster: "linien", akzente: ["💥", "⚓", "🌊"] },
};
function coverHtml(id, s) {
  const c = COVER[id] || { muster: "punkte", akzente: [] };
  return `<span class="cover-muster ${c.muster}"></span><span class="cover-licht"></span>
    ${c.akzente.map((a, i) => `<span class="cover-akzent a${i}">${a}</span>`).join("")}
    <span class="cover-sockel"></span><span class="spiel-icon">${s.icon}</span>`;
}

// Große Spielkarte für Startseite und Lobby
function spielKarte(id, s, { knopf = "", aktiv = false, deaktiviert = false, alsKnopf = false } = {}) {
  const tag = alsKnopf ? "button" : "div";
  return `
    <${tag} class="spiel-gross ${aktiv ? "aktiv" : ""}" data-farbe="${id}" ${alsKnopf ? `data-spiel-wahl="${id}" ${deaktiviert ? "disabled" : ""}` : ""}>
      <span class="spiel-bild">${coverHtml(id, s)}${aktiv ? '<span class="gewaehlt-marke">✓ Ausgewählt</span>' : ""}</span>
      <span class="spiel-text">
        <span class="spiel-titel">${s.titel}</span>
        <span class="spiel-beschreibung">${s.beschreibung}</span>
        <span class="spiel-tags">${s.tags.map((t) => `<span>${t}</span>`).join("")}</span>
        ${knopf}
      </span>
    </${tag}>`;
}

// =============================================================
//  Startseite
// =============================================================
function zeigeStart() {
  GN.ansicht = "start";
  GN.stoppeTimer();
  document.body.dataset.spiel = "hub";
  $("#raumChip").classList.add("versteckt");
  $("#reaktionen").classList.add("versteckt");
  $("#stoppSpielBtn").classList.add("versteckt");
  const codeAusLink = (new URLSearchParams(location.search).get("raum") || "").toUpperCase();

  const beitreten = `
    <section class="kapitel rein ${codeAusLink ? "einladung" : ""}" style="--d:1.5s">
      <h2 class="kapitel-titel">${codeAusLink ? "🎉 Du wurdest eingeladen!" : "Hast du einen Raum-Code?"}</h2>
      <div class="beitreten-zeile">
        <input id="codeInput" class="feld code-feld" maxlength="4" placeholder="ABCD" autocomplete="off" value="${esc(codeAusLink)}" aria-label="Raum-Code" />
        <button id="beitretenBtn" class="btn ${codeAusLink ? "" : "zweit"}">Beitreten ➜</button>
      </div>
    </section>`;

  let schnell = false;
  try { schnell = sessionStorage.getItem("introGesehen") === "1"; sessionStorage.setItem("introGesehen", "1"); } catch {}
  app.innerHTML = `
    <section class="hero-start ${schnell ? "schnell" : ""}">
      <h1 class="hero-logo">${GN.logo("riesig")}</h1>
      <p class="hero-by rein" style="--d:1.15s">by <b>laumik</b></p>
      <div class="hero-fakten rein" style="--d:1.3s"><span>👥 1–${GN.meta.maxSpieler} Spieler</span><span>📱 Handy &amp; PC</span><span>⚡ Kein Download</span></div>
    </section>

    <section class="kapitel name-kapitel rein" style="--d:1.45s">
      <label class="kapitel-titel" for="nameInput">Wie heißt du?</label>
      <input id="nameInput" class="feld name-feld" maxlength="16" placeholder="Dein Name" autocomplete="off" value="${esc(speicher("name") || "")}" />
      ${codeAusLink ? "" : `<button class="btn gross voll" id="erstellenBtn">🎉 Raum erstellen</button>
      <p class="leise klein-text">Das Spiel wählst du danach in der Lobby, und du kannst jederzeit wechseln.</p>`}
    </section>

    ${beitreten}

    <div id="startExtra"></div>

    <section class="kapitel rein" style="--d:1.6s">
      <h2 class="kapitel-titel">Unsere Spiele</h2>
      <div class="spiele-gitter">
        ${nachBeliebtheit().map(([id, s], i) => imAufbau(id) ? aufbauKarte({ ...s, id }, true) : spielKarte(id, i === 0 && beliebtheit(id) > 0 ? { ...s, tags: ["🔥 Am meisten gespielt", ...s.tags] } : s)).join("")}
        ${GN.imAufbau.map((s) => aufbauKarte(s, true)).join("")}
      </div>
    </section>
    <div class="fuss-bloecke">${demnaechstBlock()}${patchBlock()}${spendenBlock()}</div>`;

  const name = () => {
    const n = $("#nameInput").value.trim();
    speicher("name", n);
    if (!n) {
      $("#nameInput").scrollIntoView({ behavior: "smooth", block: "center" });
      $("#nameInput").focus();
      $("#nameInput").classList.add("fehlt");
      setTimeout(() => $("#nameInput")?.classList.remove("fehlt"), 700);
      toast("Gib zuerst deinen Namen ein.");
    }
    return n;
  };
  $("#erstellenBtn")?.addEventListener("click", () => {
    Ton.entsperren();
    const n = name();
    if (n) socket.emit("raumErstellen", { name: n, spielerId, spiel: speicher("letztesSpiel") || "preis", vorschau: vorschauModus() });
  });
  // Spiele dürfen eigene Blöcke auf der Startseite zeigen (z. B. die Tagesarena)
  GN.raumMitSpiel = (spiel) => {
    Ton.entsperren();
    const n = name();
    if (n) socket.emit("raumErstellen", { name: n, spielerId, spiel, vorschau: vorschauModus() });
    return !!n;
  };
  for (const [id, s] of Object.entries(GN.spiele)) if (s.startseite && (!imAufbau(id) || vorschauModus())) s.startseite($("#startExtra"));
  $("#beitretenBtn").onclick = () => {
    Ton.entsperren();
    const n = name();
    if (n) socket.emit("raumBeitreten", { code: $("#codeInput").value, name: n, spielerId });
  };
  $("#codeInput").addEventListener("keydown", (e) => e.key === "Enter" && $("#beitretenBtn").click());
  $("#nameInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (codeAusLink) $("#beitretenBtn").click();
    else $("#erstellenBtn").click();
  });
  neuigkeitenZeigen();
}

// Kleiner Spenden-Block (Link und Text aus config.json → "spende")
function spendenBlock() {
  const sp = GN.meta.spende;
  if (!sp) return "";
  return `
    <div class="spende rein" style="--d:1.8s">
      <img class="spende-qr" src="/qr/spende.svg" alt="QR-Code: Spenden per PayPal" width="84" height="84" loading="lazy">
      <div class="spende-text">
        <span>${esc(sp.text)}</span>
        <a class="btn klein spende-btn" href="/spenden" target="_blank" rel="noopener">💛 Spenden per PayPal</a>
      </div>
    </div>`;
}

// Kleiner Block mit dem letzten Update (Inhalt aus config.json → "patch")
// Reihenfolge der Spiele: am meisten gespielt zuerst, Spiele im Aufbau ans Ende
const beliebtheit = (id) => GN.meta.beliebt?.[id] || 0;
function nachBeliebtheit() {
  const reihe = Object.keys(GN.spiele);
  return Object.entries(GN.spiele).sort(([a], [b]) => (imAufbau(a) - imAufbau(b)) || (beliebtheit(b) - beliebtheit(a)) || (reihe.indexOf(a) - reihe.indexOf(b)));
}

// Kasten "Demnächst" (Inhalt aus config.json → "demnaechst")
function demnaechstBlock() {
  const d = GN.meta.demnaechst;
  if (!d || !d.punkte?.length) return "";
  return `
    <div class="demnaechst rein" style="--d:1.7s">
      <div class="demnaechst-kopf"><span class="demnaechst-marke">⏳ Bald</span><b>${esc(d.titel || "Demnächst")}</b></div>
      <ul>${d.punkte.map(([icon, titel, text]) => `<li><span class="dn-icon">${icon}</span><span><b>${esc(titel)}</b>${text ? `<small>${esc(text)}</small>` : ""}</span></li>`).join("")}</ul>
    </div>`;
}

// Spieleabend: Gesamtwertung über alle Spiele des Abends
function abendTafel(z) {
  const a = z.abend;
  const ids = Object.keys(a.namen).sort((x, y) => (a.punkte[y] || 0) - (a.punkte[x] || 0));
  return `<div class="abend-tafel ${a.fertig ? "fertig" : ""}">
    <div class="abend-kopf">🎉 Spieleabend <span>${a.fertig ? "Endstand" : `nach Spiel ${a.index + 1} von ${a.spiele.length}`}</span></div>
    <div class="abend-spiele">${a.spiele.map((s, i) => `<span class="${i < a.index || (i === a.index && a.erfasst) ? "fertig" : i === a.index ? "jetzt" : ""}" title="${esc(GN.spiele[s]?.titel || s)}">${GN.spiele[s]?.icon || "🎮"}</span>`).join("")}</div>
    <ol class="abend-liste">${ids.map((id, i) => `<li class="${id === spielerId ? "ich" : ""}"><span>${((n) => n === 0 ? "👑" : n + 1)(ids.filter((o) => (a.punkte[o] || 0) > (a.punkte[id] || 0)).length)}</span>${a.namen[id].avatar} <b>${esc(id === spielerId ? "Du" : a.namen[id].name)}</b>
      <em>${a.ergebnisse.map((e) => `<i title="${esc(GN.spiele[e.spiel]?.titel || "")}">${e.ergebnis[id] ? `+${e.ergebnis[id].punkte}` : "–"}</i>`).join("")}</em><strong>${a.punkte[id] || 0}</strong></li>`).join("")}</ol>
    <small class="leise">Punkte pro Spiel: 1. Platz 10 · 2. Platz 7 · 3. Platz 5 · 4. Platz 3 · sonst 1</small>
  </div>`;
}
function abendPlaner() {
  let d = $("#abendFenster");
  if (!d) { d = document.createElement("dialog"); d.id = "abendFenster"; d.className = "fenster abend-fenster"; document.body.appendChild(d); d.addEventListener("click", (ev) => ev.target === d && d.close()); }
  const verfuegbar = nachBeliebtheit().filter(([id]) => !imAufbau(id) || GN.zustand?.vorschau);
  let auswahl = [];
  const zeichnen = () => {
    d.innerHTML = `<div class="fenster-kopf"><h2>🎉 Spieleabend planen</h2><button class="icon-btn klein" data-zu aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt">
        <p class="leise klein-text" style="margin-top:0">Tippe die Spiele in der Reihenfolge an, in der ihr sie spielen wollt (2 bis 8). Nach jedem Spiel gibt es Abendpunkte, am Ende gewinnt, wer insgesamt vorne liegt. Jedes Spiel nutzt seine aktuellen Einstellungen.</p>
        <div class="abend-wahl">${verfuegbar.map(([id, s]) => { const n = auswahl.indexOf(id); return `<button data-abend="${id}" class="${n >= 0 ? "gewaehlt" : ""}"><span>${s.icon}</span>${esc(s.titel)}${n >= 0 ? `<em>${n + 1}</em>` : ""}</button>`; }).join("")}</div>
        <div class="abend-aktionen"><button class="btn zweit klein" id="abendZufall">🎲 Zufällige 4</button><button class="btn zweit klein" id="abendLeeren" ${auswahl.length ? "" : "disabled"}>Leeren</button></div>
        <button class="btn gross voll" id="abendLos" ${auswahl.length >= 2 ? "" : "disabled"}>▶ Abend starten${auswahl.length >= 2 ? ` (${auswahl.length} Spiele)` : ""}</button>
      </div>`;
    $("[data-zu]", d).onclick = () => d.close();
    $$("[data-abend]", d).forEach((b) => (b.onclick = () => {
      Ton.klick();
      const id = b.dataset.abend, n = auswahl.indexOf(id);
      if (n >= 0) auswahl.splice(n, 1); else if (auswahl.length < 8) auswahl.push(id);
      zeichnen();
    }));
    $("#abendZufall", d).onclick = () => { Ton.klick(); auswahl = verfuegbar.map(([id]) => id).sort(() => Math.random() - 0.5).slice(0, 4); zeichnen(); };
    $("#abendLeeren", d).onclick = () => { auswahl = []; zeichnen(); };
    $("#abendLos", d).onclick = () => { Ton.abgeben(); socket.emit("abendStarten", auswahl); d.close(); };
  };
  zeichnen();
  d.showModal();
}

// Quizfrage melden: kleines Fenster mit Grund und optionalem Kommentar
GN.frageMelden = (spiel, f) => {
  let d = $("#meldeFenster");
  if (!d) { d = document.createElement("dialog"); d.id = "meldeFenster"; d.className = "fenster"; document.body.appendChild(d); d.addEventListener("click", (ev) => ev.target === d && d.close()); }
  const gruende = [["falsch", "❌ Antwort ist falsch"], ["mehrdeutig", "🤔 Mehrere Antworten passen"], ["tippfehler", "✏️ Tippfehler"], ["veraltet", "📅 Veraltet"], ["anderes", "💬 Etwas anderes"]];
  d.innerHTML = `<div class="fenster-kopf"><h2>⚑ Frage melden</h2><button class="icon-btn klein" data-zu aria-label="Schließen">✕</button></div>
    <div class="fenster-inhalt">
      <p class="melde-frage">„${esc(f.text)}“${f.richtig != null ? `<br><small>Lösung laut Spiel: <b>${esc(f.antworten[f.richtig])}</b></small>` : ""}</p>
      <div class="melde-gruende">${gruende.map(([id, t], i) => `<label><input type="radio" name="grund" value="${id}" ${i ? "" : "checked"}> ${t}</label>`).join("")}</div>
      <textarea class="feld" id="meldeText" maxlength="500" rows="3" placeholder="Was stimmt nicht? (optional)"></textarea>
      <button class="btn voll" id="meldeSenden" style="margin-top:10px">Meldung senden</button>
    </div>`;
  $("[data-zu]", d).onclick = () => d.close();
  $("#meldeSenden", d).onclick = () => {
    socket.emit("frageMelden", { spiel, id: f.id, frage: f.text, antworten: f.antworten, richtig: f.richtig != null ? f.antworten[f.richtig] : "", grund: $("input[name=grund]:checked", d).value, kommentar: $("#meldeText", d).value });
    d.close();
    toast("Danke! Die Frage wird geprüft. ⚑");
  };
  d.showModal();
};

// Einmaliges Fenster „Was ist neu?“ beim ersten Besuch nach einem Update
// (gemerkt pro Update: Datum + Titel aus config.json → "patch")
function neuigkeitenZeigen() {
  const p = GN.meta.patch;
  if (!p || !p.punkte?.length) return;
  const schluessel = `${p.datum}|${p.titel}`;
  if (speicher("neuGesehen") === schluessel) return;
  if (new URLSearchParams(location.search).get("raum")) return; // Einladung: nicht im Weg stehen
  setTimeout(() => {
    if (GN.ansicht !== "start" || $("#neuFenster")?.open) return;
    let d = $("#neuFenster");
    if (!d) { d = document.createElement("dialog"); d.id = "neuFenster"; d.className = "fenster neu-fenster"; document.body.appendChild(d); }
    d.innerHTML = `
      <div class="neu-kopf"><span class="neu-marke">🆕 Neu auf SpielO</span><h2>${esc(p.titel || "Was ist neu?")}</h2><small>${esc(p.datum || "")}</small></div>
      <div class="fenster-inhalt"><ul class="neu-liste">${p.punkte.map((x, i) => {
        const m = x.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u);
        return `<li style="--i:${i}"><span class="neu-icon">${m ? m[1] : "✨"}</span><span>${esc(m ? m[2] : x)}</span></li>`;
      }).join("")}</ul></div>
      <div class="neu-fuss"><button class="btn voll" id="neuOk">Los geht’s! 🎉</button></div>`;
    const zu = () => { speicher("neuGesehen", schluessel); d.close(); };
    $("#neuOk", d).onclick = () => { Ton.klick(); zu(); };
    d.addEventListener("click", (ev) => ev.target === d && zu());
    d.addEventListener("cancel", () => speicher("neuGesehen", schluessel));
    d.showModal();
    GN.konfetti?.(90);
  }, 1400);
}

function patchBlock() {
  const p = GN.meta.patch;
  if (!p || !p.punkte?.length) return "";
  return `
    <details class="patch-notiz rein" style="--d:1.75s">
      <summary><span class="patch-neu">🆕 Neu</span><span class="patch-titel">${esc(p.titel || "Letztes Update")}</span><span class="patch-datum">${esc(p.datum || "")}</span></summary>
      <ul>${p.punkte.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </details>`;
}

// =============================================================
//  Lobby
// =============================================================
function zeigeLobby() {
  const z = GN.zustand;
  const host = GN.istHost();
  const spiel = GN.spiele[z.spiel];
  const ersterAufbau = GN.ansicht !== "lobby";
  GN.ansicht = "lobby";
  GN.stoppeTimer();
  $("#intro").classList.add("versteckt");

  // Fokus in Textfeldern und Scroll-Position nicht verlieren
  const fokus = document.activeElement?.id;
  const fokusWert = document.activeElement?.value;
  const scroll = scrollY;
  const abschnitte = spiel.abschnitte(z, host);
  // KI-Stärke: für jedes Spiel mit Computer-Gegnern (nicht in der Tagesarena, dort gibt es keine)
  const e = z.einstellungen || {};
  if (e.bots > 0 && !(z.spiel === "arena" && e.modus === "tag")) {
    const st = e.stufe || "mittel";
    const STUFEN = { einfach: ["🐣", "Einfach", "Macht öfter Fehler"], mittel: ["🙂", "Mittel", "Spielt solide, mit kleinen Patzern"], schwer: ["😈", "Schwer", "Spielt immer den besten Zug"] };
    abschnitte.push({ id: "kistufe", wichtig: true, icon: "🧠", titel: "KI-Stärke", info: `${STUFEN[st][0]} ${STUFEN[st][1]}`,
      html: `<div class="segment">${Object.entries(STUFEN).map(([k, [icon, name]]) => `<button data-ki-stufe="${k}" class="${st === k ? "aktiv" : ""}" ${host ? "" : "disabled"}>${icon} ${name}</button>`).join("")}</div>
        <p class="leise klein-text" style="margin-top:6px">${STUFEN[st][2]}.</p>` });
  }
  const wichtig = abschnitte.filter((a) => a.wichtig);
  const extras = abschnitte.filter((a) => !a.wichtig);
  const offenesFenster = $("dialog[data-fenster][open]")?.dataset.fenster; // bleibt nach Änderungen offen
  if (z.spiel !== speicher("letztesSpiel") && host) speicher("letztesSpiel", z.spiel);

  app.innerHTML = `
    <section class="raum-kopf karte">
      <div class="raum-code-block">
        <span class="leise klein-text">Raum-Code</span>
        <span class="code-gross">${z.code}</span>
      </div>
      <div class="raum-spieler">
        <span class="leise klein-text">Spieler ${z.spieler.length}/${GN.meta.maxSpieler} · tippe auf deinen Avatar, um ihn zu wechseln</span>
        <div class="spieler-reihe">
          ${z.spieler.map((s) => `
            <span class="spieler-chip ${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
              ${s.id === spielerId
                ? `<button class="avatar" id="avatarBtn" title="Avatar wechseln">${s.avatar}</button>`
                : `<span class="avatar">${s.avatar}</span>`}
              <span class="name">${esc(s.name)}${s.id === z.hostId ? " 👑" : ""}</span>
              ${host && s.id !== spielerId ? `<button class="chip-weg" data-weg="${esc(s.id)}" title="${esc(s.name)} entfernen" aria-label="${esc(s.name)} entfernen">✕</button>` : ""}
            </span>`).join("")}
        </div>
      </div>
      <button class="btn zweit" id="teilenBtn">📱 Einladen</button>
    </section>

    <section class="kapitel">
      <h2 class="kapitel-titel">${host ? "Wähle ein Spiel" : "Gewähltes Spiel"}</h2>
      <div class="spiele-gitter zwei">
        ${nachBeliebtheit().map(([id, s]) => imAufbau(id) && !z.vorschau
          ? aufbauKarte({ ...s, id }, true)
          : spielKarte(id, imAufbau(id) ? { ...s, tags: ["🚧 Vorschau", ...s.tags] } : s, { aktiv: z.spiel === id, deaktiviert: !host, alsKnopf: true })).join("")}
        ${GN.imAufbau.map((s) => aufbauKarte(s, true)).join("")}
      </div>
    </section>

    ${host ? `<section class="kapitel abend-karte">
      <div><b>🎉 Spieleabend</b><small>Mehrere Spiele hintereinander mit Gesamtwertung – wer gewinnt den Abend?</small></div>
      <button class="btn" id="abendBtn">Abend planen</button>
    </section>` : ""}

    <section class="kapitel" id="spielEinstellungen">
      <div class="einstellungen-kopf">
        <h2 class="kapitel-titel">Einstellungen</h2>
        <div class="extra-knoepfe">
          ${extras.map((a) => `<button class="extra-knopf" data-oeffne="${a.id}" title="${esc(a.info.replace(/<[^>]*>/g, ""))}">${a.icon} ${a.titel}</button>`).join("")}
        </div>
      </div>
      <div class="einstellungs-bloecke">
        ${wichtig.map((a) => `
          <div class="einstellung-block" data-block="${a.id}">
            <div class="block-kopf"><span class="block-icon">${a.icon}</span><b>${a.titel}</b><span class="block-info">${a.info}</span></div>
            ${a.html}
          </div>`).join("")}
      </div>
      ${extras.map((a) => `
        <dialog class="fenster" data-fenster="${a.id}" aria-label="${esc(a.titel)}">
          <div class="fenster-kopf"><b>${a.icon} ${a.titel}</b><button class="icon-btn" data-schliessen aria-label="Schließen">✕</button></div>
          <div class="fenster-inhalt">${a.html}</div>
        </dialog>`).join("")}
    </section>

    <div class="start-leiste">
      ${host
        ? `<button class="btn gross voll" id="startBtn">▶ ${spiel.titel} starten</button>
           ${z.spieler.length < 2 ? '<div class="leise klein-text" style="text-align:center">Du kannst auch alleine spielen. Mit Freunden macht es noch mehr Spaß!</div>' : ""}`
        : `<div class="warte">Warte, bis der Host das Spiel startet${punkte()}</div>`}
      <button class="btn link" id="verlassenBtn">Raum verlassen</button>
    </div>`;

  if (host) spiel.binde?.($("#spielEinstellungen"), z);
  $("#abendBtn")?.addEventListener("click", () => { Ton.klick(); abendPlaner(); });
  if (host) for (const b of document.querySelectorAll("[data-ki-stufe]")) b.onclick = () => GN.einstellungen({ stufe: b.dataset.kiStufe });
  spiel.lobbyFertig?.(z, host);
  // Fenster für Regeln & Punkte
  $$("[data-oeffne]").forEach((b) => (b.onclick = () => { Ton.klick(); $(`dialog[data-fenster="${b.dataset.oeffne}"]`).showModal(); }));
  $$("dialog.fenster[data-fenster]").forEach((d) => {
    d.querySelector("[data-schliessen]").onclick = () => d.close();
    d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); }); // Klick neben das Fenster schließt
  });
  if (offenesFenster) $(`dialog[data-fenster="${offenesFenster}"]`)?.classList.add("ohne-animation");
  if (offenesFenster) $(`dialog[data-fenster="${offenesFenster}"]`)?.showModal();
  $("#teilenBtn").onclick = () => { Ton.klick(); oeffneRaumFenster(); };
  $$("[data-weg]").forEach((b) => (b.onclick = () => rauswerfen(b.dataset.weg)));
  $("#avatarBtn")?.addEventListener("click", () => { Ton.klick(); socket.emit("avatarWechseln"); });
  $("#verlassenBtn").onclick = verlassen;
  if (host) {
    $("#startBtn").onclick = () => { Ton.entsperren(); socket.emit("spielStarten"); };
    $$("[data-spiel-wahl]").forEach((b) => (b.onclick = () => { Ton.klick(); socket.emit("spielWaehlen", b.dataset.spielWahl); }));
  }
  if (!ersterAufbau) {
    scrollTo(0, scroll);
    const el = fokus && document.getElementById(fokus);
    if (el) { el.value = fokusWert; el.focus(); }
  }
}

GN.einstellungen = (e) => { Ton.klick(); socket.emit("einstellungen", e); };

// Eule (Tipps) an/aus: entscheidet jeder Spieler für sich, gespeichert auf dem Gerät
GN.euleAn = () => speicher("eule") !== "aus";
GN.euleKnopf = () => `<button class="eule-schalter ${GN.euleAn() ? "an" : ""}" data-eule-schalter title="Die Eule gibt dir Tipps. Nur du siehst sie.">🦉 ${GN.euleAn() ? "Eule an" : "Eule aus"}</button>`;
document.addEventListener("click", (ev) => {
  if (!ev.target.closest("[data-eule-schalter]")) return;
  speicher("eule", GN.euleAn() ? "aus" : "an");
  Ton.klick();
  $$("[data-eule-schalter]").forEach((b) => { b.classList.toggle("an", GN.euleAn()); b.textContent = `🦉 ${GN.euleAn() ? "Eule an" : "Eule aus"}`; });
  GN.euleNeu?.();
});

const einladungsLink = () => `${location.origin}/?raum=${GN.zustand.code}`;
async function kopieren() {
  try { await navigator.clipboard.writeText(einladungsLink()); toast("Link kopiert! Schick ihn deinen Freunden.", true); }
  catch { prompt("Kopiere diesen Link:", einladungsLink()); }
}
async function teilen() {
  try { await navigator.share({ title: SEITE.name, text: `Spiel mit! Raum-Code: ${GN.zustand.code}`, url: einladungsLink() }); }
  catch (e) { if (e?.name !== "AbortError") kopieren(); }
}

// ---------- Raum-Fenster: QR-Code, Link und Spielerliste ----------
function oeffneRaumFenster() {
  const z = GN.zustand;
  if (!z) return;
  const f = $("#raumFenster");
  f.innerHTML = `
    <div class="fenster-kopf"><b>📱 Freunde einladen</b><button class="icon-btn" data-schliessen aria-label="Schließen">✕</button></div>
    <div class="fenster-inhalt">
      <div class="einladen">
        <div class="qr-rahmen"><img class="qr" src="/qr/${z.code}.svg" alt="QR-Code zum Beitreten von Raum ${z.code}" width="200" height="200"></div>
        <div class="einladen-text">
          <span class="leise klein-text">Mit der Handy-Kamera scannen oder diesen Code eingeben</span>
          <span class="code-gross">${z.code}</span>
          <div class="link-zeile">
            <input class="feld" readonly value="${esc(einladungsLink())}" aria-label="Einladungslink" />
            <button class="btn" id="linkKopieren">📋 Kopieren</button>
          </div>
          ${navigator.share ? '<button class="btn zweit voll" id="linkTeilen">📤 Teilen …</button>' : ""}
        </div>
      </div>
      <div class="abschnitt-titel" id="raumSpielerTitel"></div>
      <div class="raum-spieler-liste" id="raumSpieler"></div>
    </div>`;
  $("[data-schliessen]", f).onclick = () => f.close();
  f.onclick = (ev) => { if (ev.target === f) f.close(); };
  $("#linkKopieren").onclick = kopieren;
  $("#linkTeilen")?.addEventListener("click", teilen);
  $(".link-zeile input", f).onfocus = (ev) => ev.target.select();
  zeichneRaumSpieler();
  if (!f.open) f.showModal();
}

function zeichneRaumSpieler() {
  const z = GN.zustand;
  const box = $("#raumSpieler");
  if (!z || !box) return;
  const host = GN.istHost();
  $("#raumSpielerTitel").textContent = `Spieler ${z.spieler.length}/${GN.meta.maxSpieler}`;
  box.innerHTML = z.spieler.map((s) => {
    const marken = [
      s.id === z.hostId ? '<span class="marke gold">👑 Host</span>' : "",
      s.id === spielerId ? '<span class="marke">Du</span>' : "",
      !s.online ? '<span class="marke grau">📴 getrennt</span>' : "",
      s.afk ? '<span class="marke grau">💤 abwesend</span>' : "",
      s.zuschauer ? '<span class="marke">👀 steigt gleich ein</span>' : "",
    ].join("");
    return `<div class="raum-spieler-zeile ${s.online ? "" : "offline"}">
      <span class="avatar">${s.avatar}</span>
      <span class="name">${esc(s.name)}</span>
      <span class="marken">${marken}</span>
      ${host && s.id !== spielerId ? `<button class="btn zweit klein" data-weg="${esc(s.id)}">Entfernen</button>` : ""}
    </div>`;
  }).join("");
  $$("[data-weg]", box).forEach((b) => (b.onclick = () => rauswerfen(b.dataset.weg)));
  if (host && z.spieler.length > 1) box.insertAdjacentHTML("beforeend", '<p class="leise klein-text">Entfernte Spieler können 5 Minuten lang nicht zurück in den Raum.</p>');
}

function rauswerfen(id) {
  const s = GN.spieler(id);
  if (!confirm(`${s.name} aus dem Raum entfernen?`)) return;
  socket.emit("rauswerfen", id);
  toast(`${s.name} wurde entfernt.`);
}

$("#raumChip").onclick = () => { if (GN.zustand) { Ton.klick(); oeffneRaumFenster(); } };
$("#afkBtn").onclick = () => { Ton.klick(); GN.aktion("da"); $("#afkHinweis").classList.add("versteckt"); };

// ---------- Zuschauen (später eingestiegen) ----------
function zeigeZuschauer(z) {
  const ende = /ende/.test(z.phase);
  const nr = z.rundeNr || z.runde?.nr || 0;
  const gesamt = z.rundenGesamt || z.einstellungen?.runden || 0;
  const key = "zuschauer";
  if (GN.ansicht === key) {
    $("#zuschauerInfo").textContent = ende ? "Die Partie ist gerade vorbei." : `Gerade läuft Runde ${nr} von ${gesamt}.`;
    return GN.rangliste($("#rangliste"));
  }
  GN.ansicht = key;
  GN.stoppeTimer();
  $("#intro").classList.add("versteckt");
  app.innerHTML = `
    <div class="max-breite zuschauer">
      <div class="karte zuschauer-karte">
        <div class="zuschauer-icon">👀</div>
        <h2>Du bist gleich dabei!</h2>
        <p>${ende ? "Sobald der Host die nächste Partie startet, spielst du mit." : "Das Spiel läuft schon. <b>Ab der nächsten Runde</b> spielst du mit."}</p>
        <div class="leise" id="zuschauerInfo">${ende ? "Die Partie ist gerade vorbei." : `Gerade läuft Runde ${nr} von ${gesamt}.`}</div>
        <div class="warte">Gleich geht's los${punkte()}</div>
      </div>
      <div class="abschnitt-titel">Punktestand</div>
      <div class="rangliste" id="rangliste"></div>
      <div class="start-leiste"><button class="btn link" id="verlassenBtn">Raum verlassen</button></div>
    </div>`;
  GN.rangliste($("#rangliste"));
  $("#verlassenBtn").onclick = verlassen;
}
$("#tonBtn").onclick = () => { $("#tonBtn").textContent = Ton.umschalten() ? "🔊" : "🔇"; };
$("#tonBtn").textContent = Ton.an ? "🔊" : "🔇";
$("#stoppSpielBtn").onclick = () => {
  if (confirm("Spiel abbrechen und zurück zur Lobby?")) socket.emit("zurLobby");
};
document.addEventListener("pointerdown", () => Ton.entsperren(), { once: true });

function verlassen() {
  socket.emit("verlassen");
  speicher("raum", null);
  history.replaceState(null, "", "/");
  GN.zustand = null;
  zeigeStart();
}
GN.verlassen = verlassen;

// =============================================================
//  Gemeinsame Bausteine
// =============================================================
function punkte() {
  return '<span class="punkte"><span>.</span><span>.</span><span>.</span></span>';
}
GN.wartePunkte = punkte;

// Countdown-Leiste: erwartet #timer, #timerBalken, #timerZahl im DOM
let timerInterval = null;
GN.starteTimer = (restMs, gesamtMs, { tickAb = 5000, tonAus = () => false } = {}) => {
  GN.stoppeTimer();
  const ende = Date.now() + restMs;
  let letzteSek = null;
  const tick = () => {
    const rest = Math.max(0, ende - Date.now());
    const balken = $("#timerBalken");
    if (!balken) return GN.stoppeTimer();
    balken.style.transform = `scaleX(${Math.min(1, rest / gesamtMs)})`;
    const sek = Math.ceil(Math.min(rest, gesamtMs) / 1000);
    const knapp = rest <= tickAb;
    $("#timer").classList.toggle("knapp", knapp);
    const zahl = $("#timerZahl");
    if (zahl) {
      zahl.textContent = sek;
      zahl.classList.toggle("knapp", knapp && rest > 0);
    }
    if (knapp && sek !== letzteSek && sek > 0 && !tonAus()) Ton.tick();
    letzteSek = sek;
    if (rest <= 0) GN.stoppeTimer();
  };
  tick();
  timerInterval = setInterval(tick, 200);
};
GN.stoppeTimer = () => { clearInterval(timerInterval); timerInterval = null; };
// Ohne Zeitlimit: Balken bleibt voll, statt Sekunden steht ∞
GN.ohneZeitlimit = () => {
  GN.stoppeTimer();
  $("#timer")?.classList.add("unendlich");
  const zahl = $("#timerZahl");
  if (zahl) { zahl.textContent = "∞"; zahl.title = "Ohne Zeitlimit"; }
};

GN.intro = ({ oben, icon, titel, text, dauer = 1700, ton = true }) => {
  const intro = $("#intro");
  intro.innerHTML = `<div>
    ${oben ? `<div class="nr">${oben}</div>` : ""}
    <div class="icon">${icon}</div>
    <div class="titel">${titel}</div>
    ${text ? `<div class="text">${text}</div>` : ""}</div>`;
  intro.classList.remove("versteckt");
  if (ton) Ton.rundeStart();
  clearTimeout(GN.intro.t);
  GN.intro.t = setTimeout(() => intro.classList.add("versteckt"), dauer);
};

// Rangliste: rundenPunkte = { spielerId: +Punkte dieser Runde }
GN.rangliste = (box, rundenPunkte = {}, mitAnimation = false) => {
  if (!box) return;
  const z = GN.zustand;
  const sortiert = GN.alle(z).filter((s) => !s.zuschauer && (z.spiel !== "quartett" || !z.teilnehmer || z.teilnehmer.some((t) => t.id === s.id))).sort((a, b) => b.punkte - a.punkte);
  const max = Math.max(1, ...sortiert.map((s) => s.punkte));
  box.innerHTML = sortiert.map((s, i) => `
    <div class="rang ${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
      <span class="balken" style="width:${mitAnimation ? 0 : (s.punkte / max) * 100}%" data-w="${(s.punkte / max) * 100}"></span>
      <span class="platz">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
      <span class="avatar">${s.avatar}</span>
      <span class="name">${esc(s.name)}${s.afk ? ' <span title="abwesend">💤</span>' : ""}</span>
      <span class="pkt">${s.punkte.toLocaleString("de-DE")}${rundenPunkte[s.id] ? ` <span class="plus-klein">+${rundenPunkte[s.id]}</span>` : ""}</span>
    </div>`).join("");
  if (mitAnimation) setTimeout(() => $$(".balken", box).forEach((b) => (b.style.width = b.dataset.w + "%")), 900);
};

// =============================================================
//  Siegerehrung für alle Spiele
//  Ablauf: Trommelwirbel → Säulen wachsen (3., 2., 1.) und Punkte zählen hoch
//  → Sieger wird enthüllt (Fanfare, Konfetti) → Auszeichnungen erscheinen nacheinander
// =============================================================
GN.podest = (key, { einheit = "Pkt." } = {}) => {
  const schonGesehen = GN.podest.zuletzt === key; // z. B. nach Host-Wechsel: ohne erneute Show
  GN.podest.zuletzt = key;
  GN.ansicht = key;
  GN.stoppeTimer();
  clearTimeout(GN.podest.t);
  (GN.podest.timer || []).forEach(clearTimeout);
  GN.podest.timer = [];
  const spaeter = (ms, fn) => GN.podest.timer.push(setTimeout(() => GN.ansicht === key && fn(), schonGesehen ? 0 : ms));
  const z = GN.zustand;
  const host = GN.istHost();
  const sortiert = GN.alle(z).filter((s) => !s.zuschauer && (z.spiel !== "quartett" || !z.teilnehmer || z.teilnehmer.some((t) => t.id === s.id))).sort((a, b) => b.punkte - a.punkte);
  const solo = sortiert.length === 1;
  if (!schonGesehen) try { GN.profilErfassen?.(z, sortiert, key); } catch (e) { console.warn("Profil:", e); }
  const fmt = (n) => Math.round(n).toLocaleString("de-DE");
  // Plätze wie beim Sport: Gleichstand = gleicher Platz
  const platzNr = sortiert.map((s, i) => (i > 0 && s.punkte === sortiert[i - 1].punkte ? null : i + 1));
  platzNr.forEach((p, i) => { if (p === null) platzNr[i] = platzNr[i - 1]; });

  const saeule = (i) => {
    const s = sortiert[i];
    if (!s) return `<div class="podest-platz leer"></div>`;
    return `<div class="podest-platz p${i + 1}" data-platz="${i}">
      <div class="podest-oben">
        ${i === 0 && !solo && !gleichstand ? '<span class="krone" aria-hidden="true">👑</span>' : ""}
        <span class="avatar">${s.avatar}</span>
        <div class="name">${esc(s.name)}</div>
        <div class="pkt"><span class="zaehler" data-ziel="${s.punkte}">0</span> ${einheit}</div>
      </div>
      <div class="podest-sockel"><span>${platzNr[i]}</span></div>
    </div>`;
  };

  let rekordInfo = "";
  if (solo) {
    const schluessel = `rekord-${z.spiel}`;
    const alt = Number(speicher(schluessel) || 0);
    const jetzt = sortiert[0].punkte;
    if (!schonGesehen && jetzt > alt) speicher(schluessel, String(jetzt));
    const neuerRekord = jetzt > alt || (schonGesehen && jetzt === alt && jetzt > 0);
    rekordInfo = neuerRekord ? (alt && jetzt > alt ? `🎉 Neuer Rekord! Vorher: ${fmt(alt)}` : "🎯 Neuer Rekord!") : `Dein Rekord: ${fmt(alt)} ${einheit}`;
  }
  const gleichstand = sortiert[1] && sortiert[0].punkte === sortiert[1].punkte;
  const titel = solo ? `🏁 ${fmt(sortiert[0].punkte)} ${einheit}` : gleichstand ? "🤝 Gleichstand an der Spitze!"
    : sortiert[0]?.id === spielerId ? "🏆 Du hast gewonnen!" : `🏆 ${esc(sortiert[0]?.name || "")} gewinnt!`;

  const auszeichnungen = (z.auszeichnungen || z.runde?.auszeichnungen || []).filter((a) => a.spieler.some((id) => GN.alle(z).some((s) => s.id === id)));
  const wer = (ids) => ids.map((id) => { const s = GN.spieler(id); return `<span class="az-person ${id === spielerId ? "ich" : ""}">${s.avatar} ${esc(s.name)}</span>`; }).join(ids.length === 2 ? " &amp; " : " ");

  app.innerHTML = `
    <div class="max-breite siegerehrung ${schonGesehen ? "schnell" : ""}">
      <div class="sieger-titel" id="siegerTitel">${schonGesehen ? titel : solo ? "Dein Ergebnis …" : "Und der Sieg geht an …"}</div>
      ${rekordInfo ? `<div class="rekord-info" id="rekordInfo">${rekordInfo}</div>` : ""}
      <div class="podest ${solo ? "solo" : ""}">${solo ? saeule(0) : saeule(1) + saeule(0) + saeule(2)}</div>
      ${auszeichnungen.length ? `
        <div class="abschnitt-titel">${solo ? "🏅 Deine Bilanz" : "🏅 Auszeichnungen"}</div>
        <div class="auszeichnungen">
          ${auszeichnungen.map((a, i) => `
            <div class="auszeichnung ${a.spieler.includes(spielerId) ? "meine" : ""}" style="--i:${i}">
              <span class="az-icon">${a.icon}</span>
              <div class="az-text">
                <div class="az-titel">${esc(a.titel)}</div>
                ${solo ? "" : `<div class="az-wer">${wer(a.spieler)}</div>`}
                <div class="az-info">${esc(a.text)}</div>
              </div>
            </div>`).join("")}
        </div>` : ""}
      ${z.abend ? abendTafel(z) : ""}
      <div class="abschnitt-titel">${z.abend ? "Endstand dieses Spiels" : "Endstand"}</div>
      <div class="rangliste" id="rangliste"></div>
      <div class="start-leiste">
        ${z.abend
          ? host
            ? z.abend.fertig
              ? `<button class="btn gross voll" id="abendEndeBtn">🏆 Abend beenden</button>`
              : `<button class="btn gross voll" id="abendWeiterBtn">▶ Weiter: ${GN.spiele[z.abend.spiele[z.abend.index + 1]]?.icon || ""} ${esc(GN.spiele[z.abend.spiele[z.abend.index + 1]]?.titel || "")} (${z.abend.index + 2}/${z.abend.spiele.length})</button>
                 <button class="btn zweit voll" id="abendEndeBtn">Abend abbrechen</button>`
            : `<div class="warte">${z.abend.fertig ? "Der Spieleabend ist vorbei!" : "Gleich geht’s weiter mit dem nächsten Spiel"}${punkte()}</div>`
          : host
            ? `<button class="btn gross voll" id="nochmalBtn">🔁 Nochmal spielen</button>
               <button class="btn zweit voll" id="lobbyBtn">🎮 Anderes Spiel / Einstellungen</button>`
            : `<div class="warte">Der Host entscheidet, wie es weitergeht${punkte()}</div>`}
        <button class="btn link" id="verlassenBtn">Raum verlassen</button>
      </div>
    </div>`;
  GN.rangliste($("#rangliste"));
  $("#nochmalBtn")?.addEventListener("click", () => socket.emit("spielStarten"));
  $("#abendWeiterBtn")?.addEventListener("click", () => { Ton.klick(); socket.emit("abendWeiter"); });
  $("#abendEndeBtn")?.addEventListener("click", () => { Ton.klick(); socket.emit("abendBeenden"); });
  if (z.abend?.fertig && !schonGesehen) setTimeout(() => { Ton.fanfare(); GN.konfetti(220); }, 2600);
  $("#lobbyBtn")?.addEventListener("click", () => socket.emit("zurLobby"));
  $("#verlassenBtn").onclick = verlassen;

  // Säulen wachsen nacheinander: 3. → 2. → 1.
  const reihenfolge = [2, 1, 0].filter((i) => sortiert[i]);
  const zeiten = solo ? [400] : [400, 1200, 2100];
  if (!schonGesehen) Ton.trommel(solo ? 1.2 : 2.6);
  reihenfolge.forEach((i, n) => spaeter(zeiten[n], () => {
    const el = $(`.podest-platz[data-platz="${i}"]`);
    if (!el) return;
    el.classList.add("steigt");
    if (!schonGesehen) Ton.aufsteigen(0.6, 1 + (2 - i) * 0.25);
    hochzaehlen($(".zaehler", el), schonGesehen ? 0 : 900);
  }));
  const enthuellung = solo ? 1500 : 3000;
  spaeter(enthuellung, () => {
    $("#siegerTitel").innerHTML = titel;
    $("#siegerTitel").classList.add("enthuellt");
    $(".podest-platz.p1")?.classList.add("sieger");
    if (schonGesehen) return;
    Ton.fanfare();
    konfetti(solo ? 120 : 200);
  });
  $$(".auszeichnung").forEach((el, i) => spaeter(enthuellung + 900 + i * 650, () => {
    el.classList.add("sichtbar");
    if (!schonGesehen) Ton.auszeichnung(i);
    if (!schonGesehen && el.classList.contains("meine")) navigator.vibrate?.(40);
  }));
};

// Zahl zählt weich hoch (für Podest-Punkte)
function hochzaehlen(el, dauer) {
  if (!el) return;
  const ziel = Number(el.dataset.ziel) || 0;
  if (!dauer) { el.textContent = ziel.toLocaleString("de-DE"); return; }
  const start = performance.now();
  const schritt = (jetzt) => {
    const t = Math.min(1, (jetzt - start) / dauer);
    el.textContent = Math.round(ziel * (1 - Math.pow(1 - t, 3))).toLocaleString("de-DE");
    if (t < 1 && el.isConnected) requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}

// ---------- Kleine Helfer ----------
function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
GN.esc = esc;

let toastTimer;
function toast(text, ok = false) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.toggle("ok", ok);
  t.classList.remove("versteckt");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("versteckt"), 3200);
}
GN.toast = toast;

// Konfetti: läuft nur kurz, danach wird nichts mehr gezeichnet
function konfetti(anzahl = 150) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("#konfetti");
  const ctx = c.getContext("2d");
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const farben = getComputedStyle(document.body).getPropertyValue("--konfetti").split(",").map((f) => f.trim()).filter(Boolean);
  const teile = Array.from({ length: anzahl }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    f: farben[(Math.random() * farben.length) | 0] || "#ffcb47",
  }));
  const start = performance.now();
  const frame = (jetzt) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const t of teile) {
      t.vy += 0.35; t.vx *= 0.99; t.x += t.vx; t.y += t.vy; t.r += t.vr;
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.r);
      ctx.fillStyle = t.f; ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h * Math.abs(Math.cos(t.r * 2)));
      ctx.restore();
    }
    if (jetzt - start < 3800) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}
GN.konfetti = konfetti;

// =============================================================
//  Sparmodus: spart Server-Stunden (Render Free schläft ohne Verbindungen)
//  - Tab im Hintergrund > 3 Min.   → Verbindung trennen
//  - Startseite ohne Aktivität 5 Min. → trennen
//  - Lobby / Endstand ohne Aktivität 20 Min. → trennen
//  Ein Tipp (oder Zurückkehren in den Tab) verbindet sofort wieder.
// =============================================================
// Render schläft 15 Min. nach der letzten Verbindung. Je früher alle trennen, desto eher schläft er.
const SPAR = { verstecktMs: 2 * 60e3, startseiteMs: 2 * 60e3, lobbyMs: 10 * 60e3 };
let letzteAktivitaet = Date.now();
let verstecktSeit = null;
let pausiert = false;

function schlafen() {
  pausiert = true;
  socket.disconnect();
  GN.stoppeTimer();
  $("#sparmodus").classList.remove("versteckt");
}
function aufwachen() {
  pausiert = false;
  letzteAktivitaet = Date.now();
  $("#sparmodus").classList.add("versteckt");
  if (!socket.connected) socket.connect(); // meldet sich automatisch wieder im Raum an
}
const aktiv = () => { letzteAktivitaet = Date.now(); if (pausiert && !document.hidden) aufwachen(); };
for (const ereignis of ["pointerdown", "keydown", "touchstart", "wheel"]) addEventListener(ereignis, aktiv, { passive: true });
$("#sparmodus").addEventListener("click", aufwachen);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) verstecktSeit = Date.now();
  else { verstecktSeit = null; aktiv(); }
});
setInterval(() => {
  if (pausiert || !socket.connected) return;
  const jetzt = Date.now();
  const phase = GN.zustand?.phase;
  const grenze = !GN.zustand ? SPAR.startseiteMs : phase === "lobby" || phase === "ende" ? SPAR.lobbyMs : null;
  if ((verstecktSeit && jetzt - verstecktSeit > SPAR.verstecktMs) || (grenze && jetzt - letzteAktivitaet > grenze)) schlafen();
}, 15000);

// Erste Anzeige (wird ersetzt, sobald der Server antwortet). Wartet, bis alle Spiel-Skripte geladen sind.
addEventListener("DOMContentLoaded", () => { if (!GN.zustand) zeigeStart(); });
