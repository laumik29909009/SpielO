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
GN.spieler = (id) => GN.zustand?.spieler.find((s) => s.id === id) || { name: "?", avatar: "👤" };

// =============================================================
//  Verbindung
// =============================================================
socket.on("meta", (m) => { GN.meta = m; if (!GN.zustand) zeigeStart(); });

// Wartungsmodus: Seite neu laden, dann erscheint die Wartungsseite
socket.on("connect_error", (err) => { if (err.message === "wartung") location.reload(); });

socket.on("connect", () => {
  const raum = speicher("raum");
  if (raum) socket.emit("raumBeitreten", { code: raum, name: speicher("name"), spielerId });
});

socket.on("beigetreten", ({ code }) => {
  speicher("raum", code);
  history.replaceState(null, "", "?raum=" + code);
});

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
function seitenWechsel() {
  app.classList.remove("seite-rein");
  void app.offsetWidth; // Animation neu starten
  app.classList.add("seite-rein");
}

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
  $("#stoppSpielBtn").classList.toggle("versteckt", !(GN.istHost() && z.phase !== "lobby"));
  if (z.phase === "lobby") return zeigeLobby();
  GN.spiele[z.spiel].zeige(z, vorher);
}

// =============================================================
//  Logo
// =============================================================
GN.logo = (klasse = "") => `
  <span class="spielo-logo ${klasse}" aria-label="${esc(SEITE.name)}">
    ${[..."Spiel"].map((b, i) => `<span class="b" style="--i:${i}">${b}</span>`).join("")}<span class="o-chip" style="--i:5"><span class="o-zeichnen"><span class="o-ring"></span></span><span class="o-punkt"></span></span>
  </span>`;

// Spiele, die noch im Aufbau sind (werden ausgegraut angezeigt)
GN.imAufbau = [
  { id: "quartett", icon: "🃏", titel: "Quartett", beschreibung: "Das Karten-Duell: Wer hat den höheren Wert? Mit eigenen Kartendecks zu Autos, Promis und mehr.", tags: ["🚧 Im Aufbau"] },
];
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

// Große Spielkarte für Startseite und Lobby
function spielKarte(id, s, { knopf = "", aktiv = false, deaktiviert = false, alsKnopf = false } = {}) {
  const tag = alsKnopf ? "button" : "div";
  return `
    <${tag} class="spiel-gross ${aktiv ? "aktiv" : ""}" data-farbe="${id}" ${alsKnopf ? `data-spiel-wahl="${id}" ${deaktiviert ? "disabled" : ""}` : ""}>
      <span class="spiel-bild"><span class="spiel-icon">${s.icon}</span>${aktiv ? '<span class="gewaehlt-marke">✓ Ausgewählt</span>' : ""}</span>
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
    </section>

    ${codeAusLink ? beitreten : ""}

    <section class="kapitel rein" style="--d:1.6s">
      <h2 class="kapitel-titel">${codeAusLink ? "Oder starte ein eigenes Spiel" : "Wähle ein Spiel"}</h2>
      <div class="spiele-gitter">
        ${Object.entries(GN.spiele).map(([id, s]) => spielKarte(id, s, {
          knopf: `<button class="btn voll" data-erstellen="${id}">▶ Raum erstellen</button>`,
        })).join("")}
        ${GN.imAufbau.map((s) => aufbauKarte(s)).join("")}
      </div>
    </section>

    ${codeAusLink ? "" : beitreten}`;

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
  $$("[data-erstellen]").forEach((b) => (b.onclick = () => {
    Ton.entsperren();
    const n = name();
    if (n) socket.emit("raumErstellen", { name: n, spielerId, spiel: b.dataset.erstellen });
  }));
  $("#beitretenBtn").onclick = () => {
    Ton.entsperren();
    const n = name();
    if (n) socket.emit("raumBeitreten", { code: $("#codeInput").value, name: n, spielerId });
  };
  $("#codeInput").addEventListener("keydown", (e) => e.key === "Enter" && $("#beitretenBtn").click());
  $("#nameInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (codeAusLink) $("#beitretenBtn").click();
    else $("#nameInput").blur();
  });
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
  const offen = (id) => speicher(`offen-${z.spiel}-${id}`) === "1";

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
            </span>`).join("")}
        </div>
      </div>
      <button class="btn zweit" id="teilenBtn">🔗 Einladen</button>
    </section>

    <section class="kapitel">
      <h2 class="kapitel-titel">${host ? "Wähle ein Spiel" : "Gewähltes Spiel"}</h2>
      <div class="spiele-gitter zwei">
        ${Object.entries(GN.spiele).map(([id, s]) => spielKarte(id, s, { aktiv: z.spiel === id, deaktiviert: !host, alsKnopf: true })).join("")}
        ${GN.imAufbau.map((s) => aufbauKarte(s, true)).join("")}
      </div>
    </section>

    <section class="kapitel">
      <h2 class="kapitel-titel">Einstellungen</h2>
      <div class="abschnitte" id="spielEinstellungen">
        ${abschnitte.map((a) => `
          <details class="abschnitt" data-abschnitt="${a.id}" ${offen(a.id) ? "open" : ""}>
            <summary>
              <span class="abschnitt-icon">${a.icon}</span>
              <span class="abschnitt-kopf"><b>${a.titel}</b><span>${a.info}</span></span>
              <span class="pfeil" aria-hidden="true">⌄</span>
            </summary>
            <div class="abschnitt-inhalt">${a.html}</div>
          </details>`).join("")}
      </div>
    </section>

    <div class="start-leiste">
      ${host
        ? `<button class="btn gross voll" id="startBtn">▶ ${spiel.titel} starten</button>
           ${z.spieler.length < 2 ? '<div class="leise klein-text" style="text-align:center">Du kannst auch alleine spielen. Mit Freunden macht es noch mehr Spaß!</div>' : ""}`
        : `<div class="warte">Warte, bis der Host das Spiel startet${punkte()}</div>`}
      <button class="btn link" id="verlassenBtn">Raum verlassen</button>
    </div>`;

  if (host) spiel.binde?.($("#spielEinstellungen"), z);
  $$(".abschnitt").forEach((d) => d.addEventListener("toggle", () => speicher(`offen-${z.spiel}-${d.dataset.abschnitt}`, d.open ? "1" : "0")));
  $("#teilenBtn").onclick = teilen;
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

