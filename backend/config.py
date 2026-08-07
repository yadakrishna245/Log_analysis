"""Application configuration for LogSherlock Pro."""

import os
import secrets

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


def _get_secret_key():
    """Get or generate a secret key. Checks env var first, then .secret_key file."""
    env_key = os.environ.get('SECRET_KEY')
    if env_key:
        return env_key
    # Use /tmp on Lambda (read-only /var/task), otherwise use BASE_DIR
    if os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
        secret_key_file = '/tmp/.secret_key'
    else:
        secret_key_file = os.path.join(BASE_DIR, '.secret_key')
    if os.path.exists(secret_key_file):
        with open(secret_key_file, 'r') as f:
            key = f.read().strip()
            if key:
                return key
    # Generate and persist a new key
    key = secrets.token_hex(32)
    try:
        with open(secret_key_file, 'w') as f:
            f.write(key)
    except OSError:
        pass  # If we can't write, just use the generated key in-memory
    return key


class Config:
    """Main application configuration."""

    # Flask
    SECRET_KEY = _get_secret_key()
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() in ('true', '1', 'yes')

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "logsherlock.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

    # File Upload
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
    MAX_CONTENT_LENGTH = 4 * 1024 * 1024 * 1024  # 4GB max file size
    ALLOWED_EXTENSIONS = {'7z', 'zip', 'tar', 'gz', 'log', 'txt', 'conf', 'cfg'}

    # Log directory for application logs
    LOG_DIR = os.environ.get('LOG_DIR', os.path.join(BASE_DIR, 'logs'))

    # Analysis settings
    CONTEXT_LINES_BEFORE = 3
    CONTEXT_LINES_AFTER = 3
    MAX_FINDINGS_PER_FILE = 500
    MAX_LINE_LENGTH = 4096

    # Pagination
    DEFAULT_PAGE_SIZE = 25
    MAX_PAGE_SIZE = 100

    # Rate limiting
    RATELIMIT_DEFAULT = '100/hour'
    RATELIMIT_STORAGE_URI = 'memory://'
    
    # API Key (set via environment variable)
    API_KEY = os.environ.get('LOGSHERLOCK_API_KEY', '')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': Config,
}
