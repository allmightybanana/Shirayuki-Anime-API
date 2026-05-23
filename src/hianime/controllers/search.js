import { getHianimeSearch } from '../scraper/search.js';
import { wrapController } from './_cache.js';
import { resolveBulkAnime } from '../../utils/anilist.js';

export const hianimeSearchController = wrapController({
  cacheKey: (c) => `search:${c.req.query('q') || ''}:${c.req.query('page') || '1'}`,
  handler: async (c) => {
    const q = c.req.query('q');
    const page = c.req.query('page');
    const searchData = await getHianimeSearch({ q, page });
    if (searchData?.results) {
      searchData.results = await resolveBulkAnime(searchData.results, q);
    }
    return searchData;
  },
});
