# Template dari dosen: jangan diubah
import sys

def baca_data(nama_berkas):
    data = []
    with open(nama_berkas) as f:
        for baris in f:
            bagian = baris.strip().split(",")
            data.append((bagian[0], float(bagian[1])))
    return data

def hitung_mean(daftar_angka):   # fungsi rata rata buatan saya
    jumlah = 0
    for a in daftar_angka:
        jumlah += a
    return jumlah/len(daftar_angka)

def konversi_grade(nilai_akhir):
    """Ubah angka jadi huruf"""
    if nilai_akhir >= 85:
        return 'A'
    elif nilai_akhir >= 70:
        return 'B'
    elif nilai_akhir >= 55:
        return 'C'
    else:
        return 'D'

def cetak_rekap(mahasiswa):
    rekap = {}
    for nm, sk in mahasiswa:
        rekap[nm] = konversi_grade(sk)
    juara = max(mahasiswa, key=lambda m: m[1])
    print("Rata-rata:", hitung_mean([s for _, s in mahasiswa]))
    print("Tertinggi:", juara[0], juara[1])
    return rekap

if __name__ == "__main__":
    print(cetak_rekap(baca_data(sys.argv[1])))
