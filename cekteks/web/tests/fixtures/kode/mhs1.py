# Template dari dosen: jangan diubah
import sys

def baca_data(nama_berkas):
    data = []
    with open(nama_berkas) as f:
        for baris in f:
            bagian = baris.strip().split(",")
            data.append((bagian[0], float(bagian[1])))
    return data

# Menghitung rata-rata dan menentukan huruf mutu
def rata_rata(nilai):
    total = 0
    for n in nilai:
        total += n
    return total / len(nilai)

def huruf_mutu(skor):
    if skor >= 85:
        return "A"
    elif skor >= 70:
        return "B"
    elif skor >= 55:
        return "C"
    else:
        return "D"

def laporan(data):
    hasil = {}
    for nama, skor in data:
        hasil[nama] = huruf_mutu(skor)
    terbaik = max(data, key=lambda x: x[1])
    print("Rata-rata kelas:", rata_rata([s for _, s in data]))
    print("Nilai tertinggi:", terbaik[0], terbaik[1])
    return hasil

if __name__ == "__main__":
    print(laporan(baca_data(sys.argv[1])))
