FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "gunicorn>=27.0.1,<28"
COPY . .
# Jalan sebagai pengguna biasa, bukan root, agar celah di aplikasi tidak memberi akses penuh ke kontainer.
RUN useradd --system --uid 10001 cekteks && chown -R cekteks /app
USER cekteks
EXPOSE 8000
# Batas waktu dan ukuran permintaan menahan klien lambat (slowloris) dan permintaan raksasa.
CMD ["gunicorn", "-b", "0.0.0.0:8000", "-w", "2", "--timeout", "60", "--limit-request-line", "8190", "--limit-request-fields", "100", "app:app"]
