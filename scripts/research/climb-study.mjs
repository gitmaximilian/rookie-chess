/**
 * Wie schnell steigen Einsteiger auf Lichess, und was hängt damit zusammen? (Nachtrag 20.11.2026 in
 * docs/research-2026-11-13.md; Grundlage der Wochendosis in lib/training/prescription.ts)
 *
 *   curl -r 0-60000000 https://database.lichess.org/standard/lichess_db_standard_rated_2025-10.pgn.zst | zstd -dc > part.pgn
 *   node scripts/research/climb-study.mjs pool part.pgn pool.json     # Spieler 550–1049 in gewerteten Rapid-Partien
 *   node scripts/research/climb-study.mjs users pool.json users.json  # öffentliche Profile (POST /api/users)
 *   node scripts/research/climb-study.mjs perf pool.json users.json perf.json  # Höchstwert (nur neue Konten)
 *   node scripts/research/climb-study.mjs report pool.json users.json perf.json
 *
 * Neue Konten (≤ 90 Tage alt bei der Stichprobenpartie): fast alle ihre Partien fallen in den Beobachtungszeitraum,
 * deshalb gilt „Partien insgesamt“ als Partien seit dem Start. Die Ausgabe enthält keine Namen; die Zwischendateien
 * bleiben lokal und gehören nicht ins Repo.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [, , cmd, ...files] = process.argv;
const DAY = 864e5;
const NEW_ACCOUNT_DAYS = 90;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const UA = { 'User-Agent': 'chess-research-script' };

async function get(url, opts = {}) {
	for (;;) {
		const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers ?? {}) } });
		if (r.status === 429) {
			await sleep(65000);
			continue;
		}
		return r.ok ? r.json() : null;
	}
}

if (cmd === 'pool') {
	const [pgn, out] = files;
	const pool = new Map();
	for (const g of readFileSync(pgn, 'utf8').split('\n[Event ')) {
		if (!g.includes('Rated Rapid game')) continue;
		const h = (k) => g.match(new RegExp(`\\[${k} "([^"]*)"\\]`))?.[1];
		const date = Date.parse(h('UTCDate').replace(/\./g, '-') + 'T' + h('UTCTime') + 'Z');
		for (const side of ['White', 'Black']) {
			const elo = Number(h(side + 'Elo'));
			const name = h(side);
			if (h(side + 'Title')) continue;
			if (elo >= 550 && elo < 1050 && name && !pool.has(name)) pool.set(name, { elo, date });
		}
	}
	writeFileSync(out, JSON.stringify([...pool.entries()]));
	console.log(pool.size);
} else if (cmd === 'users') {
	const [poolFile, out] = files;
	const list = read(poolFile);
	const users = {};
	for (let i = 0; i < list.length; i += 250) {
		const ids = list
			.slice(i, i + 250)
			.map(([n]) => n)
			.join(',');
		for (const u of (await get('https://lichess.org/api/users', { method: 'POST', body: ids })) ??
			[])
			users[u.id] = u;
		await sleep(2000);
	}
	writeFileSync(out, JSON.stringify(users));
	console.log(Object.keys(users).length);
} else if (cmd === 'perf') {
	const [poolFile, usersFile, out] = files;
	const pool = new Map(read(poolFile));
	const users = read(usersFile);
	const perf = existsSync(out) ? read(out) : {};
	for (const [name, p] of pool) {
		const u = users[name.toLowerCase()];
		if (!u || u.disabled || u.tosViolation || perf[name]) continue;
		if ((p.date - u.createdAt) / DAY > NEW_ACCOUNT_DAYS) continue;
		const j = await get(`https://lichess.org/api/user/${encodeURIComponent(name)}/perf/rapid`, {
			headers: { Accept: 'application/json' }
		});
		perf[name] = j ? { highest: j.stat?.highest } : { err: true };
		await sleep(900);
	}
	writeFileSync(out, JSON.stringify(perf));
} else if (cmd === 'report') {
	const [poolFile, usersFile, perfFile] = files;
	const pool = new Map(read(poolFile));
	const users = read(usersFile);
	const perf = read(perfFile);
	const q = (xs, p) => {
		const s = [...xs].sort((a, b) => a - b);
		return s.length ? s[Math.floor((s.length - 1) * p)] : null;
	};
	const rows = Object.keys(perf)
		.filter((n) => !perf[n].err)
		.map((name) => {
			const p = pool.get(name);
			const u = users[name.toLowerCase()];
			const r = u.perfs.rapid;
			const last = u.seenAt ?? Date.now();
			const h = perf[name].highest;
			return {
				start: p.elo,
				date: p.date,
				now: r.rating,
				games: r.games,
				gpw: r.games / Math.max(1, (last - u.createdAt) / (7 * DAY)),
				fast: (u.perfs.blitz?.games ?? 0) + (u.perfs.bullet?.games ?? 0),
				puzzles: u.perfs.puzzle?.games ?? 0,
				months: (last - p.date) / (30 * DAY),
				high: h && Date.parse(h.at) > p.date ? h.int : null
			};
		});
	const pct = (f, xs) => Math.round((xs.filter(f).length / xs.length) * 100);
	console.log(
		`neue Konten: ${rows.length}, Start Median ${q(
			rows.map((r) => r.start),
			0.5
		)}`
	);
	console.log(`nach ≥ 6 Monaten noch aktiv: ${pct((r) => r.months >= 6, rows)} %`);
	for (const goal of [1000, 1200, 1400, 1600]) {
		const xs = rows.filter((r) => r.start < goal);
		console.log(`je erreicht ${goal}: ${pct((r) => (r.high ?? 0) >= goal, xs)} % von ${xs.length}`);
	}
	const stay = rows.filter((r) => r.months >= 6 && r.games >= 50);
	const line = (label, xs) =>
		console.log(
			`${label.padEnd(20)} n ${String(xs.length).padStart(3)}  Δ Median ${q(
				xs.map((r) => r.now - r.start),
				0.5
			)}  Q1 ${q(
				xs.map((r) => r.now - r.start),
				0.25
			)}  Q3 ${q(
				xs.map((r) => r.now - r.start),
				0.75
			)}  Partien ${q(
				xs.map((r) => r.games),
				0.5
			)}`
		);
	console.log('\nPartien pro Woche (≥ 6 Monate dabei, ≥ 50 Rapid-Partien)');
	for (const [lo, hi] of [
		[0, 2],
		[2, 4],
		[4, 8],
		[8, 15],
		[15, Infinity]
	])
		line(
			`${lo}–${hi}/Woche`,
			stay.filter((r) => r.gpw >= lo && r.gpw < hi)
		);
	console.log('\nPuzzles bei ähnlicher Partienzahl (150–1000 Rapid-Partien)');
	const mid = stay.filter((r) => r.games >= 150 && r.games < 1000);
	for (const [lo, hi] of [
		[0, 100],
		[100, 1000],
		[1000, Infinity]
	])
		line(
			`${lo}–${hi} Puzzles`,
			mid.filter((r) => r.puzzles >= lo && r.puzzles < hi)
		);
	console.log('\nBlitz/Bullet im Verhältnis zu Rapid');
	for (const [lo, hi] of [
		[0, 0.25],
		[0.25, 1],
		[1, Infinity]
	])
		line(
			`schnell/rapid ${lo}–${hi}`,
			stay.filter((r) => r.fast / r.games >= lo && r.fast / r.games < hi)
		);
	for (const goal of [1200, 1400]) {
		const xs = rows.filter((r) => r.start < goal - 100);
		const yes = xs.filter((r) => (r.high ?? 0) >= goal);
		const no = xs.filter((r) => (r.high ?? 0) < goal);
		console.log(
			`\n${goal} erreicht: n ${yes.length}, Rapid-Partien Median ${q(
				yes.map((r) => r.games),
				0.5
			)} (Q1 ${q(
				yes.map((r) => r.games),
				0.25
			)}), Puzzles ${q(
				yes.map((r) => r.puzzles),
				0.5
			)} · nicht erreicht: Partien ${q(
				no.map((r) => r.games),
				0.5
			)}, Puzzles ${q(
				no.map((r) => r.puzzles),
				0.5
			)}`
		);
	}
} else {
	console.error('Befehl: pool | users | perf | report');
	process.exit(1);
}
