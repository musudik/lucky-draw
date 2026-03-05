require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

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

// Socket.io — join event room for live draw updates
io.on('connection', (socket) => {
  socket.on('join:event', (eventId) => {
    socket.join(`event:${eventId}`);
  });
  socket.on('leave:event', (eventId) => {
    socket.leave(`event:${eventId}`);
  });
});

// Initialize DB schema on startup
async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schema);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 4000;

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Lucky Draw API running on port ${PORT}`);
  });
});
