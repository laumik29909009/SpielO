// =============================================================
//  Profil mit Statistiken (pro Gerät, ohne Anmeldung)
//  Wird zentral bei jeder Siegerehrung erfasst (GN.podest ruft GN.profilErfassen auf).
//  Gespeichert in localStorage unter "profil": Spiele, Siege, Bestwerte, Erfolge.
// =============================================================
(() => {
  const { $, $$, esc } = GN;
  const SCHLUESSEL = "profil";
  const leer = () => ({ seit: Date.now(), spiele: {}, gesamt: { gespielt: 0, siege: 0, podest: 0 }, serie: 0, besteSerie: 0, erfolge: {}, letzte: [] });
  function laden() {
    try { const p = JSON.parse(GN.speicher(SCHLUESSEL) || "null"); return p && p.spiele ? p : leer(); } catch { return leer(); }
  }
  const speichern = (p) => GN.speicher(SCHLUESSEL, JSON.stringify(p));

  // Erfolge: [id, Symbol, Titel, Beschreibung, Bedingung(profil)]
  const ERFOLGE = [
    ["erstesSpiel", "🎮", "Erste Runde", "Dein erstes Spiel beendet", (p) => p.gesamt.gespielt >= 1],
    ["ersterSieg", "🥇", "Erster Sieg", "Ein Spiel gewonnen", (p) => p.gesamt.siege >= 1],
    ["zehnSpiele", "🔟", "Stammgast", "10 Spiele beendet", (p) => p.gesamt.gespielt >= 10],
    ["fuenfzigSpiele", "🏟️", "Dauerbrenner", "50 Spiele beendet", (p) => p.gesamt.gespielt >= 50],
    ["zehnSiege", "🏆", "Seriensieger", "10 Spiele gewonnen", (p) => p.gesamt.siege >= 10],
    ["serie3", "🔥", "Heiße Serie", "3 Siege hintereinander", (p) => p.besteSerie >= 3],
    ["allrounder", "🧩", "Allrounder", "5 verschiedene Spiele gespielt", (p) => Object.keys(p.spiele).length >= 5],
    ["alleSpiele", "🌍", "Weltenbummler", "10 verschiedene Spiele gespielt", (p) => Object.keys(p.spiele).length >= 10],
    ["millionaer", "💰", "Millionär", "Bei der Millionenfrage die Million geholt", (p) => (p.spiele.millionen?.bester || 0) >= 1000000],
    ["riesenschlange", "🐍", "Riesenschlange", "In der Schlangengrube 300 lang geworden", (p) => (p.spiele.schlange?.bester || 0) >= 300],
    ["baulowe", "🎩", "Immobilienhai", "Baulöwe mit über 5.000 € Vermögen beendet", (p) => (p.spiele.baulowe?.bester || 0) >= 5000],
    ["quizprofi", "🧠", "Quizprofi", "5 Wissensduelle gewonnen", (p) => (p.spiele.duell?.siege || 0) >= 5],
  ];

  // Ein beendetes Spiel erfassen. sortiert: Rangliste (höchste Punkte zuerst)
  GN.profilErfassen = (z, sortiert, key) => {
    const ich = sortiert.find((s) => s.id === GN.ich);
    if (!ich || !z?.spiel) return;
    const p = laden();
    // Doppelt erfasst? (z. B. Podest nach Host-Wechsel neu gezeigt)
    const marke = `${z.code}|${key}`;
    const jetzt = Date.now();
    if (p.letzte.some((l) => l.marke === marke && jetzt - l.t < 10 * 60 * 1000)) return;
    const platz = sortiert.filter((s) => s.punkte > ich.punkte).length + 1;
    const sieg = platz === 1 && sortiert.length > 1;
    const s = (p.spiele[z.spiel] ||= { gespielt: 0, siege: 0, bester: 0 });
    s.gespielt++; if (sieg) s.siege++; s.bester = Math.max(s.bester, ich.punkte || 0); s.zuletzt = jetzt;
    p.gesamt.gespielt++; if (sieg) p.gesamt.siege++; if (platz <= 3 && sortiert.length > 1) p.gesamt.podest++;
    p.serie = sieg ? p.serie + 1 : 0; p.besteSerie = Math.max(p.besteSerie, p.serie);
    p.letzte = [{ marke, t: jetzt, spiel: z.spiel, platz, von: sortiert.length, punkte: ich.punkte || 0 }, ...p.letzte].slice(0, 15);
    // Neue Erfolge freischalten und feiern
    const neu = ERFOLGE.filter(([id, , , , ok]) => !p.erfolge[id] && ok(p));
    for (const [id] of neu) p.erfolge[id] = jetzt;
    speichern(p);
    neu.forEach(([, icon, titel], i) => setTimeout(() => { GN.toast(`${icon} Erfolg freigeschaltet: ${titel}`); Ton.auszeichnung?.(2); }, 2500 + i * 2200));
  };

  const zahl = (n) => Number(n || 0).toLocaleString("de-DE");
  function fenster() {
    const p = laden();
    let d = $("#profilFenster");
    if (!d) { d = document.createElement("dialog"); d.id = "profilFenster"; d.className = "fenster profil-fenster"; document.body.appendChild(d); d.addEventListener("click", (ev) => ev.target === d && d.close()); }
    const spiele = Object.entries(p.spiele).sort((a, b) => b[1].gespielt - a[1].gespielt);
    const quote = p.gesamt.gespielt ? Math.round((p.gesamt.siege / p.gesamt.gespielt) * 100) : 0;
    const liebling = spiele[0] ? GN.spiele[spiele[0][0]] : null;
    const name = GN.speicher("name") || "Du";
    d.innerHTML = `
      <div class="fenster-kopf"><h2>👤 ${esc(name)}</h2><button class="icon-btn klein" data-zu aria-label="Schließen">✕</button></div>
      <div class="fenster-inhalt">
        <div class="profil-zahlen">
          <div><b>${zahl(p.gesamt.gespielt)}</b><small>Spiele</small></div>
          <div><b>${zahl(p.gesamt.siege)}</b><small>Siege</small></div>
          <div><b>${quote}%</b><small>Siegquote</small></div>
          <div><b>${zahl(p.besteSerie)}</b><small>Beste Serie</small></div>
        </div>
        ${liebling ? `<p class="profil-liebling">❤️ Lieblingsspiel: <b>${liebling.icon} ${esc(liebling.titel)}</b></p>` : '<p class="leise">Noch keine Spiele beendet. Los geht’s!</p>'}
        <h3>🏅 Erfolge <small>${Object.keys(p.erfolge).length}/${ERFOLGE.length}</small></h3>
        <div class="profil-erfolge">${ERFOLGE.map(([id, icon, titel, text]) => `<div class="profil-erfolg ${p.erfolge[id] ? "frei" : ""}" title="${esc(text)}"><span>${p.erfolge[id] ? icon : "🔒"}</span><b>${esc(titel)}</b><small>${esc(text)}</small></div>`).join("")}</div>
        ${spiele.length ? `<h3>🎲 Deine Spiele</h3>
        <div class="profil-spiele">${spiele.map(([id, s]) => { const g = GN.spiele[id]; return `<div class="profil-spiel"><span>${g?.icon || "🎮"}</span><b>${esc(g?.titel || id)}</b><em>${s.gespielt}× · ${s.siege} 🏆</em><small>Bestwert ${zahl(s.bester)}</small></div>`; }).join("")}</div>` : ""}
        ${p.letzte.length ? `<h3>🕑 Zuletzt</h3><div class="profil-letzte">${p.letzte.slice(0, 6).map((l) => { const g = GN.spiele[l.spiel]; return `<div>${g?.icon || "🎮"} ${esc(g?.titel || l.spiel)} <span>${l.platz === 1 && l.von > 1 ? "🥇" : `Platz ${l.platz}/${l.von}`}</span><small>${new Date(l.t).toLocaleDateString("de-DE")}</small></div>`; }).join("")}</div>` : ""}
        <p class="leise klein-text profil-fuss">Gespeichert nur auf diesem Gerät. <button class="link-knopf" id="profilReset">Statistik zurücksetzen</button></p>
      </div>`;
    $("[data-zu]", d).onclick = () => d.close();
    $("#profilReset", d).onclick = () => { if (confirm("Deine ganze Statistik auf diesem Gerät löschen?")) { speichern(leer()); fenster(); } };
    if (!d.open) d.showModal();
  }
  const knopf = $("#profilBtn");
  if (knopf) knopf.onclick = () => { Ton.klick(); fenster(); };
  GN.profilOeffnen = fenster;
})();
