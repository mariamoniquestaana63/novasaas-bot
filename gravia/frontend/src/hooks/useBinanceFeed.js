import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "wss://stream.binance.com:9443/stream?streams=";
const DEFAULT_SYMBOLS = ["btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt", "adausdt"];

// Simulated fallback — realistic random-walk prices
const SEED = {
  BTCUSDT: 67400, ETHUSDT: 3820, BNBUSDT: 615,
  SOLUSDT: 178,   XRPUSDT: 0.62, ADAUSDT: 0.48,
};

function randomWalk(prev, volatility = 0.0008) {
  const delta = prev * volatility * (Math.random() * 2 - 1);
  return Math.max(prev + delta, prev * 0.9);
}

export function useBinanceFeed(symbols = DEFAULT_SYMBOLS) {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const retryDelay = useRef(2000);
  const simRef = useRef(null);
  const simPrices = useRef({ ...SEED });

  const startSimulation = useCallback(() => {
    setSimulated(true);
    setConnected(false);
    simRef.current = setInterval(() => {
      simPrices.current = Object.fromEntries(
        Object.entries(simPrices.current).map(([sym, price]) => [sym, randomWalk(price)])
      );
      const now = Date.now();
      setPrices(
        Object.fromEntries(
          Object.entries(simPrices.current).map(([symbol, price]) => [
            symbol,
            {
              symbol,
              price,
              change24h: (Math.random() * 10 - 5),
              volume24h: Math.random() * 1e9,
              ts: now,
            },
          ])
        )
      );
    }, 1000);
  }, []);

  const stopSimulation = useCallback(() => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    setSimulated(false);
  }, []);

  const connect = useCallback(() => {
    const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
    const ws = new WebSocket(`${WS_URL}${streams}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setSimulated(false);
      stopSimulation();
      retryDelay.current = 2000;
    };

    ws.onmessage = (e) => {
      try {
        const { data } = JSON.parse(e.data);
        setPrices((prev) => ({
          ...prev,
          [data.s]: {
            symbol:    data.s,
            price:     parseFloat(data.c),
            change24h: parseFloat(data.P),
            volume24h: parseFloat(data.v),
            ts:        Date.now(),
          },
        }));
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      startSimulation();
      retryRef.current = setTimeout(() => {
        stopSimulation();
        connect();
      }, retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, 30000);
    };

    ws.onerror = () => ws.close();
  }, [symbols, startSimulation, stopSimulation]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (retryRef.current) clearTimeout(retryRef.current);
      stopSimulation();
    };
  }, []);

  const getAll = () => Object.values(prices);
  const get = (symbol) => prices[symbol.toUpperCase()] ?? null;

  return { prices, getAll, get, connected, simulated };
}
