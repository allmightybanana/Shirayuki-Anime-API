let handlerInstance = null;

exports.handler = async (event, context) => {
  if (!handlerInstance) {
    const { handle } = await import('hono/netlify');
    const { default: app } = await import('../../index-worker.js');
    handlerInstance = handle(app);
  }
  return handlerInstance(event, context);
};
