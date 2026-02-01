import React, { useState } from 'react';
import { CheckCheck, User, Eye, X, Instagram, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import reviewsData from './reviews.json';

const TestimonialsSection = () => {
  const [selectedProof, setSelectedProof] = useState(null);

  return (
    <section id="testimonials" className="py-24 bg-[#FDFBFE] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#2E2A35] mb-4">לקוחות מספרות</h2>
          <div className="w-20 h-1 bg-[#A68AC2] mx-auto rounded-full mb-6"></div>
          <p className="text-gray-500 text-lg">המילים החמות שלכן הן כרטיס הביקור הטוב ביותר שלי</p>
        </div>

        {/* Carousel Container */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-12 px-4 md:px-8 scrollbar-hide -mx-4 md:mx-0 before:content-[''] before:w-4 before:shrink-0 after:content-[''] after:w-4 after:shrink-0 md:before:hidden md:after:hidden">
          {reviewsData.map((review) => (
            <div 
              key={review.id} 
              className="snap-center shrink-0 w-[85vw] md:w-[400px] flex flex-col"
            >
              {/* Card Container */}
              <div className="bg-white p-6 rounded-3xl shadow-lg border border-[#F3F0F7] h-full flex flex-col">
                
                {/* Header: Avatar + Name */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-[#F3F0F7] rounded-full flex items-center justify-center text-[#9E8FB2]">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2E2A35] text-lg">{review.name}</h3>
                    <span className="text-xs text-gray-400">{review.date}</span>
                  </div>
                </div>

                {/* WhatsApp Bubble */}
                <div className="bg-[#DCF8C6] p-4 rounded-2xl rounded-tr-none relative shadow-sm flex-grow">
                  {/* Tail Triangle */}
                  <div className="absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-[#DCF8C6] border-r-[10px] border-r-transparent"></div>
                  
                  <p className="text-[#2E2A35] text-base leading-relaxed whitespace-pre-line mb-2">
                    {review.message}
                  </p>
                  
                  {/* Footer: Time + Proof Link */}
                  <div className="mt-3 pt-3 border-t border-black/5 flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                      {/* Stars */}
                      <div className="flex text-yellow-400">
                        {[...Array(review.stars || 5)].map((_, i) => (
                          <Star key={i} size={12} fill="currentColor" />
                        ))}
                      </div>
                      
                      {/* View Original Button */}
                      {review.proof_image && (
                        <button 
                          onClick={() => setSelectedProof(review.proof_image)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#A68AC2] hover:underline transition-colors mt-1"
                        >
                          <Eye size={12} />
                          צפה במקור
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-70">
                      <span className="text-[11px] text-gray-600">{review.time}</span>
                      <CheckCheck size={14} className="text-[#34B7F1]" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* Social Proof Footer */}
        <div className="text-center mt-16">
          <a 
            href="https://www.instagram.com/dr.rinat.ben_tovim?igsh=anR2ZGJ3OGZjZW40" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full border-2 border-[#A68AC2] text-[#A68AC2] font-bold hover:bg-[#A68AC2] hover:text-white transition-all duration-300 group"
          >
            <Instagram size={24} />
            לעוד עשרות המלצות מצולמות בהיילייטס באינסטגרם
          </a>
        </div>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {selectedProof && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedProof(null)}
            >
              <button 
                className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors"
                onClick={() => setSelectedProof(null)}
              >
                <X size={40} />
              </button>
              
              <motion.img 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                src={new URL(selectedProof, import.meta.url).href}
                alt="Original Review Screenshot"
                className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default TestimonialsSection;