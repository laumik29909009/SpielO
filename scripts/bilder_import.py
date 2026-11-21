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
Nicht zugeordnete Dateien werden aufgelistet.
"""
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
        if len(name) >= 3 and name in s:
            return namen[name]
    return None


def zuschneiden(pfad):
    bild = ImageOps.exif_transpose(Image.open(pfad)).convert("RGB")
    # 4:3, Ausschnitt eher oben (Köpfe), seitlich mittig
    return ImageOps.fit(bild, (BREITE, HOEHE), Image.LANCZOS, centering=(0.5, 0.3))


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
            for alt in (ZIEL / deck_id).glob(f"{kid}.*"):
                alt.unlink()  # altes Bild derselben Karte ersetzen
            ziel = ZIEL / deck_id / f"{kid}.webp"
            zuschneiden(datei).save(ziel, "WEBP", quality=80, method=6)
            name = next(k["name"] for k in karten if k["id"] == kid)
            print(f"✓ {deck_id}/{datei.name} → {kid} ({name}), {ziel.stat().st_size // 1024} KB")
    if fehlend:
        print("\nNicht zugeordnet (bitte umbenennen, z. B. in den Kartennamen oder die ID wie 'B1.jpg'):")
        for f in fehlend:
            print("  -", f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
