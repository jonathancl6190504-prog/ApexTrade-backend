const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const TradingBot = require('./bot');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));

const bot = new TradingBot();

// Broadcast to all WebSocket clients
function broadcast(data) {
  wss.clients.forEach(client => {
 if (client.readyState === WebSocket.OPEN) {
 client.send(JSON.stringify(data));
 }
  });
}

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'connected', message: 'Connected to ApexTrade' }));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Account info
app.get('/api/account', (req, res) => {
  try {
 const summary = bot.paperEngine.getAccountSummary();
 res.json(summary);
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Open positions
app.get('/api/positions', (req, res) => {
  try {
 const positions = bot.paperEngine.getOpenPositions();
 res.json({ openPositions: positions });
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Trade history
app.get('/api/history', (req, res) => {
  try {
 const history = bot.paperEngine.getTradeHistory();
 res.json({ history });
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Buy
app.post('/api/trade/buy', (req, res) => {
  try {
 const { symbol, price, quantity } = req.body;
 const result = bot.paperEngine.openPosition(symbol, 'long', price, quantity);
 broadcast({ type: 'trade', action: 'buy', result });
 res.json(result);
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Sell
app.post('/api/trade/sell', (req, res) => {
  try {
 const { symbol, price, quantity } = req.body;
 const result = bot.paperEngine.openPosition(symbol, 'short', price, quantity);
 broadcast({ type: 'trade', action: 'sell', result });
 res.json(result);
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Close all positions
app.post('/api/trade/close-all', (req, res) => {
  try {
 const result = bot.paperEngine.closeAllPositions();
 broadcast({ type: 'trade', action: 'close-all', result });
 res.json(result);
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Start bot
app.post('/api/bot/start', (req, res) => {
  try {
 bot.start();
 res.json({ status: 'running' });
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Stop bot
app.post('/api/bot/stop', (req, res) => {
  try {
 bot.stop();
 res.json({ status: 'stopped' });
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

// Stripe subscribe
app.post('/api/subscribe', async (req, res) => {
  try {
 const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 const session = await stripe.checkout.sessions.create({
 payment_method_types: ['card'],
 mode: 'subscription',
 line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
 success_url: process.env.FRONTEND_URL + '?subscribed=true',
 cancel_url: process.env.FRONTEND_URL + '?cancelled=true',
 });
 res.json({ url: session.url });
  } catch (err) {
 res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ApexTrade running on port ${PORT}`);
});
