import { handle, type Env } from '../../server/api';

/** Alle Anfragen unter /api/* (Cloudflare Pages Functions) */
export const onRequest: PagesFunction<Env> = (ctx) => handle(ctx.request, ctx.env);
