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

## GoonO (Spiel-ID `farbrausch`)
- **Grundregeln:** Farbe, Zahl oder Symbol bedienen; ⦸ Aussetzen, ⇄ Richtungswechsel, +2, Farbwahl, Farbwahl +4. Wer nicht kann, zieht eine Karte und darf sie legen, wenn sie passt.
- **Letzte Karte!** Bei 2 Karten erscheint der Knopf. Wer seine vorletzte Karte legt, ohne zu rufen, kann 4 Sekunden lang erwischt werden (+2).
- **Punkte:** Der Rundensieger bekommt die Kartenwerte der anderen (Zahl = Augen, Aktion = 20, Farbwahl = 50). Spielziel: 1 Runde, 200 oder 500 Punkte.
- **Hausregeln:** Stapeln (+2/+4 weiterreichen), Ziehen bis es passt, 7 tauscht / 0 gibt weiter, Einwerfen.
- Eigenes Kartendesign (Raute in der Mitte), Logik in `spiele/farbrausch.js`, Oberfläche in `public/spiele/farbrausch.js` und `public/farbrausch.css`. Der 3D-Tisch ist derselbe wie beim Quartett (`public/spiele/quartett-3d.js`).

## Kartenrunde (Skat-Blatt)
Drei Klassiker in einem Spiel, Auswahl in der Lobby (Logik: `spiele/skat.js`, Oberfläche: `public/spiele/skat.js`, `public/skat.css`):
- **Schwimmen (31):** 3 Karten, tauschen mit der Mitte, schieben, klopfen. 31 und Feuer (3 Asse) beenden sofort. Leben einstellbar, wer keine mehr hat, schwimmt.
- **Arschloch:** alle Karten verteilt, gleiche Werte höher stechen, König bis Arschloch, Kartentausch ab Runde 2.
- **Durak:** 36 Karten, Trumpf, angreifen, nachlegen, verteidigen oder aufnehmen. Der Letzte mit Karten ist der Durak.
Edles Kartendesign (Elfenbein, Goldrahmen, Serifenschrift, eigene Goldornamente für König, Dame und Bube).

## Würfelglück
Würfelklassiker mit 5 Würfeln: bis zu 3 Würfe, Würfel festhalten, 13 Felder (Einser–Sechser mit Bonus 35 ab 63, Dreier-/Viererpasch, Full House 25, Kleine Straße 30, Große Straße 40, Fünfling 50, Chance), jeder weitere Fünfling +50.
3D-Würfel in CSS (`public/wuerfel.css`), Würfelbecher (einsammeln, schütteln, auskippen), Halteleiste, Punkteblock und die Würfel-Eule als Live-Helfer (Punkte, Chancen per Simulation, Halte-Tipp). Logik: `spiele/wuerfel.js`, Oberfläche: `public/spiele/wuerfel.js`. 1–8 Spieler, Computer-Gegner.

