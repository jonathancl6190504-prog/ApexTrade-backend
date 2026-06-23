// src/tradingBot.js
const IndicatorsEngine = require('./indicators');
const PaperTradingEngine = require('./paperTrading');
const DataFetcher = require('./dataFetcher');

class TradingBot {
  constructor({ polygonKey, finnhubKey, initialBalance = 100000, watchList = ['ES', 'NQ', 'CL'] }) {
 this.fetcher = new DataFetcher({ polygonKey, finnhubKey });
 this.paperEngine = new PaperTradingEngine(initialBalance);
 this.watchList = watchList;
 this.isRunning = false;
 this.interval = null;
 this.timeframes = ['5m', '15m', '30m', '1d'];
  }

  // ─── Automated Trading ────────────────────────────────────────────────────

  async startAutomatedTrading(wsServer) {
 if (this.isRunning) return;
 this.isRunning = true;
 console.log('🤖 Bot started - evaluating every 5 minutes');

 // Run immediately, then every 5 min
 await this.evaluateAndTrade(wsServer);

 this.interval = setInterval(async () => {
 await this.evaluateAndTrade(wsServer);
 }, 5 * 60 * 1000);
  }

  stopTrading() {
 if (this.interval) {
 clearInterval(this.interval);
 this.interval = null;
 }
 this.isRunning = false;
 console.log('🛑 Bot stopped');
  }

  // ─── Signal Evaluation ────────────────────────────────────────────────────

  async evaluateAndTrade(wsServer) {
 for (const symbol of this.watchList) {
 try {
 const signals = await this._getMultiTimeframeSignals(symbol);
 const sentiment = await this.fetcher.getSentiment(symbol);
 const quote = await this.fetcher.getQuote(symbol);

 const buyCount = signals.filter(s => s === 'BUY').length;
 const sellCount = signals.filter(s => s === 'SELL').length;
 const currentPrice = quote.price;

 const decision = this._makeDecision(symbol, buyCount, sellCount, sentiment.sentimentScore);

 // Broadcast signal update to all WebSocket clients
 if (wsServer) {
 wsServer.broadcast({
 type: 'SIGNAL_UPDATE',
 data: {
 symbol,
 decision,
 buySignals: buyCount,
 sellSignals: sellCount,
 sentiment: sentiment.sentimentScore,
 price: currentPrice,
 timestamp: new Date().toISOString(),
 },
 });
 }

 // Execute trade if conditions met
 if (decision === 'BUY') {
 const result = this.paperEngine.executeBuy(symbol, 1, currentPrice, 'AUTO');
 if (result.success && wsServer) {
 wsServer.broadcast({ type: 'TRADE_EXECUTED', data: { ...result, action: 'BUY', symbol } });
 wsServer.broadcast({ type: 'ACCOUNT_UPDATE', data: this.paperEngine.getAccountSummary() });
 }
 } else if (decision === 'SELL') {
 // Close any existing LONG for this symbol
 const summary = this.paperEngine.getAccountSummary();
 const longPosition = summary.openPositions?.find(
 p => p.symbol === symbol && p.direction === 'LONG'
 );
 if (longPosition) {
 const result = this.paperEngine.closePosition(longPosition.id, currentPrice);
 if (result.success && wsServer) {
 wsServer.broadcast({ type: 'POSITION_CLOSED', data: { ...result, symbol } });
 wsServer.broadcast({ type: 'ACCOUNT_UPDATE', data: this.paperEngine.getAccountSummary() });
 }
 }
 }

 // Rate limit between symbols
 await this._sleep(1200);

 } catch (err) {
 console.error(`[${symbol}] Evaluation error:`, err.message);
 }
 }
  }

  // ─── Multi-Timeframe Analysis ─────────────────────────────────────────────

  async _getMultiTimeframeSignals(symbol) {
 const signals = [];

 for (const tf of this.timeframes) {
 try {
 const { candles } = await this.fetcher.getCandles(symbol, tf, 50);
 if (!candles || candles.length < 20) {
 signals.push('HOLD');
 continue;
 }

 const prices = candles.map(c => c.close);

 const rsi = IndicatorsEngine.calculateRSI(prices, 14);
 const macd = IndicatorsEngine.calculateMACD(prices);
 const bb = IndicatorsEngine.calculateBollingerBands(prices);
 const ema = IndicatorsEngine.calculateEMA(prices, 9);

 const signal = IndicatorsEngine.generateSignal({ rsi, macd, bb, ema });
 signals.push(signal);

 await this._sleep(300); // respect rate limits
 } catch (err) {
 console.warn(`[${symbol}/${tf}] Skipping - ${err.message}`);
 signals.push('HOLD');
 }
 }

 return signals; // array of 'BUY' | 'SELL' | 'HOLD' for each timeframe
  }

  // ─── Decision Logic ───────────────────────────────────────────────────────

  _makeDecision(symbol, buyCount, sellCount, sentimentScore) {
 const summary = this.paperEngine.getAccountSummary();
 const hasLong = summary.openPositions?.some(
 p => p.symbol === symbol && p.direction === 'LONG'
 );

 // BUY: ≥2 timeframes say BUY + positive sentiment + no existing LONG
 if (buyCount >= 2 && sentimentScore > 0 && !hasLong) {
 return 'BUY';
 }

 // SELL: ≥2 timeframes say SELL + negative sentiment + existing LONG open
 if (sellCount >= 2 && sentimentScore < 0 && hasLong) {
 return 'SELL';
 }

 return 'HOLD';
  }

  // ─── Manual Trading ───────────────────────────────────────────────────────

  executeManualTrade(action, symbol, price, quantity = 1) {
 if (!symbol || !price) {
 return { success: false, error: 'symbol and price are required' };
 }

 if (action === 'BUY') {
 return this.paperEngine.executeBuy(symbol, quantity, price, 'MANUAL');
 } else if (action === 'SELL') {
 return this.paperEngine.executeSell(symbol, quantity, price, 'MANUAL');
 }

 return { success: false, error: `Unknown action: ${action}` };
  }

  closePosition(positionId, exitPrice) {
 if (!positionId || !exitPrice) {
 return { success: false, error: 'positionId and exitPrice are required' };
 }
 return this.paperEngine.closePosition(positionId, exitPrice);
  }

  closeAllPositions(currentPrices = {}) {
 const summary = this.paperEngine.getAccountSummary();
 const results = [];

 for (const pos of summary.openPositions || []) {
 const exitPrice = currentPrices[pos.symbol] || pos.currentPrice;
 results.push(this.paperEngine.closePosition(pos.id, exitPrice));
 }

 return { closed: results.length, results };
  }

  // ─── State Access ─────────────────────────────────────────────────────────

  getAccountSummary() {
 return this.paperEngine.getAccountSummary();
  }

  getTradingHistory(limit = 50) {
 const summary = this.paperEngine.getAccountSummary();
 const trades = summary.trades || [];
 return trades.slice(-limit).reverse(); // most recent first
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  _sleep(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TradingBot;
