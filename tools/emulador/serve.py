import http.server, socketserver, sys, os, threading
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
def run(port, d):
    h = lambda *a, **k: H(*a, directory=d, **k)
    socketserver.TCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer(('', port), h).serve_forever()
base = sys.argv[1]
threading.Thread(target=run, args=(8001, os.path.join(base, 'host')), daemon=True).start()
run(8002, os.path.join(base, '.ext'))
