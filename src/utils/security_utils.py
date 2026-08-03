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
        Genera una contraseña aleatoria de alta entropia alineada con normas NCSC/NIST.
        Garantiza al menos una mayuscula, una minuscula, un numero y un caracter especial.
        """
        if length < 8:
            length = 8

        lowercase = string.ascii_lowercase
        uppercase = string.ascii_uppercase
        digits = string.digits
        symbols = "!@#$%^&*"

        # Asegurar al menos un caracter de cada grupo
        password = [
            secrets.choice(lowercase),
            secrets.choice(uppercase),
            secrets.choice(digits),
            secrets.choice(symbols)
        ]

        # Rellenar el resto de la longitud elegida
        all_characters = lowercase + uppercase + digits + symbols
        password += [secrets.choice(all_characters) for _ in range(length - 4)]

        # Mezclar criptograficamente la lista de caracteres
        secrets.SystemRandom().shuffle(password)
        return "".join(password)

    @staticmethod
    def sanitize_email(email: str) -> str:
        """
        Normaliza y sanitiza cadenas de correo electronico para prevenir inyecciones.
        """
        if not email or not isinstance(email, str):
            return ""
        sanitized = email.strip().lower()
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, sanitized):
            return ""
        return sanitized
