const WebSocket = require("ws");
const EventEmitter = require("events");

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream?streams=";

class BinanceWebSocket extends EventEmitter {
  constructor(symbols = ["btcusdt", "ethusdt", "bnbusdt", "solusdt"]) {
    super();
    this.symbols = symbols.map((s) => s.toLowerCase());
    this.prices = {};
    this.ws = null;
    this.reconnectDelay = 2000;
    this._connect();
  }

  _buildUrl() {
    const streams = this.symbols.map((s) => `${s}@ticker`).join("/");
    return `${BINANCE_WS_BASE}${streams}`;
  }

  _connect() {
    const url = this._buildUrl();
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log("[Binance WS] Connected to live price stream");
      this.reconnectDelay = 2000;
    });

    this.ws.on("message", (raw) => {
      try {
        const { data } = JSON.parse(raw);
        const symbol = data.s;          // e.g. "BTCUSDT"
        const price = parseFloat(data.c); // last price
        const change = parseFloat(data.P); // 24h % change
        const volume = parseFloat(data.v); // 24h base volume

        this.prices[symbol] = { symbol, price, change24h: change, volume24h: volume, ts: Date.now() };
        this.emit("tick", this.prices[symbol]);
      } catch {
        // malformed frame — ignore
      }
    });

    this.ws.on("close", () => {
      console.warn(`[Binance WS] Disconnected. Reconnecting in ${this.reconnectDelay}ms…`);
      setTimeout(() => this._connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    });

    this.ws.on("error", (err) => {
      console.error("[Binance WS] Error:", err.message);
      this.ws.close();
    });
  }

  getAll() {
    return Object.values(this.prices);
  }

  get(symbol) {
    return this.prices[symbol.toUpperCase()] ?? null;
  }

  addSymbol(symbol) {
    const s = symbol.toLowerCase();
    if (!this.symbols.includes(s)) {
      this.symbols.push(s);
      // reconnect with updated stream list
      this.ws.close();
    }
  }
}

module.exports = BinanceWebSocket;
