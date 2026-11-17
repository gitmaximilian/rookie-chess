# Coach-Verlauf

## Plan

- Den Verlauf auf dem Coach-Tab direkt unter dem Kopf anzeigen. Zeitraumwahl mit den letzten 7, 30 und 365 Tagen sowie der gesamten importierten Historie. Zwei Linien auf derselben Zeitachse und mit beschrifteten eigenen Skalen.
- Für beide Linien dieselbe Auswahl gewerteter menschlicher Lichess-Rapid-Partien wie auf dem Weg zu 1600 verwenden. Die Wertung ist die gespeicherte Wertung nach der Partie. Der Trainingsindex nutzt nur vollständig analysierte Partien.
- Je analysiertem Spielpunkt die letzten zehn analysierten Rapid-Partien bis zu diesem Spiel einbeziehen. Ab drei Partien und 30 auswertbaren Zügen gibt es einen Index von 0 bis 100. Die Zeitraumauswahl ändert den Ausschnitt, nicht das Berechnungsfenster.
- Index = 60 % Zugsicherheit + 40 % mittlere Stockfish-Genauigkeit pro Partie. Sicherheit = max(0, 100 − 10 × Patzer je 30 auswertbare Züge). Bestehende Definition für Patzer und Züge verwenden. Siege, Remis, Niederlagen, analysierte Partien und verwertete Gewinnstellungen dienen zur Einordnung.
- Zahlen, Datenbasis, Grenzen und Formel in einer aufklappbaren Erklärung anzeigen. Auf der Zeitachse per Zeiger oder Tastatur zwischen Beobachtungen wechseln. Kein neuer Datenspeicher und kein zusätzlicher Abruf.

Die Gewichtung ist eine Produktentscheidung. Der Index beschreibt die von Rookie ausgewertete Zugqualität im verfügbaren Rapid-Verlauf. Spielpraxis, Gegnerstärke, Auswahl der importierten Partien und Analysetiefe können den Wert beeinflussen. Die gewöhnliche Lichess-Wertung behält ihre eigene Einheit.

## Abnahme

Mit bekannten Rapid-, Blitz-, Bot- und unvollständig analysierten Partien prüfen: echte Wertungspunkte nur aus gültigen Rapid-Partien, genug Daten vor dem ersten Index, unterschiedliche Zeiträume, Interaktion am Handy und am Desktop, Erklärung und leere Ansicht. Prüfen, dass unterschiedliche Zeiträume die Werte überlappender Punkte unverändert wiedergeben.
