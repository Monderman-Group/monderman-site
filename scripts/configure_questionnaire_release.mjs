// Build-time switch only. Never select an existing run's questionnaire here.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.render-public');
const channel = process.env.MONDERMAN_QUESTIONNAIRE_RELEASE || 'legacy';
if (!['legacy','current'].includes(channel)) throw new Error('MONDERMAN_QUESTIONNAIRE_RELEASE must be legacy or current');
const source = 'const ACTIVE_QUESTIONNAIRE_COPY_VERSION = undefined;';
const replacement = channel === 'current' ? 'const ACTIVE_QUESTIONNAIRE_COPY_VERSION = "diagnostic-language-20260908";' : source;
for (const filename of ['decision-velocity.html','structural-clarity.html','operational-systems.html','institutional-performance.html']) {
  const file=path.join(root,filename), html=fs.readFileSync(file,'utf8');
  if (html.split(source).length!==2) throw new Error(filename+': expected exactly one inactive release constant');
  fs.writeFileSync(file,html.replace(source,replacement));
}
fs.mkdirSync(path.join(root,'.well-known'),{recursive:true});
fs.writeFileSync(path.join(root,'.well-known/monderman-questionnaire-release.json'),JSON.stringify({channel,copy_version:channel==='current'?'diagnostic-language-20260908':null,supports:['legacy','current']})+'\n');
console.log('Questionnaire build channel: '+channel+'; both saved versions remain supported.');
