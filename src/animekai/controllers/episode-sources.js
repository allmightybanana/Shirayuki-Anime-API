import { getAnimekaiEpisodeSources } from '../scraper/episode-sources.js';
import { resolveExternalId } from '../../utils/resolver.js';

const episodeSourcesCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const getCachedEpisodeSources = (key) => {
  const item = episodeSourcesCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    episodeSourcesCache.delete(key);
    return null;
  }

  return item.value;
};

const setCachedEpisodeSources = (key, value) => {
  episodeSourcesCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

export const animekaiEpisodeSourcesController = async (c) => {
  try {
    const startTime = Date.now();
    let animeEpisodeId = c.req.query('animeEpisodeId');
    const ep = c.req.query('ep');
    const server = c.req.query('server');
    const category = c.req.query('category');
    const provider = c.req.query('provider');

    if (!animeEpisodeId) {
      return c.json(
        {
          success: false,
          error: 'animeEpisodeId query parameter is required',
        },
        400
      );
    }

    // Resolve external IDs (AniList/MAL) to AnimeKai anime ID
    if (provider && (provider === 'anilist' || provider === 'mal')) {
      const resolvedId = await resolveExternalId(animeEpisodeId, provider, 'animekai');
      if (!resolvedId) {
        return c.json(
          {
            success: false,
            error: `Could not resolve ${provider} ID "${animeEpisodeId}" to an AnimeKai anime`,
          },
          404
        );
      }
      animeEpisodeId = resolvedId;
    }

    const cacheKey = [
      'animekai',
      'episode-sources',
      animeEpisodeId,
      ep || '',
      server || '',
      category || '',
    ].join(':');

    const cachedData = getCachedEpisodeSources(cacheKey);
    if (cachedData) {
      const extractionTimeSec = Number(((Date.now() - startTime) / 1000).toFixed(3));
      return c.json({
        success: true,
        data: cachedData,
        extractionTimeSec,
      });
    }

      const data = await getAnimekaiEpisodeSources({ animeEpisodeId, ep, server, category });
      setCachedEpisodeSources(cacheKey, data);
    const extractionTimeSec = Number(((Date.now() - startTime) / 1000).toFixed(3));

    return c.json({
      success: true,
      data,
      extractionTimeSec,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
};
