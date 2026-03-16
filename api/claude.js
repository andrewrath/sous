export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let { messages, system, model, max_tokens } = req.body;

    // If the user message looks like a URL, fetch the page content first
    const userContent = messages?.[0]?.content || '';
    const urlMatch = userContent.trim().match(/^https?:\/\/[^\s]+$/);

    if (urlMatch) {
      try {
        const pageRes = await fetch(urlMatch[0], {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SousApp/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(8000),
        });
        const html = await pageRes.text();

        // Strip HTML tags, keep under ~6000 chars
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 6000);

        messages = [{ role: 'user', content: `URL: ${urlMatch[0]}\n\nPage content:\n${text}` }];
      } catch (fetchErr) {
        console.log('Could not fetch URL:', fetchErr.message);
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
