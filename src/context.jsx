import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './lib/api';
import { CITIES, TYPES, AMENITIES, DURATIONS } from './lib/utils';
const AppContext=createContext(null);
export function AppProvider({children}){
  const [user,setUser]=useState(null),[sessionLoading,setSessionLoading]=useState(true),[sessionError,setSessionError]=useState(null);
  const [favorites,setFavorites]=useState([]),[toasts,setToasts]=useState([]),[meta,setMeta]=useState({cities:CITIES,types:TYPES,amenities:AMENITIES,durations:DURATIONS,feeRate:.05});
  const toast=useCallback((message,type='success')=>{const id=crypto.randomUUID();setToasts(t=>[...t.slice(-3),{id,message,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),5000);},[]);
  const refreshSession=useCallback(async()=>{setSessionLoading(true);setSessionError(null);try{const data=await api('/session');setUser(data.user);setFavorites(data.favorites);}catch(e){setSessionError(e.message);}finally{setSessionLoading(false);}},[]);
  useEffect(()=>{refreshSession();api('/meta').then(setMeta).catch(()=>{});},[refreshSession]);
  const afterLogin=data=>{setUser(data.user);setFavorites([]);api('/favorites').then(setFavorites).catch(()=>{});toast(`Bienvenue, ${data.user.name.split(' ')[0]} !`);};
  const loginDemo=async userId=>{const data=await api('/auth/demo',{method:'POST',body:{userId}});afterLogin(data);return data.user;};
  const login=async body=>{const data=await api('/auth/login',{method:'POST',body});afterLogin(data);return data.user;};
  const register=async body=>{const data=await api('/auth/register',{method:'POST',body});afterLogin(data);return data.user;};
  const logout=async()=>{try{await api('/auth/logout',{method:'POST'});setUser(null);setFavorites([]);toast('Vous êtes déconnecté. À bientôt sur Loka !');}catch(e){toast(e.message,'error');}};
  const toggleFavorite=async listingId=>{
    if(!user)return false;
    const saved=favorites.includes(listingId);const previous=favorites;
    setFavorites(f=>saved?f.filter(x=>x!==listingId):[...f,listingId]);
    try{await api(`/favorites/${listingId}`,{method:saved?'DELETE':'PUT'});toast(saved?'Retiré de vos favoris.':'Un joli coup de cœur, enregistré.');return true;}
    catch(e){setFavorites(previous);toast(e.message,'error');return false;}
  };
  return <AppContext.Provider value={{user,setUser,sessionLoading,sessionError,refreshSession,favorites,toggleFavorite,loginDemo,login,register,logout,meta,toast,toasts,dismissToast:id=>setToasts(t=>t.filter(x=>x.id!==id))}}>{children}</AppContext.Provider>;
}
export const useApp=()=>useContext(AppContext);
