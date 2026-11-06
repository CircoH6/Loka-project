import express from 'express';
import path from 'node:path';
import { createDatabase } from './db.js';
import { createApi } from './api.js';

const app = express();
const db = createDatabase();
const uploadsDir = path.resolve(process.env.LOKA_UPLOADS_DIR || 'data/uploads');
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');next();});
app.use('/api',createApi(db,{uploadsDir}));
app.use('/uploads',express.static(uploadsDir,{maxAge:'1d',immutable:true}));
let vite;
if(process.env.NODE_ENV==='production'){
  app.use(express.static(path.resolve('dist')));
  app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
}else{
  const { createServer } = await import('vite');
  vite = await createServer({server:{middlewareMode:true,hmr:false,host:'0.0.0.0',allowedHosts:true},appType:'spa'});
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT)||3000;
const server=app.listen(port,'0.0.0.0',()=>console.log(`Loka est prêt sur http://0.0.0.0:${port} — interface française, paiements simulés.`));
async function shutdown(){server.close();if(vite)await vite.close();db.close();process.exit(0);}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
