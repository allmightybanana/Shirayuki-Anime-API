import { getMiruroEpisodes } from '../scraper/episodes.js';

export const miruroEpisodesController = async (c) => {
  try {
    const animeId = c.req.param('animeId');

    if (!animeId) {
      return c.json(
        {
          success: false,
          error: 'animeId parameter is required',
        },
        400
      );
    }

    const data = await getMiruroEpisodes(animeId);
    return c.json({
      success: true,
      data,
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
