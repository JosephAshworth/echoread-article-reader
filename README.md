# EchoRead

EchoRead is a web application that turns any article URL into a concise spoken summary. Paste a link, and EchoRead fetches the article, summarises it with Claude, converts the summary to speech with ElevenLabs, and plays it back in your browser.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Python, FastAPI
- **AI Services:**
  - Anthropic Claude (`claude-sonnet-4-6`) for article summarisation
  - ElevenLabs for text-to-speech

## How It Works

1. The frontend sends the article URL to the backend `/summarise` endpoint.
2. The backend fetches the page, extracts the main article text, and asks Claude to produce a concise, audio-friendly summary of no more than 150 words.
3. The frontend displays the summary and sends it to `/speak` with the selected voice.
4. The backend calls ElevenLabs and streams back MP3 audio for playback in the browser.

All external API calls happen on the backend so API keys are never exposed to the client.

## Prerequisites

- Node.js 18+
- Python 3.10+
- An Anthropic API key
- An ElevenLabs API key

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=your_anthropic_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

Start the API server:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/summarise`, `/speak`, and `/voices` to the backend during development.

## API Keys

API keys must be stored in `backend/.env` only. Do not put them in frontend code or commit them to git. The root `.gitignore` excludes `.env` files.

## Local Testing

1. Start the backend and frontend in separate terminals.
2. Open `http://localhost:5173`.
3. Confirm the voice dropdown loads.
4. Paste an article URL and click **Generate Summary and Audio**.
5. Verify the summary appears and the audio player works.

## Project Structure

```text
/backend
  main.py
  requirements.txt
  .env
/frontend
  src/
    App.tsx
    types.ts
  vite.config.ts
README.md
.gitignore
```
