// Only talks to explicitly selected local emulators. Never uses the production project.
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9195';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8185';
const {initializeApp}=await import('firebase-admin/app');
const {getAuth}=await import('firebase-admin/auth');
initializeApp({projectId:'demo-autogroupposter'});
const auth=getAuth(),email='owner@autogroupposter.test';
let user;try{user=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;user=await auth.createUser({email,password:'LocalDemo!2026',emailVerified:true,displayName:'Local Owner'});}
await auth.setCustomUserClaims(user.uid,{agpAdmin:true});
console.log('Local demo owner is ready. No production accounts changed.');
