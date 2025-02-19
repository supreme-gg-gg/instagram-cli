import subprocess
import sys
from purest import TestCase, run

class TestInstgramCLI(TestCase):
    def test_instgram(self):
        """Test if 'instagram' command runs successfully"""
        result = subprocess.run(
            ['instagram'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        self.assertEqual(result.returncode, 0, f"Command failed: {result.stderr.decode()}")

if __name__ == '__main__':
    run()