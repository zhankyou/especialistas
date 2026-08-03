import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor
from config.settings import Config


class EmailService:
    """
    Servicio de mensajeria transaccional (SMTP).
    Implementa ThreadPoolExecutor para despachos asincronos (Fire-and-Forget)
    sin bloquear el Event Loop del servidor WSGI.
    """
    _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="EmailWorker")

    @classmethod
    def _send_email_task(cls, app_obj, recipient_email: str, subject: str, html_content: str) -> bool:
        """Tarea aislada en hilo secundario. Requiere inyeccion del app_context."""
        with app_obj.app_context():
            sender_email = Config.GMAIL_SENDER
            sender_password = Config.GMAIL_APP_PASSWORD

            if not sender_email or not sender_password:
                print("[EMAIL ERROR] Credenciales de correo no configuradas en las variables de entorno.")
                return False

            try:
                message = MIMEMultipart("alternative")
                message["Subject"] = subject
                message["From"] = f"APS ESE 2026 Notification <{sender_email}>"
                message["To"] = recipient_email

                part_html = MIMEText(html_content, "html", "utf-8")
                message.attach(part_html)

                # Conexion SMTP con cifrado TLS
                with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(sender_email, sender_password)
                    server.sendmail(sender_email, recipient_email, message.as_string())

                print(f"[EMAIL SUCCESS] Correo transaccional enviado exitosamente a {recipient_email}")
                return True

            except Exception as e:
                print(f"[EMAIL ERROR] Fallo critico de capa de red SMTP hacia {recipient_email}: {str(e)}")
                return False

    @classmethod
    def send_welcome_credentials_async(cls, app_obj, recipient_email: str, raw_password: str, role: str) -> None:
        """
        Despacha las credenciales al nuevo especialista.
        El parametro 'app_obj' es estricto para evitar la perdida de contexto (Out of Context Error).
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
                <p>Por normativas de ciberseguridad, le recomendamos cambiar su contrasena.</p>
                <div class="footer">
                    <p>Este es un mensaje automatico. Por favor, no responda a este correo.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Envio al ThreadPool
        cls._executor.submit(
            cls._send_email_task,
            app_obj,
            recipient_email,
            subject,
            html_template
        )