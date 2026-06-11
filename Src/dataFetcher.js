const axios = require('axios');

class DataFetcher {
  constructor(polygonKey, finnhubKey) {
 this.polygonKey = polygonKey;
 this.finnhubKey = finnhubKey;
 this.polygonBaseUrl = 'https://api.polygon.io/v2';
 this.finnhubBaseUrl = 'https://finnhub.io/api/v1';
  }

  /**
 * Fetch historical candle data from Polygon.io
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - Timeframe (minute, hour, day)
 * @param {number} limit - Number of candles
 * @returns {object[]} Array of candles {open, high, low, close, volume, timestamp}
 */
  async getCandles(symbol, timeframe, limit = 100) {
 try {
 const params = {
 apiKey: this.polygonKey,
 limit: Math.min(limit, 50000),
 };

 // Map timeframe to Polygon format
 let endpoint = '';
 if (timeframe === '5m') {
 endpoint = `/aggs/ticker/${symbol}/range/5/minute`;
 params.timespan = 'minute';
 } else if (timeframe === '15m') {
 endpoint = `/aggs/ticker/${symbol}/range/15/minute`;
 params.timespan = 'minute';
 } else if (timeframe === '30m') {
 endpoint = `/aggs/ticker/${symbol}/range/30/minute`;
 params.timespan = 'minute';
 } else if (timeframe === '1d') {
 endpoint = `/aggs/ticker/${symbol}/range/1/day`;
 params.timespan = 'day';
 }

 // Calculate date range (last N trading days)
 const endDate = new Date();
 const startDate = new Date(endDate);
 startDate.setDate(startDate.getDate() - Math.ceil(limit / 8)); // Rough estimate

 params.from = startDate.toISOString().split('T')[0];
 params.to = endDate.toISOString().split('T')[0];
 params.sort = 'asc';

 const response = await axios.get(
 `${this.polygonBaseUrl}${endpoint}`,
 { params }
 );

 if (!response.data.results) {
 return [];
 }

 // Transform Polygon response to standard format
 return response.data.results.slice(-limit).map((candle) => ({
 timestamp: candle.t,
 open: candle.o,
 high: candle.h,
 low: candle.l,
 close: candle.c,
 volume: candle.v,
 }));
 } catch (error) {
 console.error(`Error fetching candles for ${symbol}:`, error.message);
 return [];
 }
  }

  /**
 * Fetch current price for a symbol
 * @param {string} symbol - Trading symbol
 * @returns {number|null} Current price or null if error
 */
  async getCurrentPrice(symbol) {
 try {
 const params = { apiKey: this.polygonKey };

 const response = await axios.get(
 `${this.polygonBaseUrl}/aggs/ticker/${symbol}/prev`,
 { params }
 );

 if (response.data.results && response.data.results.length > 0) {
 return response.data.results[0].c; // Close price
 }
 return null;
 } catch (error) {
 console.error(`Error fetching current price for ${symbol}:`, error.message);
 return null;
 }
  }

  /**
 * Fetch market sentiment from Finnhub
 * @param {string} symbol - Trading symbol
 * @returns {number} Sentiment score (-1 to 1)
 */
  async getMarketSentiment(symbol) {
 try {
 const params = {
 symbol,
 token: this.finnhubKey,
 };

 const response = await axios.get(
 `${this.finnhubBaseUrl}/sentiment/bullbear`,
 { params }
 );

 if (response.data) {
 // Calculate sentiment: positive count - negative count
 const bullish = response.data.bull || 0;
 const bearish = response.data.bear || 0;
 const total = bullish + bearish || 1;

 // Normalize to -1 to 1 range
 const sentiment = (bullish - bearish) / total;
 return parseFloat(sentiment.toFixed(2));
 }

 return 0; // Neutral sentiment if no data
 } catch (error) {
 console.error(
 `Error fetching sentiment for ${symbol}:`,
 error.message
 );
 return 0; // Return neutral sentiment on error
 }
  }

  /**
 * Fetch multiple timeframes for a symbol
 * @param {string} symbol - Trading symbol
 * @returns {object} Candles by timeframe
 */
  async getMultiTimeframeData(symbol) {
 try {
 const [candles5m, candles15m, candles30m, candles1d] = await Promise.all([
 this.getCandles(symbol, '5m', 30),
 this.getCandles(symbol, '15m', 30),
 this.getCandles(symbol, '30m', 30),
 this.getCandles(symbol, '1d', 30),
 ]);

 return {
 '5m': candles5m,
 '15m': candles15m,
 '30m': candles30m,
 '1d': candles1d,
 };
 } catch (error) {
 console.error(`Error fetching multi-timeframe data for ${symbol}:`, error.message);
 return {};
 }
  }

  /**
 * Get market data and sentiment for a symbol
 * @param {string} symbol - Trading symbol
 * @returns {object} Complete market data
 */
  async getMarketData(symbol) {
 try {
 const [timeframeData, sentiment, currentPrice] = await Promise.all([
 this.getMultiTimeframeData(symbol),
 this.getMarketSentiment(symbol),
 this.getCurrentPrice(symbol),
 ]);

 return {
 symbol,
 currentPrice,
 sentiment,
 timeframes: timeframeData,
 timestamp: new Date().toISOString(),
 };
 } catch (error) {
 console.error(`Error getting market data for ${symbol}:`, error.message);
 return null;
 }
  }

  /**
 * Batch fetch market data for multiple symbols
 * @param {string[]} symbols - Array of trading symbols
 * @returns {object[]} Array of market data
 */
  async getMarketDataBatch(symbols) {
 try {
 const results = await Promise.all(
 symbols.map((symbol) => this.getMarketData(symbol))
 );
 return results.filter((r) => r !== null);
 } catch (error) {
 console.error('Error in batch market data fetch:', error.message);
 return [];
 }
  }

  /**
 * Validate API connections
 * @returns {object} Connection status
 */
  async validateConnections() {
 try {
 const polygonTest = await axios.get(
 `${this.polygonBaseUrl}/aggs/ticker/ES/prev`,
 { params: { apiKey: this.polygonKey } }
 );
 const polygonOk = polygonTest.status === 200;

 const finnhubTest = await axios.get(
 `${this.finnhubBaseUrl}/sentiment/bullbear`,
 { params: { symbol: 'AAPL', token: this.finnhubKey } }
 );
 const finnhubOk = finnhubTest.status === 200;

 return {
 polygon: polygonOk,
 finnhub: finnhubOk,
 timestamp: new Date().toISOString(),
 };
 } catch (error) {
 console.error('Error validating API connections:', error.message);
 return {
 polygon: false,
 finnhub: false,
 error: error.message,
 };
 }
  }
}

module.exports = DataFetcher;
