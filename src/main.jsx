import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import GalleryPage from './GalleryPage.jsx' 
import ArticlesIndex from './ArticlesIndex.jsx'
import ArticleDetail from './ArticleDetail.jsx'
import './index.css'

const rootElement = document.getElementById('root');

const app = (
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/gallery.html" element={<GalleryPage />} />
          <Route path="/articles" element={<ArticlesIndex />} />
          <Route path="/articles/:slug" element={<ArticleDetail />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}