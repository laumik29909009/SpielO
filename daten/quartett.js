// =============================================================
//  Quartett decks: Kung Fu Panda and Dragons: Riders of Berk
//  Characters © DreamWorks Animation, used with permission.
//  Card content is in English (names, groups, stats, texts, attacks).
//  Each deck: groups A–H, up to 4 cards per group, 5 stats. Higher value always wins.
//  Rare cards (selten: true) shine holographically.
//  Stats are our own estimate based on the films and series (no official numbers).
//  Images: public/quartett/bilder/<deck-id>/<card-id>.webp (see scripts/bilder_import.py)
//  Attack: [type, name, color, object]. Types: strahl, feuerball, stacheln, blitz, welle,
//  wirbel, krallen, sprung, regen, eis, nebel, schlag, beben, peitsche, werfen, chi
// =============================================================

const KUNGFUPANDA = {
  id: "kungfupanda",
  name: "Kung Fu Panda",
  icon: "🐼",
  lizenz: "Characters © DreamWorks Animation",
  beschreibung: "Po, the Furious Five, masters, villains and characters from the series.",
  platzhalter: true,
  werte: [{ id: "staerke", name: "Strength", icon: "💪" }, { id: "tempo", name: "Speed", icon: "⚡" }, { id: "technik", name: "Technique", icon: "🥋" }, { id: "chi", name: "Chi", icon: "☯️" }, { id: "ausdauer", name: "Stamina", icon: "🛡️" }],
  gruppen: [
    { id: "A", name: "Furious Five", icon: "🥋", element: "feuer", farbe: "#e8452c", farbe2: "#ffc247" },
    { id: "B", name: "Jade Palace", icon: "🏯", element: "licht", farbe: "#2fa86a", farbe2: "#c8f5a8" },
    { id: "C", name: "Villains", icon: "😈", element: "schatten", farbe: "#6d32c9", farbe2: "#ff6bd5" },
    { id: "D", name: "Family & Friends", icon: "🍜", element: "wind", farbe: "#e08b1f", farbe2: "#ffe5a8" },
    { id: "E", name: "Masters & Warriors", icon: "🛡️", element: "stein", farbe: "#8a6a4a", farbe2: "#e9d2a8" },
    { id: "F", name: "More Characters", icon: "🏮", element: "wasser", farbe: "#1f86c9", farbe2: "#a8e6ff" },
    { id: "G", name: "Panda Village", icon: "🎋", element: "wind", farbe: "#4caf50", farbe2: "#e6ffd1" },
    { id: "H", name: "Legends of the Series", icon: "📜", element: "schatten", farbe: "#b8336a", farbe2: "#ffc2dc" },
  ],
  karten: [
    { id: "A1", name: "Tigress", tier: "1f42f", stil: "Tiger Style", text: "The toughest of the Five. Smashes ironwood with her bare fists.", w: [90, 86, 93, 70, 92], angriff: ["krallen", "Tiger Claw", "#ff7a1a"] },
    { id: "A2", name: "Monkey", tier: "1f412", stil: "Monkey Style", text: "Acrobatic, playful and fighting with tail and hands at once.", w: [70, 88, 85, 62, 76], angriff: ["schlag", "Staff Spin", "#c98a4b"] },
    { id: "A3", name: "Mantis", tier: "1f997", stil: "Mantis Style", text: "The smallest, but lightning fast and knows every pressure point.", w: [58, 96, 89, 66, 70], angriff: ["stacheln", "Pressure Point Volley", "#7ddc5a"] },
    { id: "A4", name: "Viper", tier: "1f40d", stil: "Snake Style", text: "Fights without venom, but with incredible grace.", w: [52, 84, 91, 72, 74], angriff: ["peitsche", "Snake Whip", "#52c46a"] },
    { id: "B1", name: "Po", tier: "1f43c", stil: "Dragon Warrior", text: "The Dragon Warrior. Underestimated, hungry and always victorious in the end.", w: [86, 62, 82, 96, 99], selten: true, angriff: ["sprung", "Dragon Warrior Slam", "#ffd23f"] },
    { id: "B2", name: "Crane", tier: "1f426", stil: "Crane Style", text: "Calm, balanced and always keeping watch from above.", w: [56, 91, 82, 74, 70], angriff: ["wirbel", "Wing Storm", "#f5f0e6"] },
    { id: "B3", name: "Master Shifu", tier: "1f94b", stil: "Master of the Jade Palace", text: "Strict and small, but one of the greatest masters in China.", w: [72, 88, 98, 86, 76], selten: true, angriff: ["schlag", "Master's Hand", "#ff9f1c"] },
    { id: "B4", name: "Master Oogway", tier: "1f422", stil: "Grand Master", text: "The wise old tortoise who once created kung fu.", w: [70, 66, 99, 100, 82], selten: true, angriff: ["chi", "Blossom Chi", "#ffb7d5", "🌸"] },
    { id: "C1", name: "Tai Lung", tier: "1f406", stil: "Snow Leopard", text: "Shifu's former student. Escaped from the most secure prison.", w: [95, 94, 95, 55, 92], selten: true, angriff: ["welle", "Nerve Strike", "#b07cff"] },
    { id: "C2", name: "Lord Shen", tier: "1f99a", stil: "Peacock with Cannons", text: "Wants to conquer China with firepower. Hides blades in his feathers.", w: [62, 82, 91, 48, 66], angriff: ["feuerball", "Cannon Fire", "#ff6a2a"] },
    { id: "C3", name: "General Kai", tier: "1f402", stil: "Warrior from the Spirit Realm", text: "Steals the chi of masters and turns them into jade warriors.", w: [99, 72, 86, 97, 96], selten: true, angriff: ["regen", "Jade Blades", "#3ee08f"] },
    { id: "C4", name: "The Chameleon", tier: "1f98e", stil: "Shapeshifter", text: "Can take any shape, even that of great masters.", w: [66, 80, 90, 91, 70], angriff: ["nebel", "Shapeshift", "#9be15d"] },
    { id: "D1", name: "Mr. Ping", tier: "1fabf", stil: "Noodle Chef", text: "Po's adoptive father. His secret ingredient: there is none.", w: [15, 42, 28, 50, 62], angriff: ["werfen", "Noodle Soup Toss", "#ffe0a3", "🍜"] },
    { id: "D2", name: "Li Shan", tier: "1f43c", stil: "Panda Village", text: "Po's birth father. Teaches pandas the art of lazing around.", w: [88, 50, 58, 82, 86], angriff: ["beben", "Panda Stomp", "#c9a77c"] },
    { id: "D3", name: "Mei Mei", tier: "1f43c", stil: "Ribbon Dance", text: "Fights with a silk ribbon and a lot of confidence.", w: [62, 76, 84, 64, 72], angriff: ["peitsche", "Silk Ribbon Dance", "#ff6fb5"] },
    { id: "D4", name: "Zhen", tier: "1f98a", stil: "Thief", text: "A cunning fox who first robs Po and then helps him.", w: [50, 92, 80, 60, 74], angriff: ["werfen", "Pickpocket Trick", "#ffd23f", "🪙"] },
    { id: "E1", name: "Master Croc", tier: "1f40a", stil: "Crocodile Style", text: "One of the masters of Gongmen City. Feared tail strike.", w: [82, 58, 74, 52, 86], angriff: ["peitsche", "Tail Strike", "#4f9a3a"] },
    { id: "E2", name: "Master Storming Ox", tier: "1f402", stil: "Ox Style", text: "Tramples everything flat with his horns.", w: [92, 52, 70, 56, 89], angriff: ["sprung", "Horn Charge", "#a0522d"] },
    { id: "E3", name: "Master Thundering Rhino", tier: "1f98f", stil: "Rhino Style", text: "Protector of Gongmen City. His hammer is legendary.", w: [94, 48, 80, 60, 88], angriff: ["beben", "Thunder Hammer", "#9aa5b1"] },
    { id: "E4", name: "Commander Vachir", tier: "1f98f", stil: "Prison Commander", text: "Guards Chorh-Gom with a thousand guards. Or so he thinks.", w: [84, 44, 55, 38, 82], angriff: ["regen", "Arrow Hail", "#d9d2c3", "➶"] },
    { id: "F1", name: "Boss Wolf", tier: "1f43a", stil: "Leader of the Wolves", text: "Shen's henchman with a soft core.", w: [78, 72, 62, 36, 76], angriff: ["stacheln", "Wolf Pack Arrows", "#b8b8c8"] },
    { id: "F2", name: "The Soothsayer", tier: "1f410", stil: "Fortune Teller", text: "Sees the future. And likes to snack on shoes.", w: [25, 36, 42, 93, 58], angriff: ["wirbel", "Glimpse of the Future", "#c58bff"] },
    { id: "F3", name: "Zeng", tier: "1fabf", stil: "Messenger", text: "The nervous messenger of the Jade Palace.", w: [18, 86, 22, 30, 40], angriff: ["werfen", "Urgent Message", "#f5e6c8", "📜"] },
    { id: "F4", name: "Han", tier: "1f994", stil: "Trickster Master", text: "Zhen's mentor with plenty of tricks up his shell.", w: [56, 70, 82, 74, 72], angriff: ["wirbel", "Rolling Ball", "#c08a4a"] },
    { id: "G1", name: "Lei Lei", tier: "1f43c", stil: "Panda Cub", text: "The littlest one in the village. Cuddles with everyone.", w: [20, 58, 30, 70, 50], angriff: ["werfen", "Cuddle Attack", "#ffb7d5", "💕"] },
    { id: "G2", name: "Grandma Panda", tier: "1f43c", stil: "Wise Grandmother", text: "Knows all the old stories. And all the recipes.", w: [35, 22, 48, 85, 66], angriff: ["werfen", "Dumpling Hail", "#f5e6c8", "🥟"] },
    { id: "H1", name: "Fenghuang", tier: "1f989", stil: "Shadow Wing", text: "A dangerous owl seeking power over the Five.", w: [64, 90, 88, 84, 68], selten: true, angriff: ["nebel", "Shadow Wing", "#b07cff"] },
    { id: "H2", name: "Temutai", tier: "1f403", stil: "Yak Warlord", text: "Stubborn, loud and leader of a whole horde.", w: [93, 50, 66, 52, 90], angriff: ["beben", "Horde Stampede", "#8a5a3a"] },
    { id: "H3", name: "Taotie", tier: "1f417", stil: "Inventor Villain", text: "Keeps building new machines to conquer the Jade Palace.", w: [58, 44, 76, 60, 64], angriff: ["werfen", "Invention", "#c9c9d6", "⚙️"] },
    { id: "H4", name: "Master Bear", tier: "1f43b", stil: "Jade Warrior", text: "A master whose chi was stolen. Hard as stone.", w: [90, 54, 68, 40, 93], angriff: ["regen", "Jade Hail", "#3ee08f"] },
  ],
};

