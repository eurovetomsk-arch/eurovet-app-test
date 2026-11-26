'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const XLSX=require('../xlsx.core.min.js');

const source=process.env.DOSE_WORKBOOK||'/Users/agent/Documents/Codex/2026-11-05/evrovet-clinical/outputs/dose-calculator-v1/ЕВРОВЕТ_реестр_дозировок_107_препаратов_ЧЕРНОВИК.xlsx';
const expectedSha='c301f9a655cc65100d29301c3bb34686907804ea80c2a5649a439417830dec81';
const bytes=fs.readFileSync(source);
const actualSha=crypto.createHash('sha256').update(bytes).digest('hex');
if(actualSha!==expectedSha)throw new Error('Unexpected workbook SHA-256: '+actualSha);

const workbook=XLSX.read(bytes,{type:'buffer'});
const rows=XLSX.utils.sheet_to_json(workbook.Sheets['Матрица 107'],{defval:''});
const pick=(r,k)=>String(r[k]??'').trim();
const items=rows.map(r=>({
  id:pick(r,'ID'),
  group:pick(r,'Группа'),
  no:Number(r['№']),
  source_name:pick(r,'Исходная строка справочника'),
  name:pick(r,'Нормализованное наименование'),
  release_status:pick(r,'Статус для выпуска'),
  concentration:pick(r,'Концентрация / форма'),
  dog:pick(r,'Собака'),
  cat:pick(r,'Кошка'),
  min_max:pick(r,'Минимум / максимум'),
  route:pick(r,'Путь введения'),
  frequency:pick(r,'Кратность'),
  restrictions:pick(r,'Ограничения / противопоказания'),
  evidence:pick(r,'Комментарий доказательности'),
  label_status:pick(r,'On-label / off-label')
}));
if(items.length!==107||new Set(items.map(x=>x.id)).size!==107)throw new Error('Dose inventory must contain 107 unique rows');

const counts=items.reduce((m,x)=>(m[x.release_status]=(m[x.release_status]||0)+1,m),{});
const expectedCounts={'ПРОЕКТ СХЕМЫ':16,'РУЧНОЙ РЕЖИМ':30,'ЗАБЛОКИРОВАНО':43,'НЕ ПРИМЕНЯЕТСЯ':17,'HARD STOP':1};
if(Object.keys(expectedCounts).some(k=>counts[k]!==expectedCounts[k])||Object.keys(counts).length!==Object.keys(expectedCounts).length)throw new Error('Unexpected status counts: '+JSON.stringify(counts));

const output={
  schema:'evrovet.dose_catalog_test/v1',
  test_only:true,
  clinical_status:'draft_not_for_treatment',
  source_sha256:actualSha,
  items
};
const dest=path.resolve(__dirname,'../data/dose-v1.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(output));
const gz=require('node:zlib').gzipSync(fs.readFileSync(dest),{level:9});
console.log(JSON.stringify({items:items.length,counts,bytes:fs.statSync(dest).size,gzip_bytes:gz.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')},null,2));
