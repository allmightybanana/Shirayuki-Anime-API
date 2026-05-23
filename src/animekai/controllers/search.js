import { getAnimekaiSearchResults } from '../scraper/search.js';
import { resolveBulkAnime } from '../../utils/anilist.js';

export const animekaiSearchController = async (c) => {
	try {
		const q = c.req.query('q');
		const page = parseInt(c.req.query('page')) || 1;

		if (!q) {
			return c.json(
				{
					success: false,
					error: 'Query parameter "q" is required',
				},
				400
			);
		}

		const data = await getAnimekaiSearchResults(q, page);
		if (data?.animes) {
			data.animes = await resolveBulkAnime(data.animes, q);
		}
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
