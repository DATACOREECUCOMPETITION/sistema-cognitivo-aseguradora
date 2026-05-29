import logging
from typing import Any, Dict, List, Optional, Set
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Configuración del logger
logger = logging.getLogger("anomaly_detector")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# DETECTOR DE ANOMALÍAS PROBABILÍSTICO (ISOLATION FOREST & PENALIZACIÓN GRAFOS)
# ==============================================================================

class AnomalyDetector:
    """
    Motor probabilístico no supervisado de detección de anomalías basado en Isolation Forest.
    Diseñado para operar con eficiencia en VPS de recursos limitados (2GB RAM).
    
    Integra hiperparámetros de baja contaminación y un factor de penalización aditivo
    basado en clústeres de colisión geográfica/organizacional (grafos de colisión).
    """
    
    # Clústeres observados locales de proveedores y asegurados sospechosos (Grafos de colisión)
    SUSPICIOUS_PROVIDERS: Set[str] = {
        "PROV-9081", "PROV-4421", "PROV-1102", "PROV-8854", "PROV-3312"
    }
    
    SUSPICIOUS_INSUREDS: Set[str] = {
        "ASEG-7701", "ASEG-3092", "ASEG-1154", "ASEG-9904", "ASEG-5510"
    }

    def __init__(self) -> None:
        """
        Inicializa el detector calibrando estrictamente los hiperparámetros del Isolation Forest
        para estabilizar el comportamiento de los árboles y limitar falsos positivos.
        """
        # Hiperparámetros de calibración antifraude
        self.n_estimators: int = 250       # Estabilización estricta de la semilla estocástica
        self.contamination: float = 0.012   # 1.2% acorde a la tasa real de fraudes de seguros en LATAM
        self.random_state: int = 42         # Semilla reproducible fija
        
        # Modelo y Normalizador
        self.model: IsolationForest = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1  # Ejecución paralela eficiente utilizando todos los cores del VPS
        )
        self.scaler: StandardScaler = StandardScaler()
        self.is_trained: bool = False

    def entrenar_modelo(self, df_historico: pd.DataFrame) -> None:
        """
        Extrae y normaliza las variables continuas para entrenar los árboles del Isolation Forest.
        
        Variables críticas normalizadas:
        - `monto_reclamado`: Magnitud económica del siniestro.
        - `dias_desde_inicio_poliza`: Cercanía con el inicio del contrato.
        - `dias_desde_fin_poliza`: Cercanía con el fin del contrato.
        - `dias_entre_ocurrencia_reporte`: Retraso temporal en la notificación.
        
        Args:
            df_historico: DataFrame consolidado de siniestros históricos.
        """
        try:
            logger.info("Iniciando entrenamiento del modelo Isolation Forest...")
            
            # 1. Extracción de características numéricas críticas
            X = self._extraer_caracteristicas(df_historico)
            
            if X.shape[0] < 10:
                logger.warning("Dataset histórico demasiado pequeño para entrenar Isolation Forest de forma robusta.")
                return
                
            # 2. Normalización de características
            X_scaled = self.scaler.fit_transform(X)
            
            # 3. Entrenamiento del modelo de aislamiento
            self.model.fit(X_scaled)
            self.is_trained = True
            logger.info("✓ Modelo Isolation Forest entrenado y calibrado con éxito.")
            
        except Exception as e:
            logger.error(f"Fallo al entrenar el modelo Isolation Forest: {str(e)}")
            self.is_trained = False

    def calcular_score_probabilistico(self, datos_siniestro: Dict[str, Any]) -> float:
        """
        Calcula un puntaje probabilístico de anomalía continuo de 0.0 a 100.0.
        
        Aplica una escala sigmoidal sobre las trayectorias de .score_samples() y añade
        una penalización aditiva si el caso coincide con grafos de colisión en memoria.
        
        En caso de error o falta de entrenamiento, retorna un score por defecto conservador (50.0).
        
        Args:
            datos_siniestro: Diccionario con la información del siniestro a evaluar.
            
        Returns:
            Flotante entre 0.0 (normal) y 100.0 (anomalía inequívoca).
        """
        if not self.is_trained:
            logger.warning("El detector de anomalías no está entrenado. Retornando puntaje neutro por defecto.")
            return 50.0
            
        try:
            # 1. Construir DataFrame de una fila para aplicar normalización
            df_siniestro = pd.DataFrame([datos_siniestro])
            X_sin = self._extraer_caracteristicas(df_siniestro)
            
            # 2. Escalar características usando los parámetros del entrenamiento histórico
            X_sin_scaled = self.scaler.transform(X_sin)
            
            # 3. Obtener score crudo de aislamiento
            # score_samples() en sklearn retorna la negación de la puntuación de anomalía:
            # Rango típico: [-0.8, -0.3], donde valores más negativos representan mayor nivel de anomalía
            raw_score = float(self.model.score_samples(X_sin_scaled)[0])
            
            # 4. Normalización a escala continua 0-100 mediante función sigmoide calibrada
            # x0 = -0.55 (punto de inflexión medio), k = 12.0 (pendiente de transición rápida)
            # score_scaled = 1 / (1 + exp(k * (raw_score - x0))) * 100
            k = 12.0
            x0 = -0.55
            score_prob = 1.0 / (1.0 + np.exp(k * (raw_score - x0))) * 100.0
            
            # 5. Penalización por interconectividad de grafos (clústeres sospechosos)
            id_prov = datos_siniestro.get("proveedor_id", "")
            id_aseg = datos_siniestro.get("asegurado_id", "")
            
            penalizacion = 0.0
            if id_prov in self.SUSPICIOUS_PROVIDERS:
                penalizacion += 15.0
                logger.info(f"Aplicando penalización por red de colisión del proveedor: {id_prov} (+15.0)")
                
            if id_aseg in self.SUSPICIOUS_INSUREDS:
                penalizacion += 15.0
                logger.info(f"Aplicando penalización por red de colisión del asegurado: {id_aseg} (+15.0)")
                
            # Aplicar penalización aditiva y recortar al límite superior
            final_score = min(100.0, score_prob + penalizacion)
            
            logger.info(f"Cálculo completado. Score crudo: {raw_score:.4f} -> Probabilidad: {score_prob:.2f}% -> Final con Grafos: {final_score:.2f}")
            return float(final_score)
            
        except Exception as e:
            logger.error(f"Error matemático durante el cálculo del score de anomalía: {str(e)}")
            # Fail-safe: Retornar score neutro para mantener la continuidad operativa
            return 50.0

    def _extraer_caracteristicas(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extrae y preprocesa estrictamente los campos continuos requeridos por el modelo.
        """
        df_feats = pd.DataFrame(index=df.index)
        
        # A. Magnitud monetaria
        df_feats["monto_reclamado"] = df["monto_reclamado"].astype(float)
        
        # B. Tiempos asociados al ciclo de vida de la póliza
        f_siniestro = pd.to_datetime(df["fecha_siniestro"])
        f_inicio_pol = pd.to_datetime(df["fecha_inicio_poliza"])
        f_fin_pol = pd.to_datetime(df["fecha_fin_poliza"])
        
        df_feats["dias_desde_inicio_poliza"] = (f_siniestro - f_inicio_pol).dt.days.abs()
        df_feats["dias_desde_fin_poliza"] = (f_fin_pol - f_siniestro).dt.days.abs()
        
        # C. Tiempo de demora del reporte
        f_reporte = pd.to_datetime(df["fecha_reporte"])
        df_feats["dias_entre_ocurrencia_reporte"] = (f_reporte - f_siniestro).dt.days.abs()
        
        # Rellenar valores nulos imprevistos con la mediana estadística
        df_feats = df_feats.fillna(df_feats.median().fillna(0))
        
        return df_feats
