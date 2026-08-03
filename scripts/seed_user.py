import sys
import os
import importlib.util
from sqlalchemy.exc import IntegrityError

# 1. Resolucion absoluta de la raiz del proyecto actual
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..'))

# 2. SANITIZACION DE RUTAS MEDIANTE LISTA BLANCA (Whitelisting)
safe_paths = []
for p in sys.path:
    if ".venv" in p or "site-packages" in p or "Python" in p or "lib" in p.lower():
        safe_paths.append(p)

sys.path = safe_paths
sys.path.insert(0, root_dir)

# 3. Inyeccion fisica de app.py
app_path = os.path.join(root_dir, 'app.py')
spec = importlib.util.spec_from_file_location("app_module", app_path)
app_module = importlib.util.module_from_spec(spec)
sys.modules["app_module"] = app_module
spec.loader.exec_module(app_module)

from src.models.especialista_model import db, Especialista


def inyectar_usuario_semilla():
    """
    Genera el primer registro de acceso para pruebas de autenticacion.
    Respeta el encapsulamiento del modelo para el cifrado de credenciales.
    """
    print("=========================================================")
    print(" INICIANDO PROCESO DE INYECCION DML (SEEDER)")
    print("=========================================================")

    app_instance = app_module.create_app()

    with app_instance.app_context():
        email_admin = "profesional@entidad.gov.co"
        password_plana = "APS.Seguro2026*"

        try:
            usuario_existente = Especialista.query.filter_by(email=email_admin).first()
            if usuario_existente:
                print(f"ADVERTENCIA: El identificador {email_admin} ya existe. Omitiendo operacion.")
                return

            # CORRECCION ARQUITECTONICA: Principio de Encapsulamiento (POO)
            # Pasamos la clave plana al constructor. El modelo Especialista
            # se encargara de invocar werkzeug.security internamente.
            nuevo_especialista = Especialista(
                email=email_admin,
                password=password_plana,
                rol="profesional_aps"
            )

            # Asignacion de estado activo post-instanciacion
            nuevo_especialista.is_active = True

            db.session.add(nuevo_especialista)
            db.session.commit()

            print("EXITO: Identidad aprovisionada en la base de datos.")
            print(f"-> Correo: {email_admin}")
            print(f"-> Clave:  {password_plana}")

        except IntegrityError:
            db.session.rollback()
            print("ERROR: Violacion de unicidad en la base de datos (Unique Constraint).")
            sys.exit(1)
        except Exception as e:
            db.session.rollback()
            print("ERROR CRITICO: Falla inesperada en la transaccion de inyeccion.")
            print(f"Detalle tecnico: {str(e)}")
            sys.exit(1)


if __name__ == '__main__':
    inyectar_usuario_semilla()