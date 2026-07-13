"""
precios.py - Diccionario centralizado de precios Ctrl+Rock

Todas las partes personalizables con sus costos:
- Arbitrarias (definidas manualmente en COP)
- Hardware (obtenidas desde Amazon via ZenRows, precios default en USD)

Un solo lugar para auditarlos y modificarlos.
"""

# ==========================================
# PRECIOS ARBITRARIOS (COP)
# ==========================================

PRECIOS_MODELO = {
    "lespaul": 600000,
    "telecaster": 500000,
    "ibanezxp": 650000,
    "stingray": 600000,
    "espex": 700000,
    "danelectro": 450000,
}

PRECIOS_MADERA = {
    "fresno": 0,          # precio base, incluido en el modelo
    "caoba": 150000,
    "nogal": 300000,
}

PRECIOS_ACABADO = {
    "cherry": 50000,
    "natural": 25000,
    "carbon": 45000,
}

PRECIOS_TAMANO = {
    "1_4": 0,
    "1_2": 0,
    "3_4": 0,
    "4_4": 0,
}

PRECIOS_PICKS = {
    "rojo": 5000,
    "amarillo": 5000,
    "azul": 5000,
    "rosado": 5000,
    "morado": 5000,
}

# ==========================================
# MAPEO DE COMPONENTES FRONTEND -> BACKEND
# ==========================================
# Traduce los valores que manda el configurador.js a las claves
# de los diccionarios de precios.

MAPEO_MODELO = {
    "lespaul": "lespaul",
    "telecaster": "telecaster",
    "ibanezxp": "ibanezxp",
    "stingray": "stingray",
    "espex": "espex",
    "danelectro": "danelectro",
}

MAPEO_MADERA = {
    "fresno": "fresno",
    "caoba": "caoba",
    "nogal": "nogal",
}

MAPEO_ACABADO = {
    "cherry": "cherry",
    "natural": "natural",
    "carbon": "carbon",
}

# ==========================================
# COSTO DE PRODUCCION
# ==========================================
# Cubre mano de obra (2 empleados carpinteria/ensamble) + overhead de taller.
# Calculo:
#   - Salario + prestaciones por empleado: ~$1,600,000 COP/mes
#   - 2 empleados: ~$3,200,000 COP/mes
#   - Produccion estimada: ~10 guitarras/mes
#   - Costo laboral por guitarra: ~$320,000 COP
#   - Overhead taller (herramientas, insumos, electricidad): ~$30,000 COP
#   - Total: $350,000 COP por guitarra
COSTO_PRODUCCION_COP = 350000

# ==========================================
# TASAS DE MARKUP
# ==========================================
# Aplicadas en este orden:
#   1. transporte, imprevistos, ganancia → sobre el subtotal de costos (partes + produccion)
#   2. IVA → sobre el subtotal con margenes
#   3. Comision Stripe → sobre el total con IVA (porque Stripe cobra sobre lo cobrado al cliente)

TASA_TRANSPORTE = 0.05       # 5%  - Logistica de envio
TASA_IMPREVISTOS = 0.04      # 4%  - Reserva para contingencias
TASA_GANANCIA = 0.18         # 18% - Margen de rentabilidad
TASA_IVA = 0.19              # 19% - Impuesto al valor agregado
TASA_STRIPE_PORCENTAJE = 0.029  # 2.9% del total con IVA
TASA_STRIPE_FIJO_USD = 0.30     # $0.30 USD fijo por transaccion

# ==========================================
# PRECIOS DEFAULT HARDWARE (USD)
# Usados como fallback cuando falla el scraping de Amazon
# ==========================================

PRECIOS_DEFAULT_HARDWARE_USD = {
    "trastes": 15.0,
    "clavijeros": 45.0,
    "knobs": 12.0,
    "puente": 65.0,
    "pastillas_alnico": 40.0,
}