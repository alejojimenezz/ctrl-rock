import json
import logging
import os
import subprocess
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from db import (
    actualizar_estado_pedido,
    get_connection,
    guardar_detalles_pedido,
    guardar_pedido,
    inicializar_db,
    obtener_detalles_pedido,
    obtener_pedidos,
    obtener_webhook_logs,
    registrar_webhook_log,
)
from stripe_payments import (
    STRIPE_PUBLISHABLE_KEY,
    crear_payment_intent,
    procesar_webhook,
    verificar_pago,
)
from email_sender import (
    enviar_correo,
    generar_html_confirmacion_pago,
)

BASE_DIR = Path(__file__).resolve().parent
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin123")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "..", "assets"),
    static_url_path="/assets"
)

CORS(app)
inicializar_db()


def validar_admin():
    token = request.args.get("token") or request.headers.get("X-Admin-Token")
    return token == ADMIN_TOKEN


def normalizar_precio(valor):
    try:
        precio = int(float(valor))
    except (TypeError, ValueError):
        return None
    return precio if precio > 0 else None


def guardar_detalles_configuracion(pedido_id, configuracion):
    if not pedido_id or not isinstance(configuracion, dict):
        return

    conn = get_connection()
    try:
        cursor = conn.cursor()
        for componente in ("modelo", "madera", "color", "hardware", "pickups", "tamano", "dimensiones_cad"):
            nombre = configuracion.get(componente)
            if not nombre:
                continue
            cursor.execute(
                """
                INSERT INTO detalles_pedido (pedido_id, componente, nombre, precio_usd, precio_cop, enlace, cantidad)
                VALUES (?, ?, ?, 0, 0, '', 1)
                """,
                (pedido_id, componente, str(nombre)),
            )
        conn.commit()
    except Exception as exc:
        logger.exception("No se pudieron guardar detalles de configuracion: %s", exc)
        conn.rollback()
    finally:
        conn.close()


@app.route("/api/cotizar", methods=["POST"])
def cotizar():
    try:
        from zenrows_scraper import calcular_precio_hardware
        from exchange_rates import convertir_a_cop, obtener_tasa_usd_cop

        data = request.get_json(silent=True) or {}
        
        # Map frontend config to backend keys
        configuracion = {
            "trastes": data.get("trastes", "estandar"),
            "clavijeros": data.get("clavijeros", "grover"),
            "knobs": data.get("knobs", "top_hat"),
            "puente": data.get("puente", "tremolo"),
            "pastillas": data.get("pastillas", data.get("pickups", "humbucker")),
        }
        
        logger.info(f"Calculando cotizacion para configuracion: {configuracion}")
        
        # Calculate hardware prices in USD
        resultado_hardware = calcular_precio_hardware(configuracion)
        total_usd = resultado_hardware["total_usd"]
        desglose = resultado_hardware["desglose"]
        
        # Convert to COP
        tasa_cambio = obtener_tasa_usd_cop()
        total_hardware_cop = convertir_a_cop(total_usd)
        
        # Add manufacturing cost
        COSTO_FABRICACION_COP = 350000
        precio_final_cop = total_hardware_cop + COSTO_FABRICACION_COP
        
        resultado = {
            "precio_final_cop": precio_final_cop,
            "total_hardware_usd": total_usd,
            "precio_componentes_cop": total_hardware_cop,
            "costo_fabricacion_cop": COSTO_FABRICACION_COP,
            "tasa_cambio_usd_cop": tasa_cambio,
            "desglose": desglose,
            "detalles": desglose,  # For direct use in guardar_detalles_pedido
            "configuracion": configuracion
        }
        
        logger.info(f"Cotizacion generada: ${total_usd:.2f} USD = ${precio_final_cop:,.0f} COP")
        return jsonify(resultado)
        
    except Exception as exc:
        logger.exception("Error generando cotizacion")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/stripe-config")
def stripe_config():
    return jsonify({"publishable_key": STRIPE_PUBLISHABLE_KEY})


@app.route("/api/payment-intent", methods=["POST"])
def payment_intent():
    data = request.get_json(silent=True) or {}
    precio_cop = normalizar_precio(data.get("precio_cop"))
    email = data.get("email") or "cliente@ctrlrock.test"

    if not precio_cop:
        return jsonify({"error": "precio_cop es requerido y debe ser mayor a 0"}), 400

    resultado = crear_payment_intent(
        precio_cop,
        email,
        "Guitarra personalizada Ctrl+Rock",
    )
    if not resultado or resultado.get("error"):
        return jsonify({"error": resultado.get("error", "No se pudo crear el PaymentIntent")}), 500

    return jsonify(resultado)


