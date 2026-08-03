import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from concurrent.futures import ThreadPoolExecutor

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config.settings import Config


class EmailService:
    """
    Capa de Mensajeria Transaccional Integrada con Google Workspace API (OAuth 2.0).
    Opera en modo Fire-and-Forget mediante ThreadPoolExecutor, evadiendo
    bloqueos de puertos en redes Cloud al usar transacciones HTTPS.
    """
    _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="EmailWorker")
    _SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

    @classmethod
    def _get_gmail_service(cls):
        """Construye y autentica el cliente HTTP RESTful de Google Gmail."""
        creds = Credentials(
            token=None,
            refresh_token=Config.GMAIL_REFRESH_TOKEN,
            client_id=Config.GMAIL_CLIENT_ID,
            client_secret=Config.GMAIL_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
            scopes=cls._SCOPES,
        )
        # cache_discovery=False mitiga colisiones de permisos de escritura en contenedores efimeros (Render/Docker)
        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    @classmethod
    def _send_email_task(cls, app_obj, recipient_email: str, subject: str, html_content: str) -> bool:
        """Hilo en segundo plano. Requiere inyeccion del contexto de la app de Flask."""
        with app_obj.app_context():
            sender_email = Config.GMAIL_SENDER

            if not Config.GMAIL_REFRESH_TOKEN or not Config.GMAIL_CLIENT_ID:
                print("[EMAIL ERROR] Credenciales OAuth2 de Gmail no configuradas en el entorno Cloud.")
                return False

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"APS ESE 2026 Notificaciones <{sender_email}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(html_content, "html", "utf-8"))

            # Transformacion Binaria Segura requerida por la especificacion de Google API
            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode()

            try:
                service = cls._get_gmail_service()
                service.users().messages().send(
                    userId="me",
                    body={"raw": raw_message}
                ).execute()

                print(f"[EMAIL SUCCESS] Credenciales despachadas exitosamente a {recipient_email} via Gmail API")
                return True

            except HttpError as e:
                print(f"[EMAIL ERROR] Error HTTP en Gmail API hacia {recipient_email}: {str(e)}")
                return False
            except Exception as e:
                print(f"[EMAIL CRITICAL ERROR] Fallo interno del cliente de Google hacia {recipient_email}: {str(e)}")
                return False

    @classmethod
    def send_welcome_credentials_async(cls, app_obj, recipient_email: str, raw_password: str, role: str) -> None:
        """
        API de enrutamiento asincrono. Formatea la notificacion transaccional y delega
        la transaccion de red al ThreadPool de manera no bloqueante.
        """
        subject = "Bienvenido a APS ESE 2026 - Credenciales de Acceso"

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }}
                .card {{ background-color: #f8fbff; border-radius: 8px; padding: 30px; border-top: 5px solid #00b09b; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ color: #004b87; border-bottom: 2px solid #00b09b; padding-bottom: 10px; margin-bottom: 20px; }}
                .credential-box {{ background-color: #ffffff; border: 1px solid #e0e0e0; padding: 20px; margin: 20px 0; border-radius: 6px; }}
                .footer {{ font-size: 0.8rem; color: #64748b; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2 class="header">Hola, Especialista</h2>
                <p style="font-size: 16px;">Se ha creado exitosamente su acceso a la plataforma <strong>APS ESE 2026</strong>.</p>
                <div class="credential-box">
                    <p style="margin-top: 0;"><strong>Usuario:</strong> {recipient_email}</p>
                    <p><strong>Contraseña Temporal:</strong> <code>{raw_password}</code></p>
                    <p style="margin-bottom: 0;"><strong>Perfil Asignado:</strong> {role}</p>
                </div>
                <p style="font-size: 15px;">Por normativas de ciberseguridad, le recomendamos cambiar su contraseña una vez inicie sesión en la plataforma.</p>
                <div class="footer">
                    <p>Mensaje automático generado por el subsistema IAM de APS ESE 2026.</p>
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
