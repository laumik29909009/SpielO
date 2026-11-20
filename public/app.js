// =============================================================
//  Preis-Schätzer – Browser-Teil (was jeder Spieler sieht)
// =============================================================
const socket = io({ transports: ["websocket", "polling"] });
const app = document.getElementById("app");
const $ = (sel, el = document) => el.querySelector(sel);

// ---------- Speicher (kann im privaten Modus fehlen) ----------
function speicher(key, wert) {
  try {
    if (wert === undefined) return localStorage.getItem(key);
    if (wert === null) localStorage.removeItem(key);
    else localStorage.setItem(key, wert);
  } catch { return null; }
}
let spielerId = speicher("spielerId");
if (!spielerId) {
  spielerId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  speicher("spielerId", spielerId);
}

// ---------- Spielmodi ----------
const MODI = {
  mix: { icon: "🎲", titel: "Mix", text: "Jede Runde ein zufälliger Modus. Perfekt für den Spieleabend." },
  klassisch: { icon: "🎯", titel: "Klassisch", text: "Schätz den Preis. Je näher du dran bist, desto mehr Punkte." },
  nichtdrueber: { icon: "🔥", titel: "Nicht drüber!", text: "Am nächsten dran gewinnt, aber wer drüber liegt, kriegt 0 Punkte." },
  hoehertiefer: { icon: "⚖️", titel: "Teurer oder billiger?", text: "Ist das zweite Ding teurer oder billiger? Schnelle Antworten geben Bonus." },
  sortieren: { icon: "📊", titel: "Sortieren", text: "Bring 4 Dinge in die richtige Reihenfolge, von billig nach teuer." },
};
const EINHEITEN = [
  { label: null, faktor: 1 },
  { label: "Tsd.", faktor: 1e3 },
  { label: "Mio.", faktor: 1e6 },
  { label: "Mrd.", faktor: 1e9 },
  { label: "Bio.", faktor: 1e12 },
];

// ---------- Zustand im Browser ----------
let meta = { kategorien: [] };
let zustand = null;
let ansicht = ""; // welche Ansicht gerade gerendert ist (verhindert unnötiges Neuzeichnen)
let timerInterval = null;
let eingabe = { einheit: 0, text: "" };
let sortierung = [];

// =============================================================
//  Verbindung
// =============================================================
socket.on("meta", (m) => { meta = m; if (!zustand) zeigeStart(); });

socket.on("connect", () => {
  const raum = speicher("raum");
  if (raum) socket.emit("raumBeitreten", { code: raum, name: speicher("name"), spielerId });
});

socket.on("beigetreten", ({ code }) => {
  speicher("raum", code);
  history.replaceState(null, "", "?raum=" + code);
});

socket.on("fehler", (text) => {
  if (!zustand) { speicher("raum", null); if (ansicht !== "start") zeigeStart(); }
  toast(text);
});

socket.on("zustand", (z) => {
  const vorher = zustand;
  zustand = z;
  $("#raumChip").textContent = z.code;
  $("#raumChip").classList.remove("versteckt");

  if (z.phase === "lobby") return zeigeLobby();
  if (z.phase === "frage") {
    const key = "frage-" + z.runde.nr;
    if (ansicht !== key) return zeigeFrage(key, !vorher || vorher.phase !== "frage" || vorher.runde?.nr !== z.runde.nr);
    return aktualisiereStatus();
  }
  const key = z.phase + "-" + z.runde.nr;
  if (ansicht !== key) return z.phase === "ende" ? zeigeEnde(key) : zeigeAufloesung(key);
  aktualisiereRangliste();
});