@app.route("/api/confirm-payment", methods=["POST"])
def confirm_payment():
    data = request.get_json(silent=True) or {}
    payment_intent_id = data.get("payment_intent_id")
    precio_cop = normalizar_precio(data.get("precio_cop"))
    cliente = data.get("cliente") or {}
    cotizacion = data.get("cotizacion") or {}
    configuracion = data.get("configuracion") or cotizacion.get("configuracion") or {}

    if not payment_intent_id:
        return jsonify({"error": "payment_intent_id es requerido"}), 400
    if not precio_cop:
        return jsonify({"error": "precio_cop es requerido"}), 400

    pago = verificar_pago(payment_intent_id)
    if not pago or pago.get("error"):
        return jsonify({"error": pago.get("error", "No se pudo verificar el pago")}), 400
    if pago.get("status") != "succeeded":
        return jsonify({"error": f"El pago no esta aprobado. Estado actual: {pago.get('status')}"}), 400
    if int(pago.get("amount", 0)) != int(precio_cop * 100):
        return jsonify({"error": "El monto pagado no coincide con la cotizacion"}), 400

    nombre = cliente.get("nombre") or "Cliente Ctrl+Rock"
    email = cliente.get("email") or "cliente@ctrlrock.test"
    pedido_id = guardar_pedido({
        "nombre": nombre,
        "email": email,
        "telefono": cliente.get("telefono"),
        "direccion": cliente.get("direccion"),
        "ciudad": cliente.get("ciudad"),
        "precio_cop": precio_cop,
        "metodo_pago": "tarjeta",
        "stripe_payment_intent_id": payment_intent_id,
    })

    if not pedido_id:
        return jsonify({"error": "No se pudo guardar el pedido"}), 500

    detalles = cotizacion.get("detalles") or cotizacion.get("componentes") or cotizacion.get("desglose")
    tasa_cop = cotizacion.get("tasa_cambio") or cotizacion.get("tasa_cambio_usd_cop") or 0
    
    # If rate not provided, fetch it now
    if not tasa_cop and isinstance(detalles, dict):
        try:
            from exchange_rates import obtener_tasa_usd_cop
            tasa_cop = obtener_tasa_usd_cop()
            logger.info(f"Tasa de cambio obtenida para guardar detalles: {tasa_cop}")
        except Exception as exc:
            logger.warning(f"No se pudo obtener tasa de cambio: {exc}")
    
    if isinstance(detalles, dict):
        guardar_detalles_pedido(pedido_id, detalles, tasa_cop)
    guardar_detalles_configuracion(pedido_id, configuracion)

    # Enviar correo de confirmación de pago
    try:
        modelo = configuracion.get("modelo", "Guitarra personalizada")
        telefono = cliente.get("telefono", "")
        direccion = cliente.get("direccion", "")
        ciudad = cliente.get("ciudad", "")
        
        html = generar_html_confirmacion_pago(
            nombre=nombre,
            email=email,
            pedido_id=pedido_id,
            precio_cop=precio_cop,
            modelo=modelo,
            telefono=telefono,
            direccion=direccion,
            ciudad=ciudad,
        )
        
        enviado = enviar_correo(
            destinatario=email,
            asunto="Confirmación de Pago - Ctrl+Rock",
            cuerpo_html=html,
        )
        
        if enviado:
            logger.info("✅ Correo de confirmación enviado a %s", email)
        else:
            logger.warning("⚠️ No se pudo enviar el correo de confirmación a %s", email)
    except Exception as exc:
        logger.exception("Error enviando correo de confirmación: %s", exc)

    return jsonify({
        "ok": True,
        "pedido_id": pedido_id,
        "estado": "pagado",
        "email_enviado": enviado if 'enviado' in locals() else False,
    })


@app.route("/api/webhook/stripe", methods=["POST"])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    resultado = procesar_webhook(payload, sig_header)

    if not resultado:
        registrar_webhook_log("webhook_invalid", datos=payload.decode("utf-8", errors="ignore"))
        return jsonify({"error": "Webhook invalido"}), 400

    evento = resultado.get("event")
    intent_id = resultado.get("intent_id")
    registrar_webhook_log(evento, intent_id, payload.decode("utf-8", errors="ignore"))

    if evento == "payment_succeeded" and intent_id:
        actualizar_estado_pedido(intent_id, "pagado")
    elif evento == "payment_failed" and intent_id:
        actualizar_estado_pedido(intent_id, "fallido")

    return jsonify({"received": True})


