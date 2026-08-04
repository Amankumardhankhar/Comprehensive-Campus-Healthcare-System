import rateLimit from 'express-rate-limit';

const HOUR = 60 * 60 * 1000;

const tooMany = (message) => (req, res) => {
  res.status(429).json({ success: false, message });
};

/**
 * Coarse per-IP backstop for the reset endpoints.
 *
 * Deliberately loose: the app sits behind the Hugging Face edge proxy, so
 * every visitor can share an apparent IP if `trust proxy` is ever misread.
 * A tight per-IP limit here would lock out the whole deployment.
 */
export const resetRequestByIp = rateLimit({
  windowMs: HOUR,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many password reset attempts from this network. Try again in an hour.'),
});

/**
 * The limit that actually matters: caps how often any single address can be
 * targeted, so nobody can flood a victim's inbox or burn the mail quota.
 *
 * Mounted after `validate`, so req.body.email is guaranteed present and
 * already normalised — malformed floods are absorbed by resetRequestByIp.
 */
export const resetRequestByEmail = rateLimit({
  windowMs: HOUR,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email || '').toLowerCase(),
  handler: tooMany(
    'Too many reset requests for this email. Check your inbox and spam folder, then try again in an hour.'
  ),
});
