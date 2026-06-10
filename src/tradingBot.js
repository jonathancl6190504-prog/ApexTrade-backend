const DataFetcher = require('./dataFetcher');
const IndicatorsEngine = require('./indicators');
const PaperTradingEngine = require('./paperTrading');

class TradingBot {
  constructor(config) {
 this.polygonKey = config.polygonKey;
 this.finnhubKey = config.finnhubKey;
 this.initialBalance = config.initialBalance;
 this.watchList = config.watchList || ['ES', 'NQ', 'CL'];
 
 this.fetcher = new DataFetcher(config.polygonKey, config.finnhubKey);
 this.engine = new PaperTradingEngine(config.initialBalance);
 this.isRunning = false;
 this.evalInterval = null;
  }

  async startAutomatedTrading(wsServer) {
 if (this.isRunning) return;
 this.isRunning = true;
 
 console.log('🤖 Bot started - evaluating every 5 minutes');
 
 // Evaluate immediately
 await this.evaluateAndTrade(wsServer);
 
 // Then every 5 minutes
 this.evalInterval = setInterval(async () => {
 await this.evaluateAndTrade(wsServer);
 }, 5 * 60 * 1000);
  }

  stopTrading() {
 if (this.evalInterval) clearInterval(this.evalInterval);
 this.isRunning = false;
 console.log('🛑 Bot stopped');
  }

  async evaluateAndTrade(wsServer) {
 try {
 for (const symbol of this.watchList) {
 const signals = await this.evaluateSymbol(symbol);
 
 // Broadcast signal update
 wsServer.broadcast({
 type: 'SIGNAL_UPDATE',
 symbol,
 signal: signals.decision,
 indicators: signals.indicators,
 sentiment: signals.sentiment,
 });

 // Execute trade if signal is strong
 if (signals.decision === 'BUY' && !this.hasLongPosition(symbol)) {
 const quote = await this.fetcher.getQuote(symbol);
 const result = this.engine.executeBuy(symbol, 1, quote.price, '5m');
 
 if (result.success) {
 wsServer.broadcast({
 type: 'TRADE_EXECUTED',
 action: 'BUY',
 symbol,
 price: quote.price,
 position: result.position,
 });
 console.log(`✅ BUY ${symbol} @ ${quote.price}`);
 }
 } else if (signals.decision === 'SELL' && this.hasLongPosition(symbol)) {
 const quote = await this.fetcher.getQuote(symbol);
 const position = this.engine.positions.find(p => p.symbol === symbol && p.side === 'LONG');
 
 if (position) {
 const result = this.engine.closePosition(position.id, quote.price);
 
 if (result.success) {
 wsServer.broadcast({
 type: 'POSITION_CLOSED',
 symbol,
 pnl: result.closedTrade.pnl,
 pnlPercent: result.closedTrade.pnlPercent,
 });
 console.log(`📉 SELL ${symbol} @ ${quote.price} | PnL: ${result.closedTrade.pnl.toFixed(2)}`);
 }
 }
 }
 }
 
 // Update account summary broadcast
 wsServer.broadcast({
 type: 'ACCOUNT_UPDATE',
 ...this.getAccountSummary(),
 });
 } catch (error) {
 console.error('⚠️ Evaluation error:', error.message);
 }
  }

