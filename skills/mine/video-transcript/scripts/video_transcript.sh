#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  printf '%s\n' \
    "Usage: video_transcript.sh [options] <video-url>" \
    "" \
    "Options:" \
    "  --output-dir DIR              Output directory (default: ./video-transcript-output)" \
    "  --lang LANG                   Exact subtitle language key (default: auto)" \
    "  --asr-language LANG           Whisper language code (default: auto)" \
    "  --cookies-from-browser NAME   Browser for yt-dlp cookies (default: chrome)" \
    "  --no-cookies                  Do not read browser cookies" \
    "  --engine auto|whisper|qwen    Local ASR engine (default: auto)" \
    "  --whisper-model FILE          whisper.cpp GGML model" \
    "  --qwen-model-dir DIR          Qwen3-ASR GGUF directory" \
    "  --model-dir DIR               Alias for --qwen-model-dir" \
    "  --chunk-seconds N             ASR chunk length (default: 60)" \
    "  --force-asr                   Skip discovered captions and test local ASR" \
    "  -h, --help                    Show this help"
}

output_dir="$PWD/video-transcript-output"
requested_lang="auto"
asr_language="${ASR_LANGUAGE:-auto}"
cookies_browser="${VIDEO_TRANSCRIPT_COOKIES_BROWSER:-chrome}"
cookies_explicit=0
asr_engine="${VIDEO_TRANSCRIPT_ENGINE:-auto}"
whisper_model="${WHISPER_MODEL:-$HOME/models/ggml-large-v3-turbo.bin}"
qwen_model_dir="${QWEN_ASR_MODEL_DIR:-}"
chunk_seconds=60
force_asr=0
url=""

while (($#)); do
  case "$1" in
    --output-dir)
      output_dir=${2:?"--output-dir requires a directory"}
      shift 2
      ;;
    --lang)
      requested_lang=${2:?"--lang requires a language key"}
      shift 2
      ;;
    --asr-language)
      asr_language=${2:?"--asr-language requires a language code"}
      shift 2
      ;;
    --cookies-from-browser)
      cookies_browser=${2:?"--cookies-from-browser requires a browser name"}
      cookies_explicit=1
      shift 2
      ;;
    --no-cookies)
      cookies_browser=""
      cookies_explicit=1
      shift
      ;;
    --engine)
      asr_engine=${2:?"--engine requires auto, whisper, or qwen"}
      shift 2
      ;;
    --whisper-model)
      whisper_model=${2:?"--whisper-model requires a file"}
      shift 2
      ;;
    --qwen-model-dir|--model-dir)
      qwen_model_dir=${2:?"$1 requires a directory"}
      shift 2
      ;;
    --chunk-seconds)
      chunk_seconds=${2:?"--chunk-seconds requires an integer"}
      shift 2
      ;;
    --force-asr)
      force_asr=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$url" ]]; then
        printf 'Only one video URL is supported per run.\n' >&2
        exit 2
      fi
      url=$1
      shift
      ;;
  esac
done

if [[ -z "$url" ]]; then
  usage >&2
  exit 2
fi
if ! [[ "$chunk_seconds" =~ ^[1-9][0-9]*$ ]]; then
  printf 'Chunk length must be a positive integer.\n' >&2
  exit 2
fi
case "$asr_engine" in
  auto|whisper|qwen) ;;
  *)
    printf 'ASR engine must be auto, whisper, or qwen.\n' >&2
    exit 2
    ;;
esac

for command_name in yt-dlp jq ffmpeg ffprobe; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

mkdir -p "$output_dir"
output_dir=$(cd "$output_dir" && pwd)
work_dir="$output_dir/work"
mkdir -p "$work_dir"

ytdlp=(yt-dlp --no-playlist)
if [[ -n "$cookies_browser" ]]; then
  ytdlp+=(--cookies-from-browser "$cookies_browser")
fi

youtube_transcript_file="$output_dir/youtube-transcript.txt"

