# 🎲 SpielO

Eure eigene Spieleseite für 1 bis 10 Leute: Ein Raum, ein Link, und der Host wählt das Spiel. Alles ist auch solo spielbar.

| Spiel | Worum es geht |
|---|---|
| 💰 **Preis-Schätzer** | Was kostet ein Windrad? 137 Fragen in 15 Themen, 4 Modi (Klassisch, Nicht drüber!, Teurer oder billiger?, Sortieren) und Mix |
| 🃏 **Quartett** | Karten-Duelle mit 2 eigenen Decks (Drachen, Kung-Fu-Meister), je 24 Karten mit Bild und 5 Werten, animierte Kämpfe, 1–4 Spieler (auch gegen den Computer) |
| 🌍 **Stadt Land Fluss** | 92 Kategorien in 7 Gruppen, eigene Kategorien, Stopp-Knopf, Live-Fortschritt, Abstimmung und automatischer Schiedsrichter |

Ü18-Kategorien (Nachtleben, Dates, Trinkspiele …) sind mit 🔞 gekennzeichnet und standardmäßig nicht ausgewählt.

## Komfort im Raum
- **📱 Einladen:** QR-Code, Raum-Code und Link (Knopf „Einladen“ oder oben auf den Raum-Code tippen)
- **Spieler entfernen:** Der Host 👑 tippt auf ✕ (Lobby) oder „Entfernen“ (Raum-Fenster). Wer entfernt wurde, kann 5 Minuten nicht zurück.
- **Später einsteigen:** Wer während eines Spiels beitritt, schaut zu 👀 und spielt ab der nächsten Runde mit.
- **💤 Abwesend:** Wer 2 Runden (Stadt Land Fluss: 1 Runde) nichts eingibt, wird als abwesend markiert. Auf ihn wird nicht mehr gewartet, und ein abwesender Host gibt die Krone weiter. Jede Eingabe oder „Bin wieder da!“ beendet das.
- **⏱️ Zeit ∞:** Ohne Zeitlimit. Preis-Schätzer löst auf, wenn alle getippt haben; Stadt Land Fluss endet per Stopp. Der Host kann jederzeit auflösen bzw. beenden.
- **🏅 Siegerehrung:** Podest mit Animation und Auszeichnungen (z. B. Scharfschütze, Blitzmerker, Kreativkopf, Stopp-König, Seelenverwandte)

## Quartett
> 🚧 **Im Aufbau:** In `config.json` steht `"imAufbau": ["quartett"]`. Dann ist Quartett für alle ausgegraut. Testen kannst du es über den Vorschau-Link **`/?vorschau=1`** (Raum darüber erstellen). Zum Freigeben `"imAufbau": []` setzen.

- **Decks:** Kung Fu Panda (24 Karten) und Dragons – Die Reiter von Berk (20 Karten), Figuren © DreamWorks Animation, Nutzung mit Erlaubnis. Dazu zwei eigene Decks (Kung-Fu-Meister, Drachen).
- **Offizielle Bilder** kommen in `public/quartett/bilder/<deck>/<Karten-ID>.jpg`, Liste der IDs in `public/quartett/bilder/LIES_MICH.md`. Fehlt ein Bild, zeigt die Karte einen Platzhalter.
- **Regeln:** Wer dran ist, wählt einen Wert seiner obersten Karte. Der höchste Wert gewinnt alle Karten der Runde. Gleichstand → Karten in den Topf. Wer alle Karten hat (oder nach dem Rundenlimit die meisten), gewinnt.
- **Decks** stehen in `daten/quartett.js`: 6 Gruppen (A–F) × 4 Karten, 5 Werte, seltene Karten ★ glänzen holografisch.
- **Bilder:** Drachen werden im Browser aus Bauteilen gezeichnet (`public/spiele/quartett-bilder.js`, Feld `d` pro Karte). Die Kung-Fu-Meister nutzen Twemoji-Tiere (CC-BY 4.0, siehe `public/quartett/tiere/LIZENZ.md`).
- **Computer-Gegner** füllen freie Plätze auf und wählen meist ihren stärksten Wert. Solo spielt man immer gegen den Computer.

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

## Hintergrundmusik 🎵
Oben rechts gibt es einen 🎵-Knopf mit Musikrichtungen, Wiedergabe-Steuerung und Lautstärkeregler.

**🎹 SpielO-Beat** (`public/beat.js`): unser eigener Song, live im Browser erzeugt (C–G–Am–F, 100 BPM, 16 Takte im Kreis). Er läuft standardmäßig. Weil Browser Ton erst nach dem ersten Tippen erlauben, startet er spätestens beim ersten Tipp auf der Seite. Wer „Aus“ wählt, hört ihn auch beim nächsten Besuch nicht mehr.

Jeder Ordner in `public/musik/` ist eine Musikrichtung (z. B. `public/musik/jazz/`). Lieder (MP3, M4A, OGG …) einfach dort hineinlegen.
Bitte nur Musik verwenden, die ihr öffentlich abspielen dürft (eigene Aufnahmen oder lizenzfreie Musik), denn das Repository und die Seite sind öffentlich.

## Wartungsmodus
In `config.json` `"wartung": true` setzen und hochladen. Dann sehen alle nur eine Wartungsseite. Zum Beenden wieder auf `false`.
Was auf der Wartungsseite steht, kommt aus `"wartungInfo"`: `"punkte"` (kurze Stichpunkte, was gemacht wird) und optional `"zahlen"` (große Kennzahlen).

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
- `spiele/quartett.js`: Quartett (Verteilen, Kämpfe, Computer-Gegner, Auszeichnungen)
- `daten/`: Fragen, Kategorien, Wortlisten, Prüfregeln
- `public/beat.js`: der SpielO-Beat; `public/musik.js`: Musik-Player
- `public/kern.js`: Startseite, Lobby, Raum-Fenster (QR, Spieler), Zuschauen, Podest; oben lässt sich der Name der Seite ändern (`SEITE`)
- `public/spiele/*.js`: Oberfläche der einzelnen Spiele; `public/quartett.css`: Karten und Kampf-Animationen
- `public/style.css`: Design; jedes Spiel hat seine eigene Farbwelt (`body[data-spiel="..."]`)
- `scripts/bilder_suchen.py`: sucht frei lizenzierte Bilder für neue Preis-Schätzer-Fragen

## Neues Spiel hinzufügen
1. `spiele/<id>.js` mit `standardEinstellungen`, `einstellungenSetzen`, `starten`, `aktion`, `ansicht` anlegen und in `server.js` unter `SPIELE` eintragen.
2. `public/spiele/<id>.js` mit `abschnitte`, `binde` und `zeige` anlegen und in `public/index.html` einbinden.
3. Farbwelt in `style.css` ergänzen.

## Bilder
Die Bilder stammen von Wikipedia / Wikimedia Commons und sind frei lizenziert. Urheber und Lizenz stehen im Spiel am Bild.

SpielO by laumik
