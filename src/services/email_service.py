import smtplib
import socket
import ssl
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor
from config.settings import Config


class SecureIPv4SMTP(smtplib.SMTP_SSL):
    """
    Subclase extendida de SMTP_SSL (Arquitectura POO).
    Sobrescribe el comportamiento del Socket para forzar el enrutamiento exclusivo
    por IPv4. Mitiga bloqueos de red [Errno 101] en entornos Cloud (Render/AWS).
    """
    def _get_socket(self, host, port, timeout):
        # Filtrado estricto de resolucion DNS a IPv4 (AF_INET)
        info = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        new_socket = None
        
        for res in info:
            af, socktype, proto, canonname, sa = res
            try:
                new_socket = socket.socket(af, socktype, proto)
                new_socket.settimeout(timeout)
                new_socket.connect(sa)
                break
            except OSError:
                if new_socket:
                    new_socket.close()
                new_socket = None
        
        if not new_socket:
            raise OSError(f"Red inalcanzable via IPv4 para el host: {host}:{port}")
        
        # Envoltura del Socket en un contexto criptografico TLS (ISO 27001)
        new_socket = self.context.wrap_socket(new_socket, server_hostname=self._host)
        return new_socket


class EmailService:
    """
    Capa de Mensajeria Transaccional.
    Opera en modo Fire-and-Forget mediante ThreadPoolExecutor.
    """
    _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="EmailWorker")

    @classmethod
    def _send_email_task(cls, app_obj, recipient_email: str, subject: str, html_content: str) -> bool:
        """Hilo en segundo plano. Aislado del Event Loop principal de Flask."""
        with app_obj.app_context():
            sender_email = Config.GMAIL_SENDER
            sender_password = Config.GMAIL_APP_PASSWORD

            if not sender_email or not sender_password:
                print("[EMAIL ERROR] Credenciales de correo no configuradas en entorno Cloud.")
                return False

            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"APS ESE 2026 Notificaciones <{sender_email}>"
            message["To"] = recipient_email

            part_html = MIMEText(html_content, "html", "utf-8")
            message.attach(part_html)

            # Patrón de Resiliencia: Circuit Breaker y Retry
            max_retries = 3
            
            for attempt in range(max_retries):
                try:
                    # Implementacion de Cifrado Estricto desde Byte 0 (Puerto 465)
                    context = ssl.create_default_context()
                    with SecureIPv4SMTP("smtp.gmail.com", 465, context=context, timeout=15) as server:
                        server.login(sender_email, sender_password)
                        server.sendmail(sender_email, recipient_email, message.as_string())
                    
                    print(f"[EMAIL SUCCESS] Credenciales despachadas exitosamente a {recipient_email}")
                    return True

                except (socket.error, smtplib.SMTPException, OSError) as e:
                    print(f"[EMAIL WARNING] Hilo SMTP fallido (Intento {attempt + 1}/{max_retries}) hacia {recipient_email}: {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2)  # Backoff lineal
                    else:
                        print(f"[EMAIL CRITICAL ERROR] Imposible alcanzar servidor de Google para {recipient_email}.")
                        return False

    @classmethod
    def send_welcome_credentials_async(cls, app_obj, recipient_email: str, raw_password: str, role: str) -> None:
        """
        API de enrutamiento asincrono. Recibe el proxy del aplicativo (app_obj)
        para preservar la configuracion en el salto de hilo.
        """
        subject = "Bienvenido a APS ESE 2026 - Credenciales de Acceso"
        
        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 20px; }}
                .card {{ background-color: #ffffff; border-radius: 8px; padding: 30px; border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; }}
                .header {{ color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }}
                .credential-box {{ background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .footer {{ font-size: 0.8rem; color: #64748b; margin-top: 20px; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2 class="header">APS ESE 2026 - Acceso a Plataforma</h2>
                <p>Se ha creado exitosamente su cuenta de especialista.</p>
                <div class="credential-box">
                    <p><strong>Usuario:</strong> {recipient_email}</p>
                    <p><strong>Contrasena Temporal:</strong> <code>{raw_password}</code></p>
                    <p><strong>Rol Asignado:</strong> {role}</p>
                </div>
                <p>Por normativas de ciberseguridad, cambie su contrasena tras el primer ingreso.</p>
                <div class="footer">
                    <p>Mensaje automatico generado por el subsistema IAM de APS ESE 2026.</p>
                </div>
            </div>
        </body>
        </html>
        """

        cls._executor.submit(
            cls._send_email_task,
            app_obj,
            recipient_email,
            subject,
            html_template
        )
