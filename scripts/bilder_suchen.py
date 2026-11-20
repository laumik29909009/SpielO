"""Sucht zu jedem Produkt ein frei lizenziertes Bild (Wikipedia / Wikimedia Commons)
und speichert Bild-URL, Urheber und Lizenz in daten/produkte.json.

Aufruf (nur nötig, wenn neue Produkte dazukommen):
    python3 scripts/bilder_suchen.py
Bereits gefundene Bilder werden nicht neu gesucht.
"""
import json, re, time, html, urllib.parse, urllib.request, pathlib

DATEI = pathlib.Path(__file__).resolve().parent.parent / "daten" / "preis-produkte.json"
UA = {"User-Agent": "PreisSchaetzerGame/1.0 (hobby party game; image lookup)"}


def api(host, params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)
    for versuch in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception as e:  # Rate-Limit o. Ä.: kurz warten
            print("  warte …", e)
            time.sleep(45 * (versuch + 1))
    raise RuntimeError("API nicht erreichbar")


def text(wert):
    wert = re.sub(r"<[^>]+>", "", wert or "")
    return html.unescape(wert).strip()


daten = json.loads(DATEI.read_text())
offen = [p for p in daten["produkte"] if p.get("wiki") and not p.get("bild")]
print(f"{len(offen)} Produkte ohne Bild")

# 1) Hauptbild des Wikipedia-Artikels (nur freie Lizenzen)
datei_zu_produkt = {}
for i in range(0, len(offen), 40):
    gruppe = offen[i:i + 40]
    antwort = api("en.wikipedia.org", {
        "action": "query", "prop": "pageimages", "piprop": "name",
        "pilicense": "free", "pilimit": "50", "redirects": "1",
        "titles": "|".join(p["wiki"] for p in gruppe),
    })
    q = antwort["query"]
    umleitung = {x["from"]: x["to"] for x in q.get("normalized", []) + q.get("redirects", [])}
    seiten = {s["title"]: s for s in q["pages"]}
    for p in gruppe:
        titel = p["wiki"]
        while titel in umleitung:
            titel = umleitung[titel]
        name = seiten.get(titel, {}).get("pageimage")
        if name:
            datei_zu_produkt.setdefault(name, []).append(p)
        else:
            print("  kein freies Bild:", p["wiki"])
    time.sleep(20)

# 2) Thumbnail-URL + Urheber/Lizenz von Commons
namen = list(datei_zu_produkt)
for i in range(0, len(namen), 40):
    gruppe = namen[i:i + 40]
    antwort = api("commons.wikimedia.org", {
        "action": "query", "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": "640", "titles": "|".join("File:" + n for n in gruppe),
    })
    q = antwort["query"]
    umleitung = {x["to"]: x["from"] for x in q.get("normalized", [])}
    for s in q["pages"]:
        info = (s.get("imageinfo") or [None])[0]
        name = umleitung.get(s["title"], s["title"]).removeprefix("File:")
        if not info:
            print("  nicht auf Commons:", name)
            continue
        meta = info.get("extmetadata", {})
        bild = {
            "url": info.get("thumburl") or info["url"],
            "autor": text(meta.get("Artist", {}).get("value"))[:80] or "Unbekannt",
            "lizenz": text(meta.get("LicenseShortName", {}).get("value")) or "siehe Quelle",
            "quelle": info["descriptionurl"],
        }
        for p in datei_zu_produkt.get(name, []):
            p["bild"] = bild
    time.sleep(20)

DATEI.write_text(json.dumps(daten, ensure_ascii=False, indent=1) + "\n")
mit = sum(1 for p in daten["produkte"] if p.get("bild"))
print(f"Fertig: {mit} von {len(daten['produkte'])} Produkten haben ein Bild")
