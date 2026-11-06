# Loka

**Un lieu à vous, à votre rythme.** Prototype full-stack de location flexible au Bénin : quelques heures, une demi-journée, une journée, une nuit, une semaine ou plusieurs mois. Interface en français, prix en FCFA, paiements **simulés**.

## Démarrer

Prérequis : Node.js >= 22.12.

```bash
npm install
npm run dev
```

Le serveur démarre sur `http://localhost:3000` (API + interface Vite). En production :

```bash
npm run build
npm start
```

Variables utiles : `PORT`, `LOKA_DB_PATH`, `LOKA_UPLOADS_DIR`, `COOKIE_SECURE`.

## Comptes de démonstration

Connexion en un clic depuis l’écran de connexion, ou avec :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Voyageur | `grace@loka.demo` | `Loka2026!` |
| Propriétaire | `rodrigue@loka.demo` | `Loka2026!` |
| Administrateur | `nadege@loka.demo` | `Loka2026!` |

## Fonctionnalités

- Recherche par ville/quartier, date, durée, voyageurs et filtres.
- fiches logements, photos, équipements, règles, calendrier de disponibilité.
- Devis en temps réel : prix du séjour + frais Loka de 5 % séparés, en FCFA.
- Réservation de démonstration : immédiate ou sur demande, statuts clairs.
- Espace voyageur : favoris, séjours, profil.
- Espace propriétaire : CRUD logements/offres, publication/archivage, disponibilités, demandes.
- Espace administrateur : vue d’ensemble logements, membres, réservations.
- Persistance SQLite : utilisateurs, sessions, logements, offres, disponibilités, réservations, favoris.

## Données et tests

La base est créée/amorcée automatiquement dans `data/loka.db`. Les photos importées vont dans `data/uploads/`. Ces dossiers sont ignorés par Git.

```bash
npm test       # tests unitaires et API
npm run seed   # réinitialise les données de démonstration
```

## Important

Loka est un **prototype** : logements, prix, avis et paiements sont fictifs. Aucun paiement réel n’est traité, aucune coordonnée bancaire n’est demandée. Les photos sont des illustrations (voir `public/images/SOURCES.md`).
