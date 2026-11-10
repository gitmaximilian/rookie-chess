export type Goal = 'mate' | 'promote' | 'draw';

export interface Lesson {
	id: string;
	title: string;
	subtitle: string;
	level: 1 | 2 | 3;
	goal: Goal;
	/** maximale eigene Züge */
	maxMoves: number;
	player: 'white' | 'black';
	positions: string[];
	/** Kurze Anleitung, Schritt für Schritt */
	steps: string[];
	/** Kurzform für Karten */
	icon: 'queen' | 'rook' | 'rooks' | 'pawn' | 'king' | 'bridge' | 'shield';
}

/** Alle Startstellungen sind mit der Lichess-Tablebase geprüft (scripts/check-endgames). */
export const LESSONS: Lesson[] = [
	{
		id: 'kqk',
		title: 'Matt mit der Dame',
		subtitle: 'König + Dame gegen König',
		level: 1,
		goal: 'mate',
		maxMoves: 20,
		player: 'white',
		icon: 'queen',
		positions: [
			'8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
			'8/8/3k4/8/8/8/2Q5/6K1 w - - 0 1',
			'4k3/8/8/8/8/8/8/Q3K3 w - - 0 1'
		],
		steps: [
			'Stell die Dame einen Springerzug vom gegnerischen König entfernt – so wird sein Bereich kleiner.',
			'Spiegle die Bewegungen des Königs und drück ihn Schritt für Schritt an den Rand.',
			'Steht er am Rand: Achtung Patt! Lass ihm immer ein Feld, bis dein König hilft.',
			'Hol deinen König heran – zusammen mit der Dame setzt du matt.'
		]
	},
	{
		id: 'kkrr',
		title: 'Treppenmatt',
		subtitle: 'Zwei Türme gegen König',
		level: 1,
		goal: 'mate',
		maxMoves: 12,
		player: 'white',
		icon: 'rooks',
		positions: ['8/8/8/4k3/8/8/R7/1R4K1 w - - 0 1', '3k4/8/8/8/8/8/R7/R5K1 w - - 0 1'],
		steps: [
			'Ein Turm sperrt eine Reihe ab, der andere gibt Schach auf der nächsten.',
			'Abwechselnd ziehen die Türme eine Reihe weiter – wie eine Treppe.',
			'Kommt der König einem Turm zu nahe, zieh diesen Turm weit weg auf die andere Seite.',
			'Am Rand angekommen: Schach auf der letzten Reihe ist Matt.'
		]
	},
	{
		id: 'krk',
		title: 'Matt mit dem Turm',
		subtitle: 'König + Turm gegen König',
		level: 2,
		goal: 'mate',
		maxMoves: 32,
		player: 'white',
		icon: 'rook',
		positions: [
			'8/8/8/3k4/8/8/8/R3K3 w - - 0 1',
			'8/8/4k3/8/8/8/8/4K2R w - - 0 1',
			'8/5k2/8/8/8/8/1R6/1K6 w - - 0 1'
		],
		steps: [
			'Der Turm schneidet den gegnerischen König ab – wie eine Wand.',
			'Bring deinen König nach vorne, in Opposition zum gegnerischen König.',
			'Stehen sich die Könige gegenüber, gibt der Turm Schach – die Wand rückt eine Reihe vor.',
			'Hat der König Platz, mach einen Wartezug mit dem Turm. Wiederhole bis zum Rand.'
		]
	},
	{
		id: 'opposition',
		title: 'Die Opposition',
		subtitle: 'König + Bauer gegen König',
		level: 2,
		goal: 'promote',
		maxMoves: 25,
		player: 'white',
		icon: 'pawn',
		positions: [
			'4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
			'8/8/3k4/8/3K4/8/3P4/8 w - - 0 1',
			'8/8/8/3k4/8/2K5/2P5/8 w - - 0 1'
		],
		steps: [
			'Der König geht vor dem Bauern – nicht der Bauer zuerst!',
			'Opposition: Die Könige stehen sich mit einem Feld Abstand gegenüber, der Gegner ist am Zug.',
			'Ein Bauernzug als Reserve („Tempo“) kann dir die Opposition schenken.',
			'Erreicht dein König die 6. Reihe vor dem Bauern, ist die Partie gewonnen.'
		]
	},
	{
		id: 'square',
		title: 'Die Quadratregel',
		subtitle: 'Fang den Freibauern',
		level: 1,
		goal: 'draw',
		maxMoves: 8,
		player: 'black',
		icon: 'king',
		positions: ['8/8/8/4k3/P7/8/8/7K b - - 0 1', '8/8/8/8/1P6/5k2/8/7K b - - 0 1'],
		steps: [
			'Stell dir ein Quadrat vor: vom Bauern bis zur Umwandlungsreihe, gleich breit wie hoch.',
			'Kann dein König mit seinem Zug ins Quadrat treten, holt er den Bauern ein.',
			'Lauf diagonal – so kommst du am schnellsten heran.',
			'Schlag den Bauern oder blockiere sein Umwandlungsfeld.'
		]
	},
	{
		id: 'lucena',
		title: 'Lucena-Stellung',
		subtitle: 'Turmendspiel gewinnen: der Brückenbau',
		level: 3,
		goal: 'promote',
		maxMoves: 20,
		player: 'white',
		icon: 'bridge',
		positions: ['1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1'],
		steps: [
			'Vertreib zuerst den gegnerischen König mit einem Turmschach von der Seite.',
			'Stell deinen Turm auf die 4. Reihe – dort baust du später die „Brücke“.',
			'Dein König verlässt das Umwandlungsfeld und läuft Richtung Turm.',
			'Kommen Schachs von hinten, schiebt sich der Turm dazwischen: Die Brücke steht, der Bauer wird zur Dame.'
		]
	},
	{
		id: 'philidor',
		title: 'Philidor-Verteidigung',
		subtitle: 'Turmendspiel halten',
		level: 3,
		goal: 'draw',
		maxMoves: 15,
		player: 'black',
		icon: 'shield',
		positions: ['3k4/R7/7r/3PK3/8/8/8/8 b - - 0 1'],
		steps: [
			'Dein Turm bleibt auf der 6. Reihe – so kann der weiße König nicht vorrücken.',
			'Erst wenn der Bauer auf die 6. Reihe zieht, gehst du mit dem Turm ganz nach hinten.',
			'Von hinten gibst du Schach um Schach – der weiße König findet keinen Schutz mehr.',
			'Halte die Stellung, bis die Zeit um ist.'
		]
	}
];

export function lessonById(id: string): Lesson | undefined {
	return LESSONS.find((l) => l.id === id);
}

export const GOAL_DE: Record<Goal, string> = {
	mate: 'Setze matt',
	promote: 'Wandle den Bauern um',
	draw: 'Halte remis'
};
