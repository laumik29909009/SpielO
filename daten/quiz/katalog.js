// =============================================================
//  Fragen-Katalog: handgeschriebene Fragen + Bildfragen aus der Länderliste
//  Liefert für Wissensduell und Millionenfrage einheitliche Fragen:
//  { id, kat, text, richtig, falsch: [3], s: 1–5, bild?: { typ: "flagge"|"umriss"|"emoji", wert } }
// =============================================================
const KATEGORIEN = require("./fragen");
const LAENDER = require("./laender.json");

const mischen = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const SCHWER = require("./schwer");
const HAND = [];
for (const k of KATEGORIEN) [...k.fragen, ...(SCHWER[k.id] || [])].forEach((f, i) => {
  const [text, richtig, f1, f2, f3, s, emoji] = f;
  HAND.push({ id: `${k.id}-${i}`, kat: k.id, text: emoji ? text.split("?")[0] + "?" : text, richtig, falsch: [f1, f2, f3], s, bild: emoji ? { typ: "emoji", wert: emoji } : null });
});

// Bildfragen: Falsche Antworten aus Ländern ähnlicher Bekanntheit (sonst ist es zu leicht)
const CODES = Object.keys(LAENDER);
function aehnliche(code, feld) {
  const s = LAENDER[code].s;
  const pool = CODES.filter((c) => c !== code && Math.abs(LAENDER[c].s - s) <= 1 && LAENDER[c][feld]);
  return mischen(pool).slice(0, 3);
}
function laenderFrage(kat, code) {
  const L = LAENDER[code];
  if (kat === "flaggen") return { id: `flaggen-${code}`, kat, text: "Zu welchem Land gehört diese Flagge?", richtig: L.name, falsch: aehnliche(code, "name").map((c) => LAENDER[c].name), s: L.s, bild: { typ: "flagge", wert: code.toLowerCase() } };
  if (kat === "umrisse") return { id: `umrisse-${code}`, kat, text: "Welches Land hat diesen Umriss?", richtig: L.name, falsch: aehnliche(code, "umriss").map((c) => LAENDER[c].name), s: Math.min(5, L.s + 1), bild: { typ: "umriss", wert: code } };
  if (kat === "hauptstaedte") return { id: `hauptstaedte-${code}`, kat, text: `Was ist die Hauptstadt von ${L.name}?`, richtig: L.hauptstadt, falsch: aehnliche(code, "hauptstadt").map((c) => LAENDER[c].hauptstadt), s: L.s, bild: { typ: "flagge", wert: code.toLowerCase(), klein: true } };
  return null;
}
const BILD_KATS = [
  { id: "flaggen", name: "Flaggen", icon: "🏳️", farbe: "#1565c0", passt: (c) => true },
  { id: "umrisse", name: "Länderumrisse", icon: "🗺️", farbe: "#00838f", passt: (c) => LAENDER[c].umriss },
  { id: "hauptstaedte", name: "Hauptstädte", icon: "🏙️", farbe: "#6d4c41", passt: (c) => LAENDER[c].hauptstadt },
];

const ALLE_KATEGORIEN = [
  ...KATEGORIEN.map(({ id, name, icon, farbe }) => ({ id, name, icon, farbe })),
  ...BILD_KATS.map(({ id, name, icon, farbe }) => ({ id, name, icon, farbe })),
];
const katInfo = (id) => ALLE_KATEGORIEN.find((k) => k.id === id);

// Fragen einer Kategorie (Bildkategorien werden frisch erzeugt)
function fragenVon(kat) {
  const b = BILD_KATS.find((x) => x.id === kat);
  if (b) return CODES.filter(b.passt).map((c) => laenderFrage(kat, c));
  return HAND.filter((f) => f.kat === kat);
}
// n Fragen aus einer Kategorie, möglichst ungesehen, Schwierigkeit im Wunschbereich
function ziehen(kat, n, { gesehen = new Set(), sMin = 1, sMax = 5 } = {}) {
  const alle = fragenVon(kat);
  const bereich = (f) => f.s >= sMin && f.s <= sMax;
  const sortiert = [
    ...mischen(alle.filter((f) => !gesehen.has(f.id) && bereich(f))),
    ...mischen(alle.filter((f) => !gesehen.has(f.id) && !bereich(f))),
    ...mischen(alle.filter((f) => gesehen.has(f.id))),
  ];
  return sortiert.slice(0, n);
}
// Für die Millionenfrage: eine Frage genau einer Schwierigkeit aus beliebiger Kategorie
function frageMitStufe(s, gesehen = new Set(), { mitBild = true } = {}) {
  const bild = mitBild ? BILD_KATS.flatMap((b) => CODES.filter(b.passt).map((c) => laenderFrage(b.id, c))) : [];
  const pool = [...HAND, ...bild].filter((f) => f.s === s && !gesehen.has(f.id));
  return mischen(pool)[0] || null;
}
// Antworten mischen; Rückgabe für den Browser (ohne Lösung) und die Position der richtigen Antwort
function vorbereiten(f) {
  const antworten = mischen([f.richtig, ...f.falsch]);
  return { antworten, richtig: antworten.indexOf(f.richtig) };
}

module.exports = { ALLE_KATEGORIEN, katInfo, ziehen, frageMitStufe, vorbereiten, mischen, anzahl: () => HAND.length + BILD_KATS.reduce((n, b) => n + CODES.filter(b.passt).length, 0) };
