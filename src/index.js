/**
 * Cloudflare Worker to proxy requests to the Google Gemini API.
 * This updated script correctly handles CORS preflight (OPTIONS) requests
 * and gracefully handles other methods like GET.
 */
export default {
  async fetch(request, env, ctx) {
    // --- CORS Headers ---
    // These headers allow your frontend application to communicate with this Worker.
    // This has been updated to match the domain from your response headers.
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://imgcaption.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 1. Handle CORS Preflight Requests (OPTIONS)
    // The browser sends this automatically before a POST request to check permissions.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 2. Handle API Proxy Requests (POST)
    if (request.method === 'POST') {
      try {
        const requestBody = await request.json();
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

        const googleResponse = await fetch(googleApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!googleResponse.ok) {
          const errorText = await googleResponse.text();
          return new Response(`Error from Google API: ${errorText}`, { 
            status: googleResponse.status,
            headers: corsHeaders 
          });
        }

        const googleResponseBody = await googleResponse.json();
        return new Response(JSON.stringify(googleResponseBody), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });

      } catch (error) {
        return new Response(`Worker error: ${error.message}`, { 
          status: 500,
          headers: corsHeaders
        });
      }
    }

    // 3. Handle other requests (like GET for favicon) gracefully
    return new Response('This worker only accepts POST requests for the API.', {
      status: 405, // Method Not Allowed
      headers: corsHeaders,
    });
  },
};