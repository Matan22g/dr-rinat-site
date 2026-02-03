import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom" // <--- הוספנו את זה
import App from './App.jsx'
import GalleryPage from './GalleryPage.jsx' // ודא שיש לך את הקובץ הזה
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* <--- חובה לעטוף את הכל בזה */}
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/gallery.html" element={<GalleryPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)