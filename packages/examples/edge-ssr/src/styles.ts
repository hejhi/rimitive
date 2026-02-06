/**
 * App Styles
 */
export const styles = `
* { box-sizing: border-box; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem;
  background: #0a0a0a;
  color: #fafafa;
}
h1 { color: #3b82f6; margin-bottom: 0.5rem; }
.lead { font-size: 1.125rem; color: #ccc; }
.container { display: flex; flex-direction: column; gap: 1rem; }
.nav {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid #333;
  margin-bottom: 1rem;
}
.nav a { color: #3b82f6; text-decoration: none; }
.nav a:hover { text-decoration: underline; }
.card {
  background: #1a1a1a;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #333;
}
.card h3 { margin-top: 0; color: #3b82f6; }
.card.loading { opacity: 0.7; }
.card.info { background: #1a2a1a; border-color: #2a4a2a; }
.card.error { background: #2a1a1a; border-color: #4a2a2a; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.skeleton {
  background: #333;
  padding: 1rem;
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.timing { font-size: 0.875rem; color: #888; }
ul { padding-left: 1.5rem; }
li { margin: 0.5rem 0; }
a { color: #3b82f6; }
.page { min-height: 50vh; }
`;
