const WebSocket = require('ws');

class WSServer {
  constructor(port = 8080) {
 this.port = port;
 this.wss = new WebSocket.Server({ port });
 this.clients = new Set();
 this.setupConnectionHandlers();
  }

  /**
 * Setup WebSocket connection handlers
 */
  setupConnectionHandlers() {
 this.wss.on('connection', (ws) => {
 console.log('Client connected');
 this.clients.add(ws);

 ws.on('message', (message) => {
 this.handleMessage(ws, message);
 });

 ws.on('close', () => {
 console.log('Client disconnected');
 this.clients.delete(ws);
 });

 ws.on('error', (error) => {
 console.error('WebSocket error:', error);
 });

 // Send welcome message
 this.sendMessage(ws, {
 type: 'CONNECTED',
 message: 'Connected to trading bot server',
 timestamp: new Date().toISOString(),
 });
 });
  }

  /**
 * Handle incoming messages from clients
 * @param {WebSocket} ws - Client WebSocket
 * @param {string} message - Message data
 */
  handleMessage(ws, message) {
 try {
 const data = JSON.parse(message);

 switch (data.type) {
 case 'PING':
 this.sendMessage(ws, {
 type: 'PONG',
 timestamp: new Date().toISOString(),
 });
 break;
 case 'SUBSCRIBE':
 console.log(`Client subscribed to: ${data.channel}`);
 this.sendMessage(ws, {
 type: 'SUBSCRIBED',
 channel: data.channel,
 timestamp: new Date().toISOString(),
 });
 break;
 default:
 console.log('Unknown message type:', data.type);
 }
 } catch (error) {
 console.error('Error handling message:', error);
 this.sendMessage(ws, {
 type: 'ERROR',
 message: 'Failed to process message',
 });
 }
  }

  /**
 * Send message to single client
 * @param {WebSocket} ws - Target client
 * @param {object} data - Message data
 */
  sendMessage(ws, data) {
 if (ws.readyState === WebSocket.OPEN) {
 ws.send(JSON.stringify(data));
 }
  }

  /**
 * Broadcast message to all connected clients
 * @param {object} data - Message data
 */
  broadcast(data) {
 const message = JSON.stringify(data);
 this.clients.forEach((client) => {
 if (client.readyState === WebSocket.OPEN) {
 client.send(message);
 }
 });
  }

  /**
 * Broadcast signal update
 * @param {string} symbol - Trading symbol
 * @param {object} signals - Signal data by timeframe
 */
  broadcastSignalUpdate(symbol, signals) {
 this.broadcast({
 type: 'SIGNAL_UPDATE',
 symbol,
 signals,
 timestamp: new Date().toISOString(),
 });
  }

  /**
 * Broadcast trade execution
 * @param {object} trade - Trade data
 */
  broadcastTradeExecuted(trade) {
 this.broadcast({
 type: 'TRADE_EXECUTED',
 trade: {
 id: trade.id,
 symbol: trade.symbol,
 action: trade.action,
 entryPrice: trade.entryPrice,
 quantity: trade.quantity,
 timestamp: trade.entryTime,
 },
 timestamp: new Date().toISOString(),
 });
  }

  /**
 * Broadcast position closed
 * @param {object} closedTrade - Closed trade data
 */
  broadcastPositionClosed(closedTrade) {
 this.broadcast({
 type: 'POSITION_CLOSED',
 trade: {
 symbol: closedTrade.symbol,
 action: closedTrade.action,
 entryPrice: closedTrade.entryPrice,
 exitPrice: closedTrade.exitPrice,
 pnl: closedTrade.pnl,
 returnPercent: closedTrade.returnPercent,
 exitTime: closedTrade.exitTime,
 },
 timestamp: new Date().toISOString(),
 });
  }

  /**
 * Broadcast account update
 * @param {object} accountSummary - Account summary data
 */
  broadcastAccountUpdate(accountSummary) {
 this.broadcast({
 type: 'ACCOUNT_UPDATE',
 account: {
 balance: accountSummary.balance,
 equity: accountSummary.equity,
 usedMargin: accountSummary.usedMargin,
 availableMargin: accountSummary.availableMargin,
 marginRatio: accountSummary.marginRatio,
 positionCount: accountSummary.positionCount,
 },
 timestamp: new Date().toISOString(),
 });
  }

  /**
 * Broadcast bot status
 * @param {string} status - 'RUNNING' or 'STOPPED'
 * @param {string} message - Status message
 */
  broadcastBotStatus(status, message) {
 this.broadcast({
 type: 'BOT_STATUS',
 status,
 message,
 timestamp: new Date().toISOString(),
 });
  }

  /**
 * Broadcast error
 * @param {string} error - Error message
 */
  broadcastError(error) {
 this.broadcast({
 type: 'ERROR',
 message: error,
 timestamp: new Date().toISOString(),
 });
  }

  /**
 * Get number of connected clients
 * @returns {number} Client count
 */
  getClientCount() {
 return this.clients.size;
  }

  /**
 * Close WebSocket server
 */
  close() {
 this.wss.close();
  }
}

module.exports = WSServer;
