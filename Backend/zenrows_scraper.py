"""
zenrows_scraper.py - Extracción de precios Amazon vía ZenRows API

Mapea componentes de guitarra a ASINs y obtiene precios en tiempo real.
Usa caché local (JSON) para no exceder límites de la API.
"""

import os
import re
import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import requests

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURACIÓN
# ==========================================

API_KEY = os.getenv("ZENROWS_API_KEY", "")
CACHE_FILE = Path(__file__).parent / "cache" / "amazon_precios.json"
CACHE_DURATION_HOURS = 6
MAX_INTENTOS = 5
ESPERA_SEGUNDOS = 2

ASIN_MAP = {
    "trastes": "B003B0D4OU",
    "trastes_dunlop": "B003B0D4OU",
    "trastes_jescar": "B07XKQY8VH",
    "clavijeros": "B082ZNPSGZ",
    "clavijeros_grover": "B082ZNPSGZ",
    "clavijeros_grover_1by4": "B07FHSQ3VH",
    "clavijeros_shafer": "B09TQ5K3YL",
    "knobs": "B0BLMWPDQ9",
    "knobs_clase": "B0BLMWPDQ9",
    "knobs_top": "B0C1J8Y7KL",
    "puente": "B0FY5M9G97",
    "puente_gotoh": "B0FY5M9G97",
    "puente_tremolo": "B0C3K8N2PL",
    "puente_fixo": "B0BW4H7T9R",
    "pastillas_alnico": "B0FZKM55QD",
    "pastillas_ceramicas": "B0C8M3N4QR",
    "pastillas_luminance": "B0BW9K2T7L",
}

CATEGORIAS = ["trastes", "clavijeros", "knobs", "puente", "pastillas"]

# Traduce los valores que manda el frontend/configurador (p.ej. "humbucker",
# "tremolo", "top_hat") a las claves reales del diccionario de precios
# (ASIN_MAP / default_prices). Si una opción no está aquí, se usa tal cual
# como clave (fallback) y, si tampoco existe en `precios`, se cobra $0 y se
# loggea un warning en vez de reventar.
OPCION_A_CLAVE = {
    "trastes": {"estandar": "trastes_dunlop", "jumbo": "trastes_jescar", "narrow_tall": "trastes_dunlop"},
    "clavijeros": {"grover": "clavijeros_grover", "schaller": "clavijeros_shafer", "grover_rotomatic": "clavijeros_grover_1by4"},
    "knobs": {"top_hat": "knobs_clase", "domed": "knobs_clase", "speed": "knobs_top"},
    "puente": {"tremolo": "puente_tremolo", "fixed_stopbar": "puente_fixo"},
    "pastillas": {"humbucker": "pastillas_alnico", "singlecoil": "pastillas_ceramicas", "single_coil": "pastillas_ceramicas", "p90": "pastillas_luminance"},
}


def _ensure_cache_dir():
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)


def _load_cache():
    if not CACHE_FILE.exists():
        return {}
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("el caché no es un objeto JSON válido")
        precios = data.get("precios", {})
        if not isinstance(precios, dict):
            raise ValueError("'precios' en el caché no es un diccionario")
        cached_time = datetime.fromisoformat(data.get("timestamp", ""))
        if datetime.now() - cached_time < timedelta(hours=CACHE_DURATION_HOURS):
            logger.info(f"Caché vigente (actualizada: {cached_time})")
            return precios
        else:
            logger.info("Caché expirada, se requiere actualización")
            return {}
    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
        logger.warning(f"Caché corrupta o con formato inválido, se ignora: {e}")
        return {}


def _save_cache(precios):
    _ensure_cache_dir()
    data = {"timestamp": datetime.now().isoformat(), "precios": precios}
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    logger.info(f"Caché guardada en {CACHE_FILE}")


