# Merkzettel: geplante Arbeiten (erst umsetzen, wenn Laurin es sagt)

## 1. Fehler und Wünsche (Stand 22.11.2026)
- **Knaben von Schechingen:**
  - Straßen und Rohstoffe unten blinken weiter, wenn ein anderer Spieler dran ist, nach dem Würfeln und kurz nach „Zug beenden“. Das soll weg.
  - Zu unübersichtlich und zu schnell. Gut sichtbar sein soll:
    - wer gerade was hat (längste Straße, Wirtshaus usw.)
    - wer mit Punkten führt
  - Ein Feld war grau und funktionierte nicht (Gewitter? unklar) → prüfen.
- **Jonkler:** Austeil-Animationen fehlen bzw. sind zu schlicht. Sie sollen so schön werden wie die im Qualitäts-Update.
- **Alle Spiele mit Bots:** Auswahl der Schwierigkeit: einfach, mittel, schwer.
- **Jonkler – 17 und 4 und Poker:** ausgeblendet (`AUSGEBLENDET` in spiele/skat.js), werden später fürs Casino überarbeitet.
- **Baulöwe:** wartet auf Straßennamen und Kartenideen (daten/baulowe.js).
- **Quartett:** wartet auf Bilder (G2, H2, H3, H4 KFP; C1, B4, F3, H4 Dragons; neue Karten I1–J4 beider Decks).

## 2. Qualitäts-Plan „Teil 3“
Teils schon da: fx.js mit GN.fx.zahl/pop/funken/flug/schuettel, Ton.serie, ⚙️-Menü, Welle auf Knöpfen.

### A) Für die ganze Seite
1. **`GN.fx` ausbauen.** Gewünschte Funktionen:
   - `zaehle(el, von, bis)`: zählt hoch, mit Tick-Tönen
   - `knall(text, stärke)`: Einblendung in 3 Stufen
   - `wackeln(stärke)`: klein bei Kleinigkeiten, groß nur beim Sieg
   - `teilchen(x, y, art)`: Funken, Sterne oder Münzen
   - `flieg(von, nach, icon)`: Gegenstand fliegt von A nach B
   - `stopp(ms)`: Hit-Stop vor großen Momenten

   Danach die vorhandenen Effekte aller Spiele darauf umstellen.
2. **Einheitliche Tonleiter:**
   - Serien steigen um je einen Halbton.
   - Feste Bedeutungen: Klick = Auswahl, Ding = du bist dran, Fanfare = großer Erfolg, tiefer Ton = Fehler.
3. **Knöpfe:** beim Drücken auf 0,95 einsinken, beim Loslassen nachfedern. Leichte Vibration bei wichtigen Knöpfen.
4. **Einstellungen:**
   - Animationen reduzieren; Standard ist die Einstellung des Geräts.
   - Farbenblind-Modus auch für die Spielerfarben (Muster oder Symbole).
   - Vibration.
   - Eule.
5. **Übergänge:** weich zwischen Lobby, Spiel und Siegerehrung (wischen oder Vorhang).
6. **Idle-Leben:**
   - Der aktive Spieler pulsiert.
   - Handkarten schweben leicht.
   - Der Hintergrund bewegt sich langsam.
   - Wartende sehen eine Animation statt starrem Text.

### B) Pro Spiel
- **Preis-Schätzer:**
  - Trommelwirbel, dann rollt der Preis als Zählwerk auf die Zahl.
  - Je näher dran, desto stärker das Feuerwerk.
  - Die Schätzungen fliegen als Pins auf den Zahlenstrahl.
- **Stadt Land Puss:**
  - Buchstabe als Glücksrad.
  - 👍/👎 als fliegende Daumen.
  - Doppelte Antworten werden mit Ton durchgestrichen.
- **Quartett:**
  - Hit-Stop beim Vergleich: der Gewinner groß, die verlierende Karte fliegt zu ihm.
  - Die Karte neigt sich zur Maus und hat Glanz.
- **GoonO:**
  - Karten neigen und heben sich.
  - Ablegen mit Abprall und schräg wie echt.
  - +2/+4 stapeln sich sichtbar, mit steigendem Ton und stärkerem Wackeln.
  - Farbwechsel als Welle über den Tisch.
  - Bei „letzte Karte“ pulsiert der Rufer rot.
- **Kartenrunde:**
  - 3D-Flip beim Umdrehen.
  - Klopfen mit Wackeln und Klopf-Ton.
  - Arschloch: Titel zeremoniell verleihen (Krone bzw. Abwertung).
- **Würfelglück:**
  - Fünfling: einfrieren, dann Explosion.
  - Die Zahl fliegt vom Teller in die Tabelle.
  - 63er-Bonus: Balken füllt sich und zerplatzt in Sternen.
- **Knaben:**
  - Höfe fallen mit Staubwolke aufs Brett, Wege werden Brett für Brett gelegt.
  - Gewitter: Blitz über dem Brett, Wackeln, die Wolke zieht sichtbar zum neuen Feld.
  - Sieg: Zoom auf den Gewinner, seine Gebäude leuchten nacheinander auf.
  - Bot-Züge mit Zeiger zeigen.
- **Arena:**
  - Die Fanfare steigt mit der Stufe; der Lorbeer ist laut und mit Hit-Stop.
  - Der Jubel wird mit der Stufe lauter.

### C) Reihenfolge
1. Schnell: Knöpfe, Tonleiter, Übergänge.
2. Mittel: GN.fx ausbauen und umstellen, Einstellungen, pro Spiel 2–3 Momente.
3. Groß: Karten-Neigung und Glanz (GoonO, Quartett, Kartenrunde); Zoom und Bau-Effekte bei den Knaben.
4. Mit Freunden testen: Wo zögert jemand oder fragt „Wer ist dran?“ bzw. „Was ist passiert?“. Genau dort fehlt Rückmeldung.
