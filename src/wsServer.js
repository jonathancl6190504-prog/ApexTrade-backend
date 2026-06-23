const WebSocket = require('ws');

class WSServer {
  constructor() {
 this.wss = null;
 this.clients = new Set();
  }

  attach(httpServer) {
 this.wss = new WebSocket.Server({ server: httpServer });
 this.wss.on('connection', (ws) => {
 this.clients.add(ws);
 ws.send(JSON.stringify({ type: 'CONNECTED' }));
 ws.on('close', () => this.clients.delete(ws));
 });
 console.log('WebSocket server attached to HTTP server');
  }

  broadcast(data) {
 const msg = JSON.stringify(data);
 this.clients.forEach(ws => {
 if (ws.readyState === WebSocket.OPEN) ws.send(msg);
 });
  }
}

module.exports = WSServer;
