"""
db.py - Base de datos SQLite para persistencia de cotizaciones y pedidos.

Tablas:
- cotizaciones: Almacena las cotizaciones generadas por los usuarios
- pedidos: Almacena los pedidos confirmados con pago exitoso
"""

import os
import sqlite3
import logging
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "ctrl_rock.db"


def get_connection():
    """Obtener conexión a la base de datos."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrar_esquema_pedidos():
    """Agregar columnas faltantes a la tabla pedidos (sincronizacion con Stripe)."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(pedidos)")
        columnas = {row[1] for row in cursor.fetchall()}
        if "reembolsado" not in columnas:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN reembolsado INTEGER DEFAULT 0")
            logger.info("Migracion: columna 'reembolsado' agregada a 'pedidos'")
        if "monto_reembolsado" not in columnas:
            cursor.execute("ALTER TABLE pedidos ADD COLUMN monto_reembolsado REAL DEFAULT 0")
            logger.info("Migracion: columna 'monto_reembolsado' agregada a 'pedidos'")
        conn.commit()
    except sqlite3.Error as e:
        logger.error(f"Error en migracion de esquema: {e}")
        conn.rollback()
    finally:
        conn.close()


def inicializar_db():
    """Crear tablas si no existen."""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                email TEXT NOT NULL,
                modelo TEXT,
                madera TEXT,
                color TEXT,
                hardware TEXT,
                pickups TEXT,
                dimensiones_cad TEXT,
                precio_usd REAL DEFAULT 0,
                precio_cop REAL DEFAULT 0,
                tasa_cambio REAL DEFAULT 0,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado TEXT DEFAULT 'pendiente'
            );

            CREATE TABLE IF NOT EXISTS pedidos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cotizacion_id INTEGER,
                nombre TEXT NOT NULL,
                email TEXT NOT NULL,
                telefono TEXT,
                direccion TEXT,
                ciudad TEXT,
                precio_cop REAL NOT NULL,
                metodo_pago TEXT DEFAULT 'tarjeta',
                stripe_payment_intent_id TEXT UNIQUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                estado TEXT DEFAULT 'pagado',
                reembolsado INTEGER DEFAULT 0,
                monto_reembolsado REAL DEFAULT 0,
                FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id)
            );

            CREATE TABLE IF NOT EXISTS configuraciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                email TEXT,
                modelo TEXT,
                madera TEXT,
                color TEXT,
                hardware TEXT,
                pickups TEXT,
                dimensiones_cad TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS detalles_pedido (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pedido_id INTEGER NOT NULL,
                componente TEXT NOT NULL,
                nombre TEXT NOT NULL,
                precio_usd REAL NOT NULL,
                precio_cop REAL NOT NULL,
                enlace TEXT,
                cantidad INTEGER DEFAULT 1,
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
            );

            CREATE TABLE IF NOT EXISTS webhook_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                evento TEXT NOT NULL,
                payment_intent_id TEXT,
                datos TEXT,
                recibido_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        migrar_esquema_pedidos()
        logger.info("Base de datos inicializada correctamente")
    except sqlite3.Error as e:
        logger.error(f"Error al inicializar DB: {e}")
    finally:
        conn.close()


