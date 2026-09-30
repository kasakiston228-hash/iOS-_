const https=require('node:https');
function telegram(method,payload){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) throw Error('TELEGRAM_BOT_TOKEN is not configured');
  const body=JSON.stringify(payload);
  return new Promise((resolve,reject)=>{
    const req=https.request({hostname:'api.telegram.org',path:`/bot${token}/${method}`,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const j=JSON.parse(d);j.ok?resolve(j):reject(Error(j.description||'Telegram API error'))}catch(e){reject(e)}})});req.on('error',reject);req.write(body);req.end();
  });
}
exports.handler=async(event)=>{
  if(event.httpMethod!=='GET') return {statusCode:405,body:'Method not allowed'};
  try{
    const site=(process.env.IOS_SITE_URL||`https://${event.headers?.host||''}`).replace(/\/$/,'');
    const r=await telegram('setWebhook',{url:`${site}/.netlify/functions/telegram-webhook`});
    return {statusCode:200,headers:{'content-type':'application/json'},body:JSON.stringify(r)};
  }catch(e){return {statusCode:500,headers:{'content-type':'application/json'},body:JSON.stringify({ok:false,error:e.message})};}
};
