# 🎲 SpielO

Eure eigene Spieleseite für 1 bis 10 Leute: Ein Raum, ein Link, und der Host wählt das Spiel. Alles ist auch solo spielbar.

| Spiel | Worum es geht |
|---|---|
| 💰 **Preis-Schätzer** | Was kostet ein Windrad? 137 Fragen in 15 Themen, 4 Modi (Klassisch, Nicht drüber!, Teurer oder billiger?, Sortieren) und Mix |
| 🃏 **Quartett** | Karten-Duelle mit Kung Fu Panda und Dragons – Die Reiter von Berk, 30 bzw. 31 Karten mit echten Bildern, 5 Werten und eigenem Spezialangriff, Spieltisch, 1–4 Spieler (auch gegen den Computer) |
| 🌈 **Farbrausch** | Der Karten-Klassiker (Farbe oder Zahl bedienen) am 3D-Tisch: 108 Karten, Aktionskarten, „Letzte Karte!“, Hausregeln, 2–8 Spieler, Computer-Gegner |
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

- **Decks:** Kung Fu Panda (30 Karten) und Dragons: Riders of Berk (31 Karten), Gruppen A–H. Karteninhalte einheitlich auf Englisch. Figuren © DreamWorks Animation, Nutzung mit Erlaubnis.
- **Offizielle Bilder** kommen in `public/quartett/bilder/<deck>/<Karten-ID>.jpg`, Liste der IDs in `public/quartett/bilder/LIES_MICH.md`. Fehlt ein Bild, zeigt die Karte einen Platzhalter.
- **Handkarten (1–3):** Wer dran ist, wählt eine Handkarte und sagt einen Wert an. Danach legt jeder andere die Karte, mit der er kontern will. Mit 1 Handkarte spielt es sich klassisch.
- **3D-Spieltisch** (`public/spiele/quartett-3d.js`, Three.js in `public/vendor/`, wird nur bei Bedarf geladen): runder Holztisch, Licht und Schatten, jede Person sitzt als eigene Toon-Figur passend zu ihrem Avatar. Figuren atmen, denken, jubeln oder sind traurig, gelegte Karten fliegen auf den Tisch. Knopf „2D/3D“ schaltet um; ohne WebGL gibt es automatisch die 2,5D-Ansicht.
- **Seltenheit:** ● Gewöhnlich, ◆ Selten (Silber), ★★ Episch (Gold), ★★★ Legendär (Full-Art mit Regenbogenrahmen), berechnet aus der Kartenstärke.
- **Bilder übernehmen:** Bilder nach Figur benannt in `bilder-eingang/<deck>/` legen, dann `python3 scripts/bilder_import.py`. Das Skript ordnet sie den Karten zu, schneidet auf 4:3 zu und speichert WebP.
- **Spezialangriffe:** Jede Karte hat einen eigenen Angriff mit Namen (`ANGRIFFE` in `daten/quartett.js`, Effekte in `public/spiele/quartett-angriffe.js`). Im Kampf greifen alle gleichzeitig an, in der Mitte prallen die Angriffe aufeinander und der stärkere bricht durch.
- **Regeln:** Wer dran ist, wählt einen Wert seiner obersten Karte. Der höchste Wert gewinnt alle Karten der Runde. Gleichstand → Karten in den Topf. Wer alle Karten hat (oder nach dem Rundenlimit die meisten), gewinnt.
- **Decks** stehen in `daten/quartett.js`: 8 Gruppen (A–H) × 4 Karten, 5 Werte, seltene Karten ★ glänzen holografisch.
- **Platzhalter:** Solange kein offizielles Bild im Ordner liegt, zeigt die Karte ein neutrales Symbol (Twemoji, CC-BY 4.0, siehe `public/quartett/tiere/LIZENZ.md`).
- **Computer-Gegner** füllen freie Plätze auf und wählen meist ihren stärksten Wert. Solo spielt man immer gegen den Computer.

## Farbrausch
- **Grundregeln:** Farbe, Zahl oder Symbol bedienen; ⦸ Aussetzen, ⇄ Richtungswechsel, +2, Farbwahl, Farbwahl +4. Wer nicht kann, zieht eine Karte und darf sie legen, wenn sie passt.
- **Letzte Karte!** Bei 2 Karten erscheint der Knopf. Wer seine vorletzte Karte legt, ohne zu rufen, kann 4 Sekunden lang erwischt werden (+2).
- **Punkte:** Der Rundensieger bekommt die Kartenwerte der anderen (Zahl = Augen, Aktion = 20, Farbwahl = 50). Spielziel: 1 Runde, 200 oder 500 Punkte.
- **Hausregeln:** Stapeln (+2/+4 weiterreichen), Ziehen bis es passt, 7 tauscht / 0 gibt weiter, Einwerfen.
- Eigenes Kartendesign (Raute in der Mitte), Logik in `spiele/farbrausch.js`, Oberfläche in `public/spiele/farbrausch.js` und `public/farbrausch.css`. Der 3D-Tisch ist derselbe wie beim Quartett (`public/spiele/quartett-3d.js`).

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

## Patch-Hinweis
Auf der Startseite steht unten ein kleiner aufklappbarer Block „🆕 Neu“ mit dem letzten Update. Der Inhalt kommt aus `config.json` → `"patch"` (`datum`, `titel`, `punkte`).

## Sparmodus & Start
Browser trennen die Verbindung, wenn niemand aktiv ist (Startseite 2 Min., Lobby/Endstand 10 Min., Tab im Hintergrund 2 Min.). Dann kann Render nach 15 Minuten ohne Verbindung schlafen. Beim Aufwachen zeigt die Seite „SpielO wird gestartet …“. Ein Service Worker (`public/sw.js`) zeigt wiederkehrenden Besuchern die Seite sofort, auch während der Server noch aufwacht.

## Musik & Spenden
- `config.json` → `"musikAus": ["jazz"]` blendet Musikrichtungen vorübergehend aus (Dateien bleiben). Mit `[]` ist Jazz wieder da.
- `config.json` → `"spende"`: Text und PayPal-Link für die Spenden-Ecke (QR unter `/qr/spende.svg`, Weiterleitung `/spenden`).

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
