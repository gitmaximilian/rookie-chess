import { parseSan } from 'chessops/san';
import { makeUci, parseUci, makeSquare } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { makeFen } from 'chessops/fen';
import type { Chess } from 'chessops/chess';
import { positionFromFen, INITIAL_FEN } from '#lib/chess/game.js';
import { figurineText } from '#lib/chess/notation.js';
import { i18n, t } from '#lib/i18n/i18n.svelte.js';
import type { Side } from './repertoire.js';

/** Stellung ohne Zugzähler (wie repertoire.fenKey – hier dupliziert gegen zyklische Importe) */
const fenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** Text in beiden Sprachen – Kursinhalte stehen direkt hier statt im Wörterbuch */
export interface L {
	en: string;
	de: string;
}

export function loc(l: L | undefined): string {
	if (!l) return '';
	// Züge im Text mit Figurensymbolen – wie am Brett, unabhängig von der Sprache
	return figurineText(i18n.locale === 'de' ? l.de : l.en);
}

const N = (en: string, de: string): L => ({ en, de });

export interface CourseLine {
	id: string;
	name: L;
	/** Züge in SAN ab der Grundstellung, durch Leerzeichen getrennt */
	moves: string;
	/** Erklärungen je Halbzug (0 = 1. Zug von Weiß) */
	notes: Record<number, L>;
}

export interface Course {
	id: string;
	color: Side;
	/** gegen welchen ersten Zug (bei Schwarz) bzw. womit (bei Weiß) */
	group: 'e4' | 'd4';
	level: 1 | 2 | 3;
	name: L;
	tagline: L;
	/** die großen Ideen – werden vor dem Lernen gezeigt */
	ideas: L[];
	lines: CourseLine[];
}

