// =============================================================
//  Baulöwe – Spielfeld und Karten
//  ★ Hier personalisieren: Straßennamen, Farben, Kartentexte ★
//  Schechingen-Edition: Weiler, Gebäude, Vereine und Firmen aus Schechingen, Bahnhöfe der Umgebung.
//  Preise/Mieten sind ausbalanciert und sollten nur mit Bedacht geändert werden.
// =============================================================

// Farbgruppen (Haus-Preis je Gruppe)
const GRUPPEN = {
  braun: { name: "Braun", farbe: "#8b5a2b", haus: 50 },
  hellblau: { name: "Hellblau", farbe: "#8fd3ff", haus: 50 },
  pink: { name: "Pink", farbe: "#e05cb4", haus: 100 },
  orange: { name: "Orange", farbe: "#ff9a3c", haus: 100 },
  rot: { name: "Rot", farbe: "#e8433f", haus: 150 },
  gelb: { name: "Gelb", farbe: "#ffd23f", haus: 150 },
  gruen: { name: "Grün", farbe: "#2fae5f", haus: 200 },
  blau: { name: "Dunkelblau", farbe: "#2f5fd6", haus: 200 },
};

// 40 Felder im Uhrzeigersinn ab Start.
// art: start | strasse | bahn | werk | ereignis | kasse | steuer | knast | parken | geheKnast
// miete bei Straßen: [ohne Haus, 1, 2, 3, 4 Häuser, Hotel]
const S = (name, gruppe, preis, miete) => ({ art: "strasse", name, gruppe, preis, miete });
const FELDER = [
  { art: "start", name: "Los", icon: "🏁" },
  S("Zeirenhof", "braun", 60, [2, 10, 30, 90, 160, 250]),
  { art: "kasse", name: "Dorfkasse", icon: "💰" },
  S("Eichhof", "braun", 60, [4, 20, 60, 180, 320, 450]),
  { art: "steuer", name: "Grundsteuer", icon: "🧾", betrag: 200 },
  { art: "bahn", name: "Bahnhof Aalen", icon: "🚆", preis: 200 },
  S("Klotzhof", "hellblau", 100, [6, 30, 90, 270, 400, 550]),
  { art: "ereignis", name: "Glück", icon: "❓" },
  S("Haghof", "hellblau", 100, [6, 30, 90, 270, 400, 550]),
  S("Leinweiler", "hellblau", 120, [8, 40, 100, 300, 450, 600]),
  { art: "knast", name: "Gefängnis / Nur zu Besuch", icon: "🚔" },
  S("Kindergarten St. Josef", "pink", 140, [10, 50, 150, 450, 625, 750]),
  { art: "werk", name: "EnBW", icon: "⚡", preis: 150 },
  S("Grundschule", "pink", 140, [10, 50, 150, 450, 625, 750]),
  S("Autohaus Krieger", "pink", 160, [12, 60, 180, 500, 700, 900]),
  { art: "bahn", name: "Bahnhof Mögglingen", icon: "🚆", preis: 200 },
  S("Feuerwehrhaus", "orange", 180, [14, 70, 200, 550, 750, 950]),
  { art: "kasse", name: "Dorfkasse", icon: "💰" },
  S("Musikverein 1857", "orange", 180, [14, 70, 200, 550, 750, 950]),
  S("Autohaus Bopp", "orange", 200, [16, 80, 220, 600, 800, 1000]),
  { art: "parken", name: "Dorfplatz Schechingen", icon: "⛲" },
  S("Kulturforum", "rot", 220, [18, 90, 250, 700, 875, 1050]),
  { art: "ereignis", name: "Glück", icon: "❓" },
  S("Bürgersaal", "rot", 220, [18, 90, 250, 700, 875, 1050]),
  S("Gemeindehalle", "rot", 240, [20, 100, 300, 750, 925, 1100]),
  { art: "bahn", name: "Bahnhof Gmünd", icon: "🚆", preis: 200 },
  S("FC Schechingen", "gelb", 260, [22, 110, 330, 800, 975, 1150]),
  S("TC Schechingen", "gelb", 260, [22, 110, 330, 800, 975, 1150]),
  { art: "werk", name: "Wasserturm", icon: "🚰", preis: 150 },
  S("Kaiser-Friedrich-Straße", "gelb", 280, [24, 120, 360, 850, 1025, 1200]),
  { art: "geheKnast", name: "Ab ins Gefängnis!", icon: "👮" },
  S("Kirche St. Sebastian", "gruen", 300, [26, 130, 390, 900, 1100, 1275]),
  S("Freibad", "gruen", 300, [26, 130, 390, 900, 1100, 1275]),
  { art: "kasse", name: "Dorfkasse", icon: "💰" },
  S("Rathaus", "gruen", 320, [28, 150, 450, 1000, 1200, 1400]),
  { art: "bahn", name: "Bahnhof Böbingen", icon: "🚆", preis: 200 },
  { art: "ereignis", name: "Glück", icon: "❓" },
  S("Osterbrunnen", "blau", 350, [35, 175, 500, 1100, 1300, 1500]),
  { art: "steuer", name: "Luxussteuer", icon: "💎", betrag: 100 },
  S("Gasthaus Ochsen", "blau", 400, [50, 200, 600, 1400, 1700, 2000]),
];

