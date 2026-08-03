import io
from flask import render_template
from xhtml2pdf import pisa

class PdfService:
    @staticmethod
    def _create_pdf(html_content):
        pdf_buffer = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.StringIO(html_content), dest=pdf_buffer, encoding='utf-8')
        if pisa_status.err: raise Exception(f"xhtml2pdf error: {pisa_status.err}")
        return pdf_buffer.getvalue()

    @staticmethod
    def generate_nutricion_pdf(data_dict):
        return PdfService._create_pdf(render_template('pdf/nutricion_pdf.html', data=data_dict))

    @staticmethod
    def generate_respiratoria_pdf(data_dict):
        return PdfService._create_pdf(render_template('pdf/respiratoria_pdf.html', data=data_dict))

    @staticmethod
    def generate_fisioterapia_pdf(data_dict):
        return PdfService._create_pdf(render_template('pdf/fisioterapia_pdf.html', data=data_dict))