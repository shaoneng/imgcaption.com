/**
 * Cloudflare Worker  |  Proxy → Google Gemini API
 * 把 API-Key 藏在服务端，前端拿不到。
 */
export default {
  async fetch(request, env) {
    // ===== ① CORS 头，每次都要带 =====
    const cors = {
      'Access-Control-Allow-Origin': 'https://imgcaption.com',           // TODO: 生产环境写成 https://你的域名
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // ===== ② 预检请求必须先放行 =====
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ===== ③ 只接受 POST，其它一律 405 =====
    if (request.method !== 'POST') {
      return new Response('Expected POST request', { status: 405, headers: cors });
    }

    try {
      const body = await request.json();

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await resp.text();            // 先拿文本，成功失败都能读
      return new Response(text, {
        status: resp.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(`Worker error: ${err}`, { status: 500, headers: cors });
    }
  },
};