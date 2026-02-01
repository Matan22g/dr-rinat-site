import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import GalleryPage from './GalleryPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GalleryPage />
  </StrictMode>,
)