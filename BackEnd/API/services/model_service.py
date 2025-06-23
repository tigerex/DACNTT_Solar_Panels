from fastapi import FastAPI, UploadFile, File, APIRouter
from fastapi.responses import JSONResponse

import torch
import segmentation_models_pytorch as smp
import albumentations as A


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

# Endpoint để dự đoán ảnh
@router.post("/predict/")
async def predict_endpoint(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        start_time = time.time()
        mask = predict_large_image(model, image)
        end_time = time.time()

        # Convert mask to base64
        mask_img = Image.fromarray(mask)
        buf = io.BytesIO()
        mask_img.save(buf, format="PNG")
        mask_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return JSONResponse(content={
            "mask_base64": mask_base64,
            "time_taken": f"{end_time - start_time:.2f} seconds"
        })

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})