// =============================================================
//  Startseite
// =============================================================
function zeigeStart() {
  ansicht = "start";
  stoppeTimer();
  $("#raumChip").classList.add("versteckt");
  const codeAusLink = (new URLSearchParams(location.search).get("raum") || "").toUpperCase();
  app.innerHTML = `
    <section class="start">
      <div class="hero">
        <h1>Was kostet<br><span class="gold">das</span>?!</h1>
        <p>Windräder, Weltstars, Hypercars und Rekord-Auktionen: Wer schätzt am besten? Das Partyspiel für deine Freunde.</p>
        <div class="preisschilder">
          <span class="preisschild">🌬️ Windrad: ???</span>
          <span class="preisschild">⚽ Neymar: ???</span>
          <span class="preisschild">🦖 T.-rex-Skelett: ???</span>
          <span class="preisschild">🚀 Raketenstart: ???</span>
          <span class="preisschild">🏎️ Bugatti: ???</span>
          <span class="preisschild">⚛️ 1 g Antimaterie: ???</span>
        </div>
      </div>
      <div class="karte start-karte">
        <div>
          <label class="feld-label" for="nameInput">Dein Name</label>
          <input id="nameInput" class="feld" maxlength="16" placeholder="z. B. Laurin" autocomplete="off" value="${esc(speicher("name") || "")}" />
        </div>
        ${codeAusLink ? "" : `<button id="erstellenBtn" class="btn gross voll">🎉 Neuen Raum erstellen</button><div class="trenner">ODER BEITRETEN</div>`}
        <div>
          <label class="feld-label" for="codeInput">Raum-Code</label>
          <div class="beitreten-zeile">
            <input id="codeInput" class="feld code-feld" maxlength="4" placeholder="ABCD" autocomplete="off" value="${esc(codeAusLink)}" />
            <button id="beitretenBtn" class="btn ${codeAusLink ? "" : "zweit"}">Los ➜</button>
          </div>
        </div>
        ${codeAusLink ? `<button id="andererBtn" class="btn link">Stattdessen eigenen Raum erstellen</button>` : ""}
      </div>
    </section>
    <p class="fuss">Bilder: Wikimedia Commons (Urheber &amp; Lizenz stehen am jeweiligen Bild). Alle Preise sind gerundete Richtwerte.</p>`;

  const name = () => { const n = $("#nameInput").value.trim(); speicher("name", n); return n; };
  $("#erstellenBtn")?.addEventListener("click", () => { Ton.entsperren(); socket.emit("raumErstellen", { name: name(), spielerId }); });
  $("#beitretenBtn").addEventListener("click", () => {
    Ton.entsperren();
    socket.emit("raumBeitreten", { code: $("#codeInput").value, name: name(), spielerId });
  });
  $("#andererBtn")?.addEventListener("click", () => { history.replaceState(null, "", "/"); zeigeStart(); });
  $("#codeInput").addEventListener("keydown", (e) => e.key === "Enter" && $("#beitretenBtn").click());
  $("#nameInput").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    ($("#erstellenBtn") || $("#beitretenBtn")).click();
  });
  if (!$("#nameInput").value) $("#nameInput").focus();
}

// =============================================================
//  Lobby
// =============================================================
function zeigeLobby() {
  ansicht = "lobby";
  stoppeTimer();
  const z = zustand;
  const host = z.hostId === spielerId;
  const e = z.einstellungen;
  const dis = host ? "" : "disabled";
  const anzahlFragen = meta.kategorien.filter((k) => e.kategorien.includes(k.id)).reduce((s, k) => s + k.anzahl, 0);

  app.innerHTML = `
    <section class="lobby">
      <div>
        <div class="karte code-karte">
          <div class="leise">Raum-Code</div>
          <div class="code-gross">${z.code}</div>
          <div class="knopf-reihe">
            <button class="btn zweit" id="teilenBtn">🔗 Freunde einladen</button>
          </div>
        </div>
        <div class="abschnitt-titel">Spieler (${z.spieler.length})</div>
        <div class="spieler-gitter">
          ${z.spieler.map((s) => `
            <div class="spieler-kachel ${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
              ${s.id === z.hostId ? '<span class="krone" title="Host">👑</span>' : ""}
              ${s.id === spielerId
                ? `<button class="avatar" id="avatarBtn" title="Avatar wechseln">${s.avatar}</button>`
                : `<span class="avatar">${s.avatar}</span>`}
              <div class="name">${esc(s.name)}</div>
            </div>`).join("")}
        </div>
        <p class="leise" style="font-size:.85rem;margin-top:10px">Tipp: Tippe auf deinen Avatar, um ihn zu wechseln.</p>
      </div>

      <div>
        <div class="abschnitt-titel" style="margin-top:0">Spielmodus</div>
        <div class="modus-gitter">
          ${Object.entries(MODI).map(([id, m]) => `
            <button class="modus-karte ${e.modus === id ? "aktiv" : ""}" data-modus="${id}" ${dis}>
              <div class="icon">${m.icon}</div>
              <div class="titel">${m.titel}</div>
              <div class="text">${m.text}</div>
            </button>`).join("")}
        </div>

        <div class="abschnitt-titel">Kategorien <span style="text-transform:none;letter-spacing:0">· ${anzahlFragen} Fragen</span></div>
        <div class="kat-gitter">
          ${meta.kategorien.map((k) => `
            <button class="kat-chip ${e.kategorien.includes(k.id) ? "aktiv" : ""}" data-kat="${k.id}" title="${esc(k.beschreibung)}" ${dis}>
              <span class="e">${k.emoji}</span>
              <span><div class="n">${esc(k.name)}</div><div class="z">${k.anzahl} Fragen</div></span>
            </button>`).join("")}
        </div>

        <div class="einstellungs-zeile">
          <div>
            <div class="abschnitt-titel">Runden</div>
            <div class="segment">${[5, 10, 15, 20].map((n) => `<button data-runden="${n}" class="${e.runden === n ? "aktiv" : ""}" ${dis}>${n}</button>`).join("")}</div>
          </div>
          <div>
            <div class="abschnitt-titel">Zeit pro Frage</div>
            <div class="segment">${[20, 30, 45, 60].map((n) => `<button data-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${n}s</button>`).join("")}</div>
          </div>
        </div>

        <div class="start-leiste">
          ${host
            ? `<button class="btn gross voll" id="startBtn">▶ Spiel starten</button>
               ${z.spieler.length < 2 ? '<div class="leise" style="text-align:center;font-size:.85rem">Du kannst auch alleine testen, mit Freunden macht es aber mehr Spaß!</div>' : ""}`
            : `<div class="warte">Warte, bis der Host das Spiel startet<span class="punkte"><span>.</span><span>.</span><span>.</span></span></div>`}
          <button class="btn link" id="verlassenBtn">Raum verlassen</button>
        </div>
      </div>
    </section>`;

  $("#teilenBtn").onclick = teilen;
  $("#avatarBtn")?.addEventListener("click", () => { Ton.klick(); socket.emit("avatarWechseln"); });
  $("#verlassenBtn").onclick = verlassen;
  if (!host) return;
  $("#startBtn").onclick = () => { Ton.entsperren(); socket.emit("spielStarten"); };
  app.querySelectorAll("[data-modus]").forEach((b) => (b.onclick = () => { Ton.klick(); socket.emit("einstellungen", { modus: b.dataset.modus }); }));
  app.querySelectorAll("[data-runden]").forEach((b) => (b.onclick = () => { Ton.klick(); socket.emit("einstellungen", { runden: +b.dataset.runden }); }));
  app.querySelectorAll("[data-sek]").forEach((b) => (b.onclick = () => { Ton.klick(); socket.emit("einstellungen", { sekunden: +b.dataset.sek }); }));
  app.querySelectorAll("[data-kat]").forEach((b) => (b.onclick = () => {
    Ton.klick();
    const k = b.dataset.kat;
    const neu = e.kategorien.includes(k) ? e.kategorien.filter((x) => x !== k) : [...e.kategorien, k];
    if (!neu.length) return toast("Mindestens eine Kategorie muss an sein.");
    socket.emit("einstellungen", { kategorien: neu });
  }));
}

