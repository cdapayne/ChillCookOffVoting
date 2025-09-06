// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const OPTIONS = (process.env.OPTIONS || "Red,Blue,Green")
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

let counts = Object.fromEntries(OPTIONS.map(o => [o, 0]));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/vote.html'));

app.get('/reset', (_req, res) => {
  counts = Object.fromEntries(OPTIONS.map(o => [o, 0]));
  io.emit('tally', { options: OPTIONS, counts });
  res.json({ ok: true, counts });
});

io.on('connection', (socket) => {
  socket.emit('tally', { options: OPTIONS, counts });

  socket.on('cast-vote', ({ option }) => {
    if (typeof option !== 'string') return;
    if (!OPTIONS.includes(option)) return;
    counts[option] += 1;
    io.emit('tally', { options: OPTIONS, counts });
  });

  socket.on('reset', () => {
    counts = Object.fromEntries(OPTIONS.map(o => [o, 0]));
    io.emit('tally', { options: OPTIONS, counts });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Live Vote server running on http://localhost:${PORT}`);
  console.log(`Options: ${OPTIONS.join(' | ')}`);
  console.log('Vote page:    /vote.html');
  console.log('Display page: /display.html');
});
