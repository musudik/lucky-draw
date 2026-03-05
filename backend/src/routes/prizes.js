const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/events/:id/prizes
router.get('/:id/prizes', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pr.*, s.name AS sponsor_name, s.logo_url AS sponsor_logo
       FROM prizes pr
       LEFT JOIN sponsors s ON s.id = pr.sponsor_id
       WHERE pr.event_id = $1
       ORDER BY pr.rank ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events/:id/prizes
router.post('/:id/prizes', auth, async (req, res) => {
  const { rank, description, sponsor_id } = req.body;
  if (!rank || !description) return res.status(400).json({ error: 'rank and description are required' });
  try {
    const check = await db.query(
      'SELECT id FROM events WHERE id = $1 AND manager_id = $2',
      [req.params.id, req.manager.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const result = await db.query(
      `INSERT INTO prizes (event_id, rank, description, sponsor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, rank, description, sponsor_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `A prize for rank ${rank} already exists for this event` });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/prizes/:prizeId
router.delete('/prize/:prizeId', auth, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM prizes pr
       USING events e
       WHERE pr.id = $1 AND pr.event_id = e.id AND e.manager_id = $2
       RETURNING pr.id`,
      [req.params.prizeId, req.manager.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prize not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
