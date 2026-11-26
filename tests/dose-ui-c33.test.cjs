const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const shots=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(shots)fs.mkdirSync(shots,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{
  const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '')||'index.html',f=path.resolve(root,rel);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404).end();return}
  s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});s.end(fs.readFileSync(f));
});
const sizes=[{name:'phone-320',width:320,height:700},{name:'phone-390',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1366,height:900}];
const engines=(process.env.ENGINES||'chromium,firefox,webkit').split(',');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function enter(page){
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{S.person={id:901,full_name:'Тестовый Врач',roles:['doctor'],doctor:true};S.token='test-token';S.view='branch';HOME_WHO.rows=[];HOME_WHO.key=homeWhoKey();render()});
  const tile=page.locator('[data-v="dose"]');await tile.waitFor();
  const t=Date.now();await tile.click();await page.locator('#dose-results .dose-row').first().waitFor({timeout:5000});return Date.now()-t;
}
let origin;
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));origin='http://127.0.0.1:'+server.address().port+'/';
  const report=[];
  for(const engine of engines){
    const browser=await pw[engine].launch({headless:true});
    for(const size of sizes){
      const context=await browser.newContext({viewport:{width:size.width,height:size.height},locale:'ru-RU'});
      await context.route('https://txcibtcfuzqhhebeguby.supabase.co/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"rows":[],"items":[],"shifts":[]}'}));
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      const ms=await enter(page);
      assert.ok(ms<2000,engine+' '+size.name+': открытие '+ms+' мс');
      assert.equal(await page.locator('#dose-results .dose-row').count(),8,engine+' '+size.name+': на старте только рабочие расчёты');
      const geom=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bar:!!document.querySelector('.ui2-bottom-nav'),h1:document.querySelector('.dose-head h1')?.textContent}));
      assert.ok(geom.sw<=geom.cw+1,engine+' '+size.name+': горизонтальный скролл '+geom.sw+'/'+geom.cw);
      assert.equal(geom.bar,true,engine+' '+size.name+': нижняя навигация');assert.equal(geom.h1,'Расчёт дозы');
      assert.deepEqual(errors,[],engine+' '+size.name+': '+errors.join('|'));
      if(shots&&(size.name==='phone-320'||size.name==='desktop'))await page.screenshot({path:path.join(shots,engine+'-'+size.name+'.png'),fullPage:true});
      report.push({engine,viewport:size.name,open_ms:ms});await context.close();
    }
    /* Боевой тестовый сценарий — конкретный расчёт, крупный результат, locked-карточка и отзыв. */
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'ru-RU'});const page=await context.newPage();await enter(page);
    await page.locator('#dose-q').fill('Аллервет');await page.locator('#dose-results .dose-row').first().dispatchEvent('click');
    await page.locator('[data-dose-act="species"][data-value="cat"]').dispatchEvent('click');
    await page.locator('#dose-weight').pressSequentially('2',{delay:0});
    await page.locator('#dose-dose').pressSequentially('2',{delay:0});
    await page.locator('[data-dose-act="route"][data-value="SC"]').dispatchEvent('click');
    assert.match(await page.locator('.dose-result.ready').innerText(),/0,4 мл/);
    assert.match(await page.locator('.dose-result.ready').innerText(),/Подкожно/);
    assert.match(await page.locator('.dose-result.ready').innerText(),/2–3 раза в сутки/);
    assert.equal(await page.locator('.dose-details').evaluate(x=>x.open),false,'подробности закрыты по умолчанию');
    if(shots)await page.screenshot({path:path.join(shots,engine+'-detail.png'),fullPage:true});
    await page.locator('[data-dose-act="close"]').dispatchEvent('click');await page.locator('#dose-q').fill('Пиро-Стоп');await page.locator('#dose-results .dose-row').first().dispatchEvent('click');
    await page.locator('[data-dose-act="species"][data-value="dog"]').dispatchEvent('click');await page.locator('#dose-weight').fill('10');await page.locator('[data-dose-act="route"][data-value="SC"]').dispatchEvent('click');
    assert.match(await page.locator('.dose-result.ready').innerText(),/0,5 мл/);assert.match(await page.locator('.dose-result.ready').innerText(),/Не более 2 мл/);
    await page.evaluate(()=>{DOSE.selected=null;DOSE.query='Анестофол 5%';DOSE.status='all';render()});await page.locator('#dose-results .dose-row').first().dispatchEvent('click');
    assert.match(await page.locator('.dose-badge.stop').innerText(),/Стоп/);assert.match(await page.locator('.dose-calc-locked').innerText(),/Быстрый расчёт недоступен/);
    await page.locator('.dose-review summary').dispatchEvent('click');const feedback=page.locator('[data-dose-act="feedback"][data-value="fix"]');await feedback.dispatchEvent('click');await page.locator('#dose-fb-note').waitFor();await page.locator('#dose-fb-note').fill('Проверить формулировку');await page.locator('[data-dose-act="feedback-save"]').dispatchEvent('click');
    assert.match(await page.locator('.dose-feedback-saved').textContent(),/нужно исправить/);
    console.log(engine,'functional PASS');await context.close();await browser.close();
  }
  console.log('dose ui PASS',JSON.stringify(report));server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});