const DRAGONS = {
  id: "dragons",
  name: "Dragons: Riders of Berk",
  icon: "🐲",
  lizenz: "Characters © DreamWorks Animation",
  beschreibung: "Toothless, Stormfly & co. The dragons of Berk and their greatest foes.",
  platzhalter: true,
  werte: [{ id: "atem", name: "Firepower", icon: "🔥" }, { id: "tempo", name: "Speed", icon: "💨", einheit: "km/h" }, { id: "panzer", name: "Armor", icon: "🛡️" }, { id: "spannweite", name: "Wingspan", icon: "📏", einheit: "m" }, { id: "klugheit", name: "Intelligence", icon: "🧠" }],
  gruppen: [
    { id: "A", name: "Riders' Dragons", icon: "🛡️", element: "feuer", farbe: "#d9381e", farbe2: "#ffc247" },
    { id: "B", name: "Friends of Berk", icon: "⛵", element: "wind", farbe: "#1f9e7a", farbe2: "#b6f5d8" },
    { id: "C", name: "Giants", icon: "🌋", element: "stein", farbe: "#8a5a3a", farbe2: "#f0c58a" },
    { id: "D", name: "Dangerous Species", icon: "⚡", element: "blitz", farbe: "#6b3fd4", farbe2: "#ffe14d" },
    { id: "E", name: "Small & Swift", icon: "💨", element: "schatten", farbe: "#2b2a5e", farbe2: "#7fe3ff" },
    { id: "F", name: "Dragons of Berk", icon: "🏘️", element: "feuer", farbe: "#b5562b", farbe2: "#ffd59e" },
    { id: "G", name: "Mighty Species", icon: "🌋", element: "licht", farbe: "#c97a00", farbe2: "#ffe58a" },
    { id: "H", name: "Night Hunters", icon: "🌙", element: "eis", farbe: "#3a4f8a", farbe2: "#c7e3ff" },
  ],
  karten: [
    { id: "A1", name: "Toothless", tier: "1f409", stil: "Night Fury", text: "Hiccup's dragon. The fastest and rarest dragon of all.", w: [92, 300, 60, 14, 95], selten: true, angriff: ["feuerball", "Plasma Blast", "#7c6bff"] },
    { id: "A2", name: "Stormfly", tier: "1f409", stil: "Deadly Nadder", text: "Astrid's dragon. Shoots venomous spines from her tail.", w: [80, 200, 70, 13, 72], angriff: ["stacheln", "Spine Volley", "#38c6ff"] },
    { id: "A3", name: "Meatlug", tier: "1f409", stil: "Gronckle", text: "Fishlegs' dragon. Eats rocks and spits lava.", w: [76, 60, 93, 7, 66], angriff: ["feuerball", "Lava Blast", "#ff7a1a"] },
    { id: "A4", name: "Hookfang", tier: "1f409", stil: "Monstrous Nightmare", text: "Snotlout's dragon. Sets himself on fire.", w: [88, 160, 62, 19, 52], angriff: ["strahl", "Flame Skin", "#ff4d2e"] },
    { id: "B1", name: "Barf and Belch", tier: "1f409", stil: "Hideous Zippleback", text: "One head breathes gas, the other lights it. Ruffnut and Tuffnut argue constantly.", w: [86, 150, 55, 16, 44], angriff: ["nebel", "Gas and Spark", "#9be15d"] },
    { id: "B2", name: "Light Fury", tier: "1f409", stil: "Light Fury", text: "Can turn invisible with her own fire.", w: [90, 290, 55, 14, 90], selten: true, angriff: ["strahl", "Cloaking Fire", "#bfe9ff"] },
    { id: "B3", name: "Cloudjumper", tier: "1f409", stil: "Stormcutter", text: "Valka's dragon with four wings.", w: [82, 220, 70, 18, 88], angriff: ["wirbel", "Fire Whirl", "#ff9f1c"] },
    { id: "B4", name: "Skullcrusher", tier: "1f409", stil: "Rumblehorn", text: "Tracks down any trail with his nose.", w: [62, 140, 86, 12, 80], angriff: ["sprung", "Ram Charge", "#a88a63"] },
    { id: "C1", name: "Red Death", tier: "1f409", stil: "Queen of the Nest", text: "As big as a mountain. Ruled over the dragon nest.", w: [99, 90, 99, 120, 40], selten: true, angriff: ["strahl", "Inferno", "#ff2d1a"] },
    { id: "C2", name: "Bewilderbeast", tier: "1f409", stil: "Alpha", text: "Commands all dragons and breathes ice instead of fire. Cannot fly.", w: [95, 30, 100, 0, 92], selten: true, angriff: ["eis", "Ice Breath", "#bff3ff"] },
    { id: "C3", name: "Screaming Death", tier: "1f409", stil: "Tunneler", text: "Burrows through rock with a deafening scream.", w: [90, 120, 88, 12, 34], angriff: ["welle", "Death Scream", "#ffffff"] },
    { id: "C4", name: "Typhoomerang", tier: "1f409", stil: "Spinning Fire Dragon", text: "Spins in flight and hurls a whirlwind of fire.", w: [92, 180, 66, 28, 60], angriff: ["wirbel", "Fire Tornado", "#ff6a2a"] },
    { id: "D1", name: "Skrill", tier: "1f409", stil: "Lightning Dragon", text: "Rides thunderstorms and breathes lightning.", w: [97, 250, 74, 14, 68], selten: true, angriff: ["blitz", "Lightning Strike", "#ffe14d"] },
    { id: "D2", name: "Whispering Death", tier: "1f409", stil: "Tunnel Dragon", text: "Has rings of teeth and lives underground.", w: [70, 130, 80, 8, 50], angriff: ["beben", "Tunnel Attack", "#8a6a4a"] },
    { id: "D3", name: "Deathgripper", tier: "1f409", stil: "Hunter Dragon", text: "A dangerous hunter with powerful pincers.", w: [86, 200, 85, 18, 58], angriff: ["stacheln", "Venom Stinger", "#b07cff"] },
    { id: "D4", name: "Thunderdrum", tier: "1f409", stil: "Sea Dragon", text: "Its roar is as loud as a thunderclap.", w: [78, 170, 64, 15, 54], angriff: ["welle", "Thunder Roar", "#38a8ff"] },
    { id: "E1", name: "Terrible Terror", tier: "1f409", stil: "Tiny Dragon", text: "Small as a cat and just as cheeky.", w: [40, 110, 20, 1, 56], angriff: ["feuerball", "Mini Fire Blast", "#ffb23d"] },
    { id: "E2", name: "Night Lights", tier: "1f409", stil: "Dragon Hatchlings", text: "The offspring of Toothless and the Light Fury.", w: [68, 260, 40, 6, 84], angriff: ["regen", "Spark Rain", "#7fe3ff"] },
    { id: "E3", name: "Changewing", tier: "1f409", stil: "Camouflage Dragon", text: "Changes its color to match its surroundings.", w: [72, 150, 46, 9, 78], angriff: ["nebel", "Acid Spray", "#c3f73a"] },
    { id: "E4", name: "Windshear", tier: "1f409", stil: "Razorwhip", text: "Her wings and tail are as sharp as blades.", w: [66, 230, 86, 16, 72], angriff: ["stacheln", "Blade Throw", "#d6dde6"] },
    { id: "F1", name: "Grump", tier: "1f409", stil: "Hotburple", text: "Gobber's dragon. Prefers sleeping while glowing quietly.", w: [80, 50, 88, 9, 30], angriff: ["feuerball", "Ember Lump", "#ff7a1a"] },
    { id: "F3", name: "Torch", tier: "1f409", stil: "Young Typhoomerang", text: "A playful fire dragon that leaves scorch marks everywhere.", w: [84, 165, 58, 22, 50], angriff: ["wirbel", "Spark Whirl", "#ffb23d"] },
    { id: "F4", name: "Fireworm Queen", tier: "1f409", stil: "Fireworm", text: "Her whole body burns. Rules over thousands of fireworms.", w: [96, 140, 50, 12, 70], selten: true, angriff: ["strahl", "Blazing Body", "#ffd23f"] },
    { id: "G1", name: "Eruptodon", tier: "1f409", stil: "Titan Wing", text: "Eats lava and protects a whole island from its volcano.", w: [88, 60, 97, 45, 58], selten: true, angriff: ["beben", "Lava Eater", "#ff6a2a"] },
    { id: "G2", name: "Death Song", tier: "1f409", stil: "Luring Dragon", text: "Lures other dragons with its song and traps them in amber.", w: [86, 190, 66, 24, 84], angriff: ["chi", "Amber Song", "#ffb347", "🎵"] },
    { id: "G3", name: "Catastrophic Quaken", tier: "1f409", stil: "Earthquake Dragon", text: "Curls up and crashes into the ground like a meteor.", w: [82, 110, 95, 20, 40], angriff: ["beben", "Meteor Impact", "#a88a63"] },
    { id: "G4", name: "Shockjaw", tier: "1f409", stil: "Electric Sea Dragon", text: "Lives in the sea and shoots electric water jets.", w: [84, 150, 68, 18, 54], angriff: ["blitz", "Shock Beam", "#7fe3ff"] },
    { id: "H1", name: "Snow Wraith", tier: "1f409", stil: "Snow Ghost", text: "Invisible in a blizzard. Senses heat from far away.", w: [80, 240, 66, 20, 76], angriff: ["eis", "Frost Bolt", "#e3f8ff"] },
    { id: "H2", name: "Night Terror", tier: "1f409", stil: "Swarm Dragon", text: "Many small dragons that together form the shape of a giant one.", w: [56, 210, 30, 3, 80], angriff: ["regen", "Swarm Attack", "#9aa5b1", "🦇"] },
    { id: "H3", name: "Speed Stinger", tier: "1f409", stil: "Paralyzing Dragon", text: "Runs at lightning speed and paralyzes with its stinger.", w: [44, 270, 42, 2, 66], angriff: ["stacheln", "Paralyzing Sting", "#c3f73a"] },
    { id: "H4", name: "Smothering Smokebreath", tier: "1f409", stil: "Smoke Dragon", text: "Hides in thick smoke and collects metal.", w: [58, 120, 54, 6, 74], angriff: ["nebel", "Smoke Wall", "#8d8da3"] },
  ],
};

const DECKS = { kungfupanda: KUNGFUPANDA, dragons: DRAGONS };
// Gruppe aus der Karten-ID (A1 → A) ableiten, Angriff als Objekt
for (const deck of Object.values(DECKS)) {
  for (const k of deck.karten) {
    k.gruppe = k.id[0];
    const [art, name, farbe, objekt] = k.angriff;
    k.angriff = { art, name, farbe: farbe || null, objekt: objekt || null };
  }
}
module.exports = { DECKS };
