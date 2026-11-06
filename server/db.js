import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { seedDatabase } from './data.js';

export function createDatabase(filename = process.env.LOKA_DB_PATH || path.resolve('data/loka.db')) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('renter','owner','admin')),
      city TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#e6eddf', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, city TEXT NOT NULL, neighborhood TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '', capacity INTEGER NOT NULL DEFAULT 2, bedrooms INTEGER NOT NULL DEFAULT 1,
      beds INTEGER NOT NULL DEFAULT 1, bathrooms INTEGER NOT NULL DEFAULT 1,
      photos TEXT NOT NULL DEFAULT '[]', amenities TEXT NOT NULL DEFAULT '[]', rules TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
      instant_booking INTEGER NOT NULL DEFAULT 1, rating REAL NOT NULL DEFAULT 0, review_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      unit TEXT NOT NULL CHECK(unit IN ('hour','half_day','day','night','week','month')),
      label TEXT NOT NULL, price INTEGER NOT NULL CHECK(price BETWEEN 100 AND 10000000),
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, UNIQUE(listing_id, unit)
    );
    CREATE TABLE IF NOT EXISTS availability (
      id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      start_at TEXT NOT NULL, end_at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT 'Indisponible', CHECK(end_at > start_at)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), renter_id TEXT NOT NULL REFERENCES users(id),
      owner_id TEXT NOT NULL REFERENCES users(id), offer_id TEXT REFERENCES offers(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','confirmed','declined','cancelled','completed')),
      start_at TEXT NOT NULL, end_at TEXT NOT NULL, unit TEXT NOT NULL, quantity INTEGER NOT NULL,
      rental_price INTEGER NOT NULL, platform_fee INTEGER NOT NULL, total INTEGER NOT NULL, unit_price INTEGER NOT NULL,
      listing_title TEXT NOT NULL, listing_city TEXT NOT NULL, listing_photo TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '', cancellation_reason TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'simulation' CHECK(payment_method = 'simulation'),
      payment_status TEXT NOT NULL DEFAULT 'simulated' CHECK(payment_status = 'simulated'),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(end_at > start_at)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, listing_id)
    );
    CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings(city, status);
    CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_renter ON bookings(renter_id, start_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_id, status);
    CREATE INDEX IF NOT EXISTS idx_bookings_availability ON bookings(listing_id, status, start_at, end_at);
    CREATE INDEX IF NOT EXISTS idx_availability_listing ON availability(listing_id, start_at, end_at);
  `);
  if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) seedDatabase(db);
  return db;
}
