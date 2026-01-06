import os
import re
import json

# Configuration
PROJECT_ROOT = r'c:\Users\willi\Desktop\CHS_talk\hoverhedgy_web_01\HOVERHEDGY_DEPLOY'
IMAGE_DIR_REL = r'assets\image'
SCRIPT_FILE = os.path.join(PROJECT_ROOT, 'script.js')
IMAGE_DIR_ABS = os.path.join(PROJECT_ROOT, IMAGE_DIR_REL)

# Supported Extensions
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}

def update_gallery():
    print(f"Scanning directory: {IMAGE_DIR_ABS}")
    
    if not os.path.exists(IMAGE_DIR_ABS):
        print("Error: Image directory not found!")
        return

    # 1. Get List of Files
    files = []
    for f in sorted(os.listdir(IMAGE_DIR_ABS)):
        ext = os.path.splitext(f)[1].lower()
        if ext in EXTENSIONS:
            # Create forward-slash path for web
            web_path = f"assets/image/{f}"
            files.append(web_path)
    
    print(f"Found {len(files)} images: {files}")

    # 2. Read script.js
    with open(SCRIPT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # 3. Prepare JS Array String
    # Format: ['path1', 'path2', ...]
    js_array_str = "    const images = [\n"
    for i, path in enumerate(files):
        comma = "," if i < len(files) - 1 else ""
        js_array_str += f"        '{path}'{comma}\n"
    js_array_str += "    ];"

    # 4. Regex Replace
    # Look for: const images = [ ... ];
    # We use [\s\S]*? to match across newlines non-greedily
    pattern = r"const images\s*=\s*\[[\s\S]*?\];"
    
    new_content = re.sub(pattern, js_array_str, content)

    # 5. Write Back
    if new_content != content:
        with open(SCRIPT_FILE, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("✅ script.js has been successfully updated with the new image list.")
    else:
        print("No changes needed.")

if __name__ == "__main__":
    update_gallery()
