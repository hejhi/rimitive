export const tpl = (content: string, hydrationScript = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rimitive SSR Marketing Site</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8f9fa;
      line-height: 1.6;
      color: #333;
    }
    a {
      color: #007bff;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }

    /* Layout */
    .app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .navbar {
      background: white;
      padding: 1rem 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-brand h1 {
      font-size: 1.4rem;
      color: #333;
      font-weight: 600;
    }
    .nav-links {
      display: flex;
      gap: 0.5rem;
    }
    .nav-link {
      padding: 0.5rem 1rem;
      color: #555;
      text-decoration: none;
      border-radius: 6px;
      transition: all 0.2s;
      font-weight: 500;
    }
    .nav-link:hover {
      background: #f0f0f0;
      color: #333;
      text-decoration: none;
    }
    .nav-link.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .main-content {
      flex: 1;
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Page containers */
    .page {
      background: white;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .page h2 {
      color: #333;
      margin-bottom: 0.75rem;
      font-size: 2rem;
    }
    .lead {
      font-size: 1.15rem;
      color: #666;
      margin-bottom: 2rem;
      max-width: 600px;
    }

    /* Buttons */
    button, .primary-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.75rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    button:hover, .primary-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      text-decoration: none;
    }
    .secondary-btn {
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
      padding: 0.75rem 1.75rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s, color 0.2s;
    }
    .secondary-btn:hover {
      background: #667eea;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    /* Cards */
    .card {
      background: #fafafa;
      padding: 1.5rem;
      border-radius: 8px;
      margin: 1rem 0;
      border: 1px solid #eee;
    }
    .card h3 {
      color: #333;
      margin-bottom: 0.75rem;
    }
    ul, ol {
      margin-left: 1.5rem;
      margin-top: 0.5rem;
    }
    li {
      margin: 0.4rem 0;
      color: #555;
    }

    /* Footer */
    .footer {
      background: #333;
      color: #aaa;
      padding: 1.5rem 2rem;
      text-align: center;
      margin-top: auto;
    }
    .footer p {
      font-size: 0.9rem;
    }

    /* Home page */
    .hero {
      text-align: center;
      padding: 2rem 0 3rem;
    }
    .hero h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero .lead {
      max-width: 500px;
      margin: 0 auto 2rem;
    }
    .hero-cta {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }
    .features {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #eee;
    }
    .features h2 {
      text-align: center;
      margin-bottom: 2rem;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }
    .feature {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 10px;
      border: 1px solid #eee;
    }
    .feature h3 {
      margin-bottom: 0.5rem;
      font-size: 1.1rem;
    }
    .feature p {
      color: #666;
      font-size: 0.95rem;
    }

    /* Services page */
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .service-card {
      background: #f8f9fa;
      padding: 2rem;
      border-radius: 12px;
      border: 1px solid #eee;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .service-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }
    .service-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1rem;
    }
    .service-card h3 {
      margin-bottom: 0.75rem;
      color: #333;
    }
    .service-card p {
      color: #666;
      margin-bottom: 1rem;
      font-size: 0.95rem;
    }
    .service-link {
      color: #667eea;
      font-weight: 500;
    }

    /* Service detail page */
    .service-detail-page .back-link {
      display: inline-block;
      margin-bottom: 1.5rem;
      color: #667eea;
      font-weight: 500;
    }
    .service-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .service-icon-large {
      font-size: 3rem;
    }
    .service-header h2 {
      margin: 0;
    }
    .service-description {
      font-size: 1.1rem;
      color: #555;
      margin-bottom: 2rem;
      line-height: 1.7;
    }
    .service-section {
      margin: 2rem 0;
    }
    .service-section h3 {
      margin-bottom: 1rem;
      color: #333;
    }
    .benefits-list, .process-list {
      background: #f8f9fa;
      padding: 1.5rem 1.5rem 1.5rem 2.5rem;
      border-radius: 8px;
    }
    .benefits-list li, .process-list li {
      padding: 0.5rem 0;
    }
    .service-cta {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      margin-top: 2rem;
    }
    .service-cta p {
      color: white;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    .service-cta .primary-btn {
      background: white;
      color: #667eea;
    }
    .service-cta .primary-btn:hover {
      box-shadow: 0 4px 12px rgba(255,255,255,0.3);
    }

    /* Contact page */
    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 2rem;
      margin-top: 1rem;
    }
    @media (max-width: 768px) {
      .contact-grid {
        grid-template-columns: 1fr;
      }
    }
    .contact-info {
      margin: 0;
    }
    .contact-info h3 {
      margin-bottom: 1.5rem;
      color: #333;
    }
    .contact-info p {
      margin-bottom: 1rem;
      color: #555;
    }
    .contact-info strong {
      color: #333;
    }
    .contact-form {
      background: #f8f9fa;
      padding: 2rem;
      border-radius: 12px;
    }
    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-group label {
      font-weight: 500;
      color: #333;
    }
    .form-group input,
    .form-group textarea {
      padding: 0.75rem 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
    }
    .success-message {
      text-align: center;
      padding: 2rem;
    }
    .success-message h3 {
      color: #28a745;
      margin-bottom: 0.5rem;
    }

    /* Not found page */
    .not-found {
      text-align: center;
      padding: 3rem;
    }
    .not-found h2 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .not-found p {
      color: #666;
      margin-bottom: 2rem;
    }
  </style>
</head>
<body>
  ${content}
  <script type="module" src="/client.js"></script>
  ${hydrationScript}
</body>
</html>
`;
