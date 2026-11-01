#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suites=[
  ['shelf-categories','verify-shelf-category-navigation.mjs'],
  ['entrance-route','verify-entrance-zoom-v16.mjs'],
  ['entrance-input','verify-entrance-input-v16.mjs'],
  ['facade-columns','verify-facade-columns.mjs'],
  ['walking-books','verify-walk-books-v16.mjs'],
];
/** The suites retain their existing human-readable prefixes. Normalize only
 * their emitted results; a failed child process still fails the whole suite. */
function parseSuiteOutput(stdout) {
  const text=(stdout??'').trim(),jsonStart=text.startsWith('{')?0:text.lastIndexOf('\n{')+1;
  let result;
  if(jsonStart>=0&&text[jsonStart]==='{') {
    result=JSON.parse(text.slice(jsonStart));
    if(!result.checks&&Array.isArray(result.groups))result.checks=result.groups.map(name=>({name,status:'PASS'}));
  } else {
    const names=text.split(/\r?\n/).filter(line=>/^(?:PASS\s+|✓\s+)/.test(line)).map(line=>line.replace(/^(?:PASS\s+|✓\s+)/,''));
    if(!names.length)throw new Error('No JSON result or completed check lines');
    result={checks:names.map(name=>({name,status:'PASS'})),outputFormat:'pass-lines'};
  }
  return result;
}
const report={version:'2.14.0',revision:16,checkedAt:new Date().toISOString(),suites:[],totalGroups:0,failedGroups:0};
for(const [name,file] of suites){
  const child=spawnSync(process.execPath,[path.join(root,'scripts',file)],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
  let result;
  if(child.error)result={status:'FAIL',error:child.error.message,errorCode:child.error.code??null};
  else try{result=parseSuiteOutput(child.stdout);}catch{result={status:'FAIL',error:child.stderr||child.stdout||`No JSON result; exit=${child.status}, signal=${child.signal??'none'}`};}
  const checks=result.checks??[],failed=checks.filter(c=>c.status!=='PASS').length;
  const status=!child.error&&child.status===0&&failed===0&&result.status!=='FAIL'?'PASS':'FAIL';
  report.suites.push({name,file,...result,status});report.totalGroups+=checks.length;report.failedGroups+=failed||+(status==='FAIL');
  console.log(`${status} ${name}: ${checks.length} groups`);
  if(status==='FAIL')console.log(child.error?.message||child.stderr||child.stdout||result.error);
}
report.status=report.failedGroups?'FAIL':'PASS';
if(process.argv.includes('--report'))fs.writeFileSync(path.join(root,'docs','interaction-v16.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,totalGroups:report.totalGroups,failedGroups:report.failedGroups}));
process.exitCode=report.failedGroups?1:0;
