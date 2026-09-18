'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {WebSocketServer, WebSocket} = require('ws');
const createMatch = require('./engine.cjs');
const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/game.js':'game.js','/renderer.js':'renderer.js','/audio.js':'audio.js','/online.js':'online.js','/sync.js':'sync.js'};
const server = http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/health'){res.writeHead(200);return res.end('ok');}
 const name=files[pathname];
 if(!name){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
 fs.createReadStream(path.join(__dirname,'public',name)).pipe(res);
});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048});
const rooms=new Map();
function send(ws,msg){if(ws.readyState===WebSocket.OPEN && ws.bufferedAmount<256000)ws.send(JSON.stringify(msg));}
function broadcast(room,msg){
 if(msg.type==='state')msg.serverTime=performance.now();
 const payload=JSON.stringify(msg);
 for(const ws of room.players){
  // Drop superseded snapshots rather than accumulating seconds of old positions.
  const limit=msg.type==='state'?16384:256000;
  if(ws.readyState===WebSocket.OPEN && ws.bufferedAmount<limit)ws.send(payload);
 }
}
function leave(ws){
 const room=ws.room;if(!room)return;
 rooms.delete(room.code);
 for(const peer of room.players){peer.room=null;send(peer,{type:'left',message:peer===ws?'ルームを退出しました。':'相手が退出・切断しました。ルームを作り直してください。'});}
}
function fail(ws,message){send(ws,{type:'error',message});}
wss.on('connection',ws=>{
 if(wss.clients.size>200){ws.close(1013,'Server full');return;}
 ws.alive=true;ws.rate=0;ws.rateAt=Date.now();
 ws.on('pong',()=>ws.alive=true);
 ws.on('error',()=>{});
 ws.on('close',()=>leave(ws));
 ws.on('message',raw=>{
  if(Date.now()-ws.rateAt>1000){ws.rate=0;ws.rateAt=Date.now();}
  if(++ws.rate>120){ws.close(1008,'Rate limit');return;}
  let msg;try{msg=JSON.parse(raw);}catch{return fail(ws,'通信データが不正です。');}
  if(!msg || typeof msg!=='object')return;
  if(msg.type==='leave'){leave(ws);return;}
  if(msg.type==='create'){
   if(ws.room)return fail(ws,'先に現在のルームを退出してください。');
   if(rooms.size>=100)return fail(ws,'満室です。時間をおいてお試しください。');
   let code;do{code=crypto.randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
   const room={code,players:[ws],match:null,votes:new Set(),created:Date.now()};rooms.set(code,room);ws.room=room;
   send(ws,{type:'room',code,player:1});return;
  }
  if(msg.type==='join'){
   if(ws.room)return fail(ws,'先に現在のルームを退出してください。');
   const room=typeof msg.code==='string' && rooms.get(msg.code.trim().toUpperCase());
   if(!room)return fail(ws,'ルームが見つかりません。コードを確認してください。');
   if(room.players.length!==1)return fail(ws,'このルームは満員です（2人まで）。');
   room.players.push(ws);ws.room=room;room.match=createMatch();
   send(ws,{type:'room',code:room.code,player:2});
   broadcast(room,{type:'start'});broadcast(room,{type:'state',model:room.match.snapshot()});return;
  }
  const room=ws.room;if(!room?.match)return;
  if(msg.type==='input')room.match.input(room.players.indexOf(ws),msg.input);
  if(msg.type==='rematch' && room.match.snapshot().state==='Complete'){
   room.votes.add(ws);broadcast(room,{type:'votes',count:room.votes.size});
   if(room.votes.size===2){room.votes.clear();room.match.reset();broadcast(room,{type:'start'});}
  }
 });
});
const STEP=1000/60;
let previous=performance.now(),accumulator=0,frame=0;
const tick=setInterval(()=>{
 const now=performance.now();accumulator=Math.min(accumulator+now-previous,STEP*5);previous=now;
 let steps=0;
 while(accumulator>=STEP){accumulator-=STEP;steps++;}
 if(!steps)return;
 const publish=Math.floor((frame+steps)/2)!==Math.floor(frame/2);frame+=steps;
 for(const room of rooms.values()){
  if(!room.match){if(Date.now()-room.created>30*60*1000)leave(room.players[0]);continue;}
  for(let i=0;i<steps;i++)room.match.tick();
  if(publish)broadcast(room,{type:'state',model:room.match.snapshot()});
 }
},8);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`BOX TANKS listening on ${server.address().port}`));
function shutdown(){clearInterval(tick);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();server.close();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
