/**
 * Prüft die Kontraste der Pastell-Tokens (WCAG 2.1): node scripts/contrast.mjs
 * Text ≥ 4,5:1, große Zahlen ≥ 3:1. Liest die Werte direkt aus src/app.css.
 */
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
const block = (start) => {
	const i = css.indexOf(start);
	const j = css.indexOf('}', i);
	return css.slice(i, j);
};
const vars = (s) =>
	Object.fromEntries([...s.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
	const c = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};
const AREAS = ['play', 'games', 'coach', 'puzzle', 'learn', 'stars'];
let fail = 0;
for (const [mode, sel] of [
	['hell', ':root {'],
	['dunkel', ":root[data-theme='dark'] {"]
]) {
	const v = { ...vars(block(':root {')), ...(mode === 'dunkel' ? vars(block(sel)) : {}) };
	console.log(`\n${mode}`);
	for (const a of AREAS) {
		const bg = v[`tile-${a}`];
		const checks = [
			['Text', v['tile-text'], 4.5],
			['Ink (Label)', v[`tile-${a}-ink`], 4.5],
			['Text-2', v['tile-text-2'], 4.5],
			['Gut', v['good-text'], 4.5],
			['Schlecht', v['bad-text'], 4.5],
			['Warnung', v['warn-text'], 4.5]
		];
		const row = checks.map(([n, fg, min]) => {
			const r = ratio(fg, bg);
			if (r < min) fail++;
			return `${n} ${r.toFixed(2)}${r < min ? ' ✗' : ''}`;
		});
		console.log(`  ${a.padEnd(7)} ${bg}  ${row.join(' · ')}`);
	}
	for (const n of ['text-2', 'text-3']) {
		for (const s of ['bg', 'surface']) {
			const r = ratio(v[n], v[s]);
			if (r < 4.5) fail++;
			console.log(`  ${n} auf ${s}: ${r.toFixed(2)}${r < 4.5 ? ' ✗' : ''}`);
		}
	}
	// Glas-Kapsel: 88 % deckend – schlimmster Fall ist weißer Inhalt dahinter
	const mix = (hex, a) => {
		const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
		return (
			'#' +
			c
				.map((x) =>
					Math.round(x * a + 255 * (1 - a))
						.toString(16)
						.padStart(2, '0')
				)
				.join('')
		);
	};
	const glass = ratio(v['tabbar-fg'], mix(v['tabbar-bg'], 0.88));
	if (glass < 4.5) fail++;
	console.log(`  Tab-Kapsel (Glas über Weiß): ${glass.toFixed(2)}`);
	const tb = ratio(v['tabbar-fg'], v['tabbar-bg']);
	const ta = ratio(v['tabbar-active-fg'], v['tabbar-active-bg']);
	if (tb < 4.5 || ta < 4.5) fail++;
	console.log(`  Tab-Leiste: inaktiv ${tb.toFixed(2)} · aktiv ${ta.toFixed(2)}`);
}
if (fail) {
	// siehe oben
}
console.log(fail ? `\n${fail} Verstöße` : '\nalle Kontraste ok');
process.exit(fail ? 1 : 0);
