# ============================================================
# Plataforma Antifraude — Aseguradora del Sur
# Dockerfile de Producción
# ============================================================
FROM python:3.13-slim

# Metadatos
LABEL maintainer="Aseguradora del Sur"
LABEL description="Motor Híbrido Antifraude v2.0.0"

# Variables de entorno del sistema
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalar dependencias del sistema (para Pillow, lxml, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python primero (cache layer)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install gunicorn && \
    pip install -r requirements.txt

# Copiar todo el código fuente
COPY . .

# Crear directorios de datos persistentes si no existen
RUN mkdir -p data/raw data/uploads/claims REPORTES

# Exponer el puerto de la aplicación
EXPOSE 8000

# Comando de producción: Gunicorn con workers Uvicorn async
# workers = (2 × CPUs) + 1  →  para VPS de 2 cores = 5 workers
CMD ["gunicorn", "main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "3", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keepalive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
