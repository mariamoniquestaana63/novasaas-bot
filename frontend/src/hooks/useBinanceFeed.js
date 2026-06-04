import { useEffect, useRef, useState, useCallback } from "react";

const STREAMS = "wss://stream.binance.com:9443/stream?streams=";
const SYMBOLS  = ["btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt", "adausdt"];
const SEEDS    = { BTCUSDT: 67400, ETHUSDT: 3820, BNBUSDT: 615, SOLUSDT: 178, XRPUSDT: 0.62, ADAUSDT: 0.48 };

function walk(p, v = 0.0008) { return Math.max(p + p * v * (Math.random() * 2 - 1), p * 0.9); }

export function useBinanceFeed(symbols = SYMBOLS) {
  const [prices, setPrices]       = useState({});
  const [connected, setConnected] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const ws  = useRef(null);
  const sim = useRef(null);
  const buf = useRef({ ...SEEDS });
  const delay = useRef(2000);

  const stopSim = useCallback(() => {
    if (sim.current) { clearInterval(sim.current); sim.current = null; }
    setSimulated(false);
  }, []);

  const startSim = useCallback(() => {
    setSimulated(true); setConnected(false);
    sim.current = setInterval(() => {
      buf.current = Object.fromEntries(Object.entries(buf.current).map(([s, p]) => [s, walk(p)]));
      const now = Date.now();
      setPrices(Object.fromEntries(
        Object.entries(buf.current).map(([symbol, price]) => [
          symbol, { symbol, price, change24h: Math.random() * 10 - 5, volume24h: Math.random() * 1e9, ts: now },
        ])
      ));
    }, 1000);
  }, []);

  const connect = useCallback(() => {
    const url = `${STREAMS}${symbols.map(s => `${s}@ticker`).join("/")}`;
    const sock = new WebSocket(url);
    ws.current = sock;
    sock.onopen  = () => { setConnected(true); stopSim(); delay.current = 2000; };
    sock.onmessage = ({ data }) => {
      try {
        const { data: d } = JSON.parse(data);
        setPrices(p => ({ ...p, [d.s]: { symbol: d.s, price: +d.c, change24h: +d.P, volume24h: +d.v, ts: Date.now() } }));
      } catch {}
    };
    sock.onclose = () => {
      setConnected(false); startSim();
      setTimeout(() => { stopSim(); connect(); }, delay.current);
      delay.current = Math.min(delay.current * 2, 30000);
    };
    sock.onerror = () => sock.close();
  }, [symbols, startSim, stopSim]);

  useEffect(() => { connect(); return () => { ws.current?.close(); stopSim(); }; }, []);

  return {
    prices,
    connected,
    simulated,
    getAll: () => Object.values(prices),
    get: (sym) => prices[sym.toUpperCase()] ?? null,
  };
}
