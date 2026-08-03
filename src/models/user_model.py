from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='profesional_aps')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, email, password, role='profesional_aps'):
        self.email = email
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256:260000')
        self.role = role

    def verify_password(self, password):
        """Valida la contraseña contra el hash almacenado."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serializa los datos seguros del usuario."""
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active
        }