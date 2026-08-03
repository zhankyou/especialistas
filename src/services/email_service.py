import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import Config
from flask import request


class EmailService:
    @staticmethod
    def send_welcome_email(destinatario, nombre, raw_password, rol):
        """
        Servicio Transaccional SMTP (TLS 587).
        Envía credenciales en texto plano por única vez al momento de la creación.
        """
        remitente = Config.GMAIL_SENDER
        password = Config.GMAIL_APP_PASSWORD

        if not remitente or not password:
            print("Advertencia Arquitectónica: Credenciales SMTP no configuradas. Correo omitido.")
            return False

        try:
            # Captura de la URL base dinámica del servidor Flask
            login_url = f"{request.host_url}login"
        except:
            login_url = "http://localhost:5000/login"

        msg = MIMEMultipart()
        msg['From'] = remitente
        msg['To'] = destinatario
        msg['Subject'] = "Tus Credenciales de Acceso - Plataforma APS ESE 2026"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                    <h2 style="color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 10px;">Bienvenido al Sistema de Información APS</h2>
                    <p>Estimado/a <strong>{nombre}</strong>,</p>
                    <p>El equipo de administración ha habilitado una cuenta oficial para usted bajo el rol de seguridad: <strong>{rol}</strong>.</p>
                    <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0 0 10px 0;">Sus credenciales de acceso son:</p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li><strong>Usuario (Email):</strong> {destinatario}</li>
                            <li><strong>Contraseña Asignada:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px;">{raw_password}</span></li>
                        </ul>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{login_url}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder a la Plataforma</a>
                    </div>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                        <em>Aviso de Seguridad: Si usted no solicitó esta cuenta o no pertenece a la ESE, elimine este correo de inmediato (ISO 27001).</em>
                    </p>
                </div>
            </body>
        </html>
        """

        msg.attach(MIMEText(html_content, 'html'))

        try:
            # Handshake Seguro SMTP TLS
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(remitente, password)
            server.send_message(msg)
            server.quit()
            return True
        except Exception as e:
            print(f"Error SMTP Transaccional: {str(e)}")
            return False