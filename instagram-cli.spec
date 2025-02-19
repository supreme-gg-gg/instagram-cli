# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['instagram/cli.py'],
    pathex=['.'],
    binaries=[],
    datas=[('README.md', 'README.md')],
    hiddenimports=[
        'instagrapi',
        'typer',
        'pydantic',
        'art',
        'pyyaml',
        'pillow',
        'emoji',
        'requests'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='instagram-cli',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='resource/icon.ico'
)
