(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let socket=null,player=1,inRoom=false,active=false,lastState=0;
 const status=text=>$('networkStatus').textContent=text;
 function send(msg){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(msg));}
 function buttons(){ $('createRoom').disabled=inRoom;$('joinRoom').disabled=inRoom;$('leaveRoom').hidden=!inRoom; }
 function clear(){inRoom=false;active=false;buttons();$('rematch').hidden=true;$('onePlayerButton').disabled=false;$('twoPlayerButton').disabled=false;}
 async function connect(){
  if(socket?.readyState===WebSocket.OPEN)return;
  if(socket)socket.close();
  const configured=$('serverUrl').value.trim();
  let url;
  try{url=new URL(configured||location.origin);if(!['http:','https:','ws:','wss:'].includes(url.protocol))throw Error();}
  catch{throw Error('サーバーURLを確認してください。');}
  url.protocol=['https:','wss:'].includes(url.protocol)?'wss:':'ws:';url.pathname='/ws';url.search='';url.hash='';
  if(location.protocol==='https:' && url.protocol!=='wss:')throw Error('HTTPSページではHTTPSのサーバーURLが必要です。');
  status('サーバーに接続中…');
  await new Promise((resolve,reject)=>{
   const ws=new WebSocket(url);socket=ws;
   const timer=setTimeout(()=>{ws.close();reject(Error('接続がタイムアウトしました。サーバー起動後に再試行してください。'));},15000);
   ws.onopen=()=>{clearTimeout(timer);resolve();};
   ws.onerror=()=>{clearTimeout(timer);reject(Error('接続できません。サーバーURLと起動状態を確認してください。'));};
   ws.onclose=()=>{clearTimeout(timer);if(socket!==ws)return;const wasActive=active;clear();if(wasActive)window.BoxGame.title();status('接続が切れました。ルームを作成・参加し直してください。');reject(Error('接続が終了しました。'));};
   ws.onmessage=e=>{
    if(socket!==ws)return;
    let msg;try{msg=JSON.parse(e.data);}catch{return;}
    if(msg.type==='room'){
     inRoom=true;player=msg.player;buttons();$('roomCode').value=msg.code;
     $('onePlayerButton').disabled=true;$('twoPlayerButton').disabled=true;
     status(`ルーム ${msg.code} ｜ あなたは P${player}（${player===1?'青':'赤'}）${player===1?' ｜ 相手の参加待ち':''}`);
    }
    if(msg.type==='start'){
     active=true;lastState=Date.now();window.BoxGame.begin(player);$('rematch').hidden=true;$('rematch').disabled=false;$('rematch').textContent='再対戦';
     status(`対戦中 ｜ ${$('roomCode').value} ｜ あなたは P${player}（${player===1?'青':'赤'}）`);
    }
    if(msg.type==='state' && active){lastState=Date.now();window.BoxGame.receive(msg.model,msg.serverTime);$('rematch').hidden=msg.model.state!=='Complete';}
    if(msg.type==='votes')status(`再対戦の準備 ${msg.count}/2人 ｜ 両者が「再対戦」を押すと開始`);
    if(msg.type==='left'){const wasActive=active;clear();if(wasActive)window.BoxGame.title();status(msg.message);}
    if(msg.type==='error')status(msg.message);
   };
  });
 }
 let pending=false;
 async function act(type){if(pending)return;pending=true;try{await connect();send({type,code:$('roomCode').value});}catch(e){status(e.message);}finally{pending=false;}}
 $('createRoom').onclick=()=>act('create');$('joinRoom').onclick=()=>act('join');
 window.BoxOnline={leave(){send({type:'leave'});clear();}};
 $('leaveRoom').onclick=()=>{window.BoxOnline.leave();window.BoxGame.title();status('ルームを退出しました。');};
 $('rematch').onclick=()=>{send({type:'rematch'});$('rematch').disabled=true;$('rematch').textContent='相手の準備待ち';};
 $('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText($('roomCode').value);status('ルームコードをコピーしました。相手に送ってください。');}catch{status('コード欄を長押ししてコピーしてください。');}};
 setInterval(()=>{
  if(!active)return;
  if(Date.now()-lastState>10000){socket?.close();return;}
  if(socket?.bufferedAmount<2048)send({type:'input',input:document.hidden?{x:0,y:0,angle:0,fire:false,mine:false}:window.BoxGame.input()});
 },1000/30);
 document.addEventListener('visibilitychange',()=>{if(document.hidden && active)send({type:'input',input:{x:0,y:0,angle:0,fire:false,mine:false}});});
})();
