import { Hono } from 'hono';
import { miruroEpisodesController } from '../controllers/episodes.js';

const miruroEpisodesRouter = new Hono();

miruroEpisodesRouter.get('/:animeId/episodes', miruroEpisodesController);

export default miruroEpisodesRouter;
