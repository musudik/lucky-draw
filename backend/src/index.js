require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Socket.io only works in long-lived server mode (VPS/Docker/local dev).
// On Vercel serverless it is unavailable — io is null and the draw still
// works (winner is returned in the HTTP response) but real-time cross-screen
// push is disabled.
let io = null;
if (!process.env.VERCEL) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
  });
  io.on('connection', (socket) => {
    socket.on('join:event', (eventId) => socket.join(`event:${eventId}`));
    socket.on('leave:event', (eventId) => socket.leave(`event:${eventId}`));
  });
}

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/events', require('./routes/sponsors'));
app.use('/api/events', require('./routes/prizes'));
app.use('/api/participants', require('./routes/participants'));
app.use('/api/events', require('./routes/draw')(io));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Initialize DB schema (idempotent — all statements use IF NOT EXISTS)
async function initDb() {
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await db.query(schema);
  console.log('Database schema initialized');
}

const PORT = process.env.PORT || 4000;

if (process.env.VERCEL) {
  // Serverless mode: export app immediately, init DB in background
  initDb().catch((err) =>
    console.error('DB schema init failed:', err.message)
  );
  module.exports = app;
} else {
  // Long-lived mode: wait for DB before accepting requests
  initDb()
    .then(() => {
      server.listen(PORT, () =>
        console.log(`Lucky Draw API running on port ${PORT}`)
      );
    })
    .catch((err) => {
      console.error('Failed to initialize database schema:', err.message);
      process.exit(1);
    });
}
