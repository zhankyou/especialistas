import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor
from flask import current_app
from config.settings import Config


class EmailService:
    """
    Servicio de notificaciones por correo electronico.
    Implementa un patron de ejecucion asincrono por hilos (ThreadPoolExecutor)
    para evitar el bloqueo del Worker de Gunicorn y prevenir llamadas SIGKILL por Timeout.
    """

    # Pool de hilos limitado para no saturar la CPU de Render
    _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="EmailWorker")

    @classmethod
    def _send_email_task(cls, app_obj, recipient_email: str, subject: str, html_content: str) -> bool:
        """
        Tarea interna ejecutada en el hilo secundario.
        Restablece el contexto de aplicacion de Flask para acceder a variables de configuracion.
        """
        with app_obj.app_context():
            sender_email = Config.GMAIL_SENDER
            sender_password = Config.GMAIL_APP_PASSWORD

            if not sender_email or not sender_password:
                print("ERROR EMAIL: Credenciales de GMAIL_SENDER o GMAIL_APP_PASSWORD no configuradas.")
                return False

            try:
                message = MIMEMultipart("alternative")
                message["Subject"] = subject
                message["From"] = f"APS ESE 2026 Notification <{sender_email}>"
                message["To"] = recipient_email

                part_html = MIMEText(html_content, "html", "utf-8")
                message.attach(part_html)

                # Conexion SMTP segura con timeout de socket ajustado
                with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(sender_email, sender_password)
                    server.sendmail(sender_email, recipient_email, message.as_string())

                print(f"INFO EMAIL: Notificacion enviada exitosamente a {recipient_email}")
                return True

            except smtplib.SMTPAuthenticationError:
                print(f"ERROR EMAIL CRITICO: Fallo de autenticacion SMTP para {sender_email}. Verifique App Password.")
                return False
            except smtplib.SMTPException as e:
                print(f"ERROR EMAIL SMTP: Fallo en protocolo al enviar a {recipient_email}. Detalle: {str(e)}")
                return False
            except Exception as e:
                print(f"ERROR EMAIL INESPERADO: Excepcion en hilo secundario. Detalle: {str(e)}")
                return False

    @classmethod
    def send_welcome_credentials_async(cls, recipient_email: str, raw_password: str, role: str) -> None:
        """
        Punto de entrada publico no bloqueante. Programado en el pool de hilos.
        Devuelve el control de ejecucion al hilo HTTP de forma instantanea O(1).
        """
        app_obj = current_app._get_current_object()
        subject = "Bienvenido a APS ESE 2026 - Credenciales de Acceso"

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 20px; }}
                .card {{ background-color: #ffffff; border-radius: 8px; padding: 30px; border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; }}
                .header {{ color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }}
                .credential-box {{ background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .footer {{ font-size: 0.8rem; color: #64748b; margin-top: 20px; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2 class="header">APS ESE 2026 - Acceso a Plataforma</h2>
                <p>Se ha creado exitosamente una cuenta de especialista para su direccion de correo electronico.</p>
                <div class="credential-box">
                    <p><strong>Usuario:</strong> {recipient_email}</p>
                    <p><strong>Contrasena Temporal:</strong> <code style="font-size: 1.1rem; color: #d97706;">{raw_password}</code></p>
                    <p><strong>Rol Asignado:</strong> {role}</p>
                </div>
                <p>Por normativas de ciberseguridad ISO 27001, le recomendamos ingresar al sistema y cambiar esta contrasena inmediatamente.</p>
                <div class="footer">
                    <p>Este es un mensaje automatico generado por el sistema APS ESE 2026. No responda a este correo.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Despachar al ThreadPool sin esperar la respuesta
        cls._executor.submit(
            cls._send_email_task,
            app_obj,
            recipient_email,
            subject,
            html_template
        )
