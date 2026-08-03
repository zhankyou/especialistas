import sys
import os
import importlib.util
from sqlalchemy import text

# Resolución dinámica de rutas absolutas para el entorno de scripts
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..'))
safe_paths = [p for p in sys.path if ".venv" in p or "site-packages" in p or "Python" in p or "lib" in p.lower()]
sys.path = safe_paths
sys.path.insert(0, root_dir)

# Importación dinámica del Factory Pattern de la aplicación
app_path = os.path.join(root_dir, 'app.py')
spec = importlib.util.spec_from_file_location("app_module", app_path)
app_module = importlib.util.module_from_spec(spec)
sys.modules["app_module"] = app_module
spec.loader.exec_module(app_module)

from src.models import db


def patch_database_schema():
    """
    Ejecuta comandos DDL estructurales para sincronizar el esquema físico
    de PostgreSQL con los modelos lógicos de SQLAlchemy de forma no destructiva.
    """
    print("=========================================================")
    print(" INICIANDO MIGRACION ESTRUCTURAL DE BASE DE DATOS (DDL)")
    print("=========================================================")

    app_instance = app_module.create_app()
    with app_instance.app_context():
        try:
            # Observabilidad del entorno objetivo
            engine_url = str(db.engine.url)
            masked_url = engine_url.split('@')[-1] if '@' in engine_url else engine_url
            print(f"INFO: Parcheando Base de Datos -> {masked_url}")

            # ARQUITECTURA IDEMPOTENTE: 'IF NOT EXISTS' previene errores si el script se ejecuta 2 veces
            queries = [
                "ALTER TABLE formulario_nutricionista ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;",
                "ALTER TABLE formulario_respiratoria ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;",
                "ALTER TABLE formulario_fisioterapia ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;"
            ]

            for query in queries:
                db.session.execute(text(query))

            db.session.commit()
            print("INFO: Patrón Soft Delete (is_deleted) inyectado exitosamente en todos los módulos.")
            print("=========================================================")
            print(" EXITO: Esquema de base de datos sincronizado.")
            print(" Ya puede acceder al panel de Registros sin errores.")
            print("=========================================================")

        except Exception as e:
            db.session.rollback()
            print(f"ERROR CRITICO DE MIGRACION DDL: {str(e)}")


if __name__ == '__main__':
    patch_database_schema()