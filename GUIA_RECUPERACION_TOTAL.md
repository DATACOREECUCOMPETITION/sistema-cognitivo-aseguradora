# 🛡️ GUÍA DE RECUPERACIÓN TOTAL — FRAUDIA CLAIMS
### hackIAthon 2026 — Aseguradora del Sur
> **Propósito:** Esta guía técnica auto-contenida y de referencia absoluta permite borrar toda la infraestructura, contenedores y archivos, y reconstruir el sistema completo desde cero en 5 minutos en el VPS.

---

## 🔑 1. SECRETOS, TOKENS Y VARIABLES DE ENTORNO

Guarda esta sección de forma segura, ya que contiene las credenciales activas provistas por la competencia:

### A. Archivo `.env` (Raíz del Proyecto: `/root/hackathon-ia/.env`)
```ini
# ── CLOUDFLARE TUNNEL TOKENS ─────────────────────────────────
TOKEN_INDEX=eyJhIjoiYzY2MGQ1MjQyMGQ4YTJiZjJjNGQwMzRkYzdkNDg5NDUiLCJ0IjoiNWNlNjU2MWYtYzU1Ny00OTMwLWEyYWItYmIyYmZmMDMwMTM1IiwicyI6IlptUTNNakZqTURZdFlqRmtNQzAwT1RFNExXRTBORGN0TXpKbU9ERXdOakpsTnpFMyJ9
TOKEN_PANEL=eyJhIjoiYzY2MGQ1MjQyMGQ4YTJiZjJjNGQwMzRkYzdkNDg5NDUiLCJ0IjoiYTU5NmJhNmUtNWU0Yi00YzAxLTk3MjMtODY4MjFmMjM1ZjMzIiwicyI6Ik9HTXpNMlpoTkdRdFl6TTVZUzAwT1RGaExXRmlOelF0WXpFMVltSTVaak5oWm1KbSJ9
TOKEN_WEBHOOKS=eyJhIjoiYzY2MGQ1MjQyMGQ4YTJiZjJjNGQwMzRkYzdkNDg5NDUiLCJ0IjoiZWE5YmE1YmQtMzdiMi00Y2RkLWJkNjItYjkxMGZkMDI3NmZlIiwicyI6IllqQXpOVGhoWWpNdFlUWXdNaTAwWTJKbUxXRmxaVE10WWpBNU5EUXlaV1V6TnpNMiJ9
```

### B. Credenciales de la Base de Datos PostgreSQL
*   **Base de Datos:** `n8n_data_hackaton`
*   **Usuario Admin:** `DATACORE_ADMIN`
*   **Contraseña:** `admin3429@`
*   **Puerto Host:** `5432`

---

## 🏗️ 2. INFRAESTRUCTURA DE CONTENEDORES (DOCKER & NGINX)

### A. Archivo `docker-compose.yml` (Ruta: `/root/hackathon-ia/docker-compose.yml`)
```yaml
version: '3.8'

services:
  db:
    image: postgres:17-alpine
    container_name: hackathon-postgres
    restart: always
    environment:
      POSTGRES_DB: n8n_data_hackaton
      POSTGRES_USER: DATACORE_ADMIN
      POSTGRES_PASSWORD: admin3429@
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  nginx:
    image: nginx:alpine
    container_name: hackathon-nginx
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx/hackathon.conf:/etc/nginx/conf.d/default.conf:ro
      # Frontend estático Next.js (carpeta /out generada por next build)
      - ./HACKATON_FINAL/fraudia-frontend/out:/usr/share/nginx/html:ro
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      - db

  cloudflared-index:
    image: cloudflare/cloudflared:latest
    container_name: hackathon-cloudflared-index
    restart: always
    network_mode: "host"
    environment:
      - TUNNEL_TOKEN=${TOKEN_INDEX}
    command: tunnel run

  cloudflared-panel:
    image: cloudflare/cloudflared:latest
    container_name: hackathon-cloudflared-panel
    restart: always
    network_mode: "host"
    environment:
      - TUNNEL_TOKEN=${TOKEN_PANEL}
    command: tunnel run

  cloudflared-webhooks:
    image: cloudflare/cloudflared:latest
    container_name: hackathon-cloudflared-webhooks
    restart: always
    network_mode: "host"
    environment:
      - TUNNEL_TOKEN=${TOKEN_WEBHOOKS}
    command: tunnel run

volumes:
  postgres_data:
```

