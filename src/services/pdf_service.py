import io
from flask import render_template
from xhtml2pdf import pisa


class PdfService:
    """
    Motor de Generacion de Reportes PDF utilizando XHTML2PDF.
    Proporciona traduccion de plantillas Jinja2 a flujos binarios PDF con soporte
    para CSS embebido, prevencion de saltos de linea y UTF-8 encoding.
    """

    @staticmethod
    def _create_pdf(html_content: str) -> bytes:
        pdf_buffer = io.BytesIO()
        # Se forza la codificacion UTF-8 para evitar corrupcion de caracteres especiales (ñ, tildes)
        pisa_status = pisa.CreatePDF(
            io.StringIO(html_content),
            dest=pdf_buffer,
            encoding='utf-8'
        )
        if pisa_status.err:
            raise Exception(f"xhtml2pdf error interno de renderizado: {pisa_status.err}[cite: 15]")
        return pdf_buffer.getvalue()

    @staticmethod
    def generate_nutricion_pdf(data_dict: dict) -> bytes:
        rendered_html = render_template('pdf/nutricion_pdf.html', data=data_dict)
        return PdfService._create_pdf(rendered_html)

    @staticmethod
    def generate_respiratoria_pdf(data_dict: dict) -> bytes:
        rendered_html = render_template('pdf/respiratoria_pdf.html', data=data_dict)
        return PdfService._create_pdf(rendered_html)

    @staticmethod
    def generate_fisioterapia_pdf(data_dict: dict) -> bytes:
        rendered_html = render_template('pdf/fisioterapia_pdf.html', data=data_dict)
        return PdfService._create_pdf(rendered_html)
