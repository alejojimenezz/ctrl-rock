"""
email_service.py - Envío de correos electrónicos (SMTP)

Envía correos de confirmación de pago y cotizaciones desde el backend.
Compatible con Gmail, SendGrid SMTP u otros proveedores.
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from datetime import datetime as dt
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURACIÓN SMTP
# ==========================================

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)

# Dry run para pruebas sin enviar realmente
DRY_RUN = os.getenv("EMAIL_DRY_RUN", "false").lower() == "true"


def _conectar_smtp():
    """Crear conexión SMTP con STARTTLS."""
    if not SMTP_USER or not SMTP_PASS:
        logger.error("❌ Configuración SMTP incompleta (SMTP_USER/SMTP_PASS no definidos)")
        return None
    try:
        logger.info(f"🔌 Conectando a SMTP: {SMTP_HOST}:{SMTP_PORT}")
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        logger.info("✅ Conexión SMTP establecida correctamente")
        return server
    except Exception as e:
        logger.error(f"❌ Error al conectar SMTP: {e}")
        return None


def enviar_correo(destinatario, asunto, cuerpo_html):
    """Enviar un correo electrónico HTML."""
    if not destinatario or "@" not in destinatario:
        logger.error(f"❌ Email inválido: {destinatario}")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = FROM_EMAIL
    msg["To"] = destinatario
    msg["Subject"] = asunto
    msg.attach(MIMEText(cuerpo_html, "html"))

    # Modo prueba: solo log, no envía
    if DRY_RUN:
        logger.warning(f"⚠️  DRY_RUN ACTIVO: No se envió correo a {destinatario}")
        logger.debug(f"   Asunto: {asunto}")
        return True

    server = _conectar_smtp()
    if not server:
        logger.error(f"❌ No se pudo conectar SMTP para enviar a {destinatario}")
        return False
    try:
        logger.info(f"📧 Enviando correo a {destinatario}: {asunto}")
        server.sendmail(FROM_EMAIL, [destinatario], msg.as_string())
        logger.info(f"✅ Correo enviado exitosamente a {destinatario}")
        return True
    except Exception as e:
        logger.error(f"❌ Error al enviar correo a {destinatario}: {e}")
        return False
    finally:
        try:
            server.quit()
        except Exception:
            pass


def generar_html_cotizacion(nombre, email, detalles, precio_total):
    """Generar HTML para correo de cotización."""
    items_html = ""
    for item, valor in detalles.items():
        items_html += f"<li><strong>{item}</strong>: {valor}</li>\n"
    
    fecha = dt.now().strftime("%d/%m/%Y %H:%M")
    
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body {{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}}
.container {{max-width:600px;margin:auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}}
.header {{background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;padding:30px;text-align:center}}
.content {{padding:30px}}.price {{font-size:28px;color:#27ae60;font-weight:bold;text-align:center;margin:20px 0}}
table {{width:100%;border-collapse:collapse;margin:20px 0}}th,td {{padding:10px;border-bottom:1px solid #ddd;text-align:left}}th {{background:#f8f9fa}}
.footer {{background:#34495e;color:#fff;padding:20px;text-align:center;font-size:12px}}
</style></head><body><div class="container">
<div class="header"><h1>🎸 Ctrl+Rock</h1><p>Tu guitarra personalizada</p></div>
<div class="content"><h2>Cotización de Guitarra Personalizada</h2>
<p>Hola <strong>{nombre}</strong>,</p><p>Aquí tienes los detalles de tu cotización (generada: {fecha}):</p>
<ul>{items_html}</ul>
<div class="price">Total: ${precio_total:,.0f} COP</div>
<p>Esta cotización es válida por 30 días.</p></div>
<div class="footer"><p>Ctrl+Rock - Guitarras Personalizadas</p>
<p>Este correo fue enviado automáticamente. No respondas a este mensaje.</p></div>
</div></body></html>"""


