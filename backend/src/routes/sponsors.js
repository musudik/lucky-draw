const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/events/:id/sponsors
router.get('/:id/sponsors', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sponsors WHERE event_id = $1 ORDER BY id ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/:id/sponsors
router.post('/:id/sponsors', auth, async (req, res) => {
  const { name, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    // Verify event ownership
    const check = await db.query(
      'SELECT id FROM events WHERE id = $1 AND manager_id = $2',
      [req.params.id, req.manager.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const result = await db.query(
      'INSERT INTO sponsors (event_id, name, logo_url) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, name, logo_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sponsors/:sponsorId
router.delete('/sponsor/:sponsorId', auth, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM sponsors s
       USING events e
       WHERE s.id = $1 AND s.event_id = e.id AND e.manager_id = $2
       RETURNING s.id`,
      [req.params.sponsorId, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sponsor not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
