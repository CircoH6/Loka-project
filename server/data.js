import { hashPassword } from './auth.js';
import { calculatePrice, addMonthsClamped } from './domain.js';

export const DEMO_ACCOUNTS = [
  { id: 'user-grace', name: 'Grâce Hounkpatin', email: 'grace@loka.demo', role: 'renter', city: 'Cotonou', color: '#f1dfcb' },
  { id: 'user-rodrigue', name: 'Rodrigue Dossou', email: 'rodrigue@loka.demo', role: 'owner', city: 'Cotonou', color: '#dfe8d9' },
  { id: 'user-nadege', name: 'Nadège Assogba', email: 'nadege@loka.demo', role: 'admin', city: 'Porto-Novo', color: '#e6e0ef' },
];
const rules = ['Respecter le calme du voisinage après 22 h.', 'Ne pas fumer à l’intérieur du logement.', 'Prévenir le propriétaire de votre heure d’arrivée.', 'Les fêtes et événements ne sont pas autorisés.'];
const descriptions = {
  apartment: 'Posez vos valises dans ce logement lumineux, pensé pour vous faire sentir chez vous. Un salon accueillant, une cuisine équipée et une connexion Wi-Fi fiable vous accompagnent, le temps d’une escapade ou d’un séjour professionnel. Le quartier vivant vous permet de rejoindre facilement les marchés, les cafés et les transports. Les tarifs s’adaptent à votre rythme, de quelques heures à plusieurs mois.',
  villa: 'Une parenthèse de douceur dans un écrin de verdure. Cette villa spacieuse associe les matières naturelles au confort contemporain : chambres aérées, séjour ouvert sur le jardin et espaces extérieurs invitants. Profitez d’un cadre calme pour vos retrouvailles en famille, votre télétravail ou un séjour longue durée. Le propriétaire vous accueille avec les bonnes adresses du quartier.',
  studio: 'Un petit cocon fonctionnel, idéal pour une escapade à deux ou un déplacement professionnel. Vous trouverez un coin nuit confortable, un espace pour travailler et tout le nécessaire pour préparer vos repas. Situé à proximité des commerces et des axes de transport, ce studio est une adresse pratique pour découvrir la ville à votre rythme.',
};
const listingData = [
  { id:'l-01', title:'Le patio des possibles', type:'Villa', city:'Cotonou', neighborhood:'Fidjrossè', address:'Rue de la plage, Fidjrossè', capacity:6, bedrooms:3, beds:4, bathrooms:2, photos:['loka-hero','interior-1','apartment-1'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Piscine','Parking','Jardin','Groupe électrogène'], prices:{hour:8000,half_day:25000,day:35000,night:45000,week:245000,month:780000}, instant:1, rating:4.96, reviews:38, description:descriptions.villa },
  { id:'l-02', title:'Un appartement, un peu de soleil', type:'Appartement', city:'Cotonou', neighborhood:'Haie Vive', address:'Avenue Jean-Paul II, Haie Vive', capacity:4, bedrooms:2, beds:2, bathrooms:2, photos:['apartment-1','interior-2','apartment-2'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Parking','Espace de travail','Sécurité 24/7'], prices:{hour:4000,half_day:12000,day:18000,night:25000,week:145000,month:460000}, instant:1, rating:4.92, reviews:26, description:descriptions.apartment },
  { id:'l-03', title:'Le cocon de Porto-Novo', type:'Studio', city:'Porto-Novo', neighborhood:'Ouando', address:'Rue des marchés, Ouando', capacity:2, bedrooms:1, beds:1, bathrooms:1, photos:['studio-1','apartment-3','interior-2'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Espace de travail','Eau chaude'], prices:{hour:2500,half_day:7500,day:11000,night:15000,week:85000,month:270000}, instant:1, rating:4.88, reviews:19, description:descriptions.studio },
  { id:'l-04', title:'La résidence aux palmiers', type:'Résidence', city:'Abomey-Calavi', neighborhood:'Arconville', address:'Route d’Arconville, près du carrefour', capacity:4, bedrooms:2, beds:2, bathrooms:1, photos:['residence-1','apartment-2','interior-1'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Parking','Balcon','Groupe électrogène','Sécurité 24/7'], prices:{hour:3500,half_day:10000,day:15000,night:20000,week:115000,month:350000}, instant:0, rating:4.85, reviews:31, description:descriptions.apartment },
  { id:'l-05', title:'Les jours tranquilles', type:'Appartement', city:'Cotonou', neighborhood:'Cadjèhoun', address:'Rue de l’entente, Cadjèhoun', capacity:3, bedrooms:1, beds:2, bathrooms:1, photos:['apartment-2','interior-2','apartment-3'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Balcon','Espace de travail','Lave-linge'], prices:{night:22000,week:130000,month:390000}, instant:1, rating:4.90, reviews:22, description:descriptions.apartment },
  { id:'l-06', title:'La maison du manguier', type:'Villa', city:'Porto-Novo', neighborhood:'Tokpota', address:'Quartier Tokpota, rue du manguier', capacity:8, bedrooms:4, beds:5, bathrooms:3, photos:['villa-2','interior-1','apartment-1'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Parking','Jardin','Eau chaude','Groupe électrogène'], prices:{day:30000,night:40000,week:230000,month:720000}, instant:0, rating:4.94, reviews:17, description:descriptions.villa },
  { id:'l-07', title:'Votre escale à Zogbadjè', type:'Studio', city:'Abomey-Calavi', neighborhood:'Zogbadjè', address:'À proximité du campus d’Abomey-Calavi', capacity:2, bedrooms:1, beds:1, bathrooms:1, photos:['studio-2','apartment-3','interior-2'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Espace de travail','Parking'], prices:{hour:2000,half_day:6000,day:9000,night:12000,week:70000,month:210000}, instant:1, rating:4.81, reviews:43, description:descriptions.studio },
  { id:'l-08', title:'L’adresse des artistes', type:'Chambre privée', city:'Porto-Novo', neighborhood:'Centre-ville', address:'Rue Toffa, Centre-ville', capacity:2, bedrooms:1, beds:1, bathrooms:1, photos:['room-1','interior-1','apartment-3'], amenities:['Wi-Fi','Climatisation','Eau chaude','Espace de travail'], prices:{hour:2000,day:8000,night:12000,week:65000,month:190000}, instant:1, rating:4.87, reviews:14, description:descriptions.studio },
  { id:'l-09', title:'Le refuge de Ganhi', type:'Appartement', city:'Cotonou', neighborhood:'Ganhi', address:'Boulevard Saint-Michel, Ganhi', capacity:4, bedrooms:2, beds:2, bathrooms:1, photos:['apartment-3','interior-1','interior-2'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Parking','Lave-linge','Sécurité 24/7'], prices:{night:28000,week:160000,month:480000}, instant:0, rating:4.83, reviews:29, description:descriptions.apartment },
  { id:'l-10', title:'La villa aux heures dorées', type:'Villa', city:'Cotonou', neighborhood:'Kindonou', address:'Quartier Kindonou, voie pavée', capacity:6, bedrooms:3, beds:3, bathrooms:2, photos:['villa-3','interior-1','apartment-2'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Parking','Jardin','Piscine','Groupe électrogène'], prices:{night:50000,week:280000,month:850000}, instant:0, rating:4.97, reviews:12, description:descriptions.villa },
  { id:'l-11', title:'Le nid d’Akassato', type:'Appartement', city:'Abomey-Calavi', neighborhood:'Akassato', address:'Route d’Akassato, zone résidentielle', capacity:4, bedrooms:2, beds:2, bathrooms:1, photos:['interior-1','interior-2','apartment-3'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Parking','Balcon','Jardin'], prices:{night:18000,week:100000,month:300000}, instant:1, rating:4.80, reviews:21, description:descriptions.apartment },
  { id:'l-12', title:'Le jardin de Djassin', type:'Villa', city:'Porto-Novo', neighborhood:'Djassin', address:'Voie de Djassin, quartier résidentiel', capacity:5, bedrooms:3, beds:3, bathrooms:2, photos:['villa-4','interior-1','apartment-1'], amenities:['Wi-Fi','Climatisation','Cuisine équipée','Piscine','Parking','Jardin'], prices:{night:35000,week:195000,month:620000}, instant:0, rating:4.89, reviews:16, status:'draft', description:descriptions.villa },
  { id:'l-13', title:'L’atelier de Catchi', type:'Studio', city:'Porto-Novo', neighborhood:'Catchi', address:'Rue de Catchi, Porto-Novo', capacity:2, bedrooms:1, beds:1, bathrooms:1, photos:['studio-1','apartment-3'], amenities:['Wi-Fi','Climatisation','Espace de travail'], prices:{night:14000,month:240000}, instant:1, rating:4.70, reviews:8, status:'archived', description:descriptions.studio },
];

export function seedDatabase(db) {
  const now = new Date();
  const todayBenin = new Date(now.getTime() + 3600000).toISOString().slice(0,10);
  const at = (days, hour = 13) => { const d = new Date(`${todayBenin}T${String(hour).padStart(2,'0')}:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString(); };
  const tx = db.transaction(() => {
    const insertUser = db.prepare('INSERT INTO users (id,name,email,password_hash,role,city,color,bio,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const u of DEMO_ACCOUNTS) insertUser.run(u.id,u.name,u.email,hashPassword('Loka2026!'),u.role,u.city,u.color,u.role==='owner'?'Des lieux accueillants, des séjours à votre rythme. Bienvenue chez vous.':u.role==='renter'?'Curieuse, toujours partante pour découvrir le Bénin.':'L’équipe Loka, au service des voyageurs et des propriétaires.',at(-90));
    for (const [i, email, name, role, city] of [[1,'ami@loka.demo','Ami Tokpo','renter','Porto-Novo'],[2,'selom@loka.demo','Sélom Agbodjan','renter','Abomey-Calavi'],[3,'farid@loka.demo','Faridath Ali','renter','Cotonou'],[4,'joel@loka.demo','Joël Kpadonou','owner','Porto-Novo'],[5,'lea@loka.demo','Léa Gbaguidi','renter','Cotonou']]) {
      insertUser.run(`user-demo-${i}`,name,email,hashPassword('Loka2026!'),role,city,['#e4e9d8','#eee0d7','#dce8eb'][i%3],'Compte de démonstration Loka.',at(-60+i*5));
    }
    const insertListing = db.prepare(`INSERT INTO listings (id,owner_id,title,description,type,city,neighborhood,address,capacity,bedrooms,beds,bathrooms,photos,amenities,rules,status,instant_booking,rating,review_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertOffer = db.prepare('INSERT INTO offers (id,listing_id,unit,label,price,active,created_at) VALUES (?,?,?,?,?,?,?)');
    const labels = {hour:'À l’heure',half_day:'La demi-journée',day:'La journée',night:'La nuit',week:'La semaine',month:'Le mois'};
    for (const [i,l] of listingData.entries()) {
      const owner = ['l-03','l-06','l-08','l-12','l-13'].includes(l.id) ? 'user-demo-4' : 'user-rodrigue';
      insertListing.run(l.id,owner,l.title,l.description,l.type,l.city,l.neighborhood,l.address,l.capacity,l.bedrooms,l.beds,l.bathrooms,JSON.stringify(l.photos.map(p=>`/images/${p}.webp`)),JSON.stringify(l.amenities),JSON.stringify(rules),l.status||'published',l.instant,l.rating,l.reviews,at(-45+i),now.toISOString());
      for(const [unit,price] of Object.entries(l.prices)) insertOffer.run(`${l.id}-${unit}`,l.id,unit,labels[unit],price,1,now.toISOString());
    }
    db.prepare('INSERT INTO availability (id,listing_id,start_at,end_at,reason) VALUES (?,?,?,?,?)').run('block-demo-1','l-01',at(5),at(7),'Entretien de la piscine');
    const insertBooking = db.prepare(`INSERT INTO bookings (id,listing_id,renter_id,owner_id,offer_id,status,start_at,end_at,unit,quantity,rental_price,platform_fee,total,unit_price,listing_title,listing_city,listing_photo,message,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const booking = (id,lid,rid,unit,qty,start,status,daysAgo=2) => {
      const l=listingData.find(x=>x.id===lid); const offerId=`${lid}-${unit}`; const price=l.prices[unit]; const p=calculatePrice(price,qty);
      const startDate=new Date(start); const end=unit==='month'?addMonthsClamped(startDate,qty):new Date(startDate.getTime()+qty*({hour:1,half_day:6,day:12,night:12,week:168}[unit])*3600000);
      insertBooking.run(id,lid,rid,db.prepare('SELECT owner_id FROM listings WHERE id=?').get(lid).owner_id,offerId,status,start,end.toISOString(),unit,qty,p.rentalPrice,p.platformFee,p.total,price,l.title,`${l.city} · ${l.neighborhood}`,`/images/${l.photos[0]}.webp`,'Bonjour, j’ai hâte de découvrir votre logement. Séjour de démonstration.',at(-daysAgo),now.toISOString());
    };
    booking('LK-DEMO1001','l-02','user-grace','night',2,at(3,19),'confirmed');
    booking('LK-DEMO1002','l-03','user-grace','week',1,at(14,13),'pending');
    booking('LK-DEMO1003','l-01','user-grace','night',2,at(-20,19),'completed',25);
    booking('LK-DEMO1004','l-04','user-grace','night',1,at(-40,19),'cancelled',45);
    booking('LK-DEMO1005','l-01','user-demo-1','week',1,at(8,13),'pending');
    booking('LK-DEMO1006','l-05','user-demo-2','night',3,at(10,19),'confirmed');
    booking('LK-DEMO1007','l-06','user-demo-3','month',2,at(20,13),'pending');
    booking('LK-DEMO1008','l-07','user-demo-5','month',1,at(-35,13),'completed',40);
    booking('LK-DEMO1009','l-08','user-demo-1','night',1,at(4,19),'confirmed');
    booking('LK-DEMO1010','l-09','user-demo-2','week',1,at(12,13),'pending');
    const fav=db.prepare('INSERT INTO favorites (user_id,listing_id) VALUES (?,?)');
    fav.run('user-grace','l-01');fav.run('user-grace','l-03');fav.run('user-demo-1','l-02');
  });
  tx();
}
export function resetDatabase(db) {
  db.transaction(() => {
    for (const table of ['favorites','bookings','availability','offers','listings','sessions','users']) db.prepare(`DELETE FROM ${table}`).run();
    seedDatabase(db);
  })();
}
