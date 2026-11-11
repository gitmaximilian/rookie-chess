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
		home: 'Start',
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
		analyse: 'Analysieren',
		newOpponent: 'Neuer Gegner',
		event: 'Rookie – Partie gegen Bot'
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
		title: 'Deine Partien',
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
		games: 'Partien',
		running: 'Stockfish analysiert …',
		resume: 'Fortsetzen',
		start: 'Ausgangsstellung',
		startText: 'Mit ← → durch die Partie. Fehler sind in der Kurve markiert.',
		opponentMove: (p) => `Zug von ${p.name}`,
		best: 'Genau der Zug, den auch Stockfish spielt.',
		solid: 'Ein solider Zug.',
		bestHere: 'Bester Zug hier:',
		practice: (p) => `${p.n} neue ${s(p.n, 'Übung', 'Übungen')}`,
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
		source: { bot: 'Bot', lichess: 'Lichess', chesscom: 'Chess.com', pgn: 'PGN' },
		nav: { first: 'Anfang', prev: 'Zurück', next: 'Vor', last: 'Ende', flip: 'Brett drehen' }
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
			`Dieser Zug gibt Vorteil ab.${p.best ? ` Stärker war ${p.best}${p.idea ? ` mit der Idee ${p.idea}` : ''}.` : ''}`
	},
	settings: {
		eyebrow: 'Profil',
		title: 'Einstellungen',
		appearance: 'Darstellung',
		auto: 'Automatisch',
		light: 'Hell',
		dark: 'Dunkel',
		language: 'Sprache',
		sound: 'Töne',
		soundStyle: 'Klangstil',
		soundStyles: { wood: 'Holz', soft: 'Sanft', chime: 'Glocke' },
		goal: 'Tagesziel',
		goalText: 'Wie viele Puzzles möchtest du pro Tag lösen?',
		data: 'Deine Daten',
		dataText:
			'Alles bleibt auf diesem Gerät – kein Konto, keine Cloud. Mit einer Sicherung kannst du deinen Fortschritt auf ein anderes Gerät mitnehmen (z. B. vom iPhone auf den Mac).',
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
		eyebrow: 'Wissen',
		title: 'Lernen',
		subtitle: 'Eröffnungen und Endspiele, die du wirklich brauchst.',
		endgames: 'Endspiele',
		endgamesText: 'Lerne die wichtigsten Techniken – mit perfektem Spiel aus der Tablebase.',
		openings: 'Eröffnungen',
		openingsText:
			'Bau dein eigenes Repertoire und trainiere es mit Wiederholung im richtigen Moment.',
		level: (p) => ['', 'Grundlagen', 'Fortgeschritten', 'Profi'][Number(p.n)],
		goal: { mate: 'Setze matt', promote: 'Wandle den Bauern um', draw: 'Halte remis' },
		maxMoves: (p) => `in ≤ ${p.n} Zügen`,
		survive: (p) => `über ${p.n} Züge`
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
			'Einmal Benutzernamen verknüpfen – Rookie holt dann bei jedem Öffnen der App deine neuen Partien automatisch und analysiert sie im Hintergrund.',
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
		once: 'Einmalig importieren'
	},
	profile: {
		eyebrow: 'Du',
		title: 'Profil',
		subtitle: 'Dein Fortschritt, deine Partien, deine Einstellungen.',
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
