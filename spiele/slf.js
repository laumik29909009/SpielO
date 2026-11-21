// =============================================================
//  Spiel-Modul: Stadt Land Fluss
//  Ablauf pro Runde:
//  buchstabe (Glücksrad) → schreiben → [stopp: 10 s Countdown]
//  → pruefen (Schiedsrichter) → bewerten (Abstimmung) → nächste Runde / ende
// =============================================================
const KATALOG = require("../daten/slf/kategorien.json");
const { pruefe, beginntMit } = require("./slf-pruefer");
const istSolo = (raum) => Object.keys(raum.spieler).length === 1;

const ALLE_KATEGORIEN = KATALOG.gruppen.flatMap((g) => g.kategorien);
const NACH_ID = Object.fromEntries(ALLE_KATEGORIEN.map((k) => [k.id, k]));
const MAX_KATEGORIEN = 10;
const MAX_TEXT = 50;

const BUCHSTABEN_LEICHT = "ABDEFGHIKLMNOPRSTUVWZ".split("");
const BUCHSTABEN_SCHWER = ["C", "J", "Q", "X", "Y"];

const RAD_MS = 3600; // Glücksrad-Animation
const STOPP_MS = 10_000; // Countdown nach "Stopp!"
const NACHZUEGLER_MS = 1500; // Zeit, damit alle letzten Eingaben ankommen
const PUNKTE = { allein: 20, einzigartig: 10, doppelt: 5, stern: 3, solo: 10 };

// ---------- Einstellungen ----------
function kategorieAusId(id) {
  const k = NACH_ID[id];
  return k ? { id: k.id, name: k.name, emoji: k.emoji, frei: !!k.frei, ue18: !!k.ue18 } : null;
}

function standardEinstellungen() {
  return {
    kategorien: KATALOG.pakete[0].kategorien.map(kategorieAusId),
    runden: 5,
    sekunden: 90,
    stopp: true,
    schwer: false,
    ue18: false,
  };
}

function einstellungenSetzen(alt, e) {
  const neu = { ...alt, kategorien: [...alt.kategorien] };
  if (typeof e.umschalten === "string") {
    const i = neu.kategorien.findIndex((k) => k.id === e.umschalten);
    if (i >= 0) neu.kategorien.splice(i, 1);
    else if (NACH_ID[e.umschalten] && (!NACH_ID[e.umschalten].ue18 || neu.ue18) && neu.kategorien.length < MAX_KATEGORIEN) {
      neu.kategorien.push(kategorieAusId(e.umschalten));
    }
  }
  if (typeof e.eigene === "string") {
    const name = e.eigene.replace(/\s+/g, " ").trim().slice(0, 32);
    const doppelt = neu.kategorien.some((k) => k.name.toLowerCase() === name.toLowerCase());
    if (name.length >= 2 && !doppelt && neu.kategorien.length < MAX_KATEGORIEN) {
      neu.kategorien.push({ id: "eigen-" + Date.now().toString(36), name, emoji: "✏️", frei: !!e.frei, eigen: true });
    }
  }
  if (typeof e.paket === "string") {
    const p = KATALOG.pakete.find((x) => x.id === e.paket);
    if (p && (!p.ue18 || neu.ue18)) neu.kategorien = p.kategorien.map(kategorieAusId);
  }
  if (e.zufall) {
    const pool = ALLE_KATEGORIEN.filter((k) => !k.ue18 || neu.ue18).map((k) => k.id).sort(() => Math.random() - 0.5);
    neu.kategorien = ["stadt", "land", ...pool.filter((id) => id !== "stadt" && id !== "land").slice(0, 4)].map(kategorieAusId);
  }
  if (e.runden !== undefined) neu.runden = Math.min(15, Math.max(1, parseInt(e.runden) || 5));
  if (e.sekunden !== undefined) neu.sekunden = Math.min(300, Math.max(30, parseInt(e.sekunden) || 90));
  if (typeof e.stopp === "boolean") neu.stopp = e.stopp;
  if (typeof e.schwer === "boolean") neu.schwer = e.schwer;
  if (typeof e.ue18 === "boolean") {
    neu.ue18 = e.ue18;
    if (!neu.ue18) neu.kategorien = neu.kategorien.filter((k) => !k.ue18);
    if (!neu.kategorien.length) neu.kategorien = KATALOG.pakete[0].kategorien.map(kategorieAusId);
  }
  return neu;
}

