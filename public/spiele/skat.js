// =============================================================
//  Kartenrunde (Skat-Blatt) – Browser-Teil
//  Schwimmen, Arschloch und Durak am 3D-Tisch, eigenes Kartendesign
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  let hand = [];
  let auswahl = new Set(); // ausgewählte Handkarten
  let mitteAuswahl = null; // Schwimmen: Karte aus der Mitte
  let angriffAuswahl = null; // Durak: welche Angriffskarte geschlagen wird
  let letzteT = 0;

  const SYM = { kreuz: "♣", pik: "♠", herz: "♥", karo: "♦" };
  const ROT = { herz: true, karo: true };
  const BILD = { B: "⚔️", D: "🌹", K: "👑" };
  const SPIELNAME = { schwimmen: "Schwimmen", arschloch: "Arschloch", durak: "Durak" };
  const SPIELICON = { schwimmen: "🏊", arschloch: "👑", durak: "🛡️" };

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
    };
    return [
      {
        id: "spielwahl", wichtig: true, icon: "🃏", titel: "Welches Spiel?", info: `${SPIELICON[e.modus]} ${SPIELNAME[e.modus]}`,
        html: `<div class="modus-gitter">${Object.keys(spiele).map((m) => `
          <button class="modus-karte ${e.modus === m ? "aktiv" : ""}" data-sk-modus="${m}" ${dis}>
            <div class="icon">${SPIELICON[m]}</div><div class="titel">${SPIELNAME[m]}</div><div class="text">${spiele[m]}</div>
          </button>`).join("")}</div>`,
      },
      {
        id: "spieler", wichtig: true, icon: "🤖", titel: "Mitspieler & Zeit", info: `${menschen} + ${Math.min(e.bots, max - menschen)} Computer · max. ${max}`,
        html: `<div class="einstellungs-zeile">
          <div><div class="unter-titel">Computer-Gegner</div><div class="segment">${[0, 1, 2, 3, 4, 5].map((n) => `<button data-sk-bots="${n}" class="${e.bots === n ? "aktiv" : ""}" ${dis}>${n === 0 ? "Keine" : n}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Zeit pro Zug</div><div class="segment">${[15, 30, 0].map((n) => `<button data-sk-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n ? n + "s" : "∞"}</button>`).join("")}</div></div>
          ${e.modus === "schwimmen" ? `<div><div class="unter-titel">Leben</div><div class="segment">${[2, 3, 4].map((n) => `<button data-sk-leben="${n}" class="${e.leben === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>` : ""}
          ${e.modus === "arschloch" ? `<div><div class="unter-titel">Runden</div><div class="segment">${[3, 5, 8].map((n) => `<button data-sk-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div></div>` : ""}
        </div>
        <p class="leise klein-text" style="margin-top:8px">${e.modus === "arschloch" ? "Arschloch braucht mindestens 3 Spieler, fehlende Plätze füllt der Computer." : "Fehlende Plätze füllt der Computer auf."}</p>`,
      },
      {
        id: "regeln", icon: "📖", titel: "Regeln", info: SPIELNAME[e.modus],
        html: ({
          schwimmen: `<ol class="q-regeln"><li>Jeder hat 3 Karten, 3 liegen offen in der Mitte.</li><li>Pro Zug: <b>eine Karte tauschen</b>, <b>alle drei tauschen</b>, <b>schieben</b> (nichts tun) oder <b>klopfen</b> (ab der 2. Runde: jeder ist noch einmal dran, dann wird aufgedeckt).</li><li>Gezählt wird die beste Farbe: Ass 11, Bilder und 10 je 10, sonst Augen. Drei Gleiche = 30,5.</li><li><b>31</b> beendet sofort. <b>Feuer</b> (drei Asse) beendet sofort, alle anderen verlieren ein Leben.</li><li>Wer am wenigsten hat, verliert ein Leben. Ohne Leben <b>schwimmt</b> man noch eine Runde, beim nächsten Verlust ist man raus.</li></ol>`,
          arschloch: `<ol class="q-regeln"><li>Alle Karten werden verteilt. Reihenfolge: 7 &lt; 8 &lt; 9 &lt; 10 &lt; B &lt; D &lt; K &lt; A.</li><li>Ausspielen: 1 bis 4 gleiche Karten. Der Nächste legt <b>gleich viele, aber höhere</b> oder passt.</li><li>Passen alle, räumt der Letzte ab und spielt neu aus.</li><li>Wer zuerst fertig ist, wird <b>König</b>, der Letzte ist das <b>Arschloch</b>.</li><li>Ab Runde 2 gibt das Arschloch dem König seine 2 besten Karten und bekommt 2 schlechte zurück (Vize je 1 Karte).</li></ol>`,
          durak: `<ol class="q-regeln"><li>36 Karten (6 bis Ass), jeder hat 6. Die unterste Karte bestimmt <b>Trumpf</b>.</li><li>Der Angreifer legt eine Karte. Der Verteidiger schlägt sie: <b>höher in derselben Farbe oder mit Trumpf</b>.</li><li>Alle außer dem Verteidiger dürfen <b>nachlegen</b>, aber nur Werte, die schon liegen (max. 6).</li><li>Kann der Verteidiger nicht, <b>nimmt er alles auf</b>. Sonst greift er als Nächstes an.</li><li>Danach wird auf 6 Karten nachgezogen. Wer am Ende noch Karten hat, ist der <b>Durak</b>.</li></ol>`,
        })[e.modus],
      },
    ];
  }
  function binde(el) {
    $$("[data-sk-modus]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ modus: b.dataset.skModus })));
    $$("[data-sk-bots]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ bots: +b.dataset.skBots })));
    $$("[data-sk-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.skSek })));
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
        setTimeout(() => GN.zustand?.phase === "ende" && !GN.ansicht.startsWith("skat-podest") && GN.podest("skat-podest", { einheit: z.modus === "arschloch" ? "Punkte" : "Pkt." }), z.modus === "schwimmen" ? 4500 : 2500);
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
    $("#skRunde").textContent = z.modus === "arschloch" ? `Runde ${z.runde} / ${z.rundenGesamt}` : z.modus === "schwimmen" ? `Runde ${z.runde}` : `Stapel: ${z.stapelAnzahl}`;
    const drei = $("#skSzene.drei") && QuartettTisch3D.tisch;
    if (drei) { QuartettTisch3D.tisch.aktualisieren({ ...z, spiel: "skat" }, GN.ich); $("#skSitze").innerHTML = ""; }
    else zeichneSitze(z);
    zeichneLeiste(z);
    zeichneMitte(z);
    zeichneHand(z);
    effekte(z);
    if (!vorher || vorher.zug !== z.zug || GN.timerNeu) {
      GN.timerNeu = false;
      if (z.phase === "spielen" && z.restMs > 0) { $("#timer")?.classList.remove("unendlich"); GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000, tonAus: () => GN.zustand?.dran !== GN.ich }); }
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
    if (z.modus === "arschloch") {
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
    box.innerHTML = html;
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
      return gleiche >= z.stich.length && "7 8 9 10 B D K A".split(" ").indexOf(k.wert) > "7 8 9 10 B D K A".split(" ").indexOf(z.stich[0].wert);
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
    const R = "6 7 8 9 10 B D K A".split(" "), F = { kreuz: 0, pik: 1, herz: 2, karo: 3 };
    const karten = [...hand].sort((a, b) => (z.modus === "arschloch" ? R.indexOf(a.wert) - R.indexOf(b.wert) || F[a.farbe] - F[b.farbe] : F[a.farbe] - F[b.farbe] || R.indexOf(a.wert) - R.indexOf(b.wert)));
    const n = karten.length;
    const breite = Math.min(innerWidth - 24, 900);
    const kb = Math.min(z.modus === "schwimmen" ? 130 : 112, Math.max(66, breite / 5.4));
    const abstand = n > 1 ? Math.min(kb * 0.6, (breite - kb) / (n - 1)) : 0;
    const winkel = Math.min(7, 64 / Math.max(1, n));
    box.style.setProperty("--kb", kb + "px");
    box.innerHTML = karten.map((k, i) => {
      const m = i - (n - 1) / 2;
      return `<button class="fr-handkarte sk-handkarte ${spielbar(z, k) ? "spielbar" : ""} ${auswahl.has(k.id) ? "ausgewaehlt" : ""}" data-karte="${k.id}"
        style="--x:${m * abstand}px;--r:${m * winkel}deg;--y:${m * m * 0.9}px;--z:${i}">${karte(k)}</button>`;
    }).join("");
    $$(".sk-handkarte", box).forEach((b) => (b.onclick = () => handKlick(b.dataset.karte)));
    knoepfe(z);
  }

  function handKlick(id) {
    const z = GN.zustand;
    const k = hand.find((x) => x.id === id);
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
    if (z.modus === "arschloch" && ichDran) {
      html = `<button class="btn" id="skLegen" ${auswahl.size ? "" : "disabled"}>🃏 ${auswahl.size || ""} Karte${auswahl.size === 1 ? "" : "n"} legen</button>
        ${z.stich ? '<button class="btn zweit" id="skPassen">✋ Passen</button>' : ""}`;
    }
    if (z.modus === "durak" && z.phase === "spielen") {
      if (z.verteidiger === GN.ich && z.tisch.some((p) => !p.abwehr) && !z.nimmt) html = `<button class="btn zweit" id="skNehmen">🎒 Alles aufnehmen</button><span class="fr-anzahl">Tippe eine Karte zum Schlagen</span>`;
      else if (z.verteidiger !== GN.ich && z.tisch.length && !z.fertig?.includes(GN.ich) && !z.fertigGemeldet?.includes(GN.ich)) html = `<button class="btn zweit" id="skFertig">✅ Fertig (nichts nachlegen)</button>`;
      else if (z.angreifer === GN.ich && !z.tisch.length) html = `<span class="fr-anzahl"><b>Du greifst an:</b> tippe eine Karte</span>`;
    }
    a.innerHTML = html + `<span class="fr-anzahl">${hand.length} ${hand.length === 1 ? "Karte" : "Karten"}${z.modus === "schwimmen" && hand.length === 3 ? ` · <b>${punkte(hand)}</b> Punkte` : ""}</span>`;
    $("#skTauschen")?.addEventListener("click", tauschen);
    $("#skAlle")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("alleTauschen"); auswahl.clear(); mitteAuswahl = null; });
    $("#skSchieben")?.addEventListener("click", () => { Ton.klick(); GN.aktion("schieben"); });
    $("#skKlopfen")?.addEventListener("click", () => { Ton.treffer(); GN.aktion("klopfen"); });
    $("#skLegen")?.addEventListener("click", () => { Ton.abgeben(); GN.aktion("legen", [...auswahl]); auswahl.clear(); });
    $("#skPassen")?.addEventListener("click", () => { Ton.klick(); GN.aktion("passen"); auswahl.clear(); });
    $("#skNehmen")?.addEventListener("click", () => { Ton.falsch(); GN.aktion("nehmen"); });
    $("#skFertig")?.addEventListener("click", () => { Ton.klick(); GN.aktion("fertig"); });
  }

  // Schwimmen: Punkte des eigenen Blatts
  function punkte(h) {
    const W = (w) => (w === "A" ? 11 : ["K", "D", "B", "10"].includes(w) ? 10 : Number(w));
    if (h.every((k) => k.wert === "A")) return "Feuer! 🔥";
    if (h.every((k) => k.wert === h[0].wert)) return "30,5";
    return Math.max(...Object.keys(SYM).map((f) => h.filter((k) => k.farbe === f).reduce((a, k) => a + W(k.wert), 0)));
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
    if (a.typ === "austeilen") { Ton.wusch(); zeige("<b>🃏 Karten werden verteilt</b>"); if (a.tausch?.length) a.tausch.forEach((t) => zeige(`<b>🔁 Kartentausch</b><span>${esc(nameVon(z, t.von))} gibt ${esc(nameVon(z, t.an))} ${t.karten.length} Karte${t.karten.length > 1 ? "n" : ""}</span>`, "gold", 2400)); return; }
    if (a.typ === "klopfen") { Ton.treffer(); zeige(`<b class="riesig">✊</b><span>${wer} ${a.spieler === GN.ich ? "klopfst" : "klopft"}! Letzte Runde</span>`, "gold", 1800); }
    if (a.typ === "neueMitte") { Ton.wusch(); zeige("<b>🔄 Alle haben geschoben: neue Mitte</b>"); }
    if (a.typ === "alleTauschen") { Ton.wusch(); zeige(`<b>🔁 ${wer} ${a.spieler === GN.ich ? "tauschst" : "tauscht"} alle 3</b>`); }
    if (a.typ === "tauschen" || a.typ === "legen" || a.typ === "angreifen" || a.typ === "schlagen") Ton.abgeben();
    if (a.typ === "legen" && a.karten?.length >= 3) zeige(`<b class="riesig">${a.karten.length}×${a.karten[0].wert}</b><span>${wer}</span>`, "gold", 1400);
    if (a.typ === "legen" && a.fertig) zeige(`<b>${["👑", "🥈", "🥉"][a.fertig - 1] || "✅"} ${wer} ${a.spieler === GN.ich ? "bist" : "ist"} fertig!</b>`, "gold", 1800);
    if (a.stichWeg) setTimeout(() => zeige("<b>🧹 Stich abgeräumt</b>", "info", 900), 400);
    if (a.typ === "nimmt") { Ton.falsch(); zeige(`<b class="riesig">🎒</b><span>${wer} ${a.spieler === GN.ich ? "nimmst" : "nimmt"} auf!</span>`, "plus2", 1600); }
    if (a.typ === "aufgenommen") zeige(`<b>🎒 +${a.anzahl} Karten</b><span>${wer}</span>`, "plus2");
    if (a.typ === "abgewehrt") { Ton.richtig(); zeige(`<b class="riesig">🛡️</b><span>${wer} ${a.spieler === GN.ich ? "hast" : "hat"} alles abgewehrt!</span>`, "gold", 1600); }
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
    }
    if (z.modus === "durak" && z.phase === "ende") {
      inhalt = z.durak ? `<div class="fr-re-avatar">${person(z, z.durak).avatar}</div><b>${z.durak === GN.ich ? "Du bist der Durak! 🤡" : `${esc(person(z, z.durak).name)} ist der Durak! 🤡`}</b>` : "<b>Unentschieden!</b>";
      if (z.durak !== GN.ich) GN.konfetti(100);
    }
    if (!inhalt) return;
    const ov = document.createElement("div");
    ov.className = "fr-rundenende sk-ergebnis";
    ov.innerHTML = `<div class="fr-rundenende-karte">${inhalt}${z.phase !== "ende" ? `<span class="leise klein-text">Nächste Runde gleich${GN.wartePunkte()}</span>` : ""}</div>`;
    document.body.appendChild(ov);
    Ton.fanfare();
    const weg = setInterval(() => { if (GN.zustand?.phase === "spielen" || GN.ansicht.startsWith("skat-podest") || GN.zustand?.spiel !== "skat") { clearInterval(weg); ov.remove(); } }, 300);
  }

  GN.spiele.skat = {
    icon: "🃏",
    titel: "Kartenrunde",
    kurz: "Schwimmen, Arschloch und Durak mit dem Skat-Blatt.",
    beschreibung: "Die Kartenklassiker für den Abend: Schwimmen (31), Arschloch und Durak. Am 3D-Tisch, mit Computer-Gegnern.",
    tags: ["🏊 Schwimmen", "👑 Arschloch", "🛡️ Durak", "👥 2–8 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
