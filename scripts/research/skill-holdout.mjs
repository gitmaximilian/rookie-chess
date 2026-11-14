/**
 * Holdout-Prüfung des Skill-Pentas: Wie genau trifft der App-Code (lib/training/skills.ts) die echte Wertung
 * von Spielern, deren Partien NICHT in der Eichung stecken?
 *
 * 1. Spieler mit vielen Rapid/Classical-Partien aus der Lichess-Datenbank wählen (je Band 400–2400 gleich
 *    viele), ihre Partien als PGN sammeln, Spieler aus den Eichdaten ausschließen.
 * 2. node scripts/research/skill-study.mjs holdout.pgn > holdout.json
 * 3. node scripts/research/skill-holdout.mjs holdout.json [maxPartien=30] [minPartien=10]
 *
 * Bündelt skills.ts mit esbuild (dieselbe Logik wie in der App: skillMirror, overallLevel) und fasst die
 * Partien je Spieler zusammen wie collectSkills. Ausgabe: r, mittlerer Fehler (MAE) und Verzerrung je Ecke
 * und gesamt, dazu „Raten“ (immer den Mittelwert) als Vergleich. Ergebnis 14.11.2026: docs/research-2026-11-13.md.
 */
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const [, , file, maxArg, minArg] = process.argv;
const MAXG = Number(maxArg ?? 30);
const MING = Number(minArg ?? 10);
const root = new URL('../../', import.meta.url).pathname;
const out = await build({
	stdin: {
		contents: `export * from './src/lib/training/skills.ts'; export { accuracy } from './src/lib/analysis/classify.ts';`,
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

const games = JSON.parse(readFileSync(file, 'utf8')).players;
const by = new Map();
for (const g of games) by.set(g.name, [...(by.get(g.name) ?? []), g]);
const accOf = (x) => (x[1] ? S.accuracy(Array(x[1]).fill(x[0] / x[1])) : null);

/** Partien eines Spielers zusammenfassen – wie collectSkills */
function raw(gs) {
	const a = { live: 0, blunders: 0, chances: 0, taken: 0 };
	const ph = { opening: [0, 0], strategy: [0, 0], endgame: [0, 0] };
	const per = { safety: [], tactics: [], opening: [], strategy: [], endgame: [] };
	const cnt = { safety: 0, tactics: 0, opening: 0, strategy: 0, endgame: 0 };
	for (const g of gs) {
		for (const k of Object.keys(a)) a[k] += g[k];
		for (const k of Object.keys(ph)) {
			ph[k][0] += g[k][0];
			ph[k][1] += g[k][1];
			if (g[k][1] >= 5) per[k].push(accOf(g[k]));
		}
		if (g.live >= 10) per.safety.push((g.blunders / g.live) * 30);
		if (g.chances >= 2) per.tactics.push((g.taken / g.chances) * 100);
		for (const k of Object.keys(cnt)) cnt[k] += g.cnt[k];
	}
	const s = (value, n, perGame) => ({ value, n, perGame });
	return {
		games: gs.length,
		perGameCount: Object.fromEntries(Object.keys(cnt).map((k) => [k, cnt[k] / gs.length])),
		blunderShare: { opening: null, endgame: null },
		safety: s(a.live ? (a.blunders / a.live) * 30 : null, a.live, per.safety),
		tactics: s(a.chances ? (a.taken / a.chances) * 100 : null, a.chances, per.tactics),
		opening: s(accOf(ph.opening), ph.opening[1], per.opening),
		strategy: s(accOf(ph.strategy), ph.strategy[1], per.strategy),
		endgame: s(accOf(ph.endgame), ph.endgame[1], per.endgame)
	};
}

const rows = [];
for (const gs0 of by.values()) {
	const gs = gs0.slice(0, MAXG);
	if (gs.length < MING) continue;
	const m = S.skillMirror(raw(gs));
	rows.push({
		rating: gs.reduce((s, g) => s + g.rating, 0) / gs.length,
		m,
		o: S.overallLevel(m)
	});
}
function stat(pairs) {
	const n = pairs.length;
	if (n < 3) return '–';
	const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
	const my = pairs.reduce((s, p) => s + p[1], 0) / n;
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	let ae = 0;
	let bias = 0;
	for (const [x, y] of pairs) {
		sxy += (x - mx) * (y - my);
		sxx += (x - mx) ** 2;
		syy += (y - my) ** 2;
		ae += Math.abs(x - y);
		bias += x - y;
	}
	const r = sxx && syy ? (sxy / Math.sqrt(sxx * syy)).toFixed(2) : '–';
	return `n ${n} · r ${r} · MAE ${Math.round(ae / n)} · Verzerrung ${Math.round(bias / n)}`;
}
const mean = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
console.log(`Spieler: ${rows.length} (je ${MING}–${MAXG} Partien)`);
console.log('Raten (Mittelwert):', stat(rows.map((r) => [mean, r.rating])));
console.log('Gesamt:', stat(rows.filter((r) => r.o).map((r) => [r.o.elo, r.rating])));
for (const k of S.SKILLS)
	console.log(
		`${k}:`,
		stat(
			rows.map((r) => [r.m.find((x) => x.skill === k).elo, r.rating]).filter((p) => p[0] !== null)
		)
	);
