#!/usr/bin/env python3
"""
Bilder für die Quartett-Karten übernehmen.

So geht's:
1. Bilder in den Ordner  bilder-eingang/kungfupanda/  bzw.  bilder-eingang/dragons/  legen.
   Dateiname = Name der Figur, z. B. "Po.jpg", "Meister Shifu.png", "ohnezahn.webp".
   (Groß-/Kleinschreibung, Umlaute, Leer- und Sonderzeichen sind egal.)
2. Ausführen:  python3 scripts/bilder_import.py
3. Das Skript findet die passende Karte, schneidet das Bild auf 4:3 zu
   (Motiv eher oben, damit Köpfe nicht abgeschnitten werden), verkleinert auf 800 × 600
   und speichert es als WebP in  public/quartett/bilder/<deck>/<Karten-ID>.webp
   Bilder mit weißem Hintergrund werden freigestellt (<Karten-ID>.frei.webp, mit Transparenz).
Nicht zugeordnete Dateien werden aufgelistet.
"""
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

WURZEL = Path(__file__).resolve().parent.parent
EINGANG = WURZEL / "bilder-eingang"
ZIEL = WURZEL / "public" / "quartett" / "bilder"
BREITE, HOEHE = 800, 600
ENDUNGEN = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp"}

# Zusätzliche Schreibweisen (englische Namen, Kurzformen)
ALIASE = {
    "kungfupanda": {
        "shifu": "B3", "oogway": "B4", "meisteroogway": "B4", "masteroogway": "B4", "mastershifu": "B3",
        "taotie": "H3", "fenghuang": "H1", "temutai": "H2", "masterbear": "H4", "bear": "H4",
        "mrping": "D1", "ping": "D1", "lishan": "D2", "meimei": "D3", "leilei": "G1", "grandmapanda": "G2", "omapanda": "G2",
        "chameleon": "C4", "chamaeleon": "C4", "kai": "C3", "generalkai": "C3", "shen": "C2", "lordshen": "C2", "tailung": "C1",
        "soothsayer": "F2", "wahrsagerin": "F2", "bosswolf": "F1", "croc": "E1", "mastercroc": "E1",
        "stormingox": "E2", "masterstormingox": "E2", "thunderingrhino": "E3", "masterthunderingrhino": "E3", "vachir": "E4", "commandervachir": "E4",
    },
    "dragons": {
        "toothless": "A1", "nachtschatten": "A1", "stormfly": "A2", "meatlug": "A3", "hookfang": "A4",
        "barfandbelch": "B1", "barfbelch": "B1", "kotzwuerg": "B1", "lightfury": "B2", "cloudjumper": "B3", "skullcrusher": "B4",
        "reddeath": "C1", "rotertod": "C1", "bewilderbeast": "C2", "alpha": "C2", "screamingdeath": "C3", "typhoomerang": "C4",
        "skrill": "D1", "whisperingdeath": "D2", "deathgripper": "D3", "thunderdrum": "D4",
        "terribleterror": "E1", "nightlights": "E2", "changewing": "E3", "windshear": "E4", "razorwhip": "E4",
        "fireworm": "F4", "fireworkqueen": "F4", "fireworm queen": "F4", "fireworms": "F4",
    },
    "cars": {
        "queen": "A1", "mcqueen": "A1", "lightning": "A1", "hook": "A2", "sally": "A3", "doc": "A4",
        "luigi": "B1", "guido": "B2", "ramone": "B3", "flo": "B4",
        "filmore": "C1", "fillmore": "C1", "sarge": "C2", "sherrif": "C3", "sheriff": "C3", "lizze": "C4", "lizzie": "C4",
        "king": "D1", "chickhicks": "D2", "chick": "D2", "carl": "D3", "cal": "D3", "bobby": "D4",
        "jackson": "E1", "storm": "E1", "cruze": "E2", "cruz": "E2", "danny": "E3", "chaze": "E4", "chase": "E4",
        "francesos": "F1", "francesco": "F1", "shu": "F2", "raoul": "F3", "carla": "F4",
        "finn": "G1", "holley": "G2", "professor": "G3", "professorz": "G3", "sirmiles": "G4", "miles": "G4",
        "mack": "H1", "smokey": "H2", "missfritter": "H3", "fritter": "H3", "rod": "H4", "rodredline": "H4",
    },
}


