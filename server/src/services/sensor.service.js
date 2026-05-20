import crypto from 'node:crypto';

const gaussian = (mean, stdDev) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdDev;
};

const round = (n, d = 1) => Number(n.toFixed(d));
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const SCENARIOS = [
  {
    key: 'normal',
    weight: 0.60,
    hr: [72, 8],
    tempF: [98.4, 0.4],
    spO2: [98, 1.2],
    rr: [15, 2],
  },
  {
    key: 'mild_fever',
    weight: 0.18,
    hr: [88, 9],
    tempF: [100.6, 0.6],
    spO2: [97, 1.2],
    rr: [18, 2.5],
  },
  {
    key: 'high_fever',
    weight: 0.07,
    hr: [104, 10],
    tempF: [102.8, 0.7],
    spO2: [96, 1.5],
    rr: [20, 3],
  },
  {
    key: 'tachycardia',
    weight: 0.05,
    hr: [122, 10],
    tempF: [98.8, 0.5],
    spO2: [97, 1.5],
    rr: [19, 2.5],
  },
  {
    key: 'hypoxia',
    weight: 0.04,
    hr: [96, 8],
    tempF: [98.6, 0.5],
    spO2: [91, 1.5],
    rr: [22, 3],
  },
  {
    key: 'bradycardia',
    weight: 0.03,
    hr: [48, 5],
    tempF: [98.2, 0.4],
    spO2: [97, 1.5],
    rr: [13, 2],
  },
  {
    key: 'critical',
    weight: 0.03,
    hr: [135, 12],
    tempF: [103.4, 0.8],
    spO2: [88, 2],
    rr: [26, 3.5],
  },
];

const pickScenario = (forceKey) => {
  if (forceKey) {
    const s = SCENARIOS.find((x) => x.key === forceKey);
    if (s) return s;
  }
  const total = SCENARIOS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SCENARIOS) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return SCENARIOS[0];
};

export const generateVitals = ({ forceScenario = null } = {}) => {
  const s = pickScenario(forceScenario);

  const heartRate = clamp(Math.round(gaussian(s.hr[0], s.hr[1])), 30, 220);
  const temperature = round(clamp(gaussian(s.tempF[0], s.tempF[1]), 92, 107), 1);
  const spO2 = clamp(Math.round(gaussian(s.spO2[0], s.spO2[1])), 70, 100);
  const respirationRate = clamp(Math.round(gaussian(s.rr[0], s.rr[1])), 6, 40);

  return {
    heartRate,
    temperature,
    spO2,
    respirationRate,
    capturedAt: new Date(),
    source: 'simulated',
    _scenario: s.key,
  };
};

export const captureImage = ({ sessionId = null, condition = null } = {}) => {
  const seed = sessionId || crypto.randomBytes(6).toString('hex');
  const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/480`;
  return {
    capturedImageUrl: imageUrl,
    width: 640,
    height: 480,
    capturedAt: new Date(),
    source: 'simulated_camera',
    conditionHint: condition || null,
  };
};

export const captureFullReading = ({ sessionId, forceScenario } = {}) => {
  const vitals = generateVitals({ forceScenario });
  const image = captureImage({ sessionId });
  return {
    ...vitals,
    capturedImageUrl: image.capturedImageUrl,
    image,
  };
};
