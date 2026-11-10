/**
 * Kleine, synthetisierte Klänge über die Web Audio API – keine Audiodateien nötig.
 * Abschaltbar in den Einstellungen.
 */
let ctx: AudioContext | null = null;
let enabled = true;

try {
	enabled = localStorage.getItem('rookie:sound') !== 'off';
} catch {
	/* privat / kein Storage */
}

function ac(): AudioContext | null {
	if (!enabled || typeof window === 'undefined') return null;
	try {
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') void ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
	const a = ac();
	if (!a) return;
	const t = a.currentTime + delay;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = type;
	o.frequency.setValueAtTime(freq, t);
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain, t + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g).connect(a.destination);
	o.start(t);
	o.stop(t + dur + 0.02);
}

/** Holziges „Klack“ aus gefiltertem Rauschen */
function knock(gain: number, freq: number) {
	const a = ac();
	if (!a) return;
	const len = Math.floor(a.sampleRate * 0.06);
	const buf = a.createBuffer(1, len, a.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
	const src = a.createBufferSource();
	src.buffer = buf;
	const f = a.createBiquadFilter();
	f.type = 'bandpass';
	f.frequency.value = freq;
	f.Q.value = 1.4;
	const g = a.createGain();
	g.gain.value = gain;
	src.connect(f).connect(g).connect(a.destination);
	src.start();
}

export const sound = {
	get enabled() {
		return enabled;
	},
	setEnabled(on: boolean) {
		enabled = on;
		try {
			localStorage.setItem('rookie:sound', on ? 'on' : 'off');
		} catch {
			/* egal */
		}
	},
	move(capture = false, check = false) {
		knock(capture ? 1.1 : 0.8, capture ? 900 : 1400);
		if (check) tone(880, 0.12, 'sine', 0.06, 0.04);
	},
	good() {
		tone(660, 0.14, 'sine', 0.08);
		tone(990, 0.22, 'sine', 0.07, 0.09);
	},
	bad() {
		tone(220, 0.22, 'triangle', 0.09);
	},
	end(kind: 'win' | 'loss' | 'draw') {
		if (kind === 'win') {
			tone(523, 0.18, 'sine', 0.08);
			tone(659, 0.18, 'sine', 0.08, 0.12);
			tone(784, 0.35, 'sine', 0.08, 0.24);
		} else if (kind === 'loss') {
			tone(330, 0.25, 'triangle', 0.08);
			tone(262, 0.4, 'triangle', 0.08, 0.18);
		} else {
			tone(440, 0.3, 'sine', 0.07);
		}
	}
};
