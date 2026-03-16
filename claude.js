module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let { messages, system, model, max_tokens } = req.body;

    // If the user message is a bare URL, fetch the page content first
    const userContent = (messages && messages[0] && messages[0].content) || '';
    const urlMatch = userContent.trim().match(/^https?:\/\/[^\s]+$/);

    if (urlMatch) {
      try {
        const https = require('https');
        const http = require('http');
        const urlObj = new URL(urlMatch[0]);
        const client = urlObj.protocol === 'https:' ? https : http;

        const pageText = await new Promise((resolve, reject) => {
          const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 8000,
          };
          const req2 = client.request(options, (res2) => {
            let data = '';
            res2.on('data', chunk => { data += chunk; });
            res2.on('end', () => resolve(data));
          });
          req2.on('error', reject);
          req2.on('timeout', () => { req2.destroy(); reject(new Error('timeout')); });
          req2.end();
        });

        // Strip HTML tags and trim
        const text = pageText
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 8000);

        messages = [{ role: 'user', content: 'URL: ' + urlMatch[0] + '\n\nPage content:\n' + text }];
      } catch (fetchErr) {
        console.log('URL fetch failed:', fetchErr.message);
      }
    }

    const https = require('https');
    const body = JSON.stringify({ model, max_tokens, system, messages });

    const claudeResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const req2 = https.request(options, (res2) => {
        let data = '';
        res2.on('data', chunk => { data += chunk; });
        res2.on('end', () => resolve(data));
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });

    const data = JSON.parse(claudeResponse);
    return res.status(200).json(data);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
