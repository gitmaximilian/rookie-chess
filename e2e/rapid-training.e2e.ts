import { expect, test, type Page } from '@playwright/test';
import type { GameRow } from '../src/lib/db/db';
import { playUci } from './helpers/board';

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const example: GameRow = {
	id: 7,
	date: 0,
	pgn: '1. f3 e5 2. g4 Qh4# 0-1',
	moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
	startFen,
	result: '0-1',
	myColor: 'white',
	opponent: 'Test fixture',
	source: 'lichess',
	speed: 'rapid',
	rated: true,
	myRating: 1320,
	analysis: {
		depth: 11,
		done: true,
		evals: [
			{ cp: 30, best: 'e2e4' },
			{ cp: -15, best: 'e7e5' },
			{ cp: -15, best: 'e2e4' },
			{ mate: -1, best: 'd8h4' },
			{ cp: -10000 }
		]
	}
};

async function seed(page: Page, settings: Record<string, unknown>, games: GameRow[]) {
	await page.evaluate(
		({ settings, games }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('rookie');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction(['settings', 'games'], 'readwrite');
					for (const [key, value] of Object.entries(settings)) {
						tx.objectStore('settings').put({ key, value, t: Date.now() });
					}
					for (const game of games) tx.objectStore('games').put(game);
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
			}),
		{ settings, games }
	);
}

test('Fortgeschrittenes Profil: Schnellschach bleibt bei späteren Blitzpartien stabil, Spieltermin bei 5/15/30 Minuten', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
	const oldRapid = { ...example, date: Date.now() - 7 * 86_400_000 };
	const casual: GameRow = {
		...example,
		id: 8,
		date: Date.now() - 86_400_000,
		source: 'chesscom',
		speed: 'blitz',
		rated: false,
		myRating: 830
	};
	await seed(page, { minutesPerDay: 5, dailyPlan: null }, [oldRapid, casual]);
	const tile = page.getByTestId('tile-strength');
	const plan = page.locator('.plan');
	await expect.poll(async () => await plan.getByRole('link', { name: /^Start$/ }).count()).toBe(1);
	await page.reload();
	await expect(tile).toContainText('1320');
	await expect(tile).toContainText('Playing strength');
	await expect(plan.getByRole('link', { name: /Board scan/ })).toHaveCount(0);
	await expect(plan.getByTestId('rapid-slot')).toBeVisible();
	// 5 min Budget: Puzzles bleiben täglich drin (bis zu 5 min darüber)
	await expect(plan).toContainText('about 7 min');
	await seed(page, { minutesPerDay: 15, dailyPlan: null }, []);
	await page.reload();
	await expect(plan.getByRole('link', { name: /Practise one mistake/ })).toBeVisible();
	await expect(plan.getByTestId('rapid-slot')).toBeVisible();
	await seed(page, { minutesPerDay: 30, dailyPlan: null }, []);
	await page.reload();
	await expect(plan.getByTestId('rapid-slot')).toHaveCount(0);
	await plan.getByRole('link', { name: 'Play a rated Rapid game' }).click();
	await expect(page.getByTestId('rapid-plan')).toBeVisible();
	await expect(page.getByRole('link', { name: /Import a finished game/ })).toHaveAttribute(
		'href',
		'/import?rapid=1'
	);
});

test('Ein eigener Fehler wird nach Import vorausgewählt und bleibt nach Auflösung und Neuladen gespeichert', async ({
	page
}) => {
	await page.goto('/');
	const plan = page.locator('.plan');
	await expect(plan.getByRole('link', { name: /^Start$/ })).toBeVisible();
	await seed(page, { minutesPerDay: 30 }, [{ ...example, date: Date.now() }]);
	await page.reload();
	const task = plan.getByRole('link', { name: /Practise one mistake/ });
	await expect(task).toHaveAttribute('href', '/analysis?game=7&practice=1');
	await expect(plan.getByRole('link', { name: /^Continue$/ })).toHaveAttribute(
		'href',
		'/analysis?game=7&practice=1'
	);
	await task.click();
	await expect(
		page
			.getByText(/Mistake 1 of 1/i)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Solution', exact: true })
		.locator('visible=true')
		.first()
		.click();
	await expect(
		page.getByRole('button', { name: 'Finish', exact: true }).locator('visible=true').first()
	).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('quick-result')).toContainText('Saved for spaced review');
	await expect(page.getByTestId('quick-result')).toContainText('Next review:');
	await page
		.getByTestId('quick-result')
		.getByRole('link', { name: 'Back to the daily plan' })
		.click();
	await expect(
		plan.locator('.task.finished').filter({ hasText: 'Practise one mistake' })
	).toBeVisible();
});

for (const withHint of [false, true]) {
	test(`Nachspielen speichert einen ${withHint ? 'unterstützten' : 'selbstständigen'} Treffer`, async ({
		page,
		hasTouch
	}) => {
		await page.goto('/');
		await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
		await seed(page, {}, [{ ...example, date: Date.now() }]);
		await page.goto('/analysis?game=7&practice=1');
		await expect(
			page
				.getByText(/Mistake 1 of 1/i)
				.locator('visible=true')
				.first()
		).toBeVisible();
		// erst wird der Partiezug kurz vorgespielt, dann ist das Brett frei
		await expect(page.locator('.board-wrap[data-previewing="0"]')).toBeVisible();
		if (withHint) {
			await page
				.getByRole('button', { name: 'Hint', exact: true })
				.locator('visible=true')
				.first()
				.click();
		}
		await playUci(page, 'e2e4', hasTouch ? 'touch' : 'mouse');
		await expect(
			page
				.getByText(withHint ? 'Found – with a hint.' : 'Well found!', { exact: true })
				.locator('visible=true')
				.first()
		).toBeVisible();
		const records = await page.evaluate(
			() =>
				new Promise<{ solved: boolean; hinted: boolean }[]>((resolve) => {
					const req = indexedDB.open('rookie');
					req.onsuccess = () => {
						const db = req.result;
						const tx = db.transaction('puzzleAttempts');
						const query = tx.objectStore('puzzleAttempts').getAll();
						query.onsuccess = () =>
							resolve(query.result.map(({ solved, hinted }) => ({ solved, hinted })));
						tx.oncomplete = () => db.close();
					};
				})
		);
		expect(records).toEqual([{ solved: true, hinted: withHint }]);
	});
}

