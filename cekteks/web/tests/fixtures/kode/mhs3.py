# Template dari dosen: jangan diubah
import sys

def baca_data(nama_berkas):
    data = []
    with open(nama_berkas) as f:
        for baris in f:
            bagian = baris.strip().split(",")
            data.append((bagian[0], float(bagian[1])))
    return data

class Statistik:
    def __init__(self, data):
        self.data = sorted(data, key=lambda t: -t[1])

    def median(self):
        xs = [v for _, v in self.data]
        n = len(xs)
        tengah = n // 2
        return xs[tengah] if n % 2 else (xs[tengah - 1] + xs[tengah]) / 2

    def peringkat(self):
        return {nama: i + 1 for i, (nama, _) in enumerate(self.data)}

if __name__ == "__main__":
    s = Statistik(baca_data(sys.argv[1]))
    print("Median", s.median())
    print(s.peringkat())
