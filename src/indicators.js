class IndicatorsEngine {
  static calculateRSI(prices, period = 14) {
 if (prices.length < period + 1) return 50;

 let gains = 0, losses = 0;
 for (let i = 1; i <= period; i++) {
 const diff = prices[i] - prices[i - 1];
 if (diff >= 0) gains += diff;
 else losses += Math.abs(diff);
 }

 let avgGain = gains / period;
 let avgLoss = losses / period;

 for (let i = period + 1; i < prices.length; i++) {
 const diff = prices[i] - prices[i - 1];
 const gain = diff >= 0 ? diff : 0;
 const loss = diff < 0 ? Math.abs(diff) : 0;
 avgGain = (avgGain * (period - 1) + gain) / period;
 avgLoss = (avgLoss * (period - 1) + loss) / period;
 }

 if (avgLoss === 0) return 100;
 const rs = avgGain / avgLoss;
 return 100 - (100 / (1 + rs));
  }

  static calculateEMA(prices, period) {
 if (prices.length < period) return prices[prices.length - 1];
 const k = 2 / (period + 1);
 let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
 for (let i = period; i < prices.length; i++) {
 ema = prices[i] * k + ema * (1 - k);
 }
 return ema;
  }

  static calculateMACD(prices) {
 const ema12 = this.calculateEMA(prices, 12);
 const ema26 = this.calculateEMA(prices, 26);
 const macd = ema12 - ema26;

 // Signal line: 9-period EMA of MACD (simplified - use last value)
 const signal = macd * 0.9; // approximation without full history
 const histogram = macd - signal;

 return { macd, signal, histogram };
  }

  static calculateBollingerBands(prices, period = 20) {
 const slice = prices.slice(-period);
 const middle = slice.reduce((a, b) => a + b, 0) / slice.length;
 const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / slice.length;
 const stdDev = Math.sqrt(variance);

 return {
 upper: middle + 2 * stdDev,
 middle,
 lower: middle - 2 * stdDev,
 };
  }

  static generateSignal({ rsi, macd, bb, ema }) {
 let score = 0;

 // RSI
 if (rsi < 30) score += 2; // oversold - bullish
 else if (rsi > 70) score -= 2;  // overbought - bearish
 else if (rsi < 45) score += 1;
 else if (rsi > 55) score -= 1;

 // MACD
 if (macd.histogram > 0) score += 1;
 else score -= 1;
 if (macd.macd > macd.signal) score += 1;
 else score -= 1;

 // Bollinger Bands (price vs bands - use last bb.middle as proxy)
 if (bb) {
 if (bb.middle < bb.lower * 1.01) score += 1;  // near lower band
 else if (bb.middle > bb.upper * 0.99) score -= 1; // near upper band
 }

 if (score >= 3) return 'BUY';
 if (score <= -3) return 'SELL';
 return 'HOLD';
  }
}

module.exports = IndicatorsEngine;
