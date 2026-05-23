import os
import sys

# Ensure backend directory is in path
api_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(api_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from seed import run_seeder

if __name__ == "__main__":
    run_seeder()
