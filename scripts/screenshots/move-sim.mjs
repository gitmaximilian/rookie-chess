/**
 * Simuliert den Umzug chess.maximilianauer.at → rookie.maximilianauer.at lokal:
 * beide Adressen werden per Playwright auf den Vorschau-Server umgeleitet (mit den Headern aus static/_headers).
 *   node scripts/screenshots/move-sim.mjs [webkit|chromium]
 */
import { webkit, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const engine = process.argv[2] === 'chromium' ? chromium : webkit;
const base = 'http://localhost:4173';
const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const browser = await engine.launch();
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 393, height: 852 } });
await ctx.route(/https:\/\/(chess|rookie)\.maximilianauer\.at\/.*/, async (route) => {
	const u = new URL(route.request().url());
	const path = u.pathname === '/move-out' ? '/move-out.html' : u.pathname;
	const res = await fetch(base + path + u.search);
	const headers = Object.fromEntries(res.headers);
	delete headers['content-encoding'];
	delete headers['content-length'];
	// wie static/_headers
	if (!/^\/move-(in|out)/.test(u.pathname)) {
		headers['cross-origin-opener-policy'] = 'same-origin';
		headers['cross-origin-embedder-policy'] = 'require-corp';
	} else {
		delete headers['cross-origin-opener-policy'];
		delete headers['cross-origin-embedder-policy'];
	}
	headers['cross-origin-resource-policy'] = 'same-origin';
	await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
});
const page = await ctx.newPage();
page.on('console', (m) => console.log('console:', m.type(), m.text()));
// 1. Daten auf der alten Adresse anlegen (vor dem Laden der App: Umzug abschalten über leere Seite)
await page.goto('https://chess.maximilianauer.at/robots.txt');
await page.evaluate(async (f) => {
	localStorage.setItem('rookie:lang', 'de');
	localStorage.setItem('rookie:theme', 'dark');
	const db = await new Promise((res, rej) => {
		const r = indexedDB.open('rookie');
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
	db.close();
	return f.games.length;
}, fixture);
// App einmal laden lassen, damit Dexie das Schema anlegt – dann sofort Daten schreiben
await page.route('https://chess.maximilianauer.at/move-off', (r) => r.fulfill({ body: 'x' }));
const seedPage = await ctx.newPage();
// 204 auf die Weiterleitung: Seite bleibt stehen, damit Dexie das Schema anlegt
await seedPage.route('https://rookie.maximilianauer.at/**', (r) => r.fulfill({ status: 204 }));
await seedPage.goto('https://chess.maximilianauer.at/about');
await seedPage.waitForFunction(async () => {
	const dbs = await indexedDB.databases();
	return dbs.some((d) => d.name === 'rookie');
});
await seedPage.waitForTimeout(1500);
const n = await seedPage.evaluate(async (f) => {
	const db = await new Promise((res) => {
		const r = indexedDB.open('rookie');
		r.onsuccess = () => res(r.result);
	});
	const put = (store, rows) =>
		new Promise((res, rej) => {
			const tx = db.transaction(store, 'readwrite');
			for (const row of rows) tx.objectStore(store).put(row);
			tx.oncomplete = res;
			tx.onerror = () => rej(tx.error);
		});
	await put('games', f.games.map((g, i) => ({ ...g, id: i + 1 })));
	await put('puzzleAttempts', f.puzzleAttempts.map((a, i) => ({ ...a, id: i + 1 })));
	await put('activity', f.activity);
	db.close();
	return f.games.length;
}, fixture);
console.log('seed-Seite:', seedPage.url());
await seedPage.close();
console.log('alte Adresse: Partien angelegt', n);

// 2. alte Adresse öffnen → Umzug
await page.goto('https://chess.maximilianauer.at/coach?x=1');
await page.waitForURL(/rookie\.maximilianauer\.at\/coach\?x=1/, { timeout: 30000 });
console.log('weitergeleitet nach', page.url());
await page.waitForTimeout(2500);
const after = await page.evaluate(async () => {
	const db = await new Promise((res) => {
		const r = indexedDB.open('rookie');
		r.onsuccess = () => res(r.result);
	});
	const count = (s) =>
		new Promise((res) => {
			const q = db.transaction(s).objectStore(s).count();
			q.onsuccess = () => res(q.result);
		});
	return {
		games: await count('games'),
		attempts: await count('puzzleAttempts'),
		lang: localStorage.getItem('rookie:lang'),
		theme: localStorage.getItem('rookie:theme')
	};
});
console.log('neue Adresse:', after);
await page.screenshot({ path: '/tmp/claude-501/move-after.png' });
// 3. nochmal alte Adresse: sofort weiter (schon umgezogen)
const t0 = Date.now();
await page.goto('https://chess.maximilianauer.at/puzzles');
await page.waitForURL(/rookie\.maximilianauer\.at\/puzzles/, { timeout: 15000 });
console.log('zweiter Besuch weitergeleitet in', Date.now() - t0, 'ms');
await browser.close();
if (after.games !== n) process.exit(1);
