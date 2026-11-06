export { DURATIONS, CITIES, TYPES, AMENITIES, PLATFORM_FEE_RATE, calculatePrice, addMonthsClamped, durationLabel } from '../../server/domain.js';
export const TZ='Africa/Porto-Novo';
export const money=value=>`${new Intl.NumberFormat('fr-BJ',{maximumFractionDigits:0}).format(value||0)} FCFA`;
export const number=value=>new Intl.NumberFormat('fr-BJ').format(value||0);
export function dateLabel(value,options={}){const {year,...rest}=options;const yearOption=year===true?'numeric':year||undefined;return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',timeZone:TZ,...rest,...(yearOption?{year:yearOption}:{})}).format(new Date(value));}
export function timeLabel(value){return new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:TZ}).format(new Date(value));}
export function dateRange(start,end,{year=false,time=true}={}){
  const a=dateLabel(start,{year}),b=dateLabel(end,{year});
  const dates=a===b?a:a+' → '+b;
  if(!time)return dates;
  return dates+' · '+timeLabel(start)+(a===b?' – ':' → ')+timeLabel(end);
}
export function beninNow(){return new Date(Date.now()+3600000);}
export function futureDate(days=1){const d=beninNow();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export const toISO=(date,time='14:00')=>`${date}T${time||'14:00'}:00+01:00`;
export function inputDateTime(value){const d=new Date(new Date(value).getTime()+3600000).toISOString();return {date:d.slice(0,10),time:d.slice(11,16)};}
export const unitSuffix=unit=>({hour:'heure',half_day:'demi-journée',day:'jour',night:'nuit',week:'semaine',month:'mois'}[unit]||'séjour');
export const roleLabel=role=>({renter:'Voyageur',owner:'Propriétaire',admin:'Administrateur'}[role]||'Voyageur');
export const homeForRole=role=>role==='owner'?'/espace-hote':role==='admin'?'/administration':'/';
export function safeNext(value,fallback='/'){return value&&value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith('/api')?value:fallback;}
export const initials=name=>(name||'Loka').split(' ').map(s=>s[0]).slice(0,2).join('');
export const listingStatus={draft:'Brouillon',published:'Publié',archived:'Archivé'};
export const bookingStatus={pending:'En attente',confirmed:'Confirmée',declined:'Refusée',cancelled:'Annulée',completed:'Terminée'};
export const cx=(...values)=>values.filter(Boolean).join(' ');
