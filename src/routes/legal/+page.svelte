<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import CookieIcon from '@lucide/svelte/icons/cookie';
	import UserX from '@lucide/svelte/icons/user-x';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { operator, privacyUpdated } from '#lib/legal.js';

	const facts = [
		{ icon: UserX, title: 'Kein Konto', text: 'Keine Anmeldung, keine Registrierung.' },
		{
			icon: Smartphone,
			title: 'Daten bleiben lokal',
			text: 'Dein Fortschritt liegt nur auf deinem Gerät.'
		},
		{
			icon: CookieIcon,
			title: 'Keine Cookies',
			text: 'Kein Tracking, keine Werbung, keine Analyse.'
		},
		{ icon: ShieldCheck, title: 'Open Source', text: 'Der gesamte Code ist öffentlich einsehbar.' }
	];
</script>

<svelte:head><title>Impressum & Datenschutz – Zugzwang</title></svelte:head>

<PageHeader
	eyebrow="Rechtliches"
	title="Impressum & Datenschutz"
	subtitle="Kurz gesagt: Zugzwang sammelt keine Daten über dich."
/>

<div class="wrap">
	<ul class="facts">
		{#each facts as f (f.title)}
			<li class="card">
				<span class="ico"><f.icon size={20} strokeWidth={2.1} /></span>
				<b>{f.title}</b>
				<span>{f.text}</span>
			</li>
		{/each}
	</ul>

	<section class="card block" id="impressum">
		<h2>Offenlegung gemäß § 25 Mediengesetz</h2>
		<dl>
			<dt>Medieninhaber</dt>
			<dd>
				{#if operator.name}{operator.name}{:else}<span class="todo">Name noch einzutragen</span
					>{/if}
			</dd>
			<dt>Wohnort</dt>
			<dd>
				{#if operator.place}{operator.place}{:else}<span class="todo">Wohnort noch einzutragen</span
					>{/if}
			</dd>
			{#if operator.email}
				<dt>Kontakt</dt>
				<dd><a href="mailto:{operator.email}">{operator.email}</a></dd>
			{/if}
			<dt>Blattlinie</dt>
			<dd>Privates, nicht-kommerzielles Projekt: ein kostenloser Schach-Trainer.</dd>
		</dl>
	</section>

	<section class="card block" id="datenschutz">
		<h2>Datenschutzerklärung</h2>

		<h3>Verantwortlicher</h3>
		<p>Verantwortlich ist der oben genannte Medieninhaber.</p>

		<h3>Deine Trainingsdaten</h3>
		<p>
			Spielstände, Ratings, Puzzle-Fortschritt, Partien und Einstellungen werden ausschließlich
			lokal in deinem Browser gespeichert (IndexedDB). Sie werden nicht an uns übertragen. Wir
			können sie weder einsehen noch wiederherstellen. Du kannst sie jederzeit löschen, indem du
			die Website-Daten in deinem Browser entfernst.
		</p>

		<h3>Hosting</h3>
		<p>
			Die Website wird über Cloudflare Pages ausgeliefert (Cloudflare, Inc., USA). Beim Aufruf
			verarbeitet Cloudflare technisch notwendige Verbindungsdaten wie IP-Adresse, Zeitpunkt und
			abgerufene Datei, um die Seite auszuliefern und vor Angriffen zu schützen (Art. 6 Abs. 1 lit.
			f DSGVO). Mit Cloudflare besteht ein Auftragsverarbeitungsvertrag; die Übermittlung in die USA
			stützt sich auf das EU-US Data Privacy Framework bzw. Standardvertragsklauseln.
		</p>

		<h3>Externe Dienste – nur wenn du sie nutzt</h3>
		<p>
			Einige Funktionen fragen Daten direkt aus deinem Browser bei Drittanbietern ab. Dabei wird
			deine IP-Adresse an den jeweiligen Anbieter übertragen:
		</p>
		<ul class="list">
			<li>
				<b>Lichess</b> (lichess.org, Frankreich): Endspiel-Datenbank, Eröffnungsstatistik und Import deiner
				Partien, wenn du einen Lichess-Benutzernamen eingibst.
			</li>
			<li>
				<b>Chess.com</b> (USA): Import deiner Partien, wenn du einen Chess.com-Benutzernamen eingibst.
			</li>
		</ul>
		<p>
			Rechtsgrundlage ist deine Nutzung der jeweiligen Funktion (Art. 6 Abs. 1 lit. b DSGVO). Ohne
			diese Funktionen findet keine Übertragung statt.
		</p>

		<h3>Cookies & lokaler Speicher</h3>
		<p>
			Zugzwang verwendet keine Cookies und keine Analyse- oder Werbedienste. Der lokale Speicher im
			Browser wird nur genutzt, um die von dir gewünschte Funktion bereitzustellen (§ 165 Abs. 3 TKG
			2021) – etwa deinen Fortschritt und die Offline-Version der App. Schriften und Icons werden
			vom eigenen Server geladen, nicht von Google oder anderen Anbietern.
		</p>

		<h3>Deine Rechte</h3>
		<p>
			Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
			Datenübertragbarkeit und Widerspruch. Da wir keine personenbezogenen Daten über dich
			speichern, betreffen diese Rechte vor allem die Verbindungsdaten bei Cloudflare. Du kannst
			dich außerdem bei der österreichischen Datenschutzbehörde beschweren (dsb.gv.at).
		</p>

		<p class="meta">Stand: {privacyUpdated}</p>
	</section>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 760px;
	}

	.facts {
		list-style: none;
		margin: 0 0 0.25rem;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 900px) {
		.facts {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.facts li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 1rem;
		font-size: 0.9rem;
		color: var(--text-2);
		line-height: 1.35;
	}

	.facts b {
		color: var(--text);
		font-family: var(--font-display);
		font-size: 1.02rem;
		letter-spacing: -0.01em;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 11px;
		background: var(--c-learn-soft);
		color: var(--c-learn);
		margin-bottom: 0.5rem;
	}

	.block {
		padding: 1.35rem 1.4rem 1.5rem;
		scroll-margin-top: 1rem;
	}

	h2 {
		font-size: 1.25rem;
		margin-bottom: 0.9rem;
	}

	h3 {
		font-size: 1rem;
		margin: 1.25rem 0 0.35rem;
	}

	p,
	.list {
		color: var(--text-2);
		font-size: 0.95rem;
	}

	p + p {
		margin-top: 0.5rem;
	}

	.list {
		margin: 0.5rem 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.list b {
		color: var(--text);
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.55rem 1.25rem;
		margin: 0;
	}

	dt {
		color: var(--text-3);
		font-size: 0.88rem;
	}

	dd {
		margin: 0;
		font-weight: 560;
	}

	dd a:hover {
		color: var(--accent);
	}

	.todo {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-strong);
		font-size: 0.85rem;
		font-weight: 650;
	}

	.meta {
		margin-top: 1.25rem;
		font-size: 0.82rem;
		color: var(--text-3);
	}
</style>
