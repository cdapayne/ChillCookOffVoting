// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DEFAULT_CONTEST = 'default';

function parseList (str, fallback) {
  return (str || fallback)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function createEmptyCounts (candidates, categories) {
  return Object.fromEntries(
    candidates.map(c => [
      c,
      Object.fromEntries(
        categories.map(cat => [cat, [0, 0, 0, 0, 0]])
      )
    ])
  );
}

const contests = {};
const defaultContest = {
  contestName: process.env.CONTEST_NAME || 'Chili Cook‑Off',
  candidates: parseList(process.env.CANDIDATES, 'Chili 1,Chili 2,Chili 3'),
  categories: parseList(
    process.env.CATEGORIES,
    'Appearance,Aroma,Consistency,Taste,Spiciness'
  )
};
defaultContest.counts = createEmptyCounts(
  defaultContest.candidates,
  defaultContest.categories
);
contests[DEFAULT_CONTEST] = defaultContest;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/vote.html'));

app.get('/config', (req, res) => {
  const id = req.query.contest || DEFAULT_CONTEST;
  const contest = contests[id];
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  const { contestName, candidates, categories } = contest;
  res.json({ contestName, candidates, categories });
});

app.get('/reset', (req, res) => {
  const id = req.query.contest || DEFAULT_CONTEST;
  const contest = contests[id];
  if (!contest) return res.status(404).json({ error: 'Contest not found' });
  contest.counts = createEmptyCounts(contest.candidates, contest.categories);
  io.to(id).emit('tally', contest);
  res.json({ ok: true, counts: contest.counts });
});

app.post('/setup', (req, res) => {
  const { id = DEFAULT_CONTEST, contestName: name, candidates: cand, categories: cat } = req.body || {};
  let contest = contests[id];
  if (!contest) {
    contest = { contestName: 'Contest', candidates: [], categories: [], counts: {} };
    contests[id] = contest;
  }
  if (typeof name === 'string') contest.contestName = name;
  if (Array.isArray(cand)) contest.candidates = cand.filter(Boolean);
  if (Array.isArray(cat)) contest.categories = cat.filter(Boolean);
  contest.counts = createEmptyCounts(contest.candidates, contest.categories);
  io.to(id).emit('tally', contest);
  res.json({ ok: true, contestId: id, contestName: contest.contestName, candidates: contest.candidates, categories: contest.categories });
});

io.on('connection', (socket) => {
  const contestId = socket.handshake.query.contest || DEFAULT_CONTEST;
  if (!contests[contestId]) {
    contests[contestId] = {
      contestName: 'Contest',
      candidates: [],
      categories: [],
      counts: createEmptyCounts([], [])
    };
  }
  const contest = contests[contestId];
  socket.join(contestId);
  socket.emit('tally', contest);

  socket.on('cast-vote', ({ candidate, ratings }) => {
    const contest = contests[contestId];
    if (!contest) return;
    if (typeof candidate !== 'string' || !contest.counts[candidate]) return;
    if (typeof ratings !== 'object' || ratings === null) return;
    for (const [cat, val] of Object.entries(ratings)) {
      if (!contest.categories.includes(cat)) continue;
      const n = Number(val);
      if (n >= 1 && n <= 5) contest.counts[candidate][cat][n - 1] += 1;
    }
    io.to(contestId).emit('tally', contest);
  });

  socket.on('reset', () => {
    const contest = contests[contestId];
    if (!contest) return;
    contest.counts = createEmptyCounts(contest.candidates, contest.categories);
    io.to(contestId).emit('tally', contest);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const { contestName, candidates, categories } = contests[DEFAULT_CONTEST];
  console.log(`Live Vote server running on http://localhost:${PORT}`);
  console.log(`Contest: ${contestName}`);
  console.log(`Candidates: ${candidates.join(' | ')}`);
  console.log(`Categories: ${categories.join(' | ')}`);
  console.log(`Vote page:    /vote.html?contest=${DEFAULT_CONTEST}`);
  console.log(`Display page: /display.html?contest=${DEFAULT_CONTEST}`);
});
