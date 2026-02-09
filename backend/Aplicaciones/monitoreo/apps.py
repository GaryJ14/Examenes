from django.apps import AppConfig


class MonitoreoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'Aplicaciones.monitoreo'

    def ready(self):
        """
        Se ejecuta UNA sola vez al arranque de Django.
        Carga el modelo MediaPipe en memoria para que
        no se repita la carga en cada petición.
        """
        try:
            from .detection_service import _init_model
            _init_model()
        except Exception as e:
            # No rompe el arranque si mediapipe no está instalado.
            # El endpoint /analizar-frame/ retornará 500 al llamarse.
            import logging
            logging.getLogger("django").warning(
                "[MonitoreoConfig] Modelo facial no se cargó: %s", str(e)
            )