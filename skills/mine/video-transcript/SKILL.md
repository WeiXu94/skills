---
name: video-transcript
description: Obtain complete transcripts or subtitle files from public video URLs. Use for YouTube, X, Bilibili, and other yt-dlp-supported videos when the user asks for captions, transcription, subtitles, or a transcript-backed summary; prefer source captions and use local ASR only when captions are unavailable.
---

# Video Transcript

Get the best available transcript before summarizing the video. Treat webpage captions, embedded media streams, and locally generated ASR as different sources.

## Workflow

1. For Bilibili, check subtitles with the browser login state first: `yt-dlp --cookies-from-browser chrome --list-subs URL`. An unauthenticated result that lists only `danmaku` does not mean AI subtitles are absent. The helper script uses Chrome cookies by default; use `--no-cookies` when browser-session access is unwanted.
2. For YouTube, take yt-dlp captions first; when yt-dlp cannot read the video or finds no usable caption, fall back to the bundled `scripts/youtube/transcript.js` helper (see below).
3. For every yt-dlp-supported URL, inspect both manual subtitles and automatic captions with `yt-dlp --list-subs`. Web players may expose a separate VTT/HLS caption even when the MP4 contains no subtitle stream.
4. Prefer a requested language, then a manual caption in the spoken language, then an automatic caption. Download the source caption and retain its original VTT/SRT alongside any converted copy.
5. Verify the saved transcript before calling it complete: require a successful command, a nonempty file, timestamps spanning the beginning through the end of the spoken content, and opening/middle/ending samples that form a continuous account.
6. Only when neither caption route yields usable text, download the best audio. Use multilingual Whisper `large-v3-turbo` through `whisper.cpp` as the default long-form engine: give it the whole WAV and retain its native segment timestamps, TXT, and SRT.
7. Use Qwen3-ASR as a deliberate second pass for difficult Chinese, dialects, accents, code-switching, or clearly poor Whisper output. Keep audio local unless the user explicitly authorizes an upload.

Use the deterministic helper for the full discovery and fallback pipeline:

```bash
{baseDir}/scripts/video_transcript.sh --output-dir <directory> '<video-url>'
```

Useful options:

```bash
--lang en                         # exact caption language key
--asr-language zh                 # Whisper language; default auto
--cookies-from-browser firefox    # override the default Chrome browser
--no-cookies                      # skip browser-session access
--engine auto                     # auto, whisper, or qwen
--whisper-model ~/models/ggml-large-v3-turbo.bin
--qwen-model-dir ~/models/Qwen3-ASR-0.6B-GGUF
--chunk-seconds 60
--force-asr                       # diagnostic testing; normally omit
```

## YouTube helper

`scripts/youtube/transcript.js` fetches YouTube's caption track — manual or auto-generated — and prints `[m:ss] text` lines. It accepts a video ID or full URL:

```bash
{baseDir}/scripts/youtube/transcript.js EBw7gsDPAYQ
```

On a fresh clone, run `npm install` once inside `scripts/youtube` (`node_modules` is not committed). The pipeline invokes it only as a fallback after yt-dlp captions fail; without Node or that install, the pipeline goes straight to local ASR.

## ASR routing

The normal local path is `~/models/ggml-large-v3-turbo.bin` with `whisper-cpp`. The checkpoint is multilingual; unlike `small.en`, it supports Chinese. `whisper.cpp` accepts the complete audio in one command, performs its internal windows automatically, and emits substantially finer timestamps than fixed external chunks.

The Qwen path uses `llama-mtmd-cli` with a Qwen3-ASR GGUF main model and matching `mmproj`, not PyTorch. It searches `~/models/Qwen3-ASR-0.6B-GGUF` first, then other `Qwen*ASR*GGUF` directories. The 0.6B Q8 model was more usable than 1.7B Q8 under the current experimental llama.cpp audio path; this is runtime-specific, not a general model ranking. Select 1.7B explicitly when comparing recognition quality.

Qwen audio is converted to 16 kHz mono WAV and divided into fixed chunks. Its SRT times are chunk boundaries, not forced word alignment. Inspect for prompt echo, unrelated text, and repetition; cleanup may remove echoed wrappers but cannot repair recognition errors. Report these limits whenever Qwen is used.

## Completion report

State which source won (`youtube-transcript`, yt-dlp manual/automatic caption, Whisper, or Qwen3-ASR), the language and format, verified coverage, output paths, and any accuracy or timing limits. Base a summary on the complete verified transcript and distinguish the speaker's claims from independently verified facts.
