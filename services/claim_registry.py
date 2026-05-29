import logging
from typing import Any, Dict
import pandas as pd

logger = logging.getLogger("claim_registry")
logging.basicConfig(level=logging.INFO)


def _read_csv_safe(path: str, columns: list[str]) -> pd.DataFrame:
    try:
        return pd.read_csv(path)
    except Exception:
        return pd.DataFrame(columns=columns)


class ClaimRegistry:
    """
    Handles claim creation and persistence in CSV storage.
    """

    @classmethod
    def register_claim(cls, data_loader: Any, request: Any) -> Dict[str, Any]:
        claim_id = request.claim_id.strip()
        logger.info(f"Registering claim: {claim_id}")

        df_siniestros = data_loader.datasets.get("siniestros", pd.DataFrame())
        if not df_siniestros.empty and claim_id in df_siniestros["claim_id"].values:
            raise ValueError(f"El ID de siniestro '{claim_id}' ya esta registrado en el sistema.")

        path_siniestros = data_loader.paths["siniestros"]
        path_polizas = data_loader.paths["polizas"]
        path_asegurados = data_loader.paths["asegurados"]
        path_proveedores = data_loader.paths["proveedores"]

        df_asegurados = data_loader.datasets.get("asegurados", pd.DataFrame())
        df_proveedores = data_loader.datasets.get("proveedores", pd.DataFrame())
        df_polizas = data_loader.datasets.get("polizas", pd.DataFrame())

        if df_asegurados.empty or request.asegurado_id not in df_asegurados["asegurado_id"].values:
            nuevo_asegurado = {
                "asegurado_id": request.asegurado_id,
                "nombre_completo": f"Asegurado Automatico ({request.asegurado_id})",
                "identificador_fiscal": "1710034065001",
                "estres_financiero": "False",
                "lat_domicilio": -0.1806,
                "lon_domicilio": -78.4678,
            }
            temp_df = _read_csv_safe(
                path_asegurados,
                ["asegurado_id", "nombre_completo", "identificador_fiscal", "estres_financiero", "lat_domicilio", "lon_domicilio"],
            )
            temp_df = pd.concat([temp_df, pd.DataFrame([nuevo_asegurado])], ignore_index=True)
            temp_df.to_csv(path_asegurados, index=False)
            logger.info(f"Created placeholder asegurado: {request.asegurado_id}")

        if df_proveedores.empty or request.proveedor_id not in df_proveedores["proveedor_id"].values:
            nuevo_proveedor = {
                "proveedor_id": request.proveedor_id,
                "nombre": f"Proveedor Automatico ({request.proveedor_id})",
                "identificador_fiscal": "1792061504001",
                "lat_proveedor": -0.2200,
                "lon_proveedor": -78.5200,
            }
            temp_df = _read_csv_safe(
                path_proveedores,
                ["proveedor_id", "nombre", "lat_proveedor", "lon_proveedor"],
            )
            temp_df = pd.concat([temp_df, pd.DataFrame([nuevo_proveedor])], ignore_index=True)
            temp_df.to_csv(path_proveedores, index=False)
            logger.info(f"Created placeholder proveedor: {request.proveedor_id}")

        if df_polizas.empty or request.poliza_id not in df_polizas["poliza_id"].values:
            nueva_poliza = {
                "poliza_id": request.poliza_id,
                "asegurado_id": request.asegurado_id,
                "fecha_inicio": "2026-01-01",
                "fecha_fin": "2027-01-01",
                "broker_id": "BROK-88",
            }
            temp_df = _read_csv_safe(
                path_polizas,
                ["poliza_id", "asegurado_id", "fecha_inicio", "fecha_fin", "broker_id"],
            )
            temp_df = pd.concat([temp_df, pd.DataFrame([nueva_poliza])], ignore_index=True)
            temp_df.to_csv(path_polizas, index=False)
            logger.info(f"Created placeholder poliza: {request.poliza_id}")

        polizas_df = _read_csv_safe(
            path_polizas,
            ["poliza_id", "asegurado_id", "fecha_inicio", "fecha_fin", "broker_id"],
        )
        p_row = polizas_df[polizas_df["poliza_id"] == request.poliza_id]
        fecha_ini = p_row["fecha_inicio"].iloc[0] if not p_row.empty else "2026-01-01"
        fecha_f = p_row["fecha_fin"].iloc[0] if not p_row.empty else "2027-01-01"

        nuevo_siniestro = {
            "claim_id": claim_id,
            "poliza_id": request.poliza_id,
            "asegurado_id": request.asegurado_id,
            "proveedor_id": request.proveedor_id,
            "ramo": request.ramo,
            "fecha_siniestro": request.fecha_siniestro,
            "fecha_inicio_poliza": fecha_ini,
            "fecha_fin_poliza": fecha_f,
            "fecha_reporte": request.fecha_reporte,
            "monto_reclamado": request.monto_reclamado,
            "lat_siniestro": request.lat_siniestro,
            "lon_siniestro": request.lon_siniestro,
            "severidad": request.severidad,
            "narrativa_libre": request.narrativa_libre,
        }

        siniestros_df = _read_csv_safe(
            path_siniestros,
            [
                "claim_id",
                "poliza_id",
                "asegurado_id",
                "proveedor_id",
                "ramo",
                "fecha_siniestro",
                "fecha_inicio_poliza",
                "fecha_fin_poliza",
                "fecha_reporte",
                "monto_reclamado",
                "lat_siniestro",
                "lon_siniestro",
                "severidad",
                "narrativa_libre",
            ],
        )

        siniestros_df = pd.concat([siniestros_df, pd.DataFrame([nuevo_siniestro])], ignore_index=True)
        siniestros_df.to_csv(path_siniestros, index=False)
        logger.info(f"Claim written to CSV: {claim_id}")

        data_loader.cargar_y_limpiar_datasets()
        logger.info("Datasets reloaded after claim creation.")

        return {
            "status": "success",
            "claim_id": claim_id,
            "detail": "Siniestro registrado y cargado en el sandbox analitico.",
        }
