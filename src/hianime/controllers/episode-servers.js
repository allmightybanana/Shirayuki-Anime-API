import { getHianimeEpisodeServers } from '../scraper/episode-servers.js';
import { wrapController } from './_cache.js';
import { resolveExternalId } from '../../utils/resolver.js';

export const hianimeEpisodeServersController = wrapController({
  cacheKey: (c) =>
    `episode-servers:${c.req.query('animeEpisodeId') || ''}:${c.req.query('ep') || ''}:${c.req.query('provider') || ''}`,
  handler: async (c) => {
    let animeEpisodeId = c.req.query('animeEpisodeId');
    const ep = c.req.query('ep');
    const provider = c.req.query('provider');

    // Resolve external IDs (AniList/MAL) to HiAnime anime ID
    if (provider && (provider === 'anilist' || provider === 'mal')) {
      const resolvedId = await resolveExternalId(animeEpisodeId, provider, 'hianime');
      if (!resolvedId) {
        throw new Error(`Could not resolve ${provider} ID "${animeEpisodeId}" to a HiAnime anime`);
      }
      animeEpisodeId = resolvedId;
    }

    return getHianimeEpisodeServers({
      animeEpisodeId,
      ep,
    });
  },
});
