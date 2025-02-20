import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from instagram.cli import app

from typer.testing import CliRunner

runner = CliRunner()

def test_instagram_main():
    result = runner.invoke(app, [])
    assert result.exit_code == 0