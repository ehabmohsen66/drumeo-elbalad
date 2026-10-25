#!/usr/bin/env python3
# ============================================================================
# DRUMEO AL-BALAD — Backend Server & Live Songsterr Drum + Guitar Riff Engine
# Serves the web app on port 3030 + fetches & converts ANY song's real drum tab
# AND extracts its real Guitar/Bass Riff MIDI notes so you recognize the song!
# ============================================================================

import gzip
import html as html_lib
import http.server
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

PORT = 3030
BASE_DIR = Path(__file__).resolve().parent


def _load_seo_catalog():
    lessons = {}
    weeks = {}
    try:
        raw = (BASE_DIR / "curriculumData.js").read_text("utf-8")
        cur_block = raw.split("const CURRICULUM_LESSONS = [")[1].split("const THREE_MONTH_PLAN = [")[0]
        for m in re.finditer(
            r"id:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)'[\s\S]*?band:\s*'([^']+)'[\s\S]*?title:\s*['\"]([^'\"]+)['\"][\s\S]*?startBpm:\s*(\d+),\s*targetBpm:\s*(\d+)",
            cur_block,
        ):
            lid, cat, band, title, sbpm, tbpm = m.groups()
            clean_band = re.sub(r"^[^\w\u0600-\u06FF]+", "", band).strip()
            clean_title = re.sub(r"\s*[—–]\s*", ": ", title).strip()
            lessons[lid] = {
                "id": lid,
                "category": cat,
                "band": clean_band,
                "rawBand": band,
                "title": clean_title,
                "startBpm": sbpm,
                "targetBpm": tbpm,
            }
        plan_block = raw.split("const THREE_MONTH_PLAN = [")[1].split("const FILL_GENERATOR_OPTIONS")[0]
        for m in re.finditer(
            r"month:\s*(\d+)[\s\S]*?week:\s*(\d+),\s*title:\s*['\"]([^'\"]+)['\"][\s\S]*?goal:\s*['\"]([^'\"]+)['\"][\s\S]*?bpmRange:\s*['\"]([^'\"]+)['\"]",
            plan_block,
        ):
            mo, wk, title, goal, bpm_range = m.groups()
            weeks[wk] = {
                "week": wk,
                "month": mo,
                "title": re.sub(r"\s*[—–]\s*", ": ", title).strip(),
                "bpmRange": re.sub(r"\s*[—–]\s*", " to ", bpm_range).strip(),
                "goal": re.sub(r"\s*[—–]\s*", ": ", goal).strip(),
            }
    except Exception:
        pass
    return lessons, weeks


SEO_LESSONS, SEO_WEEKS = _load_seo_catalog()
STATIC_CACHE_DIR = BASE_DIR / "song_cache"
try:
    CACHE_DIR = BASE_DIR / ".song_cache"
    CACHE_DIR.mkdir(exist_ok=True)
    SAMPLE_CACHE_DIR = BASE_DIR / ".sample_cache"
    SAMPLE_CACHE_DIR.mkdir(exist_ok=True)
except OSError:
    CACHE_DIR = Path("/tmp/.song_cache")
    CACHE_DIR.mkdir(exist_ok=True)
    SAMPLE_CACHE_DIR = Path("/tmp/.sample_cache")
    SAMPLE_CACHE_DIR.mkdir(exist_ok=True)
ALLOWED_SAMPLE_INSTRUMENTS = {
    "distortion_guitar",
    "overdriven_guitar",
    "electric_guitar_clean",
    "electric_bass_pick",
    "acoustic_grand_piano",
}