def schluessel(text):
    """Name vereinfachen: Umlaute auflösen, nur Buchstaben/Ziffern, klein."""
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"^(der|die|das|the|meister|master|meisterin)\s+", "", text)
    return re.sub(r"[^a-z0-9]", "", text)


def karten_laden():
    js = "const {DECKS}=require('./daten/quartett');console.log(JSON.stringify(Object.fromEntries(Object.values(DECKS).map(d=>[d.id,d.karten.map(k=>({id:k.id,name:k.name}))]))))"
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=WURZEL))


def zuordnen(deck_id, karten, dateiname):
    s = schluessel(Path(dateiname).stem)
    if re.fullmatch(r"[a-h][1-4]", s):
        return s.upper()
    namen = {schluessel(k["name"]): k["id"] for k in karten}
    namen.update({schluessel(k["name"].split(" ", 1)[-1]): k["id"] for k in karten})
    for alias, kid in ALIASE.get(deck_id, {}).items():
        namen[schluessel(alias)] = kid
    if s in namen:
        return namen[s]
    # Teiltreffer (z. B. "po_kungfu_panda" → Po), längster Name zuerst
    for name in sorted(namen, key=len, reverse=True):
        if len(name) >= 5 and name in s:
            return namen[name]
    # Gekürzter Name (z. B. "Lung" → Tai Lung, "snow" → Snow Wraith), nur wenn eindeutig
    teil = {namen[n] for n in namen if len(s) >= 4 and s in n}
    if len(teil) == 1:
        return teil.pop()
    # Tippfehler (z. B. "Fenghunag", "Tafumerang", "ogway")
    nah = difflib.get_close_matches(s, list(namen), n=1, cutoff=0.75)
    return namen[nah[0]] if nah else None


