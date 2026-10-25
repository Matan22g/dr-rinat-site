import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, MessageSquare, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

const TREATMENT_OPTIONS = [
  'פיסול פנים',
  'עיצוב שפתיים',
  'בוטוקס',
  'מילוי שקעי עיניים',
  'פולינוקלאוטידים / סקין בוסטר',
  'ייעוץ כללי'
];

const ContactForm = () => {
  const [status, setStatus] = useState('idle'); // idle, sending, success, error
  const [selectedTopic, setSelectedTopic] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('sending');
    
    const formData = new FormData(event.target);
    formData.append("access_key", "c142493b-061a-4dec-900e-026d45e9cbcc");
    formData.append("subject", selectedTopic ? `New Lead from Website (${selectedTopic})` : "New Lead from Website!");
    formData.append("from_name", "Website Contact Form");
    if (selectedTopic) {
      formData.append("treatment_interest", selectedTopic);
    }

    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: json
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setSelectedTopic('');
        event.target.reset();
      } else {
        console.error("Web3Forms Error:", result);
        setStatus('error');
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="py-16 md:py-28 bg-[#F3F0F7] scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 text-center">

        <div className="bg-white p-6 sm:p-10 md:p-12 rounded-[32px] md:rounded-[40px] shadow-xl border border-[#F3F0F7] flex flex-col justify-center relative overflow-hidden">
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 bg-[#F3F0F7] text-[#9E8FB2] rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="font-serif text-3xl font-bold text-[#2E2A35] mb-3">תודה רבה!</h3>
                <p className="text-lg text-gray-600 mb-6">הפרטים נשלחו בהצלחה. ניצור איתך קשר בהקדם.</p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="text-sm font-bold text-[#9E8FB2] underline underline-offset-4"
                >
                  שליחת פנייה נוספת
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="text-xs md:text-sm font-bold tracking-[0.2em] text-[#9E8FB2] uppercase block mb-2">תיאום ייעוץ אישי</span>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2E2A35] mb-3">צרו קשר</h2>
                <div className="w-16 md:w-20 h-1 bg-[#9E8FB2] mx-auto rounded-full mb-4"></div>
                <p className="text-gray-500 text-sm sm:text-base mb-6 md:mb-8 max-w-md mx-auto">
                  השאירי פרטים ונחזור אלייך לשיחת היכרות והתאמה אישית
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 text-right">
                  
                  {/* --- Quick Topic Selector Chips --- */}
                  <div>
                    <span className="block text-xs sm:text-sm font-bold text-[#2E2A35] mb-2.5 flex items-center gap-1.5">
                      <Sparkles size={15} className="text-[#9E8FB2]" />
                      באיזה טיפול את מתעניינת? <span className="text-gray-400 font-normal">(אופציונלי)</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {TREATMENT_OPTIONS.map((topic) => {
                        const isActive = selectedTopic === topic;
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => setSelectedTopic(isActive ? '' : topic)}
                            className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all border ${
                              isActive
                                ? 'bg-[#9E8FB2] text-white border-[#9E8FB2] shadow-sm scale-[1.02]'
                                : 'bg-[#FDFBFE] text-[#2E2A35] border-[#F3F0F7] hover:border-[#9E8FB2]/50'
                            }`}
                          >
                            {topic}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* --- Visual Fields --- */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="sr-only">שם מלא</label>
                      <User size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9E8FB2]" />
                      <input
                        type="text"
                        name="name"
                        required
                        placeholder="שם מלא *"
                        className="w-full pr-11 pl-4 py-3.5 sm:py-4 border border-[#F3F0F7] rounded-2xl bg-[#FDFBFE] focus:bg-white focus:outline-none focus:border-[#9E8FB2] focus:ring-2 focus:ring-[#9E8FB2]/15 transition-all text-right text-sm sm:text-base"
                      />
                    </div>

                    <div className="relative">
                      <label className="sr-only">טלפון</label>
                      <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9E8FB2]" />
                      <input
                        type="tel"
                        name="phone"
                        required
                        pattern="[0-9+\-]*"
                        placeholder="טלפון נייד *"
                        className="w-full pr-11 pl-4 py-3.5 sm:py-4 border border-[#F3F0F7] rounded-2xl bg-[#FDFBFE] focus:bg-white focus:outline-none focus:border-[#9E8FB2] focus:ring-2 focus:ring-[#9E8FB2]/15 transition-all text-right text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <label className="sr-only">הודעה</label>
                    <MessageSquare size={18} className="absolute right-4 top-4 text-[#9E8FB2]" />
                    <textarea
                      name="message"
                      placeholder="הודעה או שאלה (אופציונלי)"
                      className="w-full pr-11 pl-4 py-3.5 border border-[#F3F0F7] rounded-2xl bg-[#FDFBFE] focus:bg-white h-28 focus:outline-none focus:border-[#9E8FB2] focus:ring-2 focus:ring-[#9E8FB2]/15 transition-all resize-none text-right text-sm sm:text-base"
                    ></textarea>
                  </div>
                  
                  {status === 'error' && (
                     <p className="text-red-500 text-sm font-semibold text-center">אירעה שגיאה בשליחת הטופס. אנא נסי שוב.</p>
                  )}

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={status === 'sending'}
                      className="w-full bg-[#9E8FB2] text-white py-4 rounded-full font-bold text-base sm:text-lg hover:bg-[#8D7FA3] transition-all shadow-lg shadow-[#9E8FB2]/25 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {status === 'sending' ? 'שולח פרטים...' : 'שליחת פרטים לתיאום'}
                    </button>
                    <p className="text-xs text-gray-400 text-center mt-3 flex items-center justify-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#9E8FB2]" />
                      מענה אישי ודיסקרטי • ללא התחייבות
                    </p>
                  </div>
                </form>
                
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
