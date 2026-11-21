/**
 * Bedenkzeit und Wertung: Was sagt die Uhr über die Spielstärke – und verbessert sie die Schätzung des Pentas?
 *
 *   node scripts/research/clock-study.mjs <holdout.json> <rapid|blitz|bullet> [minPartien=10] [maxPartien=30]
 *
 * Eingabe: Ausgabe von skill-study.mjs (mit %clk-Feldern) für Holdout-Spieler (skill-speed-sample.mjs oder
 * chesscom-sample.mjs). Je Spieler (≥ minPartien Partien mit Uhr):
 * - Zeitnot-Anteil: Züge mit weniger als 10 % der Grundzeit vor dem Zug
 * - Patzer pro 30 Züge (offene Stellung) in Zeitnot und ohne Zeitnot, über alle Spieler je Band gepoolt
 * - Zeitverluste je Partie und Verbrauch bis Zug 10
 * Danach: Korrelation jeder Kennzahl mit der Wertung und Kreuzvalidierung (leave-one-out) einer linearen
 * Schätzung der Wertung aus dem Penta-Gesamtniveau allein gegen Penta + Uhr. Ergebnis: docs/research-2026-11-13.md.
 */
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const [, , file, speed = 'rapid', minArg, maxArg] = process.argv;
const MING = Number(minArg ?? 10);
const MAXG = Number(maxArg ?? 30);
const root = new URL('../../', import.meta.url).pathname;
const out = await build({
	stdin: {
		contents: `export * from './src/lib/training/skills.ts'; export { tableFor } from './src/lib/training/skillTables.ts'; export { accuracy } from './src/lib/analysis/classify.ts';`,
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
const TABLE = S.tableFor(speed);
const accOf = (x) => (x[1] ? S.accuracy(Array(x[1]).fill(x[0] / x[1])) : null);

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

const by = new Map();
for (const g of JSON.parse(readFileSync(file, 'utf8')).players)
	if (g.clock) by.set(g.name, [...(by.get(g.name) ?? []), g]);

const rows = [];
for (const gs0 of by.values()) {
	const gs = gs0.slice(0, MAXG);
	if (gs.length < MING) continue;
	const c = gs.reduce(
		(s, g) => ({
			moves: s.moves + g.clock.moves,
			tt: s.tt + g.clock.tt,
			ttLive: s.ttLive + g.clock.ttLive,
			ttBl: s.ttBl + g.clock.ttBlunders,
			live: s.live + g.live,
			bl: s.bl + g.blunders,
			flagged: s.flagged + (g.clock.flagged ? 1 : 0),
			used: s.used + (g.clock.used10 ?? 0),
			usedN: s.usedN + (g.clock.used10 === null ? 0 : 1)
		}),
		{ moves: 0, tt: 0, ttLive: 0, ttBl: 0, live: 0, bl: 0, flagged: 0, used: 0, usedN: 0 }
	);
	const m = S.skillMirror(raw(gs), TABLE);
	rows.push({
		rating: gs.reduce((s, g) => s + g.rating, 0) / gs.length,
		games: gs.length,
		o: S.overallLevel(m, TABLE)?.elo ?? null,
		ttShare: c.moves ? c.tt / c.moves : 0,
		flagRate: c.flagged / gs.length,
		used10: c.usedN ? c.used / c.usedN : null,
		...c
	});
}

const corr = (pairs) => {
	const n = pairs.length;
	const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
	const my = pairs.reduce((s, p) => s + p[1], 0) / n;
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (const [x, y] of pairs) {
		sxy += (x - mx) * (y - my);
		sxx += (x - mx) ** 2;
		syy += (y - my) ** 2;
	}
	return sxx && syy ? +(sxy / Math.sqrt(sxx * syy)).toFixed(2) : null;
};

/** kleinste Quadrate mit Achsenabschnitt (Normalgleichungen, Gauß) */
function fit(X, y) {
	const A = X.map((x) => [1, ...x]);
	const k = A[0].length;
	const M = Array.from({ length: k }, (_, i) =>
		Array.from({ length: k + 1 }, (_, j) =>
			j < k ? A.reduce((s, a) => s + a[i] * a[j], 0) : A.reduce((s, a, n) => s + a[i] * y[n], 0)
		)
	);
	for (let i = 0; i < k; i++) {
		M[i][i] += i ? 1e-6 : 0;
		for (let r = 0; r < k; r++) {
			if (r === i) continue;
			const f = M[r][i] / M[i][i];
			for (let j = i; j <= k; j++) M[r][j] -= f * M[i][j];
		}
	}
	return M.map((row, i) => row[k] / row[i]);
}
const predict = (b, x) => b[0] + x.reduce((s, v, i) => s + v * b[i + 1], 0);
function loocv(feat) {
	const rs = rows.filter((r) => feat(r).every((v) => v !== null && Number.isFinite(v)));
	let ae = 0;
	for (let i = 0; i < rs.length; i++) {
		const train = rs.filter((_, j) => j !== i);
		const b = fit(
			train.map(feat),
			train.map((r) => r.rating)
		);
		ae += Math.abs(predict(b, feat(rs[i])) - rs[i].rating);
	}
	return { n: rs.length, mae: Math.round(ae / rs.length) };
}

const mean = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
console.log(`${speed}: ${rows.length} Spieler mit Uhr (je ${MING}–${MAXG} Partien)`);
console.log(
	'Raten:',
	Math.round(rows.reduce((s, r) => s + Math.abs(r.rating - mean), 0) / rows.length)
);
console.log('r mit Wertung:', {
	penta: corr(rows.filter((r) => r.o !== null).map((r) => [r.o, r.rating])),
	zeitnotAnteil: corr(rows.map((r) => [r.ttShare, r.rating])),
	zeitverluste: corr(rows.map((r) => [r.flagRate, r.rating])),
	verbrauchBisZug10: corr(rows.filter((r) => r.used10 !== null).map((r) => [r.used10, r.rating]))
});
console.log('Kreuzvalidiert (MAE):', {
	pentaRoh: (() => {
		const rs = rows.filter((r) => r.o !== null);
		return {
			n: rs.length,
			mae: Math.round(rs.reduce((s, r) => s + Math.abs(r.o - r.rating), 0) / rs.length)
		};
	})(),
	penta: loocv((r) => [r.o]),
	pentaUndUhr: loocv((r) => [r.o, r.ttShare, r.flagRate]),
	pentaUndTempo: loocv((r) => [r.o, r.used10]),
	nurTempo: loocv((r) => [r.used10]),
	nurUhr: loocv((r) => [r.ttShare, r.flagRate, r.used10])
});
console.log(
	'\nje Band: Zeitnot-Anteil · Patzer/30 ohne Zeitnot → in Zeitnot · Zeitverluste/Partie'
);
const band = (r) => Math.max(400, Math.min(2400, Math.floor(r / 400) * 400));
for (const b of [...new Set(rows.map((r) => band(r.rating)))].sort((x, y) => x - y)) {
	const rs = rows.filter((r) => band(r.rating) === b);
	const sum = (k) => rs.reduce((s, r) => s + r[k], 0);
	const normLive = sum('live') - sum('ttLive');
	const normBl = sum('bl') - sum('ttBl');
	console.log(
		`${b}+ n ${rs.length} · ${Math.round((sum('tt') / sum('moves')) * 100)} % · ${((normBl / Math.max(1, normLive)) * 30).toFixed(1)} → ${((sum('ttBl') / Math.max(1, sum('ttLive'))) * 30).toFixed(1)} (${sum('ttLive')} Züge) · ${(sum('flagged') / sum('games')).toFixed(2)} · ${Math.round((rs.filter((r) => r.used10 !== null).reduce((s, r) => s + r.used10, 0) / Math.max(1, rs.filter((r) => r.used10 !== null).length)) * 100)} %`
	);
}
const all = (k) => rows.reduce((s, r) => s + r[k], 0);
console.log(
	`alle: Patzer/30 ohne Zeitnot ${(((all('bl') - all('ttBl')) / (all('live') - all('ttLive'))) * 30).toFixed(1)} · in Zeitnot ${((all('ttBl') / all('ttLive')) * 30).toFixed(1)} · Anteil der Patzer in Zeitnot ${Math.round((all('ttBl') / all('bl')) * 100)} %`
);
{
	const rs = rows.filter((r) => r.o !== null && r.used10 !== null);
	const b = fit(
		rs.map((r) => [r.o, r.used10]),
		rs.map((r) => r.rating)
	);
	console.log(
		`Koeffizienten (alle ${rs.length}): Wertung ≈ ${b[0].toFixed(0)} + ${b[1].toFixed(3)} × Penta + ${b[2].toFixed(0)} × Verbrauch bis Zug 10`
	);
}
{
	const rs = rows.filter((r) => r.used10 !== null);
	const b = fit(
		rs.map((r) => [r.used10]),
		rs.map((r) => r.rating)
	);
	console.log(
		`nur Tempo (alle ${rs.length}): Wertung ≈ ${b[0].toFixed(0)} + ${b[1].toFixed(0)} × Verbrauch bis Zug 10`
	);
}
{
	// Umrechnung: Wertung dieser Stichprobe (z. B. Chess.com) aus dem Penta-Gesamtniveau (Lichess-Skala)
	const rs = rows.filter((r) => r.o !== null);
	const b = fit(
		rs.map((r) => [r.o]),
		rs.map((r) => r.rating)
	);
	console.log(
		`nur Penta (alle ${rs.length}): Wertung ≈ ${b[0].toFixed(0)} + ${b[1].toFixed(3)} × Penta`
	);
	const lv = rows.filter((r) => r.o !== null && r.used10 !== null);
	const blitz = (r) => 1149 + 0.564 * r.o - 3150 * r.used10;
	if (speed === 'blitz' && lv.length) {
		const b2 = fit(
			lv.map((r) => [blitz(r)]),
			lv.map((r) => r.rating)
		);
		console.log(
			`Blitz-Uhrmodell (Lichess-Skala) → diese Wertung: ≈ ${b2[0].toFixed(0)} + ${b2[1].toFixed(3)} × Niveau · r ${corr(lv.map((r) => [blitz(r), r.rating]))} · LOOCV ${JSON.stringify(loocv((r) => (r.o === null || r.used10 === null ? [null] : [blitz(r)])))}`
		);
	}
}
if (process.env.CONVERT) {
	// Prüfung einer Umrechnung Lichess → diese Skala: CONVERT="a,b" (Wertung ≈ a + b × Lichess)
	const [a, b] = process.env.CONVERT.split(',').map(Number);
	const rs = rows.filter((r) => r.o !== null);
	const mae = (f) =>
		Math.round(rs.reduce((s, r) => s + Math.abs(f(r.o) - r.rating), 0) / rs.length);
	const bias = (f) => Math.round(rs.reduce((s, r) => s + f(r.o) - r.rating, 0) / rs.length);
	console.log(
		`Umrechnung ${a} + ${b} × Lichess: MAE ${mae((o) => a + b * o)}, Verzerrung ${bias((o) => a + b * o)} · alte Pauschale (−150): MAE ${mae((o) => o - 150)}, Verzerrung ${bias((o) => o - 150)} · unverändert: MAE ${mae((o) => o)}`
	);
}
if (process.env.CONVERT) {
	const [a, b] = process.env.CONVERT.split(',').map(Number);
	for (const lo of [0, 600, 1000, 1400, 1800]) {
		const rs = rows.filter((r) => r.o !== null && r.rating >= lo && r.rating < lo + 400);
		if (!rs.length) continue;
		const bias = (f) => Math.round(rs.reduce((s, r) => s + f(r.o) - r.rating, 0) / rs.length);
		console.log(
			`  Wertung ${lo}–${lo + 399} (n ${rs.length}): Verzerrung neu ${bias((o) => a + b * o)} · alt ${bias((o) => o - 150)}`
		);
	}
}
