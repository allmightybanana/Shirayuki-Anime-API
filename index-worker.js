import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import animekaiHomeRouter from './src/animekai/router/home.js';
import animekaiAzlistRouter from './src/animekai/router/azlist.js';
import animekaiAnimeRouter from './src/animekai/router/anime.js';
import animekaiSearchRouter from './src/animekai/router/search.js';
import animekaiSearchAdvancedRouter from './src/animekai/router/search-advanced.js';
import animekaiSearchSuggestionRouter from './src/animekai/router/search-suggestion.js';
import animekaiProducerRouter from './src/animekai/router/producer.js';
import animekaiGenreRouter from './src/animekai/router/genre.js';
import animekaiCategoryRouter from './src/animekai/router/category.js';
import animekaiScheduleRouter from './src/animekai/router/schedule.js';
import animekaiEpisodesRouter from './src/animekai/router/episodes.js';
import animekaiNextEpisodeRouter from './src/animekai/router/next-episode.js';
import animekaiEpisodeServersRouter from './src/animekai/router/episode-servers.js';
import animekaiEpisodeSourcesRouter from './src/animekai/router/streaming-server.js';
import animekaiProxyRouter from './src/animekai/router/proxy.js';
import { animekaiEpisodesController } from './src/animekai/controllers/episodes.js';
import hianimeEpisodeSourcesRouter from './src/hianime/router/streaming-server.js';
import hianimeHomeRouter from './src/hianime/router/home.js';
import hianimeAzlistRouter from './src/hianime/router/azlist.js';
import hianimeAnimeRouter from './src/hianime/router/anime.js';
import hianimeSearchRouter from './src/hianime/router/search.js';
import hianimeSearchAdvancedRouter from './src/hianime/router/search-advanced.js';
import hianimeSearchSuggestionRouter from './src/hianime/router/search-suggestion.js';
import hianimeGenreRouter from './src/hianime/router/genre.js';
import hianimeCategoryRouter from './src/hianime/router/category.js';
import hianimeScheduleRouter from './src/hianime/router/schedule.js';
import hianimeEpisodeServersRouter from './src/hianime/router/episode-servers.js';
import hianimeProxyRouter from './src/hianime/router/proxy.js';
import { renderDashboard } from './src/utils/dashboard.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Root
app.get('/', (c) => {
  return c.html(renderDashboard());
});

// API Routes
app.route('/api/v2/animekai/home', animekaiHomeRouter);
app.route('/api/v2/animekai/azlist', animekaiAzlistRouter);
app.route('/api/v2/animekai/anime', animekaiAnimeRouter);
app.route('/api/v2/animekai/search', animekaiSearchRouter);
app.route('/api/v2/animekai/search/advanced', animekaiSearchAdvancedRouter);
app.route('/api/v2/animekai/search/suggestion', animekaiSearchSuggestionRouter);
app.route('/api/v2/animekai/producer', animekaiProducerRouter);
app.route('/api/v2/animekai/genre', animekaiGenreRouter);
app.route('/api/v2/animekai/category', animekaiCategoryRouter);
app.route('/api/v2/animekai/schedule', animekaiScheduleRouter);
app.route('/api/v2/animekai/anime', animekaiEpisodesRouter);
app.route('/api/v2/animekai/anime', animekaiNextEpisodeRouter);

app.route('/api/v2/animekai/episode', animekaiEpisodeServersRouter);
app.route('/api/v2/animekai/episode/sources', animekaiEpisodeSourcesRouter);
app.route('/api/v2/animekai/proxy', animekaiProxyRouter);
app.route('/api/v2/hianime/home', hianimeHomeRouter);
app.route('/api/v2/hianime/azlist', hianimeAzlistRouter);
app.route('/api/v2/hianime/anime', hianimeAnimeRouter);
app.route('/api/v2/hianime/search', hianimeSearchRouter);
app.route('/api/v2/hianime/search/advanced', hianimeSearchAdvancedRouter);
app.route('/api/v2/hianime/search/suggestion', hianimeSearchSuggestionRouter);
app.route('/api/v2/hianime/genre', hianimeGenreRouter);
app.route('/api/v2/hianime/category', hianimeCategoryRouter);
app.route('/api/v2/hianime/schedule', hianimeScheduleRouter);
app.route('/api/v2/hianime/episode', hianimeEpisodeServersRouter);
app.route('/api/v2/hianime/episode/sources', hianimeEpisodeSourcesRouter);
app.route('/api/v2/hianime/proxy', hianimeProxyRouter);

// Compatibility alias: supports /api/v2/animekai/:animeId/episodes format.
app.get('/api/v2/animekai/:animeId/episodes', animekaiEpisodesController);

app.notFound((c) => {
  return c.json({
    success: false,
    message: 'Endpoint not found',
  }, 404);
});

app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    success: false,
    error: err.message,
  }, 500);
});

export default app;
