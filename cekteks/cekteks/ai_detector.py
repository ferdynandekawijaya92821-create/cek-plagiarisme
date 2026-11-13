"""Deteksi teks buatan AI berbasis heuristik stilometri (tanpa API eksternal).

Sinyal yang dipakai (masing-masing dinormalisasi ke 0..1, makin tinggi makin "AI"):
- burstiness      : variasi panjang kalimat. Tulisan manusia cenderung naik-turun,
                    teks AI cenderung seragam.
- frasa_ai        : kepadatan frasa klise khas model bahasa (ID & EN).
- konektor_awal   : proporsi kalimat yang diawali kata transisi formal
                    ("Selain itu,", "Furthermore,", ...).
- keseragaman_par : variasi panjang paragraf.
- repetisi_awal   : pengulangan kata pembuka kalimat.
- informalitas    : bahasa gaul, singkatan, tanda seru/tanya -> menurunkan skor.
- leksikal        : keragaman kosakata (MATTR) yang terlalu "rata".

PENTING: ini estimasi probabilistik, bukan bukti. Hasil sebaiknya dipakai sebagai
indikasi awal dan selalu ditinjau manusia.
"""

import re
import statistics

from .text_utils import normalize, split_sentences, words

AI_PHRASES = [
    # Bahasa Indonesia
    "penting untuk dicatat", "perlu diingat bahwa", "secara keseluruhan", "dengan demikian",
    "dalam era digital", "di era modern", "di era digital", "memainkan peran penting",
    "peran yang sangat penting", "tidak dapat dipungkiri", "dapat disimpulkan bahwa",
    "kesimpulannya", "sebagai kesimpulan", "selain itu", "lebih lanjut", "oleh karena itu",
    "hal ini menunjukkan", "hal ini disebabkan", "berbagai aspek", "aspek penting",
    "secara signifikan", "dalam konteks ini", "mari kita", "tentu saja", "pada akhirnya",
    "membuka peluang", "tantangan dan peluang", "lanskap", "menavigasi", "memastikan bahwa",
    "merupakan salah satu", "sangat penting untuk", "dengan kata lain", "tidak hanya",
    "namun juga", "seiring dengan perkembangan", "seiring berjalannya waktu",
    "pemahaman yang mendalam", "secara holistik", "berkelanjutan", "inovatif",
    # English
    "it is important to note", "it's important to note", "it is worth noting", "delve",
    "in conclusion", "in summary", "overall,", "furthermore", "moreover", "additionally",
    "in today's", "ever-evolving", "ever-changing", "landscape", "navigate", "navigating",
    "plays a crucial role", "plays a vital role", "crucial", "pivotal", "foster", "fostering",
    "leverage", "leveraging", "seamless", "seamlessly", "robust", "comprehensive",
    "a testament to", "tapestry", "realm", "underscore", "underscores", "multifaceted",
    "holistic", "in the realm of", "not only", "but also", "as an ai", "i hope this helps",
    "embark", "unlock", "unleash", "game-changer", "cutting-edge", "nuanced",
]

CONNECTORS = [
    "selain itu", "oleh karena itu", "dengan demikian", "namun", "lebih lanjut", "kemudian",
    "di sisi lain", "secara keseluruhan", "pertama", "kedua", "ketiga", "terakhir",
    "akhirnya", "sebaliknya", "selanjutnya", "maka", "oleh sebab itu", "meskipun demikian",
    "furthermore", "moreover", "additionally", "however", "therefore", "in addition",
    "consequently", "overall", "in conclusion", "firstly", "secondly", "finally",
    "ultimately", "notably", "importantly", "thus", "hence",
]

INFORMAL = {
    "gak", "nggak", "ngga", "enggak", "gk", "ga", "banget", "aja", "sih", "dong", "deh",
    "kok", "nih", "tuh", "gue", "gw", "lu", "lo", "elo", "aku", "kayak", "kaya", "udah",
    "udh", "blm", "yg", "dgn", "tdk", "krn", "jd", "jadi", "bgt", "wkwk", "wkwkwk", "haha",
    "hehe", "anjir", "btw", "lol", "lmao", "omg", "gonna", "wanna", "kinda", "yeah",
    "nope", "ok", "okay", "dunno", "tbh", "imo", "idk", "bikin", "gimana", "ngapain",
}

_CONTRACTION_RE = re.compile(r"\b\w+'(?:t|m|re|ve|ll|d)\b", re.I)

WEIGHTS = {
    "burstiness": 0.27,
    "frasa_ai": 0.25,
    "konektor_awal": 0.15,
    "keseragaman_paragraf": 0.10,
    "repetisi_awal": 0.08,
    "leksikal": 0.05,
    "informalitas": 0.10,  # dipakai sebagai pengurang
}

LABELS = [
    (35, "Kemungkinan besar ditulis manusia", "human"),
    (65, "Campuran / tidak pasti", "mixed"),
    (101, "Kemungkinan besar dibuat AI", "ai"),
]


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def _count_phrases(text_lower):
    hits = {}
    for p in AI_PHRASES:
        pat = r"(?<!\w)" + re.escape(p) + (r"(?!\w)" if p[-1].isalnum() else "")
        n = len(re.findall(pat, text_lower))
        if n:
            hits[p] = n
    return hits


def _starts_with_connector(sentence_lower):
    s = sentence_lower.lstrip("\"'“‘(- ")
    return any(s.startswith(c + ",") or s.startswith(c + " ") for c in CONNECTORS)