# General MIDI Drum Fret -> 5-Piece Single-Kick Kit Symbol Mapping
FRET_MAP = {
    35: "B",   # Acoustic Bass Drum
    36: "B",   # Bass Drum 1
    37: "S",   # Side Stick
    38: "S",   # Acoustic Snare
    40: "S",   # Electric Snare
    42: "X",   # Closed Hi-Hat
    44: "X",   # Pedal Hi-Hat
    46: "O",   # Open Hi-Hat
    49: "C",   # Crash Cymbal 1
    57: "C",   # Crash Cymbal 2
    52: "C",   # Chinese Cymbal
    55: "C",   # Splash Cymbal
    51: "X",   # Ride Cymbal 1 -> Mapped to Hi-Hat (X) for 5-Piece Kit without Ride
    53: "X",   # Ride Bell -> Mapped to Hi-Hat (X)
    59: "X",   # Ride Cymbal 2 -> Mapped to Hi-Hat (X)
    48: "T1",  # Hi-Mid Tom (High Tom 1)
    50: "T1",  # High Tom
    45: "T2",  # Low Tom (Mid Tom 2)
    47: "T2",  # Low-Mid Tom
    41: "FT",  # Low Floor Tom
    43: "FT",  # High Floor Tom
}

SYMBOL_ORDER = ["C", "X", "O", "S", "g", "T1", "T2", "FT", "B"]
DEFAULT_GUITAR_TUNING = [64, 59, 55, 50, 45, 40]


def http_get_json(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        },
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        raw = resp.read()
        if resp.info().get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8", errors="ignore"))


def measure_to_16_tokens(m):
    steps = [set() for _ in range(16)]
    voices = m.get("voices", [])
    if not voices:
        return ["-"] * 16

    for v in voices:
        pos = 0.0
        for bt in v.get("beats", []):
            dur_arr = bt.get("duration", [1, 4])
            dur = (dur_arr[0] / dur_arr[1]) if dur_arr and dur_arr[1] else 0.25
            idx = int(round(pos * 16))
            if 0 <= idx < 16:
                for n in bt.get("notes", []):
                    if n.get("rest"):
                        continue
                    fret = n.get("fret")
                    code = FRET_MAP.get(fret)
                    if code == "S" and (n.get("ghost") or bt.get("velocity") in ("p", "pp")):
                        code = "g"
                    if code:
                        steps[idx].add(code)
            pos += dur

    tokens = []
    for s in steps:
        if not s:
            tokens.append("-")
        else:
            if "S" in s and "g" in s:
                s.discard("g")
            if "O" in s and "X" in s:
                s.discard("X")
            sorted_codes = sorted(
                list(s), key=lambda x: SYMBOL_ORDER.index(x) if x in SYMBOL_ORDER else 99
            )
            tokens.append("".join(sorted_codes))
    return tokens


def measure_to_16_riff_notes(m, tuning):
    steps = [[] for _ in range(16)]
    voices = m.get("voices", [])
    if not voices:
        return [None] * 16

    for v in voices[:1]:
        pos = 0.0
        for bt in v.get("beats", []):
            dur_arr = bt.get("duration", [1, 4])
            dur = (dur_arr[0] / dur_arr[1]) if dur_arr and dur_arr[1] else 0.25
            idx = int(round(pos * 16))
            if 0 <= idx < 16:
                pitches = []
                for n in bt.get("notes", []):
                    if n.get("rest") or n.get("dead") or n.get("tie"):
                        continue
                    fret = n.get("fret")
                    string_idx = n.get("string", 0)
                    if isinstance(fret, int) and isinstance(string_idx, int):
                        base_pitch = (
                            tuning[string_idx]
                            if 0 <= string_idx < len(tuning)
                            else DEFAULT_GUITAR_TUNING[min(string_idx, 5)]
                        )
                        midi = base_pitch + fret
                        if 24 <= midi <= 96:
                            pitches.append(midi)
                if pitches:
                    pitches = sorted(list(set(pitches)))[:3]
                    steps[idx] = pitches[0] if len(pitches) == 1 else pitches
            pos += dur

    return [s if s else None for s in steps]


def is_fill_measure(tokens):
    tom_hits = sum(1 for t in tokens if ("T1" in t or "T2" in t or "FT" in t))
    snare_16ths = sum(1 for i, t in enumerate(tokens) if i % 2 == 1 and "S" in t)
    second_half_toms = sum(1 for t in tokens[8:] if ("T1" in t or "T2" in t or "FT" in t or "S" in t))
    return tom_hits >= 2 or snare_16ths >= 2 or second_half_toms >= 4


