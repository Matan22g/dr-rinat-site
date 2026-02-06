import React, { useState, useEffect } from 'react';
import { Menu, X, Calendar, Sparkles, User, ShieldCheck, Heart, Mail, 
  Syringe, 
  Dna, 
  Eye, 
  Droplets,
  Image as ImageIcon } from 'lucide-react'; // Added Image icon
import { motion, AnimatePresence } from 'framer-motion';
import webPro from './imgs/webPro.jpeg';
import webAcd from './imgs/webAcd.JPG';
import ContactForm from './ContactForm';
import BeforeAfterSection from './BeforeAfterSection';
import galleryData from './imgs/before_after/gallery.json';
import TestimonialsSection from './TestimonialsSection';
import LegalModal from './LegalModal';
import { GiLips } from "react-icons/gi";
import ladyFaceSrc from './imgs/icons/lady_face.svg';

// --- 1. Constants ---
const BRAND_COLORS = {
  primary: '#9E8FB2',
  secondary: '#F3F0F7',
  text: '#2E2A35',
  bg: '#FDFBFE',
};

const NAV_LINKS = [
  { name: 'אודות', href: '#about' },
  { name: 'טיפולים', href: '#treatments' },
  { name: 'תוצאות', href: '#results' },
  { name: 'המלצות', href: '#testimonials' },
];

const FaceIcon = ({ size = 24, className }) => (
  <img 
    src={ladyFaceSrc} 
    alt="Face Sculpting" 
    style={{ width: size, height: size }} 
    className={className} 
  />
);

