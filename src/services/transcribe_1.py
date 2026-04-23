
import sys
import os
import time
import re

# Disable CUDA for faster startup
os.environ["CUDA_VISIBLE_DEVICES"] = ""

print("Starting optimized transcription...")
script_start_time = time.time()

try:
    from faster_whisper import WhisperModel
    use_faster = True
    print("Using faster-whisper")
except ImportError:
    import whisper
    use_faster = False
    print("Using standard whisper")

def format_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def split_long_segments(text, max_chars=42):
    """Fast text splitting"""
    if len(text) <= max_chars:
        return [text]
    
    # Split on sentence boundaries first
    sentences = re.split(r'(?<=[.!?])\s+', text)
    if len(sentences) == 1:
        # Split on commas if no sentences
        sentences = re.split(r'(?<=,)\s+', text)
    
    parts = []
    current = ""
    
    for sentence in sentences:
        if len(current + sentence) <= max_chars:
            current += (" " if current else "") + sentence
        else:
            if current:
                parts.append(current)
            current = sentence
    
    if current:
        parts.append(current)
    
    return parts if parts else [text]

def process_segments(segments):
    """Process segments with optimized splitting"""
    processed = []
    
    for segment in segments:
        text = segment.get('text', '').strip()
        if not text:
            continue
            
        start_time = segment.get('start', 0)
        end_time = segment.get('end', start_time + 3)
        duration = end_time - start_time
        
        # Split long segments
        text_parts = split_long_segments(text)
        
        if len(text_parts) == 1:
            processed.append({
                'start': start_time,
                'end': end_time,
                'text': text_parts[0]
            })
        else:
            # Distribute time across parts
            part_duration = duration / len(text_parts)
            for i, part in enumerate(text_parts):
                part_start = start_time + (i * part_duration)
                part_end = part_start + part_duration
                processed.append({
                    'start': part_start,
                    'end': part_end,
                    'text': part
                })
    
    return processed

# Main transcription
audio_path = r"E:\\ffmpeg video generator\\src\\services\\test-output\\chunks\\chunk_001.wav"
output_path = r"E:\\ffmpeg video generator\\src\\services\\test-output\\chunk_001.srt"

print(f"Processing: {os.path.basename(audio_path)}")

try:
    if use_faster:
        # Faster Whisper with optimized settings
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        
        segments, info = model.transcribe(
            audio_path,
            beam_size=2,
            best_of=2,
            temperature=0.0,
            condition_on_previous_text=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=300)
        )
        
        print(f"Language: {info.language} ({info.language_probability:.2f})")
        
        # Convert to list for processing
        segment_list = []
        for segment in segments:
            if segment.text.strip():
                segment_list.append({
                    'start': segment.start,
                    'end': segment.end,
                    'text': segment.text.strip()
                })
        
    else:
        # Standard Whisper with optimized settings
        model = whisper.load_model("tiny")
        
        result = model.transcribe(
            audio_path,
            fp16=False,
            verbose=False,
            condition_on_previous_text=True,
            temperature=0.0
        )
        
        print(f"Language: {result.get('language', 'unknown')}")
        
        segment_list = []
        for segment in result.get('segments', []):
            if segment.get('text', '').strip():
                segment_list.append({
                    'start': segment['start'],
                    'end': segment['end'],
                    'text': segment['text'].strip()
                })
    
    print(f"Processing {len(segment_list)} segments...")
    
    # Process segments (basic cleaning, no spell checking here)
    processed_segments = process_segments(segment_list)
    
    # Generate SRT content
    srt_content = ""
    for i, segment in enumerate(processed_segments, 1):
        start_time = format_time(segment['start'])
        end_time = format_time(segment['end'])
        text = segment['text']
        
        srt_content += f"{i}\n{start_time} --> {end_time}\n{text}\n\n"
    
    if not srt_content:
        print("No speech detected")
        srt_content = "1\n00:00:00,000 --> 00:00:05,000\n[No speech detected]\n\n"
    
    # Save output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    
    processing_time = time.time() - script_start_time
    print(f"Completed in {processing_time:.1f}s")
    print(f"SUCCESS: {output_path}")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
