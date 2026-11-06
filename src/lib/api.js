import { useEffect, useState, useCallback } from 'react';
export class ApiError extends Error { constructor(message,status,details){super(message);this.status=status;this.details=details;} }
export async function api(path,{method='GET',body,signal,...options}={}) {
  const isForm=body instanceof FormData;
  const response=await fetch(`/api${path}`,{method,credentials:'same-origin',signal,headers:body&&!isForm?{'Content-Type':'application/json'}:{},...(body?{body:isForm?body:JSON.stringify(body)}:{}),...options});
  const data=await response.json().catch(()=>({error:'Le serveur est momentanément indisponible. Réessayez.'}));
  if(!response.ok)throw new ApiError(data.error||'Une erreur est survenue. Réessayez.',response.status,data.details);
  return data;
}
export function useResource(path) {
  const [state,setState]=useState({data:null,loading:!!path,error:null});
  const [version,setVersion]=useState(0);
  const reload=useCallback(()=>setVersion(v=>v+1),[]);
  useEffect(()=>{
    if(!path){setState({data:null,loading:false,error:null});return;}
    const controller=new AbortController();let active=true;
    setState({data:null,loading:true,error:null});
    api(path,{signal:controller.signal}).then(data=>{if(active)setState({data,loading:false,error:null});}).catch(error=>{if(active&&error.name!=='AbortError')setState({data:null,loading:false,error});});
    return ()=>{active=false;controller.abort();};
  },[path,version]);
  return {...state,reload,setData:data=>setState(s=>({...s,data:typeof data==='function'?data(s.data):data}))};
}
export function queryString(values){const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==''&&v!=null&&v!==false)p.set(k,String(v));});return p.toString();}
