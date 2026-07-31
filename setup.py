"""
LogSherlock Pro - Package Setup
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README for long description
this_directory = Path(__file__).parent
long_description = ""
readme_path = this_directory / "README.md"
if readme_path.exists():
    long_description = readme_path.read_text(encoding="utf-8")

# Read requirements
requirements = []
req_path = this_directory / "requirements.txt"
if req_path.exists():
    requirements = [
        line.strip()
        for line in req_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith('#')
    ]

setup(
    name="logsherlock-pro",
    version="1.0.0",
    author="HPE Support Engineering",
    author_email="logsherlock@hpe.com",
    description="Enterprise log analysis platform for HPE support ticket investigation",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.hpe.com/support-tools/logsherlock-pro",
    packages=find_packages(exclude=["tests", "tests.*"]),
    python_requires=">=3.10",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest==8.2.2",
            "pytest-flask==1.3.0",
            "pytest-cov==5.0.0",
            "factory-boy==3.3.0",
            "black==24.4.2",
            "flake8==7.1.0",
            "mypy==1.10.1",
        ],
        "production": [
            "gunicorn==22.0.0",
            "waitress==3.0.0",
            "sentry-sdk[flask]==2.7.1",
        ],
    },
    entry_points={
        "console_scripts": [
            "logsherlock=app:app",
        ],
    },
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Framework :: Flask",
        "Intended Audience :: System Administrators",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: System :: Logging",
        "Topic :: System :: Systems Administration",
    ],
    keywords="log analysis, support tickets, pattern matching, HPE",
)
