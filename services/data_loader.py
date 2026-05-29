import os
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

# Configuración de Logging
logger = logging.getLogger("data_loader")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# CARGADOR DE DATOS DE ALTA DISPONIBILIDAD (CLEAN ARCHITECTURE DATA LAYER)
# ==============================================================================

class DataLoader:
    """
    Componente de acceso a datos encargado de cargar, sanear y limpiar
    los datasets en formato CSV desde el almacenamiento raw local.
    
    Implementa fallbacks de contingencia ante ausencia física de archivos
    para garantizar resiliencia en tiempo de ejecución.
    """
    
    def __init__(self, base_dir: Optional[str] = None) -> None:
        """
        Inicializa las rutas temáticas de los archivos CSV físicos del repositorio.
        """
        self.base_dir: str = base_dir if base_dir else "/home/hackaton/HACKATON_FINAL"
        
        # Rutas temáticas de almacenamiento raw estándar
        self.paths: Dict[str, str] = {
            "siniestros": os.path.join(self.base_dir, "data/raw/siniestros.csv"),
            "polizas": os.path.join(self.base_dir, "data/raw/polizas.csv"),
            "asegurados": os.path.join(self.base_dir, "data/raw/asegurados.csv"),
            "proveedores": os.path.join(self.base_dir, "data/raw/proveedores.csv"),
            "endosos": os.path.join(self.base_dir, "data/raw/endosos.csv")
        }
        
        # Columnas mínimas requeridas por cada DataFrame para fallbacks de contingencia
        self.required_columns: Dict[str, List[str]] = {
            "siniestros": [
                "claim_id", "poliza_id", "id_poliza", "asegurado_id", "id_asegurado", 
                "proveedor_id", "id_proveedor", "ramo", "fecha_siniestro", "fecha_reporte", 
                "monto_reclamado", "monto_reclamacion", "lat_siniestro", "lon_siniestro", 
                "severidad", "narrativa_libre"
            ],
            "polizas": ["poliza_id", "id_poliza", "asegurado_id", "id_asegurado", "fecha_inicio", "fecha_fin", "broker_id"],
            "asegurados": ["asegurado_id", "id_asegurado", "nombre_completo", "identificador_fiscal", "estres_financiero", "lat_domicilio", "lon_domicilio"],
            "proveedores": ["proveedor_id", "id_proveedor", "nombre", "identificador_fiscal", "lat_proveedor", "lon_proveedor"],
            "endosos": ["poliza_id", "id_poliza", "fecha_endoso", "tipo_endoso"]
        }

        
        # Diccionario contenedor de DataFrames cargados
        self.datasets: Dict[str, pd.DataFrame] = {}
        
        # Ejecutar carga inicial automática
        self.cargar_y_limpiar_datasets()

    def cargar_y_limpiar_datasets(self) -> Dict[str, pd.DataFrame]:
        """
        Carga los 4 archivos CSV físicos saneándolos rigurosamente mediante Pandas.
        
        Saneamientos Aplicados:
        1. Conversión explícita de campos temporales a datetime64[ns] de Pandas.
        2. Recorte de espacios en blanco (strip) en cadenas y claves indexables.
        3. Imputación segura de valores NaN en variables numéricas continuas con 0.0.
        
        Returns:
            Dict[str, pd.DataFrame]: Mapeo de DataFrames saneados listos para uso analítico.
        """
        for name, path in self.paths.items():
            try:
                if not os.path.exists(path):
                    raise FileNotFoundError(f"Archivo físico no encontrado: {path}")
                    
                logger.info(f"Cargando dataset físico: {name} desde {path}...")
                df = pd.read_csv(path)
                
                # Saneamiento A: Limpieza de espacios en blanco en columnas de texto
                for col in df.columns:
                    if df[col].dtype == object:
                        df[col] = df[col].astype(str).str.strip()
                        
                # Saneamiento B: Conversión explícita a datetime64
                date_cols = ["fecha_siniestro", "fecha_reporte", "fecha_inicio", "fecha_fin", "fecha_ocurrencia"]
                for col in date_cols:
                    if col in df.columns:
                        df[col] = pd.to_datetime(df[col], errors="coerce")
                        
                # Saneamiento C: Imputación de nulos numéricos (NaN) a 0.0
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                for col in numeric_cols:
                    df[col] = df[col].fillna(0.0)
                    
                self.datasets[name] = df
                logger.info(f"✓ Dataset {name} cargado con éxito ({len(df)} registros).")
                
            except (FileNotFoundError, Exception) as e:
                logger.error(
                    f"⚠ ALERTA CRÍTICA DE ALMACENAMIENTO: No se pudo cargar '{name}' desde '{path}'. "
                    f"Detalle: {str(e)}"
                )
                # Fallback de Contingencia Local: Evita caídas catastróficas del servidor
                self.datasets[name] = pd.DataFrame(columns=self.required_columns[name])
                logger.warning(f"✓ Generado DataFrame de contingencia vacío para: {name}.")
                
        return self.datasets

    def obtener_caso_por_id(self, claim_id: str) -> Dict[str, Any]:
        """
        Filtra un siniestro por ID y realiza un cruce (merge/join) asimétrico en caliente
        con pólizas, asegurados y proveedores para consolidar un registro plano enriquecido.
        
        Soporta y homogeneiza variaciones terminológicas (ej. poliza_id / id_poliza)
        y previene fugas de serialización convirtiendo tipos NumPy/Pandas a tipos nativos de Python.
        
        Args:
            claim_id: Identificador del siniestro a consultar.
            
        Returns:
            Dict[str, Any]: Diccionario plano enriquecido, vacío si el claim no existe.
        """
        df_s = self.datasets.get("siniestros", pd.DataFrame())
        df_p = self.datasets.get("polizas", pd.DataFrame())
        df_a = self.datasets.get("asegurados", pd.DataFrame())
        df_pr = self.datasets.get("proveedores", pd.DataFrame())
        
        if df_s.empty:
            return {}
            
        # 1. Filtro rápido del siniestro raíz
        claim_df = df_s[df_s["claim_id"] == claim_id]
        if claim_df.empty:
            logger.warning(f"El claim_id '{claim_id}' no existe en el dataset de siniestros.")
            return {}
            
        merged = claim_df.copy()
        
        # 2. Cruce en caliente con Pólizas (soporta variantes poliza_id / id_poliza)
        p_key = "poliza_id" if "poliza_id" in merged.columns else "id_poliza"
        p_join = "poliza_id" if "poliza_id" in df_p.columns else "id_poliza"
        if p_key in merged.columns and p_join in df_p.columns and not df_p.empty:
            merged = merged.merge(df_p, left_on=p_key, right_on=p_join, how="left", suffixes=("", "_poliza"))
            
        # 3. Cruce en caliente con Asegurados (soporta variantes asegurado_id / id_asegurado)
        a_key = "asegurado_id" if "asegurado_id" in merged.columns else "id_asegurado"
        a_join = "asegurado_id" if "asegurado_id" in df_a.columns else "id_asegurado"
        if a_key in merged.columns and a_join in df_a.columns and not df_a.empty:
            merged = merged.merge(df_a, left_on=a_key, right_on=a_join, how="left", suffixes=("", "_asegurado"))
            
        # 4. Cruce en caliente con Proveedores (soporta variantes proveedor_id / id_proveedor)
        pr_key = "proveedor_id" if "proveedor_id" in merged.columns else "id_proveedor"
        pr_join = "proveedor_id" if "proveedor_id" in df_pr.columns else "id_proveedor"
        if pr_key in merged.columns and pr_join in df_pr.columns and not df_pr.empty:
            merged = merged.merge(df_pr, left_on=pr_key, right_on=pr_join, how="left", suffixes=("", "_proveedor"))
            
        # 5. Sanitización de tipado NumPy/Pandas para exportación segura a Pydantic
        result_dict = merged.iloc[0].to_dict()
        
        for k, v in list(result_dict.items()):
            if pd.isnull(v):
                result_dict[k] = None
            elif isinstance(v, pd.Timestamp):
                result_dict[k] = v.isoformat()
            elif isinstance(v, (np.integer, int)):
                result_dict[k] = int(v)
            elif isinstance(v, (np.floating, float)):
                result_dict[k] = float(v)
            elif isinstance(v, np.ndarray):
                result_dict[k] = v.tolist()
                
        return result_dict
