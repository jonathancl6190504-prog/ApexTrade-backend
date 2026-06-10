class IndicatorsEngine {
  /**
 * Calculate RSI (Relative Strength Index)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - RSI period (default 14)
 * @returns {number} RSI value (0-100)
 */
  static calculateRSI(prices, period = 14) {
 if (prices.length < period + 1) return null;

 let gains = 0;
 let losses = 0;

 // Calculate initial average gain and loss
 for (let i = prices.length - period; i < prices.length; i++) {
 const change = prices[i] - prices[i - 1];
 if (change > 0) {
 gains += change;
 } else {
 losses += Math.abs(change);
 }
 }

 let avgGain = gains / period;
 let avgLoss = losses / period;

 // Calculate RS and RSI
 const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
 const rsi = 100 - (100 / (1 + rs));

 return parseFloat(rsi.toFixed(2));
  }

  /**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {number[]} prices - Array of closing prices
 * @returns {object} {macd, signal, histogram}
 */
  static calculateMACD(prices) {
 if (prices.length < 26) return null;

 const ema12 = this.calculateEMA(prices, 12);
 const ema26 = this.calculateEMA(prices, 26);

 if (ema12 === null || ema26 === null) return null;

 const macdLine = ema12 - ema26;

 // Calculate signal line (9-period EMA of MACD)
 // For simplicity, we'll use a basic approximation
 const signalLine = (macdLine * 2) / 11; // Smoothed estimate
 const histogram = macdLine - signalLine;

 return {
 macd: parseFloat(macdLine.toFixed(4)),
 signal: parseFloat(signalLine.toFixed(4)),
 histogram: parseFloat(histogram.toFixed(4)),
 };
  }

  /**
 * Calculate Bollinger Bands
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - Period (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {object} {upper, middle, lower}
 */
  static calculateBollingerBands(prices, period = 20, stdDev = 2) {
 if (prices.length < period) return null;

 const recentPrices = prices.slice(-period);
 const sma = recentPrices.reduce((a, b) => a + b, 0) / period;

 // Calculate standard deviation
 const variance =
 recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) /
 period;
 const std = Math.sqrt(variance);

 return {
 upper: parseFloat((sma + stdDev * std).toFixed(2)),
 middle: parseFloat(sma.toFixed(2)),
 lower: parseFloat((sma - stdDev * std).toFixed(2)),
 };
  }

  /**
 * Calculate EMA (Exponential Moving Average)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - EMA period
 * @returns {number} EMA value
 */
  static calculateEMA(prices, period) {
 if (prices.length < period) return null;

 const k = 2 / (period + 1);
 let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

 for (let i = period; i < prices.length; i++) {
 ema = prices[i] * k + ema * (1 - k);
 }

 return parseFloat(ema.toFixed(2));
  }

  /**
 * Generate trading signal based on indicators
 * @param {object[]} candles - Array of candle data {close, high, low, open}
 * @returns {string} 'BUY', 'SELL', or 'HOLD'
 */
  static generateSignal(candles) {
 if (candles.length < 26) return 'HOLD';

 const closes = candles.map((c) => c.close);
 const highs = candles.map((c) => c.high);
 const lows = candles.map((c) => c.low);

 // Calculate indicators
 const rsi = this.calculateRSI(closes, 14);
 const macd = this.calculateMACD(closes);
 const bb = this.calculateBollingerBands(closes, 20, 2);
 const ema9 = this.calculateEMA(closes, 9);
 const ema21 = this.calculateEMA(closes, 21);
 const ema50 = this.calculateEMA(closes, 50);

 if (!rsi || !macd || !bb || !ema9 || !ema21 || !ema50) {
 return 'HOLD';
 }

 const currentPrice = closes[closes.length - 1];
 let buySignals = 0;
 let sellSignals = 0;

 // RSI signals
 if (rsi < 30) buySignals++;
 if (rsi > 70) sellSignals++;

 // MACD signals
 if (macd.histogram > 0 && macd.macd > macd.signal) buySignals++;
 if (macd.histogram < 0 && macd.macd < macd.signal) sellSignals++;

 // Bollinger Bands signals
 if (currentPrice < bb.lower) buySignals++;
 if (currentPrice > bb.upper) sellSignals++;

 // EMA trend signals
 if (ema9 > ema21 && ema21 > ema50) buySignals++;
 if (ema9 < ema21 && ema21 < ema50) sellSignals++;

 // Determine signal
 if (buySignals > sellSignals && buySignals >= 2) return 'BUY';
 if (sellSignals > buySignals && sellSignals >= 2) return 'SELL';
 return 'HOLD';
  }

  /**
 * Get indicator values for analysis/debugging
 * @param {object[]} candles - Array of candle data
 * @returns {object} All indicator values
 */
  static getIndicatorValues(candles) {
 if (candles.length < 26) return null;

 const closes = candles.map((c) => c.close);

 return {
 rsi: this.calculateRSI(closes, 14),
 macd: this.calculateMACD(closes),
 bollingerBands: this.calculateBollingerBands(closes, 20, 2),
 ema9: this.calculateEMA(closes, 9),
 ema21: this.calculateEMA(closes, 21),
 ema50: this.calculateEMA(closes, 50),
 signal: this.generateSignal(candles),
 };
  }
}

module.exports = IndicatorsEngine;