export const COURSES: Course[] = [
	// ───────────────────────────── Weiß ─────────────────────────────
	{
		id: 'italian',
		color: 'white',
		group: 'e4',
		level: 1,
		name: N('Italian Game', 'Italienische Partie'),
		tagline: N(
			'1.e4 e5 2.Nf3 Nc6 3.Bc4 – fast development, eyes on f7.',
			'1.e4 e5 2.Sf3 Sc6 3.Lc4 – schnelle Entwicklung, Blick auf f7.'
		),
		ideas: [
			N(
				'Develop knights and bishops quickly, then castle.',
				'Springer und Läufer schnell entwickeln, dann rochieren.'
			),
			N(
				'The bishop on c4 aims at f7 – the weakest square near Black’s king.',
				'Der Läufer auf c4 zielt auf f7 – das schwächste Feld vor dem schwarzen König.'
			),
			N(
				'Plan: c3 and d4 to build a strong pawn centre.',
				'Plan: c3 und d4, um ein starkes Bauernzentrum aufzubauen.'
			)
		],
		lines: [
			{
				id: 'piano',
				name: N('Giuoco Piano', 'Giuoco Piano'),
				moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3',
				notes: {
					0: N(
						'Take the centre and open lines for your queen and bishop.',
						'Besetzt das Zentrum und öffnet Linien für Dame und Läufer.'
					),
					1: N('Black claims the centre too.', 'Schwarz besetzt ebenfalls das Zentrum.'),
					2: N(
						'Develop with tempo: the knight attacks the pawn on e5.',
						'Entwickeln mit Tempo: Der Springer greift den Bauern auf e5 an.'
					),
					3: N('Black defends e5 by developing.', 'Schwarz deckt e5 und entwickelt dabei.'),
					4: N(
						'The bishop aims at f7 – only Black’s king protects that square.',
						'Der Läufer zielt auf f7 – dieses Feld deckt nur der schwarze König.'
					),
					5: N(
						'Black copies you: the bishop eyes f2.',
						'Schwarz spiegelt: Der Läufer zielt auf f2.'
					),
					6: N(
						'Prepare d4 – you want a big pawn centre.',
						'Bereitet d4 vor – du willst ein großes Bauernzentrum.'
					),
					7: N('Black attacks your e4 pawn.', 'Schwarz greift deinen Bauern auf e4 an.'),
					8: N(
						'Calm and solid: protect e4. You can play d4 later.',
						'Ruhig und solide: e4 decken. d4 kommt später.'
					),
					10: N(
						'Castle early: your king is safe and the rook joins the game.',
						'Früh rochieren: Der König steht sicher, der Turm kommt ins Spiel.'
					),
					12: N('The rook supports e4 and prepares d4.', 'Der Turm stützt e4 und bereitet d4 vor.'),
					13: N('Black prepares …b5 or …Ba7.', 'Schwarz bereitet …b5 oder …La7 vor.'),
					14: N(
						'Step back before …b5 or …d5 come with tempo – the bishop keeps aiming at f7.',
						'Rückzug, bevor …b5 oder …d5 mit Tempo kommen – der Läufer zielt weiter auf f7.'
					)
				}
			},
			{
				id: 'two-knights',
				name: N('Two Knights Defence', 'Zweispringerspiel'),
				moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
				notes: {
					5: N(
						'Black counter-attacks e4 instead of copying you.',
						'Schwarz greift e4 an, statt dich zu kopieren.'
					),
					6: N(
						'Protect e4. The sharp Ng5 exists, but d3 gives you an easy, safe game.',
						'e4 decken. Das scharfe Sg5 gibt es auch, aber d3 führt zu einem einfachen, sicheren Spiel.'
					),
					7: N('A modest, solid setup.', 'Ein bescheidener, solider Aufbau.'),
					8: N('Bring your king to safety.', 'Bring deinen König in Sicherheit.'),
					10: N('The rook goes to the centre file.', 'Der Turm geht auf die Zentrumslinie.'),
					12: N(
						'Same plan as always: c3, then d4 – or Nbd2–f1–g3 towards Black’s king.',
						'Derselbe Plan wie immer: c3, dann d4 – oder Sbd2–f1–g3 Richtung Königsflügel.'
					)
				}
			},
			{
				id: 'philidor',
				name: N('Against the Philidor (2…d6)', 'Gegen Philidor (2…d6)'),
				moves: 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O O-O',
				notes: {
					3: N(
						'Black protects e5 with a pawn – solid, but passive.',
						'Schwarz deckt e5 mit einem Bauern – solide, aber passiv.'
					),
					4: N(
						'Strike in the centre while Black is passive.',
						'Schlag im Zentrum zu, solange Schwarz passiv steht.'
					),
					5: N('Black gives up the centre.', 'Schwarz gibt das Zentrum auf.'),
					6: N(
						'Recapture – your knight is strong in the centre.',
						'Zurückschlagen – dein Springer steht stark im Zentrum.'
					),
					8: N('Develop and defend e4.', 'Entwickeln und e4 decken.'),
					10: N('Simple development, then castle.', 'Einfach entwickeln, dann rochieren.'),
					12: N(
						'You have more space and an easy game.',
						'Du hast mehr Raum und ein einfaches Spiel.'
					)
				}
			}
		]
	},
	{
		id: 'scotch',
		color: 'white',
		group: 'e4',
		level: 1,
		name: N('Scotch Game', 'Schottische Partie'),
		tagline: N(
			'1.e4 e5 2.Nf3 Nc6 3.d4 – open the centre straight away.',
			'1.e4 e5 2.Sf3 Sc6 3.d4 – das Zentrum sofort öffnen.'
		),
		ideas: [
			N(
				'Open the position early with d4 – your pieces get active squares.',
				'Die Stellung früh mit d4 öffnen – deine Figuren bekommen aktive Felder.'
			),
			N(
				'Your knight on d4 dominates the centre; keep it protected.',
				'Dein Springer auf d4 beherrscht das Zentrum – halte ihn gedeckt.'
			),
			N(
				'Against …Nf6, trade on c6 and push e5 to gain space.',
				'Gegen …Sf6: auf c6 tauschen und mit e5 Raum gewinnen.'
			)
		],
		lines: [
			{
				id: 'classical',
				name: N('Classical (4…Bc5)', 'Klassisch (4…Lc5)'),
				moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4',
				notes: {
					4: N(
						'The Scotch: open the centre immediately.',
						'Die Schottische: das Zentrum sofort öffnen.'
					),
					5: N('Black has to take.', 'Schwarz muss nehmen.'),
					6: N(
						'Recapture – your knight now rules the centre.',
						'Zurückschlagen – dein Springer beherrscht jetzt das Zentrum.'
					),
					7: N('Black attacks the knight.', 'Schwarz greift den Springer an.'),
					8: N(
						'Defend the knight and develop at the same time.',
						'Den Springer decken und gleichzeitig entwickeln.'
					),
					9: N('Black adds pressure on d4.', 'Schwarz erhöht den Druck auf d4.'),
					10: N(
						'Support the knight with a pawn – now it is rock solid.',
						'Den Springer mit einem Bauern stützen – jetzt steht er felsenfest.'
					),
					12: N('Develop and prepare to castle.', 'Entwickeln und die Rochade vorbereiten.')
				}
			},
			{
				id: 'mieses',
				name: N('Against 4…Nf6', 'Gegen 4…Sf6'),
				moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4',
				notes: {
					7: N('Black attacks e4.', 'Schwarz greift e4 an.'),
					8: N(
						'Trade first – this weakens Black’s pawns.',
						'Erst tauschen – das schwächt die schwarzen Bauern.'
					),
					10: N(
						'Gain space with tempo – the knight has to move.',
						'Raum gewinnen mit Tempo – der Springer muss weg.'
					),
					11: N(
						'Black pins your e-pawn to the king.',
						'Schwarz fesselt deinen e-Bauern an den König.'
					),
					12: N('Break the pin and defend e5.', 'Fesselung aufheben und e5 decken.'),
					13: N('The knight jumps to the centre.', 'Der Springer springt ins Zentrum.'),
					14: N(
						'Kick it again – you gain even more space.',
						'Ihn erneut vertreiben – du gewinnst noch mehr Raum.'
					)
				}
			}
		]
	},
	{
		id: 'ruy',
		color: 'white',
		group: 'e4',
		level: 2,
		name: N('Ruy Lopez', 'Spanische Partie'),
		tagline: N(
			'1.e4 e5 2.Nf3 Nc6 3.Bb5 – long-term pressure on e5.',
			'1.e4 e5 2.Sf3 Sc6 3.Lb5 – langfristiger Druck auf e5.'
		),
		ideas: [
			N(
				'The bishop attacks the knight that defends e5.',
				'Der Läufer greift den Springer an, der e5 deckt.'
			),
			N(
				'Castle quickly – e4 is protected by tactics at first.',
				'Schnell rochieren – e4 ist anfangs taktisch gedeckt.'
			),
			N('Plan: c3, h3 and d4 for a big centre.', 'Plan: c3, h3 und d4 für ein großes Zentrum.')
		],
		lines: [
			{
				id: 'main',
				name: N('Main line (3…a6)', 'Hauptvariante (3…a6)'),
				moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
				notes: {
					4: N(
						'The Spanish bishop: pressure on the defender of e5.',
						'Der spanische Läufer: Druck auf den Verteidiger von e5.'
					),
					5: N('Black asks: take or retreat?', 'Schwarz fragt: nehmen oder zurückziehen?'),
					6: N('Keep the pressure.', 'Den Druck aufrechterhalten.'),
					8: N(
						'Castle – if …Nxe4, Re1 wins the pawn back.',
						'Rochieren – nach …Sxe4 holt Te1 den Bauern zurück.'
					),
					10: N('Now e4 is protected directly.', 'Jetzt ist e4 direkt gedeckt.'),
					11: N('Black chases the bishop away.', 'Schwarz verjagt den Läufer.'),
					12: N(
						'The bishop finds a great diagonal towards f7.',
						'Der Läufer findet eine tolle Diagonale Richtung f7.'
					),
					14: N(
						'Prepares d4 and gives the bishop a retreat on c2.',
						'Bereitet d4 vor und gibt dem Läufer ein Rückzugsfeld auf c2.'
					),
					16: N('Stops …Bg4 before you play d4.', 'Verhindert …Lg4, bevor du d4 spielst.')
				}
			},
			{
				id: 'berlin',
				name: N('Berlin Defence', 'Berliner Verteidigung'),
				moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+',
				notes: {
					5: N('The Berlin: Black attacks e4.', 'Die Berliner: Schwarz greift e4 an.'),
					6: N(
						'Don’t worry about e4 – you will win it back.',
						'Keine Sorge um e4 – du holst ihn zurück.'
					),
					8: N(
						'Open the centre while Black’s king is still there.',
						'Das Zentrum öffnen, solange der schwarze König dort steht.'
					),
					10: N('Remove the defender.', 'Den Verteidiger beseitigen.'),
					12: N(
						'Pawn regained – with tempo on the knight.',
						'Bauer zurückgewonnen – mit Tempo gegen den Springer.'
					),
					14: N(
						'Queens off: Black’s king can no longer castle – your long-term plus.',
						'Damentausch: Der schwarze König kann nicht mehr rochieren – dein langfristiger Vorteil.'
					)
				}
			}
		]
	},
	{
		id: 'london',
		color: 'white',
		group: 'd4',
		level: 1,
		name: N('London System', 'London-System'),
		tagline: N(
			'1.d4 with Bf4 – the same setup against almost everything.',
			'1.d4 mit Lf4 – derselbe Aufbau gegen fast alles.'
		),
		ideas: [
			N(
				'Get the bishop to f4 before playing e3.',
				'Den Läufer nach f4 bringen, bevor du e3 spielst.'
			),
			N(
				'Build the pyramid c3–d4–e3: very hard to break.',
				'Die Pyramide c3–d4–e3 aufbauen: sehr schwer zu knacken.'
			),
			N(
				'Then Nf3, Nbd2, Bd3, castle – and attack later.',
				'Dann Sf3, Sbd2, Ld3, rochieren – und später angreifen.'
			)
		],
		lines: [
			{
				id: 'vs-d5',
				name: N('Against 1…d5', 'Gegen 1…d5'),
				moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
				notes: {
					0: N('Take the centre with the d-pawn.', 'Das Zentrum mit dem d-Bauern besetzen.'),
					2: N(
						'The London bishop – out before e3 locks it in.',
						'Der London-Läufer – raus, bevor e3 ihn einsperrt.'
					),
					4: N(
						'Solid pawn chain; the bishop stays active outside it.',
						'Solide Bauernkette; der Läufer bleibt aktiv davor.'
					),
					6: N('Develop the knight.', 'Den Springer entwickeln.'),
					7: N('Black attacks your centre.', 'Schwarz greift dein Zentrum an.'),
					8: N('The c3–d4–e3 pyramid: very solid.', 'Die Pyramide c3–d4–e3: sehr solide.'),
					10: N(
						'Knight to d2 – it supports e4 later and keeps the structure.',
						'Springer nach d2 – unterstützt später e4 und hält die Struktur.'
					),
					11: N(
						'Black challenges your best bishop.',
						'Schwarz fordert deinen besten Läufer heraus.'
					),
					12: N(
						'Keep the bishop. If Black takes, the h-file opens for your rook.',
						'Den Läufer behalten. Nimmt Schwarz, öffnet sich die h-Linie für deinen Turm.'
					),
					14: N(
						'Bishop aims at Black’s king. Next: castle.',
						'Der Läufer zielt auf den schwarzen König. Als Nächstes: rochieren.'
					)
				}
			},
			{
				id: 'vs-kid',
				name: N('Against …g6', 'Gegen …g6'),
				moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3',
				notes: {
					3: N('Black prepares a fianchetto.', 'Schwarz bereitet ein Fianchetto vor.'),
					4: N('Your usual setup.', 'Dein gewohnter Aufbau.'),
					8: N(
						'Against …g6 the bishop is safer on e2.',
						'Gegen …g6 steht der Läufer auf e2 sicherer.'
					),
					10: N(
						'Gives your bishop a retreat on h2 against …Nh5. Next: O-O.',
						'Gibt deinem Läufer ein Rückzugsfeld auf h2 gegen …Sh5. Danach: O-O.'
					)
				}
			},
			{
				id: 'vs-e6',
				name: N('Against …e6 and …c5', 'Gegen …e6 und …c5'),
				moves: 'd4 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nd2 d5 Ngf3 Bd6 Bg3 O-O Bd3',
				notes: {
					5: N('Black hits the centre.', 'Schwarz greift das Zentrum an.'),
					6: N('The pyramid again.', 'Wieder die Pyramide.'),
					8: N(
						'Knight to d2 first, then the other knight to f3.',
						'Erst Springer nach d2, dann der andere nach f3.'
					),
					12: N('Keep your bishop.', 'Behalte deinen Läufer.'),
					14: N(
						'Same picture as always – then castle.',
						'Dasselbe Bild wie immer – dann rochieren.'
					)
				}
			}
		]
	},
	{
		id: 'queens-gambit',
		color: 'white',
		group: 'd4',
		level: 2,
		name: N('Queen’s Gambit', 'Damengambit'),
		tagline: N(
			'1.d4 d5 2.c4 – fight for the centre with a pawn offer.',
			'1.d4 d5 2.c4 – Kampf ums Zentrum mit einem Bauernangebot.'
		),
		ideas: [
			N(
				'c4 attacks d5 – Black’s strongest centre pawn.',
				'c4 greift d5 an – den stärksten Zentrumsbauern von Schwarz.'
			),
			N(
				'If Black takes on c4, you win the pawn back easily.',
				'Nimmt Schwarz auf c4, holst du den Bauern leicht zurück.'
			),
			N(
				'Develop with Nc3, Nf3, Bg5 and use the c-file.',
				'Mit Sc3, Sf3, Lg5 entwickeln und die c-Linie nutzen.'
			)
		],
		lines: [
			{
				id: 'qgd',
				name: N('Declined (2…e6)', 'Abgelehnt (2…e6)'),
				moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1',
				notes: {
					2: N(
						'The gambit: pull Black’s d-pawn away from the centre.',
						'Das Gambit: den schwarzen d-Bauern vom Zentrum weglocken.'
					),
					3: N(
						'Declined: Black holds d5 with a pawn.',
						'Abgelehnt: Schwarz hält d5 mit einem Bauern.'
					),
					4: N('More pressure on d5.', 'Mehr Druck auf d5.'),
					6: N('Pin the knight that defends d5.', 'Den Springer fesseln, der d5 deckt.'),
					8: N(
						'Open the way for your light bishop.',
						'Den Weg für deinen weißfeldrigen Läufer öffnen.'
					),
					10: N('Develop and prepare castling.', 'Entwickeln und die Rochade vorbereiten.'),
					12: N(
						'The rook goes to the c-file, which often opens up.',
						'Der Turm geht auf die c-Linie, die sich oft öffnet.'
					)
				}
			},
			{
				id: 'qga',
				name: N('Accepted (2…dxc4)', 'Angenommen (2…dxc4)'),
				moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O',
				notes: {
					3: N(
						'Accepted – but Black can’t keep the pawn.',
						'Angenommen – aber Schwarz kann den Bauern nicht halten.'
					),
					4: N(
						'Develop first – this also stops …e5.',
						'Erst entwickeln – das verhindert auch …e5.'
					),
					6: N(
						'Opens your bishop to take back on c4.',
						'Öffnet deinen Läufer, um auf c4 zurückzuschlagen.'
					),
					8: N(
						'Pawn regained – and you have the bigger centre.',
						'Bauer zurück – und du hast das größere Zentrum.'
					),
					10: N('Safe king, easy game.', 'Sicherer König, einfaches Spiel.')
				}
			},
			{
				id: 'slav',
				name: N('Against the Slav (2…c6)', 'Gegen Slawisch (2…c6)'),
				moves: 'd4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Nc3 e6 Nh4',
				notes: {
					3: N(
						'The Slav: d5 is supported by the c-pawn.',
						'Slawisch: d5 wird vom c-Bauern gestützt.'
					),
					6: N('Solid – protects c4.', 'Solide – deckt c4.'),
					7: N(
						'Black brings the bishop out before …e6.',
						'Schwarz bringt den Läufer vor …e6 heraus.'
					),
					10: N(
						'Hunt the bishop – the bishop pair is a long-term advantage.',
						'Jag den Läufer – das Läuferpaar ist ein langfristiger Vorteil.'
					)
				}
			}
		]
	},

	// ──────────────────────── Schwarz gegen 1.e4 ────────────────────────
	{
		id: 'e5',
		color: 'black',
		group: 'e4',
		level: 1,
		name: N('1…e5 – classical', '1…e5 – klassisch'),
		tagline: N(
			'Answer 1.e4 with e5 and develop naturally.',
			'1.e4 mit e5 beantworten und natürlich entwickeln.'
		),
		ideas: [
			N(
				'Hold your e5 pawn and develop knights before bishops.',
				'Halte deinen Bauern e5 und entwickle Springer vor Läufern.'
			),
			N(
				'Always watch f7 – it is your weakest square early on.',
				'Behalte immer f7 im Blick – anfangs dein schwächstes Feld.'
			),
			N(
				'Castle early and strike back with …d5 when possible.',
				'Früh rochieren und wenn möglich mit …d5 zurückschlagen.'
			)
		],
		lines: [
			{
				id: 'vs-italian',
				name: N('Against the Italian', 'Gegen Italienisch'),
				moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
				notes: {
					1: N('Fight for the centre symmetrically.', 'Symmetrisch um das Zentrum kämpfen.'),
					2: N('White attacks e5.', 'Weiß greift e5 an.'),
					3: N('Develop and defend e5.', 'Entwickeln und e5 decken.'),
					4: N('White eyes f7.', 'Weiß zielt auf f7.'),
					5: N('Active bishop, aiming at f2.', 'Aktiver Läufer, zielt auf f2.'),
					7: N('Attack e4 and get ready to castle.', 'e4 angreifen und die Rochade vorbereiten.'),
					9: N(
						'Solid: supports e5 and frees your light bishop.',
						'Solide: stützt e5 und befreit deinen weißfeldrigen Läufer.'
					),
					11: N('King safe – a comfortable position.', 'König sicher – eine bequeme Stellung.')
				}
			},
			{
				id: 'vs-scholar',
				name: N('Against early Qh5', 'Gegen frühes Dh5'),
				moves: 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6',
				notes: {
					2: N(
						'Careful: the queen attacks e5 and eyes f7.',
						'Vorsicht: Die Dame greift e5 an und zielt auf f7.'
					),
					3: N('Defend e5 first.', 'Erst e5 decken.'),
					4: N('Now White threatens Qxf7 checkmate!', 'Jetzt droht Weiß Dxf7 matt!'),
					5: N(
						'Block the queen’s path to f7 – with tempo on the queen.',
						'Den Weg der Dame nach f7 sperren – mit Tempo gegen die Dame.'
					),
					6: N('Again the threat is Qxf7 mate.', 'Wieder droht Dxf7 matt.'),
					7: N(
						'The knight blocks the f-file and develops – f7 is safe, and you are better.',
						'Der Springer sperrt die f-Linie und entwickelt sich – f7 ist sicher, und du stehst besser.'
					)
				}
			},
			{
				id: 'vs-ruy',
				name: N('Against the Ruy Lopez', 'Gegen Spanisch'),
				moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6',
				notes: {
					4: N('White pressures your knight.', 'Weiß setzt deinen Springer unter Druck.'),
					5: N('Ask the bishop right away.', 'Den Läufer sofort fragen.'),
					7: N('Develop with an attack on e4.', 'Entwickeln mit Angriff auf e4.'),
					9: N('Calm development; prepare to castle.', 'Ruhig entwickeln; Rochade vorbereiten.'),
					11: N(
						'Now that e4 is protected, get rid of the annoying bishop.',
						'Jetzt, da e4 gedeckt ist, den lästigen Läufer vertreiben.'
					),
					13: N('Support e5. Next: castle.', 'e5 stützen. Danach: rochieren.')
				}
			},
			{
				id: 'vs-scotch',
				name: N('Against the Scotch', 'Gegen Schottisch'),
				moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nc3 Bb4 Nxc6 bxc6 Bd3 d5',
				notes: {
					5: N('Take – you can’t hold e5 anyway.', 'Nehmen – e5 lässt sich ohnehin nicht halten.'),
					7: N('Attack e4.', 'e4 angreifen.'),
					9: N('Pin the knight that defends e4.', 'Den Springer fesseln, der e4 deckt.'),
					11: N('Recapture towards the centre.', 'Zum Zentrum hin zurückschlagen.'),
					13: N(
						'Strike back in the centre – you are doing fine.',
						'Im Zentrum zurückschlagen – du stehst gut.'
					)
				}
			}
		]
	},
	{
		id: 'caro',
		color: 'black',
		group: 'e4',
		level: 1,
		name: N('Caro-Kann', 'Caro-Kann'),
		tagline: N('1.e4 c6 – solid and safe.', '1.e4 c6 – solide und sicher.'),
		ideas: [
			N('…c6 prepares …d5 with support.', '…c6 bereitet ein gestütztes …d5 vor.'),
			N(
				'Develop the light bishop (…Bf5 or …Bg4) before playing …e6.',
				'Den weißfeldrigen Läufer (…Lf5 oder …Lg4) entwickeln, bevor du …e6 spielst.'
			),
			N(
				'Against e5, attack the pawn chain with …c5.',
				'Gegen e5 die Bauernkette mit …c5 angreifen.'
			)
		],
		lines: [
			{
				id: 'classical',
				name: N('Classical (3.Nc3)', 'Klassisch (3.Sc3)'),
				moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
				notes: {
					1: N('Prepare …d5 with support.', 'Ein gestütztes …d5 vorbereiten.'),
					3: N('Challenge the centre.', 'Das Zentrum herausfordern.'),
					5: N('Release the tension.', 'Die Spannung auflösen.'),
					7: N(
						'Bishop out before …e6 – the key idea of the Caro-Kann.',
						'Läufer raus vor …e6 – die Kernidee des Caro-Kann.'
					),
					8: N('White chases the bishop.', 'Weiß jagt den Läufer.'),
					9: N('Stay on the diagonal.', 'Auf der Diagonale bleiben.'),
					10: N(
						'White threatens h5 to trap your bishop.',
						'Weiß droht h5, um deinen Läufer einzusperren.'
					),
					11: N('Give the bishop a retreat square.', 'Dem Läufer ein Rückzugsfeld geben.'),
					13: N(
						'Prepare …Ngf6 and keep Ne5 under control.',
						'…Sgf6 vorbereiten und Se5 unter Kontrolle halten.'
					)
				}
			},
			{
				id: 'advance',
				name: N('Advance (3.e5)', 'Vorstoß (3.e5)'),
				moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6',
				notes: {
					4: N('White grabs space.', 'Weiß gewinnt Raum.'),
					5: N('Again: bishop out before …e6.', 'Wieder: Läufer raus vor …e6.'),
					7: N('Now close the chain.', 'Jetzt die Kette schließen.'),
					9: N(
						'Attack White’s pawn chain at its base.',
						'Die weiße Bauernkette an der Basis angreifen.'
					),
					11: N('More pressure on d4.', 'Mehr Druck auf d4.')
				}
			},
			{
				id: 'exchange',
				name: N('Exchange (3.exd5)', 'Abtausch (3.exd5)'),
				moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4',
				notes: {
					5: N(
						'Recapture with the c-pawn – a solid, symmetrical structure.',
						'Mit dem c-Bauern zurückschlagen – eine solide, symmetrische Struktur.'
					),
					7: N('Pressure on d4.', 'Druck auf d4.'),
					9: N('Develop.', 'Entwickeln.'),
					11: N(
						'The bishop comes out with tempo on White’s queen.',
						'Der Läufer kommt mit Tempo gegen die weiße Dame heraus.'
					)
				}
			}
		]
	},
	{
		id: 'french',
		color: 'black',
		group: 'e4',
		level: 2,
		name: N('French Defence', 'Französische Verteidigung'),
		tagline: N(
			'1.e4 e6 – a solid wall, then counter-attack.',
			'1.e4 e6 – eine solide Mauer, dann Gegenangriff.'
		),
		ideas: [
			N('…e6 prepares …d5.', '…e6 bereitet …d5 vor.'),
			N(
				'When White plays e5, attack the chain with …c5 (and later …f6).',
				'Spielt Weiß e5, die Kette mit …c5 (und später …f6) angreifen.'
			),
			N(
				'Your light bishop is the problem piece – find it a job.',
				'Dein weißfeldriger Läufer ist die Problemfigur – gib ihm eine Aufgabe.'
			)
		],
		lines: [
			{
				id: 'advance',
				name: N('Advance (3.e5)', 'Vorstoß (3.e5)'),
				moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Bd3 cxd4 cxd4 Bd7',
				notes: {
					1: N('Prepare …d5.', '…d5 vorbereiten.'),
					3: N('Challenge e4.', 'e4 herausfordern.'),
					4: N('White gains space.', 'Weiß gewinnt Raum.'),
					5: N('Attack the base of the chain on d4.', 'Die Basis der Kette auf d4 angreifen.'),
					7: N('More pressure on d4.', 'Mehr Druck auf d4.'),
					9: N(
						'The queen joins the attack on d4 and eyes b2.',
						'Die Dame greift d4 mit an und zielt auf b2.'
					),
					11: N('Open the c-file.', 'Die c-Linie öffnen.'),
					13: N(
						'Develop and prepare …Nge7–f5 to keep hitting d4.',
						'Entwickeln und …Sge7–f5 vorbereiten, um weiter auf d4 zu drücken.'
					)
				}
			},
			{
				id: 'classical',
				name: N('Classical (3.Nc3)', 'Klassisch (3.Sc3)'),
				moves: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5',
				notes: {
					5: N('Pressure on e4.', 'Druck auf e4.'),
					7: N('Break the pin.', 'Die Fesselung lösen.'),
					9: N('The knight steps back.', 'Der Springer weicht zurück.'),
					11: N('Recapture.', 'Zurückschlagen.'),
					13: N('Castle first …', 'Erst rochieren …'),
					15: N(
						'… then hit the centre with …c5 – the French recipe.',
						'… dann mit …c5 das Zentrum angreifen – das französische Rezept.'
					)
				}
			},
			{
				id: 'exchange',
				name: N('Exchange (3.exd5)', 'Abtausch (3.exd5)'),
				moves: 'e4 e6 d4 d5 exd5 exd5 Bd3 Nc6 c3 Bd6 Nf3 Nge7',
				notes: {
					5: N(
						'Recapture – your light bishop is free now!',
						'Zurückschlagen – dein weißfeldriger Läufer ist jetzt frei!'
					),
					7: N('Pressure on d4.', 'Druck auf d4.'),
					9: N('Active bishop.', 'Aktiver Läufer.'),
					11: N(
						'Knight to e7 keeps the f-pawn free and allows …Bf5 or …Bg4.',
						'Springer nach e7 hält den f-Bauern frei und erlaubt …Lf5 oder …Lg4.'
					)
				}
			}
		]
	},
	{
		id: 'scandi',
		color: 'black',
		group: 'e4',
		level: 1,
		name: N('Scandinavian Defence', 'Skandinavische Verteidigung'),
		tagline: N('1.e4 d5 – hit back immediately.', '1.e4 d5 – sofort zurückschlagen.'),
		ideas: [
			N(
				'Attack e4 on move one – no theory jungle.',
				'e4 im ersten Zug angreifen – kein Theoriedschungel.'
			),
			N(
				'The queen goes to a5 (or d6) where it is safe.',
				'Die Dame geht nach a5 (oder d6), wo sie sicher steht.'
			),
			N(
				'Then …Nf6, …Bf5, …e6, …c6 – a rock-solid setup.',
				'Dann …Sf6, …Lf5, …e6, …c6 – ein felsenfester Aufbau.'
			)
		],
		lines: [
			{
				id: 'qa5',
				name: N('Main line (…Qa5)', 'Hauptvariante (…Da5)'),
				moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6 Bd2 c6',
				notes: {
					1: N('Attack e4 right away.', 'e4 sofort angreifen.'),
					3: N('Recapture with the queen.', 'Mit der Dame zurückschlagen.'),
					4: N('White gains a tempo on the queen.', 'Weiß gewinnt ein Tempo gegen die Dame.'),
					5: N('a5 is a safe square for the queen.', 'a5 ist ein sicheres Feld für die Dame.'),
					7: N('Develop.', 'Entwickeln.'),
					9: N('Bishop out before …e6.', 'Läufer raus vor …e6.'),
					11: N('Solid structure.', 'Solide Struktur.'),
					13: N(
						'The Scandi pyramid: the queen gets c7 as a retreat and d5 is covered.',
						'Die Skandi-Pyramide: Die Dame bekommt c7 als Rückzug, und d5 ist kontrolliert.'
					)
				}
			},
			{
				id: 'nf6',
				name: N('Modern (2…Nf6)', 'Modern (2…Sf6)'),
				moves: 'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 Bg4 Be2 e6 O-O Nc6 c4 Nb6',
				notes: {
					3: N(
						'Win the pawn back with the knight instead of the queen.',
						'Den Bauern mit dem Springer statt der Dame zurückholen.'
					),
					5: N('Pawn regained.', 'Bauer zurück.'),
					7: N('Pin the knight.', 'Den Springer fesseln.'),
					11: N('Pressure on d4.', 'Druck auf d4.'),
					13: N(
						'Step back – the knight on b6 eyes c4 and d5.',
						'Zurückziehen – der Springer auf b6 zielt auf c4 und d5.'
					)
				}
			}
		]
	},
	{
		id: 'sicilian',
		color: 'black',
		group: 'e4',
		level: 3,
		name: N('Sicilian (Accelerated Dragon)', 'Sizilianisch (Beschleunigter Drache)'),
		tagline: N('1.e4 c5 – unbalanced fighting chess.', '1.e4 c5 – unausgeglichenes Kampfschach.'),
		ideas: [
			N(
				'…c5 fights for d4 from the side – the position becomes unbalanced.',
				'…c5 kämpft von der Seite um d4 – die Stellung wird unausgeglichen.'
			),
			N(
				'After …cxd4 you have an extra centre pawn and a half-open c-file.',
				'Nach …cxd4 hast du einen Zentrumsbauern mehr und eine halboffene c-Linie.'
			),
			N(
				'The dragon bishop on g7 is your strongest piece.',
				'Der Drachenläufer auf g7 ist deine stärkste Figur.'
			)
		],
		lines: [
			{
				id: 'open',
				name: N('Open Sicilian', 'Offenes Sizilianisch'),
				moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6',
				notes: {
					1: N('Fight for d4 from the side.', 'Von der Seite um d4 kämpfen.'),
					3: N('Develop and control d4.', 'Entwickeln und d4 kontrollieren.'),
					5: N(
						'Trade a side pawn for White’s centre pawn.',
						'Einen Randbauern gegen den weißen Zentrumsbauern tauschen.'
					),
					7: N('Prepare the dragon bishop.', 'Den Drachenläufer vorbereiten.'),
					9: N(
						'The bishop on the long diagonal – your star piece.',
						'Der Läufer auf der langen Diagonale – deine Starfigur.'
					),
					11: N('Develop.', 'Entwickeln.'),
					13: N('King safety first.', 'Erst die Königssicherheit.'),
					15: N(
						'Development complete – ideas: …Na5, …Ng4, …Bd7 and the c-file.',
						'Entwicklung abgeschlossen – Ideen: …Sa5, …Sg4, …Ld7 und die c-Linie.'
					)
				}
			},
			{
				id: 'alapin',
				name: N('Against the Alapin (2.c3)', 'Gegen Alapin (2.c3)'),
				moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6',
				notes: {
					2: N('White wants to play d4.', 'Weiß will d4 spielen.'),
					3: N('Attack e4 right away.', 'e4 sofort angreifen.'),
					5: N('The knight is great in the centre.', 'Der Springer steht im Zentrum hervorragend.'),
					7: N('Trade on d4.', 'Auf d4 tauschen.'),
					9: N('Pressure on d4.', 'Druck auf d4.'),
					11: N('Hit the e5 pawn.', 'Den Bauern e5 angreifen.')
				}
			},
			{
				id: 'closed',
				name: N('Against the Closed (2.Nc3)', 'Gegen Geschlossen (2.Sc3)'),
				moves: 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6',
				notes: {
					4: N('White fianchettoes.', 'Weiß stellt ein Fianchetto auf.'),
					5: N('Copy the plan.', 'Den Plan kopieren.'),
					7: N(
						'Your bishop fights for d4 and the long diagonal.',
						'Dein Läufer kämpft um d4 und die lange Diagonale.'
					),
					9: N(
						'Solid. Later: …e6, …Nge7, …O-O and …Rb8 with …b5.',
						'Solide. Später: …e6, …Sge7, …O-O und …Tb8 mit …b5.'
					)
				}
			}
		]
	},

	// ──────────────────────── Schwarz gegen 1.d4 ────────────────────────
	{
		id: 'qgd',
		color: 'black',
		group: 'd4',
		level: 1,
		name: N('Queen’s Gambit Declined', 'Abgelehntes Damengambit'),
		tagline: N(
			'1.d4 d5 2.c4 e6 – the classic answer.',
			'1.d4 d5 2.c4 e6 – die klassische Antwort.'
		),
		ideas: [
			N('Hold d5 with …e6 – rock solid.', 'd5 mit …e6 halten – felsenfest.'),
			N('Develop: …Nf6, …Be7, …O-O, …Nbd7.', 'Entwickeln: …Sf6, …Le7, …O-O, …Sbd7.'),
			N(
				'Free your position later with …c5 or …e5.',
				'Später mit …c5 oder …e5 die Stellung befreien.'
			)
		],
		lines: [
			{
				id: 'main',
				name: N('Main line (3.Nc3)', 'Hauptvariante (3.Sc3)'),
				moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7',
				notes: {
					1: N('Claim the centre.', 'Das Zentrum besetzen.'),
					2: N('The Queen’s Gambit.', 'Das Damengambit.'),
					3: N('Decline: keep a pawn on d5.', 'Ablehnen: einen Bauern auf d5 behalten.'),
					5: N('Develop and defend d5.', 'Entwickeln und d5 decken.'),
					6: N('White pins your knight.', 'Weiß fesselt deinen Springer.'),
					7: N('Break the pin.', 'Die Fesselung lösen.'),
					9: N('Castle.', 'Rochieren.'),
					11: N(
						'Flexible: prepares …c5 or …c6 and …dxc4 with …e5.',
						'Flexibel: bereitet …c5 oder …c6 und …dxc4 mit …e5 vor.'
					)
				}
			},
			{
				id: 'vs-london',
				name: N('Against the London', 'Gegen London'),
				moves: 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6',
				notes: {
					5: N('Hit the centre with the c-pawn.', 'Mit dem c-Bauern das Zentrum angreifen.'),
					7: N('More pressure on d4.', 'Mehr Druck auf d4.'),
					9: N('Open the way for your bishop.', 'Den Weg für deinen Läufer öffnen.'),
					11: N('Challenge the London bishop.', 'Den London-Läufer herausfordern.')
				}
			},
			{
				id: 'nf3',
				name: N('Against 2.Nf3', 'Gegen 2.Sf3'),
				moves: 'd4 d5 Nf3 Nf6 c4 e6 Nc3 Be7 Bf4 O-O',
				notes: {
					3: N('Develop.', 'Entwickeln.'),
					5: N('Hold d5.', 'd5 halten.'),
					7: N('Prepare castling.', 'Rochade vorbereiten.'),
					9: N('King safe – next …c5 or …Nbd7.', 'König sicher – als Nächstes …c5 oder …Sbd7.')
				}
			}
		]
	},
	{
		id: 'slav',
		color: 'black',
		group: 'd4',
		level: 2,
		name: N('Slav Defence', 'Slawische Verteidigung'),
		tagline: N(
			'1.d4 d5 2.c4 c6 – solid, with a free light bishop.',
			'1.d4 d5 2.c4 c6 – solide, mit freiem weißfeldrigem Läufer.'
		),
		ideas: [
			N(
				'…c6 supports d5 without locking in your light bishop.',
				'…c6 stützt d5, ohne deinen weißfeldrigen Läufer einzusperren.'
			),
			N(
				'Bring the bishop to f5 or g4 before …e6.',
				'Den Läufer nach f5 oder g4 bringen, bevor …e6 kommt.'
			),
			N(
				'Sometimes take on c4 and make White spend time winning it back.',
				'Manchmal auf c4 nehmen und Weiß Zeit für die Rückeroberung kosten lassen.'
			)
		],
		lines: [
			{
				id: 'main',
				name: N('Main line (4.Nc3 dxc4)', 'Hauptvariante (4.Sc3 dxc4)'),
				moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O',
				notes: {
					3: N(
						'The Slav: support d5 without blocking your bishop.',
						'Slawisch: d5 stützen, ohne den Läufer zu blockieren.'
					),
					5: N('Develop.', 'Entwickeln.'),
					7: N(
						'Grab the pawn – White must spend time to win it back.',
						'Den Bauern nehmen – Weiß braucht Zeit, um ihn zurückzuholen.'
					),
					8: N('White stops …b5.', 'Weiß verhindert …b5.'),
					9: N(
						'The bishop is out – the Slav’s big plus over the QGD.',
						'Der Läufer ist draußen – der große Vorteil gegenüber dem Damengambit.'
					),
					11: N('Solid centre.', 'Solides Zentrum.'),
					13: N('Active bishop pins the knight.', 'Aktiver Läufer fesselt den Springer.'),
					15: N('Castle – an excellent position.', 'Rochieren – eine ausgezeichnete Stellung.')
				}
			},
			{
				id: 'exchange',
				name: N('Exchange (3.cxd5)', 'Abtausch (3.cxd5)'),
				moves: 'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6 e3 Bf5',
				notes: {
					5: N('Recapture – symmetrical and solid.', 'Zurückschlagen – symmetrisch und solide.'),
					7: N('Develop.', 'Entwickeln.'),
					9: N('Pressure on d4.', 'Druck auf d4.'),
					11: N(
						'Copy and develop – the position is very safe.',
						'Kopieren und entwickeln – die Stellung ist sehr sicher.'
					)
				}
			},
			{
				id: 'e3',
				name: N('Against 4.e3', 'Gegen 4.e3'),
				moves: 'd4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Bd3 Bxd3 Qxd3 e6',
				notes: {
					7: N('Bishop out before …e6.', 'Läufer raus vor …e6.'),
					8: N('White offers a trade.', 'Weiß bietet einen Tausch an.'),
					9: N('Trade – the “problem bishop” is gone.', 'Tauschen – der „Problemläufer“ ist weg.'),
					11: N(
						'Solid centre. Next: …Nbd7, …Be7, …O-O.',
						'Solides Zentrum. Danach: …Sbd7, …Le7, …O-O.'
					)
				}
			}
		]
	},
	{
		id: 'kid',
		color: 'black',
		group: 'd4',
		level: 3,
		name: N('King’s Indian Defence', 'Königsindische Verteidigung'),
		tagline: N(
			'1.d4 Nf6 2.c4 g6 – let White build, then strike.',
			'1.d4 Sf6 2.c4 g6 – Weiß bauen lassen, dann zuschlagen.'
		),
		ideas: [
			N(
				'Fianchetto the bishop on g7 and castle quickly.',
				'Den Läufer auf g7 fianchettieren und schnell rochieren.'
			),
			N('Strike at the centre with …e5 (or …c5).', 'Mit …e5 (oder …c5) das Zentrum angreifen.'),
			N(
				'When the centre is closed, attack the king with …f5.',
				'Ist das Zentrum geschlossen, mit …f5 am Königsflügel angreifen.'
			)
		],
		lines: [
			{
				id: 'classical',
				name: N('Classical', 'Klassisch'),
				moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
				notes: {
					1: N(
						'Control e4 without committing a pawn.',
						'e4 kontrollieren, ohne einen Bauern festzulegen.'
					),
					3: N('Prepare the fianchetto.', 'Das Fianchetto vorbereiten.'),
					5: N('The long-diagonal bishop.', 'Der Läufer auf der langen Diagonale.'),
					6: N('White builds a big centre.', 'Weiß baut ein großes Zentrum.'),
					7: N('Stop e5 and prepare …e5.', 'e5 verhindern und …e5 vorbereiten.'),
					9: N('Castle early.', 'Früh rochieren.'),
					11: N('Strike at the centre!', 'Schlag im Zentrum zu!'),
					13: N('Pressure on d4.', 'Druck auf d4.'),
					14: N('White closes the centre.', 'Weiß schließt das Zentrum.'),
					15: N(
						'The knight heads for the kingside – next comes …Nd7 and …f5.',
						'Der Springer geht zum Königsflügel – als Nächstes …Sd7 und …f5.'
					)
				}
			},
			{
				id: 'vs-london',
				name: N('Against the London', 'Gegen London'),
				moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 O-O Nbd7',
				notes: {
					3: N('The same KID setup.', 'Derselbe Königsindisch-Aufbau.'),
					7: N('Castle.', 'Rochieren.'),
					9: N('Prepare …e5.', '…e5 vorbereiten.'),
					11: N(
						'Supports …e5 – the key break against the London.',
						'Unterstützt …e5 – der wichtigste Hebel gegen London.'
					)
				}
			},
			{
				id: 'fianchetto',
				name: N('Against the fianchetto', 'Gegen das Fianchetto'),
				moves: 'd4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O O-O d6 c4 Nbd7',
				notes: {
					4: N('White fianchettoes too.', 'Weiß fianchettiert ebenfalls.'),
					7: N('Castle.', 'Rochieren.'),
					9: N('Solid, and prepares …e5.', 'Solide, und bereitet …e5 vor.'),
					11: N('Next: …e5.', 'Als Nächstes: …e5.')
				}
			}
		]
	}
];

