// =============================================================
//  Quartett-Decks (eigene Figuren, eigene Werte)
//  Jedes Deck: 6 Gruppen (A–F) × 4 Karten = 24 Karten, 5 Werte.
//  Höherer Wert gewinnt immer. Seltene Karten (selten: true) sind
//  stärker und glänzen holografisch.
//
//  Bewertungsidee: Jede Karte hat 1–2 Stärken, mindestens eine
//  Schwäche, damit es keine Karte gibt, die immer gewinnt.
//  Seltene Karten haben die höchste Summe, aber auch eine Lücke.
// =============================================================

const KUNGFU = {
  id: "kungfu",
  name: "Kung-Fu-Meister",
  icon: "🥋",
  beschreibung: "24 Tier-Meister aus 6 Tempeln. Wer hat mehr Chi?",
  werte: [
    { id: "staerke", name: "Stärke", icon: "💪" },
    { id: "tempo", name: "Tempo", icon: "⚡" },
    { id: "technik", name: "Technik", icon: "🥋" },
    { id: "chi", name: "Chi", icon: "☯️" },
    { id: "ausdauer", name: "Ausdauer", icon: "🛡️" },
  ],
  gruppen: [
    { id: "A", name: "Feuer-Tempel", icon: "🔥", element: "feuer", farbe: "#ff5a36", farbe2: "#ffb23d" },
    { id: "B", name: "Wasser-Tempel", icon: "🌊", element: "wasser", farbe: "#1fa6ff", farbe2: "#7fe3ff" },
    { id: "C", name: "Wind-Tempel", icon: "🌪️", element: "wind", farbe: "#20c997", farbe2: "#b6f5d8" },
    { id: "D", name: "Berg-Tempel", icon: "⛰️", element: "stein", farbe: "#b9773d", farbe2: "#f0c58a" },
    { id: "E", name: "Schatten-Tempel", icon: "🌙", element: "schatten", farbe: "#7c4dff", farbe2: "#d1b8ff" },
    { id: "F", name: "Himmels-Tempel", icon: "☀️", element: "licht", farbe: "#f5b700", farbe2: "#fff1a8" },
  ],
  // tier: Twemoji-Datei in public/quartett/tiere/
  karten: [
    { id: "A1", name: "Tigerkralle Ruko", tier: "1f42f", stil: "Glühende Kralle", text: "Seine Krallen glühen, wenn er wütend wird.", w: [88, 74, 80, 62, 78] },
    { id: "A2", name: "Funkenfuchs Kiri", tier: "1f98a", stil: "Tanzende Flamme", text: "Schlägt dreimal zu, bevor du blinzelst.", w: [58, 92, 85, 70, 55] },
    { id: "A3", name: "Glutlöwe Malek", tier: "1f981", stil: "Brüllende Faust", text: "Sein Brüllen bringt Kerzen zum Flackern.", w: [92, 60, 72, 66, 84] },
    { id: "A4", name: "Drachenmeisterin Yara", tier: "1f432", stil: "Feuerdrachen-Form", text: "Hüterin des ewigen Feuers. Kein Kampf dauert lange.", w: [90, 78, 88, 95, 86], selten: true },

    { id: "B1", name: "Otter Pip", tier: "1f9a6", stil: "Fließender Fluss", text: "Weicht jedem Schlag aus, als wäre er Wasser.", w: [45, 88, 90, 64, 70] },
    { id: "B2", name: "Pinguin Pling", tier: "1f427", stil: "Rutschende Welle", text: "Unterschätzt ihn nicht. Er rutscht schneller, als du rennst.", w: [55, 72, 80, 60, 82] },
    { id: "B3", name: "Frosch Quako", tier: "1f438", stil: "Seerosen-Sprung", text: "Meditiert stundenlang auf einem einzigen Seerosenblatt.", w: [40, 85, 82, 88, 60] },
    { id: "B4", name: "Großmeisterin Okta", tier: "1f419", stil: "Acht Arme, acht Schulen", text: "Beherrscht acht Kampfstile gleichzeitig.", w: [70, 62, 99, 84, 75], selten: true },

    { id: "C1", name: "Adler Sora", tier: "1f985", stil: "Sturzflug", text: "Greift aus der Sonne an. Man sieht ihn nie kommen.", w: [62, 97, 76, 72, 64] },
    { id: "C2", name: "Eule Nachtfeder", tier: "1f989", stil: "Stiller Flügel", text: "Hat jedes Kampfbuch des Tempels gelesen. Zweimal.", w: [48, 70, 84, 93, 66] },
    { id: "C3", name: "Hase Hops", tier: "1f430", stil: "Tausend Sprünge", text: "Der schnellste Fuß im ganzen Tal.", w: [38, 99, 79, 60, 58] },
    { id: "C4", name: "Einhorn Lumi", tier: "1f984", stil: "Regenbogen-Wind", text: "Erscheint nur, wenn der Wind dreht.", w: [72, 90, 81, 97, 82], selten: true },

    { id: "D1", name: "Gorilla Gromm", tier: "1f98d", stil: "Felsenfaust", text: "Zerteilt Felsen mit der flachen Hand.", w: [98, 52, 66, 55, 92] },
    { id: "D2", name: "Bison Torun", tier: "1f9ac", stil: "Stampfende Herde", text: "Wenn er losrennt, bebt der Boden.", w: [95, 48, 60, 62, 96] },
    { id: "D3", name: "Dachs Grabo", tier: "1f9a1", stil: "Tunnelkralle", text: "Taucht unter dir auf. Immer.", w: [76, 64, 74, 61, 89] },
    { id: "D4", name: "Eisbär Frostpranke", tier: "1f43b-200d-2744-fe0f", stil: "Gletscher-Stand", text: "Steht seit hundert Jahren unbesiegt auf dem Gipfel.", w: [97, 58, 77, 80, 95], selten: true },

    { id: "E1", name: "Wolf Schattenzahn", tier: "1f43a", stil: "Mondheulen", text: "Jagt im Rudel, kämpft allein.", w: [80, 86, 83, 68, 77] },
    { id: "E2", name: "Waschbär Maskito", tier: "1f99d", stil: "Diebische Hand", text: "Hat dir schon den Gürtel geklaut. Merkst du's?", w: [52, 88, 92, 65, 63] },
    { id: "E3", name: "Katze Mitternacht", tier: "1f431", stil: "Lautlose Pfote", text: "Landet immer auf den Füßen. Und auf deinen.", w: [46, 94, 95, 74, 57] },
    { id: "E4", name: "Fledermaus Nachtschwinge", tier: "1f987", stil: "Echo-Schlag", text: "Kämpft mit geschlossenen Augen besser als andere mit offenen.", w: [60, 96, 89, 90, 72], selten: true },

    { id: "F1", name: "Schwan Ayla", tier: "1f9a2", stil: "Weißer Flügel", text: "Elegant wie ein Tanz, hart wie ein Hammer.", w: [50, 84, 91, 86, 68] },
    { id: "F2", name: "Hirsch Silbergeweih", tier: "1f98c", stil: "Mondgeweih", text: "Sein Geweih leuchtet im Morgengrauen.", w: [70, 82, 76, 91, 79] },
    { id: "F3", name: "Koala Dösi", tier: "1f428", stil: "Schlafender Meister", text: "Schläft 20 Stunden am Tag. Die anderen 4 sind legendär.", w: [55, 20, 70, 99, 74] },
    { id: "F4", name: "Großmeister Elio", tier: "1f418", stil: "Ewiger Berg", text: "Der älteste Meister. Vergisst nie einen Schlag.", w: [94, 45, 85, 98, 97], selten: true },
  ],
};

