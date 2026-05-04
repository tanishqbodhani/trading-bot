const express = require('express');
const app = express();

// This line is VERY IMPORTANT (fixes your earlier error)
app.use(express.json());

// This is your ON/OFF switch
let isTradingEnabled = true;

// Test route (to check server working)
app.get('/', (req, res) => {
    res.send("Server Running");
});

// Pause trading
app.get('/pause', (req, res) => {
    isTradingEnabled = false;
    res.send("Trading Paused");
});

// Resume trading
app.get('/resume', (req, res) => {
    isTradingEnabled = true;
    res.send("Trading Resumed");
});

// MAIN: receives TradingView signal
app.post('/webhook', (req, res) => {

    if (!isTradingEnabled) {
        console.log("Paused - signal ignored");
        return res.send("Paused");
    }

    console.log("Incoming Data:", req.body);

    const { action, symbol, timeframe } = req.body;

    // Only allow ETH + 1H
    if (symbol !== "ETHUSD" || timeframe !== "60") {
        return res.send("Ignored");
    }

    if (action === "BUY") {
        console.log("BUY signal received");
    }

    if (action === "SELL") {
        console.log("SELL signal received");
    }

    res.send("OK");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
