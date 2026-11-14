# Rookie – Lernwirkungs-Review (13. November 2026, v0.3.0)

Frage: **Spielt ein Einsteiger (< 1200) mit Rookie messbar, schnell und effizient besser Schach?**
Maßstab ist das Rookie-Lernmodell aus [research-2026-11-13.md](research-2026-11-13.md). Die vorige Runde ([review-2026-11-13.md](review-2026-11-13.md)) war UX/Klarheit; hier geht es nur um Lernwirkung.

**Grundlage:** Code-Lektüre aller Lernbausteine (`lib/training/*`, `lib/analysis/*`, `lib/coach/*`, `lib/bots`, Puzzle-, Spiel-, Analyse- und Lernseiten); Build mit Testdaten (Fixture, 32 Partien) und Durchlauf der Seiten; zwei Personas über eine simulierte Woche mit der echten Tagesplan-Logik ([`lib/training/sim/personas.ts`](../src/lib/training/sim/personas.ts), Protokoll im Anhang); Prüfung der Berechnungen (FSRS-Intervalle nachgerechnet, Glicko-Erwartungswerte, Puzzle-Auswahl, Erklärungen mit konstruierten Stellungen); 2 200 echte Lichess-Partien mit Stockfish ausgewertet (Forschungsfrage 4).

Schweregrad: **kritisch** (verschenkt den größten Lernhebel) · **hoch** (bremst täglich) · **mittel** · **niedrig**. Aufwand: S (< ½ Tag) · M (1–2 Tage) · L (mehr). Zeilenangaben beziehen sich auf v0.3.0 (Commit `2ed553c`).

---

## Zusammenfassung in fünf Sätzen

Rookie hat die richtigen Bausteine – Coach im Moment des Fehlers, eigene Fehler als Puzzles, Wiederholung nach FSRS, Analyse mit Erklärungen –, aber sie greifen nicht ineinander: **Eigene Fehler kommen nie in den Tagesplan**, **Bot-Partien werden nur analysiert, wenn man die Analyse öffnet**, und ein verfehltes Puzzle ist **nach einer Minute** wieder fällig. Der wichtigste Einzelhebel für Einsteiger – **vor dem eigenen Zug prüfen, ob er sicher ist** – wird nirgends geübt; der Coach nimmt ihn dem Spieler sogar ab, indem er jede Drohung ankündigt. Puzzles zielen auf **50 % Erfolg** (genau die eigene Wertung) statt ~80 %, Hinweise kosten nichts, und Sterne gibt es fürs Durchklicken. Was Fortschritt zeigt (Sterne, Serie, Puzzle-Wertung, „Spielstärke“), misst Fleiß oder ist mit Hilfe aufgebläht; **ob jemand weniger patzt, sieht man nirgends**. Gut und bleibend: Coach mit Zurücknehmen, „Fehler nachspielen“, die Erklärungen in einfacher Sprache, ehrliche Mindestmengen im Spielerprofil.

---

## Teil 1 – Nach dem Rookie-Lernmodell

### Grundsatz 1 · Sicherheit zuerst — **nicht erfüllt**

