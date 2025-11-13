import http from 'http';

const port = process.env.PORT || 3007;
console.log(`Making HTTP request to server on port ${port}...`);

const req = http.get(`http://localhost:${port}/`, (res) => {
  console.log('Got response, status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
    console.log('Received chunk, total length:', data.length);
  });
  res.on('end', () => {
    console.log('Response complete, total length:', data.length);
    console.log('First 500 chars:', data.slice(0, 500));
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.error('Request timed out');
  req.destroy();
  process.exit(1);
});
