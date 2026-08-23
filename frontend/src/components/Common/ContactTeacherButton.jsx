import { useEffect, useId, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import teacherQrCode from '../../assets/teacher-wechat-qr.webp';

const ContactTeacherButton = () => {
  const { isEnglish } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 active:translate-y-0.5"
        title={isEnglish ? 'Contact Teacher Shi on WeChat' : '添加石老师微信咨询'}
        data-i18n-skip
      >
        <MessageCircle className="h-4 w-4 fill-emerald-100" />
        <span>{isEnglish ? 'Contact' : '联系老师'}</span>
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          data-i18n-skip
        >
          <div
            className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-sm flex-col items-center overflow-y-auto rounded-[1.75rem] bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.38)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              aria-label={isEnglish ? 'Close contact dialog' : '关闭微信咨询弹窗'}
            >
              <X className="h-5 w-5 stroke-[3]" />
            </button>

            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                viewBox="0 0 64 64"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path
                  fill="#16a34a"
                  d="M25.5 13C13.6 13 4 20.4 4 29.5c0 5.1 3.1 9.7 8 12.7L9.7 49l7.9-4a28 28 0 0 0 7.9 1.1c.8 0 1.6 0 2.4-.1a15.3 15.3 0 0 1-2-7.4c0-9.2 8.4-16.6 18.8-16.6h.7C42 16.6 34.5 13 25.5 13Z"
                />
                <circle cx="19" cy="26" r="2.3" fill="white" />
                <circle cx="31" cy="26" r="2.3" fill="white" />
                <path
                  fill="#059669"
                  d="M45 24c-9.3 0-16.8 6-16.8 13.4S35.7 50.8 45 50.8c2.1 0 4.2-.3 6-.9l6.3 3.2-1.8-5.3c3.9-2.5 6.3-6.2 6.3-10.4C61.8 30 54.3 24 45 24Z"
                />
                <circle cx="40" cy="34.5" r="1.8" fill="white" />
                <circle cx="49.5" cy="34.5" r="1.8" fill="white" />
              </svg>
            </div>

            <h2 id={titleId} className="mb-2 text-2xl font-black text-slate-800">
              {isEnglish ? 'Connect on WeChat' : '添加微信沟通'}
            </h2>
            <p id={descriptionId} className="mb-6 text-base font-medium leading-6 text-slate-500">
              {isEnglish
                ? 'For youth AI coding courses, AI-assisted animation courses for teachers, AI coding tokens, or other questions, scan the QR code below to contact Teacher Shi.'
                : (
                  <>
                    需要了解青少年AI编程课，教师动画制作AI编程课，或者购买AI编程token，或有其他咨询和疑问
                    <br />
                    <strong>请微信扫一扫下方二维码联系石老师。</strong>
                  </>
                )}
            </p>

            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-inner">
              <img
                src={teacherQrCode}
                alt={isEnglish ? 'Teacher Shi WeChat QR code' : '石老师微信二维码'}
                className="mx-auto h-48 w-48 rounded-xl object-cover"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full rounded-xl bg-emerald-500 py-3 font-black text-white transition hover:bg-emerald-600 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-emerald-200"
            >
              {isEnglish ? 'Got it' : '好的，我知道了'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ContactTeacherButton;
