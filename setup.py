from setuptools import setup, find_packages

setup(
    name="instagram-cli",
    version="1.0.0",
    author="Jet Chiang, James Zheng",
    author_email="jetjiang.ez@gmail.com",
    description="CLI and TUI client for Instagram, chat without brainrot.",
    long_description=open("README.md", "r", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/supreme-gg-gg/instagram-cli",
    packages=find_packages(),
    install_requires=[
        "typer",
        "art",
        "pydantic",
        "instagrapi",
        "pyyaml"
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Development Status :: 3 - Alpha",
    ],
    python_requires=">=3.9",
    entry_points={
        "console_scripts": [
            "instagram=instagram.cli:app"
        ]
    }
)