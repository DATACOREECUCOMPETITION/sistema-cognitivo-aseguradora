import os
import re
import json
import logging
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from PyPDF2 import PdfReader
from core.config import settings
from services.gemini_agent import GeminiAgent
from services.evidence_extractor import EvidenceExtractor
from services.claim_registry import _read_csv_safe

logger = logging.getLogger("quick_scan_processor")

class QuickScanProcessor:
    """
    Procesador para la extracción cognitiva y local de datos de siniestros a partir de PDFs.
    Persiste la información de forma relacional en los CSVs del sandbox local.
    """

    SYSTEM_INSTRUCTION = (
        "Actúa como un agente extractor de datos altamente capacitado para Aseguradora del Sur.\n"
        "Tu trabajo consiste en analizar el texto de un documento de siniestro (formulario de reclamación, parte policial o factura) y extraer los campos clave requeridos para el sistema.\n"
        "Si un dato no se detalla en el texto, debes inferir un valor adecuado o un marcador consistente para no romper la integridad relacional de la base de datos (por ejemplo, autogenerar un ID de póliza del estilo POL-2026-XXX o un ID de asegurado ASEG-XXXX si el documento no lo tiene).\n"
        "MUY IMPORTANTE (REGLA GPS): No intentes inventar o aproximar coordenadas GPS (latitud/longitud) si el documento no las especifica explícitamente. En ese caso, devuelve obligatoriamente lat_siniestro = 0.0 y lon_siniestro = 0.0.\n\n"
        "Debes extraer los siguientes campos estructurados:\n"
        "1. claim_id: ID de siniestro en formato CLM-YYYY-XXXX (si en el texto aparece un código como SIN-0378 o SIN-0005, conviértelo a CLM-2026-0378 o CLM-2026-0005, o autogéneralo usando el año actual 2026).\n"
        "2. poliza_id: ID de póliza en formato POL-2026-XXXX o similar.\n"
        "3. asegurado_id: ID de asegurado en formato ASEG-XXXX.\n"
        "4. nombre_asegurado: Nombre completo del asegurado.\n"
        "5. identificador_fiscal_asegurado: Cédula o RUC del asegurado (10 o 13 dígitos). Si es cédula, agrega '001' al final si es necesario para convertirlo en RUC.\n"
        "6. proveedor_id: ID de proveedor o taller en formato PROV-XXXX o TALLER-XXXX (si no se especifica, usa 'PROV-9081').\n"
        "7. nombre_proveedor: Nombre del taller o proveedor de servicio.\n"
        "8. identificador_fiscal_proveedor: RUC del proveedor (13 dígitos) si está presente.\n"
        "9. ramo: Ramo del siniestro en MAYÚSCULAS ('VEHICULOS', 'SALUD', etc.).\n"
        "10. fecha_siniestro: Fecha del siniestro o accidente en formato YYYY-MM-DD.\n"
        "11. fecha_reporte: Fecha del reporte en formato YYYY-MM-DD (si no está, usa la fecha del documento o la fecha actual 2026-05-29).\n"
        "12. monto_reclamado: Monto reclamado en dólares (float). Para facturas o preformas, usa el TOTAL A PAGAR.\n"
        "13. lat_siniestro: Latitud geográfica aproximada (float). Si no está explícitamente especificada en el documento, devuelve obligatoriamente 0.0.\n"
        "14. lon_siniestro: Longitud geográfica aproximada (float). Si no está explícitamente especificada en el documento, devuelve obligatoriamente 0.0.\n"
        "15. severidad: Severidad del siniestro en MAYÚSCULAS ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') basada en la descripción de los daños.\n"
        "16. narrativa_libre: Breve resumen en tercera persona de cómo ocurrió el accidente o la descripción del hecho.\n"
        "17. placa_vehiculo: Placa del vehículo asegurado si se menciona.\n\n"
        "Tu salida DEBE ser estrictamente un objeto JSON plano y limpio con este esquema exacto:\n"
        "{\n"
        "  \"claim_id\": \"CLM-YYYY-XXXX\",\n"
        "  \"poliza_id\": \"POL-YYYY-XXXX\",\n"
        "  \"asegurado_id\": \"ASEG-XXXX\",\n"
        "  \"nombre_asegurado\": \"...\",\n"
        "  \"identificador_fiscal_asegurado\": \"...\",\n"
        "  \"proveedor_id\": \"...\",\n"
        "  \"nombre_proveedor\": \"...\",\n"
        "  \"identificador_fiscal_proveedor\": \"...\",\n"
        "  \"ramo\": \"...\",\n"
        "  \"fecha_siniestro\": \"YYYY-MM-DD\",\n"
        "  \"fecha_reporte\": \"YYYY-MM-DD\",\n"
        "  \"monto_reclamado\": 0.0,\n"
        "  \"lat_siniestro\": 0.0,\n"
        "  \"lon_siniestro\": 0.0,\n"
        "  \"severidad\": \"...\",\n"
        "  \"narrativa_libre\": \"...\",\n"
        "  \"placa_vehiculo\": \"...\"\n"
        "}"
    )

    @classmethod
    async def process_quick_scan(cls, data_loader: Any, file_bytes: bytes, filename: str, bypass_gemini: bool = False) -> Dict[str, Any]:
        """
        Lee el documento (PDF o Excel), extrae su texto, aplica la IA o fallback local, persiste los datos en los CSVs
        y almacena el archivo como evidencia documental válida para auditar.
        """
        logger.info(f"Iniciando Quick Scan para el archivo: {filename}")
        
        # Detectar si es un Excel en modo Ingesta Masiva (Batch Import)
        ext = os.path.splitext(filename)[1].lower()
        is_excel = ext in (".xlsx", ".xls")
        
        if is_excel:
            try:
                import pandas as pd
                from io import BytesIO
                excel_file = pd.ExcelFile(BytesIO(file_bytes))
                sheet_names = excel_file.sheet_names
                logger.info(f"Excel cargado en Quick Scan. Hojas detectadas: {sheet_names}")
                
                # Detectar si es el dataset relacional con múltiples registros (Batch Mode)
                has_siniestros_sheet = any("siniestro" in s.lower() for s in sheet_names)
                has_polizas_sheet = any("poliza" in s.lower() for s in sheet_names)
                
                if has_siniestros_sheet and has_polizas_sheet:
                    logger.info("¡Modo Ingesta Masiva (Batch Import) Detectado!")
                    return await cls._process_batch_excel_import(data_loader, excel_file, sheet_names)
            except Exception as e:
                logger.error(f"Fallo al intentar pre-procesar Excel en modo Batch: {str(e)}")

        # 1. Extraer texto del documento (PDF o Excel) en memoria
        import uuid
        temp_dir = os.path.join(EvidenceExtractor.BASE_DIR, "temp_scans")
        os.makedirs(temp_dir, exist_ok=True)
        temp_filename = f"{uuid.uuid4()}_{filename}"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        try:
            with open(temp_path, "wb") as f:
                f.write(file_bytes)
            
            doc_meta = EvidenceExtractor._extract_document_metadata(temp_path)
            doc_text = doc_meta.get("text_excerpt", "").strip()
            if not doc_text:
                raise ValueError("El archivo cargado no contiene texto legible.")
                
            doc_text = EvidenceExtractor.limpiar_disclaimers_texto(doc_text)
        except Exception as e:
            logger.error(f"Fallo al extraer texto del documento: {str(e)}")
            raise ValueError(f"No se pudo extraer texto del archivo: {str(e)}")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        # Obtener los próximos IDs consistentes de apoyo por si acaso
        next_ids = cls._get_next_ids_catalogs(data_loader)

        # 2. Decidir si usar Gemini o Fallback
        extracted_data = None
        use_bypass = bypass_gemini or settings.BYPASS_GEMINI
        
        if not use_bypass:
            try:
                # Instanciar el agente de Gemini
                gemini_agent = GeminiAgent()
                api_key = gemini_agent._get_active_api_key()
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
                
                user_prompt = (
                    f"--- TEXTO EXTRAÍDO DEL DOCUMENTO ---\n{doc_text}\n\n"
                    f"--- PARÁMETROS SUGERIDOS ---\n"
                    f"next_claim_id: {next_ids['claim_id']}\n"
                    f"next_poliza_id: {next_ids['poliza_id']}\n"
                    f"next_asegurado_id: {next_ids['asegurado_id']}\n\n"
                    "Extrae y estructura todos los campos en un JSON plano respetando estrictamente la instrucción de sistema."
                )

                payload = {
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "systemInstruction": {"parts": [{"text": cls.SYSTEM_INSTRUCTION}]},
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.1
                    }
                }

                import httpx
                headers = {"Content-Type": "application/json"}
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if candidates:
                        content_text = candidates[0]["content"]["parts"][0]["text"].strip()
                        extracted_data = json.loads(content_text)
                        logger.info("✓ Extracción cognitiva de Gemini completada con éxito.")
            except Exception as e:
                logger.error(f"Fallo en la llamada a Gemini para extracción. Utilizando fallback local. Detalle: {str(e)}")
                extracted_data = None

        if not extracted_data:
            logger.warning("Ejecutando fallback heurístico local en QuickScanProcessor.")
            extracted_data = cls._fallback_local_parse(doc_text, next_ids)

        # 3. Sanitizar y Homogeneizar Datos Extraídos
        claim_id = str(extracted_data.get("claim_id", next_ids["claim_id"])).strip()
        poliza_id = str(extracted_data.get("poliza_id", next_ids["poliza_id"])).strip()
        asegurado_id = str(extracted_data.get("asegurado_id", next_ids["asegurado_id"])).strip()
        proveedor_id = str(extracted_data.get("proveedor_id", "PROV-9081")).strip()
        
        # Validar formato claim_id
        if not re.match(r"^CLM-[0-9]{4}-[0-9]+$", claim_id):
            claim_id = next_ids["claim_id"]
            
        nombre_asegurado = str(extracted_data.get("nombre_asegurado", "Asegurado PDF")).strip()
        ruc_asegurado = str(extracted_data.get("identificador_fiscal_asegurado", "1710034065001")).strip()
        nombre_proveedor = str(extracted_data.get("nombre_proveedor", "Taller Auxiliar")).strip()
        ruc_proveedor = str(extracted_data.get("identificador_fiscal_proveedor", "1792061504001")).strip()
        
        ramo = str(extracted_data.get("ramo", "VEHICULOS")).strip().upper()
        fecha_siniestro = str(extracted_data.get("fecha_siniestro", datetime.now().strftime("%Y-%m-%d"))).strip()
        fecha_reporte = str(extracted_data.get("fecha_reporte", datetime.now().strftime("%Y-%m-%d"))).strip()
        
        monto_reclamado = float(extracted_data.get("monto_reclamado") or 1500.0)
        
        # Forzar lat/lon en 0.0 si no mandaron explícito (tal como el usuario nos instruyó)
        lat_siniestro = float(extracted_data.get("lat_siniestro") or 0.0)
        lon_siniestro = float(extracted_data.get("lon_siniestro") or 0.0)
        
        severidad = str(extracted_data.get("severidad", "LOW")).strip().upper()
        if severidad not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
            severidad = "LOW"
            
        narrativa_libre = str(extracted_data.get("narrativa_libre", "Siniestro cargado mediante quick scan de PDF.")).strip()
        placa_vehiculo = str(extracted_data.get("placa_vehiculo", "")).strip()

        # 4. Guardar consistentemente de forma relacional en los CSVs
        cls._persist_relational_data(
            data_loader=data_loader,
            claim_id=claim_id,
            poliza_id=poliza_id,
            asegurado_id=asegurado_id,
            nombre_asegurado=nombre_asegurado,
            ruc_asegurado=ruc_asegurado,
            proveedor_id=proveedor_id,
            nombre_proveedor=nombre_proveedor,
            ruc_proveedor=ruc_proveedor,
            ramo=ramo,
            fecha_siniestro=fecha_siniestro,
            fecha_reporte=fecha_reporte,
            monto_reclamado=monto_reclamado,
            lat_siniestro=lat_siniestro,
            lon_siniestro=lon_siniestro,
            severidad=severidad,
            narrativa_libre=narrativa_libre,
            placa_vehiculo=placa_vehiculo
        )

        # 5. Persistir el documento físicamente y generar el metadata.json para que sea completamente auditable
        dirs = EvidenceExtractor.ensure_claim_dirs(claim_id)
        ext = os.path.splitext(filename)[1].lower() or ".pdf"
        stored_doc_name = f"preforma{ext}"
        doc_path = os.path.join(dirs["docs"], stored_doc_name)
        with open(doc_path, "wb") as f:
            f.write(file_bytes)

        # Extraer metadatos para el documento de cara al análisis de discrepancias posterior
        doc_metadata = EvidenceExtractor._extract_document_metadata(doc_path)
        doc_metadata.update({
            "original_name": filename,
            "stored_name": stored_doc_name,
            "size_bytes": len(file_bytes),
        })

        summary = EvidenceExtractor._build_summary([], doc_metadata)
        summary = EvidenceExtractor.limpiar_summary_dict(summary)

        metadata_payload = {
            "claim_id": claim_id,
            "created_at": datetime.utcnow().isoformat(),
            "photos": [],
            "pdf": doc_metadata,
            "summary": summary,
            "errors": [],
        }

        metadata_path = os.path.join(dirs["base"], "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as handle:
            json.dump(metadata_payload, handle, indent=2, ensure_ascii=False)

        logger.info(f"✓ Quick Scan completado y persistido. Claim ID: {claim_id}")
        
        return {
            "status": "success",
            "claim_id": claim_id,
            "extracted_fields": {
                "claim_id": claim_id,
                "poliza_id": poliza_id,
                "asegurado_id": asegurado_id,
                "nombre_asegurado": nombre_asegurado,
                "ruc_asegurado": ruc_asegurado,
                "proveedor_id": proveedor_id,
                "nombre_proveedor": nombre_proveedor,
                "ramo": ramo,
                "fecha_siniestro": fecha_siniestro,
                "monto_reclamado": monto_reclamado,
                "lat_siniestro": lat_siniestro,
                "lon_siniestro": lon_siniestro,
                "severidad": severidad,
                "narrativa_libre": narrativa_libre,
                "placa_vehiculo": placa_vehiculo
            }
        }

    @classmethod
    def _persist_relational_data(
        cls,
        data_loader: Any,
        claim_id: str,
        poliza_id: str,
        asegurado_id: str,
        nombre_asegurado: str,
        ruc_asegurado: str,
        proveedor_id: str,
        nombre_proveedor: str,
        ruc_proveedor: str,
        ramo: str,
        fecha_siniestro: str,
        fecha_reporte: str,
        monto_reclamado: float,
        lat_siniestro: float,
        lon_siniestro: float,
        severidad: str,
        narrativa_libre: str,
        placa_vehiculo: str
    ) -> None:
        """
        Guarda los datos en los archivos CSV correspondientes de manera limpia e íntegra.
        """
        path_siniestros = data_loader.paths["siniestros"]
        path_polizas = data_loader.paths["polizas"]
        path_asegurados = data_loader.paths["asegurados"]
        path_proveedores = data_loader.paths["proveedores"]

        # A. Actualizar/Añadir Asegurado
        df_asegurados = _read_csv_safe(path_asegurados, ["asegurado_id", "nombre_completo", "identificador_fiscal", "estres_financiero", "lat_domicilio", "lon_domicilio"])
        if asegurado_id not in df_asegurados["asegurado_id"].values:
            nuevo_asegurado = {
                "asegurado_id": asegurado_id,
                "nombre_completo": nombre_asegurado,
                "identificador_fiscal": ruc_asegurado,
                "estres_financiero": "False",
                "lat_domicilio": -0.1806,
                "lon_domicilio": -78.4678
            }
            df_asegurados = pd.concat([df_asegurados, pd.DataFrame([nuevo_asegurado])], ignore_index=True)
            df_asegurados.to_csv(path_asegurados, index=False)
            logger.info(f"Quick Scan: Registrado Asegurado: {asegurado_id}")

        # B. Actualizar/Añadir Proveedor
        df_proveedores = _read_csv_safe(path_proveedores, ["proveedor_id", "nombre", "identificador_fiscal", "lat_proveedor", "lon_proveedor"])
        if proveedor_id not in df_proveedores["proveedor_id"].values:
            nuevo_proveedor = {
                "proveedor_id": proveedor_id,
                "nombre": nombre_proveedor,
                "identificador_fiscal": ruc_proveedor,
                "lat_proveedor": -0.2200,
                "lon_proveedor": -78.5200
            }
            df_proveedores = pd.concat([df_proveedores, pd.DataFrame([nuevo_proveedor])], ignore_index=True)
            df_proveedores.to_csv(path_proveedores, index=False)
            logger.info(f"Quick Scan: Registrado Proveedor: {proveedor_id}")

        # C. Actualizar/Añadir Póliza
        df_polizas = _read_csv_safe(path_polizas, ["poliza_id", "asegurado_id", "fecha_inicio", "fecha_fin", "broker_id"])
        if poliza_id not in df_polizas["poliza_id"].values:
            nueva_poliza = {
                "poliza_id": poliza_id,
                "asegurado_id": asegurado_id,
                "fecha_inicio": "2026-01-01",
                "fecha_fin": "2027-01-01",
                "broker_id": "BROK-88"
            }
            df_polizas = pd.concat([df_polizas, pd.DataFrame([nueva_poliza])], ignore_index=True)
            df_polizas.to_csv(path_polizas, index=False)
            logger.info(f"Quick Scan: Registrada Póliza: {poliza_id}")

        # D. Añadir Siniestro en siniestros.csv
        # Leer el CSV original con soporte opcional de placa_vehiculo
        headers_sin = [
            "claim_id", "poliza_id", "asegurado_id", "proveedor_id", "ramo", 
            "fecha_siniestro", "fecha_reporte", "monto_reclamado", 
            "lat_siniestro", "lon_siniestro", "severidad", "narrativa_libre", "placa_vehiculo"
        ]
        df_siniestros = pd.read_csv(path_siniestros)
        
        # Si ya existe el siniestro, lo eliminamos para poder re-escribirlo y actualizar
        df_siniestros = df_siniestros[df_siniestros["claim_id"] != claim_id]

        # Asegurar que la columna placa_vehiculo existe en el DataFrame
        if "placa_vehiculo" not in df_siniestros.columns:
            df_siniestros["placa_vehiculo"] = ""

        # Mapear fechas a string limpio
        p_row = df_polizas[df_polizas["poliza_id"] == poliza_id]
        fecha_ini_pol = p_row["fecha_inicio"].iloc[0] if not p_row.empty else "2026-01-01"
        fecha_fin_pol = p_row["fecha_fin"].iloc[0] if not p_row.empty else "2027-01-01"

        nuevo_siniestro = {
            "claim_id": claim_id,
            "poliza_id": poliza_id,
            "asegurado_id": asegurado_id,
            "proveedor_id": proveedor_id,
            "ramo": ramo,
            "fecha_siniestro": fecha_siniestro,
            "fecha_inicio_poliza": fecha_ini_pol,
            "fecha_fin_poliza": fecha_fin_pol,
            "fecha_reporte": fecha_reporte,
            "monto_reclamado": monto_reclamado,
            "lat_siniestro": lat_siniestro,
            "lon_siniestro": lon_siniestro,
            "severidad": severidad,
            "narrativa_libre": narrativa_libre,
            "placa_vehiculo": placa_vehiculo
        }
        
        df_siniestros = pd.concat([df_siniestros, pd.DataFrame([nuevo_siniestro])], ignore_index=True)
        # Re-guardar preservando todas las columnas
        df_siniestros.to_csv(path_siniestros, index=False)
        logger.info(f"Quick Scan: Siniestro guardado en CSV: {claim_id}")

        # Recargar el estado en memoria de data_loader
        data_loader.cargar_y_limpiar_datasets()
        logger.info("Data loader datasets reloaded.")

    @classmethod
    def _fallback_local_parse(cls, text: str, next_ids: Dict[str, str]) -> Dict[str, Any]:
        """
        Parser heurístico local por regex y palabras clave cuando bypass está activo o falla la API.
        """
        text_upper = text.upper()
        
        # 1. Intentar buscar Siniestro ID
        claim_id = next_ids.get("claim_id", "CLM-2026-999")
        match_sin = re.search(r"(?:SINIESTRO|SINRef|Ref Siniestro|Siniestro Ref|SIN):?\s*([A-Z0-9-]+)", text, re.IGNORECASE)
        if match_sin:
            raw_id = match_sin.group(1).strip()
            num_match = re.search(r"\d+", raw_id)
            if num_match:
                claim_id = f"CLM-2026-{int(num_match.group(0)):03d}"
            else:
                claim_id = f"CLM-2026-{raw_id}"

        # 2. Intentar buscar Póliza ID
        poliza_id = next_ids.get("poliza_id", "POL-2026-999")
        match_pol = re.search(r"(?:PÓLIZA|POLIZA|POL):?\s*([A-Z0-9-]+)", text, re.IGNORECASE)
        if match_pol:
            raw_pol = match_pol.group(1).strip()
            if not raw_pol.startswith("POL-") and not raw_pol.startswith("VH-"):
                poliza_id = f"POL-2026-{raw_pol}"
            else:
                poliza_id = raw_pol
                
        # 3. Asegurado e identificador fiscal
        asegurado_id = next_ids.get("asegurado_id", "ASEG-9999")
        nombre_asegurado = "Asegurado PDF"
        identificador_fiscal_asegurado = "1710034065001"
        
        match_aseg = re.search(r"(?:Asegurado|Cliente|Propietario):?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)", text, re.IGNORECASE)
        if match_aseg:
            val = match_aseg.group(1).split("\n")[0].strip()
            if val and len(val) > 3:
                nombre_asegurado = val

        match_fiscal = re.search(r"(?:C\.I\./RUC|C\.I\.|RUC|CÉDULA|CEDULA|IDENTIFICACIÓN):?\s*(\d+)", text, re.IGNORECASE)
        if match_fiscal:
            val = match_fiscal.group(1).strip()
            if len(val) == 10:
                identificador_fiscal_asegurado = val + "001"
            elif len(val) == 13:
                identificador_fiscal_asegurado = val
        
        # 4. Proveedor/Taller
        proveedor_id = "PROV-9081"
        nombre_proveedor = "CASA BACA S.A."
        identificador_fiscal_proveedor = "1792061504001"
        
        if "ALVAREZ BARBA" in text_upper:
            proveedor_id = "PROV-4421"
            nombre_proveedor = "ALVAREZ BARBA S.A."
            identificador_fiscal_proveedor = "1790025734001"
        elif "AUTOLINE" in text_upper:
            proveedor_id = "PROV-1111"
            nombre_proveedor = "AUTOLINE S.A."
            identificador_fiscal_proveedor = "1790408544001"
        elif "MENDOZA" in text_upper:
            proveedor_id = "PROV-1112"
            nombre_proveedor = "MENDOZA ALVARADO WILFRIDO JAVIER"
            identificador_fiscal_proveedor = "1716049281001"
        elif "TALLER FANTASMA" in text_upper:
            proveedor_id = "PROV-1114"
            nombre_proveedor = "TALLER FANTASMA S.A."
            identificador_fiscal_proveedor = "1799999999001"
        elif "REVENTON" in text_upper or "REVENTÓN" in text_upper:
            proveedor_id = "PROV-1115"
            nombre_proveedor = "MECÁNICA EL REVENTÓN"
            identificador_fiscal_proveedor = "1711223344001"
            
        # 5. Ramo
        ramo = "VEHICULOS"
        if any(w in text_upper for w in ["SALUD", "MÉDICO", "MEDICO", "CLÍNICA", "CLINICA"]):
            ramo = "SALUD"
        elif "HOGAR" in text_upper or "VIVIENDA" in text_upper:
            ramo = "HOGAR"

        # 6. Fechas
        fecha_siniestro = datetime.now().strftime("%Y-%m-%d")
        detected_dates = EvidenceExtractor.extraer_fechas_del_texto(text)
        if detected_dates:
            fecha_siniestro = detected_dates[0]
            
        # 7. Monto
        monto_reclamado = 1500.0
        detected_montos = EvidenceExtractor.extraer_montos_del_texto(text)
        if detected_montos:
            monto_reclamado = max(detected_montos)

        # 8. Severidad
        severidad = "LOW"
        if any(w in text_upper for w in ["GRAVE", "SEVERO", "SEVERA", "CRÍTICO", "CRITICO", "PÉRDIDA TOTAL", "PERDIDA TOTAL"]):
            severidad = "HIGH"
            
        # 9. Narrativa
        narrativa_libre = "Siniestro procesado mediante escaneo rápido de PDF."
        match_desc = re.search(r"(?:Explique detalladamente cómo ocurrió el accidente|Circunstancias del Hecho):?\s*(.+)", text, re.DOTALL | re.IGNORECASE)
        if match_desc:
            desc = match_desc.group(1).strip()
            if len(desc) > 200:
                narrativa_libre = desc[:400] + "..."
            else:
                narrativa_libre = desc
                
        # 10. Placa
        placa_vehiculo = ""
        match_placa = re.search(r"(?:PLACA|PLACAS):?\s*([A-Z0-9-]{7,8})", text, re.IGNORECASE)
        if match_placa:
            placa_vehiculo = match_placa.group(1).strip()

        return {
            "claim_id": claim_id,
            "poliza_id": poliza_id,
            "asegurado_id": asegurado_id,
            "nombre_asegurado": nombre_asegurado,
            "identificador_fiscal_asegurado": identificador_fiscal_asegurado,
            "proveedor_id": proveedor_id,
            "nombre_proveedor": nombre_proveedor,
            "identificador_fiscal_proveedor": identificador_fiscal_proveedor,
            "ramo": ramo,
            "fecha_siniestro": fecha_siniestro,
            "fecha_reporte": datetime.now().strftime("%Y-%m-%d"),
            "monto_reclamado": float(monto_reclamado),
            "lat_siniestro": 0.0,
            "lon_siniestro": 0.0,
            "severidad": severidad,
            "narrativa_libre": narrativa_libre,
            "placa_vehiculo": placa_vehiculo
        }

    @classmethod
    def _get_next_ids_catalogs(cls, data_loader: Any) -> Dict[str, str]:
        """
        Autocalcula los siguientes IDs consistentes para evitar choques en la persistencia.
        """
        # A. Siguiente claim_id
        df_siniestros = data_loader.datasets.get("siniestros", pd.DataFrame())
        next_claim_num = 1
        if not df_siniestros.empty:
            nums = []
            for cid in df_siniestros["claim_id"].dropna().values:
                parts = str(cid).split("-")
                if len(parts) >= 3 and parts[-1].isdigit():
                    nums.append(int(parts[-1]))
            if nums:
                next_claim_num = max(nums) + 1
        next_claim_id = f"CLM-2026-{next_claim_num:03d}"
        
        # B. Siguiente poliza_id
        df_polizas = data_loader.datasets.get("polizas", pd.DataFrame())
        next_poliza_num = 100
        if not df_polizas.empty:
            nums = []
            for pid in df_polizas["poliza_id"].dropna().values:
                parts = str(pid).split("-")
                if len(parts) >= 3 and parts[-1].isdigit():
                    nums.append(int(parts[-1]))
            if nums:
                next_poliza_num = max(nums) + 1
        next_poliza_id = f"POL-2026-{next_poliza_num}"
        
        # C. Siguiente asegurado_id
        df_asegurados = data_loader.datasets.get("asegurados", pd.DataFrame())
        next_aseg_num = 1000
        if not df_asegurados.empty:
            nums = []
            for aid in df_asegurados["asegurado_id"].dropna().values:
                parts = str(aid).split("-")
                if len(parts) >= 2 and parts[-1].isdigit():
                    nums.append(int(parts[-1]))
            if nums:
                next_aseg_num = max(nums) + 1
        next_asegurado_id = f"ASEG-{next_aseg_num}"

        return {
            "claim_id": next_claim_id,
            "poliza_id": next_poliza_id,
            "asegurado_id": next_asegurado_id
        }

    @classmethod
    async def _process_batch_excel_import(cls, data_loader: Any, excel_file: Any, sheet_names: List[str]) -> Dict[str, Any]:
        """
        Procesa la ingesta masiva (Batch Import) de un archivo Excel de base de datos relacional.
        Mapea dinámicamente columnas aproximadas, limpia NaNs y persiste de forma relacional en los CSVs.
        """
        import pandas as pd
        import numpy as np
        import os
        from datetime import datetime
        
        logger.info("Iniciando pipeline de Ingesta Masiva desde Excel...")

        # Encontrar nombres de las hojas con búsqueda tolerante a mayúsculas
        sh_siniestros = next((s for s in sheet_names if "siniestro" in s.lower()), None)
        sh_polizas = next((s for s in sheet_names if "poliza" in s.lower() or "póliza" in s.lower()), None)
        sh_asegurados = next((s for s in sheet_names if "asegurado" in s.lower()), None)
        sh_proveedores = next((s for s in sheet_names if "proveedor" in s.lower()), None)
        
        if not sh_siniestros:
            raise ValueError("No se encontró ninguna hoja de Siniestros en el archivo Excel.")

        # Cargar DataFrames
        df_sin_excel = excel_file.parse(sh_siniestros)
        df_pol_excel = excel_file.parse(sh_polizas) if sh_polizas else pd.DataFrame()
        df_aseg_excel = excel_file.parse(sh_asegurados) if sh_asegurados else pd.DataFrame()
        df_prov_excel = excel_file.parse(sh_proveedores) if sh_proveedores else pd.DataFrame()

        # Mapeador dinámico de columnas por sinónimos
        def map_cols(df: pd.DataFrame, mappings: Dict[str, List[str]]) -> pd.DataFrame:
            mapped = pd.DataFrame()
            cols_cleaned = {
                c.lower().replace("_", "").replace(" ", "").replace("ó", "o").replace("é", "e").replace("í", "i").replace("á", "a").replace("ú", "u").replace("$", "").replace("(", "").replace(")", ""): c 
                for c in df.columns
            }
            for target_col, synonyms in mappings.items():
                found_col = None
                for syn in synonyms:
                    syn_clean = syn.lower().replace("_", "").replace(" ", "").replace("ó", "o").replace("é", "e").replace("í", "i").replace("á", "a").replace("ú", "u").replace("$", "").replace("(", "").replace(")", "")
                    if syn_clean in cols_cleaned:
                        found_col = cols_cleaned[syn_clean]
                        break
                if found_col is not None:
                    mapped[target_col] = df[found_col]
                else:
                    mapped[target_col] = None
            return mapped

        # A. Asegurados
        df_aseg_mapped = pd.DataFrame()
        if not df_aseg_excel.empty:
            df_aseg_mapped = map_cols(df_aseg_excel, {
                "asegurado_id": ["ID Asegurado", "asegurado_id", "Asegurado"],
                "nombre_completo": ["Nombre Completo", "nombre_completo", "Nombre Asegurado", "Nombres Asegurado", "Nombre"],
                "identificador_fiscal": ["Identificador Fiscal", "identificador_fiscal", "RUC", "Cedula", "ID Fiscal"],
                "estres_financiero": ["Estres Financiero", "estres_financiero", "Estres", "Financial Stress"],
                "lat_domicilio": ["Lat Domicilio", "lat_domicilio", "Latitude Domicilio", "Latitud Domicilio"],
                "lon_domicilio": ["Lon Domicilio", "lon_domicilio", "Longitude Domicilio", "Longitud Domicilio"]
            })
            df_aseg_mapped = df_aseg_mapped.dropna(subset=["asegurado_id"])
            df_aseg_mapped["nombre_completo"] = df_aseg_mapped["nombre_completo"].fillna("Asegurado Importado")
            df_aseg_mapped["identificador_fiscal"] = df_aseg_mapped["identificador_fiscal"].fillna("1710034065001").astype(str).str.replace(".0", "", regex=False)
            df_aseg_mapped["identificador_fiscal"] = df_aseg_mapped["identificador_fiscal"].apply(lambda x: str(x) + "001" if len(str(x)) == 10 else str(x))
            df_aseg_mapped["estres_financiero"] = df_aseg_mapped["estres_financiero"].fillna("False").astype(str).str.upper().apply(
                lambda x: "True" if isinstance(x, str) and any(k in x for k in ["TR", "S", "1"]) else "False"
            )
            df_aseg_mapped["lat_domicilio"] = pd.to_numeric(df_aseg_mapped["lat_domicilio"], errors='coerce').fillna(-0.1806)
            df_aseg_mapped["lon_domicilio"] = pd.to_numeric(df_aseg_mapped["lon_domicilio"], errors='coerce').fillna(-78.4678)

        # B. Proveedores
        df_prov_mapped = pd.DataFrame()
        if not df_prov_excel.empty:
            df_prov_mapped = map_cols(df_prov_excel, {
                "proveedor_id": ["ID Proveedor", "proveedor_id", "Proveedor"],
                "nombre": ["Nombre", "nombre", "Nombre Proveedor", "Taller", "Nombre Taller"],
                "identificador_fiscal": ["Identificador Fiscal", "identificador_fiscal", "RUC", "RUC Taller", "RUC Proveedor"],
                "lat_proveedor": ["Lat Proveedor", "lat_proveedor", "Latitud Proveedor"],
                "lon_proveedor": ["Lon Proveedor", "lon_proveedor", "Longitud Proveedor"]
            })
            df_prov_mapped = df_prov_mapped.dropna(subset=["proveedor_id"])
            df_prov_mapped["nombre"] = df_prov_mapped["nombre"].fillna("Proveedor Importado")
            df_prov_mapped["identificador_fiscal"] = df_prov_mapped["identificador_fiscal"].fillna("1792061504001").astype(str).str.replace(".0", "", regex=False)
            df_prov_mapped["lat_proveedor"] = pd.to_numeric(df_prov_mapped["lat_proveedor"], errors='coerce').fillna(-0.2200)
            df_prov_mapped["lon_proveedor"] = pd.to_numeric(df_prov_mapped["lon_proveedor"], errors='coerce').fillna(-78.5200)

        # C. Pólizas
        df_pol_mapped = pd.DataFrame()
        if not df_pol_excel.empty:
            df_pol_mapped = map_cols(df_pol_excel, {
                "poliza_id": ["ID Poliza", "poliza_id", "Poliza"],
                "asegurado_id": ["ID Asegurado", "asegurado_id", "Asegurado"],
                "fecha_inicio": ["Fecha Inicio", "fecha_inicio", "Inicio Vigencia", "fecha_inicio_poliza"],
                "fecha_fin": ["Fecha Fin", "fecha_fin", "Fin Vigencia", "fecha_fin_poliza"],
                "broker_id": ["ID Broker", "broker_id", "Broker"]
            })
            df_pol_mapped = df_pol_mapped.dropna(subset=["poliza_id", "asegurado_id"])
            df_pol_mapped["fecha_inicio"] = df_pol_mapped["fecha_inicio"].astype(str).str.split(" ").str[0].fillna("2026-01-01")
            df_pol_mapped["fecha_fin"] = df_pol_mapped["fecha_fin"].astype(str).str.split(" ").str[0].fillna("2027-01-01")
            df_pol_mapped["broker_id"] = df_pol_mapped["broker_id"].fillna("BROK-88")
            
            # Normalize POL-XXXX to POL-2026-XXXX format
            df_pol_mapped["poliza_id"] = df_pol_mapped["poliza_id"].astype(str).apply(
                lambda x: x.replace("POL-", "POL-2026-") if x.startswith("POL-") and "2026" not in x else x
            )

        # D. Siniestros
        df_sin_mapped = map_cols(df_sin_excel, {
            "claim_id": ["ID Siniestro", "claim_id", "Siniestro"],
            "poliza_id": ["ID Poliza", "poliza_id", "Poliza"],
            "asegurado_id": ["ID Asegurado", "asegurado_id", "Asegurado"],
            "proveedor_id": ["ID Proveedor", "proveedor_id", "Proveedor"],
            "ramo": ["Ramo", "ramo"],
            "fecha_siniestro": ["Fecha Ocurrencia", "fecha_siniestro", "Ocurrencia"],
            "fecha_reporte": ["Fecha Reporte", "fecha_reporte", "Reporte"],
            "monto_reclamado": ["Monto Reclamado ($)", "Monto Reclamado", "monto_reclamado", "Monto"],
            "lat_siniestro": ["Lat Siniestro", "lat_siniestro", "Latitud Siniestro"],
            "lon_siniestro": ["Lon Siniestro", "lon_siniestro", "Longitud Siniestro"],
            "severidad": ["Severidad", "severidad"],
            "narrativa_libre": ["Descripcion del Evento", "narrativa_libre", "Narrativa", "Descripcion"],
            "placa_vehiculo": ["Placa Vehiculo Asegurado", "placa_vehiculo", "Placa"]
        })
        
        df_sin_mapped = df_sin_mapped.dropna(subset=["claim_id", "poliza_id", "asegurado_id"])
        
        # Normalize SIN-XXXX to CLM-2026-XXXX format
        df_sin_mapped["claim_id"] = df_sin_mapped["claim_id"].astype(str).apply(
            lambda x: x.replace("SIN-", "CLM-2026-") if x.startswith("SIN-") else x
        )
        
        # Normalize POL-XXXX to POL-2026-XXXX format
        df_sin_mapped["poliza_id"] = df_sin_mapped["poliza_id"].astype(str).apply(
            lambda x: x.replace("POL-", "POL-2026-") if x.startswith("POL-") and "2026" not in x else x
        )
        
        # Completar fechas de pólizas desde df_pol_mapped si es necesario
        def get_pol_date(pid, col_name, default_val):
            if df_pol_mapped.empty:
                return default_val
            match = df_pol_mapped[df_pol_mapped["poliza_id"] == pid]
            return str(match[col_name].iloc[0]) if not match.empty else default_val
            
        df_sin_mapped["fecha_inicio_poliza"] = df_sin_mapped["poliza_id"].apply(lambda pid: get_pol_date(pid, "fecha_inicio", "2026-01-01"))
        df_sin_mapped["fecha_fin_poliza"] = df_sin_mapped["poliza_id"].apply(lambda pid: get_pol_date(pid, "fecha_fin", "2027-01-01"))
        
        df_sin_mapped["ramo"] = df_sin_mapped["ramo"].fillna("VEHICULOS").astype(str).str.upper()
        df_sin_mapped["fecha_siniestro"] = df_sin_mapped["fecha_siniestro"].astype(str).str.split(" ").str[0].fillna("2026-05-29")
        df_sin_mapped["fecha_reporte"] = df_sin_mapped["fecha_reporte"].astype(str).str.split(" ").str[0].fillna("2026-05-29")
        df_sin_mapped["monto_reclamado"] = pd.to_numeric(df_sin_mapped["monto_reclamado"], errors='coerce').fillna(1500.0)
        df_sin_mapped["lat_siniestro"] = pd.to_numeric(df_sin_mapped["lat_siniestro"], errors='coerce').fillna(0.0)
        df_sin_mapped["lon_siniestro"] = pd.to_numeric(df_sin_mapped["lon_siniestro"], errors='coerce').fillna(0.0)
        df_sin_mapped["severidad"] = df_sin_mapped["severidad"].fillna("LOW").astype(str).str.upper()
        df_sin_mapped["severidad"] = df_sin_mapped["severidad"].apply(lambda x: x if x in ("LOW", "MEDIUM", "HIGH", "CRITICAL") else "LOW")
        df_sin_mapped["narrativa_libre"] = df_sin_mapped["narrativa_libre"].fillna("Siniestro importado vía lote masivo de Excel.")
        df_sin_mapped["placa_vehiculo"] = df_sin_mapped["placa_vehiculo"].fillna("")

        # Persistir de forma relacional en los CSVs
        path_siniestros = data_loader.paths["siniestros"]
        path_polizas = data_loader.paths["polizas"]
        path_asegurados = data_loader.paths["asegurados"]
        path_proveedores = data_loader.paths["proveedores"]

        # A. Asegurados
        if not df_aseg_mapped.empty:
            df_aseg_db = pd.read_csv(path_asegurados)
            df_aseg_combined = pd.concat([df_aseg_mapped, df_aseg_db], ignore_index=True)
            df_aseg_combined = df_aseg_combined.drop_duplicates(subset=["asegurado_id"], keep="first")
            df_aseg_combined.to_csv(path_asegurados, index=False)

        # B. Proveedores
        if not df_prov_mapped.empty:
            df_prov_db = pd.read_csv(path_proveedores)
            df_prov_combined = pd.concat([df_prov_mapped, df_prov_db], ignore_index=True)
            df_prov_combined = df_prov_combined.drop_duplicates(subset=["proveedor_id"], keep="first")
            df_prov_combined.to_csv(path_proveedores, index=False)

        # C. Pólizas
        if not df_pol_mapped.empty:
            df_pol_db = pd.read_csv(path_polizas)
            df_pol_combined = pd.concat([df_pol_mapped, df_pol_db], ignore_index=True)
            df_pol_combined = df_pol_combined.drop_duplicates(subset=["poliza_id"], keep="first")
            df_pol_combined.to_csv(path_polizas, index=False)

        # D. Siniestros
        df_sin_db = pd.read_csv(path_siniestros)
        df_sin_db = df_sin_db[~df_sin_db["claim_id"].isin(df_sin_mapped["claim_id"])]
        
        for col in ["placa_vehiculo", "fecha_inicio_poliza", "fecha_fin_poliza"]:
            if col not in df_sin_db.columns:
                df_sin_db[col] = ""
                
        df_sin_combined = pd.concat([df_sin_mapped, df_sin_db], ignore_index=True)
        df_sin_combined.to_csv(path_siniestros, index=False)

        # Recargar datasets en memoria de data_loader
        data_loader.cargar_y_limpiar_datasets()
        
        # Obtener el claim ID del primer siniestro ingresado
        first_claim_id = str(df_sin_mapped["claim_id"].iloc[0]) if not df_sin_mapped.empty else "CLM-2026-001"
        
        logger.info(f"¡Ingesta masiva completada! {len(df_sin_mapped)} siniestros registrados.")

        return {
            "status": "success",
            "claim_id": first_claim_id,
            "is_batch_import": True,
            "imported_counts": {
                "siniestros": len(df_sin_mapped),
                "polizas": len(df_pol_mapped),
                "asegurados": len(df_aseg_mapped),
                "proveedores": len(df_prov_mapped)
            },
            "extracted_fields": {
                "claim_id": first_claim_id,
                "poliza_id": str(df_sin_mapped["poliza_id"].iloc[0]) if not df_sin_mapped.empty else "POL-2026-001",
                "asegurado_id": str(df_sin_mapped["asegurado_id"].iloc[0]) if not df_sin_mapped.empty else "ASEG-1001",
                "nombre_asegurado": "Lote de Ingesta Masiva",
                "ruc_asegurado": "Multiples Registros",
                "nombre_proveedor": "Multiples Registros",
                "ramo": "BATCH",
                "fecha_siniestro": str(df_sin_mapped["fecha_siniestro"].iloc[0]) if not df_sin_mapped.empty else "2026-05-29",
                "monto_reclamado": float(df_sin_mapped["monto_reclamado"].iloc[0]) if not df_sin_mapped.empty else 0.0,
                "lat_siniestro": 0.0,
                "lon_siniestro": 0.0,
                "severidad": "LOW",
                "narrativa_libre": f"Lote de Ingesta Masiva: {len(df_sin_mapped)} registros importados exitosamente.",
                "placa_vehiculo": str(df_sin_mapped["placa_vehiculo"].iloc[0]) if not df_sin_mapped.empty else ""
            }
        }
