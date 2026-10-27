const login=await fetch('http://127.0.0.1:9195/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@autogroupposter.test',password:'LocalDemo!2026',returnSecureToken:true})});
if(!login.ok)throw new Error('Local demo login failed');
const {idToken}=await login.json();
for(const action of ['bootstrap','admin.overview']){
 const response=await fetch('http://127.0.0.1:5105/demo-autogroupposter/us-central1/agpApi',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},body:JSON.stringify({data:{action,input:{}}}),signal:AbortSignal.timeout(60000)});
 const data=await response.json();if(!response.ok||data.error)throw new Error(action+': '+(data.error?.message||response.status));
 console.log(action+': OK'+(action==='bootstrap'?' (admin='+data.result.admin+', plan='+data.result.plan.name+')':''));
}
