import { getHianimeSearch } from '../scraper/search.js';
import { getHianimeEpisodes } from '../scraper/episodes.js';
import { wrapController } from './_cache.js';
import { resolveBulkAnime } from '../../utils/anilist.js';
import { resolveExternalId } from '../../utils/resolver.js';
import { findMetadataInOfflineDb } from '../../utils/offlineDb.js';

export const hianimeSearchController = wrapController({
  cacheKey: (c) => {
    const anilistId = c.req.query('anilistId');
    const malId = c.req.query('malId');
    const debug = c.req.query('debug') === 'true' || c.req.query('debug') === '1';
    if (debug) return `search:debug:${Date.now()}`;
    if (anilistId) return `search:anilist:${anilistId}`;
    if (malId) return `search:mal:${malId}`;
    return `search:${c.req.query('q') || ''}:${c.req.query('page') || '1'}`;
  },
  handler: async (c) => {
    const q = c.req.query('q');
    const anilistId = c.req.query('anilistId');
    const malId = c.req.query('malId');
    const page = c.req.query('page');
    const debug = c.req.query('debug') === 'true' || c.req.query('debug') === '1';

    // AniList ID or MAL ID resolution mode
    if (anilistId || malId) {
      const provider = anilistId ? 'anilist' : 'mal';
      const externalId = anilistId || malId;

      // Look up metadata from offline database for response enrichment
      const offlineMeta = findMetadataInOfflineDb(externalId, provider);

      const debugOptions = debug ? { logs: [] } : null;
      const resolvedId = await resolveExternalId(externalId, provider, 'hianime', debugOptions);
      if (!resolvedId) {
        if (debug) {
          return {
            success: false,
            error: `Could not resolve ${provider} ID "${externalId}" to a HiAnime anime`,
            debugLogs: debugOptions.logs,
          };
        }
        throw new Error(`Could not resolve ${provider} ID "${externalId}" to a HiAnime anime`);
      }

      // Fetch episode data to build a useful result
      let animeData = null;
      try {
        animeData = await getHianimeEpisodes({ animeId: resolvedId });
      } catch (err) {
        console.error(`[Search] Failed to fetch details for resolved ID ${resolvedId}:`, err.message);
      }

      return {
        resolvedFrom: { provider, id: externalId },
        offlineDbMatch: offlineMeta ? {
          anilistId: offlineMeta.id || null,
          malId: offlineMeta.idMal || null,
          title: offlineMeta.title || null,
          format: offlineMeta.format || null,
          seasonYear: offlineMeta.seasonYear || null,
          season: offlineMeta.season || null,
        } : null,
        animeId: resolvedId,
        title: animeData?.animeId || offlineMeta?.title?.userPreferred || null,
        totalEpisodes: animeData?.totalEpisodes || null,
        ...(debug && { debugLogs: debugOptions.logs }),
      };
    }

    // Normal keyword search mode
    if (!q) {
      throw new Error('Query parameter "q" or "anilistId" or "malId" is required');
    }

    const searchData = await getHianimeSearch({ q, page });
    if (searchData?.results) {
      searchData.results = await resolveBulkAnime(searchData.results, q);
    }
    return searchData;
  },
});
