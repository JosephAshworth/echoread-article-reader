# EchoRead

EchoRead is a web application that turns any article URL into a concise spoken summary. Paste a link, and EchoRead fetches the article, summarises it with Claude or OpenAI, converts the summary to speech with ElevenLabs, and plays it back in your browser. It also stores summary history in PostgreSQL so users can revisit recent summaries without re-summarising the same article.

## Features

- Generate concise, audio-friendly article summaries from any URL.
- Choose a summary provider per request: Claude (Anthropic) or OpenAI.
- See exactly which provider/model generated each summary.
- Convert summaries to speech with selectable ElevenLabs voices.
- Save and revisit recent summaries in history (latest 20 unique article URL + provider combinations).
- Filter history by provider (All providers / Claude / OpenAI).

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, TypeScript, Express.js
- **Database:** PostgreSQL (accessed with `pg`)
- **AI Services:**
  - Anthropic Claude (`claude-sonnet-4-6`) or OpenAI (`gpt-4o-mini`) for article summarisation
  - ElevenLabs for text-to-speech

## How It Works

1. The frontend sends the article URL, selected summary provider (`claude` or `openai`), and selected voice to the backend `/summarise` endpoint.
2. The backend fetches the page, extracts the main article text, and asks the selected model (Claude or OpenAI) to produce a concise, audio-friendly summary of no more than 150 words.
3. The backend returns both the summary text and the provider used.
4. The frontend displays the summary, including which provider/model generated it, and sends the summary text to `/speak` with the selected voice.
5. The backend calls ElevenLabs and streams back MP3 audio for playback in the browser.
6. After each successful summary, the backend stores the URL, title, summary, selected voice, summary provider, summary model, and timestamp in PostgreSQL.
7. History is keyed by URL + provider, so the same article can have separate Claude and OpenAI summary entries.
8. The frontend loads `/history` to show the latest 20 URL + provider entries, displays the model used for each item, supports filtering history by provider (All / Claude / OpenAI), and lets users reuse entries for audio playback.

All external API calls happen on the backend so API keys are never exposed to the client.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- An Anthropic API key
- An OpenAI API key (if you want to use OpenAI summaries as well)
- An ElevenLabs API key

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
LLM_PROVIDER=anthropic
DATABASE_URL=postgres://postgres:postgres@localhost:5432/echoread
```

Set up the database (example):

```bash
createdb echoread
```

If your database credentials or host differ, update `DATABASE_URL` accordingly.

Start the API server:

```bash
npm run dev
```

The backend runs at `http://localhost:8000` by default.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/summarise`, `/speak`, `/voices`, and `/history` to the backend during development.

## API Keys

API keys and database credentials must be stored in `backend/.env` only. Do not put them in frontend code or commit them to git. The root `.gitignore` excludes `.env` files.

## Local Testing

1. Start the backend and frontend in separate terminals.
2. Open `http://localhost:5173`.
3. Confirm the voice dropdown loads.
4. Paste an article URL, choose your summary provider (Claude or OpenAI), and click **Generate Summary and Audio**.
5. Verify the summary appears with a "Generated with ..." provider/model indicator and the audio player works.
6. Verify the **History** section shows the new entry, including its provider/model.
7. Verify the History provider filter (All providers / Claude / OpenAI) works.
8. Generate the same URL once with Claude and once with OpenAI, then confirm both entries appear in History.
9. Verify clicking **Use this article** restores the URL and summary for audio regeneration.

## Project Structure

```text
/backend
  src/
    app.ts
    server.ts
    routes/
    services/
    db/
  package.json
  tsconfig.json
  .env.example
/frontend
  src/
    App.tsx
    types.ts
  vite.config.ts
README.md
.gitignore
```


## Demo

https://github.com/JosephAshworth/echoread-article-reader/raw/main/assets/echoread-demo.mp4