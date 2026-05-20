import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import LeftSidebar from '../components/LeftSidebar.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../lib/api.js';

const QUICK_KEYS = [
  'fever',
  'headache',
  'cough',
  'sore_throat',
  'stomach_pain',
  'nausea',
  'vomiting',
  'body_ache',
  'diarrhea',
  'runny_nose',
];

// Keys above map to canonical symptom strings the NLP service understands.
const KEY_TO_SYMPTOM = {
  fever: 'fever',
  headache: 'headache',
  cough: 'cough',
  sore_throat: 'sore throat',
  stomach_pain: 'stomach pain',
  nausea: 'nausea',
  vomiting: 'vomiting',
  body_ache: 'body ache',
  diarrhea: 'diarrhea',
  runny_nose: 'runny nose',
};

const LANG_TO_BCP = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN' };

export default function KioskStart() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [picked, setPicked] = useState(new Set());
  const [listening, setListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [openSession, setOpenSession] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const recognitionRef = useRef(null);
  const interimRef = useRef('');
  const voiceSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    []
  );

  useEffect(() => {
    if (!getToken()) {
      navigate(`/login?next=${encodeURIComponent('/kiosk')}`);
      return;
    }
    (async () => {
      try {
        const res = await apiFetch(
          '/api/machine/sessions?status=in_progress&limit=1'
        );
        setOpenSession((res.items || [])[0] || null);
      } catch (_) {
        /* ignore */
      }
    })();
  }, [navigate]);

  const toggleChip = (k) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const commitInterim = () => {
    const pending = interimRef.current.trim();
    if (pending) {
      setText((prev) => (prev ? `${prev.trim()} ${pending}` : pending));
      setUsedVoice(true);
    }
    interimRef.current = '';
    setVoiceInterim('');
  };

  const startVoice = () => {
    if (!voiceSupported) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = LANG_TO_BCP[i18n.resolvedLanguage] || 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '';
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      if (finalChunk.trim()) {
        setText((prev) =>
          prev ? `${prev.trim()} ${finalChunk.trim()}` : finalChunk.trim()
        );
        setUsedVoice(true);
      }
      interimRef.current = interim;
      setVoiceInterim(interim);
    };
    rec.onerror = () => {
      commitInterim();
      setListening(false);
    };
    rec.onend = () => {
      commitInterim();
      setListening(false);
    };
    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (_) {
      setListening(false);
    }
  };

  const stopVoice = () => {
    commitInterim();
    try {
      recognitionRef.current?.stop();
    } catch (_) {
      /* ignore */
    }
    setListening(false);
  };

  const handleCancelOpen = async () => {
    if (!openSession) return;
    setCancelling(true);
    setError('');
    try {
      await apiFetch(`/api/machine/session/${openSession.sessionId}/cancel`, {
        method: 'POST',
        body: { reason: 'user started fresh consultation' },
      });
      setOpenSession(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleResumeOpen = () => {
    if (!openSession) return;
    if (openSession.type === 'quick') {
      navigate(`/quick/payment/${openSession.sessionId}`);
    } else {
      navigate(`/kiosk/sensor/${openSession.sessionId}`);
    }
  };

  const canStart =
    !openSession &&
    !submitting &&
    (text.trim().length > 0 || picked.size > 0);

  const inputMode = (() => {
    const hasText = text.trim().length > 0;
    if (hasText && usedVoice) return 'mixed';
    if (usedVoice) return 'voice';
    if (hasText) return 'text';
    return 'quick';
  })();

  const handleBegin = async () => {
    if (!canStart) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch('/api/machine/session/start', {
        method: 'POST',
        body: {
          text: text.trim(),
          quickSelections: Array.from(picked).map((k) => KEY_TO_SYMPTOM[k]),
          inputMode,
          language: i18n.resolvedLanguage || 'en',
        },
      });
      navigate(`/kiosk/sensor/${res.data.sessionId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark
    ? 'bg-white/5 ring-white/10'
    : 'bg-white/80 ring-slate-200';
  const inputStyle = isDark
    ? 'bg-white/5 text-white placeholder-white/40 ring-white/10 focus:ring-brand-400'
    : 'bg-white text-slate-900 placeholder-slate-400 ring-slate-200 focus:ring-brand-500';

  return (
    <div className="relative min-h-screen overflow-hidden pb-28">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 backdrop-blur transition-colors ${
                isDark
                  ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20'
                  : 'bg-white/80 text-slate-800 ring-slate-200 hover:bg-white'
              }`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              {t('common.back')}
            </button>
            <div className={`hidden items-center gap-2 md:flex ${textColor}`}>
              <Logo size={36} />
              <div className="text-left">
                <div className="text-sm font-semibold leading-tight">
                  {t('welcome.begin')}
                </div>
                <div className={`text-[11px] ${subText}`}>
                  {t('kiosk.subtitle')}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <LanguageSelector compact />
              <ThemeToggle />
            </div>
            <AccountBox />
          </div>
        </header>

        <main className="flex-1 px-8 md:px-14">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr_280px]">
            <LeftSidebar tipLabel="Wellness Tip" />
            <div>
            {openSession && (
              <section
                className={`mt-2 rounded-2xl p-5 ring-1 backdrop-blur-xl ${
                  isDark
                    ? 'bg-amber-400/10 text-amber-100 ring-amber-300/20'
                    : 'bg-amber-50 text-amber-900 ring-amber-200'
                }`}
              >
                <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {t('kiosk.openSession.title')}
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
                      {openSession.type === 'quick'
                        ? t('kiosk.openSession.bodyQuick')
                        : t('kiosk.openSession.bodyConsult')}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={handleResumeOpen}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/30"
                    >
                      {t('kiosk.openSession.resume')} →
                    </button>
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={handleCancelOpen}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ring-1 disabled:opacity-60 ${
                        isDark
                          ? 'bg-white/10 text-white ring-white/20 hover:bg-white/20'
                          : 'bg-white text-amber-900 ring-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {cancelling ? t('kiosk.openSession.cancelling') : t('kiosk.openSession.cancel')}
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div className={openSession ? 'pointer-events-none opacity-40' : ''}>
              <div className="mt-6 text-center">
                <h1 className={`text-4xl font-bold tracking-tight md:text-5xl ${textColor}`}>
                  {t('kiosk.title')}
                </h1>
                <p className={`mx-auto mt-3 max-w-2xl text-base md:text-lg ${subText}`}>
                  {t('kiosk.subtitle')}
                </p>
              </div>

              {/* Text input */}
              <section className={`mt-8 rounded-3xl p-7 backdrop-blur-xl ring-1 ${cardBg}`}>
                <div className="relative">
                  <textarea
                    value={text + (voiceInterim ? ` ${voiceInterim}` : '')}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (usedVoice) setUsedVoice(false);
                    }}
                    placeholder={t('kiosk.placeholder')}
                    rows={5}
                    className={`w-full resize-none rounded-2xl px-5 py-4 text-lg leading-relaxed ring-1 focus:outline-none focus:ring-2 ${inputStyle}`}
                  />
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={listening ? stopVoice : startVoice}
                      className={`absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-md transition ${
                        listening
                          ? 'bg-red-500 text-white shadow-red-500/40 animate-pulse'
                          : isDark
                          ? 'bg-white text-slate-900 shadow-black/30'
                          : 'bg-slate-900 text-white shadow-slate-900/30'
                      }`}
                      aria-label={listening ? t('kiosk.voiceStop') : t('kiosk.voiceStart')}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="3" width="6" height="12" rx="3" />
                        <path d="M5 11a7 7 0 0014 0M12 18v3" />
                      </svg>
                      {listening ? t('kiosk.voiceListening') : t('kiosk.voiceStart')}
                    </button>
                  )}
                </div>
              </section>

              {/* Quick-select chips */}
              <section className="mt-8">
                <div className={`mb-4 text-sm font-semibold uppercase tracking-widest ${subText}`}>
                  {t('kiosk.quickSelectTitle')}
                </div>
                <div className="flex flex-wrap gap-3">
                  {QUICK_KEYS.map((k) => {
                    const on = picked.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleChip(k)}
                        className={`rounded-full px-5 py-2.5 text-base font-medium ring-1 transition-all ${
                          on
                            ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white ring-transparent shadow shadow-brand-500/30'
                            : isDark
                            ? 'bg-white/5 text-white/80 ring-white/15 hover:bg-white/10'
                            : 'bg-white/80 text-slate-700 ring-slate-200 hover:bg-white'
                        }`}
                      >
                        {t(`kiosk.chips.${k}`)}
                      </button>
                    );
                  })}
                </div>
              </section>

              {error && (
                <div
                  className={`mt-6 rounded-xl px-4 py-3 text-sm ring-1 ${
                    isDark
                      ? 'bg-red-500/15 text-red-100 ring-red-400/30'
                      : 'bg-red-50 text-red-700 ring-red-200'
                  }`}
                >
                  {error}
                </div>
              )}
            </div>
            </div>
            <RightSidebar />
          </div>
        </main>
      </div>

      {/* Sticky bottom CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-xl px-6 py-4 md:px-10"
        style={{
          backgroundColor: isDark ? 'rgba(10,14,22,0.7)' : 'rgba(255,255,255,0.8)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className={`text-xs ${subText}`}>
            {picked.size > 0
              ? t('kiosk.selectedCount', { count: picked.size })
              : text.trim().length > 0
              ? t('kiosk.typed')
              : t('kiosk.hint')}
          </div>
          <button
            type="button"
            disabled={!canStart}
            onClick={handleBegin}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? t('kiosk.submitting') : t('kiosk.begin')}
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
