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
    Implementa procesamiento en RAM, enrutamiento a Unidades Compartidas y sanitizacion Base64.
    """
    SCOPES = ['https://www.googleapis.com/auth/drive.file']

    @classmethod
    def get_service(cls):
        if not Config.GOOGLE_CREDENTIALS_JSON:
            raise ValueError("Variable de entorno GOOGLE_CREDENTIALS_JSON no configurada o vacia.")

        try:
            creds_info = json.loads(Config.GOOGLE_CREDENTIALS_JSON)
            creds = service_account.Credentials.from_service_account_info(
                creds_info, scopes=cls.SCOPES)
            return build('drive', 'v3', credentials=creds)
        except json.JSONDecodeError:
            raise ValueError("El formato de GOOGLE_CREDENTIALS_JSON es invalido.")
        except Exception as e:
            raise RuntimeError(f"Fallo al construir el cliente de Google Drive: {str(e)}")

    @classmethod
    def upload_stream_evidence(cls, file_stream: io.BytesIO, file_name: str, modulo: str,
                               mime_type: str = 'application/pdf') -> str:
        try:
            folder_id = Config.DRIVE_FOLDERS.get(modulo.lower())
            if not folder_id:
                raise ValueError(f"El modulo {modulo} no posee un repositorio de Drive configurado.")

            service = cls.get_service()
            file_metadata = {
                'name': file_name,
                'parents': [folder_id]
            }
            media = MediaIoBaseUpload(file_stream, mimetype=mime_type, resumable=True)

            uploaded_file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink',
                supportsAllDrives=True
            ).execute()

            print(f"INFO: Evidencia {file_name} transferida exitosamente al modulo {modulo.upper()}.")
            return uploaded_file.get('webViewLink')

        except HttpError as e:
            if e.resp.status in [403, 404]:
                msg = f"Error IAM GCP: La carpeta destino ({folder_id}) no existe o la cuenta de servicio no tiene rol de Editor."
                print(f"[CRITICAL IAM] {msg}")
                raise PermissionError(msg)
            raise e
        except Exception as e:
            print(f"Error critico en transferencia a Google Drive: {str(e)}")
            raise e

    @classmethod
    def upload_base64_evidence(cls, base64_data: str, file_name: str, modulo: str) -> str:
        try:
            if not base64_data or not isinstance(base64_data, str):
                raise ValueError("Payload Base64 invalido o vacio.")

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

            # Sanitizacion Estricta Base64 (Limpieza de saltos de linea y calculo de padding)
            b64_str = ''.join(b64_str.split())
            b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
            file_bytes = base64.b64decode(b64_str)
            memory_buffer = io.BytesIO(file_bytes)

            try:
                return cls.upload_stream_evidence(
                    file_stream=memory_buffer,
                    file_name=file_name,
                    modulo=modulo,
                    mime_type=mime_type
                )
            finally:
                memory_buffer.close()

        except PermissionError as e:
            raise e
        except Exception as e:
            print(f"Error critico decodificando Base64 en RAM: {str(e)}")
            raise e