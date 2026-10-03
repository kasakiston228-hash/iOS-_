const https=require('node:https');
const {createClient}=require('@supabase/supabase-js');

function reply(code,obj){return {statusCode:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(obj)}}
function adminOk(event){
  const expected=String(process.env.ADMIN_SECRET||'');
  const got=String(event.headers?.['x-admin-secret']||event.headers?.['X-Admin-Secret']||'');
  return expected && got && got===expected;
}
function tg(method,payload){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) throw Error('TELEGRAM_BOT_TOKEN is not configured');
  const body=JSON.stringify(payload);
  return new Promise((resolve,reject)=>{
    const req=https.request({hostname:'api.telegram.org',path:`/bot${token}/${method}`,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      let data='';res.setEncoding('utf8');res.on('data',c=>data+=c);res.on('end',()=>{try{const j=JSON.parse(data);j.ok?resolve(j):reject(Error(j.description||'Telegram API error'))}catch(e){reject(e)}})
    });
    req.on('error',reject);req.write(body);req.end();
  });
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
exports.handler=async(event)=>{
  if(!adminOk(event)) return reply(401,{error:'Unauthorized'});
  try{
    const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    const {data,error}=await supabase.from('licenses').select('telegram_id').eq('status','active').not('telegram_id','is',null);
    if(error) throw error;
    const ids=[...new Set((data||[]).map(x=>Number(x.telegram_id)).filter(x=>Number.isSafeInteger(x)&&x>0))];
    if(event.httpMethod==='GET') return reply(200,{ok:true,recipients:ids.length});
    if(event.httpMethod!=='POST') return reply(405,{error:'Method'});
    const body=JSON.parse(event.body||'{}');
    const text=String(body.text||'').trim();
    if(!text) return reply(400,{error:'Введите текст сообщения'});
    if(text.length>4096) return reply(400,{error:'Сообщение слишком длинное (максимум 4096 символов)'});
    let sent=0,failed=0,errors=[];
    for(const id of ids){
      try{await tg('sendMessage',{chat_id:id,text,disable_web_page_preview:true});sent++}
      catch(e){failed++;if(errors.length<10)errors.push({telegram_id:id,error:String(e.message||e)})}
      await sleep(40);
    }
    return reply(200,{ok:true,total:ids.length,sent,failed,errors});
  }catch(e){console.error(e);return reply(500,{error:'Ошибка рассылки'})}
};
