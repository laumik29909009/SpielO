// =============================================================
//  Preis-Schätzer – Browser-Teil (was jeder Spieler sieht)
// =============================================================
const socket = io();
const $ = (id) => document.getElementById(id);

// Jeder Browser bekommt eine feste ID, damit man nach einem Verbindungsabbruch
// (z. B. Handy kurz gesperrt) wieder als derselbe Spieler im Raum landet.
function speicher(key, wert) {
  try {
    if (wert === undefined) return localStorage.getItem(key);
    if (wert === null) localStorage.removeItem(key);
    else localStorage.setItem(key, wert);
  } catch { return null; }
}
let spielerId = speicher("spielerId");
if (!spielerId) {
  spielerId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  speicher("spielerId", spielerId);
}

let zustand = null;
let zeitInterval = null;
let letzteRunde = -1;

// ---------- Start ----------
$("nameInput").value = speicher("name") || "";
const codeAusLink = new URLSearchParams(location.search).get("raum");
if (codeAusLink) $("codeInput").value = codeAusLink.toUpperCase();

$("erstellenBtn").onclick = () => {
  const name = $("nameInput").value.trim();
  speicher("name", name);
  socket.emit("raumErstellen", { name, spielerId });
};
$("beitretenBtn").onclick = () => {
  const name = $("nameInput").value.trim();
  speicher("name", name);
  socket.emit("raumBeitreten", { code: $("codeInput").value, name, spielerId });
};
$("codeInput").addEventListener("keydown", (e) => e.key === "Enter" && $("beitretenBtn").click());

// Nach Verbindungsabbruch automatisch zurück in den Raum
socket.on("connect", () => {
  const raum = speicher("raum");
  if (raum) socket.emit("raumBeitreten", { code: raum, name: speicher("name"), spielerId });
});

socket.on("beigetreten", ({ code }) => {
  speicher("raum", code);
  history.replaceState(null, "", "?raum=" + code);
});

socket.on("fehler", (text) => {
  // Raum existiert nicht mehr (z. B. Server neu gestartet) → zurück zum Start
  if (!zustand || text.startsWith("Raum")) { speicher("raum", null); zeigeScreen("start"); }
  toast(text);
});

// ---------- Lobby ----------
$("linkBtn").onclick = async () => {
  const link = `${location.origin}/?raum=${zustand.code}`;
  try { await navigator.clipboard.writeText(link); toast("Link kopiert! Schick ihn deinen Freunden.", true); }
  catch { prompt("Kopiere diesen Link:", link); }
};
$("rundenInput").onchange = $("sekundenInput").onchange = () =>
  socket.emit("einstellungen", { runden: $("rundenInput").value, sekunden: $("sekundenInput").value });
$("startBtn").onclick = () => socket.emit("spielStarten");
$("verlassenBtn").onclick = () => {
  socket.emit("verlassen");
  speicher("raum", null);
  history.replaceState(null, "", "/");
  zustand = null;
  zeigeScreen("start");
};

// ---------- Schätzen ----------
$("tippForm").onsubmit = (e) => {
  e.preventDefault();
  const wert = $("tippInput").value.trim();
  if (!wert) return;
  socket.emit("tippAbgeben", wert);
  $("tippBestaetigt").textContent = `Dein Tipp: ${euro(parseFloat(wert.replace(",", ".")))} – du kannst ihn noch ändern.`;
  $("tippBestaetigt").classList.remove("versteckt");
};

// ---------- Auflösung ----------
$("weiterBtn").onclick = () => socket.emit("naechsteRunde");
$("nochmalBtn").onclick = () => socket.emit("spielStarten");
$("lobbyBtn").onclick = () => socket.emit("zurLobby");

// ---------- Zustand vom Server anzeigen ----------
socket.on("zustand", (z) => {
  zustand = z;
  const binHost = z.hostId === spielerId;
  $("raumAnzeige").textContent = z.code;
  $("raumAnzeige").classList.remove("versteckt");

  if (z.phase === "lobby") zeigeLobby(z, binHost);
  else if (z.phase === "schaetzen") zeigeSchaetzen(z);
  else zeigeAufloesung(z, binHost);
});

