import sys
import os
import importlib.util
from werkzeug.security import generate_password_hash

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
from src.models.especialista_model import Especialista


def inyectar_administrador():
    print("=========================================================")
    print(" INICIANDO SECUENCIA CRIPTOGRAFICA DE ADMINISTRADOR IAM")
    print("=========================================================")

    admin_email = "cristian.calentura@gmail.com"
    admin_raw_password = "Pako-189@"

    app_instance = app_module.create_app()
    with app_instance.app_context():
        try:
            # Observabilidad Arquitectónica: Validación del motor conectado
            engine_url = str(db.engine.url)
            # Ofuscación de credenciales en consola (OWASP Log Forging Prevention)
            masked_url = engine_url.split('@')[-1] if '@' in engine_url else engine_url
            print(f"INFO: Conectado a la Base de Datos -> {masked_url}")

            hashed_pwd = generate_password_hash(admin_raw_password, method='pbkdf2:sha256:260000')
            user = Especialista.query.filter_by(email=admin_email).first()

            if user:
                user.password_hash = hashed_pwd
                user.rol = 'ADMINISTRADOR'
                user.is_blocked = False
                print(
                    f"INFO: El usuario {admin_email} existe en la base de datos. Privilegios restaurados a ADMINISTRADOR.")
            else:
                nuevo_admin = Especialista(
                    email=admin_email,
                    nombre="Cristian Calentura",
                    password_hash=hashed_pwd,
                    rol='ADMINISTRADOR',
                    is_blocked=False,
                    registro_profesional="SYS-ADMIN-01"
                )
                db.session.add(nuevo_admin)
                print(f"INFO: Nuevo Administrador {admin_email} inyectado con exito.")

            db.session.commit()
            print("=========================================================")
            print(" EXITO: Transaccion persistida en Base de Datos PostgreSQL.")
            print(" Ya puede iniciar sesion en la plataforma web.")
            print("=========================================================")

        except Exception as e:
            db.session.rollback()
            print(f"ERROR CRITICO DURANTE EL SEEDING: {str(e)}")


if __name__ == '__main__':
    inyectar_administrador()