const TREATMENTS = [
  { 
    title: 'פיסול פנים ועיצוב', 
    icon: FaceIcon, 
    desc: 'טיפול שמטרתו להדגיש קווי מתאר, לשפר פרופורציות ולהרים אזורים שצנחו עם הזמן.',
    details: 'טיפול שמטרתו להדגיש קווי מתאר, לשפר פרופורציות ולהרים אזורים שצנחו עם הזמן. מתאים לעצמות לחיים, סנטר, קו לסת, רקות ולעיתים גם קווי קמט עמוקים.\nהמטרה היא יצירת מראה מורם, הרמוני וטבעי, ללא נפח מיותר.\nאני משתמשת בחומצות היאלורוניות של Saypha, עם חומרים ייעודיים לפיסול פנים.\nמדובר בחומר מרים וחזק, שנותן תמיכה טובה לרקמה.\nהחומר מרים אזורים שצריך, מבלי ליצור נפיחויות מיותרות. הטיפול מותאם אישית למבנה הפנים.\nלפי מחקרים, משך ההחזקה לרוב בין 12–18 חודשים ואף יותר.\nהתוצאה - מראה טבעי, מורם ורענן לאורך זמן.'
  },
  { 
    title: 'מילוי ועיצוב שפתיים', 
    icon: GiLips, 
    desc: 'טיפול עדין שמטרתו להדגיש את צורת השפה הטבעית, לשפר סימטריה ולהוסיף נפח בצורה הרמונית.',
    details: 'טיפול עדין שמטרתו להדגיש את צורת השפה הטבעית, לשפר סימטריה ולהוסיף נפח בצורה הרמונית. מתאים לשפתיים דקות, א-סימטריות או לשיפור קווי מתאר.\nהטיפול מאפשר גם ריכוך קמטים עדינים סביב הפה. מבוצע בהתאמה אישית למבנה הפנים ולרצון המטופלת. ללא מראה מוגזם, דגש על תוצאה טבעית.\nאני עובדת עם חומצות היאלורוניות איכותיות של Saypha. חומרים אירופאיים, מאושרי משרד הבריאות.\nפרופיל בטיחות גבוה ומרקם רך.\nלפי מחקרים, התוצאה מחזיקה לרוב בין 9–12 חודשים.\nתוצאות יפות, טבעיות ועמידות לאורך זמן.'
  },
  { 
    title: 'בוטוקס (דיספורט)', 
    icon: Syringe, 
    desc: 'טיפול להפחתת קמטי הבעה ולקבלת מראה רענן וחלק יותר.',
    details: 'טיפול להפחתת קמטי הבעה ולקבלת מראה רענן וחלק יותר.\nמתאים למצח, בין הגבות, צידי העיניים ואזורים נוספים.\nהטיפול מרפה זמנית את פעילות השריר, וכך מונע העמקה של קמטים קיימים והיווצרות קמטים חדשים.\nאני משתמשת ב Dysport. טוקסין סטנדרטי ואיכותי, מאושר משרד הבריאות.\nתחילת השפעה לרוב לאחר 3–7 ימים.\nתוצאה מלאה לאחר כשבועיים.\nמשך ההשפעה לרוב בין 3–5 חודשים.\nהתאמה אישית של אזורים ומינון לפי מבנה הפנים והצורך.'
  },
  { 
    title: 'פולינוקלאוטידים (טיפול סלמון)', 
    icon: Dna, 
    desc: 'טיפול ביולוגי שמטרתו לשקם ולשפר את איכות העור ברמה התאית, בדגש על אזור העיניים.',
    details: 'טיפול ביולוגי שמטרתו לשקם ולשפר את איכות העור ברמה התאית.\nמתאים במיוחד לאזורים בהם העור נהיה דק עם הזמן, בדגש על אזור מתחת לעיניים.\nניתן לבצע גם בשאר אזורי הפנים, אך הדגש העיקרי הוא מתחת לעיניים, שם העור מתייבש ונהיה דק מהר יותר.\nהטיפול מעודד שיקום, אלסטיות ויצירת קולגן. מבוסס על סדרה של שלושה טיפולים.\nלפי מחקרים, האפקט מחזיק לרוב בין 6–12 חודשים לאחר השלמת הסדרה.\nהמטרה - עור חזק יותר, עבה יותר ואיכותי יותר.'
  },
  { 
    title: 'מילוי שקעי עיניים', 
    icon: Eye, 
    desc: 'טיפול ייעודי לשיפור שקעים, כהויות ומראה עייף באזור העדין שמתחת לעיניים.',
    details: 'טיפול שמטרתו לשפר שקעים, כהויות, מראה עייף ומרקם עור באזור שמתחת לעיניים.\nמדובר באזור עדין במיוחד, עם עור דק, כלי דם רבים ורקמה רגישה. בגלל הרגישות, רופאים רבים נמנעים מלטפל באזור זה.\nאני משתמשת ב-Redensity 2, חומר ייעודי לאזור מתחת לעיניים שנחשב לאחד הטובים והבטוחים ביותר, עם פרופיל סיבוכים נמוך במיוחד.\nהחומר נבחר במטרה להפחית סיכונים ולתת תוצאה טבעית ובטוחה.\nמתאים בעיקר לשקעים ולמראה עייף (לא מתאים לעודפי עור משמעותיים או שקיות שומן).\nלפי מחקרים, התוצאה מחזיקה לרוב בין 12–18 חודשים.\nהמטרה - מראה רענן, חיוני וטבעי, ללא נפח מיותר.'
  },
  { 
    title: 'סקין בוסטר', 
    icon: Droplets, 
    desc: 'טיפול להחדרת לחות עמוקה, שיפור מרקם העור והענקת זוהר וגמישות.',
    details: 'טיפול שמטרתו להחדיר לחות עמוקה לעור ולשפר את איכות העור מבפנים.\nהטיפול משפר מרקם, גמישות, זוהר ותחושת רכות בעור. מתאים לעור יבש, עייף או חסר חיוניות.\nניתן לבצע בפנים, בצוואר ובאזורים נוספים לפי הצורך.\nהטיפול מבוסס על סדרה של שלושה טיפולים בהפרשים קבועים, כשהמטרה היא בנייה הדרגתית של איכות העור.\nלפי מחקרים, האפקט מחזיק לרוב בין 6–12 חודשים לאחר השלמת הסדרה.\nהתוצאה - עור רווי בלחות, חיוני ובריא יותר.'
  }
];

