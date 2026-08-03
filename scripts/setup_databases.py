import sys
import os
import importlib.util
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..'))
safe_paths = [p for p in sys.path if ".venv" in p or "site-packages" in p or "Python" in p or "lib" in p.lower()]
sys.path = safe_paths
sys.path.insert(0, root_dir)

app_path = os.path.join(root_dir, 'app.py')
spec = importlib.util.spec_from_file_location("app_module", app_path)
app_module = importlib.util.module_from_spec(spec)
sys.modules["app_module"] = app_module
spec.loader.exec_module(app_module)

from src.models import db
# ARQUITECTURA: Importación OBLIGATORIA para que SQLAlchemy registre las tablas en db.metadata
from src.models.especialista_model import Especialista
from src.models.nutricion_model import FormularioNutricion
from src.models.respiratoria_model import FormularioRespiratoria
from src.models.fisioterapia_model import FormularioFisioterapia


def inicializar_esquemas():
    print("=========================================================")
    print(" INICIANDO DESPLIEGUE DDL - IDENTITY & ACCESS MANAGEMENT")
    print("=========================================================")
    app_instance = app_module.create_app()
    with app_instance.app_context():
        try:
            db.create_all()

            # PARCHE DDL: Inyección de Control de Acceso Basado en Roles (RBAC)
            db.session.execute(
                text("ALTER TABLE especialista ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'DILIGENCIADOR';"))
            db.session.execute(
                text("ALTER TABLE especialista ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;"))

            db.session.commit()
            print("EXITO: Transaccion DDL completada. Tablas e indices sincronizados.")
        except SQLAlchemyError as e:
            db.session.rollback()
            print(f"ERROR CRITICO: {str(e)}")
            sys.exit(1)


if __name__ == '__main__':
    inicializar_esquemas()