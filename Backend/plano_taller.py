import fitz
from pathlib import Path
from datetime import datetime


def escribir_junto_a_texto(
    pagina,
    texto_buscar,
    texto_escribir,
    offset_x=110,  # Ajustado usando x0 como base para alineación perfecta
    offset_y=-2,
    fontsize=10
):
    """
    Busca un texto dentro del PDF y escribe otro a su derecha.
    Usamos rect.x0 (el inicio de la etiqueta de texto) para asegurar
    una alineación vertical perfecta, sin importar el largo del texto buscado.
    """
    resultados = pagina.search_for(texto_buscar)

    if not resultados:
        print(f"No se encontró: {texto_buscar}")
        return False

    rect = resultados[0]

    # Al usar rect.x0 como base, todos los valores de una misma columna
    # comenzarán exactamente en la misma coordenada X.
    pagina.insert_text(
        (
            rect.x0 + offset_x,
            rect.y1 + offset_y
        ),
        str(texto_escribir),
        fontsize=fontsize,
    )

    return True


BASE_DIR = Path(__file__).resolve().parent.parent

PLANOS_ORIGINALES = BASE_DIR / "assets" / "planos" / "originales"
PLANOS_PEDIDOS = BASE_DIR / "assets" / "planos" / "pedidos"

PLANOS_PEDIDOS.mkdir(parents=True, exist_ok=True)


def generar_plano_taller(
    pedido_id,
    cliente,
    configuracion
):
    # --- Diccionario de conversión: Frontend -> Nombre del archivo PDF (Decimales) ---
    TAMANOS_DECIMALES = {
        "1_4": "0.25",
        "1_2": "0.5",
        "3_4": "0.75",
        "4_4": "1.0",
    }

    # --- Diccionarios de traducción para el texto elegante que se estampa ---
    MATERIAL = {
        "fresno": "Fresno Américano",
        "nogal": "Nogal Negro Exótico",
        "caoba": "Caoba de Honduras",
    }
    
    COLORES = {
        "natural": "Natural",
        "cherry": "Rojo Cereza",
        "carbon": "Negro Carbón",
    }
    
    # 1. Extraemos las variables del frontend
    modelo = configuracion["modelo"]         # ej: "danelectro"
    tamano_raw = configuracion["tamano"]     # ej: "1_2"
    madera_raw = configuracion["madera"]     # ej: "fresno"
    acabado_raw = configuracion["acabado"]   # ej: "carbon"

    # Convertimos el tamaño del frontend ("1_2") a su decimal correspondiente ("0.5")
    tamano_decimal = TAMANOS_DECIMALES.get(tamano_raw, str(tamano_raw))

    # 2. Construimos el nombre del archivo usando el formato decimal.
    # Esto buscará en tu carpeta de originales archivos como: "danelectro-0.5.pdf" o "lespaul-1.0.pdf"
    nombre_archivo = f"{modelo}-{tamano_decimal}.pdf"
    ruta_original = PLANOS_ORIGINALES / nombre_archivo

    if not ruta_original.exists():
        print("\n======================")
        print("Buscando plano base:", nombre_archivo)
        print("Ruta esperada:", ruta_original)
        print("======================\n")
        raise FileNotFoundError(f"No existe el plano original: {ruta_original}")

    doc = fitz.open(ruta_original)
    pagina = doc[0]

    # --- Bloque de Información del Cliente ---
    escribir_junto_a_texto(pagina, "NOMBRE CLIENTE", cliente.get("nombre", ""))
    escribir_junto_a_texto(pagina, "TELEFONO", cliente.get("telefono", ""))
    escribir_junto_a_texto(pagina, "CORREO", cliente.get("email", ""), fontsize=9)
    escribir_junto_a_texto(pagina, "FECHA COTIZACION", datetime.now().strftime("%d/%m/%Y"))

    # --- Bloque de Material y Color (con un offset más corto de 60 para columnas estrechas) ---
    madera_elegante = MATERIAL.get(madera_raw, str(madera_raw).title())
    color_elegante = COLORES.get(acabado_raw, str(acabado_raw).title())

    escribir_junto_a_texto(pagina, "MATERIAL", madera_elegante, offset_x=60)
    escribir_junto_a_texto(pagina, "COLOR", color_elegante, offset_x=60)

    # 3. Guardamos el plano personalizado del pedido en la carpeta de pedidos
    ruta_salida = PLANOS_PEDIDOS / f"Pedido_{pedido_id}.pdf"
    doc.save(ruta_salida)
    doc.close()

    return ruta_salida