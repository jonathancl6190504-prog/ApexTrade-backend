const { v4: uuidv4 } = require('uuid');

class PaperTradingEngine {
  constructor() {
 this.balance = 10000;
 this.positions = [];
 this.history = [];
  }

  getAccountSummary() {
 const unrealizedPnl = this.positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
 return {
 balance: this.balance,
 unrealizedPnl,
 totalValue: this.balance + unrealizedPnl,
 openPositions: this.positions.length
 };
  }

  getPositions() {
 return this.positions;
  }

  getHistory() {
 return this.history;
  }

  buy(symbol, quantity, price) {
 const cost = quantity * price;
 if (cost > this.balance) throw new Error('Insufficient balance');
 this.balance -= cost;
 const position = { id: uuidv4(), symbol, quantity, entryPrice: price, currentPrice: price, unrealizedPnl: 0, side: 'long', openedAt: new Date().toISOString() };
 this.positions.push(position);
 return position;
  }

  sell(symbol, quantity, price) {
 const position = this.positions.find(p => p.symbol === symbol && p.side === 'long');
 if (!position) throw new Error('No position found');
 const proceeds = quantity * price;
 const pnl = (price - position.entryPrice) * quantity;
 this.balance += proceeds;
 this.positions = this.positions.filter(p => p.id !== position.id);
 const record = { ...position, exitPrice: price, realizedPnl: pnl, closedAt: new Date().toISOString() };
 this.history.push(record);
 return record;
  }

  closeAll(currentPrice) {
 const closed = this.positions.map(p => this.sell(p.symbol, p.quantity, currentPrice || p.currentPrice));
 return closed;
  }

  updatePrice(symbol, price) {
 this.positions.forEach(p => {
 if (p.symbol === symbol) {
 p.currentPrice = price;
 p.unrealizedPnl = (price - p.entryPrice) * p.quantity;
 }
 });
  }
}

class TradingBot {
  constructor() {
 this.paperEngine = new PaperTradingEngine();
 this.running = false;
  }

  start() {
 this.running = true;
 return { status: 'started' };
  }

  stop() {
 this.running = false;
 return { status: 'stopped' };
  }

  getStatus() {
 return { running: this.running };
  }
}

module.exports = TradingBot;
