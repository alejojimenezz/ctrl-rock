"""
stripe_payments.py - Integración con Stripe para procesamiento de pagos.

Modo pruebas: usa las claves de test de Stripe.
Flujo: crear PaymentIntent -> frontend confirma -> backend verifica -> guarda pedido.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURACIÓN STRIPE
# ==========================================

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_...")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_...")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

try:
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
except ImportError:
    logger.error("Stripe no instalado. Ejecuta: pip install stripe")
    stripe = None


def crear_payment_intent(monto_cop, email, descripcion="Guitarra personalizada Ctrl+Rock"):
    """
    Crear un PaymentIntent en Stripe.

    Args:
        monto_cop: Monto en COP. Para COP (moneda zero-decimal) se envía el valor entero
                   sin multiplicar por 100. Ej: 1_261_400 COP → amount=1261400.
        email: Email del cliente para receipt
        descripcion: Descripción del pago

    Returns:
        dict con client_secret y payment_intent_id, o None si falla
    """
    if not stripe:
        logger.error("Módulo Stripe no disponible")
        return {"error": "Stripe no configurado"}

    try:
        # Stripe espera el monto en la MENOR UNIDAD de la moneda.
        # Para COP (moneda de 2 decimales): 1,261,400 COP → 1261400 (sin multiplicar por 100).
        monto_units = int(float(monto_cop))
        logger.info(f"Creando PaymentIntent: amount={monto_units}, currency=cop, email={email}, descripcion={descripcion}")
        payment_intent = stripe.PaymentIntent.create(
            amount=monto_units,
            currency="cop",
            description=descripcion,
            receipt_email=email,
            metadata={
                "tipo": "guitarra_personalizada",
                "plataforma": "ctrl_rock"
            }
        )
        logger.info(f"PaymentIntent creado: id={payment_intent.id}, amount={payment_intent.amount}, currency={payment_intent.currency}")
        return {
            "client_secret": payment_intent.client_secret,
            "payment_intent_id": payment_intent.id
        }
    except stripe.error.StripeError as e:
        logger.error(f"Error al crear PaymentIntent: {e}")
        return {"error": str(e)}


def verificar_pago(payment_intent_id):
    """Verificar el estado de un PaymentIntent."""
    if not stripe:
        return None

    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return {
            "id": intent.id,
            "status": intent.status,  # 'succeeded', 'requires_payment_method', etc.
            "amount": intent.amount,
            "currency": intent.currency,
            "created": intent.created
        }
    except stripe.error.StripeError as e:
        logger.error(f"Error al verificar pago: {e}")
        return {"error": str(e)}


def procesar_webhook(payload, sig_header):
    """Procesar webhook de Stripe para eventos asíncronos."""
    if not stripe or not STRIPE_WEBHOOK_SECRET:
        return None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )

        if event["type"] == "payment_intent.succeeded":
            intent = event["data"]["object"]
            logger.info(f"Pago exitoso: {intent['id']} - ${intent['amount']}/{intent['currency']}")
            return {"event": "payment_succeeded", "intent_id": intent["id"]}

        elif event["type"] == "payment_intent.payment_failed":
            intent = event["data"]["object"]
            logger.warning(f"Pago fallido: {intent['id']}")
            return {"event": "payment_failed", "intent_id": intent["id"]}

        return {"event": event["type"]}

    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Webhook signature inválida: {e}")
        return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("\n" + "=" * 50)
    print("Ctrl+Rock - Stripe Payment Test")
    print("=" * 50)

    if stripe:
        result = crear_payment_intent(1500000, "test@example.com")
        print(f"\nPaymentIntent: {result}")
    else:
        print("\n⚠️ Stripe no instalado. Ejecuta: pip install stripe")