async function teilen() {
  const link = `${location.origin}/?raum=${zustand.code}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title: "Preis-Schätzer", text: `Spiel mit! Raum-Code: ${zustand.code}`, url: link }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(link); toast("Link kopiert! Schick ihn deinen Freunden.", true); }
  catch { prompt("Kopiere diesen Link:", link); }
}
$("#raumChip").onclick = () => zustand && teilen();
$("#tonBtn").onclick = () => { $("#tonBtn").textContent = Ton.umschalten() ? "🔊" : "🔇"; };
$("#tonBtn").textContent = Ton.an ? "🔊" : "🔇";
document.addEventListener("pointerdown", () => Ton.entsperren(), { once: true });

function verlassen() {
  socket.emit("verlassen");
  speicher("raum", null);
  history.replaceState(null, "", "/");
  zustand = null;
  zeigeStart();
}

// =============================================================
//  Frage
// =============================================================
function zeigeFrage(key, neueRunde) {
  ansicht = key;
  const r = zustand.runde;
  const m = MODI[r.modus];
  eingabe = { einheit: 0, text: "" };
  sortierung = [];

  if (neueRunde) zeigeIntro(r);

  const kopf = `
    <div class="runden-kopf">
      <span class="modus-badge">${m.icon} ${m.titel}</span>
      <span class="runden-nr">Runde ${r.nr} / ${zustand.einstellungen.runden}</span>
      <span class="timer-zahl" id="timerZahl"></span>
    </div>
    <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div>`;

  let inhalt = "";
  if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
    const p = r.produkte[0];
    inhalt = `
      <div class="frage-layout">
        ${produktKarte(p)}
        <div class="karte eingabe-karte" id="eingabeBereich">
          ${r.modus === "nichtdrueber"
            ? `<div class="regel warnung">🔥 <span><b>Nicht drüber!</b> Wer über dem echten Preis liegt, bekommt 0 Punkte.</span></div>`
            : `<div class="regel">🎯 <span>Schätz den Preis. Nutze die Knöpfe für Tausend, Millionen &amp; Co.</span></div>`}
          <form id="tippForm" autocomplete="off">
            <div class="betrag">
              <input id="tippInput" inputmode="decimal" placeholder="0" aria-label="Dein Tipp" />
              <span class="waehrung" id="waehrung">${p.w}</span>
            </div>
            <div class="einheiten" style="margin-top:10px">
              ${EINHEITEN.map((e, i) => `<button type="button" data-einheit="${i}" class="${i === 0 ? "aktiv" : ""}">${e.label || p.w}</button>`).join("")}
            </div>
            <div class="vorschau" id="vorschau" style="margin:12px 0"></div>
            <button class="btn gross voll" type="submit" id="tippBtn">Tipp abgeben</button>
          </form>
        </div>
      </div>`;
  } else if (r.modus === "hoehertiefer") {
    const [a, b] = r.produkte;
    inhalt = `
      <div class="duell">
        ${produktKarte(a, `<span class="preis-etikett">${fmtPreis(a.preis, a.w)}</span>`)}
        <div class="vs">VS</div>
        ${produktKarte(b, `<span class="preis-etikett frage">??? ${b.w}</span>`)}
      </div>
      <div class="karte eingabe-karte" id="eingabeBereich" style="margin-top:14px">
        <div class="regel">⚖️ <span>Ist <b>${esc(b.name)}</b> teurer oder billiger als <b>${fmtPreis(a.preis, a.w)}</b>? Je schneller, desto mehr Punkte!</span></div>
        <div class="duell-knoepfe">
          <button class="btn" data-wahl="hoeher">⬆ Teurer</button>
          <button class="btn billiger" data-wahl="tiefer">⬇ Billiger</button>
        </div>
      </div>`;
  } else if (r.modus === "sortieren") {
    inhalt = `
      <div class="sortier-hilfe"><span>1 = am billigsten</span><span>4 = am teuersten</span></div>
      <div class="sortier-gitter" id="sortierGitter">
        ${r.produkte.map((p) => `
          <button class="sortier-karte" data-id="${p.id}">
            ${bildBox(p, false)}
            <div class="t">${esc(p.name)}<div class="i">${esc(p.info)}</div></div>
          </button>`).join("")}
      </div>
      <div class="karte eingabe-karte" id="eingabeBereich" style="margin-top:14px">
        <div class="regel">📊 <span>Tippe die Karten der Reihe nach an, <b>vom billigsten zum teuersten</b>. Nochmal tippen = entfernen.</span></div>
        <div class="duell-knoepfe">
          <button class="btn zweit" id="sortReset">↺ Zurücksetzen</button>
          <button class="btn" id="sortOk" disabled>Abschicken</button>
        </div>
      </div>`;
  }

  app.innerHTML = kopf + inhalt + `<div class="status-reihe" id="statusReihe"></div>`;
  bilderEinblenden();
  verbindeFrage(r);
  aktualisiereStatus();
  starteTimer(r);
}

function verbindeFrage(r) {
  if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
    const w = r.produkte[0].w;
    const input = $("#tippInput");
    const aktualisieren = () => {
      eingabe.text = input.value;
      const e = EINHEITEN[eingabe.einheit];
      $("#waehrung").textContent = (e.label ? e.label + " " : "") + w;
      app.querySelectorAll("[data-einheit]").forEach((b) => b.classList.toggle("aktiv", +b.dataset.einheit === eingabe.einheit));
      const wert = tippWert();
      $("#vorschau").innerHTML = wert === null ? "&nbsp;"
        : `= ${fmtPreis(wert, w)}${wert >= 1e6 ? ` <div class="klein">${fmtVoll(wert)} ${w}</div>` : ""}`;
    };
    input.addEventListener("input", aktualisieren);
    app.querySelectorAll("[data-einheit]").forEach((b) => (b.onclick = () => { Ton.klick(); eingabe.einheit = +b.dataset.einheit; aktualisieren(); input.focus(); }));
    $("#tippForm").onsubmit = (ev) => {
      ev.preventDefault();
      const wert = tippWert();
      if (wert === null) return toast("Gib eine Zahl ein.");
      senden(wert, fmtPreis(wert, w));
    };
    aktualisieren();
    if (matchMedia("(pointer: fine)").matches) setTimeout(() => input.focus(), 1900);
  } else if (r.modus === "hoehertiefer") {
    app.querySelectorAll("[data-wahl]").forEach((b) => (b.onclick = () =>
      senden(b.dataset.wahl, b.dataset.wahl === "hoeher" ? "⬆ Teurer" : "⬇ Billiger")));
  } else if (r.modus === "sortieren") {
    const zeichne = () => {
      app.querySelectorAll(".sortier-karte").forEach((k) => {
        const pos = sortierung.indexOf(k.dataset.id);
        k.classList.toggle("gewaehlt", pos >= 0);
        k.querySelector(".rang-marke")?.remove();
        if (pos >= 0) k.insertAdjacentHTML("afterbegin", `<span class="rang-marke">${pos + 1}</span>`);
      });
      $("#sortOk").disabled = sortierung.length !== r.produkte.length;
    };
    app.querySelectorAll(".sortier-karte").forEach((k) => (k.onclick = () => {
      if (!$("#sortOk")) return;
      const id = k.dataset.id;
      sortierung = sortierung.includes(id) ? sortierung.filter((x) => x !== id) : [...sortierung, id];
      Ton.klick();
      zeichne();
    }));
    $("#sortReset").onclick = () => { sortierung = []; zeichne(); };
    $("#sortOk").onclick = () => senden([...sortierung], "Reihenfolge abgeschickt");
  }
}

function tippWert() {
  let t = eingabe.text.replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.500 = 1500
  const zahl = parseFloat(t);
  if (!isFinite(zahl) || zahl < 0) return null;
  return zahl * EINHEITEN[eingabe.einheit].faktor;
}

function senden(wert, anzeige) {
  socket.emit("antwort", wert);
  Ton.abgeben();
  zeigeAbgegeben(anzeige);
}

function zeigeAbgegeben(anzeige) {
  const bereich = $("#eingabeBereich");
  if (!bereich) return;
  bereich.innerHTML = `<div class="abgegeben">✅ Abgegeben!${anzeige ? `<div class="gross">${esc(anzeige)}</div>` : ""}
    <div class="leise" style="margin-top:6px">Warte auf die anderen …</div></div>`;
  // Sortier-Karten sperren
  app.querySelectorAll(".sortier-karte").forEach((k) => (k.style.pointerEvents = "none"));
}

function aktualisiereStatus() {
  const z = zustand;
  const reihe = $("#statusReihe");
  if (!reihe) return;
  reihe.innerHTML = z.spieler.filter((s) => s.online).map((s) =>
    `<span class="status ${s.fertig ? "fertig" : ""}" title="${esc(s.name)}"><span class="avatar">${s.avatar}</span></span>`).join("");
  // Nach Neuladen der Seite: eigene Antwort ist schon da
  const ich = z.spieler.find((s) => s.id === spielerId);
  if (ich?.fertig && !$(".abgegeben")) zeigeAbgegeben("");
}

function starteTimer(r) {
  stoppeTimer();
  const ende = Date.now() + r.restMs;
  const gesamt = r.sekunden * 1000;
  let letzteSek = null;
  const tick = () => {
    const rest = Math.max(0, ende - Date.now());
    const anteil = Math.min(1, rest / gesamt);
    const sek = Math.ceil(Math.min(rest, gesamt) / 1000);
    const balken = $("#timerBalken");
    if (!balken) return stoppeTimer();
    balken.style.transform = `scaleX(${anteil})`;
    const knapp = rest <= 5000;
    $("#timer").classList.toggle("knapp", knapp);
    const zahl = $("#timerZahl");
    zahl.textContent = sek;
    zahl.classList.toggle("knapp", knapp && rest > 0);
    if (knapp && sek !== letzteSek && sek > 0 && !$(".abgegeben")) Ton.tick();
    letzteSek = sek;
    if (rest <= 0) stoppeTimer();
  };
  tick();
  timerInterval = setInterval(tick, 200);
}
function stoppeTimer() { clearInterval(timerInterval); timerInterval = null; }

function zeigeIntro(r) {
  const m = MODI[r.modus];
  const intro = $("#intro");
  intro.innerHTML = `<div>
    <div class="nr">Runde ${r.nr} von ${zustand.einstellungen.runden}</div>
    <div class="icon">${m.icon}</div>
    <div class="titel">${m.titel}</div>
    <div class="text">${m.text}</div></div>`;
  intro.classList.remove("versteckt");
  Ton.rundeStart();
  clearTimeout(zeigeIntro.t);
  zeigeIntro.t = setTimeout(() => intro.classList.add("versteckt"), Math.min(1700, r.restMs - r.sekunden * 1000));
}

// =============================================================
//  Auflösung
// =============================================================
function zeigeAufloesung(key) {
  ansicht = key;
  stoppeTimer();
  $("#intro").classList.add("versteckt");
  const z = zustand;
  const r = z.runde;
  const host = z.hostId === spielerId;

  let links = "";
  let zielPreis = null;
  if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
    const p = r.produkte[0];
    zielPreis = p;
    links = `
      <div class="karte produkt-karte" style="padding:0">
        ${bildBox(p, true)}
        <div class="produkt-text" style="padding-bottom:0">
          <div class="produkt-name">${esc(p.name)}</div>
          <div class="produkt-info">${esc(p.info)}</div>
        </div>
        <div class="preis-reveal">
          <div class="label">Der echte Preis</div>
          <div class="preis-gross" id="preisGross">0</div>
        </div>
        <div class="zahlenstrahl" id="zahlenstrahl"></div>
        <div class="fakt" id="fakt">💡 <span>${esc(p.fakt || "")}</span></div>
      </div>`;
  } else if (r.modus === "hoehertiefer") {
    const [a, b] = r.produkte;
    zielPreis = b;
    links = `
      <div class="duell">
        ${produktKarte(a, `<span class="preis-etikett">${fmtPreis(a.preis, a.w)}</span>`)}
        <div class="vs">VS</div>
        ${produktKarte(b, `<span class="preis-etikett" id="preisGross">0</span>`)}
      </div>
      <div class="urteil ${r.loesung}" id="urteil" style="visibility:hidden">${r.loesung === "hoeher" ? "⬆ TEURER!" : "⬇ BILLIGER!"}</div>
      <div class="karte fakt" id="fakt" style="margin:0">💡 <span>${esc(b.fakt || "")}</span></div>`;
  } else if (r.modus === "sortieren") {
    const nachId = Object.fromEntries(r.produkte.map((p) => [p.id, p]));
    links = `
      <div class="karte" style="padding:0">
        <div class="preis-reveal"><div class="label">Richtige Reihenfolge</div></div>
        <div class="loesung-liste">
          ${r.loesung.map((id, i) => {
            const p = nachId[id];
            return `<div class="loesung-zeile ergebnis" data-stufe="${i}">
              <span class="nr">${i + 1}</span>
              <span class="thumb">${p.bild ? `<img src="${esc(p.bild.url)}" alt="" loading="lazy">` : p.emoji}</span>
              <span class="n">${esc(p.name)}</span>
              <span class="p">${fmtPreis(p.preis, p.w)}</span>
            </div>`;
          }).join("")}
        </div>
        ${new Set(r.produkte.map((p) => p.w)).size > 1 ? '<div class="leise" style="padding:0 16px 14px;font-size:.8rem">Verschiedene Währungen wurden umgerechnet verglichen.</div>' : ""}
      </div>`;
  }

  const rechts = `
    <div>
      <div class="abschnitt-titel" style="margin-top:0">Diese Runde</div>
      <div class="ergebnis-liste">${r.ergebnisse.map((e) => ergebnisZeile(e, r)).join("")}</div>
      <div class="abschnitt-titel">Punktestand</div>
      <div class="rangliste" id="rangliste"></div>
      <div class="start-leiste">
        ${host
          ? `<button class="btn gross voll" id="weiterBtn">Nächste Runde ➜</button>`
          : `<div class="warte">Warte auf den Host<span class="punkte"><span>.</span><span>.</span><span>.</span></span></div>`}
      </div>
    </div>`;

  app.innerHTML = `
    <div class="runden-kopf">
      <span class="modus-badge">${MODI[r.modus].icon} ${MODI[r.modus].titel}</span>
      <span class="runden-nr">Runde ${r.nr} / ${z.einstellungen.runden}</span>
    </div>
    <div class="aufloesung-layout">${links}${rechts}</div>`;
  bilderEinblenden();
  $("#weiterBtn")?.addEventListener("click", () => socket.emit("naechsteRunde"));
  aktualisiereRangliste(true);
  (z.vorladen || []).forEach((url) => { const i = new Image(); i.src = url; });

  // Ablauf: Trommelwirbel → Preis zählt hoch → Ergebnisse erscheinen
  const meins = r.ergebnisse.find((e) => e.id === spielerId);
  const dauer = zielPreis ? 1500 : 300;
  if (zielPreis) {
    Ton.trommel(dauer / 1000);
    hochzaehlen($("#preisGross"), zielPreis.preis, zielPreis.w, dauer);
  }
  setTimeout(() => {
    if (!$("#rangliste")) return;
    if (zielPreis) { Ton.ding(); $("#preisGross")?.classList.add("fertig"); }
    $("#urteil")?.style.setProperty("visibility", "visible");
    if (r.modus === "klassisch" || r.modus === "nichtdrueber") zeichneZahlenstrahl(r);
    setTimeout(() => {
      if (meins?.volltreffer) Ton.volltreffer();
      else if (meins && meins.tipp !== null) (meins.punkte > 0 ? Ton.richtig : Ton.falsch)();
    }, 250);
    app.querySelectorAll(".ergebnis").forEach((el, i) => setTimeout(() => el.classList.add("sichtbar"), 150 + i * 110));
    setTimeout(() => $("#fakt")?.classList.add("sichtbar"), 500);
    if (meins?.volltreffer) konfetti(70);
  }, dauer);
}

function ergebnisZeile(e, r) {
  const s = zustand.spieler.find((x) => x.id === e.id) || { name: "?", avatar: "👤" };
  let detail = "";
  let tag = "";
  if (e.tipp === null) {
    detail = "Keine Antwort";
  } else if (r.modus === "klassisch" || r.modus === "nichtdrueber") {
    const w = r.produkte[0].w;
    const prozent = Math.round(Math.abs(e.abweichung) * 100);
    detail = `${fmtPreis(e.tipp, w)} · ${prozent === 0 ? "exakt" : `${prozent} % ${e.abweichung > 0 ? "zu hoch" : "zu niedrig"}`}`;
    if (e.volltreffer) tag = '<span class="tag gold">VOLLTREFFER</span>';
    else if (e.drueber) tag = '<span class="tag rot">DRÜBER</span>';
    else if (e.platz === 1) tag = '<span class="tag gruen">BESTER</span>';
  } else if (r.modus === "hoehertiefer") {
    detail = e.tipp === "hoeher" ? "⬆ Teurer" : "⬇ Billiger";
    tag = e.richtig ? '<span class="tag gruen">RICHTIG</span>' : '<span class="tag rot">FALSCH</span>';
  } else if (r.modus === "sortieren") {
    detail = `<span class="mini-reihe">${e.treffer.map((t, i) => `<span class="${t ? "ok" : "nein"}">${i + 1}</span>`).join("")}</span>`;
    if (e.treffer.every(Boolean)) tag = '<span class="tag gold">PERFEKT</span>';
  }
  return `<div class="ergebnis ${e.id === spielerId ? "ich" : ""}">
    <span class="avatar">${s.avatar}</span>
    <div><div class="name">${esc(s.name)}${tag}</div><div class="detail">${detail}</div></div>
    <span class="plus ${e.punkte ? "" : "null"}">+${e.punkte}</span>
  </div>`;
}

function zeichneZahlenstrahl(r) {
  const box = $("#zahlenstrahl");
  if (!box) return;
  const p = r.produkte[0];
  const tipps = r.ergebnisse.filter((e) => e.tipp > 0);
  const werte = [p.preis, ...tipps.map((e) => e.tipp)];
  const lo = Math.log10(Math.min(...werte) / 1.6);
  const hi = Math.log10(Math.max(...werte) * 1.6);
  const pos = (v) => Math.min(96, Math.max(4, ((Math.log10(v) - lo) / (hi - lo || 1)) * 100));

  const marken = tipps.map((e) => ({ e, x: pos(e.tipp) })).sort((a, b) => a.x - b.x);
  let letzteX = -100, ebene = 0;
  for (const m of marken) { ebene = m.x - letzteX < 7 ? 1 - ebene : 0; m.ebene = ebene; letzteX = m.x; }

  box.style.height = marken.some((m) => m.ebene) ? "116px" : "92px";
  box.innerHTML = `<div class="linie" style="top:40px"></div>
    <div class="ziel" style="left:${pos(p.preis)}%"><span class="fahne">${fmtPreis(p.preis, p.w)}</span><span class="stab" style="height:30px"></span></div>
    ${marken.map((m) => {
      const s = zustand.spieler.find((x) => x.id === m.e.id);
      return `<div class="marke ${m.e.drueber ? "drueber" : ""}" style="left:50%;top:${48 + m.ebene * 28}px" data-x="${m.x}" title="${esc(s?.name || "")}: ${fmtPreis(m.e.tipp, p.w)}">
        <span class="avatar">${s?.avatar || "👤"}</span></div>`;
    }).join("")}`;
  requestAnimationFrame(() => requestAnimationFrame(() =>
    box.querySelectorAll(".marke").forEach((el) => (el.style.left = el.dataset.x + "%"))));
}

function aktualisiereRangliste(mitAnimation) {
  const box = $("#rangliste");
  if (!box) return;
  const z = zustand;
  const runde = Object.fromEntries((z.runde?.ergebnisse || []).map((e) => [e.id, e.punkte]));
  const sortiert = [...z.spieler].sort((a, b) => b.punkte - a.punkte);
  const max = Math.max(1, sortiert[0]?.punkte || 1);
  box.innerHTML = sortiert.map((s, i) => `
    <div class="rang ${s.id === spielerId ? "ich" : ""} ${s.online ? "" : "offline"}">
      <span class="balken" style="width:${mitAnimation ? 0 : (s.punkte / max) * 100}%" data-w="${(s.punkte / max) * 100}"></span>
      <span class="platz">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
      <span class="avatar">${s.avatar}</span>
      <span class="name">${esc(s.name)}</span>
      <span class="pkt">${s.punkte.toLocaleString("de-DE")}${runde[s.id] ? ` <span style="color:var(--gruen);font-size:.8rem">+${runde[s.id]}</span>` : ""}</span>
    </div>`).join("");
  if (mitAnimation) setTimeout(() => box.querySelectorAll(".balken").forEach((b) => (b.style.width = b.dataset.w + "%")), 1700);
}

// =============================================================
//  Spielende
// =============================================================
function zeigeEnde(key) {
  // Erst die Auflösung der letzten Runde zeigen, dann das Podest
  if (ansicht !== "aufloesung-final-" + zustand.runde.nr) {
    zeigeAufloesung("aufloesung-final-" + zustand.runde.nr);
    const weiter = $(".start-leiste");
    if (weiter) weiter.innerHTML = `<button class="btn gross voll" id="podestBtn">🏆 Zur Siegerehrung</button>`;
    $("#podestBtn").onclick = () => zeigePodest(key);
    ansicht = key;
    zeigeEnde.timer = setTimeout(() => ansicht === key && !$(".podest") && zeigePodest(key), 9000);
    return;
  }
}

function zeigePodest(key) {
  clearTimeout(zeigeEnde.timer);
  ansicht = key;
  const z = zustand;
  const host = z.hostId === spielerId;
  const sortiert = [...z.spieler].sort((a, b) => b.punkte - a.punkte);
  const platz = (i) => sortiert[i]
    ? `<div class="podest-platz p${i + 1}"><span class="avatar">${sortiert[i].avatar}</span>
        <div class="name">${esc(sortiert[i].name)}</div><div class="pkt">${sortiert[i].punkte.toLocaleString("de-DE")} Pkt.</div>
        <div class="podest-sockel">${i + 1}</div></div>`
    : `<div></div>`;
  const ichGewinne = sortiert[0]?.id === spielerId;

  app.innerHTML = `
    <div class="max-breite">
      <div class="sieger-titel">${ichGewinne ? "🏆 Du hast gewonnen!" : `🏆 ${esc(sortiert[0]?.name || "")} gewinnt!`}</div>
      <div class="podest">${platz(1)}${platz(0)}${platz(2)}</div>
      <div class="abschnitt-titel">Endstand</div>
      <div class="rangliste" id="rangliste"></div>
      <div class="start-leiste">
        ${host
          ? `<button class="btn gross voll" id="nochmalBtn">🔁 Nochmal spielen</button>
             <button class="btn zweit voll" id="lobbyBtn">⚙️ Einstellungen ändern</button>`
          : `<div class="warte">Der Host entscheidet, wie es weitergeht<span class="punkte"><span>.</span><span>.</span><span>.</span></span></div>`}
        <button class="btn link" id="verlassenBtn">Raum verlassen</button>
      </div>
    </div>`;
  zustand.runde.ergebnisse = [];
  aktualisiereRangliste(false);
  $("#nochmalBtn")?.addEventListener("click", () => socket.emit("spielStarten"));
  $("#lobbyBtn")?.addEventListener("click", () => socket.emit("zurLobby"));
  $("#verlassenBtn").onclick = verlassen;
  setTimeout(() => { Ton.fanfare(); konfetti(180); }, 1300);
}

// =============================================================
//  Bausteine
// =============================================================
function bildBox(p, mitCredit = true) {
  const kat = meta.kategorien.find((k) => k.id === p.kat);
  return `<div class="bild-box">
    <div class="emoji-gross">${p.emoji}</div>
    ${p.bild ? `<img src="${esc(p.bild.url)}" alt="${esc(p.name)}" decoding="async" referrerpolicy="no-referrer">` : ""}
    ${kat && mitCredit ? `<span class="kat-badge">${kat.emoji} ${esc(kat.name)}</span>` : ""}
    ${p.bild && mitCredit ? `<a class="bild-credit" href="${esc(p.bild.quelle)}" target="_blank" rel="noopener">📷 ${esc(p.bild.autor)} · ${esc(p.bild.lizenz)}</a>` : ""}
  </div>`;
}

function produktKarte(p, extra = "") {
  return `<div class="karte produkt-karte">
    ${bildBox(p)}
    <div class="produkt-text">
      <div class="produkt-name">${esc(p.name)}</div>
      <div class="produkt-info">${esc(p.info)}</div>
      ${extra}
    </div>
  </div>`;
}

// Bilder erst einblenden, wenn sie geladen sind. Bei Fehler bleibt das Emoji sichtbar.
function bilderEinblenden() {
  app.querySelectorAll(".bild-box img").forEach((img) => {
    const fertig = () => img.classList.add("geladen");
    if (img.complete && img.naturalWidth) fertig();
    else {
      img.addEventListener("load", fertig, { once: true });
      img.addEventListener("error", () => img.remove(), { once: true });
    }
  });
}

function hochzaehlen(el, ziel, w, dauer) {
  if (!el) return;
  const start = performance.now();
  const schritt = (jetzt) => {
    if (!el.isConnected) return;
    const t = Math.min(1, (jetzt - start) / dauer);
    const k = 1 - Math.pow(1 - t, 3);
    // Bei großen Zahlen logarithmisch zählen, sonst sieht man nur die letzte Sekunde etwas
    const wert = ziel > 1000 ? Math.pow(10, Math.log10(ziel) * k) * (k > 0 ? 1 : 0) : ziel * k;
    el.textContent = fmtPreis(t >= 1 ? ziel : wert, w);
    if (t < 1) requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}

// ---------- Zahlen formatieren ----------
function fmtPreis(n, w = "€") {
  if (n === null || n === undefined) return "?";
  const stufen = [[1e12, "Bio."], [1e9, "Mrd."], [1e6, "Mio."]];
  for (const [f, name] of stufen) {
    if (n >= f) return `${(n / f).toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${name} ${w}`;
  }
  let opt;
  if (Number.isInteger(n)) opt = { maximumFractionDigits: 0 };
  else if (n < 1) opt = { minimumFractionDigits: 2, maximumFractionDigits: 4 };
  else opt = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `${n.toLocaleString("de-DE", opt)} ${w}`;
}
function fmtVoll(n) { return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }); }

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let toastTimer;
function toast(text, ok = false) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.toggle("ok", ok);
  t.classList.remove("versteckt");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("versteckt"), 3200);
}

// ---------- Konfetti (läuft nur kurz, dann wird nichts mehr gezeichnet) ----------
function konfetti(anzahl = 150) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("#konfetti");
  const ctx = c.getContext("2d");
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const farben = ["#ffcb47", "#ff9f1c", "#3ee08f", "#5cc8ff", "#a77bff", "#ff5d73"];
  const teile = Array.from({ length: anzahl }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    f: farben[(Math.random() * farben.length) | 0],
  }));
  const start = performance.now();
  const frame = (jetzt) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const t of teile) {
      t.vy += 0.35; t.vx *= 0.99; t.x += t.vx; t.y += t.vy; t.r += t.vr;
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.r);
      ctx.fillStyle = t.f; ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h * Math.abs(Math.cos(t.r * 2)));
      ctx.restore();
    }
    if (jetzt - start < 3800) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// Erste Anzeige, falls "meta" schon vorher ankam oder der Server langsam aufwacht
zeigeStart();