### B. Archivo `nginx/hackathon.conf` (Ruta: `/root/hackathon-ia/nginx/hackathon.conf`)
```nginx
server {
    listen 80;
    server_name index.datacoreecuadorcompetition.online webhooks.datacoreecuadorcompetition.online localhost;

    # ── Logs ──────────────────────────────────────────────────
    access_log /var/log/nginx/hackathon_access.log;
    error_log  /var/log/nginx/hackathon_error.log;

    # ── Gzip ──────────────────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # ── CORS Global ───────────────────────────────────────────
    add_header Access-Control-Allow-Origin  "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;

    # ── Preflight OPTIONS ─────────────────────────────────────
    if ($request_method = OPTIONS) {
        return 204;
    }

    # ── Proxy FastAPI Backend (Fraudia Claims) ────────────────
    location /api/ {
        proxy_pass         http://host.docker.internal:8000/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        client_max_body_size 10M;
    }

    # ── Proxy Webhook N8N ─────────────────────────────────────
    location /webhook/ {
        proxy_pass         http://host.docker.internal:5678/webhook/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        client_max_body_size 10M;
    }

    # ── Frontend Next.js (HTML Estático) ─────────────────────
    location / {
        root  /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ── Health check ──────────────────────────────────────────
    location /health {
        return 200 '{"status":"ok","service":"fraudia-claims","version":"1.0.0"}';
        add_header Content-Type application/json;
    }
}
```

---

## 🐍 3. BACKEND (FASTAPI) Y SERVICIO SYSTEMD

### A. Dependencias de Python (`requirements.txt`)
Ubicado en `/root/hackathon-ia/HACKATON_FINAL/fraudia-backend/requirements.txt`:
```
fastapi>=0.100.0
uvicorn>=0.22.0
pydantic>=2.0
scikit-learn>=1.2.0
shap>=0.41.0
pillow>=9.5.0
reportlab>=4.0.0
httpx>=0.24.0
```

### B. Archivo del Servicio Systemd (`/etc/systemd/system/fraudia-backend.service`)
Permite levantar FastAPI en el host como proceso del sistema en segundo plano:
```ini
[Unit]
Description=Fraudia Claims FastAPI Backend — hackIAthon 2026
After=network.target
Documentation=https://github.com/fraudia-claims

[Service]
Type=simple
User=root
WorkingDirectory=/root/hackathon-ia/HACKATON_FINAL/fraudia-backend
Environment="SQLITE_DB_PATH=/root/hackathon-ia/HACKATON_FINAL/fraudia-backend/data/fraudia.db"
Environment="N8N_WEBHOOK_BASE=http://localhost:5678/webhook"
Environment="LLM_TIMEOUT_MS=3000"
ExecStart=/root/hackathon-ia/HACKATON_FINAL/fraudia-backend/.venv/bin/uvicorn src.app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## 🎛️ 4. PASO A PASO: DESTRUCCIÓN TOTAL Y RECONSTRUCCIÓN

Sigue esta receta de comandos en la consola SSH para borrar todo de raíz y levantarlo de forma impecable:

### ⚠️ PASO A: La Destrucción Absoluta (Limpieza Total)
```bash
# 1. Detener y borrar todos los contenedores Docker y sus VOLÚMENES de datos asociados (-v)
cd /root/hackathon-ia
docker-compose down -v --remove-orphans

# 2. Detener y deshabilitar el servicio del backend en el host
systemctl stop fraudia-backend
systemctl disable fraudia-backend

