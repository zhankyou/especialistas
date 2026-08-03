import os
from app import app
# Asegúrate de que 'app' sea la instancia de Flask creada en tu app.py o __init__.py

if __name__ == "__main__":
    # En producción (Render), Gunicorn ignora este bloque y usa el objeto 'app' directamente.
    # Esto actúa como un fallback de seguridad.
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)