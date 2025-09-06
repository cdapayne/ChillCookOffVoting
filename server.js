// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let contestName = process.env.CONTEST_NAME || 'Chili Cook‑Off';
let candidates = (process.env.CANDIDATES || 'Chili 1,Chili 2,Chili 3')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
let categories = (process.env.CATEGORIES || 'Appearance,Aroma,Consistency,Taste,Spiciness')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function createEmptyCounts () {
  return Object.fromEntries(
    candidates.map(c => [
      c,
      Object.fromEntries(
        categories.map(cat => [cat, [0, 0, 0, 0, 0]])
      )
    ])
  );
}

let counts = createEmptyCounts();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/vote.html'));

app.get('/config', (_req, res) => {
  res.json({ contestName, candidates, categories });
});

app.get('/reset', (_req, res) => {
  counts = createEmptyCounts();
  io.emit('tally', { contestName, candidates, categories, counts });
  res.json({ ok: true, counts });
});

app.post('/setup', (req, res) => {
  const { contestName: name, candidates: cand, categories: cat } = req.body || {};
  if (typeof name === 'string') contestName = name;
  if (Array.isArray(cand)) candidates = cand.filter(Boolean);
  if (Array.isArray(cat)) categories = cat.filter(Boolean);
  counts = createEmptyCounts();
  io.emit('tally', { contestName, candidates, categories, counts });
  res.json({ ok: true, contestName, candidates, categories });
});

io.on('connection', (socket) => {
  socket.emit('tally', { contestName, candidates, categories, counts });

  socket.on('cast-vote', ({ candidate, ratings }) => {
    if (typeof candidate !== 'string' || !counts[candidate]) return;
    if (typeof ratings !== 'object' || ratings === null) return;
    for (const [cat, val] of Object.entries(ratings)) {
      if (!categories.includes(cat)) continue;
      const n = Number(val);
      if (n >= 1 && n <= 5) counts[candidate][cat][n - 1] += 1;
    }
    io.emit('tally', { contestName, candidates, categories, counts });
  });

  socket.on('reset', () => {
    counts = createEmptyCounts();
    io.emit('tally', { contestName, candidates, categories, counts });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Live Vote server running on http://localhost:${PORT}`);
  console.log(`Contest: ${contestName}`);
  console.log(`Candidates: ${candidates.join(' | ')}`);
  console.log(`Categories: ${categories.join(' | ')}`);
  console.log('Vote page:    /vote.html');
  console.log('Display page: /display.html');
});
