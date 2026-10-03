const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

function db(){
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Server not configured');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
}
function reply(code,obj){
  return {statusCode:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(obj)};
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
  if(!/^[a-f0-9]{64}$/i.test(hash) || !Number.isSafeInteger(auth) || Math.abs(Date.now()/1000-auth)>86400) return null;
  pairs.sort(([a],[b])=>a.localeCompare(b));
  const dataCheck=pairs.map(([k,v])=>k+'='+v).join('\n');
  const secret=crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const actual=crypto.createHmac('sha256',secret).update(dataCheck).digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(actual,'hex'))) return null;
  const id=Number(user.id);
  return Number.isSafeInteger(id)&&id>0?id:null;
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return reply(405,{error:'Method'});
  try{
    const body=JSON.parse(event.body||'{}');
    const telegramId=verifyTelegramLogin(body.user);
    if(!telegramId) return reply(401,{error:'Не удалось подтвердить вход через Telegram'});
    const {data,error}=await db().from('licenses').select('status').eq('telegram_id',telegramId).eq('status','active').maybeSingle();
    if(error) throw error;
    if(!data) return reply(403,{error:'Для этого Telegram ID нет активной лицензии. Сначала активируй код в Telegram.'});
    return reply(200,{active:true});
  }catch(e){
    console.error(e);
    return reply(500,{error:'Ошибка сервера'});
  }
};
