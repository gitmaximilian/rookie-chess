import type { Page } from '@playwright/test';

/** Klickt einen UCI-Zug auf dem Brett (Tippen-Tippen) */
export async function playUci(page: Page, uci: string) {
	const host = page.locator('.cg-host').first();
	// Einblend-Animation nach einem Seitenwechsel abwarten, sonst verrutschen die Klick-Koordinaten
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((a) => (a.effect as KeyframeEffect | null)?.target?.tagName !== 'MAIN')
	);
	// Brettgröße kann sich nach dem vorigen Zug noch ändern (Seitenleiste lädt nach) – auf stabile Box warten
	let box = (await host.boundingBox())!;
	for (let i = 0; i < 20; i++) {
		await page.waitForTimeout(50);
		const next = (await host.boundingBox())!;
		if (next.x === box.x && next.y === box.y && next.width === box.width) break;
		box = next;
	}
	const flipped = (await host.getAttribute('data-orientation')) === 'black';
	const sq = box.width / 8;
	const at = (s: string) => {
		const f = s.charCodeAt(0) - 97;
		const r = Number(s[1]) - 1;
		const x = flipped ? 7 - f : f;
		const y = flipped ? r : 7 - r;
		return { x: box.x + (x + 0.5) * sq, y: box.y + (y + 0.5) * sq };
	};
	const a = at(uci.slice(0, 2));
	const b = at(uci.slice(2, 4));
	await page.mouse.click(a.x, a.y);
	await page.mouse.click(b.x, b.y);
}

export async function fen(page: Page): Promise<string> {
	return (await page.locator('.cg-host').first().getAttribute('data-fen'))!;
}
