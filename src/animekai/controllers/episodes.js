import { getAnimekaiEpisodes } from '../scraper/episodes.js';
import { resolveExternalId } from '../../utils/resolver.js';

export const animekaiEpisodesController = async (c) => {
	try {
		let animeId = c.req.param('animeId');
		const provider = c.req.query('provider');

		if (!animeId) {
			return c.json(
				{
					success: false,
					error: 'animeId parameter is required',
				},
				400
			);
		}

		if (provider && (provider === 'anilist' || provider === 'mal')) {
			const resolvedId = await resolveExternalId(animeId, provider, 'animekai');
			if (!resolvedId) {
				return c.json(
					{
						success: false,
						error: `Could not resolve ${provider} ID "${animeId}" to an AnimeKai ID`,
					},
					404
				);
			}
			animeId = resolvedId;
		}

		const data = await getAnimekaiEpisodes(animeId);
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
