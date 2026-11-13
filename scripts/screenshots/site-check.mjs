/** Prüft Projektseiten der Website: Bilder geladen, Rookie-Status, kein Überlauf (EN/DE, Handy/Desktop). */
import { webkit } from '@playwright/test';
const base = process.argv[2];
const out = process.argv[3];
const b = await webkit.launch();
let bad = 0;
for (const [w, h] of [
	[390, 844],
	[1280, 800]
]) {
	const p = await b.newPage({ viewport: { width: w, height: h } });
	for (const path of ['/projects/', '/projects/rookie/'])
		for (const lang of ['en', 'de']) {
			await p.goto(`${base}${path}?lang=${lang}`, { waitUntil: 'networkidle' });
			await p.evaluate(async () => {
				for (const i of document.images) i.loading = 'eager';
				window.scrollTo(0, document.body.scrollHeight);
				await new Promise((r) => setTimeout(r, 600));
				window.scrollTo(0, 0);
			});
			await p.waitForTimeout(500);
			const r = await p.evaluate(() => ({
				broken: [...document.images]
					.filter((i) => i.src.includes('rookie') && !(i.complete && i.naturalWidth))
					.map((i) => i.src),
				status: document.querySelector('[data-copy="cardStatusRookie"]')?.textContent ?? null,
				rk4: document.querySelector('[data-copy="rkP4"]')?.textContent?.slice(0, 50) ?? null,
				overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
			}));
			if (r.broken.length || r.overflow) bad++;
			console.log(w, path, lang, JSON.stringify(r));
			if (out)
				await p.screenshot({
					path: `${out}/${w}${path.replace(/\//g, '_')}${lang}.png`,
					fullPage: true
				});
		}
	await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
