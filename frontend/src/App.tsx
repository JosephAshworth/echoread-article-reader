import { useEffect, useState } from 'react'
import type {
  ApiErrorResponse,
  HistoryItem,
  SummariseResponse,
  SummaryProvider,
  Voice,
} from './types'

function parseErrorMessage(payload: ApiErrorResponse | null, fallback: string): string {
  if (!payload?.detail) {
    return fallback
  }

  if (typeof payload.detail === 'string') {
    return payload.detail
  }

  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail[0]?.msg ?? fallback
  }

  if (
    typeof payload.detail === 'object' &&
    payload.detail !== null &&
    !Array.isArray(payload.detail) &&
    typeof payload.detail.message === 'string'
  ) {
    return payload.detail.message
  }

  return fallback
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorResponse
    return parseErrorMessage(payload, fallback)
  } catch {
    return fallback
  }
}

function getProviderDisplay(provider: SummaryProvider): { label: string; model: string } {
  if (provider === 'claude') {
    return { label: 'Claude (Anthropic)', model: 'claude-sonnet-4-6' }
  }
  return { label: 'OpenAI', model: 'gpt-4o-mini' }
}

function App() {
  const [url, setUrl] = useState('')
  const [voices, setVoices] = useState<Voice[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<SummaryProvider>('claude')
  const [summaryProviderUsed, setSummaryProviderUsed] = useState<SummaryProvider | null>(null)
  const [summary, setSummary] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [audioOnlyMode, setAudioOnlyMode] = useState(false)
  const [loadingVoices, setLoadingVoices] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyProviderFilter, setHistoryProviderFilter] = useState<'all' | SummaryProvider>('all')
  const [error, setError] = useState<string | null>(null)
  const filteredHistory = history.filter((item) =>
    historyProviderFilter === 'all' ? true : item.summary_provider === historyProviderFilter,
  )

  async function fetchHistory() {
    try {
      const response = await fetch('/history')
      if (!response.ok) {
        const message = await readError(response, 'Failed to load summary history.')
        throw new Error(message)
      }

      const data = (await response.json()) as HistoryItem[]
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary history.')
    } finally {
      setLoadingHistory(false)
    }
  }

  async function generateAudio(text: string, voiceId: string): Promise<void> {
    const speakResponse = await fetch('/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
      }),
    })

    if (!speakResponse.ok) {
      const message = await readError(speakResponse, 'Failed to generate audio.')
      throw new Error(message)
    }

    const audioBlob = await speakResponse.blob()
    const nextAudioUrl = URL.createObjectURL(audioBlob)
    setAudioUrl(nextAudioUrl)
  }

  useEffect(() => {
    let cancelled = false

    async function fetchInitialData() {
      try {
        const [voicesResponse, historyResponse] = await Promise.all([
          fetch('/voices'),
          fetch('/history'),
        ])

        if (!voicesResponse.ok) {
          const message = await readError(voicesResponse, 'Failed to load voices.')
          throw new Error(message)
        }
        if (!historyResponse.ok) {
          const message = await readError(historyResponse, 'Failed to load summary history.')
          throw new Error(message)
        }

        const voicesData = (await voicesResponse.json()) as Voice[]
        const historyData = (await historyResponse.json()) as HistoryItem[]
        if (cancelled) {
          return
        }

        setVoices(voicesData)
        setHistory(historyData)
        if (voicesData.length > 0) {
          setSelectedVoice(voicesData[0].voice_id)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load required data for the app.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingVoices(false)
          setLoadingHistory(false)
        }
      }
    }

    void fetchInitialData()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  async function handleGenerate() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Please paste an article URL.')
      return
    }

    if (!selectedVoice) {
      setError('Please select a voice.')
      return
    }

    setLoading(true)
    setAudioOnlyMode(false)
    setError(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    try {
      setSummary('')
      setSummaryProviderUsed(null)
      const summariseResponse = await fetch('/summarise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          voice_id: selectedVoice,
          provider: selectedProvider,
        }),
      })

      if (!summariseResponse.ok) {
        const message = await readError(
          summariseResponse,
          'Failed to generate summary.',
        )
        throw new Error(message)
      }

      const summariseData = (await summariseResponse.json()) as SummariseResponse
      setSummary(summariseData.summary)
      setSummaryProviderUsed(summariseData.provider)
      await generateAudio(summariseData.summary, selectedVoice)
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateAudioFromSummary() {
    const trimmedSummary = summary.trim()
    if (!trimmedSummary) {
      setError('Please load or generate a summary first.')
      return
    }
    if (!selectedVoice) {
      setError('Please select a voice.')
      return
    }

    setLoading(true)
    setAudioOnlyMode(true)
    setError(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    try {
      await generateAudio(trimmedSummary, selectedVoice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio.')
    } finally {
      setLoading(false)
      setAudioOnlyMode(false)
    }
  }

  function handleUseArticleFromHistory(item: HistoryItem) {
    setUrl(item.url)
    setSummary(item.summary)
    if (item.voice_id) {
      setSelectedVoice(item.voice_id)
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6">
        <header className="mb-10 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">
            EchoRead
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Turn articles into audio summaries
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
            Paste a link, pick a voice, and listen to a concise spoken summary in seconds.
          </p>
        </header>

        <main className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="url" className="mb-2 block text-sm font-medium text-slate-300">
                Article URL
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label htmlFor="provider" className="mb-2 block text-sm font-medium text-slate-300">
                Summary provider
              </label>
              <select
                id="provider"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as SummaryProvider)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label htmlFor="voice" className="mb-2 block text-sm font-medium text-slate-300">
                Voice
              </label>
              <select
                id="voice"
                value={selectedVoice}
                onChange={(event) => setSelectedVoice(event.target.value)}
                disabled={loadingVoices || voices.length === 0}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingVoices && <option value="">Loading voices...</option>}
                {!loadingVoices && voices.length === 0 && (
                  <option value="">No voices available</option>
                )}
                {voices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading || loadingVoices || voices.length === 0}
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900/60"
            >
              {loading ? 'Generating summary and audio...' : 'Generate Summary and Audio'}
            </button>

            <button
              type="button"
              onClick={() => void handleGenerateAudioFromSummary()}
              disabled={loading || loadingVoices || voices.length === 0 || !summary.trim()}
              className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-400/50 bg-slate-950 px-4 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && audioOnlyMode
                ? 'Generating audio from current summary...'
                : 'Generate Audio From Current Summary'}
            </button>

            {loading && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                <span>
                  {audioOnlyMode
                    ? 'Generating audio from the current summary...'
                    : `Fetching the article, summarising with ${
                        selectedProvider === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'
                      }, and creating audio...`}
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {summary && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="summary" className="block text-sm font-medium text-slate-300">
                    Summary
                  </label>
                  {summaryProviderUsed && (
                    <span className="text-xs text-slate-400">
                      {(() => {
                        const providerInfo = getProviderDisplay(summaryProviderUsed)
                        return `Generated with ${providerInfo.label} (${providerInfo.model})`
                      })()}
                    </span>
                  )}
                </div>
                <textarea
                  id="summary"
                  readOnly
                  value={summary}
                  rows={8}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none"
                />
              </div>
            )}

            {audioUrl && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="mb-3 text-sm font-medium text-slate-300">Audio playback</p>
                <audio controls src={audioUrl} className="w-full">
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </main>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-white">History</h2>
              <select
                aria-label="Filter history by summary provider"
                value={historyProviderFilter}
                onChange={(event) =>
                  setHistoryProviderFilter(event.target.value as 'all' | SummaryProvider)
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">All providers</option>
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Use a previous article to restore its URL and saved summary.
            </p>
          </div>

          {loadingHistory ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              Loading history...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              {history.length === 0
                ? 'No summaries yet. Generate one to see it here.'
                : 'No history entries match the selected provider filter.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-indigo-500/60 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-medium text-indigo-300">{item.url}</p>
                    <button
                      type="button"
                      onClick={() => handleUseArticleFromHistory(item)}
                      className="shrink-0 rounded-lg border border-indigo-400/50 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-slate-800"
                    >
                      Use this article
                    </button>
                  </div>
                  <p
                    className="mt-2 text-sm text-slate-300"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.summary}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {(() => {
                      const providerInfo = getProviderDisplay(item.summary_provider)
                      return `Model: ${providerInfo.label} (${item.summary_model})`
                    })()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default App