test('Rapid-Einstieg und kurze Fehlerübung funktionieren mit vorhandenen Daten offline', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'Service Worker im Test nur mit Chromium');
	await page.goto('/');
	await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
	await seed(page, {}, [{ ...example, date: Date.now() }]);
	await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
	await page.reload();
	await page.waitForFunction(() => !!navigator.serviceWorker.controller);
	await context.setOffline(true);
	await page.goto('/play?plan=1');
	await expect(page.getByTestId('rapid-plan')).toContainText(
		'You can practise against a bot below'
	);
	await page.goto('/analysis?game=7&practice=1');
	await expect(
		page
			.getByText(/Mistake 1 of 1/i)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Solution', exact: true })
		.locator('visible=true')
		.first()
		.click();
	await expect(
		page.getByRole('button', { name: 'Finish', exact: true }).locator('visible=true').first()
	).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('quick-result')).toBeVisible();
});

test('Skill-Penta: Tempo umschalten, Blitz mit Hinweis, Bot-Partien zählen nie', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
	const now = Date.now();
	await seed(page, {}, [
		...[1, 2, 3].map((i) => ({ ...example, id: 20 + i, date: now - i * 86_400_000 })),
		...[1, 2].map((i) => ({
			...example,
			id: 30 + i,
			date: now - i * 3_600_000,
			speed: 'blitz'
		})),
		{ ...example, id: 40, date: now, speed: 'blitz', opponentIsBot: true },
		{ ...example, id: 41, date: now - 7_200_000, speed: 'bullet' }
	]);
	await page.goto('/coach');
	const speeds = page.getByTestId('penta-speed');
	await expect(speeds.getByRole('radio', { name: /Rapid 3/ })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(page.getByTestId('penta-need')).toContainText('analysed Rapid games');
	await expect(page.getByTestId('penta-fast')).toHaveCount(0);
	await speeds.getByRole('radio', { name: /Blitz 2/ }).click();
	await expect(page.getByTestId('penta-fast')).toBeVisible();
	await expect(page.getByTestId('penta-need')).toContainText('3 analysed Blitz games');
	// Bullet: kein Penta, sondern die ehrliche Erklärung (Holdout schlechter als Raten)
	await speeds.getByRole('radio', { name: /Bullet 1/ }).click();
	await expect(page.getByTestId('penta-fast')).toContainText('no penta for bullet');
	await expect(page.getByTestId('skill-penta')).toHaveCount(0);
	await speeds.getByRole('radio', { name: /Blitz 2/ }).click();
	await expect(page.getByTestId('skill-penta')).toBeVisible();
	// die Wahl bleibt nach dem Neuladen
	await page.reload();
	await expect(
		page.getByTestId('penta-speed').getByRole('radio', { name: /Blitz 2/ })
	).toHaveAttribute('aria-checked', 'true');
});

test('Uhr: Bullet bekommt Tempo, Niveau mit Uhr und einen Rat – ohne Analyse', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
	const san = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O h3 h6 Re1 a6 a4 Ba7 Nbd2 Be6'.split(' ');
	const uci =
		'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 e1g1 e8g8 h2h3 h7h6 f1e1 a7a6 a2a4 c5a7 b1d2 c8e6'.split(
			' '
		);
	// 1+0: Weiß (ich) braucht je Zug 2,5 s → 25 von 60 s bis Zug 10 (42 %), Schwarz 1 s je Zug
	const body = san
		.map((m, i) => {
			const n = Math.floor(i / 2) + 1;
			const left = i % 2 === 0 ? 60 - n * 2.5 : 60 - n;
			const clk = `0:00:${String(Math.floor(left)).padStart(2, '0')}${left % 1 ? '.5' : ''}`;
			return `${i % 2 === 0 ? `${n}. ` : ''}${m} { [%clk ${clk}] }`;
		})
		.join(' ');
	const now = Date.now();
	await seed(
		page,
		{ pentaSpeed: 'bullet' },
		Array.from({ length: 12 }, (_, i) => ({
			...example,
			id: 50 + i,
			date: now - i * 3_600_000,
			speed: 'bullet',
			analysis: undefined,
			moves: uci,
			result: i < 6 ? ('0-1' as const) : ('1-0' as const),
			pgn: `[TimeControl "60+0"]\n[Termination "${i < 6 ? 'Time forfeit' : 'Normal'}"]\n[Result "${i < 6 ? '0-1' : '1-0'}"]\n\n${body} ${i < 6 ? '0-1' : '1-0'}`
		}))
	);
	await page.goto('/coach');
	const card = page.getByTestId('clock-card');
	await expect(card).toBeVisible();
	await expect(page.getByTestId('clock-tempo')).toHaveText('42 %');
	await expect(page.getByTestId('clock-level')).toContainText('Level with clock');
	await expect(card).toContainText('Lost on time: 50 %');
	await expect(page.getByTestId('clock-advice')).toContainText('first moves');
	await expect(card.getByRole('link', { name: /Learn an opening/ })).toBeVisible();
});
