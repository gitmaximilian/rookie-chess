import { expect, test } from '@playwright/test';
import type { GameRow } from '../src/lib/db/db';

test('Coach zeigt beide Linien mit Zeiträumen, auswählbaren Punkten und Formel', async ({
	page
}) => {
	await page.goto('/coach');
	const chart = page.getByTestId('coach-history');
	await expect(
		chart.getByText('Import rated Lichess Rapid games to see your progress.')
	).toBeVisible();
	const moves = [
		'e2e4',
		'e7e5',
		'g1f3',
		'b8c6',
		'f1c4',
		'g8f6',
		'd2d3',
		'd7d6',
		'e1g1',
		'f8e7',
		'b1c3',
		'e8g8',
		'c1e3',
		'c8e6',
		'c4e6',
		'f7e6',
		'd1d2',
		'd8d7',
		'a1d1',
		'a8d8',
		'h2h3',
		'h7h6'
	];
	const games: GameRow[] = [500, 100, 10, 5, 2].map((age, i) => ({
		date: Date.now() - age * 86_400_000,
		source: 'lichess',
		speed: 'rapid',
		rated: true,
		myRating: 1200 + i * 10,
		startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
		pgn: '[WhiteRatingDiff "8"]',
		moves,
		result: '1-0',
		myColor: 'white',
		opponent: 'Fixture',
		analysis: {
			depth: 11,
			done: true,
			evals: Array.from({ length: moves.length + 1 }, () => ({ cp: 0 }))
		}
	}));
	await page.evaluate(
		(rows) =>
			new Promise<void>((resolve, reject) => {
				const req = indexedDB.open('rookie');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const tx = db.transaction('games', 'readwrite');
					for (const game of rows) tx.objectStore('games').add(game);
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
			}),
		games
	);
	await page.reload();
	await expect(chart.getByRole('button', { name: '30 days' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(chart.locator('path.elo')).toHaveAttribute('d', /M.+L/);
	await expect(chart.locator('path.index')).toHaveAttribute('d', /M.+L/);
	await expect(chart.getByText('3/3')).toBeVisible();
	await chart.getByRole('button', { name: '7 days' }).click();
	await expect(chart.getByText('2/2')).toBeVisible();
	await expect(chart.getByText('0 blunders per 30 moves', { exact: false })).toBeVisible();
	await chart.getByRole('button', { name: '1 year' }).click();
	await expect(chart.getByText('4/4')).toBeVisible();
	await chart.getByRole('button', { name: 'All time' }).click();
	await expect(chart.getByText('5/5')).toBeVisible();
	const slider = chart.getByRole('slider');
	await slider.press('Home');
	await expect(slider).toHaveValue('0');
	await expect(chart.getByTestId('coach-history-point')).toContainText(/1[,. ]?208/);
	await chart.getByText('How is this calculated?').click();
	await expect(chart.getByText(/0.60 × safety/)).toBeVisible();
});
