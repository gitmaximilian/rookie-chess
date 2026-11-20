/**
 * Eichung des Skill-Pentas je Tempo. Rapid und Klassisch nutzen die Rapid/Classical-Eichung aus skills.ts;
 * Blitz und Bullet haben eigene Tabellen aus Lichess-Partien desselben Tempos (skill-speed-sample.mjs,
 * skill-study.mjs, skill-fit.mjs; Holdout mit skill-holdout.mjs – docs/research-2026-11-13.md, Nachtrag 20.11.).
 */
import type { PentaSpeed } from '#lib/import/ratings.js';
import { registerCalibration, SKILL_TABLE, type SkillTable } from './skills.js';

/** Lichess Blitz, Oktober 2025, 1 335 Partien, 12 Bänder (528–2696), Stockfish Tiefe 11 */
export const BLITZ_TABLE: SkillTable = registerCalibration(
	[
		{
			r: 528,
			safety: 5.39,
			tactics: 42.5,
			opening: 68.7,
			strategy: 81.7,
			endgame: 65.6,
			lpm: { safety: 4.142, tactics: 17.095, opening: 3.382, strategy: 4.406, endgame: 2.509 }
		},
		{
			r: 708,
			safety: 5.02,
			tactics: 46.1,
			opening: 72.3,
			strategy: 85.1,
			endgame: 65.6,
			lpm: { safety: 3.674, tactics: 15.145, opening: 2.917, strategy: 3.57, endgame: 2.509 }
		},
		{
			r: 902,
			safety: 4.06,
			tactics: 48.5,
			opening: 77.5,
			strategy: 85.1,
			endgame: 65.7,
			lpm: { safety: 2.825, tactics: 13.677, opening: 2.84, strategy: 3.57, endgame: 2.509 }
		},
		{
			r: 1105,
			safety: 3.17,
			tactics: 52.8,
			opening: 82.7,
			strategy: 86.1,
			endgame: 71.8,
			lpm: { safety: 2.164, tactics: 12.045, opening: 2.4, strategy: 3.301, endgame: 2.461 }
		},
		{
			r: 1305,
			safety: 2.87,
			tactics: 57.5,
			opening: 83.3,
			strategy: 87.5,
			endgame: 78,
			lpm: { safety: 1.995, tactics: 10.447, opening: 2.297, strategy: 2.995, endgame: 2.461 }
		},
		{
			r: 1497,
			safety: 2.54,
			tactics: 57.7,
			opening: 86.1,
			strategy: 87.5,
			endgame: 78,
			lpm: { safety: 1.738, tactics: 9.722, opening: 2.073, strategy: 2.995, endgame: 2.461 }
		},
		{
			r: 1702,
			safety: 2.54,
			tactics: 57.7,
			opening: 87.6,
			strategy: 87.5,
			endgame: 79.5,
			lpm: { safety: 1.738, tactics: 9.722, opening: 1.986, strategy: 2.995, endgame: 1.998 }
		},
		{
			r: 1891,
			safety: 2.52,
			tactics: 60.1,
			opening: 88.1,
			strategy: 87.7,
			endgame: 81.9,
			lpm: { safety: 1.67, tactics: 9.1, opening: 1.866, strategy: 2.938, endgame: 1.998 }
		},
		{
			r: 2086,
			safety: 1.93,
			tactics: 61.1,
			opening: 90.8,
			strategy: 89,
			endgame: 83.9,
			lpm: { safety: 1.373, tactics: 8.065, opening: 1.624, strategy: 2.568, endgame: 1.789 }
		},
		{
			r: 2294,
			safety: 1.86,
			tactics: 63.3,
			opening: 92.2,
			strategy: 89.9,
			endgame: 84.3,
			lpm: { safety: 1.222, tactics: 8.065, opening: 1.378, strategy: 2.313, endgame: 1.789 }
		},
		{
			r: 2481,
			safety: 1.42,
			tactics: 64,
			opening: 93.4,
			strategy: 90.9,
			endgame: 85.9,
			lpm: { safety: 0.939, tactics: 7.296, opening: 1.217, strategy: 2.112, endgame: 1.68 }
		},
		{
			r: 2696,
			safety: 1.05,
			tactics: 64,
			opening: 95.3,
			strategy: 91.4,
			endgame: 90.1,
			lpm: { safety: 0.547, tactics: 7.296, opening: 0.916, strategy: 1.928, endgame: 1.332 }
		}
	],
	{
		meanCount: { safety: 25.7, tactics: 3.9, opening: 9.7, strategy: 5.8, endgame: 4.4 },
		eloPerPoint: 12.2,
		// Holdout (59 Blitz-Spieler): Taktik ±508 Elo – schlechter als Raten (±480)
		hidden: ['tactics']
	}
);

