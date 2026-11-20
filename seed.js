// Creates a default staff account. Run once: npm run seed
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const email = 'staff@school.edu';
const hash = await bcrypt.hash('staff123', 10);
await pool.query(
  `INSERT INTO users (full_name, email, password_hash, role)
   VALUES ('Registrar Staff', ?, ?, 'staff')
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'staff'`,
  [email, hash]
);
console.log(`Staff account ready -> ${email} / staff123`);
process.exit(0);
