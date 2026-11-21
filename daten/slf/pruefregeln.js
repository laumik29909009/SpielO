// =============================================================
//  Prüfregeln für Stadt Land Fluss
//  de / en:   Wörter, die in der Wikipedia-Beschreibung (oder dem
//             ersten Satz des Artikels) vorkommen müssen, damit die
//             Antwort zur Kategorie passt.
//  eigenname: Was Wikipedia gar nicht kennt, ist sehr wahrscheinlich
//             falsch (Städte, Promis, Filme ...).
//  listen:    Welche Wortlisten aus woerter.js dazugehören.
//  Kategorien ohne Eintrag (z. B. kreative) werden nur auf den
//  Anfangsbuchstaben geprüft, den Rest entscheidet die Abstimmung.
// =============================================================
const R = (s) => new RegExp(s, "i");

module.exports = {
  stadt: { de: R("stadt|gemeinde|metropole|ortschaft|kommune|siedlung|city|ort in|ort im|ortsteil|marktgemeinde|kreisstadt|millionenstadt|großstadt"), en: R("city|town|capital|municipality|metropolis|village|commune|settlement|borough"), eigenname: true, listen: ["stadt", "hauptstadt"] },
  hauptstadt: { de: R("hauptstadt"), en: R("capital"), eigenname: true, listen: ["hauptstadt"] },
  land: { de: R("staat|land in|land im|königreich|republik|fürstentum|emirat|sultanat|landesteil|bundesstaat|nation|inselstaat|binnenstaat"), en: R("country|state|kingdom|republic|nation|principality|emirate"), eigenname: true, listen: ["land"] },
  fluss: { de: R("fluss|strom|nebenfluss|gewässer|bach|kanal"), en: R("river|stream|tributary|creek"), eigenname: true, listen: ["fluss"] },
  name: { de: R("vorname|männlich|weiblich|name"), en: R("given name|name|masculine|feminine"), listen: ["name"] },
  tier: { de: R("familie|gattung|art |art der|art aus|tierart|ordnung|säugetier|vogel|fisch|insekt|reptil|amphib|spinne|tier|rasse|unterart|weichtier|krebs|wal|hund|katze|schlange|käfer|schmetterling|affe|raubtier|nagetier|huftier|beuteltier"), en: R("species|genus|family|animal|bird|fish|insect|reptile|mammal|breed|order of"), listen: ["tier"] },
  beruf: { de: R("beruf|tätig|fachkraft|handwerk|arzt|ärztin|person, die|bezeichnung für|tätigkeit|ausbildung|amt|berufsbezeichnung|mitarbeiter|angestellt"), en: R("occupation|profession|job|worker|person who"), listen: ["beruf"] },
  pflanze: { de: R("pflanze|gattung|art |art der|baum|blume|strauch|kraut|gewächs|familie|gemüse|obst|gras|kaktus|palme|blüte|zierpflanze|kulturpflanze"), en: R("plant|species|genus|tree|flower|shrub|herb"), listen: ["pflanze", "baum", "obst", "gewuerz"] },
  baum: { de: R("baum|gehölz|gattung|art der|familie|nadelbaum|laubbaum"), en: R("tree|genus|species"), listen: ["baum"] },
  essen: { de: R("gericht|speise|lebensmittel|gebäck|frucht|obst|gemüse|süß|wurst|käse|brot|kuchen|suppe|nahrung|küche|spezialität|snack|soße|sauce|nudel|teigware|fleisch|dessert|eis|backware|eintopf|salat|beilage|frühstück"), en: R("dish|food|cuisine|pastry|bread|cake|soup|sauce|snack|dessert|meal"), listen: ["essen", "obst", "suess"] },
  obst: { de: R("frucht|obst|gemüse|beere|kulturpflanze|pflanze|art der|zitrus|kohl|knolle|hülsenfrucht"), en: R("fruit|vegetable|berry|plant|species"), listen: ["obst"] },
  suess: { de: R("süß|schokolade|bonbon|gebäck|süßware|riegel|marke|kaugummi|praline|keks|dessert|lakritz|fruchtgummi"), en: R("candy|chocolate|confection|sweet|biscuit|cookie|brand"), listen: ["suess"] },
  getraenk: { de: R("getränk|cocktail|likör|bier|wein|spirituose|limonade|saft|tee|kaffee|schnaps|brand|softdrink|milch|mineralwasser|erfrischungsgetränk"), en: R("drink|beverage|cocktail|liqueur|beer|wine|spirit|soda|juice|tea|coffee"), listen: ["getraenk", "cocktail"] },
  cocktail: { de: R("cocktail|likör|spirituose|schnaps|brand|branntwein|getränk|whisky|wodka|rum|gin"), en: R("cocktail|liqueur|spirit|liquor|drink|whisky|vodka|rum|gin"), listen: ["cocktail"] },
  gewuerz: { de: R("gewürz|kraut|pflanze|art der|gattung|würz|samen"), en: R("spice|herb|plant|seasoning"), listen: ["gewuerz"] },
  kleidung: { de: R("kleid|bekleidung|schuh|kopfbedeckung|hose|jacke|mantel|textil|mode|accessoire|unterwäsche|tracht"), en: R("garment|clothing|shoe|hat|dress|jacket|coat|trousers"), listen: ["kleidung"] },
  koerperteil: { de: R("körper|organ|knochen|muskel|anatom|gelenk|drüse|gewebe|gliedmaße"), en: R("body|organ|bone|muscle|anatom|joint|gland"), listen: ["koerperteil"] },
  farbe: { de: R("farb|ton|pigment"), en: R("colou?r|shade|pigment"), listen: ["farbe"] },
  haushalt: { de: R("gerät|gegenstand|möbel|werkzeug|küche|haushalt|behälter|utensil|apparat|maschine|geschirr|besteck"), en: R("device|appliance|tool|utensil|furniture|container|kitchen"), listen: ["haushalt", "moebel", "werkzeug"] },
  moebel: { de: R("möbel|sitz|liege|schrank|tisch|regal|bett|einrichtung"), en: R("furniture|chair|table|bed|cabinet|shelf|sofa"), listen: ["moebel"] },
  werkzeug: { de: R("werkzeug|gerät|maschine|handwerk|instrument|zange|säge"), en: R("tool|device|instrument"), listen: ["werkzeug"] },
  fahrzeug: { de: R("fahrzeug|auto|wagen|schiff|boot|flugzeug|zug|bahn|rad|motorrad|bus|lkw|kraftfahrzeug|luftfahrzeug|transportmittel"), en: R("vehicle|car|ship|boat|aircraft|train|bicycle|motorcycle|bus|truck"), listen: ["fahrzeug"] },
  schulfach: { de: R("schulfach|unterrichtsfach|fach|wissenschaft|lehre|disziplin|kunde"), en: R("subject|discipline|science|study"), listen: ["schulfach"] },
  hobby: { de: R("hobby|freizeit|sport|spiel|tätigkeit|beschäftigung|kunst|handarbeit|sammeln"), en: R("hobby|leisure|sport|game|activity|craft"), listen: ["hobby", "sportart"] },
  gefuehl: { de: R("gefühl|emotion|empfindung|gemütszustand|stimmung|affekt"), en: R("emotion|feeling|mood"), listen: ["gefuehl"] },
  kuehlschrank: { listen: ["kuehlschrank", "obst", "essen", "getraenk"] },
  supermarkt: { listen: ["kuehlschrank", "obst", "essen", "getraenk", "suess", "gewuerz", "haushalt"] },
  urlaub: { listen: ["urlaub", "kleidung"] },
  promi: { de: R("schauspieler|sänger|musiker|politiker|fußball|moderator|rapper|unternehmer|youtuber|influencer|sportler|spieler|schriftsteller|model|komiker|regisseur|künstler|fernseh|tennis|basketball|rennfahrer|komponist|autor|\\(\\*|webvideoproduzent|entertainer"), en: R("actor|actress|singer|musician|politician|footballer|presenter|rapper|businessman|youtuber|influencer|athlete|player|writer|model|comedian|director|artist|born"), eigenname: true, listen: ["promi", "musik", "sportler", "fussballer", "youtuber", "historisch"] },
  crush: { de: R("schauspieler|sänger|musiker|model|fußball|sportler|rapper|moderator|influencer|\\(\\*"), en: R("actor|actress|singer|model|footballer|athlete|rapper|born"), eigenname: true, listen: ["promi", "musik", "sportler", "fussballer"] },
  film: { de: R("film|serie|fernseh|zeichentrick|anime|sitcom|staffel|show|franchise|filmreihe|miniserie"), en: R("film|movie|series|television|sitcom|anime|show|franchise"), eigenname: true, listen: ["film"] },
  musik: { de: R("band|sänger|musiker|rapper|musikgruppe|komponist|dj|pop|rock|duo|gruppe|singer|interpret|liedermacher|produzent"), en: R("band|singer|musician|rapper|group|composer|dj|duo|songwriter|producer"), eigenname: true, listen: ["musik"] },
  song: { de: R("lied|song|single|titel|hit|schlager|hymne|album"), en: R("song|single|track|hit|anthem"), eigenname: true },
  game: { de: R("spiel|game|videospiel|computerspiel|franchise|spielreihe|konsole"), en: R("video game|game|franchise|series"), eigenname: true, listen: ["game"] },
  zeichentrick: { de: R("figur|zeichentrick|comic|trickfilm|cartoon|anime|charakter|animations"), en: R("character|cartoon|animated|comic|anime|mascot"), eigenname: true, listen: ["zeichentrick", "disney", "superheld"] },
  superheld: { de: R("superheld|schurke|bösewicht|figur|comic|marvel|dc|antagonist|held"), en: R("superhero|supervillain|villain|character|comic|marvel|dc"), eigenname: true, listen: ["superheld"] },
  disney: { de: R("disney|pixar|figur|zeichentrick|animations|film|charakter"), en: R("disney|pixar|character|animated"), eigenname: true, listen: ["disney"] },
  youtuber: { de: R("youtuber|webvideoproduzent|influencer|streamer|twitch|tiktok|instagram|content|internet|webvideo|moderator"), en: R("youtuber|influencer|streamer|content creator|internet personality|tiktok"), eigenname: true, listen: ["youtuber"] },
  app: { de: R("app|website|webseite|plattform|dienst|soziales netzwerk|software|online|anwendung|internet|suchmaschine|messenger|streaming"), en: R("app|website|platform|service|social network|software|online|search engine|messaging|streaming"), eigenname: true, listen: ["app"] },
  marke: { de: R("marke|unternehmen|konzern|hersteller|firma|handelskette|label|kette|produkt|aktiengesellschaft|gmbh|discounter|warenhaus"), en: R("brand|company|corporation|manufacturer|retailer|chain|label"), eigenname: true, listen: ["marke", "automarke", "app"] },
  automarke: { de: R("automobil|automarke|autohersteller|fahrzeug|pkw|kraftfahrzeug|marke"), en: R("automobile|car|automaker|vehicle|manufacturer|marque"), eigenname: true, listen: ["automarke"] },
  buch: { de: R("roman|buch|schriftsteller|autor|autorin|erzählung|werk|literatur|dichter|kinderbuch|reihe"), en: R("novel|book|writer|author|poet|series"), eigenname: true, listen: ["buch"] },
  sportart: { de: R("sport|disziplin|kampfkunst|spiel|wettkampf|ballspiel|kampfsport|wassersport|wintersport"), en: R("sport|discipline|martial art|game"), listen: ["sportart"] },
  verein: { de: R("verein|klub|club|fußball|sport|mannschaft"), en: R("club|football|team|association"), eigenname: true, listen: ["verein"] },
  sportler: { de: R("sportler|spieler|fußball|tennis|basketball|rennfahrer|leichtathlet|schwimmer|boxer|skirennläufer|radrennfahrer|athlet|olympia|weltmeister|handball|golf|biathlet|turner"), en: R("athlete|player|footballer|tennis|basketball|racing driver|swimmer|boxer|cyclist|olympic"), eigenname: true, listen: ["sportler", "fussballer"] },
  fussballer: { de: R("fußball"), en: R("footballer|soccer|football"), eigenname: true, listen: ["fussballer"] },
  insel: { de: R("insel|atoll|archipel|eiland"), en: R("island|atoll|archipelago"), eigenname: true, listen: ["insel"] },
  gebirge: { de: R("berg|gebirge|gipfel|vulkan|massiv|höhenzug|mittelgebirge|bergkette"), en: R("mountain|range|peak|volcano|massif|summit|hill"), eigenname: true, listen: ["gebirge"] },
  sehenswuerdigkeit: { de: R("bauwerk|denkmal|turm|schloss|burg|kirche|dom|museum|brücke|palast|tempel|platz|kathedrale|statue|wahrzeichen|park|monument|sehenswürdigkeit|stadion|gebäude|welterbe|ruine|tor"), en: R("building|monument|tower|castle|church|cathedral|museum|bridge|palace|temple|square|statue|landmark|park|stadium|heritage"), eigenname: true, listen: ["sehenswuerdigkeit"] },
  sprache: { de: R("sprache|dialekt|mundart"), en: R("language|dialect"), eigenname: true, listen: ["sprache"] },
  element: { de: R("chemisches element|element"), en: R("chemical element|element"), eigenname: true, listen: ["element"] },
  krankheit: { de: R("krankheit|erkrankung|infektion|syndrom|störung|entzündung|leiden|symptom|virus|tumor|infektionskrankheit"), en: R("disease|disorder|infection|syndrome|illness|condition"), listen: ["krankheit"] },
  weltall: { de: R("planet|stern|galaxie|mond|komet|asteroid|sternbild|zwergplanet|nebel|weltraum|raumsonde|raumstation|satellit|astronom"), en: R("planet|star|galaxy|moon|comet|asteroid|constellation|nebula|space|spacecraft|satellite"), listen: ["weltall"] },
  erfindung: { de: R("erfindung|gerät|maschine|technik|technologie|apparat|verfahren|instrument|werkzeug|medium|fahrzeug"), en: R("invention|device|machine|technology|apparatus|instrument"), listen: ["erfindung"] },
  historisch: { de: R("kaiser|könig|königin|herrscher|politiker|feldherr|philosoph|wissenschaftler|physiker|erfinder|maler|komponist|papst|pharao|präsident|kanzler|reformator|entdecker|seefahrer|\\(\\*|†"), en: R("emperor|king|queen|ruler|politician|general|philosopher|scientist|physicist|inventor|painter|composer|pope|pharaoh|president|explorer"), eigenname: true, listen: ["historisch"] },
  maerchen: { de: R("märchen|sage|figur|gottheit|gott|held|fabelwesen|mytholog|gestalt|legende|göttin"), en: R("fairy tale|legend|myth|deity|god|goddess|hero|creature|character"), listen: ["maerchen"] },
  musikinstrument: { de: R("instrument|musikinstrument"), en: R("instrument"), listen: ["instrument"] },
  trinkspiel: { de: R("trinkspiel|spiel|kartenspiel|würfel"), en: R("drinking game|game"), listen: ["trinkspiel"] },
};