1. **Kein Training für den Blunder-Check.** In den Lichess-Daten (Forschungsfrage 4) sind bei 400–800 rund 55 % der Patzer Figuren- oder Mattverluste innerhalb von zwei Zügen (Figur hängt 28 %, Gewinn verpasst 12 %, Gabel/Zweizüger 9 %, Matt 6 %), bei 1600–1800 noch rund 37 %; dazu 17–22 % Bauernverluste. Rookie trainiert nur die _Angreifer_-Seite (Puzzles: „finde den Gewinnzug“). Die _Verteidiger_-Seite – „Ist mein geplanter Zug sicher?“ – fehlt ganz; Puzzles mit Thema „Verteidigungszug“ gibt es unter 1000 nur 89 von 30 000. Lernverlust: jeder Einsteiger, jede Partie. **kritisch · L**
2. **Der Coach macht den Blunder-Check für den Spieler.** Nach jedem Gegnerzug meldet er automatisch angegriffene Figuren (`routes/play/+page.svelte:526–535`) und Engine-Drohungen (`findThreat`, `:543–552`); nach einem Patzer erscheinen sofort Pfeile und die Widerlegung (`:445–458`). Das fühlt sich hilfreich an, ist aber laut Guidance-Hypothese (Salmoni et al. 1984; Winstein & Schmidt 1990) genau die Hilfe, auf die man sich verlässt – ohne Coach (Online-Partie) fehlt sie dann. Es gibt keine Stufe, die die Hilfe zurücknimmt. **kritisch · M**
3. **Theorie ohne Rücksicht auf die Stufe.** Persona B (1000) bekommt an 7 von 7 Tagen 8 Minuten Endspiel gegen die Tablebase, der Plan wählt Lektionen ohne Blick auf die Spielstärke (`lib/training/plan.ts:76–80`) – unter 900 kämen nach den ersten Lektionen Lucena/Philidor/zwei Läufer. **Korrektur meiner Erwartung durch die Daten:** Endspiele sind _kein_ Randthema – 62–71 % der Partien erreichen ein Endspiel (≤ 6 Figuren), und dort passieren 20–33 % der Patzer (bei 1600–1800: 42 %). Grundendspiele bleiben deshalb im Plan, aber passend zur Stufe und nach Sicherheit und eigenen Fehlern. **hoch · S**

### Grundsatz 2 · Selbst finden, dann gezeigt bekommen — **teilweise erfüllt**

1. **Hinweise sind gratis.** Ein Puzzle mit Hinweis zählt als vollständig gelöst – volle Wertungspunkte, keine Wiederholung (`routes/puzzles/+page.svelte:244`, `:266`). Wer bei jeder Unsicherheit „Hinweis“ drückt, steigt in der Wertung und übt dabei Wiedererkennen statt Finden. **hoch · S**
2. **Lektionen sind überwiegend Lesen.** Grundlagen: 22 Erklär- gegen 11 Such-Schritte; Taktik: 8 gegen 6 (`lib/basics/lessons.ts`). Die Taktik-Lektionen verweisen danach auf Puzzles – gut –, die Lektion selbst ist aber kaum Abruf. Für Regel-Lektionen in Ordnung, für Taktik dünn. **mittel · M** (nicht in diesem Plan, siehe „Bewusst nicht“)
3. **Gut:** Puzzles, „Fehler nachspielen“, Eröffnungs-Training und Endspiele verlangen einen Zug, bevor etwas gezeigt wird; der Coach-Hinweis kommt in drei Stufen (Idee → Figur → Pfeil).

### Grundsatz 3 · Eigene Fehler werden Training – mit Abständen — **teilweise erfüllt, Kette gerissen**

1. **Fällige eigene Fehler erscheinen nie im Tagesplan.** Der Plan zählt nur Karten der Art `puzzle` (`lib/training/planData.ts:36`), eigene Fehler sind `mistake`. Sie stapeln sich unter „Meine Fehler“, ohne dass Rookie je dazu auffordert. Persona B: 37 eigene Fehler in der Woche, **25 nie geübt**. **kritisch · S**
2. **Bot-Partien werden nur analysiert, wenn man die Analyse öffnet** (`lib/import/sync.svelte.ts:187–195` analysiert nur importierte Online-Partien und nur mit verknüpftem Konto). Wer nach der Partie nicht in die Analyse geht, bekommt keine Fehler-Puzzles und keine Messwerte. **hoch · S**
3. **„Fehler nachspielen“ und Wiederholungskarten wissen nichts voneinander.** Wer einen Fehler in der Analyse richtig nachspielt, bekommt dieselbe Stellung morgen trotzdem als fällige Karte (die Karte wurde bei der Analyse „sofort fällig“ angelegt, `lib/analysis/run.ts:156–163`). **mittel · S**
4. **Stellungsfehler werden zu Puzzles.** Auch „Fehler“ ohne greifbares Motiv („positional“) werden Karten (`run.ts:126`); „finde den besten Zug in einer ruhigen Stellung“ ist für Einsteiger kaum lernbar und füllt die Warteschlange. **mittel · S**

### Grundsatz 4 · Richtig schwer, gemischt — **nicht erfüllt**

