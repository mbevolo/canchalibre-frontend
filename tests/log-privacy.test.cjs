const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('browser scripts never log form payloads, passwords, tokens or provider errors',()=>{
 const sources=fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>['js/'+f,fs.readFileSync('js/'+f,'utf8')]);
 for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){
   for(const match of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))sources.push([file,match[1]]);
 }
 for(const[file,source]of sources){
 const calls=source.match(/console\.(?:log|warn|error)\s*\(/g)||[];
 const safe=source.match(/console\.(?:log|warn|error)\s*\(\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\)/g)||[];
 assert.equal(calls.length,safe.length,`Unsafe browser log in ${file}`);
 }
});
