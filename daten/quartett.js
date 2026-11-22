// =============================================================
//  Quartett-Decks: Kung Fu Panda und Dragons – Die Reiter von Berk
//  Sprache: alles deutsch, nur die Namen der Figuren/Drachen(arten) sind englisch.
//  Figuren © DreamWorks Animation, Nutzung mit Erlaubnis.
//  Jedes Deck: 8 Gruppen (A–H), bis zu 4 Karten pro Gruppe, 5 Werte.
//  Karten ohne passendes Bild wurden entfernt (Kung Fu Panda: Dim, Sum; Dragons: Thornado).
//  Höherer Wert gewinnt immer. Seltene Karten (selten: true) glänzen holografisch.
//  Werte sind eine eigene Einschätzung anhand der Filme und Serien (keine offiziellen Zahlen):
//  Jede Karte hat 1–2 Stärken und mindestens eine Schwäche.
// =============================================================

const WERTE_KUNGFU = [
    { id: "staerke", name: "Stärke", icon: "💪" },
    { id: "tempo", name: "Tempo", icon: "⚡" },
    { id: "technik", name: "Technik", icon: "🥋" },
    { id: "chi", name: "Chi", icon: "☯️" },
    { id: "ausdauer", name: "Ausdauer", icon: "🛡️" },
  ];
const WERTE_DRACHEN = [
    { id: "atem", name: "Atemkraft", icon: "🔥" },
    { id: "tempo", name: "Tempo", icon: "💨", einheit: "km/h" },
    { id: "panzer", name: "Panzer", icon: "🛡️" },
    { id: "spannweite", name: "Spannweite", icon: "📏", einheit: "m" },
    { id: "klugheit", name: "Klugheit", icon: "🧠" },
  ];

