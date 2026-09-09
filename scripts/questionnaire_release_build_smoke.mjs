import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const pages=['decision-velocity.html','structural-clarity.html','operational-systems.html','institutional-performance.html'];
const marker='const ACTIVE_QUESTIONNAIRE_COPY_VERSION = undefined;';
const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'monderman-questionnaire-build-'));
try {
  for(const channel of ['legacy','current','invalid']) {
    const dir=path.join(fixtureRoot,channel);fs.mkdirSync(dir);
    for(const file of pages) {
      const source=fs.readFileSync(file,'utf8');assert.equal(source.split(marker).length,2);
      fs.writeFileSync(path.join(dir,file),source);
    }
    const run=spawnSync(process.execPath,['scripts/configure_questionnaire_release.mjs',dir],{env:{...process.env,MONDERMAN_QUESTIONNAIRE_RELEASE:channel},encoding:'utf8'});
    if(channel==='invalid') {
      assert.notEqual(run.status,0);
      for(const file of pages)assert.equal(fs.readFileSync(path.join(dir,file),'utf8'),fs.readFileSync(file,'utf8'));
      continue;
    }
    assert.equal(run.status,0,run.stderr);
    for(const file of pages) {
      const expected=channel==='current'?fs.readFileSync(file,'utf8').replace(marker,'const ACTIVE_QUESTIONNAIRE_COPY_VERSION = "diagnostic-language-20260908";'):fs.readFileSync(file,'utf8');
      assert.equal(fs.readFileSync(path.join(dir,file),'utf8'),expected,'activation must change only the new-start constant');
    }
    const metadata=JSON.parse(fs.readFileSync(path.join(dir,'.well-known/monderman-questionnaire-release.json')));
    assert.equal(metadata.channel,channel);assert.deepEqual(metadata.supports,['legacy','current']);
  }
  console.log('QUESTIONNAIRE_RELEASE_BUILD_PASS: bridge/current differ only in four start constants; invalid channel fails before changing pages.');
} finally {fs.rmSync(fixtureRoot,{recursive:true,force:true});}
