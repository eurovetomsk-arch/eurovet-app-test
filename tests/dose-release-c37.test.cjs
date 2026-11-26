const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const text=file=>read(file).toString('utf8');
const sha=file=>crypto.createHash('sha256').update(read(file)).digest('hex');

assert.match(text('index.html'),/evrovet-version" content="2\.0-test-c37"/);
assert.match(text('scripts/common.js'),/appVer:'2\.0-test-c37'/);
assert.match(text('index.html'),/styles\/dose\.css\?v=c37/);
assert.match(text('index.html'),/scripts\/dose\.js\?v=c37/);
assert.match(text('index.html'),/txcibtcfuzqhhebeguby\.supabase\.co/);
assert.doesNotMatch(text('index.html'),/ikxmzapfmgqnnrsttuxc\.supabase\.co/);
assert.match(text('config.js'),/txcibtcfuzqhhebeguby\.supabase\.co/);
assert.match(text('sw.js'),/const V='ev2-test-c37'/);

const exact={
  'scripts/dose.js':'b710b8bac7785ceeaa40448fb8e86414eb02a64d295227a839ab4e251c683049',
  'styles/dose.css':'e21ea2249f4c8d2207fc234fc12a81617cb986601acad85cf8aa078e2784a1f6',
  'data/dose-v1.json':'f8aad9b249d2d315a927828998a4ccef84d78e33d520a8a5b80e73ad2ba1279e',
  'data/dose-rules-v1.json':'b6e44a388149b51ddab98334f77de45179762e51b28d9ea089194aae9b281a96',
  'scripts/view.js':'ded2a51f601b0165ce7d0684b127f7a3b099f8002398e25f1afdc99e62e28bac',
  'scripts/home.js':'da28d0fe95fe2cd7d2295e5f204acd2eeb2a7e085c97c30c16bfefcce0f33332'
};
for(const [file,want] of Object.entries(exact))assert.equal(sha(file),want,file+' must byte-match the live candidate');

const catalog=JSON.parse(text('data/dose-v1.json')),rules=JSON.parse(text('data/dose-rules-v1.json'));
assert.equal(catalog.items.length,107);
assert.equal(rules.rules.length,14);
assert.equal(new Set(rules.rules.map(x=>x.item_id)).size,8);
console.log('dose public test c37 PASS (exact candidate calculator and shell routing; test backend isolated)');
