'use strict';
/**
 * Creates (or promotes) an admin account.
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-password' ADMIN_NAME='Your Name' npm run seed:admin
 */
const bcrypt = require('bcryptjs');
const db = require('../src/lib/db');
const { User } = require('../src/modules/users/user.model');

async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name = 'Admin' } = process.env;
  if (!email || !password || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters)');
  }
  await db.connect();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { role: 'admin', passwordHash, disabled: false }, $setOnInsert: { name } },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`Admin ready: ${user.email}`);
  await db.disconnect();
}

main().catch((err) => { console.error(err.message); process.exit(1); });
