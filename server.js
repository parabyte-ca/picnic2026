'use strict';

const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Passwords ────────────────────────────────────────────────────────────────
const MAIN_PASSWORD  = process.env.MAIN_PASSWORD  || 'Moote2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MooteAdmin2026';

// ── Persistent session secret ─────────────────────────────────────────────
const DATA_DIR     = path.join(__dirname, 'data');
const SECRET_FILE  = path.join(DATA_DIR, '.session_secret');
const VOTES_FILE   = path.join(DATA_DIR, 'votes.json');
const RSVPS_FILE   = path.join(DATA_DIR, 'rsvps.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let SESSION_SECRET;
if (fs.existsSync(SECRET_FILE)) {
  SESSION_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} else {
  SESSION_SECRET = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, SESSION_SECRET, { mode: 0o600 });
}

if (!fs.existsSync(VOTES_FILE)) fs.writeFileSync(VOTES_FILE, '[]');
if (!fs.existsSync(RSVPS_FILE)) fs.writeFileSync(RSVPS_FILE, '[]');

// ── Data helpers ──────────────────────────────────────────────────────────
function readJSON(file)       { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function voteCounts(votes) {
  return [1, 2, 3, 4].map(i => ({
    photoId: i,
    count: votes.filter(v => v.photoId === i).length
  }));
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 48 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

// ── Auth guards ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (req.session.adminAuthenticated) return next();
  res.redirect('/admin-login');
}

// ── Page routes ────────────────────────────────────────────────────────────
app.get('/', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin', requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/admin-login', (req, res) => {
  if (req.session.adminAuthenticated) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});

// Static assets (CSS, JS, images) – no index.html auto-serve
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── API: Login ─────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  if (req.body.password === MAIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Incorrect password — please try again.' });
});

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.adminAuthenticated = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Incorrect admin password.' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── API: Photo voting ──────────────────────────────────────────────────────
app.post('/api/vote', requireAuth, (req, res) => {
  const id = parseInt(req.body.photoId, 10);
  if (!id || id < 1 || id > 4) {
    return res.status(400).json({ success: false, message: 'Invalid photo selection.' });
  }

  const votes = readJSON(VOTES_FILE);

  if (req.session.voted) {
    return res.json({
      success: false,
      alreadyVoted: true,
      votedFor: req.session.votedFor,
      counts: voteCounts(votes)
    });
  }

  votes.push({
    id: Date.now(),
    photoId: id,
    sessionId: req.session.id,
    timestamp: new Date().toISOString()
  });
  writeJSON(VOTES_FILE, votes);

  req.session.voted    = true;
  req.session.votedFor = id;

  res.json({ success: true, votedFor: id, counts: voteCounts(votes) });
});

app.get('/api/vote/status', requireAuth, (req, res) => {
  const votes = readJSON(VOTES_FILE);
  res.json({
    hasVoted: !!req.session.voted,
    votedFor: req.session.votedFor || null,
    counts: voteCounts(votes)
  });
});

// ── API: Cornhole RSVP ─────────────────────────────────────────────────────
app.post('/api/cornhole', requireAuth, (req, res) => {
  const { name, isParticipating, canBringSet, email, additionalDetails } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Your name is required.' });
  }
  if (!isParticipating) {
    return res.status(400).json({ success: false, message: 'Please select yes or no for participation.' });
  }
  // Email required only when they can bring a set
  if (canBringSet === 'yes' && (!email || !email.trim())) {
    return res.status(400).json({ success: false, message: 'Email address is required if you can bring a set.' });
  }

  if (req.session.cornholeSubmitted) {
    return res.json({ success: false, alreadySubmitted: true });
  }

  const rsvps = readJSON(RSVPS_FILE);
  rsvps.push({
    id: Date.now(),
    name: name.trim(),
    isParticipating: isParticipating === 'yes',
    canBringSet: canBringSet === 'yes' ? true : (canBringSet === 'no' ? false : null),
    email: (email || '').trim() || null,
    additionalDetails: (additionalDetails || '').trim() || null,
    timestamp: new Date().toISOString()
  });
  writeJSON(RSVPS_FILE, rsvps);

  req.session.cornholeSubmitted = true;

  res.json({ success: true });
});

app.get('/api/cornhole/status', requireAuth, (req, res) => {
  res.json({ submitted: !!req.session.cornholeSubmitted });
});

// ── API: Admin data ────────────────────────────────────────────────────────
app.get('/api/admin/data', requireAdmin, (_req, res) => {
  const votes = readJSON(VOTES_FILE);
  const rsvps = readJSON(RSVPS_FILE);

  res.json({
    voteCounts: voteCounts(votes),
    totalVotes: votes.length,
    rsvps,
    totalRsvps: rsvps.length,
    participatingCount: rsvps.filter(r => r.isParticipating).length,
    bringingSetCount: rsvps.filter(r => r.canBringSet).length
  });
});

// CSV download
app.get('/api/admin/export', requireAdmin, (_req, res) => {
  const rsvps = readJSON(RSVPS_FILE);
  const header = ['Name', 'Participating', 'Bringing Set', 'Email', 'Additional Details', 'Submitted At'];
  const rows = rsvps.map(r => [
    r.name,
    r.isParticipating ? 'Yes' : 'No',
    r.canBringSet === true ? 'Yes' : (r.canBringSet === false ? 'No' : '—'),
    r.email || '',
    (r.additionalDetails || '').replace(/\n/g, ' '),
    r.timestamp
  ].map(v => `"${String(v).replace(/"/g, '""')}"`));

  const csv = [header, ...rows].map(r => r.join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="cornhole-rsvps.csv"');
  res.send(csv);
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('  Moote Friends & Family Picnic 2026');
  console.log(`  Running at: http://localhost:${PORT}`);
  console.log('------------------------------------------------------');
  console.log(`  Main site password : ${MAIN_PASSWORD}`);
  console.log(`  Admin password     : ${ADMIN_PASSWORD}`);
  console.log(`  Admin dashboard    : http://localhost:${PORT}/admin`);
  console.log('======================================================\n');
});
