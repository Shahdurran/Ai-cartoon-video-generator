import sys
from faster_whisper import WhisperModel

if len(sys.argv) < 2:
    print("Usage: python whisper_test.py <audio_file>")
    sys.exit(1)

audio_file = sys.argv[1]
model = WhisperModel("base")
segments, info = model.transcribe(audio_file)

for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
