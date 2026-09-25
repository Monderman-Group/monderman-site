// Current, narrow presentation contract; no data regeneration or publication.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {
  PROMOTIONAL_GOLD_PRIOR_COMMIT, PROMOTIONAL_GOLD_STYLE_FILES,
  sourceBeforePromotionalGold20260924,
} from './promotional_gold_20260924_inverse.mjs';

export function assertPromotionalGold20260924(root=path.resolve(import.meta.dirname,'..')){
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  const prior=file=>execFileSync('git',['show',PROMOTIONAL_GOLD_PRIOR_COMMIT+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16e6});
  let checks=0;
  const assertSource=(file,source)=>{
    // The shared wrapper restores gold exactly once, then the separate library
    // preview delta and the immutable copy delta where those layers apply.
    const restored=sourceBeforePublicCopyClarity(file,source);
    assert.equal(restored,prior(file),file+': exact prior file is recovered; unrelated styles, semantic colors and behavior remain unchanged');
    checks++;
  };
  for(const file of PROMOTIONAL_GOLD_STYLE_FILES){
    const source=read(file);
    assertSource(file,source);
    assert.doesNotMatch(source,/#C9A227|rgba\(201,\s*162,\s*39/i,file+': no former promotional shade remains');
    assert.throws(()=>assertSource(file,source+'\n/* unrelated edit */\n'),file+': an unrelated source edit must not pass historical inversion');
    checks+=2;
  }
  const shared=read('enterprise-site.css');
  assert.match(shared,/--mdm-gold: #E6C765;/);
  assert.match(shared,/--mdm-gold-ink: #7A6015;/,'Light surfaces retain the readable dark ink');
  for(const value of ['--mdm-amber: #C9821F;','--mdm-amber-dark: #86530D;','--mdm-amber-light: #F0C47D;','--mdm-sea-glass: #A9D0D4;'])assert.ok(shared.includes(value));
  assert.throws(()=>assertSource('enterprise-site.css',shared.replace('--mdm-gold: #E6C765;','--mdm-gold: #E6C764;')),'Even a one-channel deviation from the approved shade must fail');
  assert.throws(()=>assertSource('enterprise-site.css',shared.replace('--mdm-amber: #C9821F;','--mdm-amber: #E6C765;')),'Recoloring a semantic status must fail');
  checks+=8;
  const unknown='/* other content */';
  assert.equal(sourceBeforePromotionalGold20260924('unrelated.css',unknown),unknown,'No inversion outside the explicit seven-file scope');
  checks++;
  return {passed:true,checks,files:PROMOTIONAL_GOLD_STYLE_FILES,exactShade:'#E6C765',primaryAndSemanticStylesPreserved:true,copyFixtureUnchanged:true,publicationApprovalClaimed:false};
}

if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
  console.log('PROMOTIONAL_GOLD_20260924_CONTRACT '+JSON.stringify(assertPromotionalGold20260924()));
}
