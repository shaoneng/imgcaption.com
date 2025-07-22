/**
 * Cloudflare Worker to proxy requests to the Google Gemini API.
 * This script securely adds the API key on the server-side.
 */
export default {
  async fetch(request, env, ctx) {
    // 1. We only want to handle POST requests.
    if (request.method !== 'POST') {
      return new Response('Expected POST request', { status: 405 });
    }

    // 2. Set up CORS headers to allow requests from your GitHub Pages domain.
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // For testing. For production, replace '*' with your GitHub Pages URL.
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 3. Get the request body from the frontend.
      const requestBody = await request.json();

      // 4. Construct the URL for the actual Google API.
      const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;

      // 5. Make the request to the Google API, forwarding the body.
      const googleResponse = await fetch(googleApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // 6. Check if the request to Google was successful.
      if (!googleResponse.ok) {
        // If not, pass the error response back to the frontend.
        const errorText = await googleResponse.text();
        return new Response(`Error from Google API: ${errorText}`, { 
          status: googleResponse.status,
          headers: corsHeaders 
        });
      }

      // 7. Get the response from Google.
      const googleResponseBody = await googleResponse.json();

      // 8. Send the response from Google back to the frontend.
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
  },
};
