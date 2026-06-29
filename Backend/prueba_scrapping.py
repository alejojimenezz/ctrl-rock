import requests
import json
import re
import time
from bs4 import BeautifulSoup

# ==========================================
# CONFIGURACIÓN
# ==========================================

API_KEY = "b993945ec0271774fadc16de1f30792698614eca"

PRODUCTOS = {
    "Trastes": "B003B0D4OU",
    "Clavijeros": "B082ZNPSGZ",
    "Knobs": "B0BLMWPDQ9",
    "Puente": "B0FY5M9G97",
    "Pastillas Alnico": "B0FZKM55QD"
}

MAX_INTENTOS = 10
ESPERA_SEGUNDOS = 3

# ==========================================
# EXTRAER PRECIO
# ==========================================

def extraer_precio(soup):

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

            match = re.search(
                r"\$\d+(?:,\d{3})*(?:\.\d{2})?",
                texto
            )

            if match:
                return match.group()

    return None

# ==========================================
# CONSULTAR PRODUCTO
# ==========================================

def consultar_precio(asin):

    try:

        response = requests.get(
            "https://api.zenrows.com/v1/",
            params={
                "url": f"https://www.amazon.com/dp/{asin}",
                "apikey": API_KEY
            },
            timeout=60
        )

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        return extraer_precio(soup)

    except:
        return None

# ==========================================
# SCRAPING CON REINTENTOS
# ==========================================

resultados = {}

pendientes = PRODUCTOS.copy()

print("\n--- Consultando precios ---")

for intento in range(1, MAX_INTENTOS + 1):

    if not pendientes:
        break

    print(f"\n========== INTENTO {intento}/{MAX_INTENTOS} ==========")

    resueltos = []

    for nombre, asin in pendientes.items():

        print(f"Consultando {nombre}...")

        precio = consultar_precio(asin)

        if precio:

            resultados[nombre] = precio

            print(f"✅ {nombre}: {precio}")

            resueltos.append(nombre)

        else:

            print(f"❌ {nombre}: None")

    # Eliminar productos ya resueltos
    for nombre in resueltos:
        pendientes.pop(nombre)

    # Si ya están todos, salir
    if not pendientes:
        break

    print(
        f"\nEsperando {ESPERA_SEGUNDOS} segundos antes del siguiente intento..."
    )

    time.sleep(ESPERA_SEGUNDOS)

# ==========================================
# MARCAR LOS QUE FALLARON
# ==========================================

for nombre in pendientes:
    resultados[nombre] = "No encontrado"

# ==========================================
# GUARDAR JSON
# ==========================================

with open(
    "precios_actuales.json",
    "w",
    encoding="utf-8"
) as archivo:

    json.dump(
        resultados,
        archivo,
        indent=4,
        ensure_ascii=False
    )

# ==========================================
# RESUMEN FINAL
# ==========================================

print("\n==============================")
print("RESULTADO FINAL")
print("==============================")

for nombre in PRODUCTOS:

    precio = resultados.get(nombre)

    if precio != "No encontrado":
        print(f"✅ {nombre}: {precio}")
    else:
        print(f"❌ {nombre}: No encontrado")

# ==========================================
# COSTO TOTAL
# ==========================================

USD_A_COP = 3850
COSTO_FABRICACION = 1_000_000

total_usd = 0

for precio in resultados.values():

    if precio != "No encontrado":

        try:
            total_usd += float(
                precio.replace("$", "").replace(",", "")
            )
        except:
            pass

total_cop = total_usd * USD_A_COP
precio_final = total_cop + COSTO_FABRICACION
# Guardar resumen para el frontend
with open("resultado_cotizacion.json", "w", encoding="utf-8") as archivo:
    json.dump({
        "precio_final_cop": round(precio_final),
        "precio_componentes_cop": round(total_cop),
        "total_usd": round(total_usd, 2)
    }, archivo, indent=4)

print("\n==============================")
print(f"TOTAL USD: ${total_usd:.2f}")
print(f"TOTAL COP COMPONENTES: ${total_cop:,.0f}")
print(f"COSTO FABRICACIÓN: ${COSTO_FABRICACION:,.0f}")
print("------------------------------")
print(f"PRECIO FINAL GUITARRA: ${precio_final:,.0f} COP")
print("==============================")