def detect_fill_start_step(tokens):
    for i in range(16):
        t = tokens[i]
        if "T1" in t or "T2" in t or "FT" in t:
            return max(0, (i // 4) * 4)
    return 8


def extract_song_parts(meta, track_data, guitar_data=None, guitar_tone="metal"):
    tempos = track_data.get("automations", {}).get("tempo", [])
    bpm = int(round(tempos[0]["bpm"])) if tempos else 100
    bpm = max(55, min(185, bpm))
    start_bpm = max(55, int(round(bpm * 0.75)))

    raw_measures = track_data.get("measures", [])
    guitar_measures = guitar_data.get("measures", []) if guitar_data else []
    guitar_tuning = (
        guitar_data.get("tuning")
        if (guitar_data and guitar_data.get("tuning"))
        else DEFAULT_GUITAR_TUNING
    )

    parsed_bars = []
    current_marker = "Intro"

    for idx, m in enumerate(raw_measures):
        mk = m.get("marker", {}).get("text", "").strip()
        if mk:
            current_marker = mk
        toks = measure_to_16_tokens(m)
        non_empty = sum(1 for t in toks if t != "-")
        riff = (
            measure_to_16_riff_notes(guitar_measures[idx], guitar_tuning)
            if idx < len(guitar_measures)
            else [None] * 16
        )
        parsed_bars.append(
            {
                "barNumber": idx + 1,
                "marker": current_marker,
                "hasNewMarker": bool(mk),
                "tokens": toks,
                "riff": riff,
                "riffTone": guitar_tone,
                "nonEmptyCount": non_empty,
                "isFill": is_fill_measure(toks) and non_empty >= 4,
            }
        )

    parts = []
    seen_signatures = set()

    # 1. Extract Named Sections (Intro, Verse, Chorus, Bridge, Riff...) where drums are active
    for i in range(len(parsed_bars) - 1):
        b1 = parsed_bars[i]
        b2 = parsed_bars[i + 1]
        if b1["nonEmptyCount"] < 4:
            continue

        sig = " ".join(b1["tokens"]) + "|" + " ".join(b2["tokens"] if b2["nonEmptyCount"] >= 3 else b1["tokens"])
        if b1["hasNewMarker"] and sig not in seen_signatures:
            seen_signatures.add(sig)
            second_bar = b2 if b2["nonEmptyCount"] >= 3 else b1
            parts.append(
                {
                    "partTitle": f"{b1['marker']} (Bar {b1['barNumber']})",
                    "partTitleAr": f"جزء {b1['marker']} (مازورة {b1['barNumber']})",
                    "bars": [
                        {
                            "role": "groove",
                            "subdivision": 4,
                            "riff": b1["riff"],
                            "riffTone": b1["riffTone"],
                            "tokens": b1["tokens"],
                        },
                        {
                            "role": "fill" if second_bar["isFill"] else "groove",
                            "fillStartStep": detect_fill_start_step(second_bar["tokens"]) if second_bar["isFill"] else 8,
                            "subdivision": 4,
                            "riff": second_bar["riff"],
                            "riffTone": second_bar["riffTone"],
                            "tokens": second_bar["tokens"],
                        },
                    ],
                }
            )
            if len(parts) >= 5:
                break

    # 2. Extract Groove -> Fill Pairs (Bar i = Groove, Bar i+1 = Fill!)
    fill_count = 0
    for i in range(len(parsed_bars) - 1):
        b1 = parsed_bars[i]
        b2 = parsed_bars[i + 1]
        if b1["nonEmptyCount"] >= 4 and not b1["isFill"] and b2["isFill"]:
            sig = " ".join(b1["tokens"]) + "|" + " ".join(b2["tokens"])
            if sig not in seen_signatures:
                seen_signatures.add(sig)
                fill_count += 1
                parts.append(
                    {
                        "partTitle": f"Real Fill #{fill_count} ({b2['marker']} - Bar {b2['barNumber']})",
                        "partTitleAr": f"الفيل الحقيقي #{fill_count} (مازورة {b2['barNumber']})",
                        "bars": [
                            {
                                "role": "groove",
                                "subdivision": 4,
                                "riff": b1["riff"],
                                "riffTone": b1["riffTone"],
                                "tokens": b1["tokens"],
                            },
                            {
                                "role": "fill",
                                "fillStartStep": detect_fill_start_step(b2["tokens"]),
                                "subdivision": 4,
                                "riff": b2["riff"],
                                "riffTone": b2["riffTone"],
                                "tokens": b2["tokens"],
                            },
                        ],
                    }
                )
                if fill_count >= 5:
                    break

    # 3. Fallback if no markers/fills matched: take first active 2-bar phrases
    if not parts:
        active = [b for b in parsed_bars if b["nonEmptyCount"] >= 4]
        for idx in range(0, min(len(active) - 1, 6), 2):
            b1 = active[idx]
            b2 = active[idx + 1]
            parts.append(
                {
                    "partTitle": f"Main Groove Part {len(parts)+1} (Bar {b1['barNumber']})",
                    "partTitleAr": f"الجروف الأساسي {len(parts)+1} (مازورة {b1['barNumber']})",
                    "bars": [
                        {
                            "role": "groove",
                            "subdivision": 4,
                            "riff": b1["riff"],
                            "riffTone": b1["riffTone"],
                            "tokens": b1["tokens"],
                        },
                        {
                            "role": "fill" if b2["isFill"] else "groove",
                            "subdivision": 4,
                            "riff": b2["riff"],
                            "riffTone": b2["riffTone"],
                            "tokens": b2["tokens"],
                        },
                    ],
                }
            )

    # Build full-song allBars and section jump markers so the drum notation walks through the entire song!
    all_bars = []
    sections = []
    seen_section_bars = set()
    first_drum_bar_idx = 0
    found_first_drum = False

    for idx, b in enumerate(parsed_bars):
        is_fill = b["isFill"]
        all_bars.append(
            {
                "barNumber": b["barNumber"],
                "marker": b["marker"],
                "hasNewMarker": b["hasNewMarker"],
                "role": "fill" if is_fill else "groove",
                "fillStartStep": detect_fill_start_step(b["tokens"]) if is_fill else 8,
                "subdivision": 4,
                "tokens": b["tokens"],
                "nonEmptyCount": b["nonEmptyCount"],
                "riff": b["riff"],
                "riffTone": b["riffTone"],
            }
        )
        if not found_first_drum and b["nonEmptyCount"] >= 2:
            found_first_drum = True
            first_drum_bar_idx = idx
            if idx > 0:
                sections.append(
                    {
                        "title": f"🥁 Drums Enter (Bar {b['barNumber']})",
                        "titleAr": f"🥁 دخول الدرامز (مازورة {b['barNumber']})",
                        "barIndex": idx,
                        "barNumber": b["barNumber"],
                        "isFill": False,
                    }
                )
                seen_section_bars.add(idx)

        if (b["hasNewMarker"] or idx == 0) and idx not in seen_section_bars:
            seen_section_bars.add(idx)
            sections.append(
                {
                    "title": f"📍 {b['marker']} (Bar {b['barNumber']})",
                    "titleAr": f"📍 {b['marker']} (مازورة {b['barNumber']})",
                    "barIndex": idx,
                    "barNumber": b["barNumber"],
                    "isFill": False,
                }
            )

    fill_sec_count = 0
    for idx, b in enumerate(parsed_bars):
        if b["isFill"] and idx not in seen_section_bars:
            fill_sec_count += 1
            seen_section_bars.add(idx)
            sections.append(
                {
                    "title": f"🔥 Fill #{fill_sec_count} (Bar {b['barNumber']})",
                    "titleAr": f"🔥 فيل #{fill_sec_count} (مازورة {b['barNumber']})",
                    "barIndex": max(0, idx - 1),
                    "barNumber": b["barNumber"],
                    "isFill": True,
                }
            )
            if fill_sec_count >= 5:
                break

    sections.sort(key=lambda s: s["barIndex"])

    return {
        "songId": meta["songId"],
        "artist": meta["artist"],
        "title": meta["title"],
        "startBpm": start_bpm,
        "targetBpm": bpm,
        "firstDrumBarIndex": first_drum_bar_idx,
        "allBars": all_bars,
        "sections": sections,
        "parts": parts,
    }


class DrumeoRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/search":
            qs = urllib.parse.parse_qs(parsed.query)
            q = (qs.get("q", [""])[0]).strip()
            if not q:
                return self.send_json({"results": []})
            try:
                url = "https://www.songsterr.com/api/songs?pattern=" + urllib.parse.quote(q)
                songs = http_get_json(url)
                results = []
                for s in songs:
                    drum_tracks = [
                        (i, t)
                        for i, t in enumerate(s.get("tracks", []))
                        if t.get("instrumentId") == 1024 or "drum" in t.get("instrument", "").lower()
                    ]
                    if drum_tracks:
                        results.append(
                            {
                                "songId": s["songId"],
                                "artist": s["artist"],
                                "title": s["title"],
                            }
                        )
                    if len(results) >= 12:
                        break
                return self.send_json({"results": results})
            except Exception as e:
                return self.send_json({"error": str(e), "results": []}, status=500)

        if parsed.path == "/api/song":
            qs = urllib.parse.parse_qs(parsed.query)
            song_id = (qs.get("songId", [""])[0]).strip()
            query_fallback = (qs.get("q", [""])[0]).strip()

            if query_fallback and not song_id.isdigit():
                search_url = "https://www.songsterr.com/api/songs?pattern=" + urllib.parse.quote(query_fallback)
                found = http_get_json(search_url)
                for s in found:
                    if any(t.get("instrumentId") == 1024 or "drum" in t.get("instrument", "").lower() for t in s.get("tracks", [])):
                        song_id = str(s["songId"])
                        break

            if not song_id.isdigit():
                return self.send_json({"error": "Invalid songId"}, status=400)

            cache_file = CACHE_DIR / f"song_v3_{song_id}.json"
            static_cache_file = STATIC_CACHE_DIR / f"song_v3_{song_id}.json"
            for cf in (cache_file, static_cache_file):
                if cf.exists():
                    try:
                        cached = json.loads(cf.read_text("utf-8"))
                        return self.send_json(cached)
                    except Exception:
                        pass

            try:
                meta = http_get_json(f"https://www.songsterr.com/api/meta/{song_id}")
                rev_id = meta["revisionId"]
                image = meta["image"]
                drum_idx = meta.get("popularTrackDrum")
                if drum_idx is None:
                    for i, t in enumerate(meta.get("tracks", [])):
                        if (t.get("instrumentId") == 1024 or "drum" in t.get("instrument", "").lower()) and "scratch" not in (t.get("name") or "").lower():
                            drum_idx = i
                            break
                if drum_idx is None:
                    for i, t in enumerate(meta.get("tracks", [])):
                        if t.get("instrumentId") == 1024 or "drum" in t.get("instrument", "").lower():
                            drum_idx = i
                            break
                if drum_idx is None:
                    return self.send_json({"error": "No drum track found for this song"}, status=404)

                cdn_url = f"https://dqsljvtekg760.cloudfront.net/{song_id}/{rev_id}/{image}/{drum_idx}.json"
                track_data = http_get_json(cdn_url)

                # Also fetch accompanying Guitar/Piano/Bass track so the user hears the recognizable song melody!
                guitar_idx = meta.get("popularTrackGuitar")
                if guitar_idx is None:
                    guitar_idx = meta.get("popularTrackBass")
                guitar_data = None
                guitar_tone = "metal"
                if guitar_idx is not None and guitar_idx != drum_idx:
                    try:
                        g_url = f"https://dqsljvtekg760.cloudfront.net/{song_id}/{rev_id}/{image}/{guitar_idx}.json"
                        guitar_data = http_get_json(g_url)
                        inst_name = (meta.get("tracks", [])[guitar_idx].get("instrument", "")).lower()
                        if "piano" in inst_name or "clean" in inst_name or "acoustic" in inst_name:
                            guitar_tone = "clean"
                    except Exception:
                        guitar_data = None

                extracted = extract_song_parts(meta, track_data, guitar_data, guitar_tone)
                cache_file.write_text(json.dumps(extracted), encoding="utf-8")
                return self.send_json(extracted)
            except Exception as e:
                return self.send_json({"error": str(e)}, status=500)

        if parsed.path == "/api/realtrack":
            return self.serve_real_track(parsed)

        if parsed.path == "/api/studio_audio":
            return self.serve_studio_audio(parsed)

        if parsed.path == "/api/sample":
            return self.serve_instrument_sample(parsed)

        if parsed.path in ("/", "/index.html"):
            return self.serve_seo_index(parsed)

        return super().do_GET()

    def serve_seo_index(self, parsed):
        index_path = BASE_DIR / "index.html"
        if not index_path.exists():
            return super().do_GET()

        html_text = index_path.read_text("utf-8")
        qs = urllib.parse.parse_qs(parsed.query)
        track_id = (qs.get("track", [""])[0]).strip()
        week_num = (qs.get("week", [""])[0]).strip()
        lang = (qs.get("lang", ["en"])[0]).strip()

        host = self.headers.get("Host") or "drumeo-elbalad.vercel.app"
        scheme = "https" if "vercel.app" in host else "http"
        base_url = f"{scheme}://{host}"

        page_title = None
        page_desc = None
        canonical_url = f"{base_url}/"
        heading_band = None
        heading_title = None

        if week_num in SEO_WEEKS:
            w = SEO_WEEKS[week_num]
            page_title = f"{w['title']} ({w['bpmRange']}) | Drumeo Al-Balad 3-Month Drum Plan"
            page_desc = (
                f"{w['title']}: {w['goal']} Practice the 30-minute daily drum routine on a 5-piece single-kick kit "
                f"with synchronized 16th-note letter notation."
            )
            canonical_url = f"{base_url}/?week={week_num}" + ("&lang=ar" if lang == "ar" else "")
        elif track_id in SEO_LESSONS:
            l = SEO_LESSONS[track_id]
            page_title = f"{l['band']}: {l['title']} ({l['targetBpm']} BPM Drum Tab) | Drumeo Al-Balad"
            page_desc = (
                f"Play {l['band']} ({l['title']}) at {l['startBpm']} to {l['targetBpm']} BPM using 5-piece "
                f"single-kick letter drum notation (X, S, B, T1, T2, FT) and drumless backing tracks."
            )
            canonical_url = f"{base_url}/?track={track_id}" + ("&lang=ar" if lang == "ar" else "")
            heading_band = l["rawBand"]
            heading_title = l["title"]

        if page_title and page_desc:
            esc_title = html_lib.escape(page_title, quote=True)
            esc_desc = html_lib.escape(page_desc, quote=True)
            esc_url = html_lib.escape(canonical_url, quote=True)

            html_text = re.sub(
                r'<title id="seo-doc-title">.*?</title>',
                f'<title id="seo-doc-title">{esc_title}</title>',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<meta id="seo-meta-desc" name="description" content="[^"]*" />',
                f'<meta id="seo-meta-desc" name="description" content="{esc_desc}" />',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<link id="seo-canonical" rel="canonical" href="[^"]*" />',
                f'<link id="seo-canonical" rel="canonical" href="{esc_url}" />',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<meta id="seo-og-title" property="og:title" content="[^"]*" />',
                f'<meta id="seo-og-title" property="og:title" content="{esc_title}" />',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<meta id="seo-og-desc" property="og:description" content="[^"]*" />',
                f'<meta id="seo-og-desc" property="og:description" content="{esc_desc}" />',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<meta id="seo-og-url" property="og:url" content="[^"]*" />',
                f'<meta id="seo-og-url" property="og:url" content="{esc_url}" />',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<meta id="seo-twitter-title" name="twitter:title" content="[^"]*" />',
                f'<meta id="seo-twitter-title" name="twitter:title" content="{esc_title}" />',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<meta id="seo-twitter-desc" name="twitter:description" content="[^"]*" />',
                f'<meta id="seo-twitter-desc" name="twitter:description" content="{esc_desc}" />',
                html_text,
                count=1,
            )

        if heading_band and heading_title:
            html_text = re.sub(
                r'<span id="active-lesson-band" class="band-tag">.*?</span>',
                f'<span id="active-lesson-band" class="band-tag">{html_lib.escape(heading_band)}</span>',
                html_text,
                count=1,
            )
            html_text = re.sub(
                r'<h1 id="active-lesson-title" class="song-main-title">.*?</h1>',
                f'<h1 id="active-lesson-title" class="song-main-title">{html_lib.escape(heading_title)}</h1>',
                html_text,
                count=1,
            )

        body = html_text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _lookup_itunes_track(self, artist, title):
        q = f"{artist} {title}".strip()
        url = "https://itunes.apple.com/search?entity=song&limit=5&term=" + urllib.parse.quote(q)
        try:
            data = http_get_json(url)
            results = data.get("results", [])
            if not results:
                return None
            artist_low = artist.lower()
            for r in results:
                if artist_low and artist_low in r.get("artistName", "").lower() and r.get("previewUrl"):
                    return r
            return results[0] if results[0].get("previewUrl") else None
        except Exception:
            return None

    def serve_studio_audio(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        artist = (qs.get("artist", [""])[0]).strip()
        title = (qs.get("title", [""])[0]).strip()
        if not title:
            return self.send_json({"error": "Missing title"}, status=400)

        key = re.sub(r"[^a-z0-9]+", "_", f"{artist}_{title}".lower()).strip("_")[:80]
        audio_cache = CACHE_DIR / f"audio_{key}.m4a"

        if not audio_cache.exists():
            it = self._lookup_itunes_track(artist, title)
            if not it or not it.get("previewUrl"):
                return self.send_json({"error": "No studio audio found"}, status=404)
            try:
                req = urllib.request.Request(it["previewUrl"], headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    raw_audio = resp.read()
                if raw_audio:
                    audio_cache.write_bytes(raw_audio)
            except Exception as e:
                return self.send_json({"error": str(e)}, status=500)

        if not audio_cache.exists():
            return self.send_json({"error": "Studio audio unavailable"}, status=404)

        body = audio_cache.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "audio/mp4")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def serve_real_track(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        artist = (qs.get("artist", [""])[0]).strip()
        title = (qs.get("title", [""])[0]).strip()
        song_id = (qs.get("songId", [""])[0]).strip()
        if not title:
            return self.send_json({"error": "Missing title"}, status=400)

        key = re.sub(r"[^a-z0-9]+", "_", f"{artist}_{title}_{song_id}".lower()).strip("_")[:80]
        cache_file = CACHE_DIR / f"yt_v3_{key}.json"
        static_cache_file = STATIC_CACHE_DIR / f"yt_v3_{song_id}.json" if song_id else None
        for cf in (cache_file, static_cache_file):
            if cf and cf.exists():
                try:
                    return self.send_json(json.loads(cf.read_text("utf-8")))
                except Exception:
                    pass

        def yt_search(query):
            url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "Accept-Language": "en-US"},
            )
            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    html = resp.read().decode("utf-8", errors="ignore")
            except Exception:
                return []
            ids = []
            for vid in re.findall(r'"videoId":"([A-Za-z0-9_-]{11})"', html):
                if vid not in ids:
                    ids.append(vid)
                if len(ids) >= 6:
                    break
            return ids

        it = self._lookup_itunes_track(artist, title)
        studio_audio_url = (
            f"/api/studio_audio?artist={urllib.parse.quote(artist)}&title={urllib.parse.quote(title)}"
            if (it and it.get("previewUrl"))
            else None
        )
        artwork_url = it.get("artworkUrl100") if it else None

        yt_drumless_ids = yt_search(f"{artist} {title} drumless backing track")
        yt_orig_ids = yt_search(f"{artist} {title} official audio")

        drumless_tracks = []
        original_tracks = []
        reference_points = []
        seen_drumless = set()
        seen_orig = set()

        if song_id.isdigit():
            try:
                meta = http_get_json(f"https://www.songsterr.com/api/meta/{song_id}")
                rev_id = meta["revisionId"]
                drum_indices = [
                    i
                    for i, t in enumerate(meta.get("tracks", []))
                    if (t.get("instrumentId") == 1024 or "drum" in (t.get("instrument") or "").lower())
                    and "scratch" not in (t.get("name") or "").lower()
                ]
                if not drum_indices:
                    drum_indices = [
                        i for i, t in enumerate(meta.get("tracks", [])) if t.get("instrumentId") == 1024
                    ]

                vp_list = http_get_json(f"https://www.songsterr.com/api/video-points/{song_id}/{rev_id}/list")
                # Pick reference points from main video or first valid video
                for v in vp_list:
                    pts = v.get("points") or []
                    if len(pts) >= 8 and v.get("feature") in (None, "alternative"):
                        reference_points = pts
                        if v.get("feature") is None:
                            break

                # 1. Exact Songsterr-synced Drumless Backing tracks (where drum track is muted OR videoId is in yt_drumless_ids)
                for v in vp_list:
                    vid = v.get("videoId")
                    pts = v.get("points") or []
                    if not vid or len(pts) < 8:
                        continue
                    is_drum_backing = v.get("feature") == "backing" and any(
                        d in (v.get("tracks") or []) for d in drum_indices
                    )
                    is_yt_drumless_match = vid in yt_drumless_ids
                    if (is_drum_backing or is_yt_drumless_match) and vid not in seen_drumless:
                        seen_drumless.add(vid)
                        drumless_tracks.append({"videoId": vid, "points": pts, "synced": True})

                # 2. Exact Songsterr-synced Original Song tracks
                # Put main video (feature is None) first, then alternative videos
                sorted_vp = sorted(
                    vp_list,
                    key=lambda x: (0 if x.get("feature") is None else 1 if x.get("feature") == "alternative" else 2),
                )
                for v in sorted_vp:
                    vid = v.get("videoId")
                    pts = v.get("points") or []
                    if not vid or len(pts) < 8:
                        continue
                    if v.get("feature") in (None, "alternative") and vid not in seen_drumless and vid not in seen_orig:
                        seen_orig.add(vid)
                        original_tracks.append({"videoId": vid, "points": pts, "synced": True})
                        if len(original_tracks) >= 8:
                            break
            except Exception:
                pass

        # Append YouTube search drumless & original fallbacks with reference_points
        for vid in yt_drumless_ids:
            if vid not in seen_drumless:
                seen_drumless.add(vid)
                drumless_tracks.append({"videoId": vid, "points": reference_points, "synced": bool(reference_points)})
        for vid in yt_orig_ids:
            if vid not in seen_orig:
                seen_orig.add(vid)
                original_tracks.append({"videoId": vid, "points": reference_points, "synced": bool(reference_points)})

        payload = {
            "artist": artist,
            "title": title,
            "songId": song_id,
            "studioAudioUrl": studio_audio_url,
            "artworkUrl": artwork_url,
            "referencePoints": reference_points,
            "drumlessTracks": drumless_tracks[:8],
            "originalTracks": original_tracks[:8],
            "original": [t["videoId"] for t in original_tracks[:8]],
            "drumless": [t["videoId"] for t in drumless_tracks[:8]],
        }
        if studio_audio_url or original_tracks or drumless_tracks:
            cache_file.write_text(json.dumps(payload), encoding="utf-8")
        return self.send_json(payload)

    def serve_instrument_sample(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        inst = (qs.get("inst", [""])[0]).strip()
        note = (qs.get("note", [""])[0]).strip()
        if inst not in ALLOWED_SAMPLE_INSTRUMENTS or not re.fullmatch(r"[A-G]b?[0-8]", note):
            return self.send_json({"error": "Invalid sample request"}, status=400)

        cache_file = SAMPLE_CACHE_DIR / f"{inst}__{note}.mp3"
        if not cache_file.exists():
            data = None
            for bank in ("MusyngKite", "FluidR3_GM"):
                url = f"https://gleitz.github.io/midi-js-soundfonts/{bank}/{inst}-mp3/{note}.mp3"
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=12) as resp:
                        data = resp.read()
                    if data:
                        break
                except Exception:
                    data = None
            if not data:
                return self.send_json({"error": "Sample unavailable"}, status=404)
            cache_file.write_bytes(data)

        body = cache_file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), DrumeoRequestHandler) as httpd:
        print(f"Drumeo Al-Balad Server running on http://localhost:{PORT}")
        httpd.serve_forever()
