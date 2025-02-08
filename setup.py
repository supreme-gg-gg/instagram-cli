from setuptools import setup, find_packages

setup(
    name="instagram-cli",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "typer",
        "instagrapi"
    ],
    entry_points={
        "console_scripts": [
            "instagram=instagram.cli:app"
        ]
    }
)