async function teilen() {
  const link = `${location.origin}/?raum=${GN.zustand.code}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title: SEITE.name, text: `Spiel mit! Raum-Code: ${GN.zustand.code}`, url: link }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(link); toast("Link kopiert! Schick ihn deinen Freunden.", true); }
  catch { prompt("Kopiere diesen Link:", link); }
}
$("#raumChip").onclick = () => GN.zustand && teilen();
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
  const sortiert = [...z.spieler].sort((a, b) => b.punkte - a.punkte);
  const max = Math.max(1, ...sortiert.map((s) => s.punkte));
  box.innerHTML = sortiert.map((s, i) => `
    <div class="rang ${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
      <span class="balken" style="width:${mitAnimation ? 0 : (s.punkte / max) * 100}%" data-w="${(s.punkte / max) * 100}"></span>
      <span class="platz">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
      <span class="avatar">${s.avatar}</span>
      <span class="name">${esc(s.name)}</span>
      <span class="pkt">${s.punkte.toLocaleString("de-DE")}${rundenPunkte[s.id] ? ` <span class="plus-klein">+${rundenPunkte[s.id]}</span>` : ""}</span>
    </div>`).join("");
  if (mitAnimation) setTimeout(() => $$(".balken", box).forEach((b) => (b.style.width = b.dataset.w + "%")), 900);
};

// Siegerehrung für alle Spiele
GN.podest = (key, { einheit = "Pkt." } = {}) => {
  GN.ansicht = key;
  GN.stoppeTimer();
  const z = GN.zustand;
  const host = GN.istHost();
  const sortiert = [...z.spieler].sort((a, b) => b.punkte - a.punkte);
  const platz = (i) => sortiert[i]
    ? `<div class="podest-platz p${i + 1}"><span class="avatar">${sortiert[i].avatar}</span>
        <div class="name">${esc(sortiert[i].name)}</div><div class="pkt">${sortiert[i].punkte.toLocaleString("de-DE")} ${einheit}</div>
        <div class="podest-sockel">${i + 1}</div></div>`
    : `<div></div>`;
  const gleichstand = sortiert[1] && sortiert[0].punkte === sortiert[1].punkte;
  let rekordInfo = "";
  if (sortiert.length === 1) {
    const schluessel = `rekord-${z.spiel}`;
    const alt = Number(speicher(schluessel) || 0);
    const jetzt = sortiert[0].punkte;
    if (jetzt > alt) { speicher(schluessel, String(jetzt)); rekordInfo = alt ? `🎉 Neuer Rekord! Vorher: ${alt.toLocaleString("de-DE")}` : "🎯 Dein erster Rekord ist gesetzt!"; }
    else rekordInfo = `Dein Rekord: ${alt.toLocaleString("de-DE")} ${einheit}`;
  }
  const titel = sortiert.length === 1 ? `🏁 ${sortiert[0].punkte.toLocaleString("de-DE")} ${einheit}` : gleichstand ? "🤝 Gleichstand an der Spitze!"
    : sortiert[0]?.id === spielerId ? "🏆 Du hast gewonnen!" : `🏆 ${esc(sortiert[0]?.name || "")} gewinnt!`;

  app.innerHTML = `
    <div class="max-breite">
      <div class="sieger-titel">${titel}</div>
      ${rekordInfo ? `<div class="rekord-info">${rekordInfo}</div>` : ""}
      <div class="podest">${platz(1)}${platz(0)}${platz(2)}</div>
      <div class="abschnitt-titel">Endstand</div>
      <div class="rangliste" id="rangliste"></div>
      <div class="start-leiste">
        ${host
          ? `<button class="btn gross voll" id="nochmalBtn">🔁 Nochmal spielen</button>
             <button class="btn zweit voll" id="lobbyBtn">🎮 Anderes Spiel / Einstellungen</button>`
          : `<div class="warte">Der Host entscheidet, wie es weitergeht${punkte()}</div>`}
        <button class="btn link" id="verlassenBtn">Raum verlassen</button>
      </div>
    </div>`;
  GN.rangliste($("#rangliste"));
  $("#nochmalBtn")?.addEventListener("click", () => socket.emit("spielStarten"));
  $("#lobbyBtn")?.addEventListener("click", () => socket.emit("zurLobby"));
  $("#verlassenBtn").onclick = verlassen;
  setTimeout(() => { Ton.fanfare(); konfetti(180); }, 1300);
};

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
const SPAR = { verstecktMs: 3 * 60e3, startseiteMs: 5 * 60e3, lobbyMs: 20 * 60e3 };
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
