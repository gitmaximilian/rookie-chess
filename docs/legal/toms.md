# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) – Rookie

> Stand 2026-11-11, freigegeben. Beschreibt, was der Code tatsächlich tut (`server/api.ts`).

## Datenminimierung (Art. 5, 25 DSGVO – Privacy by Design/Default)

- Konto ist freiwillig; ohne Konto bleiben alle Daten lokal im Browser.
- Anmeldung ausschließlich per Passkey (WebAuthn): keine E-Mail, kein Name, kein Passwort.
- Konto-ID ist zufällig (128 Bit) und ohne Personenbezug; Passkey-Name im Schlüsselbund „Rookie xxxxxx“.
- Importierte Online-Partien (enthalten Namen Dritter) werden nicht hochgeladen.
- Keine IP-Adressen, keine Gerätekennungen, kein Tracking, keine Analyse-Tools, keine Werbung.

## Vertraulichkeit

- Übertragung nur per HTTPS (TLS) über Cloudflare; HSTS über Cloudflare möglich.
- Passkeys sind phishing-resistent; Server speichert nur öffentliche Schlüssel.
- Sitzungs-Token: 256 Bit zufällig, nur als SHA-256-Hash in der Datenbank; Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, Pfad `/api`.
- Zugriff auf Daten ausschließlich über die eigene Sitzung (Konto-ID aus Sitzung, nie aus Anfrageparametern).
- Schutz vor Cross-Site-Anfragen: Origin-Prüfung bei allen schreibenden Anfragen, `SameSite=Strict`.
- Anmelde-Challenges sind einmalig verwendbar und laufen nach 5 Minuten ab.
- Sicherheits-Header: COOP/COEP/CORP, Referrer-Policy (`static/_headers`).
- Zugriff auf Cloudflare-Konto: nur Verantwortlicher; Zwei-Faktor-Anmeldung aktiv (seit 2026-11-11).

## Integrität

- Optimistische Versionierung beim Speichern (Konflikte werden erkannt, nichts wird überschrieben).
- Server nimmt nur gzip-Daten bis 1,9 MB an.

## Verfügbarkeit und Belastbarkeit

- Cloudflare-Infrastruktur (redundant); Daten zusätzlich lokal auf jedem Gerät.
- Nutzer können jederzeit eine lokale Sicherung exportieren.
- Cloudflare D1 Time Travel (Wiederherstellungspunkte, im Gratis-Tarif 7 Tage) ist automatisch aktiv. Gelöschte Daten verschwinden daraus spätestens nach 7 Tagen.

## Löschung und Betroffenenrechte

- „Konto löschen“ entfernt sofort alle Zeilen (Konto, Passkeys, Sitzungen, Daten).
- „Meine Serverdaten herunterladen“ liefert alle gespeicherten Daten (Auskunft/Übertragbarkeit).
- Automatische Löschung inaktiver Konten nach 2 Jahren.

## Protokollierung

- Rookie protokolliert keine personenbezogenen Daten; Fehlermeldungen der API enthalten keine Details.
- Cloudflare-Logs: Workers-Logs/Logpush nicht aktivieren, solange nicht nötig.

## Überprüfung

- Automatisierte Tests: `npm run test:account` (Anmeldung, Abgleich, Export, Löschung, Zugriffsschutz).
- Abhängigkeiten aktuell halten (`npm audit`), Überprüfung mindestens jährlich.
