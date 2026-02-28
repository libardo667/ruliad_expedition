# Ruliad Expedition v1

Local web tool served through a Node.js proxy (`proxy_server.mjs`) with OpenRouter support and an optional experimental Wolfram Alpha integration.

## Prerequisites

- Extract this project into its own dedicated folder.
- Install Node.js v18 or higher from `nodejs.org`. Choose the LTS version. Verify with `node -v`.
- Create an OpenRouter account and get an API key.
- Optional: create a Wolfram Alpha account and generate an App ID if you want to try the experimental Wolfram feature.

## Start the project (Windows / PowerShell)

1. Open a terminal in this project folder.
   - Option A: In File Explorer, open the folder and choose **Open in Terminal**.
   - Option B: Open PowerShell and `cd` to the extracted folder.
2. Set environment variables:
   ```powershell
   $env:OPENROUTER_API_KEY="your_openrouter_api_key"
   $env:WOLFRAM_APPID="your_wolfram_appid"   # optional
   ```
3. Start the proxy server:
   ```powershell
   node proxy_server.mjs
   ```
4. Open:
   - `http://localhost:8787`

## Start the project (macOS / Linux)

1. Open a terminal and `cd` into this project folder.
2. Set environment variables:
   ```bash
   export OPENROUTER_API_KEY="your_openrouter_api_key"
   export WOLFRAM_APPID="your_wolfram_appid"   # optional
   ```
3. Start the proxy server:
   ```bash
   node proxy_server.mjs
   ```
4. Open:
   - `http://localhost:8787`

## Next Steps

Explore and learn! For Pro/Founding Pro members, A video walkthrough covering the interface and running your first expedition is available in your download files. 

## Notes

- `OPENROUTER_API_KEY` is required for proxying LLM requests unless your client sends an `Authorization` header directly.
- `WOLFRAM_APPID` is only needed for Wolfram endpoints/features.
- If you set or change environment variables after the server starts, stop and restart `node proxy_server.mjs`.
