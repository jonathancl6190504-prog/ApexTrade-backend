const { v4: uuidv4 } = require('uuid');

class PaperTradingEngine {
  constructor(initialBalance = 100000) {
 this.balance = initialBalance;
 this.initialBalance = initialBalance;
 this.openPositions = [];
 this.closedTrades = [];
  }

  executeBuy(symbol, quantity = 1, price, timeframe = 'MANUAL') {
 const cost = price * quantity;
 if (cost > this.balance) {
 return { success: false, error: 'Insufficient balance' };
 }

 const position = {
 id: uuidv4(),
 symbol,
 quantity,
 entryPrice: price,
 currentPrice: price,
 direction: 'LONG',
 timeframe,
 openedAt: new Date().toISOString(),
 unrealizedPnL: 0,
 };

 this.balance -= cost;
 this.openPositions.push(position);

 return {
 success: true,
 tradeId: position.id,
 position,
 balanceAfter: this.balance,
 };
  }

  executeSell(symbol, quantity = 1, price, timeframe = 'MANUAL') {
 // Short position
 const position = {
 id: uuidv4(),
 symbol,
 quantity,
 entryPrice: price,
 currentPrice: price,
 direction: 'SHORT',
 timeframe,
 openedAt: new Date().toISOString(),
 unrealizedPnL: 0,
 };

 this.openPositions.push(position);

 return {
 success: true,
 tradeId: position.id,
 position,
 balanceAfter: this.balance,
 };
  }

  closePosition(positionId, exitPrice) {
 const idx = this.openPositions.findIndex(p => p.id === positionId);
 if (idx === -1) {
 return { success: false, error: 'Position not found' };
 }

 const position = this.openPositions[idx];
 const priceDiff = position.direction === 'LONG'
 ? exitPrice - position.entryPrice
 : position.entryPrice - exitPrice;

 const pnl = priceDiff * position.quantity;
 const pnlPercent = (priceDiff / position.entryPrice) * 100;

 // Return capital + pnl
 this.balance += (position.entryPrice * position.quantity) + pnl;

 const closedTrade = {
 ...position,
 exitPrice,
 closedAt: new Date().toISOString(),
 pnl,
 pnlPercent,
 };

 this.closedTrades.push(closedTrade);
 this.openPositions.splice(idx, 1);

 return { success: true, closedTrade };
  }

  updatePrices(priceMap = {}) {
 // priceMap: { ES: 5410, NQ: 18000 }
 this.openPositions = this.openPositions.map(pos => {
 const current = priceMap[pos.symbol];
 if (!current) return pos;

 const priceDiff = pos.direction === 'LONG'
 ? current - pos.entryPrice
 : pos.entryPrice - current;

 return {
 ...pos,
 currentPrice: current,
 unrealizedPnL: priceDiff * pos.quantity,
 };
 });
  }

  getAccountSummary() {
 const totalUnrealized = this.openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
 const totalRealizedPnL = this.closedTrades.reduce((sum, t) => sum + t.pnl, 0);
 const wins = this.closedTrades.filter(t => t.pnl > 0).length;
 const winRate = this.closedTrades.length > 0
 ? ((wins / this.closedTrades.length) * 100).toFixed(1)
 : 0;

 return {
 balance: parseFloat(this.balance.toFixed(2)),
 initialBalance: this.initialBalance,
 openPositions: this.openPositions,
 totalUnrealizedPnL: parseFloat(totalUnrealized.toFixed(2)),
 totalRealizedPnL: parseFloat(totalRealizedPnL.toFixed(2)),
 totalPnL: parseFloat((totalUnrealized + totalRealizedPnL).toFixed(2)),
 trades: this.closedTrades,
 winRate: parseFloat(winRate),
 totalTrades: this.closedTrades.length,
 };
  }
}

module.exports = PaperTradingEngine;
