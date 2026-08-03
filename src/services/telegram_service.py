import urllib.request
import urllib.parse
import json
from concurrent.futures import ThreadPoolExecutor
from config.settings import Config


class TelegramService:
    """
    Capa de Mensajeria Push Integrada con Telegram API (Webhook Nativo).
    Implementa ThreadPoolExecutor para despachos asincronos (Fire-and-Forget),
    evitando el bloqueo del Event Loop del servidor Flask.
    """
    _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="TelegramWorker")

    @classmethod
    def _send_message_task(cls, text_message: str) -> None:
        """
        Hilo secundario de red. Aislado para prevenir timeouts en la UI.
        No utiliza librerias de terceros (cero dependencias, arquitectura nativa).
        """
        token = Config.TELEGRAM_BOT_TOKEN
        chat_id = Config.TELEGRAM_CHAT_ID

        if not token or not chat_id:
            print("[TELEGRAM WARNING] Credenciales de Telegram no configuradas en el entorno Cloud.")
            return

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text_message,
            "parse_mode": "Markdown"
        }

        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

        try:
            # Timeout estricto de 5 segundos para liberar descriptores de socket
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.getcode() == 200:
                    print("[TELEGRAM SUCCESS] Notificacion de seguridad despachada exitosamente.")
                else:
                    print(f"[TELEGRAM ERROR] Respuesta inesperada del webhook: HTTP {response.getcode()}")
        
        except urllib.error.HTTPError as err:
            if err.code == 403:
                print("[TELEGRAM ERROR] 403 Forbidden: El bot esta bloqueado por el usuario o falta inicializar el chat.")
            else:
                print(f"[TELEGRAM ERROR] Falla HTTP en webhook de Telegram: HTTP {err.code}")
        except Exception as e:
            print(f"[TELEGRAM CRITICAL ERROR] Falla de capa de red hacia la API de Telegram: {str(e)}")

    @classmethod
    def send_restoration_request(cls, record_id, user_email, user_role):
        """
        Despacha alertas al Chatbot de Telegram para flujos de autorizacion sensibles.
        FIRMA CORREGIDA: 'user_role' para alinear con el Kwarg del controlador.
        """
        text_message = (
            "🚨 *SOLICITUD DE RESTAURACIÓN (PAPELERA)*\n\n"
            f"🆔 *ID Expediente:* `{record_id}`\n"
            f"👤 *Solicitante:* {user_email}\n"
            f"🛡️ *Rol del Sistema:* {user_role}\n\n"
            "⚠️ _Un Administrador o Coordinador debe ingresar al Gestor de Expedientes para revisar y aprobar esta operación._"
        )

        # Inyeccion de tarea a la cola del procesador en segundo plano
        cls._executor.submit(
            cls._send_message_task,
            text_message
        )
        
        # Retorno inmediato para liberar el Controller
        return True
