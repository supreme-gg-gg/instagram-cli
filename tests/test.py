import sys
import os

# Add the project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from instagram import app  # Now this import should work

from typer.testing import CliRunner

runner = CliRunner()

def test_instagram_main():
    result = runner.invoke(app, [])
    assert result.exit_code == 0