def _mattr(tokens, window=50):
    if not tokens:
        return 0.0
    if len(tokens) <= window:
        return len(set(tokens)) / len(tokens)
    vals = [len(set(tokens[i : i + window])) / window for i in range(0, len(tokens) - window + 1, 5)]
    return sum(vals) / len(vals)


def _cv(values):
    if len(values) < 2:
        return None
    mean = statistics.mean(values)
    return statistics.pstdev(values) / mean if mean else None


def detect_ai(text):
    text = normalize(text)
    sentences = split_sentences(text)
    toks = words(text)
    n_words = len(toks)
    lower = text.lower()

    sent_lens = [len(words(s)) for s, _, _ in sentences]
    sent_lens_nz = [x for x in sent_lens if x > 0]

    # 1. Burstiness
    cv = _cv(sent_lens_nz)
    burst = _clamp((0.70 - cv) / 0.45) if cv is not None else 0.5

    # 2. Frasa AI per 100 kata
    phrase_hits = _count_phrases(lower)
    density = 100 * sum(phrase_hits.values()) / max(n_words, 1)
    phrase = _clamp(density / 2.0)

    # 3. Kalimat diawali konektor
    conn_flags = [_starts_with_connector(s.lower()) for s, _, _ in sentences]
    conn_ratio = sum(conn_flags) / len(sentences) if sentences else 0
    conn = _clamp(conn_ratio / 0.35)

    # 4. Keseragaman paragraf
    paras = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    pcv = _cv([len(words(p)) for p in paras]) if len(paras) >= 3 else None
    para = _clamp((0.6 - pcv) / 0.45) if pcv is not None else 0.5

    # 5. Repetisi kata pembuka kalimat
    firsts = [words(s)[0] for s, _, _ in sentences if words(s)]
    rep = 0.0
    if len(firsts) >= 4:
        rep = _clamp((1 - len(set(firsts)) / len(firsts)) / 0.5)

    # 6. Keragaman leksikal: MATTR di rentang 0.68-0.80 tipikal teks AI yang "rapi"
    m = _mattr(toks)
    lex = _clamp(1 - abs(m - 0.74) / 0.12) if n_words >= 50 else 0.5

    # 7. Informalitas (sinyal manusia)
    informal_hits = sum(1 for w in toks if w in INFORMAL) + len(_CONTRACTION_RE.findall(text))
    informal_hits += text.count("!") + len(re.findall(r"\?{2,}|!{2,}|\.{3,}|:\)|:\(|:v", text))
    informal = _clamp((100 * informal_hits / max(n_words, 1)) / 3.0)

    signals = {
        "burstiness": burst,
        "frasa_ai": phrase,
        "konektor_awal": conn,
        "keseragaman_paragraf": para,
        "repetisi_awal": rep,
        "leksikal": lex,
    }
    pos_w = sum(v for k, v in WEIGHTS.items() if k != "informalitas")
    raw = sum(signals[k] * WEIGHTS[k] for k in signals) / pos_w
    raw = raw - WEIGHTS["informalitas"] * informal * 2.5
    # Sedikit penajaman agar skor tidak menumpuk di tengah.
    score = _clamp(0.5 + (raw - 0.45) * 1.6)
    score_pct = round(100 * score, 1)

    label, code = next((lbl, c) for th, lbl, c in LABELS if score_pct < th)

    # Skor per kalimat untuk penyorotan
    mean_len = statistics.mean(sent_lens_nz) if sent_lens_nz else 0
    sent_out = []
    for (s, st, en), ln, is_conn in zip(sentences, sent_lens, conn_flags):
        sl = s.lower()
        ph = sum(_count_phrases(sl).values())
        inf = sum(1 for w in words(s) if w in INFORMAL) + s.count("!")
        closeness = 1 - _clamp(abs(ln - mean_len) / max(mean_len, 1))
        sscore = 0.35 * score + 0.3 * _clamp(ph / 2) + 0.15 * is_conn + 0.2 * closeness * burst
        sscore = _clamp(sscore - 0.2 * _clamp(inf / 2))
        sent_out.append({"text": s, "start": st, "end": en, "score": round(100 * sscore, 1)})

    warnings = []
    if n_words < 80:
        warnings.append("Teks terlalu pendek (< 80 kata); hasil deteksi AI kurang akurat.")
    if len(sentences) < 5:
        warnings.append("Jumlah kalimat sedikit; analisis variasi kalimat terbatas.")

    return {
        "score": score_pct,
        "label": label,
        "label_code": code,
        "word_count": n_words,
        "sentence_count": len(sentences),
        "signals": {k: round(100 * v, 1) for k, v in signals.items()} | {"informalitas": round(100 * informal, 1)},
        "stats": {
            "rata_panjang_kalimat": round(mean_len, 1),
            "variasi_panjang_kalimat_cv": round(cv, 3) if cv is not None else None,
            "mattr": round(m, 3),
            "frasa_ai_per_100_kata": round(density, 2),
        },
        "ai_phrases_found": dict(sorted(phrase_hits.items(), key=lambda x: -x[1])),
        "sentences": sent_out,
        "warnings": warnings,
        "disclaimer": "Deteksi AI bersifat probabilistik dan dapat keliru. Jangan jadikan satu-satunya dasar keputusan.",
    }
