import { Component, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useApp } from './context';
import Layout from './components/Layout';
import { Toasts, Loading, Button, Logo, EmptyState, ErrorBox } from './components/ui';
import { homeForRole, safeNext, roleLabel } from './lib/utils';
import Home from './pages/Home';
import Listing from './pages/Listing';
import Booking from './pages/Booking';
import { Bookings, Favorites } from './pages/Bookings';
import Profile from './pages/Profile';
import Login from './pages/Login';
import HowItWorks from './pages/HowItWorks';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerListings from './pages/OwnerListings';
import ListingEditor from './pages/ListingEditor';
import Availability from './pages/Availability';
import Admin from './pages/Admin';

function RouteEffects(){const location=useLocation();useEffect(()=>{if(location.hash){const timer=setTimeout(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'smooth',block:'start'}),160);return()=>clearTimeout(timer);}window.scrollTo({top:0,behavior:'instant'});},[location.pathname,location.hash]);useEffect(()=>{const p=location.pathname;document.title=p.startsWith('/espace-hote')?'Mon espace propriétaire — Loka':p.startsWith('/administration')?'Administration — Loka':p.startsWith('/mes-sejours')?'Mes réservations — Loka':p.startsWith('/connexion')?'Bienvenue chez vous — Loka':p.startsWith('/reserver')?'Votre réservation — Loka':p.startsWith('/logements')?'Votre prochain chez-vous — Loka':'Loka — Un lieu à vous, à votre rythme.';},[location.pathname]);return null;}
function Protected({roles,children}){const {user,sessionLoading,sessionError,refreshSession}=useApp();const location=useLocation();if(sessionLoading)return <Loading full/>;if(sessionError)return <div className="container page-pad"><ErrorBox error={sessionError} onRetry={refreshSession}/></div>;if(!user)return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname+location.search)}`} replace/>;if(roles&&!roles.includes(user.role))return <div className="container page-pad"><EmptyState icon={ShieldCheck} title={`Un espace pour les ${roleLabel(roles[0]).toLowerCase()}s`} description={`Vous êtes connecté en tant que ${roleLabel(user.role).toLowerCase()}. Changez de compte de démonstration pour découvrir cet espace.`} action={<div className="button-row"><Button to={`/connexion?role=${roles[0]}&next=${encodeURIComponent(location.pathname+location.search)}`}>Changer de compte</Button><Button to={homeForRole(user.role)} variant="secondary">Mon espace</Button></div>}/></div>;return children;}
class ErrorBoundary extends Component{state={error:null};static getDerivedStateFromError(error){return {error};}render(){if(this.state.error)return <div className="fatal-error"><Logo/><h1>Un petit contretemps.</h1><p>Rechargez la page pour retrouver votre chemin.</p><Button onClick={()=>window.location.reload()}>Recharger Loka</Button></div>;return this.props.children;}}
export default function App(){return <ErrorBoundary><RouteEffects/><Routes><Route element={<Layout/>}><Route index element={<Home/>}/><Route path="logements/:listingId" element={<Listing/>}/><Route path="reserver/:listingId" element={<Booking/>}/><Route path="connexion" element={<Login/>}/><Route path="comment-ca-marche" element={<HowItWorks/>}/><Route path="mes-sejours" element={<Protected><Bookings/></Protected>}/><Route path="favoris" element={<Protected roles={['renter']}><Favorites/></Protected>}/><Route path="profil" element={<Protected><Profile/></Protected>}/><Route path="espace-hote" element={<Protected roles={['owner']}><OwnerDashboard/></Protected>}/><Route path="espace-hote/logements" element={<Protected roles={['owner']}><OwnerListings/></Protected>}/><Route path="espace-hote/logements/nouveau" element={<Protected roles={['owner']}><ListingEditor/></Protected>}/><Route path="espace-hote/logements/:listingId/modifier" element={<Protected roles={['owner']}><ListingEditor/></Protected>}/><Route path="espace-hote/logements/:listingId/disponibilites" element={<Protected roles={['owner']}><Availability/></Protected>}/><Route path="administration" element={<Protected roles={['admin']}><Admin/></Protected>}/><Route path="*" element={<div className="container page-pad"><EmptyState title="Ce chemin ne mène à aucun logement." description="La page a peut-être changé d’adresse. Reprenons l’exploration." action={<Button to="/">Retour à l’exploration<ArrowLeft size={17}/></Button>}/></div>}/></Route></Routes><Toasts/></ErrorBoundary>;}
