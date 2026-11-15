import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cekteks.ai_detector import detect_ai  # noqa: E402
from cekteks.plagiarism import check_plagiarism, compare_documents, load_corpus  # noqa: E402
from cekteks.text_utils import split_sentences  # noqa: E402
from cekteks.cli import main as cli_main  # noqa: E402
from app import app  # noqa: E402

AI_TEXT = """Di era digital saat ini, teknologi memainkan peran penting dalam kehidupan sehari-hari. Selain itu, perkembangan teknologi membuka peluang baru bagi masyarakat untuk berinovasi. Oleh karena itu, penting untuk dicatat bahwa pemanfaatan teknologi harus dilakukan secara bijak dan bertanggung jawab.

Lebih lanjut, pendidikan merupakan salah satu aspek penting yang terdampak oleh transformasi digital. Dengan demikian, para pendidik perlu memastikan bahwa proses pembelajaran tetap relevan dan efektif. Tidak dapat dipungkiri bahwa teknologi memberikan berbagai manfaat yang signifikan bagi dunia pendidikan.

Secara keseluruhan, teknologi memiliki dampak yang luas terhadap berbagai aspek kehidupan. Namun, tantangan dan peluang harus dihadapi dengan pemahaman yang mendalam. Kesimpulannya, kolaborasi antara berbagai pihak sangat penting untuk menciptakan masa depan yang berkelanjutan."""

HUMAN_TEXT = """Kemarin aku ke pasar sama ibu. Rame banget! Mau beli cabai aja antrinya panjang, padahal cuma dua ons. Ibu sih santai, malah ngobrol sama penjual sayur langganannya soal harga bawang yang naik lagi.

Pulangnya hujan. Kami neduh di warung kopi kecil dekat terminal, yang pemiliknya bapak-bapak tua berkumis tebal itu. Dia cerita dulu warungnya pernah kebanjiran sampai sepinggang, tahun 2007 kalau nggak salah. Aku cuma manggut-manggut sambil nyeruput teh manis yang kemanisan.

Sampai rumah udah magrib. Capek, tapi seru juga sih. Lain kali mungkin aku bawa payung."""


def test_split_sentences_offsets():
    text = "Halo dunia. Ini kalimat kedua! Apa kabar?"
    sents = split_sentences(text)
    assert [s for s, _, _ in sents] == ["Halo dunia.", "Ini kalimat kedua!", "Apa kabar?"]
    for s, a, b in sents:
        assert text[a:b] == s


def test_ai_detector_separates_examples():
    ai = detect_ai(AI_TEXT)
    human = detect_ai(HUMAN_TEXT)
    assert ai["score"] > 65 and ai["label_code"] == "ai"
    assert human["score"] < 35 and human["label_code"] == "human"
    assert "penting untuk dicatat" in ai["ai_phrases_found"]


def test_ai_detector_short_text_warns():
    r = detect_ai("Halo.")
    assert r["warnings"]
    assert 0 <= r["score"] <= 100


def test_plagiarism_exact_copy():
    r = check_plagiarism(AI_TEXT, [{"name": "asli", "text": AI_TEXT}])
    assert r["score"] == 100.0
    assert r["sources"][0]["cosine_similarity"] > 99


def test_plagiarism_partial_and_offsets():
    copied = "Pemanasan global adalah peningkatan suhu rata-rata permukaan bumi yang terutama disebabkan oleh aktivitas manusia."
    text = "Saya menulis pembuka sendiri tentang cuaca hari ini. " + copied + " Penutup ini juga tulisan saya."
    r = check_plagiarism(text, load_corpus(os.path.join(os.path.dirname(__file__), "..", "corpus")))
    assert 30 < r["score"] < 90
    assert r["sources"][0]["name"] == "pemanasan_global.txt"
    m = r["matches"][0]
    assert text[m["start"] : m["end"]] == m["text"]
    assert "aktivitas manusia" in m["text"]


def test_plagiarism_original_text():
    r = check_plagiarism(HUMAN_TEXT, [{"name": "x", "text": AI_TEXT}])
    assert r["score"] == 0.0 and r["matches"] == []


def test_compare_documents():
    pairs = compare_documents([
        {"name": "a", "text": AI_TEXT},
        {"name": "b", "text": AI_TEXT + " Tambahan."},
        {"name": "c", "text": HUMAN_TEXT},
    ])
    assert {pairs[0]["a"], pairs[0]["b"]} == {"a", "b"}
    assert pairs[-1]["a_in_b"] == 0.0


def test_api_endpoints():
    client = app.test_client()
    assert client.get("/").status_code == 200
    assert client.get("/api/health").get_json()["status"] == "ok"

    r = client.post("/api/check", json={"text": AI_TEXT, "sources": [{"name": "s", "text": AI_TEXT}]})
    data = r.get_json()
    assert r.status_code == 200
    assert data["plagiarism"]["score"] == 100.0 and data["ai"]["score"] > 65

    assert client.post("/api/check", json={"text": "  "}).status_code == 400
    assert client.post("/api/check", json={"text": "x", "mode": "zzz"}).status_code == 400
    r = client.post("/api/check", json={"text": HUMAN_TEXT, "mode": "ai"}).get_json()
    assert "plagiarism" not in r and "ai" in r

    r = client.post("/api/extract", data={"file": (io.BytesIO("halo dunia".encode()), "a.txt")})
    assert r.get_json()["text"] == "halo dunia"
    r = client.post("/api/extract", data={"file": (io.BytesIO(b"x"), "a.exe")})
    assert r.status_code == 400

    r = client.post("/api/compare", json={"docs": [{"name": "a", "text": AI_TEXT}, {"name": "b", "text": AI_TEXT}]})
    assert r.get_json()["pairs"][0]["a_in_b"] == 100.0


def test_cli_json(tmp_path, capsys):
    f = tmp_path / "esai.txt"
    f.write_text(AI_TEXT, encoding="utf-8")
    assert cli_main(["--json", "cek", str(f), "--no-corpus", "-s", str(f)]) == 0
    out = capsys.readouterr().out
    assert '"plagiarism"' in out and '"ai"' in out


def test_docx_extract(tmp_path):
    import docx

    from cekteks.file_reader import read_file

    p = tmp_path / "t.docx"
    d = docx.Document()
    d.add_paragraph("Paragraf satu.")
    d.add_paragraph("Paragraf dua.")
    d.save(p)
    assert read_file(str(p)) == "Paragraf satu.\n\nParagraf dua."
