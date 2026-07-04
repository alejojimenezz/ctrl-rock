"""
email_sender.py
Envío de correos de confirmación para Ctrl+Rock.
Compatible con SMTP (Gmail) y SendGrid.
Permite adjuntar archivos PDF.
"""

import os
import smtplib
import logging
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

# ======================================================
# CONFIGURACIÓN
# ======================================================

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USER)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")


# ======================================================
# HTML DEL CORREO
# ======================================================

def generar_html_confirmacion_pago(
    nombre,
    email,
    pedido_id,
    precio_cop,
    modelo="",
    telefono="",
    direccion="",
    ciudad=""
):

    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")

    precio = f"${precio_cop:,.0f} COP"

    return f"""
<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">

<style>

body {{
    font-family: Arial;
    background:#f5f5f5;
}}

.container{{
    max-width:700px;
    margin:auto;
    background:white;
    border-radius:10px;
    overflow:hidden;
}}

.header{{
    background:#1d1d1d;
    color:white;
    padding:30px;
    text-align:center;
}}

.section{{
    padding:30px;
}}

table{{
    width:100%;
    border-collapse:collapse;
}}

td{{
    padding:8px;
    border-bottom:1px solid #ddd;
}}

.price{{
    font-size:28px;
    font-weight:bold;
    color:#B8860B;
}}

.footer{{
    background:#111;
    color:white;
    padding:20px;
    text-align:center;
}}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h1>CTRL + ROCK</h1>

<p>Confirmación de compra</p>

</div>

<div class="section">

<p>Hola <b>{nombre}</b>.</p>

<p>Tu pago fue aprobado correctamente.</p>

<table>

<tr>
<td><b>Pedido</b></td>
<td>#{pedido_id}</td>
</tr>

<tr>
<td><b>Modelo</b></td>
<td>{modelo}</td>
</tr>

<tr>
<td><b>Email</b></td>
<td>{email}</td>
</tr>

<tr>
<td><b>Teléfono</b></td>
<td>{telefono}</td>
</tr>

<tr>
<td><b>Dirección</b></td>
<td>{direccion}</td>
</tr>

<tr>
<td><b>Ciudad</b></td>
<td>{ciudad}</td>
</tr>

<tr>
<td><b>Fecha</b></td>
<td>{fecha}</td>
</tr>

</table>

<br>

<div class="price">

Total pagado:<br>

{precio}

</div>

<br>

<p>

Adjunto encontrarás la factura correspondiente a tu compra.

</p>

<p>

Tiempo estimado de fabricación y envío:

<b>15 días calendario.</b>

</p>

</div>

<div class="footer">

Gracias por confiar en Ctrl+Rock.

</div>

</div>

</body>

</html>

"""


# ======================================================
# ENVÍO SMTP
# ======================================================

def enviar_correo(
    destinatario,
    asunto,
    cuerpo_html,
    adjuntos=None
):

    if SENDGRID_API_KEY:

        return _enviar_via_sendgrid(
            destinatario,
            asunto,
            cuerpo_html,
            adjuntos
        )

    try:

        if not SMTP_USER or not SMTP_PASS:

            logger.error("SMTP no configurado.")

            return False

        msg = MIMEMultipart()

        msg["From"] = SENDER_EMAIL

        msg["To"] = destinatario

        msg["Subject"] = asunto

        msg.attach(
            MIMEText(
                cuerpo_html,
                "html"
            )
        )

        # ===========================
        # Adjuntar PDFs
        # ===========================

        if adjuntos:

            for archivo in adjuntos:

                if not os.path.exists(archivo):
                    logger.warning(f"No existe {archivo}")
                    continue

                with open(archivo, "rb") as f:

                    parte = MIMEBase(
                        "application",
                        "octet-stream"
                    )

                    parte.set_payload(f.read())

                encoders.encode_base64(parte)

                parte.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{os.path.basename(archivo)}"'
                )

                msg.attach(parte)

        server = smtplib.SMTP(
            SMTP_HOST,
            SMTP_PORT
        )

        server.ehlo()

        server.starttls()

        server.login(
            SMTP_USER,
            SMTP_PASS
        )

        server.sendmail(
            SENDER_EMAIL,
            destinatario,
            msg.as_string()
        )

        server.quit()

        logger.info(
            f"Correo enviado a {destinatario}"
        )

        return True

    except Exception as e:

        logger.exception(e)

        return False
# ======================================================
# SENDGRID
# ======================================================

def _enviar_via_sendgrid(
    destinatario,
    asunto,
    cuerpo_html,
    adjuntos=None
):
    """
    Envío mediante SendGrid.

    Por simplicidad, los adjuntos no se implementan aquí.
    Si SENDGRID_API_KEY está vacío, esta función nunca se usa.
    """

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

        logger.info(
            f"Correo enviado mediante SendGrid. Status={response.status_code}"
        )

        return response.status_code == 202

    except ImportError:

        logger.error(
            "SendGrid no instalado. Ejecuta: pip install sendgrid"
        )

        return False

    except Exception as e:

        logger.exception(e)

        return False


# ======================================================
# PRUEBA LOCAL
# ======================================================

if __name__ == "__main__":

    logging.basicConfig(level=logging.INFO)

    html = generar_html_confirmacion_pago(
        nombre="Juan Pablo Barreto",
        email="correo@ejemplo.com",
        pedido_id="20260001",
        precio_cop=3650000,
        modelo="Music Man StingRay",
        telefono="3001234567",
        direccion="Bogotá",
        ciudad="Bogotá"
    )

    pdf = "Factura_CTRLROCK_20260001.pdf"

    if os.path.exists(pdf):

        enviados = enviar_correo(
            destinatario="correo@ejemplo.com",
            asunto="Prueba Ctrl+Rock",
            cuerpo_html=html,
            adjuntos=[pdf]
        )

    else:

        enviados = enviar_correo(
            destinatario="correo@ejemplo.com",
            asunto="Prueba Ctrl+Rock",
            cuerpo_html=html
        )

    if enviados:

        print("✅ Correo enviado correctamente")

    else:

        print("❌ Error enviando correo")