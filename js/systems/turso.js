// Turso cloud save client - calls server-side API proxy
const API='/api';

async function apiCall(endpoint,body){
const r=await fetch(API+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
return r.json();
}

export async function tursoSave(username,slot,state){
return apiCall('/saves',{action:'save',username,slot,state});
}
export async function tursoLoad(username,slot){
const r=await apiCall('/saves',{action:'load',username,slot});
return r.ok?r.state:null;
}
export async function tursoListSlots(username){
const r=await apiCall('/saves',{action:'list',username});
return r.slots||[];
}
export async function tursoDelete(username,slot){
return apiCall('/saves',{action:'delete',username,slot});
}
export async function tursoRegister(username,hash){
return apiCall('/auth',{action:'register',username,hash});
}
export async function tursoLogin(username,hash){
const r=await apiCall('/auth',{action:'login',username,hash});
return r.ok;
}
export async function tursoInit(){
return apiCall('/setup',{});
}