// Karten. wirkung:
//  geld (+/-), zu (Feld-Index, über Los gibt Geld), zurueck (Felder), knast, frei (Gefängnis-frei-Karte),
//  reparatur {haus, hotel}, vonJedem (jeder zahlt dir), anJeden (du zahlst jedem), naechsteBahn (doppelte Miete),
//  naechstesWerk (würfeln, 10 × Augen zahlen)
const EREIGNIS = [
  { text: "Der Bus fährt durch: Rücke vor bis auf Los.", zu: 0 },
  { text: "Großes Fest in der Gemeindehalle! Rücke vor. Kommst du über Los, bekommst du 200.", zu: 24 },
  { text: "Elternabend im Kindergarten St. Josef: Rücke vor. Über Los gibt es 200.", zu: 11 },
  { text: "Stromausfall! Rücke vor zum nächsten Werk. Gehört es jemandem, würfle und zahle das Zehnfache.", naechstesWerk: true },
  { text: "Ab zum nächsten Bahnhof. Gehört er jemandem, zahlst du doppelte Miete.", naechsteBahn: true },
  { text: "Der Zug nach Gmünd wartet: Rücke vor zum nächsten Bahnhof. Gehört er jemandem, zahlst du doppelte Miete.", naechsteBahn: true },
  { text: "Deine EnBW-Aktien zahlen eine Dividende: Du erhältst 50.", geld: 50 },
  { text: "Der Bürgermeister drückt ein Auge zu: Du kommst aus dem Gefängnis frei. Behalte die Karte, bis du sie brauchst.", frei: true },
  { text: "Du hast deinen Geldbeutel im Ochsen liegen lassen: Gehe 3 Felder zurück.", zurueck: 3 },
  { text: "Beim Maibaumklau erwischt! Gehe ins Gefängnis, direkt und ohne über Los.", knast: true },
  { text: "Sturm über Schechingen: Zahle für jedes Haus 25 und für jedes Hotel 100.", reparatur: { haus: 25, hotel: 100 } },
  { text: "Zu schnell durch Leinweiler gefahren: Zahle 15.", geld: -15 },
  { text: "Ausflug nach Aalen: Rücke vor zum Bahnhof Aalen. Über Los bekommst du 200.", zu: 5 },
  { text: "Feierabend: Rücke vor ins Gasthaus Ochsen.", zu: 39 },
  { text: "Du wirst Vorsitzender beim Musikverein: Zahle jedem Spieler 50.", anJeden: 50 },
  { text: "Dein Bausparvertrag ist fällig: Du erhältst 150.", geld: 150 },
];
const KASSE = [
  { text: "Rücke vor bis auf Los.", zu: 0 },
  { text: "Fehler der Raiffeisenbank zu deinen Gunsten: Du erhältst 200.", geld: 200 },
  { text: "Arztrechnung nach dem Fußballspiel beim FC: Zahle 50.", geld: -50 },
  { text: "Erlös vom Flohmarkt in der Gemeindehalle: Du erhältst 50.", geld: 50 },
  { text: "Die Feuerwehr holt dich raus: Du kommst aus dem Gefängnis frei. Behalte die Karte, bis du sie brauchst.", frei: true },
  { text: "Beim Osterbrunnen-Schmücken Eier geklaut: Gehe ins Gefängnis, direkt und ohne über Los.", knast: true },
  { text: "Deine Urlaubskasse ist voll: Du erhältst 100.", geld: 100 },
  { text: "Steuerrückzahlung vom Rathaus: Du erhältst 20.", geld: 20 },
  { text: "Du hast Geburtstag! Jeder Spieler schenkt dir 10.", vonJedem: 10 },
  { text: "Deine Lebensversicherung wird fällig: Du erhältst 100.", geld: 100 },
  { text: "Krankenhausrechnung: Zahle 100.", geld: -100 },
  { text: "Spende für den Förderverein der Grundschule: Zahle 50.", geld: -50 },
  { text: "Du hilfst im Autohaus aus: Beratungshonorar 25.", geld: 25 },
  { text: "Die Gemeinde saniert die Straßen: Zahle für jedes Haus 40 und für jedes Hotel 115.", reparatur: { haus: 40, hotel: 115 } },
  { text: "Zweiter Platz bei der Kleintierschau: Du erhältst 10.", geld: 10 },
  { text: "Erbschaft von der Tante aus Eichhof: Du erhältst 100.", geld: 100 },
];

const SPIELFIGUREN = ["🎩", "🚗", "🐕", "🚀", "🦆", "👟", "⛵", "🎸"];

module.exports = { GRUPPEN, FELDER, EREIGNIS, KASSE, SPIELFIGUREN };
