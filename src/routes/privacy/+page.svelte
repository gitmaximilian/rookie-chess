<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { i18n } from '#lib/i18n/i18n.svelte.js';

	const de = $derived(i18n.locale === 'de');
	const UPDATED = '2026-11-11';
</script>

<svelte:head><title>{de ? 'Datenschutzhinweise' : 'Privacy notice'} – Rookie</title></svelte:head>

<PageHeader
	eyebrow="Rookie"
	title={de ? 'Datenschutzhinweise' : 'Privacy notice'}
	subtitle={de
		? 'Was Rookie speichert – und was nicht.'
		: 'What Rookie stores – and what it doesn’t.'}
/>

<article class="card doc">
	{#if de}
		<h2>Kurz gesagt</h2>
		<ul>
			<li>Ohne Konto bleibt alles auf deinem Gerät. Wir sehen nichts.</li>
			<li>
				Das Konto ist freiwillig. Es gibt keine E-Mail, keinen Namen, kein Passwort, kein Tracking
				und keine Werbung.
			</li>
			<li>Du kannst deine Serverdaten jederzeit herunterladen und dein Konto sofort löschen.</li>
		</ul>

		<h2>Verantwortlicher</h2>
		<p>
			Maximilian Auer, Wien, Österreich ·
			<a href="mailto:contact@maximilianauer.at">contact@maximilianauer.at</a>. Impressum und die
			allgemeine Datenschutzerklärung findest du unter
			<a href="https://maximilianauer.at/legal/" rel="noopener">maximilianauer.at/legal</a>.
		</p>

		<h2>Ohne Konto</h2>
		<p>
			Dein Trainingsfortschritt wird nur lokal in deinem Browser gespeichert (IndexedDB). Er wird
			nicht an uns übertragen.
		</p>

		<h2>Mit Konto (freiwillig)</h2>
		<p>Damit dein Fortschritt auf all deinen Geräten verfügbar ist, speichern wir:</p>
		<ul>
			<li>
				<b>Konto:</b> eine zufällige Konto-ID, Zeitpunkt der Erstellung und der letzten Nutzung.
			</li>
			<li>
				<b>Passkey:</b> die Kennung deines Passkeys, den zugehörigen öffentlichen Schlüssel, einen Signaturzähler
				und die Übertragungsart (z. B. „internal“). Dein privater Schlüssel und deine biometrischen Daten
				(Face ID / Touch ID) verlassen nie dein Gerät.
			</li>
			<li>
				<b>Sitzungen:</b> nur eine Prüfsumme (SHA-256) des Anmelde-Tokens und dessen Ablaufdatum.
			</li>
			<li>
				<b>Trainingsstand</b> (komprimiert): Puzzle-Versuche, Wertungsverlauf, Wiederholungskarten, Fehler-Übungen,
				Repertoire, Endspiel- und Kursfortschritt, Aktivität, Einstellungen (inkl. eines ggf. verknüpften
				Lichess- oder Chess.com-Benutzernamens), Partien gegen Bots und von dir eingefügte PGN-Partien.
			</li>
		</ul>
		<p>
			<b>Nicht gespeichert</b> werden: E-Mail-Adresse, Name, Passwort, IP-Adressen und Gerätekennungen.
			Von Lichess oder Chess.com importierte Partien werden nicht hochgeladen, weil sie Namen anderer
			Spieler enthalten. Sie werden auf jedem Gerät neu geladen. Bitte lade keine PGN-Partien mit Daten
			anderer Personen hoch, wenn du das nicht möchtest.
		</p>

		<h2>Zweck und Rechtsgrundlage</h2>
		<p>
			Bereitstellung des Kontos und der Synchronisation, die du anforderst – Art. 6 Abs. 1 lit. b
			DSGVO (Vertragserfüllung). Das Konto ist ab 14 Jahren oder mit Zustimmung der Eltern nutzbar.
		</p>

		<h2>Cookies</h2>
		<p>
			Nur technisch notwendige Cookies, beschränkt auf die Schnittstelle <code>/api</code>:
			<code>rk_session</code> (Anmeldung, bis zu 180 Tage) und <code>rk_challenge</code> (nur während
			der Anmeldung, 5 Minuten). Es gibt keine Analyse- oder Werbe-Cookies (§ 165 Abs. 3 TKG 2021).
		</p>

		<h2>Empfänger und Speicherort</h2>
		<p>
			Hosting und Datenbank: Cloudflare, Inc. (Cloudflare Pages und D1) als Auftragsverarbeiter auf
			Grundlage des Auftragsverarbeitungsvertrags von Cloudflare. Die Datenbank ist auf die EU
			beschränkt. Für etwaige Zugriffe aus den USA gilt das EU-US Data Privacy Framework bzw.
			Standardvertragsklauseln. Passkeys werden von deinem Betriebssystem verwaltet (z. B. Apple
			iCloud-Schlüsselbund) – dafür gelten die Bedingungen des jeweiligen Anbieters.
		</p>

		<h2>Speicherdauer</h2>
		<ul>
			<li>
				Bis du dein Konto löschst – die Löschung ist sofort und endgültig. Technische
				Wiederherstellungspunkte der Datenbank laufen nach spätestens 7 Tagen ab.
			</li>
			<li>Konten ohne Nutzung seit 2 Jahren werden automatisch gelöscht.</li>
			<li>
				Anmeldungen laufen nach 180 Tagen ohne Nutzung ab. Anmelde-Challenges werden nach 5 Minuten
				gelöscht.
			</li>
		</ul>

		<h2>Sicherheit</h2>
		<p>
			Verschlüsselte Übertragung (HTTPS), Anmeldung nur per Passkey (phishing-resistent), keine
			Passwörter, Sitzungs-Tokens nur als Prüfsumme gespeichert, Zugriff ausschließlich auf die
			eigenen Daten. Rookie selbst protokolliert keine personenbezogenen Daten (Cloudflare
			verarbeitet beim Abruf technisch notwendige Verbindungsdaten, siehe allgemeine
			Datenschutzerklärung).
		</p>

		<h2>Deine Rechte</h2>
		<p>
			Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch.
			Auskunft und Übertragbarkeit: „Meine Serverdaten herunterladen“ in den
			<a href={resolve('/settings')}>Einstellungen</a>. Löschung: „Konto löschen“. Für alles Weitere
			schreib an
			<a href="mailto:contact@maximilianauer.at">contact@maximilianauer.at</a>. Du kannst dich
			außerdem bei der österreichischen Datenschutzbehörde beschweren (<a
				href="https://www.dsb.gv.at"
				rel="noopener">dsb.gv.at</a
			>).
		</p>
		<p class="updated">Stand: {UPDATED}</p>
	{:else}
		<h2>In short</h2>
		<ul>
			<li>Without an account everything stays on your device. We see nothing.</li>
			<li>
				The account is optional: no email, no name, no password, no tracking and no advertising.
			</li>
			<li>You can download your server data at any time and delete your account instantly.</li>
		</ul>

		<h2>Controller</h2>
		<p>
			Maximilian Auer, Vienna, Austria ·
			<a href="mailto:contact@maximilianauer.at">contact@maximilianauer.at</a>. Legal notice and the
			general privacy policy:
			<a href="https://maximilianauer.at/legal/" rel="noopener">maximilianauer.at/legal</a>.
		</p>

		<h2>Without an account</h2>
		<p>
			Your training progress is stored only locally in your browser (IndexedDB) and is never sent to
			us.
		</p>

		<h2>With an account (optional)</h2>
		<p>To make your progress available on all your devices, we store:</p>
		<ul>
			<li><b>Account:</b> a random account ID, the time it was created and last used.</li>
			<li>
				<b>Passkey:</b> your passkey’s identifier, its public key, a signature counter and the transport
				type (e.g. “internal”). Your private key and biometric data (Face ID / Touch ID) never leave your
				device.
			</li>
			<li><b>Sessions:</b> only a SHA-256 hash of the sign-in token and its expiry date.</li>
			<li>
				<b>Training data</b> (compressed): puzzle attempts, rating history, review cards, mistake exercises,
				repertoire, endgame and course progress, activity, settings (including a linked Lichess or Chess.com
				username, if any), games against bots and PGN games you pasted.
			</li>
		</ul>
		<p>
			<b>Not stored:</b> email address, name, password, IP addresses or device identifiers. Games imported
			from Lichess or Chess.com are not uploaded because they contain other players’ names – they are
			loaded again on each device. Please don’t upload PGN games containing other people’s data if you
			don’t want that.
		</p>

		<h2>Purpose and legal basis</h2>
		<p>
			Providing the account and synchronisation you request – Art. 6(1)(b) GDPR (performance of a
			contract). Accounts are for users aged 14 and over or with parental permission.
		</p>

		<h2>Cookies</h2>
		<p>
			Only strictly necessary cookies, limited to the <code>/api</code> path:
			<code>rk_session</code> (sign-in, up to 180 days) and <code>rk_challenge</code> (only during sign-in,
			5 minutes). No analytics or advertising cookies.
		</p>

		<h2>Recipients and storage location</h2>
		<p>
			Hosting and database: Cloudflare, Inc. (Cloudflare Pages and D1) as processor under
			Cloudflare’s data processing addendum. The database is restricted to the EU. Any access from
			the USA is covered by the EU-US Data Privacy Framework or standard contractual clauses.
			Passkeys are managed by your operating system (e.g. Apple iCloud Keychain) under that
			provider’s terms.
		</p>

		<h2>Retention</h2>
		<ul>
			<li>
				Until you delete your account – deletion is immediate and permanent. Technical database
				restore points expire after at most 7 days.
			</li>
			<li>Accounts unused for 2 years are deleted automatically.</li>
			<li>Sign-ins expire after 180 days without use; sign-in challenges after 5 minutes.</li>
		</ul>

		<h2>Security</h2>
		<p>
			Encrypted transport (HTTPS), passkey-only sign-in (phishing-resistant), no passwords, session
			tokens stored only as hashes, access strictly limited to your own data. Rookie itself does not
			log personal data (Cloudflare processes technically necessary connection data, see the general
			privacy policy).
		</p>

		<h2>Your rights</h2>
		<p>
			Access, rectification, erasure, restriction, data portability and objection. Access and
			portability: “Download my server data” in
			<a href={resolve('/settings')}>Settings</a>. Erasure: “Delete account”. For anything else,
			write to <a href="mailto:contact@maximilianauer.at">contact@maximilianauer.at</a>. You can
			also lodge a complaint with the Austrian Data Protection Authority (<a
				href="https://www.dsb.gv.at"
				rel="noopener">dsb.gv.at</a
			>).
		</p>
		<p class="updated">Last updated: {UPDATED}</p>
	{/if}
</article>

<style>
	.doc {
		max-width: 760px;
		padding: 1.4rem 1.5rem;
		line-height: 1.6;
	}

	.doc h2 {
		font-size: 1.1rem;
		margin: 1.4rem 0 0.4rem;
	}

	.doc h2:first-child {
		margin-top: 0;
	}

	.doc ul {
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.doc a {
		color: var(--accent);
		font-weight: 600;
	}

	code {
		font-size: 0.88em;
		padding: 0.05rem 0.3rem;
		border-radius: 5px;
		background: var(--surface-2);
	}

	.updated {
		margin-top: 1.4rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}
</style>
