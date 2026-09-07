import http.server
import json
import pathlib
import subprocess
import tempfile
import threading
import unittest

class CheckTest(unittest.TestCase):
    def run_check(self, missing_asset=False, leak=False):
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                status, mime, body = 200, 'text/html', b'<div id="root"></div><script src="/assets/app.js"></script>'
                if self.path == '/assets/app.js':
                    mime, body = 'application/javascript', b'import("./page.js")'
                elif self.path == '/assets/page.js':
                    status, mime, body = (404 if missing_asset else 200), 'application/javascript', b'export {}'
                elif self.path.startswith('/api/'):
                    status, mime, body = (200 if leak else 403), 'application/json', b'{}'
                elif self.path.startswith('/actuator/'):
                    mime, body = 'application/json', b'{"status":"UP"}'
                self.send_response(status); self.send_header('Content-Type',mime); self.end_headers(); self.wfile.write(body)
        with http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler) as server, tempfile.TemporaryDirectory() as directory:
            thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
            routes=pathlib.Path(directory)/'routes.json';routes.write_text(json.dumps(['/','/library/all']))
            result=subprocess.run(['python3',str(pathlib.Path(__file__).with_name('check.py')),f'http://127.0.0.1:{server.server_port}','--routes',str(routes)],capture_output=True,text=True)
            server.shutdown();thread.join()
            return result
    def test_valid_release(self): self.assertEqual(self.run_check().returncode,0)
    def test_missing_lazy_chunk_blocks_release(self): self.assertNotEqual(self.run_check(missing_asset=True).returncode,0)
    def test_private_api_exposure_blocks_release(self): self.assertNotEqual(self.run_check(leak=True).returncode,0)

if __name__ == '__main__': unittest.main()