# YouTube caption fallback for when yt-dlp routes fail: the bundled helper
# requests YouTube's caption track (manual or auto-generated) directly.
run_youtube_helper() {
  case "$url" in
    *youtube.com/*|*youtu.be/*) ;;
    *) return 1 ;;
  esac
  local youtube_script="$script_dir/youtube/transcript.js"
  [[ -f "$youtube_script" ]] || return 1
  command -v node >/dev/null 2>&1 || return 1
  node "$youtube_script" "$url" >"$youtube_transcript_file" 2>"$work_dir/youtube-transcript.log" || return 1
  [[ -s "$youtube_transcript_file" ]]
}

info_json="$work_dir/info.json"
if ! "${ytdlp[@]}" --skip-download --write-subs --write-auto-subs --dump-single-json "$url" >"$info_json" 2>"$work_dir/yt-dlp-metadata.log"; then
  if ((cookies_explicit == 0)) && [[ -n "$cookies_browser" ]]; then
    printf 'Default %s cookie access failed; retrying without browser cookies.\n' "$cookies_browser" >&2
    ytdlp=(yt-dlp --no-playlist)
    "${ytdlp[@]}" --skip-download --write-subs --write-auto-subs --dump-single-json "$url" >"$info_json" 2>"$work_dir/yt-dlp-metadata.log" || true
  fi
fi
if [[ ! -s "$info_json" ]] || ! jq -e . "$info_json" >/dev/null 2>&1; then
  if run_youtube_helper; then
    printf 'TRANSCRIPT_SOURCE=youtube-transcript\nTRANSCRIPT_FILE=%s\n' "$youtube_transcript_file"
    exit 0
  fi
  printf 'yt-dlp could not read the video. See %s\n' "$work_dir/yt-dlp-metadata.log" >&2
  exit 1
fi

video_id=$(jq -r '.id // "video"' "$info_json")
title=$(jq -r '.title // ""' "$info_json")
duration=$(jq -r '.duration // empty' "$info_json")

caption_choice=$(jq -r --arg requested "$requested_lang" '
  (.language // "") as $source_language |
  def available($object): (($object // {}) | keys | map(select(. != "live_chat" and . != "danmaku")));
  def choose($object):
    ($object // {}) as $captions |
    if $requested != "auto" then
      if $requested != "danmaku" and $captions[$requested] != null then $requested else "" end
    else
      ([$source_language, "en", "en-US", "en-GB", "zh-Hans", "zh-CN", "zh", "zh-Hant"]
       + available($captions))
      | map(select(. != null and . != "" and $captions[.] != null))
      | .[0] // ""
    end;
  (choose(.subtitles)) as $manual |
  if $manual != "" then ["manual", $manual]
  else (choose(.automatic_captions)) as $automatic |
    if $automatic != "" then ["automatic", $automatic] else empty end
  end | @tsv
' "$info_json")

if ((force_asr == 0)) && [[ -n "$caption_choice" ]]; then
  caption_kind=${caption_choice%%$'\t'*}
  caption_lang=${caption_choice#*$'\t'}
  source_kind=$caption_kind
  if [[ "$caption_lang" == ai-* ]]; then
    source_kind=ai
  fi
  caption_args=(--skip-download --sub-langs "$caption_lang" --sub-format 'vtt/srt/best')
  if [[ "$caption_kind" == "manual" ]]; then
    caption_args+=(--write-subs)
  else
    caption_args+=(--write-auto-subs)
  fi
  if "${ytdlp[@]}" "${caption_args[@]}" -o "$output_dir/${video_id}.%(ext)s" "$url" \
      >"$work_dir/yt-dlp-caption.log" 2>&1; then
    caption_files=()
    while IFS= read -r caption_file; do
      caption_files+=("$caption_file")
    done < <(find "$output_dir" -maxdepth 1 -type f -size +0c \
      \( -name "${video_id}.${caption_lang}.*" -o -name "${video_id}.*.${caption_lang}.*" \) | sort)
    if ((${#caption_files[@]})); then
      for caption_file in "${caption_files[@]}"; do
        if [[ "${caption_file##*.}" != "srt" ]]; then
          converted_caption="${caption_file%.*}.srt"
          ffmpeg -hide_banner -loglevel error -y -i "$caption_file" "$converted_caption"
        fi
      done
      caption_files=()
      while IFS= read -r caption_file; do
        caption_files+=("$caption_file")
      done < <(find "$output_dir" -maxdepth 1 -type f -size +0c \
        \( -name "${video_id}.${caption_lang}.*" -o -name "${video_id}.*.${caption_lang}.*" \) | sort)
      printf 'TRANSCRIPT_SOURCE=yt-dlp-%s-caption\n' "$source_kind"
      printf 'TITLE=%s\nLANGUAGE=%s\nDURATION=%s\n' "$title" "$caption_lang" "$duration"
      printf 'TRANSCRIPT_FILE=%s\n' "${caption_files[@]}"
      exit 0
    fi
  fi
fi

if ((force_asr == 0)) && run_youtube_helper; then
  printf 'TRANSCRIPT_SOURCE=youtube-transcript\nTITLE=%s\nDURATION=%s\nTRANSCRIPT_FILE=%s\n' \
    "$title" "$duration" "$youtube_transcript_file"
  exit 0
fi

audio_template="$work_dir/source.%(ext)s"
"${ytdlp[@]}" -f 'bestaudio/best' -x --audio-format wav --audio-quality 0 \
  -o "$audio_template" "$url" >"$work_dir/yt-dlp-audio.log" 2>&1
downloaded_audio=$(find "$work_dir" -maxdepth 1 -type f -name 'source.wav' -size +0c | head -n 1)
if [[ -z "$downloaded_audio" ]]; then
  printf 'Audio extraction did not produce a WAV file. See %s\n' "$work_dir/yt-dlp-audio.log" >&2
  exit 1
fi
audio_file="$work_dir/source-16k-mono.wav"
ffmpeg -hide_banner -loglevel error -y -i "$downloaded_audio" \
  -ar 16000 -ac 1 -c:a pcm_s16le "$audio_file"

if [[ "$asr_engine" == "auto" || "$asr_engine" == "whisper" ]]; then
  whisper_ready=1
  if ! command -v whisper-cpp >/dev/null 2>&1; then
    whisper_ready=0
    printf 'whisper-cpp is not installed.\n' >&2
  elif [[ ! -s "$whisper_model" ]]; then
    whisper_ready=0
    printf 'Whisper model not found: %s\n' "$whisper_model" >&2
  fi

  if ((whisper_ready)); then
    whisper_model_name=$(basename "$whisper_model" .bin)
    whisper_prefix="$output_dir/${video_id}-${whisper_model_name}"
    whisper_resources="${GGML_METAL_PATH_RESOURCES:-}"
    if [[ -z "$whisper_resources" ]] && command -v brew >/dev/null 2>&1; then
      whisper_prefix_dir=$(brew --prefix whisper-cpp 2>/dev/null || true)
      if [[ -f "$whisper_prefix_dir/share/whisper-cpp/ggml-metal.metal" ]]; then
        whisper_resources="$whisper_prefix_dir/share/whisper-cpp"
      fi
    fi

    whisper_command=(whisper-cpp -m "$whisper_model" -f "$audio_file" -l "$asr_language"
      -osrt -otxt -oj -of "$whisper_prefix")
    if [[ -n "$whisper_resources" ]]; then
      whisper_command=(env GGML_METAL_PATH_RESOURCES="$whisper_resources" "${whisper_command[@]}")
    fi

    if "${whisper_command[@]}" >"$work_dir/whisper.stdout.log" 2>"$work_dir/whisper.stderr.log" \
        && [[ -s "$whisper_prefix.txt" && -s "$whisper_prefix.srt" ]]; then
      printf 'TRANSCRIPT_SOURCE=whisper.cpp\nTITLE=%s\nDURATION=%s\nMODEL=%s\n' \
        "$title" "$duration" "$whisper_model"
      printf 'LANGUAGE=%s\nTIMING=whisper-segment-timestamps\n' "$asr_language"
      printf 'TRANSCRIPT_FILE=%s\nTRANSCRIPT_FILE=%s\nTRANSCRIPT_FILE=%s\n' \
        "$whisper_prefix.txt" "$whisper_prefix.srt" "$whisper_prefix.json"
      exit 0
    fi
    printf 'Whisper transcription failed; inspect %s.\n' "$work_dir/whisper.stderr.log" >&2
  fi

  if [[ "$asr_engine" == "whisper" ]]; then
    exit 1
  fi
  printf 'Falling back to Qwen3-ASR.\n' >&2
fi

if ! command -v llama-mtmd-cli >/dev/null 2>&1; then
  printf 'Qwen fallback requires llama-mtmd-cli.\n' >&2
  exit 1
fi

if [[ -z "$qwen_model_dir" ]]; then
  for candidate in \
    "$HOME/models/Qwen3-ASR-0.6B-GGUF" \
    "$HOME/models/Qwen3-ASR-1.7B-GGUF"; do
    if [[ -d "$candidate" ]]; then
      qwen_model_dir=$candidate
      break
    fi
  done
fi
if [[ -z "$qwen_model_dir" ]]; then
  while IFS= read -r candidate; do
    qwen_model_dir=$candidate
    break
  done < <(find "$HOME/models" -maxdepth 1 -type d -iname '*qwen*asr*gguf*' 2>/dev/null | sort)
fi
if [[ -z "$qwen_model_dir" || ! -d "$qwen_model_dir" ]]; then
  printf 'No Qwen3-ASR GGUF model directory was found under %s/models.\n' "$HOME" >&2
  exit 1
fi

model_file=$(find "$qwen_model_dir" -maxdepth 1 -type f -iname '*.gguf' ! -iname 'mmproj*' | sort | head -n 1)
mmproj_file=$(find "$qwen_model_dir" -maxdepth 1 -type f -iname 'mmproj*.gguf' | sort | head -n 1)
if [[ -z "$model_file" || -z "$mmproj_file" ]]; then
  printf 'Expected one Qwen3-ASR model GGUF and one mmproj GGUF in %s.\n' "$qwen_model_dir" >&2
  exit 1
fi

chunk_dir="$work_dir/chunks"
raw_dir="$work_dir/raw"
mkdir -p "$chunk_dir" "$raw_dir"
ffmpeg -hide_banner -loglevel error -y -i "$audio_file" -ar 16000 -ac 1 -c:a pcm_s16le \
  -f segment -segment_time "$chunk_seconds" -reset_timestamps 1 "$chunk_dir/%04d.wav"

plain_output="$output_dir/${video_id}-qwen3-asr.txt"
srt_output="$output_dir/${video_id}-qwen3-asr.srt"
: >"$plain_output"
: >"$srt_output"

asr_prompt='请逐字转写这段音频，保留原始口语语言。只输出转写文本，不要翻译，不要解释。'
failed_chunks=0

format_srt_time() {
  local total_ms=$1
  local hours minutes seconds millis
  hours=$((total_ms / 3600000))
  minutes=$(((total_ms % 3600000) / 60000))
  seconds=$(((total_ms % 60000) / 1000))
  millis=$((total_ms % 1000))
  printf '%02d:%02d:%02d,%03d' "$hours" "$minutes" "$seconds" "$millis"
}

for chunk in "$chunk_dir"/*.wav; do
  chunk_name=$(basename "$chunk" .wav)
  chunk_number=$((10#$chunk_name))
  raw_output="$raw_dir/$chunk_name.full.txt"
  clean_output="$raw_dir/$chunk_name.txt"
  log_output="$raw_dir/$chunk_name.log"

  if ! llama-mtmd-cli -c 4096 -m "$model_file" --mmproj "$mmproj_file" \
      --audio "$chunk" --jinja -p "$asr_prompt" -n 2048 --no-warmup \
      >"$raw_output" 2>"$log_output"; then
    : >"$clean_output"
  else
    ASR_PROMPT="$asr_prompt" perl -0777 -pe '
      s/\A.*?<asr_text>//s;
      s#</asr_text>.*\z##s;
      s/\Q$ENV{ASR_PROMPT}\E//g;
      s/^\s+|\s+$//g;
    ' "$raw_output" >"$clean_output"
  fi

  if [[ ! -s "$clean_output" ]]; then
    failed_chunks=$((failed_chunks + 1))
    transcript_text="[No usable transcription for this chunk]"
  else
    transcript_text=$(<"$clean_output")
  fi

  chunk_duration=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$chunk")
  chunk_duration_ms=$(awk -v seconds="$chunk_duration" 'BEGIN { printf "%d", (seconds * 1000) + 0.5 }')
  start_ms=$((chunk_number * chunk_seconds * 1000))
  end_ms=$((start_ms + chunk_duration_ms))

  printf '%s\n\n' "$transcript_text" >>"$plain_output"
  printf '%d\n%s --> %s\n%s\n\n' \
    "$((chunk_number + 1))" "$(format_srt_time "$start_ms")" "$(format_srt_time "$end_ms")" \
    "$transcript_text" >>"$srt_output"
done

if ((failed_chunks)); then
  printf 'Local ASR completed with %d failed or empty chunk(s). Inspect %s.\n' "$failed_chunks" "$raw_dir" >&2
  exit 1
fi

printf 'TRANSCRIPT_SOURCE=qwen3-asr-llama.cpp\nTITLE=%s\nDURATION=%s\nMODEL=%s\n' \
  "$title" "$duration" "$model_file"
printf 'TIMING=coarse-%s-second-chunks\nTRANSCRIPT_FILE=%s\nTRANSCRIPT_FILE=%s\n' \
  "$chunk_seconds" "$plain_output" "$srt_output"
