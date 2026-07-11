import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ContactForm = () => {
  const [status, setStatus] = useState('idle'); // idle, sending, success, error

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('sending');
    
    // 1. Grab the form data
    const formData = new FormData(event.target);
    
    // 2. Append your Web3Forms Access Key
    formData.append("access_key", "c142493b-061a-4dec-900e-026d45e9cbcc");
    
    // Optional: Set a custom email subject
    formData.append("subject", "New Lead from Website!");
    formData.append("from_name", "Website Contact Form");

    // 3. Convert FormData to JSON
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
    <section id="contact" className="py-28 bg-[#F3F0F7] scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 text-center">

        <div className="bg-white p-8 rounded-3xl shadow-lg border border-[#F3F0F7] min-h-[550px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center"
              >
                <h3 className="font-serif text-3xl font-bold text-[#2E2A35] mb-4">תודה רבה!</h3>
                <p className="text-xl text-gray-600">הפרטים נשלחו בהצלחה. ניצור קשר בהקדם.</p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-[#2E2A35] mb-4">צרו קשר</h2>
                <div className="w-20 h-1 bg-[#9E8FB2] mx-auto rounded-full mb-8"></div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* --- Visual Fields --- */}
                  <div>
                    <label className="sr-only">שם מלא</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="שם מלא"
                      className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#9E8FB2] transition-colors text-right"
                    />
                  </div>

                  <div>
                    <label className="sr-only">טלפון</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      pattern="[0-9+\-]*"
                      placeholder="טלפון"
                      className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#9E8FB2] transition-colors text-right"
                    />
                  </div>

                  <div>
                    <label className="sr-only">הודעה</label>
                    <textarea
                      name="message"
                      placeholder="הודעה (אופציונלי)"
                      className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 h-32 focus:outline-none focus:border-[#9E8FB2] transition-colors resize-none text-right"
                    ></textarea>
                  </div>
                  
                  {status === 'error' && (
                     <p className="text-red-500 font-semibold">אירעה שגיאה. אנא נסו שוב.</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full bg-[#9E8FB2] text-white p-4 rounded-full font-bold text-lg hover:bg-[#8D7FA3] transition-all shadow-md active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {status === 'sending' ? 'שולח...' : 'שליחת פרטים'}
                  </button>
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
