// Exact presentation-only historical inverse. This restores the approved gold
// edits before older copy/source pins run; it never changes those pins or data.
import assert from 'node:assert/strict';

export const PROMOTIONAL_GOLD_RELEASE='20260924.gold1';
export const PROMOTIONAL_GOLD_PRIOR_COMMIT='4b24682b352df38ce9d72530ee9bbf0b2775af21';
export const PROMOTIONAL_GOLD_STYLE_FILES=Object.freeze([
  'enterprise-site.css','public-product-design.css','pilot-waitlist.css',
  'homepage-workspace-demo.css','canonical-site-shell.css','sample-report-tile.css','index.html',
]);

const focusAddition=`
  body.canonical-green-shell :is(a.btn-secondary, a.btn-hero-secondary, a.btn.secondary, a.article-action:not(.article-action-primary)):focus-visible,
  body.canonical-green-shell .dx-use-actions > a.btn-subtle:focus-visible {
    outline: 3px solid currentColor !important;
    outline-offset: 3px;
  }
`;

// [exact current fragment, exact prior fragment, occurrence count]. Counts are
// fixed deliberately: a broader recolor or added declaration cannot hide here.
const deltas=Object.freeze({
  'enterprise-site.css':[
    ['  --mdm-gold: #E6C765;','  --mdm-gold: #C9A227;',1],
    [focusAddition,'',1],
    ['rgba(230, 199, 101, .65)','rgba(201, 162, 39, .65)',1],
    ['rgba(230, 199, 101, .14)','rgba(201, 162, 39, .14)',2],
  ],
  'public-product-design.css':[
    ['var(--mdm-gold, #E6C765)','var(--mdm-gold, #C9A227)',1],
    ['rgba(230, 199, 101, .11)','rgba(201, 162, 39, .11)',2],
    ['rgba(230, 199, 101, .26)','rgba(201, 162, 39, .26)',1],
    ['rgba(230, 199, 101, .34)','rgba(201, 162, 39, .34)',1],
    ['rgba(230, 199, 101, .42)','rgba(201, 162, 39, .42)',1],
    ['rgba(230, 199, 101, .18)','rgba(201, 162, 39, .18)',1],
  ],
  'pilot-waitlist.css':[
    ['var(--mdm-gold,#E6C765)','var(--mdm-gold,#C9A227)',1],
    ['rgba(230,199,101,.65)','rgba(201,162,39,.65)',1],
    ['rgba(230,199,101,.14)','rgba(201,162,39,.14)',2],
  ],
  'homepage-workspace-demo.css':[
    ['rgba(230,199,101,.5)','rgba(201,162,39,.5)',1],
    ['var(--mdm-gold,#E6C765)','var(--mdm-gold,#C9A227)',1],
  ],
  'canonical-site-shell.css':[
    ['var(--mdm-gold,#E6C765)','var(--mdm-gold,#C9A227)',1],
  ],
  'sample-report-tile.css':[
    ['  background:var(--mdm-deep,#04181B);','  background:var(--mdm-gold,#C9A227);',1],
    ['  background:rgba(12,110,120,.065);','  background:rgba(201,162,39,.065);',1],
    ['  border-left:2px solid var(--mdm-teal,#0C6E78);','  border-left:2px solid var(--mdm-gold,#C9A227);',1],
    ['  color:var(--mdm-teal,#0C6E78);','  color:var(--mdm-gold-ink,#7A6015);',1],
  ],
  'index.html':[
    ['var(--mdm-gold,#E6C765)','var(--mdm-gold,#C9A227)',2],
    ['rgba(230,199,101,.12)','rgba(201,162,39,.12)',1],
    ['background:conic-gradient(var(--mdm-teal,#0C6E78) 0 30%,#DDDAD2 30% 100%);','background:conic-gradient(var(--mdm-gold,#C9A227) 0 30%,#DDDAD2 30% 100%);',1],
    ['.hrp-recovery-metric:nth-child(3) b{color:var(--mdm-teal,#0C6E78);}', '.hrp-recovery-metric:nth-child(3) b{color:var(--mdm-gold-ink,#7A6015);}',1],
    ['href="homepage-workspace-demo.css?v=20260924.gold1"','href="homepage-workspace-demo.css?v=20260923.samples1"',1],
  ],
});

export function sourceBeforePromotionalGold20260924(file,source){
  if(!PROMOTIONAL_GOLD_STYLE_FILES.includes(file))return source;
  let restored=String(source);
  for(const [current,prior,count]of deltas[file]){
    assert.equal(restored.split(current).length-1,count,file+': exact approved promotional gold fragment count');
    restored=restored.split(current).join(prior);
  }
  return restored;
}