// ---------- Hilfen ----------
const einst = (raum) => raum.einstellungen.slf;

// Live-Fortschritt: pro Kategorie 0 = leer, 1 = falscher Buchstabe, 2 = passt
function felderStatus(raum, spielerId) {
  const d = raum.daten;
  const entwurf = d.entwuerfe[spielerId] || {};
  return d.kategorien.map((k) => {
    const t = (entwurf[k.id] || "").trim();
    return !t ? 0 : beginntMit(t, d.buchstabe) ? 2 : 1;
  }).join("");
}

function ausgefuellt(raum, spielerId) {
  const d = raum.daten;
  const entwurf = d.entwuerfe[spielerId] || {};
  return d.kategorien.filter((k) => (entwurf[k.id] || "").trim()).length;
}

function allesKorrektAusgefuellt(raum, spielerId) {
  const d = raum.daten;
  const entwurf = d.entwuerfe[spielerId] || {};
  return d.kategorien.every((k) => {
    const t = (entwurf[k.id] || "").trim();
    return t && beginntMit(t, d.buchstabe);
  });
}

function zieheBuchstabe(raum) {
  const d = raum.daten;
  const pool = [...BUCHSTABEN_LEICHT, ...(einst(raum).schwer ? BUCHSTABEN_SCHWER : [])];
  let frei = pool.filter((b) => !d.benutzt.includes(b));
  if (!frei.length) { d.benutzt = []; frei = pool; }
  const b = frei[Math.floor(Math.random() * frei.length)];
  d.benutzt.push(b);
  return b;
}

// ---------- Ablauf ----------
function starteRunde(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.rundeNr++;
  d.buchstabe = zieheBuchstabe(raum);
  d.phase = "buchstabe";
  d.entwuerfe = {};
  d.stoppVon = null;
  d.bewertung = null;
  d.bereit = new Set();
  d.hinweis = null;
  d.tempoBonus = {};
  d.endetUm = Date.now() + RAD_MS;
  d.timer = setTimeout(() => {
    d.phase = "schreiben";
    d.endetUm = Date.now() + einst(raum).sekunden * 1000;
    d.timer = setTimeout(() => zeitAbgelaufen(raum, ctx), einst(raum).sekunden * 1000);
    ctx.sende(raum);
  }, RAD_MS);
  ctx.sende(raum);
}

function zeitAbgelaufen(raum, ctx) {
  const d = raum.daten;
  if (!d || (d.phase !== "schreiben" && d.phase !== "stopp")) return;
  clearTimeout(d.timer);
  d.phase = "pruefen";
  d.endetUm = null;
  ctx.sende(raum); // Clients schicken jetzt sofort ihren letzten Stand
  d.timer = setTimeout(() => auswerten(raum, ctx), NACHZUEGLER_MS);
}

async function auswerten(raum, ctx) {
  const d = raum.daten;
  const rundeNr = d.rundeNr;
  const antworten = {};
  for (const k of d.kategorien) {
    antworten[k.id] = {};
    for (const s of Object.values(raum.spieler)) antworten[k.id][s.id] = (d.entwuerfe[s.id]?.[k.id] || "").trim();
  }
  const { ergebnis, hinweis } = await pruefe(d.buchstabe, d.kategorien, antworten);
  if (raum.daten !== d || d.rundeNr !== rundeNr || d.phase !== "pruefen") return; // Spiel wurde inzwischen beendet

  d.hinweis = hinweis;
  d.bewertung = {};
  for (const k of d.kategorien) {
    d.bewertung[k.id] = {};
    for (const [spielerId, auto] of Object.entries(ergebnis[k.id])) {
      d.bewertung[k.id][spielerId] = {
        text: antworten[k.id][spielerId], auto, fuer: new Set(), gegen: new Set(), sterne: new Set(), host: null,
      };
    }
  }
  d.phase = "bewerten";
  ctx.sende(raum);
}

// Gilt eine Antwort? Host-Entscheid > Abstimmung > Schiedsrichter
function entscheidung(e) {
  if (e.auto.status === "leer") return { gilt: false, durch: "regel" };
  if (e.host) return { gilt: e.host === "ok", durch: "host" };
  if (e.fuer.size !== e.gegen.size) return { gilt: e.fuer.size > e.gegen.size, durch: "abstimmung" };
  return { gilt: e.auto.status !== "falsch", durch: e.auto.quelle };
}

