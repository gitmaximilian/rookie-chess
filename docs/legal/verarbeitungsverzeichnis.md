# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) – Rookie

> Stand 2026-11-11, vom Verantwortlichen freigegeben. Internes Dokument; muss nicht veröffentlicht, aber auf Anfrage der Datenschutzbehörde vorgelegt werden. Bitte prüfen und bei Änderungen aktualisieren. Keine Rechtsberatung.

## Verantwortlicher

Maximilian Auer, Wien, Österreich – contact@maximilianauer.at
Datenschutzbeauftragter: nicht erforderlich (keine umfangreiche Verarbeitung besonderer Kategorien, keine systematische Überwachung).

## Verarbeitung 1: Nutzerkonto und Synchronisation des Trainingsstands

| Punkt                 | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zweck                 | Freiwilliges Konto, damit der Trainingsfortschritt auf mehreren Geräten verfügbar ist und gesichert bleibt                                                                                                                                                                                                                                                                                                                                   |
| Rechtsgrundlage       | Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsverhältnisses)                                                                                                                                                                                                                                                                                                                                                                             |
| Betroffene            | Nutzerinnen und Nutzer von Rookie, die ein Konto anlegen (ab 14 Jahren bzw. mit Zustimmung der Eltern)                                                                                                                                                                                                                                                                                                                                       |
| Datenkategorien       | Zufällige Konto-ID; Zeitpunkte (Erstellung, letzte Nutzung); Passkey-Kennung, öffentlicher Schlüssel, Signaturzähler, Übertragungsart; SHA-256-Hash des Sitzungs-Tokens mit Ablaufdatum; Trainingsstand (Puzzle-Versuche, Wertungen, Wiederholungskarten, Repertoire, Endspiel-/Kursfortschritt, Aktivität, Einstellungen inkl. eines ggf. verknüpften Lichess-/Chess.com-Benutzernamens, Partien gegen Bots, selbst eingefügte PGN-Partien) |
| Nicht verarbeitet     | E-Mail, Name, Passwort, IP-Adressen (durch Rookie), Gerätekennungen, Tracking, Biometrie (bleibt auf dem Gerät)                                                                                                                                                                                                                                                                                                                              |
| Empfänger             | Cloudflare, Inc. als Auftragsverarbeiter (Cloudflare Pages, Workers/Functions, D1)                                                                                                                                                                                                                                                                                                                                                           |
| Drittlandübermittlung | Datenbank mit Gerichtsbarkeit „EU“ (Speicherung in der EU). Mögliche Zugriffe aus den USA: EU-US Data Privacy Framework (Cloudflare ist zertifiziert) bzw. Standardvertragsklauseln im Cloudflare DPA                                                                                                                                                                                                                                        |
| Löschfristen          | Sofort bei Kontolöschung durch Nutzer (technische Wiederherstellungspunkte von D1 laufen nach spätestens 7 Tagen ab); automatisch nach 2 Jahren ohne Nutzung; Sitzungen nach 180 Tagen ohne Nutzung; Anmelde-Challenges nach 5 Minuten                                                                                                                                                                                                       |
| TOMs                  | siehe `toms.md`                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Verarbeitung 2: Auslieferung der Website (Hosting)

| Punkt           | Inhalt                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Zweck           | Auslieferung der App, Schutz vor Angriffen                                                                     |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb)                                        |
| Daten           | Technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, abgerufene Datei, User-Agent) – durch Cloudflare |
| Empfänger       | Cloudflare, Inc. (Auftragsverarbeiter)                                                                         |
| Löschfrist      | gemäß Cloudflare (kurzfristige Logs); Rookie selbst speichert keine Logs                                       |

## Auftragsverarbeitung

Cloudflare Data Processing Addendum (DPA) – gilt automatisch mit den Cloudflare-Nutzungsbedingungen (Self-Serve Subscription Agreement). Link: https://www.cloudflare.com/cloudflare-customer-dpa/
