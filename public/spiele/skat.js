// =============================================================
//  Kartenrunde (Skat-Blatt) – Browser-Teil
//  Schwimmen, Arschloch, Durak, Mau-Mau, 17 und 4 und Texas Hold'em am 3D-Tisch, eigenes Kartendesign
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let hand = [];
  let auswahl = new Set(); // ausgewählte Handkarten
  let mitteAuswahl = null; // Schwimmen: Karte aus der Mitte
  let angriffAuswahl = null; // Durak: welche Angriffskarte geschlagen wird
  let letzteT = 0;
  let austeilenBis = 0; // Austeil-Animation: Handkarten fliegen ein und drehen sich um
  let mauGerufen = false; // Mau-Mau: „Mau!“ vor der vorletzten Karte
  let pkZiel = null; // Poker: gewählte Erhöhung

  const SYM = { kreuz: "♣", pik: "♠", herz: "♥", karo: "♦" };
  const ROT = { herz: true, karo: true };
  const BILD = { B: "⚔️", D: "🌹", K: "👑" };
  const SPIELNAME = { schwimmen: "Schwimmen", arschloch: "Arschloch", durak: "Durak", maumau: "Mau-Mau", siebzehn: "17 und 4", poker: "Texas Hold'em" };
  const SPIELICON = { schwimmen: "🏊", arschloch: "👑", durak: "🛡️", maumau: "🔄", siebzehn: "🎰", poker: "♠️" };
  const FARBNAME = { kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" };
  const RANG = "2 3 4 5 6 7 8 9 10 B D K A".split(" ");
  const chipsText = (n) => `🪙 ${Number(n || 0).toLocaleString("de-DE")}`;

  GN.socket.on("skat:hand", (h) => {
    hand = h.karten || [];
    for (const id of [...auswahl]) if (!hand.some((k) => k.id === id)) auswahl.delete(id);
    if (GN.zustand?.spiel === "skat" && $(".sk-buehne")) zeichneHand(GN.zustand);
  });

  const leute = (z) => z.teilnehmer || [];
  const person = (z, id) => leute(z).find((t) => t.id === id) || GN.spieler(id);
  const nameVon = (z, id) => (id === GN.ich ? "Du" : person(z, id).name);

  // =============================================================
  //  Karte: französisches Blatt im SpielO-Stil
  // =============================================================
  // Goldene Ornamente für die Bildkarten (eigene, schlichte Linienzeichnungen)
  const ORNAMENT = {
    K: `<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M6 32 L10 10 L22 22 L30 4 L38 22 L50 10 L54 32 Z" fill="url(#skGold)" stroke="#7a5a12" stroke-width="1.4" stroke-linejoin="round"/><rect x="6" y="32" width="48" height="5" rx="1.5" fill="url(#skGold)" stroke="#7a5a12" stroke-width="1.2"/><circle cx="30" cy="4" r="2.6" fill="#fff8e1" stroke="#7a5a12"/><circle cx="10" cy="10" r="2.2" fill="#fff8e1" stroke="#7a5a12"/><circle cx="50" cy="10" r="2.2" fill="#fff8e1" stroke="#7a5a12"/></svg>`,
    D: `<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M6 34 Q30 18 54 34 Q30 26 6 34 Z" fill="url(#skGold)" stroke="#7a5a12" stroke-width="1.2"/><path d="M14 28 Q18 14 24 22 Q30 6 36 22 Q42 14 46 28" fill="none" stroke="url(#skGold)" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="10" r="3.4" fill="#fff8e1" stroke="#7a5a12"/><circle cx="19" cy="18" r="2" fill="#fff8e1" stroke="#7a5a12"/><circle cx="41" cy="18" r="2" fill="#fff8e1" stroke="#7a5a12"/></svg>`,
    B: `<svg viewBox="0 0 60 40" aria-hidden="true"><path d="M30 3 L48 9 L46 24 Q42 33 30 38 Q18 33 14 24 L12 9 Z" fill="url(#skGold)" stroke="#7a5a12" stroke-width="1.4" stroke-linejoin="round"/><path d="M30 9 L41 13 L40 23 Q37 29 30 32 Q23 29 20 23 L19 13 Z" fill="none" stroke="#fff8e1" stroke-width="1.4"/></svg>`,
  };
  function karte(k, { klasse = "", attr = "" } = {}) {
    const s = SYM[k.farbe];
    const bild = BILD[k.wert];
    const mitte = k.wert === "A" ? `<span class="sk-ass"><i class="sk-ass-ring"></i><span>${s}</span></span>`
      : bild ? `<span class="sk-bild"><span class="sk-orn">${ORNAMENT[k.wert]}</span><b>${k.wert}</b><span class="sk-bild-sym">${s}</span></span>`
      : `<span class="sk-zahl"><b>${k.wert}</b><span>${s}</span></span>`;
    return `<div class="sk ${ROT[k.farbe] ? "rot" : "schwarz"} ${klasse}" ${attr} aria-label="${({ kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" })[k.farbe]} ${({ B: "Bube", D: "Dame", K: "König", A: "Ass" })[k.wert] || k.wert}">
      <span class="sk-rahmen" aria-hidden="true"></span><span class="sk-ecke o"><b>${k.wert}</b>${s}</span>${mitte}<span class="sk-ecke u"><b>${k.wert}</b>${s}</span></div>`;
  }
  const rueckseite = (klasse = "") => `<div class="sk sk-ruecken ${klasse}"><span class="sk-r-muster"></span><span class="sk-r-stein"></span></div>`;
  // Goldverlauf für alle Ornamente (einmal pro Seite)
  if (!document.getElementById("skGoldDefs")) document.body.insertAdjacentHTML("beforeend", `<svg id="skGoldDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="skGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".35" stop-color="#e2b13c"/><stop offset=".65" stop-color="#b8860b"/><stop offset="1" stop-color="#f6d77a"/></linearGradient></defs></svg>`);

  // =============================================================
  //  Lobby
  // =============================================================
  function abschnitte(z, host) {
    const e = z.einstellungen;
    const dis = host ? "" : "disabled";
    const max = GN.meta.spiele.skat?.max?.[e.modus] || 6;
    const menschen = z.spieler.length;
    const spiele = {
      schwimmen: "3 Karten, tauschen mit der Mitte, 31 in einer Farbe gewinnt. Wer am wenigsten hat, verliert ein Leben.",
      arschloch: "Karten loswerden: gleiche Werte höher stechen. Der Erste wird König, der Letzte das Arschloch und muss tauschen.",
      durak: "Angreifen und mit Trumpf verteidigen. Wer am Ende noch Karten hat, ist der Durak.",
      maumau: "Farbe auf Farbe, Wert auf Wert. 7 zieht 2, 8 setzt aus, Bube wünscht. Mau! nicht vergessen.",
      siebzehn: "Gegen die Bank: möglichst nah an 21, aber nicht drüber. Mit Chips, auch allein spielbar.",
      poker: "Texas Hold'em: 2 eigene und 5 offene Karten, bluffen, erhöhen, alles setzen.",
    };
    const rundenWahl = GN.meta.spiele.skat?.runden?.[e.modus];
    return [
      {
        id: "spielwahl", wichtig: true, icon: "🃏", titel: "Welches Spiel?", info: `${SPIELICON[e.modus]} ${SPIELNAME[e.modus]}`,
        html: `<div class="modus-gitter">${Object.keys(spiele).filter((m) => !(GN.meta.spiele.skat?.ausgeblendet || []).includes(m)).map((m) => `
          <button class="modus-karte ${e.modus === m ? "aktiv" : ""}" data-sk-modus="${m}" ${dis}>
            <div class="icon">${SPIELICON[m]}</div><div class="titel">${SPIELNAME[m]}</div><div class="text">${spiele[m]}</div>
          </button>`).join("")}</div>`,
      },
      {
        id: "spieler", wichtig: true, icon: "🤖", titel: "Mitspieler & Zeit", info: `${menschen} + ${Math.min(e.bots, max - menschen)} Computer · max. ${max}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3, 4, 5].map((n) => `<button data-sk-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[15, 30, 0].map((n) => `<button data-sk-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
          ${e.modus === "arschloch" ? `<div><div class="unter-titel">Hohe 10</div><div class="segment"><button data-sk-zehn="0" class="${!e.hoheZehn ? "aktiv" : ""}" ${dis}>Aus</button><button data-sk-zehn="1" class="${e.hoheZehn ? "aktiv" : ""}" ${dis}>An: 10 über dem König</button></div></div>` : ""}
          ${e.modus === "schwimmen" ? `<div><div class="unter-titel">Leben</div><div class="segment">${[2, 3, 4].map((n) => `<button data-sk-leben="${n}" class="${e.leben === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>` : ""}
          ${rundenWahl ? `<div><div class="unter-titel">${e.modus === "poker" ? "Hände" : "Runden"}</div><div class="segment">${rundenWahl.map((n) => `<button data-sk-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>` : ""}
        </div>
        <p class="leise klein-text" style="margin-top:8px">${e.modus === "arschloch" ? "Arschloch braucht mindestens 3 Spieler, fehlende Plätze füllt der Computer." : e.modus === "siebzehn" ? "Geht auch allein gegen die Bank. Jeder startet mit 100 Chips." : e.modus === "poker" ? "Jeder startet mit 1000 Chips. Die Blinds steigen alle 6 Hände." : "Fehlende Plätze füllt der Computer auf."}</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "Regeln", info: SPIELNAME[e.modus],
        html: ({
          schwimmen: `<ol class="q-regeln"><li>Jeder hat 3 Karten, 3 liegen offen in der Mitte.</li><li>Pro Zug: <b>eine Karte tauschen</b>, <b>alle drei tauschen</b>, <b>schieben</b> (nichts tun) oder <b>klopfen</b> (ab der 2. Runde: jeder ist noch einmal dran, dann wird aufgedeckt).</li><li>Gezählt wird die beste Farbe: Ass 11, Bilder und 10 je 10, sonst Augen. Drei Gleiche = 30,5. <b>Kleiner Stein</b> (7-8-9) = 25, <b>großer Stein</b> (8-9-10) = 28, Farbe egal.</li><li><b>31</b> beendet sofort. <b>Feuer</b> (drei Asse) beendet sofort, alle anderen verlieren ein Leben.</li><li>Wer am wenigsten hat, verliert ein Leben. Ohne Leben <b>schwimmt</b> man noch eine Runde, beim nächsten Verlust ist man raus.</li></ol>`,
          arschloch: `<ol class="q-regeln"><li>Alle Karten werden verteilt. Reihenfolge: ${e.hoheZehn ? "7 &lt; 8 &lt; 9 &lt; B &lt; D &lt; K &lt; <b>10</b> &lt; A (hohe 10)" : "7 &lt; 8 &lt; 9 &lt; 10 &lt; B &lt; D &lt; K &lt; A"}.</li><li>Ausspielen: 1 bis 4 gleiche Karten. Der Nächste legt <b>gleich viele, aber höhere</b> oder passt.</li><li>Passen alle, räumt der Letzte ab und spielt neu aus.</li><li>Wer zuerst fertig ist, wird <b>König</b>, der Letzte ist das <b>Arschloch</b>.</li><li>Ab Runde 2 muss das Arschloch dem König seine <b>2 besten Karten</b> geben. Der König sucht sich aus, welche 2 Karten er zurückgibt. Vize-Arschloch und Vize-König tauschen genauso 1 Karte. Alle anderen sind <b>Mitläufer</b>.</li></ol>`,
          maumau: `<ol class="q-regeln"><li>Jeder bekommt 5 Karten. Lege eine Karte mit <b>gleicher Farbe oder gleichem Wert</b> auf die Ablage, sonst ziehst du eine.</li><li><b>7</b>: Der Nächste zieht 2 Karten, außer er legt auch eine 7 (dann zieht der Übernächste 4 …).</li><li><b>8</b>: Der Nächste setzt aus.</li><li><b>Bube</b> passt auf alles außer einen Buben. Du wünschst dir eine Farbe.</li><li>Bevor du deine vorletzte Karte legst, drücke <b>„Mau!“</b>, sonst gibt es eine Strafkarte.</li><li>Wer zuerst keine Karten mehr hat, bekommt die Punkte der Karten der anderen (Bube 20, Ass 11, 10 = 10, K 4, D 3, sonst Augen).</li></ol>`,
          siebzehn: `<ol class="q-regeln"><li>Jeder startet mit <b>100 Chips</b> und setzt vor jeder Runde (mindestens 10).</li><li>Du und die Bank bekommen 2 Karten, eine Karte der Bank ist verdeckt. Zahlen zählen ihre Augen, Bilder 10, <b>Ass 11 oder 1</b>.</li><li><b>Karte</b> ziehen, so oft du willst. Über 21 hast du sofort verloren. <b>Halten</b> beendet deinen Zug. <b>Verdoppeln</b>: doppelter Einsatz, genau eine Karte.</li><li>Die Bank zieht bis 16 und bleibt ab 17 stehen.</li><li>Näher an 21 als die Bank = doppelter Einsatz zurück. <b>21 mit zwei Karten</b> zahlt 3 zu 2. Gleichstand = Einsatz zurück.</li></ol>`,
          poker: `<ol class="q-regeln"><li>Jeder startet mit <b>1000 Chips</b>. Zwei Spieler setzen Pflichteinsätze (Blinds).</li><li>Du bekommst 2 verdeckte Karten. Danach kommen 3 offene Karten (Flop), eine 4. (Turn) und eine 5. (River).</li><li>In jeder Setzrunde: <b>Passen</b> (aussteigen), <b>Schieben</b> (wenn nichts zu zahlen ist), <b>Mitgehen</b>, <b>Erhöhen</b> oder <b>All-in</b>.</li><li>Am Ende gewinnt die beste Hand aus 5 der 7 Karten: Höchste Karte &lt; Paar &lt; Zwei Paare &lt; Drilling &lt; Straße &lt; Flush &lt; Full House &lt; Vierling &lt; Straight Flush.</li><li>Steigen alle anderen aus, gewinnst du den Pot ohne Aufdecken. Bei All-in gibt es Nebentöpfe.</li></ol>`,
          durak: `<ol class="q-regeln"><li>36 Karten (6 bis Ass), jeder hat 6. Die unterste Karte bestimmt <b>Trumpf</b>.</li><li>Der Angreifer legt eine Karte. Der Verteidiger schlägt sie: <b>höher in derselben Farbe oder mit Trumpf</b>.</li><li>Alle außer dem Verteidiger dürfen <b>nachlegen</b>, aber nur Werte, die schon liegen (max. 6).</li><li>Kann der Verteidiger nicht, <b>nimmt er alles auf</b>. Sonst greift er als Nächstes an.</li><li>Danach wird auf 6 Karten nachgezogen. Wer am Ende noch Karten hat, ist der <b>Durak</b>.</li></ol>`,
        })[e.modus],
      },
    ];
  }
  function binde(el) {
    $$("[data-sk-modus]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ modus: b.dataset.skModus })));
    $$("[data-sk-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.skBots })));
    $$("[data-sk-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.skSek })));
    $$("[data-sk-zehn]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ hoheZehn: b.dataset.skZehn === "1" })));
    $$("[data-sk-leben]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ leben: +b.dataset.skLeben })));
    $$("[data-sk-runden]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ runden: +b.dataset.skRunden })));
  }

  // =============================================================
  //  Spielansicht
  // =============================================================
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      if (!GN.ansicht.startsWith("skat-podest")) {
        ergebnisZeigen(z);
        setTimeout(() => GN.zustand?.phase === "ende" && !GN.ansicht.startsWith("skat-podest") && GN.podest("skat-podest", { einheit: ["siebzehn", "poker"].includes(z.modus) ? "Chips" : z.modus === "arschloch" || z.modus === "maumau" ? "Punkte" : "Pkt." }), ["schwimmen", "maumau", "poker"].includes(z.modus) ? 4500 : 2500);
        GN.ansicht = "skat-ende";
      }
      return;
    }
    if (!$(".sk-buehne") || !GN.ansicht.startsWith("skat-spiel")) aufbauen(z);
    aktualisieren(z, vorher);
  }

  function aufbauen(z) {
    GN.ansicht = "skat-spiel";
    GN.stoppeTimer();
    auswahl.clear(); mitteAuswahl = null; angriffAuswahl = null;
    app.innerHTML = `
      <div class="sk-buehne fr-buehne q-buehne">
        <div class="runden-kopf">
          <span class="modus-badge">${SPIELICON[z.modus]} ${SPIELNAME[z.modus]}</span>
          <span class="runden-nr" id="skRunde"></span>
          <button class="q-3d-knopf" id="sk3dKnopf">${QuartettTisch3D.moeglich() ? "2D" : "3D"}</button>
          <span class="timer-zahl" id="timerZahl"></span>
        </div>
        <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>
        <div class="sk-leiste" id="skLeiste"></div>
        <div class="q-szene fr-szene sk-szene" id="skSzene">
          <div class="q-sitze" id="skSitze"></div>
          <div class="sk-mitte" id="skMitte"></div>
          <div class="fr-effekt" id="skEffekt" aria-live="polite"></div>
        </div>
        <div class="fr-ich sk-ich">
          <div class="fr-aktionen" id="skAktionen"></div>
          <div class="fr-hand sk-hand" id="skHand" role="listbox" aria-label="Deine Karten"></div>
        </div>
      </div>`;
    $("#sk3dKnopf").onclick = () => { Ton.klick(); QuartettTisch3D.umschalten(); GN.ansicht = ""; zeige(GN.zustand, null); };
    if (QuartettTisch3D.moeglich()) {
      $("#skSzene").classList.add("drei");
      QuartettTisch3D.einhaengen($("#skSzene")).then(() => GN.ansicht.startsWith("skat-spiel") && aktualisieren(GN.zustand, null)).catch(() => $("#skSzene")?.classList.remove("drei"));
    }
  }

  function aktualisieren(z, vorher) {
    $("#skRunde").textContent = ["arschloch", "maumau", "siebzehn"].includes(z.modus) ? `Runde ${z.runde} / ${z.rundenGesamt}` : z.modus === "poker" ? `Hand ${z.runde} / ${z.rundenGesamt} · Blinds ${z.bb / 2}/${z.bb}` : z.modus === "schwimmen" ? `Runde ${z.runde}` : `Stapel: ${z.stapelAnzahl}`;
    const drei = $("#skSzene.drei") && QuartettTisch3D.tisch;
    if (drei) { QuartettTisch3D.tisch.aktualisieren({ ...z, spiel: "skat" }, GN.ich); $("#skSitze").innerHTML = ""; }
    else zeichneSitze(z);
    zeichneLeiste(z);
    zeichneMitte(z);
    zeichneHand(z);
    const ichDranJetzt = z.dran === GN.ich && z.phase === "spielen";
    $(".sk-ich")?.classList.toggle("ich-dran", ichDranJetzt);
    $("#skSzene")?.classList.toggle("ich-dran", ichDranJetzt);
    effekte(z);
    if (!vorher || vorher.zug !== z.zug || vorher.phase !== z.phase || GN.timerNeu) {
      GN.timerNeu = false;
      if ((z.phase === "spielen" || z.phase === "setzen" || z.phase === "tausch") && z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000, tonAus: () => GN.zustand?.dran !== GN.ich }); }
      else GN.ohneZeitlimit();
      if (vorher && z.dran === GN.ich && vorher.dran !== GN.ich && z.phase === "spielen") { Ton.ding(); navigator.vibrate?.(40); }
    }
    if (z.phase === "aufgedeckt" || z.phase === "rundenende") ergebnisZeigen(z);
  }

  // Obere Leiste: Status aller Spieler (Leben, Rolle, gepasst, fertig)
  function zeichneLeiste(z) {
    $("#skLeiste").innerHTML = leute(z).map((t) => {
      let info = `🃏 ${t.karten}`;
      if (z.modus === "schwimmen") info = z.raus?.includes(t.id) ? "raus" : z.schwimmt?.includes(t.id) ? "🏊 schwimmt" : "❤️".repeat(Math.max(0, z.leben?.[t.id] || 0));
      let rolle = "";
      if (z.modus === "durak") rolle = t.id === z.angreifer ? "⚔️" : t.id === z.verteidiger ? "🛡️" : z.fertig?.includes(t.id) ? "✅" : "";
      if (z.modus === "arschloch") rolle = z.fertig?.includes(t.id) ? `#${z.fertig.indexOf(t.id) + 1}` : z.gepasst?.includes(t.id) ? "passt" : "";
      if (z.modus === "schwimmen" && z.geklopft === t.id) rolle = "✊ klopft";
      if (z.modus === "maumau") info = `🃏 ${t.karten} · ${z.gesamt?.[t.id] || 0} P.`;
      if (z.modus === "siebzehn") {
        info = chipsText(z.chips?.[t.id]);
        rolle = !z.imSpiel?.includes(t.id) ? "pleite" : z.einsatz?.[t.id] ? `Einsatz ${z.einsatz[t.id]}` : z.phase === "setzen" ? "setzt …" : "";
      }
      if (z.modus === "poker") {
        info = z.raus?.includes(t.id) ? "raus" : chipsText(z.chips?.[t.id]);
        const marke = t.id === z.dealer ? "Ⓓ " : t.id === z.sb ? "SB " : t.id === z.bbSpieler ? "BB " : "";
        rolle = z.raus?.includes(t.id) ? "" : z.gefoldet?.includes(t.id) ? `${marke}passt` : z.allin?.includes(t.id) ? `${marke}All-in` : z.runBet?.[t.id] ? `${marke}${z.runBet[t.id]}` : marke.trim();
      }
      return `<span class="sk-chip ${z.dran === t.id ? "dran" : ""} ${t.id === GN.ich ? "ich" : ""}"><span>${t.avatar}</span><b>${esc(t.id === GN.ich ? "Du" : t.name)}</b><small>${info}</small>${rolle ? `<em>${rolle}</em>` : ""}</span>`;
    }).join("");
  }

  function zeichneSitze(z) {
    const andere = leute(z).filter((t) => t.id !== GN.ich);
    $("#skSitze").className = "q-sitze fr-sitze";
    $("#skSitze").innerHTML = andere.map((t, i) => `
      <div class="q-sitz ${z.dran === t.id ? "dran" : ""}" data-teilnehmer="${t.id}" style="--i:${i}">
        <div class="q-figur"><span class="q-figur-schatten"></span><span class="q-figur-koerper">${t.avatar}</span></div>
        <div class="q-schild"><b>${esc(t.name)}</b><span>🃏 ${t.karten}${t.bot ? " · 🤖" : ""}</span></div>
      </div>`).join("");
  }

  // Tischmitte je nach Spiel
  function zeichneMitte(z) {
    const box = $("#skMitte");
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    let html = "";
    if (z.modus === "schwimmen") {
      html = `<div class="sk-reihe">${(z.mitte || []).map((k) => `<button class="sk-wahl ${mitteAuswahl === k.id ? "gewaehlt" : ""}" data-mitte="${k.id}" ${ichDran ? "" : "disabled"}>${karte(k)}</button>`).join("")}</div>
        <div class="fr-ansage">${ichDran ? "<b>Du bist dran!</b> Tauschen, schieben oder klopfen" : `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)} ist dran${GN.wartePunkte()}`}${z.geklopft ? ` · ✊ ${esc(nameVon(z, z.geklopft))} hat geklopft` : ""}</div>`;
    }
    if (z.modus === "arschloch" && z.phase === "tausch") {
      const offen = (z.tausch || []).filter((t) => !t.fertig);
      const mein = offen.find((t) => t.an === GN.ich), ichGebe = (z.tausch || []).find((t) => t.von === GN.ich);
      html = `<div class="sk-reihe stich"><div class="sk-leer">🔁 Kartentausch</div></div>
        <div class="fr-ansage">${mein ? `<b>Du bist ${mein.n === 2 ? "König" : "Vize-König"}!</b> ${esc(nameVon(z, mein.von))} hat dir ${mein.n === 2 ? "seine 2 besten Karten" : "seine beste Karte"} gegeben. Wähle ${mein.n} Karte${mein.n > 1 ? "n" : ""} zum Zurückgeben.`
          : ichGebe ? `Du hast ${esc(nameVon(z, ichGebe.an))} ${ichGebe.n === 2 ? "deine 2 besten Karten" : "deine beste Karte"} gegeben. ${ichGebe.fertig ? "Du hast deine Karten zurück." : `${esc(nameVon(z, ichGebe.an))} sucht aus${GN.wartePunkte()}`}`
          : `${offen.map((t) => esc(nameVon(z, t.an))).join(" und ")} ${offen.length > 1 ? "suchen" : "sucht"} Karten zum Zurückgeben aus${GN.wartePunkte()}`}</div>`;
    } else if (z.modus === "arschloch") {
      html = `<div class="sk-reihe stich">${z.stich ? z.stich.map((k, i) => `<div class="sk-stichkarte" style="--i:${i}">${karte(k)}</div>`).join("") : '<div class="sk-leer">Ausspielen</div>'}</div>
        <div class="fr-ansage">${z.stich ? `${esc(nameVon(z, z.stichVon))} liegt vorn · ` : ""}${ichDran ? (z.stich ? `<b>Du bist dran!</b> ${z.stich.length}× höher als ${z.stich[0].wert} oder passen` : "<b>Du spielst aus!</b> 1 bis 4 gleiche Karten") : `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)} ist dran${GN.wartePunkte()}`}</div>`;
    }
    if (z.modus === "durak") {
      const ichVerteidige = z.verteidiger === GN.ich;
      html = `<div class="sk-durak-oben">
          ${z.trumpfKarte ? `<div class="sk-trumpf"><div class="sk-trumpf-karte">${karte(z.trumpfKarte)}</div>${rueckseite("sk-stapel")}<span>${z.stapelAnzahl}</span></div>` : `<div class="sk-trumpf leer"><span class="sk-trumpf-sym ${ROT[z.trumpf] ? "rot" : ""}">${SYM[z.trumpf]}</span><span>Stapel leer</span></div>`}
        </div>
        <div class="sk-reihe durak">${z.tisch.length ? z.tisch.map((p) => `
          <button class="sk-paar ${!p.abwehr && ichVerteidige ? "offen" : ""} ${angriffAuswahl === p.angriff.id ? "gewaehlt" : ""}" data-angriff="${p.angriff.id}" ${!p.abwehr && ichVerteidige ? "" : "disabled"}>
            ${karte(p.angriff)}${p.abwehr ? `<div class="sk-abwehr">${karte(p.abwehr)}</div>` : ""}</button>`).join("") : '<div class="sk-leer">Angriff</div>'}</div>
        <div class="fr-ansage">⚔️ ${esc(nameVon(z, z.angreifer))} greift an · 🛡️ ${esc(nameVon(z, z.verteidiger))} verteidigt${z.nimmt ? " · <b>nimmt auf!</b>" : ""} · Trumpf <b class="${ROT[z.trumpf] ? "rot-text" : ""}">${SYM[z.trumpf]}</b></div>`;
    }
    if (z.modus === "maumau") {
      const o = z.oben;
      html = `<div class="sk-mm-tisch">
          <button class="sk-mm-stapel" id="skMmStapel" ${ichDran && !z.gezogen ? "" : "disabled"} aria-label="Karte ziehen">${rueckseite()}<span class="sk-mm-zahl">${z.ziehen ? `+${z.ziehen}` : z.stapelAnzahl}</span></button>
          <div class="sk-mm-ablage">${o ? karte(o, { klasse: "sk-mm-oben" }) : ""}${z.wunsch ? `<span class="sk-mm-wunsch ${ROT[z.wunsch] ? "rot" : ""}" title="Gewünschte Farbe">${SYM[z.wunsch]}</span>` : ""}</div>
        </div>
        <div class="fr-ansage">${ichDran ? (z.ziehen ? `<b>Du bist dran!</b> 7 legen oder ${z.ziehen} Karten ziehen` : z.gezogen ? "<b>Gezogen.</b> Passt sie? Sonst <b>Weiter</b>" : `<b>Du bist dran!</b>${z.wunsch ? ` Gewünscht: <b class="${ROT[z.wunsch] ? "rot-text" : ""}">${SYM[z.wunsch]} ${FARBNAME[z.wunsch]}</b>` : " Farbe oder Wert bedienen"}`) : z.phase === "spielen" ? `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)} ist dran${GN.wartePunkte()}${z.wunsch ? ` · Wunsch <b class="${ROT[z.wunsch] ? "rot-text" : ""}">${SYM[z.wunsch]}</b>` : ""}${z.ziehen ? ` · <b>+${z.ziehen}</b>` : ""}` : "Runde vorbei"}</div>`;
    }
    if (z.modus === "siebzehn") {
      const andere = leute(z).filter((t) => t.id !== GN.ich && z.imSpiel?.includes(t.id));
      const status = (id) => ({ bj: "🎯 21!", steht: "✋ hält", drueber: "💥 drüber" })[z.status?.[id]] || "";
      html = `<div class="sk-bj-bank"><span class="sk-bj-name">🏦 Bank</span>
          <div class="sk-reihe klein">${(z.bank || []).map((k) => (k ? karte(k) : rueckseite())).join("") || '<div class="sk-leer">Bank</div>'}</div>
          ${z.bank?.length ? `<b class="sk-bj-wert ${z.bankWert > 21 ? "drueber" : ""}">${z.bankOffen ? z.bankWert : "?"}</b>` : ""}</div>
        ${andere.length ? `<div class="sk-bj-plaetze">${andere.map((t) => `<div class="sk-bj-platz ${z.dran === t.id ? "dran" : ""}">
          <span>${t.avatar} ${esc(t.name)}</span><div class="sk-reihe mini">${(z.tische?.[t.id]?.karten || []).map((k) => karte(k)).join("")}</div>
          <small>${z.tische?.[t.id]?.karten.length ? `<b>${z.tische[t.id].wert}</b> · ` : ""}${z.einsatz?.[t.id] ? `Einsatz ${z.einsatz[t.id]}` : "setzt …"} ${status(t.id)}</small></div>`).join("")}</div>` : ""}
        <div class="fr-ansage">${z.phase === "setzen" ? (z.imSpiel?.includes(GN.ich) && !z.einsatz?.[GN.ich] ? "<b>Wie viel setzt du?</b>" : `Alle setzen${GN.wartePunkte()}`) : z.phase === "bank" ? "🏦 Die Bank zieht …" : ichDran ? "<b>Du bist dran!</b> Karte oder halten?" : z.dran ? `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)} ist dran${GN.wartePunkte()}` : ""}</div>`;
    }
    if (z.modus === "poker") {
      const b = z.board || [];
      html = `<div class="sk-pk-pot">Pot <b>${chipsText(z.pot)}</b></div>
        <div class="sk-reihe sk-pk-board">${[0, 1, 2, 3, 4].map((i) => (b[i] ? `<div class="sk-pk-karte" style="--i:${i}">${karte(b[i])}</div>` : '<div class="sk-pk-leer"></div>')).join("")}</div>
        <div class="fr-ansage">${z.phase !== "spielen" ? "Hand vorbei" : ichDran ? `<b>Du bist dran!</b>${z.einsatzHoehe - (z.runBet?.[GN.ich] || 0) > 0 ? ` ${z.einsatzHoehe - (z.runBet?.[GN.ich] || 0)} zum Mitgehen` : ""}` : `${person(z, z.dran).avatar} ${esc(person(z, z.dran).name)} ist dran${GN.wartePunkte()}`}</div>`;
    }
    box.innerHTML = html;
    $("#skMmStapel")?.addEventListener("click", () => { Ton.wusch(); GN.aktion("ziehen"); });
    $$("[data-mitte]", box).forEach((b) => (b.onclick = () => { Ton.klick(); mitteAuswahl = mitteAuswahl === b.dataset.mitte ? null : b.dataset.mitte; zeichneMitte(GN.zustand); zeichneHand(GN.zustand); }));
    $$("[data-angriff]", box).forEach((b) => (b.onclick = () => { Ton.klick(); angriffAuswahl = b.dataset.angriff; zeichneMitte(GN.zustand); zeichneHand(GN.zustand); }));
  }

  // Darf diese Karte (allein) gerade gespielt werden? (für die Hervorhebung)
  function spielbar(z, k) {
    if (z.phase !== "spielen") return false;
    if (z.modus === "schwimmen") return z.dran === GN.ich;
    if (z.modus === "arschloch") {
      if (z.dran !== GN.ich) return false;
      if (!z.stich) return true;
      const gleiche = hand.filter((x) => x.wert === k.wert).length;
      const AR = (z.hoheZehn ? "7 8 9 B D K 10 A" : "7 8 9 10 B D K A").split(" ");
      return gleiche >= z.stich.length && AR.indexOf(k.wert) > AR.indexOf(z.stich[0].wert);
    }
    if (z.modus === "maumau") {
      if (z.dran !== GN.ich || !z.oben) return false;
      if (z.ziehen) return k.wert === "7";
      if (k.wert === "B") return z.oben.wert !== "B";
      if (z.wunsch) return k.farbe === z.wunsch;
      return k.farbe === z.oben.farbe || k.wert === z.oben.wert;
    }
    if (z.modus === "durak") {
      const R = "6 7 8 9 10 B D K A".split(" ");
      if (z.verteidiger === GN.ich) {
        const offen = z.tisch.find((p) => p.angriff.id === angriffAuswahl && !p.abwehr) || z.tisch.find((p) => !p.abwehr);
        if (!offen || z.nimmt) return false;
        const a = offen.angriff;
        return (k.farbe === a.farbe && R.indexOf(k.wert) > R.indexOf(a.wert)) || (k.farbe === z.trumpf && a.farbe !== z.trumpf);
      }
      if (z.tisch.length >= z.limit) return false;
      if (!z.tisch.length) return z.angreifer === GN.ich;
      return z.tisch.some((p) => p.angriff.wert === k.wert || p.abwehr?.wert === k.wert);
    }
    return false;
  }

  function zeichneHand(z) {
    const box = $("#skHand");
    if (!box) return;
    const ich = leute(z).find((t) => t.id === GN.ich);
    if (!ich) { box.innerHTML = '<div class="q-hinweis">👀 Du schaust diese Partie zu.</div>'; $("#skAktionen").innerHTML = ""; return; }
    const R = z.modus === "arschloch" && z.hoheZehn ? "7 8 9 B D K 10 A".split(" ") : RANG, F = { kreuz: 0, pik: 1, herz: 2, karo: 3 };
    const karten = z.modus === "siebzehn" ? [...hand] : [...hand].sort((a, b) => (z.modus === "arschloch" || z.modus === "poker" ? R.indexOf(a.wert) - R.indexOf(b.wert) || F[a.farbe] - F[b.farbe] : F[a.farbe] - F[b.farbe] || R.indexOf(a.wert) - R.indexOf(b.wert)));
    const n = karten.length;
    const breite = Math.min(innerWidth - 24, 900);
    const kb = Math.min(["schwimmen", "poker", "siebzehn"].includes(z.modus) ? 130 : 112, Math.max(66, breite / 5.4));
    const abstand = n > 1 ? Math.min(kb * 0.6, (breite - kb) / (n - 1)) : 0;
    const winkel = Math.min(7, 64 / Math.max(1, n));
    box.style.setProperty("--kb", kb + "px");
    const austeilen = Date.now() < austeilenBis;
    // Während des Austeilens nicht neu zeichnen, sonst beginnt die Animation immer wieder von vorn
    const schluessel = karten.map((k) => k.id).join();
    if (austeilen && box.dataset.schluessel === schluessel && box.classList.contains("austeilen")) return knoepfe(z);
    box.dataset.schluessel = schluessel;
    box.classList.toggle("austeilen", austeilen);
    box.innerHTML = karten.map((k, i) => {
      const m = i - (n - 1) / 2;
      return `<button class="fr-handkarte sk-handkarte ${spielbar(z, k) ? "spielbar" : ""} ${auswahl.has(k.id) ? "ausgewaehlt" : ""}" data-karte="${k.id}"
        style="--x:${m * abstand}px;--r:${m * winkel}deg;--y:${m * m * 0.9}px;--z:${i};--v:${austeilen ? Math.round(((austeilenBis - Date.now()) * 0.75 * i) / Math.max(1, n)) : 0}ms">${karte(k)}</button>`;
    }).join("");
    $$(".sk-handkarte", box).forEach((b) => (b.onclick = () => handKlick(b.dataset.karte)));
    knoepfe(z);
  }

  function handKlick(id) {
    const z = GN.zustand;
    const k = hand.find((x) => x.id === id);
    const meinTausch = z.phase === "tausch" && z.tausch?.find((t) => t.an === GN.ich && !t.fertig);
    if (k && meinTausch) {
      Ton.klick();
      if (auswahl.has(id)) auswahl.delete(id);
      else { if (auswahl.size >= meinTausch.n) auswahl.delete([...auswahl][0]); auswahl.add(id); }
      return zeichneHand(z);
    }
    if (!k || z.phase !== "spielen") return;
    if (z.modus === "schwimmen") {
      if (z.dran !== GN.ich) return GN.toast("Du bist nicht dran.");
      Ton.klick();
      auswahl = new Set(auswahl.has(id) ? [] : [id]);
      if (mitteAuswahl) return tauschen();
      return zeichneHand(z);
    }
    if (z.modus === "arschloch") {
      if (z.dran !== GN.ich) return GN.toast("Du bist nicht dran.");
      Ton.klick();
      // Muss ein Paar/Drilling gelegt werden: passende Anzahl gleicher Karten automatisch wählen
      if (z.stich) {
        const gleiche = hand.filter((x) => x.wert === k.wert);
        auswahl = auswahl.has(id) ? new Set() : new Set([k, ...gleiche.filter((x) => x !== k)].slice(0, z.stich.length).map((x) => x.id));
        if (auswahl.size && auswahl.size < z.stich.length) GN.toast(`Du brauchst ${z.stich.length} gleiche Karten.`);
        return zeichneHand(z);
      }
      // Beim Ausspielen: gleiche Werte gemeinsam auswählen
      if (auswahl.has(id)) auswahl.delete(id);
      else { if ([...auswahl].some((x) => hand.find((h) => h.id === x)?.wert !== k.wert)) auswahl.clear(); auswahl.add(id); }
      return zeichneHand(z);
    }
    if (z.modus === "maumau") {
      if (z.dran !== GN.ich) return GN.toast("Du bist nicht dran.");
      if (!spielbar(z, k)) { Ton.falsch(); return GN.toast(z.ziehen ? `Nur eine 7 – oder ${z.ziehen} Karten ziehen.` : k.wert === "B" ? "Bube auf Bube geht nicht." : z.wunsch ? `Gewünscht ist ${FARBNAME[z.wunsch]}.` : "Passt nicht: gleiche Farbe oder gleicher Wert."); }
      const mau = mauGerufen;
      const senden = (wunsch) => { Ton.abgeben(); GN.aktion("legen", { karte: id, wunsch, mau }); mauGerufen = false; };
      if (k.wert === "B" && hand.length > 1) return farbeWuenschen().then((f) => f && senden(f));
      return senden(null);
    }
    if (z.modus === "siebzehn" || z.modus === "poker") return;
    if (z.modus === "durak") {
      if (!spielbar(z, k)) { Ton.falsch(); return GN.toast(z.verteidiger === GN.ich ? "Diese Karte schlägt nicht. Höher in derselben Farbe oder Trumpf." : z.tisch.length ? "Nachlegen nur mit Werten, die schon liegen." : "Der Angreifer legt zuerst."); }
      Ton.abgeben();
      if (z.verteidiger === GN.ich) {
        const offen = z.tisch.find((p) => p.angriff.id === angriffAuswahl && !p.abwehr) || z.tisch.find((p) => !p.abwehr);
        angriffAuswahl = null;
        return GN.aktion("schlagen", { angriff: offen.angriff.id, karte: id });
      }
      return GN.aktion("angreifen", id);
    }
  }

  // Mau-Mau: Farbe wünschen (Bube)
  function farbeWuenschen() {
    return new Promise((ok) => {
      const d = document.createElement("div");
      d.className = "fr-farbwahl";
      d.innerHTML = `<div class="fr-farbwahl-karte"><b>Welche Farbe wünschst du dir?</b>
        <div class="fr-farbwahl-raster sk-wunsch-raster">${Object.keys(SYM).map((f) => `<button data-f="${f}" class="${ROT[f] ? "rot" : ""}"><span>${SYM[f]}</span>${FARBNAME[f]}</button>`).join("")}</div>
        <button class="btn link" data-f="">Abbrechen</button></div>`;
      document.body.appendChild(d);
      $$("[data-f]", d).forEach((b) => (b.onclick = () => { d.remove(); if (b.dataset.f) Ton.klick(); ok(b.dataset.f || null); }));
    });
  }

  function tauschen() {
    const [h] = [...auswahl];
    if (!h || !mitteAuswahl) return GN.toast("Wähle eine Karte aus deiner Hand und eine aus der Mitte.");
    Ton.abgeben();
    GN.aktion("tauschen", { hand: h, mitte: mitteAuswahl });
    auswahl.clear(); mitteAuswahl = null;
  }

  function knoepfe(z) {
    const a = $("#skAktionen");
    const ichDran = z.dran === GN.ich && z.phase === "spielen";
    let html = "";
    if (z.modus === "schwimmen" && ichDran) {
      html = `<button class="btn" id="skTauschen" ${auswahl.size && mitteAuswahl ? "" : "disabled"}>🔄 Tauschen</button>
        <button class="btn zweit" id="skAlle">🔁 Alle 3 tauschen</button>
        <button class="btn zweit" id="skSchieben">⏭ Schieben</button>
        ${z.darfKlopfen ? '<button class="btn sk-klopfen" id="skKlopfen">✊ Klopfen</button>' : ""}`;
    }
    const meinTausch = z.modus === "arschloch" && z.phase === "tausch" && z.tausch?.find((t) => t.an === GN.ich && !t.fertig);
    if (meinTausch) html = `<button class="btn" id="skZurueck" ${auswahl.size === meinTausch.n ? "" : "disabled"}>🔁 ${meinTausch.n} Karte${meinTausch.n > 1 ? "n" : ""} an ${esc(nameVon(z, meinTausch.von))} geben</button>`;
    if (z.modus === "arschloch" && ichDran) {
      html = `<button class="btn" id="skLegen" ${auswahl.size ? "" : "disabled"}>🃏 ${auswahl.size || ""} Karte${auswahl.size === 1 ? "" : "n"} legen</button>
        ${z.stich ? '<button class="btn zweit" id="skPassen">✋ Passen</button>' : ""}`;
    }
    if (z.modus === "durak" && z.phase === "spielen") {
      if (z.verteidiger === GN.ich && z.tisch.some((p) => !p.abwehr) && !z.nimmt) html = `<button class="btn zweit" id="skNehmen">🎒 Alles aufnehmen</button><span class="fr-anzahl">Tippe eine Karte zum Schlagen</span>`;
      else if (z.verteidiger !== GN.ich && z.tisch.length && !z.fertig?.includes(GN.ich) && !z.fertigGemeldet?.includes(GN.ich)) html = `<button class="btn zweit" id="skFertig">✅ Fertig (nichts nachlegen)</button>`;
      else if (z.angreifer === GN.ich && !z.tisch.length) html = `<span class="fr-anzahl"><b>Du greifst an:</b> tippe eine Karte</span>`;
    }
    if (z.modus === "maumau" && ichDran) {
      html = `${z.gezogen ? '<button class="btn zweit" id="skWeiter">⏭ Weiter</button>' : `<button class="btn zweit" id="skZiehen">🃏 ${z.ziehen ? `${z.ziehen} Karten ziehen` : "Karte ziehen"}</button>`}
        ${hand.length === 2 && !z.ziehen ? `<button class="btn sk-mau ${mauGerufen ? "aktiv" : ""}" id="skMau">📣 Mau!</button>` : ""}`;
    }
    if (z.modus === "siebzehn") {
      if (z.phase === "setzen" && z.imSpiel?.includes(GN.ich) && !z.einsatz?.[GN.ich]) {
        const c = z.chips?.[GN.ich] || 0;
        html = [10, 20, 50, 100].filter((n) => n <= c).map((n) => `<button class="btn ${n === 10 ? "" : "zweit"} sk-chip-knopf" data-setzen="${n}">🪙 ${n}</button>`).join("") + (c > 100 ? `<button class="btn zweit sk-chip-knopf" data-setzen="${c}">Alles (${c})</button>` : "");
      } else if (ichDran) {
        html = `<button class="btn" id="skKarte">➕ Karte</button><button class="btn zweit" id="skHalten">✋ Halten</button>
          ${hand.length === 2 && (z.chips?.[GN.ich] || 0) >= (z.einsatz?.[GN.ich] || 0) ? `<button class="btn zweit" id="skDoppel">✌️ Verdoppeln</button>` : ""}`;
      }
    }
    if (z.modus === "poker" && ichDran) {
      const zu = z.einsatzHoehe - (z.runBet?.[GN.ich] || 0);
      const meine = z.chips?.[GN.ich] || 0, schon = z.runBet?.[GN.ich] || 0;
      const min = Math.min(z.einsatzHoehe + z.minRaise, schon + meine), max = schon + meine;
      if (pkZiel === null || pkZiel < min || pkZiel > max) pkZiel = min;
      const vorschlag = (f) => Math.min(max, Math.max(min, z.einsatzHoehe + Math.round(((z.pot + zu) * f) / 10) * 10));
      html = `<button class="btn zweit" id="skFold">✋ Passen</button>
        ${zu > 0 ? `<button class="btn" id="skCall">${zu >= meine ? `🔥 All-in ${meine}` : `📞 Mitgehen ${zu}`}</button>` : '<button class="btn" id="skCheck">👌 Schieben</button>'}
        ${max > z.einsatzHoehe && zu < meine ? `<div class="sk-pk-erhoehen">
          <input type="range" id="skRaise" min="${min}" max="${max}" step="${Math.max(1, Math.round(z.bb / 2))}" value="${pkZiel}" aria-label="Erhöhen auf">
          <div class="sk-pk-presets"><button data-pk="${vorschlag(0.5)}">½ Pot</button><button data-pk="${vorschlag(1)}">Pot</button><button data-pk="${max}">All-in</button></div>
          <button class="btn sk-pk-raise" id="skRaiseBtn">⬆️ ${pkZiel >= max ? "All-in" : "Erhöhen auf"} <b id="skRaiseWert">${pkZiel}</b></button></div>` : ""}`;
    }
    const extra = z.modus === "schwimmen" && hand.length === 3 ? ` · <b>${punkte(hand)}</b> Punkte`
      : z.modus === "siebzehn" && hand.length ? ` · <b>${bjWert(hand)}</b>${z.einsatz?.[GN.ich] ? ` · Einsatz ${z.einsatz[GN.ich]}` : ""}`
      : z.modus === "poker" && hand.length ? ` · ${chipsText(z.chips?.[GN.ich])}${z.board?.length ? ` · <b>${pkHandName([...hand, ...z.board])}</b>` : ""}` : "";
    a.innerHTML = html + `<span class="fr-anzahl">${z.modus === "siebzehn" && z.phase === "setzen" ? chipsText(z.chips?.[GN.ich]) : `${hand.length} ${hand.length === 1 ? "Karte" : "Karten"}`}${extra}</span>`;
    $("#skTauschen")?.addEventListener("click", tauschen);
    $("#skAlle")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("alleTauschen"); auswahl.clear(); mitteAuswahl = null; });
    $("#skSchieben")?.addEventListener("click", () => { Ton.klick(); GN.aktion("schieben"); });
    $("#skKlopfen")?.addEventListener("click", () => { Ton.treffer(); GN.aktion("klopfen"); });
    $("#skZurueck")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("zurueckgeben", [...auswahl]); auswahl.clear(); });
    $("#skLegen")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("legen", [...auswahl]); auswahl.clear(); });
    $("#skPassen")?.addEventListener("click", () => { Ton.klick(); GN.aktion("passen"); auswahl.clear(); });
    $("#skNehmen")?.addEventListener("click", () => { Ton.falsch(); GN.aktion("nehmen"); });
    $("#skFertig")?.addEventListener("click", () => { Ton.klick(); GN.aktion("fertig"); });
    $("#skZiehen")?.addEventListener("click", () => { Ton.wusch(); GN.aktion("ziehen"); });
    $("#skWeiter")?.addEventListener("click", () => { Ton.klick(); GN.aktion("weiter"); });
    $("#skMau")?.addEventListener("click", (ev) => { mauGerufen = !mauGerufen; ev.currentTarget.classList.toggle("aktiv", mauGerufen); if (mauGerufen) { Ton.treffer(); GN.toast("📣 Mau! – jetzt deine vorletzte Karte legen"); } else Ton.klick(); });
    $$("[data-setzen]", a).forEach((b) => b.addEventListener("click", () => { Ton.abgeben(); GN.aktion("setzen", { betrag: +b.dataset.setzen }); }));
    $("#skKarte")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("karte"); });
    $("#skHalten")?.addEventListener("click", () => { Ton.klick(); GN.aktion("halten"); });
    $("#skDoppel")?.addEventListener("click", () => { Ton.treffer(); GN.aktion("verdoppeln"); });
    $("#skFold")?.addEventListener("click", () => { Ton.klick(); GN.aktion("passen"); pkZiel = null; });
    $("#skCheck")?.addEventListener("click", () => { Ton.klick(); GN.aktion("schieben"); pkZiel = null; });
    $("#skCall")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("mitgehen"); pkZiel = null; });
    const raise = $("#skRaise");
    const raiseText = () => { const max = +raise.max; $("#skRaiseBtn").innerHTML = `⬆️ ${pkZiel >= max ? "All-in" : "Erhöhen auf"} <b id="skRaiseWert">${pkZiel}</b>`; };
    raise?.addEventListener("input", () => { pkZiel = +raise.value; raiseText(); });
    $$("[data-pk]", a).forEach((b) => b.addEventListener("click", () => { Ton.klick(); pkZiel = +b.dataset.pk; raise.value = pkZiel; raiseText(); }));
    $("#skRaiseBtn")?.addEventListener("click", () => { Ton.treffer(); GN.aktion(pkZiel >= +raise.max ? "allin" : "erhoehen", { betrag: pkZiel }); pkZiel = null; });
  }

  // 17 und 4: Wert der eigenen Hand (Ass 11 oder 1)
  function bjWert(h) {
    let s = 0, a = 0;
    for (const k of h) { s += k.wert === "A" ? 11 : ["B", "D", "K"].includes(k.wert) ? 10 : +k.wert; if (k.wert === "A") a++; }
    while (s > 21 && a) { s -= 10; a--; }
    return s;
  }
  // Poker: Name der aktuell besten Hand (für die Anzeige unter den Karten)
  function pkHandName(k) {
    const r = k.map((x) => RANG.indexOf(x.wert) + 2);
    const anz = {}; r.forEach((x) => (anz[x] = (anz[x] || 0) + 1));
    const n = Object.values(anz).sort((a, b) => b - a);
    const farben = {}; k.forEach((x) => (farben[x.farbe] = (farben[x.farbe] || []).concat(RANG.indexOf(x.wert) + 2)));
    const strasse = (werte) => { const u = new Set(werte); if (u.has(14)) u.add(1); for (let h = 14; h >= 5; h--) if ([0, 1, 2, 3, 4].every((i) => u.has(h - i))) return true; return false; };
    const flush = Object.values(farben).find((w) => w.length >= 5);
    if (flush && strasse(flush)) return "Straight Flush";
    if (n[0] === 4) return "Vierling";
    if (n[0] === 3 && n[1] >= 2) return "Full House";
    if (flush) return "Flush";
    if (strasse(r)) return "Straße";
    if (n[0] === 3) return "Drilling";
    if (n[0] === 2 && n[1] === 2) return "Zwei Paare";
    if (n[0] === 2) return "Paar";
    return "Höchste Karte";
  }

  // Schwimmen: Punkte des eigenen Blatts
  function punkte(h) {
    const W = (w) => (w === "A" ? 11 : ["K", "D", "B", "10"].includes(w) ? 10 : Number(w));
    if (h.every((k) => k.wert === "A")) return "Feuer! 🔥";
    if (h.every((k) => k.wert === h[0].wert)) return "30,5";
    const farbe = Math.max(...Object.keys(SYM).map((f) => h.filter((k) => k.farbe === f).reduce((a, k) => a + W(k.wert), 0)));
    const stein = { "7,8,9": 25, "10,8,9": 28 }[h.map((k) => k.wert).sort().join(",")] || 0;
    return stein > farbe ? `${stein} (${stein === 25 ? "kleiner" : "großer"} Stein)` : farbe;
  }

  // =============================================================
  //  Effekte und Ergebnisse
  // =============================================================
  function effekte(z) {
    const a = z.letzteAktion;
    if (!a || a.t === letzteT) return;
    const erstes = !letzteT;
    letzteT = a.t;
    if (erstes && a.typ !== "austeilen") return;
    const box = $("#skEffekt");
    const zeige = (html, klasse = "info", dauer = 1300) => {
      if (!box) return;
      const el = document.createElement("div");
      el.className = "fr-knall " + klasse; el.innerHTML = html; box.appendChild(el);
      setTimeout(() => el.remove(), dauer);
    };
    const wer = esc(nameVon(z, a.spieler));
    if (a.typ === "austeilen" && (z.modus === "poker" || z.modus === "siebzehn")) { Ton.wusch(); return; }
    if (a.typ === "austeilen") { austeilenZeigen(z); Ton.wusch(); zeige("<b>🃏 Karten werden verteilt</b>"); if (a.tausch?.length) a.tausch.forEach((t) => zeige(`<b>🔁 Kartentausch</b><span>${esc(nameVon(z, t.von))} gibt ${esc(nameVon(z, t.an))} ${t.karten.length === 2 ? "die 2 besten Karten" : "die beste Karte"}</span>`, "gold", 2400)); return; }
    if (a.typ === "getauscht") { Ton.wusch(); zeige("<b>🔁 Tausch erledigt</b><span>Das Arschloch spielt aus</span>", "gold", 2000); return; }
    if (a.typ === "klopfen") { Ton.klopf(); GN.fx?.wackeln(2); zeige(`<b class="riesig">✊</b><span>${wer} ${a.spieler === GN.ich ? "klopfst" : "klopft"}! Letzte Runde</span>`, "gold", 1800); }
    if (a.typ === "neueMitte") { Ton.wusch(); zeige("<b>🔄 Alle haben geschoben: neue Mitte</b>"); }
    if (a.typ === "alleTauschen") { Ton.wusch(); zeige(`<b>🔁 ${wer} ${a.spieler === GN.ich ? "tauschst" : "tauscht"} alle 3</b>`); }
    if (a.typ === "tauschen" || a.typ === "legen" || a.typ === "angreifen" || a.typ === "schlagen") Ton.abgeben();
    if (a.typ === "legen" && a.karten?.length >= 3) zeige(`<b class="riesig">${a.karten.length}×${a.karten[0].wert}</b><span>${wer}</span>`, "gold", 1400);
    if (a.typ === "legen" && a.fertig) zeige(`<b>${["👑", "🥈", "🥉"][a.fertig - 1] || "✅"} ${wer} ${a.spieler === GN.ich ? "bist" : "ist"} fertig!</b>`, "gold", 1800);
    if (a.stichWeg) setTimeout(() => zeige("<b>🧹 Stich abgeräumt</b>", "info", 900), 400);
    if (a.typ === "nimmt") { Ton.falsch(); zeige(`<b class="riesig">🎒</b><span>${wer} ${a.spieler === GN.ich ? "nimmst" : "nimmt"} auf!</span>`, "plus2", 1600); }
    if (a.typ === "aufgenommen") zeige(`<b>🎒 +${a.anzahl} Karten</b><span>${wer}</span>`, "plus2");
    // Mau-Mau
    if (z.modus === "maumau") {
      if (a.typ === "legen" && a.wunsch) zeige(`<b class="riesig ${ROT[a.wunsch] ? "rot-text" : ""}">${SYM[a.wunsch]}</b><span>${wer} ${a.spieler === GN.ich ? "wünschst" : "wünscht"} ${FARBNAME[a.wunsch]}</span>`, "gold", 1500);
      if (a.typ === "legen" && a.ziehen) zeige(`<b class="riesig">+${a.ziehen}</b><span>${a.ziehen > 2 ? "Weitergegeben!" : "Ziehen!"}</span>`, "plus2", 1300);
      if (a.typ === "legen" && a.aussetzen) zeige(`<b class="riesig">⏭</b><span>${esc(nameVon(z, a.aussetzen))} ${a.aussetzen === GN.ich ? "setzt" : "setzt"} aus</span>`, "info", 1300);
      if (a.mau) { Ton.treffer(); zeige(`<b class="riesig">📣 Mau!</b><span>${wer}</span>`, "gold", 1400); }
      if (a.vergessen) { Ton.falsch(); zeige(`<b>🤐 Mau vergessen!</b><span>${wer} ${a.spieler === GN.ich ? "ziehst" : "zieht"} eine Strafkarte</span>`, "plus2", 1800); }
      if (a.mauMau) { GN.konfetti(90); zeige(`<b class="riesig">🎉 Mau-Mau!</b><span>${wer}</span>`, "gold", 2000); }
      if (a.typ === "zieht" && a.anzahl > 1) { Ton.falsch(); zeige(`<b>🎒 +${a.anzahl}</b><span>${wer}</span>`, "plus2"); }
      if (a.typ === "zieht" && a.anzahl === 1) Ton.wusch();
    }
    // 17 und 4
    if (z.modus === "siebzehn") {
      if (a.typ === "setzen") { Ton.wusch(); zeige("<b>🪙 Einsätze bitte!</b>"); }
      if (a.typ === "karte" || a.typ === "bankZieht") Ton.abgeben();
      if (a.typ === "verdoppeln") zeige(`<b class="riesig">✌️</b><span>${wer} ${a.spieler === GN.ich ? "verdoppelst" : "verdoppelt"}</span>`, "gold", 1300);
      if (a.drueber) { Ton.falsch(); zeige(`<b class="riesig">💥</b><span>${wer}: über 21!</span>`, "plus2", 1500); }
      if (a.typ === "bankAufdecken") { Ton.wusch(); zeige("<b>🏦 Die Bank deckt auf</b>"); }
    }
    // Poker
    if (z.modus === "poker") {
      if (a.typ === "strasse") { Ton.wusch(); zeige(`<b class="riesig">${a.name}</b>`, "info", 1100); }
      if (a.typ === "allin") { Ton.treffer(); zeige(`<b class="riesig">🔥 All-in!</b><span>${wer}</span>`, "gold", 1600); }
      if (a.typ === "erhoehen") { Ton.abgeben(); zeige(`<b>⬆️ ${wer} ${a.spieler === GN.ich ? "erhöhst" : "erhöht"} auf ${a.betrag}</b>`, "info", 1200); }
      if (a.typ === "mitgehen") Ton.abgeben();
      if (a.typ === "passen" && a.spieler !== GN.ich) zeige(`<b>✋ ${wer} passt</b>`, "info", 900);
    }
    if (a.typ === "abgewehrt") { Ton.richtig(); zeige(`<b class="riesig">🛡️</b><span>${wer} ${a.spieler === GN.ich ? "hast" : "hat"} alles abgewehrt!</span>`, "gold", 1600); }
  }

  // Austeilen: verdeckte Karten fliegen aus der Mitte zu jedem Mitspieler, die eigenen drehen sich um
  function austeilenZeigen(z) {
    const dauer = 3200; // gemütlich austeilen
    austeilenBis = Date.now() + dauer;
    zeichneHand(z);
    const mitte = $("#skMitte");
    const andere = leute(z).filter((t) => t.id !== GN.ich);
    const runden = Math.min(3, Math.max(1, Math.round((z.teilnehmer?.[0]?.karten || 3) / 3)));
    let n = 0;
    for (let r = 0; r < runden; r++) for (const t of andere) {
      const ziel = $(`[data-teilnehmer="${t.id}"]`) || $(`.sk-chip:nth-child(${leute(z).indexOf(t) + 1})`);
      const v = (n++ * dauer) / (runden * Math.max(1, andere.length) + 2);
      setTimeout(() => { GN.fx?.flug(mitte, ziel, '<span class="sk-flug-karte"></span>', { dauer: 450 }); if (n % 2) Ton.klick(); }, v);
    }
    setTimeout(() => GN.ansicht.startsWith("skat-spiel") && zeichneHand(GN.zustand), dauer + 80);
  }

  function ergebnisZeigen(z) {
    if ($(".sk-ergebnis")) return;
    let inhalt = "";
    if (z.modus === "schwimmen" && z.ergebnis) {
      const e = z.ergebnis;
      inhalt = `<b>${e.feuer ? `🔥 Feuer von ${esc(nameVon(z, e.feuer))}!` : Object.values(e.punkte).some((p) => p >= 31) ? `🎯 31! ${esc(nameVon(z, e.gewinner))}` : "Aufgedeckt!"}</b>
        <div class="sk-blaetter">${Object.entries(e.haende).map(([id, h]) => `<div class="sk-blatt ${e.verlierer.includes(id) ? "verloren" : ""}">
          <span>${person(z, id).avatar} ${esc(nameVon(z, id))}</span><div class="sk-reihe klein">${h.map((k) => karte(k)).join("")}</div>
          <b>${String(e.punkte[id]).replace(".", ",")}</b>${e.verlierer.includes(id) ? `<em>${e.ausgeschieden.includes(id) ? "raus!" : "−1 Leben"}</em>` : ""}</div>`).join("")}</div>`;
      if (e.feuer || Object.values(e.punkte).some((p) => p >= 31)) GN.konfetti(80);
    }
    if (z.modus === "arschloch" && z.ergebnis) {
      inhalt = `<b>Runde ${z.runde} vorbei</b><div class="fr-re-liste">${z.ergebnis.raenge.map((id, i) => `<div><span>${["👑", "🥈"][i] || (i === z.ergebnis.raenge.length - 1 ? "💩" : "🙂")} ${esc(z.ergebnis.titel[i])}: ${person(z, id).avatar} ${esc(nameVon(z, id))}</span><b>${z.gesamt?.[id] || 0} P.</b></div>`).join("")}</div>`;
      if (z.ergebnis.raenge[0] === GN.ich) GN.konfetti(120);
      // Zeremonie: Krone für den König, Abwertung für das Arschloch
      const r = z.ergebnis.raenge;
      setTimeout(() => { GN.fx?.knall(`👑 ${esc(nameVon(z, r[0]))}`, 2, "wird König!"); Ton.fanfare(); }, 700);
      setTimeout(() => { GN.fx?.knall(`💩 ${esc(nameVon(z, r[r.length - 1]))}`, 1, "ist das Arschloch"); Ton.falsch(); }, 2300);
    }
    if (z.modus === "durak" && z.phase === "ende") {
      inhalt = z.durak ? `<div class="fr-re-avatar">${person(z, z.durak).avatar}</div><b>${z.durak === GN.ich ? "Du bist der Durak! 🤡" : `${esc(person(z, z.durak).name)} ist der Durak! 🤡`}</b>` : "<b>Unentschieden!</b>";
      if (z.durak !== GN.ich) GN.konfetti(100);
    }
    if (z.modus === "maumau" && z.ergebnis) {
      const e = z.ergebnis;
      inhalt = `<div class="fr-re-avatar">${person(z, e.gewinner).avatar}</div><b>${e.gewinner === GN.ich ? "Du gewinnst die Runde!" : `${esc(person(z, e.gewinner).name)} gewinnt die Runde!`} +${e.punkte}</b>
        <div class="fr-re-liste">${[...leute(z)].sort((a, b) => (z.gesamt?.[b.id] || 0) - (z.gesamt?.[a.id] || 0)).map((t) => `<div><span>${t.avatar} ${esc(nameVon(z, t.id))}${e.strafe?.[t.id] ? ` <small class="leise">(${e.strafe[t.id]} in der Hand)</small>` : ""}</span><b>${z.gesamt?.[t.id] || 0} P.</b></div>`).join("")}</div>`;
      if (e.gewinner === GN.ich) GN.konfetti(110);
    }
    if (z.modus === "siebzehn" && z.ergebnis) {
      const e = z.ergebnis;
      const TEXT = { bj: "🎯 21 mit 2 Karten!", gewonnen: "✅ gewonnen", gleich: "🤝 Gleichstand", verloren: "❌ verloren", drueber: "💥 über 21" };
      inhalt = `<b>🏦 Bank: ${e.bankNatur ? "21 mit 2 Karten!" : e.bank > 21 ? `${e.bank} – über 21!` : e.bank}</b>
        <div class="fr-re-liste">${Object.entries(e.res).map(([id, r]) => `<div class="${r.plus > 0 ? "plus" : r.plus < 0 ? "minus" : ""}"><span>${person(z, id).avatar} ${esc(nameVon(z, id))} · ${TEXT[r.art]}</span><b>${r.plus > 0 ? "+" : ""}${r.plus} · ${chipsText(z.chips?.[id])}</b></div>`).join("")}</div>`;
      if (e.res[GN.ich]?.plus > 0) GN.konfetti(e.res[GN.ich].art === "bj" ? 140 : 70);
    }
    if (z.modus === "poker" && z.ergebnis) {
      const e = z.ergebnis;
      const sieger = Object.keys(e.gewinne || {});
      inhalt = `<b>${sieger.map((id) => `${person(z, id).avatar} ${esc(nameVon(z, id))}`).join(" & ")} ${sieger.length > 1 ? "teilen sich" : sieger[0] === GN.ich ? "gewinnst" : "gewinnt"} ${e.toepfe.length > 1 ? "Töpfe" : "den Pot"}${e.ohneAufdecken ? " – alle anderen haben gepasst" : ""}</b>
        ${e.ohneAufdecken ? "" : `<div class="sk-blaetter">${Object.entries(e.haende).map(([id, h]) => `<div class="sk-blatt ${e.gewinne[id] ? "" : "verloren"}">
          <span>${person(z, id).avatar} ${esc(nameVon(z, id))}</span><div class="sk-reihe klein">${h.map((k) => karte(k)).join("")}</div>
          <b>${esc(e.namen[id] || "")}</b>${e.gewinne[id] ? `<em class="sk-plus">+${e.gewinne[id]}</em>` : ""}</div>`).join("")}</div>`}
        ${e.ohneAufdecken ? `<div class="fr-re-liste">${sieger.map((id) => `<div><span>${person(z, id).avatar} ${esc(nameVon(z, id))}</span><b>+${e.gewinne[id]}</b></div>`).join("")}</div>` : ""}`;
      if (e.gewinne?.[GN.ich]) GN.konfetti(e.ohneAufdecken ? 50 : 110);
    }
    if ((z.modus === "siebzehn" || z.modus === "poker") && z.phase === "ende" && !inhalt) {
      inhalt = `<b>🏁 Spiel vorbei!</b><div class="fr-re-liste">${(z.platzierung || []).map((id, i) => `<div><span>${["🥇", "🥈", "🥉"][i] || "🙂"} ${person(z, id).avatar} ${esc(nameVon(z, id))}</span><b>${chipsText(z.chips?.[id])}</b></div>`).join("")}</div>`;
    }
    if (!inhalt) return;
    const ov = document.createElement("div");
    ov.className = "fr-rundenende sk-ergebnis";
    ov.innerHTML = `<div class="fr-rundenende-karte">${inhalt}${z.phase !== "ende" ? `<span class="leise klein-text">Nächste Runde gleich${GN.wartePunkte()}</span>` : ""}</div>`;
    document.body.appendChild(ov);
    Ton.fanfare();
    const weg = setInterval(() => { if (GN.zustand?.phase === "spielen" || GN.zustand?.phase === "setzen" || GN.zustand?.phase === "tausch" || GN.ansicht.startsWith("skat-podest") || GN.zustand?.spiel !== "skat") { clearInterval(weg); ov.remove(); } }, 300);
  }

  GN.spiele.skat = {
    icon: "🃏",
    titel: "Jonkler",
    kurz: "Schwimmen, Arschloch und Durak mit dem Skat-Blatt.",
    beschreibung: "Die Kartenklassiker für den Abend: Schwimmen (31), Arschloch und Durak. Am 3D-Tisch, mit Computer-Gegnern.",
    tags: ["🏊 Schwimmen", "👑 Arschloch", "🛡️ Durak", "👥 2–8 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
