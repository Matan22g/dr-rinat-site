import { preview } from 'vite';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  console.log('🚀 Starting Vite preview server for pre-rendering...');
  // Spin up Vite's local server programmatically
  const server = await preview({ preview: { port: 4173 } });
  
  console.log('🤖 Launching modern headless browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // The routes we want to bake into static HTML
  const routes = ['/', '/gallery.html'];
  
  for (const route of routes) {
    console.log(`⏳ Pre-rendering ${route}...`);
    
    // Go to the route and wait for the React app to fully load
    await page.goto(`http://localhost:4173${route}`, { waitUntil: 'networkidle0' });
    
    // Give it a tiny bit of extra time to ensure the DOM is completely stable
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    // Extract the final HTML
    const html = await page.content();
    
    // Determine file path
    const fileName = route === '/' ? 'index.html' : route;
    const filePath = path.join(__dirname, 'dist', fileName);
    
    // Overwrite the empty Vite shell with the fully rendered DOM
    fs.writeFileSync(filePath, html);
    console.log(`✅ Saved fully rendered HTML to ${fileName}`);
  }

  // Teardown
  await browser.close();
  server.httpServer.close();
  console.log('🎉 Pre-rendering pipeline complete!');
  process.exit(0);
})();