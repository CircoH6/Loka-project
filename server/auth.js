import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { AppError } from './domain.js';
export const hashPassword = password => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };
export function verifyPassword(password, stored) { const [salt, hash] = stored.split(':'); const candidate = scryptSync(password, salt, 64); return timingSafeEqual(candidate, Buffer.from(hash, 'hex')); }
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function publicUser(user) { if (!user) return null; const { password_hash, ...safe } = user; return safe; }
export function createSession(db, userId, res) {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 7 * 86400000;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), userId, expires);
  res.cookie('loka_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 7 * 86400000, path: '/' });
}
export function attachUser(db, req, _res, next) {
  const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('loka_session='));
  const token = cookie?.slice('loka_session='.length);
  req.user = token ? db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(tokenHash(token), Date.now()) : null;
  next();
}
export const requireAuth = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Connectez-vous pour continuer. Un compte de démonstration est disponible.'));
  if (roles.length && !roles.includes(req.user.role)) return next(new AppError(403, 'Cet espace est réservé au rôle ' + roles.map(r => ({ owner: 'propriétaire', admin: 'administrateur', renter: 'voyageur' }[r])).join(' ou ') + '.'));
  next();
};
export function assertListingAccess(req, listing) {
  if (!listing) throw new AppError(404, 'Ce logement est introuvable.');
  if (req.user?.role !== 'admin' && listing.owner_id !== req.user?.id) throw new AppError(403, 'Vous ne pouvez pas modifier le logement d’un autre propriétaire.');
}
