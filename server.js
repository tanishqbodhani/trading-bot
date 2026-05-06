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

// ⚠️ UPDATE THIS AFTER FETCHING
const PRODUCT_ID = 0; // ETHUSD PERPETUAL ID

// ===============================
// ⚙️ STRATEGY CONFIG
// ===============================
const ALLOWED_SYMBOL = "ETHUSD";
const ALLOWED_TF = ["15s", "1h"];

// ===============================
// ⚙️ STATE CONTROL
// ===============================
let isTradingEnabled = true;
let lastAction = null;
let currentPosition = "NONE"; // NONE | LONG | SHORT

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
// 🚀 PLACE ORDER
// ===============================
async function placeOrder(side) {
    const path = "/v2/orders";
    const method = "POST";
    const timestamp = Date.now().toString();

    const size = 0.01;

    const body = {
        product_id: PRODUCT_ID,
        size: size,
        side: side,
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
// ❌ CLOSE POSITION
// ===============================
async function closePosition() {
    if (currentPosition === "NONE") {
        console.log("No position to close");
        return;
    }

    const side = currentPosition === "LONG" ? "sell" : "buy";

    console.log("Closing position:", currentPosition);

    await placeOrder(side);

    currentPosition = "NONE";
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

    // 🔥 NEW STRUCTURED INPUT
    const { event, side, symbol, tf } = req.body;

    // ===============================
    // ✅ FILTER (SYMBOL + TF)
    // ===============================
    if (symbol !== ALLOWED_SYMBOL || !ALLOWED_TF.includes(tf)) {
        console.log(`Ignored: ${symbol} ${tf}`);
        return res.send("Ignored");
    }

    console.log("Allowed TF:", ALLOWED_TF, "| Incoming TF:", tf);

    // ===============================
    // 🚀 ENTRY LOGIC
    // ===============================
    if (event === "ENTRY") {

        if (side === "LONG" && currentPosition !== "LONG") {
            console.log("Entering LONG");
            await placeOrder("buy");
            currentPosition = "LONG";
        }

        else if (side === "SHORT" && currentPosition !== "SHORT") {
            console.log("Entering SHORT");
            await placeOrder("sell");
            currentPosition = "SHORT";
        }

        else {
            console.log("Duplicate / same position ignored");
        }
    }

    // ===============================
    // 🛑 EXIT LOGIC
    // ===============================
    if (event === "EXIT") {

        if (side === "LONG" && currentPosition === "LONG") {
            console.log("Exiting LONG");
            await closePosition();
        }

        else if (side === "SHORT" && currentPosition === "SHORT") {
            console.log("Exiting SHORT");
            await closePosition();
        }

        else {
            console.log("No matching position to exit");
        }
    }

    res.send("OK");
});

// ===============================
// ▶️ START SERVER
// ===============================
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