1. **Puzzles zielen auf 50 % Erfolg.** „Für dich“ wählt Puzzles um die eigene Wertung ±150 (`lib/training/puzzles.ts:79`). Nach der Glicko-/Elo-Formel heißt gleiche Wertung 50 % Lösungswahrscheinlichkeit. Persona A (600) löst am ersten Tag 1 von 5 (Startwert 800 > Stärke), in der Woche 66 %. Bei 50 % sieht man jede zweite Lösung, statt sie zu finden. **hoch · S**
2. **Verfehlte Puzzles sind nach einer Minute wieder fällig.** FSRS mit Kurzzeit-Lernschritten (`lib/training/srs.ts:5`): „Nochmal“ → 1 min → 10 min → 1 Tag. Nachgerechnet mit `ts-fsrs`. Nach einer Minute „löst“ man aus dem Arbeitsgedächtnis – Roediger & Karpicke (2006): nach 5 Minuten schlägt Wiederlesen sogar das Abfragen, der Abruf-Vorteil entsteht erst über Tage. **hoch · S**
3. **Der Schwerpunkt ist ein Block.** „5 Puzzles · Schwerpunkt: Hängende Figur“ – die Überschrift verrät das Motiv; im Spiel steht es nie dran (gemischtes Üben, Rohrer et al. 2015). **mittel · S**
4. **Gut:** Puzzle-Pakete gleichmäßig von 400 bis 1300 (je 3 000), Themen mit Einsteiger-Bezug, Lichess-Daten (CC0).

### Grundsatz 5 · Hilfe ausschleichen — **nicht erfüllt**

Siehe 1.2: Der Coach ist immer gleich gesprächig, von der ersten bis zur hundertsten Partie. Es gibt nur „an“ oder „aus“. **kritisch · M**

### Grundsatz 6 · Spielen mit Zeit, dann kurz besprechen — **teilweise erfüllt**

1. **Gut:** Standard ohne Uhr, Coach im Moment des Fehlers, nach der Partie „Fehler nachspielen“ im Tagesplan.
2. **Spielanteil kippt je nach Schwerpunkt.** Persona A (Schwerpunkt „Partien“) spielt an 7 von 7 Tagen, 52 % der Zeit; Persona B (spielt online) 10 %. Ziel laut Recherche ~30 %. **mittel · S**
3. **Keine Selbstbesprechung vor der Engine.** Die Analyse zeigt sofort alle Zugarten. Ein „Wo war deine Partie kritisch?“ vor der Auflösung fehlt. **mittel · M** (siehe „Bewusst nicht“)

### Grundsatz 7 · Fortschritt ehrlich messen — **nicht erfüllt**

1. **Nichts zeigt, ob man weniger patzt.** Patzer pro Partie stehen im Coach-Tab, aber ohne Verlauf, ohne Vergleich und ohne Hinweis auf Zufall. Kein fester Test. **kritisch · M**
2. **„Spielstärke“ ist mit Hilfe aufgebläht.** Ein Sieg gegen einen Bot zählt auch mit Zurücknehmen und Hinweisen; die Schätzung setzt dann die Bot-Elo als Untergrenze (`lib/training/strength.ts:39`, gesetzt in `routes/play/+page.svelte:632`). Die Bot-Elo-Werte selbst sind nicht kalibriert (`lib/bots/bots.ts` – Schätzwerte aus Engine-Einstellungen). **hoch · S** (Kalibrierung: L, siehe „Offen“)
3. **Fleiß sieht aus wie Fortschritt.** Sterne für bloßes Abschließen einer Lektion (3 von 3, `lib/training/stars.ts:38`), Serie, Puzzle-Wertung – alles prominent auf Start. Deci et al. (1999): an die Aufgabe gekoppelte Belohnungen untergraben innere Motivation; Kluger & DeNisi (1996): Rückmeldung auf Zahl/Rang hilft am wenigsten. **mittel · S**

---

## Teil 2 – Jede Funktion gegen das Lernmodell

„Wirkt?“ = laut Forschung (Quelle: Kürzel aus research-2026-11-13.md). Zeit pro Lerngewinn: grobe Einschätzung (↑ gut, → mittel, ↓ schlecht).

