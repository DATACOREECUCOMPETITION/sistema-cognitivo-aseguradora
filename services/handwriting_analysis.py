import base64
import json
import logging
import re
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("handwriting_analysis")

PROMPT_ANALISIS = (
    "Realiza un análisis caligráfico y estilométrico forense exhaustivo y extremadamente detallado de esta "
    "imagen de un documento escrito a mano (por ejemplo, un parte policial, informe o declaración).\n\n"
    "Debes inspeccionar meticulosamente todo el contenido visible de la imagen y redactar un informe profesional estructurado, "
    "de al menos dos o tres párrafos completos y detallados, abordando los siguientes puntos:\n"
    "1. **Análisis Morfológico de los Trazos**: Describe detalladamente el tipo de letra (cursiva, imprenta, redondeada, angulosa), "
    "la inclinación, la presión del bolígrafo (si es detectable), el espaciado entre palabras y la alineación de las líneas.\n"
    "2. **Comparación Inter-Seccional**: Compara meticulosamente diferentes partes del documento (por ejemplo, la cabecera vs. el cuerpo, "
    "las firmas, los campos rellenados vs. el texto libre, o un párrafo respecto al siguiente). "
    "Busca y detalla de forma explícita si existe un cambio de letra (un tipo de caligrafía en una sección y otra letra distinta en otra), "
    "lo cual indicaría que fue llenado por varias personas o alterado posteriormente.\n"
    "3. **Evidencias de Alteración**: Detalla si hay tachaduras, enmiendas, sobreescrituras, diferencias de tinta, o agregados anómalos.\n"
    "4. **Dictamen de Consistencia**: Finaliza con una conclusión técnica muy clara e inequívoca de si la caligrafía es 'consistente' "
    "(el documento completo fue redactado por una misma persona de forma continua y sin anomalías) o 'inconsistente' "
    "(se detecta mezcla de caligrafías, letras distintas, o alteraciones evidentes).\n\n"
    "Sé sumamente descriptivo, profesional y minucioso en tu redacción. Evita resúmenes telegráficos o frases cortas e inconclusas."
)


def _normalize_text(value: str) -> str:
    return " ".join(value.strip().split()).lower()


def _safe_parse_json(payload: str) -> Dict[str, Any]:
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return {}


def _fallback_response(reason: str) -> Dict[str, Any]:
    return {
        "analisis_exitoso": False,
        "caligrafia_consistente": True,
        "detalles_analisis": reason,
        "regla_activada": "",
        "score_riesgo": 0,
    }


def _build_success_response(consistent: bool, details: str) -> Dict[str, Any]:
    rule = "RF-02" if not consistent else ""
    score = 10 if not consistent else 0
    return {
        "analisis_exitoso": True,
        "caligrafia_consistente": consistent,
        "detalles_analisis": details,
        "regla_activada": rule,
        "score_riesgo": score,
    }


async def analyze_handwriting(
    image_bytes: bytes,
    api_key: Optional[str],
    content_type: Optional[str] = None,
) -> Dict[str, Any]:
    if not image_bytes:
        return _fallback_response("No se recibio contenido de imagen para analizar.")

    # Permitir bypass local para preservar cuota de API en desarrollo/pruebas
    try:
        from core.config import settings
        if settings.BYPASS_GEMINI:
            logger.warning("⚠️ BYPASS CALIGRAFIA ACTIVO: Retornando dictamen simulado local para preservar cuota API.")
            return _build_success_response(
                consistent=True,
                details=(
                    "[MODO CONTINGENCIA LOCAL] Se simula un análisis caligráfico exitoso local. "
                    "Los trazos morfológicos, la inclinación y el tipo de letra del escrito a mano "
                    "han sido evaluados localmente sobre el documento de prueba y presentan consistencia "
                    "en todas sus secciones."
                )
            )
    except Exception as e:
        logger.error("No se pudo evaluar BYPASS_GEMINI en caligrafia: %s", e)

    prompt = PROMPT_ANALISIS

    if not api_key:
        return _fallback_response(
            "Analisis visual no disponible: configure GEMINI_API_KEY en el entorno."
        )

    try:
        encoded_image = base64.b64encode(image_bytes).decode("ascii")
        mime_type = content_type if content_type in ("image/jpeg", "image/png") else "image/jpeg"
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent"
        )
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": mime_type, "data": encoded_image}},
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
                "thinkingConfig": {
                    "thinkingBudget": 0
                }
            },
        }
        headers = {
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                headers=headers,
                params={"key": api_key},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        text_output = ""
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                text_chunks = [p.get("text", "") for p in parts if p.get("text")]
                text_output = "\n".join(text_chunks).strip()

        # Escribir logs de depuracion detallados para inspeccionar truncamiento
        try:
            with open("/home/hackaton/HACKATON_FINAL/handwriting_debug.log", "w", encoding="utf-8") as f:
                f.write("=== RAW GEMINI DATA ===\n")
                f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n\n")
                f.write("=== EXTRACTED TEXT OUTPUT ===\n")
                f.write(text_output + "\n")
        except Exception as log_err:
            logger.error("No se pudo escribir archivo de depuracion: %s", log_err)

        if not text_output:
            return _fallback_response("El motor visual no devolvio un analisis interpretable.")

        normalized = _normalize_text(text_output)
        inconsistent = any(
            token in normalized
            for token in [
                "inconsistente",
                "inconsistencia",
                "distintas letras",
                "letra distinta",
                "alteraciones evidentes",
                "mezcla de caligrafias",
            ]
        )
        if "consistente" in normalized and "inconsistente" not in normalized:
            inconsistent = False

        # Regla de cumplimiento etico: evitar terminos acusatorios en la salida (insensible a mayusculas/minusculas)
        detalles = re.sub(r'(?i)fraude[s]?', 'alerta de revision', text_output)

        return _build_success_response(not inconsistent, detalles)
    except Exception as exc:
        logger.error("Fallo analisis caligrafia: %s", exc)
        return _fallback_response(
            "No se pudo completar el analisis visual. "
            "Se recomienda revision manual del documento."
        )
