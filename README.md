# ApexTrade Backend

Automated futures trading bot with paper trading simulation, real-time WebSocket updates, and multi-timeframe signal consolidation.

## Features

- **Automated Trading Bot** - Evaluates 4 timeframes (5m, 15m, 30m, 1d) every 5 minutes
- **Multi-Indicator Analysis** - RSI(14), MACD, Bollinger Bands, EMA(9/21/50)
- **Paper Trading Engine** - Full position tracking with 20x margin enforcement
- **Real-Time Updates** - WebSocket server broadcasts signals, trades, and account updates
- **Market Data Integration** - Polygon.io for candles, Finnhub for sentiment
- **REST API** - Complete endpoints for trading, account management, and history
- **Mobile-Ready** - Designed for React Native/Expo cross-platform mobile app

## Tech Stack

- **Runtime** - Node.js 18.x
- **Framework** - Express.js
- **Real-Time** - WebSocket (ws)
- **APIs** - Polygon.io (market data), Finnhub (sentiment)
- **Testing** - Jest

## Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Fill in your API keys
# POLYGON_API_KEY=your_key
# FINNHUB_API_KEY=your_key
