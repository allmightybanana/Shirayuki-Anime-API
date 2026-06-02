import { getHianimeEpisodeSources } from '../scraper/episode-sources.js';
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

export const hianimeEpisodeSourcesController = async (c) => {
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

    // Resolve external IDs (AniList/MAL) to HiAnime anime ID
    if (provider && (provider === 'anilist' || provider === 'mal')) {
      const resolvedId = await resolveExternalId(animeEpisodeId, provider, 'hianime');
      if (!resolvedId) {
        return c.json(
          {
            success: false,
            error: `Could not resolve ${provider} ID "${animeEpisodeId}" to a HiAnime anime`,
          },
          404
        );
      }
      animeEpisodeId = resolvedId;
    }

    const cacheKey = [
      'hianime',
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

    const data = await getHianimeEpisodeSources({ animeEpisodeId, ep, server, category });

    // Rewrite m3u8 source URLs to go through the proxy so segments
    // are PNG-stripped and directly playable in any HLS player.
    const reqUrl = new URL(c.req.url);
    const proxyBase = `${reqUrl.protocol}//${reqUrl.host}/api/v2/hianime/proxy/m3u8?url=`;
    if (data?.sources) {
      for (const src of data.sources) {
        if (src.source && src.type === 'm3u8') {
          src.source = proxyBase + encodeURIComponent(src.source);
        }
      }
    }

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
