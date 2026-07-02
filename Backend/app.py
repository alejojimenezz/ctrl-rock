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

BASE_DIR = Path(__file__).resolve().parent
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin123")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
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

    detalles = cotizacion.get("detalles") or cotizacion.get("componentes")
    tasa_cop = cotizacion.get("tasa_cambio") or 0
    if isinstance(detalles, dict):
        guardar_detalles_pedido(pedido_id, detalles, tasa_cop)
    guardar_detalles_configuracion(pedido_id, configuracion)

    logger.info("Correo de confirmacion simulado para %s - pedido #%s", email, pedido_id)

    return jsonify({
        "ok": True,
        "pedido_id": pedido_id,
        "estado": "pagado",
        "email_simulado": True,
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
        pedidos.append({
            "id": pedido["id"],
            "nombre": pedido["nombre"],
            "email": pedido["email"],
            "telefono": pedido["telefono"],
            "direccion": pedido["direccion"],
            "ciudad": pedido["ciudad"],
            "fecha": pedido["fecha_creacion"],
            "estado": pedido["estado"],
            "total_cop": pedido["precio_cop"],
            "stripe_payment_intent_id": pedido["stripe_payment_intent_id"],
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
        return jsonify({"error": "Token invalido"}), 403

    pago = verificar_pago(payment_intent_id)
    if not pago or pago.get("error"):
        return jsonify({"error": pago.get("error", "No se pudo consultar Stripe")}), 400

    estado = "pagado" if pago.get("status") == "succeeded" else pago.get("status")
    actualizado = actualizar_estado_pedido(payment_intent_id, estado)
    return jsonify({
        "ok": actualizado,
        "mensaje": f"Estado sincronizado: {estado}" if actualizado else "No existe un pedido local para ese PaymentIntent",
        "stripe_status": pago.get("status"),
    })


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
