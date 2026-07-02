"""
email_sender.py - Envío de correos SMTP/SendGrid para confirmaciones de pago.

Usa smtplib nativo de Python o SendGrid API según configuración.
Para modo pruebas, se puede usar un servidor SMTP local o SendGrid test mode.
"""

import os
import logging
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)


# ==========================================
# CONFIGURACIÓN SMTP / SENDGRID
# ==========================================

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USER)

# Alternativa: SendGrid API
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")


def generar_html_confirmacion_pago(nombre, email, pedido_id, precio_cop, modelo="", telefono="", direccion="", ciudad=""):
    """Generar HTML para el correo de confirmación de pago."""

    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
    precio_formateado = f"${precio_cop:,.0f} COP"

    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e; color: #eee; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #e94560, #0f3460); padding: 30px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 28px; color: white; }}
            .header p {{ margin: 10px 0 0; color: #ddd; font-size: 14px; }}
            .content {{ padding: 30px; }}
            .section {{ background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #e94560; }}
            .section h3 {{ margin: 0 0 15px; color: #e94560; font-size: 18px; }}
            .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a4a; }}
            .detail-label {{ color: #aaa; }}
            .detail-value {{ color: #fff; font-weight: bold; }}
            .price-box {{ background: linear-gradient(135deg, #e94560, #c73e54); border-radius: 8px; padding: 20px; text-align: center; margin-top: 20px; }}
            .price-box h2 {{ margin: 0; font-size: 32px; color: white; }}
            .footer {{ background-color: #0f3460; padding: 20px; text-align: center; color: #888; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎸 Ctrl+Rock</h1>
                <p>¡Tu guitarra personalizada está en camino!</p>
            </div>

            <div class="content">
                <p>Hola <strong>{nombre}</strong>,</p>
                <p>Tu pago ha sido procesado exitosamente. A continuación encontrarás los detalles de tu pedido:</p>

                <div class="section">
                    <h3>📋 Detalles del Pedido</h3>
                    <div class="detail-row">
                        <span class="detail-label">Número de pedido:</span>
                        <span class="detail-value">#{pedido_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Fecha:</span>
                        <span class="detail-value">{fecha}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Modelo:</span>
                        <span class="detail-value">{modelo or 'Guitarra personalizada'}</span>
                    </div>
                </div>

                <div class="section">
                    <h3>📧 Información de Contacto</h3>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">{email}</span>
                    </div>
                    {f'<div class="detail-row"><span class="detail-label">Teléfono:</span><span class="detail-value">{telefono or "No proporcionado"}</span></div>' if telefono else ''}
                </div>

                <div class="section">
                    <h3>📍 Dirección de Envío</h3>
                    <p>{direccion or 'No proporcionada'}</p>
                    {f'<p>Ciudad: {ciudad}</p>' if ciudad else ''}
                </div>

                <div class="price-box">
                    <h2>{precio_formateado}</h2>
                    <p style="margin: 5px 0 0; font-size: 14px;">Total pagado</p>
                </div>

                <p style="margin-top: 20px; color: #aaa; font-size: 14px;">
                    Te contactaremos pronto para coordinar los detalles de fabricación y envío.
                    ¡Gracias por elegir Ctrl+Rock! 🎸🔥
                </p>
            </div>

            <div class="footer">
                <p>Ctrl+Rock - Guitarras Personalizadas</p>
                <p>Este es un correo automático, no respondas a este mensaje.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html



def enviar_correo(destinatario, asunto, cuerpo_html):
    """Enviar correo electrónico vía SMTP o SendGrid."""
    if SENDGRID_API_KEY:
        return _enviar_via_sendgrid(destinatario, asunto, cuerpo_html)

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        if not SMTP_USER or not SMTP_PASS:
            logger.error("SMTP no configurado. Configura SMTP_USER y SMTP_PASS en .env")
            return False

        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = destinatario
        msg["Subject"] = asunto
        msg.attach(MIMEText(cuerpo_html, "html"))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SENDER_EMAIL, destinatario, msg.as_string())
        server.quit()

        logger.info(f"Correo enviado a {destinatario}: {asunto}")
        return True

    except Exception as e:
        logger.error(f"Error enviando correo SMTP: {e}")
        return False


def _enviar_via_sendgrid(destinatario, asunto, cuerpo_html):
    """Enviar correo usando la API de SendGrid."""
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)

        message = Mail(
            from_email=(SENDER_EMAIL, "Ctrl+Rock"),
            to_emails=destinatario,
            subject=asunto,
            html_content=cuerpo_html
        )

        response = sg.send(message)
        logger.info(f"Correo enviado vía SendGrid a {destinatario}: status={response.status_code}")
        return response.status_code == 202

    except ImportError:
        logger.error("Módulo sendgrid no instalado. Ejecuta: pip install sendgrid")
        return False
    except Exception as e:
        logger.error(f"Error enviando correo SendGrid: {e}")
        return False


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO)

    test_html = generar_html_confirmacion_pago(
        nombre="Joel Felipe Suarez Vidarte",
        email="joelfelipesv@gmail.com",
        pedido_id="999",
        precio_cop=1387400,
        modelo="Stingray",
        telefono="31667646927",
        direccion="Reserva Campestre",
        ciudad="Tenjo"
    )

    print("HTML generado para prueba:")
    print(test_html[:500])

    destino_prueba = "joelfelipesv@gmail.com"
    if enviar_correo(destino_prueba, "Prueba Confirmación Pago Ctrl+Rock", test_html):
        print(f"\n✅ Correo enviado exitosamente a {destino_prueba}")
    else:
        print(f"\n❌ Error enviando correo a {destino_prueba}")
