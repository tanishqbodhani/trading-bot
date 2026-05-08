const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

// =====================================
// JSON BODY ONLY
// =====================================
app.use(express.json());

// =====================================
// CONFIG
// =====================================
const API_KEY = "MGXIlKx3GgbXX0W9Z6ET5DzV7EmVVz";
const API_SECRET = "s8jHpB8GGD0BYpmlS7NPceVYOgHcPss99LxrxEVWbOml6W6uLbyOe89d1e72";

const BASE_URL =
    "https://testnet-api.delta.exchange";

const PRODUCT_ID = 1699;

const ORDER_SIZE = 0.01;

const SYMBOL = "ETHUSD";

const ALLOWED_TF = ["15s", "1h"];

// =====================================
// STATE
// =====================================
let currentPosition = "NONE";

// =====================================
// HEALTH CHECK
// =====================================
app.get("/", (req, res) => {
    res.send("Bot Running");
});

// =====================================
// SIGNATURE
// =====================================
function generateSignature(
    method,
    timestamp,
    path,
    body
) {

    const payload =
        method +
        timestamp +
        path +
        JSON.stringify(body);

    return crypto
        .createHmac(
            "sha256",
            API_SECRET
        )
        .update(payload)
        .digest("hex");
}

// =====================================
// PLACE ORDER
// =====================================
async function placeOrder(side) {

    const path = "/v2/orders";

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
            "POST",
            timestamp,
            path,
            body
        );

    try {

        const response =
            await axios.post(
                BASE_URL + path,
                body,
                {
                    headers: {
                        "api-key": API_KEY,
                        "timestamp": timestamp,
                        "signature": signature,
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        console.log(
            "ORDER SUCCESS"
        );

        console.log(
            response.data
        );

    } catch (err) {

        console.log(
            "ORDER FAILED"
        );

        console.log(
            err.response?.data ||
            err.message
        );
    }
}

// =====================================
// WEBHOOK
// =====================================
app.post(
    "/webhook",
    async (req, res) => {

        console.log(
            "Webhook Received:"
        );

        console.log(req.body);

        const {
            event,
            side,
            symbol,
            tf
        } = req.body;

        // ============================
        // FILTER
        // ============================
        if (
            symbol !== SYMBOL ||
            !ALLOWED_TF.includes(tf)
        ) {

            console.log(
                "Ignored"
            );

            return res.send(
                "Ignored"
            );
        }

        // ============================
        // ENTRY
        // ============================
        if (event === "ENTRY") {

            // LONG
            if (
                side === "LONG" &&
                currentPosition !== "LONG"
            ) {

                console.log(
                    "OPEN LONG"
                );

                await placeOrder(
                    "buy"
                );

                currentPosition =
                    "LONG";
            }

            // SHORT
            else if (
                side === "SHORT" &&
                currentPosition !== "SHORT"
            ) {

                console.log(
                    "OPEN SHORT"
                );

                await placeOrder(
                    "sell"
                );

                currentPosition =
                    "SHORT";
            }
        }

        // ============================
        // EXIT
        // ============================
        if (event === "EXIT") {

            // EXIT LONG
            if (
                side === "LONG" &&
                currentPosition === "LONG"
            ) {

                console.log(
                    "CLOSE LONG"
                );

                await placeOrder(
                    "sell"
                );

                currentPosition =
                    "NONE";
            }

            // EXIT SHORT
            else if (
                side === "SHORT" &&
                currentPosition === "SHORT"
            ) {

                console.log(
                    "CLOSE SHORT"
                );

                await placeOrder(
                    "buy"
                );

                currentPosition =
                    "NONE";
            }
        }

        res.send("OK");
    }
);

// =====================================
// START SERVER
// =====================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Running on ${PORT}`);
});,
    () => {

        console.log(
            "Server Running"
        );
    }
);
