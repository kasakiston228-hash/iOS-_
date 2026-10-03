const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');

function db(){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Server not configured');
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
}
function json(code,obj,headers={}){
  return {statusCode:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers},body:JSON.stringify(obj)};
}
function verifyTelegramLogin(user){
  if(!user || typeof user!=='object' || !process.env.TELEGRAM_BOT_TOKEN) return null;
  const allowed=['id','first_name','last_name','username','photo_url','auth_date','hash'];
  const pairs=[];
  for(const key of allowed){
    if(key==='hash') continue;
    if(user[key]!==undefined && user[key]!==null) pairs.push([key,String(user[key])]);
  }
  const hash=String(user.hash||'');
  const auth=Number(user.auth_date);
  if(!/^[a-f0-9]{64}$/i.test(hash)||!Number.isSafeInteger(auth)||Math.abs(Date.now()/1000-auth)>86400) return null;
  pairs.sort(([a],[b])=>a.localeCompare(b));
  const dataCheck=pairs.map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const actual=crypto.createHmac('sha256',secret).update(dataCheck).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(actual,'hex'))) return null;
  const id=Number(user.id);
  return Number.isSafeInteger(id)&&id>0?id:null;
}
function sessionSecret(){
  if(!process.env.CODE_HASH_SECRET) throw Error('CODE_HASH_SECRET is not configured');
  return process.env.CODE_HASH_SECRET;
}
function makeSession(telegramId){
  const exp=Math.floor(Date.now()/1000)+86400;
  const payload=`${telegramId}.${exp}`;
  const sig=crypto.createHmac('sha256',sessionSecret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}
function verifySession(token){
  try{
    const [enc,sig]=String(token||'').split('.');
    if(!enc||!sig) return null;
    const payload=Buffer.from(enc,'base64url').toString('utf8');
    const expected=crypto.createHmac('sha256',sessionSecret()).update(payload).digest('base64url');
    if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
    const [id,exp]=payload.split('.').map(Number);
    if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(exp)||exp<Math.floor(Date.now()/1000)) return null;
    return id;
  }catch{return null}
}
function cookie(event,name){
  const raw=event.headers?.cookie||event.headers?.Cookie||'';
  const found=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return found?decodeURIComponent(found.slice(name.length+1)):'';
}

exports.handler=async(event)=>{
  try{
    if(event.httpMethod==='POST'){
      const body=JSON.parse(event.body||'{}');
      const telegramId=verifyTelegramLogin(body.user);
      if(!telegramId) return json(401,{error:'Unauthorized'});
      const {data,error}=await db().from('licenses').select('status').eq('telegram_id',telegramId).eq('status','active').maybeSingle();
      if(error) throw error;
      if(!data) return json(403,{error:'License required'});
      const token=makeSession(telegramId);
      return json(200,{ok:true}, { 'set-cookie': `rasscheet_ios_session=${encodeURIComponent(token)}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax` });
    }
    if(event.httpMethod==='GET'){
      const telegramId=verifySession(cookie(event,'rasscheet_ios_session'));
      if(!telegramId) return {statusCode:401,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'},body:'License required'};
      const {data,error}=await db().from('licenses').select('status').eq('telegram_id',telegramId).eq('status','active').maybeSingle();
      if(error) throw error;
      if(!data) return {statusCode:403,headers:{'content-type':'text/plain; charset=utf-8'},body:'License required'};
      const html=fs.readFileSync(path.resolve(__dirname,'../../private/app.html'),'utf8');
      return {statusCode:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'},body:html};
    }
    return {statusCode:405,headers:{'allow':'GET, POST'},body:'Method not allowed'};
  }catch(e){
    console.error(e);
    return json(500,{error:'Server error'});
  }
};
