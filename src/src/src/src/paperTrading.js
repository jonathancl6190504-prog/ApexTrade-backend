class PaperTradingEngine {
  constructor(initialBalance = 100000) {
 this.balance = initialBalance;
 this.initialBalance = initialBalance;
 this.positions = []; // Open positions
 this.trades = []; // Trade history
 this.maxLeverage = 20; // 20x leverage enforcement
  }

  /**
 * Get account summary
 * @returns {object} Account info
 */
  getAccountSummary() {
 const equity = this.calculateEquity();
 const usedMargin = this.calculateUsedMargin();
 const availableMargin = equity - usedMargin;
 const marginRatio = equity > 0 ? (usedMargin / equity) * 100 : 0;

 return {
 balance: parseFloat(this.balance.toFixed(2)),
 equity: parseFloat(equity.toFixed(2)),
 usedMargin: parseFloat(usedMargin.toFixed(2)),
 availableMargin: parseFloat(availableMargin.toFixed(2)),
 marginRatio: parseFloat(marginRatio.toFixed(2)),
 maxLeverage: this.maxLeverage,
 positionCount: this.positions.length,
 totalTrades: this.trades.length,
 };
  }

  /**
 * Calculate current equity (balance + unrealized P&L)
 * @returns {number} Current equity
 */
  calculateEquity() {
 let unrealizedPnL = 0;
 this.positions.forEach((pos) => {
 unrealizedPnL += pos.unrealizedPnL;
 });
 return this.balance + unrealizedPnL;
  }

  /**
 * Calculate total margin in use
 * @returns {number} Used margin
 */
  calculateUsedMargin() {
 let usedMargin = 0;
 this.positions.forEach((pos) => {
 usedMargin += Math.abs(pos.notional);
 });
 return usedMargin / this.maxLeverage;
  }

  /**
 * Check if trade is allowed based on margin
 * @param {number} notional - Notional value of trade
 * @returns {boolean} True if trade is allowed
 */
  isTradeAllowed(notional) {
 const equity = this.calculateEquity();
 const usedMargin = this.calculateUsedMargin();
 const requiredMargin = Math.abs(notional) / this.maxLeverage;
 const availableMargin = equity - usedMargin;

 return requiredMargin <= availableMargin && equity > 0;
  }

  /**
 * Open a new position (BUY or SELL)
 * @param {string} symbol - Trading symbol
 * @param {string} action - 'BUY' or 'SELL'
 * @param {number} price - Entry price
 * @param {number} quantity - Number of contracts
 * @returns {object|null} Position object or null if rejected
 */
  openPosition(symbol, action, price, quantity) {
 const notional = price * quantity;

 // Check margin availability
 if (!this.isTradeAllowed(notional)) {
 return null;
 }

 // Check for duplicate position (only one LONG or SHORT per symbol)
 const existingPosition = this.positions.find(
 (p) => p.symbol === symbol && p.action === action
 );
 if (existingPosition) {
 return null;
 }

 const position = {
 id: `POS-${Date.now()}`,
 symbol,
 action, // 'BUY' or 'SELL'
 entryPrice: price,
 quantity,
 notional,
 entryTime: new Date().toISOString(),
 currentPrice: price,
 unrealizedPnL: 0,
 unrealizedReturn: 0,
 };

 this.positions.push(position);
 return position;
  }

  /**
 * Close a position
 * @param {string} positionId - Position ID
 * @param {number} exitPrice - Exit price
 * @returns {object|null} Closed trade or null if not found
 */
  closePosition(positionId, exitPrice) {
 const posIndex = this.positions.findIndex((p) => p.id === positionId);
 if (posIndex === -1) return null;

 const pos = this.positions[posIndex];
 let pnl = 0;

 if (pos.action === 'BUY') {
 pnl = (exitPrice - pos.entryPrice) * pos.quantity;
 } else {
 pnl = (pos.entryPrice - exitPrice) * pos.quantity;
 }

 const trade = {
 id: `TRADE-${Date.now()}`,
 symbol: pos.symbol,
 action: pos.action,
 entryPrice: pos.entryPrice,
 exitPrice,
 quantity: pos.quantity,
 entryTime: pos.entryTime,
 exitTime: new Date().toISOString(),
 pnl: parseFloat(pnl.toFixed(2)),
 returnPercent: parseFloat(
 ((pnl / pos.notional) * 100).toFixed(2)
 ),
 };

 // Update balance
 this.balance += pnl;

 // Record trade
 this.trades.push(trade);

 // Remove position
 this.positions.splice(posIndex, 1);

 return trade;
  }

  /**
 * Update position with new market price
 * @param {string} symbol - Trading symbol
 * @param {number} currentPrice - Current market price
 */
  updatePositionPrice(symbol, currentPrice) {
 this.positions.forEach((pos) => {
 if (pos.symbol === symbol) {
 pos.currentPrice = currentPrice;

 if (pos.action === 'BUY') {
 pos.unrealizedPnL = (currentPrice - pos.entryPrice) * pos.quantity;
 } else {
 pos.unrealizedPnL = (pos.entryPrice - currentPrice) * pos.quantity;
 }

 pos.unrealizedReturn = parseFloat(
 ((pos.unrealizedPnL / pos.notional) * 100).toFixed(2)
 );
 }
 });
  }

  /**
 * Get all open positions
 * @returns {object[]} Array of positions
 */
  getPositions() {
 return this.positions.map((p) => ({
 ...p,
 unrealizedPnL: parseFloat(p.unrealizedPnL.toFixed(2)),
 }));
  }

  /**
 * Get trade history
 * @param {number} limit - Limit results (default 50)
 * @returns {object[]} Recent trades
 */
  getTradeHistory(limit = 50) {
 return this.trades.slice(-limit).reverse();
  }

  /**
 * Get trade statistics
 * @returns {object} Stats on trades
 */
  getTradeStats() {
 if (this.trades.length === 0) {
 return {
 totalTrades: 0,
 winningTrades: 0,
 losingTrades: 0,
 winRate: 0,
 avgWin: 0,
 avgLoss: 0,
 totalPnL: 0,
 profitFactor: 0,
 };
 }

 const wins = this.trades.filter((t) => t.pnl > 0);
 const losses = this.trades.filter((t) => t.pnl < 0);
 const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
 const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
 const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

 return {
 totalTrades: this.trades.length,
 winningTrades: wins.length,
 losingTrades: losses.length,
 winRate: parseFloat(((wins.length / this.trades.length) * 100).toFixed(2)),
 avgWin: wins.length > 0 ? parseFloat((totalWins / wins.length).toFixed(2)) : 0,
 avgLoss: losses.length > 0 ? parseFloat((totalLosses / losses.length).toFixed(2)) : 0,
 totalPnL: parseFloat(totalPnL.toFixed(2)),
 profitFactor:
 totalLosses > 0 ? parseFloat((totalWins / totalLosses).toFixed(2)) : 0,
 };
  }

  /**
 * Liquidate all positions at current price
 * @param {object} prices - Symbol -> current price map
 * @returns {object[]} Closed trades
 */
  liquidateAll(prices) {
 const closedTrades = [];
 const positionsCopy = [...this.positions];

 positionsCopy.forEach((pos) => {
 const exitPrice = prices[pos.symbol] || pos.currentPrice;
 const trade = this.closePosition(pos.id, exitPrice);
 if (trade) {
 closedTrades.push(trade);
 }
 });

 return closedTrades;
  }

  /**
 * Reset account to initial balance
 */
  reset() {
 this.balance = this.initialBalance;
 this.positions = [];
 this.trades = [];
  }
}

module.exports = PaperTradingEngine;
