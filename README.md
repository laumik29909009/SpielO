# 💰 Preis-Schätzer

Online-Partyspiel für 2–12 Leute: Alle sehen ein Produkt und schätzen den Preis. Wer am nächsten dran ist, bekommt die meisten Punkte.

## Lokal starten
```bash
npm install
npm start
```
Dann http://localhost:3000 öffnen.

## Dateien
- `server.js`: Spiel-Logik und Verbindung der Spieler (Socket.IO)
- `produkte.json`: alle Produkte mit Preisen, hier eigene hinzufügen
- `public/`: was im Browser angezeigt wird (HTML, CSS, JavaScript)

## Punkte
1000 Punkte minus die prozentuale Abweichung (50 % daneben = 500 Punkte). Bei weniger als 1 % Abweichung gibt es 500 Bonuspunkte.