// =============================================================
//  Lizenzierte Decks (Figuren © DreamWorks Animation, Nutzung mit Erlaubnis)
//  Bilder: Die offiziellen Bilder legst du selbst in
//  public/quartett/bilder/<deck-id>/<Karten-ID>.jpg (oder .png/.webp), z. B. kungfupanda/B1.jpg
//  Fehlt ein Bild, zeigt die Karte ein neutrales Platzhalter-Symbol (tier = Twemoji-Code).
//  Werte: eigene Einschätzung anhand der Filme (1–100), keine offiziellen Zahlen.
// =============================================================
const KUNGFUPANDA = {
  id: "kungfupanda",
  name: "Kung Fu Panda",
  icon: "🐼",
  lizenz: "Figuren © DreamWorks Animation",
  beschreibung: "Po, die Furiosen Fünf, Meister, Bösewichte und Figuren aus der Serie.",
  platzhalter: true,
  werte: WERTE_KUNGFU,
  gruppen: [
    { id: "A", name: "Die Furiosen Fünf", icon: "🥋", element: "feuer", farbe: "#e8452c", farbe2: "#ffc247" },
    { id: "B", name: "Jadepalast", icon: "🏯", element: "licht", farbe: "#2fa86a", farbe2: "#c8f5a8" },
    { id: "C", name: "Bösewichte", icon: "😈", element: "schatten", farbe: "#6d32c9", farbe2: "#ff6bd5" },
    { id: "D", name: "Familie & Freunde", icon: "🍜", element: "wind", farbe: "#e08b1f", farbe2: "#ffe5a8" },
    { id: "E", name: "Meister & Krieger", icon: "🛡️", element: "stein", farbe: "#8a6a4a", farbe2: "#e9d2a8" },
    { id: "F", name: "Weitere Figuren", icon: "🏮", element: "wasser", farbe: "#1f86c9", farbe2: "#a8e6ff" },
    { id: "G", name: "Panda-Dorf", icon: "🎋", element: "wind", farbe: "#4caf50", farbe2: "#e6ffd1" },
    { id: "H", name: "Legenden der Serie", icon: "📜", element: "schatten", farbe: "#b8336a", farbe2: "#ffc2dc" },
  ],
  karten: [
    { id: "A1", name: "Tigress", tier: "1f42f", stil: "Tigerstil", text: "Die Härteste der Fünf. Zerschlägt Eisenholz mit bloßen Fäusten.", w: [90, 86, 93, 70, 92] },
    { id: "A2", name: "Monkey", tier: "1f412", stil: "Affenstil", text: "Akrobatisch, verspielt und mit Schwanz und Händen zugleich unterwegs.", w: [70, 88, 85, 62, 76] },
    { id: "A3", name: "Mantis", tier: "1f997", stil: "Gottesanbeterin-Stil", text: "Der Kleinste, aber blitzschnell und kennt jeden Druckpunkt.", w: [58, 96, 89, 66, 70] },
    { id: "A4", name: "Viper", tier: "1f40d", stil: "Schlangenstil", text: "Kämpft ohne Gift, aber mit unglaublicher Eleganz.", w: [52, 84, 91, 72, 74] },

    { id: "B1", name: "Po", tier: "1f43c", stil: "Drachenkrieger", text: "Der Drachenkrieger. Unterschätzt, hungrig und am Ende immer siegreich.", w: [86, 62, 82, 96, 99], selten: true },
    { id: "B2", name: "Crane", tier: "1f426", stil: "Kranichstil", text: "Ruhig, ausgeglichen und von oben immer im Überblick.", w: [56, 91, 82, 74, 70] },
    { id: "B3", name: "Master Shifu", tier: "1f94b", stil: "Meister des Jadepalasts", text: "Streng, klein, aber einer der größten Meister Chinas.", w: [72, 88, 98, 86, 76], selten: true },
    { id: "B4", name: "Master Oogway", tier: "1f422", stil: "Großmeister", text: "Der weise Schildkrötenmeister, der Kung Fu einst erfand.", w: [70, 66, 99, 100, 82], selten: true },

    { id: "C1", name: "Tai Lung", tier: "1f406", stil: "Schneeleopard", text: "Shifus ehemaliger Schüler. Brach aus dem sichersten Gefängnis aus.", w: [95, 94, 95, 55, 92], selten: true },
    { id: "C2", name: "Lord Shen", tier: "1f99a", stil: "Pfau mit Kanonen", text: "Will China mit Feuerwaffen erobern. Wirbelt mit Messern im Gefieder.", w: [62, 82, 91, 48, 66] },
    { id: "C3", name: "General Kai", tier: "1f402", stil: "Krieger aus der Geisterwelt", text: "Stiehlt das Chi von Meistern und macht sie zu Jade-Kriegern.", w: [99, 72, 86, 97, 96], selten: true },
    { id: "C4", name: "The Chameleon", tier: "1f98e", stil: "Gestaltwandlerin", text: "Kann jede Gestalt annehmen, auch die von großen Meistern.", w: [66, 80, 90, 91, 70] },

    { id: "D1", name: "Mr. Ping", tier: "1fabf", stil: "Nudelsuppen-Koch", text: "Pos Adoptivvater. Seine geheime Zutat: Es gibt keine.", w: [15, 42, 28, 50, 62] },
    { id: "D2", name: "Li Shan", tier: "1f43c", stil: "Pandadorf", text: "Pos leiblicher Vater. Bringt den Pandas das Faulenzen bei.", w: [88, 50, 58, 82, 86] },
    { id: "D3", name: "Mei Mei", tier: "1f43c", stil: "Band-Tanz", text: "Kämpft mit einem Seidenband und sehr viel Selbstbewusstsein.", w: [62, 76, 84, 64, 72] },
    { id: "D4", name: "Zhen", tier: "1f98a", stil: "Diebin", text: "Gerissene Füchsin, die Po zuerst bestiehlt und dann hilft.", w: [50, 92, 80, 60, 74] },

    { id: "E1", name: "Master Croc", tier: "1f40a", stil: "Krokodilstil", text: "Einer der Meister der Stadt Gongmen. Gefürchteter Schwanzschlag.", w: [82, 58, 74, 52, 86] },
    { id: "E2", name: "Master Storming Ox", tier: "1f402", stil: "Ochsenstil", text: "Stampft mit seinen Hörnern alles nieder.", w: [92, 52, 70, 56, 89] },
    { id: "E3", name: "Master Thundering Rhino", tier: "1f98f", stil: "Nashornstil", text: "Beschützer von Gongmen. Sein Hammer ist legendär.", w: [94, 48, 80, 60, 88] },
    { id: "E4", name: "Commander Vachir", tier: "1f98f", stil: "Gefängnis-Kommandant", text: "Bewacht Chorh-Gom mit tausend Wachen. Glaubt er zumindest.", w: [84, 44, 55, 38, 82] },

    { id: "F1", name: "Boss Wolf", tier: "1f43a", stil: "Anführer der Wölfe", text: "Shens Handlanger mit einem harten Kern.", w: [78, 72, 62, 36, 76] },
    { id: "F2", name: "The Soothsayer", tier: "1f410", stil: "Wahrsagerei", text: "Sieht die Zukunft. Und frisst gern mal Schuhe.", w: [25, 36, 42, 93, 58] },
    { id: "F3", name: "Zeng", tier: "1fabf", stil: "Bote", text: "Der nervöse Bote des Jadepalasts.", w: [18, 86, 22, 30, 40] },
    { id: "F4", name: "Han", tier: "1f994", stil: "Gauner-Meister", text: "Zhens Lehrmeister mit vielen Tricks im Panzer.", w: [56, 70, 82, 74, 72] },

    { id: "G1", name: "Lei Lei", tier: "1f43c", stil: "Panda-Kind", text: "Die Kleinste im Dorf. Kuschelt sich an jeden ran.", w: [20, 58, 30, 70, 50] },
    { id: "G2", name: "Grandma Panda", tier: "1f43c", stil: "Weise Großmutter", text: "Kennt alle alten Geschichten. Und alle Rezepte.", w: [35, 22, 48, 85, 66] },

    { id: "H1", name: "Fenghuang", tier: "1f989", stil: "Schattenflügel", text: "Eine gefährliche Eule, die nach Macht über die Fünf strebt.", w: [64, 90, 88, 84, 68], selten: true },
    { id: "H2", name: "Temutai", tier: "1f403", stil: "Yak-Kriegsherr", text: "Stur, laut und Anführer einer ganzen Horde.", w: [93, 50, 66, 52, 90] },
    { id: "H3", name: "Taotie", tier: "1f417", stil: "Erfinder-Bösewicht", text: "Baut ständig neue Maschinen, um den Jadepalast zu erobern.", w: [58, 44, 76, 60, 64] },
    { id: "H4", name: "Master Bear", tier: "1f43b", stil: "Jade-Krieger", text: "Ein Meister, dessen Chi gestohlen wurde. Hart wie Stein.", w: [90, 54, 68, 40, 93] },
  ],
};

