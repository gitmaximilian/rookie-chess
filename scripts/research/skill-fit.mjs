/**
 * Eichung des Skill-Pentas aus skill-study.mjs:
 * 1. Je Wertungsband die gepoolten Werte der fünf Fähigkeiten (monoton geglättet) → Tabelle
 *    „Fähigkeit → Elo-Entsprechung“ für lib/training/skills.ts.
 * 2. Gewichte: Wie stark trägt jede Fähigkeit zur Wertung bei? „Pseudo-Spieler“ = 8 zufällige Partien
 *    aus demselben Band (wie Rookie die letzten Partien zusammenfasst); Regression der Wertung auf die
 *    fünf Elo-Entsprechungen; negative Gewichte → 0, dann auf Summe 1 normiert.
 *
 *   node scripts/research/skill-fit.mjs skills.json
 */
import { readFileSync } from 'node:fs';

const { players } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const SKILLS = ['safety', 'tactics', 'opening', 'strategy', 'endgame'];
const accuracy = (sum, n) =>
	n ? Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * (sum / n) * 50) - 3.1669)) : null;

/** gepoolte Werte einer Menge Spieler-Partien */
function pooled(ps) {
	const s = (k) => ps.reduce((a, p) => a + p[k], 0);
	const sumN = (k) => [ps.reduce((a, p) => a + p[k][0], 0), ps.reduce((a, p) => a + p[k][1], 0)];
	const live = s('live');
	const ch = s('chances');
	return {
		// Patzer je 30 Züge in offener Stellung (weniger ist besser)
		safety: live ? (s('blunders') / live) * 30 : null,
		tactics: ch ? (s('taken') / ch) * 100 : null,
		opening: accuracy(...sumN('opening')),
		strategy: accuracy(...sumN('strategy')),
		endgame: accuracy(...sumN('endgame')),
		n: {
			live,
			ch,
			opening: sumN('opening')[1],
			strategy: sumN('strategy')[1],
			endgame: sumN('endgame')[1]
		}
	};
}

const bandOf = (r) => (r >= 2600 ? 2600 : Math.floor(r / 200) * 200);
const bands = [...new Set(players.map((p) => bandOf(p.rating)))].sort((a, b) => a - b);
const table = bands.map((b) => {
	const ps = players.filter((p) => bandOf(p.rating) === b);
	return {
		r: Math.round(ps.reduce((a, p) => a + p.rating, 0) / ps.length),
		count: ps.length,
		...pooled(ps)
	};
});

/** monoton glätten (Pool Adjacent Violators): Sicherheit fallend, alles andere steigend */
function isotonic(xs, increasing) {
	const v = increasing ? [...xs] : xs.map((x) => -x);
	const blocks = v.map((x) => ({ sum: x, n: 1 }));
	for (let i = 0; i < blocks.length - 1;) {
		if (blocks[i].sum / blocks[i].n > blocks[i + 1].sum / blocks[i + 1].n) {
			blocks[i] = { sum: blocks[i].sum + blocks[i + 1].sum, n: blocks[i].n + blocks[i + 1].n };
			blocks.splice(i + 1, 1);
			if (i > 0) i--;
		} else i++;
	}
	const out = blocks.flatMap((b) => Array(b.n).fill(b.sum / b.n));
	return increasing ? out : out.map((x) => -x);
}
const smooth = {};
for (const k of SKILLS)
	smooth[k] = isotonic(
		table.map((t) => t[k]),
		k !== 'safety'
	);

console.log(
	'| Band (Mittel) | Spieler-Partien | Patzer/30 | Chancen genutzt % | Eröffnung % | Strategie % | Endspiel % |'
);
console.log('|---|---|---|---|---|---|---|');
table.forEach((t, i) =>
	console.log(
		`| ${bands[i]}${bands[i] === 2600 ? '+' : ''} (${t.r}) | ${t.count} | ${t.safety.toFixed(2)} | ${t.tactics.toFixed(1)} | ${t.opening.toFixed(1)} | ${t.strategy.toFixed(1)} | ${t.endgame.toFixed(1)} |`
	)
);