| Funktion                        | Ziel                            | Wirkt laut Forschung?                                    | Umsetzung korrekt?                                                  | Zeit/Lerngewinn                             | Lücken                                                                      | Code                                                     |
| ------------------------------- | ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Bots mit Coach                  | Spielen, Fehler im Moment sehen | teilweise (Rückmeldung ja, aber Guidance: zu viel Hilfe) | Erklärungen meist richtig; „ungeschützt“ auch bei gedeckten Figuren | →                                           | keine Hilfe-Stufen; warnt immer                                             | `routes/play/+page.svelte:420–560`, `lib/coach/coach.ts` |
| Drohungs-Warnung                | Gefahr erkennen                 | nein in dieser Form (nimmt Check ab)                     | technisch korrekt (Nullzug, Material ≥ 150 cp)                      | ↓ langfristig                               | kein Ausschleichen                                                          | `coach.ts:143–176`                                       |
| Zurücknehmen nach Patzer        | Fehler korrigieren              | ja (Fehlversuch + Korrektur, Kornell 2009)               | ja                                                                  | ↑                                           | zählte für „Bot besiegt“                                                    | `play/+page.svelte:470–480`                              |
| Partie-Analyse mit Zugarten     | eigene Fehler verstehen         | teilweise (Lesen; Abruf erst mit „Nachspielen“)          | Schwellen wie Lichess (`classify.ts:57–60`) – stimmt                | →                                           | Bot-Partien nur auf Knopfdruck analysiert                                   | `routes/analysis/+page.svelte`, `lib/analysis/*`         |
| Fehler nachspielen              | Abruf eigener Fehler            | ja (Abruf, eigene Inhalte)                               | ja, alternative gute Züge per Engine                                | ↑                                           | Ergebnis nicht in der Wiederholung                                          | `analysis/+page.svelte:451–540`                          |
| Eigene Fehler als Puzzles       | verteilte Wiederholung          | ja (Cepeda 2006)                                         | Karte sofort fällig; nur erster Zug                                 | ↑                                           | **nie im Tagesplan**; Stellungsfehler mit drin                              | `lib/analysis/run.ts:119–167`                            |
| Puzzles „Für dich“ + Glicko-2   | Muster                          | ja (Muster)                                              | Glicko korrekt (Test gegen Glickman)                                | →                                           | **Ziel 50 %**; Hinweis gratis                                               | `lib/training/puzzles.ts:72–101`, `glicko2.ts`           |
| FSRS-Wiederholung               | verteilte Wiederholung          | ja                                                       | Kurzzeit-Schritte 1 min/10 min                                      | ↓ bei Puzzles                               | Wiederholung im Arbeitsgedächtnis                                           | `lib/training/srs.ts:5`                                  |
| Themenfilter                    | gezielt üben                    | teilweise (Blocken < Mischen)                            | ja                                                                  | →                                           | Plan-Schwerpunkt als Block                                                  | `routes/puzzles/+page.svelte`                            |
| Puzzle-Sturm                    | Tempo, Spaß                     | schwach (Tempo ≠ Sicherheit)                             | ja                                                                  | ↓ für < 1200                                | fördert schnelles Raten                                                     | `routes/puzzles/storm`                                   |
| 15 Grundlagen-Lektionen         | Regeln                          | ja für Regeln                                            | ja                                                                  | ↑ (einmalig)                                | überwiegend Lesen                                                           | `lib/basics/lessons.ts`                                  |
| 5 Taktik-Lektionen              | Motive kennen                   | teilweise                                                | ja                                                                  | →                                           | 1–2 Aufgaben je Lektion                                                     | `lessons.ts:551–792`                                     |
| 14 Eröffnungskurse + Repertoire | Eröffnung                       | schwach unter 1200                                       | Varianten korrekt                                                   | ↓ unter 1000                                | Plan zeigt alle Stufen                                                      | `lib/openings/*`                                         |
| 10 Endspiel-Lektionen           | Grundendspiele                  | ja für die 4–5 Grundendspiele                            | Tablebase korrekt                                                   | ↑ für K+D/K+T, ↓ für Lucena/Philidor < 1200 | Plan beachtet Spielstärke nicht                                             | `lib/endgames/*`, `plan.ts:76–80`                        |
| Tagesplan                       | ein nächster Schritt            | ja (Struktur, Regelmäßigkeit – Lally 2010)               | ja                                                                  | →                                           | ohne Blunder-Check, ohne eigene Fehler, ohne Zeitbudget, 4-Aufgaben-Schnitt | `lib/training/plan.ts:83–107`                            |
| Ein Schwerpunkt                 | Fokus                           | plausibel                                                | Motiv → Thema korrekt                                               | ↑                                           | nur Puzzle-Thema, kein Sicherheitstraining                                  | `lib/training/focus.ts`                                  |
| Spielerprofil (Fünfeck)         | Stärken/Schwächen               | beschreibend                                             | Mindestmengen vorhanden (gut)                                       | –                                           | kein Verlauf                                                                | `lib/training/skills.ts`                                 |
| Spielstärke-Schätzung           | Orientierung                    | –                                                        | Gewichte plausibel; Bots mit Hilfe zählen                           | –                                           | Bots unkalibriert                                                           | `lib/training/strength.ts`                               |
| Sterne, Serie, Tagesziel        | Dranbleiben                     | Serie: mittel; Sterne: schwach/negativ                   | ja                                                                  | –                                           | belohnt Erledigen                                                           | `lib/training/stars.ts`, `streak.ts`                     |

