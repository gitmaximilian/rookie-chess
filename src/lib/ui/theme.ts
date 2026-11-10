export type ThemePref = 'system' | 'light' | 'dark';

export function getThemePref(): ThemePref {
	try {
		const v = localStorage.getItem('rookie:theme');
		return v === 'light' || v === 'dark' ? v : 'system';
	} catch {
		return 'system';
	}
}

export function setThemePref(t: ThemePref): void {
	try {
		if (t === 'system') localStorage.removeItem('rookie:theme');
		else localStorage.setItem('rookie:theme', t);
	} catch {
		/* egal */
	}
	applyTheme(t);
}

export function applyTheme(t: ThemePref = getThemePref()): void {
	const root = document.documentElement;
	if (t === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', t);
}
