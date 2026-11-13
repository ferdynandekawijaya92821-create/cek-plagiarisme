"""Pembaca berkas: .txt, .md, .docx, .pdf."""

import io
import os

SUPPORTED_EXT = {".txt", ".md", ".docx", ".pdf"}


def read_bytes(data: bytes, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".txt", ".md", ""):
        for enc in ("utf-8-sig", "utf-16", "latin-1"):
            try:
                return data.decode(enc)
            except UnicodeDecodeError:
                continue
    if ext == ".docx":
        try:
            import docx
        except ImportError as e:
            raise RuntimeError("Paket python-docx belum terpasang (pip install python-docx)") from e
        d = docx.Document(io.BytesIO(data))
        return "\n\n".join(p.text for p in d.paragraphs if p.text.strip())
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as e:
            raise RuntimeError("Paket pypdf belum terpasang (pip install pypdf)") from e
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    raise ValueError(f"Format berkas tidak didukung: {ext} (gunakan .txt, .md, .docx, .pdf)")


def read_file(path: str) -> str:
    with open(path, "rb") as f:
        return read_bytes(f.read(), path)
