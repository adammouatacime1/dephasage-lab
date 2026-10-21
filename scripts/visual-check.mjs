import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const dir='artifacts/visual-review';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({reducedMotion:'reduce'});
page.on('pageerror',e=>{console.error(e);process.exitCode=1;});
for(const [name,width,height] of [['desktop',1440,1100],['mobile',390,844]]) {
 await page.setViewportSize({width,height});await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/');
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'Activer le thème sombre'}).click();
  await page.screenshot({path:`${dir}/${name}-${theme}.png`,fullPage:true});
  console.log(name,theme,await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth})));
 }
}
await browser.close();
