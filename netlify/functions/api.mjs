import { handle } from 'hono/netlify';
import app from '../../index-worker.js';

export const handler = handle(app);
