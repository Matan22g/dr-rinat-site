import { preview } from 'vite';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  console.log('🚀 Starting Vite preview server...');
  const server = await preview({ preview: { port: 4173 } });
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Load the articles list to generate routes dynamically
  const articles = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/articles.json'), 'utf-8'));
  
  const routes = [
    '/', 
    '/gallery.html', 
    '/articles',
    ...articles.map(a => `/articles/${a.slug}`)
  ];
  
  for (const route of routes) {
    console.log(`⏳ Pre-rendering ${route}...`);
    await page.goto(`http://localhost:4173${route}`, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    let html = await page.content();
    html = html.replace(/http:\/\/localhost:4173/g, '');
    
    // Determine file path and ensure directories exist
    const fileName = route === '/' ? 'index.html' : route.endsWith('.html') ? route : `${route}.html`;
    const filePath = path.join(__dirname, 'dist', fileName);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(filePath, html);
    console.log(`✅ Saved: ${fileName}`);
  }

  await browser.close();
  server.httpServer.close();
  console.log('🎉 Articles Pre-rendering complete!');
  process.exit(0);
})();