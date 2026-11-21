# 🎲 SpielO

Eure eigene Spieleseite für 1 bis 10 Leute: Ein Raum, ein Link, und der Host wählt das Spiel. Alles ist auch solo spielbar.

| Spiel | Worum es geht |
|---|---|
| 💰 **Preis-Schätzer** | Was kostet ein Windrad? 137 Fragen in 15 Themen, 4 Modi (Klassisch, Nicht drüber!, Teurer oder billiger?, Sortieren) und Mix |
| 🌍 **Stadt Land Fluss** | 92 Kategorien in 7 Gruppen, eigene Kategorien, Stopp-Knopf, Live-Fortschritt, Abstimmung und automatischer Schiedsrichter |

Ü18-Inhalte (Nachtleben, Dates, Trinkspiele …) sind in beiden Spielen standardmäßig aus und lassen sich in der Lobby einschalten.

## Stadt Land Fluss: Punkte
| Punkte | Wann |
|---|---|
| 20 | Nur du hast in der Kategorie eine gültige Antwort |
| 10 | Deine Antwort hat sonst keiner |
| 5 | Jemand hat dasselbe |
| 0 | Leer oder ungültig |
| +3 | pro ⭐, den andere für eine kreative Antwort vergeben |

**Solo:** 10 Punkte pro gültiger Antwort, dazu Tempo-Bonus (1 Punkt pro 3 Sekunden, die beim Stopp noch übrig sind). Dein Rekord wird im Browser gespeichert.

## Der Schiedsrichter (automatisch, kostenlos)
1. **Regeln:** leer, falscher Anfangsbuchstabe, Buchstabensalat
2. **Wortlisten** (`daten/slf/woerter.js`, `woerter-extra.js`, rund 5.700 Begriffe) mit Toleranz für Tippfehler
3. **Wikipedia:**
   - deutscher Artikel: Kurzbeschreibung und erster Satz müssen zur Kategorie passen („Nashorn“ als Stadt → abgelehnt)
   - sonst englischer Artikel (Filme, Bands, Spiele)
   - sonst Wikipedia-Suche, um Tippfehler zu korrigieren („Nordenhamm“ → „Nordenham“)
4. **Abstimmung:** 👍/👎, die Mehrheit gewinnt, der Host 👑 hat das letzte Wort.

Welche Wörter in der Wikipedia-Beschreibung zu welcher Kategorie passen, steht in `daten/slf/pruefregeln.js`.

## Wartungsmodus
In `config.json` `"wartung": true` setzen und hochladen. Dann sehen alle nur eine Wartungsseite. Zum Beenden wieder auf `false`.

## Lokal starten
```bash
npm install
npm start
```
Dann http://localhost:3000 öffnen.

## Aufbau
- `server.js`: Räume, Spieler, Host, Wartungsmodus (Socket.IO)
- `spiele/preis.js`, `spiele/slf.js`: Spiel-Logik auf dem Server
- `spiele/slf-pruefer.js`: Schiedsrichter für Stadt Land Fluss
- `daten/`: Fragen, Kategorien, Wortlisten, Prüfregeln
- `public/kern.js`: Startseite, Lobby, Podest; oben lässt sich der Name der Seite ändern (`SEITE`)
- `public/spiele/*.js`: Oberfläche der einzelnen Spiele
- `public/style.css`: Design; jedes Spiel hat seine eigene Farbwelt (`body[data-spiel="..."]`)
- `scripts/bilder_suchen.py`: sucht frei lizenzierte Bilder für neue Preis-Schätzer-Fragen

## Neues Spiel hinzufügen
1. `spiele/<id>.js` mit `standardEinstellungen`, `einstellungenSetzen`, `starten`, `aktion`, `ansicht` anlegen und in `server.js` unter `SPIELE` eintragen.
2. `public/spiele/<id>.js` mit `abschnitte`, `binde` und `zeige` anlegen und in `public/index.html` einbinden.
3. Farbwelt in `style.css` ergänzen.

## Bilder
Die Bilder stammen von Wikipedia / Wikimedia Commons und sind frei lizenziert. Urheber und Lizenz stehen im Spiel am Bild.

SpielO by laumik
