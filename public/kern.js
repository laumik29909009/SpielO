// =============================================================
//  Game Night – gemeinsamer Kern im Browser
//  Startseite, Lobby, Spielerliste, Podest und Hilfsfunktionen.
//  Die Spiele selbst liegen in /spiele/*.js und melden sich
//  über GN.spiele.<id> an.
// =============================================================

// ★ Hier kannst du die Seite personalisieren ★
const SEITE = {
  name: "GAME NIGHT",
  slogan: "Euer Spieleabend im Browser. Ein Link, alle sind dabei.",
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

socket.on("zustand", (z) => {
  const vorher = GN.zustand;
  GN.zustand = z;
  document.body.dataset.spiel = z.spiel;
  $("#raumChip").textContent = z.code;
  $("#raumChip").classList.remove("versteckt");
  $("#stoppSpielBtn").classList.toggle("versteckt", !(GN.istHost() && z.phase !== "lobby"));
  if (z.phase === "lobby") return zeigeLobby();
  GN.spiele[z.spiel].zeige(z, vorher);
});

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
  const karten = Object.entries(GN.spiele).map(([id, s]) => `
    <div class="spiel-vorschau" data-farbe="${id}">
      <span class="icon">${s.icon}</span>
      <div><div class="titel">${s.titel}</div><div class="text">${s.kurz}</div></div>
    </div>`).join("");

  app.innerHTML = `
    <section class="start">
      <div class="hero">
        <h1>${esc(SEITE.name).replace(" ", "<br><span class='gold'>")}</span></h1>
        <p>${esc(SEITE.slogan)}</p>
        <div class="spiel-vorschauen">${karten}
          <div class="spiel-vorschau bald"><span class="icon">✨</span><div><div class="titel">Bald mehr</div><div class="text">Weitere Spiele kommen</div></div></div>
        </div>
      </div>
      <div class="karte start-karte">
        <div>
          <label class="feld-label" for="nameInput">Dein Name</label>
          <input id="nameInput" class="feld" maxlength="16" placeholder="z. B. Alex" autocomplete="off" value="${esc(speicher("name") || "")}" />
        </div>
        ${codeAusLink ? "" : `<button id="erstellenBtn" class="btn gross voll">🎉 Neuen Raum erstellen</button><div class="trenner">ODER BEITRETEN</div>`}
        <div>
          <label class="feld-label" for="codeInput">Raum-Code</label>
          <div class="beitreten-zeile">
            <input id="codeInput" class="feld code-feld" maxlength="4" placeholder="ABCD" autocomplete="off" value="${esc(codeAusLink)}" />
            <button id="beitretenBtn" class="btn ${codeAusLink ? "" : "zweit"}">Los ➜</button>
          </div>
        </div>
        ${codeAusLink ? `<button id="andererBtn" class="btn link">Stattdessen eigenen Raum erstellen</button>` : ""}
        <p class="leise klein-text">Bis zu ${GN.meta.maxSpieler} Spieler pro Raum.</p>
      </div>
    </section>
    <p class="fuss">Bilder im Preis-Schätzer: Wikimedia Commons (Urheber &amp; Lizenz am jeweiligen Bild).</p>`;

  const name = () => { const n = $("#nameInput").value.trim(); speicher("name", n); return n; };
  $("#erstellenBtn")?.addEventListener("click", () => { Ton.entsperren(); socket.emit("raumErstellen", { name: name(), spielerId }); });
  $("#beitretenBtn").addEventListener("click", () => {
    Ton.entsperren();
    socket.emit("raumBeitreten", { code: $("#codeInput").value, name: name(), spielerId });
  });
  $("#andererBtn")?.addEventListener("click", () => { history.replaceState(null, "", "/"); zeigeStart(); });
  $("#codeInput").addEventListener("keydown", (e) => e.key === "Enter" && $("#beitretenBtn").click());
  $("#nameInput").addEventListener("keydown", (e) => e.key === "Enter" && ($("#erstellenBtn") || $("#beitretenBtn")).click());
  if (!$("#nameInput").value) $("#nameInput").focus();
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

  // Fokus in Textfeldern der Einstellungen nicht verlieren
  const fokus = document.activeElement?.id;
  const fokusWert = document.activeElement?.value;
  const scroll = scrollY;

  app.innerHTML = `
    <section class="lobby">
      <div>
        <div class="karte code-karte">
          <div class="leise">Raum-Code</div>
          <div class="code-gross">${z.code}</div>
          <button class="btn zweit" id="teilenBtn">🔗 Freunde einladen</button>
        </div>
        <div class="abschnitt-titel">Spieler (${z.spieler.length}/${GN.meta.maxSpieler})</div>
        <div class="spieler-gitter">
          ${z.spieler.map((s) => `
            <div class="spieler-kachel ${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
              ${s.id === z.hostId ? '<span class="krone" title="Host">👑</span>' : ""}
              ${s.id === spielerId
                ? `<button class="avatar" id="avatarBtn" title="Avatar wechseln">${s.avatar}</button>`
                : `<span class="avatar">${s.avatar}</span>`}
              <div class="name">${esc(s.name)}</div>
            </div>`).join("")}
        </div>
        <p class="leise klein-text" style="margin-top:10px">Tipp: Tippe auf deinen Avatar, um ihn zu wechseln.</p>
      </div>

      <div>
        <div class="abschnitt-titel" style="margin-top:0">Spiel</div>
        <div class="spiel-wahl">
          ${Object.entries(GN.spiele).map(([id, s]) => `
            <button class="spiel-karte ${z.spiel === id ? "aktiv" : ""}" data-spiel-wahl="${id}" data-farbe="${id}" ${host ? "" : "disabled"}>
              <span class="icon">${s.icon}</span>
              <span><span class="titel">${s.titel}</span><span class="text">${s.kurz}</span></span>
            </button>`).join("")}
        </div>
        <div id="spielEinstellungen"></div>
        <div class="start-leiste">
          ${host
            ? `<button class="btn gross voll" id="startBtn">▶ ${spiel.titel} starten</button>
               ${z.spieler.length < 2 ? '<div class="leise klein-text" style="text-align:center">Du kannst auch alleine testen, mit Freunden macht es aber mehr Spaß!</div>' : ""}`
            : `<div class="warte">Warte, bis der Host das Spiel startet${punkte()}</div>`}
          <button class="btn link" id="verlassenBtn">Raum verlassen</button>
        </div>
      </div>
    </section>`;

  spiel.lobby($("#spielEinstellungen"), z, host);

  $("#teilenBtn").onclick = teilen;
  $("#avatarBtn")?.addEventListener("click", () => { Ton.klick(); socket.emit("avatarWechseln"); });
  $("#verlassenBtn").onclick = verlassen;
  if (host) {
    $("#startBtn").onclick = () => { Ton.entsperren(); socket.emit("spielStarten"); };
    $$("[data-spiel-wahl]").forEach((b) => (b.onclick = () => { Ton.klick(); socket.emit("spielWaehlen", b.dataset.spielWahl); }));
  }
  if (!ersterAufbau) {
    scrollTo(0, scroll);
    if (fokus && document.getElementById(fokus)) {
      const el = document.getElementById(fokus);
      el.value = fokusWert;
      el.focus();
    }
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
  const titel = gleichstand ? "🤝 Gleichstand an der Spitze!"
    : sortiert[0]?.id === spielerId ? "🏆 Du hast gewonnen!" : `🏆 ${esc(sortiert[0]?.name || "")} gewinnt!`;

  app.innerHTML = `
    <div class="max-breite">
      <div class="sieger-titel">${titel}</div>
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

// Erste Anzeige (wird ersetzt, sobald der Server antwortet). Wartet, bis alle Spiel-Skripte geladen sind.
addEventListener("DOMContentLoaded", () => { if (!GN.zustand) zeigeStart(); });
