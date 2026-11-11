# UX-Audit Rookie (November 2026)

Ziel: Anfänger unter 1200 werden messbar besser. Jede Kritik misst sich daran, ob der Nutzer mehr, gezielter und lieber trainiert und sofort weiß, was als Nächstes kommt.

Geprüft im Browser bei 393×852, 393×659, iPad (820×1180) und Desktop (1280×800), hell und dunkel, mit drei Datenständen: Erststart, leer nach Onboarding, „Profi“ mit 1000 analysierten Partien, 600 Puzzle-Versuchen und 200 Tagen Aktivität.

## Kritisch

| #   | Befund                                                                                                                                                                                                                                                                                       | Warum es dem Ziel schadet                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | **Home beantwortet „Was mache ich jetzt?“ nicht.** Der Tagesplan steht ganz unten, auf dem iPhone erst nach knapp zwei Bildschirmen Scrollen. Über dem Falz stehen Begrüßung, vier Zahlenkacheln und ein riesiges Konto-Formular.                                                            | Der Tagesplan ist der Motor des Trainings. Wer ihn nicht sieht, tippt ziellos herum oder schließt die App.                                   |
| K2  | **Partienliste auf dem iPhone kaputt.** Ergebnis-Badge 92 px breit, der Gegnername bricht auf zwei Zeilen um, die Metazeile auf vier. Jede Zeile ist 165 px hoch, bei 1000 Partien sieht man nur 4 auf einmal. Dazu ein Mülleimer an jeder Zeile direkt neben dem Pfeil (Fehltipp = Dialog). | „Games“ ist laut Nutzer der wichtigste Bereich. Scannen, welche Partie man anschauen will, ist mühsam; die Löschtaste lädt zum Fehltipp ein. |
| K3  | **Konto-Formular dreifach und dominant.** Die große „Lichess oder Chess.com verknüpfen“-Karte steht auf Home, Games und Profil ganz oben, auch wenn schon 1000 Partien da sind.                                                                                                              | Verdrängt auf drei Seiten den eigentlichen Inhalt. Wer nicht online spielt, sieht dauerhaft eine Aufforderung, die für ihn nicht gilt.       |

## Hoch

| #   | Befund                                                                                                                                                    | Warum es dem Ziel schadet                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| H1  | **Coach ist beim Bot-Spiel standardmäßig aus.**                                                                                                           | Für Anfänger ist das Feedback pro Zug der eigentliche Lerneffekt einer Bot-Partie. Ohne Coach ist Spielen nur Spielen. |
| H2  | **Onboarding blitzt nach.** Beim Erststart erscheint eine Sekunde lang die volle Startseite mit Zahlen, dann blendet das Onboarding darüber.              | Erster Eindruck wirkt unruhig und kaputt.                                                                              |
| H3  | **Analyse: kein Sprung zum nächsten eigenen Fehler.** Man klickt Zug für Zug, der Starttext sagt „← → zum Blättern“, was auf dem iPhone nicht existiert.  | Der Kern einer Analyse für Anfänger ist: Wo habe ich gepatzt, was war besser? Das muss ein Tipp sein.                  |
| H4  | **Kontrast der Ergebnis-Badges** („Win“ grün auf hellgrün, ca. 3,2:1) unter WCAG AA. Dasselbe für Warn-Gelb als Text.                                     | Schlecht lesbar in Sonne, schlechter für Sehschwache.                                                                  |
| H5  | **Widersprüchliche Texte in den Einstellungen:** „Alles bleibt auf diesem Gerät – kein Konto, keine Cloud“ direkt unter dem Abschnitt „Konto & Abgleich“. | Verunsichert beim Thema Daten, genau dort, wo Vertrauen wichtig ist.                                                   |

## Mittel

| #   | Befund                                                                                                                                                          | Warum                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| M1  | Spielstärke steht auf Home doppelt (Kachel und Zeile unter dem Plan).                                                                                           | Rauschen.                                        |
| M2  | Play: „Gegen Freund“ steht als erste Karte über allem, obwohl Bot-Partie der Hauptweg ist.                                                                      | Lenkt vom Standardweg ab.                        |
| M3  | Onboarding: Auf Touch bleibt der Hover-Zustand der getippten Option auf der Option an gleicher Stelle im nächsten Schritt hängen und wirkt wie vorausgewählt.   | Irritiert, wirkt wie ein Fehler.                 |
| M4  | Einstellungen tragen die Überzeile „Profil“, sind aber eine eigene Seite.                                                                                       | Orientierung.                                    |
| M5  | Gestaffelte Einblend-Animationen (Lernkarten, Bots) mit `both`-Füllung halten Inhalte unsichtbar, bis die Animation läuft. In gedrosselten Tabs bleibt es leer. | Bei langsamen Geräten wirkt die Seite kurz leer. |
| M6  | Partienliste zeigt nicht, wo die Fehler sind (nur Genauigkeit) und hat keine Zusammenfassung „X Fehler zum Üben“ oben.                                          | Der Weg Partie → Fehler üben ist versteckt.      |

## Feinschliff

- F1 Ergebnis-Badges in Home und Games verschieden gebaut: eine gemeinsame Komponente.
- F2 „not analysed“-Text in der Liste lang; ein dezentes Symbol oder kurzer Text reicht.
- F3 Datum mit Jahr in jeder Zeile, obwohl fast alles aus dem laufenden Jahr ist.

## Vergleich mit Lichess und Chess.com

- **Chess.com** führt nach jeder Partie direkt in „Game Review“ mit „Schlüsselmomente“ und „Nochmal versuchen“. Rookie hat „Fehler nachspielen“, aber erst nach Scrollen. → Sprung zum nächsten Fehler im Dock (H3).
- **Chess.com** zeigt auf Home eine einzige große Karte „Heute: …“ mit einem Knopf. → K1.
- **Lichess** ist bei Listen extrem dicht (eine Zeile pro Partie). → K2.
- **Was Rookie besser kann:** Coach mit Erklärungen in einfacher Sprache, Fehler-Puzzles aus eigenen Partien, Tagesplan aus echten Schwächen, alles offline und kostenlos. Das muss vorne stehen, nicht hinter Formularen.

## Bewusst nicht gemacht

- Tab-Leiste auf 5 Einträge kürzen (Profil in Home verschieben): 6 Tabs passen bei 393 px noch mit 44 px Tippflächen, und Profil/Statistik ist ein eigener Bereich mit Wert. Ein Umbau würde Muskelgedächtnis der bestehenden Nutzer brechen.
