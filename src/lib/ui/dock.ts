/**
 * Mobile Aktionsleiste: Auf dem Handy wandern Elemente mit `use:dock` in eine feste Leiste
 * direkt über der Tab-Leiste – Hinweis, Lösung, Coach & Co. sind so immer sichtbar,
 * ohne zu scrollen. Am Desktop bleiben sie, wo sie im Markup stehen.
 *
 * Der Knoten wird an <body> gehängt (nicht nur `position: fixed`), weil Animationen
 * mit transform sonst den Bezugsrahmen verschieben würden.
 */
const MOBILE = '(max-width: 767px)';

let root: HTMLDivElement | null = null;
let ro: ResizeObserver | null = null;
let users = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Reservierte Höhe (`--dock-h`) – wächst auf einer Seite nur, schrumpft nie.
 * Brettgröße und Abstand unten hängen daran: Würde sie mit jedem Kommentar oder jedem
 * Wechsel „Hinweis ↔ Weiter“ schwanken, würde das Brett springen und die Seite scrollen.
 * Erst beim Seitenwechsel (anderer Pfad oder andere Partie) wird neu gemessen.
 */
let reserved = 0;
let reservedFor = '';

function publish() {
	const where = location.pathname + location.search;
	if (where !== reservedFor) {
		reservedFor = where;
		reserved = 0;
	}
	const h = root && root.childElementCount ? root.offsetHeight : 0;
	// Seiten können vorab reservieren, was ihre Leiste höchstens braucht (z. B. Lösung + „Weiter“)
	let floor = 0;
	for (const el of root?.children ?? [])
		floor = Math.max(floor, Number((el as HTMLElement).dataset.reserve) || 0);
	const want = Math.max(h, h ? floor : 0);
	if (want > reserved) {
		reserved = want;
		document.documentElement.style.setProperty('--dock-h', `${want}px`);
	}
}

function ensureRoot(): HTMLDivElement {
	if (releaseTimer) {
		clearTimeout(releaseTimer);
		releaseTimer = null;
	}
	if (root) return root;
	root = document.createElement('div');
	root.className = 'dock-root';
	root.setAttribute('role', 'region');
	document.body.appendChild(root);
	ro = new ResizeObserver(publish);
	ro.observe(root);
	return root;
}

function releaseRoot() {
	if (users > 0 || !root || releaseTimer) return;
	// kurz warten: beim Tausch zweier Leisten-Inhalte ({#if} … {:else}) nicht zurücksetzen
	releaseTimer = setTimeout(() => {
		releaseTimer = null;
		if (users > 0 || !root) return;
		ro?.disconnect();
		root.remove();
		root = null;
		ro = null;
		reserved = 0;
		reservedFor = '';
		document.documentElement.style.setProperty('--dock-h', '0px');
	}, 400);
}

export interface DockOptions {
	/** Reihenfolge in der Leiste (kleiner = weiter oben) */
	order?: number;
	/** nur auf dem Handy zeigen (am Desktop gibt es das schon an anderer Stelle) */
	mobileOnly?: boolean;
	/** so viel Höhe (px, ganze Leiste) von Anfang an reservieren, damit das Brett nie nachträglich schrumpft */
	reserve?: number;
}

export function dock(node: HTMLElement, opts: DockOptions = {}) {
	if (typeof window === 'undefined' || !window.matchMedia) return;
	const mq = window.matchMedia(MOBILE);
	const anchor = document.createComment('dock');
	node.before(anchor);
	users++;
	let docked = false;

	function place() {
		if (mq.matches && !docked) {
			const r = ensureRoot();
			node.style.order = String(opts.order ?? 0);
			node.classList.add('docked');
			node.hidden = false;
			if (opts.reserve) node.dataset.reserve = String(opts.reserve);
			r.appendChild(node);
			docked = true;
			// sofort messen, nicht erst einen Frame später – sonst startet das Brett zu groß
			publish();
		} else if (!mq.matches) {
			if (docked) {
				anchor.after(node);
				node.classList.remove('docked');
				node.style.order = '';
				docked = false;
			}
			node.hidden = !!opts.mobileOnly;
		}
	}

	place();
	mq.addEventListener('change', place);
	return {
		update(next: DockOptions = {}) {
			opts = next;
			if (docked) {
				node.style.order = String(opts.order ?? 0);
				node.dataset.reserve = String(opts.reserve ?? 0);
				publish();
			} else node.hidden = !mq.matches && !!opts.mobileOnly;
		},
		destroy() {
			mq.removeEventListener('change', place);
			node.remove();
			anchor.remove();
			users--;
			releaseRoot();
		}
	};
}
