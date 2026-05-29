import re
import math
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Set, Tuple

# ==============================================================================
# UTILERÍAS MATEMÁTICAS Y ALGORÍTMICAS (Python Puro, Numpy & Pandas)
# ==============================================================================

def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """
    Calcula la similitud de Jaro-Winkler entre dos cadenas de caracteres.
    Ideal para comparaciones ortográficas difusas de nombres de asegurados.
    
    Args:
        s1: Primera cadena de texto.
        s2: Segunda cadena de texto.
        
    Returns:
        Flotante entre 0.0 (completamente distintas) y 1.0 (exactamente iguales).
    """
    s1 = str(s1).strip().lower()
    s2 = str(s2).strip().lower()
    
    if s1 == s2:
        return 1.0
        
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0
        
    # Rango máximo de coincidencia de caracteres
    match_bound = max(len1, len2) // 2 - 1
    if match_bound < 0:
        match_bound = 0
        
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    
    matches = 0
    transpositions = 0
    
    # Búsqueda de coincidencias
    for i in range(len1):
        start = max(0, i - match_bound)
        end = min(len2, i + match_bound + 1)
        for j in range(start, end):
            if s2_matches[j]:
                continue
            if s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break
                
    if matches == 0:
        return 0.0
        
    # Búsqueda de transposiciones
    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1
        
    # Coeficiente Jaro
    jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0
    
    # Modificación de Winkler para prefijos idénticos (hasta 4 caracteres)
    prefix = 0
    for i in range(min(4, len1, len2)):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break
            
    # Factor de escala constante p = 0.1
    jaro_winkler = jaro + prefix * 0.1 * (1.0 - jaro)
    return jaro_winkler


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Aplica la fórmula geodésica de Haversine para calcular la distancia en kilómetros
    entre dos puntos sobre la superficie terrestre (esfera de radio medio 6,371 km).
    
    Args:
        lat1, lon1: Coordenadas del primer punto en grados decimales.
        lat2, lon2: Coordenadas del segundo punto en grados decimales.
        
    Returns:
        Distancia geodésica en kilómetros (float).
    """
    # Radio medio de la Tierra en kilómetros
    R = 6371.0
    
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    return R * c


# ==============================================================================
# MOTOR DETERMINISTA DE REGLAS COMPLEJAS (MDR)
# ==============================================================================

def regla_proximidad_temporal(
    df_siniestros: pd.DataFrame,
    df_polizas: pd.DataFrame,
    threshold_days: int = 5
) -> pd.Series:
    """
    Regla 1: Evalúa la diferencia de días entre la fecha del siniestro
    y las fechas de inicio/fin de vigencia de la póliza (dt <= 5 días).
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'poliza_id', 'fecha_siniestro']
        df_polizas: ['poliza_id', 'fecha_inicio', 'fecha_fin']
        
    Returns:
        pd.Series de booleanos mapeados al index original de df_siniestros.
    """
    merged = df_siniestros.merge(df_polizas, on="poliza_id", how="left")
    
    f_siniestro = pd.to_datetime(merged["fecha_siniestro"])
    f_inicio = pd.to_datetime(merged["fecha_inicio"])
    f_fin = pd.to_datetime(merged["fecha_fin"])
    
    dt_inicio = (f_siniestro - f_inicio).dt.days.abs()
    dt_fin = (f_siniestro - f_fin).dt.days.abs()
    
    anomaly = (dt_inicio <= threshold_days) | (dt_fin <= threshold_days)
    # Alinear la serie al índice del dataframe original
    anomaly.index = df_siniestros.index
    return anomaly


def regla_colusion_proveedor(
    df_siniestros: pd.DataFrame,
    threshold: float = 3.5
) -> pd.Series:
    """
    Regla 2: Calcula el Modified Z-Score basado en la Mediana y el MAD
    sobre los montos de reclamación de los proveedores para aislar sobrefacturaciones severas.
    
    Fórmula:
        M_i = (0.6745 * (x_i - Mediana)) / MAD
        
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'proveedor_id', 'monto_reclamacion']
        
    Returns:
        pd.Series de booleanos mapeados al index original de df_siniestros.
    """
    result = pd.Series(False, index=df_siniestros.index)
    
    for prov_id, group in df_siniestros.groupby("proveedor_id"):
        montos = group["monto_reclamacion"].to_numpy()
        if len(montos) < 3:
            continue  # No hay suficientes muestras para estadísticas robustas
            
        median = np.median(montos)
        deviations = np.abs(montos - median)
        mad = np.median(deviations)
        
        # Evitar división por cero
        if mad == 0.0:
            # Fallback a desviación estándar estándar no nula
            std = np.std(montos)
            mad = std if std > 0.0 else 1e-5
            
        modified_z = (0.6745 * (montos - median)) / mad
        anomalies_indices = group.index[np.abs(modified_z) >= threshold]
        result.loc[anomalies_indices] = True
        
    return result


def regla_duplicidad_identidad(
    df_asegurados: pd.DataFrame,
    threshold: float = 0.85
) -> pd.DataFrame:
    """
    Regla 3: Utiliza comparaciones ortográficas difusas de Jaro-Winkler para detectar
    asegurados con nombres sospechosamente similares pero identificadores fiscales alternativos.
    
    DataFrames Requeridos:
        df_asegurados: ['asegurado_id', 'nombre_completo', 'identificador_fiscal']
        
    Returns:
        pd.DataFrame con los pares sospechosos detectados.
    """
    anomalies = []
    records = df_asegurados.to_dict("records")
    n = len(records)
    
    for i in range(n):
        for j in range(i + 1, n):
            rec1 = records[i]
            rec2 = records[j]
            
            # Si tienen el mismo identificador fiscal no es anomalía de duplicidad de identidad
            if rec1["identificador_fiscal"] == rec2["identificador_fiscal"]:
                continue
                
            sim = jaro_winkler_similarity(rec1["nombre_completo"], rec2["nombre_completo"])
            
            if sim >= threshold:
                anomalies.append({
                    "asegurado_id_a": rec1["asegurado_id"],
                    "nombre_a": rec1["nombre_completo"],
                    "fiscal_id_a": rec1["identificador_fiscal"],
                    "asegurado_id_b": rec2["asegurado_id"],
                    "nombre_b": rec2["nombre_completo"],
                    "fiscal_id_b": rec2["identificador_fiscal"],
                    "similitud_jaro_winkler": sim
                })
                
    return pd.DataFrame(anomalies)


def regla_cross_claiming(
    df_siniestros: pd.DataFrame,
    threshold_hours: int = 48
) -> pd.DataFrame:
    """
    Regla 4: Cruza ventanas de tiempo estrechas (<= 48 horas) para detectar siniestralidad
    simultánea del mismo asegurado en ramos distintos (ej. salud y vehículos).
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'asegurado_id', 'ramo', 'fecha_siniestro']
        
    Returns:
        pd.DataFrame con los pares de claims que configuran cross-claiming.
    """
    df = df_siniestros.copy()
    df["fecha_siniestro"] = pd.to_datetime(df["fecha_siniestro"])
    
    # Self-join por asegurado_id
    merged = df.merge(df, on="asegurado_id", suffixes=("_a", "_b"))
    
    # Filtrar siniestros cruzados en ramos distintos e IDs de reclamo distintos
    filtered = merged[
        (merged["claim_id_a"] < merged["claim_id_b"]) & 
        (merged["ramo_a"] != merged["ramo_b"])
    ].copy()
    
    dt_hours = (filtered["fecha_siniestro_a"] - filtered["fecha_siniestro_b"]).dt.total_seconds().abs() / 3600.0
    
    anomalies = filtered[dt_hours <= threshold_hours].copy()
    anomalies["diferencia_horas"] = dt_hours[dt_hours <= threshold_hours]
    
    return anomalies[[
        "asegurado_id", "claim_id_a", "ramo_a", "fecha_siniestro_a",
        "claim_id_b", "ramo_b", "fecha_siniestro_b", "diferencia_horas"
    ]]


def regla_clonacion_semantica(
    df_siniestros: pd.DataFrame,
    threshold: float = 0.8
) -> pd.DataFrame:
    """
    Regla 5: Implementa Similitud de Coseno sobre matrices de frecuencia de texto
    para detectar si la narrativa libre del siniestro fue copiada de reclamos de otros asegurados.
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'asegurado_id', 'narrativa_libre']
        
    Returns:
        pd.DataFrame con los pares de siniestros sospechosos de clonación semántica.
    """
    anomalies = []
    df = df_siniestros.dropna(subset=["narrativa_libre"]).copy()
    records = df.to_dict("records")
    n = len(records)
    
    if n < 2:
        return pd.DataFrame(anomalies)
        
    # Helper simple de tokenización de texto en minúsculas y palabras clave
    def tokenize(text: str) -> List[str]:
        tokens = re.findall(r"\b\w+\b", text.lower())
        # Filtro de stopwords en español básicas
        stopwords = {"el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "y", "a", "que", "se", "por", "con"}
        return [t for t in tokens if t not in stopwords]

    # Precalculo de bolsas de palabras (Word Bags)
    word_bags = []
    for r in records:
        tokens = tokenize(r["narrativa_libre"])
        freqs: Dict[str, int] = {}
        for token in tokens:
            freqs[token] = freqs.get(token, 0) + 1
        word_bags.append(freqs)
        
    for i in range(n):
        for j in range(i + 1, n):
            rec1, rec2 = records[i], records[j]
            
            # No es fraude si es el mismo asegurado (puede ser el mismo incidente)
            if rec1["asegurado_id"] == rec2["asegurado_id"]:
                continue
                
            bag1, bag2 = word_bags[i], word_bags[j]
            
            # Crear vocabulario común para los dos documentos
            all_words = set(bag1.keys()).union(set(bag2.keys()))
            if not all_words:
                continue
                
            # Construir vectores numéricos de frecuencia
            v1 = np.array([bag1.get(word, 0) for word in all_words], dtype=float)
            v2 = np.array([bag2.get(word, 0) for word in all_words], dtype=float)
            
            # Calcular Similitud de Coseno
            dot_val = np.dot(v1, v2)
            norm1 = np.linalg.norm(v1)
            norm2 = np.linalg.norm(v2)
            
            sim = 0.0
            if norm1 > 0.0 and norm2 > 0.0:
                sim = float(dot_val / (norm1 * norm2))
                
            if sim >= threshold:
                anomalies.append({
                    "claim_id_a": rec1["claim_id"],
                    "asegurado_id_a": rec1["asegurado_id"],
                    "narrativa_a": rec1["narrativa_libre"],
                    "claim_id_b": rec2["claim_id"],
                    "asegurado_id_b": rec2["asegurado_id"],
                    "narrativa_b": rec2["narrativa_libre"],
                    "similitud_coseno": sim
                })
                
    return pd.DataFrame(anomalies)


def regla_velocidad_post_modificacion(
    df_siniestros: pd.DataFrame,
    df_endosos: pd.DataFrame,
    df_polizas: pd.DataFrame,
    threshold_days: int = 15
) -> pd.Series:
    """
    Regla 6: Alerta si ocurre una reclamación de alta severidad dentro de los primeros
    15 días posteriores a un endoso o aumento de los límites de cobertura de la póliza.
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'poliza_id', 'fecha_siniestro', 'severidad'] 
                       (donde severidad es NivelGravedad o valor indicando alto impacto)
        df_endosos: ['poliza_id', 'fecha_endoso', 'tipo_endoso'] 
                    (tipo_endoso == 'AUMENTO_COBERTURA' o similar)
        df_polizas: ['poliza_id']
        
    Returns:
        pd.Series de booleanos mapeados al index de df_siniestros.
    """
    # Filtrar solo endosos de incremento de cobertura
    df_endosos_fil = df_endosos[df_endosos["tipo_endoso"].str.upper() == "AUMENTO_COBERTURA"]
    
    merged = df_siniestros.merge(df_endosos_fil, on="poliza_id", how="inner")
    
    f_siniestro = pd.to_datetime(merged["fecha_siniestro"])
    f_endoso = pd.to_datetime(merged["fecha_endoso"])
    
    dt_days = (f_siniestro - f_endoso).dt.days
    
    # Anómalo si:
    # 1. El siniestro ocurre posterior o el mismo día del endoso.
    # 2. Transcurren menos o igual de los días umbrales.
    # 3. La severidad del siniestro es alta ('CRITICAL' o 'HIGH').
    is_anomaly = (
        (dt_days >= 0) & 
        (dt_days <= threshold_days) & 
        (merged["severidad"].str.upper().isin(["CRITICAL", "HIGH"]))
    )
    
    anomaly_claims = merged.loc[is_anomaly, "claim_id"].unique()
    
    return df_siniestros["claim_id"].isin(anomaly_claims)


def regla_direccionamiento_broker(
    df_siniestros: pd.DataFrame,
    df_polizas: pd.DataFrame,
    threshold_prob: float = 0.7,
    min_claims: int = 5
) -> pd.DataFrame:
    """
    Regla 7: Calcula la probabilidad condicional de asignación para identificar
    brokers que direccionan sistemáticamente a sus asegurados hacia proveedores específicos.
    
    Fórmula:
        P(Proveedor | Broker) = Siniestros(Proveedor & Broker) / Siniestros(Broker)
        
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'poliza_id', 'proveedor_id']
        df_polizas: ['poliza_id', 'broker_id']
        
    Returns:
        pd.DataFrame con los pares (broker_id, proveedor_id) sospechosos y su probabilidad calculada.
    """
    merged = df_siniestros.merge(df_polizas, on="poliza_id", how="inner")
    
    # Conteo global de siniestros por broker
    broker_counts = merged.groupby("broker_id")["claim_id"].count().rename("total_broker_claims")
    
    # Conteo conjunto por broker y proveedor
    joint_counts = merged.groupby(["broker_id", "proveedor_id"])["claim_id"].count().rename("joint_claims").reset_index()
    
    # Cruzar conteos para calcular probabilidad condicional
    analisis = joint_counts.merge(broker_counts, on="broker_id")
    analisis["probabilidad_condicional"] = analisis["joint_claims"] / analisis["total_broker_claims"]
    
    # Filtrar por umbral de probabilidad y un mínimo de volumen representativo
    anomalies = analisis[
        (analisis["probabilidad_condicional"] >= threshold_prob) & 
        (analisis["total_broker_claims"] >= min_claims)
    ].copy()
    
    return anomalies.sort_values(by="probabilidad_condicional", ascending=False)


def regla_triangulacion_geografica(
    df_siniestros: pd.DataFrame,
    df_asegurados: pd.DataFrame,
    df_proveedores: pd.DataFrame,
    threshold_km: float = 200.0
) -> pd.Series:
    """
    Regla 8: Aplica la fórmula geodésica de Haversine para calcular la distancia en kilómetros
    entre el domicilio del asegurado, el lugar del siniestro y la sede del proveedor,
    alertando si supera los 200 km (siniestralidad simulada en papel).
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'asegurado_id', 'proveedor_id', 'lat_siniestro', 'lon_siniestro']
        df_asegurados: ['asegurado_id', 'lat_domicilio', 'lon_domicilio']
        df_proveedores: ['proveedor_id', 'lat_proveedor', 'lon_proveedor']
        
    Returns:
        pd.Series de booleanos mapeados al index original de df_siniestros.
    """
    m1 = df_siniestros.merge(df_asegurados, on="asegurado_id", how="left")
    m2 = m1.merge(df_proveedores, on="proveedor_id", how="left")
    
    anomalies = pd.Series(False, index=df_siniestros.index)
    
    records = m2.to_dict("records")
    for idx, r in enumerate(records):
        try:
            # Latitudes y Longitudes del triángulo geográfico
            lat_s, lon_s = float(r["lat_siniestro"]), float(r["lon_siniestro"])
            lat_d, lon_d = float(r["lat_domicilio"]), float(r["lon_domicilio"])
            lat_p, lon_p = float(r["lat_proveedor"]), float(r["lon_proveedor"])
            
            # Calcular distancias de los 3 lados
            d_asegurado_siniestro = haversine_distance(lat_d, lon_d, lat_s, lon_s)
            d_siniestro_proveedor = haversine_distance(lat_s, lon_s, lat_p, lon_p)
            d_asegurado_proveedor = haversine_distance(lat_d, lon_d, lat_p, lon_p)
            
            # Es anomalía si cualquier arista del triángulo supera la distancia umbral
            if (d_asegurado_siniestro > threshold_km or 
                d_siniestro_proveedor > threshold_km or 
                d_asegurado_proveedor > threshold_km):
                anomalies.iloc[idx] = True
        except (ValueError, TypeError, KeyError):
            # En caso de datos nulos o inválidos, no se marca para evitar falsos positivos
            continue
            
    return anomalies


def regla_smurfing_siniestros(
    df_siniestros: pd.DataFrame,
    audit_threshold: float = 5000.0,
    smurfing_range: float = 0.1,
    min_count: int = 3
) -> pd.DataFrame:
    """
    Regla 9: Identifica patrones de fraccionamiento de facturas (smurfing) analizando
    si un mismo proveedor concentra reclamaciones sospechosamente ubicadas justo por debajo del umbral de auditoría.
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'proveedor_id', 'monto_reclamacion']
        
    Returns:
        pd.DataFrame con los proveedores sospechosos, indicando cantidad e importe de reclamos en la "zona caliente".
    """
    min_limit = audit_threshold * (1.0 - smurfing_range)
    max_limit = audit_threshold
    
    # Filtrar reclamaciones que están en la zona caliente
    zona_caliente = df_siniestros[
        (df_siniestros["monto_reclamacion"] >= min_limit) & 
        (df_siniestros["monto_reclamacion"] < max_limit)
    ]
    
    # Agrupar por proveedor y contar volumen
    smurfing = zona_caliente.groupby("proveedor_id").agg(
        claims_zona_caliente=("claim_id", "count"),
        monto_promedio_zona_caliente=("monto_reclamacion", "mean")
    ).reset_index()
    
    # Filtrar proveedores con volumen sospechoso
    anomalies = smurfing[smurfing["claims_zona_caliente"] >= min_count].copy()
    
    # Calcular el porcentaje de siniestros de este proveedor que caen en esa zona caliente
    total_prov = df_siniestros.groupby("proveedor_id")["claim_id"].count().rename("total_claims").reset_index()
    anomalies = anomalies.merge(total_prov, on="proveedor_id")
    anomalies["ratio_smurfing"] = anomalies["claims_zona_caliente"] / anomalies["total_claims"]
    
    return anomalies.sort_values(by="ratio_smurfing", ascending=False)


def regla_siniestralidad_estacional(
    df_siniestros: pd.DataFrame,
    df_asegurados: pd.DataFrame
) -> pd.DataFrame:
    """
    Regla 10: Correlaciona el historial temporal para identificar reclamos repetitivos
    del mismo asegurado en los mismos meses en años sucesivos cruzado con estrés financiero.
    
    DataFrames Requeridos:
        df_siniestros: ['claim_id', 'asegurado_id', 'fecha_siniestro']
        df_asegurados: ['asegurado_id', 'estres_financiero'] (boolean: True/False)
        
    Returns:
        pd.DataFrame con los asegurados y meses repetitivos de sospecha estacional.
    """
    df = df_siniestros.copy()
    df["fecha_siniestro"] = pd.to_datetime(df["fecha_siniestro"])
    df["anio"] = df["fecha_siniestro"].dt.year
    df["mes"] = df["fecha_siniestro"].dt.month
    
    # Agrupar por asegurado y mes para contar años distintos
    grouped = df.groupby(["asegurado_id", "mes"]).agg(
        anios_distintos=("anio", "nunique"),
        total_siniestros_mes=("claim_id", "count")
    ).reset_index()
    
    # Filtrar siniestralidad en los mismos meses en al menos 2 años distintos
    estacionales = grouped[grouped["anios_distintos"] >= 2]
    
    # Cruzar con tabla de asegurados con indicador de estrés financiero
    stress_asegurados = df_asegurados[df_asegurados["estres_financiero"] == True]
    
    anomalies = estacionales.merge(stress_asegurados, on="asegurado_id", how="inner")
    
    return anomalies[[
        "asegurado_id", "mes", "anios_distintos",
        "total_siniestros_mes", "estres_financiero"
    ]]
