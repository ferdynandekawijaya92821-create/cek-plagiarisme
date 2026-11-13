"""CekTeks - pemeriksa plagiarisme dan deteksi teks buatan AI."""

from .plagiarism import check_plagiarism
from .ai_detector import detect_ai

__all__ = ["check_plagiarism", "detect_ai"]
__version__ = "1.0.0"