/** Elo-Entsprechung eines Werts (linear zwischen den Bändern, außen begrenzt) */
function eqOf(k, v) {
	const xs = smooth[k];
	const rs = table.map((t) => t.r);
	const inc = k !== 'safety';
	const at = (i) => xs[i];
	if (inc ? v <= at(0) : v >= at(0)) return rs[0];
	if (inc ? v >= at(xs.length - 1) : v <= at(xs.length - 1)) return rs[rs.length - 1];
	for (let i = 1; i < xs.length; i++) {
		const a = at(i - 1);
		const b = at(i);
		if ((v - a) * (v - b) <= 0 && a !== b)
			return rs[i - 1] + ((v - a) / (b - a)) * (rs[i] - rs[i - 1]);
	}
	return rs[rs.length - 1];
}

// ── Pseudo-Spieler und Regression ──
let seed = 77;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rows = [];
for (const b of bands) {
	const ps = players.filter((p) => bandOf(p.rating) === b);
	for (let k = 0; k < 400; k++) {
		const pick = Array.from({ length: 8 }, () => ps[Math.floor(rnd() * ps.length)]);
		const m = pooled(pick);
		if (SKILLS.some((s) => m[s] === null)) continue;
		rows.push({
			y: pick.reduce((a, p) => a + p.rating, 0) / 8,
			x: SKILLS.map((s) => eqOf(s, m[s]))
		});
	}
}
function ols(X, y) {
	const k = X[0].length;
	const A = Array.from({ length: k }, () => Array(k).fill(0));
	const v = Array(k).fill(0);
	X.forEach((r, i) =>
		r.forEach((a, p) => {
			v[p] += a * y[i];
			r.forEach((b, q) => (A[p][q] += a * b));
		})
	);
	for (let i = 0; i < k; i++) {
		for (let r = i + 1; r < k; r++) {
			const f = A[r][i] / A[i][i];
			for (let c = i; c < k; c++) A[r][c] -= f * A[i][c];
			v[r] -= f * v[i];
		}
	}
	const beta = Array(k).fill(0);
	for (let i = k - 1; i >= 0; i--) {
		let s = v[i];
		for (let c = i + 1; c < k; c++) s -= A[i][c] * beta[c];
		beta[i] = s / A[i][i];
	}
	return beta;
}
const r2 = (X, y, beta) => {
	const pred = X.map((r) => r.reduce((s, v, i) => s + v * beta[i], 0));
	const m = y.reduce((a, b) => a + b, 0) / y.length;
	const tot = y.reduce((s, v) => s + (v - m) ** 2, 0);
	return 1 - y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0) / tot;
};
const X = rows.map((r) => [1, ...r.x]);
const y = rows.map((r) => r.y);
const beta = ols(X, y);
console.log(
	`\nRegression (Pseudo-Spieler aus 8 Partien, n = ${rows.length}): R² = ${r2(X, y, beta).toFixed(3)}`
);
SKILLS.forEach((s, i) => {
	const Xi = rows.map((r) => [1, r.x[i]]);
	const bi = ols(Xi, y);
	console.log(
		`  ${s}: Koeffizient ${beta[i + 1].toFixed(3)}, allein R² = ${r2(Xi, y, bi).toFixed(3)}`
	);
});
const pos = beta.slice(1).map((b) => Math.max(0, b));
const sum = pos.reduce((a, b) => a + b, 0);
const weights = Object.fromEntries(
	SKILLS.map((s, i) => [s, Math.round((pos[i] / sum) * 100) / 100])
);
console.log('Gewichte (normiert):', JSON.stringify(weights));

