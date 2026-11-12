import { redirect } from '@sveltejs/kit';

// Statistik ist in den Coach-Tab umgezogen – alte Links und Lesezeichen leiten weiter
export const load = () => {
	redirect(308, '/coach/stats');
};
