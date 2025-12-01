from faster_whisper import WhisperModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    logger.info("Loading model...")
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    logger.info("Model loaded!")
except Exception as e:
    logger.error(f"Error: {e}")
