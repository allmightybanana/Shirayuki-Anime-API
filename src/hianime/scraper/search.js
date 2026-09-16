import {
  HIANIME_BASE_URL,
  fetchApiJson,
  fetchPage,
  extractFlwItems,
  extractPagination,
  parseNumber,
} from './_shared.js';

export const getHianimeSearch = async ({ q, page } = {}) => {
  const keyword = String(q || '').trim();
  if (!keyword) {
    throw new Error('q query parameter is required');
  }
  const normalizedPage = Number(page) > 0 ? Number(page) : 1;

  try {
    const rawList = await fetchApiJson('/search', {
      method: 'POST',
      data: { title: keyword },
    });

    const items = Array.isArray(rawList) ? rawList : [];

    const results = items.map((anime) => {
      const slug = anime.slug || (Array.isArray(anime.slugs) ? anime.slugs[0] : null) || anime._id;
      return {
        id: slug,
        title: anime.title || anime.English || null,
        jname: anime.Japanese || null,
        ename: anime.English || null,
        href: `/anime/${slug}`,
        url: `${HIANIME_BASE_URL}/anime/${slug}`,
        poster: anime.image || anime.landScapeImage || null,
        type: anime.Type || null,
        duration: anime.Duration || null,
        episode: null,
        episodes: {
          sub: typeof anime.totalSubbed === 'number' ? anime.totalSubbed : parseNumber(anime.totalSubbed),
          dub: typeof anime.totalDubbed === 'number' ? anime.totalDubbed : parseNumber(anime.totalDubbed),
        },
        mal_id: anime.mal_id || null,
      };
    }).filter((r) => r.id);

    const itemsPerPage = 24;
    const totalPages = Math.ceil(results.length / itemsPerPage) || 1;
    const paginatedResults = results.slice((normalizedPage - 1) * itemsPerPage, normalizedPage * itemsPerPage);

    return {
      source: `${HIANIME_BASE_URL}/filter?keyword=${encodeURIComponent(keyword)}`,
      query: keyword,
      pagination: {
        currentPage: normalizedPage,
        totalPages,
        hasNextPage: normalizedPage < totalPages,
      },
      results: paginatedResults.length ? paginatedResults : results,
    };
  } catch (apiErr) {
    console.error('[getHianimeSearch] API search failed, falling back to HTML fetch:', apiErr.message);
    const { url, $ } = await fetchPage('/filter', {
      searchParams: { keyword, page: normalizedPage },
      referer: `${HIANIME_BASE_URL}/`,
    });

    return {
      source: url,
      query: keyword,
      pagination: extractPagination($),
      results: extractFlwItems($),
    };
  }
};

