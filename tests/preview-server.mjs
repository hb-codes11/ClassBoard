// Local UI fixture only. Never served by the production classboard/ deployment.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  let file=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  if(url.pathname==='/preview'){
   let html=await readFile(resolve(root,'classboard/index.html'),'utf8');
   html=html.replace('<head>','<head><base href="/classboard/">').replace(/<script[^>]+src="(?:https:\/\/cdn.jsdelivr.net\/npm\/@supabase[^\"]*|supabase-config.js|classboard-auth.js[^\"]*|\/_vercel\/insights\/script.js)"[^>]*><\/script>/g,'');
   html=html.replace('<script type="module" src="./study-plan.js?v=1"></script>','<script src="/tests/study-fixture.js"></script><script type="module" src="./study-plan.js?v=1"></script>');
   res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;
  }
  const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'})[extname(file)]||'text/plain'}).end(content);
 }catch{res.writeHead(404).end('Not found');}
}).listen(4186,'127.0.0.1',()=>console.log('Disposable study fixture: http://127.0.0.1:4186/preview'));
