import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCheck, User, Eye, X, Star, Quote } from 'lucide-react';
import reviewsData from './reviews.json';

// Pre-resolve all proof image URLs once at module load
const PROOF_IMAGE_URLS = Object.fromEntries(
  reviewsData
    .filter((r) => r.proof_image)
    .map((r) => [r.id, new URL(`./imgs/reviews/${r.proof_image}`, import.meta.url).href])
);

const TestimonialsSection = () => {
  const [selectedProofId, setSelectedProofId] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const openProof = (reviewId) => {
    setSelectedProofId(reviewId);
  };

  const closeProof = () => {
    setSelectedProofId(null);
  };

  useEffect(() => {
    if (selectedProofId === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeProof();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProofId]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = window.innerWidth < 768 ? window.innerWidth * 0.85 : 400;
    const scrollPos = Math.abs(container.scrollLeft);
    const idx = Math.min(reviewsData.length - 1, Math.max(0, Math.round(scrollPos / cardWidth)));
    setActiveIndex(idx);
  }, []);

  const scrollToSlide = (index) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = window.innerWidth < 768 ? window.innerWidth * 0.85 + 24 : 424;
    container.scrollTo({ left: -index * cardWidth, behavior: 'smooth' });
    setActiveIndex(index);
  };

  const isOpen = selectedProofId !== null;

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-[#FDFBFE] overflow-hidden scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10 md:mb-16">
          <span className="text-xs md:text-sm font-bold tracking-[0.2em] text-[#9E8FB2] uppercase block mb-2">חוות דעת מאומתות</span>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2E2A35] mb-4">לקוחות מספרות</h2>
          <div className="w-16 md:w-20 h-1 bg-[#9E8FB2] mx-auto rounded-full mb-4 md:mb-6"></div>
          <p className="text-gray-500 text-base md:text-lg">המילים החמות שלכן הן כרטיס הביקור הטוב ביותר שלי</p>
        </div>

        {/* Carousel Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory gap-5 md:gap-6 pb-6 md:pb-12 px-4 md:px-8 scrollbar-hide -mx-4 md:mx-0 before:content-[''] before:w-2 before:shrink-0 after:content-[''] after:w-2 after:shrink-0 md:before:hidden md:after:hidden"
        >
          {reviewsData.map((review) => (
            <div 
              key={review.id} 
              className="snap-center shrink-0 w-[85vw] md:w-[400px] flex flex-col"
            >
              {/* Card Container */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-md hover:shadow-xl transition-shadow duration-300 border border-[#F3F0F7] h-full flex flex-col relative overflow-hidden">
                
                {/* Subtle Decorative Quote */}
                <Quote size={48} className="absolute top-4 left-4 text-[#F3F0F7] -scale-x-100 pointer-events-none" />

                {/* Header: Avatar + Name + Stars */}
                <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-[#F3F0F7] rounded-2xl flex items-center justify-center text-[#9E8FB2] shrink-0">
                      <User size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2E2A35] text-base md:text-lg leading-tight">{review.name}</h3>
                      <span className="text-xs text-[#9E8FB2] font-medium flex items-center gap-1 mt-0.5">
                        <CheckCheck size={13} className="text-[#25D366]" />
                        מטופלת מאומתת בווטסאפ
                      </span>
                    </div>
                  </div>

                  {/* Stars */}
                  <div className="flex text-amber-400 bg-amber-50/80 px-2.5 py-1 rounded-full border border-amber-100/60 shrink-0">
                    {[...Array(review.stars || 5)].map((_, i) => (
                      <Star key={i} size={12} fill="currentColor" />
                    ))}
                  </div>
                </div>

                {/* Refined Luxury Message Bubble */}
                <div className="bg-[#FAF8FC] border border-[#F3F0F7] p-4 sm:p-5 rounded-2xl rounded-tr-sm relative flex-grow flex flex-col justify-between">
                  <p className="text-[#2E2A35] text-sm sm:text-base leading-relaxed whitespace-pre-line mb-4">
                    {review.message}
                  </p>
                  
                  {/* Footer: Proof Link + Timestamp */}
                  <div className="pt-3 border-t border-[#9E8FB2]/10 flex justify-between items-center gap-2">
                    {review.proof_image ? (
                      <button 
                        type="button"
                        onClick={() => openProof(review.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9E8FB2] bg-white hover:bg-[#9E8FB2] hover:text-white border border-[#9E8FB2]/25 px-3 py-1.5 rounded-full transition-colors shadow-2xs"
                      >
                        <Eye size={13} />
                        לצילום ההודעה המקורי
                      </button>
                    ) : <span />}

                    <div className="flex items-center gap-1 text-gray-400">
                      <span className="text-xs">{review.time}</span>
                      <CheckCheck size={14} className="text-[#34B7F1]" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* Mobile Pagination Dots */}
        {reviewsData.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-2 md:hidden">
            {reviewsData.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToSlide(idx)}
                aria-label={`עבור להמלצה ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeIndex === idx ? 'w-6 bg-[#9E8FB2]' : 'w-2 bg-[#9E8FB2]/25'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Persistent Portal Lightbox with pre-decoded individual image nodes (zero src-swap flash) */}
      {isMounted &&
        createPortal(
          <div
            aria-hidden={!isOpen}
            onClick={closeProof}
            onTouchMove={(e) => {
              if (isOpen) e.preventDefault();
            }}
            className={`fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4 select-none transition-opacity duration-150 ${
              isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={closeProof}
              aria-label="סגור צילום מסך"
              className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors z-10"
            >
              <X size={26} />
            </button>

            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black"
            >
              {reviewsData.map((r) =>
                r.proof_image ? (
                  <img
                    key={r.id}
                    src={PROOF_IMAGE_URLS[r.id]}
                    alt={`Original review from ${r.name}`}
                    loading="eager"
                    decoding="sync"
                    className={`w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-2xl ${
                      selectedProofId === r.id ? 'block' : 'hidden'
                    }`}
                  />
                ) : null
              )}
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};

export default TestimonialsSection;