def guardar_cotizacion(datos):
    """Guardar una cotización en la base de datos."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO cotizaciones (nombre, email, modelo, madera, color, hardware, pickups, dimensiones_cad, precio_usd, precio_cop, tasa_cambio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datos["nombre"], datos["email"],
            datos.get("modelo"), datos.get("madera"), datos.get("color"),
            datos.get("hardware"), datos.get("pickups"), datos.get("dimensiones_cad"),
            datos.get("precio_usd", 0), datos.get("precio_cop", 0), datos.get("tasa_cambio", 0)
        ))
        conn.commit()
        cotizacion_id = cursor.lastrowid
        logger.info(f"Cotización #{cotizacion_id} guardada para {datos['email']}")
        return cotizacion_id
    except sqlite3.Error as e:
        logger.error(f"Error al guardar cotización: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()


def guardar_pedido(datos):
    """Guardar un pedido con confirmación de pago."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pedidos (cotizacion_id, nombre, email, telefono, direccion, ciudad, precio_cop, metodo_pago, stripe_payment_intent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datos.get("cotizacion_id"), datos["nombre"], datos["email"],
            datos.get("telefono"), datos.get("direccion"), datos.get("ciudad"),
            datos["precio_cop"], datos.get("metodo_pago", "tarjeta"),
            datos.get("stripe_payment_intent_id")
        ))
        conn.commit()
        pedido_id = cursor.lastrowid

        # Actualizar estado de la cotización asociada
        if datos.get("cotizacion_id"):
            cursor.execute(
                "UPDATE cotizaciones SET estado = 'comprado' WHERE id = ?",
                (datos["cotizacion_id"],)
            )
            conn.commit()

        logger.info(f"Pedido #{pedido_id} guardado para {datos['email']}")
        return pedido_id
    except sqlite3.Error as e:
        logger.error(f"Error al guardar pedido: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()


def obtener_cotizacion(cotizacion_id):
    """Obtener una cotización por su ID."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        return dict(cursor.fetchone()) if cursor.fetchone() else None
    finally:
        conn.close()


def obtener_pedidos():
    """Obtener todos los pedidos."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pedidos ORDER BY fecha_creacion DESC")
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def guardar_detalles_pedido(pedido_id, detalles, tasa_cop):
    """Guardar los detalles/materiales de un pedido.

    Args:
        pedido_id: ID del pedido
        detalles: dict como el que devuelve calcular_precio_hardware()
        tasa_cop: tasa de cambio usada para convertir USD -> COP
    """
    if not pedido_id or not detalles:
        return []
    conn = get_connection()
    try:
        cursor = conn.cursor()
        ids_insertados = []
        for categoria, info in detalles.items():
            if not isinstance(info, dict):
                continue
            opcion = info.get("opcion", categoria)
            precio_usd = info.get("precio_usd", 0.0)
            enlace = info.get("enlace", "")
            precio_cop = round(precio_usd * tasa_cop, 2) if tasa_cop else 0.0
            cursor.execute("""
                INSERT INTO detalles_pedido (pedido_id, componente, nombre, precio_usd, precio_cop, enlace, cantidad)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (pedido_id, categoria, opcion, precio_usd, precio_cop, enlace, 1))
            ids_insertados.append(cursor.lastrowid)
        conn.commit()
        logger.info(f"Detalles guardados para pedido #{pedido_id}: {len(ids_insertados)} componentes")
        return ids_insertados
    except sqlite3.Error as e:
        logger.error(f"Error al guardar detalles de pedido: {e}")
        conn.rollback()
        return []
    finally:
        conn.close()


def obtener_detalles_pedido(pedido_id):
    """Obtener los detalles/materiales de un pedido."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM detalles_pedido WHERE pedido_id = ? ORDER BY id", (pedido_id,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def actualizar_estado_pedido(payment_intent_id, nuevo_estado):
    """Actualizar el estado de un pedido por payment_intent_id."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE pedidos SET estado = ? WHERE stripe_payment_intent_id = ?",
            (nuevo_estado, payment_intent_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logger.error(f"Error actualizando estado de pedido: {e}")
        return False
    finally:
        conn.close()


def registrar_webhook_log(evento, payment_intent_id=None, datos=None):
    """Registrar un evento de webhook recibido."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO webhook_logs (evento, payment_intent_id, datos) VALUES (?, ?, ?)",
            (evento, payment_intent_id, datos)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.Error as e:
        logger.error(f"Error registrando webhook log: {e}")
        return None
    finally:
        conn.close()


def obtener_webhook_logs(limit=50):
    """Obtener los últimos logs de webhooks."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM webhook_logs ORDER BY recibido_en DESC LIMIT ?", (limit,))
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    inicializar_db()
    print("\nBase de datos SQLite inicializada correctamente.")
    print(f"Ubicación: {DB_PATH}")
