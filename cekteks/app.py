"""Server web CekTeks (Flask): antarmuka + REST API.

Jalankan:  python app.py   lalu buka http://localhost:5000
"""

import os

from flask import Flask, jsonify, render_template, request, send_from_directory

from cekteks import __version__
from cekteks.ai_detector import detect_ai
from cekteks.file_reader import SUPPORTED_EXT, read_bytes
from cekteks.plagiarism import check_plagiarism, compare_documents, load_corpus

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_DIR = os.environ.get("CEKTEKS_CORPUS", os.path.join(BASE_DIR, "corpus"))
MAX_CHARS = 200_000

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024  # 15 MB


def _err(msg, code=400):
    return jsonify({"error": msg}), code


def _clean_sources(raw):
    out = []
    for i, s in enumerate(raw or []):
        if isinstance(s, dict) and str(s.get("text", "")).strip():
            out.append({"name": str(s.get("name") or f"Sumber {i + 1}")[:200], "text": str(s["text"])[:MAX_CHARS]})
    return out


@app.get("/")
def index():
    return render_template("index.html", version=__version__)


@app.get("/sw.js")
def service_worker():
    # Disajikan dari root agar scope service worker mencakup seluruh situs.
    resp = send_from_directory(os.path.join(BASE_DIR, "static"), "sw.js")
    resp.headers["Content-Type"] = "application/javascript"
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "version": __version__, "corpus_docs": len(load_corpus(CORPUS_DIR))})


@app.post("/api/check")
def api_check():
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", ""))
    if not text.strip():
        return _err("Teks tidak boleh kosong.")
    if len(text) > MAX_CHARS:
        return _err(f"Teks terlalu panjang (maks {MAX_CHARS:,} karakter).")
    mode = data.get("mode", "both")
    if mode not in ("both", "plagiarism", "ai"):
        return _err("mode harus 'both', 'plagiarism', atau 'ai'.")

    result = {}
    if mode in ("both", "plagiarism"):
        sources = _clean_sources(data.get("sources"))
        if data.get("use_corpus", True):
            sources += load_corpus(CORPUS_DIR)
        try:
            ngram = int(data.get("ngram", 5))
        except (TypeError, ValueError):
            ngram = 5
        ngram = max(3, min(ngram, 10))
        result["plagiarism"] = check_plagiarism(text, sources, ngram=ngram)
        result["plagiarism"]["source_count"] = len(sources)
    if mode in ("both", "ai"):
        result["ai"] = detect_ai(text)
    return jsonify(result)


@app.post("/api/compare")
def api_compare():
    data = request.get_json(silent=True) or {}
    docs = _clean_sources(data.get("docs"))
    if len(docs) < 2:
        return _err("Minimal 2 dokumen untuk dibandingkan.")
    if len(docs) > 30:
        return _err("Maksimal 30 dokumen sekaligus.")
    return jsonify({"pairs": compare_documents(docs)})


@app.post("/api/extract")
def api_extract():
    f = request.files.get("file")
    if not f or not f.filename:
        return _err("Tidak ada berkas yang diunggah.")
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in SUPPORTED_EXT:
        return _err(f"Format tidak didukung. Gunakan: {', '.join(sorted(SUPPORTED_EXT))}")
    try:
        text = read_bytes(f.read(), f.filename)
    except Exception as e:  # noqa: BLE001 - kirim pesan ramah ke pengguna
        return _err(f"Gagal membaca berkas: {e}")
    return jsonify({"name": f.filename, "text": text[:MAX_CHARS]})


@app.errorhandler(413)
def too_large(_):
    return _err("Berkas terlalu besar (maks 15 MB).", 413)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=port, debug=bool(os.environ.get("DEBUG")))
