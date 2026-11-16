import { expect, test, type Page } from '@playwright/test';
import { fen, playUci } from './helpers/board';

type BotTestWindow = Window & {
	premoveTestBot: { searches: number; reply: ((uci: string) => void) | null };
};

async function startWithControlledBot(page: Page) {
	// Der Test steuert nur die UCI-Antwort. Spielregeln und Eingabe bleiben unverändert.
	await page.addInitScript(() => {
		Math.random = () => 0.9;
		const bot: BotTestWindow['premoveTestBot'] = { searches: 0, reply: null };
		(window as BotTestWindow).premoveTestBot = bot;

		window.Worker = new Proxy(window.Worker, {
			construct(target, args) {
				if (!/\/engine\/stockfish-19-lite(?:-single)?\.js$/.test(String(args[0])))
					return Reflect.construct(target, args);
				const worker = {
					onmessage: null as ((event: MessageEvent<string>) => void) | null,
					postMessage(command: string) {
						const send = (data: string) =>
							queueMicrotask(() => worker.onmessage?.(new MessageEvent('message', { data })));
						if (command === 'uci') send('uciok');
						else if (command === 'isready') send('readyok');
						else if (command === 'stop') {
							bot.reply = null;
							send('bestmove (none)');
						} else if (command.startsWith('go ')) {
							bot.searches++;
							bot.reply = (uci) => {
								bot.reply = null;
								send('info depth 12 multipv 1 score cp 0 pv ' + uci);
								send('bestmove ' + uci);
							};
						}
					},
					terminate() {
						bot.reply = null;
					}
				};
				return worker;
			}
		});
	});
	await page.goto('/play');
	await page.getByRole('switch', { name: 'Play with coach' }).click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await expect(page.getByText('Your move', { exact: true })).toBeVisible();

	let next = 0;
	return () => {
		const requested = page.waitForFunction(
			(n) => (window as BotTestWindow).premoveTestBot.searches >= n,
			++next
		);
		const play = (uci: string) =>
			page.evaluate((move) => (window as BotTestWindow).premoveTestBot.reply!(move), uci);
		return { requested, play };
	};
}

test('Ein vorgemerkter Zug wird nach der Bot-Antwort automatisch gespielt', async ({
	page,
	hasTouch
}) => {
	const nextReply = await startWithControlledBot(page);
	const reply = nextReply();
	await playUci(page, 'e2e4');
	await reply.requested;
	await playUci(page, 'g1f3', hasTouch ? 'touch' : 'mouse');
	await expect(page.locator('cg-board square.current-premove')).toHaveCount(2);
	await expect(page.getByRole('button', { name: 'Cancel premove' })).toBeVisible();
	expect(await fen(page)).toMatch(/ b /);

	const secondReply = nextReply();
	await reply.play('e7e5');
	await secondReply.requested;
	await expect(page.locator('cg-board square.current-premove')).toHaveCount(0);
	await expect(page.locator('.side-moves')).toContainText('f3');
	expect(await fen(page)).toMatch(/^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/5N2\/PPPP1PPP\/RNBQKB1R b /);
	await secondReply.play('b8c6');
});

test('Ein im Schach illegaler Premove wird entfernt und der Spieler bleibt am Zug', async ({
	page
}) => {
	const nextReply = await startWithControlledBot(page);
	const first = nextReply();
	await playUci(page, 'e2e4');
	await first.requested;
	await first.play('e7e5');
	await expect(page.getByText('Your move', { exact: true })).toBeVisible();

	const second = nextReply();
	await playUci(page, 'd2d4');
	await second.requested;
	await playUci(page, 'a2a3');
	await expect(page.getByRole('button', { name: 'Cancel premove' })).toBeVisible();
	await second.play('f8b4');
	await expect(page.getByText('Your move', { exact: true })).toBeVisible();
	await expect(page.locator('cg-board square.current-premove')).toHaveCount(0);
	await expect(page.locator('.side-moves')).toContainText('b4+');
	await expect(page.locator('.side-moves')).not.toContainText('a3');
});

test('Ein Premove lässt sich ersetzen und anschließend löschen', async ({ page }) => {
	const nextReply = await startWithControlledBot(page);
	const reply = nextReply();
	await playUci(page, 'e2e4');
	await reply.requested;
	await playUci(page, 'g1f3');
	const cancel = page.getByRole('button', { name: 'Cancel premove' });
	await expect(cancel).toBeVisible();
	await playUci(page, 'f1c4');
	await expect(page.locator('cg-board square.current-premove')).toHaveCount(2);
	await cancel.click();
	await expect(page.locator('cg-board square.current-premove')).toHaveCount(0);
	await playUci(page, 'g1f3');
	await expect(cancel).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(cancel).toHaveCount(0);

	await reply.play('e7e5');
	await expect(page.getByText('Your move', { exact: true })).toBeVisible();
	await expect(page.locator('.side-moves')).not.toContainText(/f3|c4/);
});
