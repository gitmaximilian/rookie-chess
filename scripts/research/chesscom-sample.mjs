/**
 * Stichprobe echter Chess.com-Spieler für die Umrechnung des Skill-Pentas (Lichess-Skala) auf Chess.com-Wertungen:
 *
 *   node scripts/research/chesscom-sample.mjs <ausgabeordner> [jeBand=8]
 *
 * - Spielernamen aus den öffentlichen Länderlisten (api.chess.com/pub/country/XX/players), gemischt, reproduzierbar.
 * - Je Spieler die Wertungen (…/stats): ein Tempo zählt, wenn die Wertung eingespielt ist (RD ≤ 100), die letzte
 *   Partie höchstens 45 Tage alt ist und mindestens 30 Partien gespielt sind.
 * - Je Band (Chess.com-Wertung, 200er-Schritte 200–2400) bis zu `jeBand` Spieler je Tempo (Rapid, Blitz) mit
 *   ≥ 12 gewerteten Partien in den letzten beiden Monatsarchiven; je Spieler bis zu 20 Partien (neueste zuerst).
 * Ausgabe: rapid.pgn, blitz.pgn (mit %clk), sample.log. Die Dateien enthalten Spielernamen und bleiben lokal;
 * veröffentlicht werden nur zusammengefasste Kennzahlen. Anfragen nacheinander (Chess.com erlaubt serielle Abrufe).
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const [, , dir, perBandArg] = process.argv;
const PER_BAND = Number(perBandArg ?? 8);
const COUNTRIES = [
	'AT',
	'DE',
	'US',
	'GB',
	'IN',
	'FR',
	'ES',
	'BR',
	'PH',
	'TR',
	'PL',
	'NL',
	'IT',
	'CA'
];
const MAX_STATS = 7000;
const MIN_GAMES = 12;
const MAX_GAMES = 20;
const BANDS = Array.from({ length: 12 }, (_, i) => 200 + i * 200);
const UA = {
	'User-Agent': 'rookie-research (open-source chess trainer, aggregate statistics only)'
};
const now = Date.now();
mkdirSync(dir, { recursive: true });
const log = (s) => {
	appendFileSync(`${dir}/sample.log`, s + '\n');
	process.stderr.write(s + '\n');
};

let seed = 777;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url, { headers: UA });
			if (res.status === 429) {
				await sleep(5000 * (attempt + 1));
				continue;
			}
			if (!res.ok) return null;
			return await res.json();
		} catch {
			await sleep(2000);
		}
	}
	return null;
}

const names = [];
for (const c of COUNTRIES) {
	const list = (await get(`https://api.chess.com/pub/country/${c}/players`))?.players ?? [];
	// je Land höchstens 3000 Namen, damit kein Land die Stichprobe dominiert
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[list[i], list[j]] = [list[j], list[i]];
	}
	names.push(...list.slice(0, 3000));
	log(`${c}: ${list.length} Namen`);
}
for (let i = names.length - 1; i > 0; i--) {
	const j = Math.floor(rnd() * (i + 1));
	[names[i], names[j]] = [names[j], names[i]];
}

const SPEEDS = { rapid: 'chess_rapid', blitz: 'chess_blitz' };
const picked = { rapid: new Map(), blitz: new Map() };
const bandOf = (r) => BANDS.findLast((b) => r >= b);
const full = (speed, band) => (picked[speed].get(band)?.length ?? 0) >= PER_BAND;
const done = () => Object.keys(SPEEDS).every((s) => BANDS.every((b) => full(s, b)));

const d = new Date(now);
const months = [0, 1].map((k) => {
	const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1));
	return `${m.getUTCFullYear()}/${String(m.getUTCMonth() + 1).padStart(2, '0')}`;
});

let asked = 0;
for (const name of names) {
	if (done() || asked >= MAX_STATS) break;
	asked++;
	const stats = await get(`https://api.chess.com/pub/player/${name}/stats`);
	if (!stats) continue;
	const want = [];
	for (const [speed, key] of Object.entries(SPEEDS)) {
		const s = stats[key];
		if (!s?.last) continue;
		const games = (s.record?.win ?? 0) + (s.record?.loss ?? 0) + (s.record?.draw ?? 0);
		const band = bandOf(s.last.rating);
		if (band === undefined || full(speed, band)) continue;
		if (s.last.rd > 100 || games < 30 || now - s.last.date * 1000 > 45 * 86_400_000) continue;
		want.push({ speed, band });
	}
	if (!want.length) continue;
	const games = [];
	for (const m of months) {
		const arch = await get(`https://api.chess.com/pub/player/${name}/games/${m}`);
		games.push(...(arch?.games ?? []));
	}
	for (const { speed, band } of want) {
		const mine = games
			.filter((g) => g.rules === 'chess' && g.rated && g.time_class === speed && g.pgn)
			.sort((a, b) => b.end_time - a.end_time)
			.slice(0, MAX_GAMES);
		if (mine.length < MIN_GAMES) continue;
		const list = picked[speed].get(band) ?? [];
		list.push({ name, pgns: mine.map((g) => g.pgn.trim()) });
		picked[speed].set(band, list);
	}
	if (asked % 100 === 0)
		log(
			`${asked} Spieler gefragt · ` +
				Object.keys(SPEEDS)
					.map((s) => `${s} ` + BANDS.map((b) => picked[s].get(b)?.length ?? 0).join('/'))
					.join(' · ')
		);
}

for (const speed of Object.keys(SPEEDS)) {
	const all = [...picked[speed].values()].flat();
	writeFileSync(`${dir}/${speed}.pgn`, all.flatMap((p) => p.pgns).join('\n\n') + '\n');
	log(
		`${speed}: ${all.length} Spieler, ${all.reduce((s, p) => s + p.pgns.length, 0)} Partien (${BANDS.map(
			(b) => `${b}:${picked[speed].get(b)?.length ?? 0}`
		).join(' ')})`
	);
}
