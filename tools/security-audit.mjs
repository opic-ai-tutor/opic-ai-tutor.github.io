
import {spawn} from 'node:child_process';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const html=(await readFile('index.html','utf8')).replace(/\r\n?/g,'\n');
const script=html.replace('render();\nif(stateReset)','window.audit={vault,openSettings,authHeaders,apiFetch};\nrender();\nif(stateReset)');
const probe=script.replace(/'sha256-[^']+'/,"'sha256-"+createHash('sha256').update(script.match(/<script>([\s\S]*?)<\/script>/)[1]).digest('base64')+"'");
const worker="self.oninstall=()=>self.skipWaiting();self.onactivate=e=>e.waitUntil(clients.claim());self.onfetch=e=>{if(e.request.url.endsWith('/replaced'))e.respondWith(new Response('<input id=k><script>k.oninput=()=>localStorage.setItem(\"captured\",k.value)</script>',{headers:{'Content-Type':'text/html'}}))}";
const server=createServer((q,r)=>{
 const p=q.url;
 r.setHeader('Content-Type',p==='/sw.js'||p==='/asset.js'?'application/javascript':'text/html; charset=utf-8');
 r.end(p==='/sw.js'?worker:p==='/asset.js'?'window.pwned=1':p==='/probe'?probe:p==='/frame'?'<iframe src="/app"></iframe>':p==='/blank'?'<title>blank</title>':html);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'opic-audit-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--no-first-run','--disable-background-networking','--disable-component-update','--no-proxy-server','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+profile,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f){for(let i=0;i<100;i++){const v=await f();if(v)return v;await wait(50);}throw Error('timeout');}
let ws,id=0,mock=null,n=0,errors=0;
const pending=new Map(),requests=[],paused=[];
function c(method,params={}){const i=++id;return new Promise((r,j)=>{const t=setTimeout(()=>j(Error(method+' timeout')),7000);pending.set(i,m=>{clearTimeout(t);m.error?j(Error(m.error.message)):r(m.result);});ws.send(JSON.stringify({id:i,method,params}));});}
async function e(expression){const r=await c('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const f=(fn,...args)=>e('('+fn.toString()+')(...'+JSON.stringify(args)+')');
async function nav(p='/app'){const navResult=await c('Page.navigate',{url:base+p});if(navResult.errorText)console.log('NAV',navResult,await e('location.href'));await until(()=>e('location.pathname==='+JSON.stringify(p)+' && document.readyState==="complete"').catch(()=>false)).catch(async()=>{throw Error('Navigation '+p+' ended at '+await e('location.href+" "+document.readyState'))});}
const K={gemini:'AIzaAUDIT_DUMMY',openai:'sk-AUDIT_DUMMY',claude:'sk-ant-AUDIT_DUMMY'}, P='Audit-Only!93-Kdf';
const has=(r,k)=>Object.values(r.headers).includes(k);
const open=()=>e('document.querySelector("#settingsDlg").open || document.querySelector("[data-cmd=settings]").click()');
const form=(p,k,dev=false)=>f((p,k,dev,pass)=>{const q=s=>document.querySelector(s);q('#sProv').value=p;q('#sProv').dispatchEvent(new Event('change'));q('#sKey').value=k;if(dev){q('#sStoreDev').click();q('#sPass').value=q('#sPass2').value=pass;}},p,k,dev,P);
const model=()=>e('document.querySelector("#sLoadModels").click()');
const save=async()=>{await e('document.querySelector("#sSave").click()');await until(()=>e('!document.querySelector("#settingsDlg").open'));};
async function test(name,fn){try{console.log(++n,name,await fn()||'BLOCKED');}catch(err){errors++;console.log(n,name,'ERROR',err.message.split('\n')[0]);}}
const evil='<img id="auditXss" src=x onerror="window.pwned=1">';
try{
 const port=await until(async()=>{try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return false;}});
 const tab=await until(async()=>(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page' && t.url==='about:blank'));
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=async({data})=>{
  const m=JSON.parse(data);
  if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}
  if(m.method==='Network.requestWillBeSent')requests.push(m.params.request);
  if(m.method==='Fetch.requestPaused'){
   const {requestId,request}=m.params;
   paused.push(request);
   const response=mock?.(request)||{};
   const h={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Content-Type':'application/json',...response.headers};
   try{await c('Fetch.fulfillRequest',{requestId,responseCode:response.status||200,responseHeaders:Object.entries(h).map(([name,value])=>({name,value})),body:Buffer.from(JSON.stringify(response.body||{})).toString('base64')});}catch{}
  }
 };
 await Promise.all(['Network','Page','Runtime'].map(d=>c(d+'.enable')));
 console.log('Browser', (await c('Browser.getVersion')).product);
 await nav();assert(await e('document.querySelector("#app").children.length'));
 await c('Fetch.enable',{patterns:[{urlPattern:'https://*.googleapis.com/*'},{urlPattern:'https://api.openai.com/*'},{urlPattern:'https://api.anthropic.com/*'}]});
 for(const p of Object.keys(K))await test(p+' request header',async()=>{
  const from=requests.length;await open();await form(p,K[p]);await model();
  const expected=p==='openai'?'Bearer '+K[p]:K[p];
  const r=await until(()=>requests.slice(from).find(r=>has(r,expected)));
  assert(!r.url.includes(K[p]));
  assert.equal(Object.entries(r.headers).find(([,v])=>v===expected)[0].toLowerCase(),{gemini:'x-goog-api-key',openai:'authorization',claude:'x-api-key'}[p]);
  return 'EXPOSED';
 });
 await test('privileged JavaScript reads password field',async()=>{assert.equal(await e('document.querySelector("#sKey").value'),K.claude);return 'EXPOSED';});
 await test('fetch hook installed after app loads',async()=>{
  const from=requests.length;await e('window.original=fetch;window.count=0;window.fetch=()=>{count++;throw Error()}');
  await model();await until(()=>requests.slice(from).some(r=>has(r,K.claude)));assert.equal(await e('window.fetch=original;count'),0);
 });
 await test('privileged fetch hook installed before app',async()=>{
  const {identifier}=await c('Page.addScriptToEvaluateOnNewDocument',{source:'const original=fetch;window.fetch=(u,i)=>{window.hook=i.headers;return original(u,i)}'});
  try{await nav();await open();await form('openai',K.openai);await model();await until(()=>f(k=>window.hook?.Authorization==='Bearer '+k,K.openai));return 'EXPOSED';}
  finally{await c('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
 });
 await test('memory-only key persisted across reload',async()=>{
  await save();assert(!await f(k=>Object.values(localStorage).some(s=>s.includes(k)),K.openai));
  await nav();await open();assert(!await e('document.querySelector("#sKeyStatus").textContent.includes("····")'));
 });
 let blob;
 await test('device storage plaintext scan',async()=>{
  await form('openai',K.openai,true);await save();
  blob=await e('localStorage.getItem("opic.vault")');assert(blob&&!blob.includes(K.openai));
  const o=JSON.parse(blob);assert.equal(o.iter,600000);assert.equal(atob(o.salt).length,16);assert.equal(atob(o.iv).length,12);
 });
 await nav('/probe');
 const denied=pass=>f(async pass=>{try{await audit.vault.unlock(pass);return false;}catch{return audit.vault.get('openai')==='';}},pass);
 await test('wrong password',async()=>assert(await denied('incorrect')));
 await test('AES-GCM tampered ciphertext',async()=>{
  await e('(()=>{const o=JSON.parse(localStorage.getItem("opic.vault"));o.ct=(o.ct[0]==="A"?"B":"A")+o.ct.slice(1);localStorage.setItem("opic.vault",JSON.stringify(o));})()');
  try{assert(await denied(P));}finally{await f(b=>localStorage.setItem('opic.vault',b),blob);}
 });
 await test('correct password via unlock dialog',async()=>{
  await f(p=>{document.querySelector('#uPass').value=p;document.querySelector('#uGo').click();},P);
  await until(()=>e('!document.querySelector("#unlockDlg").open'));assert.equal(await e('audit.vault.get("openai")'),K.openai);return 'CONTROL OK';
 });
 await test('weak password rejected',async()=>assert(await e('(async()=>{try{await audit.vault.useDevice("password123456789");return false;}catch{return true;}})()')));
 await test('idle lock after simulated 31 minutes',async()=>assert(await e('(()=>{const original=Date.now;Date.now=()=>original()+31*60000;try{return audit.vault.get("openai")===""&&audit.vault.isLocked()}finally{Date.now=original}})()')));
 await test('legacy plaintext migration',async()=>{
  await f(k=>{localStorage.clear();localStorage.setItem('opic.settings',JSON.stringify({apiKey:k}));},K.gemini);
  await nav('/probe');assert(await f(k=>audit.vault.get('gemini')===k&&!localStorage.getItem('opic.settings').includes(k),K.gemini));
 });
 for(const [label,k] of [['CRLF header injection','sk-test\r\nX-Fake:yes'],['Claude key as OpenAI key',K.claude]])await test(label,async()=>assert(await f(k=>{try{audit.authHeaders('openai',k);return false;}catch{return true;}},k)));
 for(const [label,u] of [['foreign API origin','https://audit.invalid/'],['lookalike hostname','https://api.openai.com.audit.invalid/'],['HTTP downgrade','http://api.openai.com/']])await test(label,async()=>assert(await f(u=>{try{audit.apiFetch('openai',u,{});return false;}catch(err){return err.kind==='blocked';}},u)));
 await nav();
 await e('window.viol=[];document.addEventListener("securitypolicyviolation",e=>viol.push([e.effectiveDirective,e.blockedURI]))');
 await test('unhashed inline script CSP',async()=>{
  await e('(()=>{const s=document.createElement("script");s.textContent="window.pwned=1";document.head.append(s)})()');
  await until(()=>e('viol.some(([d,u])=>d==="script-src-elem"&&u==="inline")'));assert(!await e('window.pwned'));
 });
 await test('same-origin external script CSP',async()=>{
  await e('(()=>{const s=document.createElement("script");s.src="/asset.js";document.head.append(s)})()');
  await until(()=>e('viol.some(([d,u])=>d==="script-src-elem"&&u.endsWith("/asset.js"))'));assert(!await e('window.pwned'));
 });
 await test('foreign fetch CSP',async()=>{
  await e('fetch("https://audit.invalid/collect").catch(()=>{})');await until(()=>e('viol.some(([d])=>d==="connect-src")'));
 });
 await test('stored survey attribute breakout',async()=>{
  await nav('/blank');
  const p='">'+evil;
  await f(p=>localStorage.setItem('opic.state',JSON.stringify({view:'survey',level:3,survey:{jobDetail:p}})),p);
  await nav();assert(await f(p=>[...document.querySelectorAll('input,textarea')].some(el=>el.value===p)&&!document.querySelector('#auditXss'),p));
 });
 await test('stored question and answer HTML injection',async()=>{
  await nav('/blank');
  const p='</textarea>'+evil;
  await f(p=>localStorage.setItem('opic.state',JSON.stringify({view:'practice',session:{sets:[{questions:[{text:p,answer:p,reveal:true}]}]}})),p);
  await nav();assert(await f(p=>document.querySelector('#app').textContent.includes(p)&&!document.querySelector('#auditXss'),p));
 });
 await test('model API response HTML injection',async()=>{
  const p='gpt-test">'+evil;mock=()=>({body:{data:[{id:p}]}});
  try{await open();await form('openai',K.openai);await model();await until(()=>f(p=>[...document.querySelectorAll('#modelList option')].some(el=>el.value===p),p));assert(!await e('!!document.querySelector("#auditXss")'));}finally{mock=null;}
 });
 await test('same-origin iframe clickjacking',async()=>{
  await nav('/frame');await until(()=>e('document.querySelector("iframe").contentDocument?.body?.textContent.includes("OPIc AI 튜터 직접 열기")'));
  assert(await e('!document.querySelector("iframe").contentDocument.querySelector("#sKey")'));
 });
 await nav('/blank');
 await test('normal app with controlling service worker',async()=>{
  await e('navigator.serviceWorker.register("/sw.js").then(()=>navigator.serviceWorker.ready).then(()=>true)');await until(()=>e('!!navigator.serviceWorker.controller'));
  await nav();await open();assert(await e('document.querySelector("#sKey").disabled&&!document.querySelector("#sSwWarn").hidden'));
  const from=requests.length;await form('openai',K.openai);await model();await wait(150);assert(!requests.slice(from).some(r=>has(r,'Bearer '+K.openai)));
 });
 await test('malicious service worker swaps HTML and captures key',async()=>{
  await nav('/replaced');assert(await f(k=>{const x=document.querySelector('#k');x.value=k;x.dispatchEvent(new Event('input'));return localStorage.getItem('captured')===k;},K.openai));return 'EXPOSED';
 });
 await e('navigator.serviceWorker.getRegistrations().then(async rs=>{await Promise.all(rs.map(r=>r.unregister()));localStorage.clear();return true})');
 await nav('/probe');await until(()=>e('!navigator.serviceWorker.controller'));
 await test('Claude API redirects to CSP-allowed Gemini origin',async()=>{
  const from=paused.length;
  mock=r=>r.url.startsWith('https://api.anthropic.com')&&r.method!=='OPTIONS'?{status:307,headers:{Location:'https://generativelanguage.googleapis.com/audit-redirect'}}:{headers:{'Access-Control-Allow-Origin':'*'}};
  try{await open();await form('claude',K.claude);await model();
   const hit=await until(()=>paused.slice(from).find(r=>r.url.endsWith('/audit-redirect')&&r.method==='GET'));
   assert(has(hit,K.claude), 'redirect headers: '+Object.keys(hit.headers).join(', '));return 'EXPOSED (mock redirect)';
  }finally{mock=null;}
 });
 await test('same-origin page restores deleted vault snapshot',async()=>{
  await e('audit.vault.wipeAll()');await nav('/blank');await f(b=>localStorage.setItem('opic.vault',b),blob);await nav('/probe');
  assert(await f(async(p,k)=>{await audit.vault.unlock(p);return audit.vault.get('openai')===k;},P,K.openai));return 'ROLLBACK (password required)';
 });
}finally{ws?.close();chrome.kill();server.close();}
if(errors)process.exitCode=1;

