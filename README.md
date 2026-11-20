# 💰 Preis-Schätzer

Online-Partyspiel für 2–16 Leute: Windräder, Fußballstars, Hypercars, Rekord-Auktionen. Wer schätzt am besten?

## Spielmodi
| Modus | Regel |
|---|---|
| 🎲 Mix | Jede Runde ein zufälliger Modus |
| 🎯 Klassisch | Preis schätzen. Bis zu 1000 Punkte, Faktor 10 daneben = 0 Punkte, Volltreffer (≤ 2 %) = +250 |
| 🔥 Nicht drüber! | Am nächsten dran gewinnt, wer drüber liegt, bekommt 0 Punkte |
| ⚖️ Teurer oder billiger? | Ist das zweite Ding teurer? 500 Punkte + bis zu 500 Bonus für Schnelligkeit |
| 📊 Sortieren | 4 Dinge von billig nach teuer sortieren, 200 Punkte pro richtiger Position, +200 für alle richtig |

## Lokal starten
```bash
npm install
npm start
```
Dann http://localhost:3000 öffnen.

## Dateien
- `server.js`: Räume, Runden, Punkte (Socket.IO)
- `daten/produkte.json`: Kategorien und Produkte mit Preis, Info und Fun Fact
- `scripts/bilder_suchen.py`: sucht für neue Produkte frei lizenzierte Bilder auf Wikimedia Commons
- `public/`: Oberfläche (`app.js`), Design (`style.css`), Sounds (`ton.js`)

## Neue Produkte hinzufügen
1. In `daten/produkte.json` ein Produkt ergänzen (`wiki` = Titel des englischen Wikipedia-Artikels für das Bild).
2. `python3 scripts/bilder_suchen.py` ausführen.

## Bilder
Alle Bilder stammen von Wikimedia Commons und sind frei lizenziert. Urheber und Lizenz stehen im Spiel direkt am Bild.
Preise sind gerundete Richtwerte aus öffentlich berichteten Zahlen.