@app.route("/api/admin/pedidos")
def admin_pedidos():
    if not validar_admin():
        return jsonify({"error": "Token invalido"}), 403

    pedidos = []
    for pedido in obtener_pedidos():
        intent_id = pedido.get("stripe_payment_intent_id")
        estado = pedido.get("estado", "pagado")
        reembolsado = bool(pedido.get("reembolsado", 0))
        monto_reembolsado = pedido.get("monto_reembolsado", 0) or 0

        pedidos.append({
            "id": pedido["id"],
            "nombre": pedido["nombre"],
            "email": pedido["email"],
            "telefono": pedido["telefono"],
            "direccion": pedido["direccion"],
            "ciudad": pedido["ciudad"],
            "fecha": pedido["fecha_creacion"],
            "estado": estado,
            "reembolsado": reembolsado,
            "monto_reembolsado": monto_reembolsado,
            "total_cop": pedido["precio_cop"],
            "stripe_payment_intent_id": intent_id,
            "detalles": obtener_detalles_pedido(pedido["id"]),
        })
    return jsonify({"pedidos": pedidos})


@app.route("/api/admin/webhook-logs")
def admin_webhook_logs():
    if not validar_admin():
        return jsonify({"error": "Token invalido"}), 403

    limit = request.args.get("limit", 50, type=int)
    return jsonify({"logs": obtener_webhook_logs(limit)})


@app.route("/api/admin/sincronizar-pedido/<payment_intent_id>")
def admin_sincronizar_pedido(payment_intent_id):
    if not validar_admin():
        return jsonify({"error": "Token inválido"}), 403

    pago = verificar_pago(payment_intent_id)
    if not pago or pago.get("error"):
        return jsonify({"error": pago.get("error", "No se pudo consultar Stripe")}), 400

    stripe_status = pago.get("status") or "desconocido"
    estado = "pagado" if stripe_status == "succeeded" else stripe_status

    refunds = pago.get("refunds") or []
    reembolsado = bool(refunds)
    monto_reembolsado = (sum(r.get("amount", 0) for r in refunds) / 100) if reembolsado else 0

    actualizado_estado = actualizar_estado_pedido(payment_intent_id, estado)

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE pedidos
            SET reembolsado = ?, monto_reembolsado = ?
            WHERE stripe_payment_intent_id = ?
            """,
            (1 if reembolsado else 0, monto_reembolsado, payment_intent_id),
        )
        conn.commit()
        actualizado = True
    except Exception:
        conn.rollback()
        actualizado = False
    finally:
        conn.close()

    return jsonify({
        "ok": actualizado,
        "mensaje": f"Estado sincronizado: {estado}" if actualizado else "No existe un pedido local para ese PaymentIntent",
        "stripe_status": stripe_status,
        "reembolsado": reembolsado,
        "monto_reembolsado": monto_reembolsado,
    })


@app.route("/api/admin/sincronizar-todos", methods=["GET", "POST"])
def admin_sincronizar_todos():
    if not validar_admin():
        return jsonify({"error": "Token inválido"}), 403

    resumen = {"total": 0, "actualizados": 0, "fallidos": 0}
    for pedido in obtener_pedidos():
        intent_id = pedido.get("stripe_payment_intent_id")
        resumen["total"] += 1
        if not intent_id:
            continue
        pago = verificar_pago(intent_id)
        if not pago or pago.get("error"):
            resumen["fallidos"] += 1
            continue
        resumen["actualizados"] += 1
        stripe_status = pago.get("status") or "desconocido"
        actualizar_estado_pedido(intent_id, "pagado" if stripe_status == "succeeded" else stripe_status)
        guardar_sincronizacion_remota(intent_id, pago)

    return jsonify({"ok": True, "resumen": resumen})


def guardar_sincronizacion_remota(payment_intent_id, pago):
    refunds = pago.get("refunds") or []
    monto_reembolsado = (sum(r.get("amount", 0) for r in refunds) / 100) if refunds else 0
    reembolsado = 1 if refunds else 0
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE pedidos SET reembolsado = ?, monto_reembolsado = ? WHERE stripe_payment_intent_id = ?",
            (reembolsado, monto_reembolsado, payment_intent_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        conn.close()


FRONTEND_DIR = BASE_DIR.parent / "Frontend"


@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Ruta API no encontrada"}), 404
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
