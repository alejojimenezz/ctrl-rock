#!/usr/bin/env python
"""Script temporal para ejecutar la migracion del esquema de pedidos."""
import sys
from pathlib import Path

# Asegurar que el directorio Backend esta en el path
sys.path.insert(0, str(Path(__file__).parent))

from db import migrar_esquema_pedidos
import sqlite3

DB_PATH = Path(__file__).parent / "ctrl_rock.db"

print("Ejecutando migracion del esquema de pedidos...")
migrar_esquema_pedidos()

# Verificar resultado
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(pedidos)")
cols = cursor.fetchall()
print("\nColumnas en tabla 'pedidos':")
for c in cols:
    print(f"  - {c[1]} ({c[2]})")
conn.close()

print("\nMigracion completada.")