import os
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

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel - ElevenLabs default voice

app = FastAPI(title="EchoRead API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummariseRequest(BaseModel):
    url: HttpUrl


class SpeakRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class VoiceResponse(BaseModel):
    voice_id: str
    name: str


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


def extract_article_text(url: str) -> str:
    try:
        article = Article(url)
        article.download()
        article.parse()
        text = (article.text or "").strip()
        if text:
            return text
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
        text = "\n\n".join(paragraphs).strip()
        if text:
            return text
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


@app.post("/summarise")
def summarise(request: SummariseRequest):
    get_api_keys()
    url = str(request.url)

    article_text = extract_article_text(url)
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
        return {"summary": summary}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate summary with Claude: {exc}",
        ) from exc


@app.post("/speak")
def speak(request: SpeakRequest):
    _, elevenlabs_key = get_api_keys()

    text = request.text.strip()
    if not text:
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
                "text": text,
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
