/**
 * Glicko-2 (Mark Glickman, 2012) – kompakte Implementierung für ein Rating
 * gegen einzelne Gegner (z. B. Puzzles). Skala wie bei Lichess.
 */
export interface Rating {
	rating: number;
	rd: number;
	vol: number;
}

export interface Opponent {
	rating: number;
	rd: number;
	/** 1 = gewonnen, 0.5 = remis, 0 = verloren */
	score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 0.000001;

export const DEFAULT_RATING: Rating = { rating: 1500, rd: 350, vol: 0.06 };
/** Startwert für Anfänger */
export const BEGINNER_RATING: Rating = { rating: 800, rd: 250, vol: 0.06 };

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

export function update(player: Rating, opponents: Opponent[]): Rating {
	const mu = (player.rating - 1500) / SCALE;
	const phi = player.rd / SCALE;
	const sigma = player.vol;

	if (opponents.length === 0) {
		const phiStar = Math.sqrt(phi * phi + sigma * sigma);
		return { rating: player.rating, rd: Math.min(350, phiStar * SCALE), vol: sigma };
	}

	const ops = opponents.map((o) => ({
		mu: (o.rating - 1500) / SCALE,
		phi: o.rd / SCALE,
		s: o.score
	}));

	let vInv = 0;
	let deltaSum = 0;
	for (const o of ops) {
		const gp = g(o.phi);
		const e = E(mu, o.mu, o.phi);
		vInv += gp * gp * e * (1 - e);
		deltaSum += gp * (o.s - e);
	}
	const v = 1 / vInv;
	const delta = v * deltaSum;

	// Neue Volatilität (Illinois-Verfahren)
	const a = Math.log(sigma * sigma);
	const f = (x: number) => {
		const ex = Math.exp(x);
		const num = ex * (delta * delta - phi * phi - v - ex);
		const den = 2 * Math.pow(phi * phi + v + ex, 2);
		return num / den - (x - a) / (TAU * TAU);
	};
	let A = a;
	let B: number;
	if (delta * delta > phi * phi + v) {
		B = Math.log(delta * delta - phi * phi - v);
	} else {
		let k = 1;
		while (f(a - k * TAU) < 0) k++;
		B = a - k * TAU;
	}
	let fA = f(A);
	let fB = f(B);
	while (Math.abs(B - A) > EPS) {
		const C = A + ((A - B) * fA) / (fB - fA);
		const fC = f(C);
		if (fC * fB <= 0) {
			A = B;
			fA = fB;
		} else {
			fA = fA / 2;
		}
		B = C;
		fB = fC;
	}
	const newSigma = Math.exp(A / 2);

	const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
	const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
	const newMu = mu + newPhi * newPhi * deltaSum;

	return {
		rating: newMu * SCALE + 1500,
		// Untergrenze, damit das Rating beweglich bleibt
		rd: Math.max(45, Math.min(350, newPhi * SCALE)),
		vol: Math.min(newSigma, 0.1)
	};
}

/** Ergebnis für ein einzelnes Puzzle */
export function updateForPuzzle(player: Rating, puzzleRating: number, solved: boolean): Rating {
	return update(player, [{ rating: puzzleRating, rd: 75, score: solved ? 1 : 0 }]);
}
