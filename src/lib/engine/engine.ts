import { parseInfo, type PvLine } from './uci.js';

export interface AnalyseOptions {
	fen: string;
	depth?: number;
	nodes?: number;
	movetime?: number;
	multipv?: number;
	/** 0–20, Standard 20 */
	skill?: number;
	signal?: AbortSignal;
	onInfo?: (lines: PvLine[]) => void;
}

export interface AnalyseResult {
	bestmove: string | null;
	/** sortiert nach multipv, Score aus Sicht der Seite am Zug */
	lines: PvLine[];
}

type Listener = (line: string) => void;

/**
 * Stockfish (WASM) im Web Worker. Aufträge laufen strikt nacheinander.
 * Multi-Thread, wenn die Seite cross-origin-isoliert ist, sonst Single-Thread.
 */
class EngineService {
	private worker: Worker | null = null;
	private listeners = new Set<Listener>();
	private ready: Promise<void> | null = null;
	private queue: Promise<unknown> = Promise.resolve();
	private current: { stop: () => void } | null = null;
	multiThreaded = false;

	private send(cmd: string) {
		this.worker?.postMessage(cmd);
	}

	/** Wartet auf eine Engine-Zeile; mit `timeout` → null, wenn sie nicht kommt */
	private waitFor(pred: (line: string) => boolean, timeout?: number): Promise<string | null> {
		return new Promise((resolve) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const l: Listener = (line) => {
				if (pred(line)) {
					this.listeners.delete(l);
					clearTimeout(timer);
					resolve(line);
				}
			};
			this.listeners.add(l);
			if (timeout)
				timer = setTimeout(() => {
					this.listeners.delete(l);
					resolve(null);
				}, timeout);
		});
	}

	/**
	 * Engine hängt (iOS friert Worker beim App-Wechsel ein, Multi-Thread-WASM kann blockieren):
	 * Worker beenden, beim nächsten Auftrag neu starten – dann nur noch Single-Thread.
	 */
	private reset() {
		this.worker?.terminate();
		this.worker = null;
		this.listeners.clear();
		this.ready = null;
		this.current = null;
		if (this.multiThreaded) {
			this.multiThreaded = false;
			try {
				localStorage.setItem(SINGLE_KEY, '1');
			} catch {
				/* privat/gesperrt – egal */
			}
		}
	}

	init(): Promise<void> {
		if (this.ready) return this.ready;
		this.ready = (async () => {
			const canThread =
				typeof SharedArrayBuffer !== 'undefined' &&
				self.crossOriginIsolated === true &&
				!isAppleMobile() &&
				!singleOnly();
			this.multiThreaded = canThread && (await this.boot('stockfish-19-lite.js'));
			// Rückfall: Single-Thread läuft überall
			if (!this.multiThreaded) await this.boot('stockfish-19-lite-single.js');
			if (this.multiThreaded) {
				// Akku & Wärme schonen: höchstens 2 Threads auf Mobilgeräten, 4 sonst
				const cores = navigator.hardwareConcurrency || 2;
				const mobile = /Android/.test(navigator.userAgent);
				const threads = Math.max(1, Math.min(mobile ? 2 : 4, cores - 1));
				this.send(`setoption name Threads value ${threads}`);
			}
			this.send('setoption name Hash value 16');
			if (!(await this.isReady())) throw new Error('engine not ready');
		})();
		// fehlgeschlagener Start: beim nächsten Auftrag neu versuchen
		this.ready.catch(() => this.reset());
		return this.ready;
	}

	/** Startet einen Engine-Worker; false, wenn er nicht innerhalb von 4 s antwortet */
	private boot(file: string): Promise<boolean> {
		this.worker?.terminate();
		const worker = new Worker(`/engine/${file}`);
		this.worker = worker;
		worker.onmessage = (e: MessageEvent) => {
			const line = String(e.data);
			for (const l of [...this.listeners]) l(line);
		};
		return new Promise<boolean>((resolve) => {
			let done = false;
			const finish = (ok: boolean) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				if (!ok) worker.terminate();
				resolve(ok);
			};
			const timer = setTimeout(() => finish(false), 4000);
			worker.onerror = (e) => {
				e.preventDefault();
				finish(false);
			};
			this.waitFor((l) => l === 'uciok').then(() => finish(true));
			worker.postMessage('uci');
		});
	}

	/** true, wenn die Engine innerhalb von 6 s antwortet */
	private async isReady(): Promise<boolean> {
		const p = this.waitFor((l) => l === 'readyok', 6000);
		this.send('isready');
		return (await p) !== null;
	}

	newGame(): Promise<void> {
		return this.enqueue(async () => {
			try {
				await this.init();
				this.send('ucinewgame');
				if (!(await this.isReady())) this.reset();
			} catch {
				this.reset();
			}
		});
	}

	/** Bricht den laufenden Auftrag ab (liefert dessen bisheriges Ergebnis) */
	stop(): void {
		this.current?.stop();
	}

	analyse(opts: AnalyseOptions): Promise<AnalyseResult> {
		return this.enqueue(() => this.run(opts));
	}

	private enqueue<T>(job: () => Promise<T>): Promise<T> {
		const next = this.queue.then(job, job);
		this.queue = next.catch(() => undefined);
		return next;
	}

	private async run(opts: AnalyseOptions): Promise<AnalyseResult> {
		const empty = { bestmove: null, lines: [] };
		try {
			await this.init();
		} catch {
			return empty;
		}
		if (opts.signal?.aborted) return empty;

		const multipv = opts.multipv ?? 1;
		this.send(`setoption name MultiPV value ${multipv}`);
		this.send(`setoption name Skill Level value ${opts.skill ?? 20}`);
		if (!(await this.isReady())) {
			this.reset();
			return empty;
		}

		const lines = new Map<number, PvLine>();
		let lastEmit = 0;

		return new Promise<AnalyseResult>((resolve) => {
			const onLine: Listener = (line) => {
				const info = parseInfo(line);
				if (info) {
					lines.set(info.multipv, info);
					const now = Date.now();
					if (opts.onInfo && now - lastEmit > 120) {
						lastEmit = now;
						opts.onInfo(sorted());
					}
					return;
				}
				if (line.startsWith('bestmove')) {
					const bm = line.split(' ')[1];
					done(bm && bm !== '(none)' ? bm : null);
				}
			};
			let finished = false;
			const done = (bestmove: string | null) => {
				if (finished) return;
				finished = true;
				clearTimeout(watchdog);
				this.listeners.delete(onLine);
				this.current = null;
				opts.signal?.removeEventListener('abort', abort);
				const res = { bestmove, lines: sorted() };
				opts.onInfo?.(res.lines);
				resolve(res);
			};
			// Watchdog: keine Antwort in vernünftiger Zeit → stoppen, notfalls Engine neu starten
			const budget =
				(opts.movetime ?? 0) + (opts.depth && !opts.nodes ? 30_000 : opts.nodes ? 10_000 : 30_000);
			const watchdog = setTimeout(() => {
				this.send('stop');
				setTimeout(() => {
					if (finished) return;
					this.reset();
					const best = sorted()[0]?.pv[0] ?? null;
					done(best);
				}, 1500);
			}, budget);
			const sorted = () => [...lines.values()].sort((a, b) => a.multipv - b.multipv);
			const abort = () => this.send('stop');
			this.current = { stop: abort };
			opts.signal?.addEventListener('abort', abort);
			this.listeners.add(onLine);

			this.send(`position fen ${opts.fen}`);
			const limits = [
				opts.depth ? `depth ${opts.depth}` : '',
				opts.nodes ? `nodes ${opts.nodes}` : '',
				opts.movetime ? `movetime ${opts.movetime}` : ''
			]
				.filter(Boolean)
				.join(' ');
			this.send(`go ${limits || 'depth 12'}`);
		});
	}
}

const SINGLE_KEY = 'rookie.engine.single';

function singleOnly(): boolean {
	try {
		return localStorage.getItem(SINGLE_KEY) === '1';
	} catch {
		return false;
	}
}

/** iPhone/iPad (auch iPadOS mit Desktop-UA): Multi-Thread-WASM ist dort unzuverlässig */
function isAppleMobile(): boolean {
	const ua = navigator.userAgent;
	return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export const engine = new EngineService();