export function courseById(id: string): Course | undefined {
	return COURSES.find((c) => c.id === id);
}

/** SAN-Zugfolge → UCI (wirft bei illegalen Zügen) */
export function lineUcis(line: CourseLine): string[] {
	const pos = positionFromFen(INITIAL_FEN);
	return line.moves.split(/\s+/).map((san, i) => {
		const m = parseSan(pos, san);
		if (!m) throw new Error(`illegal move ${i}: ${san} in ${line.id}`);
		let uci = makeUci(m);
		// Rochade als Königszug zwei Felder (e1g1) – so wie das Brett sie meldet
		if (san.startsWith('O-O')) uci = uci.slice(0, 2) + (san === 'O-O' ? 'g' : 'c') + uci[1];
		pos.play(m);
		return uci;
	});
}

/** Ist dieser Halbzug ein eigener Zug (aus Sicht des Kurses)? */
export function isOwnPly(course: Course, ply: number): boolean {
	return course.color === 'white' ? ply % 2 === 0 : ply % 2 === 1;
}

// ───────────────────── Erklärungen für Züge ohne eigene Notiz ─────────────────────

const CENTRE = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'c5']);

/** Kurze, regelbasierte Erklärung eines Eröffnungszugs (Entwicklung, Zentrum, Rochade, Schlagen) */
export function autoNote(fen: string, uci: string): string {
	const pos = positionFromFen(fen);
	const m = parseUci(uci) as NormalMove | undefined;
	if (!m) return '';
	const piece = pos.board.get(m.from);
	if (!piece) return '';
	const to = makeSquare(m.to);
	const target = pos.board.get(m.to);
	if (piece.role === 'king' && Math.abs((m.from % 8) - (m.to % 8)) > 1)
		return t('course.auto.castle');
	if (piece.role === 'king' && target?.role === 'rook' && target.color === piece.color)
		return t('course.auto.castle');
	if (target) return t('course.auto.capture', { piece: t(`pieces.name.${target.role}`), sq: to });
	if (piece.role === 'pawn' && CENTRE.has(to)) return t('course.auto.centre');
	const backRank = piece.color === 'white' ? m.from < 8 : m.from >= 56;
	if ((piece.role === 'knight' || piece.role === 'bishop') && backRank)
		return t('course.auto.develop', { piece: t(`pieces.name.${piece.role}`) });
	return '';
}

let noteIndex: Map<string, L> | null = null;

/** Notiz aus irgendeinem Kurs zu diesem Zug in dieser Stellung (für das Repertoire-Training) */
export function noteFor(fen: string, uci: string): string {
	if (!noteIndex) {
		noteIndex = new Map();
		for (const c of COURSES)
			for (const line of c.lines) {
				const pos = positionFromFen(INITIAL_FEN);
				for (const [i, san] of line.moves.split(/\s+/).entries()) {
					const mv = parseSan(pos, san)!;
					let u = makeUci(mv);
					if (san.startsWith('O-O')) u = u.slice(0, 2) + (san === 'O-O' ? 'g' : 'c') + u[1];
					const key = `${fenKey(makeFenOf(pos))}|${u}`;
					if (line.notes[i] && !noteIndex.has(key)) noteIndex.set(key, line.notes[i]);
					pos.play(mv);
				}
			}
	}
	const hit = noteIndex.get(`${fenKey(fen)}|${uci}`);
	return hit ? loc(hit) : autoNote(fen, uci);
}

function makeFenOf(pos: Chess): string {
	return makeFen(pos.toSetup());
}