function berechnePunkte(raum) {
  const d = raum.daten;
  const runde = {};
  const proEintrag = {};
  for (const s of Object.keys(raum.spieler)) runde[s] = d.tempoBonus?.[s] || 0;
  const solo = istSolo(raum);
  for (const k of d.kategorien) {
    proEintrag[k.id] = {};
    const eintraege = Object.entries(d.bewertung[k.id] || {});
    const gueltig = eintraege.filter(([, e]) => entscheidung(e).gilt);
    const zaehler = {};
    for (const [, e] of gueltig) zaehler[e.auto.kanonisch] = (zaehler[e.auto.kanonisch] || 0) + 1;
    for (const [spielerId, e] of eintraege) {
      let p = 0;
      let art = "ungueltig";
      if (entscheidung(e).gilt) {
        if (solo) { p = PUNKTE.solo; art = "gueltig"; }
        else if (gueltig.length === 1) { p = PUNKTE.allein; art = "allein"; }
        else if (zaehler[e.auto.kanonisch] > 1) { p = PUNKTE.doppelt; art = "doppelt"; }
        else { p = PUNKTE.einzigartig; art = "einzigartig"; }
      }
      const sternPunkte = e.sterne.size * PUNKTE.stern;
      proEintrag[k.id][spielerId] = { punkte: p, sternPunkte, art };
      if (runde[spielerId] !== undefined) runde[spielerId] += p + sternPunkte;
    }
  }
  return { runde, proEintrag };
}

function naechsteRunde(raum, ctx) {
  const d = raum.daten;
  const { runde } = berechnePunkte(raum);
  for (const [id, p] of Object.entries(runde)) if (raum.spieler[id]) raum.spieler[id].punkte += p;
  d.verlauf.push({ nr: d.rundeNr, buchstabe: d.buchstabe, punkte: runde });
  if (d.rundeNr >= einst(raum).runden) {
    d.phase = "ende";
    d.letzteRunde = runde;
    ctx.sende(raum);
  } else {
    starteRunde(raum, ctx);
  }
}