def heller_rand(bild):
    """Ist der Hintergrund (Bildrand) fast weiß? Dann wird die Figur freigestellt."""
    w, h = bild.size
    px = bild.load()
    punkte = [(x, 0) for x in range(0, w, max(1, w // 60))] + [(x, h - 1) for x in range(0, w, max(1, w // 60))]
    punkte += [(0, y) for y in range(0, h, max(1, h // 60))] + [(w - 1, y) for y in range(0, h, max(1, h // 60))]
    hell = sum(1 for p in punkte if min(px[p]) > 232)
    return hell / len(punkte) > 0.8


def freistellen(bild):
    """Weißen Hintergrund vom Rand aus entfernen (Flutfüllung), Kanten weich machen."""
    from PIL import ImageDraw, ImageFilter
    markiert = bild.copy()
    MARKE = (1, 254, 3)
    w, h = markiert.size
    for x in range(0, w, max(1, w // 40)):
        for y in (0, h - 1):
            if min(markiert.getpixel((x, y))) > 225:
                ImageDraw.floodfill(markiert, (x, y), MARKE, thresh=38)
    for y in range(0, h, max(1, h // 40)):
        for x in (0, w - 1):
            if min(markiert.getpixel((x, y))) > 225:
                ImageDraw.floodfill(markiert, (x, y), MARKE, thresh=38)
    maske = Image.new("L", (w, h), 255)
    mp, bp = maske.load(), markiert.load()
    for y in range(h):
        for x in range(w):
            if bp[x, y] == MARKE:
                mp[x, y] = 0
    maske = maske.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    frei = bild.convert("RGBA")
    frei.putalpha(maske)
    box = maske.point(lambda v: 255 if v > 20 else 0).getbbox()
    return frei.crop(box) if box else frei


def zuschneiden(pfad):
    """Gibt (Bild, freigestellt?) zurück. Freigestellt: ganze Figur, unten mittig im 4:3-Feld."""
    bild = ImageOps.exif_transpose(Image.open(pfad)).convert("RGB")
    if max(bild.size) > 1400:
        bild.thumbnail((1400, 1400), Image.LANCZOS)
    if heller_rand(bild):
        frei = freistellen(bild)
        flaeche = Image.new("RGBA", (BREITE, HOEHE), (0, 0, 0, 0))
        rand = 0.05
        maxw, maxh = int(BREITE * (1 - 2 * rand)), int(HOEHE * (1 - rand))
        # Auf die Fläche einpassen; kleine Vorlagen werden vergrößert (höchstens 3-fach), damit die Figur die Karte füllt
        faktor = min(maxw / frei.width, maxh / frei.height, 3)
        frei = frei.resize((max(1, round(frei.width * faktor)), max(1, round(frei.height * faktor))), Image.LANCZOS)
        flaeche.alpha_composite(frei, ((BREITE - frei.width) // 2, HOEHE - frei.height))
        return flaeche, True
    # Foto mit eigenem Hintergrund: 4:3, Ausschnitt eher oben (Köpfe), seitlich mittig
    return ImageOps.fit(bild, (BREITE, HOEHE), Image.LANCZOS, centering=(0.5, 0.25)), False


def speichern(datei, deck_id, kid):
    for alt in (ZIEL / deck_id).glob(f"{kid}.*"):
        alt.unlink()  # altes Bild derselben Karte ersetzen
    bild, frei = zuschneiden(datei)
    ziel = ZIEL / deck_id / (f"{kid}.frei.webp" if frei else f"{kid}.webp")
    bild.save(ziel, "WEBP", quality=82, method=6)
    return ziel, frei


def main():
    if not EINGANG.exists():
        print(f"Ordner fehlt: {EINGANG}. Lege dort Unterordner 'kungfupanda' und 'dragons' an.")
        return 1
    alle = karten_laden()
    fehlend = []
    for deck_id, karten in alle.items():
        ordner = EINGANG / deck_id
        if not ordner.exists():
            continue
        (ZIEL / deck_id).mkdir(parents=True, exist_ok=True)
        for datei in sorted(ordner.iterdir()):
            if datei.suffix.lower() not in ENDUNGEN:
                continue
            kid = zuordnen(deck_id, karten, datei.name)
            if not kid:
                fehlend.append(f"{deck_id}/{datei.name}")
                continue
            ziel, frei = speichern(datei, deck_id, kid)
            name = next(k["name"] for k in karten if k["id"] == kid)
            print(f"✓ {deck_id}/{datei.name} → {kid} ({name}){' freigestellt' if frei else ''}, {ziel.stat().st_size // 1024} KB")
    # Bilder direkt in bilder-eingang/ (ohne Unterordner): Deck anhand des Namens erkennen
    for datei in sorted(EINGANG.iterdir()):
        if not datei.is_file() or datei.suffix.lower() not in ENDUNGEN:
            continue
        treffer = [(d, zuordnen(d, k, datei.name)) for d, k in alle.items()]
        treffer = [(d, kid) for d, kid in treffer if kid and not re.fullmatch(r"[A-H][1-4]", Path(datei.name).stem.upper())]
        if len(treffer) != 1:
            fehlend.append(f"{datei.name}" + (" (passt zu mehreren Decks, bitte in den Unterordner legen)" if len(treffer) > 1 else ""))
            continue
        deck_id, kid = treffer[0]
        (ZIEL / deck_id).mkdir(parents=True, exist_ok=True)
        ziel, frei = speichern(datei, deck_id, kid)
        name = next(k["name"] for k in alle[deck_id] if k["id"] == kid)
        print(f"✓ {datei.name} → {deck_id} {kid} ({name}){' freigestellt' if frei else ''}, {ziel.stat().st_size // 1024} KB")
    if fehlend:
        print("\nNicht zugeordnet (bitte umbenennen, z. B. in den Kartennamen oder die ID wie 'B1.jpg'):")
        for f in fehlend:
            print("  -", f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
