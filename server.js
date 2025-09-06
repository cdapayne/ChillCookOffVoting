// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const CONTEST_NAME = process.env.CONTEST_NAME || 'Chili Cook‑Off';
const CANDIDATES = (process.env.CANDIDATES || 'Chili 1,Chili 2,Chili 3')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const CATEGORIES = (process.env.CATEGORIES || 'Appearance,Aroma,Consistency,Taste,Spiciness')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function createEmptyCounts () {
  return Object.fromEntries(
    CANDIDATES.map(c => [
      c,
      Object.fromEntries(
        CATEGORIES.map(cat => [cat, [0, 0, 0, 0, 0]])
      )
    ])
  );
}

let counts = createEmptyCounts();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/vote.html'));

app.get('/config', (_req, res) => {
  res.json({ contestName: CONTEST_NAME, candidates: CANDIDATES, categories: CATEGORIES });
});

app.get('/reset', (_req, res) => {
  counts = createEmptyCounts();
  io.emit('tally', { contestName: CONTEST_NAME, candidates: CANDIDATES, categories: CATEGORIES, counts });
  res.json({ ok: true, counts });
});

io.on('connection', (socket) => {
  socket.emit('tally', { contestName: CONTEST_NAME, candidates: CANDIDATES, categories: CATEGORIES, counts });

  socket.on('cast-vote', ({ candidate, ratings }) => {
    if (typeof candidate !== 'string' || !counts[candidate]) return;
    if (typeof ratings !== 'object' || ratings === null) return;
    for (const [cat, val] of Object.entries(ratings)) {
      if (!CATEGORIES.includes(cat)) continue;
      const n = Number(val);
      if (n >= 1 && n <= 5) counts[candidate][cat][n - 1] += 1;
    }
    io.emit('tally', { contestName: CONTEST_NAME, candidates: CANDIDATES, categories: CATEGORIES, counts });
  });

  socket.on('reset', () => {
    counts = createEmptyCounts();
    io.emit('tally', { contestName: CONTEST_NAME, candidates: CANDIDATES, categories: CATEGORIES, counts });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Live Vote server running on http://localhost:${PORT}`);
  console.log(`Contest: ${CONTEST_NAME}`);
  console.log(`Candidates: ${CANDIDATES.join(' | ')}`);
  console.log(`Categories: ${CATEGORIES.join(' | ')}`);
  console.log('Vote page:    /vote.html');
  console.log('Display page: /display.html');
});
