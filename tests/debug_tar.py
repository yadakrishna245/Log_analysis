"""Debug tar.gz extraction."""
import tarfile
import os

tar_path = r'C:\Users\krishna\Downloads\collect_custpmorphvm101_20260720_090354.tar.gz'

print(f'File: {tar_path}')
print(f'Size: {os.path.getsize(tar_path) / (1024*1024):.1f} MB')

# Check if valid tar.gz
try:
    with tarfile.open(tar_path, 'r:gz') as tf:
        members = tf.getmembers()
        print(f'Members count: {len(members)}')
        total_size = sum(m.size for m in members if m.isfile())
        print(f'Total uncompressed size: {total_size / (1024*1024):.1f} MB')
        
        # Show first 20 files
        print('\nFirst 20 files:')
        for m in members[:20]:
            print(f'  {m.name} ({m.size} bytes)')
        
        # Check for symlinks
        symlinks = [m for m in members if m.issym() or m.islnk()]
        if symlinks:
            print(f'\nSymlinks found: {len(symlinks)}')
            for s in symlinks[:5]:
                print(f'  {s.name} -> {s.linkname}')
except Exception as e:
    print(f'ERROR: {e}')
