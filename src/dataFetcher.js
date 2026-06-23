const axios = require('axios');

class DataFetcher {
  constructor({ polygonKey, finnhubKey }) {
 this.polygonKey = polygonKey;
 this.finnhubKey = finnhubKey;

 // Futures symbol map: internal → Polygon ticker
 this.symbolMap = {
 ES: 'ES', // S&P 500 futures
 NQ: 'NQ', // Nasdaq futures
 CL: 'CL', // Crude Oil futures
 GC: 'GC', // Gold futures
 ZB: 'ZB', // 30-Year Treasury Bond futures
 };

 // Polygon timeframe map
 this.tfMap = {
 '5m':  { multiplier: 5,  timespan: 'minute' },
 '15m': { multiplier: 15, timespan: 'minute' },
 '30m': { multiplier: 30, timespan: 'minute' },
 '1d':  { multiplier: 1,  timespan: 'day' },
 };
  }

  async getCandles(symbol, timeframe = '5m', limit = 50) {
 const ticker = this.symbolMap[symbol] || symbol;
 const tf = this.tfMap[timeframe] || this.tfMap['5m'];

 const to = new Date();
 const from = new Date();
 from.setDate(from.getDate() - (timeframe === '1d' ? 60 : 3));

 const fromStr = from.toISOString().split('T')[0];
 const toStr = to.toISOString().split('T')[0];

 try {
 const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${tf.multiplier}/${tf.timespan}/${fromStr}/${toStr}`;
 const res = await axios.get(url, {
 params: { adjusted: true, sort: 'asc', limit, apiKey: this.polygonKey },
 timeout: 8000,
 });

 if (!res.data.results || res.data.results.length === 0) {
 throw new Error(`No candles returned for ${symbol}/${timeframe}`);
 }

 const candles = res.data.results.map(r => ({
 timestamp: r.t,
 open: r.o,
 high: r.h,
 low: r.l,
 close: r.c,
 volume: r.v,
 }));

 return { candles };
 } catch (err) {
 console.error(`[DataFetcher] getCandles error (${symbol}/${timeframe}):`, err.message);
 throw err;
 }
  }

  async getQuote(symbol) {
 const ticker = this.symbolMap[symbol] || symbol;

 try {
 const url = `https://api.polygon.io/v2/last/trade/${ticker}`;
 const res = await axios.get(url, {
 params: { apiKey: this.polygonKey },
 timeout: 5000,
 });

 const price = res.data.results?.p || res.data.last?.price;
 if (!price) throw new Error('No price in response');

 return { price, bid: price * 0.9999, ask: price * 1.0001 };
 } catch (err) {
 // Fallback: use Finnhub quote
 try {
 const res = await axios.get('https://finnhub.io/api/v1/quote', {
 params: { symbol: ticker, token: this.finnhubKey },
 timeout: 5000,
 });
 const price = res.data.c;
 return { price, bid: res.data.l, ask: res.data.h };
 } catch (fb) {
 console.error(`[DataFetcher] getQuote fallback failed (${symbol}):`, fb.message);
 throw fb;
 }
 }
  }

  async getSentiment(symbol) {
 const ticker = this.symbolMap[symbol] || symbol;

 try {
 const res = await axios.get('https://finnhub.io/api/v1/news-sentiment', {
 params: { symbol: ticker, token: this.finnhubKey },
 timeout: 5000,
 });

 const score = res.data.sentiment?.bullishPercent - res.data.sentiment?.bearishPercent || 0;
 const bullishArticles = res.data.buzz?.articlesInLastWeek || 0;

 return {
 sentimentScore: score,
 bullishArticles,
 bearishArticles: 0,
 news: res.data.news || [],
 };
 } catch (err) {
 console.warn(`[DataFetcher] getSentiment failed (${symbol}), defaulting to 0`);
 // Neutral fallback so bot doesn't crash
 return { sentimentScore: 0, bullishArticles: 0, bearishArticles: 0, news: [] };
 }
  }
}

module.exports = DataFetcher;
