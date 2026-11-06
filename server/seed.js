import { createDatabase } from './db.js';
import { resetDatabase } from './data.js';
const db=createDatabase();
if(process.argv.includes('--reset')){resetDatabase(db);console.log('Données de démonstration Loka réinitialisées. Aucun paiement réel.');}
else console.log('Base initialisée. Utilisez npm run seed pour restaurer les données de démonstration.');
db.close();
