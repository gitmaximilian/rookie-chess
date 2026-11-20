/**
 * Stichprobe für die Eichung des Skill-Pentas je Tempo (Blitz, Bullet) aus einem Lichess-Datenbankauszug:
 *
 *   node scripts/research/skill-speed-sample.mjs <auszug.pgn> <Blitz|Bullet> <eichung.pgn> <holdout.pgn>
 *
 * - Holdout: je Band (400–2400, nach dem Median der eigenen Wertung) bis zu 6 Spieler mit ≥ 12 Partien in
 *   diesem Tempo, je Spieler bis zu 20 Partien (beliebige Gegner). Diese Spieler fehlen in der Eichung.
 * - Eichung: Partien, in denen beide Spieler im selben Band sind (Abstand ≤ 150) und keiner zum Holdout
 *   gehört, bis zu 120 je Band (400 … 2600+), zufällig, aber reproduzierbar.
 * Bot-Konten (Titel BOT) sind ausgeschlossen. Danach skill-study.mjs auf beide Dateien, skill-fit.mjs auf die
 * Eichung, skill-holdout.mjs (mit `--speed`) auf den Holdout. Die Dateien enthalten Spielernamen und bleiben lokal.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , file, speed, outCalib, outHold] = process.argv;
const PER_BAND = 120;
const HOLD_PLAYERS = 6;
const HOLD_GAMES = 20;
let seed = 4242;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = (xs) => {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};
const bandOf = (r) => (r >= 2600 ? 2600 : Math.floor(r / 200) * 200);

const games = [];
for (const raw of readFileSync(file, 'utf8').split('\n[Event ')) {
	const g = raw.startsWith('[Event ') ? raw : '[Event ' + raw;
	if (!g.includes(`[Event "Rated ${speed} game"]`)) continue;
	const h = (k) => g.match(new RegExp(`\\[${k} "([^"]*)"\\]`))?.[1];
	if (h('WhiteTitle') === 'BOT' || h('BlackTitle') === 'BOT') continue;
	if (!/\n1\. /.test(g)) continue;
	games.push({
		pgn: g.trim(),
		w: h('White'),
		b: h('Black'),
		we: +h('WhiteElo'),
		be: +h('BlackElo')
	});
}

// Holdout-Spieler
const byPlayer = new Map();
for (const g of games)
	for (const [n, r] of [
		[g.w, g.we],
		[g.b, g.be]
	]) {
		if (!byPlayer.has(n)) byPlayer.set(n, { games: [], ratings: [] });
		byPlayer.get(n).games.push(g);
		byPlayer.get(n).ratings.push(r);
	}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const hold = new Set();
const holdGames = new Set();
for (let band = 400; band <= 2400; band += 200) {
	const cands = shuffle(
		[...byPlayer.entries()].filter(
			([, p]) => p.games.length >= 12 && bandOf(median(p.ratings)) === band
		)
	).slice(0, HOLD_PLAYERS);
	for (const [n, p] of cands) {
		hold.add(n);
		for (const g of p.games.slice(0, HOLD_GAMES)) holdGames.add(g);
	}
}

// Eichung
const perBand = new Map();
for (const g of shuffle(games)) {
	if (hold.has(g.w) || hold.has(g.b) || Math.abs(g.we - g.be) > 150) continue;
	const band = bandOf((g.we + g.be) / 2);
	if (band < 400) continue;
	const list = perBand.get(band) ?? [];
	if (list.length < PER_BAND) list.push(g);
	perBand.set(band, list);
}
const calib = [...perBand.values()].flat();
writeFileSync(outCalib, calib.map((g) => g.pgn).join('\n\n') + '\n');
writeFileSync(outHold, [...holdGames].map((g) => g.pgn).join('\n\n') + '\n');
console.error(
	`${speed}: Eichung ${calib.length} Partien (${[...perBand.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([b, l]) => `${b}:${l.length}`)
		.join(' ')}), Holdout ${hold.size} Spieler / ${holdGames.size} Partien`
);
