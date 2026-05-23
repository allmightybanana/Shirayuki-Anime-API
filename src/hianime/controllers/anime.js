import { getHianimeAnimeDetails } from '../scraper/anime.js';
import { wrapController } from './_cache.js';
import { resolveSingleAnime } from '../../utils/anilist.js';
import { resolveExternalId } from '../../utils/resolver.js';

export const hianimeAnimeController = wrapController({
  cacheKey: (c) => `anime:${c.req.param('animeId') || ''}:${c.req.query('provider') || ''}`,
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

    const details = await getHianimeAnimeDetails({ animeId });
    const mapping = await resolveSingleAnime(details.title, details.jname, details.ename);
    return {
      ...details,
      anilistId: mapping.anilistId,
      malId: mapping.malId,
    };
  },
});
