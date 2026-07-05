import os
from pathlib import Path
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image,
    Table,
    TableStyle,
)

# =====================================================
# RUTAS DEL PROYECTO
# =====================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

ASSETS_DIR = PROJECT_DIR / "assets"
IMAGES_DIR = ASSETS_DIR / "images"
GUITARRAS_DIR = IMAGES_DIR / "guitarras"
PICKS_DIR = IMAGES_DIR / "picks"

LOGO = ASSETS_DIR / "LogoCTRL+ROCK.png"

FACTURAS_DIR = PROJECT_DIR / "facturas"
FACTURAS_DIR.mkdir(exist_ok=True)

# =====================================================
# NOMBRES PARA MOSTRAR EN LA FACTURA
# =====================================================

MODELOS = {
    "lespaul": "Gibson Les Paul",
    "telecaster": "Fender Telecaster",
    "ibanezxp": "Ibanez XP",
    "stingray": "Music Man StingRay",
    "espex": "ESP EX",
    "danelectro": "Danelectro",
}

MADERAS = {
    "fresno": "Fresno Americano",
    "caoba": "Caoba de Honduras",
    "nogal": "Nogal Negro Exótico",
}

ACABADOS = {
    "carbon": "Carbon",
    "cherry": "Cherry",
    "natural": "Natural",
}

TAMANOS = {
    "1_4": "1/4",
    "1_2": "1/2",
    "3_4": "3/4",
    "4_4": "4/4",
}

PICKS = {
    "amarillo": "amarillo.png",
    "azul": "azul.png",
    "morado": "morado.png",
    "rojo": "rojo.png",
    "rosado": "rosado.png",
}

# =====================================================
# GENERAR FACTURA PDF
# =====================================================

