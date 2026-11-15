const fs=require('node:fs');
const path=require('node:path');

module.exports=function appSource(root){
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...index.matchAll(/<script src="(scripts\/[^"]+\.js)"><\/script>/g)].map(m=>m[1]);
  return index+'\n'+scripts.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
};
