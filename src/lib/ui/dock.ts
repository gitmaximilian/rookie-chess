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

function ensureRoot(): HTMLDivElement {
	if (root) return root;
	root = document.createElement('div');
	root.className = 'dock-root';
	root.setAttribute('role', 'region');
	document.body.appendChild(root);
	ro = new ResizeObserver(() => {
		const h = root && root.childElementCount ? root.offsetHeight : 0;
		document.documentElement.style.setProperty('--dock-h', `${h}px`);
	});
	ro.observe(root);
	return root;
}

function releaseRoot() {
	if (users > 0 || !root) return;
	ro?.disconnect();
	root.remove();
	root = null;
	ro = null;
	document.documentElement.style.setProperty('--dock-h', '0px');
}

export interface DockOptions {
	/** Reihenfolge in der Leiste (kleiner = weiter oben) */
	order?: number;
	/** nur auf dem Handy zeigen (am Desktop gibt es das schon an anderer Stelle) */
	mobileOnly?: boolean;
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
			r.appendChild(node);
			docked = true;
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
			if (docked) node.style.order = String(opts.order ?? 0);
			else node.hidden = !mq.matches && !!opts.mobileOnly;
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