def generar_factura_pdf(pedido_id, cliente, cotizacion, configuracion):
    codigo_pedido = f"CTR-{datetime.now().strftime('%Y%m%d')}-{int(pedido_id):04d}"
    ruta_pdf = FACTURAS_DIR / f"{codigo_pedido}.pdf"

    doc = SimpleDocTemplate(
        str(ruta_pdf),
        pagesize=(21 * cm, 29.7 * cm),
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

    estilos = getSampleStyleSheet()
    
    titulo = estilos["Heading1"]
    titulo.alignment = TA_CENTER
    titulo.textColor = colors.HexColor("#A60000")
    titulo.spaceAfter = 6

    subtitulo = estilos["Heading2"]
    subtitulo.textColor = colors.HexColor("#A60000")
    subtitulo.fontSize = 12
    subtitulo.spaceAfter = 4

    normal = estilos["BodyText"]
    normal.alignment = TA_CENTER

    elementos = []

    # =====================================================
    # ENCABEZADO (LOGO + TÍTULO)
    # =====================================================
    encabezado_datos = []
    
    if LOGO.exists():
        logo = Image(str(LOGO), width=6 * cm, height=1.95 * cm)
        encabezado_datos.append(logo)
    
    encabezado_datos.append(Paragraph("<b>FACTURA DE COMPRA</b>", titulo))
    encabezado_datos.append(Paragraph(f"Pedido: <b>{codigo_pedido}</b><br/>Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}", normal))
    
    for item in encabezado_datos:
        elementos.append(item)
        elementos.append(Spacer(1, 0.2 * cm))
        
    elementos.append(Spacer(1, 0.3 * cm))

    # =====================================================
    # DATOS DEL CLIENTE
    # =====================================================
    elementos.append(Paragraph("DATOS DEL CLIENTE", subtitulo))
    
    tabla_cliente = Table(
        [
            ["Nombre:", cliente.get("nombre", ""), "Doc:", cliente.get("identificacion", "")],
            ["Correo:", cliente.get("email", ""), "Tel:", cliente.get("telefono", "")],
            ["Dirección:", cliente.get("direccion", ""), "Ubicación:", f"{cliente.get('ciudad', '')}, {cliente.get('departamento', '')}"],
        ],
        colWidths=[2.5 * cm, 6.8 * cm, 2.5 * cm, 6.8 * cm],
    )
    
    estilo_tabla_limpia = TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.2, colors.lightgrey),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#FAFAFA")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#FAFAFA")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ])
    
    tabla_cliente.setStyle(estilo_tabla_limpia)
    elementos.append(tabla_cliente)
    elementos.append(Spacer(1, 0.5 * cm))

    # =====================================================
    # INFORMACIÓN DEL INSTRUMENTO
    # =====================================================
    elementos.append(Paragraph("ESPECIFICACIONES DEL INSTRUMENTO", subtitulo))
    
    modelo = MODELOS.get(configuracion.get("modelo", ""), configuracion.get("modelo", ""))
    madera = MADERAS.get(configuracion.get("madera", ""), configuracion.get("madera", ""))
    acabado = ACABADOS.get(configuracion.get("acabado", ""), configuracion.get("acabado", ""))
    tamano = TAMANOS.get(configuracion.get("tamano", ""), configuracion.get("tamano", ""))

    tabla_instrumento = Table(
        [
            ["Modelo:", modelo, "Madera:", madera],
            ["Acabado:", acabado, "Tamaño:", tamano],
        ],
        colWidths=[2.5 * cm, 6.8 * cm, 2.5 * cm, 6.8 * cm],
    )
    tabla_instrumento.setStyle(estilo_tabla_limpia)
    elementos.append(tabla_instrumento)
    elementos.append(Spacer(1, 0.5 * cm))

    # =====================================================
    # IMÁGENES (Guitarra y Pick en paralelo)
    # =====================================================
    ruta_guitarra = GUITARRAS_DIR / f"{configuracion.get('modelo')}-{configuracion.get('madera')}-{configuracion.get('acabado')}.png"
    ruta_pick = PICKS_DIR / PICKS.get(configuracion.get("picks", ""), "")

    imagenes_row = []
    
    if ruta_guitarra.exists():
        imagenes_row.append(Image(str(ruta_guitarra), width=6.5 * cm, height=6.5 * cm))
    else:
        imagenes_row.append(Paragraph("Imagen de modelo no disponible", normal))
        
    if ruta_pick.exists():
        # ¡Aquí está el ajuste! Aumentamos el tamaño a 4 cm
        imagenes_row.append(Image(str(ruta_pick), width=8.0 * cm, height=8.0 * cm))
    else:
        imagenes_row.append(Paragraph("Sin pick de cortesía", normal))

    elementos.append(Paragraph("VISTA PREVIA Y OBSEQUIO", subtitulo))
    
    tabla_imagenes = Table([imagenes_row], colWidths=[9.3 * cm, 9.3 * cm])
    tabla_imagenes.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'), # Esto asegura que el pick quede centrado verticalmente respecto a la guitarra
    ]))
    
    elementos.append(tabla_imagenes)
    elementos.append(Spacer(1, 0.5 * cm))

    # =====================================================
    # TOTAL PAGADO
    # =====================================================
    precio = f"${cotizacion.get('precio_final_cop', 0):,.0f} COP"
    tabla_precio = Table([["TOTAL PAGADO", precio]], colWidths=[9.3 * cm, 9.3 * cm])
    tabla_precio.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#A60000")),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#EAEAEA")),
        ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.black),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 1, colors.HexColor("#A60000")),
    ]))
    elementos.append(tabla_precio)
    elementos.append(Spacer(1, 0.5 * cm))

    # =====================================================
    # MENSAJE FINAL
    # =====================================================
    mensaje = """
    <para align="center">
    <b>¡Gracias por confiar en CTRL + ROCK!</b><br/><br/>
    Hemos recibido correctamente tu pedido. Nuestro equipo iniciará el proceso de fabricación de tu instrumento.<br/>
    <b>Tiempo estimado de fabricación y envío:</b> 15 días calendario.<br/><br/>
    ¿Tienes dudas? Comunícate a <b>contacto@ctrlrock.com</b> | <b>www.ctrlrock.com</b>
    </para>
    """
    
    estilo_mensaje = estilos["BodyText"]
    estilo_mensaje.fontSize = 9
    
    elementos.append(Paragraph(mensaje, estilo_mensaje))
    elementos.append(Spacer(1, 0.4 * cm))

    # =====================================================
    # PIE DE PÁGINA
    # =====================================================
    elementos.append(
        Paragraph(
            "<para align='center'><font size='7' color='gray'>"
            "Documento generado automáticamente por el sistema Ctrl+Rock. "
            "Conserva esta factura como comprobante de compra."
            "</font></para>",
            estilos["Normal"],
        )
    )

    doc.build(elementos)
    return str(ruta_pdf)