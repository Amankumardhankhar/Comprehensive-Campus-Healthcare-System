import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import MedicineArt from '../components/MedicineArt.jsx';
import LeftSidebar from '../components/LeftSidebar.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../lib/api.js';

export default function KioskResult() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNurseView, setShowNurseView] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      navigate(`/login?next=${encodeURIComponent(`/kiosk/result/${sessionId}`)}`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/machine/session/${sessionId}`);
        if (!cancelled) {
          setSession(res.data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark ? 'bg-white/5 ring-white/10' : 'bg-white/85 ring-slate-200';

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <MedicalBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className={`flex items-center gap-3 ${textColor}`}>
            <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 11-6.2-8.55" />
            </svg>
            <span className="text-sm">{t('kioskResult.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <MedicalBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className={`max-w-md rounded-2xl p-6 text-center ring-1 ${cardBg}`}>
            <div className={`text-lg font-semibold ${textColor}`}>
              {t('kioskResult.loadErrorTitle')}
            </div>
            <div className={`mt-1 text-sm ${subText}`}>{error || t('kioskResult.loadErrorBody')}</div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2 text-sm font-semibold text-white"
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const decision = session.decision?.action || 'CONSULT_DOCTOR';
  const isDispense = decision === 'DISPENSE';

  const ai = session.aiResults || {};
  const disease = ai.disease || {};
  const risk = ai.risk || { level: 'LOW' };
  const anomaly = ai.anomaly || {};
  const image = ai.image || {};
  const recommendations = ai.recommendation || [];
  const sensor = session.sensorData || {};
  const symptoms = session.symptoms || [];
  const reasons = session.decision?.reasons || [];
  const totalAmount = session.payment?.amount || 0;

  const buildShareText = () => {
    const lines = [
      'Campus Healthcare Kiosk — referral',
      `Date: ${new Date(session.createdAt).toLocaleString('en-IN')}`,
      session.user?.name ? `Patient: ${session.user.name}` : '',
      disease.disease
        ? `AI suggests: ${disease.disease}${typeof disease.confidence === 'number' ? ` (${Math.round(disease.confidence * 100)}%)` : ''}`
        : '',
      `Risk: ${(risk.level || 'LOW')}`,
      symptoms.length ? `Symptoms: ${symptoms.slice(0, 8).join(', ')}` : '',
      sensor.heartRate || sensor.temperature || sensor.spO2
        ? `Vitals — HR ${sensor.heartRate ?? '—'}bpm, Temp ${sensor.temperature ?? '—'}°F, SpO2 ${sensor.spO2 ?? '—'}%`
        : '',
      '',
      'Please visit the campus health centre.',
      'VIT Health Centre · 1st Floor, Dr. A.L. Mudaliar Block',
      'Intercom: 2000 / 2238 / 2217',
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(buildShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleDone = async () => {
    if (!isDispense) {
      try {
        await apiFetch(`/api/machine/session/${sessionId}/acknowledge-referral`, { method: 'POST' });
      } catch {
        // non-fatal — still navigate home
      }
    }
    navigate('/');
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-32">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className={`flex items-center gap-3 ${textColor}`}>
            <Logo size={40} />
            <div>
              <div className="text-base font-semibold leading-tight">
                {t('kioskResult.title')}
              </div>
              <div className={`text-xs ${subText}`}>
                {isDispense ? t('kioskResult.dispense.status') : t('kioskResult.refer.status')}
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
          <div className="grid gap-8 lg:grid-cols-[260px_1fr_260px] items-start">
            <LeftSidebar tipLabel="Health Tip" />
            <div className="min-w-0">
            {/* Hero banner */}
            <section
              className={`relative overflow-hidden rounded-3xl p-6 ring-1 backdrop-blur-xl md:p-8 ${
                isDispense
                  ? isDark
                    ? 'bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent ring-emerald-400/30'
                    : 'bg-gradient-to-br from-emerald-100 via-teal-50 to-white ring-emerald-200'
                  : isDark
                  ? 'bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent ring-amber-400/30'
                  : 'bg-gradient-to-br from-amber-100 via-orange-50 to-white ring-amber-200'
              }`}
            >
              <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                      isDispense
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                        : 'bg-amber-500 text-white shadow-lg shadow-amber-500/40'
                    }`}
                  >
                    {isDispense ? (
                      <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v6M12 14h.01" />
                        <path d="M10.3 3.5L2.3 17a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-13.5a2 2 0 00-3.4 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h1 className={`text-2xl font-bold md:text-3xl ${textColor}`}>
                      {isDispense ? t('kioskResult.dispense.heroTitle') : t('kioskResult.refer.heroTitle')}
                    </h1>
                    <p className={`mt-1 max-w-xl text-sm md:text-base ${subText}`}>
                      {isDispense ? t('kioskResult.dispense.heroSub') : t('kioskResult.refer.heroSub')}
                    </p>
                  </div>
                </div>
                <RiskPill level={risk.level} isDark={isDark} t={t} />
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* LEFT: AI findings */}
              <section className="space-y-4">
                {/* Predicted condition */}
                <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                  <div className={`text-[11px] uppercase tracking-widest ${subText}`}>
                    {t('kioskResult.predictedCondition')}
                  </div>
                  <div className={`mt-1 flex items-baseline justify-between gap-3`}>
                    <div className={`text-xl font-bold capitalize ${textColor}`}>
                      {disease.disease || t('kioskResult.inconclusive')}
                    </div>
                    {typeof disease.confidence === 'number' && (
                      <div className={`text-sm font-semibold tabular-nums ${subText}`}>
                        {Math.round(disease.confidence * 100)}%
                      </div>
                    )}
                  </div>
                  {typeof disease.confidence === 'number' && (
                    <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        style={{ width: `${Math.min(100, Math.max(6, disease.confidence * 100))}%` }}
                      />
                    </div>
                  )}
                  {disease.alternatives?.length > 0 && (
                    <div className="mt-3">
                      <div className={`text-[10px] uppercase tracking-widest ${subText}`}>
                        {t('kioskResult.alternatives')}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {disease.alternatives.slice(0, 4).map((a, i) => (
                          <span
                            key={i}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ring-1 ${
                              isDark ? 'bg-white/5 text-white/80 ring-white/10' : 'bg-white text-slate-700 ring-slate-200'
                            }`}
                          >
                            {a.disease || a.name || a}
                            {typeof a.confidence === 'number' && (
                              <span className={`ml-1 ${subText}`}>{Math.round(a.confidence * 100)}%</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Symptoms detected */}
                {symptoms.length > 0 && (
                  <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                    <div className={`text-[11px] uppercase tracking-widest ${subText}`}>
                      {t('kioskResult.symptomsDetected')}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {symptoms.slice(0, 12).map((s, i) => (
                        <span
                          key={i}
                          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ${
                            isDark ? 'bg-brand-400/15 text-brand-200 ring-brand-400/30' : 'bg-brand-50 text-brand-700 ring-brand-200'
                          }`}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vitals snapshot */}
                {(sensor.heartRate || sensor.temperature || sensor.spO2 || sensor.respirationRate) && (
                  <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <div className={`text-[11px] uppercase tracking-widest ${subText}`}>
                        {t('kioskResult.vitals')}
                      </div>
                      {anomaly.isAnomalous && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            isDark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t('kioskResult.anomalyFlagged')}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <VitalMini label={t('kioskResult.hr')} value={sensor.heartRate} unit="bpm" isDark={isDark} textColor={textColor} subText={subText} />
                      <VitalMini label={t('kioskResult.temp')} value={sensor.temperature} unit="°F" isDark={isDark} textColor={textColor} subText={subText} />
                      <VitalMini label={t('kioskResult.spo2')} value={sensor.spO2} unit="%" isDark={isDark} textColor={textColor} subText={subText} />
                      <VitalMini label={t('kioskResult.resp')} value={sensor.respirationRate} unit="rpm" isDark={isDark} textColor={textColor} subText={subText} />
                    </div>
                    {anomaly.flaggedFields?.length > 0 && (
                      <div className={`mt-3 text-[11px] ${subText}`}>
                        {t('kioskResult.flaggedFields')}: {anomaly.flaggedFields.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Image analysis (if any) */}
                {image.condition && !image.skipped && (
                  <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                    <div className={`text-[11px] uppercase tracking-widest ${subText}`}>
                      {t('kioskResult.imageAnalysis')}
                    </div>
                    <div className={`mt-1 flex items-baseline justify-between gap-3`}>
                      <div className={`text-base font-semibold capitalize ${textColor}`}>
                        {image.condition}
                      </div>
                      {typeof image.confidence === 'number' && (
                        <div className={`text-xs ${subText}`}>
                          {Math.round(image.confidence * 100)}%
                        </div>
                      )}
                    </div>
                    {image.severity && image.severity !== 'none' && (
                      <div className={`mt-1 text-xs ${subText}`}>
                        {t('kioskResult.severity')}: <span className="capitalize">{image.severity}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* RIGHT: action panel */}
              <section className="space-y-4">
                {isDispense ? (
                  <>
                    <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                      <div className="flex items-center justify-between">
                        <div className={`text-sm font-semibold ${textColor}`}>
                          {t('kioskResult.recommendedMeds')}
                        </div>
                        <span className={`text-[11px] ${subText}`}>
                          {t('kioskResult.otcNote')}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {recommendations.length === 0 && (
                          <div className={`rounded-xl px-3 py-2 text-sm ${subText}`}>
                            {t('kioskResult.noMeds')}
                          </div>
                        )}
                        {recommendations.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 rounded-xl p-3 ${
                              isDark ? 'bg-white/5' : 'bg-white/70'
                            }`}
                          >
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ${
                                isDark ? 'bg-white/80 ring-white/20' : 'bg-white ring-slate-200'
                              }`}
                            >
                              <MedicineArt
                                genericName={item.medicine?.genericName || item.genericName}
                                className="h-10 w-10"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`truncate text-sm font-semibold capitalize ${textColor}`}>
                                {item.medicineName || item.medicine?.name || item.genericName}
                              </div>
                              <div className={`text-[11px] ${subText}`}>
                                × {item.quantity || 1}
                                {item.dosage && ` · ${item.dosage}`}
                                {item.unitPrice != null && ` · ₹${item.unitPrice}`}
                              </div>
                              {item.reason && (
                                <div className={`mt-0.5 truncate text-[11px] ${subText}`}>
                                  {item.reason}
                                </div>
                              )}
                            </div>
                            <div className={`text-sm font-semibold ${textColor}`}>
                              ₹{(item.unitPrice || 0) * Math.max(1, item.quantity || 1)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        className={`mt-3 flex items-center justify-between border-t pt-3 ${
                          isDark ? 'border-white/10' : 'border-slate-200'
                        }`}
                      >
                        <div className={`text-sm ${subText}`}>{t('kioskResult.total')}</div>
                        <div className={`text-lg font-bold ${textColor}`}>₹{totalAmount}</div>
                      </div>
                    </div>

                    {reasons.length > 0 && (
                      <ReasonsCard reasons={reasons} cardBg={cardBg} textColor={textColor} subText={subText} t={t} />
                    )}
                  </>
                ) : (
                  <>
                    {/* Health centre details */}
                    <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${
                      isDark ? 'bg-amber-500/10 ring-amber-400/30' : 'bg-amber-50 ring-amber-200'
                    }`}>
                      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${
                        isDark ? 'text-amber-300' : 'text-amber-700'
                      }`}>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Go to the campus health centre
                      </div>
                      <div className={`mt-3 text-base font-bold ${textColor}`}>
                        VIT Health Centre
                      </div>
                      <div className={`mt-1 text-sm ${subText}`}>
                        1st Floor, Dr. A.L. Mudaliar Block (beside G.D. Naidu Block)
                      </div>
                      <div className={`mt-3 grid gap-2 text-sm ${textColor}`}>
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                          <span><strong>Open 24 hours</strong> · 7 days a week</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
                          </svg>
                          <span>Intercom: <strong className="tabular-nums">2000 / 2238 / 2217</strong></span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setShowNurseView(true)}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                            isDark ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M9 9h6v6H9z" />
                          </svg>
                          Show to nurse
                        </button>
                        <button
                          type="button"
                          onClick={handleWhatsAppShare}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163A11.867 11.867 0 010 12C0 5.373 5.373 0 12 0s12 5.373 12 12-5.373 12-12 12c-2.05 0-3.992-.516-5.687-1.42L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                          </svg>
                          Share on WhatsApp
                        </button>
                      </div>
                    </div>

                    <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                      <div className={`text-sm font-semibold ${textColor}`}>
                        {t('kioskResult.refer.whatNextTitle')}
                      </div>
                      <ul className={`mt-3 space-y-2 text-sm ${subText}`}>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          {t('kioskResult.refer.stepClinic')}
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          {t('kioskResult.refer.stepShow')}
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                          {t('kioskResult.refer.stepEmergency')}
                        </li>
                      </ul>
                    </div>

                    {reasons.length > 0 && (
                      <ReasonsCard reasons={reasons} cardBg={cardBg} textColor={textColor} subText={subText} t={t} />
                    )}
                  </>
                )}

                <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-snug ring-1 ${
                  isDark ? 'bg-white/5 text-white/70 ring-white/10' : 'bg-white/70 text-slate-600 ring-slate-200'
                }`}>
                  <svg className="mt-[1px] h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span>{t('kioskResult.disclaimer')}</span>
                </div>
              </section>
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ring-1 ${
              isDark ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('common.back')}
          </button>
          {isDispense ? (
            <button
              type="button"
              onClick={() => navigate(`/quick/payment/${sessionId}`)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-emerald-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              {t('kioskResult.proceedToPayment')} · ₹{totalAmount}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDone}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-amber-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              {t('kioskResult.refer.doneCta')}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showNurseView && (
        <NurseView
          session={session}
          disease={disease}
          risk={risk}
          sensor={sensor}
          symptoms={symptoms}
          reasons={reasons}
          onClose={() => setShowNurseView(false)}
        />
      )}
    </div>
  );
}

function NurseView({ session, disease, risk, sensor, symptoms, reasons, onClose }) {
  const riskColor = {
    LOW: 'bg-emerald-600',
    MEDIUM: 'bg-amber-600',
    HIGH: 'bg-red-600',
  }[(risk.level || 'LOW').toUpperCase()] || 'bg-slate-600';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-slate-900">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Campus Healthcare Kiosk · Show to nurse</div>
            <h1 className="mt-1 text-2xl font-bold">{session.user?.name || 'Patient'}</h1>
            <div className="mt-0.5 text-sm text-slate-600">
              {session.user?.email}
              {session.user?.role && <span className="ml-2 capitalize">· {session.user.role}</span>}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Session: <span className="font-mono">{session.sessionId}</span> · {new Date(session.createdAt).toLocaleString('en-IN')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full ${riskColor} px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-white`}>
            <span className="h-2 w-2 rounded-full bg-white" />
            Risk: {(risk.level || 'LOW')}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-300">
            Refer to doctor
          </div>
        </div>

        <section className="mt-6">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI prediction</div>
          <div className="mt-1 text-3xl font-bold capitalize">
            {disease.disease || 'Inconclusive'}
            {typeof disease.confidence === 'number' && (
              <span className="ml-3 text-lg font-semibold text-slate-500 tabular-nums">{Math.round(disease.confidence * 100)}%</span>
            )}
          </div>
          {disease.alternatives?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {disease.alternatives.slice(0, 4).map((a, i) => (
                <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700 ring-1 ring-slate-200">
                  {a.disease || a.name || String(a)}
                  {typeof a.confidence === 'number' && <span className="ml-1 text-slate-500">{Math.round(a.confidence * 100)}%</span>}
                </span>
              ))}
            </div>
          )}
        </section>

        {symptoms.length > 0 && (
          <section className="mt-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Symptoms</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {symptoms.map((s, i) => (
                <span key={i} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold capitalize text-blue-800 ring-1 ring-blue-200">
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Vitals</div>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NurseVital label="Heart Rate" value={sensor.heartRate} unit="bpm" />
            <NurseVital label="Temperature" value={sensor.temperature} unit="°F" />
            <NurseVital label="SpO₂" value={sensor.spO2} unit="%" />
            <NurseVital label="Respiration" value={sensor.respirationRate} unit="rpm" />
          </div>
        </section>

        {reasons.length > 0 && (
          <section className="mt-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Why referred</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {reasons.slice(0, 6).map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          This is an AI-assisted screening summary, not a diagnosis. The attending clinician should make the final assessment.
        </div>
      </div>
    </div>
  );
}

function NurseVital({ label, value, unit }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums">{value == null ? '—' : value}</span>
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function RiskPill({ level, isDark, t }) {
  const l = (level || 'LOW').toUpperCase();
  const styles = {
    LOW: isDark
      ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30'
      : 'bg-emerald-100 text-emerald-700 ring-emerald-300',
    MEDIUM: isDark
      ? 'bg-amber-400/15 text-amber-200 ring-amber-400/30'
      : 'bg-amber-100 text-amber-800 ring-amber-300',
    HIGH: isDark
      ? 'bg-red-400/20 text-red-100 ring-red-400/40'
      : 'bg-red-100 text-red-700 ring-red-300',
  };
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ring-1 ${styles[l] || styles.LOW}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {t('kioskResult.riskLevelLabel')}: {t(`kioskResult.risk.${l}`)}
    </div>
  );
}

function VitalMini({ label, value, unit, isDark, textColor, subText }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/5' : 'bg-white/60'}`}>
      <div className={`text-[10px] uppercase tracking-widest ${subText}`}>{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`text-lg font-bold tabular-nums ${textColor}`}>
          {value == null ? '—' : value}
        </span>
        <span className={`text-[10px] ${subText}`}>{unit}</span>
      </div>
    </div>
  );
}

function ReasonsCard({ reasons, cardBg, textColor, subText, t }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
      <div className={`text-[11px] uppercase tracking-widest ${subText}`}>
        {t('kioskResult.reasonsTitle')}
      </div>
      <ul className={`mt-2 space-y-1.5 text-sm ${textColor}`}>
        {reasons.slice(0, 6).map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
