import {
  HIANIME_BASE_URL,
  fetchApiJson,
  fetchPage,
  extractPosterFromImg,
  getAnimeId,
  toAbsoluteUrl,
} from './_shared.js';

export const getHianimeSearchSuggestion = async ({ q } = {}) => {
  const keyword = String(q || '').trim();
  if (!keyword) {
    throw new Error('q query parameter is required');
  }

  try {
    const rawResults = await fetchApiJson('/search', {
      method: 'POST',
      data: { title: keyword },
    });

    const candidates = Array.isArray(rawResults) ? rawResults : [];
    const suggestions = candidates.slice(0, 10).map((anime) => {
      const slug = anime.slug || (Array.isArray(anime.slugs) ? anime.slugs[0] : null) || anime._id;
      const infoParts = [];
      if (anime.Type || anime.format) infoParts.push(anime.Type || anime.format);
      if (anime.Duration) infoParts.push(anime.Duration);
      if (anime.Aired) infoParts.push(anime.Aired);

      return {
        id: slug,
        title: anime.title || anime.English || null,
        jname: anime.Japanese || null,
        aliases: anime.English || null,
        href: `/anime/${slug}`,
        url: `${HIANIME_BASE_URL}/anime/${slug}`,
        poster: anime.image || anime.landScapeImage || null,
        info: infoParts.join(' • ') || null,
      };
    }).filter((s) => s.id);

    return {
      source: `${HIANIME_BASE_URL}/search?keyword=${encodeURIComponent(keyword)}`,
      query: keyword,
      suggestions,
    };
  } catch (apiErr) {
    console.error('[getHianimeSearchSuggestion] API search failed, falling back to HTML:', apiErr.message);
  }

  const { url, $ } = await fetchPage('/filter', {
    searchParams: { keyword },
    referer: `${HIANIME_BASE_URL}/`,
    xhr: true,
  });

  const suggestions = $('a.nav-item')
    .map((_, el) => {
      const $a = $(el);
      const href = $a.attr('href')?.trim() || null;
      const $name = $a.find('.film-name').first();
      const $img = $a.find('.film-poster img').first();
      const infoText = $a.find('.film-infor').first().text().trim() || null;

      return {
        id: getAnimeId(href),
        title: $name.text().trim() || null,
        jname: $name.attr('data-jname')?.trim() || null,
        aliases: $a.find('.alias-name').first().text().trim() || null,
        href,
        url: toAbsoluteUrl(href),
        poster: extractPosterFromImg($img),
        info: infoText,
      };
    })
    .get()
    .filter((item) => item.id);

  return {
    source: url,
    query: keyword,
    suggestions,
  };
};
