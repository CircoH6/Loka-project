import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CITIES, TYPES, AMENITIES, DURATIONS, AppError, normalizeText, quoteFor, assertPublishable, assertAvailable, rentalInterval } from './domain.js';
import { hashPassword, verifyPassword, publicUser, createSession, tokenHash, attachUser, requireAuth, assertListingAccess } from './auth.js';
import { DEMO_ACCOUNTS } from './data.js';

const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${randomUUID().slice(0,12)}`;
const bool = z.coerce.number().int().min(0).max(1);
const photo = z.string().max(500).refine(v => /^\/(images|uploads)\/[\w.-]+$/.test(v) || /^https:\/\/[^\s]+$/.test(v), 'Utilisez une image importée ou une adresse HTTPS valide.');
const dateString = z.string().refine(v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)), 'Date ou fuseau horaire invalide.');
const offerInput = z.object({ unit: z.enum(Object.keys(DURATIONS)), label: z.string().trim().min(2).max(60).optional(), price: z.number().int().min(100).max(10000000), active: z.boolean().default(true) }).strict();
const listingInput = z.object({
  title: z.string().trim().min(3).max(100), description: z.string().trim().max(5000).default(''),
  type: z.enum(TYPES), city: z.enum(Object.keys(CITIES)), neighborhood: z.string().trim().min(2).max(80),
  address: z.string().trim().max(250).default(''), capacity: z.number().int().min(1).max(30).default(2),
  bedrooms: z.number().int().min(0).max(20).default(1), beds: z.number().int().min(1).max(30).default(1), bathrooms: z.number().int().min(1).max(20).default(1),
  photos: z.array(photo).max(8).default([]), amenities: z.array(z.enum(AMENITIES)).max(16).default([]),
  rules: z.array(z.string().trim().min(3).max(250)).max(12).default([]), instantBooking: z.boolean().default(true),
  status: z.enum(['draft','published','archived']).default('draft'),
}).strict();
const createListingInput = listingInput.extend({ offers: z.array(offerInput).max(6).default([]) });
const bookingInput = z.object({ listingId: z.string().min(1), offerId: z.string().min(1), startAt: dateString, quantity: z.number().int().min(1).max(30).default(1), message: z.string().trim().max(1000).default(''), paymentMethod: z.literal('simulation') }).strict();

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError(400, result.error.issues.map(i => `${i.path.join('.') || 'Saisie'} : ${i.message}`).join(' '), result.error.flatten());
  return result.data;
}
function hydrateListing(db, row, full = false) {
  if (!row) return null;
  const owner = db.prepare('SELECT id,name,color,bio,created_at FROM users WHERE id=?').get(row.owner_id);
  const offers = db.prepare('SELECT id,unit,label,price,active FROM offers WHERE listing_id=? ORDER BY price ASC').all(row.id).map(o=>({...o,active:!!o.active}));
  const result = { ...row, photos:JSON.parse(row.photos), amenities:JSON.parse(row.amenities), rules:JSON.parse(row.rules), instantBooking:!!row.instant_booking, owner, offers };
  delete result.instant_booking;
  if (full) result.availability = db.prepare('SELECT id,start_at AS startAt,end_at AS endAt,reason FROM availability WHERE listing_id=? ORDER BY start_at').all(row.id).concat(db.prepare("SELECT id,start_at AS startAt,end_at AS endAt,'Réservé ou en attente' AS reason FROM bookings WHERE listing_id=? AND status IN ('pending','confirmed') AND end_at>? ORDER BY start_at").all(row.id,now()));
  return result;
}
function preferredOffer(listing, unit) {
  const active=listing.offers.filter(o=>o.active);
  return active.find(o=>o.unit===unit) || ['day','night','week','month','half_day','hour'].map(u=>active.find(o=>o.unit===u)).find(Boolean) || active[0];
}
function getBooking(db, bookingId) {
  return db.prepare(`SELECT b.*, u.name AS renter_name, u.email AS renter_email, o.name AS owner_name,
    l.neighborhood, l.address, l.photos AS current_photos, l.status AS listing_status
    FROM bookings b JOIN users u ON u.id=b.renter_id JOIN users o ON o.id=b.owner_id JOIN listings l ON l.id=b.listing_id WHERE b.id=?`).get(bookingId);
}
function accessBooking(req, booking) {
  if (!booking) throw new AppError(404,'Cette réservation est introuvable.');
  if (req.user.role !== 'admin' && booking.renter_id !== req.user.id && booking.owner_id !== req.user.id) throw new AppError(403,'Vous n’avez pas accès à cette réservation.');
}

export function createApi(db, { uploadsDir = path.resolve('data/uploads') } = {}) {
  const router = express.Router();
  fs.mkdirSync(uploadsDir,{recursive:true});
  router.use(express.json({limit:'100kb'}));
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin=req.headers.origin;
      if (origin) { try { if (new URL(origin).host !== req.headers.host) return next(new AppError(403,'Origine de requête non autorisée.')); } catch { return next(new AppError(403,'Origine de requête invalide.')); } }
    }
    next();
  });
  router.use(attachUser.bind(null,db));
  router.get('/health',(_req,res)=>res.json({status:'ok',prototype:true}));
  router.get('/meta',(_req,res)=>res.json({cities:CITIES,types:TYPES,amenities:AMENITIES,durations:DURATIONS,feeRate:0.05,currency:'XOF',timezone:'Africa/Porto-Novo',prototype:true}));
  router.get('/session',(req,res)=>res.json({user:publicUser(req.user),favorites:req.user?db.prepare('SELECT listing_id FROM favorites WHERE user_id=?').all(req.user.id).map(x=>x.listing_id):[]}));
  router.get('/demo-accounts',(_req,res)=>res.json(DEMO_ACCOUNTS.map(({id,name,role,color,city})=>({id,name,role,color,city}))));
  router.post('/auth/demo',(req,res)=>{
    const {userId}=parse(z.object({userId:z.string()}).strict(),req.body);
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!DEMO_ACCOUNTS.some(a=>a.id===userId) || !user) throw new AppError(404,'Ce compte de démonstration est introuvable.');
    createSession(db,user.id,res);res.json({user:publicUser(user)});
  });
  router.post('/auth/login',(req,res)=>{
    const input=parse(z.object({email:z.string().email().max(200),password:z.string().min(1).max(128)}).strict(),req.body);
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(input.email.toLowerCase().trim());
    if (!user || !verifyPassword(input.password,user.password_hash)) throw new AppError(401,'E-mail ou mot de passe incorrect. Essayez un compte de démonstration ci-dessous.');
    createSession(db,user.id,res);res.json({user:publicUser(user)});
  });
  router.post('/auth/register',(req,res)=>{
    const input=parse(z.object({name:z.string().trim().min(2).max(80),email:z.string().email().max(200),password:z.string().min(8).max(128),role:z.enum(['renter','owner'])}).strict(),req.body);
    if (db.prepare('SELECT id FROM users WHERE email=?').get(input.email)) throw new AppError(409,'Un compte existe déjà avec cet e-mail. Connectez-vous.');
    const userId=id('user');
    db.prepare('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(userId,input.name,input.email.toLowerCase().trim(),hashPassword(input.password),input.role,now());
    createSession(db,userId,res);res.status(201).json({user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId))});
  });
  router.post('/auth/logout',(req,res)=>{
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('loka_session='))?.slice(13);
    if(token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
    res.clearCookie('loka_session',{path:'/',httpOnly:true,sameSite:'lax'});res.json({ok:true});
  });
  router.patch('/profile',requireAuth(),(req,res)=>{
    const input=parse(z.object({name:z.string().trim().min(2).max(80),phone:z.string().trim().max(30).default(''),city:z.string().trim().max(80).default(''),bio:z.string().trim().max(500).default('')}).strict(),req.body);
    db.prepare('UPDATE users SET name=?,phone=?,city=?,bio=? WHERE id=?').run(input.name,input.phone,input.city,input.bio,req.user.id);
    res.json({user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id))});
  });
  router.get('/favorites/listings',requireAuth(),(req,res)=>res.json(db.prepare('SELECT l.* FROM listings l JOIN favorites f ON f.listing_id=l.id WHERE f.user_id=? ORDER BY l.created_at DESC').all(req.user.id).map(l=>hydrateListing(db,l))));
  router.get('/favorites',requireAuth(),(req,res)=>res.json(db.prepare('SELECT listing_id FROM favorites WHERE user_id=?').all(req.user.id).map(x=>x.listing_id)));
  router.put('/favorites/:listingId',requireAuth(),(req,res)=>{
    const listing=db.prepare("SELECT id FROM listings WHERE id=? AND status='published'").get(req.params.listingId);
    if(!listing) throw new AppError(404,'Ce logement n’est plus disponible.');
    db.prepare('INSERT OR IGNORE INTO favorites (user_id,listing_id) VALUES (?,?)').run(req.user.id,listing.id);res.json({ok:true});
  });
  router.delete('/favorites/:listingId',requireAuth(),(req,res)=>{db.prepare('DELETE FROM favorites WHERE user_id=? AND listing_id=?').run(req.user.id,req.params.listingId);res.json({ok:true});});

  router.get('/listings/mine',requireAuth('owner','admin'),(req,res)=>{
    const rows=req.user.role==='admin'?db.prepare('SELECT * FROM listings ORDER BY updated_at DESC').all():db.prepare('SELECT * FROM listings WHERE owner_id=? ORDER BY updated_at DESC').all(req.user.id);
    res.json(rows.map(r=>hydrateListing(db,r,true)));
  });
  router.get('/listings',(req,res)=>{
    const q=req.query;
    let listings=db.prepare("SELECT * FROM listings WHERE status='published'").all().map(r=>hydrateListing(db,r));
    const text=normalizeText(q.q);
    if(text) listings=listings.filter(l=>normalizeText(`${l.title} ${l.city} ${l.neighborhood} ${l.description}`).includes(text));
    for(const field of ['city','neighborhood','type']) if(q[field]) listings=listings.filter(l=>l[field]===q[field]);
    if(q.guests) listings=listings.filter(l=>l.capacity>=Number(q.guests));
    if(q.bedrooms) listings=listings.filter(l=>l.bedrooms>=Number(q.bedrooms));
    if(q.instant==='true') listings=listings.filter(l=>l.instantBooking);
    if(q.amenities) { const requested=String(q.amenities).split(','); listings=listings.filter(l=>requested.every(a=>l.amenities.includes(a))); }
    if(q.duration && !DURATIONS[q.duration]) throw new AppError(400,'Durée de recherche invalide.');
    listings=listings.map(l=>({...l,displayOffer:preferredOffer(l,q.duration)})).filter(l=>l.displayOffer);
    if(q.duration) listings=listings.filter(l=>l.displayOffer.unit===q.duration);
    if(q.minPrice) listings=listings.filter(l=>l.displayOffer.price>=Number(q.minPrice));
    if(q.maxPrice) listings=listings.filter(l=>l.displayOffer.price<=Number(q.maxPrice));
    if(q.startAt) {
      if(!DURATIONS[q.duration]) throw new AppError(400,'Choisissez une unité de durée pour vérifier les disponibilités.');
      const quantity=Number(q.quantity)||1;
      listings=listings.filter(l=>{try{assertAvailable(db,l.id,rentalInterval(q.startAt,l.displayOffer.unit,quantity));return true;}catch(e){if(e instanceof AppError)return false;throw e;}});
    }
    const sort=q.sort||'recommended';
    listings.sort((a,b)=>sort==='price-asc'?a.displayOffer.price-b.displayOffer.price:sort==='price-desc'?b.displayOffer.price-a.displayOffer.price:sort==='rating'?b.rating-a.rating:sort==='newest'?b.created_at.localeCompare(a.created_at):(b.rating-a.rating)||(b.review_count-a.review_count));
    const limit=Math.min(48,Math.max(1,Number(q.limit)||12));const page=Math.max(1,Number(q.page)||1);
    res.json({listings:listings.slice((page-1)*limit,page*limit),total:listings.length,page,pages:Math.ceil(listings.length/limit)});
  });
  router.get('/listings/:listingId',(req,res)=>{
    const row=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);
    if(!row || (row.status!=='published' && row.owner_id!==req.user?.id && req.user?.role!=='admin')) throw new AppError(404,'Ce logement est introuvable ou n’est plus publié.');
    res.json(hydrateListing(db,row,true));
  });
  router.post('/listings',requireAuth('owner','admin'),(req,res)=>{
    const {offers,...input}=parse(createListingInput,req.body);
    if(new Set(offers.map(o=>o.unit)).size!==offers.length) throw new AppError(400,'Une seule offre par unité de durée est autorisée.');
    if(input.status==='published') assertPublishable(input,offers);
    const listingId=id('l');
    db.transaction(()=>{
      db.prepare(`INSERT INTO listings (id,owner_id,title,description,type,city,neighborhood,address,capacity,bedrooms,beds,bathrooms,photos,amenities,rules,status,instant_booking,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(listingId,req.user.id,input.title,input.description,input.type,input.city,input.neighborhood,input.address,input.capacity,input.bedrooms,input.beds,input.bathrooms,JSON.stringify(input.photos),JSON.stringify(input.amenities),JSON.stringify(input.rules),input.status,+input.instantBooking,now(),now());
      const stmt=db.prepare('INSERT INTO offers (id,listing_id,unit,label,price,active,created_at) VALUES (?,?,?,?,?,?,?)');
      for(const o of offers) stmt.run(id('offer'),listingId,o.unit,o.label||DURATIONS[o.unit].label,o.price,+o.active,now());
    })();
    res.status(201).json(hydrateListing(db,db.prepare('SELECT * FROM listings WHERE id=?').get(listingId),true));
  });
  router.patch('/listings/:listingId',requireAuth('owner','admin'),(req,res)=>{
    const row=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);assertListingAccess(req,row);
    const input=parse(listingInput.partial().extend({offers:z.array(offerInput.extend({id:z.string().optional()})).max(6).optional()}).strict(),req.body);
    const current=hydrateListing(db,row);
    const {offers:inputOffers,...fieldsInput}=input;
    const next={...current,...fieldsInput};
    const nextOffers=inputOffers ? inputOffers.map(o=>({...o,id:o.id||current.offers.find(x=>x.unit===o.unit)?.id||id('offer')})) : current.offers;
    if(inputOffers && new Set(nextOffers.map(o=>o.unit)).size!==nextOffers.length)throw new AppError(400,'Une seule offre par unité de durée est autorisée.');
    if(inputOffers?.some(o=>o.id&&!current.offers.some(x=>x.id===o.id)))throw new AppError(400,'Une offre ne correspond pas à ce logement.');
    if(input.status==='published' || (row.status==='published' && !input.status)) assertPublishable(next,nextOffers);
    db.transaction(()=>{
      if(inputOffers){
        const keep=nextOffers.map(o=>o.id);
        for(const old of current.offers.filter(o=>!keep.includes(o.id))){
          if(db.prepare("SELECT id FROM bookings WHERE offer_id=? AND status IN ('pending','confirmed') AND end_at>?").get(old.id,now()))throw new AppError(409,`L’offre « ${old.label} » a des réservations en cours. Conservez-la en la désactivant plutôt que de la supprimer.`);
          db.prepare('DELETE FROM offers WHERE id=?').run(old.id);
        }
        const upsert=db.prepare('INSERT INTO offers (id,listing_id,unit,label,price,active,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET unit=excluded.unit,label=excluded.label,price=excluded.price,active=excluded.active');
        for(const o of nextOffers)upsert.run(o.id,row.id,o.unit,o.label||DURATIONS[o.unit].label,o.price,+o.active,now());
      }
      const fields=['title','description','type','city','neighborhood','address','capacity','bedrooms','beds','bathrooms','status'];
      db.prepare(`UPDATE listings SET ${fields.map(f=>`${f}=?`).join(',')},photos=?,amenities=?,rules=?,instant_booking=?,updated_at=? WHERE id=?`).run(...fields.map(f=>next[f]),JSON.stringify(next.photos),JSON.stringify(next.amenities),JSON.stringify(next.rules),+next.instantBooking,now(),row.id);
    })();
    res.json(hydrateListing(db,db.prepare('SELECT * FROM listings WHERE id=?').get(row.id),true));
  });
  router.patch('/listings/:listingId/status',requireAuth('owner','admin'),(req,res)=>{
    const row=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);assertListingAccess(req,row);
    const {status}=parse(z.object({status:z.enum(['draft','published','archived'])}).strict(),req.body);
    const listing=hydrateListing(db,row);if(status==='published')assertPublishable(listing,listing.offers);
    db.prepare('UPDATE listings SET status=?,updated_at=? WHERE id=?').run(status,now(),row.id);res.json(hydrateListing(db,db.prepare('SELECT * FROM listings WHERE id=?').get(row.id),true));
  });
  router.delete('/listings/:listingId',requireAuth('owner','admin'),(req,res)=>{
    const row=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);assertListingAccess(req,row);
    if(db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE listing_id=?').get(row.id).n){db.prepare("UPDATE listings SET status='archived',updated_at=? WHERE id=?").run(now(),row.id);return res.json({ok:true,archived:true,message:'L’historique est conservé : le logement a été archivé.'});}
    db.prepare('DELETE FROM listings WHERE id=?').run(row.id);res.json({ok:true,archived:false,message:'Le logement a été supprimé.'});
  });
  router.post('/listings/:listingId/offers',requireAuth('owner','admin'),(req,res)=>{
    const row=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);assertListingAccess(req,row);
    const input=parse(offerInput,req.body);
    if(db.prepare('SELECT id FROM offers WHERE listing_id=? AND unit=?').get(row.id,input.unit))throw new AppError(409,'Une offre existe déjà pour cette durée. Modifiez-la ou choisissez une autre unité.');
    const offerId=id('offer');db.prepare('INSERT INTO offers (id,listing_id,unit,label,price,active,created_at) VALUES (?,?,?,?,?,?,?)').run(offerId,row.id,input.unit,input.label||DURATIONS[input.unit].label,input.price,+input.active,now());
    res.status(201).json({...input,id:offerId});
  });
  router.patch('/offers/:offerId',requireAuth('owner','admin'),(req,res)=>{
    const offer=db.prepare('SELECT o.*,l.owner_id FROM offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=?').get(req.params.offerId);assertListingAccess(req,offer);
    const input=parse(offerInput.partial(),req.body);const next={...offer,...input};
    if(db.prepare('SELECT id FROM offers WHERE listing_id=? AND unit=? AND id<>?').get(offer.listing_id,next.unit,offer.id))throw new AppError(409,'Une offre existe déjà pour cette durée.');
    if(!next.active && offer.active){const all=db.prepare('SELECT active FROM offers WHERE listing_id=?').all(offer.listing_id);const listing=db.prepare('SELECT * FROM listings WHERE id=?').get(offer.listing_id);if(listing.status==='published')assertPublishable(listing,all.filter(o=>o.id!==offer.id).concat(next));}
    db.prepare('UPDATE offers SET unit=?,label=?,price=?,active=? WHERE id=?').run(next.unit,next.label,next.price,+next.active,offer.id);
    db.prepare('UPDATE listings SET updated_at=? WHERE id=?').run(now(),offer.listing_id);res.json({...next,active:!!next.active});
  });
  router.delete('/offers/:offerId',requireAuth('owner','admin'),(req,res)=>{
    const offer=db.prepare('SELECT o.*,l.owner_id,l.status FROM offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=?').get(req.params.offerId);assertListingAccess(req,offer);
    if(db.prepare("SELECT id FROM bookings WHERE offer_id=? AND status IN ('pending','confirmed') AND end_at>?").get(offer.id,now()))throw new AppError(409,'Cette offre a des réservations en cours. Désactivez-la plutôt que de la supprimer.');
    const remaining=db.prepare('SELECT active FROM offers WHERE listing_id=? AND id<>?').all(offer.listing_id,offer.id);
    if(offer.status==='published' && offer.active)assertPublishable(hydrateListing(db,db.prepare('SELECT * FROM listings WHERE id=?').get(offer.listing_id)),remaining);
    db.prepare('DELETE FROM offers WHERE id=?').run(offer.id);res.json({ok:true});
  });
  router.post('/listings/:listingId/availability',requireAuth('owner','admin'),(req,res)=>{
    const row=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);assertListingAccess(req,row);
    const input=parse(z.object({startAt:dateString,endAt:dateString,reason:z.string().trim().min(2).max(150).default('Indisponible')}).strict(),req.body);
    const interval={startAt:new Date(input.startAt).toISOString(),endAt:new Date(input.endAt).toISOString()};
    if(interval.endAt<=interval.startAt)throw new AppError(400,'La fin du blocage doit être après son début.');
    assertAvailable(db,row.id,interval);
    const blockId=id('block');db.prepare('INSERT INTO availability (id,listing_id,start_at,end_at,reason) VALUES (?,?,?,?,?)').run(blockId,row.id,interval.startAt,interval.endAt,input.reason);
    res.status(201).json({id:blockId,...interval,reason:input.reason});
  });
  router.delete('/availability/:blockId',requireAuth('owner','admin'),(req,res)=>{
    const block=db.prepare('SELECT a.*,l.owner_id FROM availability a JOIN listings l ON l.id=a.listing_id WHERE a.id=?').get(req.params.blockId);assertListingAccess(req,block);
    db.prepare('DELETE FROM availability WHERE id=?').run(block.id);res.json({ok:true});
  });
  router.post('/listings/:listingId/quote',(req,res)=>{
    const listing=db.prepare('SELECT * FROM listings WHERE id=?').get(req.params.listingId);
    if(!listing)throw new AppError(404,'Logement introuvable.');
    const input=parse(z.object({offerId:z.string(),startAt:dateString,quantity:z.number().int().min(1).max(30).default(1)}).strict(),req.body);
    res.json(quoteFor(db,listing,input));
  });

  router.get('/bookings',requireAuth(),(req,res)=>{
    const field=req.user.role==='admin'?null:req.user.role==='owner'?'b.owner_id':'b.renter_id';
    let bookings=db.prepare(`SELECT b.*,u.name AS renter_name,o.name AS owner_name,l.neighborhood FROM bookings b JOIN users u ON u.id=b.renter_id JOIN users o ON o.id=b.owner_id JOIN listings l ON l.id=b.listing_id ${field?`WHERE ${field}=?`:''} ORDER BY b.created_at DESC`).all(...(field?[req.user.id]:[]));
    if(req.query.status)bookings=bookings.filter(b=>b.status===req.query.status);
    res.json(bookings);
  });
  router.get('/bookings/:bookingId',requireAuth(),(req,res)=>{const booking=getBooking(db,req.params.bookingId);accessBooking(req,booking);res.json(booking);});
  router.post('/bookings',requireAuth('renter'),(req,res)=>{
    const input=parse(bookingInput,req.body);
    const bookingId=id('LK').toUpperCase();
    const result=db.transaction(()=>{
      const listing=db.prepare('SELECT * FROM listings WHERE id=?').get(input.listingId);
      if(!listing)throw new AppError(404,'Logement introuvable.');
      if(listing.owner_id===req.user.id)throw new AppError(400,'Vous ne pouvez pas réserver votre propre logement.');
      const quote=quoteFor(db,listing,input);
      db.prepare(`INSERT INTO bookings (id,listing_id,renter_id,owner_id,offer_id,status,start_at,end_at,unit,quantity,rental_price,platform_fee,total,unit_price,listing_title,listing_city,listing_photo,message,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(bookingId,listing.id,req.user.id,listing.owner_id,quote.offerId,listing.instant_booking?'confirmed':'pending',quote.startAt,quote.endAt,quote.unit,quote.quantity,quote.rentalPrice,quote.platformFee,quote.total,quote.unitPrice,listing.title,`${listing.city} · ${listing.neighborhood}`,JSON.parse(listing.photos)[0]||'/images/loka-hero.webp',input.message,now(),now());
      return getBooking(db,bookingId);
    })();
    res.status(201).json(result);
  });
  router.patch('/bookings/:bookingId/status',requireAuth(),(req,res)=>{
    const input=parse(z.object({status:z.enum(['confirmed','declined','cancelled']),reason:z.string().trim().max(500).default('')}).strict(),req.body);
    db.transaction(()=>{
      const booking=getBooking(db,req.params.bookingId);accessBooking(req,booking);
      const isManager=['admin','owner'].includes(req.user.role) && (req.user.role==='admin'||booking.owner_id===req.user.id);
      if(input.status==='cancelled'){
        if(!['pending','confirmed'].includes(booking.status)||new Date(booking.start_at)<=new Date())throw new AppError(409,'Seule une réservation à venir, en attente ou confirmée, peut être annulée.');
      }else if(!isManager||booking.status!=='pending')throw new AppError(409,'Seul le propriétaire peut répondre à une demande en attente.');
      if(input.status==='confirmed'){
        if(booking.listing_status!=='published')throw new AppError(409,'Le logement doit être publié pour confirmer une demande.');
        const other=db.prepare("SELECT start_at AS startAt,end_at AS endAt FROM bookings WHERE listing_id=? AND id<>? AND status IN ('pending','confirmed')").all(booking.listing_id,booking.id);
        const blocks=db.prepare('SELECT start_at AS startAt,end_at AS endAt FROM availability WHERE listing_id=?').all(booking.listing_id);
        if(other.concat(blocks).some(p=>p.startAt<booking.end_at&&p.endAt>booking.start_at))throw new AppError(409,'Un conflit de disponibilité empêche la confirmation.');
      }
      db.prepare('UPDATE bookings SET status=?,cancellation_reason=?,updated_at=? WHERE id=?').run(input.status,input.reason,now(),booking.id);
    })();res.json(getBooking(db,req.params.bookingId));
  });

  const upload=multer({storage:multer.diskStorage({destination:uploadsDir,filename:(_req,file,cb)=>cb(null,`${randomUUID()}${{ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp' }[file.mimetype]}`)}),limits:{fileSize:5*1024*1024,files:1},fileFilter:(_req,file,cb)=>cb(['image/jpeg','image/png','image/webp'].includes(file.mimetype)?null:new AppError(400,'Formats acceptés : JPG, PNG ou WebP.'),['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
  router.post('/uploads',requireAuth('owner','admin'),upload.single('photo'),(req,res)=>{
    if(!req.file)throw new AppError(400,'Choisissez une photo à importer.');
    const bytes=fs.readFileSync(req.file.path).subarray(0,12);
    const valid=(bytes[0]===0xff&&bytes[1]===0xd8)||(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
    if(!valid){fs.unlinkSync(req.file.path);throw new AppError(400,'Le fichier n’est pas une image JPG, PNG ou WebP valide.');}
    res.status(201).json({url:`/uploads/${req.file.filename}`});
  });
  router.get('/owner/overview',requireAuth('owner','admin'),(req,res)=>{
    const scope=req.user.role==='admin'?'':'WHERE owner_id=?';const params=req.user.role==='admin'?[]:[req.user.id];
    const listings=db.prepare(`SELECT status,COUNT(*) AS n FROM listings ${scope} GROUP BY status`).all(...params);
    const bookings=db.prepare(`SELECT status,COUNT(*) AS n,COALESCE(SUM(rental_price),0) AS amount FROM bookings ${scope} GROUP BY status`).all(...params);
    res.json({listings,bookings,pending:bookings.find(b=>b.status==='pending')?.n||0,revenue:bookings.filter(b=>['confirmed','completed'].includes(b.status)).reduce((n,b)=>n+b.amount,0)});
  });
  router.get('/admin/overview',requireAuth('admin'),(_req,res)=>{
    const count=(table,where='')=>db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`).get().n;
    res.json({stats:{users:count('users'),listings:count('listings'),published:count('listings',"WHERE status='published'"),bookings:count('bookings'),pending:count('bookings',"WHERE status='pending'"),volume:db.prepare("SELECT COALESCE(SUM(total),0) AS n FROM bookings WHERE status IN ('confirmed','completed')").get().n},users:db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(publicUser),listings:db.prepare('SELECT * FROM listings ORDER BY updated_at DESC').all().map(l=>hydrateListing(db,l)),bookings:db.prepare('SELECT b.*,u.name AS renter_name FROM bookings b JOIN users u ON u.id=b.renter_id ORDER BY b.created_at DESC').all()});
  });
  router.use((_req,_res,next)=>next(new AppError(404,'Cette ressource est introuvable.')));
  router.use((error,_req,res,_next)=>{
    if(error instanceof multer.MulterError)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'La photo dépasse la limite de 5 Mo.':'Import impossible. Choisissez une seule image JPG, PNG ou WebP.'});
    if(error.type==='entity.parse.failed')return res.status(400).json({error:'Les données envoyées ne sont pas valides.'});
    const status=error.status||500;
    if(status===500)console.error(error);
    res.status(status).json({error:status===500?'Une erreur est survenue. Réessayez dans un instant.':error.message,details:error.details});
  });
  return router;
}
