import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/** Virtueller Passkey (wie Face ID), per Chrome DevTools Protocol */
async function authenticator(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});
	return { cdp, authenticatorId };
}

async function newDevice(ctx: BrowserContext) {
	const page = await ctx.newPage();
	await page.goto('/settings');
	// erst klicken, wenn die Seite interaktiv ist und den Kontostatus kennt
	await expect(page.locator('.account[data-status="out"]')).toBeVisible();
	return page;
}

test('Konto: erstellen, auf zweitem Gerät anmelden, Stand übernehmen, exportieren, löschen', async ({
	browser
}) => {
	// ── Gerät A
	const ctxA = await browser.newContext();
	const a = await newDevice(ctxA);
	const authA = await authenticator(a);
	await a.getByRole('radio', { name: '20' }).click(); // Tagesziel ändern
	await a.getByRole('button', { name: 'Create account' }).click();
	await expect(a.getByText(/Signed in/)).toBeVisible();
	await expect(a.getByText(/Last synced/)).toBeVisible();

	// Passkey „wandert“ über den Schlüsselbund auf Gerät B
	const { credentials } = await authA.cdp.send('WebAuthn.getCredentials', {
		authenticatorId: authA.authenticatorId
	});
	expect(credentials).toHaveLength(1);

	// ── Gerät B: leere Datenbank, gleicher Passkey
	const ctxB = await browser.newContext();
	const b = await newDevice(ctxB);
	const authB = await authenticator(b);
	await authB.cdp.send('WebAuthn.addCredential', {
		authenticatorId: authB.authenticatorId,
		credential: credentials[0]
	});
	await expect(b.getByRole('radio', { name: '5' })).toHaveAttribute('aria-checked', 'true');
	await b.getByRole('button', { name: 'Sign in' }).click();
	await expect(b.getByText(/Signed in/)).toBeVisible();
	await b.reload();
	await expect(b.getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');

	// ── Auskunft: Serverdaten herunterladen
	const dl = b.waitForEvent('download');
	await b.getByRole('button', { name: /Download my server data/ }).click();
	const file = await (await dl).path();
	const data = JSON.parse(await (await import('node:fs/promises')).readFile(file!, 'utf8'));
	expect(data.account.id).toBeTruthy();
	expect(data.passkeys).toHaveLength(1);
	expect(JSON.stringify(data.sync.training)).toContain('dailyGoal');
	expect(JSON.stringify(data)).not.toMatch(/email|password/i);

	// ── Löschen: alles weg, auch für Gerät A
	b.on('dialog', (d) => d.accept());
	await b.getByRole('button', { name: 'Delete account' }).click();
	await expect(b.getByText(/Account deleted/)).toBeVisible();
	expect((await b.request.get('/api/me')).status()).toBe(401);
	expect((await a.request.get('/api/sync')).status()).toBe(401);
	// lokale Daten bleiben
	await b.reload();
	await expect(b.getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');

	// Anmeldung mit dem Passkey eines gelöschten Kontos wird sauber abgewiesen
	await b.getByRole('button', { name: 'Sign in' }).click();
	await expect(b.getByText(/no longer exists/)).toBeVisible();
});

test('API: ohne Anmeldung kein Zugriff, fremde Herkunft blockiert', async ({ request }) => {
	expect((await request.get('/api/sync')).status()).toBe(401);
	expect((await request.get('/api/account/export')).status()).toBe(401);
	const res = await request.post('/api/auth/login/options', {
		headers: { origin: 'https://evil.example' }
	});
	expect(res.status()).toBe(403);
	expect(
		(await request.put('/api/sync', { headers: { origin: 'http://localhost:8789' } })).status()
	).toBe(401);
});
