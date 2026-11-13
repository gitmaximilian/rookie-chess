/**
 * Prüft die Live-Seite im iPhone-Format: lädt, kein Überlauf, neue Bausteine vorhanden.
 *   node scripts/screenshots/live-check.mjs <ausgabe.png> [url]
 */
import { webkit, devices } from '@playwright/test';
const out = process.argv[2] ?? 'live.png';
const url = process.argv[3] ?? 'https://rookie.maximilianauer.at/';
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
await ctx.addInitScript(() => {
	localStorage.setItem('rookie:onboarded', '1');
	localStorage.setItem('rookie:installDismissed', '9999999999999');
});
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
	bento: document.querySelectorAll('.bento .tile').length,
	plan: !!document.querySelector('.plan.tone-play'),
	mono: document.fonts.check('16px "IBM Plex Mono"'),
	overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
}));
console.log(JSON.stringify(r));
await p.screenshot({ path: out });
await b.close();
