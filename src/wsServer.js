// src/wsServer.js
const { WebSocketServer } = require('ws');

class WSServer {
  constructor(port) {
 this.port = port;
 this.wss = null;
 this.clients = new Set();
  }

  async start() {
 this.wss = new WebSocketServer({ port: this.port });

 this.wss.on('connection', (ws) => {
 this.clients.add(ws);
 console.log(`📱 Client connected (${this.clients.size} total)`);

 // Send welcome
 ws.send(JSON.stringify({
 type: 'CONNECTED',
 message: 'ApexTrade WebSocket ready',
 timestamp: new Date().toISOString(),
 }));

 ws.on('close', () => {
 this.clients.delete(ws);
 console.log(`📱 Client disconnected (${this.clients.size} remaining)`);
 });

 ws.on('error', (err) => {
 console.error('WebSocket client error:', err.message);
 this.clients.delete(ws);
 });
 });

 return new Promise((resolve) => {
 this.wss.on('listening', () => {
 console.log(`📡 WebSocket server listening on port ${this.port}`);
 resolve();
 });
 });
  }

  broadcast(data) {
 const msg = JSON.stringify(data);
 for (const client of this.clients) {
 if (client.readyState === 1) { // OPEN
 client.send(msg);
 }
 }
  }

  send(client, data) {
 if (client.readyState === 1) {
 client.send(JSON.stringify(data));
 }
  }
}

module.exports = WSServer;
