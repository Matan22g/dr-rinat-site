import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoveHorizontal, ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react'; // Added icons to import
import { Link } from 'react-router-dom';

// --- Internal Helper for Responsive Images (<picture>) ---
const ResponsiveImage = ({ mobileSrc, desktopSrc, alt, className }) => {
  if (!desktopSrc) {
    // If no desktop version exists, just show the mobile/default one
    return <img src={mobileSrc} alt={alt} className={className} draggable="false" />;
  }
  
  return (
    <picture>
      {/* If screen is wider than 768px - load desktop image */}
      <source media="(min-width: 768px)" srcSet={desktopSrc} />
      {/* Otherwise - load mobile image */}
      <img src={mobileSrc} alt={alt} className={className} draggable="false" />
    </picture>
  );
};

// --- Image Comparison Slider Component ---
export const ImageComparison = ({ 
  beforeImage, afterImage, 
  beforeImageDesktop, afterImageDesktop, // Receiving new props
  title = "image",
  beforeLabel = "לפני", afterLabel = "אחרי" 
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(50);
  const containerRef = useRef(null);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const newPos = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setPosition(newPos);
  }, []);

  const onMouseDown = () => setIsResizing(true);
  
  useEffect(() => {
    const handleGlobalUp = () => setIsResizing(false);
    const handleGlobalMove = (e) => { if (isResizing) handleMove(e.clientX); };
    const handleGlobalTouchMove = (e) => { if (isResizing) handleMove(e.touches[0].clientX); };

    if (isResizing) {
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('touchend', handleGlobalUp);
      window.addEventListener('touchmove', handleGlobalTouchMove);
    }
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
    };
  }, [isResizing, handleMove]);

  return (
    <div 
      ref={containerRef}
      // Dynamic Aspect Ratio: Mobile 4/5, Desktop 16/9 (only if desktop image exists)
      className={`relative w-full rounded-2xl overflow-hidden select-none shadow-lg border border-[#F3F0F7] ${
        beforeImageDesktop ? 'aspect-[4/5] md:aspect-video' : 'aspect-[4/5]'
      }`}
    >
       {/* 1. Base Image (Before) */}
       <div className="absolute inset-0 w-full h-full">
         <ResponsiveImage 
            mobileSrc={beforeImage} 
            desktopSrc={beforeImageDesktop} 
            alt={`Before ${title} treatment`} 
            className="w-full h-full object-cover pointer-events-none" 
         />
       </div>
       
       <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold z-10 transition-opacity duration-300" style={{ opacity: position < 90 ? 1 : 0 }}>
        {beforeLabel}
      </div>

       {/* 2. Overlay Image (After) - Clipped */}
       <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
         <ResponsiveImage 
            mobileSrc={afterImage} 
            desktopSrc={afterImageDesktop} 
            alt={`After ${title} treatment`} 
            className="w-full h-full object-cover" 
         />
         
         <div className="absolute top-4 left-4 bg-[#A68AC2]/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold z-10 transition-opacity duration-300" style={{ opacity: position > 10 ? 1 : 0 }}>
          {afterLabel}
        </div>
       </div>

      {/* Visible Slider Handle (no interaction) */}
       <div 
        className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_10px_rgba(0,0,0,0.3)] pointer-events-none" 
        style={{ left: `${position}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#A68AC2] rounded-full flex items-center justify-center shadow-md border-2 border-white">
          <MoveHorizontal size={20} className="text-white" />
        </div>
      </div>

      {/* --- INVISIBLE HIT AREA for slider activation --- */}
      <div
        className="absolute top-0 bottom-0 z-30"
        style={{
          left: `calc(${position}% - 20px)`, // Center the 40px hit area on the line
          width: '40px',
          cursor: 'col-resize',
          touchAction: 'pan-y', // Allow vertical page scroll, but capture horizontal drag
        }}
        onMouseDown={onMouseDown}
        onTouchStart={() => setIsResizing(true)}
      />
    </div>
  );
};

// --- Main Component: BeforeAfterSection ---
const BeforeAfterSection = ({ images }) => {
  const scrollRef = useRef(null);

  // Logic to scroll the carousel programmatically
  const scroll = (direction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      // Scroll amount: roughly one card width
      const scrollAmount = window.innerWidth < 768 ? window.innerWidth * 0.85 : 500;
      
      if (direction === 'left') {
        current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  return (
    <section id="results" className="py-24 bg-white overflow-hidden relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 px-4">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#2E2A35] mb-4">תוצאות שמדברות בעד עצמן</h2>
          <div className="w-20 h-1 bg-[#A68AC2] mx-auto rounded-full mb-6"></div>
          <p className="text-gray-500 text-lg">
            החליקי את התמונה כדי לראות את השינוי,<br className="md:hidden"/> או השתמשי בחיצים לדפדף
          </p>
        </div>

        {/* --- CAROUSEL WRAPPER --- */}
        <div className="relative group">
          
          {/* Desktop/Tablet Arrow: Right (Previous) */}
          <button 
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-lg text-[#2E2A35] hover:bg-white transition-all hover:scale-110 hidden md:flex"
            aria-label="Scroll Right"
          >
            <ChevronRight size={24} />
          </button>

          {/* Desktop/Tablet Arrow: Left (Next) */}
          <button 
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-lg text-[#2E2A35] hover:bg-white transition-all hover:scale-110 hidden md:flex"
            aria-label="Scroll Left"
          >
            <ChevronLeft size={24} />
          </button>

          {/* The Carousel */}
          <div 
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-12 px-4 md:px-8 scrollbar-hide -mx-4 md:mx-0"
          >
            {/* Spacer for mobile layout */}
            <div className="w-2 shrink-0 md:hidden"></div>

            {images.map((pair, index) => (
              <div 
                key={index} 
                className="snap-center shrink-0 w-[85vw] md:w-[500px] flex flex-col"
              >
                {/* The Image Slider */}
                <div className="shadow-lg rounded-2xl overflow-hidden border border-[#F3F0F7]">
                  <ImageComparison 
                    title={pair.title || pair.displayTitle}
                    beforeImage={pair.beforeSrc || pair.before} 
                    afterImage={pair.afterSrc || pair.after}
                    // --- FIX: Passing the desktop props here ---
                    beforeImageDesktop={pair.beforeDesktopSrc || pair.desktop_before} 
                    afterImageDesktop={pair.afterDesktopSrc || pair.desktop_after} 
                  />
                </div>
                
                {/* SAFE ZONE: Text area is draggable but text is not selectable */}
                <div className="mt-4 text-center select-none py-4 cursor-grab active:cursor-grabbing">
                  <h3 className="font-bold text-[#2E2A35] text-xl">{pair.title || pair.displayTitle}</h3>
                  <p className="text-gray-500 text-sm">{pair.desc || "דפדפי למקרה הבא ->"}</p>
                </div>
              </div>
            ))}
            
            {/* Spacer for mobile layout */}
            <div className="w-2 shrink-0 md:hidden"></div>
          </div>
        </div>

        {/* Mobile Navigation Buttons (Visible only on mobile) */}
        <div className="flex justify-center gap-6 md:hidden -mt-6 mb-8">
           <button 
             onClick={() => scroll('right')} 
             className="bg-[#F3F0F7] p-3 rounded-full text-[#9E8FB2] shadow-sm active:scale-95 border border-[#E5DEED]"
             aria-label="Previous Image"
           >
             <ChevronRight size={24} />
           </button>
           <button 
             onClick={() => scroll('left')} 
             className="bg-[#F3F0F7] p-3 rounded-full text-[#9E8FB2] shadow-sm active:scale-95 border border-[#E5DEED]"
             aria-label="Next Image"
           >
             <ChevronLeft size={24} />
           </button>
        </div>

        <div className="text-center mt-8">
          <Link 
            to="/gallery.html" 
            className="inline-block bg-[#9E8FB2] text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-[#8D7FA3] transition-all active:scale-95 text-lg"
          >
            לצפייה בגלריה המלאה 
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterSection;