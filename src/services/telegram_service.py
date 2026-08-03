import urllib.request
import urllib.parse
import json
from config.settings import Config


class TelegramService:
    @staticmethod
    def send_restoration_request(record_id, user_email, user_rol):
        """
        Arquitectura Webhook Nativa (Sin dependencias externas).
        Despacha alertas al Chatbot de Telegram para los flujos de autorización.
        """
        token = Config.TELEGRAM_BOT_TOKEN
        chat_id = Config.TELEGRAM_CHAT_ID

        if not token or not chat_id:
            print("Advertencia Arquitectónica: Credenciales de Telegram no configuradas.")
            return False

        text_message = (
            "🚨 *SOLICITUD DE RESTAURACIÓN (PAPELERA)*\n\n"
            f"🆔 *ID Expediente:* `{record_id}`\n"
            f"👤 *Solicitante:* {user_email}\n"
            f"🛡️ *Rol del Sistema:* {user_rol}\n\n"
            "⚠️ _Un Administrador o Coordinador debe ingresar al Gestor de Expedientes para revisar y aprobar esta operación._"
        )

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text_message,
            "parse_mode": "Markdown"
        }

        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

        try:
            with urllib.request.urlopen(req) as response:
                return response.getcode() == 200
        except Exception as e:
            print(f"Error HTTP Telegram API: {str(e)}")
            return False