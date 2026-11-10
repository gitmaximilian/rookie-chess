/**
 * Lichess-Puzzle-Themen, die Rookie nutzt – mit deutschen Namen und kurzer Erklärung.
 * Die Reihenfolge bestimmt den Index im Puzzle-Paket (nicht ändern, nur anhängen!).
 */
export interface Theme {
	key: string;
	name: string;
	about: string;
	/** Für Anfänger besonders wichtig */
	core?: boolean;
}

export const THEMES: Theme[] = [
	{ key: 'mateIn1', name: 'Matt in 1', about: 'Ein Zug – und der König ist matt.', core: true },
	{
		key: 'mateIn2',
		name: 'Matt in 2',
		about: 'Zwei Züge bis zum Matt. Schach ist oft der Schlüssel.',
		core: true
	},
	{ key: 'mateIn3', name: 'Matt in 3', about: 'Drei Züge bis zum Matt.' },
	{
		key: 'hangingPiece',
		name: 'Hängende Figur',
		about: 'Eine Figur ist ungedeckt – schnapp sie dir!',
		core: true
	},
	{
		key: 'fork',
		name: 'Gabel',
		about: 'Eine Figur greift zwei gegnerische gleichzeitig an.',
		core: true
	},
	{
		key: 'pin',
		name: 'Fesselung',
		about: 'Eine Figur kann nicht ziehen, ohne eine wertvollere preiszugeben.',
		core: true
	},
	{
		key: 'skewer',
		name: 'Spieß',
		about: 'Wie eine Fesselung – nur steht die wertvollere Figur vorne.',
		core: true
	},
	{
		key: 'discoveredAttack',
		name: 'Abzugsangriff',
		about: 'Eine Figur zieht weg und gibt den Weg für einen Angriff frei.',
		core: true
	},
	{ key: 'doubleCheck', name: 'Doppelschach', about: 'Zwei Figuren geben gleichzeitig Schach.' },
	{
		key: 'backRankMate',
		name: 'Grundreihenmatt',
		about: 'Der König ist hinter seinen eigenen Bauern gefangen.',
		core: true
	},
	{
		key: 'smotheredMate',
		name: 'Ersticktes Matt',
		about: 'Ein Springer setzt den eingeklemmten König matt.'
	},
	{
		key: 'trappedPiece',
		name: 'Gefangene Figur',
		about: 'Eine Figur hat kein sicheres Feld mehr.'
	},
	{
		key: 'capturingDefender',
		name: 'Verteidiger schlagen',
		about: 'Schlag die Figur, die alles zusammenhält.'
	},
	{
		key: 'deflection',
		name: 'Ablenkung',
		about: 'Lenke eine Figur von ihrer wichtigen Aufgabe ab.'
	},
	{ key: 'attraction', name: 'Hinlenkung', about: 'Locke eine Figur auf ein ungünstiges Feld.' },
	{ key: 'sacrifice', name: 'Opfer', about: 'Gib Material, um mehr zu gewinnen.' },
	{ key: 'promotion', name: 'Umwandlung', about: 'Ein Bauer wird zur Dame (oder etwas anderem).' },
	{ key: 'advancedPawn', name: 'Vorgerückter Bauer', about: 'Ein Bauer kurz vor der Umwandlung.' },
	{
		key: 'quietMove',
		name: 'Stiller Zug',
		about: 'Kein Schach, kein Schlagen – und trotzdem stark.'
	},
	{ key: 'defensiveMove', name: 'Verteidigung', about: 'Finde den Zug, der alles rettet.' },
	{ key: 'exposedKing', name: 'Ungeschützter König', about: 'Der König steht offen – greif an!' },
	{
		key: 'kingsideAttack',
		name: 'Angriff am Königsflügel',
		about: 'Angriff auf den kurz rochierten König.'
	},
	{
		key: 'intermezzo',
		name: 'Zwischenzug',
		about: 'Erst ein unerwarteter Zug, dann das Offensichtliche.'
	},
	{
		key: 'xRayAttack',
		name: 'Röntgenangriff',
		about: 'Eine Figur wirkt durch eine andere hindurch.'
	},
	{
		key: 'clearance',
		name: 'Räumung',
		about: 'Mach ein Feld oder eine Linie für eine andere Figur frei.'
	},
	{ key: 'interference', name: 'Verstellung', about: 'Stell dich zwischen gegnerische Figuren.' },
	{ key: 'endgame', name: 'Endspiel', about: 'Wenige Figuren, präzise Technik.' },
	{ key: 'middlegame', name: 'Mittelspiel', about: 'Taktik mitten in der Partie.' },
	{ key: 'opening', name: 'Eröffnung', about: 'Fallen und Tricks in den ersten Zügen.' },
	{ key: 'pawnEndgame', name: 'Bauernendspiel', about: 'Nur Könige und Bauern.' },
	{ key: 'rookEndgame', name: 'Turmendspiel', about: 'Das häufigste Endspiel überhaupt.' },
	{
		key: 'crushing',
		name: 'Entscheidender Vorteil',
		about: 'Ein Zug, der die Partie entscheidet.'
	},
	{ key: 'short', name: 'Kurz', about: 'Ein bis zwei Züge.' },
	{ key: 'long', name: 'Lang', about: 'Drei Züge oder mehr.' },
	{ key: 'mate', name: 'Matt', about: 'Am Ende steht Schachmatt.' },
	{
		key: 'anastasiaMate',
		name: 'Anastasias Matt',
		about: 'Springer und Turm fangen den König am Rand.'
	},
	{ key: 'arabianMate', name: 'Arabisches Matt', about: 'Springer und Turm in der Ecke.' },
	{ key: 'hookMate', name: 'Hakenmatt', about: 'Turm, Springer und Bauer arbeiten zusammen.' },
	{ key: 'enPassant', name: 'En passant', about: 'Der seltene Bauernschlag im Vorbeigehen.' },
	{ key: 'castling', name: 'Rochade', about: 'Die Rochade als Lösung.' },
	{
		key: 'underPromotion',
		name: 'Unterverwandlung',
		about: 'Manchmal ist ein Springer besser als eine Dame.'
	},
	{ key: 'zugzwang', name: 'Zugzwang', about: 'Jeder Zug verschlechtert die Stellung des Gegners.' }
];

export const THEME_INDEX = new Map(THEMES.map((t, i) => [t.key, i]));

export function themeName(key: string): string {
	return THEMES.find((t) => t.key === key)?.name ?? key;
}
