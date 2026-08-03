import os
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
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default_aps_secret_key')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default_jwt_secure_key')
    PORT = int(os.environ.get('PORT', 5000))
    DEBUG = os.environ.get('DEBUG', 'True') == 'True'

    # PARAMETRO ARQUITECTONICO CRITICO: Forzar recarga del motor Jinja2
    TEMPLATES_AUTO_RELOAD = True

    aiven_host = os.environ.get('DB_HOST_AIVEN')
    aiven_pass = os.environ.get('DB_PASSWORD_AIVEN')

    if aiven_host and aiven_pass:
        db_user = os.environ.get('DB_USER_AIVEN', 'avnadmin')
        db_port = os.environ.get('DB_PORT_AIVEN', '23508')
        db_name = os.environ.get('DB_NAME_AIVEN', 'defaultdb')
        safe_pass = quote_plus(aiven_pass)
        db_url = f"postgresql://{db_user}:{safe_pass}@{aiven_host}:{db_port}/{db_name}?sslmode=require"
    else:
        db_user = os.environ.get('DB_USER', 'postgres')
        db_pass = os.environ.get('DB_PASSWORD')
        db_host = os.environ.get('DB_HOST', '127.0.0.1')
        db_port = os.environ.get('DB_PORT', '5432')
        db_name = os.environ.get('DB_NAME', 'postgres')
        safe_pass = quote_plus(db_pass) if db_pass else ""
        db_url = f"postgresql://{db_user}:{safe_pass}@{db_host}:{db_port}/{db_name}"

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', db_url)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    DRIVE_FOLDERS = {
        'nutricion': os.environ.get('DRIVE_FOLDER_NUTRICION', '1AOg42aBJK7ovBwdo71k0qsGBGjF-o8H6'),
        'respiratoria': os.environ.get('DRIVE_FOLDER_RESPIRATORIA', '1l5KYIahKfquT37DaRz1GrLWRe77GmiLQ'),
        'fisioterapia': os.environ.get('DRIVE_FOLDER_FISIOTERAPIA', '1MKUp4UHlZ-QkweEvFm9yd-qG9DG3g9z2')
    }

    GOOGLE_CREDENTIALS_JSON = os.environ.get('GOOGLE_CREDENTIALS_JSON', '')
    GMAIL_SENDER = os.environ.get('GMAIL_SENDER', 'cristian.calentura@gmail.com')
    GMAIL_APP_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD', '')
    TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')