export const DURATIONS = {
  hour: { label: 'Quelques heures', singular: 'heure', plural: 'heures', short: 'h', hours: 1, max: 12, time: '14:00', description: 'Une pause, un rendez-vous ou un peu de temps pour vous.' },
  half_day: { label: 'Une demi-journée', singular: 'demi-journée', plural: 'demi-journées', short: 'demi-j.', hours: 6, max: 4, time: '08:00', description: 'Six heures pour travailler, se retrouver ou se reposer.' },
  day: { label: 'Une journée', singular: 'jour', plural: 'jours', short: 'j', hours: 12, max: 30, time: '08:00', description: 'Votre espace pour la journée, sans passer la nuit.' },
  night: { label: 'Une nuit', singular: 'nuit', plural: 'nuits', short: 'nuit', hours: 12, max: 30, time: '20:00', description: 'Une nuit paisible, avec départ le lendemain matin.' },
  week: { label: 'Une semaine', singular: 'semaine', plural: 'semaines', short: 'sem.', hours: 168, max: 8, time: '14:00', description: 'Sept jours pour prendre vos habitudes.' },
  month: { label: 'Au mois', singular: 'mois', plural: 'mois', short: 'mois', hours: null, max: 12, time: '14:00', description: 'Un ou plusieurs mois de calendrier, pour vous installer durablement.' },
};
export const PLATFORM_FEE_RATE = 0.05;
export const CITIES = {
  'Cotonou': ['Fidjrossè', 'Haie Vive', 'Ganhi', 'Akpakpa', 'Cadjèhoun', 'Kindonou'],
  'Porto-Novo': ['Ouando', 'Centre-ville', 'Tokpota', 'Djassin', 'Catchi'],
  'Abomey-Calavi': ['Arconville', 'Togba', 'Akassato', 'Zogbadjè', 'Calavi-Centre'],
};
export const TYPES = ['Appartement', 'Studio', 'Villa', 'Chambre privée', 'Résidence'];
export const AMENITIES = ['Wi-Fi', 'Climatisation', 'Cuisine équipée', 'Parking', 'Eau chaude', 'Groupe électrogène', 'Piscine', 'Balcon', 'Espace de travail', 'Lave-linge', 'Jardin', 'Sécurité 24/7'];
export class AppError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export function addMonthsClamped(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export function rentalInterval(startAt, unit, quantity = 1) {
  const duration = DURATIONS[unit];
  if (!duration) throw new AppError(400, 'Choisissez une durée de séjour valide.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > duration.max) throw new AppError(400, `Choisissez entre 1 et ${duration.max} ${duration.plural}.`);
  if (typeof startAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(startAt)) throw new AppError(400, 'Indiquez une date, une heure et un fuseau horaire valides.');
  const [year, month, day] = startAt.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new AppError(400, 'Cette date n’existe pas dans le calendrier.');
  const start = new Date(startAt);
  if (!Number.isFinite(start.getTime())) throw new AppError(400, 'La date de début est invalide.');
  const end = unit === 'month' ? addMonthsClamped(start, quantity) : new Date(start.getTime() + quantity * duration.hours * 3600000);
  return { startAt: start.toISOString(), endAt: end.toISOString(), unit, quantity };
}
export function calculatePrice(price, quantity) {
  if (!Number.isInteger(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) throw new AppError(400, 'Le tarif est invalide.');
  const rentalPrice = price * quantity;
  const platformFee = Math.round(rentalPrice * PLATFORM_FEE_RATE);
  return { rentalPrice, platformFee, total: rentalPrice + platformFee, currency: 'XOF', feeRate: PLATFORM_FEE_RATE };
}
export function overlaps(a, b) { return a.startAt < b.endAt && a.endAt > b.startAt; }
export function assertAvailable(db, listingId, interval) {
  if (new Date(interval.startAt).getTime() < Date.now() - 60000) throw new AppError(400, 'Le début du séjour doit être dans le futur. Choisissez une autre date.');
  const periods = [
    ...db.prepare("SELECT start_at AS startAt, end_at AS endAt FROM availability WHERE listing_id = ?").all(listingId),
    ...db.prepare("SELECT start_at AS startAt, end_at AS endAt FROM bookings WHERE listing_id = ? AND status IN ('pending','confirmed') AND end_at > ?").all(listingId, new Date().toISOString()),
  ];
  if (periods.some(p => overlaps(interval, p))) throw new AppError(409, 'Ce logement n’est pas disponible sur cette période. Essayez une autre date ou une durée plus courte.');
}
export function quoteFor(db, listing, body, checkAvailability = true) {
  if (listing.status !== 'published') throw new AppError(409, 'Ce logement n’est pas encore ouvert à la réservation.');
  const offer = db.prepare('SELECT * FROM offers WHERE id = ? AND listing_id = ?').get(body.offerId, listing.id);
  if (!offer || !offer.active) throw new AppError(400, 'Cette offre n’est plus proposée. Choisissez une autre durée.');
  const interval = rentalInterval(body.startAt, offer.unit, body.quantity ?? 1);
  if (checkAvailability) assertAvailable(db, listing.id, interval);
  return { ...interval, ...calculatePrice(offer.price, interval.quantity), offerId: offer.id, offerLabel: offer.label, unitPrice: offer.price };
}
export function assertPublishable(listing, offers) {
  if (!listing.title || listing.title.length < 8 || !listing.description || listing.description.length < 30 || !listing.photos?.length || !listing.rules?.length || !CITIES[listing.city]?.includes(listing.neighborhood) || !offers.some(o => o.active)) {
    throw new AppError(400, 'Pour publier : ajoutez un titre, une description d’au moins 30 caractères, une photo, des règles, un quartier valide et au moins une offre active.');
  }
}
export function normalizeText(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
export function durationLabel(unit, quantity) { const d = DURATIONS[unit] || { singular: 'période', plural: 'périodes' }; return `${quantity} ${quantity > 1 ? d.plural : d.singular}`; }
