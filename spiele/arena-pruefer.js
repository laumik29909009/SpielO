// =============================================================
//  Arena: Antworten, die nicht in unseren Listen stehen, über Wikipedia prüfen
//  (wie der Schiedsrichter bei Stadt Land Fluss). Passt die Kurzbeschreibung
//  oder der erste Satz des Artikels zur Aufgabe, gilt die Antwort.
//  Einmal anerkannte Antworten merkt sich der Server ("gelernt").
// =============================================================
const fs = require("fs");
const os = require("os");
const path = require("path");

const UA = { "User-Agent": "SpielO/1.0 (privates Partyspiel; Antwortpruefung)" };

// Welche Wörter in Beschreibung/erstem Satz zur Aufgabe passen.
// Aufgaben ohne Eintrag (z. B. Ausreden, Hobbys) werden nicht über Wikipedia geprüft.
const R = (s) => new RegExp(s, "i");
const REGELN = {
  pasta: R("nudel|teigware|pasta"),
  haustier: R("haustier|hunderasse|katzenrasse|nagetier|kaninchen|papagei|sittich|zierfisch|aquarienfisch|schildkröte|echse|schlange|amphib|vogelart|tierart|säugetier|reptil"),
  hauptstadt: R("hauptstadt"),
  obst: R("obst|frucht|früchte|beere|zitrus|steinobst|kernobst"),
  fussballverein: R("fußballverein|fußballklub|fußballclub|sportverein|fußballmannschaft"),
  beruf: R("beruf|ausbildungsberuf|berufsbezeichnung|handwerk"),
  farbe: R("farbe|farbton|farbbezeichnung"),
  instrument: R("musikinstrument|blasinstrument|saiteninstrument|schlaginstrument|tasteninstrument|zupfinstrument|streichinstrument|idiophon|membranophon|aerophon|chordophon"),
  gemuese: R("gemüse|kohlsorte|blattsalat|knollen|rübe|hülsenfrucht|wurzelgemüse|kulturpflanze|nutzpflanze"),
  sportart: R("sportart|sport |sportdisziplin|kampfsport|ballsport|ballspiel|kampfkunst|wassersport|wintersport|disziplin der leichtathletik"),
  vogel: R("vogel|vogelart|singvogel|greifvogel|eulenart|entenart|papageienart"),
  schulfach: R("schulfach|unterrichtsfach"),
  planet: R("planet|mond des|zwergplanet|asteroid|komet|kleinplanet|himmelskörper|trojaner|transneptun"),
  kuechengeraet: R("küchengerät|küchenutensil|küchenhelfer|haushaltsgerät|kochgeschirr|besteck|geschirr|küchenmaschine"),
  automarke: R("automarke|automobilhersteller|automobilmarke|fahrzeughersteller|pkw-marke|autohersteller"),
  superheld: R("superheld|comicfigur|comic-figur|comicserie|figur aus dem marvel|figur des dc"),
  baum: R("baum|baumart|laubbaum|nadelbaum|gehölz"),
  suessigkeit: R("süßigkeit|süßware|schokolade|bonbon|konfekt|praline|fruchtgummi|lakritz|gebäck|dessert|zuckerware"),
  land_afrika: R("staat (in|im) .*afrika|afrikanischer staat|land (in|im) .*afrika|binnenstaat in .*afrika|inselstaat .*afrika"),
  koerperteil: R("körperteil|organ|knochen|muskel|anatomie|gelenk|des menschlichen körpers"),
  gewuerz: R("gewürz|küchenkraut|würzkraut|würzmittel|heilpflanze"),
  brettspiel: R("brettspiel|gesellschaftsspiel|kartenspiel|würfelspiel|legespiel|strategiespiel|partyspiel"),
  hunderasse: R("hunderasse"),
  fruehstueck: R("frühstück|lebensmittel|backware|brotaufstrich|getreideprodukt|milchprodukt|wurst|käse|gericht"),
  tier_afrika: R("tierart|säugetier|vogelart|reptil|antilope|primat|raubtier|huftier|art der"),
  erfindung: R("erfindung|gerät|apparat|maschine|werkzeug|technik|verfahren"),
  getraenk: R("getränk|spirituose|likör|bier|weinsorte|cocktail|limonade|softdrink|saft|teesorte|kaffeespezialität|kaffeegetränk"),
  stadt_deutschland: R("stadt (in|im) .*(deutschland|bayern|baden|hessen|sachsen|thüringen|niedersachsen|nordrhein|westfalen|rheinland|pfalz|saarland|brandenburg|mecklenburg|holstein|schleswig|berlin|hamburg|bremen)|großstadt in deutschland|kreisfreie stadt|kreisstadt|große kreisstadt"),
  nachname: R("familienname|nachname"),
  im_meer: R("fisch|meeres|meer|wal|hai|qualle|krebs|krebstier|muschel|schnecke|koralle|robbe|tintenfisch|kopffüßer|stachelhäuter|nesseltier"),
  marke_kleidung: R("modemarke|bekleidungsmarke|bekleidungshersteller|modeunternehmen|modelabel|sportartikelhersteller|schuhhersteller|schuhmarke|textilunternehmen|modehaus"),
  tanz: R("tanz|gesellschaftstanz|volkstanz|tanzstil"),
  wetter: R("wetter|meteorolog|wind|niederschlag|wolke|sturm|wettererscheinung|wetterphänomen|optische erscheinung"),
  kinderserie: R("zeichentrickserie|fernsehserie|animationsserie|kinderserie|anime|kindersendung|trickfilmserie"),
  blume: R("blume|blütenpflanze|zierpflanze|pflanzenart|pflanzengattung|staude"),
  gemeinsam_k: { anfang: "kopf" },
  eissorte: R("speiseeis|eissorte|frucht|obst|nuss|gewürz|schokolade|süßspeise"),
  wasserkoerper: R("fluss|nebenfluss|strom"),
  kartenspiel: R("kartenspiel"),
  kaese: R("käse|käsesorte|weichkäse|hartkäse|schnittkäse|frischkäse"),
  tier_wald: R("tierart|säugetier|vogel|käfer|insekt|amphib|reptil|schnecke|spinne|schmetterling|falter"),
  fastfood: R("gericht|speise|imbiss|fast food|fastfood|spezialität|sandwich|snack|streetfood"),
  klasse_tier: R("säugetier|säuger|raubtier|nagetier|huftier|primat|beuteltier|wal |walart|robbe"),
  schule_mitnehmen: R("schreibgerät|stift|büromaterial|schreibwaren|zeichengerät"),
  gefuehl: R("gefühl|emotion|empfindung|affekt|gemütszustand|stimmung"),
  verkehrsmittel: R("verkehrsmittel|fahrzeug|schiff|boot|flugzeug|fahrrad|schienenfahrzeug|kraftfahrzeug|luftfahrzeug"),
  musik_genre: R("musikrichtung|musikgenre|genre|stilrichtung|musikstil"),
  grillen: R("lebensmittel|fleisch|wurst|gemüse|gericht|fisch|käse|obst|frucht"),
  deutsche_band: R("(deutsche|deutsch).*(band|musikgruppe|gruppe)|(band|musikgruppe) aus (deutschland|berlin|hamburg|köln|münchen)"),
  romanfigur: R("märchen|märchenfigur|sagengestalt|sagenfigur"),
  staat_usa: R("bundesstaat"),
  schlafzimmer: R("möbel|möbelstück|einrichtungsgegenstand|bettwäsche|leuchte|lampe"),
  insekt: R("insekt|käfer|schmetterling|falter|fliege|mücke|wespe|biene|ameise|heuschrecke|wanze|libelle|zikade|laus"),
  film_deutsch: R("deutsche[rn]? .*film|film .*(deutsch|aus deutschland)|deutscher spielfilm|deutsche komödie"),
  pizza: R("lebensmittel|gemüse|käse|wurst|fleisch|pilz|fisch|frucht|gewürz|kraut|sauce|soße"),
  kneipe: R("getränk|spirituose|bier|likör|wein|gericht|speise|snack|cocktail"),
  bauernhof: R("nutztier|haustier|rasse|geflügel|haustierrasse|rinderrasse|schweinerasse|schafrasse|ziegenrasse|pferderasse|hühnerrasse"),
  comedy: R("komiker|kabarettist|comedian|entertainer|satiriker|humorist|komikerin|kabarettistin"),
  buch_klassiker: R("roman|buch|erzählung|novelle|drama|kinderbuch|jugendbuch|werk von|epos"),
  fahrzeug_teil: R("bauteil|kraftfahrzeug|fahrzeugtechnik|komponente|automobil|teil eines|motorteil"),
  ende_ball: { ende: "ball" },
  brot: R("brot|brötchen|backware|gebäck|kleingebäck|brotsorte"),
};