def _extraer_precio(soup):
    selectores = [
        "#corePrice_feature_div .a-offscreen",
        ".priceToPay .a-offscreen",
        "#apex_desktop .a-offscreen",
        ".reinventPricePriceToPayMargin .a-offscreen",
        ".a-price .a-offscreen"
    ]
    for selector in selectores:
        elemento = soup.select_one(selector)
        if elemento:
            texto = elemento.get_text(strip=True)
            match = re.search(r"\$\d+(?:,\d{3})*(?:\.\d{2})?", texto)
            if match:
                return match.group()
    return None


def _consultar_precio(asin):
    if not API_KEY:
        logger.error("ZENROWS_API_KEY no configurada")
        return None
    try:
        response = requests.get(
            "https://api.zenrows.com/v1/",
            params={"url": f"https://www.amazon.com/dp/{asin}", "apikey": API_KEY, "javascript": "true"},
            timeout=60
        )
        if response.status_code != 200:
            logger.warning(f"ZenRows HTTP {response.status_code} para ASIN {asin}")
            return None
        soup = BeautifulSoup(response.text, "html.parser")
        precio = _extraer_precio(soup)
        if precio:
            logger.info(f"ASIN {asin}: {precio}")
        else:
            logger.warning(f"No se encontró precio para ASIN {asin}")
        return precio
    except requests.exceptions.Timeout:
        logger.error(f"Timeout consultando ASIN {asin}")
        return None
    except Exception as e:
        logger.error(f"Error consultando ASIN {asin}: {e}")
        return None


def _parsear_precio(precio_str):
    if not precio_str:
        return None
    try:
        cleaned = precio_str.replace("$", "").replace(",", "")
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def obtener_precios_componentes(refresh=False):
    """Obtener precios de todos los componentes. Si refresh=True, fuerza actualización."""
    if not refresh:
        cache_precios = _load_cache()
        if cache_precios:
            return cache_precios

    logger.info("Consultando precios desde Amazon...")
    resultados = {}
    pendientes = {k: v for k, v in ASIN_MAP.items()}

    for intento in range(1, MAX_INTENTOS + 1):
        if not pendientes:
            break
        logger.info(f"Intento {intento}/{MAX_INTENTOS}")
        resueltos = []
        for nombre, asin in list(pendientes.items()):
            precio_str = _consultar_precio(asin)
            if precio_str:
                resultados[nombre] = {
                    "precio": _parsear_precio(precio_str),
                    "enlace": f"https://www.amazon.com/dp/{asin}"
                }
                resueltos.append(nombre)
        for nombre in resueltos:
            del pendientes[nombre]
        if pendientes and intento < MAX_INTENTOS:
            time.sleep(ESPERA_SEGUNDOS)

    default_prices = {
        "trastes": {"precio": 15.0, "enlace": "https://www.amazon.com/dp/B003B0D4OU"},
        "trastes_dunlop": {"precio": 15.0, "enlace": "https://www.amazon.com/dp/B003B0D4OU"},
        "trastes_jescar": {"precio": 25.0, "enlace": "https://www.amazon.com/dp/B07XKQY8VH"},
        "clavijeros": {"precio": 45.0, "enlace": "https://www.amazon.com/dp/B082ZNPSGZ"},
        "clavijeros_grover": {"precio": 45.0, "enlace": "https://www.amazon.com/dp/B082ZNPSGZ"},
        "clavijeros_grover_1by4": {"precio": 80.0, "enlace": "https://www.amazon.com/dp/B07FHSQ3VH"},
        "clavijeros_shafer": {"precio": 120.0, "enlace": "https://www.amazon.com/dp/B09TQ5K3YL"},
        "knobs": {"precio": 12.0, "enlace": "https://www.amazon.com/dp/B0BLMWPDQ9"},
        "knobs_clase": {"precio": 12.0, "enlace": "https://www.amazon.com/dp/B0BLMWPDQ9"},
        "knobs_top": {"precio": 25.0, "enlace": "https://www.amazon.com/dp/B0C1J8Y7KL"},
        "puente": {"precio": 65.0, "enlace": "https://www.amazon.com/dp/B0FY5M9G97"},
        "puente_gotoh": {"precio": 65.0, "enlace": "https://www.amazon.com/dp/B0FY5M9G97"},
        "puente_tremolo": {"precio": 90.0, "enlace": "https://www.amazon.com/dp/B0C3K8N2PL"},
        "puente_fixo": {"precio": 45.0, "enlace": "https://www.amazon.com/dp/B0BW4H7T9R"},
        "pastillas_alnico": {"precio": 85.0, "enlace": "https://www.amazon.com/dp/B0FZKM55QD"},
        "pastillas_ceramicas": {"precio": 55.0, "enlace": "https://www.amazon.com/dp/B0C8M3N4QR"},
        "pastillas_luminance": {"precio": 150.0, "enlace": "https://www.amazon.com/dp/B0BW9K2T7L"},
    }
    for nombre in pendientes:
        resultados[nombre] = default_prices.get(nombre, {"precio": 30.0, "enlace": ""})
        logger.warning(f"ASIN no disponible para {nombre}, usando precio por defecto")

    # Formatear resultados para backward compatibility: si el valor es un número,
    # lo convertimos a dict con precio y enlace por defecto.
    resultados_formateados = {}
    for k, v in resultados.items():
        if isinstance(v, (int, float)):
            resultados_formateados[k] = {"precio": float(v), "enlace": f"https://www.amazon.com/dp/{ASIN_MAP.get(k, '')}"}
        else:
            resultados_formateados[k] = v

    _save_cache(resultados_formateados)
    return resultados_formateados


