import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ChevronRight, Clock, Calendar, ArrowRight } from 'lucide-react';
import articlesData from './data/articles.json';

const ArticleDetail = () => {
    const { slug } = useParams();
    const [content, setContent] = useState('');
    const article = articlesData.find(a => a.slug === slug);
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                // This looks in public/content/articles/[slug].md
                const response = await fetch(`/content/articles/${slug}.md`);
                const text = await response.text();
                setContent(text);
            } catch (error) {
                console.error("Error fetching article:", error);
            }
        };
        fetchArticle();
        window.scrollTo(0, 0);
    }, [slug]);

    if (!article) return <div className="py-40 text-center">המאמר לא נמצא</div>;

    return (
        <div dir="rtl" className="bg-[#FDFBFE] min-h-screen font-sans pb-24 selection:bg-[#9E8FB2]/20">
            <Helmet>
                <title>{`${article.title} | ד"ר רינת בן טובים`}</title>
                <meta name="description" content={article.excerpt} />
            </Helmet>

            <motion.div className="fixed top-0 left-0 right-0 h-1.5 bg-[#9E8FB2] z-[100] origin-right" style={{ scaleX }} />

            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-[#F3F0F7] py-4">
                <div className="max-w-5xl mx-auto px-6 flex justify-between items-center">
                    <Link to="/articles" className="text-xs font-black text-[#9E8FB2] flex items-center gap-1 uppercase tracking-widest">
                        <ChevronRight size={16} /> חזרה למאמרים
                    </Link>
                    <Link to="/" className="font-serif text-lg font-bold text-[#2E2A35]">
                        Dr. Rinat <span className="text-[#9E8FB2] italic font-light">Aesthetics</span>
                    </Link>
                </div>
            </nav>

            <main className="pt-32">
                {/* Article Header */}
                <div className="max-w-4xl mx-auto px-6 mb-16 text-center">
                    <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="inline-block bg-[#9E8FB2]/10 text-[#9E8FB2] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8"
                    >
                        {article.category}
                    </motion.span>
                    <h1 className="font-serif text-4xl md:text-7xl font-bold text-[#2E2A35] leading-[1.1] mb-10">
                        {article.title}
                    </h1>
                    <div className="flex items-center justify-center gap-8 text-gray-400 text-xs font-bold border-y border-[#F3F0F7] py-6 uppercase tracking-widest">
                        <span className="flex items-center gap-2"><Calendar size={14} /> {article.date}</span>
                        <span className="flex items-center gap-2"><Clock size={14} /> {article.readTime} קריאה</span>
                    </div>
                </div>

                {/* Featured Image */}
                <div className="max-w-6xl mx-auto px-4 mb-20">
                    <div className="aspect-video md:aspect-[21/9] rounded-[60px] overflow-hidden shadow-2xl">
                        <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-3xl mx-auto px-6">
                    <article className="prose prose-lg prose-slate max-w-none 
            prose-headings:font-serif prose-headings:text-[#2E2A35] prose-headings:font-bold
            prose-p:text-gray-600 prose-p:leading-[1.8] prose-p:font-light
            prose-strong:text-[#9E8FB2] prose-strong:font-bold
            prose-li:text-gray-600 text-right">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </article>

                    {/* Dr. Rinat Signature CTA */}
                    <div className="mt-24 p-12 bg-white border border-[#F3F0F7] rounded-[48px] shadow-xl text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#9E8FB2]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                        <h3 className="font-serif text-3xl font-bold text-[#2E2A35] mb-6">מעוניינת בייעוץ אישי בנושא זה?</h3>
                        <p className="text-gray-500 mb-10 max-w-md mx-auto font-light">
                            אני כאן כדי לענות על כל שאלה ולעזור לך לבחור את הטיפול הנכון והטבעי ביותר עבורך.
                        </p>
                        <a
                            href={`https://wa.me/972559396093?text=${encodeURIComponent(`היי ד״ר רינת, קראתי את המאמר בנושא ${article.title} ואשמח להתייעץ...`)}`}
                            className="inline-flex items-center gap-3 bg-[#25D366] text-white px-12 py-5 rounded-full font-black text-sm uppercase tracking-widest hover:bg-[#1EBE57] transition-all shadow-lg shadow-[#25D366]/20 active:scale-95"
                        >
                            התייעצות בוואטסאפ
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ArticleDetail;