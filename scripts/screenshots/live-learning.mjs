/**
 * Live-Prüfung der Lern-Bausteine (v0.4.0) im iPhone-Format: Startseite mit Blunder-Check im Plan,
 * Blunder-Check-Seite beantwortbar, Coach mit „Wirkt dein Training?“, kein Überlauf.
 *   node scripts/screenshots/live-learning.mjs <ordner> [basis-url]
 */
import { webkit, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'live';
const base = process.argv[3] ?? 'https://rookie.maximilianauer.at';
mkdirSync(out, { recursive: true });
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 15'] });
await ctx.addInitScript(() => {
	localStorage.setItem('rookie:onboarded', '1');
	localStorage.setItem('rookie:installDismissed', '9999999999999');
});
const p = await ctx.newPage();
const overflow = () =>
	p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
const res = {};
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
res.version = await p.evaluate(() => document.body.innerText.match(/0\.4\.\d/)?.[0] ?? null);
res.planSafety = await p.getByText(/Blunder check: 6 moves/).count();
res.homeOverflow = await overflow();
await p.screenshot({ path: `${out}/home.png` });
await p.goto(base + '/puzzles/safety', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
res.safetyPrompt = await p.getByText(/You plan .+ Is it safe\?/).count();
await p.getByTestId('answer-safe').locator('visible=true').first().click();
await p.waitForTimeout(1200);
res.safetyAnswered = await p.getByTestId('safety-next').locator('visible=true').count();
res.safetyOverflow = await overflow();
await p.screenshot({ path: `${out}/safety.png` });
await p.goto(base + '/coach', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
res.progress = await p.getByTestId('progress-check').count();
res.coachOverflow = await overflow();
await p.screenshot({ path: `${out}/coach.png` });
await p.goto(base + '/settings', { waitUntil: 'networkidle' });
res.settingsVersion = await p.evaluate(
	() => document.body.innerText.match(/0\.\d\.\d/)?.[0] ?? null
);
console.log(JSON.stringify(res));
await b.close();
