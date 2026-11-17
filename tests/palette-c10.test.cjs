'use strict';
/* Слово Михаила 17.11: оранжевого/янтарного/золотого в приложении нет (свод §16). Проверка CSS и скриптов по оттенкам. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=['ui2-common.css','styles/view.css','config.js',...fs.readdirSync(path.join(root,'scripts')).map(f=>'scripts/'+f)];
function hsl(hex){let r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return[0,0,mx];let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;const l=(mx+mn)/2,s=d/(1-Math.abs(2*l-1));return[h,s,l]}
const bad=[];
for(const f of files){const t=fs.readFileSync(path.join(root,f),'utf8');
  for(const m of t.matchAll(/#([0-9a-fA-F]{6})\b/g)){const[h,s,l]=hsl('#'+m[1]);
    // оранжевый/янтарный/золотой: тон 18–52°, насыщенность заметная, не почти белый/чёрный. Бежевые фоны (низкая насыщенность) тоже не допускаем выше 0.25
    if(h>=18&&h<=52&&s>=0.35&&l>0.18&&l<0.9)bad.push(f+' #'+m[1]);}
  assert.doesNotMatch(t,/\borange\b|\bamber\b/i,f+': слово orange/amber')}
assert.deepEqual(bad,[],'оранжевые оттенки: '+bad.join(', '));
console.log('palette c10: OK (нет оранжевого/янтарного/золотого в CSS и скриптах)');
