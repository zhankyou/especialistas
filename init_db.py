import os
from app import app
from src.models import db
# Importación estricta de todos los modelos para que SQLAlchemy los registre en su MetaData
from src.models.especialista_model import Especialista
from src.models.fisioterapia_model import FormularioFisioterapia
from src.models.nutricion_model import FormularioNutricion
from src.models.respiratoria_model import FormularioRespiratoria


def verificar_y_crear_tablas():
    """
    Rutina de aprovisionamiento de infraestructura de datos.
    Se conecta a Aiven PostgreSQL y genera las estructuras DDL requeridas.
    """
    print("Iniciando auditoria de infraestructura de base de datos en Aiven...")

    with app.app_context():
        try:
            # db.create_all() es seguro: crea tablas que no existen, pero NO altera ni borra las existentes.
            db.create_all()
            print("INFO: Todas las tablas han sido verificadas/creadas exitosamente en el esquema publico.")

            # Verificación de conexión básica consultando el catálogo de tablas
            from sqlalchemy import text
            with db.engine.connect() as connection:
                result = connection.execute(
                    text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
                tablas = [row[0] for row in result]
                print(f"Tablas detectadas en producción: {tablas}")

        except Exception as e:
            print(f"ERROR CRITICO: Fallo al conectar o aprovisionar Aiven PostgreSQL. Detalle: {str(e)}")


if __name__ == "__main__":
    verificar_y_crear_tablas()