const TRUST_ITEMS = [
  { icon: User, label: "רופאה מנוסה" },
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
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
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
  },
  {
    name: 'Mail',
    href: 'mailto:dr.rinatbt@gmail.com',
    icon: Mail
  }
];

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
  forehead: 'טיפול מצח'
};

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [comparisonImages, setComparisonImages] = useState([]);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalSection, setLegalModalSection] = useState('');

  // --- Accessibility Script Loader ---
  useEffect(() => {
    const SCRIPT_ID = 'enable-accessibility-script';

    if (document.getElementById(SCRIPT_ID)) return;

    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1' &&
                         !window.location.hostname.startsWith('192.168');

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.setAttribute('defer', '');

    if (isProduction) {
      script.src = "https://cdn.enable.co.il/licenses/enable-L53855ubcqjuewir-0226-79303/init.js";
    } else {
      script.src = "https://cdn.enable.co.il/licenses/enable-L53855ubcqjuewir-0226-79304/init.js";
    }

    document.body.appendChild(script);

    return () => {
      const existingScript = document.getElementById(SCRIPT_ID);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  // --- Load Gallery Data ---
  useEffect(() => {
    const loadGallery = () => {
      try {
        const featuredItems = galleryData.filter(item => item.featured === true && !item.hidden);
        const items = featuredItems.map(item => ({
          beforeSrc: new URL(`./imgs/before_after/${item.before}`, import.meta.url).href,
          afterSrc: new URL(`./imgs/before_after/${item.after}`, import.meta.url).href,
          beforeDesktopSrc: item.desktop_before ? new URL(`./imgs/before_after/${item.desktop_before}`, import.meta.url).href : null,
          afterDesktopSrc: item.desktop_after ? new URL(`./imgs/before_after/${item.desktop_after}`, import.meta.url).href : null,          
          title: CATEGORY_TITLES[item.category] || item.category, 
          desc: 'החליקי לראות את השינוי'
        }));
        
        setComparisonImages(items);
      } catch (error) {
        console.error('Error loading gallery:', error);
      }
    };

    loadGallery();
  }, []);

  const openLegalModal = (section) => {
    setLegalModalSection(section);
    setIsLegalModalOpen(true);
  };
  
  // --- Scroll Detection for Header Styling ---
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <div dir="rtl" className="min-h-[100dvh] bg-[#FDFBFE] text-[#2E2A35] font-sans selection:bg-[#9E8FB2]/30">
      
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
                  <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-[#9E8FB2] transition-all group-hover:w-full"></span>
                </a>
              ))}
              <button
                onClick={(e) => handleScrollTo(e, '#contact')}
                className="bg-[#9E8FB2] text-white px-6 py-2.5 rounded-full hover:bg-[#8D7FA3] transition-all font-bold shadow-lg shadow-[#9E8FB2]/20 mr-4 active:scale-95 transform">
                צרו קשר
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
                  <button
                    onClick={(e) => handleScrollTo(e, '#contact')}
                   className="w-full bg-[#9E8FB2] text-white px-6 py-4 rounded-full font-bold text-lg shadow-md active:scale-95 transition-transform">
                   צרו קשר
                  </button>
                </div>
                <div className="flex justify-center gap-6 pt-8">
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
            <div className="w-full h-full bg-gray-200 absolute inset-0 animate-pulse" /> 
            <img 
              src={webPro}
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
                <a 
                  href={`https://wa.me/972528327115?text=${encodeURIComponent('היי ד"ר רינת, אשמח לפרטים לגבי ייעוץ...')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#25D366] text-white px-10 py-5 rounded-full font-bold text-xl hover:bg-[#1EBE57] transition-all shadow-xl shadow-[#25D366]/30 flex items-center justify-center gap-3 active:scale-95"
                >
                  <WhatsappIcon size={22} />
                  מעוניינת בעוד פרטים
                </a>
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
            <h2 className="font-serif text-4xl md:text-6xl font-bold text-[#2E2A35] mb-6">הטיפולים שלי</h2>
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

      {comparisonImages.length > 0 && <BeforeAfterSection images={comparisonImages} />}

      <TestimonialsSection />

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
                עם ניסיון רב בתחום הרפואה והאסתטיקה, ד״ר רינת מובילה קו טיפולי המבוסס על דיוק רפואי, בטיחות מקסימלית ותוצאות טבעיות המדגישות את היופי הקיים.
              </p>
              <p>
                המרפאה שלנו חורטת על דגלה שירות אישי ומקצועי, תוך שימוש בחומרים האיכותיים והמאושרים ביותר בעולם הרפואה האסתטית, כדי להבטיח את שביעות רצונך המלאה.
              </p>
            </div>
            
            
          </motion.div>
        </div>
      </section>

      <ContactForm />

      {/* --- Footer --- */}
      <footer className="bg-[#FDFBFE] py-16 text-center border-t border-[#F3F0F7] pb-24 md:pb-16">
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
          <div className="mt-4 text-sm text-gray-400">
            <button onClick={() => openLegalModal('accessibility')} className="underline hover:text-[#9E8FB2] transition-colors mx-2">הצהרת נגישות</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => openLegalModal('terms')} className="underline hover:text-[#9E8FB2] transition-colors mx-2">תנאי שימוש</button>
          </div>
        </div>
      </footer>

      <LegalModal 
        show={isLegalModalOpen} 
        onClose={() => setIsLegalModalOpen(false)} 
        section={legalModalSection} 
      />
      
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
        <WhatsappIcon size={36} />
      </motion.a>

      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-100 flex md:hidden z-40 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.1)] min-h-[5rem] pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={(e) => handleScrollTo(e, '#contact')}
          className="w-1/2 h-20 bg-[#9E8FB2] text-white font-bold text-xl flex items-center justify-center gap-3 active:brightness-90 transition-all"
        >
          <Calendar size={24} />
          השאירי פרטים
        </button>
        <button
          onClick={(e) => handleScrollTo(e, '#results')}
          className="w-1/2 h-20 bg-white text-[#2E2A35] font-bold text-xl active:bg-[#F3F0F7] transition-all flex items-center justify-center gap-3"
        >
          <Sparkles size={24} />
          תוצאות
        </button>
      </div>

    </div>
  );
};

export default App;