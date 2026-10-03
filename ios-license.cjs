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
function hashCode(code){
  const secret=process.env.CODE_HASH_SECRET;
  if(!secret) throw Error('CODE_HASH_SECRET is not configured');
  return crypto.createHmac('sha256',secret).update(String(code||'').trim().toUpperCase()).digest('hex');
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return reply(405,{error:'Method'});
  try{
    const body=JSON.parse(event.body||'{}');
    const telegramId=verifyTelegramLogin(body.user);
    if(!telegramId) return reply(401,{error:'Не удалось подтвердить вход через Telegram'});
    const code=String(body.code||'').trim().toUpperCase();
    if(!/^RS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return reply(400,{error:'Неверный формат кода'});

    const supabase=db();
    const codeHash=hashCode(code);
    const {data:license,error:findError}=await supabase.from('licenses').select('code_hash,status,telegram_id').eq('code_hash',codeHash).maybeSingle();
    if(findError) throw findError;
    if(!license) return reply(200,{result:'invalid'});
    if(license.status==='revoked') return reply(200,{result:'revoked'});
    if(license.status==='active' && Number(license.telegram_id)===telegramId) return reply(200,{result:'already_yours'});
    if(license.status!=='new' || license.telegram_id) return reply(200,{result:'used'});

    const {data:already,error:alreadyError}=await supabase.from('licenses').select('code_hash').eq('telegram_id',telegramId).eq('status','active').maybeSingle();
    if(alreadyError) throw alreadyError;
    if(already) return reply(200,{result:'already_licensed'});

    const now=new Date().toISOString();
    const {data:updated,error:updateError}=await supabase.from('licenses').update({status:'active',telegram_id:telegramId,activated_at:now}).eq('code_hash',codeHash).eq('status','new').is('telegram_id',null).select('code_hash').maybeSingle();
    if(updateError) throw updateError;
    if(updated) return reply(200,{result:'activated'});

    const {data:after,error:afterError}=await supabase.from('licenses').select('status,telegram_id').eq('code_hash',codeHash).maybeSingle();
    if(afterError) throw afterError;
    if(after && after.status==='active' && Number(after.telegram_id)===telegramId) return reply(200,{result:'already_yours'});
    return reply(200,{result:'used'});
  }catch(e){
    console.error(e);
    return reply(500,{error:'Ошибка сервера'});
  }
};
