/**
 * Fittet die Partie-Elo aus performance-study.mjs: Wertung ≈ a + b · Genauigkeit + c · Patzer/30.
 *
 *   node scripts/research/performance-fit.mjs perf.json
 *
 * Gibt Koeffizienten, R², Reststreuung (Standardabweichung einer Einzelpartie) und eine Tabelle
 * Genauigkeit → Wertung je Band aus. Die Koeffizienten übernimmt lib/analysis/report.ts.
 */
import { readFileSync } from 'node:fs';

const { players, depth } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const xs = players.filter((p) => p.moves >= 15);

/** kleinste Quadrate für y = X·β (Normalgleichungen, kleine Dimension) */
function ols(X, y) {
	const k = X[0].length;
	const A = Array.from({ length: k }, () => Array(k).fill(0));
	const b = Array(k).fill(0);
	for (let i = 0; i < X.length; i++)
		for (let r = 0; r < k; r++) {
			b[r] += X[i][r] * y[i];
			for (let c = 0; c < k; c++) A[r][c] += X[i][r] * X[i][c];
		}
	// Gauß-Elimination
	for (let i = 0; i < k; i++) {
		let m = i;
		for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
		[A[i], A[m]] = [A[m], A[i]];
		[b[i], b[m]] = [b[m], b[i]];
		for (let r = i + 1; r < k; r++) {
			const f = A[r][i] / A[i][i];
			for (let c = i; c < k; c++) A[r][c] -= f * A[i][c];
			b[r] -= f * b[i];
		}
	}
	const beta = Array(k).fill(0);
	for (let i = k - 1; i >= 0; i--) {
		let s = b[i];
		for (let c = i + 1; c < k; c++) s -= A[i][c] * beta[c];
		beta[i] = s / A[i][i];
	}
	return beta;
}

function report(name, feats) {
	const X = xs.map(feats);
	const y = xs.map((p) => p.rating);
	const beta = ols(X, y);
	const pred = X.map((r) => r.reduce((s, v, i) => s + v * beta[i], 0));
	const mean = y.reduce((a, b) => a + b, 0) / y.length;
	const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0);
	const res = y.map((v, i) => v - pred[i]);
	const ssRes = res.reduce((s, v) => s + v * v, 0);
	const sd = Math.sqrt(ssRes / (y.length - beta.length));
	console.log(
		`${name}: β = [${beta.map((b) => b.toFixed(3)).join(', ')}], R² = ${(1 - ssRes / ssTot).toFixed(3)}, ` +
			`Reststreuung (1 Partie) = ${Math.round(sd)}, n = ${y.length}`
	);
	return { beta, sd };
}

console.log(`Tiefe ${depth}, ${xs.length} Spieler-Partien mit ≥ 15 Zügen`);
const m1 = report('Genauigkeit', (p) => [1, p.accuracy]);
const m2 = report('Genauigkeit + Patzer/30', (p) => [1, p.accuracy, p.per30.b]);
const m3 = report('Genauigkeit + Patzer/30 + Fehler/30', (p) => [
	1,
	p.accuracy,
	p.per30.b,
	p.per30.m
]);

// Mittelwerte je Band (Plausibilität)
const bands = [...new Set(xs.map((p) => Math.floor(p.rating / 200) * 200))].sort((a, b) => a - b);
console.log(
	'\n| Band | n | Genauigkeit (Mittel) | Patzer/30 | Patzer/30 nachsichtig | Fehler/30 | Ungenauigkeiten/30 |'
);
console.log('|---|---|---|---|---|---|---|');
for (const b of bands) {
	const g = xs.filter((p) => Math.floor(p.rating / 200) * 200 === b);
	const avg = (f) => (g.reduce((s, p) => s + f(p), 0) / g.length).toFixed(1);
	console.log(
		`| ${b}–${b + 199} | ${g.length} | ${avg((p) => p.accuracy)} | ${avg((p) => p.per30.b)} | ${avg((p) => p.lenient30.b)} | ${avg((p) => p.per30.m)} | ${avg((p) => p.per30.i)} |`
	);
}
// Reststreuung über mehrere Partien (Mittel aus n Partien) – Näherung sd/√n
console.log(
	`\nSpanne (±1 SD) Einzelpartie ≈ ±${Math.round(m2.sd)}; Mittel aus 5 Partien ≈ ±${Math.round(m2.sd / Math.sqrt(5))}`
);
console.log(JSON.stringify({ m1, m2, m3 }));
