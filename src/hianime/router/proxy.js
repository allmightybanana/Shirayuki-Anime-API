import { Hono } from 'hono';
import { hianimeM3u8ProxyController, hianimeTsProxyController } from '../controllers/proxy.js';

const hianimeProxyRouter = new Hono();

hianimeProxyRouter.get('/master.m3u8', hianimeM3u8ProxyController);
hianimeProxyRouter.get('/playlist.m3u8', hianimeM3u8ProxyController);
hianimeProxyRouter.get('/m3u8', hianimeM3u8ProxyController);

hianimeProxyRouter.get('/seg.ts', hianimeTsProxyController);
hianimeProxyRouter.get('/segment.ts', hianimeTsProxyController);
hianimeProxyRouter.get('/ts', hianimeTsProxyController);

export default hianimeProxyRouter;