def generar_html_confirmacion_pago(nombre, email, pedido_id, precio_cop, 
                                   modelo="", telefono="", direccion="", ciudad=""):
    """
    Generar HTML para correo de confirmación de pago.
    
    Args:
        nombre: Nombre del cliente
        email: Email del cliente
        pedido_id: ID del pedido generado
        precio_cop: Monto pagado en COP
        modelo: Modelo de guitarra (opcional)
        telefono: Teléfono del cliente (opcional)
        direccion: Dirección de envío (opcional)
        ciudad: Ciudad de envío (opcional)
    """
    fecha = dt.now().strftime("%d/%m/%Y %H:%M")
    
    detalles_orden = f"""
    <tr><th>ID del Pedido</th><td><strong>#{pedido_id}</strong></td></tr>
    <tr><th>Fecha de Pago</th><td>{fecha}</td></tr>
    {f'<tr><th>Modelo</th><td>{modelo}</td></tr>' if modelo else ''}
    {f'<tr><th>Teléfono</th><td>{telefono}</td></tr>' if telefono else ''}
    {f'<tr><th>Dirección</th><td>{direccion}</td></tr>' if direccion else ''}
    {f'<tr><th>Ciudad</th><td>{ciudad}</td></tr>' if ciudad else ''}
    """
    
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body {{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}}
.container {{max-width:600px;margin:auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}}
.header {{background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;padding:30px;text-align:center}}
.content {{padding:30px}}.success {{font-size:48px;text-align:center;margin-bottom:10px}}
.price {{font-size:32px;color:#27ae60;font-weight:bold;text-align:center;margin:20px 0;border:2px solid #27ae60;padding:15px;border-radius:5px}}
table {{width:100%;border-collapse:collapse;margin:20px 0}}th,td {{padding:10px;border-bottom:1px solid #ddd;text-align:left}}th {{background:#f8f9fa;font-weight:bold}}
.footer {{background:#34495e;color:#fff;padding:20px;text-align:center;font-size:12px}}
.note {{background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0}}
</style></head><body><div class="container">
<div class="header"><h1>✅ ¡Pago Confirmado!</h1><p>Tu pedido ha sido procesado exitosamente</p></div>
<div class="content"><div class="success">🎸</div><h2>Confirmación de Pedido</h2>
<p>Hola <strong>{nombre}</strong>,</p>
<p>Tu compra ha sido registrada y procesada correctamente. Nos pondremos en contacto contigo pronto para coordinar la fabricación de tu guitarra personalizada.</p>
<table>
{detalles_orden}
</table>
<div class="price">${precio_cop:,.0f} COP</div>
<div class="note">
<strong>📍 Próximos pasos:</strong>
<ul style="margin:10px 0;padding-left:20px">
<li>Recibirás un email con los detalles de fabricación</li>
<li>Nuestro equipo te contactará en 24-48 horas</li>
<li>Tiempo estimado de fabricación: 4-6 semanas</li>
</ul>
</div>
</div>
<div class="footer"><p>Ctrl+Rock - Guitarras Personalizadas</p>
<p>Guarda este correo como comprobante de pago. Pedido: #{pedido_id}</p>
<p>Email de contacto: soporte@ctrlrock.com</p></div>
</div></body></html>"""


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    print("\n" + "=" * 50)
    print("Ctrl+Rock - Servicio de Correo")
    print("=" * 50)
    
    # Test de HTML de confirmación
    test_html = generar_html_confirmacion_pago(
        nombre="Juan Pérez",
        email="juan@example.com",
        pedido_id="2024-001",
        precio_cop=1500000.0,
        modelo="Stratocaster",
        telefono="+573001234567",
        direccion="Calle 1 #123",
        ciudad="Bogotá"
    )
    print("\n✅ HTML generado para confirmación de pago (primeras 500 chars):")
    print(test_html[:500] + "...")
