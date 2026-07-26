const http=require("http");
const fs=require("fs");
const path=require("path");
const WebSocket=require("ws");
const PORT=process.env.PORT||8080;
const PUBLIC=path.join(__dirname,"public");
let game={tokens:[{id:"a1",name:"Arannis",type:"hero",hp:19,init:18,x:360,y:470},{id:"a2",name:"Theren",type:"hero",hp:24,init:15,x:420,y:520},{id:"e1",name:"Goblin",type:"enemy",hp:7,init:12,x:650,y:540},{id:"e2",name:"Goblin",type:"enemy",hp:7,init:8,x:720,y:620}],fogHoles:[{x:290,y:410,w:230,h:230}],turn:0};
const server=http.createServer((req,res)=>{let u=(req.url||"/").split("?")[0];if(u==="/")u="/index.html";const file=path.resolve(PUBLIC,u.slice(1));if(!file.startsWith(path.resolve(PUBLIC)+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end("Not found")}const ext=path.extname(file);const type={".html":"text/html; charset=utf-8",".png":"image/png",".js":"text/javascript",".css":"text/css"}[ext]||"application/octet-stream";res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-cache"});fs.createReadStream(file).pipe(res)});
const wss=new WebSocket.Server({server});
function broadcast(x){const m=JSON.stringify(x);wss.clients.forEach(c=>{if(c.readyState===WebSocket.OPEN)c.send(m)})}
function snapshot(){broadcast({type:"state",state:game})}
wss.on("connection",ws=>{ws.send(JSON.stringify({type:"state",state:game}));ws.on("message",raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==="token_move"){let t=game.tokens.find(x=>x.id===m.id);if(t){t.x=Number(m.x);t.y=Number(m.y);snapshot()}}
else if(m.type==="rename_token"){let t=game.tokens.find(x=>x.id===m.id);if(t){t.name=String(m.name||"").slice(0,40);snapshot()}}
else if(m.type==="delete_token"){game.tokens=game.tokens.filter(x=>x.id!==m.id);snapshot()}
else if(m.type==="add_token"){game.tokens.push(m.token);snapshot()}
else if(m.type==="state"){game=m.state;snapshot()}
else if(m.type==="fog_add"){game.fogHoles.push(m.hole);snapshot()}
else if(m.type==="turn_end"){game.turn++;snapshot();broadcast({type:"system",message:"Turno "+game.turn+" iniziato."})}
else if(m.type==="chat"){broadcast({type:"chat",from:"Giocatore",message:String(m.message||"").slice(0,500)})}})});
server.listen(PORT,"0.0.0.0",()=>console.log("Tavolo virtuale online: http://localhost:"+PORT));
