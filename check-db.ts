import { getDbInstance } from './backend/db.js';
const db = getDbInstance();
const users = db.prepare('SELECT id, email, role FROM user').all();
console.log('Users:', users);
const accounts = db.prepare('SELECT id, userId, providerId, password FROM account').all();
console.log('Accounts:', accounts);
