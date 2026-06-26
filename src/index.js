require('dotenv').config();
const express = require('express');
const http = require('http');
const TradingBot = require('./tradingBot');
const WSServer = require('./wsServer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const wsServer = new WSServer();
const bot = new TradingBot({
  polygonKey: process.env.POLYGON_API_KEY,
  finnhubKey: process.env.FINNHUB_API_KEY,
  initialBalance: parseFloat(process.env.INITIAL_BALANCE || 100000),
  watchList: (process.env.WATCH_LIST || 'ES,NQ,CL').split(','),
});

app.post('/api/bot/start', async (req, res) => {
  if (bot.isRunning) return res.status(400).json({ error: 'Bot already running' });
  await bot.startAutomatedTrading(wsServer);
  wsServer.broadcast({ type: 'BOT_STARTED', mode: 'AUTO' });
  res.json({ success: true });
});

app.post('/api/bot/stop', (req, res) => {
  bot.stopTrading();
  wsServer.broadcast({ type: 'BOT_STOPPED' });
  res.json({ success: true });
});

app.get('/api/account', (req, res) => res.json(bot.getAccountSummary()));
app.get('/api/positions', (req, res) => res.json({ openPositions: bot.engine.positions }));
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ trades: bot.getTradingHistory(limit) });
});

app.post('/api/trade/buy', (req, res) => {
  const { symbol, price, quantity = 1 } = req.body;
  const result = bot.executeManualTrade('BUY', symbol, price, quantity);
  if (result.success) wsServer.broadcast({ type: 'TRADE_EXECUTED', action: 'BUY', symbol, price });
  res.json(result);
});

app.post('/api/trade/sell', (req, res) => {
  const { positionId, exitPrice } = req.body;
  const result = bot.closePosition(positionId, exitPrice);
  if (result.success) wsServer.broadcast({ type: 'POSITION_CLOSED', positionId, exitPrice });
  res.json(result);
});

app.post('/api/trade/close-all', (req, res) => {
  bot.engine.closeAllPositions();
  wsServer.broadcast({ type: 'ALL_POSITIONS_CLOSED' });
  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

async function start() {
  const httpServer = http.createServer(app);
  await wsServer.start(httpServer);
  httpServer.listen(PORT, () => {
 console.log(`🚀 Backend running on port ${PORT}`);
 console.log(`🔌 WebSocket attached on port ${PORT}`);
  });
}

start().catch(console.error);
