import React, { useEffect, useState } from 'react';
import { CalendarDays, KeyRound, Phone, Save, User, Users, X } from 'lucide-react';

const currentYear = new Date().getFullYear();
const birthdayYears = Array.from({ length: 100 }, (_, index) => currentYear - index);
const birthdayMonths = Array.from({ length: 12 }, (_, index) => index + 1);
const birthdayDays = Array.from({ length: 31 }, (_, index) => index + 1);

const splitBirthday = (birthday) => {
  if (!birthday) return { year: '', month: '', day: '' };
  const [year, month, day] = birthday.split('-');
  return { year: year || '', month: month ? String(Number(month)) : '', day: day ? String(Number(day)) : '' };
};

const buildBirthday = (year, month, day) => {
  if (!year && !month && !day) return null;
  if (!year || !month || !day) return 'invalid';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const isValidBirthday = (birthday) => {
  if (!birthday || birthday === 'invalid') return birthday === null;
  const date = new Date(`${birthday}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === birthday;
};

const ProfileDialog = ({ open, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    username: '',
    phone: '',
    classCode: '',
    gender: '',
    birthdayYear: '',
    birthdayMonth: '',
    birthdayDay: ''
  });

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);
      setErrorMsg('');

      try {
        const token = localStorage.getItem('teaching_token');
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '个人信息加载失败。');

        const birthday = splitBirthday(data.birthday);
        if (isMounted) {
          setForm({
            username: data.username || '',
            phone: data.phone || '',
            classCode: data.classCode || '',
            gender: data.gender || '',
            birthdayYear: birthday.year,
            birthdayMonth: birthday.month,
            birthdayDay: birthday.day
          });
        }
      } catch (err) {
        if (isMounted) setErrorMsg(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [open]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((previousForm) => ({ ...previousForm, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.username.trim()) {
      setErrorMsg('用户名不能为空。');
      return;
    }

    if (!form.phone.trim()) {
      setErrorMsg('手机号不能为空。');
      return;
    }

    const birthday = buildBirthday(form.birthdayYear, form.birthdayMonth, form.birthdayDay);
    if (birthday === 'invalid') {
      setErrorMsg('生日如果要填写，请把年、月、日都选完整哦。');
      return;
    }

    if (!isValidBirthday(birthday)) {
      setErrorMsg('这个生日日期不存在，请重新选择一下哦。');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('teaching_token');
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: form.username.trim(),
          phone: form.phone.trim(),
          classCode: form.classCode.trim() || null,
          gender: form.gender || null,
          birthday
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '个人信息保存失败。');

      onSaved(data.user);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border-4 border-white bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.20)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-indigo-200 bg-indigo-100 text-indigo-600">
              <User className="h-6 w-6 stroke-[3px]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">个人信息</h2>
              <p className="mt-1 text-xs font-bold text-slate-400">更新你的账号资料</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
            aria-label="关闭个人信息弹框"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm font-black text-slate-400">正在加载个人信息...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 ml-1 block text-xs font-black text-slate-500">用户名</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="请输入用户名"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 ml-1 block text-xs font-black text-slate-500">手机号</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="请输入可联系的手机号"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 ml-1 block text-xs font-black text-slate-500">班级码（可选）</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Users className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={form.classCode}
                  onChange={(e) => updateField('classCode', e.target.value)}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="如果老师提供了班级码，可以填在这里"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 ml-1 block text-xs font-black text-slate-500">性别（可选）</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex cursor-pointer items-center justify-center rounded-2xl border-2 px-4 py-3 text-sm font-black transition ${
                  form.gender === 'male'
                    ? 'border-sky-400 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-sky-200'
                }`}>
                  <input
                    type="radio"
                    name="profile-gender"
                    value="male"
                    checked={form.gender === 'male'}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className="sr-only"
                  />
                  男
                </label>
                <label className={`flex cursor-pointer items-center justify-center rounded-2xl border-2 px-4 py-3 text-sm font-black transition ${
                  form.gender === 'female'
                    ? 'border-pink-400 bg-pink-50 text-pink-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-pink-200'
                }`}>
                  <input
                    type="radio"
                    name="profile-gender"
                    value="female"
                    checked={form.gender === 'female'}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className="sr-only"
                  />
                  女
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 ml-1 block text-xs font-black text-slate-500">生日（可选）</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <select
                    value={form.birthdayYear}
                    onChange={(e) => updateField('birthdayYear', e.target.value)}
                    className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3 pl-9 pr-2 text-xs font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">年</option>
                    {birthdayYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <select
                  value={form.birthdayMonth}
                  onChange={(e) => updateField('birthdayMonth', e.target.value)}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">月</option>
                  {birthdayMonths.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
                <select
                  value={form.birthdayDay}
                  onChange={(e) => updateField('birthdayDay', e.target.value)}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">日</option>
                  {birthdayDays.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-400"
            >
              <KeyRound className="h-4 w-4" />
              修改密码
            </button>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border-2 border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-200"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl border-b-4 border-indigo-600 bg-indigo-400 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存资料'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileDialog;
