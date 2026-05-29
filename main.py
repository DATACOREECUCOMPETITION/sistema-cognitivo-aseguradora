import logging
import mimetypes
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

# Registrar MIME types adicionales para compatibilidad en el navegador
mimetypes.add_type("application/javascript", ".jsx")

# Importación de enrutadores y servicios core
from api.endpoints import router as api_router
from core.config import settings
from services.sri_client import SRIClient
from services.data_loader import DataLoader

# Configuración de Logging del Sistema
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("app_main")


# ==============================================================================
# MANEJADOR DEL CICLO DE VIDA (LIFESPAN / STARTUP)
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Controla el ciclo de vida de la aplicación.
    Al levantar el servidor, realiza comprobaciones de conectividad con Redis y el estado del pool.
    """
    logger.info("======================================================================")
    logger.info("INICIALIZANDO MOTOR ANTIFRAUDE - ASEGURADORA DEL SUR")
    logger.info("======================================================================")
    
    # Inicialización e Integración del DataLoader físico
    try:
        data_loader = DataLoader()
        app.state.data_loader = data_loader
        logger.info("✓ Instancia de DataLoader física inicializada y montada en app.state.")
    except Exception as e:
        logger.error(f"Fallo al inicializar el DataLoader: {str(e)}")
        
    # Verificación silenciosa de conectividad con la base de datos Redis

    try:
        sri = SRIClient()
        db = await sri._get_redis()
        # Ping silencioso para probar conexión
        await db.ping()
        logger.info("✓ Conexión exitosa y activa con el pool asíncrono de Redis (L2 Cache).")
    except Exception as e:
        logger.error(
            f"⚠ Redis L2 Cache no se encuentra disponible. "
            f"El motor operará en modo Degradación Suave de alto rendimiento local: {str(e)}"
        )
        
    logger.info("✓ Todos los microservicios cognitivos y matemáticos se encuentran listos.")
    yield
    
    logger.info("Cerrando recursos del servidor FastAPI...")


# ==============================================================================
# CONFIGURACIÓN GENERAL DE FASTAPI
# ==============================================================================

app = FastAPI(
    title="Motor Híbrido Antifraude - Aseguradora del Sur",
    version="1.0.0",
    description=(
        "API del Sistema Analítico e Inteligencia Artificial para la detección de fraudes "
        "en siniestros automotrices. Combina reglas complejas deterministicas multi-tabla, "
        "enriquecimiento impositivo con el SRI, Isolation Forest probabilístico y análisis "
        "de estilometría forense con Gemini 2.5 Flash."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


# ==============================================================================
# MIDDLEWARE DE POLÍTICAS DE RED CORS
# ==============================================================================

# Permite interconexión fluida y directa con el frontend de desarrollo y Lovable
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ==============================================================================
# INCLUSIÓN DE ENRUTADORES MODULARES
# ==============================================================================

# Registra los endpoints bajo el prefijo contractual /api/v1
app.include_router(api_router)


# ==============================================================================
# RUTAS DE INTERFAZ FRONTEND Y ARCHIVOS ESTÁTICOS
# ==============================================================================

# Monta la carpeta 'static' conteniendo los archivos JSX/JS del frontend modular React
app.mount("/static", StaticFiles(directory="static"), name="static")

# Ruta raíz para servir el dashboard SPA
@app.get("/")
async def serve_frontend():
    return FileResponse("templates/index.html")


# ==============================================================================
# BLOQUE DE EJECUCIÓN DIRECTA LOCAL
# ==============================================================================

if __name__ == "__main__":
    logger.info("Levantando servidor de desarrollo Uvicorn...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
