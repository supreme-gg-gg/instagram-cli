"""
This is a simple test used for the current CI/CD pipeline just to make sure 
the main command runs without any errors on multiple versions of Python.
Actual tests would be added soon as the project scales.
"""

from instagram.cli import app
import sys
import os
from typer.testing import CliRunner

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

runner = CliRunner()

def test_instagram_main():
    """Test the main command"""
    result = runner.invoke(app, [])
    assert result.exit_code == 0