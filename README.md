# 🎲 Game Night

Eure eigene Spieleseite für bis zu 10 Leute: Ein Raum, ein Link, und der Host wählt das Spiel.

| Spiel | Worum es geht |
|---|---|
| 💰 **Preis-Schätzer** | Was kostet ein Windrad? 4 Modi (Klassisch, Nicht drüber!, Teurer oder billiger?, Sortieren) und Mix, 81 Fragen in 8 Kategorien |
| 🌍 **Stadt Land Fluss** | Der Klassiker mit 39 Kategorien, eigenen Kategorien, Stopp-Knopf, Abstimmung und optionalem KI-Schiedsrichter |

## Stadt Land Fluss: Punkte
| Punkte | Wann |
|---|---|
| 20 | Nur du hast in der Kategorie eine gültige Antwort |
| 10 | Deine Antwort hat sonst keiner |
| 5 | Jemand hat dasselbe |
| 0 | Leer oder ungültig |
| +3 | pro ⭐, den andere für eine kreative Antwort vergeben |

**Wer entscheidet, ob eine Antwort gilt?**
1. Feste Regeln: leer, falscher Anfangsbuchstabe, Buchstabensalat
2. Wortlisten (`daten/slf/woerter.js`), mit Toleranz für Tippfehler
3. Optional die KI (Claude). Sie erkennt auch Antworten, die nicht in den Listen stehen, und gleichbedeutende Antworten („NYC“ = „New York“)
4. Danach können alle mit 👍/👎 abstimmen (die Mehrheit gewinnt), und der Host 👑 kann jede Antwort endgültig entscheiden.

## KI-Schiedsrichter einschalten (optional)
Ohne KI funktioniert alles mit Wortlisten und Abstimmung. Mit KI:
1. Auf https://platform.claude.com einen API-Schlüssel erstellen und etwas Guthaben aufladen.
2. Bei Render: dein Web Service → **Environment** → **Add Environment Variable**
   - Key: `ANTHROPIC_API_KEY`, Value: dein Schlüssel
3. Speichern. Render startet neu, und in der Lobby lässt sich „🤖 KI-Schiedsrichter“ einschalten.

Standardmäßig wird `claude-opus-5-5` benutzt. Über die Variable `ANTHROPIC_MODEL` lässt sich ein anderes Modell wählen, z. B. `claude-haiku-5-5` (deutlich günstiger).

## Lokal starten
```bash
npm install
npm start
```
Dann http://localhost:3000 öffnen.

## Aufbau
- `server.js`: Räume, Spieler, Host (Socket.IO)
- `spiele/preis.js`, `spiele/slf.js`: Spiel-Logik auf dem Server
- `spiele/slf-pruefer.js`: Schiedsrichter für Stadt Land Fluss (Regeln, Wortlisten, KI)
- `daten/`: Fragen, Kategorien, Wortlisten
- `public/kern.js`: Startseite, Lobby, Podest; hier kannst du oben den Namen der Seite ändern (`SEITE`)
- `public/spiele/*.js`: Oberfläche der einzelnen Spiele
- `public/style.css`: Design; jedes Spiel hat seine eigene Farbwelt (`body[data-spiel="..."]`)

## Neues Spiel hinzufügen
1. `spiele/<id>.js` mit `standardEinstellungen`, `einstellungenSetzen`, `starten`, `aktion`, `ansicht` anlegen und in `server.js` unter `SPIELE` eintragen.
2. `public/spiele/<id>.js` mit `lobby` und `zeige` anlegen und in `public/index.html` einbinden.
3. Farbwelt in `style.css` ergänzen.

## Bilder
Die Bilder im Preis-Schätzer stammen von Wikimedia Commons und sind frei lizenziert. Urheber und Lizenz stehen im Spiel am Bild.
