// draw.js — factory function that receives the Socket.io instance
module.exports = (io) => {
  const router = require('express').Router();
  const db = require('../db');
  const auth = require('../middleware/auth');

  // POST /api/events/:id/draw — run the lucky draw
  router.post('/:id/draw', auth, async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    try {
      // Verify event ownership
      const eventCheck = await db.query(
        'SELECT id FROM events WHERE id = $1 AND manager_id = $2',
        [eventId, req.manager.id]
      );
      if (eventCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get eligible participants (not yet winners)
      const eligible = await db.query(
        `SELECT p.* FROM participants p
         WHERE p.event_id = $1
           AND p.id NOT IN (
             SELECT participant_id FROM winners WHERE event_id = $1
           )`,
        [eventId]
      );

      if (eligible.rows.length === 0) {
        return res.status(400).json({ error: 'No eligible participants remaining' });
      }

      // Pick random winner
      const winnerParticipant = eligible.rows[Math.floor(Math.random() * eligible.rows.length)];

      // Determine which prize rank to assign (next unawarded rank)
      const winnersCount = await db.query(
        'SELECT COUNT(*) FROM winners WHERE event_id = $1',
        [eventId]
      );
      const nextRank = parseInt(winnersCount.rows[0].count, 10) + 1;

      // Get matching prize for this rank
      const prizeResult = await db.query(
        `SELECT pr.*, s.name AS sponsor_name, s.logo_url AS sponsor_logo
         FROM prizes pr
         LEFT JOIN sponsors s ON s.id = pr.sponsor_id
         WHERE pr.event_id = $1 AND pr.rank = $2`,
        [eventId, nextRank]
      );
      const prize = prizeResult.rows[0] || null;

      // Insert winner
      const winnerResult = await db.query(
        `INSERT INTO winners (event_id, participant_id, prize_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [eventId, winnerParticipant.id, prize ? prize.id : null]
      );

      const response = {
        winner: {
          ...winnerResult.rows[0],
          participant_name: winnerParticipant.name,
          participant_email: winnerParticipant.email,
          participant_phone: winnerParticipant.phone,
        },
        prize: prize || null,
        eligible_remaining: eligible.rows.length - 1,
      };

      // Broadcast to all clients watching this event's draw screen
      io.to(`event:${eventId}`).emit('draw:winner', response);

      res.json(response);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This participant has already won' });
      }
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
