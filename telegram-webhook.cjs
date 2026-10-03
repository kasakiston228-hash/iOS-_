const https = require('node:https');

function json(code, obj){
  return {statusCode:code,headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify(obj)};
}

function telegram(method, payload){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) throw Error('TELEGRAM_BOT_TOKEN is not configured');
  const body=JSON.stringify(payload||{});
  return new Promise((resolve,reject)=>{
    const req=https.request({
      hostname:'api.telegram.org',
      path:`/bot${token}/${method}`,
      method:'POST',
      headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}
    },res=>{
      let data=''; res.setEncoding('utf8');
      res.on('data',c=>data+=c);
      res.on('end',()=>{
        try{const j=JSON.parse(data); j.ok?resolve(j):reject(Error(j.description||'Telegram API error'));}
        catch(e){reject(e)}
      });
    });
    req.on('error',reject); req.write(body); req.end();
  });
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{ok:false});
  try{
    const update=JSON.parse(event.body||'{}');
    const msg=update.message;
    if(!msg || !msg.chat || msg.chat.type!=='private') return json(200,{ok:true});
    const text=String(msg.text||'').trim();
    if(!/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) return json(200,{ok:true});

    const site=(process.env.IOS_SITE_URL || `https://${event.headers?.host||''}`).replace(/\/$/,'');
    await telegram('sendMessage',{
      chat_id:msg.chat.id,
      text:'Привет! 👋\n\nRasscheet 0.1 для iPhone открывается кнопкой ниже.\n\nЛицензия остаётся привязанной к твоему Telegram ID.',
      reply_markup:{inline_keyboard:[[{text:'📱 Открыть Rasscheet 0.1',url:site}]]}
    });
    return json(200,{ok:true});
  }catch(e){
    console.error(e);
    return json(500,{ok:false,error:'Webhook error'});
  }
};
