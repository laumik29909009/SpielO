// =============================================================
//  Baulöwe – Spielfeld und Karten
//  ★ Hier personalisieren: Straßennamen, Farben, Kartentexte ★
//  Schechingen-Edition: Weiler, Straßen, Gebäude und Vereine der Gemeinde Schechingen.
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
  { art: "bahn", name: "Sportplatz FC Schechingen", icon: "⚽", preis: 200 },
  S("Birkhof", "hellblau", 100, [6, 30, 90, 270, 400, 550]),
  { art: "ereignis", name: "Glück", icon: "❓" },
  S("Haghof", "hellblau", 100, [6, 30, 90, 270, 400, 550]),
  S("Leinweiler", "hellblau", 120, [8, 40, 100, 300, 450, 600]),
  { art: "knast", name: "Gefängnis / Nur zu Besuch", icon: "🚔" },
  S("Hirtenweg", "pink", 140, [10, 50, 150, 450, 625, 750]),
  { art: "werk", name: "Gewerbegebiet Kappelfeld", icon: "🏭", preis: 150 },
  S("Riedenweg", "pink", 140, [10, 50, 150, 450, 625, 750]),
  S("Riedstraße", "pink", 160, [12, 60, 180, 500, 700, 900]),
  { art: "bahn", name: "Tennisclub", icon: "🎾", preis: 200 },
  S("Horner Weg", "orange", 180, [14, 70, 200, 550, 750, 950]),
  { art: "kasse", name: "Dorfkasse", icon: "💰" },
  S("Im Spagen", "orange", 180, [14, 70, 200, 550, 750, 950]),
  S("Hessenberg", "orange", 200, [16, 80, 220, 600, 800, 1000]),
  { art: "parken", name: "Dorfplatz Schechingen", icon: "⛲" },
  S("Langenstraße", "rot", 220, [18, 90, 250, 700, 875, 1050]),
  { art: "ereignis", name: "Glück", icon: "❓" },
  S("Hohenstadter Straße", "rot", 220, [18, 90, 250, 700, 875, 1050]),
  S("Schießbergstraße", "rot", 240, [20, 100, 300, 750, 925, 1100]),
  { art: "bahn", name: "Motorradfreunde", icon: "🏍️", preis: 200 },
  S("Grundschule", "gelb", 260, [22, 110, 330, 800, 975, 1150]),
  S("Gemeindehalle", "gelb", 260, [22, 110, 330, 800, 975, 1150]),
  { art: "werk", name: "Neubaugebiet Brühlgärten", icon: "🏗️", preis: 150 },
  S("Kulturforum", "gelb", 280, [24, 120, 360, 850, 1025, 1200]),
  { art: "geheKnast", name: "Ab ins Gefängnis!", icon: "👮" },
  S("Rathaus", "gruen", 300, [26, 130, 390, 900, 1100, 1275]),
  S("Kirche St. Sebastian", "gruen", 300, [26, 130, 390, 900, 1100, 1275]),
  { art: "kasse", name: "Dorfkasse", icon: "💰" },
  S("Kirche St. Laurentius", "gruen", 320, [28, 150, 450, 1000, 1200, 1400]),
  { art: "bahn", name: "Fischerfreunde", icon: "🎣", preis: 200 },
  { art: "ereignis", name: "Glück", icon: "❓" },
  S("Kaiser-Friedrich-Straße", "blau", 350, [35, 175, 500, 1100, 1300, 1500]),
  { art: "steuer", name: "Luxussteuer", icon: "💎", betrag: 100 },
  S("Gasthaus Ochsen", "blau", 400, [50, 200, 600, 1400, 1700, 2000]),
];

// Karten. wirkung:
//  geld (+/-), zu (Feld-Index, über Los gibt Geld), zurueck (Felder), knast, frei (Gefängnis-frei-Karte),
//  reparatur {haus, hotel}, vonJedem (jeder zahlt dir), anJeden (du zahlst jedem), naechsteBahn (doppelte Miete)
const EREIGNIS = [
  { text: "Rücke vor bis auf Los.", zu: 0 },
  { text: "Ab in die Schießbergstraße. Kommst du über Los, bekommst du 200.", zu: 24 },
  { text: "Rücke vor in den Hirtenweg.", zu: 11 },
  { text: "Ab zum nächsten Vereinsheim. Gehört es jemandem, zahlst du doppelte Miete.", naechsteBahn: true },
  { text: "Die Bank zahlt dir eine Dividende.", geld: 50 },
  { text: "Du kommst aus dem Gefängnis frei. Behalte die Karte, bis du sie brauchst.", frei: true },
  { text: "Gehe 3 Felder zurück.", zurueck: 3 },
  { text: "Gehe ins Gefängnis. Direkt, ohne über Los.", knast: true },
  { text: "Renovierung! Zahle 25 pro Haus und 100 pro Hotel.", reparatur: { haus: 25, hotel: 100 } },
  { text: "Falsch geparkt vor dem Rathaus.", geld: -15 },
  { text: "Ausfahrt mit den Motorradfreunden. Über Los bekommst du 200.", zu: 25 },
  { text: "Auf ein Bier ins Gasthaus Ochsen!", zu: 39 },
  { text: "Du wirst Vorsitzender beim FC Schechingen. Zahle jedem 50.", anJeden: 50 },
  { text: "Dein Bausparvertrag ist fällig.", geld: 150 },
  { text: "Du gewinnst das Quiz im Kulturforum!", geld: 100 },
  { text: "Rücke vor zum nächsten Vereinsheim.", naechsteBahn: true },
];
const KASSE = [
  { text: "Rücke vor bis auf Los.", zu: 0 },
  { text: "Bankfehler zu deinen Gunsten.", geld: 200 },
  { text: "Arztrechnung.", geld: -50 },
  { text: "Flohmarkt in der Gemeindehalle.", geld: 50 },
  { text: "Du kommst aus dem Gefängnis frei.", frei: true },
  { text: "Gehe ins Gefängnis.", knast: true },
  { text: "Geburtstag! Jeder schenkt dir 10.", vonJedem: 10 },
  { text: "Steuerrückzahlung.", geld: 20 },
  { text: "Lebensversicherung wird fällig.", geld: 100 },
  { text: "Krankenhausgebühren.", geld: -100 },
  { text: "Spende für den Förderverein der Grundschule.", geld: -50 },
  { text: "Beratungshonorar.", geld: 25 },
  { text: "Straßenausbesserung: 40 pro Haus, 115 pro Hotel.", reparatur: { haus: 40, hotel: 115 } },
  { text: "Zweiter Platz bei der Kleintierschau.", geld: 10 },
  { text: "Erbschaft.", geld: 100 },
  { text: "Urlaubsgeld.", geld: 100 },
];

const SPIELFIGUREN = ["🎩", "🚗", "🐕", "🚀", "🦆", "👟", "⛵", "🎸"];

module.exports = { GRUPPEN, FELDER, EREIGNIS, KASSE, SPIELFIGUREN };
