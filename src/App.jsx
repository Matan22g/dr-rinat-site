import React, { useState, useEffect } from 'react';
import { Menu, X, Phone, Calendar, Star, Sparkles, User, ShieldCheck, Heart, MessageCircle, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import webPro from './webPro.jpeg';
import webAcd from './webAcd.JPG';
import ContactForm from './ContactForm';

// --- 1. Constants (Moved outside component to prevent re-creation) ---
const BRAND_COLORS = {
  primary: '#9E8FB2',
  secondary: '#F3F0F7',
  text: '#2E2A35',
  bg: '#FDFBFE',
};

const NAV_LINKS = [
  { name: 'אודות', href: '#about' },
  { name: 'טיפולים', href: '#treatments' },
  { name: 'המלצות', href: '#testimonials' },
  { name: 'צור קשר', href: '#contact' },
];

const TREATMENTS = [
  { 
    title: 'פיסול פנים ועיצוב', 
    icon: Sparkles, 
    desc: 'הדגשת תווי פנים, עיצוב קו לסת ועצמות לחיים בשיטות המתקדמות ביותר למראה הרמוני.',
    details: 'תהליך פיסול הפנים מתבצע באמצעות חומרי מילוי איכותיים (חומצה היאלורונית) המותאמים אישית למבנה הפנים שלך. הטיפול מאפשר להדגיש את עצמות הלחיים, לחדד את קו הלסת ולשפר את הפרופיל, תוך שמירה על מראה טבעי ולא "עשוי". התוצאה מיידית ונשמרת לאורך זמן.'
  },
  { 
    title: 'הזרקות אסתטיות', 
    icon: Heart, 
    desc: 'טשטוש קמטי הבעה והחזרת נפחים שאבדו עם השנים, תוך שמירה על הבעה טבעית.',
    details: 'שימוש בבוטוקס ובחומרי מילוי לטיפול בקמטים דינמיים (מצח, צידי העיניים) וקמטים סטטיים. המטרה היא לא "להקפיא" את הפנים, אלא לרענן את המראה, לפתוח את העיניים ולהחזיר לעור את החיוניות שאבדה לו, הכל במינון מדויק ובטוח.'
  },
  { 
    title: 'חידוש ושיפור מרקם העור', 
    icon: Star, 
    desc: 'טיפולי מזותרפיה וסקין-בוסטרס להזנה עמוקה, זוהר ורעננות של עור הפנים.',
    details: 'סדרת טיפולים שמטרתה לשפר את איכות העור מבפנים. באמצעות החדרת ויטמינים, מינרלים ולחות עמוקה, העור מקבל "בוסט" של זוהר (Glow), הופך לגמיש יותר, והמרקם משתפר פלאים. מצוין לפני אירועים או כטיפול תחזוקה שוטף.'
  },
];

const TRUST_ITEMS = [
  { icon: User, label: "צוות רפואי מנוסה" },
  { icon: ShieldCheck, label: "חומרי טיפול מובילים" },
  { icon: Sparkles, label: "תוצאות טבעיות" },
  { icon: Heart, label: "יחס אישי ומקצועי" }
];

// --- Social Icons Components ---
const InstagramIcon = ({ size = 24, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ size = 24, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const TiktokIcon = ({ size = 24, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const WhatsappIcon = ({ size = 24, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M16.6 14c-.2-.2-.5-.2-.7 0l-1.3 1.3c-.2.2-.5.2-.7 0-1.5-1.5-2.5-2.5-4-4-.2-.2-.2-.5 0-.7l1.3-1.3c.2-.2.2-.5 0-.7l-2-2c-.2-.2-.5-.2-.7 0l-1.3 1.3c-.5.5-.5 1.3 0 1.8 2.5 2.5 5.5 5.5 8 8 .5.5 1.3.5 1.8 0l1.3-1.3c.2-.2.2-.5 0-.7l-2-2z" />
  </svg>
);

const SOCIAL_LINKS = [
  { 
    name: 'Instagram', 
    href: 'https://www.instagram.com/dr.rinat.ben_tovim?igsh=anR2ZGJ3OGZjZW40',
    icon: InstagramIcon
  },
  { 
    name: 'TikTok', 
    href: 'https://vm.tiktok.com/ZS914c7urVaYS-ubEPV/',
    icon: TiktokIcon
  },
  { 
    name: 'Facebook', 
    href: 'https://www.facebook.com/share/1AR4ZHCoSX/',
    icon: FacebookIcon
  },
  { 
    name: 'WhatsApp', 
    href: 'https://wa.me/972528327115',
    icon: WhatsappIcon
  }
];

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState(null);

  // --- 2. Scroll Detection for Header Styling ---
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- 3. Smooth Scroll Handler ---
  const handleScrollTo = (e, href) => {
    e.preventDefault();
    
    if (isMenuOpen) {
      setIsMenuOpen(false);
      setTimeout(() => {
        const element = document.querySelector(href);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      const element = document.querySelector(href);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    // Added scroll-smooth to HTML (if supported) or handled via JS
    <div dir="rtl" className="min-h-screen bg-[#FDFBFE] text-[#2E2A35] font-sans selection:bg-[#9E8FB2]/30">
      
      {/* --- Header --- */}
      <header 
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled || isMenuOpen
            ? 'bg-[#FDFBFE]/95 backdrop-blur-md border-b border-[#F3F0F7] shadow-sm py-0' 
            : 'bg-transparent py-2'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={(e) => handleScrollTo(e, '#hero')}>
              <span className="font-serif text-2xl md:text-3xl font-bold text-[#2E2A35] tracking-tight">
                Dr. Rinat <span className="text-[#9E8FB2] font-light italic">Aesthetics</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8 space-x-reverse items-center">
              {NAV_LINKS.map((link) => (
                <a 
                  key={link.name} 
                  href={link.href} 
                  onClick={(e) => handleScrollTo(e, link.href)}
                  className="text-[#2E2A35] hover:text-[#9E8FB2] transition-colors font-medium text-lg relative group"
                >
                  {link.name}
                  {/* Hover Underline Effect */}
                  <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-[#9E8FB2] transition-all group-hover:w-full"></span>
                </a>
              ))}
              <button className="bg-[#9E8FB2] text-white px-6 py-2.5 rounded-full hover:bg-[#8D7FA3] transition-all font-bold shadow-lg shadow-[#9E8FB2]/20 mr-4 active:scale-95 transform">
                תיאום ייעוץ
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="text-[#2E2A35] p-2 focus:outline-none hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={30} /> : <Menu size={30} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#FDFBFE] border-b border-[#F3F0F7] overflow-hidden absolute w-full shadow-xl right-0 top-full"
            >
              <div className="px-4 pt-2 pb-8 space-y-2">
                {NAV_LINKS.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.href} 
                    onClick={(e) => handleScrollTo(e, link.href)}
                    className="block px-4 py-4 text-xl font-medium text-[#2E2A35] hover:bg-[#F3F0F7] rounded-xl transition-colors"
                  >
                    {link.name}
                  </a>
                ))}
                <div className="pt-6 px-4">
                  <button className="w-full bg-[#9E8FB2] text-white px-6 py-4 rounded-full font-bold text-lg shadow-md active:scale-95 transition-transform">
                    תיאום ייעוץ אישי
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* --- HERO SECTION --- */}
      <section id="hero" className="relative pt-20 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between min-h-[auto] md:min-h-[85vh]">
          
          {/* 1. IMAGE SIDE */}
          <div className="relative w-full h-[70vh] md:h-[85vh] md:w-[45%] order-1">
            {/* Placeholder for when you don't have the image file locally for this review */}
            <div className="w-full h-full bg-gray-200 absolute inset-0 animate-pulse" /> 
            <img 
              src={webPro} // Restore your local image here
              alt="Dr. Rinat Professional" 
              className="w-full h-full object-cover object-top shadow-lg md:shadow-none relative z-10"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBFE] via-transparent to-transparent md:hidden opacity-90 z-20"></div>
          </div>

          {/* 2. TEXT SIDE */}
          <div className="relative z-10 flex flex-col justify-center px-6 py-12 md:py-0 md:px-20 bg-[#FDFBFE] md:w-[55%] order-2 text-center md:text-right">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-[#9E8FB2] font-bold tracking-[0.2em] text-sm mb-4 uppercase">רפואה אסתטית מתקדמת</h2>
              <h1 className="font-serif text-5xl md:text-7xl font-bold text-[#2E2A35] leading-[1.1] mb-6">
                להדגיש את <br/>
                <span className="italic text-[#9E8FB2]">היופי הטבעי</span> שלך
              </h1>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-lg mx-auto md:mx-0">
                טיפולים מותאמים אישית המשלבים ידע רפואי רחב עם עין אומנותית, לתוצאות הרמוניות וזוהרות שנשמרות לאורך זמן.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-5 justify-center md:justify-start">
                <button className="bg-[#9E8FB2] text-white px-10 py-5 rounded-full font-bold text-xl hover:bg-[#8D7FA3] transition-all shadow-xl shadow-[#9E8FB2]/30 flex items-center justify-center gap-3 active:scale-95">
                  <Calendar size={22} />
                  תיאום תור אונליין
                </button>
                <button 
                   onClick={(e) => handleScrollTo(e, '#treatments')}
                   className="border-2 border-[#9E8FB2] text-[#9E8FB2] px-10 py-5 rounded-full font-bold text-xl hover:bg-[#F3F0F7] transition-all active:scale-95"
                >
                  לכל הטיפולים
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- Trust Grid --- */}
      <section className="bg-[#F3F0F7] py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
            {TRUST_ITEMS.map((item, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center text-center gap-5 group"
              >
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-[#9E8FB2] shadow-sm border border-[#9E8FB2]/10 transition-transform group-hover:scale-110 duration-300 group-hover:shadow-md">
                  <item.icon size={44} strokeWidth={1} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#2E2A35] leading-tight">{item.label}</h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Treatments Grid --- */}
      <section id="treatments" className="py-28 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="font-serif text-4xl md:text-6xl font-bold text-[#2E2A35] mb-6">הטיפולים שלנו</h2>
            <div className="w-24 h-1 bg-[#9E8FB2] mx-auto rounded-full"></div>
            <p className="mt-8 text-xl text-gray-500 max-w-2xl mx-auto">מגוון פתרונות אסתטיים מתקדמים המותאמים אישית למבנה הפנים ולצרכים שלך.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {TREATMENTS.map((t, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -12 }}
                onClick={() => setSelectedTreatment(t)}
                className="group p-10 bg-[#FDFBFE] rounded-[40px] border border-[#F3F0F7] shadow-sm hover:shadow-2xl transition-all duration-500 text-center cursor-pointer"
              >
                <div className="w-20 h-20 bg-[#F3F0F7] rounded-3xl flex items-center justify-center text-[#9E8FB2] mx-auto mb-8 group-hover:bg-[#9E8FB2] group-hover:text-white transition-colors duration-500">
                  <t.icon size={36} />
                </div>
                <h3 className="font-serif text-3xl font-bold mb-6 text-[#2E2A35]">{t.title}</h3>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">{t.desc}</p>
                <span className="text-[#9E8FB2] font-bold text-lg group-hover:underline underline-offset-8 decoration-2">קראי עוד ←</span>
              </motion.div>
            ))}
          </div>

          {/* --- Treatment Modal --- */}
          <AnimatePresence>
            {selectedTreatment && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setSelectedTreatment(null)}
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-[30px] p-8 md:p-12 max-w-2xl w-full relative shadow-2xl text-center"
                >
                  <button 
                    onClick={() => setSelectedTreatment(null)}
                    className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={32} />
                  </button>
                  
                  <div className="w-20 h-20 bg-[#F3F0F7] rounded-3xl flex items-center justify-center text-[#9E8FB2] mx-auto mb-6">
                    <selectedTreatment.icon size={40} />
                  </div>
                  <h3 className="font-serif text-3xl md:text-4xl font-bold text-[#2E2A35] mb-6">{selectedTreatment.title}</h3>
                  <p className="text-gray-600 text-lg leading-relaxed mb-10">{selectedTreatment.details}</p>
                  
                  <button 
                    onClick={() => {
                      const message = `היי ד״ר רינת, ראיתי באתר את הטיפול ${selectedTreatment.title} ואשמח לקבל פרטים נוספים.`;
                      window.open(`https://wa.me/972528327115?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="bg-[#25D366] text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-[#1EBE57] transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-3 mx-auto w-full md:w-auto"
                  >
                    <WhatsappIcon size={24} />
                    אני מתעניינת בטיפול זה
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* --- About Section --- */}
      <section id="about" className="py-28 bg-[#2E2A35] text-white relative overflow-hidden scroll-mt-20">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#9E8FB2] opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute -inset-4 border-2 border-[#9E8FB2]/30 rounded-[40px] translate-x-4 translate-y-4 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-500"></div>
            <img 
              src={webAcd}
              alt="Dr. Rinat Professional" 
              loading="lazy"
              className="rounded-[40px] shadow-2xl relative z-10 w-full aspect-[4/5] object-cover grayscale hover:grayscale-0 transition-all duration-1000"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-6xl font-bold mb-10 leading-tight">ד״ר רינת - מצוינות <br/><span className="text-[#9E8FB2]">ברפואה אסתטית</span></h2>
            <div className="space-y-6 text-xl text-gray-300 leading-relaxed font-light">
              <p>
                עם ניסיון רב שנים בתחום הרפואה והאסתטיקה, ד״ר רינת מובילה קו טיפולי המבוסס על דיוק רפואי, בטיחות מקסימלית ותוצאות טבעיות המדגישות את היופי הקיים.
              </p>
              <p>
                המרפאה שלנו חורטת על דגלה שירות אישי ומקצועי, תוך שימוש בחומרים האיכותיים והמאושרים ביותר בעולם הרפואה האסתטית, כדי להבטיח את שביעות רצונך המלאה.
              </p>
            </div>
            
            <div className="mt-12 pt-12 border-t border-white/10">
              <a href="mailto:dr.rinatbt@gmail.com" className="flex items-center gap-5 group cursor-pointer">
                <div className="w-12 h-12 rounded-full bg-[#9E8FB2]/20 flex items-center justify-center text-[#9E8FB2] group-hover:bg-[#9E8FB2] group-hover:text-white transition-colors">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">דואר אלקטרוני</p>
                  <p className="text-xl font-bold group-hover:text-[#9E8FB2] transition-colors">dr.rinatbt@gmail.com</p>
                </div>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <ContactForm />

      {/* --- Footer --- */}
      <footer className="bg-[#FDFBFE] py-16 text-center border-t border-[#F3F0F7] pb-36 md:pb-16">
        <div className="max-w-7xl mx-auto px-4">
          <span className="font-serif text-3xl font-bold text-[#2E2A35]">
            Dr. Rinat <span className="text-[#9E8FB2]">Aesthetics</span>
          </span>
          <div className="flex flex-wrap justify-center gap-8 mt-10 mb-10">
            {NAV_LINKS.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                onClick={(e) => handleScrollTo(e, link.href)}
                className="text-gray-500 hover:text-[#9E8FB2] transition-colors font-medium"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Social Media Icons */}
          <div className="flex justify-center gap-6 mb-10">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-white border border-[#9E8FB2]/20 flex items-center justify-center text-[#9E8FB2] hover:bg-[#9E8FB2] hover:text-white transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1"
                aria-label={social.name}
              >
                <social.icon size={20} />
              </a>
            ))}
          </div>

          <p className="text-gray-400 text-sm">© 2026 כל הזכויות שמורות לד״ר רינת - רפואה אסתטית | עוצב באהבה</p>
        </div>
      </footer>
      
      {/* --- Floating Action Elements --- */}
      <motion.a 
        href="https://wa.me/972528327115"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        className="fixed z-50 bg-[#25D366] text-white p-5 rounded-full shadow-2xl bottom-24 right-6 md:bottom-8 md:right-8 flex items-center justify-center"
        aria-label="Contact via WhatsApp"
      >
        <MessageCircle size={36} fill="white" />
      </motion.a>

      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-100 flex md:hidden z-40 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.1)] h-20">
        <a 
          href="tel:0528327115"
          className="w-1/2 h-full bg-[#9E8FB2] text-white font-bold text-xl flex items-center justify-center gap-3 active:brightness-90 transition-all"
        >
          <Phone size={24} />
          שיחה
        </a>
        <button 
          onClick={() => {
             // Logic to open modal or scroll to contact form
             window.open('https://wa.me/972528327115', '_blank');
          }}
          className="w-1/2 h-full bg-white text-[#2E2A35] font-bold text-xl active:bg-[#F3F0F7] transition-all"
        >
          הודעה
        </button>
      </div>

    </div>
  );
};

export default App;