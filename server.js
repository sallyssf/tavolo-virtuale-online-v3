const http = require("http"), fs = require("fs"), path = require("path"), WebSocket = require("ws");
const PORT = process.env.PORT || 8080, PUBLIC = path.join(__dirname, "public");
const rooms = new Map();

let game = {
  tokens: [
    { id: "a1", name: "Arannis", type: "hero", hp: 19, maxHp: 19, init: 18, x: 360, y: 470, sheet: sheet("Arannis", "Guerriero") },
    { id: "a2", name: "Theren", type: "hero", hp: 24, maxHp: 24, init: 15, x: 420, y: 520, sheet: sheet("Theren", "Guerriero") },
    { id: "e1", name: "Goblin", type: "enemy", hp: 7, maxHp: 7, init: 12, x: 650, y: 540, sheet: sheet("Goblin", "Mostro") },
    { id: "e2", name: "Goblin", type: "enemy", hp: 7, maxHp: 7, init: 8, x: 720, y: 620, sheet: sheet("Goblin", "Mostro") }
  ],
  turn: 0
};

function sheet(name, cls) {
  return {
    name, class: cls, level: 1, race: "", background: "", ac: 10, speed: 9,
    stats: { Forza: 10, Destrezza: 10, Costituzione: 10, Intelligenza: 10, Saggezza: 10, Carisma: 10 },
    proficiencies: [], saves: [], inventory: [], conditions: []
  };
}

const server = http.createServer((req, res) => {
  let u = (req.url || "/").split("?")[0];
  if (u === "/") u = "/index.html";
  const file = path.resolve(PUBLIC, u.slice(1));
  if (!file.startsWith(path.resolve(PUBLIC) + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const ext = path.extname(file);
  const type = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".css": "text/css" }[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocket.Server({ server });

function broadcast(x) {
  const m = JSON.stringify(x);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(m);
  });
}

function saveRoomState(ws) {
  if (ws && ws.room) {
    rooms.set(ws.room, { tokens: game.tokens, turn: game.turn, name: (rooms.get(ws.room) || {}).name || ws.room });
  }
}

function snapshot() { broadcast({ type: "state", state: game }); }

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "state", state: game }));
  
  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === "room_create" || m.type === "room_join") {
      const room = String(m.room || "default").toUpperCase();
      if (!rooms.has(room)) rooms.set(room, { tokens: [], turn: 0, name: m.name || room });
      ws.room = room;
      const r = rooms.get(room);
      game.tokens = r.tokens;
      game.turn = r.turn;
      snapshot();
      return;
    }

    if (m.type === "token_move") {
      const t = game.tokens.find(x => x.id === m.id);
      if (t) { t.x = Number(m.x); t.y = Number(m.y); saveRoomState(ws); snapshot(); }
    } else if (m.type === "rename_token") {
      const t = game.tokens.find(x => x.id === m.id);
      if (t) { t.name = String(m.name || "").slice(0, 40); if (t.sheet) t.sheet.name = t.name; saveRoomState(ws); snapshot(); }
    } else if (m.type === "delete_token") {
      game.tokens = game.tokens.filter(x => x.id !== m.id); saveRoomState(ws); snapshot();
    } else if (m.type === "add_token") {
      game.tokens.push(m.token); saveRoomState(ws); snapshot();
    } else if (m.type === "update_sheet") {
      const t = game.tokens.find(x => x.id === m.id);
      if (t) { t.sheet = m.sheet; t.name = m.name || t.name; t.hp = Number(m.hp) || 0; t.maxHp = Number(m.maxHp) || 1; saveRoomState(ws); snapshot(); }
    } else if (m.type === "hp_change") {
      const t = game.tokens.find(x => x.id === m.id);
      if (t) { t.hp = Math.max(0, Math.min(t.maxHp, Number(m.hp) || 0)); saveRoomState(ws); snapshot(); }
    } else if (m.type === "condition_change") {
      const t = game.tokens.find(x => x.id === m.id);
      if (t) { t.sheet = t.sheet || {}; t.sheet.conditions = m.conditions || []; saveRoomState(ws); snapshot(); }
    } else if (m.type === "turn_change") {
      game.turn = Number(m.turn) || 0; saveRoomState(ws); snapshot();
    } else if (m.type === "campaign_save") {
      if (Array.isArray(m.tokens)) game.tokens = m.tokens;
      if (Number.isFinite(m.turn)) game.turn = m.turn;
      saveRoomState(ws); snapshot();
    } else if (m.type === "turn_end") {
      game.turn = (game.turn + 1) % Math.max(1, game.tokens.length);
      snapshot(); broadcast({ type: "system", message: "Turno successivo." });
    } else if (m.type === "chat") {
      broadcast({ type: "chat", message: String(m.message || "").slice(0, 500) });
    }
  });
});

server.listen(PORT, "0.0.0.0", () => console.log("Tavolo virtuale online sulla porta " + PORT));
