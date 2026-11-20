// =============================================================
//  Preis-Schätzer – Server
//  Startet einen Webserver und verbindet alle Spieler in Echtzeit.
// =============================================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const PRODUKTE = require("./produkte.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Alle offenen Räume: { CODE: raum }
const raeume = {};

// ---------- Hilfsfunktionen ----------
function neuerRaumCode() {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // ohne I und O (Verwechslungsgefahr)
  let code;
  do {
    code = Array.from({ length: 4 }, () => zeichen[Math.floor(Math.random() * zeichen.length)]).join("");
  } while (raeume[code]);
  return code;
}

function mischen(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Punkte: je näher am echten Preis, desto mehr (max. 1000, +500 Bonus für Volltreffer)
function berechnePunkte(tipp, preis) {
  const abweichung = Math.abs(tipp - preis) / preis; // 0 = perfekt, 1 = 100 % daneben
  let punkte = Math.max(0, Math.round(1000 * (1 - abweichung)));
  if (abweichung <= 0.01) punkte += 500;
  return punkte;
}

// Schickt allen Spielern im Raum den aktuellen Zustand
function sendeZustand(raum) {
  const runde = raum.runde;
  io.to(raum.code).emit("zustand", {
    code: raum.code,
    phase: raum.phase, // "lobby" | "schaetzen" | "aufloesung" | "ende"
    hostId: raum.hostId,
    einstellungen: raum.einstellungen,
    rundeNr: raum.rundeNr,
    rundenGesamt: raum.einstellungen.runden,
    spieler: Object.values(raum.spieler).map((s) => ({
      id: s.id,
      name: s.name,
      punkte: s.punkte,
      online: s.online,
      hatGetippt: runde ? runde.tipps[s.id] !== undefined : false,
    })),
    produkt:
      runde && raum.phase !== "lobby"
        ? {
            name: runde.produkt.name,
            emoji: runde.produkt.emoji,
            info: runde.produkt.info,
            // Den Preis verraten wir erst bei der Auflösung!
            preis: raum.phase === "aufloesung" || raum.phase === "ende" ? runde.produkt.preis : null,
          }
        : null,
    endetUm: raum.phase === "schaetzen" ? runde.endetUm : null,
    ergebnisse: raum.phase === "aufloesung" || raum.phase === "ende" ? runde.ergebnisse : null,
  });
}

function starteRunde(raum) {
  raum.rundeNr++;
  const produkt = raum.stapel.pop();
  raum.phase = "schaetzen";
  raum.runde = {
    produkt,
    tipps: {},
    endetUm: Date.now() + raum.einstellungen.sekunden * 1000,
    ergebnisse: null,
  };
  clearTimeout(raum.timer);
  raum.timer = setTimeout(() => beendeRunde(raum), raum.einstellungen.sekunden * 1000);
  sendeZustand(raum);
}

function beendeRunde(raum) {
  if (raum.phase !== "schaetzen") return;
  clearTimeout(raum.timer);
  const { produkt, tipps } = raum.runde;

  const ergebnisse = Object.values(raum.spieler).map((s) => {
    const tipp = tipps[s.id];
    const punkte = tipp === undefined ? 0 : berechnePunkte(tipp, produkt.preis);
    s.punkte += punkte;
    return { id: s.id, name: s.name, tipp: tipp ?? null, punkte };
  });
  // Bester Tipp zuerst
  ergebnisse.sort((a, b) => b.punkte - a.punkte);

  raum.runde.ergebnisse = ergebnisse;
  raum.phase = raum.rundeNr >= raum.einstellungen.runden ? "ende" : "aufloesung";
  sendeZustand(raum);
}

function alleHabenGetippt(raum) {
  return Object.values(raum.spieler)
    .filter((s) => s.online)
    .every((s) => raum.runde.tipps[s.id] !== undefined);
}

function neuerHostFallsNoetig(raum) {
  const host = raum.spieler[raum.hostId];
  if (host && host.online) return;
  const neuer = Object.values(raum.spieler).find((s) => s.online);
  if (neuer) raum.hostId = neuer.id;
}

// ---------- Verbindungen ----------
io.on("connection", (socket) => {
  let meinRaum = null;
  let meineId = null;

  function beitreten(raum, spielerId, name) {
    meinRaum = raum;
    meineId = spielerId;
    socket.join(raum.code);
    if (raum.spieler[spielerId]) {
      // Spieler kommt zurück (z. B. Handy war kurz im Standby)
      raum.spieler[spielerId].online = true;
      raum.spieler[spielerId].socketId = socket.id;
      clearTimeout(raum.spieler[spielerId].entfernenTimer);
    } else {
      raum.spieler[spielerId] = { id: spielerId, name, punkte: 0, online: true, socketId: socket.id };
    }
    neuerHostFallsNoetig(raum);
    socket.emit("beigetreten", { code: raum.code });
    sendeZustand(raum);
  }

  socket.on("raumErstellen", ({ name, spielerId }) => {
    name = String(name || "").trim().slice(0, 16);
    if (!name) return socket.emit("fehler", "Bitte gib einen Namen ein.");
    const code = neuerRaumCode();
    raeume[code] = {
      code,
      hostId: spielerId,
      phase: "lobby",
      spieler: {},
      einstellungen: { runden: 5, sekunden: 30 },
      rundeNr: 0,
      runde: null,
      stapel: [],
      timer: null,
    };
    beitreten(raeume[code], spielerId, name);
  });

  socket.on("raumBeitreten", ({ code, name, spielerId }) => {
    code = String(code || "").trim().toUpperCase();
    name = String(name || "").trim().slice(0, 16);
    const raum = raeume[code];
    if (!raum) return socket.emit("fehler", `Raum "${code}" gibt es nicht.`);
    const kommtZurueck = !!raum.spieler[spielerId];
    if (!kommtZurueck) {
      if (!name) return socket.emit("fehler", "Bitte gib einen Namen ein.");
      if (raum.phase !== "lobby") return socket.emit("fehler", "Das Spiel läuft schon. Warte auf die nächste Partie.");
      if (Object.keys(raum.spieler).length >= 12) return socket.emit("fehler", "Der Raum ist voll (max. 12).");
    }
    beitreten(raum, spielerId, name);
  });

  socket.on("einstellungen", ({ runden, sekunden }) => {
    if (!meinRaum || meinRaum.hostId !== meineId || meinRaum.phase !== "lobby") return;
    meinRaum.einstellungen.runden = Math.min(20, Math.max(1, parseInt(runden) || 5));
    meinRaum.einstellungen.sekunden = Math.min(120, Math.max(10, parseInt(sekunden) || 30));
    sendeZustand(meinRaum);
  });

  socket.on("spielStarten", () => {
    if (!meinRaum || meinRaum.hostId !== meineId) return;
    if (meinRaum.phase !== "lobby" && meinRaum.phase !== "ende") return;
    // Punkte zurücksetzen, Produkte mischen
    Object.values(meinRaum.spieler).forEach((s) => (s.punkte = 0));
    meinRaum.einstellungen.runden = Math.min(meinRaum.einstellungen.runden, PRODUKTE.length);
    meinRaum.stapel = mischen(PRODUKTE);
    meinRaum.rundeNr = 0;
    starteRunde(meinRaum);
  });

  socket.on("tippAbgeben", (tipp) => {
    if (!meinRaum || meinRaum.phase !== "schaetzen") return;
    tipp = parseFloat(String(tipp).replace(",", "."));
    if (!isFinite(tipp) || tipp < 0) return socket.emit("fehler", "Bitte gib eine gültige Zahl ein.");
    meinRaum.runde.tipps[meineId] = Math.round(tipp * 100) / 100;
    if (alleHabenGetippt(meinRaum)) beendeRunde(meinRaum);
    else sendeZustand(meinRaum);
  });

  socket.on("naechsteRunde", () => {
    if (!meinRaum || meinRaum.hostId !== meineId || meinRaum.phase !== "aufloesung") return;
    starteRunde(meinRaum);
  });

  socket.on("zurLobby", () => {
    if (!meinRaum || meinRaum.hostId !== meineId || meinRaum.phase !== "ende") return;
    meinRaum.phase = "lobby";
    meinRaum.runde = null;
    meinRaum.rundeNr = 0;
    // Spieler, die weg sind, endgültig entfernen
    for (const s of Object.values(meinRaum.spieler)) if (!s.online) delete meinRaum.spieler[s.id];
    sendeZustand(meinRaum);
  });

  socket.on("verlassen", () => entfernen(true));
  socket.on("disconnect", () => entfernen(false));

  function entfernen(sofort) {
    const raum = meinRaum;
    if (!raum || !raum.spieler[meineId]) return;
    const spieler = raum.spieler[meineId];
    if (spieler.socketId !== socket.id) return; // schon mit neuer Verbindung zurück
    spieler.online = false;
    socket.leave(raum.code);
    meinRaum = null;

    const weg = () => {
      delete raum.spieler[spieler.id];
      if (Object.keys(raum.spieler).length === 0) {
        clearTimeout(raum.timer);
        delete raeume[raum.code];
        return;
      }
      neuerHostFallsNoetig(raum);
      sendeZustand(raum);
    };

    if (sofort) return weg();
    // 2 Minuten Zeit zum Zurückkommen, danach fliegt man raus
    spieler.entfernenTimer = setTimeout(weg, 2 * 60 * 1000);
    neuerHostFallsNoetig(raum);
    if (raum.phase === "schaetzen" && alleHabenGetippt(raum)) beendeRunde(raum);
    else sendeZustand(raum);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Preis-Schätzer läuft auf http://localhost:${PORT}`));
