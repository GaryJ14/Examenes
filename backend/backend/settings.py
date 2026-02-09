# ============================================
# backend/settings.py
# Seguridad basada en CIA (Confidencialidad, Integridad, Disponibilidad)
# ============================================
from datetime import timedelta
from pathlib import Path
from decouple import config
import os
from dotenv import load_dotenv
load_dotenv()


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "")
LLM_FALLBACK_MODELS = os.getenv("LLM_FALLBACK_MODELS", "")
OPENROUTER_REFERER = os.getenv("OPENROUTER_REFERER", "")
OPENROUTER_TITLE = os.getenv("OPENROUTER_TITLE", "")

# =========================================================
# 1) CONFIDENCIALIDAD
# =========================================================
# Secretos (solo desde .env en producción)
SECRET_KEY = config('SECRET_KEY')

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1',
    cast=lambda v: [s.strip() for s in v.split(',')]
)

FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')

# CORS (controla quién puede consumir tu API desde navegador)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=False, cast=bool)
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = [
    'accept','accept-encoding','authorization','content-type','dnt','origin',
    'user-agent','x-csrftoken','x-requested-with'
]


# CSRF (más útil si manejas cookies/sesiones)
CSRF_COOKIE_HTTPONLY = True
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=lambda v: [s.strip() for s in v.split(',')]
)

# Cookies de sesión
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_NAME = 'examen_sessionid'
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# =========================================================
# 2) INTEGRIDAD
# =========================================================
AUTH_USER_MODEL = 'usuarios.Usuario'

# Hashing requerido (bcrypt)
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.BCryptPasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.Argon2PasswordHasher',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# JWT (control de sesión + rotación)
SIMPLE_JWT = {
    "USER_ID_FIELD": "id_usuario",
    "USER_ID_CLAIM": "user_id",

    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),

    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,

    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'ISSUER': 'sistema-monitoreo-examenes',

    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
}

# Logging (base para SIEM: Wazuh puede leer archivos)
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}', 'style': '{'},
        'simple': {'format': '{levelname} {message}', 'style': '{'},
    },
    'handlers': {
        'console': {'level': 'INFO','class': 'logging.StreamHandler','formatter': 'simple'},
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'maxBytes': 1024 * 1024 * 15,
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'error.log',
            'maxBytes': 1024 * 1024 * 15,
            'backupCount': 10,
            'formatter': 'verbose',
        },
    },
    'root': {'handlers': ['console', 'file'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console', 'file', 'error_file'], 'level': 'INFO', 'propagate': False},
        'django.request': {'handlers': ['error_file'], 'level': 'ERROR', 'propagate': False},
    },
}

# =========================================================
# 3) DISPONIBILIDAD
# =========================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        'CONN_MAX_AGE': 600,
        'OPTIONS': {'connect_timeout': 10}
    }
}

# Throttling DRF (reduce abuso/fuerza bruta a endpoints)
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {'anon': '100/hour', 'user': '1000/hour'},
}

# Cache (opcional)
USE_REDIS_CACHE = config('USE_REDIS_CACHE', default=False, cast=bool)
if USE_REDIS_CACHE and not DEBUG:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': config('REDIS_URL', default='redis://127.0.0.1:6379/1'),
        }
    }
else:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
    
REPORTS_MODE = "internal"


# =========================================================
# 4) CONFIGURACIÓN BASE DE DJANGO (obligatoria)
# =========================================================
INSTALLED_APPS = [
    'django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions',
    'django.contrib.messages','django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_yasg',
    'oauth2_provider',


    'Aplicaciones.usuarios',
    'Aplicaciones.examenes',
    'Aplicaciones.analisis',
    'Aplicaciones.monitoreo',
    'Aplicaciones.reportes',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'
WSGI_APPLICATION = 'backend.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

LANGUAGE_CODE = 'es-ec'
TIME_ZONE = 'America/Guayaquil'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'config' / 'media'

# =========================================================
# 5) PRODUCCIÓN (HTTPS, HSTS)
# =========================================================
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Directorios
(BASE_DIR / 'logs').mkdir(exist_ok=True)
(BASE_DIR / 'config' / 'media').mkdir(parents=True, exist_ok=True)
