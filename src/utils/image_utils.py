import os
import base64
from flask import current_app


class ImageUtils:
    """
    Capa de Utilidades de Infraestructura para el procesamiento de recursos graficos.
    Transforma imagenes estaticas a cadenas codificadas en Base64 para inyeccion segura en plantillas PDF.
    """

    @classmethod
    def get_base64_image(cls, image_name: str) -> str:
        """
        Lee una imagen desde la carpeta static/img y devuelve su representación Base64 Data URI.
        Retorna una cadena vacía en caso de no encontrar el archivo o ante fallos de lectura I/O.
        """
        if not image_name:
            return ""

        try:
            static_folder = current_app.static_folder or os.path.join(current_app.root_path, 'static')
            image_path = os.path.join(static_folder, 'img', image_name)

            if not os.path.exists(image_path):
                print(f"[IMAGE UTIL WARNING] Recurso de imagen no encontrado en ruta: {image_path}")
                return ""

            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

            extension = image_name.split('.')[-1].lower()
            mime_type = "image/png" if extension == "png" else "image/jpeg"

            return f"data:{mime_type};base64,{encoded_string}"

        except Exception as e:
            print(f"[IMAGE UTIL ERROR] Fallo I/O al procesar la imagen {image_name}: {str(e)}")
            return ""
