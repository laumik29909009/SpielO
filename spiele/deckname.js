// =============================================================
//  Spiel-Modul: Deckname (Team-Wortspiel)
//  - 25 Wörter. Nur die Chefs sehen, welches Wort zu welchem Team gehört.
//  - Teams-Modus (ab 4): Rot gegen Blau. Startteam 9 Wörter, anderes 8, 7 neutral, 1 Attentäter.
//  - Gemeinsam (2–3): alle gegen das Brett. 9 eigene Wörter, 15 neutral, 1 Attentäter, 8 Hinweise.
//  - Der Chef gibt einen Hinweis: ein Wort + eine Zahl. Das Team darf bis Zahl + 1 Wörter aufdecken.
//  - Eigenes Wort: weiter raten. Neutral oder fremd: Zug vorbei. Attentäter: verloren.
//  Die Farbkarte geht nur privat an die Chefs (deckname:karte), nie in die öffentliche Ansicht.
// =============================================================
const { randomInt } = require("crypto");
const WOERTER = require("../daten/deckname-woerter");
const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const einst = (raum) => raum.einstellungen.deckname;
const GEMEINSAM_HINWEISE = 8;

function aktive(raum) { return Object.values(raum.spieler).filter((s) => s.online); }
function rolleVon(d, id) {
  for (const t of ["rot", "blau"]) { if (d.chef[t] === id) return { team: t, chef: true }; if (d.teams[t].includes(id)) return { team: t, chef: false }; }
  return null;
}
const gegner = (t) => (t === "rot" ? "blau" : "rot");
const norm = (w) => String(w || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

function karteSenden(raum, ctx, nurId = null) {
  const d = raum.daten;
  for (const id of Object.keys(raum.spieler)) {
    if (nurId && id !== nurId) continue;
    const r = rolleVon(d, id);
    ctx.privat(raum, id, "deckname:karte", r?.chef || d.phase === "ende" ? { farben: d.farben } : { farben: null });
  }
}
function log(d, text) { d.log.push(text); if (d.log.length > 30) d.log.shift(); }
function aktion(d, a) { d.aktionNr = (d.aktionNr || 0) + 1; d.letzteAktion = { ...a, nr: d.aktionNr, t: Date.now() }; }

function zeitSetzen(raum, ctx) {
  const d = raum.daten;
  clearTimeout(d.timer);
  const sek = d.phase === "hinweis" ? einst(raum).sekundenHinweis : einst(raum).sekundenRaten;
  d.endetUm = sek ? Date.now() + sek * 1000 : null;
  if (sek) d.timer = setTimeout(() => {
    if (d.phase === "raten") { log(d, "⏰ Zeit vorbei."); zugEnde(raum, ctx); }
    else if (d.phase === "hinweis") { log(d, "⏰ Kein Hinweis in der Zeit – das Team setzt aus."); zugEnde(raum, ctx); }
  }, sek * 1000);
}

function zugEnde(raum, ctx) {
  const d = raum.daten;
  d.hinweis = null; d.markiert = {}; d.rest = 0;
  if (d.modus === "gemeinsam") {
    d.hinweiseUebrig--;
    if (d.hinweiseUebrig <= 0) return ende(raum, ctx, null, "Keine Hinweise mehr übrig.");
  } else d.dran = gegner(d.dran);
  d.phase = "hinweis";
  aktion(d, { typ: "wechsel", team: d.dran });
  zeitSetzen(raum, ctx);
  ctx.sende(raum);
}

function ende(raum, ctx, sieger, grund) {
  const d = raum.daten;
  clearTimeout(d.timer);
  d.phase = "ende"; d.sieger = sieger; d.grund = grund;
  log(d, grund);
  // Punkte: Gewinnerteam 10, Chefs +2; im Gemeinsam-Modus alle gleich nach gefundenen Wörtern
  for (const s of Object.values(raum.spieler)) {
    const r = rolleVon(d, s.id);
    if (d.modus === "gemeinsam") s.punkte = Object.values(d.aufgedeckt).filter((f) => f === "rot").length;
    else s.punkte = r && r.team === sieger ? 10 + (r.chef ? 2 : 0) : 0;
  }
  aktion(d, { typ: "ende", sieger });
  karteSenden(raum, ctx); // am Ende sehen alle die Karte
  ctx.sende(raum);
}

function aufdecken(raum, ctx, id, i) {
  const d = raum.daten;
  const f = d.farben[i];
  d.aufgedeckt[i] = f;
  delete d.markiert[i];
  const team = d.dran;
  aktion(d, { typ: "aufgedeckt", i, farbe: f, spieler: id, team });
  log(d, `${raum.spieler[id]?.name || "?"} deckt „${d.woerter[i]}“ auf: ${{ rot: "🟥 Rot", blau: "🟦 Blau", neutral: "⬜ neutral", attentaeter: "💀 Attentäter" }[f]}`);
  const uebrig = (t) => d.farben.filter((x, j) => x === t && !d.aufgedeckt[j]).length;
  if (f === "attentaeter") return ende(raum, ctx, d.modus === "gemeinsam" ? null : gegner(team), "💀 Der Attentäter wurde aufgedeckt!");
  if (uebrig("rot") === 0) return ende(raum, ctx, "rot", d.modus === "gemeinsam" ? "🎉 Alle Wörter gefunden!" : "🟥 Team Rot hat alle Wörter gefunden!");
  if (d.modus !== "gemeinsam" && uebrig("blau") === 0) return ende(raum, ctx, "blau", "🟦 Team Blau hat alle Wörter gefunden!");
  d.rest--;
  if (f !== team || d.rest <= 0) {
    // Kurz zeigen, was aufgedeckt wurde, dann ist das andere Team dran
    const nr = d.aktionNr;
    d.phase = "wechselt";
    clearTimeout(d.timer);
    d.timer = setTimeout(() => d.phase === "wechselt" && d.aktionNr === nr && zugEnde(raum, ctx), 1600);
    return ctx.sende(raum);
  }
  ctx.sende(raum);
}

module.exports = {
  meta: () => ({ min: 2 }),
  standardEinstellungen: () => ({ sekundenHinweis: 0, sekundenRaten: 0 }),
  einstellungenSetzen(alt, e) {
    const neu = { ...alt };
    if (e.sekundenHinweis !== undefined) neu.sekundenHinweis = [0, 60, 120, 180].includes(+e.sekundenHinweis) ? +e.sekundenHinweis : 0;
    if (e.sekundenRaten !== undefined) neu.sekundenRaten = [0, 60, 120, 180].includes(+e.sekundenRaten) ? +e.sekundenRaten : 0;
    return neu;
  },
  starten(raum, ctx) {
    const leute = mischen(aktive(raum).map((s) => s.id));
    if (leute.length < 2) return "Deckname braucht mindestens 2 Spieler.";
    const modus = leute.length >= 4 ? "teams" : "gemeinsam";
    const woerter = mischen(WOERTER).slice(0, 25);
    const start = randomInt(0, 2) ? "rot" : "blau";
    let farben;
    if (modus === "teams") farben = mischen([...Array(start === "rot" ? 9 : 8).fill("rot"), ...Array(start === "blau" ? 9 : 8).fill("blau"), ...Array(7).fill("neutral"), "attentaeter"]);
    else farben = mischen([...Array(9).fill("rot"), ...Array(15).fill("neutral"), "attentaeter"]);
    const teams = { rot: [], blau: [] }, chef = { rot: null, blau: null };
    if (modus === "teams") {
      leute.forEach((id, i) => teams[i % 2 ? "blau" : "rot"].push(id));
      chef.rot = teams.rot.shift(); chef.blau = teams.blau.shift();
    } else { chef.rot = leute[0]; teams.rot = leute.slice(1); }
    raum.daten = {
      modus, woerter, farben, aufgedeckt: {}, markiert: {}, teams, chef, dran: modus === "teams" ? start : "rot",
      phase: "hinweis", hinweis: null, rest: 0, hinweiseUebrig: GEMEINSAM_HINWEISE, verlauf: [], log: [], sieger: null, timer: null,
    };
    log(raum.daten, modus === "teams" ? `Team ${start === "rot" ? "Rot" : "Blau"} beginnt und hat 9 Wörter.` : "Gemeinsam gegen das Brett: Findet alle 9 Wörter mit höchstens 8 Hinweisen.");
    aktion(raum.daten, { typ: "start" });
    karteSenden(raum, ctx);
    zeitSetzen(raum, ctx);
  },
  beenden(raum) { if (raum.daten) clearTimeout(raum.daten.timer); },
  istVorbei: (raum) => raum.daten?.phase === "ende",
  aktion(raum, { spielerId }, typ, daten, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende") return;
    const r = rolleVon(d, spielerId);
    if (!r) return "Du schaust diese Runde zu.";
    if (typ === "hinweis") {
      if (d.phase !== "hinweis" || !r.chef || r.team !== d.dran) return "Gerade gibt jemand anderes den Hinweis.";
      const wort = String(daten?.wort || "").trim();
      const zahl = parseInt(daten?.zahl);
      if (!/^[A-Za-zÄÖÜäöüß\-]{2,24}$/.test(wort)) return "Der Hinweis muss genau ein Wort sein (nur Buchstaben).";
      if (!(zahl >= 1 && zahl <= 9)) return "Wähle eine Zahl von 1 bis 9.";
      const n = norm(wort);
      // Verboten: das Wort selbst und Zusammensetzungen (Eis → Eiswürfel, Wasser → Mineralwasser), nicht aber zufällige Buchstabenfolgen mitten im Wort
      const zusammen = (a, b) => a === b || (b.length >= 3 && (a.startsWith(b) || a.endsWith(b)));
      const verboten = d.woerter.find((w, i) => !d.aufgedeckt[i] && (zusammen(n, norm(w)) || zusammen(norm(w), n)));
      if (verboten) return `„${wort}“ ist zu nah an „${verboten}“ – das Wort liegt noch auf dem Brett.`;
      d.hinweis = { wort, zahl, von: spielerId, team: d.dran };
      d.rest = zahl + 1;
      d.phase = "raten";
      d.verlauf.push({ wort, zahl, team: d.dran });
      log(d, `💬 ${raum.spieler[spielerId].name}: „${wort}“ – ${zahl}`);
      aktion(d, { typ: "hinweis", wort, zahl, team: d.dran });
      zeitSetzen(raum, ctx);
      return void ctx.sende(raum);
    }
    if (typ === "tippen") {
      const i = parseInt(daten);
      if (d.phase !== "raten" || r.chef || r.team !== d.dran) return d.phase === "raten" && r.chef ? "Als Chef darfst du nicht raten." : "Dein Team ist gerade nicht dran.";
      if (!(i >= 0 && i < 25) || d.aufgedeckt[i]) return;
      const m = d.markiert[i] || [];
      // Erstes Tippen markiert (alle im Team sehen es), zweites Tippen derselben Person deckt auf
      if (m.includes(spielerId)) return aufdecken(raum, ctx, spielerId, i);
      for (const k of Object.keys(d.markiert)) d.markiert[k] = d.markiert[k].filter((x) => x !== spielerId);
      d.markiert[i] = [...(d.markiert[i] || []), spielerId];
      for (const k of Object.keys(d.markiert)) if (!d.markiert[k].length) delete d.markiert[k];
      return void ctx.sende(raum);
    }
    if (typ === "fertig") {
      if (d.phase !== "raten" || r.team !== d.dran || r.chef) return;
      if (d.rest > d.hinweis.zahl) return "Deckt erst mindestens ein Wort auf.";
      log(d, `✋ ${raum.spieler[spielerId].name} beendet den Zug.`);
      return void zugEnde(raum, ctx);
    }
  },
  spielerZurueck(raum, id, ctx) { if (raum.daten) karteSenden(raum, ctx, id); },
  spielerWeg(raum, id, ctx) {
    const d = raum.daten;
    if (!d || d.phase === "ende" || raum.spieler[id]) return;
    // Fällt ein Chef weg, übernimmt jemand aus dem Team
    for (const t of ["rot", "blau"]) {
      d.teams[t] = d.teams[t].filter((x) => x !== id);
      if (d.chef[t] === id) {
        d.chef[t] = d.teams[t].shift() || null;
        if (d.chef[t]) { log(d, `${raum.spieler[d.chef[t]]?.name} ist jetzt Chef von Team ${t === "rot" ? "Rot" : "Blau"}.`); karteSenden(raum, ctx, d.chef[t]); }
        else return ende(raum, ctx, gegner(t), `Team ${t === "rot" ? "Rot" : "Blau"} hat keinen Chef mehr.`);
      }
    }
    ctx.sende(raum);
  },
  spielerInfo: () => ({}),
  ansicht(raum) {
    const d = raum.daten;
    const uebrig = (t) => d.farben.filter((x, j) => x === t && !d.aufgedeckt[j]).length;
    return {
      phase: d.phase, modus: d.modus, woerter: d.woerter, aufgedeckt: d.aufgedeckt, markiert: d.markiert,
      teams: d.teams, chef: d.chef, dran: d.dran, hinweis: d.hinweis, rest: d.rest, hinweiseUebrig: d.hinweiseUebrig,
      uebrig: { rot: uebrig("rot"), blau: uebrig("blau") }, verlauf: d.verlauf.slice(-12), log: d.log.slice(-8),
      sieger: d.sieger, grund: d.grund || null, letzteAktion: d.letzteAktion || null,
      restMs: d.endetUm ? Math.max(0, d.endetUm - Date.now()) : 0,
    };
  },
  _intern: { norm, WOERTER },
};
