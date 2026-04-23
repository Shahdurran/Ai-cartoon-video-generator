
import os
import sys
from pathlib import Path

# Force CPU usage for faster-whisper
os.environ["CUDA_VISIBLE_DEVICES"] = ""

try:
    from faster_whisper import WhisperModel
    print("faster-whisper imported successfully")
except ImportError as e:
    print(f"Error importing faster-whisper: {e}")
    sys.exit(1)

def format_time(seconds):
    """Convert seconds to SRT time format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def transcribe_to_srt(audio_path, output_dir, model_size="base"):
    """Transcribe audio and save as SRT file"""
    try:
        print(f"Loading model: {model_size} (CPU-only)")
        # Explicitly force CPU usage
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        
        print(f"Transcribing: {audio_path}")
        segments, info = model.transcribe(audio_path)
        
        print(f"Detected language: {info.language} (probability: {info.language_probability:.2f})")
        
        # Generate SRT content
        srt_content = ""
        segment_count = 0
        
        for segment in segments:
            segment_count += 1
            start_time = format_time(segment.start)
            end_time = format_time(segment.end)
            text = segment.text.strip()
            
            srt_content += f"{segment_count}\n"
            srt_content += f"{start_time} --> {end_time}\n"
            srt_content += f"{text}\n\n"
        
        # Save SRT file
        os.makedirs(output_dir, exist_ok=True)
        audio_filename = Path(audio_path).stem
        srt_path = os.path.join(output_dir, f"{audio_filename}_faster.srt")
        
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
        
        print(f"SRT file saved: {srt_path}")
        print(f"Total segments: {segment_count}")
        return srt_path
        
    except Exception as e:
        print(f"Error during transcription: {e}")
        import traceback
        traceback.print_exc()
        return None

# Main execution
if __name__ == "__main__":
    audio_path = r"D:/ffmpeg video generator/LOS NOBLES LA HUMILLARON POR SU EMBARAZOHASTA QUE UN HOMBRE DE HONOR LE OFRECIÓ SU NOMBRE.mp3"
    output_dir = r"D:\\ffmpeg video generator\\test-output"
    
    result = transcribe_to_srt(audio_path, output_dir)
    if result:
        print(f"SUCCESS: {result}")
    else:
        print("FAILED: Could not generate SRT file")
        sys.exit(1)
