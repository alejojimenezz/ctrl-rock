"""
exchange_rates.py - Conversión de divisas (USD → COP)

Usa ExchangeRate-API con caché local para no exceder límites.
Fallback a FxRates si la API principal falla.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURACIÓN
# ==========================================

EXCHANGE_API_KEY = os.getenv("EXCHANGE_API_KEY", "")
FXRATES_API_KEY = os.getenv("FXRATES_API_KEY", "")
CACHE_FILE = Path(__file__).parent / "cache" / "exchange_rates.json"
CACHE_DURATION_HOURS = 12


def _ensure_cache_dir():
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)


def _load_cache():
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        cached_time = datetime.fromisoformat(data.get("timestamp", ""))
        if datetime.now() - cached_time < timedelta(hours=CACHE_DURATION_HOURS):
            logger.info(f"Caché de tasas vigente (actualizada: {cached_time})")
            return data.get("rate")
        else:
            logger.info("Caché de tasas expirada, se requiere actualización")
            return None
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"Error al cargar caché de tasas: {e}")
        return None


def _save_cache(rate):
    _ensure_cache_dir()
    data = {"timestamp": datetime.now().isoformat(), "rate": rate}
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Caché de tasas guardada: 1 USD = {rate:.2f} COP")


def _obtener_tasa_exchange_api():
    """Obtener tasa desde ExchangeRate-API v6."""
    if not EXCHANGE_API_KEY:
        return None
    try:
        url = f"https://v6.exchangerate-api.com/v6/{EXCHANGE_API_KEY}/latest/USD"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("result") == "success":
                return data.get("conversion_rates", {}).get("COP")
    except Exception as e:
        logger.warning(f"ExchangeRate-API falló: {e}")
    return None


def _obtener_tasa_fxrates():
    """Obtener tasa desde FxRates (fallback)."""
    if not FXRATES_API_KEY:
        return None
    try:
        response = requests.get(
            "https://api.fxratesapi.com/latest",
            params={"base": "USD", "symbols": "COP"},
            headers={"Authorization": f"Bearer {FXRATES_API_KEY}"},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("rates", {}).get("COP")
    except Exception as e:
        logger.warning(f"FxRates falló: {e}")
    return None


def obtener_tasa_usd_cop(refresh=False):
    """Obtener tasa de cambio USD→COP con caché y fallback."""
    if not refresh:
        cached_rate = _load_cache()
        if cached_rate is not None:
            return cached_rate

    logger.info("Consultando tasa de cambio...")
    tasa = _obtener_tasa_exchange_api()

    if tasa is None and FXRATES_API_KEY:
        logger.info("Intentando FxRates como fallback...")
        tasa = _obtener_tasa_fxrates()

    if tasa is None:
        tasa = 4200.0
        logger.warning(f"Ninguna API disponible, usando tasa por defecto: {tasa}")

    _save_cache(tasa)
    return tasa


def convertir_a_cop(monto_usd):
    """Convertir un monto en USD a COP."""
    tasa = obtener_tasa_usd_cop()
    return round(monto_usd * tasa, 2)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("\n" + "=" * 50)
    print("Ctrl+Rock - Tasa de Cambio USD/COP")
    print("=" * 50)
    tasa = obtener_tasa_usd_cop(refresh=True)
    print(f"\nTasa actual: 1 USD = {tasa:.2f} COP")
    for usd in [1, 10, 100, 500]:
        cop = convertir_a_cop(usd)
        print(f"  ${usd} USD → ${cop:,.2f} COP")