function zeigeLobby(z, binHost) {
  zeigeScreen("lobby");
  $("lobbyCode").textContent = z.code;
  $("lobbySpieler").innerHTML = z.spieler
    .map((s) => `<li class="${s.online ? "" : "offline"} ${s.id === spielerId ? "ich" : ""}">
        <span>${esc(s.name)}${s.id === spielerId ? " (du)" : ""}</span>
        <span>${s.id === z.hostId ? "👑 Host" : ""}</span></li>`)
    .join("");
  $("hostBereich").classList.toggle("versteckt", !binHost);
  $("warteHinweis").classList.toggle("versteckt", binHost);
  if (document.activeElement !== $("rundenInput")) $("rundenInput").value = z.einstellungen.runden;
  if (document.activeElement !== $("sekundenInput")) $("sekundenInput").value = z.einstellungen.sekunden;
}

function zeigeSchaetzen(z) {
  zeigeScreen("schaetzen");
  // Neue Runde → Eingabefeld leeren
  if (letzteRunde !== z.rundeNr) {
    letzteRunde = z.rundeNr;
    $("tippInput").value = "";
    $("tippBestaetigt").classList.add("versteckt");
    setTimeout(() => $("tippInput").focus(), 50);
  }
  $("rundenInfo").textContent = `Runde ${z.rundeNr} von ${z.rundenGesamt}`;
  $("pEmoji").textContent = z.produkt.emoji;
  $("pName").textContent = z.produkt.name;
  $("pInfo").textContent = z.produkt.info;
  $("tippStatus").innerHTML = z.spieler
    .filter((s) => s.online)
    .map((s) => `<li class="${s.hatGetippt ? "fertig" : ""}">${s.hatGetippt ? "✓ " : "… "}${esc(s.name)}</li>`)
    .join("");

  // Countdown-Balken
  clearInterval(zeitInterval);
  const gesamt = z.einstellungen.sekunden * 1000;
  const tick = () => {
    const rest = Math.max(0, z.endetUm - Date.now());
    $("zeitBalken").style.width = (rest / gesamt) * 100 + "%";
    $("zeitBalken").classList.toggle("knapp", rest < 5000);
    if (rest <= 0) clearInterval(zeitInterval);
  };
  tick();
  zeitInterval = setInterval(tick, 250);
}

function zeigeAufloesung(z, binHost) {
  clearInterval(zeitInterval);
  zeigeScreen("aufloesung");
  const ende = z.phase === "ende";
  $("aufloesungInfo").textContent = ende ? "🏁 Spiel vorbei!" : `Runde ${z.rundeNr} von ${z.rundenGesamt}`;
  $("aEmoji").textContent = z.produkt.emoji;
  $("aName").textContent = z.produkt.name;
  $("aPreis").textContent = euro(z.produkt.preis);

  $("ergebnisListe").innerHTML = z.ergebnisse
    .map((e) => `<li class="${e.id === spielerId ? "ich" : ""}">
        <span>${esc(e.name)} <span class="tipp">${e.tipp === null ? "– kein Tipp" : euro(e.tipp)}</span></span>
        <span class="punkte">+${e.punkte}</span></li>`)
    .join("");

  const medaillen = ["🥇", "🥈", "🥉"];
  $("standTitel").textContent = ende ? "🏆 Endstand" : "Punktestand";
  $("punkteListe").innerHTML = [...z.spieler]
    .sort((a, b) => b.punkte - a.punkte)
    .map((s, i) => `<li class="${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
        <span>${medaillen[i] || i + 1 + "."} ${esc(s.name)}</span><span>${s.punkte}</span></li>`)
    .join("");

  $("weiterBtn").classList.toggle("versteckt", !binHost || ende);
  $("endeButtons").classList.toggle("versteckt", !binHost || !ende);
  $("weiterHinweis").classList.toggle("versteckt", binHost);
}

// ---------- Helfer ----------
function zeigeScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("versteckt", s.id !== id);
  if (id === "start") $("raumAnzeige").classList.add("versteckt");
}
function euro(zahl) {
  return zahl.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
let toastTimer;
function toast(text, ok = false) {
  const t = $("toast");
  t.textContent = text;
  t.classList.toggle("ok", ok);
  t.classList.remove("versteckt");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("versteckt"), 3000);
}
