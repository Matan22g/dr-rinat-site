import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageComparison } from './BeforeAfterSection'; // ודא שזה הנתיב הנכון
import galleryData from './imgs/before_after/gallery.json';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_TITLES = {
  lips: 'עיצוב שפתיים',
  nose: 'פיסול אף',
  jawline: 'קו לסת',
  chin: 'עיצוב סנטר',
  cheeks: 'עיצוב לחיים',
  face: 'פיסול פנים',
  face_sculpting: 'פיסול פנים',
  botox: 'טיפול בוטוקס',
  eyes: 'אזור העיניים',
  temples: 'מילוי רקות',
  forehead: 'טיפול מצח',
  other: 'טיפולים אחרים'
};

const GalleryPage = () => {
  const [filter, setFilter] = useState('all');

  // --- Scroll Reset Fix ---
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filter]);

  // 1. עיבוד הנתונים + חישוב נתיבי תמונות רספונסיביים
  const processedData = useMemo(() => {
    return galleryData
      .filter(item => !item.hidden)
      .map(item => ({
        ...item,
        uniqueKey: `${item.category}-${item.id}`,
        
        // Mobile (Always exists)
        beforeSrc: new URL(`./imgs/before_after/${item.before}`, import.meta.url).href,
        afterSrc: new URL(`./imgs/before_after/${item.after}`, import.meta.url).href,
        
        // Desktop (Check if exists first to avoid errors)
        beforeDesktopSrc: item.desktop_before ? new URL(`./imgs/before_after/${item.desktop_before}`, import.meta.url).href : null,
        afterDesktopSrc: item.desktop_after ? new URL(`./imgs/before_after/${item.desktop_after}`, import.meta.url).href : null,
        
        displayTitle: CATEGORY_TITLES[item.category] || item.category 
      }));
  }, []);

  const categories = ['all', 'lips', 'botox', 'other'];

  const filteredItems = useMemo(() => {
    if (filter === 'all') return processedData;
    if (filter === 'other') {
      return processedData.filter(item => item.category !== 'lips' && item.category !== 'botox');
    }
    return processedData.filter(item => item.category === filter);
  }, [filter, processedData]);

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBFE] text-[#2E2A35] font-sans">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F3F0F7] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[#9E8FB2] hover:text-[#2E2A35] transition-colors font-medium">
            <ArrowRight size={20} />
            חזרה לדף הבית
          </Link>
          <span className="font-serif text-2xl font-bold text-[#2E2A35]">
            Dr. Rinat <span className="text-[#9E8FB2]">Gallery</span>
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#2E2A35] mb-4">גלריית עבודות</h1>
          <div className="w-20 h-1 bg-[#A68AC2] mx-auto rounded-full mb-8"></div>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-6 py-2 rounded-full border transition-all duration-300 font-medium text-lg ${
                  filter === cat
                    ? 'bg-[#A68AC2] border-[#A68AC2] text-white shadow-md transform scale-105'
                    : 'bg-transparent border-[#A68AC2] text-[#A68AC2] hover:bg-[#A68AC2] hover:text-white'
                }`}
              >
                {cat === 'all' ? 'הכל' : CATEGORY_TITLES[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 items-start"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.uniqueKey} 
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4 group"
              >
                <div className="shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl overflow-hidden bg-white">
                  <ImageComparison 
                    beforeImage={item.beforeSrc} 
                    afterImage={item.afterSrc}
                    // מעביר את הנתונים החדשים לדסקטופ
                    beforeImageDesktop={item.beforeDesktopSrc} 
                    afterImageDesktop={item.afterDesktopSrc}   
                  />                
                </div>
                
                <div className="text-center">
                  <p className="text-[#2E2A35] font-bold text-xl">{item.displayTitle}</p>
                  {/* אם תרצה להוסיף את המספר הסידורי לדיבאג, אפשר להוריד את ההערה */}
                  {/* <p className="text-gray-400 text-sm">#{item.id}</p> */}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default GalleryPage;