# 3. Eliminar la compilación anterior del frontend
rm -rf /root/hackathon-ia/HACKATON_FINAL/fraudia-frontend/out
rm -rf /root/hackathon-ia/HACKATON_FINAL/fraudia-frontend/.next
```

---

### 🚀 PASO B: La Reconstrucción Impecable (Desde Cero)

#### 1. Restaurar Permisos de Carpeta del Sistema (Crítico para Nginx)
```bash
# Otorgar permisos de travesía de directorios para que Nginx no lance 403 Forbidden
chmod 755 /root
```

#### 2. Reconstruir los Contenedores Docker (Postgres, Nginx, Tunnels)
```bash
cd /root/hackathon-ia

# Levantar los contenedores en segundo plano (re-descargará e iniciará todo limpio)
docker-compose up -d

# Verificar que los contenedores están arriba y corriendo
docker ps
```

#### 3. Restaurar y Levantar el Backend (FastAPI)
```bash
# Entrar al backend
cd /root/hackathon-ia/HACKATON_FINAL/fraudia-backend

# Crear el entorno virtual limpio
python3 -m venv .venv

# Activar el entorno virtual e instalar dependencias
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Inicializar/entrenar el modelo de Machine Learning si no existe
# (Crea scaler.pkl, fraud_model.pkl y la base SQLite inicial con el dataset)
python3 train_model.py

# Recargar el demonio de systemd para que reconozca el archivo del servicio
systemctl daemon-reload

# Habilitar e iniciar el backend FastAPI
systemctl enable fraudia-backend
systemctl start fraudia-backend

# Verificar que FastAPI esté en ejecución y saludable
systemctl status fraudia-backend --no-pager
curl -s http://localhost:8000/health
```

#### 4. Compilar y Desplegar el Frontend (Next.js)
```bash
# Entrar a la carpeta del frontend
cd /root/hackathon-ia/HACKATON_FINAL/fraudia-frontend

# Instalar dependencias locales si es necesario
npm install

# Compilar Next.js a HTML/JS Estático (genera la carpeta out/)
npm run build

# Reiniciar el contenedor de Nginx para limpiar cachés y validar volúmenes
docker restart hackathon-nginx

# Verificar que Nginx ya sirve el index con código 200 OK
curl -I http://localhost/
```

#### 5. Importar y Configurar n8n (Gemini Nativo)
1.  Copia todo el contenido estructurado y a prueba de fallos de tu archivo: **[workflow_fraudia_claims.json](file:///root/hackathon-ia/HACKATON_FINAL/workflow_fraudia_claims.json)**.
2.  Ve a tu navegador y entra al panel de n8n (`https://panel.datacoreecuadorcompetition.online`).
3.  Crea un nuevo workflow y pega el contenido con **`Ctrl + V`** (se dibujará el webhook `/webhook/fraudia-claims-agent` y el switch con los 4 Gemini nativos).
4.  Crea tu credencial de **Google Gemini API Key** pegando tu API key de Google y asóciala a los 4 nodos de Gemini en el lienzo.
5.  **Activa (Active: ON)** el workflow.

---

## 🧪 5. TEST DE VERIFICACIÓN FINAL EN VIVO

Una vez completada la reconstrucción, ejecuta este comando curl en el VPS. Si te devuelve `Offline: False`, significa que el backend, n8n, Gemini y la base de datos están conectados de forma impecable:

```bash
curl -s -X POST http://localhost:8000/claims/analyze \
  -H "Content-Type: application/json" \
  -d '{"claim_id":"SIN-8902","policy_days_active":3,"claimed_amount":15400,"average_amount":5800,"sum_insured":22000,"pdf_eof_count":3,"sri_access_key":"0506202301179264863900110010010000000011234567819","daños_parte":"choque frontal severo","repuestos_factura":["parachoques trasero","cajuela"],"use_ai":true}' \
  | python3 -m json.tool
```