const DRAGONS = {
  id: "dragons",
  name: "Dragons – Die Reiter von Berk",
  icon: "🐲",
  lizenz: "Figuren © DreamWorks Animation",
  beschreibung: "Toothless, Stormfly & Co. Die Drachen von Berk und ihre größten Gegner.",
  platzhalter: true,
  werte: WERTE_DRACHEN,
  gruppen: [
    { id: "A", name: "Drachen der Reiter", icon: "🛡️", element: "feuer", farbe: "#d9381e", farbe2: "#ffc247" },
    { id: "B", name: "Freunde von Berk", icon: "⛵", element: "wind", farbe: "#1f9e7a", farbe2: "#b6f5d8" },
    { id: "C", name: "Giganten", icon: "🌋", element: "stein", farbe: "#8a5a3a", farbe2: "#f0c58a" },
    { id: "D", name: "Gefährliche Arten", icon: "⚡", element: "blitz", farbe: "#6b3fd4", farbe2: "#ffe14d" },
    { id: "E", name: "Klein & flink", icon: "💨", element: "schatten", farbe: "#2b2a5e", farbe2: "#7fe3ff" },
    { id: "F", name: "Drachen von Berk", icon: "🏘️", element: "feuer", farbe: "#b5562b", farbe2: "#ffd59e" },
    { id: "G", name: "Mächtige Arten", icon: "🌋", element: "licht", farbe: "#c97a00", farbe2: "#ffe58a" },
    { id: "H", name: "Jäger der Nacht", icon: "🌙", element: "eis", farbe: "#3a4f8a", farbe2: "#c7e3ff" },
  ],
  karten: [
    { id: "A1", name: "Toothless", tier: "1f409", stil: "Night Fury", text: "Hiccups Drache. Der schnellste und seltenste Drache von allen.", w: [92, 300, 60, 14, 95], selten: true },
    { id: "A2", name: "Stormfly", tier: "1f409", stil: "Deadly Nadder", text: "Astrids Drache. Schießt giftige Stacheln mit dem Schwanz.", w: [80, 200, 70, 13, 72] },
    { id: "A3", name: "Meatlug", tier: "1f409", stil: "Gronckle", text: "Fishlegs' Drache. Frisst Steine und spuckt Lava.", w: [76, 60, 93, 7, 66] },
    { id: "A4", name: "Hookfang", tier: "1f409", stil: "Monstrous Nightmare", text: "Snotlouts Drache. Setzt sich selbst in Flammen.", w: [88, 160, 62, 19, 52] },

    { id: "B1", name: "Barf and Belch", tier: "1f409", stil: "Hideous Zippleback", text: "Ein Kopf gast, der andere zündet. Tuffnut und Ruffnut streiten ständig.", w: [86, 150, 55, 16, 44] },
    { id: "B2", name: "Light Fury", tier: "1f409", stil: "Light Fury", text: "Kann sich mit ihrem Feuer unsichtbar machen.", w: [90, 290, 55, 14, 90], selten: true },
    { id: "B3", name: "Cloudjumper", tier: "1f409", stil: "Stormcutter", text: "Valkas Drache mit vier Flügeln.", w: [82, 220, 70, 18, 88] },
    { id: "B4", name: "Skullcrusher", tier: "1f409", stil: "Rumblehorn", text: "Spürt mit seiner Nase jede Fährte auf.", w: [62, 140, 86, 12, 80] },

    { id: "C1", name: "Red Death", tier: "1f409", stil: "Königin des Nests", text: "Riesig wie ein Berg. Herrschte über das Drachennest.", w: [99, 90, 99, 120, 40], selten: true },
    { id: "C2", name: "Bewilderbeast", tier: "1f409", stil: "Bewilderbeast", text: "Befehligt alle Drachen und speit Eis statt Feuer. Kann nicht fliegen.", w: [95, 30, 100, 0, 92], selten: true },
    { id: "C3", name: "Screaming Death", tier: "1f409", stil: "Tunnelgräber", text: "Gräbt sich mit einem ohrenbetäubenden Schrei durch Felsen.", w: [90, 120, 88, 12, 34] },
    { id: "C4", name: "Typhoomerang", tier: "1f409", stil: "Wirbelnder Feuerdrache", text: "Dreht sich im Flug und schleudert einen Feuerwirbel.", w: [92, 180, 66, 28, 60] },

    { id: "D1", name: "Skrill", tier: "1f409", stil: "Blitzdrache", text: "Reitet auf Gewittern und speit Blitze.", w: [97, 250, 74, 14, 68], selten: true },
    { id: "D2", name: "Whispering Death", tier: "1f409", stil: "Tunneldrache", text: "Hat ringförmige Zahnreihen und lebt unter der Erde.", w: [70, 130, 80, 8, 50] },
    { id: "D3", name: "Deathgripper", tier: "1f409", stil: "Jagddrache", text: "Ein gefährlicher Jäger mit mächtigen Zangen.", w: [86, 200, 85, 18, 58] },
    { id: "D4", name: "Thunderdrum", tier: "1f409", stil: "Meeresdrache", text: "Sein Brüllen ist so laut wie ein Donnerschlag.", w: [78, 170, 64, 15, 54] },

    { id: "E1", name: "Terrible Terror", tier: "1f409", stil: "Winzling", text: "Klein wie eine Katze und genauso frech.", w: [40, 110, 20, 1, 56] },
    { id: "E2", name: "Night Lights", tier: "1f409", stil: "Drachenbabys", text: "Die Jungen von Toothless und der Light Fury.", w: [68, 260, 40, 6, 84] },
    { id: "E3", name: "Changewing", tier: "1f409", stil: "Tarndrache", text: "Passt seine Farbe der Umgebung an.", w: [72, 150, 46, 9, 78] },
    { id: "E4", name: "Windshear", tier: "1f409", stil: "Klingenflügel", text: "Ihre Flügel und ihr Schwanz sind scharf wie Messer.", w: [66, 230, 86, 16, 72] },

    { id: "F1", name: "Grump", tier: "1f409", stil: "Hotburple", text: "Gobbers Drache. Schläft am liebsten und glüht dabei vor sich hin.", w: [80, 50, 88, 9, 30] },
    { id: "F3", name: "Torch", tier: "1f409", stil: "Junger Typhoomerang", text: "Ein verspielter Feuerdrache, der überall Brandspuren hinterlässt.", w: [84, 165, 58, 22, 50] },
    { id: "F4", name: "Fireworm Queen", tier: "1f409", stil: "Fireworm", text: "Ihr ganzer Körper brennt. Herrscht über tausende Feuerwürmer.", w: [96, 140, 50, 12, 70], selten: true },

    { id: "G1", name: "Eruptodon", tier: "1f409", stil: "Titan Wing", text: "Frisst Lava und schützt so eine ganze Insel vor dem Vulkan.", w: [88, 60, 97, 45, 58], selten: true },
    { id: "G2", name: "Death Song", tier: "1f409", stil: "Lockruf-Drache", text: "Lockt andere Drachen mit seinem Gesang an und hüllt sie in Bernstein.", w: [86, 190, 66, 24, 84] },
    { id: "G3", name: "Catastrophic Quaken", tier: "1f409", stil: "Erdbeben-Drache", text: "Rollt sich zusammen und kracht wie ein Meteor auf den Boden.", w: [82, 110, 95, 20, 40] },
    { id: "G4", name: "Shockjaw", tier: "1f409", stil: "Strom-Meeresdrache", text: "Lebt im Meer und schießt elektrische Wasserstrahlen.", w: [84, 150, 68, 18, 54] },

    { id: "H1", name: "Snow Wraith", tier: "1f409", stil: "Schneegeist", text: "Unsichtbar im Schneesturm. Spürt Wärme auf große Entfernung.", w: [80, 240, 66, 20, 76] },
    { id: "H2", name: "Night Terror", tier: "1f409", stil: "Schwarm-Drache", text: "Viele kleine Drachen bilden zusammen die Form eines riesigen.", w: [56, 210, 30, 3, 80] },
    { id: "H3", name: "Speed Stinger", tier: "1f409", stil: "Lähm-Drache", text: "Rennt blitzschnell auf dem Boden und lähmt mit seinem Stachel.", w: [44, 270, 42, 2, 66] },
    { id: "H4", name: "Smothering Smokebreath", tier: "1f409", stil: "Rauch-Drache", text: "Versteckt sich in dichtem Rauch und sammelt Metall.", w: [58, 120, 54, 6, 74] },
  ],
};

