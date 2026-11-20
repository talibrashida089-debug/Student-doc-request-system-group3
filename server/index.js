import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { pool } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const STATUSES = ['Pending', 'Processing', 'Ready for Release', 'Completed'];

// ---------- helpers ----------
const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.full_name }, SECRET, { expiresIn: '8h' });

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again.' });
  }
};

const staffOnly = (req, res, next) =>
  req.user.role === 'staff' ? next() : res.status(403).json({ error: 'Staff access only.' });

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

const REQUEST_SELECT = `
  SELECT r.id, r.reference_no, r.purpose, r.copies, r.status, r.remarks, r.created_at, r.updated_at,
         d.name AS document_name, u.full_name AS student_name, u.student_no
  FROM requests r
  JOIN document_types d ON d.id = r.document_type_id
  JOIN users u ON u.id = r.student_id`;

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { student_no, full_name, email, password } = req.body;
  if (!student_no || !full_name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Fill in all fields. Password needs at least 6 characters.' });
  const [dupe] = await pool.query('SELECT id FROM users WHERE email = ? OR student_no = ?', [email, student_no]);
  if (dupe.length) return res.status(409).json({ error: 'That email or student number is already registered.' });
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    "INSERT INTO users (student_no, full_name, email, password_hash, role) VALUES (?,?,?,?, 'student')",
    [student_no, full_name, email, hash]
  );
  const user = { id: r.insertId, role: 'student', full_name };
  res.status(201).json({ token: sign(user), user: { id: user.id, role: 'student', name: full_name } });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: sign(u), user: { id: u.id, role: u.role, name: u.full_name } });
}));

// ---------- document types ----------
app.get('/api/document-types', auth, wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM document_types ORDER BY name');
  res.json(rows);
}));

// ---------- student ----------
app.post('/api/requests', auth, wrap(async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can submit requests.' });
  const { document_type_id, purpose, copies } = req.body;
  const n = Number(copies) || 1;
  if (!document_type_id || !purpose || n < 1 || n > 10)
    return res.status(400).json({ error: 'Choose a document, state the purpose, and request 1-10 copies.' });
  const ref = 'REQ-' + Date.now().toString(36).toUpperCase();
  const [r] = await pool.query(
    'INSERT INTO requests (reference_no, student_id, document_type_id, purpose, copies) VALUES (?,?,?,?,?)',
    [ref, req.user.id, document_type_id, purpose, n]
  );
  await pool.query(
    "INSERT INTO status_history (request_id, status, remarks, changed_by) VALUES (?, 'Pending', 'Request submitted', ?)",
    [r.insertId, req.user.id]
  );
  res.status(201).json({ id: r.insertId, reference_no: ref });
}));

app.get('/api/requests/mine', auth, wrap(async (req, res) => {
  const [rows] = await pool.query(`${REQUEST_SELECT} WHERE r.student_id = ? ORDER BY r.created_at DESC`, [req.user.id]);
  res.json(rows);
}));

// ---------- staff ----------
app.get('/api/requests', auth, staffOnly, wrap(async (req, res) => {
  const { status, q } = req.query;
  const where = [];
  const params = [];
  if (status && STATUSES.includes(status)) { where.push('r.status = ?'); params.push(status); }
  if (q) {
    where.push('(r.reference_no LIKE ? OR u.full_name LIKE ? OR u.student_no LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await pool.query(
    `${REQUEST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC`, params);
  res.json(rows);
}));

app.get('/api/stats', auth, staffOnly, wrap(async (_req, res) => {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM requests GROUP BY status');
  const stats = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  rows.forEach((r) => (stats[r.status] = r.total));
  res.json(stats);
}));

app.patch('/api/requests/:id/status', auth, staffOnly, wrap(async (req, res) => {
  const { status, remarks } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const [r] = await pool.query('UPDATE requests SET status = ?, remarks = ? WHERE id = ?', [status, remarks || null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Request not found.' });
  await pool.query('INSERT INTO status_history (request_id, status, remarks, changed_by) VALUES (?,?,?,?)',
    [req.params.id, status, remarks || null, req.user.id]);
  res.json({ ok: true });
}));

// ---------- single request + history (owner or staff) ----------
app.get('/api/requests/:id', auth, wrap(async (req, res) => {
  const [rows] = await pool.query(`${REQUEST_SELECT} WHERE r.id = ?`, [req.params.id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Request not found.' });
  if (req.user.role === 'student') {
    const [own] = await pool.query('SELECT id FROM requests WHERE id = ? AND student_id = ?', [req.params.id, req.user.id]);
    if (!own.length) return res.status(403).json({ error: 'This is not your request.' });
  }
  const [history] = await pool.query(
    `SELECT h.status, h.remarks, h.changed_at, u.full_name AS changed_by
     FROM status_history h JOIN users u ON u.id = h.changed_by
     WHERE h.request_id = ? ORDER BY h.changed_at, h.id`, [req.params.id]);
  res.json({ ...row, history });
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