// ---------- Schnittstelle für den Server-Kern ----------
module.exports = {
  meta: () => ({
    gruppen: KATALOG.gruppen,
    pakete: KATALOG.pakete.map(({ id, name, emoji, kategorien, ue18 }) => ({ id, name, emoji, kategorien, ue18: !!ue18 })),
    maxKategorien: MAX_KATEGORIEN,
    punkte: PUNKTE,
  }),

  standardEinstellungen,
  einstellungenSetzen,

  starten(raum, ctx) {
    const e = einst(raum);
    if (e.kategorien.length < 2) return "Wähle mindestens 2 Kategorien.";
    raum.daten = {
      phase: "buchstabe", rundeNr: 0, kategorien: e.kategorien.map((k) => ({ ...k })),
      benutzt: [], entwuerfe: {}, verlauf: [], timer: null, bereit: new Set(),
    };
    starteRunde(raum, ctx);
  },

  beenden(raum) {
    if (raum.daten) clearTimeout(raum.daten.timer);
  },

  istVorbei: (raum) => raum.daten?.phase === "ende",

  aktion(raum, { spielerId, istHost }, typ, daten, ctx) {
    const d = raum.daten;
    switch (typ) {
      case "entwurf": {
        // Spieler schicken ihren Zwischenstand regelmäßig, damit bei Abbruch nichts verloren geht
        if (!["schreiben", "stopp", "pruefen"].includes(d.phase) || !daten || typeof daten !== "object") return;
        const vorher = felderStatus(raum, spielerId);
        const entwurf = {};
        for (const k of d.kategorien) entwurf[k.id] = String(daten[k.id] || "").slice(0, MAX_TEXT);
        d.entwuerfe[spielerId] = entwurf;
        if (felderStatus(raum, spielerId) !== vorher && d.phase !== "pruefen") ctx.sende(raum);
        return;
      }
      case "stopp": {
        if (d.phase !== "schreiben" || !einst(raum).stopp) return;
        if (daten && typeof daten === "object") module.exports.aktion(raum, { spielerId }, "entwurf", daten, ctx);
        if (!allesKorrektAusgefuellt(raum, spielerId)) return "Erst alle Kategorien mit dem richtigen Buchstaben ausfüllen!";
        d.phase = "stopp";
        d.stoppVon = spielerId;
        // Solo: Runde endet sofort, übrige Zeit gibt Tempo-Bonus (1 Punkt pro 3 Sekunden)
        if (ctx.onlineSpieler(raum).length === 1) {
          d.tempoBonus[spielerId] = Math.floor(Math.max(0, d.endetUm - Date.now()) / 3000);
          return zeitAbgelaufen(raum, ctx);
        }
        if (d.endetUm - Date.now() > STOPP_MS) {
          clearTimeout(d.timer);
          d.endetUm = Date.now() + STOPP_MS;
          d.timer = setTimeout(() => zeitAbgelaufen(raum, ctx), STOPP_MS);
        }
        ctx.sende(raum);
        return;
      }
      case "stimme":
      case "stern":
      case "host": {
        if (d.phase !== "bewerten" || !daten) return;
        const e = d.bewertung[daten.kat]?.[daten.spieler];
        if (!e) return;
        if (typ === "host") {
          if (!istHost) return;
          e.host = daten.wert === "ok" || daten.wert === "falsch" ? daten.wert : null;
        } else {
          if (daten.spieler === spielerId) return "Über die eigene Antwort darfst du nicht abstimmen 😉";
          if (typ === "stern") {
            if (e.sterne.has(spielerId)) e.sterne.delete(spielerId);
            else e.sterne.add(spielerId);
          } else {
            e.fuer.delete(spielerId);
            e.gegen.delete(spielerId);
            if (daten.wert === "fuer") e.fuer.add(spielerId);
            if (daten.wert === "gegen") e.gegen.add(spielerId);
          }
        }
        ctx.sende(raum);
        return;
      }
      case "bereit": {
        if (d.phase !== "bewerten") return;
        if (d.bereit.has(spielerId)) d.bereit.delete(spielerId);
        else d.bereit.add(spielerId);
        ctx.sende(raum);
        return;
      }
      case "weiter": {
        if (istHost && d.phase === "bewerten") naechsteRunde(raum, ctx);
        return;
      }
    }
  },

  spielerZurueck(raum, spielerId, ctx) {
    const d = raum.daten;
    if (d && d.entwuerfe[spielerId] && ["schreiben", "stopp"].includes(d.phase)) {
      ctx.privat(raum, spielerId, "slf:entwurf", d.entwuerfe[spielerId]);
    }
  },

  spielerInfo(raum, s) {
    const d = raum.daten;
    if (!d) return {};
    return { fortschritt: ausgefuellt(raum, s.id), felder: felderStatus(raum, s.id), bereit: d.bereit.has(s.id) };
  },

  ansicht(raum) {
    const d = raum.daten;
    const e = einst(raum);
    let bewertung = null;
    let rundenPunkte = null;
    if (d.bewertung) {
      const { runde, proEintrag } = berechnePunkte(raum);
      rundenPunkte = runde;
      bewertung = d.kategorien.map((k) => ({
        ...k,
        eintraege: Object.entries(d.bewertung[k.id]).map(([spielerId, x]) => {
          const ent = entscheidung(x);
          return {
            spielerId, text: x.text, gilt: ent.gilt, durch: ent.durch,
            status: x.auto.status, grund: x.auto.grund, quelle: x.auto.quelle,
            fuer: [...x.fuer], gegen: [...x.gegen], sterne: [...x.sterne], host: x.host,
            ...proEintrag[k.id][spielerId],
          };
        }),
      }));
    }
    return {
      phase: d.phase,
      rundeNr: d.rundeNr,
      rundenGesamt: e.runden,
      buchstabe: d.buchstabe,
      kategorien: d.kategorien,
      sekunden: e.sekunden,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0,
      stoppErlaubt: e.stopp,
      stoppVon: d.stoppVon,
      hinweis: d.hinweis,
      solo: istSolo(raum),
      tempoBonus: d.tempoBonus || {},
      bewertung,
      rundenPunkte: rundenPunkte || (d.phase === "ende" ? d.letzteRunde : null),
      verlauf: d.verlauf,
    };
  },
};
