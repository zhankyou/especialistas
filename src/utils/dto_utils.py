import json


class SmartDTO(dict):
    """
    Wrapper DTO de Alta Disponibilidad para Plantillas PDF y Motores de Renderizado.
    Garantiza acceso transparente por notacion de atributos (obj.atributo) y por llaves (obj['atributo']).
    Resuelve accesos a colecciones no inicializadas, selecciones multiples y metodos invocables.
    """
    def __init__(self, *args, **kwargs):
        super(SmartDTO, self).__init__(*args, **kwargs)
        for key, value in list(self.items()):
            self[key] = self._normalize_value(value)

    def _normalize_value(self, value):
        """
        Deserializa recursivamente cadenas JSON y convierte diccionarios anidados en SmartDTO.
        """
        if isinstance(value, str):
            clean_str = value.strip()
            if (clean_str.startswith('{') and clean_str.endswith('}')) or (clean_str.startswith('[') and clean_str.endswith(']')):
                try:
                    parsed = json.loads(clean_str)
                    return self._normalize_value(parsed)
                except Exception:
                    pass
            return value

        if isinstance(value, dict):
            return SmartDTO(value)

        if isinstance(value, list):
            return [self._normalize_value(item) for item in value]

        return value

    def __getattr__(self, item):
        if item.startswith('__') and item.endswith('__'):
            raise AttributeError(item)

        try:
            val = self[item]
            if val is None:
                return SmartDTO()
            return val
        except KeyError:
            return SmartDTO()

    def __setattr__(self, key, value):
        self[key] = self._normalize_value(value)

    def __getitem__(self, item):
        try:
            val = super(SmartDTO, self).__getitem__(item)
            if val is None:
                return SmartDTO()
            return val
        except KeyError:
            return SmartDTO()

    def __call__(self, *args, **kwargs):
        return SmartDTO()

    def __bool__(self):
        return len(self.keys()) > 0

    def __str__(self):
        if len(self.keys()) == 0:
            return ""
        return super(SmartDTO, self).__str__()

    def __repr__(self):
        if len(self.keys()) == 0:
            return ""
        return super(SmartDTO, self).__repr__()

    def __html__(self):
        return str(self)
