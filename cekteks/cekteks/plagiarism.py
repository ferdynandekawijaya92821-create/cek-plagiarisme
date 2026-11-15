"""Deteksi plagiarisme berbasis n-gram (shingling) dan kemiripan kosinus TF-IDF.

Cara kerja:
1. Teks yang diperiksa dan setiap dokumen sumber dipecah menjadi kata.
2. Dibentuk "shingle" (urutan n kata berturut-turut, default 5).
3. Shingle yang sama di teks & sumber menandakan bagian yang disalin.
   Posisi kata yang tertutup shingle cocok disorot sebagai segmen plagiat.
4. Kemiripan kosinus TF-IDF menangkap kemiripan topik/parafrase ringan.
"""

import math
import os
from collections import Counter

from .text_utils import content_words, normalize, tokenize

DEFAULT_NGRAM = 5


def _shingles(tokens, n):
    """Map shingle -> list indeks kata awal."""
    index = {}
    for i in range(len(tokens) - n + 1):
        key = tuple(tokens[i : i + n])
        index.setdefault(key, []).append(i)
    return index


def _tfidf_cosine(doc_a, doc_b, df, n_docs):
    ca, cb = Counter(doc_a), Counter(doc_b)
    if not ca or not cb:
        return 0.0

    def weight(term, tf):
        idf = math.log((1 + n_docs) / (1 + df.get(term, 0))) + 1
        return (1 + math.log(tf)) * idf

    va = {t: weight(t, c) for t, c in ca.items()}
    vb = {t: weight(t, c) for t, c in cb.items()}
    dot = sum(va[t] * vb[t] for t in va.keys() & vb.keys())
    na = math.sqrt(sum(v * v for v in va.values()))
    nb = math.sqrt(sum(v * v for v in vb.values()))
    return dot / (na * nb) if na and nb else 0.0


def _merge_spans(spans):
    spans = sorted(spans)
    merged = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [tuple(x) for x in merged]


def check_plagiarism(text, sources, ngram=DEFAULT_NGRAM):
    """Periksa `text` terhadap daftar sumber.

    sources: list of dict {"name": str, "text": str}
    Return dict berisi skor keseluruhan, rincian per sumber, dan segmen yang cocok
    (posisi karakter di teks asli) untuk disorot.
    """
    text = normalize(text)
    tok = tokenize(text)
    words = [w for w, _, _ in tok]
    n_words = len(words)
    ngram = max(2, int(ngram))

    result = {
        "word_count": n_words,
        "ngram": ngram,
        "score": 0.0,
        "sources": [],
        "matches": [],
    }
    if n_words < ngram or not sources:
        return result

    text_shingles = _shingles(words, ngram)
    covered_any = [False] * n_words
    word_source = [None] * n_words

    cw_text = content_words(text)
    src_cw = [content_words(normalize(s.get("text", ""))) for s in sources]
    df = Counter()
    for doc in [cw_text] + src_cw:
        df.update(set(doc))
    n_docs = len(sources) + 1

    for si, src in enumerate(sources):
        src_words = [w for w, _, _ in tokenize(normalize(src.get("text", "")))]
        src_set = set(_shingles(src_words, ngram).keys()) if len(src_words) >= ngram else set()
        covered = [False] * n_words
        hits = 0
        for sh, starts in text_shingles.items():
            if sh in src_set:
                hits += len(starts)
                for st in starts:
                    for k in range(st, st + ngram):
                        covered[k] = True
        n_cov = sum(covered)
        for i, c in enumerate(covered):
            if c:
                covered_any[i] = True
                if word_source[i] is None:
                    word_source[i] = si
        total_sh = max(1, n_words - ngram + 1)
        result["sources"].append(
            {
                "name": src.get("name", f"Sumber {si + 1}"),
                "overlap_percent": round(100 * n_cov / n_words, 2),
                "shingle_match_percent": round(100 * hits / total_sh, 2),
                "cosine_similarity": round(100 * _tfidf_cosine(cw_text, src_cw[si], df, n_docs), 2),
                "matched_words": n_cov,
            }
        )

    # Bangun segmen karakter dari kata-kata yang tertutup, dikelompokkan per sumber.
    spans = []
    i = 0
    while i < n_words:
        if covered_any[i]:
            j = i
            src_idx = word_source[i]
            while j + 1 < n_words and covered_any[j + 1] and word_source[j + 1] == src_idx:
                j += 1
            spans.append((tok[i][1], tok[j][2], src_idx))
            i = j + 1
        else:
            i += 1
    result["matches"] = [
        {
            "start": s,
            "end": e,
            "text": text[s:e],
            "source": result["sources"][si]["name"],
        }
        for s, e, si in spans
    ]
    result["score"] = round(100 * sum(covered_any) / n_words, 2)
    result["sources"].sort(key=lambda x: (x["overlap_percent"], x["cosine_similarity"]), reverse=True)
    return result


def compare_documents(docs, ngram=DEFAULT_NGRAM):
    """Bandingkan banyak dokumen satu sama lain (mis. tugas mahasiswa).

    docs: list of {"name", "text"}. Return matriks kemiripan berpasangan.
    """
    pairs = []
    for i in range(len(docs)):
        for j in range(i + 1, len(docs)):
            r = check_plagiarism(docs[i]["text"], [docs[j]], ngram=ngram)
            r2 = check_plagiarism(docs[j]["text"], [docs[i]], ngram=ngram)
            pairs.append(
                {
                    "a": docs[i]["name"],
                    "b": docs[j]["name"],
                    "a_in_b": r["score"],
                    "b_in_a": r2["score"],
                    "cosine_similarity": r["sources"][0]["cosine_similarity"] if r["sources"] else 0.0,
                }
            )
    pairs.sort(key=lambda p: max(p["a_in_b"], p["b_in_a"]), reverse=True)
    return pairs


def load_corpus(directory):
    """Muat semua berkas .txt/.md/.docx/.pdf di folder corpus sebagai sumber pembanding."""
    from .file_reader import read_file, SUPPORTED_EXT

    sources = []
    if not directory or not os.path.isdir(directory):
        return sources
    for root, _, files in os.walk(directory):
        for fn in sorted(files):
            if fn.upper().startswith("README"):
                continue  # berkas penjelasan folder, bukan sumber
            if os.path.splitext(fn)[1].lower() in SUPPORTED_EXT:
                path = os.path.join(root, fn)
                try:
                    sources.append({"name": os.path.relpath(path, directory), "text": read_file(path)})
                except Exception:  # berkas rusak/tidak terbaca dilewati
                    continue
    return sources
