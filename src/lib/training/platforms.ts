/**
 * Umrechnung zwischen Lichess- und Chess.com-Wertungen (Rapid), gemessen statt geschätzt.
 *
 * Messung (docs/research-2026-11-13.md, Nachtrag 21.11.2026; scripts/research/chesscom-sample.mjs und
 * clock-study.mjs): echte Chess.com-Spieler aus den öffentlichen Länderlisten, je Band 200–2200 bis zu 8, je 12–20
 * Rapid-Partien, mit derselben Stockfish-Analyse wie in der App. Ihr Penta-Gesamtniveau (Lichess-Skala) gegen ihre
 * Chess.com-Wertung ergibt die lineare Umrechnung. Bis 0.9.0 galt pauschal Chess.com + 150.
 */
export const CHESSCOM_FIT = { a: -608, b: 1.209 };

/** Lichess-Elo → Chess.com-Rapid (auf 25 gerundet) */
export function toChessCom(lichess: number): number {
	return Math.max(100, Math.round((CHESSCOM_FIT.a + CHESSCOM_FIT.b * lichess) / 25) * 25);
}

/** Chess.com-Rapid → Lichess-Skala (an ihr sind Penta, Stufen und Schwellen geeicht) */
export function fromChessCom(chesscom: number): number {
	return Math.round((chesscom - CHESSCOM_FIT.a) / CHESSCOM_FIT.b);
}

/** Elo-Angabe auf der Lichess-Skala, für Chess.com-Spieler mit ihrer Entsprechung („1200 (Chess.com ≈ 850)“) */
export function eloFor(lichess: number, chesscom: boolean): string {
	return chesscom ? `${lichess} (Chess.com ≈ ${toChessCom(lichess)})` : String(lichess);
}
