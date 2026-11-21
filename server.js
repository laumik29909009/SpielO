// =============================================================
//  Game Night – Server-Kern
//  Verwaltet Räume, Spieler und Host. Die eigentlichen Spiele
//  liegen als Module in ./spiele/ und werden hier nur aufgerufen.
//  Bewusst sparsam gebaut (Render Free, 0,1 CPU): Nachrichten
//  werden nur bei echten Änderungen verschickt.
// =============================================================
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const SPIELE = {
  preis: require("./spiele/preis"),
  slf: require("./spiele/slf"),
};
const MAX_SPIELER = 10;
const AVATARE = ["🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐵", "🐯", "🐨", "🦖", "🐧", "🦉", "🐝", "🐳", "🦩", "🐲"];

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 25000, pingTimeout: 20000 });
// Wartungsmodus: in config.json "wartung": true setzen → alle sehen nur die Wartungsseite
// Was auf der Wartungsseite steht, kommt aus config.json ("wartungInfo")
const { wartung: WARTUNG, wartungInfo: INFO = {} } = require("./config.json");
if (WARTUNG) {
  const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const seite = require("fs").readFileSync(path.join(__dirname, "wartung.html"), "utf8")
    .replace("<!--PUNKTE-->", (INFO.punkte || []).map((p) => `        <li>${escHtml(p)}</li>`).join("\n"))
    .replace("<!--ZAHLEN-->", INFO.zahlen?.length
      ? `<div class="zahlen">${INFO.zahlen.map((z) => `<div class="zahl"><b>${escHtml(z.wert)}</b><span>${escHtml(z.text)}</span></div>`).join("")}</div>`
      : "");
  app.use((req, res) => res.status(503).set({ "Retry-After": "600", "Cache-Control": "no-store" }).type("html").send(seite));
  io.use((_socket, next) => next(new Error("wartung")));
}

// Jede neue Version bekommt eine eigene Kennung. Sie wird an alle CSS-/JS-Dateien
// gehängt, damit Browser nach einem Update nie alte Dateien mit der neuen Seite mischen.
const VERSION = (process.env.RENDER_GIT_COMMIT || Date.now().toString(36)).slice(0, 10);
const fs = require("fs");
const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8")
  .replace(/(href|src)="(?!https?:|\/socket\.io)([^"]+\.(?:css|js))"/g, `$1="$2?v=${VERSION}"`);
app.get(["/", "/index.html"], (_req, res) => res.set("Cache-Control", "no-cache").type("html").send(INDEX));

// Hintergrundmusik: jeder Unterordner von public/musik ist eine Musikrichtung (z. B. "jazz").
// Neue Lieder einfach in den Ordner legen, sie erscheinen nach dem nächsten Start automatisch.
const MUSIK_ORDNER = path.join(__dirname, "public", "musik");
const AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac)$/i;
const SYMBOLE = { jazz: "🎷", lofi: "🎧", chill: "🌙", klassik: "🎻", party: "🎉", rock: "🎸", pop: "🎤" };
function leseMusik() {
  try {
    return fs.readdirSync(MUSIK_ORDNER, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({
        id: d.name,
        name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
        symbol: SYMBOLE[d.name.toLowerCase()] || "🎵",
        titel: fs.readdirSync(path.join(MUSIK_ORDNER, d.name))
          .filter((f) => AUDIO.test(f))
          .sort((a, b) => a.localeCompare(b, "de", { numeric: true }))
          .map((f) => ({
            datei: `/musik/${encodeURIComponent(d.name)}/${encodeURIComponent(f)}`,
            name: f.replace(AUDIO, "").replace(/^\d+[\s._-]*/, "").replace(/_+/g, " ").trim() || f,
          })),
      }))
      .filter((k) => k.titel.length);
  } catch { return []; }
}
const MUSIK = leseMusik();
app.get("/api/musik", (_req, res) => res.set("Cache-Control", "no-cache").json({ richtungen: MUSIK }));

app.use(express.static(path.join(__dirname, "public"), {
  // Versionierte Dateien dürfen lange im Cache bleiben, alles andere nur kurz
  setHeaders: (res, datei) => res.set("Cache-Control", /\.(css|js)$/.test(datei) ? "public, max-age=604800, immutable" : "public, max-age=3600"),
}));

const raeume = {};

// ---------- Hilfsfunktionen ----------
function neuerRaumCode() {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // ohne I und O
  let code;
  do {
    code = Array.from({ length: 4 }, () => zeichen[Math.floor(Math.random() * zeichen.length)]).join("");
  } while (raeume[code]);
  return code;
}