const norm = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// ---------- Gelernte Antworten (überlebt Neustarts nur, solange die Datei bleibt) ----------
const DATEI = process.env.ARENA_LERN_DATEI || path.join(os.tmpdir(), "spielo-arena-gelernt.json");
let GELERNT = {};
try { GELERNT = JSON.parse(fs.readFileSync(DATEI, "utf8")) || {}; } catch {}
let speichernTimer = null;
function lernen(aufgabeId, text, anzeige, quelle) {
  const n = norm(text);
  if (!n) return;
  (GELERNT[aufgabeId] ||= {})[n] = { anzeige, quelle, t: Date.now() };
  clearTimeout(speichernTimer);
  speichernTimer = setTimeout(() => fs.writeFile(DATEI, JSON.stringify(GELERNT), () => {}), 1000);
}
const gelernt = (aufgabeId, text) => GELERNT[aufgabeId]?.[norm(text)] || null;

// ---------- Wikipedia ----------
let fetchFn = (...a) => fetch(...a); // austauschbar für Tests
const CACHE = new Map();
async function anfrage(parameter) {
  const url = "https://de.wikipedia.org/w/api.php?" + new URLSearchParams({ format: "json", formatversion: "2", ...parameter });
  const r = await fetchFn(url, { headers: UA, signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error("Wikipedia " + r.status);
  return r.json();
}
// Beschreibung + erster Satz für bis zu einige Titel (mit Weiterleitungen)
async function seiten(titel) {
  const j = await anfrage({ action: "query", prop: "description|extracts|pageprops", ppprop: "disambiguation", exintro: "1", explaintext: "1", exsentences: "2", redirects: "1", titles: titel.join("|") });
  return (j.query?.pages || []).filter((p) => !p.missing && !p.invalid).map((p) => ({ titel: p.title, text: `${p.description || ""} ${p.extract || ""}`, mehrdeutig: !!p.pageprops?.disambiguation }));
}
async function suche(text) {
  const j = await anfrage({ action: "query", list: "search", srsearch: text, srlimit: "4", srnamespace: "0" });
  return (j.query?.search || []).map((s) => s.title);
}
const grossAnfang = (t) => t.replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
function nah(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  if (a === b || b.startsWith(a) || a.startsWith(b)) return true;
  const g = a.length >= 8 ? 2 : 1;
  // einfacher Abstand
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= g;
}

// Ergebnis: { anzeige, quelle } oder null
async function pruefen(aufgabeId, text) {
  const regel = REGELN[aufgabeId];
  text = String(text || "").trim();
  if (!regel || text.length < 2) return null;
  const vorher = gelernt(aufgabeId, text);
  if (vorher) return vorher;
  const key = aufgabeId + ":" + norm(text);
  if (CACHE.has(key)) return CACHE.get(key);
  let ergebnis = null;
  try {
    // Wortaufgaben ("beginnt mit Kopf", "endet auf -ball"): Form prüfen, dann muss es das Wort geben
    if (regel.anfang || regel.ende) {
      const n = norm(text);
      const passt = regel.anfang ? n.startsWith(regel.anfang) && n.length > regel.anfang.length + 2 : n.endsWith(regel.ende) && n.length > regel.ende.length + 2;
      if (passt) {
        const s = await seiten([grossAnfang(text)]);
        const treffer = s.find((p) => !p.mehrdeutig) || s[0];
        if (treffer || (await suche(text)).some((t) => nah(t, text))) ergebnis = { anzeige: treffer?.titel || grossAnfang(text), quelle: "Wikipedia" };
      }
    } else {
      const kandidaten = [...new Set([grossAnfang(text), text.charAt(0).toUpperCase() + text.slice(1)])];
      let s = await seiten(kandidaten);
      let treffer = s.find((p) => !p.mehrdeutig && regel.test(p.text));
      // Nicht gefunden oder mehrdeutig: Suche (fängt auch Tippfehler ab), Titel muss zur Eingabe passen
      if (!treffer) {
        const titel = (await suche(text)).filter((t) => nah(t, text) || nah(t.split(/[ (]/)[0], text));
        if (titel.length) { s = await seiten(titel.slice(0, 3)); treffer = s.find((p) => !p.mehrdeutig && regel.test(p.text)); }
      }
      if (treffer) ergebnis = { anzeige: treffer.titel.replace(/\s*\(.*\)$/, ""), quelle: "Wikipedia" };
    }
  } catch { return null; } // Wikipedia nicht erreichbar: lieber nichts behaupten (nicht im Cache merken)
  CACHE.set(key, ergebnis);
  if (CACHE.size > 3000) CACHE.delete(CACHE.keys().next().value);
  if (ergebnis) lernen(aufgabeId, text, ergebnis.anzeige, ergebnis.quelle);
  return ergebnis;
}

module.exports = { pruefen, lernen, gelernt, REGELN, _setFetch: (f) => { fetchFn = f; } };
