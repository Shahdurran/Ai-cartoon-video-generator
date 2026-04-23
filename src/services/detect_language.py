
import os
from faster_whisper import WhisperModel

model = WhisperModel("tiny", device="cpu", compute_type="int8")
segments, info = model.transcribe("D:\\ffmpeg video generator\\temp\\1751115793278_30\\quick_sample.wav", beam_size=1)
print(info.language)
