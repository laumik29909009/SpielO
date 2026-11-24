// =============================================================
//  Die Millionenfrage – Browser-Teil
//  Dunkles Studio mit schwenkenden Scheinwerfern, Lichterkranz und Geldleiter.
//  Eingeloggte Antwort leuchtet orange, das Licht wird gedimmt, Herzschlag –
//  dann grün (Lichter blitzen gold) oder rot. Wer nicht Kandidat ist, tippt mit.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const app = GN.app;
  const BUCHST = ["A", "B", "C", "D"];
  const euro = (n) => `${Number(n || 0).toLocaleString("de-DE")} €`;
  let letzte = {}, herz = null, sortierFolge = [], vorgemerkt = null;
  let studio3d = null, ring = { ende: 0, gesamt: 0, an: false };
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.animationen === "aus";
  const will3d = () => GN.speicher("mi3d") !== "aus" && !!window.MiStudio3D?.moeglich() && !ruhig();

  const person = (id) => GN.spieler(id);
  const ichKandidat = (z) => z.kandidat === GN.ich;

  // ---------- Lobby ----------
  function abschnitte(z, host) {
    const e = z.einstellungen, dis = host ? "" : "disabled";
    return [{
      id: "spiel", wichtig: true, icon: "💰", titel: "So wird gespielt", info: `${e.kandidaten === 10 ? "Alle" : e.kandidaten} Kandidat${e.kandidaten === 1 ? "" : "en"} · ${e.sekunden ? e.sekunden + " s" : "ohne Zeitlimit"}`,
      html: `<p>15 Fragen bis zur Million. Bei <b>500 €</b> und <b>16.000 €</b> ist dein Gewinn sicher. Drei Joker: <b>50:50</b>, <b>Publikum</b> (die anderen stimmen wirklich ab) und <b>Telefon</b> (du rufst einen Mitspieler an).</p>
        <p class="leise klein-text">Mit mehreren Spielern entscheidet eine Auswahlrunde, wer auf den Stuhl darf: Wer vier Begriffe am schnellsten richtig sortiert. Alle anderen sitzen im Publikum und tippen mit.</p>
        <div class="einstellungs-zeile" style="margin-top:8px">
          <div><div class="unter-titel">Kandidaten nacheinander</div><div class="segment">${[[1, "1"], [2, "2"], [3, "3"], [10, "Alle"]].map(([n, t]) => `<button data-mi-kand="${n}" class="${e.kandidaten === n ? "aktiv" : ""}" ${dis}>${t}</button>`).join("")}</div></div>
          <div><div class="unter-titel">Bedenkzeit pro Frage</div><div class="segment">${[[0, "∞"], [60, "60 s"], [120, "120 s"]].map(([n, t]) => `<button data-mi-sek="${n}" class="${e.sekunden === n ? "aktiv" : ""}" ${dis}>${t}</button>`).join("")}</div></div>
        </div>`,
    }];
  }
  function binde(el) {
    $$("[data-mi-kand]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ kandidaten: +b.dataset.miKand })));
    $$("[data-mi-sek]", el).forEach((b) => (b.onclick = () => GN.einstellungen({ sekunden: +b.dataset.miSek })));
  }

  // ---------- Bühne ----------
  function zeige(z, vorher) {
    if (z.phase === "ende") {
      herzStopp();
      if (/podest/.test(GN.ansicht)) return;
      if (GN.ansicht !== "mi-ende") { GN.ansicht = "mi-ende"; GN.podest("mi-podest", { einheit: "€" }); }
      return;
    }
    if (GN.ansicht !== "mi-spiel" || !$(".mi-studio")) aufbauen();
    const studio = $(".mi-studio");
    studio.dataset.phase = z.phase;
    leiter(z);
    const schluessel = `${z.phase}|${z.kandidat}|${z.stufe}|${z.frage?.text || ""}`;
    const neu = schluessel !== letzte.schluessel;
    letzte.schluessel = schluessel;
    if (z.phase === "auswahl") { if (neu) { sortierFolge = []; auswahl(z); } else auswahlStand(z); }
    else if (z.phase === "vorstellung") { if (neu) vorstellung(z); }
    else if (z.phase === "zwischen") { if (neu) zwischen(z); }
    else frage(z, neu);
    // Timer
    if (neu || z.phase !== vorher?.phase) {
      const mitZeit = z.restMs > 0 && ["auswahl", "frage", "publikum", "telefon"].includes(z.phase);
      $("#timer").style.visibility = mitZeit ? "visible" : "hidden";
      if (mitZeit) GN.starteTimer(z.restMs, z.restMs, { tickAb: 5000 });
      else GN.stoppeTimer();
      // Uhr-Ring im Studio: gesamte Zeit = beim ersten Sehen dieser Phase verbleibende Zeit
      ring = mitZeit ? { ende: Date.now() + z.restMs, gesamt: neu || !ring.an ? z.restMs : ring.gesamt, an: true } : { an: false };
      ringZeichnen();
    }
    studioStimmung(z);
  }

  // ---------- 3D-Studio ----------
  function studioStimmung(z) {
    // Bildschirm hinten und Uhr-Mitte
    const mitte = $("#miRingText");
    const betrag = z.leiter?.[Math.min(14, z.stufe)];
    if (mitte && !ring.an) mitte.innerHTML = ["frage", "eingeloggt", "aufloesung", "publikum", "telefon"].includes(z.phase) ? `<small>Frage ${z.stufe + 1}</small>${euro(betrag).replace(" €", "")}<small>€</small>` : "💰";
    if (!studio3d) return;
    const k = z.kandidat ? person(z.kandidat) : null;
    const kSchluessel = ["auswahl"].includes(z.phase) ? "" : z.kandidat || "";
    if (studio3d.kandidatId !== (kSchluessel || null)) studio3d.kandidat(kSchluessel && k ? { id: z.kandidat, avatar: k.avatar, name: z.kandidat === GN.ich ? "Du" : k.name, unter: "Kandidat" } : null);
    const bild = z.phase === "auswahl" ? ["AUSWAHLRUNDE", "Wer ist am schnellsten?"]
      : z.phase === "zwischen" ? [z.zwischen?.grund === "million" ? "MILLIONÄR!" : "GEWINN", euro(z.zwischen?.gewinn)]
      : z.phase === "vorstellung" ? ["AUF DEM STUHL", k?.name || ""]
      : [`FRAGE ${z.stufe + 1}`, euro(betrag)];
    const bs = bild.join("|");
    if (letzte.bild !== bs) { letzte.bild = bs; studio3d.bildschirm(...bild); }
    let st = { auswahl: "auswahl", publikum: "publikum", telefon: "telefon", eingeloggt: "spannung", vorstellung: "ruhe" }[z.phase] || "ruhe";
    if (z.phase === "aufloesung") st = z.ergebnis === true ? "gold" : z.ergebnis === false ? "rot" : "ruhe";
    if (z.phase === "zwischen") st = z.zwischen?.grund === "million" ? "million" : z.zwischen?.grund === "falsch" || z.zwischen?.grund === "zeit" ? "rot" : "ruhe";
    const stSchluessel = `${st}|${z.phase}|${z.stufe}|${z.kandidat}`;
    if (letzte.stimmung !== stSchluessel) {
      letzte.stimmung = stSchluessel;
      studio3d.stimmung(st);
      if (z.phase === "vorstellung") studio3d.vorstellen();
    }
  }
  function ringZeichnen() {
    const el = $("#miRing");
    if (!el) return;
    el.classList.toggle("aus", !ring.an);
    if (!ring.an) return;
    const rest = Math.max(0, ring.ende - Date.now());
    const anteil = ring.gesamt ? rest / ring.gesamt : 0;
    $("circle.mi-ring-voll", el).style.strokeDashoffset = String(289 * (1 - anteil));
    el.classList.toggle("knapp", rest <= 10000);
    $("#miRingText").innerHTML = `${Math.ceil(rest / 1000)}<small>Sek.</small>`;
    if (rest > 0) requestAnimationFrame(() => setTimeout(ringZeichnen, 120));
  }
  async function studioStarten() {
    studio3d?.zerstoeren?.(); studio3d = null;
    const host = $("#mi3d");
    if (!host || !will3d()) { $(".mi-studio")?.classList.remove("mit3d"); return; }
    $(".mi-studio").classList.add("mit3d");
    try {
      const s = await window.MiStudio3D.einhaengen(host);
      if (!host.isConnected) return s.zerstoeren();
      studio3d = s; letzte.bild = letzte.stimmung = null;
      host.classList.add("bereit");
      if (GN.zustand?.spiel === "millionen") studioStimmung(GN.zustand);
    } catch (e) { console.warn("3D-Studio nicht verfügbar", e); $(".mi-studio")?.classList.remove("mit3d"); }
  }

  function aufbauen() {
    GN.ansicht = "mi-spiel";
    letzte = {};
    app.innerHTML = `
      <div class="mi-studio" data-phase="">
        <div class="mi-licht" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i class="mi-strahl" style="--i:${i}"></i>`).join("")}</div>
        <div class="mi-kranz" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--w:${(i / 28) * 360}deg;--i:${i}"></i>`).join("")}</div>
        <div class="mi-boden" aria-hidden="true"></div>
        <div class="mi-inhalt">
          <div class="mi-mitte">
            <div class="mi-3d" id="mi3d">
              <button class="mi-3d-knopf" id="mi3dKnopf" title="3D-Studio an/aus">${will3d() ? "3D" : "2D"}</button>
            </div>
            <div class="mi-uhr">
              <div class="mi-ring aus" id="miRing"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" class="mi-ring-grund"/><circle cx="50" cy="50" r="46" class="mi-ring-voll"/></svg></div>
              <div class="mi-ring-text" id="miRingText">💰</div>
            </div>
            <div class="timer" id="timer"><div class="timer-balken" id="timerBalken"></div></div><span class="timer-zahl versteckt" id="timerZahl"></span>
            <div class="mi-buehne" id="miBuehne"></div>
          </div>
          <aside class="mi-leiter"><div class="mi-joker" id="miJoker"></div><div id="miLeiter"></div></aside>
        </div>
      </div>`;
    $("#mi3dKnopf").onclick = () => {
      Ton.klick();
      GN.speicher("mi3d", will3d() || GN.speicher("mi3d") !== "aus" ? "aus" : "an");
      $("#mi3dKnopf").textContent = GN.speicher("mi3d") === "aus" ? "2D" : "3D";
      if (GN.speicher("mi3d") === "aus") { studio3d?.zerstoeren(); studio3d = null; $(".mi-studio").classList.remove("mit3d"); $("#mi3d").classList.remove("bereit"); }
      else studioStarten();
    };
    studioStarten();
  }

  // Geldleiter rechts (am Handy als kompakte Leiste oben)
  function leiter(z) {
    const box = $("#miLeiter");
    const aktiv = ["frage", "eingeloggt", "aufloesung", "publikum", "telefon"].includes(z.phase);
    const html = `<div class="mi-leiter-kurz"><span>Sicher: <b>${euro(z.gesichert)}</b></span><span>Frage ${Math.min(15, z.stufe + 1)}: <b>${euro(z.leiter[Math.min(14, z.stufe)])}</b></span></div>
      <ol>${z.leiter.map((b, i) => `<li class="${i === z.stufe && aktiv ? "jetzt" : ""} ${i < z.stufe ? "geschafft" : ""} ${z.sicher.includes(i) ? "sicher" : ""}"><span>${i + 1}</span><i>${i < z.stufe ? "◆" : ""}</i><b>${euro(b)}</b></li>`).reverse().join("")}</ol>`;
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }

  // ---------- Auswahlrunde ----------
  function auswahl(z) {
    letzte.frage = null;
    const a = z.auswahl;
    const dabei = a.teilnehmer.includes(GN.ich);
    $("#miBuehne").innerHTML = `
      <div class="mi-auswahl">
        <div class="mi-titel">Auswahlrunde</div>
        <div class="mi-frage-box"><div class="mi-frage-text">${esc(a.aufgabe)}</div></div>
        <p class="mi-hinweis">${dabei ? "Tippe die Begriffe in der richtigen Reihenfolge an. Der Schnellste darf auf den Stuhl!" : "Die Kandidaten sortieren …"}</p>
        <div class="mi-sortier">${a.begriffe.map((b, i) => `<button class="mi-sort" data-i="${i}" ${dabei ? "" : "disabled"}><em></em>${esc(b)}</button>`).join("")}</div>
        ${dabei ? '<button class="btn zweit klein" id="miNeu">↺ Neu sortieren</button>' : ""}
        <div class="mi-wer" id="miWer"></div>
      </div>`;
    Ton.ding?.();
    $$(".mi-sort").forEach((b) => (b.onclick = () => {
      const i = +b.dataset.i;
      if (sortierFolge.includes(i) || z.auswahl.abgegeben.includes(GN.ich)) return;
      Ton.klick(); sortierFolge.push(i);
      $("em", b).textContent = sortierFolge.length; b.classList.add("gesetzt");
      if (sortierFolge.length === 4) { Ton.abgeben(); GN.aktion("sortieren", sortierFolge); $$(".mi-sort").forEach((x) => (x.disabled = true)); $("#miNeu")?.remove(); }
    }));
    $("#miNeu")?.addEventListener("click", () => { sortierFolge = []; $$(".mi-sort").forEach((x) => { x.classList.remove("gesetzt"); $("em", x).textContent = ""; }); });
    auswahlStand(z);
  }
  function auswahlStand(z) {
    const box = $("#miWer");
    if (!box) return;
    box.innerHTML = z.auswahl.teilnehmer.map((id) => `<span class="${z.auswahl.abgegeben.includes(id) ? "fertig" : ""}">${person(id).avatar} ${z.auswahl.abgegeben.includes(id) ? "✓" : "…"}</span>`).join("");
  }
  function vorstellung(z) {
    letzte.frage = null;
    const k = person(z.kandidat), info = z.auswahlInfo;
    herzStopp();
    $("#miBuehne").innerHTML = `
      <div class="mi-vorstellung">
        <div class="mi-titel">Auf dem Stuhl</div>
        <div class="mi-kandidat"><span>${k.avatar}</span><b>${esc(z.kandidat === GN.ich ? "Du" : k.name)}</b></div>
        <p>${info?.ms ? `hat in ${(info.ms / 1000).toFixed(1).replace(".", ",")} Sekunden richtig sortiert!` : "spielt um eine Million Euro."}</p>
        ${ichKandidat(z) ? "" : '<p class="mi-hinweis">Du bist im Publikum: Tippe bei jeder Frage mit und sammle Publikumspunkte.</p>'}
      </div>`;
    Ton.fanfare?.();
    $(".mi-studio").classList.add("blitz"); setTimeout(() => $(".mi-studio")?.classList.remove("blitz"), 900);
  }
  function zwischen(z) {
    letzte.frage = null;
    const w = z.zwischen, k = person(w.id);
    herzStopp();
    const text = { million: "🎉 GEWINNT EINE MILLION!", falsch: "geht mit", aufgehoert: "hört auf und nimmt", zeit: "Zeit abgelaufen – mitgenommen:" }[w.grund];
    $("#miBuehne").innerHTML = `
      <div class="mi-vorstellung ${w.grund === "million" ? "million" : ""}">
        <div class="mi-kandidat"><span>${k.avatar}</span><b>${esc(w.id === GN.ich ? "Du" : k.name)}</b></div>
        <p class="mi-gross">${text}</p>
        ${w.grund === "million" ? "" : `<div class="mi-summe">${euro(w.gewinn)}</div><p>${w.grund === "falsch" ? "nach Hause." : ""}</p>`}
      </div>`;
    if (w.grund === "million") { Ton.fanfare(); GN.konfetti(260); GN.fx?.knall("💰 1.000.000 €", 3); }
  }

  // ---------- Frage ----------
  function bildHtml(b) {
    if (!b) return "";
    if (b.typ === "flagge") return `<img class="mi-flagge ${b.klein ? "klein" : ""}" src="/quiz/flaggen/${b.wert}.svg" alt="Flagge">`;
    if (b.typ === "emoji") return `<div class="mi-emoji">${esc(b.wert)}</div>`;
    if (b.typ === "umriss") return `<svg class="mi-umriss" viewBox="0 0 200 200" data-code="${b.wert}"></svg>`;
    return "";
  }
  function frage(z, neu) {
    const f = z.frage;
    if (!f) return;
    const ich = ichKandidat(z);
    const k = person(z.kandidat);
    // Neue Frage (anderer Kandidat oder andere Frage): Bühne neu aufbauen. Die Stufe zählt schon bei der Auflösung hoch, deshalb nicht im Schlüssel.
    const frageKey = `${z.kandidat}|${f.text}|${f.antworten.join("|")}`;
    if (letzte.frage !== frageKey || !$(".mi-antwort")) {
      letzte.frage = frageKey;
      herzStopp();
      vorgemerkt = null;
      $("#miBuehne").innerHTML = `
        <div class="mi-oben"><span class="mi-wer-spielt">${k.avatar} ${esc(ich ? "Du" : k.name)} · Frage ${z.stufe + 1} um <b>${euro(z.leiter[z.stufe])}</b></span><span class="mi-kat">${f.kat?.icon || ""} ${esc(f.kat?.name || "")}</span></div>
        <div class="mi-zeile mi-frage-zeile"><div class="mi-frage-box">${bildHtml(f.bild)}<div class="mi-frage-text">${esc(f.text)}</div></div></div>
        <div class="mi-antworten">${[0, 2].map((r) => `<div class="mi-zeile">${[r, r + 1].map((i) => `<button class="mi-antwort" data-i="${i}" style="--i:${i}"><span class="mi-buchst">${BUCHST[i]}:</span><span class="mi-a-text">${esc(f.antworten[i])}</span></button>`).join("")}</div>`).join("")}</div>
        <div class="mi-extra" id="miExtra"></div>`;
      if (f.bild?.typ === "umriss") fetch("/quiz/umrisse.json").then((r) => r.json()).then((u) => { const s = $(".mi-umriss"); if (s && u[s.dataset.code]) s.innerHTML = `<path d="${u[s.dataset.code]}"/>`; }).catch(() => {});
      $$(".mi-antwort").forEach((b, i) => {
        setTimeout(() => Ton.tick?.(), 300 + i * 180);
        b.onclick = () => antwortTippen(+b.dataset.i);
      });
    }
    // Zustand der Antworten
    const offen = z.phase === "aufloesung";
    $$(".mi-antwort").forEach((b) => {
      const i = +b.dataset.i;
      b.classList.toggle("weg", z.weg.includes(i));
      b.classList.toggle("eingeloggt", z.eingeloggt === i && !offen);
      b.classList.toggle("richtig", offen && f.richtig === i);
      b.classList.toggle("falsch", offen && z.eingeloggt === i && f.richtig !== i);
      b.disabled = z.weg.includes(i) || offen || z.phase === "eingeloggt" || (ich ? z.phase !== "frage" : z.tipps.includes(GN.ich) && z.phase !== "publikum");
    });
    joker(z);
    extra(z);
    // Dramaturgie
    const studio = $(".mi-studio");
    studio.classList.toggle("spannung", z.phase === "eingeloggt");
    if (z.phase === "eingeloggt" && letzte.phaseFx !== "eingeloggt" + z.stufe) { letzte.phaseFx = "eingeloggt" + z.stufe; Ton.abgeben(); herzStart(z.stufe); }
    if (z.phase === "aufloesung" && letzte.phaseFx !== "auf" + z.stufe + z.kandidat + f.text) {
      letzte.phaseFx = "auf" + z.stufe + z.kandidat + f.text;
      herzStopp();
      if (z.ergebnis === true) {
        Ton.richtig(); Ton.aufsteigen?.(0.7, 1.2);
        studio.classList.add("gold"); setTimeout(() => studio.classList.remove("gold"), 1400);
        GN.fx?.funken($(".mi-antwort.richtig"), { anzahl: 18, farben: ["#ffd23f", "#fff3b0", "#ff9f1c"] });
        if (z.sicher.includes(z.stufe - 1)) GN.fx?.knall(`🛡️ ${euro(z.leiter[z.stufe - 1])} sind sicher!`, 2);
      } else if (z.ergebnis === false) {
        Ton.falsch(); Ton.treffer?.(); GN.fx?.wackeln(2);
        studio.classList.add("rot"); setTimeout(() => studio.classList.remove("rot"), 1400);
        if (ich) navigator.vibrate?.([80, 40, 140]);
      } else {
        GN.fx?.knall(`👋 Aufgehört mit ${euro(z.aktuell)}`, 1);
      }
    }
  }
  function antwortTippen(i) {
    const z = GN.zustand;
    if (ichKandidat(z)) {
      if (z.phase !== "frage") return;
      Ton.klick();
      // Sicherheitsfrage wie im Studio: Ist das Ihre endgültige Antwort?
      const b = $(`.mi-antwort[data-i="${i}"]`);
      if (vorgemerkt !== i) { $$(".mi-antwort.vorgemerkt").forEach((x) => x.classList.remove("vorgemerkt")); b.classList.add("vorgemerkt"); vorgemerkt = i; extra(z); return; }
      vorgemerkt = null; b.classList.remove("vorgemerkt"); GN.aktion("antwort", i);
    } else if (z.phase === "publikum") { Ton.klick(); GN.aktion("stimme", i); }
    else if (z.phase === "frage" || z.phase === "telefon") {
      if (z.telefon?.an === GN.ich && z.phase === "telefon") return;
      Ton.klick(); GN.aktion("tipp", i); $(`.mi-antwort[data-i="${i}"]`)?.classList.add("getippt");
    }
  }

  function joker(z) {
    const box = $("#miJoker");
    if (!box) return;
    const ich = ichKandidat(z);
    const j = z.joker;
    const html = `
      <div class="mi-j-reihe">
      <button class="mi-j ${j.fifty ? "" : "benutzt"}" data-j="fifty" ${ich && j.fifty && z.phase === "frage" ? "" : "disabled"} title="50:50-Joker">50:50</button>
      <button class="mi-j ${j.publikum ? "" : "benutzt"}" data-j="publikum" ${ich && j.publikum && z.phase === "frage" ? "" : "disabled"} title="Publikumsjoker"><svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.6"/><circle cx="17" cy="8" r="2.6"/><circle cx="12" cy="6.5" r="3"/><path d="M2.5 18c0-3 2-5 4.5-5s3 1 3 1M21.5 18c0-3-2-5-4.5-5s-3 1-3 1M6.5 19c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6z"/></svg></button>
      <button class="mi-j ${j.telefon ? "" : "benutzt"}" data-j="telefon" ${ich && j.telefon && z.phase === "frage" ? "" : "disabled"} title="Telefonjoker"><svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg></button>
      </div>
      ${ich ? `<button class="btn zweit klein mi-stopp" data-j="aufhoeren" ${z.phase === "frage" ? "" : "disabled"}>✋ Aufhören (${euro(z.aktuell)})</button>` : `<span class="mi-pp">🎟️ Deine Publikumspunkte: <b>${z.publikumPunkte?.[GN.ich] || 0}</b></span>`}`;
    if (box.dataset.html === html) return;
    box.dataset.html = html; box.innerHTML = html;
    $$("[data-j]", box).forEach((b) => (b.onclick = () => {
      const a = b.dataset.j;
      if (a === "aufhoeren") { if (confirm(`Aufhören und ${euro(z.aktuell)} mitnehmen?`)) { Ton.klick(); GN.aktion("aufhoeren"); } return; }
      if (a === "telefon") return telefonWahl(z);
      Ton.wusch?.(); GN.aktion(a);
    }));
  }
  function telefonWahl(z) {
    const andere = GN.alle(z).filter((s) => s.id !== GN.ich && s.online && !s.bot);
    if (!andere.length) { Ton.wusch?.(); return GN.aktion("telefon", null); }
    const box = $("#miExtra");
    box.innerHTML = `<div class="mi-karte"><b>📞 Wen willst du anrufen?</b><div class="mi-anrufen">${andere.map((s) => `<button class="btn zweit klein" data-an="${s.id}">${s.avatar} ${esc(s.name)}</button>`).join("")}<button class="btn zweit klein" data-an="">👴 Opa Erwin (Computer)</button></div></div>`;
    $$("[data-an]", box).forEach((b) => (b.onclick = () => { Ton.klick(); GN.aktion("telefon", b.dataset.an || null); }));
  }
  // Bereich unter dem Joker: Publikum, Telefon, Sicherheitsfrage
  function extra(z) {
    const box = $("#miExtra");
    if (!box) return;
    let html = "";
    const ich = ichKandidat(z);
    if (vorgemerkt !== null && ich && z.phase === "frage") html = `<div class="mi-karte gold"><b>Ist ${BUCHST[vorgemerkt]} deine endgültige Antwort?</b><div class="mi-anrufen"><button class="btn" id="miLogIn">🔒 Einloggen</button><button class="btn zweit" id="miDoch">Nochmal überlegen</button></div></div>`;
    else if (z.phase === "publikum") html = ich ? `<div class="mi-karte"><b>👥 Das Publikum stimmt ab …</b><p>${z.publikum?.abgestimmt?.length || 0} Stimme(n) bisher</p></div>`
      : `<div class="mi-karte gold"><b>👥 Publikumsjoker!</b><p>Tippe die Antwort, die du für richtig hältst.</p></div>`;
    else if (z.publikum?.ergebnis) html = `<div class="mi-karte"><b>👥 Das Publikum sagt:</b><div class="mi-balken">${[0, 1, 2, 3].map((i) => `<div class="${z.weg.includes(i) ? "weg" : ""}"><i style="--p:${z.publikum.ergebnis[i] || 0}%"></i><em>${z.publikum.ergebnis[i] || 0} %</em><span>${BUCHST[i]}</span></div>`).join("")}</div></div>`;
    if (z.phase === "telefon") {
      const t = z.telefon;
      html += t.an === GN.ich
        ? `<div class="mi-karte gold"><b>📞 ${esc(person(z.kandidat).name)} ruft dich an!</b><p>Welche Antwort ist richtig?</p><div class="mi-anrufen">${BUCHST.map((b, i) => z.weg.includes(i) ? "" : `<button class="btn zweit klein" data-ruf="${i}">${b}</button>`).join("")}</div>
            <div class="segment" style="margin-top:8px"><button data-sicher="sicher" class="aktiv">Ganz sicher</button><button data-sicher="ziemlich">Ziemlich sicher</button><button data-sicher="geraten">Geraten</button></div></div>`
        : `<div class="mi-karte"><b>📞 Telefonjoker: ${t.avatar} ${esc(t.name)} wird angerufen …</b><div class="mi-klingeln">📱</div></div>`;
    } else if (z.telefon?.sicher) {
      const t = z.telefon;
      const spruch = t.antwort === null || t.antwort === undefined ? "„Tut mir leid, da muss ich passen …“" : `„${t.sicher === "sicher" ? "Ich bin mir ganz sicher:" : t.sicher === "ziemlich" ? "Ich glaube, es ist" : "Ich rate mal:"} ${BUCHST[t.antwort]}!“`;
      html += `<div class="mi-karte"><b>📞 ${t.avatar} ${esc(t.name)}:</b><p class="mi-zitat">${spruch}</p></div>`;
    }
    if (!ich && z.tipps.includes(GN.ich) && ["frage", "eingeloggt"].includes(z.phase)) html += `<p class="mi-hinweis">✓ Dein Tipp ist abgegeben.</p>`;
    if (z.phase === "aufloesung" && z.frage?.richtig != null) html += `<button class="mi-melden" id="miMelden">⚑ Frage melden</button>`;
    if (box.dataset.html === html) return;
    box.dataset.html = html; box.innerHTML = html;
    // Aufforderungen (Anruf, Abstimmung, Sicherheitsfrage) ins Bild holen, vor allem am Handy
    const wichtig = box.querySelector(".mi-karte.gold");
    if (wichtig) { wichtig.scrollIntoView({ behavior: "smooth", block: "center" }); navigator.vibrate?.(30); }
    $("#miMelden")?.addEventListener("click", () => GN.frageMelden("millionen", GN.zustand.frage));
    $("#miLogIn")?.addEventListener("click", () => { const i = vorgemerkt; vorgemerkt = null; $$(".mi-antwort.vorgemerkt").forEach((x) => x.classList.remove("vorgemerkt")); GN.aktion("antwort", i); });
    $("#miDoch")?.addEventListener("click", () => { vorgemerkt = null; $$(".mi-antwort.vorgemerkt").forEach((x) => x.classList.remove("vorgemerkt")); extra(GN.zustand); });
    let sicher = "sicher";
    $$("[data-sicher]", box).forEach((b) => (b.onclick = () => { sicher = b.dataset.sicher; $$("[data-sicher]", box).forEach((x) => x.classList.toggle("aktiv", x === b)); }));
    $$("[data-ruf]", box).forEach((b) => (b.onclick = () => { Ton.abgeben(); GN.aktion("anruf", { i: +b.dataset.ruf, sicher }); }));
  }

  // Herzschlag während der Spannungspause (schneller bei hohen Stufen)
  function herzStart(stufe) {
    herzStopp();
    const takt = Math.max(520, 900 - stufe * 25);
    herz = setInterval(() => Ton.klopf?.(), takt);
  }
  function herzStopp() { clearInterval(herz); herz = null; }

  GN.spiele.millionen = {
    icon: "💰",
    titel: "Die Millionenfrage",
    kurz: "15 Fragen bis zur Million – mit Publikumsjoker, Telefonjoker und echter Studio-Spannung.",
    beschreibung: "Setz dich auf den heißen Stuhl: 15 Fragen, immer schwerer, bis zur Million. Die anderen sitzen im Publikum, stimmen beim Publikumsjoker wirklich ab und können per Telefonjoker angerufen werden. Mit Auswahlrunde, Sicherheitsstufen und Lichtshow.",
    tags: ["💰 Quiz-Show", "📞 Joker", "👥 1–10 Spieler"],
    abschnitte,
    binde,
    zeige,
  };
})();
