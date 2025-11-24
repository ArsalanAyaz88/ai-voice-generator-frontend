"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

type Voice = {
  name: string;
  language: string;
};

type AudioPart = {
  id: number;
  url: string;
  label: string;
};



const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://arsalan-joiya-ai-voice-generator-backend.hf.space";
const CHARS_PER_PART = 1_500;

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

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n${para}` : para;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
        current = "";
      }

      if (para.length <= maxChars) {
        current = para;
      } else {
        for (let i = 0; i < para.length; i += maxChars) {
          chunks.push(para.slice(i, i + maxChars));
        }
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [search, setSearch] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [audioParts, setAudioParts] = useState<AudioPart[]>([]);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [recentVoices, setRecentVoices] = useState<string[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const isDark = theme === "dark";
  const baseTextClass = isDark ? "text-white" : "text-black";
  const mutedTextClass = isDark ? "text-white/70" : "text-black/60";

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

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const primaryPanelClass = `flex w-full flex-col rounded-[32px] p-4 shadow-sm sm:p-6 lg:overflow-hidden ${
    isDark ? "bg-zinc-800 shadow-none" : "bg-white text-black"
  } ${baseTextClass} lg:flex-[2]`;

  const audioPanelClass = `flex w-full flex-col rounded-[32px] p-4 shadow-sm sm:p-6 lg:overflow-hidden ${
    isDark ? "bg-zinc-800 shadow-none" : "bg-white"
  } ${baseTextClass} lg:flex-[1]`;

  const secondaryPanelClass = `flex w-full flex-col rounded-[32px] p-4 shadow-sm sm:p-6 lg:overflow-hidden ${
    isDark ? "bg-zinc-800 shadow-none" : "bg-white"
  } ${baseTextClass} lg:flex-[1]`;

  const handleGenerate = async () => {
    if (!text.trim()) {
      setSynthError("Please enter some text to synthesize");
      return;
    }
    if (!selectedVoice) {
      setSynthError("Please select a voice");
      return;
    }

    const trimmedText = text.trim();
    const chunks = splitTextIntoChunks(trimmedText, CHARS_PER_PART);

    if (chunks.length === 0) {
      setSynthError("Please enter some text to synthesize");
      return;
    }

    setAudioParts((prev) => {
      prev.forEach((part) => URL.revokeObjectURL(part.url));
      return [];
    });

    setSynthError(null);
    setIsSynthesizing(true);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        if (controller.signal.aborted) {
          throw new Error("Generation stopped by user");
        }
        
        const partText = chunks[index];

        const response = await fetch(`${API_BASE_URL}/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: partText,
            voice: selectedVoice,
            speed,
            device: "cpu",
            return_phonemes: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(
            detail
              ? `Part ${index + 1}: ${detail}`
              : `Failed to synthesize speech for part ${index + 1}`
          );
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        setAudioParts((prev) => [
          ...prev,
          {
            id: Date.now() + index,
            url,
            label: `Part ${index + 1}`,
          },
        ]);
      }

      setRecentVoices((prev) => {
        const updated = [selectedVoice, ...prev.filter((v) => v !== selectedVoice)];
        return updated.slice(0, 5);
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setSynthError("Audio generation stopped");
      } else {
        setSynthError(
          error instanceof Error ? error.message : "Unable to generate speech"
        );
      }
    } finally {
      setIsSynthesizing(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const handleDownloadAll = async () => {
    if (audioParts.length === 0) return;

    const zip = new JSZip();

    await Promise.all(
      audioParts.map(async (part, index) => {
        const response = await fetch(part.url);
        const blob = await response.blob();
        zip.file(`voice-part-${index + 1}.wav`, blob);
      })
    );

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `voice-parts-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-zinc-900" : "bg-zinc-100"
      } ${baseTextClass}`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 transition-colors sm:px-6 ${
          isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="min-w-[200px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
            Creative Platform
          </p>
          <h1 className="text-lg font-semibold">
            AI Voice Studio
          </h1>
        </div>
        <button
          onClick={toggleTheme}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            isDark
              ? "bg-zinc-800 text-white ring-1 ring-zinc-700"
              : "bg-white text-black ring-1 ring-zinc-200"
          }`}
        >
          {isDark ? "Switch to Light" : "Switch to Dark"}
        </button>
      </header>

      <div className="mx-auto flex w-full flex-col gap-6 px-4 py-6 lg:h-[calc(100vh-88px)] lg:flex-row lg:overflow-hidden lg:px-8">
        <main className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:overflow-hidden">
          <section className={primaryPanelClass}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                  Playground
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Text to Speech
                </h2>
              </div>
            </div>

            <div className="mt-6 flex-1 overflow-hidden">
              <div
                className={`flex h-full min-h-[220px] flex-col rounded-3xl border p-3 transition focus-within:border-zinc-200 sm:p-4 ${
                  isDark ? "border-zinc-700 bg-zinc-900" : "border-transparent bg-zinc-50"
                }`}
              >
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={isSynthesizing}
                  className={`h-full w-full flex-1 resize-none overflow-auto bg-transparent text-base leading-7 outline-none sm:text-lg ${baseTextClass} ${
                    isDark ? "placeholder:text-white/40" : "placeholder:text-black/40"
                  } ${isSynthesizing ? "cursor-not-allowed opacity-60" : ""}`}
                  placeholder="Type or paste the content you want to narrate..."
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm sm:gap-6">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${mutedTextClass}`}>
                  Speed
                </p>
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
                    disabled={isSynthesizing}
                    className={`w-40 ${
                      isDark ? "accent-amber-400" : "accent-zinc-900"
                    } ${isSynthesizing ? "opacity-40 cursor-not-allowed" : ""}`}
                  />
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      isDark
                        ? "bg-white/10 text-white"
                        : "bg-zinc-100 text-black"
                    }`}
                  >
                    {speed.toFixed(1)}x
                  </span>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <div className="flex items-baseline gap-2">
                  <p className={`text-xs uppercase tracking-[0.2em] ${mutedTextClass}`}>
                    Characters
                  </p>
                  <p className="text-sm font-semibold">{text.length}</p>
                </div>
                <p className={`mt-1 text-xs ${mutedTextClass}`}>
                  Unlimited text support. Long text is automatically split into multiple audio parts.
                </p>
              </div>
              <div className="ml-auto flex w-full justify-end gap-2 sm:w-auto sm:gap-3">
                <button
                  onClick={() => setText("")}
                  disabled={isSynthesizing}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition sm:px-5 ${
                    isDark
                      ? "border-white/30 text-white hover:border-white/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      : "border-zinc-200 text-black hover:border-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  Clear
                </button>
                {isSynthesizing ? (
                  <button
                    onClick={handleStop}
                    className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition sm:px-6 ${
                      isDark ? "bg-red-600 hover:bg-red-700" : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={isSynthesizing}
                    className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60 sm:px-6 ${
                      isDark ? "bg-amber-500 hover:bg-amber-600" : "bg-zinc-900 hover:bg-black"
                    }`}
                  >
                    Generate
                  </button>
                )}
              </div>
            </div>

            {synthError && (
              <p
                className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                  isDark
                    ? "bg-rose-950/40 text-rose-200"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {synthError}
              </p>
            )}
          </section>
          {audioParts.length > 0 && (
            <section className={audioPanelClass}>
              <div
                className={`flex h-full flex-col rounded-3xl p-4 ${
                  isDark ? "bg-zinc-900" : "bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`font-semibold ${baseTextClass}`}>
                    Generated Parts
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    className={`rounded-full border px-4 py-1 text-xs font-semibold transition ${
                      isDark
                        ? "border-white/30 text-white hover:border-white/60"
                        : "border-zinc-200 text-black hover:border-zinc-300"
                    }`}
                  >
                    Download all
                  </button>
                </div>
                <ul className="mt-3 flex-1 space-y-3 overflow-auto pr-1">
                  {audioParts.map((part, index) => (
                    <li
                      key={part.id}
                      className={`rounded-2xl border p-3 ${
                        isDark
                          ? "border-zinc-700 bg-zinc-900"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={`font-semibold ${baseTextClass}`}>
                          Part {index + 1}
                        </span>
                        <a
                          href={part.url}
                          download={`voice-part-${index + 1}.wav`}
                          className={`rounded-full border px-4 py-1 text-xs font-semibold transition ${
                            isDark
                              ? "border-white/30 text-white hover:border-white/60"
                              : "border-zinc-200 text-black hover:border-zinc-300"
                          }`}
                        >
                          Download
                        </a>
                      </div>
                      <audio className="mt-2 w-full" controls src={part.url} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className={secondaryPanelClass}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${mutedTextClass}`}>
                  Select a voice
                </p>
                <h3 className="text-lg font-semibold">
                  All saved voices
                </h3>
              </div>
              <span className={`text-xs ${mutedTextClass}`}>
                {filteredVoices.length} voices
              </span>
            </div>

            <div
              className={`mt-4 rounded-2xl border px-4 py-2 ${
                isDark ? "border-zinc-700 bg-zinc-800" : "border-zinc-100 bg-zinc-50"
              }`}
            >
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search voices..."
                className={`w-full rounded-2xl bg-transparent text-sm outline-none ${
                  isDark ? "placeholder:text-white/40" : "placeholder:text-black/50"
                }`}
              />
            </div>

            <div className="mt-4 flex-1 space-y-6 overflow-auto pr-2 max-h-[60vh] lg:max-h-none">
              <div>
                <div
                  className={`mb-2 flex items-center justify-between text-xs ${mutedTextClass}`}
                >
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    Recently used
                  </span>
                  <button className={`transition ${mutedTextClass} hover:opacity-70`}>
                    View all
                  </button>
                </div>
                {recentVoiceDetails.length === 0 ? (
                  <p
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      isDark
                        ? "bg-white/10"
                        : "bg-zinc-50 text-black"
                    }`}
                  >
                    Generate speech to build your recent list.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recentVoiceDetails.map((voice) => (
                      <li key={voice.name}>
                        <button
                          onClick={() => setSelectedVoice(voice.name)}
                          disabled={isSynthesizing}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                            selectedVoice === voice.name
                              ? "border-amber-500 bg-amber-500 text-black"
                              : isDark
                              ? "border-white/20 bg-white/5 text-white hover:border-white/40"
                              : "border-transparent bg-zinc-50 text-black hover:border-zinc-200"
                          } ${isSynthesizing ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          <div>
                            <p>{formatVoiceLabel(voice)}</p>
                            <p className={`text-xs ${mutedTextClass}`}>{voice.language}</p>
                          </div>
                          <span className={`text-xs ${mutedTextClass}`}>▶</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div
                  className={`mb-2 flex items-center justify-between text-xs ${mutedTextClass}`}
                >
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    All voices
                  </span>
                  <span>{loadingVoices ? "Loading..." : "View all"}</span>
                </div>
                {fetchError && (
                  <p
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      isDark
                        ? "bg-rose-950/40 text-rose-200"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {fetchError}
                  </p>
                )}
                <ul className="space-y-2">
                  {filteredVoices.map((voice) => (
                    <li key={voice.name}>
                      <button
                        onClick={() => setSelectedVoice(voice.name)}
                        disabled={isSynthesizing}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedVoice === voice.name
                            ? "border-amber-500 bg-amber-500 text-black"
                            : isDark
                            ? "border-white/20 bg-white/5 text-white hover:border-white/40"
                            : "border-zinc-100 bg-white text-black hover:border-zinc-300"
                        } ${isSynthesizing ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <div>
                          <p className="font-semibold">
                            {formatVoiceLabel(voice)}
                          </p>
                          <p className={`text-xs ${mutedTextClass}`}>{voice.language}</p>
                        </div>
                        <span className={`text-xs ${mutedTextClass}`}>▶</span>
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