const DECKS = { kungfupanda: KUNGFUPANDA, dragons: DRAGONS };

// =============================================================
//  Spezialangriffe: Jede Karte hat ihren eigenen Angriff
//  [Art, Name, Farbe, Objekt]. Arten: strahl, feuerball, stacheln, blitz, welle,
//  wirbel, krallen, sprung, regen, eis, nebel, schlag, beben, peitsche, werfen, chi
// =============================================================
const ANGRIFFE = {
  kungfupanda: {
    A1: ["krallen", "Tigerkralle", "#ff7a1a"], A2: ["schlag", "Stabwirbel", "#c98a4b"], A3: ["stacheln", "Druckpunkt-Salve", "#7ddc5a"], A4: ["peitsche", "Schlangenpeitsche", "#52c46a"],
    B1: ["sprung", "Drachenkrieger-Wumms", "#ffd23f"], B2: ["wirbel", "Flügelsturm", "#f5f0e6"], B3: ["schlag", "Meisterhand", "#ff9f1c"], B4: ["chi", "Blütenblatt-Chi", "#ffb7d5", "🌸"],
    C1: ["welle", "Nervenschlag", "#b07cff"], C2: ["feuerball", "Kanonenfeuer", "#ff6a2a"], C3: ["regen", "Jade-Klingen", "#3ee08f"], C4: ["nebel", "Gestaltwandel", "#9be15d"],
    D1: ["werfen", "Nudelsuppen-Wurf", "#ffe0a3", "🍜"], D2: ["beben", "Panda-Stampfer", "#c9a77c"], D3: ["peitsche", "Seidenband-Tanz", "#ff6fb5"], D4: ["werfen", "Taschendieb-Trick", "#ffd23f", "🪙"],
    E1: ["peitsche", "Schwanzschlag", "#4f9a3a"], E2: ["sprung", "Hörnerstoß", "#a0522d"], E3: ["beben", "Donnerhammer", "#9aa5b1"], E4: ["regen", "Pfeilhagel", "#d9d2c3", "➶"],
    F1: ["stacheln", "Wolfsrudel-Pfeile", "#b8b8c8"], F2: ["wirbel", "Blick in die Zukunft", "#c58bff"], F3: ["werfen", "Eilbotschaft", "#f5e6c8", "📜"], F4: ["wirbel", "Kugelroller", "#c08a4a"],
    G1: ["werfen", "Kuschelattacke", "#ffb7d5", "💕"], G2: ["werfen", "Teigtaschen-Hagel", "#f5e6c8", "🥟"],
    H1: ["nebel", "Schattenschwinge", "#b07cff"], H2: ["beben", "Hordenansturm", "#8a5a3a"], H3: ["werfen", "Erfindung", "#c9c9d6", "⚙️"], H4: ["regen", "Jade-Hagel", "#3ee08f"],
  },
  dragons: {
    A1: ["feuerball", "Plasmastoß", "#7c6bff"], A2: ["stacheln", "Stachelsalve", "#38c6ff"], A3: ["feuerball", "Lavaklumpen", "#ff7a1a"], A4: ["strahl", "Flammenhaut", "#ff4d2e"],
    B1: ["nebel", "Gas und Funke", "#9be15d"], B2: ["strahl", "Tarnfeuer", "#bfe9ff"], B3: ["wirbel", "Feuerwirbel", "#ff9f1c"], B4: ["sprung", "Rammstoß", "#a88a63"],
    C1: ["strahl", "Inferno", "#ff2d1a"], C2: ["eis", "Eisatem", "#bff3ff"], C3: ["welle", "Todesschrei", "#ffffff"], C4: ["wirbel", "Feuertornado", "#ff6a2a"],
    D1: ["blitz", "Blitzschlag", "#ffe14d"], D2: ["beben", "Tunnelangriff", "#8a6a4a"], D3: ["stacheln", "Giftstachel", "#b07cff"], D4: ["welle", "Donnerschall", "#38a8ff"],
    E1: ["feuerball", "Mini-Feuerstoß", "#ffb23d"], E2: ["regen", "Funkenregen", "#7fe3ff"], E3: ["nebel", "Säurespritzer", "#c3f73a"], E4: ["stacheln", "Klingenwurf", "#d6dde6"],
    F1: ["feuerball", "Glutklumpen", "#ff7a1a"], F3: ["wirbel", "Funkenwirbel", "#ffb23d"], F4: ["strahl", "Glutkörper", "#ffd23f"],
    G1: ["beben", "Lavafresser", "#ff6a2a"], G2: ["chi", "Bernstein-Gesang", "#ffb347", "🎵"], G3: ["beben", "Meteor-Aufprall", "#a88a63"], G4: ["blitz", "Stromstrahl", "#7fe3ff"],
    H1: ["eis", "Frostblitz", "#e3f8ff"], H2: ["regen", "Schwarmangriff", "#9aa5b1", "🦇"], H3: ["stacheln", "Lähmstachel", "#c3f73a"], H4: ["nebel", "Rauchwand", "#8d8da3"],
  },
};

