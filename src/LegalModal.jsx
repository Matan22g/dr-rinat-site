import React, { useEffect, useRef } from 'react';

const legalContent = {
  accessibility: {
    title: "הצהרת נגישות",
    content: "ד״ר רינת אסתטיקה רואה חשיבות עליונה בהנגשת האתר לאנשים עם מוגבלויות. בוצעו באתר התאמות הכוללות ניווט מקלדת, תמיכה בקוראי מסך, ניגודיות צבעים וטקסט חלופי לתמונות. אם נתקלתם בקושי בגלישה, ניתן לפנות במייל: dr.rinatbt@gmail.com."
  },
  terms: {
    title: "תנאי שימוש והסרת אחריות",
    content: "המידע המופיע באתר זה הינו למטרות אינפורמטיביות בלבד ואינו מהווה ייעוץ רפואי, חוות דעת מקצועית או תחליף להתייעצות עם רופא מומחה. אין להסתמך על המידע באתר לצורך אבחון או טיפול בבעיה רפואית. תמונות 'לפני ואחרי' המוצגות באתר הן להמחשה בלבד; התוצאות משתנות ממטופלת למטופלת ואין התחייבות לתוצאה זהה."
  },
  privacy: {
    title: "מדיניות פרטיות",
    content: "הפרטים האישיים שתשאירי בטופס צור קשר יישמרו במאגר המידע של המרפאה וישמשו אך ורק לצורך חזרה אליך ותיאום תור. המידע לא יועבר לצד שלישי ללא אישור."
  }
};

const LegalModal = ({ show, onClose, section }) => {
  const modalRef = useRef();

  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleKeydown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = 'unset';
    };
  }, [show, onClose]);

  if (!show) {
    return null;
  }

  const sectionsToShow = section ? [section] : ['accessibility', 'terms', 'privacy'];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl m-4 max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">מידע משפטי</h2>
          <button 
            onClick={onClose} 
            className="text-black text-2xl font-bold"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {sectionsToShow.map(key => (
            <div key={key} className="mb-6">
              <h3 className="text-lg font-bold mb-2">{legalContent[key].title}</h3>
              <p className="text-base text-gray-700">{legalContent[key].content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LegalModal;