// Drachen: Aussehen wird im Browser gezeichnet (public/spiele/quartett-bilder.js)
// d = Aussehen: form, farben, flügel, hörner, köpfe, schweif
const DRACHEN = {
  id: "drachen",
  name: "Drachen",
  icon: "🐉",
  beschreibung: "24 Drachenarten aus 6 Elementen. Wer speit am stärksten?",
  werte: [
    { id: "atem", name: "Atemkraft", icon: "🔥" },
    { id: "tempo", name: "Tempo", icon: "💨", einheit: "km/h" },
    { id: "panzer", name: "Panzer", icon: "🛡️" },
    { id: "spannweite", name: "Spannweite", icon: "📏", einheit: "m" },
    { id: "klugheit", name: "Klugheit", icon: "🧠" },
  ],
  gruppen: [
    { id: "A", name: "Feuerdrachen", icon: "🔥", element: "feuer", farbe: "#ff4d2e", farbe2: "#ffc247" },
    { id: "B", name: "Eisdrachen", icon: "❄️", element: "eis", farbe: "#38c6ff", farbe2: "#e3f8ff" },
    { id: "C", name: "Sturmdrachen", icon: "⚡", element: "blitz", farbe: "#a35cff", farbe2: "#ffe14d" },
    { id: "D", name: "Felsdrachen", icon: "🪨", element: "stein", farbe: "#9a7b5b", farbe2: "#e2cfa6" },
    { id: "E", name: "Meeresdrachen", icon: "🌊", element: "wasser", farbe: "#139ec2", farbe2: "#7ff0d8" },
    { id: "F", name: "Schattendrachen", icon: "🌑", element: "schatten", farbe: "#5b3d99", farbe2: "#ff5fa8" },
  ],
  karten: [
    { id: "A1", name: "Glutschwinge", text: "Ihr Atem schmilzt Eisen in Sekunden.", w: [92, 180, 60, 18, 55],
      d: { form: "standard", haut: "#d9381e", bauch: "#ffb347", fluegel: "fledermaus", haut2: "#8f1d12", hoerner: 2, schweif: "flamme", augen: "#ffe14d" } },
    { id: "A2", name: "Funkenschweif", text: "Klein, flink und ständig am Kichern. Und Zündeln.", w: [78, 240, 40, 9, 62],
      d: { form: "klein", haut: "#ff7a1a", bauch: "#ffd36b", fluegel: "feder", haut2: "#c2410c", hoerner: 1, schweif: "flamme", augen: "#fff" } },
    { id: "A3", name: "Magmarücken", text: "Auf seinem Rücken fließt flüssige Lava.", w: [85, 70, 95, 22, 40],
      d: { form: "schwer", haut: "#4a2a24", bauch: "#ff6a2a", fluegel: "klein", haut2: "#2a1512", hoerner: 4, schweif: "keule", augen: "#ff9f1c", muster: "risse" } },
    { id: "A4", name: "Inferno, der Vulkankönig", text: "Schläft im größten Vulkan. Wenn er aufwacht, bricht der Vulkan aus.", w: [99, 150, 88, 45, 78], selten: true,
      d: { form: "koenig", haut: "#b3121f", bauch: "#ffcf4a", fluegel: "fledermaus", haut2: "#5c0a10", hoerner: 6, schweif: "flamme", augen: "#ffe14d", krone: true } },

    { id: "B1", name: "Frostzahn", text: "Sein Biss lässt alles zu Eis erstarren.", w: [74, 160, 70, 16, 60],
      d: { form: "standard", haut: "#5ec8f2", bauch: "#e6f7ff", fluegel: "fledermaus", haut2: "#2a7fb0", hoerner: 2, schweif: "spitz", augen: "#ffffff", muster: "kristall" } },
    { id: "B2", name: "Schneeflocke", text: "So leicht, dass sie auf einer Schneeflocke landen kann.", w: [50, 210, 35, 7, 72],
      d: { form: "klein", haut: "#f2fbff", bauch: "#c9ecff", fluegel: "feder", haut2: "#9bd8f5", hoerner: 1, schweif: "flosse", augen: "#3aa8e0" } },
    { id: "B3", name: "Gletscherhorn", text: "Sein Horn spaltet Gletscher wie Butter.", w: [80, 90, 92, 30, 50],
      d: { form: "schwer", haut: "#7aa9c9", bauch: "#e1f1fb", fluegel: "klein", haut2: "#3f6f91", hoerner: 3, schweif: "keule", augen: "#bff3ff", muster: "kristall" } },
    { id: "B4", name: "Polaris, die Eiskönigin", text: "Herrscherin des ewigen Winters. Wo sie fliegt, schneit es.", w: [90, 200, 80, 52, 92], selten: true,
      d: { form: "koenig", haut: "#bfe9ff", bauch: "#ffffff", fluegel: "feder", haut2: "#4aa3d6", hoerner: 6, schweif: "spitz", augen: "#38c6ff", krone: true, muster: "kristall" } },

    { id: "C1", name: "Donnerflügel", text: "Jeder Flügelschlag klingt wie Donner.", w: [88, 280, 45, 20, 66],
      d: { form: "standard", haut: "#6b3fd4", bauch: "#ffe14d", fluegel: "fledermaus", haut2: "#3b1f86", hoerner: 2, schweif: "blitz", augen: "#ffe14d", muster: "streifen" } },
    { id: "C2", name: "Blitzschlange", text: "Hat keine Flügel und ist trotzdem der schnellste Drache.", w: [76, 300, 38, 8, 58],
      d: { form: "schlange", haut: "#f5d300", bauch: "#fff6b0", fluegel: "keine", haut2: "#a35cff", hoerner: 2, schweif: "blitz", augen: "#7c3aed", muster: "streifen" } },
    { id: "C3", name: "Wirbelzwilling", text: "Zwei Köpfe, ein Sturm. Die beiden streiten sich ständig.", w: [82, 190, 55, 24, 47],
      d: { form: "standard", koepfe: 2, haut: "#4d5bd6", bauch: "#c7d2ff", fluegel: "fledermaus", haut2: "#262f8a", hoerner: 2, schweif: "spitz", augen: "#ffe14d" } },
    { id: "C4", name: "Zephyra, Herrin der Stürme", text: "Wenn sie lacht, zieht ein Gewitter auf.", w: [93, 320, 60, 40, 88], selten: true,
      d: { form: "koenig", haut: "#8a4dff", bauch: "#fff176", fluegel: "vier", haut2: "#4c1d95", hoerner: 4, schweif: "blitz", augen: "#ffe14d", krone: true, muster: "streifen" } },

    { id: "D1", name: "Steinbeißer", text: "Frisst Felsen zum Frühstück. Und zum Mittag.", w: [60, 60, 97, 14, 45],
      d: { form: "schwer", haut: "#7d6b5a", bauch: "#c4b293", fluegel: "klein", haut2: "#4f4236", hoerner: 2, schweif: "keule", augen: "#ffd166", muster: "platten" } },
    { id: "D2", name: "Kieselchen", text: "Ein Drachenbaby. Rollt sich bei Gefahr zu einer Kugel.", w: [35, 80, 75, 4, 70],
      d: { form: "baby", haut: "#a89276", bauch: "#e8dcc2", fluegel: "klein", haut2: "#6e5c48", hoerner: 1, schweif: "spitz", augen: "#3b2f25" } },
    { id: "D3", name: "Bergkoloss", text: "Manche Berge sind in Wahrheit nur schlafende Bergkolosse.", w: [72, 50, 99, 48, 52],
      d: { form: "schwer", haut: "#5e5a55", bauch: "#a39d93", fluegel: "fledermaus", haut2: "#36332f", hoerner: 4, schweif: "keule", augen: "#8be9fd", muster: "platten" } },
    { id: "D4", name: "Urgranit, der Uralte", text: "So alt wie die Berge. Und genauso weise.", w: [84, 95, 100, 60, 96], selten: true,
      d: { form: "koenig", haut: "#6f6152", bauch: "#e2cfa6", fluegel: "fledermaus", haut2: "#3f3429", hoerner: 6, schweif: "keule", augen: "#7CFFB2", krone: true, muster: "platten" } },

    { id: "E1", name: "Tiefenschimmer", text: "Leuchtet in der Tiefsee wie eine Laterne.", w: [66, 120, 65, 26, 74],
      d: { form: "schlange", haut: "#0f5f8a", bauch: "#7ff0d8", fluegel: "flossen", haut2: "#083a55", hoerner: 0, schweif: "flosse", augen: "#7ff0d8", muster: "punkte" } },
    { id: "E2", name: "Korallenkamm", text: "Auf ihrem Kamm wachsen echte Korallen.", w: [58, 140, 72, 15, 68],
      d: { form: "standard", haut: "#ff7d8e", bauch: "#ffe0e5", fluegel: "flossen", haut2: "#d14a63", hoerner: 3, schweif: "flosse", augen: "#0b4f6c" } },
    { id: "E3", name: "Wellenreiter", text: "Surft auf Tsunamis, nur zum Spaß.", w: [74, 230, 50, 21, 61],
      d: { form: "standard", haut: "#17a2b8", bauch: "#c8fff4", fluegel: "flossen", haut2: "#0b6170", hoerner: 2, schweif: "flosse", augen: "#ffffff", muster: "streifen" } },
    { id: "E4", name: "Leviathan", text: "Der König der Meere. Schiffe drehen um, wenn sie ihn sehen.", w: [95, 110, 90, 70, 85], selten: true,
      d: { form: "koenig", haut: "#0d4f73", bauch: "#5fe3c0", fluegel: "flossen", haut2: "#06283d", hoerner: 5, schweif: "flosse", augen: "#ffe66d", krone: true, muster: "punkte" } },

    { id: "F1", name: "Dämmerkralle", text: "Jagt nur in der Dämmerung. Lautlos.", w: [80, 260, 58, 17, 82],
      d: { form: "standard", haut: "#2b2340", bauch: "#5b4a80", fluegel: "fledermaus", haut2: "#140f22", hoerner: 2, schweif: "spitz", augen: "#ff5fa8" } },
    { id: "F2", name: "Rauchschleier", text: "Versteckt sich in seinem eigenen Rauch.", w: [62, 200, 48, 13, 77],
      d: { form: "klein", haut: "#4b4b5c", bauch: "#8d8da3", fluegel: "fledermaus", haut2: "#26262f", hoerner: 2, schweif: "spitz", augen: "#c3f73a" } },
    { id: "F3", name: "Nebelgeist", text: "Halb Drache, halb Nebel. Man greift durch ihn hindurch.", w: [70, 170, 52, 19, 80],
      d: { form: "schlange", haut: "#8e7cc3", bauch: "#e2dbff", fluegel: "feder", haut2: "#4f3f8a", hoerner: 2, schweif: "flosse", augen: "#ffffff", geist: true } },
    { id: "F4", name: "Eklipse, die Sonnenfresserin", text: "Hat einmal die Sonne verschluckt. Für drei Minuten.", w: [97, 270, 75, 55, 94], selten: true,
      d: { form: "koenig", haut: "#1a1030", bauch: "#ff5fa8", fluegel: "fledermaus", haut2: "#0a0614", hoerner: 6, schweif: "spitz", augen: "#ff3d7f", krone: true } },
  ],
};

const DECKS = { kungfu: KUNGFU, drachen: DRACHEN };
// Gruppe aus der Karten-ID (A1 → A) ableiten
for (const deck of Object.values(DECKS)) {
  for (const k of deck.karten) k.gruppe = k.id[0];
}
module.exports = { DECKS };
