# Rookie-Rapid-Pilot starten

Dieses Handbuch konkretisiert das [Pilotprotokoll](../rapid-training-pilot.md). Der Pilot vergleicht zwei Rookie-Versionen und soll zeigen, ob der neue Tagesplan häufiger zur Besprechung eigener Partien führt und ob sich die Patzerrate in echten Partien günstig entwickelt. Die Stichprobe von bis zu 40 Erwachsenen liefert ein erstes Signal.

## Ablauf

1. Zwei freiwillige Personen testen vorab Anmeldung, Wochenmeldung und den Export einer Beispielpartie. Ihre Ergebnisse fließen nicht in den Hauptvergleich ein.
2. Bis zu 40 Erwachsene mit einer etablierten Lichess-Rapid-Wertung von 800 bis 1300 aufnehmen. Einmalig Browser/Gerät und frühere Rookie-Nutzung erfassen. Den Hinweis zur Datenverarbeitung vor der Einwilligung geben. Kontakte und Einwilligungen geschützt führen.
3. Zwei Wochen Ausgangsmessung. Pro Woche vier gewertete Lichess-Standardpartien mit 10+0. Das bisherige sonstige Training läuft wie gewohnt weiter und wird erfasst. Die ersten acht passenden Partien des Fensters abgeben, einschließlich Niederlagen und Zeitüberschreitungen. Zahl und Ausfallgründe notieren, wenn es weniger sind. KI- und Engine-Hilfe erst nach Ende der Partie verwenden.
4. Danach in den Startwertungsbändern 800–999, 1000–1149 und 1150–1300 paaren. Innerhalb jedes Bands nach Anzahl erfasster Ausgangspartien, dann nach Startwertung sortieren. Benachbarte Personen bilden ein Paar. Für jedes Paar einmal zufällig wählen, wer A erhält, die andere Person erhält B. Einzelne Überzählige zufällig zuteilen. Datum und Zuteilung geschützt festhalten, bevor die Links verschickt werden.
5. Sechs Wochen mit dem zugeteilten Link. Beide Gruppen erhalten dieselbe Vorgabe von vier gewerteten Partien und drei Einheiten zu je 15 Minuten Rookie pro Woche. Sie folgen den Empfehlungen ihrer Version. Rookie-Zeit, Spielzeit gegen Menschen und sonstige Schachzeit getrennt protokollieren. In Wochen 5 und 6 die ersten acht passenden Partien zusammen für die Auswertung einreichen.
6. Zwei Wochen Nachbeobachtung. Noch einmal dieselbe Wochenmeldung sowie die bestätigte Lichess-Rapid-Wertung abfragen. An Start, Ende und Nachbeobachtung prüft die Person im Lichess-Profil selbst, ob die Wertung noch provisorisch ist. Ausfälle, fehlende Daten und Gruppenwechsel dokumentieren.

