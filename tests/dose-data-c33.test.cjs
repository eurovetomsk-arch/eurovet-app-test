const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'data/dose-v1.json');
const raw=fs.readFileSync(file),data=JSON.parse(raw);

assert.equal(data.schema,'evrovet.dose_catalog_test/v1');
assert.equal(data.test_only,true);
assert.equal(data.items.length,107);
assert.equal(new Set(data.items.map(x=>x.id)).size,107,'id должны быть уникальны');
assert.equal(data.source_sha256,'c301f9a655cc65100d29301c3bb34686907804ea80c2a5649a439417830dec81');
assert.deepEqual(
  data.items.reduce((m,x)=>(m[x.release_status]=(m[x.release_status]||0)+1,m),{}),
  {'РУЧНОЙ РЕЖИМ':30,'ЗАБЛОКИРОВАНО':43,'ПРОЕКТ СХЕМЫ':16,'НЕ ПРИМЕНЯЕТСЯ':17,'HARD STOP':1}
);
assert.equal(data.items.filter(x=>x.group==='Медицинские').length,78);
assert.equal(data.items.filter(x=>x.group==='Ветеринарные').length,29);
assert.ok(raw.length<180000,'каталог должен оставаться меньше 180 КБ');
assert.ok(zlib.gzipSync(raw).length<35000,'gzip должен оставаться меньше 35 КБ');
assert.ok(!fs.readFileSync(path.join(root,'sw.js'),'utf8').includes('data/dose-v1.json'),'каталог не должен загружаться при старте приложения');
for(const x of data.items){
  assert.deepEqual(Object.keys(x),['id','group','no','source_name','name','release_status','concentration','dog','cat','min_max','route','frequency','restrictions','evidence','label_status']);
  assert.ok(x.source_name&&x.group&&x.release_status,x.id+': обязательные поля');
}
const forbidden=/client|phone|email|address|invoice|salary|payroll|owner/i;
assert.ok(!forbidden.test(Object.keys(data.items[0]).join('|')),'в контракте нет клиентских/финансовых полей');
console.log('dose data PASS',JSON.stringify({items:data.items.length,bytes:raw.length,gzip:zlib.gzipSync(raw).length,sha256:crypto.createHash('sha256').update(raw).digest('hex')}));
