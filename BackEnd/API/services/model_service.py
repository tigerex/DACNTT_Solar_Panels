from fastapi import FastAPI, UploadFile, File, APIRouter, Form
from fastapi.responses import JSONResponse

import torch
import segmentation_models_pytorch as smp
import albumentations as A
import cv2
import json

from PIL import Image
import time
import math
from tqdm import tqdm
import numpy as np

import io
import base64

# Khởi tạo router
router = APIRouter()
titles = ""

# Kiểm tra phiên bản PyTorch và CUDA
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Hàm để tải mô hình từ file
def load_model(model_arch, path, encoder):
    model = smp.create_model(model_arch, encoder_name=encoder, classes=1, activation=None)
    model.load_state_dict(torch.load(path, map_location=device), strict=False)
    model.to(device)
    model.eval()
    return model

# Tải mô hình
try:
    model = load_model(model_arch='unet',path=r'../Model/Unet_ResNet34_atEpoch8.pth',encoder='resnet34')
    print("\n========= Model loaded successfully =========")
    print(f"Architecture: {model.__class__.__name__}") # Nên là "Unet"
    print(f"Device: {device} - ",torch.cuda.get_device_name(0)) # Nên là "cuda" nếu có NVIDIA GPU, "cpu" nếu không
    print("=============================================\n") # Nên là "resnet34"
except Exception as e:
    print(f"Error loading model: {e}")

# Các hàm chuyển đổi tọa độ Google Maps sang tọa độ thế giới và ngược lại
TILE_SIZE = 256

def latlng_to_world(lat, lng):
    siny = math.sin(lat * math.pi / 180)
    siny = min(max(siny, -0.9999), 0.9999)
    x = TILE_SIZE * (0.5 + lng / 360)
    y = TILE_SIZE * (0.5 - math.log((1 + siny) / (1 - siny)) / (4 * math.pi))
    return x, y

def world_to_latlng(x, y):
    lng = (x / TILE_SIZE - 0.5) * 360
    lat_rad = 2 * math.atan(math.exp((0.5 - y / TILE_SIZE) * 2 * math.pi)) - math.pi / 2
    lat = lat_rad * 180 / math.pi
    return lat, lng

def pixel_to_latlng(px, py, zoom, scale, center_lat, center_lng, image_width, image_height):
    center_world_x, center_world_y = latlng_to_world(center_lat, center_lng)
    scale_factor = (TILE_SIZE * scale) / TILE_SIZE
    dx = px - image_width / 2
    dy = py - image_height / 2
    x = center_world_x + dx / scale_factor
    y = center_world_y + dy / scale_factor
    return world_to_latlng(x, y)

# # Hàm tiền xử lý ảnh
# def preprocess_image(image_path, img_width, img_height):
#     image = Image.open(image_path).convert("RGB")
#     image = image.resize((img_width, img_height))
#     image = np.array(image) / 255.0

#     # Sử dụng mean và std của ImageNet để chuẩn hóa
#     mean = np.array([0.485, 0.456, 0.406])
#     std  = np.array([0.229, 0.224, 0.225])
#     image = (image - mean) / std

#     image = torch.tensor(image).permute(2, 0, 1).unsqueeze(0).float().to(device)
#     return image

# # Dự đoán trên một ảnh đơn, hiện tại không sử dụng
# def predict(model, image_tensor):
#     with torch.no_grad():
#         output = model(image_tensor)
#         output = torch.sigmoid(output)  # only once
#         print("Output stats:", output.min().item(), output.max().item())
#         mask = output.squeeze().cpu().numpy()
#     return (mask > 0.5).astype(np.uint8)

# Hàm dự đoán trên ảnh lớn bằng cách chia thành các ô nhỏ
def predict_large_image(model, image, tile_size=512, overlap=256, threshold=0.5):
    original_width, original_height = image.size

    stride = tile_size - overlap
    padded_width = math.ceil((original_width - overlap) / stride) * stride + overlap
    padded_height = math.ceil((original_height - overlap) / stride) * stride + overlap

    # pad_right = padded_width - original_width
    # pad_bottom = padded_height - original_height

    padded_image = Image.new("RGB", (padded_width, padded_height))
    padded_image.paste(image, (0, 0))

    image_np = np.array(padded_image) / 255.0
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    image_np = (image_np - mean) / std

    full_mask = np.zeros((padded_height, padded_width), dtype=np.float32)
    weight_map = np.zeros_like(full_mask)

    for y in range(0, padded_height - tile_size + 1, stride):
        for x in range(0, padded_width - tile_size + 1, stride):
            tile = image_np[y:y+tile_size, x:x+tile_size, :]
            tile_tensor = torch.tensor(tile).permute(2, 0, 1).unsqueeze(0).float().to(device)

            with torch.no_grad():
                output = model(tile_tensor)
                output = torch.sigmoid(output).squeeze().cpu().numpy()

            full_mask[y:y+tile_size, x:x+tile_size] += output
            weight_map[y:y+tile_size, x:x+tile_size] += 1.0

    weight_map[weight_map == 0] = 1
    averaged_mask = full_mask / weight_map
    final_mask = averaged_mask[:original_height, :original_width]
    return (final_mask > threshold).astype(np.uint8) * 255

# Hàm để trích xuất polygon từ mask
def extract_polygons_from_mask(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygons = []
    for contour in contours:
        if cv2.contourArea(contour) > 300:
            polygon = contour.squeeze().tolist()
            if isinstance(polygon[0], list):  # multiple points
                polygons.append(polygon)
    return polygons

# Endpoint để dự đoán ảnh
@router.post("/predict")
async def predict_endpoint(file: UploadFile = File(...), center: str= Form(...), zoom: int = Form(...), size: str = Form(...), scale : int = Form(1)):
    try:
        center_data = json.loads(center)
        center_lat = center_data.get("lat")
        center_lng = center_data.get("lng")
        if center_lat is None or center_lng is None:
            return JSONResponse(status_code=400, content={"error": "Invalid center coordinates"})
        width, height = map(int, size.split('x'))
        if width <= 0 or height <= 0:
            return JSONResponse(status_code=400, content={"error": "Invalid size dimensions"})
        
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        start_time = time.time()
        mask = predict_large_image(model, image)
        end_time = time.time()

        polygons_px = extract_polygons_from_mask(mask)

        # Convert mask to base64
        mask_img = Image.fromarray(mask)
        buf = io.BytesIO()
        mask_img.save(buf, format="PNG")
        mask_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        # Convert polygons to lat/lng
        polygons_geo = []
        for polygon in polygons_px:
            geo_polygon = [
                pixel_to_latlng(x, y, zoom, scale, center_lat, center_lng, width, height)
                for x, y in polygon
            ]
            polygons_geo.append(geo_polygon)

        return JSONResponse(content={
            "mask_base64": mask_base64,
            "polygons": polygons_geo,
            "time_taken": f"{end_time - start_time:.2f} seconds"
        })

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})