import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowLeft, ChevronRight } from 'lucide-react';
import articlesData from './data/articles.json';

const ArticlesIndex = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBFE] font-sans selection:bg-[#9E8FB2]/20">
      <Helmet>
        <title>מרכז הידע | ד"ר רינת בן טובים - רפואה אסתטית</title>
        <meta name="description" content="המדריך המלא לטיפולים אסתטיים: כל מה שצריך לדעת על הזרקות, טיפולי פנים וחידושים בעולם היופי." />
      </Helmet>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-[#F3F0F7] py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link to="/" className="font-serif text-xl md:text-2xl font-bold text-[#2E2A35]">
            Dr. Rinat <span className="text-[#9E8FB2] font-light italic">Aesthetics</span>
          </Link>
          <Link to="/" className="text-sm font-bold text-[#9E8FB2] flex items-center gap-1 hover:opacity-70 transition-opacity">
            <ChevronRight size={18} /> חזרה לדף הבית
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[#9E8FB2] font-bold tracking-[0.3em] text-xs uppercase mb-4 block">Knowledge Center</span>
            <h1 className="font-serif text-5xl md:text-8xl font-bold text-[#2E2A35] mb-8 leading-[0.9]">
              עולם <span className="italic text-[#9E8FB2] font-light">האסתטיקה</span>
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-light">
              טיפים מקצועיים, מחקרים עדכניים ומבט מבפנים על תהליכי הטיפול במרפאה.
            </p>
          </motion.div>
        </header>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {articlesData.map((article, idx) => (
            <motion.article
              key={article.slug}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group"
            >
              <Link to={`/articles/${article.slug}`}>
                <div className="relative aspect-[4/5] rounded-[48px] overflow-hidden mb-8 shadow-sm group-hover:shadow-2xl transition-all duration-700">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  {/* Floating Badge */}
                  <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-5 py-2 rounded-full text-[10px] font-black text-[#9E8FB2] shadow-sm uppercase tracking-widest">
                    {article.category}
                  </div>
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2E2A35]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                <div className="px-4">
                  <div className="flex items-center gap-4 text-gray-400 text-[11px] mb-4 font-bold tracking-tighter">
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {article.date}</span>
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {article.readTime} קריאה</span>
                  </div>
                  
                  <h2 className="font-serif text-3xl font-bold text-[#2E2A35] mb-5 group-hover:text-[#9E8FB2] transition-colors leading-tight">
                    {article.title}
                  </h2>
                  
                  <p className="text-gray-500 text-base leading-relaxed line-clamp-2 mb-8 font-light">
                    {article.excerpt}
                  </p>
                  
                  <div className="inline-flex items-center gap-2 text-[#2E2A35] font-black text-xs uppercase tracking-widest border-b-2 border-[#9E8FB2] pb-1 group-hover:gap-4 transition-all">
                    קראי עוד <ArrowLeft size={14} />
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </main>

      <footer className="bg-[#F3F0F7] py-16 text-center text-gray-400 text-xs font-bold tracking-widest">
        DR. RINAT AESTHETICS © 2026
      </footer>
    </div>
  );
};

export default ArticlesIndex;