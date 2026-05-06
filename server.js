const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ===============================
// 🔐 CONFIG (PUT YOUR KEYS HERE)
// ===============================
const API_KEY = "YOUR_TESTNET_API_KEY";
const API_SECRET = "YOUR_TESTNET_SECRET";

// Testnet base URL
const BASE_URL = "https://testnet-api.delta.exchange";

// ⚠️ IMPORTANT: UPDATE THIS AFTER FETCHING FROM API
const PRODUCT_ID = 0; // ETHUSD PERPETUAL ID

// ===============================
// ⚙️ STATE CONTROL
// ===============================
let isTradingEnabled = true;
let lastAction = null;

// ===============================
// 🧪 HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
    res.send("Server Running");
});

// ===============================
// ⏸️ PAUSE / ▶️ RESUME
// ===============================
app.get("/pause", (req, res) => {
    isTradingEnabled = false;
    res.send("Trading Paused");
});

app.get("/resume", (req, res) => {
    isTradingEnabled = true;
    res.send("Trading Resumed");
});

// ===============================
// 🔐 SIGNATURE (DELTA API)
// ===============================
function generateSignature(path, method, body, timestamp) {
    const message = method + timestamp + path + JSON.stringify(body);
    return crypto
        .createHmac("sha256", API_SECRET)
        .update(message)
        .digest("hex");
}

// ===============================
// 📡 GET LIVE PRICE
// ===============================
async function getPrice() {
    const res = await axios.get(BASE_URL + "/v2/tickers/ETHUSD");
    return parseFloat(res.data.result.close);
}

// ===============================
// 🚀 PLACE ORDER (TESTNET)
// ===============================
async function placeOrder(side) {
    const path = "/v2/orders";
    const method = "POST";
    const timestamp = Date.now().toString();

    const size = 0.01; // KEEP SMALL

    const body = {
        product_id: PRODUCT_ID,
        size: size,
        side: side, // "buy" or "sell"
        order_type: "market"
    };

    const signature = generateSignature(path, method, body, timestamp);

    try {
        const res = await axios.post(BASE_URL + path, body, {
            headers: {
                "api-key": API_KEY,
                "timestamp": timestamp,
                "signature": signature
            }
        });

        console.log("ORDER SUCCESS:", res.data);
    } catch (err) {
        console.log("ORDER ERROR:", err.response?.data || err.message);
    }
}

// ===============================
// 🔍 GET PRODUCT ID (RUN ONCE)
// ===============================
app.get("/get-product", async (req, res) => {
    const data = await axios.get(BASE_URL + "/v2/products");
    res.json(data.data.result);
});

// ===============================
// 📥 WEBHOOK (TRADINGVIEW)
// ===============================
app.post("/webhook", async (req, res) => {

    if (!isTradingEnabled) {
        console.log("Paused - signal ignored");
        return res.send("Paused");
    }

    console.log("Incoming Data:", req.body);

    const { action, symbol, tf } = req.body;

    // ✅ STRICT FILTER: ETHUSD + 15s ONLY
    if (symbol !== "ETHUSD" || tf !== "15s") {
        console.log("Ignored: Not ETHUSD or not 15s");
        return res.send("Ignored");
    }

    // ✅ DUPLICATE FILTER
    if (action === lastAction) {
        console.log("Duplicate signal ignored");
        return res.send("Duplicate");
    }
    lastAction = action;

    // ✅ EXECUTION
    if (action === "BUY") {
        console.log("Executing BUY");
        await placeOrder("buy");
    }

    if (action === "SELL") {
        console.log("Executing SELL");
        await placeOrder("sell");
    }

    res.send("OK");
});

// ===============================
// ▶️ START SERVER
// ===============================
app.listen(3000, () => {
    console.log("Server running on port 3000");
});