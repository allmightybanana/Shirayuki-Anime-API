import { handle } from 'hono/aws-lambda';
import app from '../../index-worker.js';

export const handler = handle(app);
