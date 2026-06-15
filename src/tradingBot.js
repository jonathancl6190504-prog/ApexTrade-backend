class TradingBot {
  constructor(config) {
 this.config = config;
 this.isRunning = false;
  }
  
  async startAutomatedTrading(wsServer) {
 this.isRunning = true;
  }
  
  stopTrading() {
 this.isRunning = false;
  }
}

module.exports = TradingBot;
