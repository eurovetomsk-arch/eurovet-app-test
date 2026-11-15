const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const appSource=require('./app-source.cjs');

const root=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8'),source=appSource(root);
const scripts=['common','login','home','report','schedule','accruals','view'];
for(const name of scripts)assert.match(index,new RegExp(`scripts/${name}\\.js`),`missing ${name} split`);
assert.match(index,/name="evrovet-version" content="2\.0-test-3046"/);
assert.match(source,/name="evrovet-version"\\s\+content/,'split update checker must read the version from index');

const icons=fs.readdirSync(path.join(root,'icons')).filter(x=>/^\d{2}-.+\.png$/.test(x)).sort();
assert.equal(icons.length,23,'full Marketing icon set');
assert.match(source,/dose_calculator:'icons\/20-dose-calc\.png'/);
assert.match(source,/supplies:'icons\/21-order\.png'/);
assert.doesNotMatch(source,/function homeIcon[\s\S]{0,1800}<svg/,'money graph fallback returned to home tiles');

assert.match(source,/\['pending','missing'\]\.includes\(x\.status\)/,'missing VM run must remain a waiting state');
assert.match(source,/staleDays>2/,'two-day escalation threshold missing');
assert.match(source,/Сверка Vetmanager не проводилась/,'leader stale warning missing');

const plan=fs.readFileSync(path.join(root,'LIVE-MIGRATION-PLAN.md'),'utf8');
for(const phrase of ['ev_login_number','Таблица ролей и права','Реальные устройства','Порядок выпуска','Откат','git revert'])assert.match(plan,new RegExp(phrase));
console.log('architect 3046: OK (23 icons, leader VM warning, 7-way split, migration plan)');
