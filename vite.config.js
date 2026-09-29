import { defineConfig, loadEnv } from 'vite';

function vocabApi() {
  async function middleware(req, res, next) {
    if (new URL(req.url, 'http://localhost').pathname !== '/api/vocab') return next();

    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) {
          res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '이미지가 너무 큽니다.' }));
          return;
        }
        chunks.push(chunk);
      }
      try {
        req.body = size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '요청 데이터가 올바른 JSON이 아닙니다.' }));
        return;
      }
      res.status = function (code) { this.statusCode = code; return this; };
      res.json = function (payload) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8');
        this.end(JSON.stringify(payload));
      };
      const { default: handler } = await import('./api/vocab.js');
      await handler(req, res);
    } catch (error) {
      console.error('Local vocabulary API error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '로컬 API 서버 오류가 발생했습니다.' }));
      }
    }
  }

  return {
    name: 'vocabulary-api',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const name of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }
  return { plugins: [vocabApi()] };
});
