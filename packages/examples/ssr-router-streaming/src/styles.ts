/**
 * CSS styles for the analytics dashboard streaming SSR example.
 */
export function getStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f1117;
      color: #e1e4e8;
      line-height: 1.6;
    }
    .app {
      display: grid;
      grid-template-columns: 240px 1fr;
      min-height: 100vh;
    }

    /* Sidebar */
    .side-nav {
      background: #161b22;
      border-right: 1px solid #21262d;
      padding: 1.5rem 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }
    .nav-section {
      padding: 0 1rem;
      margin-bottom: 1.5rem;
    }
    .nav-section h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #8b949e;
      margin-bottom: 0.5rem;
      padding: 0 0.75rem;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: #c9d1d9;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .nav-link:hover {
      background: #21262d;
      color: #f0f6fc;
    }
    .nav-link.active {
      background: #1f6feb;
      color: #fff;
    }
    .site-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Main content */
    .main-content {
      padding: 2rem;
      overflow-y: auto;
    }
    .page {
      max-width: 1100px;
    }
    .page h2,
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f0f6fc;
      margin-bottom: 1.25rem;
    }

    /* Metrics grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 900px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .metric-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .metric-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #f0f6fc;
    }
    .metric-label {
      font-size: 0.8rem;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .metric-change {
      font-size: 0.85rem;
      font-weight: 500;
    }
    .metric-change.up {
      color: #3fb950;
    }
    .metric-change.down {
      color: #f85149;
    }

    /* Overview grid */
    .overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 800px) {
      .overview-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Page views table */
    .pageviews-table h3 {
      font-size: 1rem;
      color: #f0f6fc;
      margin-bottom: 0.75rem;
    }
    .pageviews-row {
      display: flex;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .pageviews-row:nth-child(even) {
      background: rgba(255, 255, 255, 0.03);
    }
    .page-path {
      font-family: monospace;
      color: #c9d1d9;
    }
    .page-views {
      color: #8b949e;
    }
    .page-visitors {
      color: #8b949e;
    }

    /* Referrer list */
    .referrer-list h3 {
      font-size: 1rem;
      color: #f0f6fc;
      margin-bottom: 0.75rem;
    }
    .referrer-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
    }
    .referrer-source {
      flex: 1;
      color: #c9d1d9;
    }
    .referrer-visitors {
      color: #8b949e;
      min-width: 60px;
      text-align: right;
    }
    .referrer-trend {
      font-size: 0.8rem;
      font-weight: 500;
    }
    .trend-up { color: #3fb950; }
    .trend-down { color: #f85149; }
    .trend-stable { color: #8b949e; }

    /* Traffic chart */
    .traffic-chart h3 {
      font-size: 1rem;
      color: #f0f6fc;
      margin-bottom: 0.75rem;
    }
    .chart-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.3rem 0;
      font-size: 0.85rem;
    }
    .chart-label {
      min-width: 50px;
      color: #8b949e;
      text-align: right;
    }
    .chart-bar {
      height: 16px;
      background: #1f6feb;
      border-radius: 3px;
    }
    .chart-value {
      color: #8b949e;
      min-width: 40px;
    }

    /* Site detail */
    .site-header {
      margin-bottom: 1.5rem;
    }
    .site-domain {
      color: #8b949e;
      margin-bottom: 0.5rem;
    }
    .site-stats {
      display: flex;
      gap: 1.5rem;
    }
    .stat {
      font-size: 0.9rem;
      color: #8b949e;
    }
    .site-traffic h3 {
      font-size: 1rem;
      color: #f0f6fc;
      margin-bottom: 0.75rem;
    }
    .recent-events h3 {
      font-size: 1rem;
      color: #f0f6fc;
      margin-bottom: 0.75rem;
    }

    /* Event feed */
    .event-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.5rem;
      font-size: 0.85rem;
      border-bottom: 1px solid #21262d;
    }
    .event-type {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 500;
      min-width: 70px;
      text-align: center;
      text-transform: capitalize;
    }
    .event-type-pageview {
      background: rgba(31, 111, 235, 0.2);
      color: #58a6ff;
    }
    .event-type-signup {
      background: rgba(63, 185, 80, 0.2);
      color: #3fb950;
    }
    .event-type-purchase {
      background: rgba(210, 153, 34, 0.2);
      color: #d29922;
    }
    .event-type-error {
      background: rgba(248, 81, 73, 0.2);
      color: #f85149;
    }
    .event-path {
      flex: 1;
      color: #c9d1d9;
      font-family: monospace;
      font-size: 0.8rem;
    }
    .event-visitor {
      color: #8b949e;
      min-width: 90px;
    }
    .event-time {
      color: #484f58;
      font-size: 0.8rem;
      min-width: 50px;
      text-align: right;
    }

    /* Event filter */
    .event-filter {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .filter-buttons {
      display: flex;
      gap: 0.4rem;
    }
    .filter-btn {
      padding: 0.3rem 0.75rem;
      border: 1px solid #30363d;
      background: transparent;
      color: #8b949e;
      border-radius: 14px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .filter-btn:hover {
      border-color: #58a6ff;
      color: #c9d1d9;
    }
    .filter-btn.active {
      background: #1f6feb;
      border-color: #1f6feb;
      color: #fff;
    }
    .filter-count {
      font-size: 0.8rem;
      color: #484f58;
    }

    /* Skeletons */
    .skeleton {
      background: #21262d;
      border-radius: 6px;
      animation: pulse 1.5s ease-in-out infinite;
    }
    .skeleton-sm { height: 40px; }
    .skeleton-md { height: 80px; }
    .skeleton-lg { height: 160px; }
    .skeleton-text {
      display: block;
      padding: 0.75rem;
      color: #484f58;
      font-size: 0.85rem;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Section error */
    .section-error {
      padding: 1rem;
      background: rgba(248, 81, 73, 0.1);
      border: 1px solid rgba(248, 81, 73, 0.3);
      border-radius: 6px;
      color: #f85149;
      font-size: 0.9rem;
    }

    /* Not found */
    .not-found-page {
      text-align: center;
      padding-top: 4rem;
    }
    .not-found-page p {
      color: #8b949e;
    }
  `;
}
