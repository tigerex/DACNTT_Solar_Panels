from fastapi import APIRouter, UploadFile, File
from controllers.module_controllers import calculate_roof_area, analyze_roof_shape
from services.image_analysis_service import detect_roof_shape

import shutil
import os

router = APIRouter()

# API route để kiểm tra kết nối
@router.get("/hello")
def hello():
    return {"message": "Hello from the API!"}

# API route để tính diện tích mái nhà
@router.get("/area")
def area(length: float, width: float):
    return calculate_roof_area(length, width)

# API route để phân tích hình dạng mái nhà
@router.get("/analyze-shape")
def analyze_shape(length: float, width: float, angle: float):
    return analyze_roof_shape(length, width, angle)

# API route để phân tích hình dạng mái nhà từ ảnh
@router.post("/analyze-image")
def analyze_image(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = detect_roof_shape(temp_path)
    os.remove(temp_path)  # Xoá file tạm

    return result
