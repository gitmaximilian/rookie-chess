/**
 * Screenshots aller wichtigen Seiten mit Testdaten (fixture.json), hell und dunkel,
 * in mehreren Größen – und Prüfung auf horizontalen Überlauf.
 *
 *   npm run build && npm run preview -- --port 4173 &
 *   node scripts/screenshots/shoot.mjs <ausgabeordner> [--lang=en|de] [--sizes=393x659,...]
 *        [--routes=/,/coach] [--themes=light,dark] [--scale=1] [--base=http://localhost:4173]
 *
 * Gibt am Ende alle Seiten mit Überlauf aus (scrollWidth > clientWidth) und beendet sich dann mit Code 1.
 */
import { webkit } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
	process.argv
		.slice(3)
		.filter((a) => a.startsWith('--'))
		.map((a) => {
			const i = a.indexOf('=');
			return i < 0 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)];
		})
);
const out = process.argv[2] ?? 'screens';
const base = args.base ?? 'http://localhost:4173';
const lang = args.lang ?? 'de';
const scale = Number(args.scale ?? 1);
const sizes = (args.sizes ?? '393x659,393x852,820x1180,1280x800').split(',').map((s) => {
	const [w, h] = s.split('x').map(Number);
	return { w, h };
});
const themes = (args.themes ?? 'light,dark').split(',');
const DEFAULT_ROUTES = [
	'/',
	'/coach',
	'/profile',
	'/analysis',
	'/analysis?game=32',
	'/learn',
	'/learn/openings',
	'/puzzles',
	'/play',
	'/settings'
];
const routes = args.routes ? args.routes.split(',') : DEFAULT_ROUTES;
const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
// --playing=1: laufende Partie gegen Tina (für das Play-Bild)
if (args.playing === '1') {
	const g = fixture.games.find((x) => x.myColor === 'white');
	fixture.settings.currentGame = {
		botId: 'tina',
		myColor: 'white',
		moves: g.moves.slice(0, 14),
		startFen: g.startFen,
		tc: null,
		clocks: null,
		hints: 0,
		undos: 0,
		coach: true
	};
}

mkdirSync(out, { recursive: true });

/** Testdaten direkt in IndexedDB schreiben (Dexie-Datenbank „rookie“) */
async function seed(page) {
	await page.goto(base + '/');
	await page.waitForFunction(async () =>
		(await indexedDB.databases()).some((d) => d.name === 'rookie')
	);
	await page.waitForTimeout(800);
	for (let attempt = 0; ; attempt++) {
		try {
			await page.evaluate(async (f) => {
				const shift = Date.now() - f.createdAt;
				// warten, bis die App ihr Schema angelegt hat
				let db;
				for (let k = 0; k < 50; k++) {
					db = await new Promise((res, rej) => {
						const r = indexedDB.open('rookie');
						r.onsuccess = () => res(r.result);
						r.onerror = () => rej(r.error);
					});
					if (db.objectStoreNames.contains('games')) break;
					db.close();
					await new Promise((r) => setTimeout(r, 100));
				}
				const put = (store, rows) =>
					new Promise((res, rej) => {
						const tx = db.transaction(store, 'readwrite');
						const os = tx.objectStore(store);
						os.clear();
						for (const row of rows) os.put(row);
						tx.oncomplete = res;
						tx.onerror = () => rej(tx.error);
					});
				const at = (t) => t + shift;
				await put(
					'games',
					f.games.map((g, i) => ({ ...g, id: i + 1, date: at(g.date) }))
				);
				await put(
					'puzzleAttempts',
					f.puzzleAttempts.map((a, i) => ({ ...a, id: i + 1, date: at(a.date) }))
				);
				await put(
					'ratings',
					f.ratings.map((a, i) => ({ ...a, id: i + 1, date: at(a.date) }))
				);
				await put('activity', f.activity);
				await put('endgames', f.endgames);
				await put(
					'settings',
					Object.entries(f.settings).map(([key, value]) => ({ key, value, t: Date.now() }))
				);
				db.close();
			}, fixture);
			break;
		} catch (e) {
			if (attempt > 5) throw e;
			await page.waitForTimeout(500);
		}
	}
}

const browser = await webkit.launch();
const overflow = [];
for (const theme of themes) {
	for (const { w, h } of sizes) {
		const ctx = await browser.newContext({
			viewport: { width: w, height: h },
			deviceScaleFactor: scale,
			isMobile: w < 768,
			hasTouch: w < 1024,
			colorScheme: theme,
			locale: lang === 'de' ? 'de-AT' : 'en-US'
		});
		await ctx.addInitScript(
			([l, th]) => {
				localStorage.setItem('rookie:onboarded', '1');
				localStorage.setItem('rookie:installDismissed', '9999999999999');
				localStorage.setItem('rookie:lang', l);
				localStorage.setItem('rookie:theme', th);
			},
			[lang, theme]
		);
		const page = await ctx.newPage();
		await seed(page);
		for (const r of routes) {
			await page.goto(base + r);
			await page.waitForLoadState('networkidle').catch(() => {});
			await page.waitForTimeout(r.includes('game=') ? 2500 : 1200);
			// --press=N: in einer Partie N Züge vorspulen (Pfeil rechts)
			if (args.press && r.includes('game=')) {
				for (let k = 0; k < Number(args.press); k++) await page.keyboard.press('ArrowRight');
				await page.waitForTimeout(800);
			}
			const o = await page.evaluate(() => ({
				sw: document.documentElement.scrollWidth,
				cw: document.documentElement.clientWidth
			}));
			if (o.sw > o.cw) overflow.push(`${theme} ${w}x${h} ${r}: ${o.sw} > ${o.cw}`);
			const name = args.names
				? `${args.names.split(',')[routes.indexOf(r)]}-${theme}.png`
				: `${(r === '/' ? 'home' : r.slice(1)).replace(/[/?=&]/g, '_')}-${w}x${h}-${theme}.png`;
			await page.screenshot({ path: join(out, name), fullPage: args.full === '1' });
		}
		await ctx.close();
	}
}
await browser.close();
if (overflow.length) {
	console.log('Horizontaler Überlauf:\n' + overflow.join('\n'));
	process.exit(1);
}
console.log('fertig, kein Überlauf:', out);
