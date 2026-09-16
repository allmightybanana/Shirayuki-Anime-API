import {
  HIANIME_BASE_URL,
  fetchApiJson,
  fetchPage,
  parseFlwItem,
  extractPosterFromImg,
  toAbsoluteUrl,
  getAnimeId,
  parseNumber,
} from './_shared.js';

const GENRE_LIST = [
  'Action', 'Adventure', 'Cars', 'Comedy', 'Dementia', 'Demons',
  'Drama', 'Ecchi', 'Fantasy', 'Game', 'Harem', 'Historical',
  'Horror', 'Isekai', 'Josei', 'Kids', 'Magic', 'Martial Arts',
  'Mecha', 'Military', 'Music', 'Mystery', 'Parody', 'Police',
  'Psychological', 'Romance', 'Samurai', 'School', 'Sci-Fi',
  'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Space', 'Sports',
  'Super Power', 'Supernatural', 'Thriller', 'Vampire',
];

export const getHianimeHomePage = async () => {
  try {
    const data = await fetchApiJson('/home');

    const trendingAnimes = data.trending?.animes || [];
    const trending = trendingAnimes.map((anime, index) => {
      const slug = anime.slug || (Array.isArray(anime.slugs) ? anime.slugs[0] : null) || anime._id;
      return {
        rank: index + 1,
        id: slug,
        title: anime.title || anime.English || null,
        jname: anime.Japanese || null,
        ename: anime.English || null,
        href: `/anime/${slug}`,
        url: `${HIANIME_BASE_URL}/anime/${slug}`,
        poster: anime.image || anime.landScapeImage || null,
      };
    }).filter((item) => item.id);

    const latestEpisodesList = data.latestEpisodes?.episodes || [];
    const latestEpisodes = latestEpisodesList.map((ep) => {
      const animeInfo = ep.anime_info || {};
      const animeSlug = animeInfo.slug || (Array.isArray(animeInfo.slugs) ? animeInfo.slugs[0] : null) || ep.slug;
      return {
        id: animeSlug,
        title: animeInfo.title || animeInfo.English || ep.title || null,
        jname: animeInfo.Japanese || null,
        ename: animeInfo.English || null,
        href: `/watch/${ep.slug || `${animeSlug}/ep-${ep.episodeNumber}`}`,
        url: `${HIANIME_BASE_URL}/watch/${ep.slug || `${animeSlug}/ep-${ep.episodeNumber}`}`,
        poster: animeInfo.image || animeInfo.landScapeImage || ep.image || null,
        type: animeInfo.Type || null,
        duration: animeInfo.Duration || null,
        episode: ep.episodeNumber,
        episodes: {
          sub: animeInfo.totalSubbed ?? animeInfo.episodes?.sub ?? ep.episodeNumber ?? null,
          dub: animeInfo.totalDubbed ?? animeInfo.episodes?.dub ?? null,
        },
      };
    }).filter((item) => item.id);

    const mapTopItem = (anime, rank) => {
      const slug = anime.slug || (Array.isArray(anime.slugs) ? anime.slugs[0] : null) || anime._id;
      return {
        rank,
        id: slug,
        title: anime.title || anime.English || null,
        jname: anime.Japanese || null,
        ename: anime.English || null,
        href: `/anime/${slug}`,
        url: `${HIANIME_BASE_URL}/anime/${slug}`,
        poster: anime.image || anime.landScapeImage || null,
        episodes: {
          sub: anime.totalSubbed ?? anime.episodes?.sub ?? null,
          dub: anime.totalDubbed ?? anime.episodes?.dub ?? null,
        },
      };
    };

    const popularAnimes = data.popular?.animes || [];
    const airingAnimes = data.currentlyAiring?.animes || [];

    const top10 = {
      day: popularAnimes.slice(0, 10).map((a, i) => mapTopItem(a, i + 1)),
      week: trendingAnimes.slice(0, 10).map((a, i) => mapTopItem(a, i + 1)),
      month: (airingAnimes.length ? airingAnimes : popularAnimes).slice(0, 10).map((a, i) => mapTopItem(a, i + 1)),
    };

    const estimatedSchedule = airingAnimes.slice(0, 15).map((anime) => {
      const slug = anime.slug || (Array.isArray(anime.slugs) ? anime.slugs[0] : null) || anime._id;
      return {
        id: slug,
        title: anime.title || anime.English || null,
        jname: anime.Japanese || null,
        ename: anime.English || null,
        href: `/anime/${slug}`,
        url: `${HIANIME_BASE_URL}/anime/${slug}`,
        episodeNumber: parseNumber(anime.totalEpisodes) || 1,
        airingTime: anime.Broadcast || null,
        time: anime.Broadcast || null,
      };
    }).filter((item) => item.id);

    const genres = GENRE_LIST.map((g) => {
      const slug = g.toLowerCase().replace(/\s+/g, '-');
      return {
        name: g,
        slug,
        href: `/genre/${slug}`,
        url: `${HIANIME_BASE_URL}/genre/${slug}`,
      };
    });

    return {
      source: `${HIANIME_BASE_URL}/home`,
      trending,
      latestEpisodes,
      estimatedSchedule,
      top10,
      genres,
    };
  } catch (apiErr) {
    console.error('[getHianimeHomePage] API fetch failed, trying HTML fallback:', apiErr.message);
    const { url, $ } = await fetchPage('/home', { referer: `${HIANIME_BASE_URL}/` });
    return {
      source: url,
      trending: [],
      latestEpisodes: [],
      estimatedSchedule: [],
      top10: { day: [], week: [], month: [] },
      genres: GENRE_LIST.map((g) => {
        const slug = g.toLowerCase().replace(/\s+/g, '-');
        return {
          name: g,
          slug,
          href: `/genre/${slug}`,
          url: `${HIANIME_BASE_URL}/genre/${slug}`,
        };
      }),
    };
  }
};