**Stichproben mit Stockfish/Konstruktion:**

- Zugarten-Schwellen (30/20/10 Prozentpunkte der Gewinnchance) = Lichess (geprüft gegen [tolius' Lichess-Blog](https://lichess.org/@/tolius/blog/blunder-mistake-or-inaccuracy-how-does-lichess-decide/lGMJZrYw)). ✔
- Genauigkeit = vereinfachte Lichess-Formel. ✔ (schon in der letzten Runde geprüft)
- Erklärung „Figur eingestellt“: Weiße Dame zieht nach f5, gedeckt vom Bauern g4, ein Bauer e6 schlägt. Rookie sagte „Deine Dame auf f5 ist **ungeschützt** – exf5 schlägt sie.“ – fachlich falsch (sie ist gedeckt, verloren geht sie trotzdem). ✘ **mittel · S**
- Drohungserkennung (`threats`): gedeckt + von billigerer Figur angegriffen → Warnung; gedeckt und gleichwertig angegriffen → keine. ✔
- FSRS: neue Karte „Nochmal“ → 1 min, „Gut“ → 10 min, „Gut“ → 1 Tag (ts-fsrs, Standard). ✘ für Puzzles (siehe 4.2).
- Glicko: gleiche Wertung → Erwartung 0,5. Puzzle-Ziel ±150 → Erfolgsquote 30–70 %, Mittel 50 %. ✘ (siehe 4.1).

---

## Teil 3 – Was fehlt ganz, obwohl die Forschung es nahelegt

1. **Blunder-Check-Training** („Ist der Zug sicher?“) – der größte Hebel unter 1200. → Etappe 2.
2. **Wiederholungsschleife für eigene Fehler im Tagesplan.** → Etappe 1.
3. **Hilfe-Stufen beim Coach** (warnen → fragen). → Etappe 3.
4. **Fester Test zur Fortschrittsmessung** und **Patzer-Verlauf mit Zufallsbereich**. → Etappe 4.
5. **Selbstanalyse vor der Engine** („Welche Züge waren kritisch?“). → bewusst später (siehe Plan).
6. **Zeitbudget im Tagesplan** – der Plan weiß nicht, wie lange er dauert. → Etappe 1.
7. **Visualisierung/Rechnen ohne Brettbewegung** – Beleglage schwach, bewusst nicht.

---

## Teil 4 – Unbequem

- **Fühlt sich nach Lernen an, bringt wenig:** Sterne für eine durchgeklickte Lektion; Puzzle-Wertung, die mit Hinweisen steigt; „≈ 875 Spielstärke“, die mit Zurücknehmen gegen einen 1000er-Bot auf 1000 springt; Varianten lesen im Eröffnungskurs (für < 1000 kaum Punkte); der Coach, der jede Drohung meldet – die Partie mit Coach wird sicherer, der Spieler nicht.
- **Kostet Zeit ohne Elo-Wirkung (unter 1200):** Lucena/Philidor/zwei Läufer, Sizilianisch-Drache, Repertoire-Ausbau, Puzzle-Sturm als Hauptübung.
- **Hilft, wird aber versteckt:** „Meine Fehler“ (nur ein Chip auf der Puzzle-Seite, nie im Plan); „Fehler nachspielen“ (nur über die Analyse); Patzer je Partie (eine Kachel unter vielen, ohne Verlauf).

## Was gut ist und bleiben soll

- **Coach mit Zurücknehmen** – Lernen im Moment des Fehlers, mit Fehlversuch und Korrektur (Kornell et al. 2009). Bleibt; wird nur leiser, je sicherer man wird.
- **„Fehler nachspielen“** – Abruf an eigenen Inhalten. Bleibt, wird an die Wiederholung angebunden.
- **Erklärungen in einfacher Sprache** mit konkreten Feldern („Dein Springer auf g5 …“) – aufgabenbezogene Rückmeldung (Kluger & DeNisi). Bleibt, wird an einer Stelle korrigiert.
- **Ein Schwerpunkt, ein Tagesplan** – Struktur und Regelmäßigkeit. Bleibt, wird neu gewichtet.
- **Mindestmengen im Spielerprofil** (Phasen erst ab 12 Zügen aus 2 Partien, Sicherheit ab 3 Partien) – genau der richtige Geist; wird auf die Fortschrittsmessung übertragen.
- **Lichess-Puzzles, Tablebase, Stockfish lokal** – solide, kostenlos, offline.

---

## Die 10 Änderungen mit dem größten erwarteten Elo-Gewinn pro Übungsstunde

| #   | Änderung                                                                                                                                                    | Begründung                                                              | Beleglage                                    | Aufwand |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | ------- |
| 1   | **Blunder-Check-Training** täglich im Plan (echte Patzer aus Lichess-Partien, „sicher?“ + Widerlegung zeigen)                                               | trainiert die Fähigkeit, an der die meisten Einsteiger-Partien hängen   | Daten stark, Trainingsform Trainer-Erfahrung | L       |
| 2   | **Eigene Fehler in den Tagesplan** (fällige Karten, 1 → 3 → 8 → 22 Tage)                                                                                    | verteilte Wiederholung genau der Muster, die _dieser_ Spieler übersieht | stark (Spacing), Übertrag plausibel          | S       |
| 3   | **Coach schleicht Hilfe aus** (nach 3 Partien: fragt statt warnt; „Halt – nicht sicher“ ohne Lösung)                                                        | sonst lernt man, Warnungen zu lesen, nicht Drohungen zu sehen           | mittel (Guidance)                            | M       |
| 4   | **Puzzles auf ~80 % Erfolg** (≈ 240 unter der Wertung, nachgeregelt)                                                                                        | mehr selbst gefundene Lösungen pro Minute, weniger Lösungs-Ansehen      | mittel (Theorie + Lernforschung)             | S       |
| 5   | **Wiederholung in Tagen, nicht Minuten** (Puzzles, eigene Fehler, Blunder-Check)                                                                            | Abruf nach Tagen statt Arbeitsgedächtnis                                | stark                                        | S       |
| 6   | **Bot-Partien automatisch analysieren**                                                                                                                     | Kette Partie → Fehler → Wiederholung schließt sich ohne Zusatzschritt   | – (Voraussetzung für 2 und 8)                | S       |
| 7   | **Tagesplan mit Zeitbudget und Gewichtung** (Sicherheit → eigene Fehler → gemischte Taktik → Partie alle 2 Tage → Theorie nur bei Platz, passend zur Stufe) | richtige Aufteilung der 20–30 Minuten                                   | mittel                                       | M       |
| 8   | **Fortschrittsmessung** (Patzer je 30 Züge mit Zufallsbereich, Kontrolltest alle 14 Tage)                                                                   | zeigt, ob es wirkt; lenkt Motivation von Fleiß auf Können               | stark (Messlogik)                            | M       |
| 9   | **Hinweis kostet** (½ Punkt, Wiederholung) und **Hilfe-Siege zählen nicht** für die Spielstärke                                                             | ehrliche Zahlen, Anreiz zum Selberfinden                                | mittel                                       | S       |
| 10  | **Erklärungen fachlich genau** („gedeckt, aber von billigerer Figur geschlagen“) und **gemischter Schwerpunkt** (2 von 3 Puzzles zum Thema)                 | richtige Begriffe; Motiv nicht durch Überschrift verraten               | mittel                                       | S       |

---

## Anhang: Persona-Wochen vorher (v0.3.0, Simulation)

Annahmen: siehe [`personas.ts`](../src/lib/training/sim/personas.ts). Persona A: 600, kennt die Regeln teilweise, Schwerpunkt „Partien“, 25 min/Tag, 4 Patzer pro Partie. Persona B: 1000 auf Lichess, Schwerpunkt „Taktik“, 30 min/Tag, 3 Online-Partien pro Tag, 2,2 Patzer pro Partie. Das Modell misst **Zeitaufteilung und was geübt wird**, nicht den Lernerfolg.

**A (600):** Tag 1: Partie 15 min → 5 Puzzles (1/5 gelöst, Startwertung 800 > Stärke) → Lektion „Brett“. Tag 2–7: Wiederholung → Partie → 5 Puzzles „Hängende Figur“ → letzte Partie nachspielen; Lektionen fallen aus (4-Aufgaben-Schnitt). **Woche:** 201 min · Abrufen 45 % · Lesen 3 % · Spielen 52 % · 50 Puzzles (66 % gelöst) · 27 eigene Fehler, 3 nie geübt · Blunder-Checks 0.

**B (1000):** täglich 5 Puzzles „Hängende Figur“ → letzte Partie nachspielen → **8 min Endspiel** (7 verschiedene Endspiele in 7 Tagen); Wiederholungen 1–5. **Woche:** 144 min · Abrufen 90 % · Spielen 10 % · 51 Puzzles (65 % gelöst) · **37 eigene Fehler, 25 nie geübt** · Blunder-Checks 0. Fällige eigene Fehler am Tag 7: 33 – im Plan nie sichtbar.

Gleiche Fehlerarten kommen wieder: Bei A sind ~55 % der Patzer „Figur hängt“; der Schwerpunkt ist ab Tag 2 korrekt „Hängende Figur“, geübt wird aber nur die Angreiferseite (Puzzle), nie die eigene Sicherheit. Vom Fortschritt sieht man: Puzzle-Wertung, Serie, Sterne – nicht, ob die Patzer weniger werden.

## Anhang: Persona-Wochen nachher (v0.4.0, gleiche Simulation)

**A (600):** Tag 1: Blunder-Check (6) → 4 Puzzles → Partie. Ab Tag 2 im Wechsel: _Übungstag_ Kontrolltest (einmal) → Blunder-Check → eigene Fehler → gemischte Puzzles → Partie nachspielen; _Spieltag_ Blunder-Check → Puzzles → Partie. **Woche:** 173 min (Budget 25 min/Tag eingehalten) · Abrufen 65 % · Lesen 0 % · Spielen 35 % · 35 Puzzles (**77 %** gelöst, vorher 66 %) · 4 Partien (vorher 7) · eigene Fehler 15, **21× geübt, 1 nie** · **42 Blunder-Checks** (vorher 0).

**B (1000, online):** täglich Blunder-Check → **eigene Fehler (5)** → Wiederholung → gemischte Puzzles → letzte Partie nachspielen; Endspiel nur an Tagen mit Platz (2×). **Woche:** 168 min · Abrufen 91 % · Spielen 9 % (spielt online) · 39 Puzzles (90 %) · eigene Fehler 37, **39× geübt, 11 nie** (vorher 12× / 25 nie) · 42 Blunder-Checks.

Was man vom Fortschritt sieht: Coach-Tab „Wirkt dein Training?“ mit Patzern je 30 Zügen (nach 10 bzw. 20 analysierten Partien), Kontrolltest (ab Tag 2, dann alle 14 Tage) und Trefferquoten.
