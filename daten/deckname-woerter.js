// =============================================================
//  Deckname: Wortliste (eigene Auswahl, viele doppeldeutige Wörter)
//  Doppeldeutige Begriffe machen das Spiel spannend: Schloss, Bank, Kiefer …
// =============================================================
module.exports = `Schloss Bank Kiefer Strauß Leiter Birne Maus Blatt Ball Zug Hahn Schimmel Tau Mutter Flügel Läufer Feder Krone Note Stern
Bock Golf Kater Absatz Gericht Hering Kamm Kette Kiste Knopf Lager Linse Mark Mast Nagel Pflaster Pony Rad Ring Rolle
Schild Schlange Schuppe Stamm Stift Tor Welle Zelle Zylinder Bremse Brücke Decke Erde Feuer Glas Gold Herz Horn Jäger Karte
Kirche Koch Kopf Kran Laster Löwe Mond Nase Netz Ofen Pilot Pirat Platte Post Quelle Rakete Reifen Riese Rock Rose Sand
Schatten Schnee Schuh Seite Sonne Spiegel Spinne Stadion Stahl Strom Tafel Taucher Teller Turm Uhr Vogel Wal Wolke Zahn Zange
Adler Anker Apfel Arzt Auge Bahn Bär Bart Berg Bett Biene Blitz Boot Brief Brille Brot Burg Dach Drache Eis
Elefant Engel Ente Fass Fenster Fisch Flasche Fuchs Gabel Garten Geist Gitarre Glocke Hammer Hand Hase Haus Hexe Himmel Hut
Insel Jacke Kaffee Kamel Kanone Kasse Katze Keller Kerze Kino Klavier Koffer Kran Kreuz Kuchen Kuh Lampe Löffel Magnet Mantel
Messer Mühle Nadel Nest Oper Palme Papier Park Pfeffer Pferd Pinguin Pizza Puppe Pyramide Rabe Regen Ritter Roboter Säge Schaf
Schiff Schlüssel Schrank Schule Schwert Seil Socke Spinat Stuhl Stein Tasche Tiger Tisch Tomate Topf Traktor Traum Trommel Tunnel Vampir
Vulkan Wald Wand Wasser Wecker Wolf Wurm Wüste Zauberer Zebra Zelt Ziege Zirkus Zitrone Zucker Zwerg Agent Alpen Antenne Atlas
Bombe Boxer Chip Code Dampf Diamant Dieb Dino Echo Fahne Falle Farbe Feld Film Flamme Flut Funke Gas Gift
Grab Gras Hafen Hai Held Helm Honig Hupe Iglu Joker Kabel Käfig Kaktus Kanal Kapitän Keks Kissen Knochen Kompass Korb
Kugel Lava Leder Licht Luft Mauer Medaille Meer Mikroskop Mine Mumie Muschel Nebel Orgel Pass Pfeil Pflanze Planet Pokal Prinz
Radar Rauch Rennen Rezept Rüssel Saft Salz Satellit Schal Scheibe Schere Schlitten Schwamm See Sirene Skelett Spur Staub Strand Sturm
Tanne Tinte Turbo Ufo Ungeheuer Vase Ventil Wagen Waage Wappen Wespe Wiege Wind Wurzel Zaun Zepter Ziegel Zunge Zwiebel Banane
Daumen Fallschirm Fernseher Feuerwehr Fußball Kalender Karotte Leuchtturm Marmelade Ninja Schokolade Schneemann Telefon Wikinger Zahnbürste`.split(/\s+/).filter((w, i, a) => w && a.indexOf(w) === i);
