import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from instagram import get_app

from typer.testing import CliRunner

runner = CliRunner()

app = get_app()

def test_instagram_main():
    result = runner.invoke(app, [])
    assert result.exit_code == 0