# Rookie – Coach-Plan (20. November 2026)

> **Stand der Umsetzung (v0.8.0):** Etappen 1–3 umgesetzt. Abweichung vom ersten Entwurf, aus der Messung: Spielanteil 45 % statt 30–35 % und mindestens 3 (ab 30 min 4) Partien pro Woche, weil Einsteiger mit weniger als 4 Partien kaum stiegen; Bedenkzeit 10+5 für alle statt 15+10 unter 1200 – für 15+10 gibt es keinen Beleg, es bleibt das Mittel bei Stillstand mit vielen Patzern.

Grundlage: [coach-review-2026-11-20.md](coach-review-2026-11-20.md) und der [Nachtrag vom 20.11.](research-2026-11-13.md#nachtrag-wie-viel-spielen-wie-viele-puzzles-aufstieg-neuer-lichess-spieler-20-november-2026). Ziel: **Rookie sagt jede Woche, wie viel du spielst und übst, merkt, ob es wirkt, und ändert die Dosis, wenn nicht.**

Je Etappe: `npm run check`, ESLint/Prettier, Vitest, Playwright grün; Screenshots 393×659, 393×852, 820×1180, 1280×800 hell/dunkel ohne Überlauf; Persona-Woche; deutscher Commit, Push auf `main`, Live-Check.

## Die Verordnung (je Zeitbudget; Stufe verschiebt nur Sicherheit ↔ Taktik und Theorie)

| Zeit/Tag | Partien/Woche | Bedenkzeit | Puzzles/Tag | Blunder-Checks/Tag | Brett-Scan/Tag (< 1200) | Lektionen/Woche |
| -------- | ------------- | ---------- | ----------- | ------------------ | ----------------------- | --------------- |
| 15 min   | 3             | 10+5       | 4           | 3                  | 3                       | 1–2             |
| 30 min   | 4             | 10+5       | 4           | 4–6                | 3                       | 3–4             |
| 45 min   | 6             | 10+5       | 4–7         | 7–8                | 3                       | 4–5             |
| 60 min   | 8             | 10+5       | 6–12        | 6–8                | 3                       | 5               |

Nach jeder Partie 5 Minuten besprechen (eigene Patzer zuerst). Sechs Trainingstage, ein freier Tag.

**Urteil des Coachs** (frühestens nach zwei Wochen mit Rookie, über 14 Tage bzw. 6 Wochen):

1. weniger Partien als eine Wochendosis in 14 Tagen → _mehr spielen_
2. weniger als die Hälfte besprochen → _erst besprechen_
3. Wertung in 6 Wochen < +30 bei ≥ 8 gewerteten Partien, Patzer über dem Wert der nächsten Etappe → _15+10 und Blunder-Check vor jedem Zug_
4. dasselbe, Patzer schon im Rahmen → _Taktik nach vorn_
5. sonst: _es geht voran (+x)_

**Aufstiegskriterium je Etappe (800 → 1000 → 1200 → 1400 → 1600):** Lichess-Rapid erreicht die Etappe; der Hebel dorthin ist die Patzerrate, die Spieler dort im Schnitt haben (`valueAt('safety', Etappe)`), z. B. 1200: 3,3 · 1600: 2,8 Patzer je 30 Züge.

## Etappe 1 – Die Verordnung (M) · umgesetzt

- `lib/training/prescription.ts`: `recipeFor`, `weekProgress`, `pathTo1600`, `adjust` (rein, getestet).
- `planData.ts` `loadCoachWeek`, `dailyGoal`, `isPracticeGame` (Lichess-Rapid oder Partie in Rookie).
- Coach: Karte „Deine Woche“ (Fortschritt, Urteil mit Knopf, Weg zu 1600, „Warum diese Dosis?“ mit Zeitwahl).
- Start: „Diese Woche“ statt Tagesziel; Tagesplan nach Wochenziel (gleichmäßig verteilt, gegen Wochenende aufholen), Dosis für Blunder-Check/Brett-Scan, Puzzles auch an Spieltagen.
- Einstellungen: Tagesziel „Coach“ (Standard), Zeit 10–60 min.

**Messkriterium:** Test: Budget eingehalten (≤ 10 % darüber), ab 30 min ≥ 4 Partien und ≥ 1000 Puzzles im Jahr; Persona A erreicht die Wochendosis.

## Etappe 2 – Eine Wahrheit je Zahl und Schritt (S) · umgesetzt

- Patzerrate überall gepoolt (Fortschrittskarte = Penta = Trainingsindex).
- „Weiter lernen“ = nächste Lektion des Tagesplans; Taktik-Lektionen unter 1400 vor Stellungsspiel/Endspiel/Kurs.
- Rapid-Hinweis 10+5 bzw. 15+10 statt 10+0.
- Coach kürzer: Penta-Detail nach Antippen, Lernkennzahlen unter „Statistik“.

**Messkriterium:** Test: gleiche Daten → gleiche Patzerrate in Fortschritt und Index; `nextLesson` liefert für Fortgeschrittene keine Regellektion.

## Etappe 3 – Vielspieler und Lektionen (S–M) · umgesetzt

- Neue Fehlerkarten je Partie auf die zwei teuersten begrenzt (`MISTAKES_PER_GAME`); Persona B: 4 statt 26 Fehler pro Woche ungeübt.
- Datum je erledigter Lektion (Einstellung `lessonLog`, beim Abgleich vereinigt; Endspiele und Eröffnungslinien haben schon ein Datum) – die Woche zählt Lektionen.

**Messkriterium:** Persona B: ≤ 5 ungeübte eigene Fehler pro Woche; Wochenkarte zählt Lektionen.

## Etappe 4 – Abschluss (S)

Version 0.8.0, README, Tag, GitHub-Release, Website gemäß `portfolio/PUBLISHING.md`.

## Bewusst nicht

- **Persönliche Prognose „1600 in X Monaten“:** Die Streuung ist riesig (Q1–Q3 bei 4–8 Partien/Woche: +21 bis +273) und Rookie-Nutzer sind keine Lichess-Stichprobe. Rookie zeigt die nächste Etappe und die ehrliche Gruppenzahl.
- **15+10 als Standard:** kein Beleg, dass langsamer schneller lernen lässt; kostet Partien. Nur als Mittel bei Stillstand mit vielen Patzern.
- **Mehr als 8 Partien pro Woche verordnen:** Der Zuwachs flacht ab (+165 bei 8–15, +231 darüber, aber bei 4× so vielen Partien); die Zeit geht dann besser in Puzzles und Besprechen.
- **Erinnerungen/Push:** erst bei beobachteter Wiederkehr-Hürde (Backlog).
- **Puzzle-Wertung und Sterne verstecken:** motivieren, schaden der Dosis nicht.