  async evaluateSymbol(symbol) {
 try {
 // Get data for all timeframes
 const tf5m = await this.fetcher.getCandles(symbol, '5m', 50);
 const tf15m = await this.fetcher.getCandles(symbol, '15m', 50);
 const tf30m = await this.fetcher.getCandles(symbol, '30m', 50);
 const tf1d = await this.fetcher.getCandles(symbol, '1d', 50);

 // Extract close prices
 const closes5m = tf5m.candles.map(c => c.close);
 const closes15m = tf15m.candles.map(c => c.close);
 const closes30m = tf30m.candles.map(c => c.close);
 const closes1d = tf1d.candles.map(c => c.close);

 // Calculate indicators for each timeframe
 const sig5m = IndicatorsEngine.generateSignal(
 IndicatorsEngine.calculateRSI(closes5m, 14),
 IndicatorsEngine.calculateMACD(closes5m),
 IndicatorsEngine.calculateBollingerBands(closes5m),
 IndicatorsEngine.calculateEMA(closes5m, 9),
 IndicatorsEngine.calculateEMA(closes5m, 21)
 );

 const sig15m = IndicatorsEngine.generateSignal(
 IndicatorsEngine.calculateRSI(closes15m, 14),
 IndicatorsEngine.calculateMACD(closes15m),
 IndicatorsEngine.calculateBollingerBands(closes15m),
 IndicatorsEngine.calculateEMA(closes15m, 9),
 IndicatorsEngine.calculateEMA(closes15m, 21)
 );

 const sig30m = IndicatorsEngine.generateSignal(
 IndicatorsEngine.calculateRSI(closes30m, 14),
 IndicatorsEngine.calculateMACD(closes30m),
 IndicatorsEngine.calculateBollingerBands(closes30m),
 IndicatorsEngine.calculateEMA(closes30m, 9),
 IndicatorsEngine.calculateEMA(closes30m, 21)
 );

 const sig1d = IndicatorsEngine.generateSignal(
 IndicatorsEngine.calculateRSI(closes1d, 14),
 IndicatorsEngine.calculateMACD(closes1d),
 IndicatorsEngine.calculateBollingerBands(closes1d),
 IndicatorsEngine.calculateEMA(closes1d, 9),
 IndicatorsEngine.calculateEMA(closes1d, 21)
 );

 // Get sentiment
 const sentiment = await this.fetcher.getSentiment(symbol);

 // Consolidate signals (need 2+ timeframes showing same direction)
 const buyCount = [sig5m, sig15m, sig30m, sig1d].filter(s => s === 'BUY').length;
 const sellCount = [sig5m, sig15m, sig30m, sig1d].filter(s => s === 'SELL').length;

 let decision = 'HOLD';
 if (buyCount >= 2 && sentiment.sentimentScore > 0) {
 decision = 'BUY';
 } else if (sellCount >= 2 && sentiment.sentimentScore < 0) {
 decision = 'SELL';
 }

 return {
 decision,
 sentiment: sentiment.sentimentScore,
 indicators: {
 rsi: IndicatorsEngine.calculateRSI(closes5m, 14),
 macd: IndicatorsEngine.calculateMACD(closes5m),
 ema9: IndicatorsEngine.calculateEMA(closes5m, 9),
 ema21: IndicatorsEngine.calculateEMA(closes5m, 21),
 },
 };
 } catch (error) {
 console.error(`Error evaluating ${symbol}:`, error.message);
 return { decision: 'HOLD', sentiment: 0, indicators: {} };
 }
  }

  hasLongPosition(symbol) {
 return this.engine.positions.some(p => p.symbol === symbol && p.side === 'LONG');
  }

  executeManualTrade(action, symbol, price, quantity) {
 try {
 if (action === 'BUY') {
 return this.engine.executeBuy(symbol, quantity, price, 'MANUAL');
 } else if (action === 'SELL') {
 // Find and close matching position
 const position = this.engine.positions.find(p => p.symbol === symbol && p.side === 'LONG');
 if (!position) return { success: false, error: 'No LONG position to sell' };
 return this.engine.closePosition(position.id, price);
 }
 } catch (error) {
 return { success: false, error: error.message };
 }
  }

  closePosition(positionId, exitPrice) {
 try {
 return this.engine.closePosition(positionId, exitPrice);
 } catch (error) {
 return { success: false, error: error.message };
 }
  }

  getAccountSummary() {
 return this.engine.getAccountSummary();
  }

  getTradingHistory(limit = 50) {
 return this.engine.closedPositions.slice(-limit);
  }
}

module.exports = TradingBot;
