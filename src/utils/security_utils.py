import re
import string
import secrets

class SecurityUtils:
    """
    Utilidades de seguridad para sanitizacion de entradas y generacion
    criptograficamente segura de credenciales (OWASP ASVS v4.0).
    """

    @staticmethod
    def generate_secure_password(length: int = 12) -> str:
        """
        Genera una contrasena aleatoria de alta entropia alineada con normas NCSC/NIST.
        """
        if length < 8:
            length = 8

        lowercase = string.ascii_lowercase
        uppercase = string.ascii_uppercase
        digits = string.digits
        symbols = "!@#$%^&*"

        password = [
            secrets.choice(lowercase),
            secrets.choice(uppercase),
            secrets.choice(digits),
            secrets.choice(symbols)
        ]

        all_characters = lowercase + uppercase + digits + symbols
        password += [secrets.choice(all_characters) for _ in range(length - 4)]

        secrets.SystemRandom().shuffle(password)
        return "".join(password)

    @staticmethod
    def sanitize_email_strict(email: str) -> str:
        """
        Validacion estricta para NUEVOS registros.
        """
        if not email or not isinstance(email, str):
            return ""
        sanitized = email.strip().lower()
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, sanitized):
            return ""
        return sanitized

    @staticmethod
    def sanitize_email_login(email: str) -> str:
        """
        Validacion tolerante para LOGIN de usuarios legacy.
        Mantiene el formato original para delegar la insensibilidad a mayusculas a PostgreSQL.
        """
        if not email or not isinstance(email, str):
            return ""
        return email.strip()