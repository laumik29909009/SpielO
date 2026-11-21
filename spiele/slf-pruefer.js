// =============================================================
//  Stadt Land Fluss – der Schiedsrichter
//  1. Feste Regeln: leer, falscher Buchstabe, Buchstabensalat
//  2. Wortlisten mit Toleranz für kleine Tippfehler
//  3. Wikipedia (kostenlos, ohne Schlüssel):
//     a) deutscher Artikel: Kurzbeschreibung + erster Satz
//     b) sonst englischer Artikel (Filme, Bands, Spiele ...)
//     c) sonst Wikipedia-Suche, um Tippfehler zu korrigieren
//  Am Ende können die Spieler alles per Abstimmung korrigieren.
// =============================================================
const REGELN = require("../daten/slf/pruefregeln.js");

// ---------- Wortlisten zusammenführen ----------
const WOERTER = {};
for (const quelle of [require("../daten/slf/woerter.js"), require("../daten/slf/woerter-extra.js")]) {
  for (const [id, liste] of Object.entries(quelle)) WOERTER[id] = [...(WOERTER[id] || []), ...liste];
}

// ---------- Text normalisieren ----------
function normalisieren(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // Akzente entfernen (é → e)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const ARTIKEL = /^(der|die|das|den|dem|ein|eine|einen|the|le|la|les|l|el|il|lo)\s+/;
const ohneArtikel = (n) => n.replace(ARTIKEL, "");

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let vorher = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const aktuell = [i];
    for (let j = 1; j <= b.length; j++) {
      aktuell[j] = Math.min(vorher[j] + 1, aktuell[j - 1] + 1, vorher[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    vorher = aktuell;
  }
  return vorher[b.length];
}
const erlaubteFehler = (n) => (n.length >= 9 ? 2 : n.length >= 4 ? 1 : 0);

// ---------- Wortlisten vorbereiten (einmal beim Start) ----------
const LISTEN = {};
for (const [id, woerter] of Object.entries(WOERTER)) {
  const satz = new Map(); // normalisiert → Original
  for (const w of woerter) satz.set(ohneArtikel(normalisieren(w)), w);
  LISTEN[id] = satz;
}

// Eigene Kategorien mit bekanntem Namen ("Tiere", "Städte" ...) bekommen trotzdem Regeln und Listen
const SYNONYME = {
  stadt: ["stadt", "staedte", "grossstadt", "ort"], land: ["land", "laender", "staat"], fluss: ["fluss", "fluesse", "gewaesser"],
  name: ["name", "namen", "vorname", "vornamen", "jungenname", "maedchenname"], tier: ["tier", "tiere", "tierart"], beruf: ["beruf", "berufe", "job"],
  pflanze: ["pflanze", "pflanzen", "blume", "blumen"], essen: ["essen", "gericht", "speise", "lebensmittel", "gerichte"],
  getraenk: ["getraenk", "getraenke", "drink"], marke: ["marke", "marken", "firma", "unternehmen"], automarke: ["automarke", "auto", "automarken"],
  sportart: ["sport", "sportart", "sportarten"], farbe: ["farbe", "farben"], koerperteil: ["koerperteil", "koerperteile"],
  kleidung: ["kleidung", "kleidungsstueck"], musikinstrument: ["instrument", "musikinstrument"], verein: ["verein", "fussballverein"],
  hauptstadt: ["hauptstadt", "hauptstaedte"], insel: ["insel", "inseln"], element: ["element", "chemisches element"],
  film: ["film", "filme", "serie", "serien", "kinofilm"], musik: ["band", "saenger", "musiker", "saengerin", "rapper", "kuenstler"],
  promi: ["promi", "promis", "beruehmte person", "star", "prominente"], obst: ["obst", "gemuese", "frucht"],
  game: ["videospiel", "spiel", "game", "computerspiel"], buch: ["buch", "autor", "roman", "schriftsteller"],
  sehenswuerdigkeit: ["sehenswuerdigkeit", "bauwerk", "wahrzeichen"], krankheit: ["krankheit", "krankheiten"], baum: ["baum", "baeume"],
};

function regelFuer(kat) {
  if (REGELN[kat.id]) return REGELN[kat.id];
  const n = normalisieren(kat.name);
  for (const [id, namen] of Object.entries(SYNONYME)) if (namen.includes(n) && REGELN[id]) return REGELN[id];
  return null;
}

function listenFuer(kat) {
  const r = regelFuer(kat);
  const ids = r?.listen || (LISTEN[kat.id] ? [kat.id] : []);
  return ids.map((id) => LISTEN[id]).filter(Boolean);
}

function inListen(listen, norm) {
  for (const l of listen) if (l.has(norm)) return { treffer: l.get(norm), exakt: true };
  const erlaubt = erlaubteFehler(norm);
  if (!erlaubt) return null;
  for (const l of listen) {
    for (const [wort, original] of l) {
      if (wort[0] === norm[0] && levenshtein(wort, norm) <= erlaubt) return { treffer: original, exakt: false };
    }
  }
  return null;
}

function beginntMit(text, buchstabe) {
  const b = buchstabe.toLowerCase();
  const n = normalisieren(text);
  return n.startsWith(b) || ohneArtikel(n).startsWith(b);
}

function istBuchstabensalat(norm) {
  const wort = norm.replace(/ /g, "");
  if (/(.)\1{3,}/.test(wort)) return true; // aaaa
  if (wort.length >= 5 && !/[aeiouy]/.test(wort)) return true; // keine Vokale
  if (/^(asdf|qwer|yxcv|hjkl)/.test(wort)) return true; // Tastatur-Geklimper
  return false;
}

// ---------- Stufe 1 + 2 ----------
function pruefeRegeln(buchstabe, kat, text) {
  const roh = String(text || "").trim();
  if (!roh) return { status: "leer", grund: "Keine Antwort", quelle: "regel" };
  const norm = ohneArtikel(normalisieren(roh));
  if (!beginntMit(roh, buchstabe)) return { status: "falsch", grund: `Fängt nicht mit ${buchstabe} an`, quelle: "regel" };
  if (norm.replace(/ /g, "").length < 2) return { status: "falsch", grund: "Zu kurz", quelle: "regel" };
  if (istBuchstabensalat(norm)) return { status: "falsch", grund: "Sieht nach Buchstabensalat aus", quelle: "regel" };

  const t = inListen(listenFuer(kat), norm);
  if (t) return {
    status: "ok", quelle: "liste", kanonisch: ohneArtikel(normalisieren(t.treffer)),
    grund: t.exakt ? "Steht in der Wortliste" : `Tippfehler? Gemeint ist wohl „${t.treffer}“`,
  };
  if (kat.frei) return { status: "ok", grund: "Kreativ-Kategorie: stimmt ab, ob's passt", quelle: "regel" };
  return { status: "unsicher", grund: "Nicht in der Wortliste, bitte prüfen", quelle: "regel" };
}

// ---------- Stufe 3: Wikipedia ----------
const UA = { "User-Agent": "SpielO/1.0 (privates Partyspiel; Antwortpruefung)" };
const CACHE = new Map(); // "de:Titel" → Seite oder null
const merke = (k, v) => { if (CACHE.size > 30000) CACHE.clear(); CACHE.set(k, v); };

async function wikiAnfrage(sprache, parameter) {
  const url = `https://${sprache}.wikipedia.org/w/api.php?` + new URLSearchParams({ format: "json", formatversion: "2", ...parameter });
  const holen = () => fetch(url, { headers: UA, signal: AbortSignal.timeout(7000) });
  let antwort = await holen();
  if (antwort.status === 429 || antwort.status >= 500) { // kurz warten, einmal neu versuchen
    await new Promise((r) => setTimeout(r, 1500));
    antwort = await holen();
  }
  if (!antwort.ok) throw new Error(`Wikipedia (${sprache}) antwortet nicht (${antwort.status})`);
  return (await antwort.json()).query || {};
}

// Holt Kurzbeschreibung + ersten Satz für viele Titel auf einmal
async function seitenInfos(sprache, titel) {
  const ergebnis = {};
  const offen = [];
  for (const t of titel) {
    if (CACHE.has(`${sprache}:${t}`)) ergebnis[t] = CACHE.get(`${sprache}:${t}`);
    else offen.push(t);
  }
  for (let i = 0; i < offen.length; i += 20) { // Wikipedia liefert Einleitungen für max. 20 Seiten pro Anfrage
    const gruppe = offen.slice(i, i + 20);
    const q = await wikiAnfrage(sprache, {
      action: "query", redirects: "1", titles: gruppe.join("|"),
      prop: "description|pageprops|extracts", ppprop: "disambiguation",
      exintro: "1", explaintext: "1", exsentences: "2", exlimit: "20",
    });
    const weiter = {};
    for (const x of [...(q.normalized || []), ...(q.redirects || [])]) weiter[x.from] = x.to;
    const seiten = Object.fromEntries((q.pages || []).map((p) => [p.title, p]));
    for (const t of gruppe) {
      let ziel = t;
      for (let n = 0; n < 3 && weiter[ziel]; n++) ziel = weiter[ziel];
      const p = seiten[ziel];
      const info = p && !p.missing && !p.invalid ? {
        titel: p.title,
        beschreibung: p.description || "",
        satz: (p.extract || "").replace(/\s+/g, " ").slice(0, 300),
        mehrdeutig: p.pageprops?.disambiguation !== undefined,
        sprache,
      } : null;
      ergebnis[t] = info;
      merke(`${sprache}:${t}`, info);
    }
  }
  return ergebnis;
}

// Wikipedia-Suche: findet den gemeinten Artikel bei Tippfehlern
async function sucheKorrektur(text) {
  const schluessel = `suche:${text}`;
  if (CACHE.has(schluessel)) return CACHE.get(schluessel);
  const q = await wikiAnfrage("de", { action: "query", list: "search", srsearch: text, srlimit: "3", srprop: "", srinfo: "suggestion" });
  const ziel = ohneArtikel(normalisieren(text));
  const kandidaten = [q.searchinfo?.suggestion, ...(q.search || []).map((s) => s.title)].filter(Boolean);
  let bester = null;
  for (const k of kandidaten) {
    const n = ohneArtikel(normalisieren(k.replace(/\s*\(.*\)$/, "")));
    if (n && n[0] === ziel[0] && levenshtein(n, ziel) <= Math.max(1, erlaubteFehler(ziel))) { bester = k; break; }
  }
  merke(schluessel, bester);
  return bester;
}

const grossAnfang = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function titelVarianten(text) {
  const t = String(text).trim().replace(/\s+/g, " ").replace(/^(der|die|das|the)\s+/i, "");
  const v = new Set([grossAnfang(t), t.split(" ").map(grossAnfang).join(" ")]);
  return [...v].filter((x) => x && x.length <= 80 && !/[|#<>[\]{}]/.test(x));
}

function kurzText(info) {
  let t = info.beschreibung || info.satz.split(/(?<=[.!?])\s/)[0] || "";
  t = t.replace(/\s*\([^)]*\)/g, "").trim(); // Klammern (Aussprache, Lebensdaten) entfernen
  return t.length > 70 ? t.slice(0, 68) + "…" : t;
}

function urteil(kat, info, korrigiertAus) {
  const regel = regelFuer(kat);
  const kanonisch = ohneArtikel(normalisieren(info.titel.replace(/\s*\(.*\)$/, "")));
  const vorsatz = korrigiertAus ? `Gemeint ist wohl „${info.titel}“. ` : "";
  const text = kurzText(info);
  const quelleText = info.sprache === "en" ? "Wikipedia (englisch)" : "Wikipedia";

  if (info.mehrdeutig) return { status: "ok", grund: `${vorsatz}Gibt es (${info.titel}, mehrere Bedeutungen)`, kanonisch };
  const muster = regel && (info.sprache === "en" ? regel.en : regel.de);
  if (!muster) return { status: "ok", grund: `${vorsatz}Gibt es${text ? ": " + text : " laut Wikipedia"}`, kanonisch };
  const alles = `${info.beschreibung} ${info.satz}`.toLowerCase();
  if (muster.test(alles)) return { status: "ok", grund: `${vorsatz}${quelleText}: ${text || info.titel}`, kanonisch };
  if (!text) return { status: "unsicher", grund: `${vorsatz}Gibt es (${info.titel}), passt es zur Kategorie?`, kanonisch };
  return { status: "falsch", grund: `${vorsatz}Passt nicht? ${quelleText}: ${text}`, kanonisch };
}

function nichtGefunden(kat) {
  const regel = regelFuer(kat);
  if (regel?.eigenname) return { status: "falsch", grund: "Weder in der Wortliste noch bei Wikipedia gefunden" };
  if (regel?.de) return { status: "falsch", grund: "Nicht gefunden. Stimmt ab, falls es doch stimmt" };
  return { status: "unsicher", grund: "Nicht bei Wikipedia gefunden, bitte prüfen" };
}

async function pruefeMitWikipedia(eintraege) {
  const urteile = {};
  if (!eintraege.length) return urteile;
  const finde = (seiten, e) => titelVarianten(e.text).map((t) => seiten[t]).find(Boolean);

  // a) Deutsch
  const de = await seitenInfos("de", [...new Set(eintraege.flatMap((e) => titelVarianten(e.text)))]);
  let offen = [];
  for (const e of eintraege) {
    const info = finde(de, e);
    if (info) urteile[e.id] = urteil(e.kat, info);
    else offen.push(e);
  }

  // b) Englisch (internationale Filme, Bands, Spiele, Orte ...)
  if (offen.length) {
    const en = await seitenInfos("en", [...new Set(offen.flatMap((e) => titelVarianten(e.text)))]);
    const rest = [];
    for (const e of offen) {
      const info = finde(en, e);
      if (info) urteile[e.id] = urteil(e.kat, info);
      else rest.push(e);
    }
    offen = rest;
  }

  // c) Tippfehler über die Suche korrigieren (begrenzt, um Wikipedia nicht zu überlasten)
  if (offen.length) {
    const versuche = offen.slice(0, 12);
    const korrekturen = await Promise.all(versuche.map((e) => sucheKorrektur(e.text).catch(() => null)));
    const gefunden = versuche.map((e, i) => ({ e, titel: korrekturen[i] })).filter((x) => x.titel);
    const infos = gefunden.length ? await seitenInfos("de", gefunden.map((x) => x.titel)) : {};
    for (const { e, titel } of gefunden) if (infos[titel]) urteile[e.id] = urteil(e.kat, infos[titel], e.text);
    for (const e of offen) if (!urteile[e.id]) urteile[e.id] = nichtGefunden(e.kat);
  }
  return urteile;
}

// ---------- Alles zusammen ----------
// antworten: { kategorieId: { spielerId: text } }
// Ergebnis:  { ergebnis: { kategorieId: { spielerId: {status, grund, quelle, kanonisch} } }, hinweis }
async function pruefe(buchstabe, kategorien, antworten) {
  const ergebnis = {};
  const fuerWiki = [];
  for (const kat of kategorien) {
    ergebnis[kat.id] = {};
    for (const [spielerId, text] of Object.entries(antworten[kat.id] || {})) {
      const r = pruefeRegeln(buchstabe, kat, text);
      r.kanonisch = r.kanonisch || ohneArtikel(normalisieren(text));
      ergebnis[kat.id][spielerId] = r;
      if (r.status === "unsicher") fuerWiki.push({ id: `${kat.id}|${spielerId}`, kat, text: String(text).slice(0, 60) });
    }
  }

  let hinweis = null;
  if (fuerWiki.length) {
    try {
      const urteile = await pruefeMitWikipedia(fuerWiki);
      for (const e of fuerWiki) {
        const u = urteile[e.id];
        if (!u) continue;
        const [katId, spielerId] = e.id.split("|");
        Object.assign(ergebnis[katId][spielerId], { status: u.status, grund: u.grund, quelle: "wiki" }, u.kanonisch ? { kanonisch: u.kanonisch } : {});
      }
    } catch (err) {
      console.error("Wikipedia-Prüfung fehlgeschlagen:", err.message);
      hinweis = "Wikipedia war gerade nicht erreichbar. Unsichere Antworten bitte per Abstimmung prüfen.";
    }
  }
  return { ergebnis, hinweis };
}

module.exports = { pruefe, normalisieren, beginntMit, WOERTER };
