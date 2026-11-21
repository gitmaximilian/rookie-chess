/**
 * Wie stark schwankt das Spielniveau (coachHistory.ts `playingLevel`, 15 Partien) zufällig?
 *
 *   node scripts/research/level-noise.mjs <hold30.json> [Fenster=15] [Ziehungen=200]
 *
 * Eingabe: skill-study.mjs-Ausgabe für Spieler mit ≥ 30 Rapid-Partien in einem Monat (skill-speed-sample.mjs mit
 * HOLD_MIN=30 HOLD_GAMES=30). Innerhalb eines Monats ändert sich die Wertung kaum – Unterschiede zwischen zwei
 * Fenstern desselben Spielers sind also Messschwankung. Je Spieler werden die 30 Partien viele Male zufällig in
 * zwei Fenster geteilt; ausgegeben wird die Streuung der Differenz (Standardabweichung) und daraus die Schwelle,
 * ab der eine Veränderung zwischen zwei Fenstern mehr als Zufall ist (95 %).
 *
 *   node scripts/research/level-noise.mjs --ratings <rapid.pgn>
 *
 * Dasselbe für die Wertung: Spieler mit ≥ 31 Partien (zeitlich geordnet wie die Lichess-Datenbank), ohne
 * Einstufung (kein Sprung > 40); Änderung über 15 und 30 Partien. Ergebnis 21.11.2026: Wertung ±47 (95 %) über
 * 15 Partien, Spielniveau ±650 – deshalb urteilt „Wirkt es?“ (coachHistory.ts `ratingChange`) nach der Wertung.
 */
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const [, , file, winArg, drawArg] = process.argv;
const q95 = (xs) => xs.map(Math.abs).sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];
const sdOf = (xs) => {
	const m = xs.reduce((s, x) => s + x, 0) / xs.length;
	return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};
if (file === '--ratings') {
	const series = new Map();
	for (const g of readFileSync(winArg, 'utf8').split('\n\n[Event ')) {
		const h = (k) => g.match(new RegExp(`\\[${k} "([^"]+)"`))?.[1];
		if (h('WhiteTitle') === 'BOT' || h('BlackTitle') === 'BOT') continue;
		for (const [n, r] of [
			[h('White'), h('WhiteElo')],
			[h('Black'), h('BlackElo')]
		])
			if (n && r) series.set(n, [...(series.get(n) ?? []), Number(r)]);
	}
	const d15 = [];
	const d30 = [];
	for (const r of series.values()) {
		if (r.length < 31) continue;
		if (r.slice(0, 31).some((x, i) => i && Math.abs(x - r[i - 1]) > 40)) continue;
		d15.push(r[15] - r[0], r[30] - r[15]);
		d30.push(r[30] - r[0]);
	}
	console.log(`Spieler: ${d30.length}`);
	console.log(`Wertung über 15 Partien: SD ${Math.round(sdOf(d15))}, 95 % innerhalb ±${q95(d15)}`);
	console.log(`Wertung über 30 Partien: SD ${Math.round(sdOf(d30))}, 95 % innerhalb ±${q95(d30)}`);
	process.exit(0);
}
const WIN = Number(winArg ?? 15);
const DRAWS = Number(drawArg ?? 200);
const root = new URL('../../', import.meta.url).pathname;
const out = await build({
	stdin: {
		contents: `export * from './src/lib/training/skills.ts';`,
		resolveDir: root,
		loader: 'ts'
	},
	bundle: true,
	write: false,
	format: 'esm',
	platform: 'node',
	loader: { '.svelte': 'empty' },
	alias: { '#lib': root + 'src/lib' },
	plugins: [
		{
			name: 'i18n-stub',
			setup(b) {
				b.onResolve({ filter: /i18n\.svelte/ }, () => ({ path: 'i18n', namespace: 'stub' }));
				b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
					contents: 'export const t = (k) => k; export const i18n = { lang: "en" };'
				}));
			}
		}
	]
});
const S = await import(
	'data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')
);

let seed = 99;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = (xs) => {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};
const level = (gs) => {
	const raw = S.poolSkills(gs.map((g) => ({ ...g, blunderLoss: { opening: 0, endgame: 0 } })));
	return S.overallLevel(S.skillMirror(raw))?.elo ?? null;
};

const by = new Map();
for (const g of JSON.parse(readFileSync(file, 'utf8')).players)
	by.set(g.name, [...(by.get(g.name) ?? []), g]);
const diffs = [];
const perPlayer = [];
for (const gs of by.values()) {
	if (gs.length < 2 * WIN) continue;
	const own = [];
	for (let k = 0; k < DRAWS; k++) {
		const s = shuffle(gs).slice(0, 2 * WIN);
		const a = level(s.slice(0, WIN));
		const b = level(s.slice(WIN));
		if (a !== null && b !== null) own.push(a - b);
	}
	if (own.length < DRAWS / 2) continue;
	diffs.push(...own);
	perPlayer.push(Math.sqrt(own.reduce((s, x) => s + x * x, 0) / own.length));
}
const sd = Math.sqrt(diffs.reduce((s, x) => s + x * x, 0) / diffs.length);
const qq = q95(diffs);
console.log(`Spieler: ${perPlayer.length}, Fenster ${WIN} Partien, ${DRAWS} Teilungen je Spieler`);
console.log(`Streuung der Differenz zweier Fenster: SD ${Math.round(sd)} Elo`);
console.log(`95 % der zufälligen Differenzen liegen innerhalb ±${Math.round(qq)} Elo`);
console.log(
	`SD je Spieler: Median ${Math.round(perPlayer.sort((a, b) => a - b)[perPlayer.length >> 1])}`
);
