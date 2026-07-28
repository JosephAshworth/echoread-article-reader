import os
from datetime import datetime
from io import BytesIO
from typing import Optional

import anthropic
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from newspaper import Article
from pydantic import BaseModel, HttpUrl
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel - ElevenLabs default voice

app = FastAPI(title="EchoRead API")
db_engine: Optional[AsyncEngine] = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummariseRequest(BaseModel):
    url: HttpUrl
    voice_id: Optional[str] = None


class SpeakRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class VoiceResponse(BaseModel):
    voice_id: str
    name: str


class HistoryItem(BaseModel):
    id: int
    url: str
    title: Optional[str]
    summary: str
    voice_id: str
    created_at: datetime


def get_api_keys() -> tuple[str, str]:
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "your_key_here":
        raise HTTPException(
            status_code=500,
            detail="Anthropic API key is not configured. Add ANTHROPIC_API_KEY to backend/.env.",
        )
    if not ELEVENLABS_API_KEY or ELEVENLABS_API_KEY == "your_key_here":
        raise HTTPException(
            status_code=500,
            detail="ElevenLabs API key is not configured. Add ELEVENLABS_API_KEY to backend/.env.",
        )
    return ANTHROPIC_API_KEY, ELEVENLABS_API_KEY


def get_database_url() -> str:
    if not DATABASE_URL or DATABASE_URL == "your_database_url_here":
        raise HTTPException(
            status_code=500,
            detail="Database is not configured. Add DATABASE_URL to backend/.env.",
        )
    return DATABASE_URL


async def get_db_engine() -> AsyncEngine:
    global db_engine
    if db_engine is None:
        db_engine = create_async_engine(get_database_url(), future=True)
    return db_engine


async def ensure_db_ready() -> None:
    engine = await get_db_engine()
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS summaries (
                        id SERIAL PRIMARY KEY,
                        url TEXT NOT NULL,
                        title TEXT NULL,
                        summary TEXT NOT NULL,
                        voice_id TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database is unavailable: {exc}",
        ) from exc


@app.on_event("startup")
async def startup_event() -> None:
    if DATABASE_URL and DATABASE_URL != "your_database_url_here":
        await ensure_db_ready()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global db_engine
    if db_engine is not None:
        await db_engine.dispose()
        db_engine = None


def extract_article_content(url: str) -> tuple[str, Optional[str]]:
    try:
        article = Article(url)
        article.download()
        article.parse()
        text_content = (article.text or "").strip()
        article_title = (article.title or "").strip() or None
        if text_content:
            return text_content, article_title
    except Exception:
        pass

    try:
        response = requests.get(url, timeout=15, headers={"User-Agent": "EchoRead/1.0"})
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        paragraphs = [
            p.get_text(" ", strip=True)
            for p in soup.find_all("p")
            if p.get_text(strip=True)
        ]
        text_content = "\n\n".join(paragraphs).strip()
        title_tag = soup.find("title")
        article_title = title_tag.get_text(strip=True) if title_tag else None
        if text_content:
            return text_content, article_title
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch the article from that URL: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="Could not extract readable article content from that page.",
        ) from exc

    raise HTTPException(
        status_code=422,
        detail="Could not extract readable article content from that page.",
    )


async def save_summary_to_history(
    url: str,
    title: Optional[str],
    summary: str,
    voice_id: str,
) -> None:
    await ensure_db_ready()
    engine = await get_db_engine()
    try:
        async with engine.begin() as connection:
            update_result = await connection.execute(
                text(
                    """
                    UPDATE summaries
                    SET title = :title,
                        summary = :summary,
                        voice_id = :voice_id,
                        created_at = NOW()
                    WHERE url = :url
                    """
                ),
                {
                    "url": url,
                    "title": title,
                    "summary": summary,
                    "voice_id": voice_id,
                },
            )

            if update_result.rowcount and update_result.rowcount > 0:
                return

            await connection.execute(
                text(
                    """
                    INSERT INTO summaries (url, title, summary, voice_id)
                    VALUES (:url, :title, :summary, :voice_id)
                    """
                ),
                {
                    "url": url,
                    "title": title,
                    "summary": summary,
                    "voice_id": voice_id,
                },
            )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store summary history: {exc}",
        ) from exc


@app.post("/summarise")
async def summarise(request: SummariseRequest):
    get_api_keys()
    url = str(request.url)
    voice_id = request.voice_id or DEFAULT_VOICE_ID

    article_text, article_title = extract_article_content(url)
    if len(article_text) < 100:
        raise HTTPException(
            status_code=422,
            detail="The article content was too short to summarise.",
        )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=(
                "You are a helpful assistant that produces concise, conversational, "
                "audio-friendly summaries. Keep summaries to no more than 150 words. "
                "Write in clear spoken language without bullet points or markdown."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Summarise the following article for spoken audio playback:\n\n"
                        f"{article_text[:12000]}"
                    ),
                }
            ],
        )
        summary = message.content[0].text.strip()
        if not summary:
            raise ValueError("Empty summary returned")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate summary with Claude: {exc}",
        ) from exc

    await save_summary_to_history(
        url=url,
        title=article_title,
        summary=summary,
        voice_id=voice_id,
    )
    return {"summary": summary}


@app.post("/speak")
def speak(request: SpeakRequest):
    _, elevenlabs_key = get_api_keys()

    text_content = request.text.strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="Text is required for speech synthesis.")

    voice_id = request.voice_id or DEFAULT_VOICE_ID

    try:
        response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": elevenlabs_key,
            },
            json={
                "text": text_content,
                "model_id": "eleven_multilingual_v2",
            },
            timeout=60,
            stream=True,
        )

        if response.status_code != 200:
            detail = "Failed to generate audio with ElevenLabs."
            try:
                error_payload = response.json()
                if isinstance(error_payload, dict):
                    detail = error_payload.get("detail", detail)
            except ValueError:
                pass
            raise HTTPException(status_code=502, detail=detail)

        audio_buffer = BytesIO(response.content)
        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=summary.mp3"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate audio with ElevenLabs: {exc}",
        ) from exc


@app.get("/voices", response_model=list[VoiceResponse])
def voices():
    _, elevenlabs_key = get_api_keys()

    try:
        response = requests.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": elevenlabs_key},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        voice_list = payload.get("voices", [])
        return [
            {"voice_id": voice["voice_id"], "name": voice["name"]}
            for voice in voice_list
            if voice.get("voice_id") and voice.get("name")
        ]
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch voices from ElevenLabs: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch voices from ElevenLabs: {exc}",
        ) from exc


@app.get("/history", response_model=list[HistoryItem])
async def history():
    await ensure_db_ready()
    engine = await get_db_engine()
    try:
        async with engine.connect() as connection:
            result = await connection.execute(
                text(
                    """
                    SELECT id, url, title, summary, voice_id, created_at
                    FROM (
                        SELECT DISTINCT ON (url)
                            id, url, title, summary, voice_id, created_at
                        FROM summaries
                        ORDER BY url, created_at DESC
                    ) AS latest_per_url
                    ORDER BY created_at DESC
                    LIMIT 20
                    """
                )
            )
            rows = result.mappings().all()
            return [
                {
                    "id": row["id"],
                    "url": row["url"],
                    "title": row["title"],
                    "summary": row["summary"],
                    "voice_id": row["voice_id"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load summary history: {exc}",
        ) from exc
