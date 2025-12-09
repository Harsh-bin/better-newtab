import os
import random
import shutil
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# --- NO LOG ---
SimpleHTTPRequestHandler.log_message = lambda *args: None
# ---------------------------------------------

# Configuration
# IMPORTANT: Make sure these paths are correct for your system delete or comment the unused

# Macos
#HTML_DIR = '/Users/yourname/path/to/html'
#MEDIA_DIR = '/Users/yourname/path/to/media'

# windows need full path including drive letter
#HTML_DIR = r'D:\path\to\html' 
#MEDIA_DIR = r'D:\path\to\media'

# Linux
HTML_DIR = '/home/init_harsh/scripts/tab/d-tab/'      # Where index.html lives
MEDIA_DIR = '/usr/share/backgrounds/img/'      # Where media are stored
PORT = 4000

class HybridHandler(SimpleHTTPRequestHandler):

    CUSTOM_MEDIA_TYPES = {
        # --- Supported Image Formats ---
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        # --- Supported Video Formats ---
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
    }

    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update(CUSTOM_MEDIA_TYPES)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HTML_DIR, **kwargs)
    
    def do_GET(self):
        if self.path == '/':
            self.send_response(302)
            self.send_header('Location', '/tab.html')
            self.end_headers()
        elif self.path.startswith('/random-media'):
            self.handle_random_media()
        else:
            super().do_GET()
    
    def handle_random_media(self):
        try:
            if not os.path.isdir(MEDIA_DIR):
                raise FileNotFoundError(f"Media directory not found at: {MEDIA_DIR}")
            
            supported_extensions = tuple(self.CUSTOM_MEDIA_TYPES.keys())
            media_files = [f for f in os.listdir(MEDIA_DIR) 
                           if f.lower().endswith(supported_extensions)]
            
            if not media_files:
                raise FileNotFoundError(f"No supported media files found in: {MEDIA_DIR}")
            
            chosen_media_path = os.path.join(MEDIA_DIR, random.choice(media_files))
            
            _, extension = os.path.splitext(chosen_media_path)
            content_type = self.extensions_map.get(extension.lower(), 'application/octet-stream')
            
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Access-Control-Allow-Origin', '*')
            
            file_size = os.path.getsize(chosen_media_path)
            self.send_header('Content-Length', str(file_size))
            self.end_headers()
            
            with open(chosen_media_path, 'rb') as f:
                shutil.copyfileobj(f, self.wfile)
                
        except FileNotFoundError as e:
            print(f"ERROR: {e}")
            self.send_error(404, str(e))
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            self.send_error(500, "Internal Server Error")

if __name__ == '__main__':
    if not os.path.isdir(HTML_DIR):
        print(f"CRITICAL ERROR: HTML directory not found at '{HTML_DIR}'.")
        exit(1)
    if not os.path.isdir(MEDIA_DIR):
        print(f"CRITICAL ERROR: Media directory not found at '{MEDIA_DIR}'.")
        exit(1)

    print(f"Serving HTML from: {HTML_DIR}")
    print(f"Using media from: {MEDIA_DIR}")
    print(f"Server started on http://localhost:{PORT}")
    
    with ThreadingHTTPServer(('localhost', PORT), HybridHandler) as httpd:
        httpd.serve_forever()