| Gruppe | Fest angehefteter Stand | Link                                                |
| ------ | ----------------------- | --------------------------------------------------- |
| A      | 0.7.5, `6098650`        | [Rookie A](https://c6788757.rookie-chess.pages.dev) |
| B      | 0.7.6, `79ff2b8`        | [Rookie B](https://7567d07e.rookie-chess.pages.dev) |

Beide URLs sind eigene Browser-Speicherbereiche. Teilnehmende behalten Browser, Gerät und zugeteilten Link während des Piloten bei. Einstieg mit frischem lokalen Profil. Für Partienimport genügt der Lichess-Name in den lokalen Einstellungen; das optionale Rookie-Konto wird für den Piloten nicht benötigt.

## Wochenmeldung und Partien

Den Text aus der [Vorlage](wochenmeldung.md) einmal pro Woche privat übermitteln. Als eine besprochene Partie zählt, wenn sie importiert wurde und die Person mindestens einen eigenen kritischen Zug in der Analyse nachvollzogen hat. In Trainingswoche 1 und 6 erfassen, wie viele Teilnehmende die Anleitung ohne Hilfe bis zum Import schaffen. Ein separater Transfer-Test mit neuen Aufgaben ist eine spätere Ergänzung.

Pro Partie Zugfolge, Teilnehmerfarbe, Zeitkontrolle, Ergebnis und die Gegnerwertung auf 50 Punkte gerundet, soweit angezeigt übermitteln. Nutzernamen, URLs, exakte Zeitstempel, freie PGN-Kommentare und andere identifizierende Metadaten vor der Übermittlung entfernen. Die Person bestätigt „gewertet, Standard, 10+0“ und die Reihenfolge der Partien. Keine vollständigen Rookie-Backups einfordern. Teilnehmercodes statt Namen für Wochenmeldungen und Partien verwenden. Diese Daten können über die Zugfolge und die getrennt verwahrte Kontaktliste zuordenbar bleiben.

## Auswertung vor Beginn festlegen

- Stockfish 19 Lite Single Thread aus dem Paket-Lock von `84a7e8c` verwenden. Feste Tiefe 13, Threads 1, Hash 16 MiB, MultiPV 1. Den Hash vor jeder Stellung leeren. Alle Partien zentral mit denselben Einstellungen auswerten. App-Analysen laufen je nach Gerät mit anderer Tiefe.
- Rookies Funktion `gameSafety` als Definition verwenden. Eigene Züge zählen bei vorher mindestens 20 % modellierter Gewinnchance. Ein Patzer kostet mindestens 0,30 auf der verdoppelten Differenzskala, entsprechend 15 Prozentpunkten auf der 0–100-%-Skala. Den Engine-Bestzug mit null Verlust werten. Matt und Remis auf dem Brett einheitlich bewerten. Pro Person und Fenster `100 × Patzer / auswertbare eigene Züge` berechnen.
- Ein Fenster gilt ab vier vollständigen, zulässigen Partien und mindestens 30 auswertbaren eigenen Zügen als auswertbar. Ein Datenpunkt mit komplett fehlendem Fenster bleibt als fehlend erfasst. Anzahl und Gründe nach Zuteilung berichten. Für die Hauptauswertung pro Person die Rate nach sechs Wochen minus Ausgangsrate bilden. Gruppenmittel dieser Änderungen mit 95-%-Intervall vergleichen. Zusätzlich prüfen, ob die Richtung bei plausiblen Annahmen für fehlende Werte kippt.
- Als Kriterien für eine Folgestudie gelten mindestens 70 % mit verwertbaren Partiedaten je Gruppe, mindestens 15 Prozentpunkte mehr Wochen mit importierter und besprochener Partie in B und eine günstigere Patzerrate in B. Tatsächliche Trainingsstunden und die Änderung der bestätigten Lichess-Rapid-Wertung zusätzlich berichten. Wochenmeldungen ohne Antwort gesondert ausweisen; für das Betriebskriterium zählt der Anteil an den sechs geplanten Wochen.
- Vor der ersten Zuteilung zwei Beispielpartien in der zentralen Auswertung durchspielen und dieselben Zähler bei Wiederholung bestätigen. Die endgültigen Regeln und die Zuteilung getrennt ablegen. Bei der zentralen Bewertung nur Teilnehmercodes verwenden. Erst nach Abschluss die Auswertung mit der Gruppenzuteilung verbinden.

## Vor der ersten Datenerhebung

Verantwortlich ist Maximilian Auer, Wien, Österreich, contact@maximilianauer.at. Möglichst wenig Daten erfassen, den bestehenden Account-Datenschutzhinweis durch einen Hinweis für diesen Pilot ergänzen und den Teilnehmenden beides rechtzeitig geben. Für den Pilot ist Einwilligung vorgesehen. Die auf den tatsächlich verwendeten Übermittlungskanal und Speicherort zugeschnittene Information muss Zweck, Daten, Zugriff und Empfänger, etwaige Drittlandübermittlung, Löschfristen und Rechte einschließlich Widerruf und Beschwerde nennen. [DSGVO Art. 5, 7 und 13](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de)

Vorgeschlagene Arbeitsweise: Kontaktdaten und Zuordnung getrennt von den codierten Daten in zwei verschlüsselten lokalen Ablagen, Zugriff durch die Studienleitung. Kontakt- und Rohdaten spätestens 90 Tage nach Auswertung löschen, sofern keine konkrete Verpflichtung eine andere Frist erfordert. Nach außen nur zusammengefasste Ergebnisse geben. Den privaten Übermittlungskanal und den Termin vor Versand festlegen. [Aufruf zur Teilnahme](aufruf.md)