## Arena 🚧
Zurzeit im Aufbau (`config.json` → `imAufbau`), testen über `/?vorschau=1`.
Tages-Quiz mit freien Antworten. Jede Aufgabe ist eine Kategorie („Nenne eine Nudelsorte“), jeder tippt **eine** Antwort. Je seltener die richtige Antwort, desto mehr **Ruhm**: Fußvolk 10 · Krieger 30 · Champion 60 · Legende 85 · **Goldener Lorbeer 100** (eine besondere Antwort pro Aufgabe). Ruhm × 100 = Zuschauer im Kolosseum.
- **Tagesarena:** 7 Aufgaben pro Tag (Wechsel um Mitternacht, deutsche Zeit), für alle gleich. Start direkt über den Block auf der Startseite. Das erste Ergebnis des Tages zählt für die Tages-Rangliste; Wiederholungen sind Übung.
- **Freies Spiel:** 5–15 zufällige Aufgaben (ohne die von heute), mit Freunden und bis zu 3 Computern.
- **Statistik:** auf dem Gerät gespeichert (Serie, Rekord, Schnitt, Verlauf, Stufen, Lorbeer-Sammlung, Archiv). „Sichern“ erzeugt einen Code zum Umziehen auf ein anderes Gerät.
- Die Tages-Rangliste liegt im Server-Speicher. Nach einem Neustart melden Spieler ihr heutiges Ergebnis beim nächsten Besuch automatisch neu.
- 3D-Kolosseum (`public/spiele/arena-3d.js`, three.js): Gladiator läuft mit dem Ruhm zum Goldenen Lorbeer, das Publikum füllt die Ränge. Nach der Tagesarena erscheint die Serien-Anzeige.
- Antwortprüfung wie bei Krillion in zwei Stufen: erst Listen (inkl. Tippfehler, Mehrzahl, Wortteile), dann für unbekannte Antworten **Wikipedia** (`spiele/arena-pruefer.js`, Regeln pro Aufgabe). Dort anerkannte Antworten zählen als Legende (85) und werden gelernt. Mit Freunden: **Einspruch** („Gilt!“), die Mehrheit der Mitspieler entscheidet (dann Krieger, 30).
- Aufgaben: `daten/arena.js`, `daten/arena-2.js` und zusätzliche Antworten in `daten/arena-extra.js` (Schreibweisen mit `|` trennen). Tippfehler und Mehrzahl werden erkannt.

## Knaben von Schechingen (Spiel-ID `schechingen`)
Eigenes Aufbau- und Handelsspiel auf einer Sechseck-Karte (2–4 Spieler, Computer-Gegner).
- 5 Rohstoffe: 🪵 Holz (Wald), 🪨 Stein (Steinbruch), 🌾 Korn (Feld), 🥛 Milch (Weide), 🍎 Obst (Streuobstwiese). Gewürfelte Landschaften liefern an angrenzende Höfe (Gutshof doppelt).
- Bauen: Weg (Holz, Stein), Hof (Holz, Korn, Milch, Obst; 1 Punkt), Gutshof (3 Stein, 2 Obst; 2 Punkte), Dorfkarte (Korn, Milch, Obst).
- 25 Dorfkarten: 12 Feldhüter, 3 Erntedank, 3 Wegebau, 3 Viehmarkt, 4 Kirchweih (geheimer Punkt).
- Dorfplatz in der Mitte: Hof direkt daran = Marktrecht 3:1 (sonst 4:1). Optional (Lobby): Gemeinschaftsbauten Brunnen, Wirtshaus, Kirche, Rathaus (je 2 Punkte).
- Optional (Lobby): Jahreszeiten (Frühling Weide, Sommer Feld, Herbst Obstwiese doppelt, Winter Wald doppelt und Felder ruhen).
- 7 = Gewitter: über 8 Karten die Hälfte abgeben, Gewitter blockiert ein Feld, eine Karte klauen.
- Längster Weg (ab 5) und Stärkste Feldwache (ab 3 Feldhütern): je 2 Punkte. Sieg bei 8/10/12 Punkten.
- Faire Zufallskarte jede Partie (`karteFair` in `spiele/schechingen.js`): keine starken Ecken, 6/8 und 2/12 getrennt, Zahlen pro Landschaft ausgeglichen, keine Klumpen.
- Bau-Leiste in der Hand-Leiste zeigt die Kosten (grün vorhanden, rot fehlt); Rohstoff-Abzeichen auf jedem Feld, Legende rechts.
- Dorf-Eule 🦉 (optional, pro Spieler über den Schalter oben, gespeichert auf dem Gerät – gilt auch für die Würfel-Eule): beste Start- und Bauplätze, fehlende Rohstoffe und Markt-Tausch, Gewitter-Ziel, Chance pro Wurf.
- Startanimation: Karte legen, Zahlen fallen, Reihenfolge auslosen; Start- und Würfelerträge fliegen zu den Spielern.

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
- `config.json` → `"spende"` (optional): Text und Link für eine Spenden-Ecke auf der Startseite. Ohne Eintrag wird nichts angezeigt.

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
