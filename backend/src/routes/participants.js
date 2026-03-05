const router = require('express').Router();
const db = require('../db');

const ALLOWED_SERVICES = [
  'Free Financial Coaching (worth 300 euros)',
  'Investments (Gold, Silver & Stocks)',
  'Loans (Personal & Home)',
  'Real Estate',
  'Insurances',
  'Free Bank Account',
  'Retirement Plans',
];

const ALLOWED_FAMILY_STATUS = [
  'Single',
  'Married with no kids',
  'Married with 1 or more kids',
];

// POST /api/participants — public registration via QR token
router.post('/', async (req, res) => {
  const { qr_token, name, email, phone, family_status, services_required, consent } = req.body;

  if (!qr_token) return res.status(400).json({ error: 'qr_token is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Full name is required' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email address is required' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Mobile number is required' });
  if (!consent) return res.status(400).json({ error: 'You must agree to the consent terms to register' });

  if (!family_status || !ALLOWED_FAMILY_STATUS.includes(family_status)) {
    return res.status(400).json({ error: 'Please select your family status' });
  }

  const services = Array.isArray(services_required)
    ? services_required.filter((s) => ALLOWED_SERVICES.includes(s))
    : [];

  if (services.length === 0) {
    return res.status(400).json({ error: 'Please select at least one service you are interested in' });
  }

  try {
    // Look up event by QR token — also fetch status
    const eventResult = await db.query(
      'SELECT id, name, status FROM events WHERE qr_token = $1',
      [qr_token]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found. Please scan the correct QR code.' });
    }
    const event = eventResult.rows[0];

    // Block registration if the event has been ended by the manager
    if (event.status === 'ended') {
      return res.status(403).json({
        error: 'Registration for this event is now closed.',
        status: 'ended',
      });
    }

    // Insert — unique constraint on (event_id, email) prevents duplicates
    const result = await db.query(
      `INSERT INTO participants (event_id, name, email, phone, family_status, services_required, consent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        event.id,
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        family_status,
        JSON.stringify(services),
        Boolean(consent),
      ]
    );

    res.status(201).json({
      participant: result.rows[0],
      event: { id: event.id, name: event.name },
    });
  } catch (err) {
    // Unique (event_id, email) violation — duplicate registration
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This email address is already registered for this event.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
