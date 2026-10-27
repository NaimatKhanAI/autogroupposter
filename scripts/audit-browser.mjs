import {chromium} from 'playwright-core';import path from 'node:path';import fs from 'node:fs/promises';
await fs.mkdir('artifacts/readiness',{recursive:true});
const extension=path.resolve('dist/chrome-extension');
const context=await chromium.launchPersistentContext(path.resolve('artifacts/readiness/chrome-profile'),{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
try{let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:10000}).catch(()=>null);
const result={browser:context.browser()?.version(),extensionWorkerObserved:!!worker};
if(worker){result.workerUrl=worker.url();const id=new URL(worker.url()).host;const page=await context.newPage();await page.goto('chrome-extension://'+id+'/popup.html');await page.locator('#email').waitFor({timeout:10000});await page.screenshot({path:'artifacts/readiness/popup.png'});result.popupLoginRendered=true;}
else result.limitation='Installed Chrome did not expose a side-loaded extension worker in this isolated automated profile. Real extension runtime remains unverified.';
console.log(JSON.stringify(result,null,2));await fs.writeFile('artifacts/readiness/browser-result.json',JSON.stringify(result,null,2));
}finally{await context.close();}
