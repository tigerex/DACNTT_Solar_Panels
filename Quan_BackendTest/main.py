# main.py
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
import requests
import base64
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import os
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv



app = FastAPI() # Tạo một ứng dụng FastAPI

# CORS middelware để cho phép truy cập từ localhost:5173 (frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True, # Cho phép cookie
    allow_methods=["*"], # Cho phép tất cả các phương thức
    allow_headers=["*"], # Cho phép tất cả các header
)

load_dotenv() # Tải biến môi trường từ file .env (Token cho map)

# Replace with your actual Mapbox token
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", os.getenv("MAPBOX_TOKEN"))

# --- Utility functions ---

# Lấy hình ảnh bản đồ tĩnh từ Mapbox với tọa độ được gửi từ frontend
def get_static_map_image(lat: float, lng: float, zoom: int, size: int = 512):
    url = f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/{lng},{lat},{zoom}/{size}x{size}@2x?access_token={MAPBOX_TOKEN}"
    response = requests.get(url)
    if response.status_code != 200:
        return None
    return Image.open(BytesIO(response.content)) # Mở hình ảnh từ bytes để trả về cho frontend


# Fake detection function (for demo purposes)
# Hiện tại không xài
# def fake_detect_polygon(image: Image.Image):
#     # Convert PIL to OpenCV image
#     img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
#     h, w = img_cv.shape[:2]

#     # Fake binary mask: just a rectangle in center
#     mask = np.zeros((h, w), dtype=np.uint8)
#     cv2.rectangle(mask, (w//4, h//4), (3*w//4, 3*h//4), 255, -1)

#     # Find contour
#     contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
#     polygon = []
#     if contours:
#         cnt = contours[0]
#         for pt in cnt:
#             x, y = pt[0]
#             polygon.append([int(x), int(y)])

#     return mask, polygon




# --- API route ---
@app.get("/detect") # get với endpoint /detect
async def detect(lat: float = Query(...), lng: float = Query(...), zoom: int = 20): # Nhận lat, lng, zoom từ frontend
    image = get_static_map_image(lat, lng, zoom) # Gọi hàm lấy hình ảnh bản đồ tĩnh từ Mapbox

    if not image:
        return JSONResponse(status_code=400, content={"error": "Failed to fetch static map"})

    # Detect (fake demo)
    # mask, polygon = fake_detect_polygon(image)
    polygon = [] # để chơi cho vui thôi, xài được model đã


    # Convert image to base64
    buffered = BytesIO() # Tạo buffer để lưu hình ảnh
    image.save(buffered, format="PNG") # Lưu hình ảnh vào buffer
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8") # Chuyển đổi buffer thành base64

    # Các bước trên là để lấy hình ảnh từ Mapbox và chuyển đổi nó thành base64 để trả về cho frontend

    return {
        "image_base64": f"data:image/png;base64,{img_base64}",
        "polygon": polygon
    }


