"""Aplikasi baris perintah CekTeks.

Contoh:
  python -m cekteks cek esai.docx -s sumber1.txt -s sumber2.pdf
  python -m cekteks ai esai.txt
  python -m cekteks plagiat esai.txt --corpus corpus/
  python -m cekteks bandingkan tugas/*.docx
  echo "teks..." | python -m cekteks ai -
"""

import argparse
import json
import os
import sys

from .ai_detector import detect_ai
from .file_reader import read_file
from .plagiarism import check_plagiarism, compare_documents, load_corpus

DEFAULT_CORPUS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "corpus")

USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def c(text, code):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else str(text)


def level_color(v):
    return "32" if v < 35 else "33" if v < 65 else "31"


def bar(v, width=30):
    n = int(round(v / 100 * width))
    return c("█" * n, level_color(v)) + c("░" * (width - n), "2")


def read_input(path):
    if path == "-":
        return sys.stdin.read()
    if not os.path.isfile(path):
        sys.exit(f"Berkas tidak ditemukan: {path}")
    return read_file(path)


def gather_sources(args):
    sources = [{"name": os.path.basename(p), "text": read_input(p)} for p in (args.source or [])]
    if not args.no_corpus:
        sources += load_corpus(args.corpus)
    return sources


def print_plagiarism(r, show_matches):
    print(c("\n== PLAGIARISME ==", "1"))
    print(f"Skor    : {bar(r['score'])} {c(str(r['score']) + '%', '1;' + level_color(r['score']))}")
    print(f"Kata    : {r['word_count']}   n-gram: {r['ngram']}   sumber diperiksa: {r.get('source_count', len(r['sources']))}")
    top = [s for s in r["sources"] if s["overlap_percent"] > 0 or s["cosine_similarity"] >= 20][:10]
    if top:
        print("\nSumber teratas:")
        for s in top:
            print(f"  {s['overlap_percent']:6.2f}%  (kosinus {s['cosine_similarity']:5.1f}%)  {s['name']}")
    else:
        print("Tidak ada sumber yang cocok.")
    if show_matches and r["matches"]:
        print("\nBagian yang cocok:")
        for m in r["matches"]:
            snippet = m["text"].replace("\n", " ")
            snippet = snippet if len(snippet) <= 160 else snippet[:157] + "..."
            print(f"  - [{m['source']}] {c(snippet, '31')}")


def print_ai(r, show_sentences):
    print(c("\n== DETEKSI AI ==", "1"))
    print(f"Skor    : {bar(r['score'])} {c(str(r['score']) + '%', '1;' + level_color(r['score']))}")
    print(f"Hasil   : {c(r['label'], '1')}")
    print(f"Kata    : {r['word_count']}   kalimat: {r['sentence_count']}")
    print("\nSinyal:")
    for k, v in r["signals"].items():
        print(f"  {k:<22} {bar(v, 20)} {v:5.1f}%")
    if r["ai_phrases_found"]:
        print("\nFrasa khas AI: " + ", ".join(f"{k} (×{n})" for k, n in r["ai_phrases_found"].items()))
    if show_sentences:
        print("\nPer kalimat:")
        for s in r["sentences"]:
            t = s["text"].replace("\n", " ")
            t = t if len(t) <= 120 else t[:117] + "..."
            pct = "%5.1f%%" % s["score"]
            print(f"  {c(pct, level_color(s['score']))}  {t}")
    for w in r["warnings"]:
        print(c(f"\n⚠ {w}", "33"))
    print(c(f"\n{r['disclaimer']}", "2"))


def build_parser():
    p = argparse.ArgumentParser(prog="cekteks", description="Cek plagiarisme & deteksi teks buatan AI.")
    p.add_argument("--json", action="store_true", help="keluarkan hasil sebagai JSON")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_plag_opts(sp):
        sp.add_argument("-s", "--source", action="append", help="berkas sumber pembanding (bisa berulang)")
        sp.add_argument("--corpus", default=DEFAULT_CORPUS, help="folder korpus pembanding")
        sp.add_argument("--no-corpus", action="store_true", help="jangan gunakan korpus")
        sp.add_argument("-n", "--ngram", type=int, default=5, help="panjang n-gram (default 5)")
        sp.add_argument("-m", "--matches", action="store_true", help="tampilkan bagian yang cocok")

    sp = sub.add_parser("cek", help="cek plagiarisme + AI sekaligus")
    sp.add_argument("file", help="berkas teks (.txt/.md/.docx/.pdf) atau '-' untuk stdin")
    add_plag_opts(sp)
    sp.add_argument("-k", "--kalimat", action="store_true", help="tampilkan skor AI per kalimat")

    sp = sub.add_parser("plagiat", help="cek plagiarisme saja")
    sp.add_argument("file")
    add_plag_opts(sp)

    sp = sub.add_parser("ai", help="deteksi teks buatan AI saja")
    sp.add_argument("file")
    sp.add_argument("-k", "--kalimat", action="store_true", help="tampilkan skor per kalimat")

    sp = sub.add_parser("bandingkan", help="bandingkan beberapa dokumen satu sama lain")
    sp.add_argument("files", nargs="+")
    sp.add_argument("-n", "--ngram", type=int, default=5)

    sp = sub.add_parser("web", help="jalankan server web")
    sp.add_argument("--host", default="127.0.0.1")
    sp.add_argument("--port", type=int, default=5000)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    out = {}

    if args.cmd == "web":
        sys.path.insert(0, os.path.dirname(DEFAULT_CORPUS))
        from app import app  # noqa: E402

        app.run(host=args.host, port=args.port)
        return 0

    if args.cmd == "bandingkan":
        docs = [{"name": os.path.basename(f), "text": read_input(f)} for f in args.files]
        if len(docs) < 2:
            sys.exit("Minimal 2 berkas.")
        pairs = compare_documents(docs, ngram=args.ngram)
        if args.json:
            print(json.dumps({"pairs": pairs}, ensure_ascii=False, indent=2))
        else:
            print(c("\n== PERBANDINGAN DOKUMEN ==", "1"))
            for p in pairs:
                hi = max(p["a_in_b"], p["b_in_a"])
                pct = "%6.2f%%" % hi
                print(f"  {c(pct, level_color(hi))}  {p['a']} ↔ {p['b']}   (A→B {p['a_in_b']}%, B→A {p['b_in_a']}%, kosinus {p['cosine_similarity']}%)")
        return 0

    text = read_input(args.file)
    if not text.strip():
        sys.exit("Teks kosong.")

    if args.cmd in ("cek", "plagiat"):
        sources = gather_sources(args)
        out["plagiarism"] = check_plagiarism(text, sources, ngram=args.ngram)
        out["plagiarism"]["source_count"] = len(sources)
    if args.cmd in ("cek", "ai"):
        out["ai"] = detect_ai(text)

    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0
    if "plagiarism" in out:
        print_plagiarism(out["plagiarism"], args.matches)
    if "ai" in out:
        print_ai(out["ai"], args.kalimat)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
