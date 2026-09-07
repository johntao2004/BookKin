import os
import pathlib
import subprocess
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class BackupTest(unittest.TestCase):
    def run_backup(self, directory):
        library = directory / "library"
        fonts = directory / "fonts"
        (library / "books").mkdir(parents=True)
        (library / ".bookkin-assets" / "covers").mkdir(parents=True)
        (library / ".bookkin-trash").mkdir(parents=True)
        (library / ".bookkin-cache").mkdir(parents=True)
        fonts.mkdir()
        (library / "books" / "sample.epub").write_text("book", encoding="utf-8")
        (library / ".bookkin-assets" / "covers" / "sample.jpg").write_text("cover", encoding="utf-8")
        (library / ".bookkin-trash" / "removed.epub").write_text("trash", encoding="utf-8")
        (library / ".bookkin-cache" / "derived.jpg").write_text("cache", encoding="utf-8")
        (fonts / "sample.woff2").write_text("font", encoding="utf-8")

        fake_bin = directory / "bin"
        fake_bin.mkdir()
        docker = fake_bin / "docker"
        docker.write_text("#!/bin/sh\nprintf 'fake database dump\\n'\n", encoding="utf-8")
        docker.chmod(0o755)

        env = os.environ | {
            "PATH": f"{fake_bin}:{os.environ['PATH']}",
            "BOOKKIN_BACKUP_DIR": str(directory / "backups"),
            "BOOKKIN_LIBRARY_BACKUP_ROOTS": str(library),
            "BOOKKIN_FONT_BACKUP_ROOT": str(fonts),
        }
        result = subprocess.run([str(ROOT / "ops/backup.sh")], cwd=ROOT, env=env, capture_output=True, text=True, check=True)
        backup = pathlib.Path(result.stdout.strip().split("Backup written to ", 1)[1])
        return backup, env, library, fonts

    def test_backup_contains_recoverable_files_and_excludes_cache(self):
        with tempfile.TemporaryDirectory() as temporary:
            backup, env, _, _ = self.run_backup(pathlib.Path(temporary))
            entries = subprocess.check_output(["tar", "-tzf", str(backup / "recoverable-root-0.tar.gz")], text=True)
            self.assertIn("books/sample.epub", entries)
            self.assertIn(".bookkin-assets/covers/sample.jpg", entries)
            self.assertIn(".bookkin-trash/removed.epub", entries)
            self.assertNotIn(".bookkin-cache/derived.jpg", entries)
            self.assertTrue((backup / "fonts.tar.gz").is_file())
            self.assertEqual(
                subprocess.run([str(ROOT / "ops/restore.sh"), "--dry-run", str(backup)], cwd=ROOT, env=env, check=False).returncode,
                0,
            )

    def test_backup_fails_when_font_mount_is_missing(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            library = directory / "library"
            library.mkdir()
            env = os.environ | {
                "BOOKKIN_BACKUP_DIR": str(directory / "backups"),
                "BOOKKIN_LIBRARY_BACKUP_ROOTS": str(library),
                "BOOKKIN_FONT_BACKUP_ROOT": str(directory / "missing-fonts"),
            }
            result = subprocess.run([str(ROOT / "ops/backup.sh")], cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Directory does not exist", result.stderr)


if __name__ == "__main__":
    unittest.main()
