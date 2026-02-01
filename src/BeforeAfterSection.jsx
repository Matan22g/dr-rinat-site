import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoveHorizontal, ArrowLeft } from 'lucide-react';

// --- Image Comparison Component ---
const ImageComparison = ({ beforeImage, afterImage, beforeLabel = "לפני", afterLabel = "אחרי" }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(50);
  const containerRef = useRef(null);

  // Handle movement (mouse or touch)
  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    // Calculate percentage (0 to 100)
    const newPos = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setPosition(newPos);
  }, []);

  // Mouse events
  const onMouseDown = () => setIsResizing(true);
  const onMouseUp = () => setIsResizing(false);
  const onMouseMove = (e) => {
    if (isResizing) handleMove(e.clientX);
  };

  // Touch events
  const onTouchStart = () => setIsResizing(true);
  const onTouchEnd = () => setIsResizing(false);
  const onTouchMove = (e) => {
    if (isResizing) handleMove(e.touches[0].clientX);
  };

  // Global event listeners for drag end/move outside container
  useEffect(() => {
    const handleGlobalUp = () => setIsResizing(false);
    const handleGlobalMove = (e) => {
      if (isResizing) handleMove(e.clientX);
    };
    const handleGlobalTouchMove = (e) => {
      if (isResizing) handleMove(e.touches[0].clientX);
    };

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
      className="relative w-full aspect-[4/5] md:aspect-[3/2] rounded-2xl overflow-hidden cursor-col-resize select-none shadow-lg border border-[#F3F0F7]"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      // touch-action: pan-y allows vertical scroll but captures horizontal gestures for the slider
      style={{ touchAction: 'pan-y' }} 
    >
      {/* 1. Base Image (Before) */}
      <img 
        src={beforeImage} 
        alt="Before" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      
      {/* Label for Before (Visible when slider is to the right) */}
      <div 
        className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold z-10 transition-opacity duration-300"
        style={{ opacity: position > 10 ? 1 : 0 }}
      >
        {beforeLabel}
      </div>

      {/* 2. Overlay Image (After) - Clipped */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img 
          src={afterImage} 
          alt="After" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Label for After (Visible when slider is to the left) */}
        <div 
          className="absolute top-4 left-4 bg-[#A68AC2]/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold z-10 transition-opacity duration-300"
          style={{ opacity: position < 90 ? 1 : 0 }}
        >
          {afterLabel}
        </div>
      </div>

      {/* 3. Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.3)]"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#A68AC2] rounded-full flex items-center justify-center shadow-md border-2 border-white">
          <MoveHorizontal size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
};

// --- Main Section ---
const BeforeAfterSection = ({ images }) => {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 px-4">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#2E2A35] mb-4">תוצאות שמדברות בעד עצמן</h2>
          <div className="w-20 h-1 bg-[#A68AC2] mx-auto rounded-full mb-6"></div>
          <p className="text-gray-500 text-lg">החליקי את הסמן כדי לראות את השינוי</p>
        </div>

        {/* Carousel Container with Scroll Snap */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-12 px-4 md:px-8 scrollbar-hide -mx-4 md:mx-0 before:content-[''] before:w-4 before:shrink-0 after:content-[''] after:w-4 after:shrink-0 md:before:hidden md:after:hidden">
          {images.map((pair, index) => (
            <div 
              key={index} 
              className="snap-center shrink-0 w-[85vw] md:w-[500px] flex flex-col"
            >
              <ImageComparison 
                beforeImage={pair.before} 
                afterImage={pair.after} 
              />
              <div className="mt-4 text-center">
                <h3 className="font-bold text-[#2E2A35] text-xl">{pair.title}</h3>
                <p className="text-gray-500 text-sm">{pair.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button className="inline-flex items-center gap-2 text-[#A68AC2] font-bold text-lg hover:text-[#8D7FA3] transition-colors group">
            לגלריה המלאה
            <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterSection;