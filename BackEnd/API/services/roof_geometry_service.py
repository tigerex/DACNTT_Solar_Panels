import os
import math
import base64
import requests
from io import BytesIO
from PIL import Image
from pyproj import Transformer
from dotenv import load_dotenv
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Load biến môi trường
load_dotenv()
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN")
API_KEY_ARCGIS = os.getenv("API_KEY_ARCGIS")

router = APIRouter()

class Coordinate(BaseModel):
    lat: float
    lng: float

class PolygonRequest(BaseModel):
    coordinates: list[Coordinate]

def convert_coords_to_meters(coords):
    # Chuyển đổi (lng, lat) sang mét, ví dụ dùng pyproj hoặc công thức gần đúng
    # Giả sử tọa độ đầu vào WGS84 EPSG:4326
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    return [transformer.transform(lng, lat) for lng, lat in coords]

def calculate_shape_and_area(coords_meter):
    # Shoelace
    x = [p[0] for p in coords_meter]
    y = [p[1] for p in coords_meter]
    area = 0.5 * abs(sum(x[i]*y[(i+1)%4] - x[(i+1)%4]*y[i] for i in range(4))) 

    # Tính các góc của tứ giác
    angles = []
    for i in range(4):
        a = coords_meter[i - 1]
        b = coords_meter[i]
        c = coords_meter[(i + 1) % 4]
        angle = calculate_angle(a, b, c)
        angles.append(angle)

    avg_angle = sum(angles) / len(angles)
    is_rectangle = all(88 <= angle <= 92 for angle in angles)

    shape = "rectangle" if is_rectangle else "parallelogram"

    return {
        "shape": shape,
        "area_m2": area,
        "angles": angles,
    }

def calculate_angle(a, b, c):
    ab = (a[0] - b[0], a[1] - b[1])
    cb = (c[0] - b[0], c[1] - b[1])
    dot = ab[0]*cb[0] + ab[1]*cb[1]
    mag_ab = math.hypot(*ab)
    mag_cb = math.hypot(*cb)
    cosine = dot / (mag_ab * mag_cb)
    angle = math.degrees(math.acos(cosine))
    return angle

@router.get("/detect")
async def detect(lat: float = Query(...), lng: float = Query(...), zoom: int = 20):
    url = f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/{lng},{lat},{zoom}/512x512@2x?access_token={MAPBOX_TOKEN}"
    response = requests.get(url)
    if response.status_code != 200:
        return JSONResponse(status_code=400, content={"error": "Failed to fetch static map"})
    image = Image.open(BytesIO(response.content))
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return {
        "image_base64": f"data:image/png;base64,{img_base64}",
        "polygon": []
    }

@router.post("/api/polygon")
async def get_static_map(polygon: PolygonRequest):
    coords = polygon.coordinates
    if len(coords) != 4:
        return JSONResponse(content={"error": "Need 4 coordinates for a quadrilateral"}, status_code=400)

    # Chuyển đổi sang mét để tính diện tích và góc
    coords_meter = convert_coords_to_meters([(c.lng, c.lat) for c in coords])

    # Tính diện tích và loại hình
    result = calculate_shape_and_area(coords_meter)

    # Trả thêm hình ảnh từ ArcGIS (tuỳ chọn)
    transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    converted = [transformer.transform(c.lng, c.lat) for c in coords]
    lngs, lats = zip(*converted)
    avg_lng = sum(lngs) / len(lngs)
    avg_lat = sum(lats) / len(lats)
    width = max(lngs) - min(lngs)
    height = max(lats) - min(lats)
    zoom = 17 if width > 0.005 or height > 0.005 else 18 if width > 0.002 else 20

    url = (
        "https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/beta/generate-map"
        f"/arcgis/imagery/centered-at?lon={avg_lng}&lat={avg_lat}&zoomLevel={zoom}"
        f"&mapImageWidth=512&mapImageHeight=512&token={API_KEY_ARCGIS}"
    )
    response = requests.get(url)
    if response.status_code == 200:
        image_base64 = base64.b64encode(response.content).decode("utf-8")
        result["image"] = image_base64

    return result

