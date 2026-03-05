const router = require('express').Router();
const QRCode = require('qrcode');
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/events — list events for authenticated manager
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, COUNT(p.id)::int AS participant_count
       FROM events e
       LEFT JOIN participants p ON p.event_id = e.id
       WHERE e.manager_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.manager.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events — create event
router.post('/', auth, async (req, res) => {
  const { name, description, venue, event_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await db.query(
      `INSERT INTO events (manager_id, name, description, venue, event_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.manager.id, name, description, venue, event_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id — get single event
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, COUNT(p.id)::int AS participant_count
       FROM events e
       LEFT JOIN participants p ON p.event_id = e.id
       WHERE e.id = $1 AND e.manager_id = $2
       GROUP BY e.id`,
      [req.params.id, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/events/:id — update event
router.put('/:id', auth, async (req, res) => {
  const { name, description, venue, event_date } = req.body;
  try {
    const result = await db.query(
      `UPDATE events
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           venue = COALESCE($3, venue),
           event_date = COALESCE($4, event_date)
       WHERE id = $5 AND manager_id = $6
       RETURNING *`,
      [name, description, venue, event_date || null, req.params.id, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/events/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM events WHERE id = $1 AND manager_id = $2 RETURNING id',
      [req.params.id, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/:id/end — close registration for an event
router.post('/:id/end', auth, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE events SET status = 'ended'
       WHERE id = $1 AND manager_id = $2
       RETURNING *`,
      [req.params.id, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/:id/reopen — reopen a previously ended event
router.post('/:id/reopen', auth, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE events SET status = 'active'
       WHERE id = $1 AND manager_id = $2
       RETURNING *`,
      [req.params.id, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id/qr — generate QR code PNG
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT qr_token FROM events WHERE id = $1 AND manager_id = $2',
      [req.params.id, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const { qr_token } = result.rows[0];
    const registrationUrl = `${process.env.FRONTEND_URL || 'http://localhost'}/register/${qr_token}`;
    const png = await QRCode.toBuffer(registrationUrl, { width: 400, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id/participants
router.get('/:id/participants', auth, async (req, res) => {
  try {
    const check = await db.query(
      'SELECT id FROM events WHERE id = $1 AND manager_id = $2',
      [req.params.id, req.manager.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const result = await db.query(
      'SELECT * FROM participants WHERE event_id = $1 ORDER BY registered_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id/winners
router.get('/:id/winners', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.id, w.won_at, w.event_id,
              p.id AS participant_id, p.name AS participant_name, p.email, p.phone,
              pr.id AS prize_id, pr.rank, pr.description AS prize_description,
              s.name AS sponsor_name, s.logo_url AS sponsor_logo
       FROM winners w
       JOIN participants p ON p.id = w.participant_id
       LEFT JOIN prizes pr ON pr.id = w.prize_id
       LEFT JOIN sponsors s ON s.id = pr.sponsor_id
       WHERE w.event_id = $1
       ORDER BY pr.rank ASC NULLS LAST, w.won_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/events/:id/winners/:winnerId — remove a winner record
router.delete('/:id/winners/:winnerId', auth, async (req, res) => {
  try {
    // Verify event ownership before deleting
    const check = await db.query(
      'SELECT id FROM events WHERE id = $1 AND manager_id = $2',
      [req.params.id, req.manager.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const result = await db.query(
      'DELETE FROM winners WHERE id = $1 AND event_id = $2 RETURNING id',
      [req.params.winnerId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Winner not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
