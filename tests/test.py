import subprocess

def test_instgram():
    """Test if 'instagram' command runs successfully"""
    result = subprocess.run(
        ['instagram'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    assert result.returncode == 0, f"Command failed: {result.stderr.decode()}"