/** Lichess Bullet, Oktober 2025, 1 324 Partien, 11 Bänder (724–2748; darunter kaum Bullet), Stockfish Tiefe 11 */
export const BULLET_TABLE: SkillTable = registerCalibration(
	[
		{
			r: 724,
			safety: 4.1,
			tactics: 52.4,
			opening: 77.9,
			strategy: 86,
			endgame: 69.4,
			lpm: { safety: 3.379, tactics: 12.364, opening: 2.553, strategy: 3.505, endgame: 2.972 }
		},
		{
			r: 900,
			safety: 3.37,
			tactics: 52.4,
			opening: 79.6,
			strategy: 86,
			endgame: 72,
			lpm: { safety: 2.443, tactics: 12.364, opening: 2.524, strategy: 3.505, endgame: 2.843 }
		},
		{
			r: 1100,
			safety: 3.21,
			tactics: 52.4,
			opening: 82.3,
			strategy: 86,
			endgame: 72,
			lpm: { safety: 2.368, tactics: 12.364, opening: 2.391, strategy: 3.505, endgame: 2.843 }
		},
		{
			r: 1298,
			safety: 3.09,
			tactics: 52.4,
			opening: 83.8,
			strategy: 86.5,
			endgame: 72,
			lpm: { safety: 2.055, tactics: 12.271, opening: 2.258, strategy: 3.197, endgame: 2.843 }
		},
		{
			r: 1504,
			safety: 3.09,
			tactics: 52.4,
			opening: 83.8,
			strategy: 86.5,
			endgame: 75.7,
			lpm: { safety: 2.055, tactics: 11.543, opening: 2.258, strategy: 3.132, endgame: 2.507 }
		},
		{
			r: 1704,
			safety: 3.02,
			tactics: 52.4,
			opening: 85.6,
			strategy: 86.5,
			endgame: 75.7,
			lpm: { safety: 1.957, tactics: 11.543, opening: 2.203, strategy: 3.132, endgame: 2.507 }
		},
		{
			r: 1897,
			safety: 3.02,
			tactics: 53.6,
			opening: 85.6,
			strategy: 86.6,
			endgame: 75.7,
			lpm: { safety: 1.957, tactics: 11.543, opening: 2.148, strategy: 3.132, endgame: 2.507 }
		},
		{
			r: 2103,
			safety: 2.65,
			tactics: 53.6,
			opening: 87.2,
			strategy: 87.3,
			endgame: 78.6,
			lpm: { safety: 1.825, tactics: 11.2, opening: 1.95, strategy: 2.892, endgame: 2.257 }
		},
		{
			r: 2286,
			safety: 2.58,
			tactics: 53.6,
			opening: 87.2,
			strategy: 87.3,
			endgame: 78.6,
			lpm: { safety: 1.693, tactics: 11.2, opening: 1.894, strategy: 2.892, endgame: 1.97 }
		},
		{
			r: 2486,
			safety: 2.42,
			tactics: 55,
			opening: 90,
			strategy: 88.8,
			endgame: 78.6,
			lpm: { safety: 1.617, tactics: 10.945, opening: 1.646, strategy: 2.559, endgame: 1.97 }
		},
		{
			r: 2748,
			safety: 1.9,
			tactics: 59,
			opening: 90.5,
			strategy: 89.5,
			endgame: 83.3,
			lpm: { safety: 1.233, tactics: 9.304, opening: 1.566, strategy: 2.461, endgame: 1.801 }
		}
	],
	{
		meanCount: { safety: 22.4, tactics: 3.7, opening: 9.6, strategy: 4.7, endgame: 2.3 },
		eloPerPoint: 29.1
	}
);

export const SKILL_TABLES: Record<PentaSpeed, SkillTable> = {
	rapid: SKILL_TABLE,
	classical: SKILL_TABLE,
	blitz: BLITZ_TABLE,
	bullet: BULLET_TABLE
};

export const tableFor = (speed: PentaSpeed): SkillTable => SKILL_TABLES[speed];
