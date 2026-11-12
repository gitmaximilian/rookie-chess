import type { en } from './en.js';

type P = Record<string, string | number>;
const s = (n: number | string, one: string, many: string) => (Number(n) === 1 ? one : many);

type Shape<T> = T extends (...a: never[]) => string
	? (p: P) => string
	: T extends string
		? string
		: { [K in keyof T]: Shape<T[K]> };

export const de: Shape<typeof en> = {
	meta: {
		title: 'Rookie – Schach-Trainer',
		description:
			'Kostenloser Schach-Trainer: Spielen, Puzzles, Eröffnungen und Endspiele – offline auf iPhone, iPad und Mac.'
	},
	nav: {
		coach: 'Coach',
		home: 'Start',
		games: 'Partien',
		play: 'Spielen',
		puzzles: 'Puzzles',
		learn: 'Lernen',
		profile: 'Profil',
		main: 'Hauptnavigation',
		foot: 'Kostenlos & Open Source',
		legal: 'Impressum & Datenschutz'
	},
	common: {
		next: 'Weiter',
		back: 'Zurück',
		retry: 'Nochmal versuchen',
		hint: 'Tipp',
		moreHint: 'Noch ein Tipp',
		solution: 'Lösung',
		loading: 'Lade …',
		delete: 'Löschen',
		flip: 'Drehen',
		comingSoon: 'Kommt bald',
		white: 'Weiß',
		black: 'Schwarz',
		you: 'Du',
		moves: (p) => `${p.n} ${s(p.n, 'Zug', 'Züge')}`,
		enterNext: 'Enter oder → für das nächste',
		updateAvailable: 'Neue Version verfügbar',
		reload: 'Neu laden'
	},
	pieces: {
		name: {
			pawn: 'Bauer',
			knight: 'Springer',
			bishop: 'Läufer',
			rook: 'Turm',
			queen: 'Dame',
			king: 'König'
		},
		poss: {
			pawn: 'dein Bauer',
			knight: 'dein Springer',
			bishop: 'dein Läufer',
			rook: 'dein Turm',
			queen: 'deine Dame',
			king: 'dein König'
		},
		Poss: {
			pawn: 'Dein Bauer',
			knight: 'Dein Springer',
			bishop: 'Dein Läufer',
			rook: 'Dein Turm',
			queen: 'Deine Dame',
			king: 'Dein König'
		},
		pron: { pawn: 'ihn', knight: 'ihn', bishop: 'ihn', rook: 'ihn', queen: 'sie', king: 'ihn' },
		acc: {
			pawn: 'den Bauern',
			knight: 'den Springer',
			bishop: 'den Läufer',
			rook: 'den Turm',
			queen: 'die Dame',
			king: 'den König'
		},
		enemy: {
			pawn: 'den gegnerischen Bauern',
			knight: 'den gegnerischen Springer',
			bishop: 'den gegnerischen Läufer',
			rook: 'den gegnerischen Turm',
			queen: 'die gegnerische Dame',
			king: 'den gegnerischen König'
		}
	},
	home: {
		allGames: 'Alle Partien',
		eyebrow: 'Dein Training',
		morning: 'Guten Morgen',
		hello: 'Hallo',
		evening: 'Guten Abend',
		night: 'Gute Nacht',
		streak: 'Trainingsserie in Tagen',
		backup: 'Zeit für eine Sicherung.',
		backupText: 'Safari kann Daten nach längerer Pause löschen.',
		resume: 'Partie fortsetzen',
		resumeVs: (p) => `gegen ${p.bot} · Zug ${p.n}`,
		daily: 'Puzzle des Tages',
		done: 'Erledigt',
		doneText: 'Morgen wartet ein neues Rätsel auf dich.',
		morePuzzles: 'Mehr Puzzles',
		toMove: (p) => `${p.side} am Zug – ${p.theme}`,
		findBest: 'finde den besten Zug',
		dailyText: 'Jeden Tag ein neues Rätsel. Schaffst du es ohne Tipp?',
		solve: 'Lösen',
		goal: 'Tagesziel',
		goalDone: (p) => `Geschafft! ${p.n} Puzzles heute.`,
		goalLeft: (p) => `Noch ${p.n} ${s(p.n, 'Puzzle', 'Puzzles')} bis zum Ziel.`,
		reviews: (p) =>
			Number(p.n) === 0 ? 'Alles wiederholt' : `${p.n} ${s(p.n, 'Wiederholung', 'Wiederholungen')}`,
		reviewsText: (p) =>
			Number(p.n) === 0
				? 'Fehler kommen automatisch zurück.'
				: 'Jetzt fällig – festigt dein Wissen.',
		train: 'Was möchtest du trainieren?',
		modes: {
			play: 'Acht Bots von „Bauer Bruno“ bis „Dame Doris“',
			puzzles: 'Taktik trainieren, Rating aufbauen',
			learn: 'Eröffnungen und Endspiele Schritt für Schritt',
			progress: 'Fortschritt',
			progressText: 'Statistik, Partien und Schwächen'
		}
	},
	bots: {
		bruno: {
			name: 'Bauer Bruno',
			tag: 'Schlägt alles, was sich bewegt – und vergisst seinen König.'
		},
		pia: { name: 'Pia Pferdchen', tag: 'Springt gern herum. Manchmal ins Leere.' },
		leo: { name: 'Leo Läufer', tag: 'Mag lange Diagonalen und kurze Partien.' },
		tina: { name: 'Tina Turm', tag: 'Solide wie eine Burgmauer. Fast immer.' },
		kai: { name: 'Kai Kombinator', tag: 'Sucht immer die Gabel. Findet sie auch oft.' },
		rita: { name: 'Rita Rochade', tag: 'Bringt den König in Sicherheit, dann geht’s los.' },
		sven: { name: 'Sven Springer', tag: 'Taktisch hellwach. Unterschätz ihn nicht.' },
		doris: {
			name: 'Dame Doris',
			tag: 'Die Chefin am Brett. Wer sie schlägt, ist kein Rookie mehr.'
		}
	},
	play: {
		eyebrow: 'Gegen den Computer',
		title: 'Spielen',
		subtitle: 'Wähle einen Gegner, der zu dir passt.',
		opponent: 'Gegner',
		yourOpponent: 'Dein Gegner',
		yourColor: 'Deine Farbe',
		random: 'Zufall',
		timeControl: 'Bedenkzeit',
		noClock: 'Ohne Uhr',
		min10: '10 Min',
		start: 'Partie starten',
		thinking: 'denkt nach …',
		yourTurn: 'Du bist am Zug',
		hint: 'Hinweis',
		undo: 'Zurück',
		resign: 'Aufgeben',
		result: 'Ergebnis',
		resignConfirm: 'Partie wirklich aufgeben?',
		helpers: (p) => `${p.h} ${s(p.h, 'Hinweis', 'Hinweise')} · ${p.u}× zurück`,
		otherOpponent: 'Anderer Gegner',
		won: 'Gewonnen!',
		lost: 'Verloren',
		draw: 'Remis',
		noHelp: 'Ganz ohne Hilfe – stark!',
		rematch: 'Revanche',
		analyse: 'Aus der Partie lernen',
		newOpponent: 'Neuer Gegner',
		event: 'Rookie – Partie gegen Bot'
	},
	coach: {
		tip: {
			queenEarly:
				'Tipp: Die Dame so früh herauszubringen, lässt den Gegner sie mit Tempo jagen. Erst Springer und Läufer!',
			kingWalk: 'Tipp: Königswanderungen in der Eröffnung sind gefährlich – lieber rochieren.',
			rimKnight:
				'Tipp: „Springer am Rand bringt Kummer und Schand“ – am Rand kontrolliert er nur halb so viele Felder.',
			fPawn: 'Tipp: Ein früher f-Bauernzug schwächt deinen König (Diagonale e1–h4 / e8–h5).',
			samePiece:
				'Tipp: Ziehe in der Eröffnung möglichst nicht zweimal dieselbe Figur, solange andere noch zu Hause stehen.',
			castle: 'Tipp: Schon Zug 9 und dein König steht noch in der Mitte – denk bald an die Rochade.'
		},
		hint: {
			ask: 'Coach fragen',
			more: 'Mehr Hilfe',
			show: 'Zug zeigen',
			mate: 'Hier gibt es Matt in einem Zug! Schau dir jedes Schach an.',
			mateSoon: 'Du hast ein erzwungenes Matt – suche Schachs, die dem König keine Felder lassen.',
			capture:
				'Hier kannst du Material gewinnen. Welche gegnerische Figur ist nicht genug gedeckt?',
			check: 'Ein Schach ist hier stark – prüfe alle Schachgebote.',
			castle: 'Zeit, den König in Sicherheit zu bringen.',
			defend: 'Eine deiner Figuren ist in Gefahr – kümmere dich zuerst darum.',
			develop: 'Entwickle eine Figur, die noch zu Hause steht.',
			centre: 'Besetze mit einem Bauern das Zentrum.',
			improve: 'Gerade keine Taktik – verbessere deine schlechteste Figur.',
			piece: (p: P) => `Die Figur: ${p.piece} auf ${p.sq}.`
		},
		threatMate: (p: P) =>
			`Achtung: Dein Gegner droht Matt in ${p.n}! Was würde er spielen, wenn er am Zug wäre?`,
		threatMaterial: (p: P) =>
			`Achtung: ${p.piece} ist bedroht – dein Gegner droht Material zu gewinnen. Decke oder ziehe weg.`,
		showThreat: 'Drohung zeigen',
		punish: (p: P) => `Dein Gegner könnte jetzt ${p.san} antworten.`,
		retry: 'Zurückgenommen – finde einen besseren Zug. Frag den Coach, wenn du Hilfe brauchst.',
		showBetter: 'Besseren Zug zeigen',
		betterWas: (p: P) => `Besser war ${p.san}.`,
		title: 'Coach',
		toggle: 'Mit Coach spielen',
		toggleText: 'Rückmeldung zu jedem Zug, Warnungen und Erklärungen.',
		welcome: 'Ich kommentiere jeden deiner Züge. Geht etwas schief, kannst du ihn zurücknehmen.',
		thinking: 'Coach schaut sich das an …',
		bestTitle: (p: P) => `${p.san} – ausgezeichnet!`,
		goodTitle: (p: P) => `${p.san} – guter Zug.`,
		bestText: 'Das ist hier der stärkste Zug.',
		goodText: 'Ein solider Zug.',
		worseText: 'Dieser Zug verschlechtert deine Stellung.',
		takeback: 'Zurücknehmen',
		keepPlaying: 'Weiterspielen',
		mateTitle: 'Schachmatt!',
		mateText: 'Du hast das Matt gefunden – stark!',
		threat: (p: P) => `Achtung: ${p.piece} auf ${p.sq} wird angegriffen!`,
		oppCheck: 'Dein Gegner gibt Schach – du musst reagieren.',
		opponent: 'Gegner'
	},
	end: {
		checkmate: 'durch Schachmatt',
		resign: 'durch Aufgabe',
		timeout: 'durch Zeitüberschreitung',
		stalemate: 'Patt – kein legaler Zug, aber kein Schach',
		insufficient: 'zu wenig Material zum Mattsetzen',
		threefold: 'dreifache Stellungswiederholung',
		fifty: '50-Züge-Regel'
	},
	puzzles: {
		eyebrow: 'Taktik',
		title: 'Puzzles',
		rating: 'Rating',
		ratingTitle: 'Dein Puzzle-Rating',
		streakTitle: 'Serie in dieser Sitzung',
		modes: 'Puzzle-Modus',
		forYou: 'Für dich',
		daily: 'Des Tages',
		review: 'Wiederholen',
		mistakes: 'Meine Fehler',
		allThemes: 'Alle Themen …',
		fewer: 'Weniger',
		board: 'Puzzle-Brett',
		allDone: 'Alles wiederholt!',
		nothing: 'Noch nichts hier',
		allDoneText: 'Keine Puzzles sind gerade fällig. Falsch gelöste kommen automatisch wieder.',
		nothingText:
			'Spiele Partien oder importiere deine Partien – Rookie macht aus deinen Fehlern eigene Puzzles.',
		newPuzzles: 'Neue Puzzles',
		loadError: 'Puzzles nicht geladen',
		loadErrorText: (p) =>
			`${p.msg}. Bist du offline? Gespeicherte Puzzle-Pakete funktionieren trotzdem.`,
		opponentMoves: 'Gegner zieht …',
		solved: 'Gelöst!',
		failed: 'Nicht ganz – so geht’s',
		whiteToMove: 'Weiß am Zug – finde den besten Zug',
		blackToMove: 'Schwarz am Zug – finde den besten Zug',
		fromGame: 'Aus deiner Partie',
		puzzleRating: (p) => `Puzzle-Rating ${p.r}`,
		praise: 'Stark!|Sauber gelöst!|Genau so!|Perfekt!',
		withHint: 'Gut gemacht – mit kleinem Tipp.',
		noProblem: 'Kein Problem – genau so lernst du.',
		reviewIn: (p) => `Kommt ${p.when} zur Wiederholung.`,
		tryAgain: 'Nicht ganz. Versuch’s nochmal!',
		today: 'Heute gelöst',
		todayGoal: 'Tagesziel',
		goalReached: 'Tagesziel geschafft! Was kommt als Nächstes?',
		mistakeNote: (p) => `${p.what} gegen ${p.opp} – finde den besseren Zug.`
	},
	srs: {
		soon: 'gleich',
		minutes: (p) => `in ${p.n} Min.`,
		hours: (p) => `in ${p.n} Std.`,
		tomorrow: 'morgen',
		days: (p) => `in ${p.n} Tagen`,
		month: 'in einem Monat',
		months: (p) => `in ${p.n} Monaten`
	},
	themes: {
		mateIn1: { name: 'Matt in 1', about: 'Ein Zug – und der König ist matt.' },
		mateIn2: { name: 'Matt in 2', about: 'Zwei Züge bis zum Matt. Schach ist oft der Schlüssel.' },
		mateIn3: { name: 'Matt in 3', about: 'Drei Züge bis zum Matt.' },
		hangingPiece: { name: 'Hängende Figur', about: 'Eine Figur ist ungedeckt – schnapp sie dir!' },
		fork: { name: 'Gabel', about: 'Eine Figur greift zwei gegnerische gleichzeitig an.' },
		pin: {
			name: 'Fesselung',
			about: 'Eine Figur kann nicht ziehen, ohne eine wertvollere preiszugeben.'
		},
		skewer: { name: 'Spieß', about: 'Wie eine Fesselung – nur steht die wertvollere Figur vorne.' },
		discoveredAttack: {
			name: 'Abzugsangriff',
			about: 'Eine Figur zieht weg und gibt den Weg für einen Angriff frei.'
		},
		doubleCheck: { name: 'Doppelschach', about: 'Zwei Figuren geben gleichzeitig Schach.' },
		backRankMate: {
			name: 'Grundreihenmatt',
			about: 'Der König ist hinter seinen eigenen Bauern gefangen.'
		},
		smotheredMate: {
			name: 'Ersticktes Matt',
			about: 'Ein Springer setzt den eingeklemmten König matt.'
		},
		trappedPiece: { name: 'Gefangene Figur', about: 'Eine Figur hat kein sicheres Feld mehr.' },
		capturingDefender: {
			name: 'Verteidiger schlagen',
			about: 'Schlag die Figur, die alles zusammenhält.'
		},
		deflection: { name: 'Ablenkung', about: 'Lenke eine Figur von ihrer wichtigen Aufgabe ab.' },
		attraction: { name: 'Hinlenkung', about: 'Locke eine Figur auf ein ungünstiges Feld.' },
		sacrifice: { name: 'Opfer', about: 'Gib Material, um mehr zu gewinnen.' },
		promotion: { name: 'Umwandlung', about: 'Ein Bauer wird zur Dame (oder etwas anderem).' },
		advancedPawn: { name: 'Vorgerückter Bauer', about: 'Ein Bauer kurz vor der Umwandlung.' },
		quietMove: { name: 'Stiller Zug', about: 'Kein Schach, kein Schlagen – und trotzdem stark.' },
		defensiveMove: { name: 'Verteidigung', about: 'Finde den Zug, der alles rettet.' },
		exposedKing: { name: 'Ungeschützter König', about: 'Der König steht offen – greif an!' },
		kingsideAttack: {
			name: 'Angriff am Königsflügel',
			about: 'Angriff auf den kurz rochierten König.'
		},
		intermezzo: {
			name: 'Zwischenzug',
			about: 'Erst ein unerwarteter Zug, dann das Offensichtliche.'
		},
		xRayAttack: { name: 'Röntgenangriff', about: 'Eine Figur wirkt durch eine andere hindurch.' },
		clearance: {
			name: 'Räumung',
			about: 'Mach ein Feld oder eine Linie für eine andere Figur frei.'
		},
		interference: { name: 'Verstellung', about: 'Stell dich zwischen gegnerische Figuren.' },
		endgame: { name: 'Endspiel', about: 'Wenige Figuren, präzise Technik.' },
		middlegame: { name: 'Mittelspiel', about: 'Taktik mitten in der Partie.' },
		opening: { name: 'Eröffnung', about: 'Fallen und Tricks in den ersten Zügen.' },
		pawnEndgame: { name: 'Bauernendspiel', about: 'Nur Könige und Bauern.' },
		rookEndgame: { name: 'Turmendspiel', about: 'Das häufigste Endspiel überhaupt.' },
		crushing: { name: 'Entscheidender Vorteil', about: 'Ein Zug, der die Partie entscheidet.' },
		short: { name: 'Kurz', about: 'Ein bis zwei Züge.' },
		long: { name: 'Lang', about: 'Drei Züge oder mehr.' },
		mate: { name: 'Matt', about: 'Am Ende steht Schachmatt.' },
		anastasiaMate: {
			name: 'Anastasias Matt',
			about: 'Springer und Turm fangen den König am Rand.'
		},
		arabianMate: { name: 'Arabisches Matt', about: 'Springer und Turm in der Ecke.' },
		hookMate: { name: 'Hakenmatt', about: 'Turm, Springer und Bauer arbeiten zusammen.' },
		enPassant: { name: 'En passant', about: 'Der seltene Bauernschlag im Vorbeigehen.' },
		castling: { name: 'Rochade', about: 'Die Rochade als Lösung.' },
		underPromotion: {
			name: 'Unterverwandlung',
			about: 'Manchmal ist ein Springer besser als eine Dame.'
		},
		zugzwang: { name: 'Zugzwang', about: 'Jeder Zug verschlechtert die Stellung des Gegners.' }
	},
	analysis: {
		eyebrow: 'Analyse',
		title: 'Meine Partien',
		subtitle: 'Jede Partie wird von Stockfish analysiert – mit Erklärungen in einfachem Deutsch.',
		empty: 'Noch keine Partien',
		emptyText: 'Spiel gegen einen Bot, importiere deine Online-Partien oder füge ein PGN ein.',
		playGame: 'Partie spielen',
		import: 'Importieren',
		vs: (p) => `gegen ${p.name}`,
		analysed: 'analysiert',
		deleteConfirm: 'Partie löschen?',
		deleteGame: 'Partie löschen',
		pastePgn: 'PGN einfügen',
		pasteText: 'Partie aus einem anderen Programm? Einfach hier einfügen.',
		analyse: 'Analysieren',
		paste: 'Einfügen',
		importLink: 'Partien von Lichess oder Chess.com laden',
		notFound: 'Partie nicht gefunden',
		toGames: 'Zu deinen Partien',
		showMore: (p: P) => `Mehr anzeigen (${p.n} ältere)`,
		filter: {
			all: 'Alle',
			lichess: 'Lichess',
			chesscom: 'Chess.com',
			bot: 'Bots',
			friend: 'Freunde',
			mistakes: 'Mit Fehlern'
		},
		today: 'Heute',
		yesterday: 'Gestern',
		brilliantMoves: (p) => `${p.n} ${s(p.n, 'brillanter Zug', 'brillante Züge')}`,
		formAria: (p) => `Ergebnisse deiner letzten ${p.n} Partien`,
		analyseShort: 'Analysieren',
		notYet: 'noch nicht analysiert',
		games: 'Partien',
		running: 'Stockfish analysiert …',
		resume: 'Fortsetzen',
		start: 'Ausgangsstellung',
		startText:
			'Tippe auf ›, um Zug für Zug durchzugehen, oder auf die rote Zielscheibe für deinen nächsten Fehler.',
		opponentMove: (p) => `Zug von ${p.name}`,
		best: 'Genau der Zug, den auch Stockfish spielt.',
		solid: 'Ein solider Zug.',
		bestHere: 'Bester Zug hier:',
		practice: (p) => `${p.n} neue ${s(p.n, 'Übung', 'Übungen')}`,
		hubPractice: (p) => `${p.n} ${s(p.n, 'Stellung', 'Stellungen')} aus deinen Partien zum Üben`,
		hubPracticeText: 'Finde den besseren Zug – damit dir derselbe Fehler nicht wieder passiert.',
		practiceText: 'aus deinen Fehlern – jetzt trainieren',
		downloadPgn: 'PGN herunterladen',
		board: 'Analyse-Brett',
		graph: 'Bewertungsverlauf',
		legend: { blunder: 'Patzer', mistake: 'Fehler', inaccuracy: 'Ungenau' },
		tooFew: 'Die Partie hat zu wenige Züge.',
		pgnError: 'PGN konnte nicht gelesen werden.',
		clipboard: 'Kein Zugriff auf die Zwischenablage – bitte einfügen (⌘V).',
		unknown: 'Unbekannt',
		result: { win: 'Sieg', loss: 'Niederlage', draw: 'Remis', open: 'Offen' },
		source: { bot: 'Bot', lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN', friend: 'Freund' },
		nav: {
			nextMistake: 'Zu deinem nächsten Fehler ({n} in dieser Partie)',
			first: 'Anfang',
			prev: 'Zurück',
			next: 'Vor',
			last: 'Ende',
			flip: 'Brett drehen'
		}
	},
	review: {
		head: {
			brilliant: (p) => `${p.san} ist brillant`,
			great: (p) => `${p.san} ist ein starker Zug`,
			best: (p) => `${p.san} ist der beste Zug`,
			excellent: (p) => `${p.san} ist exzellent`,
			good: (p) => `${p.san} ist ein guter Zug`,
			book: (p) => `${p.san} ist Eröffnungstheorie`,
			inaccuracy: (p) => `${p.san} ist ungenau`,
			mistake: (p) => `${p.san} ist ein Fehler`,
			miss: (p) => `${p.san} verpasst eine Chance`,
			blunder: (p) => `${p.san} ist ein Patzer`
		},
		text: {
			book: (p) => `Bekannte Eröffnung: ${p.name}.`,
			bookPlain: 'Bekannte Eröffnungstheorie – tausendfach gespielt.',
			brilliant: (p) => `Ein Opfer, das wirklich funktioniert${p.line ? `: ${p.line}` : ''}.`,
			great: 'Der einzige Zug, der die Stellung hält – alles andere ist klar schlechter.',
			best: 'Genau das, was auch die Engine spielen würde.',
			excellent: 'Fast so stark wie der Engine-Zug.',
			good: 'Ein solider Zug.',
			punish: (p) => `das bestrafst du mit ${p.san}.`,
			alt: (p) => `Noch stärker war ${p.san}.`
		},
		does: {
			castle: 'Der König steht sicher, und der Turm kommt ins Spiel.',
			promote: 'Der Bauer wird zur neuen Dame.',
			mate: 'Schachmatt – Partie vorbei!',
			capture: (p) => `Schlägt ${p.piece}.`,
			check: 'Gibt Schach.',
			attack: (p) => `Greift ${p.piece} auf ${p.sq} an.`,
			develop: (p) => `Entwickelt ${p.piece} Richtung Zentrum.`,
			center: 'Besetzt das Zentrum.'
		},
		verdict: {
			equal: 'Ausgeglichen',
			slightly: (p) => `${p.side} steht etwas besser`,
			better: (p) => `${p.side} steht besser`,
			winning: (p) => `${p.side} steht auf Gewinn`,
			whiteMates: (p) => `Weiß setzt in ${p.n} matt`,
			blackMates: (p) => `Schwarz setzt in ${p.n} matt`,
			mated: 'Schachmatt'
		},
		kind: {
			brilliant: 'Brillant',
			great: 'Stark',
			best: 'Bester',
			excellent: 'Exzellent',
			good: 'Gut',
			book: 'Buch',
			inaccuracy: 'Ungenau',
			mistake: 'Fehler',
			miss: 'Verpasst',
			blunder: 'Patzer'
		},
		accuracy: 'Genauigkeit',
		lines: 'Beste Engine-Züge',
		linesHint: 'Tippe auf eine Variante, um sie am Brett zu sehen',
		thinking: 'Engine rechnet …',
		depth: (p) => `Tiefe ${p.d}`,
		start: 'Ausgangsstellung',
		startText:
			'Tippe auf ›, um Zug für Zug durch die Partie zu gehen. Jeder Zug bekommt einen Kommentar.',
		over: 'Partie beendet',
		summary: 'Partie-Besprechung',
		opponentMove: (p) => `Zug von ${p.name}`,
		yourMove: 'Dein Zug'
	},
	judgement: {
		blunder: 'Patzer',
		mistake: 'Fehler',
		inaccuracy: 'Ungenauigkeit',
		good: 'Guter Zug',
		best: 'Bester Zug'
	},
	explain: {
		better: (p) => `Besser war ${p.san}.`,
		mateMissedTitle: (p) => `Matt in ${p.n} übersehen`,
		mateMissedText: (p) => `Du hattest ein erzwungenes Matt: ${p.line}.`,
		mateAllowedTitle: 'Matt zugelassen',
		mateAllowedText: (p) =>
			`Nach diesem Zug kann dein Gegner in ${p.n} ${s(p.n, 'Zug', 'Zügen')} mattsetzen${p.line ? ` (${p.line})` : ''}.`,
		blunderedTitle: 'Figur eingestellt',
		hangingTitle: 'Figur hängt',
		blunderedText: (p) => `${p.Piece} auf ${p.sq} ist ungeschützt – ${p.reply} schlägt ${p.pron}.`,
		hangingText: (p) => `Nach deinem Zug hängt ${p.piece} auf ${p.sq}: ${p.reply}.`,
		forkTitle: 'Gabel zugelassen',
		forkText: (p) =>
			`Dein Gegner hat ${p.reply} – damit greift er ${p.a} und ${p.b} gleichzeitig an.`,
		missedTitle: 'Chance verpasst',
		missedText: (p) => `Mit ${p.best} hättest du ${p.piece} auf ${p.sq} gewinnen können.`,
		inaccuracyTitle: 'Nicht der beste Zug',
		worseTitle: 'Stellung verschlechtert',
		positionalText: (p) =>
			`Dieser Zug verschlechtert deine Stellung.${p.best ? ` Stärker war ${p.best}${p.idea ? ` (danach ${p.idea})` : ''}.` : ''}`
	},
	account: {
		title: 'Konto & Synchronisation',
		pitch: 'Sichere deinen Fortschritt in der Cloud und nutze ihn auf iPhone, iPad und Mac.',
		how: 'Anmeldung mit Passkey (Face ID / Touch ID). Keine E-Mail, kein Passwort, kein Name – gespeichert wird nur eine anonyme Konto-ID.',
		create: 'Konto erstellen',
		signIn: 'Anmelden',
		terms:
			'Mit dem Erstellen bestätigst du, dass du mindestens 14 Jahre alt bist oder die Zustimmung deiner Eltern hast.',
		privacy: 'Datenschutzhinweise',
		signedIn: 'Angemeldet – dein Fortschritt wird automatisch gespeichert.',
		since: (p: P) => `Konto seit ${p.date}`,
		lastSync: (p: P) => `Zuletzt abgeglichen ${p.when}`,
		never: 'Noch nicht abgeglichen',
		syncNow: 'Jetzt abgleichen',
		syncing: 'Wird abgeglichen …',
		signOut: 'Abmelden',
		export: 'Meine Serverdaten herunterladen',
		delete: 'Konto löschen',
		deleteConfirm:
			'Konto und alle auf dem Server gespeicherten Daten jetzt löschen? Das kann nicht rückgängig gemacht werden. Die Daten auf diesem Gerät bleiben erhalten.',
		deleted: 'Konto gelöscht. Alle Serverdaten wurden entfernt.',
		notSynced:
			'Importierte Lichess-/Chess.com-Partien werden nicht hochgeladen – sie werden auf jedem Gerät über dein verknüpftes Konto neu geladen.',
		offline: 'Offline – der Abgleich läuft automatisch weiter, sobald du online bist.',
		err: {
			cancelled: 'Abgebrochen.',
			unsupported:
				'Dieser Browser unterstützt keine Passkeys. Bitte iOS/macOS aktualisieren oder Safari verwenden.',
			network: 'Keine Verbindung zum Server. Bitte später erneut versuchen.',
			tooLarge:
				'Deine Daten sind zu groß für den Abgleich. Lösche ein paar alte Partien und versuche es erneut.',
			server: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
			unknownPasskey: 'Dieser Passkey gehört zu einem Konto, das es nicht mehr gibt.'
		}
	},
	settings: {
		eyebrow: 'Rookie',
		title: 'Einstellungen',
		appearance: 'Darstellung',
		auto: 'Automatisch',
		light: 'Hell',
		dark: 'Dunkel',
		language: 'Sprache',
		boardTitle: 'Brett & Figuren',
		boardTheme: 'Brett',
		pieceSet: 'Figuren',
		animation: 'Animation',
		anim: { off: 'Aus', fast: 'Schnell', normal: 'Normal', slow: 'Langsam' },
		coords: 'Koordinaten',
		showDests: 'Mögliche Züge anzeigen',
		highlightLast: 'Letzten Zug hervorheben',
		themes: {
			wood: 'Holz',
			brown: 'Klassisch',
			green: 'Grün',
			blue: 'Blau',
			slate: 'Schiefer',
			purple: 'Lila',
			coral: 'Koralle'
		},
		sound: 'Töne',
		soundStyle: 'Klangstil',
		soundStyles: { wood: 'Holz', soft: 'Sanft', chime: 'Glocke' },
		goal: 'Tagesziel',
		goalText: 'Wie viele Puzzles möchtest du pro Tag lösen?',
		data: 'Deine Daten',
		dataText:
			'Ohne Konto bleibt alles nur auf diesem Gerät. Mit einer Sicherungsdatei nimmst du deinen Fortschritt selbst auf ein anderes Gerät mit (z. B. vom iPhone auf den Mac).',
		facts: (p) => `${p.g} Partien · ${p.a} Puzzle-Versuche · ${p.c} Wiederholungskarten`,
		protected: 'Daten sind vor automatischem Löschen geschützt.',
		unprotected: 'Safari kann Daten nach längerer Nichtnutzung löschen.',
		protect: 'Schützen',
		protectOk: 'Dein Browser hebt die Daten jetzt dauerhaft auf.',
		protectFail:
			'Der Browser hat abgelehnt. Tipp: Rookie zum Home-Bildschirm hinzufügen – dann ist der Schutz meist automatisch aktiv.',
		save: 'Sicherung speichern',
		load: 'Sicherung laden',
		saved: 'Sicherung heruntergeladen. Leg sie z. B. in iCloud Drive ab.',
		importConfirm: 'Alle aktuellen Daten durch die Sicherung ersetzen?',
		imported: 'Sicherung eingespielt. Willkommen zurück!',
		importFail: 'Import fehlgeschlagen.',
		never: 'Noch keine Sicherung erstellt.',
		todayBackup: 'Letzte Sicherung: heute.',
		ago: (p) => `Letzte Sicherung: vor ${p.n} ${s(p.n, 'Tag', 'Tagen')}.`,
		reset: 'Zurücksetzen',
		resetText: 'Löscht alle Partien, Puzzles, Wiederholungen und Einstellungen auf diesem Gerät.',
		resetBtn: 'Alle Daten löschen',
		reset1: 'Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.',
		reset2: 'Letzte Chance: Hast du eine Sicherung? Jetzt alles löschen?',
		badJson: 'Die Datei ist kein gültiges JSON.',
		notBackup: 'Das ist keine Rookie-Sicherung.',
		newer: 'Die Sicherung stammt aus einer neueren Rookie-Version.'
	},
	learn: {
		continue: 'Weiter lernen',
		eyebrow: 'Wissen',
		title: 'Lernen',
		subtitle: 'Grundlagen, Taktik, Eröffnungen und Endspiele – Schritt für Schritt.',
		endgames: 'Endspiele',
		endgamesText: 'Lerne die wichtigsten Techniken – mit perfektem Spiel aus der Tablebase.',
		openings: 'Eröffnungen',
		openingsText:
			'Bau dein eigenes Repertoire und trainiere es mit Wiederholung im richtigen Moment.',
		level: (p) => ['', 'Leicht', 'Mittel', 'Schwer'][Number(p.n)],
		goal: { mate: 'Setze matt', promote: 'Wandle den Bauern um', draw: 'Halte remis' },
		maxMoves: (p) => `in ≤ ${p.n} Zügen`,
		survive: (p) => `über ${p.n} Züge`
	},
	basics: {
		upNext: 'Als Nächstes',
		title: 'Schach-Grundlagen',
		hubText:
			'Neu im Schach? Lerne jede Regel Schritt für Schritt – mit kleinen Spielen auf dem Brett.',
		subtitle: 'Vom allerersten Zug bis zum Schachmatt – immer ein kleiner Schritt.',
		progress: (p: P) => `${p.n} von ${p.m} Lektionen erledigt`,
		steps: (p: P) => `${p.n} Schritte`,
		step: (p: P) => `Schritt ${p.i} von ${p.n}`,
		next: 'Weiter',
		starsLeft: (p: P) => `Noch ${p.n} ${p.n === 1 ? 'Stern' : 'Sterne'}`,
		allStars: (p: P) => `Alle Sterne in ${p.n} ${p.n === 1 ? 'Zug' : 'Zügen'} gesammelt!`,
		tryAgain: 'Nicht ganz – versuch es nochmal.',
		lessonDone: 'Lektion geschafft!',
		nextLesson: 'Nächste Lektion',
		overview: 'Alle Lektionen',
		again: 'Nochmal'
	},
	endgame: {
		back: 'Lernen',
		howTo: 'So geht’s',
		youPlay: (p) => `Du spielst ${p.side}`,
		goal: 'Ziel',
		movesLeft: (p) => `noch ${p.n} ${s(p.n, 'Zug', 'Züge')}`,
		movesUsed: (p) => `Zug ${p.n} von ${p.max}`,
		yourTurn: 'Du bist am Zug',
		opponent: 'Gegner denkt …',
		success: 'Lektion geschafft!',
		fail: 'Diesmal nicht',
		again: 'Nochmal',
		nextPos: 'Nächste Stellung',
		position: (p) => `Stellung ${p.i} von ${p.n}`,
		offline: 'Offline: Stockfish spielt den Gegner (ohne Tablebase).',
		stars: (p) => `${p.n} von 3 Sternen`,
		board: 'Endspiel-Brett',
		theoryStep: (p: P) => `Technik · Schritt ${p.i} von ${p.n}`,
		startChallenge: 'Selbst ausprobieren',
		showTheory: 'Technik nochmal ansehen',
		coach: {
			best: 'Ausgezeichnet – der beste Zug.',
			bestMate: (p: P) => `Ausgezeichnet – der schnellste Weg. Matt in ${p.n}.`,
			good: 'Gut – weiter auf Kurs.',
			goodMate: (p: P) => `Guter Zug – Matt in ${p.n}.`,
			slow: (p: P) => `Immer noch gewonnen, aber ${p.san} war genauer.`,
			slowMate: (p: P) =>
				`Immer noch gewonnen, aber langsamer: ${p.san} setzt in ${p.n} statt ${p.m} Zügen matt.`,
			holds: 'Gute Verteidigung – das Remis hält.',
			stalemate:
				'Vorsicht: Der König hat nur noch einen Zug. Nimm ihm nicht das letzte Feld – Patt!'
		},
		msg: {
			mate: 'Schachmatt – perfekt!',
			stalemateFail:
				'Patt! Der gegnerische König hat kein Feld mehr, steht aber nicht im Schach – nur remis.',
			stalemateOk: 'Patt – remis gehalten!',
			drawFail: 'Remis – der Gewinn ist weg.',
			drawOk: 'Remis – sauber verteidigt!',
			promoted: 'Umgewandelt – die neue Dame entscheidet die Partie!',
			throwsWin: 'Dieser Zug verschenkt den Sieg – die Stellung ist jetzt nur noch remis.',
			oppWins: 'Nach diesem Zug gewinnt dein Gegner.',
			survived: (p) => `${p.n} Züge überstanden – remis gehalten!`,
			tooSlow: (p) => `Ziel nicht in ${p.n} Zügen erreicht. Versuch es effizienter!`,
			pawnCaught: 'Bauer erwischt – remis!',
			mated: 'Du wurdest mattgesetzt.',
			drawn: 'Remis – geschafft!'
		}
	},
	lessons: {
		kqk: {
			title: 'Matt mit der Dame',
			subtitle: 'König + Dame gegen König',
			s1: 'Stell die Dame einen Springerzug vom gegnerischen König entfernt – so wird sein Bereich kleiner.',
			s2: 'Spiegle die Bewegungen des Königs und drück ihn Schritt für Schritt an den Rand.',
			s3: 'Steht er am Rand: Achtung Patt! Lass ihm immer ein Feld, bis dein König hilft.',
			s4: 'Hol deinen König heran – zusammen mit der Dame setzt du matt.'
		},
		kkrr: {
			title: 'Treppenmatt',
			subtitle: 'Zwei Türme gegen König',
			s1: 'Ein Turm sperrt eine Reihe ab, der andere gibt Schach auf der nächsten.',
			s2: 'Abwechselnd ziehen die Türme eine Reihe weiter – wie eine Treppe.',
			s3: 'Kommt der König einem Turm zu nahe, zieh diesen Turm weit weg auf die andere Seite.',
			s4: 'Am Rand angekommen: Schach auf der letzten Reihe ist Matt.'
		},
		krk: {
			title: 'Matt mit dem Turm',
			subtitle: 'König + Turm gegen König',
			s1: 'Der Turm schneidet den gegnerischen König ab – wie eine Wand.',
			s2: 'Bring deinen König nach vorne, in Opposition zum gegnerischen König.',
			s3: 'Stehen sich die Könige gegenüber, gibt der Turm Schach – die Wand rückt eine Reihe vor.',
			s4: 'Hat der König Platz, mach einen Wartezug mit dem Turm. Wiederhole bis zum Rand.'
		},
		opposition: {
			title: 'Die Opposition',
			subtitle: 'König + Bauer gegen König',
			s1: 'Der König geht vor dem Bauern – nicht der Bauer zuerst!',
			s2: 'Opposition: Die Könige stehen sich mit einem Feld Abstand gegenüber, der Gegner ist am Zug.',
			s3: 'Ein Bauernzug als Reserve („Tempo“) kann dir die Opposition schenken.',
			s4: 'Erreicht dein König die 6. Reihe vor dem Bauern, ist die Partie gewonnen.'
		},
		square: {
			title: 'Die Quadratregel',
			subtitle: 'Fang den Freibauern',
			s1: 'Stell dir ein Quadrat vor: vom Bauern bis zur Umwandlungsreihe, gleich breit wie hoch.',
			s2: 'Kann dein König mit seinem Zug ins Quadrat treten, holt er den Bauern ein.',
			s3: 'Lauf diagonal – so kommst du am schnellsten heran.',
			s4: 'Schlag den Bauern oder blockiere sein Umwandlungsfeld.'
		},
		kqkp: {
			title: 'Dame gegen Bauer',
			subtitle: 'Den Bauern auf der 7. Reihe stoppen',
			s1: 'Der Bauer steht kurz vor der Umwandlung. Du musst mit Schachs Zeit gewinnen.',
			s2: 'Gib von der Seite oder schräg Schach, bis der König vor seinen eigenen Bauern ziehen muss.',
			s3: 'König vor dem Bauern = Bauer blockiert. Jetzt hast du einen freien Zug: Hol deinen König heran.',
			s4: 'Wiederholen: Schach, König davor zwingen, näher kommen – bis König und Dame matt setzen oder den Bauern gewinnen.'
		},
		krkp: {
			title: 'Turm gegen Bauer',
			subtitle: 'Der Turm stoppt den Bauern',
			s1: 'Stell den Turm hinter den Bauern – von hinten kontrolliert er jedes Feld, das der Bauer erreichen will.',
			s2: 'Bring deinen König so schnell wie möglich zum Bauern.',
			s3: 'Turm und König gemeinsam gewinnen den Bauern. Deckt der gegnerische König ihn, greif mit deinem König an.',
			s4: 'Bauer weg? Dann folgt das normale Turmmatt, das du schon kennst.'
		},
		kbbk: {
			title: 'Matt mit zwei Läufern',
			subtitle: 'König + zwei Läufer gegen König',
			s1: 'Zwei Läufer auf benachbarten Diagonalen bilden eine Mauer, die der König nicht überqueren kann.',
			s2: 'Halte die Läufer nebeneinander, nahe bei deinem König, und verkleinere den Käfig Schritt für Schritt.',
			s3: 'Treib den König an den Rand, dann in eine beliebige Ecke – dein König muss mithelfen.',
			s4: 'In der Ecke: Ein Läufer deckt das Fluchtfeld, der andere setzt matt.'
		},
		lucena: {
			title: 'Lucena-Stellung',
			subtitle: 'Turmendspiel gewinnen: der Brückenbau',
			s1: 'Vertreib zuerst den gegnerischen König mit einem Turmschach von der Seite.',
			s2: 'Stell deinen Turm auf die 4. Reihe – dort baust du später die „Brücke“.',
			s3: 'Dein König verlässt das Umwandlungsfeld und läuft Richtung Turm.',
			s4: 'Kommen Schachs von hinten, schiebt sich der Turm dazwischen: Die Brücke steht, der Bauer wird zur Dame.'
		},
		philidor: {
			title: 'Philidor-Verteidigung',
			subtitle: 'Turmendspiel halten',
			s1: 'Dein Turm bleibt auf der 6. Reihe – so kann der weiße König nicht vorrücken.',
			s2: 'Erst wenn der Bauer auf die 6. Reihe zieht, gehst du mit dem Turm ganz nach hinten.',
			s3: 'Von hinten gibst du Schach um Schach – der weiße König findet keinen Schutz mehr.',
			s4: 'Halte die Stellung, bis die Zeit um ist.'
		}
	},
	openings: {
		startHere: 'Starte mit einem Kurs',
		startHereText:
			'Such dir unten eine Eröffnung aus und lerne sie Zug für Zug. Jede gelernte Variante landet in deinem Repertoire – hier kannst du sie dann trainieren.',
		repertoire: 'Dein Repertoire',
		title: 'Eröffnungstrainer',
		subtitle: 'Dein Repertoire – trainiert mit Wiederholung im richtigen Moment.',
		asWhite: 'Mit Weiß',
		asBlack: 'Mit Schwarz',
		moves: (p) => `${p.n} ${s(p.n, 'Zug', 'Züge')} im Repertoire`,
		due: (p) => `${p.n} fällig`,
		train: 'Trainieren',
		edit: 'Bearbeiten',
		starters: 'Start-Repertoires',
		startersText: 'Bewährte, anfängerfreundliche Varianten – mit einem Tipp hinzufügen.',
		add: 'Hinzufügen',
		added: 'Hinzugefügt',
		editorTitle: (p) => `Repertoire mit ${p.side}`,
		editorHint:
			'Spiel Züge auf dem Brett. Deine Züge werden gelernt, die Gegnerzüge sind die Varianten, auf die du dich vorbereitest.',
		yourMove: 'dein Zug',
		theirMove: 'Gegner',
		noMoves: 'Hier gibt es noch keine Züge. Spiel einen Zug auf dem Brett.',
		remove: 'Variante entfernen',
		removeConfirm: 'Diesen Zug und alles danach entfernen?',
		toStart: 'Zur Grundstellung',
		trainTitle: 'Training',
		trainPrompt: 'Spiel deinen Repertoire-Zug',
		correct: 'Richtig!',
		wrong: (p) => `Dein Repertoire sagt ${p.san}.`,
		lineDone: 'Variante geschafft!',
		nothingDue: 'Nichts fällig – dein Repertoire sitzt.',
		nothingDueText: 'Komm später wieder oder füge neue Züge hinzu.',
		empty: 'Dein Repertoire ist noch leer.',
		emptyText: 'Füge ein Start-Repertoire hinzu oder spiel eigene Züge im Editor.',
		comment: 'Kommentar',
		explorer: 'Bekannte Fortsetzungen (Eröffnungsbuch)',
		explorerOff: 'Explorer nicht verfügbar (offline oder gesperrt).',
		games: (p) => `${p.n} Partien`,
		rep: {
			italian: {
				name: 'Italienische Partie',
				text: '1.e4 e5 2.Sf3 Sc6 3.Lc4 – schnelle Entwicklung, Blick auf f7.'
			},
			london: { name: 'Londoner System', text: '1.d4 mit Lf4 – derselbe Aufbau gegen fast alles.' },
			e5: { name: '1…e5 mit Schwarz', text: 'Auf 1.e4 mit e5 antworten und klassisch entwickeln.' },
			caro: { name: 'Caro-Kann', text: '1.e4 c6 – solide und sicher, beliebt bei Einsteigern.' },
			qgd: {
				name: 'Abgelehntes Damengambit',
				text: '1.d4 d5 2.c4 e6 – die klassische Antwort auf 1.d4.'
			}
		}
	},
	course: {
		study: 'Lernen',
		studyLine: 'Variante lernen',
		practise: 'Üben',
		howItWorks: 'So lernst du',
		step1: 'Lernen – geh die Variante Zug für Zug durch, jeder Zug wird erklärt.',
		step2: 'Üben – spiel die Züge selbst, mit Hinweisen und Engine-Feedback.',
		step3:
			'Quiz & Wiederholung – gemischte Stellungen und Wiederholung nach Plan festigen das Wissen.',
		studyIntro:
			'Tippe auf „Weiter“, um die Variante durchzuspielen. Lies, warum jeder Zug gespielt wird.',
		moveOf: (p: P) => `Zug ${p.n} von ${p.m}`,
		next: 'Weiter',
		prev: 'Zurück',
		nextMove: 'Nächster Zug',
		studyDone: 'Jetzt selbst spielen',
		studyDoneText: 'Du hast die ganze Variante gesehen. Übe sie jetzt, solange sie frisch ist.',
		plans: 'Pläne fürs Mittelspiel',
		plansText: 'Was du tust, wenn die Eröffnungszüge vorbei sind.',
		pitfalls: 'Typische Fehler',
		traps: 'Fallen',
		trapsText: 'Kenne die Tricks – stell sie selbst und tapp nie hinein.',
		trapSet: 'Falle, die du stellen kannst',
		trapAvoid: 'Falle, die du vermeiden musst',
		theMistake: 'Der Fehler',
		quiz: 'Quiz',
		quizTitle: 'Eröffnungsquiz',
		quizText: '10 gemischte Stellungen aus diesem Kurs – finde deinen Zug.',
		quizPrompt: (p: P) => `${p.line}: Was spielst du?`,
		quizCorrect: 'Richtig!',
		quizWrong: (p: P) => `Der Kurszug ist ${p.san}.`,
		quizDone: (p: P) => `${p.n} von ${p.m} richtig`,
		quizAgain: 'Neues Quiz',
		quizLocked: 'Lerne zuerst eine Variante, um das Quiz freizuschalten.',
		courses: 'Eröffnungskurse',
		coursesText:
			'Lerne echte Eröffnungen Schritt für Schritt – mit einer Erklärung zu jedem wichtigen Zug.',
		forWhite: 'Für Weiß',
		vsE4: 'Schwarz gegen 1.e4',
		vsD4: 'Schwarz gegen 1.d4',
		level1: 'Leicht',
		level2: 'Mittel',
		level3: 'Fortgeschritten',
		progress: (p: P) => `${p.n} von ${p.m} Varianten gelernt`,
		ideas: 'Die wichtigsten Ideen',
		lines: 'Varianten',
		learn: 'Lernen',
		repeat: 'Wiederholen',
		learned: 'Gelernt',
		start: 'Los geht’s',
		you: 'Du',
		opponent: 'Gegner',
		yourMove: 'Dein Zug – was spielst du?',
		watch: 'Schau dir die Antwort des Gegners an …',
		hint: 'Tipp',
		hintPiece: (p: P) => `Zu ziehende Figur: ${p.piece}`,
		showMove: 'Zeig’s mir',
		correct: 'Richtig!',
		retry: 'Nochmal versuchen',
		checking: 'Dein Zug wird geprüft …',
		lineDone: 'Variante gelernt!',
		lineDoneText: (p: P) =>
			`${p.n} von ${p.m} Zügen beim ersten Versuch gefunden. Die Variante ist jetzt in deinem Repertoire und kommt zur Wiederholung.`,
		nextLine: 'Nächste Variante',
		again: 'Nochmal',
		review: 'Fällige Züge wiederholen',
		backToCourse: 'Kursübersicht',
		fb: {
			playableTitle: 'Spielbar – aber nicht unser Zug',
			playableText:
				'Der Zug ist in Ordnung, aber in dieser Eröffnung spielen wir etwas anderes. Versuch es nochmal!',
			dubiousTitle: 'Nicht ideal',
			dubiousText: 'Dieser Zug verschlechtert deine Stellung. Versuch es nochmal!'
		},
		auto: {
			castle: 'Rochade – der König steht sicher, und der Turm kommt ins Spiel.',
			capture: (p: P) => `Schlägt auf ${p.sq}.`,
			centre: 'Kämpft um das Zentrum.',
			develop: (p: P) => `Entwickelt eine Figur (${p.piece}).`
		}
	},
	import: {
		eyebrow: 'Import',
		title: 'Partien importieren',
		subtitle: 'Rookie analysiert deine Online-Partien und macht aus deinen Fehlern Puzzles.',
		username: 'Benutzername',
		count: 'Anzahl Partien',
		load: 'Partien importieren',
		loading: (p) => `Lade Partien …${p.n ? ' ' + p.n : ''}`,
		analysing: (p) => `Analysiere Partie ${p.i} von ${p.n} …`,
		done: (p) =>
			`${p.g} neue ${s(p.g, 'Partie', 'Partien')} importiert, ${p.m} neue ${s(p.m, 'Übung', 'Übungen')} aus deinen Fehlern.`,
		none: 'Keine neuen Partien gefunden.',
		notFound: 'Benutzer nicht gefunden.',
		error: 'Import fehlgeschlagen. Prüfe den Benutzernamen und deine Verbindung.',
		autoAnalyse: 'Automatisch analysieren und Übungen erstellen',
		practise: 'Meine Fehler üben',
		toGames: 'Partien ansehen',
		privacy:
			'Es werden nur öffentliche Partien direkt von Lichess bzw. Chess.com geladen – nichts wird woandershin gesendet.',
		stop: 'Stopp',
		accounts: 'Verknüpfte Konten',
		accountsText:
			'Einmal Benutzernamen verknüpfen – Rookie importiert alle deine bisherigen Partien und holt danach jede neue Partie automatisch, sobald du die App öffnest.',
		noPassword:
			'Deine Partien auf Lichess und Chess.com sind öffentlich – du brauchst kein Login und kein Passwort, nur deinen Benutzernamen.',
		link: 'Verknüpfen',
		unlink: 'Trennen',
		syncNow: 'Jetzt abrufen',
		syncing: 'Wird abgerufen …',
		lastSync: (p: P) => `Zuletzt abgerufen ${p.when}`,
		notSynced: 'Noch nicht abgerufen',
		synced: (p: P) => `${p.n} neue ${p.n === 1 ? 'Partie' : 'Partien'} importiert · Ansehen`,
		syncError: 'Abruf fehlgeschlagen – prüfe den Benutzernamen oder deine Verbindung.',
		historyDone: 'Komplette Historie importiert',
		historyLoading: 'Lade deine komplette Historie …',
		historyProgress: (p: P) => `Deine Partiehistorie wird importiert … bisher ${p.n} Partien`,
		newProgress: (p: P) => `${p.n} neue ${p.n === 1 ? 'Partie' : 'Partien'} importiert`,
		rateLimit:
			'Die Seite bremst gerade Anfragen – der Import geht beim nächsten Öffnen von Rookie automatisch weiter.',
		once: 'Einmalig importieren'
	},
	profile: {
		eyebrow: 'Du',
		title: 'Profil',
		subtitle: 'Dein Fortschritt, deine Partien, deine Einstellungen.',
		strength: 'Spielstärke',
		puzzleRating: 'Puzzle-Rating',
		streak: 'Tage in Folge',
		solved: 'Puzzles gelöst',
		games: 'Partien',
		ratingHistory: 'Rating-Verlauf',
		noHistory: 'Löse ein paar Puzzles, dann siehst du hier deine Rating-Kurve.',
		activity: 'Letzte 12 Wochen',
		weakest: 'Deine schwächsten Themen',
		strongest: 'Deine stärksten Themen',
		noThemes: 'Löse mehr Puzzles, um deine Stärken und Schwächen zu sehen.',
		success: (p) => `${p.pct} % von ${p.n}`,
		train: 'Üben',
		bots: 'Bots besiegt',
		endgames: 'Endspiel-Sterne',
		myGames: 'Meine Partien & Analyse',
		importGames: 'Partien importieren',
		settings: 'Einstellungen & Datensicherung',
		about: 'Über Rookie & Lizenzen',
		legal: 'Impressum & Datenschutz',
		less: 'weniger',
		more: 'mehr'
	},
	stats: {
		hist: {
			range: 'Zeitraum',
			m1: '1M',
			m3: '3M',
			y1: '1J',
			all: 'Alle',
			puzzles: 'Puzzles',
			fewInRange: 'Wenige Partien in diesem Zeitraum – es werden deine letzten Partien gezeigt.',
			peak: 'Höchstwert',
			low: 'Tiefstwert',
			games: 'Partien',
			wShort: 'S',
			dShort: 'R',
			lShort: 'N',
			performance: 'Leistung',
			avgOpp: (p: P) => `Ø Gegner ${p.n}`,
			bestWin: 'Bester Sieg',
			streak: 'Siegesserie',
			streakSub: 'in Folge',
			months: 'Monat für Monat',
			month: 'Monat',
			end: 'Wertung',
			score: 'Punkte',
			allMonths: (p: P) => `Alle ${p.n} Monate zeigen`,
			less: 'Weniger zeigen',
			vs: (p: P) => `gegen ${p.name}`,
			res: { w: 'Sieg', d: 'Remis', l: 'Niederlage' }
		},
		export: 'Exportieren',
		exportCsv: 'Partien (CSV)',
		exportJson: 'Statistik (JSON)',
		exportText:
			'Lade alle Partien mit Wertung, Eröffnung und Genauigkeit herunter – z. B. für Excel oder Numbers.',
		title: 'Statistik',
		subtitle: 'Wie du spielst – Stärken, Schwächen und Fortschritt aus all deinen Partien.',
		tabOverview: 'Übersicht',
		tabStats: 'Statistik',
		insights: 'Das fällt auf',
		noInsights:
			'Spiel oder importiere noch ein paar Partien – dann erscheinen hier persönliche Erkenntnisse.',
		results: 'Ergebnisse',
		games: (p: P) => `${p.n} ${p.n === 1 ? 'Partie' : 'Partien'}`,
		score: (p: P) => `${p.pct} % Punkte`,
		win: 'Siege',
		draw: 'Remis',
		loss: 'Niederlagen',
		asWhite: 'Mit Weiß',
		asBlack: 'Mit Schwarz',
		bySource: 'Nach Gegner',
		source: {
			bot: 'Bots',
			lichess: 'Lichess',
			chesscom: 'Chess.com',
			pgn: 'PGN',
			friend: 'Freund'
		},
		bySpeed: 'Nach Bedenkzeit',
		speed: {
			ultraBullet: 'UltraBullet',
			bullet: 'Bullet',
			blitz: 'Blitz',
			rapid: 'Schnellschach',
			classical: 'Klassisch',
			daily: 'Täglich',
			correspondence: 'Fernschach'
		},
		vsStrength: 'Gegen Gegner, die …',
		strength: {
			stronger: 'stärker sind (+100)',
			equal: 'etwa gleich stark sind',
			weaker: 'schwächer sind (−100)'
		},
		rating: 'Online-Wertung',
		noRating:
			'Verknüpfe dein Lichess- oder Chess.com-Konto, um hier deinen Wertungsverlauf zu sehen.',
		linkAccount: 'Konto verknüpfen',
		openings: 'Deine Eröffnungen',
		noOpenings: 'Noch keine Partien.',
		quality: 'Zugqualität',
		fromAnalysed: (p: P) => `aus ${p.n} analysierten ${p.n === 1 ? 'Partie' : 'Partien'}`,
		accuracy: 'Genauigkeit',
		last10: 'letzte 10 Partien',
		phases: 'Nach Partiephase',
		phase: { opening: 'Eröffnung', middlegame: 'Mittelspiel', endgame: 'Endspiel' },
		perGame: 'Pro Partie',
		blunders: 'Patzer',
		mistakes: 'Fehler',
		inaccuracies: 'Ungenauigkeiten',
		motifs: 'Deine häufigsten Fehler',
		motif: {
			'mate-missed': 'Matt übersehen',
			'mate-allowed': 'Matt zugelassen',
			hanging: 'Hängende Figuren',
			fork: 'Gabeln zugelassen',
			'missed-win': 'Gewinne verpasst',
			positional: 'Stellungsfehler'
		},
		noAnalysis: 'Analysiere ein paar Partien, um Genauigkeit und deine typischen Fehler zu sehen.',
		endings: 'So enden deine Partien',
		ending: { mate: 'Schachmatt', resign: 'Aufgabe', time: 'Zeit', draw: 'Remis' },
		avgMoves: (p: P) => `Im Schnitt ${p.n} Züge pro Partie`,
		practise: 'Meine Fehler üben',
		insight: {
			betterWhite: (p: P) => `Mit Weiß holst du ${p.a} % der Punkte, mit Schwarz nur ${p.b} %.`,
			betterBlack: (p: P) => `Mit Schwarz holst du ${p.a} % der Punkte, mit Weiß nur ${p.b} %.`,
			bestOpening: (p: P) => `Deine beste Eröffnung: ${p.name} – ${p.pct} % aus ${p.n} Partien.`,
			worstOpening: (p: P) =>
				`${p.name} macht dir Probleme: nur ${p.pct} % aus ${p.n} Partien. Ein Kurs könnte helfen.`,
			weakPhase: (p: P) =>
				`Schwächste Partiephase: ${p.phase} – ${p.acc} % Genauigkeit (beste Phase: ${p.best} %).`,
			motif: (p: P) => `Dein häufigster Fehler: ${p.motif} (${p.n}×).`,
			time: (p: P) =>
				`${p.pct} % deiner Niederlagen passieren auf Zeit – behalte die Uhr im Blick.`,
			improving: (p: P) => `Deine Genauigkeit steigt: +${p.d} Punkte in den letzten 10 Partien.`,
			declining: (p: P) =>
				`Deine Genauigkeit ist in den letzten 10 Partien um ${p.d} Punkte gesunken.`,
			giantKiller: (p: P) => `Gegen stärkere Gegner holst du ${p.pct} % – stark!`
		}
	},
	install: {
		title: 'Rookie als App installieren',
		short: 'Vollbild und offline.',
		pitch: 'Vollbild, offline, ein Tipp vom Home-Bildschirm.',
		install: 'Installieren',
		how: 'So geht’s',
		later: 'Nicht jetzt',
		gotIt: 'Verstanden',
		guideTitle: 'Rookie zum Home-Bildschirm hinzufügen',
		guideLead:
			'Drei Tipps – ganz ohne App Store. Rookie öffnet sich danach wie eine normale App, auch offline.',
		ios1: 'Tippe auf das Teilen-Symbol in der Leiste unten in Safari.',
		ios1ipad: 'Tippe auf das Teilen-Symbol oben rechts in Safari.',
		ios2: 'Scrolle nach unten und wähle „Zum Home-Bildschirm“.',
		ios3: 'Tippe auf „Hinzufügen“ – fertig. Rookie liegt jetzt auf deinem Home-Bildschirm.',
		iosNote: 'Du findest den Punkt nicht? Öffne diese Seite zuerst in Safari.',
		other1: 'Öffne das Menü deines Browsers.',
		other2: 'Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.',
		settingsRow: 'Als App installieren',
		installed: 'Rookie ist als App installiert.'
	},
	onboarding: {
		welcome: 'Willkommen bei Rookie',
		intro:
			'Ein paar kurze Fragen, damit Rookie auf dem richtigen Niveau startet – und deine Online-Partien importieren kann.',
		skip: 'Überspringen',
		back: 'Zurück',
		step: (p: P) => `Frage ${p.i} von ${p.n}`,
		rulesQ: 'Kennst du die Schachregeln?',
		rules: {
			no: { t: 'Noch nicht', d: 'Ich möchte lernen, wie die Figuren ziehen.' },
			some: { t: 'Ein bisschen', d: 'Ich kenne die Züge, aber nicht jede Regel.' },
			yes: { t: 'Ja', d: 'Ich kenne die Regeln und habe schon gespielt.' }
		},
		levelQ: 'Wie stark spielst du?',
		level: {
			new: { t: 'Gerade angefangen', d: 'Ich verliere oft Figuren, ohne es zu merken.' },
			casual: { t: 'Ich gewinne manchmal', d: 'Gegen Freunde oder online, etwa 800–1200.' },
			club: { t: 'Erfahren', d: 'Wertung 1200 oder mehr.' },
			unknown: { t: 'Keine Ahnung', d: 'Rookie findet es mit Puzzles heraus.' }
		},
		focusQ: 'Womit möchtest du anfangen?',
		focus: {
			rules: { t: 'Grundlagen lernen', d: 'Schritt für Schritt, mit kleinen Spielen.' },
			tactics: { t: 'Taktik verbessern', d: 'Puzzles auf deinem Niveau.' },
			play: { t: 'Partien spielen', d: 'Gegen einen Bot, der zu dir passt.' },
			openings: { t: 'Eröffnungen lernen', d: 'Echte Eröffnungen mit Erklärungen.' }
		},
		onlineQ: 'Spielst du auf Lichess oder Chess.com?',
		onlineText:
			'Gib deinen Benutzernamen ein, und Rookie importiert alle deine Partien – vergangene und künftige –, analysiert sie und zeigt deine Elo. Kein Passwort nötig.',
		lichessName: 'Lichess-Benutzername',
		chesscomName: 'Chess.com-Benutzername',
		linkGo: 'Verknüpfen und loslegen',
		noOnline: 'Ich spiele nicht online – loslegen',
		done: 'Los geht’s!'
	},
	plan: {
		title: 'Dein Training heute',
		review: (p: P) => `${p.n} verpasste ${p.n === 1 ? 'Puzzle' : 'Puzzles'} wiederholen`,
		puzzles: (p: P) => `${p.n} Puzzles lösen`,
		puzzlesTheme: (p: P) => `${p.n} Puzzles zu deiner Schwäche: ${p.theme}`,
		repertoire: (p: P) => `${p.n} ${p.n === 1 ? 'Eröffnungszug' : 'Eröffnungszüge'} wiederholen`,
		basics: (p: P) => `Lektion: ${p.name}`,
		course: (p: P) => `Eröffnung: ${p.name}`,
		endgame: (p: P) => `Endspiel: ${p.name}`,
		game: 'Aus deiner letzten Partie lernen',
		start: 'Los',
		continue: 'Weiter',
		allDone: 'Alles erledigt für heute – stark!',
		strength: (p: P) => `Geschätzte Spielstärke ≈ ${p.n}`,
		strengthHint: 'Aus Puzzles, besiegten Bots und Online-Partien.',
		progress: (p: P) => `${p.n} von ${p.m} erledigt`
	},
	coachTab: {
		eyebrow: 'Dein Coach',
		title: 'Coach',
		subtitle: 'Wie du spielst, was dich bremst – und was du als Nächstes trainierst.',
		you: 'Du',
		gamesCount: (p) => `${p.n} ${s(p.n, 'Partie', 'Partien')}`,
		strength: (p) => `Spielstärke ≈ ${p.n}`,
		how: 'So spielst du gerade',
		rating: 'Aktuelle Wertung',
		winRate: 'Siegquote',
		lastN: (p) => `letzte ${p.n} Partien`,
		accuracy: 'Genauigkeit',
		last10: 'letzte 10 analysierte Partien',
		blunders: 'Patzer',
		perGame: 'pro Partie',
		puzzle: 'Puzzle-Wertung',
		work: 'Daran solltest du arbeiten',
		lastGames: (p) => `Deine letzten ${p.n} Partien`,
		won: 'gewonnen',
		drawn: 'remis',
		lost: 'verloren',
		streak: 'Siege in Folge',
		typical: 'Deine typischen Fehler',
		typicalText: (p) => `Aus ${p.n} analysierten ${s(p.n, 'Partie', 'Partien')}.`,
		notes: 'Was auffällt',
		allStats: 'Alle Statistiken',
		allStatsText: 'Eröffnungen, Farben, Bedenkzeiten, Partieenden und Export.',
		adv: {
			practise: 'Üben',
			train: 'Trainieren',
			play: 'Spielen',
			mistakesTitle: (p) =>
				`${p.n} ${s(p.n, 'Stellung', 'Stellungen')} aus deinen Partien zum Nachspielen`,
			mistakesText:
				'Finde den Zug, den du übersehen hast – so wiederholst du Fehler am seltensten.',
			motifTitle: (p) => `${p.motif}: ${p.n}× in deinen Partien`,
			motif: {
				hanging: 'Prüfe vor jedem Zug: Kann meine Figur gratis geschlagen werden?',
				fork: 'Achte auf Felder, von denen Springer oder Dame zwei Dinge gleichzeitig angreifen.',
				'mate-missed':
					'Du hattest Matts, die du nicht gesehen hast. Matt-Puzzles schärfen den Blick.',
				'mate-allowed': 'Prüfe deine Königssicherheit: Welche Schachs hat dein Gegner?',
				'missed-win':
					'Dein Gegner hat Figuren hängen lassen. Schau zuerst nach freien Schlagzügen.',
				positional: 'Frag dich: Welche Figur steht am schlechtesten, und wie verbessere ich sie?'
			},
			themeTitle: (p) => `Schwächstes Puzzle-Thema: ${p.theme} (${p.pct} %)`,
			themeText: 'Trainiere es auf deinem Niveau, bis das Muster sitzt.',
			phaseTitle: (p) => `${p.phase}: nur ${p.acc} % Genauigkeit`,
			phase: {
				opening: 'Lerne eine Eröffnung richtig – weniger Überraschungen in den ersten Zügen.',
				middlegame: 'Im Mittelspiel entscheidet Taktik. Tägliche Puzzles helfen am meisten.',
				endgame: 'Ein paar Endspieltechniken machen aus gewonnenen Stellungen Siege.'
			},
			playTitle: 'Dein Coach braucht ein paar Partien',
			playText:
				'Spiel gegen einen Bot oder verknüpfe Lichess / Chess.com – dann bekommst du hier persönliche Tipps.'
		}
	},
	skills: {
		title: 'Dein Spielerprofil',
		text: (p) => `Nur aus deinen ${p.n} analysierten Partien – tippe auf eine Ecke für Details.`,
		name: {
			opening: 'Eröffnung',
			middlegame: 'Mittelspiel',
			tactics: 'Taktik',
			endgame: 'Endspiel',
			safety: 'Sicherheit'
		},
		noData: 'noch keine Daten',
		rawAccuracy: (p) => `${p.n} % Genauigkeit`,
		rawTactics: (p) => `${p.n} taktische Fehler pro Partie`,
		rawBlunders: (p) => `${p.n} Patzer pro Partie`,
		weakest: (p) => `Schwächster Bereich: ${p.name}`,
		tip: {
			opening: 'Lerne eine Eröffnung Variante für Variante.',
			middlegame: 'Tägliche Puzzles schärfen den Blick für Taktik.',
			tactics:
				'Prüfe jeden Zug auf hängende Figuren, Gabeln und Matts – und trainiere es mit Puzzles.',
			endgame: 'Mit Endspieltechnik gewinnst du gewonnene Stellungen.',
			safety: 'Spiel die Stellungen nach, in denen du gepatzt hast.'
		},
		needData: (p) =>
			`Dein Profil braucht mindestens 3 analysierte Partien (bisher ${p.n}). Öffne eine Partie unter „Games“, um sie zu analysieren.`,
		trend: 'Genauigkeit je Partie',
		trendText: (p) =>
			`Deine letzten ${p.n} analysierten Partien – tippe auf eine Säule, um die Partie zu öffnen.`,
		trendAria: (p) => `Genauigkeit deiner letzten ${p.n} Partien, Durchschnitt ${p.avg} %`
	},
	stars: {
		title: 'Deine Sterne',
		text: 'Jede Lektion, Eröffnungsvariante und jedes Endspiel bringt bis zu drei Sterne.',
		total: (p) => `${p.n} von ${p.m}`,
		area: {
			basics: 'Schach-Grundlagen',
			tactics: 'Taktik',
			openings: 'Eröffnungen',
			endgames: 'Endspiele'
		},
		howBasics: 'Lektion abschließen: 3 Sterne',
		howTactics: 'Lektion abschließen: 3 Sterne',
		howOpenings: 'Je Variante 1–3 Sterne, je nachdem, wie viele Züge du auf Anhieb wusstest',
		howEndgames: 'Je Lektion 1–3 Sterne, je nachdem, wie effizient du gewinnst',
		all: 'Alle Sterne gesammelt – großartig!'
	},
	storm: {
		title: 'Puzzle-Sturm',
		teaser: 'So viele Puzzles wie möglich in 3 Minuten.',
		rules:
			'3 Minuten, die Puzzles werden mit jedem gelösten schwerer. Ein falscher Zug kostet 10 Sekunden und überspringt das Puzzle. Wie weit kommst du?',
		start: 'Start',
		find: (p: P) => `${p.side} am Zug – finde den besten Zug!`,
		streak: 'in Folge',
		mistakes: 'Fehler',
		stop: 'Stopp',
		score: (p: P) => `${p.n} gelöst`,
		best: (p: P) => `Dein Rekord: ${p.n}`,
		newBest: 'Neuer persönlicher Rekord!',
		bestStreak: 'beste Serie',
		again: 'Nochmal'
	},
	friend: {
		title: 'Gegen Freunde',
		teaser: 'Zwei Spieler, ein Gerät.',
		white: 'Weiß',
		black: 'Schwarz',
		toMove: (p: P) => `${p.side} am Zug`,
		flip: 'Brett nach jedem Zug drehen',
		newGame: 'Neue Partie',
		undo: 'Zurück',
		resign: (p: P) => `${p.side} gibt auf`,
		draw: 'Remis vereinbaren',
		resignConfirm: (p: P) => `Wirklich für ${p.side} aufgeben?`,
		wins: (p: P) => `${p.side} gewinnt`,
		drawn: 'Remis',
		analyse: 'Partie analysieren'
	},
	tactics: {
		title: 'Taktik',
		subtitle: 'Die Tricks, die Partien entscheiden – erst erklärt, dann mit echten Puzzles geübt.',
		hubText:
			'Gabel, Fesselung, Spieß & Co.: erst den Trick verstehen, dann mit Puzzles trainieren.',
		practise: 'Mit Puzzles üben',
		practiseText: (p: P) => `Jetzt trainieren: Puzzles zum Thema „${p.theme}“ auf deinem Niveau.`
	},
	retry: {
		cta: (p: P) => `Deine ${p.n} ${p.n === 1 ? 'Fehler' : 'Fehler'} nachspielen`,
		ctaText: 'Finde den besseren Zug selbst – so lernst du am meisten aus einer Partie.',
		step: (p: P) => `Fehler ${p.i} von ${p.n}`,
		prompt: (p: P) => `Du hast ${p.move} gespielt. Finde einen besseren Zug!`,
		hint: 'Schau auch mit den Augen des Gegners: Was erlaubt dein Zug?',
		sameTitle: 'Das war dein Partiezug',
		sameText: 'Versuch etwas anderes – was wäre besser?',
		solved: 'Gut gefunden!',
		best: (p: P) => `Am besten war ${p.san}.`,
		doneTitle: 'Alle Fehler nachgespielt',
		doneText: (p: P) => `Du hast ${p.n} von ${p.m} besseren Zügen auf Anhieb gefunden.`,
		close: 'Zurück zur Analyse'
	},
	accounts: {
		ctaTitle: 'Lichess oder Chess.com verknüpfen',
		ctaText:
			'Alle deine Partien – vergangene und künftige – landen automatisch hier, analysiert von Stockfish, mit deiner Elo.',
		noRating: 'Noch keine gewerteten Partien',
		manage: 'Verwalten',
		elo: 'Deine Elo'
	},
	board2: {
		title: 'Analysebrett',
		open: 'Analysebrett',
		hint: 'Zieh frei mit beiden Farben. Stockfish bewertet jede Stellung live – tippe auf eine Variante, um ihren ersten Zug zu spielen. Tasten: ← → blättern, Leertaste = bester Zug.',
		depth: (p: P) => `Tiefe ${p.n}`,
		thinking: 'Stockfish rechnet …',
		gameOver: 'In dieser Stellung ist die Partie vorbei.',
		load: 'FEN/PGN laden',
		loadPlaceholder: 'FEN oder PGN einfügen …',
		loadGo: 'Laden',
		loadError: 'Das konnte ich nicht lesen – bitte eine gültige FEN oder PGN einfügen.',
		reset: 'Neu',
		copied: 'Kopiert!',
		fromHere: 'Analysebrett'
	},
	summary: {
		title: 'Überblick',
		link: 'Konto verknüpfen',
		loading: 'Partien werden geladen …',
		puzzle: 'Puzzles',
		today: (p: P) => `heute ${p.n}/${p.m}`,
		strength: 'Spielstärke',
		strengthSub: 'geschätzt',
		form: 'Form',
		formSub: (p: P) => `${p.pct} % · ${p.n} ${p.n === 1 ? 'Partie' : 'Partien'}`,
		formAria: (p: P) => `Letzte Partien: ${p.pct} % der Punkte`,
		noGames: 'Noch keine Partien',
		stars: 'Sterne',
		starsSub: 'beim Lernen'
	},
	about: {
		eyebrow: 'Open Source',
		title: 'Über Rookie',
		subtitle: 'Ein kostenloser Schach-Trainer. Keine Werbung, kein Tracking, keine Anmeldung.',
		licence: 'Lizenz',
		licenceText:
			'Rookie steht unter der GNU General Public License v3. Du darfst den Code nutzen, verändern und weitergeben – solange er offen bleibt. Alle Daten bleiben auf deinem Gerät.',
		thanks: 'Danke an',
		source: 'Quellcode auf GitHub',
		credits: {
			pieces: 'Figurensatz',
			stockfish: 'Schach-Engine',
			stockfishjs: 'WebAssembly-Version',
			chessground: 'Schachbrett',
			chessops: 'Schachregeln & PGN',
			puzzles: 'Taktik-Aufgaben',
			openings: 'Eröffnungsnamen',
			tablebase: 'Endspiel-Datenbank',
			lucide: 'Icons',
			font: 'Schrift',
			dexie: 'Lokale Datenbank',
			fsrs: 'Wiederholungs-Algorithmus'
		}
	},
	board: {
		label: 'Schachbrett',
		promote: 'Umwandeln in …',
		promoteDialog: 'Umwandlung wählen',
		roles: { q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer' }
	},
	moves: { list: 'Zugliste', none: 'Noch keine Züge' },
	eval: { label: (p) => `Bewertung ${p.v}` }
};
