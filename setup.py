from setuptools import setup, find_packages

setup(
    name="instagram-cli",
    version="0.1.0",
    author="Jet Chiang, James Zheng",
    author_email="jetjiang.ez@gmail.com",
    description="Use Instagram from the command line",
    long_description=open("README.md", "r", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/supreme-gg-gg/instagram-cli",
    packages=find_packages(),
    install_requires=[
        "typer",
        "art",
        "instagrapi"
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Development Status :: 3 - Alpha",
    ],
    python_requires=">=3.7",
    entry_points={
        "console_scripts": [
            "instagram=instagram.cli:app"
        ]
    }
)