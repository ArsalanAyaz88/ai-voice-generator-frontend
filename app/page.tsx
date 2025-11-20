"use client";

import { useEffect, useMemo, useState } from "react";

type Voice = {
  name: string;
  language: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const MAX_TEXT_LENGTH = 10_000;

function formatVoiceLabel(voice: Voice) {
  return voice.name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [text, setText] = useState("hi");
  const [speed, setSpeed] = useState(1);
  const [search, setSearch] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [recentVoices, setRecentVoices] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchVoices = async () => {
      try {
        setLoadingVoices(true);
        setFetchError(null);
        const response = await fetch(`${API_BASE_URL}/voices`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load voices");
        }
        const data = await response.json();
        const normalized: Voice[] = data?.voices ?? [];
        setVoices(normalized);
        if (!selectedVoice && normalized.length > 0) {
          setSelectedVoice(normalized[0].name);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setFetchError(
          error instanceof Error ? error.message : "Unable to fetch voices"
        );
      } finally {
        setLoadingVoices(false);
      }
    };

    fetchVoices();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioUrl) {
      setAudioDuration(null);
      return;
    }
    const audio = new Audio(audioUrl);
    const handleLoaded = () => {
      if (!Number.isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.load();
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
    };
  }, [audioUrl]);

  const filteredVoices = useMemo(() => {
    if (!search.trim()) return voices;
    const query = search.toLowerCase();
    return voices.filter(
      (voice) =>
        voice.name.toLowerCase().includes(query) ||
        voice.language.toLowerCase().includes(query)
    );
  }, [voices, search]);

  const recentVoiceDetails = useMemo(
    () =>
      recentVoices
        .map((name) => voices.find((voice) => voice.name === name))
        .filter((voice): voice is Voice => Boolean(voice)),
    [recentVoices, voices]
  );

  const handleGenerate = async () => {
    if (!text.trim()) {
      setSynthError("Please enter some text to synthesize");
      return;
    }
    if (!selectedVoice) {
      setSynthError("Please select a voice");
      return;
    }

    setSynthError(null);
    setIsSynthesizing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          speed,
          device: "cpu",
          return_phonemes: false,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to synthesize speech");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setRecentVoices((prev) => {
        const updated = [selectedVoice, ...prev.filter((v) => v !== selectedVoice)];
        return updated.slice(0, 5);
      });
    } catch (error) {
      setSynthError(
        error instanceof Error ? error.message : "Unable to generate speech"
      );
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-[200px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
            Creative Platform
          </p>
          <h1 className="text-lg font-semibold text-zinc-900">AI Voice Studio</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 sm:gap-3">
          <button className="rounded-full border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:border-zinc-300 sm:px-4">
            Feedback
          </button>
          <button className="rounded-full border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:border-zinc-300 sm:px-4">
            Documentation
          </button>
          <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 sm:px-4">
            <span className="h-8 w-8 rounded-full bg-amber-200" />
            <span className="font-semibold text-zinc-700">Vbn</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full flex-col gap-6 px-4 py-6 lg:h-[calc(100vh-88px)] lg:flex-row lg:overflow-hidden lg:px-8">
        <main className="flex flex-1 flex-col gap-6 lg:flex-row lg:overflow-hidden">
          <section className="flex w-full flex-1 flex-col rounded-[32px] bg-white p-4 shadow-sm sm:p-6 lg:overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                  Playground
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-900">
                  Text to Speech
                </h2>
              </div>
              <div className="text-right text-xs text-zinc-400">
                <p>2 / 5,000 characters</p>
                <p>25,509 credits remaining</p>
              </div>
            </div>

            <div className="mt-6 flex-1 overflow-hidden">
              <div className="flex h-full min-h-[220px] flex-col rounded-3xl border border-transparent bg-zinc-50 p-3 transition focus-within:border-zinc-200 sm:p-4">
                <textarea
                  value={text}
                  onChange={(event) =>
                    setText(event.target.value.slice(0, MAX_TEXT_LENGTH))
                  }
                  className="h-full w-full flex-1 resize-none overflow-auto bg-transparent text-base leading-7 text-zinc-800 outline-none sm:text-lg"
                  placeholder="Type or paste the content you want to narrate..."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-500 sm:gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Speed</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speed}
                    onChange={(event) =>
                      setSpeed(parseFloat(event.target.value))
                    }
                    className="w-40 accent-zinc-900"
                  />
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {speed.toFixed(1)}x
                  </span>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Characters</p>
                <p className="font-semibold text-zinc-700">
                  {text.length} / {MAX_TEXT_LENGTH}
                </p>
              </div>
              <div className="ml-auto flex w-full justify-end gap-2 sm:w-auto sm:gap-3">
                <button
                  onClick={() => setText("")}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300 sm:px-5"
                >
                  Clear
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isSynthesizing}
                  className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 sm:px-6"
                >
                  {isSynthesizing ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>

            {synthError && (
              <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {synthError}
              </p>
            )}

            {audioUrl && (
              <div className="mt-4 rounded-3xl bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
                  <p className="font-semibold text-zinc-900">Preview</p>
                  {audioDuration !== null && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
                      Duration: {formatDuration(audioDuration)}
                    </span>
                  )}
                  <a
                    href={audioUrl}
                    download="kokoro-tts.wav"
                    className="ml-auto rounded-full border border-zinc-200 px-4 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300"
                  >
                    Download
                  </a>
                </div>
                <audio className="mt-3 w-full" controls src={audioUrl} />
              </div>
            )}
          </section>

          <section className="flex w-full flex-col rounded-[32px] bg-white p-4 shadow-sm sm:p-6 lg:max-w-md lg:overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Select a voice
                </p>
                <h3 className="text-lg font-semibold text-zinc-900">
                  All saved voices
                </h3>
              </div>
              <span className="text-xs text-zinc-400">
                {filteredVoices.length} voices
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search voices..."
                className="w-full rounded-2xl bg-transparent px-4 py-2 text-sm text-zinc-700 outline-none"
              />
            </div>
            <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Device: <span className="font-semibold text-zinc-800">CPU</span>
            </div>

            <div className="mt-4 flex-1 space-y-6 overflow-auto pr-2 max-h-[60vh] lg:max-h-none">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    Recently used
                  </span>
                  <button className="text-zinc-400 hover:text-zinc-600">
                    View all
                  </button>
                </div>
                {recentVoiceDetails.length === 0 ? (
                  <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-400">
                    Generate speech to build your recent list.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recentVoiceDetails.map((voice) => (
                      <li key={voice.name}>
                        <button
                          onClick={() => setSelectedVoice(voice.name)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                            selectedVoice === voice.name
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-transparent bg-zinc-50 text-zinc-700 hover:border-zinc-200"
                          }`}
                        >
                          <div>
                            <p>{formatVoiceLabel(voice)}</p>
                            <p className="text-xs text-zinc-400">{voice.language}</p>
                          </div>
                          <span className="text-xs text-zinc-300">▶</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    All voices
                  </span>
                  <span>{loadingVoices ? "Loading..." : "View all"}</span>
                </div>
                {fetchError && (
                  <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {fetchError}
                  </p>
                )}
                <ul className="space-y-2">
                  {filteredVoices.map((voice) => (
                    <li key={voice.name}>
                      <button
                        onClick={() => setSelectedVoice(voice.name)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedVoice === voice.name
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-100 bg-white hover:border-zinc-300"
                        }`}
                      >
                        <div>
                          <p className="font-semibold">
                            {formatVoiceLabel(voice)}
                          </p>
                          <p className="text-xs text-zinc-400">{voice.language}</p>
                        </div>
                        <span className="text-xs text-zinc-300">▶</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
