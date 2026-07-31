"""Application configuration for LogSherlock Pro."""

import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Main application configuration."""

    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'logsherlock-pro-secret-key-change-in-production')
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
