import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ImageComparison } from './BeforeAfterSection';
import galleryData from './imgs/before_after/gallery.json';

const CATEGORY_TITLES = {
  lips: 'עיצוב שפתיים',
  nose: 'פיסול אף',
  jaw: 'קו לסת',
  cheeks: 'עיצוב לחיים',
  chin: 'עיצוב סנטר',
  botox: 'בוטוקס'
};

const GalleryPage = () => {
  const [filter, setFilter] = useState('all');

  // 1. Process data to resolve image paths using Vite's URL handling
  const processedData = useMemo(() => {
    return galleryData.map(item => ({
      ...item,
      beforeSrc: new URL(`./imgs/before_after/${item.before}`, import.meta.url).href,
      afterSrc: new URL(`./imgs/before_after/${item.after}`, import.meta.url).href,
      displayTitle: CATEGORY_TITLES[item.category] || item.category
    }));
  }, []);

  // 2. Extract unique categories for filter buttons
  const categories = useMemo(() => {
    const uniqueCats = [...new Set(processedData.map(item => item.category))];
    return ['all', ...uniqueCats];
  }, [processedData]);

  // 3. Filter items based on selection
  const filteredItems = useMemo(() => {
    if (filter === 'all') return processedData;
    return processedData.filter(item => item.category === filter);
  }, [filter, processedData]);

  return (
    <div dir="rtl" className="min-h-screen bg-white text-[#2E2A35] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F3F0F7] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-[#9E8FB2] hover:text-[#2E2A35] transition-colors font-medium">
            <ArrowRight size={20} />
            חזרה לדף הבית
          </a>
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
                className={`px-6 py-2 rounded-full border transition-all duration-300 font-medium ${
                  filter === cat
                    ? 'bg-[#A68AC2] border-[#A68AC2] text-white shadow-md'
                    : 'bg-transparent border-[#A68AC2] text-[#A68AC2] hover:bg-[#A68AC2] hover:text-white'
                }`}
              >
                {cat === 'all' ? 'הכל' : CATEGORY_TITLES[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-3"
              >
                <ImageComparison beforeImage={item.beforeSrc} afterImage={item.afterSrc} />
                <p className="text-center text-gray-500 font-medium">{item.displayTitle}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default GalleryPage;