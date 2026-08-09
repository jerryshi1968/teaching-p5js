import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getAuthHeader, getLanguageHeader } from '../../services/api';

const SmsCodeField = ({ phone, purpose, value, onChange, sendEndpoint, authRequired = false, disabled = false }) => {
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [sliderX, setSliderX] = useState(0);
  const [captchaLoading, setCaptchaLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCountdown((previousCountdown) => Math.max(previousCountdown - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  const requestChallenge = async () => {
    setErrorMsg('');
    setCaptchaLoading(true);

    try {
      const response = await fetch('/api/auth/captcha/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getLanguageHeader() }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '滑块验证加载失败，请重试。');

      setChallenge(data);
      setSliderX(0);
      setCaptchaOpen(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCaptchaLoading(false);
    }
  };

  const sendSmsCode = async (captchaToken) => {
    setSending(true);
    setErrorMsg('');

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...getLanguageHeader(),
        ...(authRequired ? getAuthHeader() : {})
      };
      const response = await fetch(sendEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: phone.trim(),
          purpose,
          captchaToken
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '验证码发送失败，请稍后重试。');

      setCountdown(60);
      setCaptchaOpen(false);
      setChallenge(null);
      setSliderX(0);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendClick = () => {
    if (disabled || sending || countdown > 0) return;

    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setErrorMsg('请输入正确的手机号码。');
      return;
    }

    requestChallenge();
  };

  const verifyCaptcha = async () => {
    if (!challenge) return;

    setSending(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/auth/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getLanguageHeader() },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          x: Number(sliderX)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '滑块验证失败，请重试。');

      await sendSmsCode(data.captchaToken);
    } catch (err) {
      setErrorMsg(err.message);
      setChallenge(null);
      setCaptchaOpen(false);
    } finally {
      setSending(false);
    }
  };

  const buttonText = countdown > 0 ? `${countdown}秒后重发` : sending || captchaLoading ? '发送中...' : '发送验证码';

  const captchaPieceSize = 64;
  const captchaTrackWidth = challenge?.trackWidth || 300;
  const captchaSliderMax = Math.max(captchaTrackWidth - captchaPieceSize, 0);
  const captchaBackgroundStyle = {
    backgroundColor: '#eefdf7',
    backgroundImage: [
      'radial-gradient(circle at 18% 22%, rgba(16,185,129,0.28) 0 10px, transparent 11px)',
      'radial-gradient(circle at 74% 30%, rgba(14,165,233,0.26) 0 14px, transparent 15px)',
      'radial-gradient(circle at 42% 76%, rgba(250,204,21,0.28) 0 12px, transparent 13px)',
      'linear-gradient(135deg, rgba(255,255,255,0.72) 25%, transparent 25% 50%, rgba(255,255,255,0.72) 50% 75%, transparent 75%)',
      'linear-gradient(90deg, rgba(15,23,42,0.07) 1px, transparent 1px)',
      'linear-gradient(0deg, rgba(15,23,42,0.06) 1px, transparent 1px)'
    ].join(', '),
    backgroundSize: '140px 140px, 180px 180px, 150px 150px, 34px 34px, 24px 24px, 24px 24px'
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          placeholder="请输入短信验证码"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleSendClick}
          disabled={disabled || sending || captchaLoading || countdown > 0}
          className="whitespace-nowrap rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {buttonText}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {errorMsg}
        </div>
      )}

      {captchaOpen && challenge && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border-4 border-white bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.24)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-emerald-100 text-emerald-600">
                <ShieldCheck className="h-5 w-5 stroke-[3px]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">滑块验证</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">拖动滑块到缺口位置</p>
              </div>
            </div>

            <div className="relative mb-5 h-32 overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-inner" style={captchaBackgroundStyle}>
              <div className="absolute left-8 top-6 h-12 w-24 rotate-[-10deg] rounded-full bg-white/45" />
              <div className="absolute bottom-5 right-8 h-14 w-28 rotate-12 rounded-full bg-emerald-200/35" />
              <div className="absolute left-1/3 top-16 h-10 w-20 rounded-full bg-sky-200/35" />
              <div
                className="absolute top-8 rounded-2xl border-2 border-dashed border-emerald-600 bg-white/75 shadow-sm"
                style={{ left: `${challenge.targetHint}px`, height: `${captchaPieceSize}px`, width: `${captchaPieceSize}px` }}
              />
              <div
                className="absolute top-8 flex items-center justify-center rounded-2xl border-2 border-emerald-600 bg-emerald-400 text-white shadow-[0_8px_18px_rgba(16,185,129,0.35)]"
                style={{ left: `${sliderX}px`, height: `${captchaPieceSize}px`, width: `${captchaPieceSize}px` }}
              >
                <ShieldCheck className="h-7 w-7 stroke-[3px]" />
              </div>
            </div>

            <input
              type="range"
              min="0"
              max={captchaSliderMax}
              value={sliderX}
              onChange={(e) => setSliderX(e.target.value)}
              className="mb-6 h-10 w-full cursor-pointer appearance-none rounded-full bg-emerald-100 accent-emerald-500 [&::-moz-range-thumb]:h-10 [&::-moz-range-thumb]:w-10 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:shadow-[0_4px_14px_rgba(16,185,129,0.45)] [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:w-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-[0_4px_14px_rgba(16,185,129,0.45)]"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCaptchaOpen(false);
                  setChallenge(null);
                }}
                className="rounded-2xl border-2 border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={verifyCaptcha}
                disabled={sending}
                className="rounded-2xl border-b-4 border-emerald-600 bg-emerald-400 px-5 py-2.5 text-sm font-black text-emerald-950 shadow-sm transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
              >
                {sending ? '验证中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsCodeField;
