from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

# Inicialización central del Componente ORM
db = SQLAlchemy()

# =====================================================================
# ARQUITECTURA CROSS-DATABASE (Compatibility Hook)
# =====================================================================
# Al utilizar SQLite en entornos locales o de desarrollo, SQLiteTypeCompiler
# colapsa al encontrar la declaración JSONB (exclusiva de PostgreSQL).
# Este decorador intercepta el Árbol de Sintaxis Abstracta (AST) de SQLAlchemy
# y fuerza la traducción de JSONB a JSON estándar únicamente para el dialecto SQLite.
# En producción (PostgreSQL), este hook es ignorado, preservando el rendimiento binario.

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    """
    Traduce el tipo de columna JSONB a JSON nativo de SQLite1
    durante la fase de emisión de sentencias DDL (CREATE TABLE).
    """
    return "JSON"