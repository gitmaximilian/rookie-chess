/** Live-Prüfung: Spiel mit Coach starten, Kommentar oben, Brett frei, kein Überlauf (iPhone). */
import { webkit, devices } from '@playwright/test';
const out = process.argv[2] ?? 'live-play.png';
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
await ctx.addInitScript(() => {
	localStorage.setItem('rookie:onboarded', '1');
	localStorage.setItem('rookie:installDismissed', '9999999999999');
});
const p = await ctx.newPage();
await p.goto('https://chess.maximilianauer.at/play', { waitUntil: 'networkidle' });
await p
	.getByRole('button', { name: /Start game|Partie starten/ })
	.first()
	.click();
await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
	const box = (s) => {
		const e = document.querySelector(s)?.getBoundingClientRect();
		return e ? [Math.round(e.top), Math.round(e.bottom)] : null;
	};
	return {
		bar: box('[data-testid="coach-bar"]'),
		board: box('.cg-host'),
		dock: box('.dock-root'),
		tab: box('.tabbar'),
		overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
	};
});
console.log(JSON.stringify(r));
await p.screenshot({ path: out });
await b.close();
