// =============================================================
//  Preis-Schätzer – Server
//  Steuert Räume, Runden und Punkte. Bewusst sparsam gebaut,
//  damit er auch mit wenig CPU (Render Free) flüssig läuft:
//  Nachrichten werden nur bei echten Änderungen verschickt.
// =============================================================
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const DATEN = require("./daten/produkte.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 25000, pingTimeout: 20000 });

app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

// ---------- Spieldaten ----------
const PRODUKTE = DATEN.produkte;
const KATEGORIEN = DATEN.kategorien.map((k) => ({
  ...k,
  anzahl: PRODUKTE.filter((p) => p.kat === k.id).length,
}));
const MODI = ["klassisch", "nichtdrueber", "hoehertiefer", "sortieren"];
const ALLE_MODI = [...MODI, "mix"];

// Ungefähre Wechselkurse, nur um Preise in verschiedenen Währungen vergleichen zu können
const IN_EURO = { "€": 1, $: 0.87, "£": 1.15, CHF: 1.07 };
const euroWert = (p) => p.preis * (IN_EURO[p.w] || 1);

const AVATARE = ["🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐵", "🐯", "🐨", "🦖", "🐧", "🦉", "🐝", "🐳", "🦩", "🐲"];

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

function zufall(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

// Nur das, was Spieler während der Frage sehen dürfen (ohne Preis!)
function oeffentlich(p, mitPreis) {
  return {
    id: p.id,
    name: p.name,
    info: p.info,
    emoji: p.emoji,
    w: p.w,
    kat: p.kat,
    bild: p.bild || null,
    preis: mitPreis ? p.preis : null,
    fakt: mitPreis ? p.fakt : null,
  };
}

// ---------- Produkte ziehen ----------
// Jeder Raum hat einen gemischten Stapel. Gezogene Produkte kommen erst wieder,
// wenn der Stapel leer ist.
function ziehe(raum, anzahl, mindestAbstand = 1) {
  const gewaehlt = [];
  const passt = (p) =>
    gewaehlt.every((g) => {
      const v = euroWert(p) / euroWert(g);
      return Math.max(v, 1 / v) >= mindestAbstand;
    });

  for (let durchgang = 0; durchgang < 3 && gewaehlt.length < anzahl; durchgang++) {
    if (raum.stapel.length < anzahl) {
      const imSpiel = new Set(gewaehlt.map((g) => g.id));
      raum.stapel.push(...mischen(raum.pool.filter((p) => !imSpiel.has(p.id))));
    }
    for (let i = raum.stapel.length - 1; i >= 0 && gewaehlt.length < anzahl; i--) {
      // Im letzten Durchgang ist der Mindestabstand egal (kleine Kategorien)
      if (durchgang === 2 || passt(raum.stapel[i])) gewaehlt.push(...raum.stapel.splice(i, 1));
    }
  }
  return gewaehlt;
}

function planeRunde(raum) {
  let modus = raum.einstellungen.modus;
  if (modus === "mix") {
    const moeglich = MODI.filter((m) => m !== raum.letzterModus);
    modus = zufall(moeglich);
  }
  raum.letzterModus = modus;
  const sek = raum.einstellungen.sekunden;

  if (modus === "hoehertiefer") {
    const [a, b] = ziehe(raum, 2, 1.5);
    return { modus, produkte: [a, b], sekunden: Math.max(10, Math.round(sek / 2)) };
  }
  if (modus === "sortieren") {
    return { modus, produkte: ziehe(raum, 4, 1.3), sekunden: sek + 10 };
  }
  return { modus, produkte: ziehe(raum, 1), sekunden: sek };
}

// ---------- Punkte ----------
const INTRO_MS = 1800;
const VOLLTREFFER = 0.02; // max. 2 % daneben
const MAX_FAKTOR = Math.log10(10); // Faktor 10 daneben = 0 Punkte

function auswerten(raum) {
  const r = raum.runde;
  const spieler = Object.values(raum.spieler);
  const ergebnisse = spieler.map((s) => ({
    id: s.id,
    tipp: r.tipps[s.id] ? r.tipps[s.id].wert : null,
    punkte: 0,
    info: null,
  }));

  if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
    const preis = r.produkte[0].preis;
    for (const e of ergebnisse) {
      if (e.tipp === null) continue;
      e.abweichung = (e.tipp - preis) / preis;
      e.volltreffer = Math.abs(e.abweichung) <= VOLLTREFFER;
    }
    if (r.modus === "klassisch") {
      // Logarithmisch: Doppelt so viel oder halb so viel ist gleich schlimm.
      // Faktor 10 daneben = 0 Punkte.
      for (const e of ergebnisse) {
        if (e.tipp === null || e.tipp <= 0) continue;
        const fehler = Math.abs(Math.log10(e.tipp / preis));
        e.punkte = Math.round(1000 * Math.max(0, 1 - fehler / MAX_FAKTOR));
        if (e.volltreffer) e.punkte += 250;
      }
    } else {
      // Nicht drüber: Wer drüber liegt, bekommt nichts. Der Rest nach Platzierung.
      const PLATZ = [1000, 700, 500, 350, 250];
      const gueltig = ergebnisse
        .filter((e) => e.tipp !== null)
        .filter((e) => {
          e.drueber = e.tipp > preis * (1 + 1e-9);
          return !e.drueber;
        })
        .sort((a, b) => b.tipp - a.tipp);
      let platz = 0;
      gueltig.forEach((e, i) => {
        if (i > 0 && e.tipp !== gueltig[i - 1].tipp) platz = i; // gleicher Tipp = gleicher Platz
        e.platz = platz + 1;
        e.punkte = (PLATZ[platz] ?? 200) + (e.volltreffer ? 250 : 0);
      });
    }
  } else if (r.modus === "hoehertiefer") {
    const [a, b] = r.produkte;
    const richtig = euroWert(b) > euroWert(a) ? "hoeher" : "tiefer";
    r.loesung = richtig;
    for (const e of ergebnisse) {
      if (e.tipp === null) continue;
      e.richtig = e.tipp === richtig;
      if (e.richtig) {
        const rest = Math.max(0, r.endetUm - r.tipps[e.id].zeit) / (r.sekunden * 1000);
        e.punkte = 500 + Math.round(500 * rest);
      }
    }
  } else if (r.modus === "sortieren") {
    const loesung = [...r.produkte].sort((x, y) => euroWert(x) - euroWert(y)).map((p) => p.id);
    r.loesung = loesung;
    for (const e of ergebnisse) {
      if (!Array.isArray(e.tipp)) continue;
      e.treffer = e.tipp.map((id, i) => id === loesung[i]);
      const anzahl = e.treffer.filter(Boolean).length;
      e.punkte = anzahl * 200 + (anzahl === loesung.length ? 200 : 0);
    }
  }

  for (const e of ergebnisse) raum.spieler[e.id].punkte += e.punkte;
  ergebnisse.sort((a, b) => b.punkte - a.punkte);
  return ergebnisse;
}

// ---------- Ablauf ----------
function sendeZustand(raum) {
  const r = raum.runde;
  const offen = raum.phase === "aufloesung" || raum.phase === "ende";
  io.to(raum.code).emit("zustand", {
    code: raum.code,
    phase: raum.phase, // lobby | frage | aufloesung | ende
    hostId: raum.hostId,
    einstellungen: raum.einstellungen,
    rundeNr: raum.rundeNr,
    spieler: Object.values(raum.spieler).map((s) => ({
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      punkte: s.punkte,
      online: s.online,
      fertig: r && raum.phase === "frage" ? !!r.tipps[s.id] : false,
    })),
    runde:
      r && raum.phase !== "lobby"
        ? {
            nr: raum.rundeNr,
            modus: r.modus,
            sekunden: r.sekunden,
            restMs: raum.phase === "frage" ? Math.max(0, r.endetUm - Date.now()) : 0,
            // Bei "Höher oder tiefer" ist der Preis des ersten Produkts bekannt
            produkte: r.produkte.map((p, i) => oeffentlich(p, offen || (r.modus === "hoehertiefer" && i === 0))),
            ergebnisse: offen ? r.ergebnisse : null,
            loesung: offen ? r.loesung ?? null : null,
          }
        : null,
    // Bilder der nächsten Runde schon mal vorladen lassen
    vorladen: raum.phase === "aufloesung" && raum.naechste ? raum.naechste.produkte.map((p) => p.bild?.url).filter(Boolean) : [],
  });
}

function starteRunde(raum) {
  const plan = raum.naechste || planeRunde(raum);
  raum.naechste = null;
  raum.rundeNr++;
  raum.phase = "frage";
  // INTRO_MS: kurze Einblendung "Runde X – Modus", die Zeit läuft erst danach
  const dauer = INTRO_MS + plan.sekunden * 1000;
  raum.runde = { ...plan, tipps: {}, endetUm: Date.now() + dauer, ergebnisse: null };
  clearTimeout(raum.timer);
  raum.timer = setTimeout(() => beendeRunde(raum), dauer + 300);
  sendeZustand(raum);
}

function beendeRunde(raum) {
  if (raum.phase !== "frage") return;
  clearTimeout(raum.timer);
  raum.runde.ergebnisse = auswerten(raum);
  const letzte = raum.rundeNr >= raum.einstellungen.runden;
  raum.phase = letzte ? "ende" : "aufloesung";
  if (!letzte) raum.naechste = planeRunde(raum);
  sendeZustand(raum);
}

function alleFertig(raum) {
  const online = Object.values(raum.spieler).filter((s) => s.online);
  return online.length > 0 && online.every((s) => raum.runde.tipps[s.id]);
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

// ---------- Verbindungen ----------
io.on("connection", (socket) => {
  let meinRaum = null;
  let meineId = null;
  let letzteNachricht = 0;

  socket.emit("meta", { kategorien: KATEGORIEN, modi: ALLE_MODI });

  // Einfacher Schutz gegen Spam: max. ~20 Nachrichten pro Sekunde
  socket.use((_, next) => {
    const jetzt = Date.now();
    if (jetzt - letzteNachricht < 50) return;
    letzteNachricht = jetzt;
    next();
  });

  function beitreten(raum, spielerId, name) {
    meinRaum = raum;
    meineId = spielerId;
    socket.join(raum.code);
    const s = raum.spieler[spielerId];
    if (s) {
      // Spieler kommt zurück (z. B. Handy war kurz im Standby)
      s.online = true;
      s.socketId = socket.id;
      clearTimeout(s.entfernenTimer);
    } else {
      raum.spieler[spielerId] = {
        id: spielerId,
        name,
        avatar: zufall(AVATARE.filter((a) => !Object.values(raum.spieler).some((x) => x.avatar === a))) || AVATARE[0],
        punkte: 0,
        online: true,
        socketId: socket.id,
      };
    }
    neuerHostFallsNoetig(raum);
    socket.emit("beigetreten", { code: raum.code });
    sendeZustand(raum);
  }

  const istHost = () => meinRaum && meinRaum.hostId === meineId;

  socket.on("raumErstellen", ({ name, spielerId } = {}) => {
    name = String(name || "").trim().slice(0, 16);
    spielerId = String(spielerId || "").slice(0, 40);
    if (!name) return socket.emit("fehler", "Bitte gib einen Namen ein.");
    if (!spielerId) return;
    const code = neuerRaumCode();
    raeume[code] = {
      code,
      hostId: spielerId,
      phase: "lobby",
      spieler: {},
      einstellungen: { modus: "mix", runden: 10, sekunden: 30, kategorien: KATEGORIEN.map((k) => k.id) },
      rundeNr: 0,
      runde: null,
      naechste: null,
      pool: [],
      stapel: [],
      timer: null,
    };
    beitreten(raeume[code], spielerId, name);
  });

  socket.on("raumBeitreten", ({ code, name, spielerId } = {}) => {
    code = String(code || "").trim().toUpperCase();
    name = String(name || "").trim().slice(0, 16);
    spielerId = String(spielerId || "").slice(0, 40);
    const raum = raeume[code];
    if (!raum) return socket.emit("fehler", `Raum "${code}" gibt es nicht (mehr).`);
    if (!spielerId) return;
    if (!raum.spieler[spielerId]) {
      if (!name) return socket.emit("fehler", "Bitte gib einen Namen ein.");
      if (raum.phase !== "lobby") return socket.emit("fehler", "Das Spiel läuft schon. Warte auf die nächste Partie.");
      if (Object.keys(raum.spieler).length >= 16) return socket.emit("fehler", "Der Raum ist voll (max. 16).");
    }
    beitreten(raum, spielerId, name);
  });

  socket.on("avatarWechseln", () => {
    if (!meinRaum || !meinRaum.spieler[meineId]) return;
    const s = meinRaum.spieler[meineId];
    s.avatar = freierAvatar(meinRaum, s.avatar);
    sendeZustand(meinRaum);
  });

  socket.on("einstellungen", (e = {}) => {
    if (!istHost() || meinRaum.phase !== "lobby") return;
    const ein = meinRaum.einstellungen;
    if (ALLE_MODI.includes(e.modus)) ein.modus = e.modus;
    if (e.runden !== undefined) ein.runden = Math.min(30, Math.max(3, parseInt(e.runden) || 10));
    if (e.sekunden !== undefined) ein.sekunden = Math.min(90, Math.max(10, parseInt(e.sekunden) || 30));
    if (Array.isArray(e.kategorien)) {
      const gueltig = e.kategorien.filter((k) => KATEGORIEN.some((x) => x.id === k));
      if (gueltig.length) ein.kategorien = gueltig;
    }
    sendeZustand(meinRaum);
  });

  socket.on("spielStarten", () => {
    if (!istHost() || (meinRaum.phase !== "lobby" && meinRaum.phase !== "ende")) return;
    const raum = meinRaum;
    for (const s of Object.values(raum.spieler)) {
      if (!s.online) delete raum.spieler[s.id];
      else s.punkte = 0;
    }
    raum.pool = PRODUKTE.filter((p) => raum.einstellungen.kategorien.includes(p.kat));
    raum.stapel = mischen(raum.pool);
    raum.rundeNr = 0;
    raum.naechste = null;
    raum.letzterModus = null;
    starteRunde(raum);
  });

  socket.on("antwort", (wert) => {
    const raum = meinRaum;
    if (!raum || raum.phase !== "frage" || raum.runde.tipps[meineId]) return;
    const r = raum.runde;
    let ok = null;
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
      const zahl = Number(wert);
      if (isFinite(zahl) && zahl >= 0 && zahl < 1e16) ok = zahl;
    } else if (r.modus === "hoehertiefer") {
      if (wert === "hoeher" || wert === "tiefer") ok = wert;
    } else if (r.modus === "sortieren") {
      const ids = r.produkte.map((p) => p.id);
      if (Array.isArray(wert) && wert.length === ids.length && ids.every((id) => wert.includes(id))) ok = wert.map(String);
    }
    if (ok === null) return socket.emit("fehler", "Ungültige Antwort.");
    r.tipps[meineId] = { wert: ok, zeit: Date.now() };
    if (alleFertig(raum)) beendeRunde(raum);
    else sendeZustand(raum);
  });

  socket.on("naechsteRunde", () => {
    if (istHost() && meinRaum.phase === "aufloesung") starteRunde(meinRaum);
  });

  socket.on("zurLobby", () => {
    if (!istHost() || meinRaum.phase !== "ende") return;
    meinRaum.phase = "lobby";
    meinRaum.runde = null;
    meinRaum.rundeNr = 0;
    for (const s of Object.values(meinRaum.spieler)) {
      s.punkte = 0;
      if (!s.online) delete meinRaum.spieler[s.id];
    }
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
      if (raum.spieler[spieler.id]?.online) return;
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
    // 3 Minuten Zeit zum Zurückkommen
    spieler.entfernenTimer = setTimeout(weg, 3 * 60 * 1000);
    neuerHostFallsNoetig(raum);
    if (raum.phase === "frage" && alleFertig(raum)) beendeRunde(raum);
    else sendeZustand(raum);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Preis-Schätzer läuft auf http://localhost:${PORT}`));
