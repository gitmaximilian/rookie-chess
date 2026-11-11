/**
 * Vertiefung der Eröffnungskurse: Mittelspielpläne, typische Fehler und Fallen.
 * Fallen-Züge werden im Test auf Legalität geprüft.
 */
import type { L } from './courses.js';

const N = (en: string, de: string): L => ({ en, de });

export interface Trap {
	id: string;
	name: L;
	/** set = Falle, die du stellst · avoid = Falle, in die du nicht tappen sollst */
	kind: 'set' | 'avoid';
	moves: string;
	notes: Record<number, L>;
	/** Halbzug des entscheidenden Fehlers (wird markiert) */
	mistake: number;
}

export interface CourseDepth {
	/** Pläne für das Mittelspiel, das aus dieser Eröffnung entsteht */
	plans: L[];
	/** typische Anfängerfehler in dieser Eröffnung */
	pitfalls: L[];
	traps: Trap[];
}

export const DEPTH: Record<string, CourseDepth> = {
	italian: {
		plans: [
			N(
				'Slow build-up: c3, d3, O-O, Re1, then Nbd2–f1–g3 brings a knight towards Black’s king.',
				'Langsamer Aufbau: c3, d3, O-O, Te1, dann Sbd2–f1–g3 – ein Springer marschiert Richtung schwarzer König.'
			),
			N(
				'When the time is right, break with d3–d4 to open the centre while your pieces are better placed.',
				'Wenn es passt, mit d3–d4 das Zentrum öffnen – dann, wenn deine Figuren besser stehen.'
			),
			N(
				'Keep the bishop on the a2–g8 diagonal (Bb3/Ba2) – it pins down f7 for the whole game.',
				'Halte den Läufer auf der Diagonale a2–g8 (Lb3/La2) – er bindet f7 die ganze Partie.'
			)
		],
		pitfalls: [
			N(
				'Grabbing with Nxe5 too early when Black’s queen or knight can punish (see the traps).',
				'Zu frühes Sxe5, wenn schwarze Dame oder Springer es bestrafen können (siehe Fallen).'
			),
			N(
				'Playing Ng5 without a follow-up – it often just loses time.',
				'Sg5 ohne Plan – meistens verliert der Springer nur Zeit.'
			),
			N(
				'Forgetting to castle because the attack looks tempting.',
				'Die Rochade vergessen, weil der Angriff verlockend aussieht.'
			)
		],
		traps: [
			{
				id: 'legal',
				name: N('Légal’s mate', 'Seekadettenmatt'),
				kind: 'set',
				moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
				mistake: 9,
				notes: {
					5: N(
						'Black pins your knight to the queen.',
						'Schwarz fesselt deinen Springer an die Dame.'
					),
					7: N(
						'A careless move – Black doesn’t watch f7 and e5.',
						'Ein nachlässiger Zug – Schwarz achtet nicht auf f7 und e5.'
					),
					8: N(
						'The pin is fake! You offer your queen.',
						'Die Fesselung ist unecht! Du bietest deine Dame an.'
					),
					9: N(
						'The mistake: taking the queen. 5…dxe5 was necessary.',
						'Der Fehler: die Dame nehmen. 5…dxe5 war nötig.'
					),
					10: N('Check – the king must go to e7.', 'Schach – der König muss nach e7.'),
					12: N(
						'Checkmate with three minor pieces against a queen.',
						'Matt mit drei Leichtfiguren gegen die Dame.'
					)
				}
			},
			{
				id: 'blackburne',
				name: N('Blackburne Shilling trap', 'Blackburne-Shilling-Falle'),
				kind: 'avoid',
				moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#',
				mistake: 6,
				notes: {
					5: N(
						'A dubious move that leaves e5 hanging – on purpose.',
						'Ein zweifelhafter Zug, der e5 stehen lässt – mit Absicht.'
					),
					6: N(
						'The mistake: grabbing the pawn. Play 4.Nxd4 or 4.O-O instead – then Black is just worse.',
						'Der Fehler: den Bauern nehmen. Spiel stattdessen 4.Sxd4 oder 4.O-O – dann steht Schwarz einfach schlechter.'
					),
					7: N(
						'The queen attacks your knight and g2 at the same time.',
						'Die Dame greift deinen Springer und g2 gleichzeitig an.'
					),
					13: N(
						'Smothered mate – the bishop on e2 blocks the king’s last escape.',
						'Matt – der Läufer auf e2 versperrt dem König das letzte Feld.'
					)
				}
			}
		]
	},
	scotch: {
		plans: [
			N(
				'Your knight on d4 is a strong centre piece – support it with Be3 and Nc3.',
				'Dein Springer auf d4 ist eine starke Zentrumsfigur – stütze ihn mit Le3 und Sc3.'
			),
			N(
				'After Nxc6 bxc6, push e4–e5 to gain space and chase Black’s knight.',
				'Nach Sxc6 bxc6 mit e4–e5 Raum gewinnen und den schwarzen Springer vertreiben.'
			),
			N(
				'Castle queenside in some lines and attack with the f- and g-pawns.',
				'In manchen Varianten lang rochieren und mit f- und g-Bauern angreifen.'
			)
		],
		pitfalls: [
			N(
				'Leaving e4 undefended when Black plays …Nf6 – Nc3 or Bd3 keeps it safe.',
				'e4 ungedeckt lassen, wenn Schwarz …Sf6 spielt – Sc3 oder Ld3 hält ihn sicher.'
			),
			N(
				'Moving the d4-knight again and again – develop the other pieces first.',
				'Den d4-Springer immer wieder ziehen – erst die anderen Figuren entwickeln.'
			)
		],
		traps: []
	},
	ruy: {
		plans: [
			N(
				'Classical plan: c3 and d4 for a big centre, with the rook on e1 behind e4.',
				'Klassischer Plan: c3 und d4 für ein großes Zentrum, der Turm auf e1 hinter e4.'
			),
			N(
				'Reroute the b1-knight via d2–f1–g3 to join the kingside attack.',
				'Den b1-Springer über d2–f1–g3 zum Königsangriff führen.'
			),
			N(
				'If Black plays …b5, use a2–a4 to attack the pawn chain on the queenside.',
				'Spielt Schwarz …b5, greife mit a2–a4 die Bauernkette am Damenflügel an.'
			)
		],
		pitfalls: [
			N(
				'Taking on c6 and then Nxe5 too early – after …Qd4 Black wins the pawn back.',
				'Zu früh auf c6 tauschen und dann Sxe5 – nach …Dd4 holt Schwarz den Bauern zurück.'
			),
			N(
				'Letting your bishop get trapped by …a6, …b5 and …c5–c4 (see the trap).',
				'Den Läufer durch …a6, …b5 und …c5–c4 einsperren lassen (siehe Falle).'
			)
		],
		traps: [
			{
				id: 'noahs-ark',
				name: N('Noah’s Ark trap', 'Arche-Noah-Falle'),
				kind: 'avoid',
				moves:
					'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5 c4',
				mistake: 14,
				notes: {
					9: N('Black chases your bishop.', 'Schwarz jagt deinen Läufer.'),
					14: N(
						'The mistake: the queen takes, but now …c5 and …c4 trap your bishop. Play 8.c3 or 8.Bd5 instead.',
						'Der Fehler: Die Dame schlägt, aber jetzt sperren …c5 und …c4 deinen Läufer ein. Besser 8.c3 oder 8.Ld5.'
					),
					15: N(
						'The queen is attacked – and the trap closes.',
						'Die Dame wird angegriffen – die Falle schnappt zu.'
					),
					21: N(
						'The bishop on b3 has no squares left – Black wins a piece.',
						'Der Läufer auf b3 hat keine Felder mehr – Schwarz gewinnt eine Figur.'
					)
				}
			}
		]
	},
	london: {
		plans: [
			N(
				'Same setup almost every game: d4, Bf4, e3, Nf3, Bd3, Nbd2, c3, O-O.',
				'Fast immer derselbe Aufbau: d4, Lf4, e3, Sf3, Ld3, Sbd2, c3, O-O.'
			),
			N(
				'Put a knight on e5, supported by f2–f4 later – a classic attacking setup.',
				'Einen Springer auf e5 stellen, später mit f2–f4 stützen – ein klassischer Angriffsaufbau.'
			),
			N(
				'If Black plays …c5, keep the centre closed with c3 and develop calmly.',
				'Spielt Schwarz …c5, das Zentrum mit c3 geschlossen halten und ruhig entwickeln.'
			)
		],
		pitfalls: [
			N(
				'Ignoring …Qb6 – watch your b2-pawn! Qb3 or Qc1 protects it.',
				'…Db6 übersehen – pass auf b2 auf! Db3 oder Dc1 deckt ihn.'
			),
			N(
				'Playing on autopilot: the setup is fixed, but you still have to check for tactics.',
				'Auf Autopilot spielen: Der Aufbau steht fest, aber Taktik musst du trotzdem prüfen.'
			)
		],
		traps: []
	},
	'queens-gambit': {
		plans: [
			N(
				'Minority attack: push b2–b4–b5 to create a weak pawn on c6.',
				'Minoritätsangriff: b2–b4–b5 vorschieben, um einen schwachen Bauern auf c6 zu erzeugen.'
			),
			N(
				'Pressure on d5 with Nc3, Bg5 and cxd5 – Black’s centre must hold.',
				'Druck auf d5 mit Sc3, Lg5 und cxd5 – das schwarze Zentrum muss halten.'
			),
			N(
				'Rooks to c1 and d1: the half-open c-file is yours.',
				'Türme nach c1 und d1: Die halboffene c-Linie gehört dir.'
			)
		],
		pitfalls: [
			N(
				'Trying to win the d5-pawn with a pinned knight (the Elephant trap).',
				'Den d5-Bauern mit einem gefesselten Springer gewinnen wollen (Elefantenfalle).'
			),
			N(
				'Holding on to the c4-pawn after …dxc4 – better to develop and win it back later.',
				'Nach …dxc4 krampfhaft den c4-Bauern zurückwollen – besser entwickeln und später zurückholen.'
			)
		],
		traps: [
			{
				id: 'elephant',
				name: N('Elephant trap', 'Elefantenfalle'),
				kind: 'avoid',
				moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8',
				mistake: 10,
				notes: {
					7: N(
						'The knight on f6 looks pinned – but Black has a trick.',
						'Der Springer auf f6 wirkt gefesselt – aber Schwarz hat einen Trick.'
					),
					10: N(
						'The mistake: the pawn on d5 is poisoned. Develop with e3 and Nf3 instead.',
						'Der Fehler: Der Bauer auf d5 ist vergiftet. Entwickle stattdessen mit e3 und Sf3.'
					),
					11: N('Black gives up the queen!', 'Schwarz gibt die Dame!'),
					13: N(
						'Check – and after Qd2 Bxd2+ Black is a piece up.',
						'Schach – und nach Dd2 Lxd2+ hat Schwarz eine Figur mehr.'
					),
					17: N(
						'Result: Black has won a whole piece.',
						'Ergebnis: Schwarz hat eine ganze Figur gewonnen.'
					)
				}
			}
		]
	},
	e5: {
		plans: [
			N(
				'Develop knights before bishops, castle kingside, then challenge the centre with …d5.',
				'Springer vor Läufern entwickeln, kurz rochieren, dann mit …d5 das Zentrum angreifen.'
			),
			N(
				'Against the Italian: …a6 and …Ba7 keep your bishop safe, then …Be6 to trade White’s strong bishop.',
				'Gegen Italienisch: …a6 und …La7 sichern den Läufer, dann …Le6, um den starken weißen Läufer zu tauschen.'
			),
			N(
				'Always know who protects f7 – it is your weak spot until you castle.',
				'Wisse immer, wer f7 deckt – bis zur Rochade ist es deine Schwachstelle.'
			)
		],
		pitfalls: [
			N(
				'Ignoring an early Qh5 or Qf3 – the threat is mate on f7.',
				'Ein frühes Dh5 oder Df3 übersehen – es droht Matt auf f7.'
			),
			N(
				'Pinning with …Bg4 and then allowing Nxe5 (Légal’s mate).',
				'Mit …Lg4 fesseln und dann Sxe5 zulassen (Seekadettenmatt).'
			)
		],
		traps: [
			{
				id: 'scholars',
				name: N('Scholar’s mate', 'Schäfermatt'),
				kind: 'avoid',
				moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#',
				mistake: 5,
				notes: {
					2: N('The bishop aims at f7.', 'Der Läufer zielt auf f7.'),
					4: N(
						'The queen attacks e5 and f7 – the threat is Qxf7 mate.',
						'Die Dame greift e5 und f7 an – es droht Dxf7 matt.'
					),
					5: N(
						'The mistake: attacking the queen does not stop the threat. 3…g6 or 3…Qe7 defends.',
						'Der Fehler: Die Dame angreifen hält die Drohung nicht auf. 3…g6 oder 3…De7 verteidigt.'
					),
					6: N('Checkmate on f7.', 'Matt auf f7.')
				}
			}
		]
	},
	caro: {
		plans: [
			N(
				'Get your light-squared bishop out (…Bf5 or …Bg4) BEFORE playing …e6.',
				'Bring den weißfeldrigen Läufer heraus (…Lf5 oder …Lg4), BEVOR du …e6 spielst.'
			),
			N(
				'Solid structure, then free yourself with …c5 or …e5.',
				'Solide Struktur, dann mit …c5 oder …e5 befreien.'
			),
			N(
				'In the endgame your pawn structure is often better – trading pieces is fine.',
				'Im Endspiel ist deine Bauernstruktur oft besser – Figurentausch ist in Ordnung.'
			)
		],
		pitfalls: [
			N(
				'…Ngf6 when White’s queen is on e2 – Nd6 is smothered mate!',
				'…Sgf6, wenn die weiße Dame auf e2 steht – Sd6 ist Matt!'
			),
			N(
				'Locking in your bishop with an early …e6.',
				'Den eigenen Läufer mit frühem …e6 einsperren.'
			)
		],
		traps: [
			{
				id: 'nd6-mate',
				name: N('Smothered mate on d6', 'Erstickungsmatt auf d6'),
				kind: 'avoid',
				moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Qe2 Ngf6 Nd6#',
				mistake: 9,
				notes: {
					8: N(
						'A sneaky move – the queen stands on the e-file behind your e7-pawn.',
						'Ein hinterhältiger Zug – die Dame steht auf der e-Linie hinter deinem e7-Bauern.'
					),
					9: N(
						'The mistake: now d6 is unprotected. 5…Ndf6 was correct.',
						'Der Fehler: Jetzt ist d6 ungedeckt. 5…Sdf6 war richtig.'
					),
					10: N(
						'Mate! The e7-pawn is pinned and your own pieces block the king.',
						'Matt! Der e7-Bauer ist gefesselt, und die eigenen Figuren versperren den König.'
					)
				}
			}
		]
	},
	french: {
		plans: [
			N(
				'Attack the base of White’s pawn chain: …c5 against d4, sometimes …f6 against e5.',
				'Greife die Basis der weißen Bauernkette an: …c5 gegen d4, manchmal …f6 gegen e5.'
			),
			N(
				'Put pressure on d4 with …Nc6, …Qb6 and …Nge7–f5.',
				'Druck auf d4 mit …Sc6, …Db6 und …Sge7–f5.'
			),
			N(
				'Your light-squared bishop is the problem piece – trade it (…b6 and …Ba6) or free it.',
				'Dein weißfeldriger Läufer ist das Sorgenkind – tausche ihn (…b6 und …La6) oder befreie ihn.'
			)
		],
		pitfalls: [
			N(
				'Grabbing the d4-pawn when Bb5+ uncovers an attack on your queen.',
				'Den d4-Bauern nehmen, wenn Lb5+ einen Angriff auf deine Dame aufdeckt.'
			),
			N(
				'Forgetting about your king while attacking d4.',
				'Den König vergessen, während du d4 angreifst.'
			)
		],
		traps: [
			{
				id: 'bb5-trick',
				name: N('The Bb5+ trick', 'Der Lb5+-Trick'),
				kind: 'avoid',
				moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Bd3 cxd4 cxd4 Nxd4 Nxd4 Qxd4 Bb5+ Bd7 Qxd4',
				mistake: 13,
				notes: {
					12: N(
						'White leaves d4 under attack – it looks like a free pawn.',
						'Weiß lässt d4 hängen – sieht aus wie ein geschenkter Bauer.'
					),
					13: N(
						'The mistake: the pawn is poisoned. 7…Bd7 keeps the pressure safely.',
						'Der Fehler: Der Bauer ist vergiftet. 7…Ld7 hält den Druck ohne Risiko.'
					),
					16: N(
						'Check – and the queen on d1 now attacks your queen on d4.',
						'Schach – und die Dame auf d1 greift jetzt deine Dame auf d4 an.'
					),
					18: N('White wins the queen.', 'Weiß gewinnt die Dame.')
				}
			}
		]
	},
	scandi: {
		plans: [
			N(
				'Queen to a5 or d6, then …Nf6, …Bf5 or …Bg4, …e6 and …c6 – a solid triangle.',
				'Dame nach a5 oder d6, dann …Sf6, …Lf5 oder …Lg4, …e6 und …c6 – ein solides Dreieck.'
			),
			N(
				'Castle long or short depending on where White attacks.',
				'Je nach weißem Angriff lang oder kurz rochieren.'
			),
			N(
				'Aim for …c5 or …e5 later to fight for the centre.',
				'Später mit …c5 oder …e5 um das Zentrum kämpfen.'
			)
		],
		pitfalls: [
			N(
				'Moving the queen again and again – once is enough, then develop.',
				'Die Dame immer wieder ziehen – einmal reicht, dann entwickeln.'
			),
			N(
				'Pinning with …Bg4 while f7 is weak and Bc4 + Ne5 is possible.',
				'Mit …Lg4 fesseln, während f7 schwach ist und Lc4 + Se5 möglich sind.'
			)
		],
		traps: [
			{
				id: 'bxf7',
				name: N('Bxf7+ and Ne5+', 'Lxf7+ und Se5+'),
				kind: 'avoid',
				moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 Bc4 Nf6 Nf3 Bg4 Bxf7+ Kxf7 Ne5+ Ke8 Nxg4 Nxg4 Qxg4',
				mistake: 9,
				notes: {
					9: N(
						'The mistake: with the bishop on c4, f7 is too weak. 5…c6 or 5…Bf5 is better.',
						'Der Fehler: Mit dem Läufer auf c4 ist f7 zu schwach. 5…c6 oder 5…Lf5 ist besser.'
					),
					10: N('A sacrifice on f7!', 'Ein Opfer auf f7!'),
					12: N(
						'Check – and the knight attacks your bishop on g4.',
						'Schach – und der Springer greift deinen Läufer auf g4 an.'
					),
					16: N(
						'White is a pawn up and your king can’t castle anymore.',
						'Weiß hat einen Bauern mehr, und dein König kann nicht mehr rochieren.'
					)
				}
			}
		]
	},
	sicilian: {
		plans: [
			N(
				'The bishop on g7 is your best piece – keep the long diagonal open.',
				'Der Läufer auf g7 ist deine beste Figur – halte die lange Diagonale offen.'
			),
			N(
				'Free the position with …d5 in one move if White allows it.',
				'Wenn Weiß es erlaubt, mit …d5 in einem Zug befreien.'
			),
			N(
				'Counterplay on the queenside: …Rc8, …Qa5, …b5 – the half-open c-file is yours.',
				'Gegenspiel am Damenflügel: …Tc8, …Da5, …b5 – die halboffene c-Linie gehört dir.'
			)
		],
		pitfalls: [
			N(
				'Allowing c4 and Nc3 (the Maróczy bind) without a plan – play …d6, …Nxd4 and …Be6 against it.',
				'c4 und Sc3 (Maróczy-Bindung) ohne Plan zulassen – spiel dagegen …d6, …Sxd4 und …Le6.'
			),
			N(
				'Forgetting that d6 is weak once your d-pawn is gone.',
				'Vergessen, dass d6 schwach ist, sobald dein d-Bauer weg ist.'
			)
		],
		traps: []
	},
	qgd: {
		plans: [
			N(
				'Hold the d5 strongpoint with …e6, …Nf6, …Be7 and castle.',
				'Den Stützpunkt d5 mit …e6, …Sf6, …Le7 halten und rochieren.'
			),
			N(
				'Free your game with …c5 or …e5 – the two classic pawn breaks.',
				'Mit …c5 oder …e5 befreien – die beiden klassischen Hebel.'
			),
			N(
				'Develop the light-squared bishop via b7 (…b6) if it is stuck behind e6.',
				'Den weißfeldrigen Läufer über b7 (…b6) entwickeln, wenn er hinter e6 klemmt.'
			)
		],
		pitfalls: [
			N(
				'Playing passively for too long – without …c5 or …e5 you get squeezed.',
				'Zu lange passiv spielen – ohne …c5 oder …e5 wirst du erdrückt.'
			),
			N(
				'Missing that Nxd5 can be a mistake for White (set the Elephant trap!).',
				'Übersehen, dass Sxd5 für Weiß ein Fehler sein kann (stell die Elefantenfalle!).'
			)
		],
		traps: [
			{
				id: 'elephant-set',
				name: N('Elephant trap', 'Elefantenfalle'),
				kind: 'set',
				moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8',
				mistake: 10,
				notes: {
					7: N(
						'Your knight seems to leave d5 under-protected – that’s the bait.',
						'Dein Springer scheint d5 zu wenig zu decken – das ist der Köder.'
					),
					10: N('White takes the bait.', 'Weiß schnappt nach dem Köder.'),
					11: N(
						'Give up your queen! The knight on f6 wasn’t really pinned.',
						'Gib die Dame! Der Springer auf f6 war gar nicht richtig gefesselt.'
					),
					13: N(
						'Check – White must give back the queen.',
						'Schach – Weiß muss die Dame zurückgeben.'
					),
					17: N('You are a whole piece up.', 'Du hast eine ganze Figur mehr.')
				}
			}
		]
	},
	slav: {
		plans: [
			N(
				'…c6 supports d5 without locking in your bishop – develop it to f5 or g4.',
				'…c6 stützt d5, ohne den Läufer einzusperren – entwickle ihn nach f5 oder g4.'
			),
			N(
				'Then …e6, …Nbd7 and …Be7/…Bd6 – a rock-solid position.',
				'Dann …e6, …Sbd7 und …Le7/…Ld6 – eine felsenfeste Stellung.'
			),
			N(
				'Break with …c5 or …e5 once your pieces are developed.',
				'Mit …c5 oder …e5 hebeln, sobald deine Figuren entwickelt sind.'
			)
		],
		pitfalls: [
			N(
				'Leaving b7 undefended when the bishop has left c8 – watch out for Qb3.',
				'b7 ungedeckt lassen, wenn der Läufer c8 verlassen hat – achte auf Db3.'
			),
			N(
				'Trying to keep an extra c4-pawn with …b5 – it often weakens your queenside.',
				'Einen Mehrbauern auf c4 mit …b5 halten wollen – das schwächt oft den Damenflügel.'
			)
		],
		traps: []
	},
	kid: {
		plans: [
			N(
				'Let White build a big centre, then attack it with …e5 or …c5.',
				'Lass Weiß ein großes Zentrum bauen, dann greif es mit …e5 oder …c5 an.'
			),
			N(
				'If the centre closes (d5), attack on the kingside with …Nh5/…Ne8, …f5 and …f4.',
				'Wird das Zentrum geschlossen (d5), greif am Königsflügel an: …Sh5/…Se8, …f5 und …f4.'
			),
			N(
				'The g7-bishop is your star – don’t trade it lightly.',
				'Der Läufer auf g7 ist dein Star – tausche ihn nicht leichtfertig.'
			)
		],
		pitfalls: [
			N(
				'Being too passive: without …e5 or …c5 White just gets more space.',
				'Zu passiv sein: Ohne …e5 oder …c5 bekommt Weiß nur noch mehr Raum.'
			),
			N(
				'Opening the centre while your king is not castled.',
				'Das Zentrum öffnen, solange dein König noch nicht rochiert hat.'
			)
		],
		traps: []
	}
};

export function depthFor(courseId: string): CourseDepth {
	return DEPTH[courseId] ?? { plans: [], pitfalls: [], traps: [] };
}
