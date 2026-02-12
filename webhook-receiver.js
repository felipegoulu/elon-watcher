import http from 'http';

const PORT = 3333;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const timestamp = new Date().toLocaleString('es-AR', { timeZone: 'America/Buenos_Aires' });
      console.log(`\n🐦 [${timestamp}] Tweet received!`);
      try {
        const tweet = JSON.parse(body);
        // Log full structure to see what we're getting
        console.log(`   Full data: ${JSON.stringify(tweet, null, 2)}`);
      } catch (e) {
        console.log(`   Raw: ${body}`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Elon Watcher webhook receiver running 🦀');
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Webhook receiver listening on http://localhost:${PORT}`);
  console.log(`   Waiting for tweets from Elon...\n`);
});