// Gruppe aus der Karten-ID (A1 → A) ableiten, Angriff zuordnen
for (const deck of Object.values(DECKS)) {
  for (const k of deck.karten) {
    k.gruppe = k.id[0];
    const [art, name, farbe, objekt] = ANGRIFFE[deck.id]?.[k.id] || ["strahl", "Angriff"];
    k.angriff = { art, name, farbe: farbe || null, objekt: objekt || null };
  }
}
// =============================================================
//  Demnächst: Karten-Ideen, die noch NICHT im Spiel sind (je zwei neue Quartette).
//  Sie erscheinen nur im Vorschau-Raum in der Galerie unter „🔒 Demnächst“.
//  Freischalten: Gruppen und Karten oben in die Decks übernehmen und Bilder ablegen.
// =============================================================
const K = (id, name, tier, stil, text, w, angriff) => ({ id, name, tier, stil, text, w, gruppe: id[0], angriff: { art: angriff[0], name: angriff[1], farbe: angriff[2] || null, objekt: angriff[3] || null } });
KUNGFUPANDA.bald = {
  gruppen: [
    { id: "I", name: "Legenden der Ehrfurcht", icon: "🐉", element: "feuer", farbe: "#c0392b", farbe2: "#ffd27a" },
    { id: "J", name: "Pfoten des Schicksals", icon: "✨", element: "licht", farbe: "#2c7fb8", farbe2: "#c9f0ff" },
  ],
  karten: [
    K("I1", "Ke-Pa", "1f409", "Höllendrache", "Ein uralter Drachendämon, der das Tal erobern will.", [96, 70, 82, 99, 95], ["feuerball", "Höllenfeuer", "#ff3d1a"]),
    K("I2", "Fung", "1f40a", "Krokodil-Bandit", "Anführer der Krokodil-Banditen. Großes Maul, großes Herz.", [78, 48, 55, 40, 82], ["peitsche", "Schwanzhieb", "#5a9a3a"]),
    K("I3", "Scorpion", "1f98e", "Giftmeisterin", "Eine ehemalige Meisterin, die mit Gift den Willen ihrer Gegner bricht.", [62, 80, 90, 88, 66], ["stacheln", "Giftstachel", "#b07cff"]),
    K("I4", "Hundun", "1f417", "Unterwelt-Boss", "Herr der Unterwelt. Plant lieber, als selbst zu kämpfen.", [70, 38, 60, 55, 85], ["werfen", "Goldmünzen-Hagel", "#ffd23f", "🪙"]),
    K("J1", "Nu Hai", "1f43c", "Blauer Drache", "Eine der vier Auserwählten mit der Kraft des Blauen Drachen.", [62, 78, 74, 90, 66], ["welle", "Drachenwelle", "#38a8ff"]),
    K("J2", "Jing", "1f43c", "Weißer Tiger", "Schnell, stolz und mit den Krallen des Weißen Tigers.", [70, 88, 86, 72, 64], ["krallen", "Tigerklaue", "#f5f0e6"]),
    K("J3", "Bao", "1f43c", "Roter Phönix", "Kann mit der Kraft des Phönix Feuer rufen.", [58, 84, 70, 80, 60], ["feuerball", "Phönixflamme", "#ff6a2a"]),
    K("J4", "Fan Tong", "1f43c", "Schwarze Schildkröte", "Der Ruhige der Gruppe, unverwüstlich wie ein Panzer.", [86, 40, 62, 70, 92], ["beben", "Panzer-Stampfer", "#3a7a4a"]),
  ],
};
DRAGONS.bald = {
  gruppen: [
    { id: "I", name: "Wüste & Wolken", icon: "🏜️", element: "wind", farbe: "#c9a24a", farbe2: "#fff0b8" },
    { id: "J", name: "Riesen der Meere", icon: "🌊", element: "wasser", farbe: "#1f6fa8", farbe2: "#a8e0ff" },
  ],
  karten: [
    K("I1", "Sand Wraith", "1f409", "Sandgeist", "Gräbt sich in Sekunden ein und schießt Sandladungen.", [70, 140, 55, 15, 72], ["welle", "Sandsturm", "#e0c27a"]),
    K("I2", "Woolly Howl", "1f409", "Wolkenjäger", "Versteckt sich in Wolken, sein dickes Fell trotzt jeder Kälte.", [68, 170, 50, 18, 80], ["eis", "Frostfeuer", "#dfefff"]),
    K("I3", "Triple Stryke", "1f409", "Dreischwanz-Jäger", "Drei Stachelschwänze, jeder mit einem anderen Gift.", [85, 160, 75, 16, 78], ["stacheln", "Dreifachstich", "#ff9f1c"]),
    K("I4", "Flightmare", "1f409", "Leuchtnebel", "Leuchtet nachts blau und lähmt mit seinem Atem vor Angst.", [60, 120, 40, 14, 60], ["nebel", "Lähmnebel", "#6fe3ff"]),
    K("J1", "Seashocker", "1f409", "Blitz unter Wasser", "Jagt mit Stromstößen in der Tiefe.", [72, 110, 70, 20, 58], ["blitz", "Unterwasserblitz", "#7fe3ff"]),
    K("J2", "Submaripper", "1f409", "Meeresgigant", "Taucht unter Schiffen auf und zieht sie in die Tiefe.", [88, 60, 85, 60, 55], ["welle", "Riesensog", "#2a7fbf"]),
    K("J3", "Boneknapper", "1f409", "Knochenpanzer", "Trägt eine Rüstung aus Knochen und sucht seinen letzten Knochen.", [66, 90, 99, 22, 60], ["beben", "Knochenbrecher", "#e8e0cf"]),
    K("J4", "Buffalord", "1f409", "Sanfter Riese", "Sein Speichel heilt Krankheiten. Kaum je gesehen.", [64, 70, 80, 30, 70], ["chi", "Heilschleim", "#9be15d", "💚"]),
  ],
};

module.exports = { DECKS };
