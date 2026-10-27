// Audit reproductions, not passing acceptance tests: assertions confirm existing defects.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initializeTestEnvironment,assertSucceeds} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {uploadBytes,ref} from 'firebase/storage';
const require=createRequire(import.meta.url),functionsRequire=createRequire(new URL('../functions/package.json',import.meta.url));
const {agpApi}=require('../functions/lib/functions/src/index.js');const {getFirestore}=functionsRequire('firebase-admin/firestore');const {effectivePlan}=require('../functions/lib/packages/shared/domain.js');const db=getFirestore();
const uid='readiness-audit',auth={uid,token:{email:'audit@example.test',email_verified:true}};
const call=(action,input={})=>agpApi.run({auth,data:{action,input}});
assert.equal(effectivePlan({planId:'pro-monthly',status:'on_trial',validUntil:Date.now()+86400000}),'free');
console.log('CONFIRMED: provider on_trial subscription resolves to Free.');
await db.doc('agpUsers/'+uid).set({email:'audit@example.test',usage:{},providerSubscriptionId:'expired-subscription',subscription:{planId:'pro-monthly',status:'expired',validUntil:Date.now()-1000}});
await assert.rejects(call('checkout',{planId:'pro-monthly'}),/already has a provider subscription/);
console.log('CONFIRMED: expired provider subscription blocks new checkout before a provider request.');
await db.doc(`agpUsers/${uid}/devices/audit-browser`).set({name:'Audit browser',revoked:false,version:'1.0.0',lastSeen:Date.now()});
for(let start=0;start<500;start+=200){const batch=db.batch();for(let i=start;i<Math.min(start+200,500);i++)batch.set(db.doc(`agpUsers/${uid}/jobs/a${String(i).padStart(4,'0')}`),{deviceId:'audit-browser',status:'user_confirmed',createdAt:Date.now(),dueAt:Date.now()-1000,expiresAt:Date.now()+86400000});await batch.commit();}
await db.doc(`agpUsers/${uid}/jobs/z-pending`).set({deviceId:'audit-browser',status:'prepared',createdAt:Date.now(),dueAt:Date.now()-1000,expiresAt:Date.now()+86400000});
assert.equal((await call('jobs',{deviceId:'audit-browser'})).length,0);
const list=await call('list',{kind:'jobs'});assert.equal(list.length,500);assert.ok(!list.some(j=>j.id==='z-pending'));
console.log('CONFIRMED: one pending job behind 500 completed jobs is absent from polling and the unpaginated list.');
await db.doc('agpUsers/'+uid).update({suspended:true});
const env=await initializeTestEnvironment({projectId:'demo-autogroupposter',storage:{rules:readFileSync('storage.rules','utf8')}});
try{await assertSucceeds(uploadBytes(ref(env.authenticatedContext(uid,{email_verified:true}).storage(),`agpMedia/${uid}/audit-upload`),new Uint8Array([1,2,3]),{contentType:'image/png'}));console.log('CONFIRMED: a suspended account can still create media directly through Storage rules.');}finally{await env.cleanup();}
console.log('Audit probes complete: 4 existing defects reproduced. These are not a product-readiness pass.');
