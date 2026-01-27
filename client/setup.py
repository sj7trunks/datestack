from setuptools import setup, find_packages

setup(
    name="datestack",
    version="1.0.0",
    description="DateStack calendar sync client for macOS",
    author="Benjamin Coles",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "requests>=2.28.0",
        "pyyaml>=6.0",
        "python-dateutil>=2.8.0",
    ],
    entry_points={
        "console_scripts": [
            "datestack=datestack.cli:cli",
        ],
    },
    python_requires=">=3.8",
)
