import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const STAGES = ['heart', 'temperature', 'spO2', 'respiration'];
const CAPTURE_MS = 5000;

const normalRange = {
  heartRate: [55, 100],
  temperature: [97.0, 99.5],
  spO2: [95, 100],
  respirationRate: [12, 20],
};

const statusFor = (key, value) => {
  if (value == null) return 'idle';
  const [lo, hi] = normalRange[key];
  if (value < lo || value > hi) return 'alert';
  return 'ok';
};

export default function KioskSensor() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { sessionId } = useParams();

  // phases: 'initializing' | 'ready' | 'capturing' | 'done' | 'denied' | 'error'
  const [phase, setPhase] = useState('initializing');
  const [cameraOk, setCameraOk] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(Math.ceil(CAPTURE_MS / 1000));
  const [vitals, setVitals] = useState({
    heartRate: null,
    temperature: null,
    spO2: null,
    respirationRate: null,
  });
  const [frameDataUrl, setFrameDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const attachStreamToVideo = async (stream) => {
    // Poll briefly for the video element — React may not have mounted it yet
    // if the phase flipped state mid-render.
    for (let i = 0; i < 20; i++) {
      if (videoRef.current) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const v = videoRef.current;
    if (!v) throw new Error('Video element not available');
    v.muted = true;
    v.setAttribute('playsinline', 'true');
    v.srcObject = stream;
    try {
      await v.play();
    } catch (_) {
      // some browsers need a user gesture — stream is still attached
    }
  };

  // Request camera once on mount; auth-gate; cleanup stream on unmount.
  useEffect(() => {
    if (!getToken()) {
      navigate(`/login?next=${encodeURIComponent(`/kiosk/sensor/${sessionId}`)}`);
      return;
    }
    let cancelled = false;
    const start = async () => {
      if (!window.isSecureContext) {
        setError('Camera requires HTTPS or localhost');
        setPhase('denied');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support camera access');
        setPhase('denied');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        await attachStreamToVideo(stream);
        setCameraOk(true);
        setPhase('ready');
      } catch (e) {
        const name = e?.name || '';
        const msg =
          name === 'NotAllowedError'
            ? 'Camera permission denied in the browser.'
            : name === 'NotFoundError'
            ? 'No camera detected on this device.'
            : name === 'NotReadableError'
            ? 'Camera is in use by another application.'
            : name === 'OverconstrainedError'
            ? 'No camera matches the requested settings.'
            : e?.message || 'Could not start the camera.';
        setError(msg);
        setPhase('denied');
        // eslint-disable-next-line no-console
        console.error('[KioskSensor] getUserMedia failed:', e);
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [sessionId, navigate]);

  const grabFrame = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return null;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  };

  const runCapture = async () => {
    setPhase('capturing');
    setError('');
    setStageIdx(0);
    setProgress(0);
    setCountdown(Math.ceil(CAPTURE_MS / 1000));
    setVitals({ heartRate: null, temperature: null, spO2: null, respirationRate: null });

    // Fire the backend-simulated vitals while the countdown runs.
    const vitalsPromise = apiFetch('/api/sensor/vitals').catch((e) => {
      throw e;
    });

    const started = performance.now();
    const perStage = CAPTURE_MS / STAGES.length;

    await new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - started;
        const frac = Math.min(elapsed / CAPTURE_MS, 1);
        setProgress(frac);
        setCountdown(Math.max(0, Math.ceil((CAPTURE_MS - elapsed) / 1000)));
        const nextStage = Math.min(
          STAGES.length - 1,
          Math.floor(elapsed / perStage)
        );
        setStageIdx(nextStage);
        if (frac < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    try {
      const res = await vitalsPromise;
      const d = res.data;
      const snapshot = cameraOk ? grabFrame() : null;
      setFrameDataUrl(snapshot);
      setVitals({
        heartRate: d.heartRate,
        temperature: d.temperature,
        spO2: d.spO2,
        respirationRate: d.respirationRate,
      });
      setStageIdx(STAGES.length);
      setPhase('done');
      // Stop the stream once we've grabbed the frame.
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const retry = async () => {
    setError('');
    setFrameDataUrl(null);
    if (streamRef.current) {
      setPhase('ready');
      return;
    }
    setPhase('initializing');
    setCameraOk(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      await attachStreamToVideo(stream);
      setCameraOk(true);
      setPhase('ready');
    } catch (e) {
      setError(e?.message || 'Could not restart camera');
      setPhase('denied');
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/machine/session/${sessionId}/sensor`, {
        method: 'POST',
        body: {
          heartRate: vitals.heartRate,
          temperature: vitals.temperature,
          spO2: vitals.spO2,
          respirationRate: vitals.respirationRate,
          source: cameraOk ? 'camera' : 'simulated',
        },
      });
      navigate(`/kiosk/analyzing/${sessionId}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      await apiFetch(`/api/machine/session/${sessionId}/cancel`, {
        method: 'POST',
        body: { reason: 'user cancelled at sensor capture' },
      });
    } catch (_) {
      /* ignore */
    }
    navigate('/');
  };

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark ? 'bg-white/5 ring-white/10' : 'bg-white/85 ring-slate-200';
  const activeStage = STAGES[Math.min(Math.max(stageIdx, 0), STAGES.length - 1)];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className={`flex items-center gap-3 ${textColor}`}>
            <Logo size={40} />
            <div>
              <div className="text-base font-semibold leading-tight">
                {t('kioskSensor.title')}
              </div>
              <div className={`text-xs ${subText}`}>
                {phase === 'done'
                  ? t('kioskSensor.captured')
                  : phase === 'capturing'
                  ? t('kioskSensor.capturing')
                  : phase === 'ready'
                  ? t('kioskSensor.readyStatus')
                  : phase === 'denied'
                  ? t('kioskSensor.deniedStatus')
                  : t('kioskSensor.initializing')}
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

        <main className="flex-1 px-8 pb-32 md:px-14">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr_280px] items-start">
            <LeftSidebar tipLabel="Sensor Tips" />
            <div>
            <div className="mt-2 text-center">
              <h1 className={`text-4xl font-bold md:text-5xl ${textColor}`}>
                {t('kioskSensor.heading')}
              </h1>
              <p className={`mx-auto mt-3 max-w-2xl text-base md:text-lg ${subText}`}>
                {t('kioskSensor.subheading')}
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* LEFT: camera / capture */}
              <section className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${cardBg}`}>
                <div
                  className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl ring-1 ${
                    isDark ? 'bg-black ring-white/10' : 'bg-slate-900 ring-slate-200'
                  }`}
                >
                  {/* Live camera or captured snapshot */}
                  {phase === 'done' && frameDataUrl ? (
                    <img
                      src={frameDataUrl}
                      alt="capture"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      className={`h-full w-full object-cover ${
                        cameraOk ? '' : 'opacity-0'
                      }`}
                      playsInline
                      muted
                    />
                  )}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Face frame overlay */}
                  {phase !== 'done' && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div
                        className={`h-56 w-44 rounded-[50%] border-2 ${
                          phase === 'capturing'
                            ? 'border-brand-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                            : 'border-white/60 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                        }`}
                      />
                    </div>
                  )}

                  {/* Denied / initializing states */}
                  {(phase === 'initializing' || phase === 'denied') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
                      {phase === 'initializing' ? (
                        <>
                          <svg className="h-8 w-8 animate-spin text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M21 12a9 9 0 11-6.2-8.55" />
                          </svg>
                          <div className="text-sm text-white/80">
                            {t('kioskSensor.requestingCamera')}
                          </div>
                        </>
                      ) : (
                        <>
                          <svg className="h-8 w-8 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 9v4M12 17h.01" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                          <div className="max-w-xs text-sm text-white/90">
                            {t('kioskSensor.deniedBody')}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Countdown overlay */}
                  {phase === 'capturing' && (
                    <>
                      <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                        {countdown}s
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width]"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                      <div className="absolute inset-x-3 bottom-4 flex items-center justify-center">
                        <span className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg">
                          ● {t('kioskSensor.recording')}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Inline status / retake */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className={`text-sm ${subText}`}>
                    {phase === 'ready' && t('kioskSensor.readyHint')}
                    {phase === 'capturing' &&
                      t('kioskSensor.capturingHint', {
                        stage: t(`kioskSensor.stages.${activeStage}`),
                      })}
                    {phase === 'done' && t('kioskSensor.doneHint')}
                    {phase === 'denied' && t('kioskSensor.deniedHint')}
                    {phase === 'initializing' && t('kioskSensor.initializingHint')}
                  </div>
                  {phase === 'done' && (
                    <button
                      type="button"
                      onClick={retry}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ring-1 ${
                        isDark
                          ? 'bg-white/10 text-white ring-white/20 hover:bg-white/20'
                          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t('kioskSensor.retake')}
                    </button>
                  )}
                </div>
              </section>

              {/* RIGHT: vitals list */}
              <section className="space-y-4">
                <div
                  className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-snug ring-1 ${
                    isDark
                      ? 'bg-amber-400/10 text-amber-100 ring-amber-300/20'
                      : 'bg-amber-50 text-amber-900 ring-amber-200'
                  }`}
                >
                  <svg
                    className="mt-[1px] h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span>{t('kioskSensor.simulatedNote')}</span>
                </div>
                <VitalCard
                  label={t('kioskSensor.heartRate')}
                  unit="bpm"
                  value={vitals.heartRate}
                  status={statusFor('heartRate', vitals.heartRate)}
                  active={phase === 'capturing' && activeStage === 'heart'}
                  isDark={isDark}
                  cardBg={cardBg}
                  textColor={textColor}
                  subText={subText}
                  icon={<HeartIcon />}
                />
                <VitalCard
                  label={t('kioskSensor.temperature')}
                  unit="°F"
                  value={vitals.temperature}
                  status={statusFor('temperature', vitals.temperature)}
                  active={phase === 'capturing' && activeStage === 'temperature'}
                  isDark={isDark}
                  cardBg={cardBg}
                  textColor={textColor}
                  subText={subText}
                  icon={<ThermometerIcon />}
                />
                <VitalCard
                  label={t('kioskSensor.spO2')}
                  unit="%"
                  value={vitals.spO2}
                  status={statusFor('spO2', vitals.spO2)}
                  active={phase === 'capturing' && activeStage === 'spO2'}
                  isDark={isDark}
                  cardBg={cardBg}
                  textColor={textColor}
                  subText={subText}
                  icon={<OxygenIcon />}
                />
                <VitalCard
                  label={t('kioskSensor.respiration')}
                  unit="rpm"
                  value={vitals.respirationRate}
                  status={statusFor('respirationRate', vitals.respirationRate)}
                  active={phase === 'capturing' && activeStage === 'respiration'}
                  isDark={isDark}
                  cardBg={cardBg}
                  textColor={textColor}
                  subText={subText}
                  icon={<LungIcon />}
                />
              </section>
            </div>

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
            <RightSidebar />
          </div>
        </main>
      </div>

      {/* Sticky bottom bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-xl px-6 py-4 md:px-10"
        style={{
          backgroundColor: isDark ? 'rgba(10,14,22,0.7)' : 'rgba(255,255,255,0.8)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleCancel}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium ring-1 ${
              isDark
                ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('kioskSensor.cancel')}
          </button>
          {(() => {
            const isDone = phase === 'done';
            const isReady = phase === 'ready';
            const isCapturing = phase === 'capturing';
            const isDenied = phase === 'denied';
            const disabled =
              saving ||
              phase === 'initializing' ||
              isCapturing ||
              (!isReady && !isDone && !isDenied);

            let label;
            if (saving) label = t('kioskSensor.saving');
            else if (isCapturing) label = `${t('kioskSensor.capturing')} ${countdown}s`;
            else if (isDone) label = t('kioskSensor.continue');
            else if (isDenied) label = t('kioskSensor.skipCamera');
            else if (isReady) label = t('kioskSensor.startCapture');
            else label = t('kioskSensor.waiting');

            const onClick = isDone ? submit : isReady || isDenied ? runCapture : undefined;

            return (
              <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={`inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-xl transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${
                  isDone
                    ? 'bg-gradient-to-r from-brand-500 to-brand-700 shadow-brand-500/30'
                    : isReady
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/30'
                    : 'bg-gradient-to-r from-brand-500 to-brand-700 shadow-brand-500/30'
                }`}
              >
                {isReady && (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                )}
                {label}
                {isDone && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function VitalCard({
  label,
  unit,
  value,
  status,
  active,
  isDark,
  cardBg,
  textColor,
  subText,
  icon,
}) {
  const statusRing =
    status === 'ok'
      ? isDark
        ? 'ring-emerald-400/30'
        : 'ring-emerald-400/50'
      : status === 'alert'
      ? isDark
        ? 'ring-amber-400/50'
        : 'ring-amber-500/60'
      : '';
  const statusBadge =
    status === 'ok'
      ? isDark
        ? 'bg-emerald-400/15 text-emerald-200'
        : 'bg-emerald-100 text-emerald-700'
      : status === 'alert'
      ? isDark
        ? 'bg-amber-400/15 text-amber-200'
        : 'bg-amber-100 text-amber-800'
      : isDark
      ? 'bg-white/10 text-white/60'
      : 'bg-slate-100 text-slate-500';

  return (
    <div
      className={`relative rounded-2xl p-4 ring-1 backdrop-blur-xl transition-all ${cardBg} ${
        active ? 'scale-[1.02] ring-brand-400/60 shadow-xl shadow-brand-500/20' : statusRing
      }`}
    >
      {active && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-400/60 animate-pulse" />
      )}
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-white/10' : 'bg-white'}`}>
          {icon}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge}`}>
          {status === 'ok' ? 'normal' : status === 'alert' ? 'alert' : '—'}
        </span>
      </div>
      <div className={`mt-3 text-[11px] uppercase tracking-widest ${subText}`}>{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${textColor}`}>
          {value == null ? '—' : value}
        </span>
        <span className={`text-xs ${subText}`}>{unit}</span>
      </div>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ef4444' }}>
      <path d="M12 21s-7.5-4.35-9.33-9.19C1.56 8.46 3.78 5 7.22 5c2.02 0 3.51 1.09 4.78 2.66C13.27 6.09 14.76 5 16.78 5c3.44 0 5.66 3.46 4.55 6.81C19.5 16.65 12 21 12 21z">
        <animate attributeName="opacity" values="1;0.65;1" dur="0.9s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function ThermometerIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4a2 2 0 10-4 0v10.54a4 4 0 104 0V4z" />
      <circle cx="12" cy="17.5" r="1.5" fill="#f97316" />
    </svg>
  );
}

function OxygenIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2s-6 7.03-6 12a6 6 0 0012 0c0-4.97-6-12-6-12z" />
      <text x="12" y="17" textAnchor="middle" fontSize="7" fontWeight="700" fill="#0ea5e9" stroke="none">
        O₂
      </text>
    </svg>
  );
}

function LungIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v11" />
      <path d="M8 6c-2 4-2 8-2 10a3 3 0 006 0" />
      <path d="M16 6c2 4 2 8 2 10a3 3 0 01-6 0" />
    </svg>
  );
}
