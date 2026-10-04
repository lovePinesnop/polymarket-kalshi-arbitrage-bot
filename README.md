![](src/img%20and%20video/polymarket-kalshi.png)

# Polymarket-Kalshi Arbitrage Bot

Professional TypeScript bot for monitoring short-duration prediction markets across **Polymarket** and **Kalshi**, detecting pricing gaps, and placing buy orders on Polymarket when configured arbitrage rules are satisfied.

**Canonical repository:** [github.com/crismarfrhot/polymarket-kalshi-arbitrage-bot](https://github.com/crismarfrhot/polymarket-kalshi-arbitrage-bot)

The bot is designed for 15-minute markets where fast pricing updates, clear execution rules, and transparent runtime status matter. It continuously compares Kalshi YES pricing against Polymarket UP pricing, exposes a simple monitoring API, and can initialize an authenticated Polymarket order client for automated execution.

<p>
  <a href="https://github.com/crismarfrhot/polymarket-kalshi-arbitrage-bot">
    <img src="https://img.shields.io/badge/Repository-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub repository" />
  </a>
</p>

> Important: Prediction market trading involves risk. This project provides configurable automation and monitoring logic; it does not guarantee profit or eliminate execution, liquidity, market, regulatory, or operational risk.

## What This Bot Does

- Monitors a paired Kalshi and Polymarket market on a configurable interval.
- Pulls Polymarket UP/DOWN token pricing from the Polymarket CLOB.
- Pulls Kalshi YES/NO pricing and market status from the Kalshi trade API.
- Waits until a configurable start window has passed before evaluating trades.
- Emits structured arbitrage signals through `/status`.
- Places Polymarket buy orders using `@polymarket/clob-client` when valid trading credentials are configured.
- Applies order cooldowns to reduce duplicate execution during repeated signals.
- Runs as a lightweight Express service that can be deployed on a VPS, container, or cloud instance.

## Strategy Overview

The current strategy focuses on buying the Polymarket UP token when Kalshi is pricing the equivalent outcome materially higher.

### Rule 1: Spread-Based Entry

After the configured start delay, the bot checks whether Kalshi YES is inside a target confidence band and whether Polymarket UP is meaningfully cheaper.

Default thresholds:

- Kalshi YES must be between `93` and `96` cents.
- Polymarket UP must be at least `10` cents cheaper than Kalshi YES.
- The bot emits `buy_polymarket` when both conditions are true.

Example:

```text
Kalshi YES:      95 cents
Polymarket UP:   82 cents
Spread:          13 cents
Decision:        BUY Polymarket UP
```

Resulting signal:

```json
{
  "action": "buy_polymarket",
  "reason": "Kalshi YES 95¢ in [93,96], Polymarket UP 82¢ (spread 13¢ >= 10¢).",
  "kalshiYesCents": 95,
  "polymarketUpCents": 82,
  "spreadCents": 13
}
```

### Rule 2: Late Resolution Opportunity

Some short-duration markets can close or settle on one venue while the other still has an active order book. If Kalshi is finished but Polymarket still has liquidity, the bot emits a late-entry signal.

Example:

```text
Kalshi status:       settled
Polymarket book:     still has liquidity
Decision:            BUY Polymarket UP
```

Resulting signal:

```json
{
  "action": "buy_polymarket_late",
  "reason": "Kalshi market finished (closed/settled) while Polymarket still has orders.",
  "kalshiStatus": "settled"
}
```

## Demo (Instagram reel — Polymarket vs Kalshi for bots)

Primary source: [https://www.instagram.com/reel/DWrBSHxlIZ3/](https://www.instagram.com/reel/DWrBSHxlIZ3/) (permalink on profile: [@moondevonyt](https://www.instagram.com/moondevonyt/reel/DWrBSHxlIZ3/)).

### Source metadata (public, as shown on Instagram)

- **Account:** [@moondevonyt](https://www.instagram.com/moondevonyt/) — display name *Moon Dev on YT* (verified).
- **Post type:** Reel / `GraphVideo` clip (vertical 720×1280 class dimensions in embed data).
- **Published:** April 3, 2026 (Instagram “taken at” timestamp in page metadata).
- **Caption (verbatim):** *Polymarket or kalshi for trading bots?*
- **Audio:** Original audio credited to the same account (“Moon Dev on YT on Instagram…” in `og:title`).
- **Approximate length:** ~39 seconds (progressive clip; duration from Instagram embed payload when the local video was mirrored).
- **Engagement (snapshot only — changes on Instagram over time):** on the order of hundreds of reel plays and a few dozen likes on the public counter at mirror time; use the live post for current numbers.

The spoken rundown is only in the clip (Instagram’s public HTML does not ship a full transcript). In short: the hook is choosing **one venue** versus wiring **both** when automation and **cross-platform** prices matter.

### How that question maps to this repository

This repo is **not** the app from the reel; it is a **standalone TypeScript service**. It still illustrates one concrete answer for **cross-venue** work: the bot **polls both venues** (Kalshi trade API + Polymarket CLOB), runs the **spread and late-resolution rules** in [Strategy Overview](#strategy-overview), and, when trading is enabled, places **Polymarket** buy orders. So for “Polymarket *or* Kalshi?” in the sense of **mispricing between books**, this code assumes **both feeds for signals** and **Polymarket** for the automated buy side wired in `polymarketOrders.ts`.

### Local copy (for README / offline use)

Mirrored under [`src/img and video/`](./src/img%20and%20video/) (shortcode **DWrBSHxlIZ3**):

- **Video:** [`instagram-DWrBSHxlIZ3-demo.mp4`](./src/img%20and%20video/instagram-DWrBSHxlIZ3-demo.mp4)
- **Poster / cover frame:** [`instagram-DWrBSHxlIZ3-poster.jpg`](./src/img%20and%20video/instagram-DWrBSHxlIZ3-poster.jpg)


## Architecture

```text
Kalshi API              Polymarket CLOB
    |                         |
    |                         |
    +------ price polling ----+
              |
              v
      Arbitrage decision engine
              |
      +-------+--------+
      |                |
      v                v
  /status API     Polymarket order client
                   authenticated execution
```

Core modules:

- `src/index.ts` starts the Express API, polling loop, and optional trading client.
- `src/config.ts` loads and validates runtime configuration from `.env`.
- `src/services/kalshi.ts` fetches Kalshi market data.
- `src/services/polymarket.ts` fetches Polymarket CLOB prices.
- `src/services/arbitrage.ts` evaluates buy/no-buy decisions.
- `src/services/polymarketOrders.ts` places Polymarket orders when trading is enabled.

## Tech Stack

- **Node.js 18+**
- **TypeScript**
- **Express** for the HTTP monitoring/control API
- **Axios** for Kalshi and Polymarket HTTP requests
- **@polymarket/clob-client** for Polymarket order placement
- **ethers** for wallet/client support
- **dotenv** for environment-based configuration

## Quick Start

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Edit `.env` with your market pair and wallet settings, then run:

```bash
npm run build
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The service starts polling automatically and exposes the API on `http://localhost:3000` by default.

## Example `.env`

```env
PORT=3000
POLL_INTERVAL_MS=5000

MARKET_START_TIME=2026-05-11T07:00:00.000Z
START_DELAY_MINS=8

KALSHI_API_BASE=https://api.elections.kalshi.com/trade-api/v2
KALSHI_TICKER=KXHIGHNY-24JAN01-T60

POLYMARKET_CLOB_BASE=https://clob.polymarket.com
POLYMARKET_TOKEN_UP=1234567890123456789012345678901234567890
POLYMARKET_TOKEN_DOWN=9876543210987654321098765432109876543210

KALSHI_MIN_CENTS=93
KALSHI_MAX_CENTS=96
MIN_SPREAD_CENTS=10

POLYMARKET_PRIVATE_KEY=0x<64_HEX_CHARACTER_PRIVATE_KEY>
POLYMARKET_PROXY_WALLET_ADDRESS=0x<40_HEX_CHARACTER_PROXY_WALLET>
POLYMARKET_CHAIN_ID=137
POLYMARKET_TRADE_USD=10
POLYMARKET_BUY_COOLDOWN_SECONDS=60
```

Keep private keys out of source control. Use a dedicated trading wallet with limited funds.

## Configuration Reference

| Variable | Description | Default / Example |
| --- | --- | --- |
| `PORT` | HTTP server port. | `3000` |
| `POLL_INTERVAL_MS` | Price polling interval in milliseconds. | `5000` |
| `MARKET_START_TIME` | Market start time in ISO 8601 format. | `2026-05-11T07:00:00.000Z` |
| `START_DELAY_MINS` | Minutes after market start before evaluating signals. | `8` |
| `KALSHI_API_BASE` | Kalshi trade API base URL. | `https://api.elections.kalshi.com/trade-api/v2` |
| `KALSHI_TICKER` | Kalshi market ticker for the target market. | `KXHIGHNY-24JAN01-T60` |
| `POLYMARKET_CLOB_BASE` | Polymarket CLOB API base URL. | `https://clob.polymarket.com` |
| `POLYMARKET_TOKEN_UP` | Polymarket UP/YES token ID. | From the Polymarket market |
| `POLYMARKET_TOKEN_DOWN` | Polymarket DOWN/NO token ID. | From the Polymarket market |
| `KALSHI_MIN_CENTS` | Lower Kalshi YES price bound for spread entries. | `93` |
| `KALSHI_MAX_CENTS` | Upper Kalshi YES price bound for spread entries. | `96` |
| `MIN_SPREAD_CENTS` | Minimum Kalshi minus Polymarket spread required. | `10` |
| `POLYMARKET_PRIVATE_KEY` | EOA private key used for trading. | `0x...` |
| `POLYMARKET_PROXY_WALLET_ADDRESS` | Polymarket proxy wallet / Safe address. | `0x...` |
| `POLYMARKET_CHAIN_ID` | Chain ID for Polymarket CLOB. | `137` |
| `POLYMARKET_TRADE_USD` | USD amount per buy order. | `10` |
| `POLYMARKET_BUY_COOLDOWN_SECONDS` | Minimum seconds between buy orders. | `60` |

## API Reference

### `GET /health`

Simple health check.

```bash
curl http://localhost:3000/health
```

Example response:

```json
{
  "ok": true,
  "ts": "2026-05-11T07:08:14.122Z"
}
```

### `GET /status`

Returns the latest market data, trading state, and current arbitrage signal.

```bash
curl http://localhost:3000/status
```

Example response:

```json
{
  "tradingEnabled": true,
  "afterStartWindow": true,
  "lastTickAt": 1778483294122,
  "polymarket": {
    "upCents": 82,
    "downCents": 18,
    "hasLiquidity": true,
    "fetchedAt": 1778483293988
  },
  "kalshi": {
    "yesCents": 95,
    "noCents": 5,
    "status": "open",
    "isFinished": false,
    "fetchedAt": 1778483294041
  },
  "signal": {
    "action": "buy_polymarket",
    "reason": "Kalshi YES 95¢ in [93,96], Polymarket UP 82¢ (spread 13¢ >= 10¢).",
    "kalshiYesCents": 95,
    "polymarketUpCents": 82,
    "spreadCents": 13
  }
}
```

### `POST /poll/start`

Starts the polling loop. Polling starts automatically when the service boots, but this endpoint is useful after manually stopping it.

```bash
curl -X POST http://localhost:3000/poll/start
```

### `POST /poll/stop`

Stops the polling loop without shutting down the HTTP server.

```bash
curl -X POST http://localhost:3000/poll/stop
```

## Operating Notes

### Monitoring Signals

The `/status` endpoint always exposes the latest evaluated signal, including no-buy reasons. This is useful for validating market pairing, reviewing spreads, and demonstrating the strategy logic before increasing capital allocation.

Best for:

- Strategy validation
- Client demos
- Reviewing live signal behavior
- Collecting signal frequency data

### Automated Trading

When `POLYMARKET_PRIVATE_KEY` and `POLYMARKET_PROXY_WALLET_ADDRESS` are valid, the bot initializes the Polymarket order client and places buy orders when a buy signal appears. Use a dedicated wallet and conservative trade size while validating behavior.

Execution protections included in the current code:

- Configurable trade size via `POLYMARKET_TRADE_USD`
- Configurable buy cooldown via `POLYMARKET_BUY_COOLDOWN_SECONDS`
- Price validation before submitting a buy
- In-memory latest state for transparent API inspection

## Example Client Workflow

1. Select a 15-minute event that exists on both Kalshi and Polymarket.
2. Copy the Kalshi ticker into `KALSHI_TICKER`.
3. Copy the matching Polymarket UP and DOWN token IDs into `.env`.
4. Set `MARKET_START_TIME` and confirm `START_DELAY_MINS`.
5. Run the bot and watch `/status` to confirm price feeds and signal behavior.
6. Confirm the signal behavior against live market screens.
7. Use a limited Polymarket wallet and conservative `POLYMARKET_TRADE_USD`.
8. Monitor logs and the `/status` endpoint during the active market window.

## Sample Logs

```text
Polymarket-Kalshi arbitrage bot listening on port 3000
  GET /health  - health check
  GET /status  - last prices and current signal
  POST /poll/start - start price polling
  POST /poll/stop  - stop price polling
[Bot] Polymarket order client ready (trading enabled).
[Bot] Polling every 5000ms
[Bot] BUY SIGNAL: {
  "action": "buy_polymarket",
  "kalshiYesCents": 95,
  "polymarketUpCents": 82,
  "spreadCents": 13
}
[Bot] Polymarket BUY order placed: { "...": "..." }
```

## Deployment Notes

- Run on a stable machine with reliable network access.
- Use process supervision such as `pm2`, Docker, systemd, or your cloud provider's runtime manager.
- Store secrets in environment variables or a managed secret store.
- Use a dedicated wallet with limited capital.
- Monitor `/health`, `/status`, application logs, and wallet balances.
- Keep polling intervals reasonable to avoid unnecessary API load.

## Security Notes

- Never commit `.env` or private keys.
- Rotate keys if they were ever exposed.
- Use a dedicated proxy wallet for bot execution.
- Start with small trade sizes until the full workflow is verified.
- Review venue rules and local regulations before using automated trading.

## Commands

```bash
npm run dev        # Start development server with auto-reload
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled production build
npm run typecheck  # Type-check without emitting files
```

## Disclaimer

This repository is provided for software engineering and automation purposes. Markets can move quickly, APIs can fail, liquidity can disappear, and automated orders can execute at unfavorable times. Review the code, test carefully, and trade only with capital you can afford to risk.
