#!/usr/bin/env node
// index.html 안의 인라인 <script> 내용으로 CSP script-src 해시를 다시 계산해 meta 태그에 써 넣는다.
// 스크립트를 고친 뒤에는 반드시 마지막에 실행해야 한다. 해시가 틀리면 브라우저가 스크립트를 막아서 앱이 동작하지 않는다.
//
//   node tools/update-csp.mjs            index.html 해시 갱신
//   node tools/update-csp.mjs --check    갱신하지 않고 맞는지만 확인 (틀리면 종료 코드 1)
//   node tools/update-csp.mjs path.html  다른 파일 지정
//
// 브라우저는 <script> 요소의 텍스트를 UTF-8로 인코딩해 해시한다. HTML 파서가 CRLF와 단독 CR을 LF로 바꾸므로 여기서도 똑같이 바꾼다.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const check = args.includes('--check');
const file = args.find(a => !a.startsWith('--')) || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');

const fail = msg => { console.error('update-csp: ' + msg); process.exit(1); };
const html = readFileSync(file, 'utf8');

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
if(scripts.length !== 1) fail(`인라인 <script>가 정확히 1개여야 하는데 ${scripts.length}개예요.`);
if(/\bsrc\s*=/i.test(scripts[0][1])) fail('<script src>는 CSP에서 허용하지 않아요.');
const body = scripts[0][2].replace(/\r\n?/g, '\n');
if(/<\/script/i.test(body)) fail('스크립트 안에 </script 문자열이 있으면 안 돼요.');
const hash = createHash('sha256').update(body, 'utf8').digest('base64');

const metaRe = /(<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*?script-src\s+)'sha256-[A-Za-z0-9+/=]+'/;
const m = html.match(metaRe);
if(!m) fail("CSP meta 태그에서 script-src 'sha256-...' 자리를 찾지 못했어요. (처음에는 'sha256-PLACEHOLDER=' 같은 값을 넣어 두세요.)");
const current = (html.match(/script-src\s+'sha256-([A-Za-z0-9+/=]+)'/) || [])[1];

if(check){
  if(current === hash){ console.log(`OK  sha256-${hash}`); process.exit(0); }
  fail(`해시가 달라요. meta: sha256-${current}  실제: sha256-${hash}`);
}
const out = html.replace(metaRe, (_, pre) => `${pre}'sha256-${hash}'`);
if(out !== html) writeFileSync(file, out);
console.log(`${current === hash ? '변경 없음' : '갱신함'}  sha256-${hash}`);
