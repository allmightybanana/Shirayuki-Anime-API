export const animekaiProxyController = async (c) => {
  try {
    const url = c.req.query('url');
    if (!url) {
      return c.json(
        {
          success: false,
          error: 'URL parameter is required',
        },
        400
      );
    }

    const response = await fetch(url);
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
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
