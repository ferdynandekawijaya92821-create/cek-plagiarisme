"""Utilitas pemrosesan teks yang dipakai bersama oleh modul plagiarisme dan AI."""

import re
import unicodedata

# Stopword ringkas Bahasa Indonesia + Inggris (dipakai untuk TF-IDF).
STOPWORDS = frozenset(
    """
    yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga atau
    karena oleh sebagai bahwa ada telah sudah dapat bisa lebih saat secara para
    serta jika maka agar namun tetapi hanya pun kami kita mereka ia dia saya anda
    nya lah kah sangat masih belum harus tersebut antara setelah sebelum hingga
    the a an and or of to in on for with is are was were be been being it this
    that these those as by at from not but if then so than too very can will
    would should could has have had do does did its their they them he she we you i
    """.split()
)

_WORD_RE = re.compile(r"[^\W_]+(?:[-'][^\W_]+)*", re.UNICODE)
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?…])[\"'”’)\]]*\s+(?=[\"'“‘(\[]?[A-Z0-9À-Ý])|\n{2,}")


def normalize(text: str) -> str:
    """Normalisasi unicode dan spasi agar perbandingan konsisten."""
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text


def tokenize(text: str):
    """Kembalikan daftar (kata_lowercase, start, end) beserta posisinya di teks asli."""
    return [(m.group(0).lower(), m.start(), m.end()) for m in _WORD_RE.finditer(text)]


def words(text: str):
    return [w for w, _, _ in tokenize(text)]


def split_sentences(text: str):
    """Pisahkan teks menjadi kalimat; kembalikan list (kalimat, start, end)."""
    text = normalize(text)
    result = []
    pos = 0
    for m in _SENT_SPLIT_RE.finditer(text):
        _append_sentence(text, pos, m.start(), result)
        pos = m.end()
    _append_sentence(text, pos, len(text), result)
    return result


def _append_sentence(text, start, end, out):
    chunk = text[start:end]
    stripped = chunk.strip()
    if not stripped:
        return
    lead = len(chunk) - len(chunk.lstrip())
    s = start + lead
    out.append((stripped, s, s + len(stripped)))


def content_words(text: str):
    return [w for w in words(text) if w not in STOPWORDS and len(w) > 1]