def calcular_precio_hardware(configuracion):
    """Calcular el costo total de hardware basado en la configuración del usuario.

    Devuelve SIEMPRE un dict: {"total_usd": float, "desglose": {categoria: {...}}}
    """
    precios = obtener_precios_componentes()
    if not isinstance(precios, dict):
        raise ValueError(
            f"obtener_precios_componentes() devolvió un {type(precios).__name__} "
            "en vez de un dict; revisa cache/amazon_precios.json"
        )

    total_usd = 0.0
    desglose = {}
    for categoria in CATEGORIAS:
        seleccion = configuracion.get(categoria, "")
        if not seleccion:
            continue
        clave_precio = OPCION_A_CLAVE.get(categoria, {}).get(seleccion, seleccion)
        entry = precios.get(clave_precio)
        if entry is None:
            logger.warning(
                f"Sin precio para {categoria}='{seleccion}' (clave '{clave_precio}'); usando $0.0"
            )
            precio = 0.0
            enlace = ""
        elif isinstance(entry, dict):
            precio = entry.get("precio", 0.0)
            enlace = entry.get("enlace", "")
        else:
            precio = float(entry)
            enlace = f"https://www.amazon.com/dp/{ASIN_MAP.get(clave_precio, '')}"
        desglose[categoria] = {
            "opcion": seleccion,
            "clave_precio": clave_precio,
            "precio_usd": precio,
            "enlace": enlace
        }
        total_usd += precio
        logger.debug(f"{categoria} → {seleccion}: ${precio:.2f}")

    return {"total_usd": round(total_usd, 2), "desglose": desglose}


def refrescar_precios():
    """Forzar actualización de todos los precios desde Amazon.

    Devuelve un dict: {"actualizados": int, "precios": dict, "timestamp": str}
    """
    precios = obtener_precios_componentes(refresh=True)
    return {
        "actualizados": len(precios),
        "precios": precios,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("\n" + "=" * 50)
    print("Ctrl+Rock - Actualización de Precios Amazon")
    print("=" * 50)
    precios = obtener_precios_componentes(refresh=True)
    print("\nPrecios obtenidos:")
    for nombre, precio in precios.items():
        status = "✅" if precio else "❌"
        print(f"  {status} {nombre}: ${precio:.2f}")
    total = sum(p or 0 for p in precios.values())
    print(f"\nTotal USD: ${total:.2f}")