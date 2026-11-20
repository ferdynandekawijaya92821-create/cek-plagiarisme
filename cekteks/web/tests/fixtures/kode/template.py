# Template dari dosen: jangan diubah
import sys

def baca_data(nama_berkas):
    data = []
    with open(nama_berkas) as f:
        for baris in f:
            bagian = baris.strip().split(",")
            data.append((bagian[0], float(bagian[1])))
    return data