const saubereId = (id) => String(id || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
const daten = (d) => (d && typeof d === "object" ? d : {});

function modul(raum) {
  return SPIELE[raum.spiel];
}

// Diese Funktionen bekommen die Spiel-Module, um mit dem Raum zu arbeiten
const ctx = {
  sende: (raum) => sendeZustand(raum),
  privat: (raum, spielerId, ereignis, daten) => {
    const s = raum.spieler[spielerId];
    if (s && s.online) io.to(s.socketId).emit(ereignis, daten);
  },
  onlineSpieler: (raum) => Object.values(raum.spieler).filter((s) => s.online),
};

function sendeZustand(raum) {
  const m = modul(raum);
  const imSpiel = raum.phase === "spiel";
  io.to(raum.code).emit("zustand", {
    code: raum.code,
    hostId: raum.hostId,
    spiel: raum.spiel,
    phase: "lobby", // wird vom Spiel-Modul überschrieben, solange ein Spiel läuft
    einstellungen: raum.einstellungen[raum.spiel],
    spieler: Object.values(raum.spieler).map((s) => ({
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      punkte: s.punkte,
      online: s.online,
      ...(imSpiel && m.spielerInfo ? m.spielerInfo(raum, s) : {}),
    })),
    ...(imSpiel ? m.ansicht(raum) : {}),
  });
}

function neuerHostFallsNoetig(raum) {
  const host = raum.spieler[raum.hostId];
  if (host && host.online) return;
  const neuer = Object.values(raum.spieler).find((s) => s.online);
  if (neuer) raum.hostId = neuer.id;
}

function freierAvatar(raum, aktuell) {
  const belegt = new Set(Object.values(raum.spieler).map((s) => s.avatar));
  const start = Math.max(0, AVATARE.indexOf(aktuell));
  for (let i = 1; i <= AVATARE.length; i++) {
    const a = AVATARE[(start + i) % AVATARE.length];
    if (!belegt.has(a)) return a;
  }
  return aktuell || AVATARE[0];
}

function zurLobby(raum) {
  const m = modul(raum);
  m.beenden?.(raum);
  raum.phase = "lobby";
  raum.daten = null;
  for (const s of Object.values(raum.spieler)) {
    s.punkte = 0;
    if (!s.online) delete raum.spieler[s.id];
  }
}

// ---------- Verbindungen ----------
io.on("connection", (socket) => {
  let meinRaum = null;
  let meineId = null;
  let letzteNachricht = 0;

  socket.emit("meta", {
    spiele: Object.fromEntries(Object.entries(SPIELE).map(([id, m]) => [id, m.meta ? m.meta() : {}])),
    maxSpieler: MAX_SPIELER,
  });

  // Spam-Schutz: höchstens 40 Nachrichten pro Sekunde (kurze Bursts sind erlaubt)
  let anzahlImFenster = 0;
  socket.use((_, next) => {
    const jetzt = Date.now();
    if (jetzt - letzteNachricht > 1000) { letzteNachricht = jetzt; anzahlImFenster = 0; }
    if (++anzahlImFenster > 40) return;
    next();
  });

  const istHost = () => meinRaum && meinRaum.hostId === meineId;
  const auf = (ereignis, fn) => socket.on(ereignis, (...args) => {
    try { fn(...args); } catch (err) { console.error(`Fehler bei "${ereignis}":`, err.message); }
  });

  function beitreten(raum, spielerId, name) {
    // Wer schon in einem anderen Raum ist, verlässt ihn zuerst (sonst bleibt dort ein "Geist" online)
    if (meinRaum && meinRaum !== raum) entfernen(true);
    meinRaum = raum;
    meineId = spielerId;
    socket.join(raum.code);
    const s = raum.spieler[spielerId];
    if (s) {
      s.online = true;
      s.socketId = socket.id;
      clearTimeout(s.entfernenTimer);
    } else {
      const frei = AVATARE.filter((a) => !Object.values(raum.spieler).some((x) => x.avatar === a));
      raum.spieler[spielerId] = {
        id: spielerId,
        name,
        avatar: frei[Math.floor(Math.random() * frei.length)] || AVATARE[0],
        punkte: 0,
        online: true,
        socketId: socket.id,
      };
    }
    neuerHostFallsNoetig(raum);
    socket.emit("beigetreten", { code: raum.code });
    if (raum.phase === "spiel") modul(raum).spielerZurueck?.(raum, spielerId, ctx);
    sendeZustand(raum);
  }

  auf("raumErstellen", (d) => {
    let { name, spielerId, spiel } = daten(d);
    name = String(name || "").trim().slice(0, 16);
    spielerId = saubereId(spielerId);
    if (!name) return socket.emit("fehler", "Bitte gib einen Namen ein.");
    if (!spielerId) return;
    const code = neuerRaumCode();
    raeume[code] = {
      code,
      hostId: spielerId,
      spiel: SPIELE[spiel] ? spiel : "preis",
      phase: "lobby",
      spieler: {},
      einstellungen: Object.fromEntries(Object.entries(SPIELE).map(([id, m]) => [id, m.standardEinstellungen()])),
      daten: null,
    };
    beitreten(raeume[code], spielerId, name);
  });

  auf("raumBeitreten", (d) => {
    let { code, name, spielerId } = daten(d);
    code = String(code || "").trim().toUpperCase().slice(0, 4);
    name = String(name || "").trim().slice(0, 16);
    spielerId = saubereId(spielerId);
    const raum = Object.hasOwn(raeume, code) ? raeume[code] : null;
    // "abgelehnt": der Browser setzt sich zurück auf die Startseite (statt eingefroren stehen zu bleiben)
    if (!raum) return socket.emit("abgelehnt", `Raum "${code}" gibt es nicht (mehr).`);
    if (!spielerId) return;
    if (!raum.spieler[spielerId]) {
      if (!name) return socket.emit("fehler", "Bitte gib einen Namen ein.");
      if (raum.phase !== "lobby") return socket.emit("abgelehnt", "Das Spiel läuft schon. Warte auf die nächste Partie.");
      if (Object.keys(raum.spieler).length >= MAX_SPIELER) return socket.emit("abgelehnt", `Der Raum ist voll (max. ${MAX_SPIELER}).`);
    }
    beitreten(raum, spielerId, name);
  });

  auf("avatarWechseln", () => {
    if (!meinRaum || !meinRaum.spieler[meineId]) return;
    const s = meinRaum.spieler[meineId];
    s.avatar = freierAvatar(meinRaum, s.avatar);
    sendeZustand(meinRaum);
  });

  auf("spielWaehlen", (spiel) => {
    if (!istHost() || meinRaum.phase !== "lobby" || !SPIELE[spiel]) return;
    meinRaum.spiel = spiel;
    sendeZustand(meinRaum);
  });

  auf("einstellungen", (e) => {
    if (!istHost() || meinRaum.phase !== "lobby" || !e || typeof e !== "object") return;
    const m = modul(meinRaum);
    meinRaum.einstellungen[meinRaum.spiel] = m.einstellungenSetzen(meinRaum.einstellungen[meinRaum.spiel], e);
    sendeZustand(meinRaum);
  });

  auf("spielStarten", () => {
    if (!istHost()) return;
    const raum = meinRaum;
    if (raum.phase === "spiel" && !modul(raum).istVorbei?.(raum)) return;
    for (const s of Object.values(raum.spieler)) {
      if (!s.online) delete raum.spieler[s.id];
      else s.punkte = 0;
    }
    modul(raum).beenden?.(raum);
    raum.phase = "spiel";
    const fehler = modul(raum).starten(raum, ctx);
    if (fehler) {
      raum.phase = "lobby";
      return socket.emit("fehler", fehler);
    }
    sendeZustand(raum);
  });

  // Alle spielspezifischen Aktionen (Antworten, Abstimmungen, ...)
  auf("aktion", (typ, nutzlast) => {
    const raum = meinRaum;
    if (!raum || raum.phase !== "spiel" || !raum.daten || typeof typ !== "string") return;
    const ergebnis = modul(raum).aktion(raum, { spielerId: meineId, istHost: istHost() }, typ, nutzlast, ctx);
    if (typeof ergebnis === "string") socket.emit("fehler", ergebnis);
  });

  auf("zurLobby", () => {
    if (!istHost() || meinRaum.phase !== "spiel") return;
    zurLobby(meinRaum);
    sendeZustand(meinRaum);
  });

  auf("verlassen", () => entfernen(true));
  auf("disconnect", () => entfernen(false));

  function entfernen(sofort) {
    const raum = meinRaum;
    if (!raum || !raum.spieler[meineId]) return;
    const spieler = raum.spieler[meineId];
    if (spieler.socketId !== socket.id) return; // schon mit neuer Verbindung zurück
    spieler.online = false;
    socket.leave(raum.code);
    meinRaum = null;

    const weg = () => {
      if (raum.spieler[spieler.id]?.online) return;
      delete raum.spieler[spieler.id];
      if (Object.keys(raum.spieler).length === 0) {
        modul(raum).beenden?.(raum);
        delete raeume[raum.code];
        return;
      }
      neuerHostFallsNoetig(raum);
      if (raum.phase === "spiel") modul(raum).spielerWeg?.(raum, spieler.id, ctx);
      sendeZustand(raum);
    };

    if (sofort) return weg();
    spieler.entfernenTimer = setTimeout(weg, 3 * 60 * 1000); // 3 Minuten zum Zurückkommen
    neuerHostFallsNoetig(raum);
    if (raum.phase === "spiel") modul(raum).spielerWeg?.(raum, spieler.id, ctx);
    sendeZustand(raum);
  }
});

// Sicherheitsnetz: Ein Fehler darf nie den ganzen Server (und alle Räume) beenden
process.on("uncaughtException", (err) => console.error("Unerwarteter Fehler:", err));
process.on("unhandledRejection", (err) => console.error("Unbehandelter Fehler:", err));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SpielO läuft auf http://localhost:${PORT}`);
});
