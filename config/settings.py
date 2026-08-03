import os
import sys
from urllib.parse import quote_plus
from dotenv import load_dotenv


def find_env_file(start_path, filename=".env"):
    current_dir = os.path.abspath(start_path)
    while True:
        target_path = os.path.join(current_dir, filename)
        if os.path.exists(target_path):
            return target_path
        parent_dir = os.path.dirname(current_dir)
        if parent_dir == current_dir:
            return None
        current_dir = parent_dir


BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
env_path = find_env_file(BASE_DIR)

if env_path:
    load_dotenv(dotenv_path=env_path, override=True)


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default_aps_secret_key_2026')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default_jwt_secure_key_2026')
    PORT = int(os.environ.get('PORT', 5000))
    DEBUG = os.environ.get('DEBUG', 'False') == 'True'
    TEMPLATES_AUTO_RELOAD = True

    # -------------------------------------------------------------------------
    # ARQUITECTURA CLOUD-NATIVE ESTRICTA (AIVEN POSTGRESQL)
    # -------------------------------------------------------------------------
    aiven_host = os.environ.get('DB_HOST_AIVEN')
    aiven_pass = os.environ.get('DB_PASSWORD_AIVEN')

    # Principio Fail-Fast: Si no hay credenciales de nube, el sistema aborta.
    if not aiven_host or not aiven_pass:
        print("[CRITICAL ERROR] Faltan credenciales de Aiven PostgreSQL (DB_HOST_AIVEN o DB_PASSWORD_AIVEN).")
        print("[SYSTEM HALT] El sistema esta configurado para operar EXCLUSIVAMENTE en la nube. Abortando inicio.")
        sys.exit(1)

    db_user = os.environ.get('DB_USER_AIVEN', 'avnadmin')
    db_port = os.environ.get('DB_PORT_AIVEN', '23508')
    db_name = os.environ.get('DB_NAME_AIVEN', 'defaultdb')

    # Sanitizacion de caracteres especiales en la contrasena
    safe_pass = quote_plus(aiven_pass)

    # Cadena de conexion blindada con SSL obligatorio
    db_url = f"postgresql://{db_user}:{safe_pass}@{aiven_host}:{db_port}/{db_name}?sslmode=require"

    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Optimizacion de Pool de Conexiones para Nube (Mitigacion de Timeouts)
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 10,
        "max_overflow": 20
    }

    # -------------------------------------------------------------------------
    # CREDENCIALES DE SERVICIOS EXTERNOS & API GMAIL (OAUTH 2.0)
    # -------------------------------------------------------------------------
    DRIVE_FOLDERS = {
        'nutricion': os.environ.get('DRIVE_FOLDER_NUTRICION', '1AOg42aBJK7ovBwdo71k0qsGBGjF-o8H6'),
        'respiratoria': os.environ.get('DRIVE_FOLDER_RESPIRATORIA', '1l5KYIahKfquT37DaRz1GrLWRe77GmiLQ'),
        'fisioterapia': os.environ.get('DRIVE_FOLDER_FISIOTERAPIA', '1MKUp4UHlZ-QkweEvFm9yd-qG9DG3g9z2')
    }

    GOOGLE_CREDENTIALS_JSON = os.environ.get('GOOGLE_CREDENTIALS_JSON', '')

    # REGLA ESTRICTA DE NEGOCIO: Remitente centralizado (Single Source of Truth)
    GMAIL_SENDER = os.environ.get('GMAIL_SENDER', 'cristian.calentura@gmail.com')

    # Variables de acceso OAuth2 para la API REST de Google
    GMAIL_CLIENT_ID = os.environ.get('GMAIL_CLIENT_ID', '')
    GMAIL_CLIENT_SECRET = os.environ.get('GMAIL_CLIENT_SECRET', '')
    GMAIL_REFRESH_TOKEN = os.environ.get('GMAIL_REFRESH_TOKEN', '')

    # Mantenido por retrocompatibilidad segun el snippet original
    GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')

    TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')
