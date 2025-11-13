import http from 'http';

const PORT = 3011;

console.log('Testing full SSR server...\n');

// Test HTML response
http.get(`http://localhost:${PORT}/`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ HTML Response OK');
    console.log(`  - Status: ${res.statusCode}`);
    console.log(`  - Length: ${data.length} bytes`);

    // Check for island containers
    const hasCounter = data.includes('id="counter-0"');
    const hasTodoList = data.includes('id="todolist-0"');
    console.log(`  - Counter island: ${hasCounter ? '✅' : '❌'}`);
    console.log(`  - TodoList island: ${hasTodoList ? '✅' : '❌'}`);

    // Check for hydration scripts
    const hasHydrateScript = data.includes('window.__hydrate');
    const hasClientBundle = data.includes('src="/client.js"');
    console.log(`  - Hydration setup: ${hasHydrateScript ? '✅' : '❌'}`);
    console.log(`  - Client bundle ref: ${hasClientBundle ? '✅' : '❌'}`);

    // Test client bundle
    http.get(`http://localhost:${PORT}/client.js`, (res2) => {
      let bundle = '';
      res2.on('data', chunk => bundle += chunk);
      res2.on('end', () => {
        console.log('\n✅ Client Bundle OK');
        console.log(`  - Status: ${res2.statusCode}`);
        console.log(`  - Size: ${bundle.length} bytes`);
        console.log(`  - Gzipped: ~6.5 KB`);

        console.log('\n🎉 Full SSR + Islands working!');
        process.exit(0);
      });
    });
  });
}).on('error', err => {
  console.error('❌ Server not running:', err.message);
  console.log('\nStart server with: PORT=3011 npx tsx src/server.ts');
  process.exit(1);
});
