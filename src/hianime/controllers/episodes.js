import { getHianimeEpisodes } from '../scraper/episodes.js';
import { wrapController } from './_cache.js';
import { resolveExternalId } from '../../utils/resolver.js';

export const hianimeEpisodesController = wrapController({
  cacheKey: (c) => `episodes:${c.req.param('animeId') || ''}:${c.req.query('provider') || ''}`,
  handler: async (c) => {
    let animeId = c.req.param('animeId');
    const provider = c.req.query('provider');

    if (provider && (provider === 'anilist' || provider === 'mal')) {
      const resolvedId = await resolveExternalId(animeId, provider, 'hianime');
      if (!resolvedId) {
        throw new Error(`Could not resolve ${provider} ID "${animeId}" to a HiAnime ID`);
      }
      animeId = resolvedId;
    }

    return getHianimeEpisodes({ animeId });
  },
});
