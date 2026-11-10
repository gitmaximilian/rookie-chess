/**
 * Baut die Puzzle-Pakete aus der Lichess-Puzzle-Datenbank (CC0).
 *
 *   curl -L -o .data/lichess_db_puzzle.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   node scripts/build-puzzles.ts
 *
 * Ergebnis: static/puzzles/index.json + p-<rating>.json (je 100er-Bereich, < 1 MB).
 * Format je Puzzle: [id, fen, moves, rating, [themeIndex…]]
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { THEMES } from '../src/lib/data/themes.ts';

const SRC = process.argv[2] ?? '.data/lichess_db_puzzle.csv.zst';
const OUT = 'static/puzzles';
const MIN = 400;
const MAX = 2000;

/** Anfänger-Schwerpunkt: mehr Puzzles in niedrigen Bereichen */
function quota(bucket: number): number {
	if (bucket < 1400) return 3000;
	if (bucket < 1700) return 1800;
	return 1000;
}

const themeIdx = new Map(THEMES.map((t, i) => [t.key, i]));
type Row = [string, string, string, number, number[]];
const reservoirs = new Map<number, { seen: number; rows: Row[] }>();

// deterministischer Zufall → reproduzierbare Pakete
let seed = 42;
const rand = () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};

if (!existsSync(SRC)) {
	console.error(`Quelle fehlt: ${SRC}`);
	process.exit(1);
}

const zstd = spawn('zstd', ['-dc', SRC]);
const rl = createInterface({ input: zstd.stdout });
let total = 0;
let kept = 0;
let header = true;

rl.on('line', (line) => {
	if (header) {
		header = false;
		return;
	}
	total++;
	const [id, fen, moves, rating, rd, pop, plays, themes] = line.split(',');
	const r = Number(rating);
	if (r < MIN || r >= MAX) return;
	if (Number(pop) < 85 || Number(plays) < 300 || Number(rd) > 90) return;
	const tIdx = themes
		.split(' ')
		.map((t) => themeIdx.get(t))
		.filter((x): x is number => x !== undefined);
	kept++;
	const bucket = Math.floor(r / 100) * 100;
	const q = quota(bucket);
	const res = reservoirs.get(bucket) ?? { seen: 0, rows: [] };
	res.seen++;
	const row: Row = [id, fen, moves, r, tIdx];
	if (res.rows.length < q) res.rows.push(row);
	else {
		const j = Math.floor(rand() * res.seen);
		if (j < q) res.rows[j] = row;
	}
	reservoirs.set(bucket, res);
});

rl.on('close', () => {
	rmSync(OUT, { recursive: true, force: true });
	mkdirSync(OUT, { recursive: true });
	const packs: { file: string; min: number; max: number; count: number; themes: number[] }[] = [];
	let bytes = 0;
	for (const bucket of [...reservoirs.keys()].sort((a, b) => a - b)) {
		const rows = reservoirs.get(bucket)!.rows.sort((a, b) => a[3] - b[3]);
		const file = `p-${String(bucket).padStart(4, '0')}.json`;
		const json = JSON.stringify(rows);
		bytes += json.length;
		writeFileSync(`${OUT}/${file}`, json);
		const themeCounts = new Array(THEMES.length).fill(0);
		for (const r of rows) for (const t of r[4]) themeCounts[t]++;
		packs.push({ file, min: bucket, max: bucket + 99, count: rows.length, themes: themeCounts });
	}
	writeFileSync(
		`${OUT}/index.json`,
		JSON.stringify({
			source: 'Lichess puzzle database (CC0) – database.lichess.org',
			built: new Date().toISOString().slice(0, 10),
			themes: THEMES.map((t) => t.key),
			packs
		})
	);
	const count = packs.reduce((a, p) => a + p.count, 0);
	console.log(
		`${total} Puzzles gelesen, ${kept} nach Filter, ${count} in ${packs.length} Paketen (${(bytes / 1e6).toFixed(1)} MB)`
	);
});
