const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

// ===============================
// 🔥 ACCEPT RAW WEBHOOK DATA
// ===============================
app.use(express.text({ type: "*/*" }));
app.use(express.json());

// ===============================
// 🔐 DELTA TESTNET CONFIG
// ===============================
const API_KEY = "chjvEFJTf9mIjEZzEH9v9GblswbekF";
const API_SECRET = "uz6e0yNnkp0bkOZb8kx8d3yBWVPrlBRkZFAr1OraQUdSvj4GfHt6ahWlVPhu";


const BASE_URL = "https://testnet-api.delta.exchange";

// ⚠️ UPDATE THIS AFTER FETCHING PRODUCT ID
const PRODUCT_ID = 0;

// ===============================
// ⚙️ STRATEGY SETTINGS
// ===============================
const ALLOWED_SYMBOL = "ETHUSD";
const ALLOWED_TF = ["15s", "1h"];

const ORDER_SIZE = 0.01;

// ===============================
// ⚙️ STATE
// ===============================
let isTradingEnabled = true;
let currentPosition = "NONE";

// ===============================
// 🧪 HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
    res.send("Server Running");
});

// ===============================
// ⏸️ PAUSE
// ===============================
app.get("/pause", (req, res) => {
    isTradingEnabled = false;
    console.log("Trading Paused");
    res.send("Trading Paused");
});

// ===============================
// ▶️ RESUME
// ===============================
app.get("/resume", (req, res) => {
    isTradingEnabled = true;
    console.log("Trading Resumed");
    res.send("Trading Resumed");
});

// ===============================
// 🔐 GENERATE SIGNATURE
// ===============================
function generateSignature(path, method, body, timestamp) {

    const message =
        method +
        timestamp +
        path +
        JSON.stringify(body);

    return crypto
        .createHmac("sha256", API_SECRET)
        .update(message)
        .digest("hex");
}

// ===============================
// 🚀 PLACE ORDER
// ===============================
async function placeOrder(side) {

    const path = "/v2/orders";
    const method = "POST";

    // ✅ FIXED TIMESTAMP
    const timestamp =
        Math.floor(Date.now() / 1000).toString();

    const body = {
        product_id: PRODUCT_ID,
        size: ORDER_SIZE,
        side: side,
        order_type: "market"
    };

    const signature =
        generateSignature(
            path,
            method,
            body,
            timestamp
        );

    try {

        const response = await axios.post(
            BASE_URL + path,
            body,
            {
                headers: {
                    "api-key": API_KEY,
                    "timestamp": timestamp,
                    "signature": signature
                }
            }
        );

        console.log("ORDER SUCCESS:");
        console.log(response.data);

    } catch (err) {

        console.log("ORDER ERROR:");

        if (err.response?.data) {
            console.log(err.response.data);
        } else {
            console.log(err.message);
        }
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

    const side =
        currentPosition === "LONG"
            ? "sell"
            : "buy";

    console.log("Closing:", currentPosition);

    await placeOrder(side);

    currentPosition = "NONE";
}

// ===============================
// 🔍 FETCH PRODUCT ID
// ===============================
app.get("/get-product", async (req, res) => {

    try {

        const response =
            await axios.get(
                BASE_URL + "/v2/products"
            );

        res.json(response.data.result);

    } catch (err) {

        res.send(err.message);
    }
});

// ===============================
// 📥 WEBHOOK
// ===============================
app.post("/webhook", async (req, res) => {

    if (!isTradingEnabled) {

        console.log("Trading paused");
        return res.send("Paused");
    }

    let data = req.body;

    // ===============================
    // 🔥 SAFE JSON PARSE
    // ===============================
    if (typeof req.body === "string") {

        try {

            if (!req.body.trim()) {

                console.log(
                    "Ignored: Empty Webhook"
                );

                return res.send("Empty");
            }

            data = JSON.parse(req.body);

        } catch (error) {

            console.log(
                "JSON Parse Error:"
            );

            console.log(req.body);

            return res
                .status(400)
                .send("Invalid JSON");
        }
    }

    console.log("Incoming Data:");
    console.log(data);

    const {
        event,
        side,
        symbol,
        tf
    } = data;

    // ===============================
    // ✅ FILTER
    // ===============================
    if (
        symbol !== ALLOWED_SYMBOL ||
        !ALLOWED_TF.includes(tf)
    ) {

        console.log(
            `Ignored: ${symbol} ${tf}`
        );

        return res.send("Ignored");
    }

    // ===============================
    // 🚀 ENTRY
    // ===============================
    if (event === "ENTRY") {

        // LONG
        if (
            side === "LONG" &&
            currentPosition !== "LONG"
        ) {

            console.log("Entering LONG");

            await placeOrder("buy");

            currentPosition = "LONG";
        }

        // SHORT
        else if (
            side === "SHORT" &&
            currentPosition !== "SHORT"
        ) {

            console.log("Entering SHORT");

            await placeOrder("sell");

            currentPosition = "SHORT";
        }

        else {

            console.log(
                "Duplicate ignored"
            );
        }
    }

    // ===============================
    // 🛑 EXIT
    // ===============================
    if (event === "EXIT") {

        // EXIT LONG
        if (
            side === "LONG" &&
            currentPosition === "LONG"
        ) {

            console.log("Exiting LONG");

            await closePosition();
        }

        // EXIT SHORT
        else if (
            side === "SHORT" &&
            currentPosition === "SHORT"
        ) {

            console.log("Exiting SHORT");

            await closePosition();
        }

        else {

            console.log(
                "No matching position"
            );
        }
    }

    res.send("OK");
});

// ===============================
// ▶️ START SERVER
// ===============================
app.listen(3000, () => {

    console.log(
        "Server running on port 3000"
    );
});
