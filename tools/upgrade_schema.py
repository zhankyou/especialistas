import os
import sys

# -----------------------------------------------------------------------------
# INYECCION PRIORITARIA DE RUTA RAIZ EN SYS.PATH
# Debe ejecutarse de manera estricta antes de importar cualquier modulo interno
# -----------------------------------------------------------------------------
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, '..'))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sqlalchemy import inspect, text
from flask import Flask
from config.settings import Config
from src.models import db


def create_migration_app():
    """Contexto de aplicacion aislado para operaciones de infraestructura."""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app


def run_schema_upgrade():
    """
    Motor de resolucion de Schema Drift.
    Audita la tabla heredada en PostgreSQL y ejecuta parches DDL incrementales.
    """
    app = create_migration_app()

    with app.app_context():
        inspector = inspect(db.engine)
        table_name = 'especialista'

        # Validacion de existencia primaria
        if not inspector.has_table(table_name):
            print(f"[SYSTEM ERROR] La tabla '{table_name}' no existe en la base de datos conectada.")
            print("[SYSTEM INSTRUCTION] Verifica tus credenciales en el archivo .env.")
            return

        # Reflexion de la estructura fisica actual
        existing_columns = [col['name'] for col in inspector.get_columns(table_name)]

        # Matriz de Evolucion (Definicion de las columnas de seguridad ISO 27001)
        required_columns = {
            'is_active': 'BOOLEAN DEFAULT TRUE',
            'failed_login_attempts': 'INTEGER DEFAULT 0',
            'account_locked_until': 'TIMESTAMP',
            'last_login_at': 'TIMESTAMP',
            'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'updated_at': 'TIMESTAMP'
        }

        mutations_applied = 0

        # Transaccion DDL Segura
        with db.engine.connect() as conn:
            for col_name, col_definition in required_columns.items():
                if col_name not in existing_columns:
                    print(f"[DB UPGRADE] Inyectando columna faltante: {col_name} ({col_definition})")
                    alter_cmd = text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_definition};")
                    conn.execute(alter_cmd)
                    mutations_applied += 1

            conn.commit()

        if mutations_applied > 0:
            print(f"[DB UPGRADE SUCCESS] Parche DDL completado. Se integraron {mutations_applied} columnas de seguridad.")
            print("[DB INSTRUCTION] Ya puedes ejecutar 'python app.py'. El sistema iniciara correctamente.")
        else:
            print("[DB SYSTEM] El esquema fisico esta 100% sincronizado con el modelo ORM. No se requieren mutaciones.")


if __name__ == "__main__":
    print("Iniciando auditoria de arquitectura de base de datos...")
    run_schema_upgrade()