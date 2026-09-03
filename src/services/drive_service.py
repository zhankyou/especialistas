import json
import base64
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
from config.settings import Config


class DriveService:
    """
    Servicio conector para la API de Google Drive.
    Implementa procesamiento en RAM, enrutamiento a Unidades Compartidas y sanitizacion Base64[cite: 11].
    """
    SCOPES = ['https://www.googleapis.com/auth/drive.file']

    @classmethod
    def get_service(cls):
        if not getattr(Config, 'GOOGLE_CREDENTIALS_JSON', None):
            print("[DRIVE WARNING] GOOGLE_CREDENTIALS_JSON no configurada o vacia[cite: 11]. Subida omitida.")
            return None

        try:
            creds_info = json.loads(Config.GOOGLE_CREDENTIALS_JSON)
            creds = service_account.Credentials.from_service_account_info(
                creds_info, scopes=cls.SCOPES)
            return build('drive', 'v3', credentials=creds)
        except json.JSONDecodeError:
            print("[DRIVE ERROR] El formato de GOOGLE_CREDENTIALS_JSON es invalido[cite: 11].")
            return None
        except Exception as e:
            print(f"[DRIVE ERROR] Fallo al construir el cliente de Google Drive: {str(e)}[cite: 11]")
            return None

    @classmethod
    def upload_stream_evidence(cls, file_stream: io.BytesIO, file_name: str, modulo: str,
                               mime_type: str = 'application/pdf') -> str:
        service = cls.get_service()
        if not service:
            return ""

        try:
            # Mapeo dinamico de carpeta destino o fallback a directorio root
            folder_map = getattr(Config, 'DRIVE_FOLDERS', {})
            folder_id = folder_map.get(modulo.lower())

            file_metadata = {'name': file_name}
            if folder_id:
                file_metadata['parents'] = [folder_id]

            media = MediaIoBaseUpload(file_stream, mimetype=mime_type, resumable=True)

            uploaded_file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink',
                supportsAllDrives=True
            ).execute()

            print(
                f"[DRIVE SUCCESS] Evidencia {file_name} transferida exitosamente al modulo {modulo.upper()}[cite: 11].")
            return uploaded_file.get('webViewLink', '')

        except HttpError as e:
            print(
                f"[CRITICAL IAM] Error GCP: Carpeta ({folder_id}) inexistente o la cuenta carece de rol de Editor[cite: 11]. Detalles: {str(e)}")
            return ""
        except Exception as e:
            print(f"[DRIVE ERROR] Error critico en transferencia a Google Drive: {str(e)}[cite: 11]")
            return ""

    @classmethod
    def upload_base64_evidence(cls, base64_data: str, file_name: str, modulo: str) -> str:
        try:
            if not base64_data or not isinstance(base64_data, str):
                return ""

            b64_clean = base64_data.strip()
            if "," in b64_clean:
                header, b64_str = b64_clean.split(",", 1)
                if "data:" in header and ";" in header:
                    mime_type = header.split(";")[0].replace("data:", "").strip()
                else:
                    mime_type = 'image/png'
            else:
                b64_str = b64_clean
                mime_type = 'application/pdf' if file_name.lower().endswith('.pdf') else 'image/jpeg'

            # Sanitizacion Estricta Base64 (Limpieza de saltos de linea y calculo de padding)[cite: 11]
            b64_str = ''.join(b64_str.split())
            b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
            file_bytes = base64.b64decode(b64_str)

            with io.BytesIO(file_bytes) as memory_buffer:
                return cls.upload_stream_evidence(
                    file_stream=memory_buffer,
                    file_name=file_name,
                    modulo=modulo,
                    mime_type=mime_type
                )

        except Exception as e:
            print(f"[DRIVE ERROR] Error critico decodificando Base64 en RAM: {str(e)}[cite: 11]")
            return ""