// ── Verlust pro Zug je Kategorie und Elo pro Prozentpunkt verlorener Gewinnchance ──
const perMove = bands.map((b) => {
	const ps = players.filter((p) => bandOf(p.rating) === b);
	const sum = (k, f) => ps.reduce((a, p) => a + p[f][k], 0);
	return Object.fromEntries(
		SKILLS.map((k) => [k, (sum(k, 'lost') / Math.max(1, sum(k, 'cnt'))) * 100])
	);
});
const perGameCnt = bands.map((b) => {
	const ps = players.filter((p) => bandOf(p.rating) === b);
	return Object.fromEntries(
		SKILLS.map((k) => [k, ps.reduce((a, p) => a + p.cnt[k], 0) / ps.length])
	);
});
const lpm = {};
for (const k of SKILLS)
	lpm[k] = isotonic(
		perMove.map((t) => t[k]),
		false
	);
// Gesamtverlust je Partie eines typischen Spielers (gleiche Zugzahlen für alle Bänder: Mittel)
const meanCnt = Object.fromEntries(
	SKILLS.map((k) => [k, perGameCnt.reduce((a, c) => a + c[k], 0) / perGameCnt.length])
);
const Ltot = table.map((_, i) => SKILLS.reduce((a, k) => a + lpm[k][i] * meanCnt[k], 0));
// Elo ≈ A + B · ln(Ltot): glatte Abhängigkeit, Ableitung dElo/dL = B / L
const lx = Ltot.map((l) => Math.log(l));
const mx = lx.reduce((a, b) => a + b, 0) / lx.length;
const my = table.reduce((a, t) => a + t.r, 0) / table.length;
const B =
	lx.reduce((a, x, i) => a + (x - mx) * (table[i].r - my), 0) /
	lx.reduce((a, x) => a + (x - mx) ** 2, 0);
const A = my - B * mx;
console.log(
	'\nVerlust pro Zug (Prozentpunkte Gewinnchance), monoton geglättet, und Züge je Partie:'
);
console.log(
	'| Band | Sicherheit | Taktik | Eröffnung | Strategie | Endspiel | Verlust je Partie |'
);
console.log('|---|---|---|---|---|---|---|');
table.forEach((t, i) =>
	console.log(
		`| ${t.r} | ${SKILLS.map((k) => lpm[k][i].toFixed(2)).join(' | ')} | ${Ltot[i].toFixed(1)} |`
	)
);
console.log(
	`Züge je Partie (Mittel): ${SKILLS.map((k) => `${k} ${meanCnt[k].toFixed(1)}`).join(', ')}`
);
console.log(`Elo ≈ ${A.toFixed(0)} + ${B.toFixed(1)} · ln(Verlust je Partie)`);
console.log('Anteil am Unterschied zum nächsten Band:');
for (let i = 0; i + 1 < table.length; i++) {
	const d = SKILLS.map((k) => (lpm[k][i] - lpm[k][i + 1]) * meanCnt[k]);
	const tot = d.reduce((a, b) => a + b, 0) || 1;
	console.log(
		`${table[i].r} → ${table[i + 1].r}: ` +
			SKILLS.map((k, j) => `${k} ${Math.round((d[j] / tot) * 100)} %`).join(', ')
	);
}
console.log(`\nLOSS_MODEL = ${JSON.stringify({ A: +A.toFixed(1), B: +B.toFixed(1) })}`);

// ── für lib/training/skills.ts ──
console.log('\nTabelle für skills.ts:');
console.log(
	JSON.stringify(
		table.map((t, i) => ({
			r: t.r,
			safety: +smooth.safety[i].toFixed(2),
			tactics: +smooth.tactics[i].toFixed(1),
			opening: +smooth.opening[i].toFixed(1),
			strategy: +smooth.strategy[i].toFixed(1),
			endgame: +smooth.endgame[i].toFixed(1),
			lpm: Object.fromEntries(SKILLS.map((k) => [k, +lpm[k][i].toFixed(3)]))
		}))
	)
);
