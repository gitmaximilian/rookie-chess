/**
 * Synthetisierte Klänge über die Web Audio API – keine Audiodateien nötig.
 * Drei Stile zur Auswahl (Einstellungen), alles weich und leise abgemischt.
 */
export type SoundStyle = 'wood' | 'soft' | 'chime';
export const SOUND_STYLES: SoundStyle[] = ['wood', 'soft', 'chime'];

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
let enabled = true;
let style: SoundStyle = 'wood';

try {
	enabled = localStorage.getItem('rookie:sound') !== 'off';
	const s = localStorage.getItem('rookie:soundStyle') as SoundStyle | null;
	if (s && SOUND_STYLES.includes(s)) style = s;
} catch {
	/* privat / kein Storage */
}

function ac(): AudioContext | null {
	if (!enabled || typeof window === 'undefined') return null;
	try {
		if (!ctx) {
			ctx = new AudioContext();
			// Master: leiser Grundpegel, sanfter Tiefpass gegen „Pieksen“, Kompressor gegen Übersteuern
			const master = ctx.createGain();
			master.gain.value = 0.55;
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 5200;
			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = -14;
			comp.ratio.value = 4;
			master.connect(lp).connect(comp).connect(ctx.destination);
			out = master;
		}
		if (ctx.state === 'suspended') void ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

/** Ein abklingender Sinus-Teilton, optional mit Tonhöhen-Abfall */
function partial(
	a: AudioContext,
	freq: number,
	gain: number,
	decay: number,
	delay = 0,
	drop = 1,
	type: OscillatorType = 'sine'
) {
	const t = a.currentTime + delay;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = type;
	o.frequency.setValueAtTime(freq, t);
	if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + decay);
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain, t + 0.004);
	g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
	o.connect(g).connect(out!);
	o.start(t);
	o.stop(t + decay + 0.03);
}

/** Ganz kurzer, dumpfer Anschlag (tiefpassgefiltertes Rauschen) – gibt dem Holz „Körper“ */
function thump(a: AudioContext, gain: number, cutoff: number, delay = 0) {
	const len = Math.floor(a.sampleRate * 0.025);
	const buf = a.createBuffer(1, len, a.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
	const src = a.createBufferSource();
	src.buffer = buf;
	const f = a.createBiquadFilter();
	f.type = 'lowpass';
	f.frequency.value = cutoff;
	const g = a.createGain();
	g.gain.value = gain;
	src.connect(f).connect(g).connect(out!);
	src.start(a.currentTime + delay);
}

/** Figur wird aufs Holzbrett gesetzt: Modal-Synthese eines kleinen Holzblocks */
function woodTap(a: AudioContext, f0: number, level: number, delay = 0) {
	thump(a, 0.5 * level, 1800, delay);
	partial(a, f0, 0.32 * level, 0.09, delay, 0.97);
	partial(a, f0 * 2.57, 0.1 * level, 0.045, delay);
	partial(a, f0 * 4.1, 0.035 * level, 0.025, delay);
}

/** Marimba-artiger Ton */
function mallet(a: AudioContext, f: number, level: number, delay = 0, decay = 0.35) {
	partial(a, f, 0.22 * level, decay, delay);
	partial(a, f * 4, 0.04 * level, decay * 0.25, delay);
	partial(a, f * 10, 0.012 * level, 0.03, delay);
}

const MOVE: Record<SoundStyle, (a: AudioContext, capture: boolean) => void> = {
	wood(a, capture) {
		if (capture) {
			// zwei Figuren berühren sich: kurzer Doppelanschlag, etwas tiefer
			woodTap(a, 360, 1.05);
			woodTap(a, 470, 0.55, 0.045);
		} else woodTap(a, 520, 0.85);
	},
	soft(a, capture) {
		// gedämpftes „Plopp“
		partial(a, capture ? 240 : 320, 0.3, 0.11, 0, 0.55);
		if (capture) partial(a, 180, 0.18, 0.12, 0.05, 0.6);
	},
	chime(a, capture) {
		if (capture) {
			mallet(a, 523.25, 0.9);
			mallet(a, 392, 0.7, 0.07);
		} else mallet(a, 659.25, 0.8, 0, 0.28);
	}
};

function check(a: AudioContext) {
	// dezenter, zweitöniger Hinweis – kein schrilles Piepen
	mallet(a, 880, 0.45, 0.06, 0.25);
	mallet(a, 1174.66, 0.35, 0.13, 0.3);
}

export const sound = {
	get enabled() {
		return enabled;
	},
	get style() {
		return style;
	},
	setEnabled(on: boolean) {
		enabled = on;
		try {
			localStorage.setItem('rookie:sound', on ? 'on' : 'off');
		} catch {
			/* egal */
		}
	},
	setStyle(s: SoundStyle) {
		style = s;
		try {
			localStorage.setItem('rookie:soundStyle', s);
		} catch {
			/* egal */
		}
	},
	move(capture = false, isCheck = false) {
		const a = ac();
		if (!a) return;
		MOVE[style](a, capture);
		if (isCheck) check(a);
	},
	good() {
		const a = ac();
		if (!a) return;
		mallet(a, 659.25, 0.8);
		mallet(a, 987.77, 0.7, 0.09, 0.45);
	},
	bad() {
		const a = ac();
		if (!a) return;
		// weich und tief statt „Fehler-Buzzer“
		partial(a, 293.66, 0.18, 0.3, 0, 0.92);
		partial(a, 246.94, 0.14, 0.35, 0.1, 0.92);
	},
	end(kind: 'win' | 'loss' | 'draw') {
		const a = ac();
		if (!a) return;
		if (kind === 'win') {
			mallet(a, 523.25, 0.8);
			mallet(a, 659.25, 0.8, 0.11);
			mallet(a, 783.99, 0.8, 0.22);
			mallet(a, 1046.5, 0.7, 0.33, 0.6);
		} else if (kind === 'loss') {
			mallet(a, 392, 0.7, 0, 0.4);
			mallet(a, 329.63, 0.7, 0.16, 0.5);
		} else {
			mallet(a, 523.25, 0.7, 0, 0.4);
			mallet(a, 523.25, 0.5, 0.14, 0.4);
		}
	}
};
