# 🎲 SpielO

Eure eigene Spieleseite für 1 bis 10 Leute: Ein Raum, ein Link, und der Host wählt das Spiel. Alles ist auch solo spielbar.

_developed by laumik_

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

**Solo:** 10 Punkte pro gültiger Antwort, dazu Tempo-Bonus (1 Punkt pro 3 Sekunden, die beim Stopp noch übrig sind). Dein Rekord wird im Browser gespeichert.

**Wer entscheidet, ob eine Antwort gilt?** (alles automatisch)
1. Feste Regeln: leer, falscher Anfangsbuchstabe, Buchstabensalat
2. Wortlisten (`daten/slf/woerter.js`), mit Toleranz für Tippfehler
3. Wikipedia (kostenlos, ohne Schlüssel): Gibt es den Begriff? Passt die Kurzbeschreibung zur Kategorie? („Nashorn“ als Stadt → abgelehnt)
4. Wenn ein API-Schlüssel eingetragen ist, prüft stattdessen Claude (KI) alles und erkennt auch gleichbedeutende Antworten („NYC“ = „New York“). Fällt die KI aus, wird mit Wikipedia geprüft.
5. Danach können alle mit 👍/👎 abstimmen (die Mehrheit gewinnt), und der Host 👑 kann jede Antwort endgültig entscheiden.

## KI-Schiedsrichter (Claude) einrichten
Eine KI braucht ein eigenes, kostenpflichtiges API-Konto. Ohne Schlüssel läuft die Prüfung über Wortlisten und Wikipedia.
1. Auf https://platform.claude.com einen API-Schlüssel erstellen und Guthaben aufladen.
2. Bei Render: dein Web Service → **Environment** → `ANTHROPIC_API_KEY` = dein Schlüssel.
3. Speichern. Ab dann wird die KI automatisch benutzt.

Standardmodell: `claude-opus-5-5`. Günstiger: Variable `ANTHROPIC_MODEL` = `claude-haiku-5-5`.

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
