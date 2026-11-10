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

	private waitFor(pred: (line: string) => boolean): Promise<string> {
		return new Promise((resolve) => {
			const l: Listener = (line) => {
				if (pred(line)) {
					this.listeners.delete(l);
					resolve(line);
				}
			};
			this.listeners.add(l);
		});
	}

	init(): Promise<void> {
		if (this.ready) return this.ready;
		this.ready = (async () => {
			const canThread =
				typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated === true;
			this.multiThreaded = canThread && (await this.boot('stockfish-19-lite.js'));
			// Rückfall: Single-Thread läuft überall
			if (!this.multiThreaded) await this.boot('stockfish-19-lite-single.js');
			if (this.multiThreaded) {
				// Akku & Wärme schonen: höchstens 2 Threads auf Mobilgeräten, 4 sonst
				const cores = navigator.hardwareConcurrency || 2;
				const mobile = /iPhone|iPad|Android/.test(navigator.userAgent);
				const threads = Math.max(1, Math.min(mobile ? 2 : 4, cores - 1));
				this.send(`setoption name Threads value ${threads}`);
			}
			this.send('setoption name Hash value 16');
			await this.isReady();
		})();
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

	private isReady(): Promise<void> {
		const p = this.waitFor((l) => l === 'readyok');
		this.send('isready');
		return p.then(() => undefined);
	}

	newGame(): Promise<void> {
		return this.enqueue(async () => {
			await this.init();
			this.send('ucinewgame');
			await this.isReady();
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
		await this.init();
		if (opts.signal?.aborted) return { bestmove: null, lines: [] };

		const multipv = opts.multipv ?? 1;
		this.send(`setoption name MultiPV value ${multipv}`);
		this.send(`setoption name Skill Level value ${opts.skill ?? 20}`);
		await this.isReady();

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
					this.listeners.delete(onLine);
					this.current = null;
					opts.signal?.removeEventListener('abort', abort);
					const bm = line.split(' ')[1];
					const res = { bestmove: bm && bm !== '(none)' ? bm : null, lines: sorted() };
					opts.onInfo?.(res.lines);
					resolve(res);
				}
			};
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

export const engine = new EngineService();
