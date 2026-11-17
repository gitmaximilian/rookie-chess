# Rookie-Backlog · Stand 0.7.8

Priorisiert nach dem Ziel, Einsteigern mit begrenzter Übungszeit in echten Partien zu helfen. Die Aufwände sind grobe Personentage für eine erste nutzbare Fassung mit Tests. Lernwirkung ist jeweils eine zu prüfende Hypothese.

## Direkt vorbereiten

| Vorhaben                  | Was noch fehlt                                                                                                                                | Aufwand | Erfolgskriterium                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| Hürden beim Import finden | Einstieg, erste echte Partie, Import, genau einen Fehler selbst analysieren. Mit der veröffentlichten Version beobachten und Schritte messen. | 1–2 PT  | Klarer Befund, an welcher Stelle Einsteiger abbrechen und was sie beim nächsten Schritt erwarten. |

## Nächste Produktetappe

| Vorhaben                            | Was noch fehlt                                                                                                                           | Aufwand                       | Entscheidung                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Erklärungen als kurze Abrufaufgaben | Eine häufig übersprungene Grundlagen- oder Stellungslektion mit einer unbekannten Beispielstellung und eigener Entscheidung abschließen. | 2–4 PT je kleinem Themenpaket | Mehr richtige Erstversuche in neuen Aufgaben zum jeweiligen Konzept. |

## Erst bei Bedarf

| Vorhaben                                         | Auslöser                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schwierigkeitssteuerung verbessern               | Bei deutlich zu leichten oder zu schweren Aufgaben pro Anfängergruppe das Zielband und Erstversuche ohne Hilfe überprüfen; eigene Fehler und gemischte Aufgaben getrennt beobachten.                                                                                                                                                  |
| Patzer, Penta und Bot-Stärke weiter validieren   | Aktuelle Penta-Kalibrierung ist im Repo untersucht. Weitere Schätzungen und Bot-Niveaus erst bei ausreichend vielen unabhängigen menschlichen Partien enger kalibrieren. Geräteabhängige Analysetiefe separat gegenprüfen.                                                                                                            |
| PWA und Barrierefreiheit                         | Echte iPhones für das Bot-Brett und Umwandlung testen, dazu Tastatur- und Screenreader-Zugeingabe, VoiceOver, dynamische Textgröße und kurze Querformatfenster. Über Gerätewechsel, Wiederherstellung und große Datensicherungen gibt es weitere plattformübergreifende Testfälle.                                                    |
| Freiwillige Erinnerungen                         | Nur bei beobachteter Wiederkehr-Hürde. Zuerst prüfen, ob ein einfacher Kalendertermin für Rapid ausreicht. Push und Einwilligungsdialog wären eine größere eigene Änderung.                                                                                                                                                           |
| Native Distribution und Geschäftsmodell          | Zahlungsbereitschaft in einer kleinen transparenten Preisprobe testen. Vor Store-Arbeit ein technisches Geräteticket für Offline, WASM, Passkeys, Sync und Datenübernahme erstellen. Lizenz- und Store-Vertriebsfragen, Kontolöschung, Kaufwiederherstellung, Datenschutzangaben und Kosten sind eine getrennte Release-Entscheidung. |
| Weitere Kurse, mehr Bots, Ranglisten und Streaks | Niedrige Priorität, solange der Weg zur ersten eigenen Partie und zurück in die Fehlerübung die erkennbare Hürde ist.                                                                                                                                                                                                                 |

Rookies [Produktplan](product-plan-2026-11-14.md) führt das überarbeitete Penta und die vereinheitlichte Patzerzahl als umgesetzt. [Rookie 0.7.5](https://github.com/gitmaximilian/rookie-chess/pull/6) enthält direktes Feedback beim Blunder Check, Scan-Korrekturen und tägliche Trainingsanzeigen. [Rookie 0.7.6](https://github.com/gitmaximilian/rookie-chess/pull/9) enthält den Rapid-Einstieg und die kurze Übung aus einer eigenen Partie. [Rookie 0.7.7](https://github.com/gitmaximilian/rookie-chess/pull/10) enthält das größere mobile Bot-Brett.

## Umgesetzt in 0.7.8

- **Zug und Antwort** verbindet freie Zugwahl mit der stärksten gegnerischen Antwort in sechs ruhigen und taktischen Stellungen. Bei praktischer Gleichwertigkeit akzeptiert Stockfish mehrere Antworten. Die Trainingsstellungen verwenden eigene Eröffnungsstellungen sowie Beispiele aus dem vorhandenen CC0-Blunder-Check-Datensatz.
- **Kurztest** verwendet sechs getrennte Stellungen. Die App speichert die ersten beiden Eingaben pro Stellung und zeigt nach Abschluss den Stand. Er misst Aufgaben in der App, kein Rating und keine belegte Verbesserung in echten Partien.
- **Rapid-Nacharbeit** bietet nach dem Import einen direkten Einstieg in einen Fehler der letzten geeigneten Partie. Die Wiederholungsfrist kommt aus der vorhandenen FSRS-Karte.
- **Erste Partie** führt aus den Grundlagen zu einem ungetakteten Spiel gegen Bauer Bruno und anschließend zur Kurzbesprechung. Geführte Partien können wie andere Bot-Partien fortgesetzt werden.
- **Coach-Automatik** wertet bis zu acht unterschiedliche aktuelle Zug-und-Antwort- oder Kurztest-Stellungen der letzten 30 Tage aus. Ab vier Stellungen und mindestens 75 % erfolgreich gelösten Aufgaben fragt der Coach häufiger selbst ab. Bei schwächeren Ergebnissen erscheinen Warnungen wieder. Der Grenzwert ist eine Produktentscheidung und bleibt überprüfbar.
