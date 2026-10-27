import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';
import {getApp} from 'firebase-admin/app';
import {createHash} from 'node:crypto';
import type {PaymentProvider} from './payments';
export function mediaBucket(){return getStorage().bucket(process.env.FIREBASE_STORAGE_EMULATOR_HOST||process.env.STORAGE_EMULATOR_HOST?`${getApp().options.projectId||process.env.GCLOUD_PROJECT}.appspot.com`:process.env.MEDIA_BUCKET||'groupposter-1f253.firebasestorage.app');}
const legacy=['connected_pages','facebook_groups','imported_posts','sharing_tasks','sharing_attempts','audit_logs','notifications','extension_devices'];
async function removeWhere(collection:string,field:string,value:string){const db=getFirestore();for(;;){const s=await db.collection(collection).where(field,'==',value).limit(400).get();if(s.empty)break;const batch=db.batch();s.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}}
export async function completeDeletion(uid:string,actor:string,provider:PaymentProvider){
 if(uid===actor)throw new Error('Another administrator must process your account deletion.');
 const db=getFirestore(),request=db.doc(`agpDeletionRequests/${uid}`),snapshot=await request.get();if(!snapshot.exists)throw new Error('A user deletion request is required.');if(snapshot.data()!.status==='completed')return {ok:true,alreadyCompleted:true};
 const user=await getAuth().getUser(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e;return null;});if(user?.customClaims?.agpAdmin)throw new Error('Revoke administrator privileges before deleting this account.');
 await request.set({status:'processing',actor,updatedAt:Date.now()},{merge:true});
 const account=(await db.doc('agpUsers/'+uid).get()).data();const subscriptionId=account?.providerSubscriptionId||snapshot.data()!.providerSubscriptionId;
 try{
  if(subscriptionId){let subscription=await provider.subscription(subscriptionId);let a=subscription.attributes;if(String(a.store_id)!==process.env.LEMON_STORE_ID||!!a.test_mode!==(process.env.LEMON_TEST_MODE!=='false'))throw new Error('Billing environment mismatch');if(!['cancelled','expired'].includes(a.status)&&a.cancelled!==true){subscription=await provider.cancelSubscription(subscriptionId);a=subscription.attributes;}if(!['cancelled','expired'].includes(a.status)&&a.cancelled!==true)throw new Error('Billing cancellation is not confirmed.');}
  await db.doc('agpUsers/'+uid).set({suspended:true,deletionRequested:true},{merge:true});await db.doc('workspace_locks/'+uid).set({deleting:true,updated_at:FieldValue.serverTimestamp()},{merge:true});
  if(user)await getAuth().revokeRefreshTokens(uid);
  for(const table of legacy)await removeWhere(table,'owner_id',uid);
  await mediaBucket().deleteFiles({prefix:`agpMedia/${uid}/`});
  const hash=createHash('sha256').update(uid).digest('hex');
  for(const table of ['agpPayments','agpSubscriptionEvents','agpSubscriptions']){for(;;){const records=await db.collection(table).where('uid','==',uid).limit(400).get();if(records.empty)break;const batch=db.batch();for(const d of records.docs)batch.update(d.ref,{uid:FieldValue.delete(),deletedUidHash:hash,...(table==='agpSubscriptions'?{deleted:true,retired:true}:{})});await batch.commit();}}
  await removeWhere('agpSupportQueue','uid',uid);await removeWhere('agpErrors','uid',uid);
  await db.recursiveDelete(db.doc('agpUsers/'+uid));await db.doc('profiles/'+uid).delete();await db.doc('memberships/'+uid).delete();
  if(user)await getAuth().deleteUser(uid);
  await request.set({status:'completed',providerSubscriptionId:FieldValue.delete(),completedAt:Date.now(),actor},{merge:true});await db.collection('agpAdminAudit').add({uid:actor,action:'admin.completeDeletion',target:hash,at:Date.now()});return {ok:true};
 }catch(e){await request.set({status:'needs_attention',updatedAt:Date.now(),failure:'Cancellation or cleanup failed; retry required'},{merge:true});throw e;}
}
export async function cleanupMedia(){
 const db=getFirestore();const reservations=await db.collectionGroup('mediaUploads').where('expiresAt','<',Date.now()).limit(100).get();let removed=0;
 for(const record of reservations.docs){const user=record.ref.parent.parent;if(!user||user.parent.id!=='agpUsers')continue;const path=record.data().path;if(typeof path!=='string'||!path.startsWith('agpMedia/'+user.id+'/'))continue;
 const claimed=await db.runTransaction(async tx=>{const r=await tx.get(record.ref);if(!r.exists)return false;const posts=await tx.get(user.collection('posts').where('media','array-contains',path).limit(1));const jobs=await tx.get(user.collection('jobs').where('post.media','array-contains',path).limit(1));if(!posts.empty||!jobs.empty){tx.update(record.ref,{expiresAt:Date.now()+86400000});return false;}tx.update(record.ref,{deleting:true});return true;});if(!claimed)continue;
 await mediaBucket().file(path).delete({ignoreNotFound:true});await db.runTransaction(async tx=>{const [r,u]=await Promise.all([tx.get(record.ref),tx.get(user)]);if(!r.exists)return;const usage=u.data()?.usage||{};tx.delete(record.ref);if(u.exists)tx.set(user,{usage:{mediaFiles:Math.max(0,(usage.mediaFiles||0)-1),mediaBytes:Math.max(0,(usage.mediaBytes||0)-r.data()!.size)}},{merge:true});});removed++;
 }return removed;
}
