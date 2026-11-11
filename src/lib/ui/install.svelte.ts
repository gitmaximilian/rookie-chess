/**
 * „Als App installieren“: Android/Chrome bietet einen echten Installations-Dialog
 * (beforeinstallprompt), iOS/iPadOS nur den Weg über Teilen → Zum Home-Bildschirm.
 */
interface InstallEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'ipad' | 'android' | 'other';

const DISMISS_KEY = 'rookie:installDismissed';
/** nach „Später“ erst nach so vielen Tagen wieder fragen */
const ASK_AGAIN_DAYS = 30;

export const install = $state({
	platform: 'other' as InstallPlatform,
	/** läuft bereits als installierte App */
	standalone: false,
	/** Android: der Browser erlaubt die Installation per Knopfdruck */
	canPrompt: false,
	/** Hinweisleiste unten sichtbar */
	banner: false,
	/** Anleitung geöffnet */
	guide: false
});

let deferred: InstallEvent | null = null;

function detectPlatform(): InstallPlatform {
	const ua = navigator.userAgent;
	if (/iPhone|iPod/.test(ua)) return 'ios';
	if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ipad';
	if (/Android/.test(ua)) return 'android';
	return 'other';
}

function recentlyDismissed(): boolean {
	try {
		const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
		return Date.now() - t < ASK_AGAIN_DAYS * 86_400_000;
	} catch {
		return false;
	}
}

/** Einmal beim Start aufrufen (nur im Browser) */
export function initInstall(): void {
	install.platform = detectPlatform();
	install.standalone =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	if (install.standalone) return;

	addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as InstallEvent;
		install.canPrompt = true;
		if (!recentlyDismissed()) install.banner = true;
	});
	addEventListener('appinstalled', () => {
		install.banner = false;
		install.guide = false;
		install.standalone = true;
	});

	// iPhone/iPad: kein Browser-Ereignis → nach kurzer Zeit selbst fragen
	if ((install.platform === 'ios' || install.platform === 'ipad') && !recentlyDismissed())
		setTimeout(() => (install.banner = true), 1800);
}

/** Installieren: Android direkt, sonst die Anleitung zeigen */
export async function startInstall(): Promise<void> {
	if (deferred) {
		await deferred.prompt();
		const { outcome } = await deferred.userChoice;
		deferred = null;
		install.canPrompt = false;
		install.banner = false;
		if (outcome === 'dismissed') dismissInstall();
		return;
	}
	install.banner = false;
	install.guide = true;
}

export function dismissInstall(): void {
	install.banner = false;
	install.guide = false;
	try {
		localStorage.setItem(DISMISS_KEY, String(Date.now()));
	} catch {
		/* privat – fragt beim nächsten Besuch erneut */
	}
}
