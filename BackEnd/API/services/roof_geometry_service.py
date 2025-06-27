import os
import json
from dotenv import load_dotenv
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from shapely.geometry import Polygon
from shapely.ops import transform
from shapely.affinity import rotate
from pyproj import Transformer
from typing import List
from math import atan2, degrees
from . import panel_type

# ==== Load .env để lấy GG_API_KEY nếu cần (dù chưa dùng trong file này) ====
load_dotenv()
GG_API_KEY = os.getenv("GG_API_KEY")

# ==== Khởi tạo router FastAPI ====
router = APIRouter()

# ==== Định nghĩa input model để nhận polygon từ phía frontend ====
class Coordinate(BaseModel):
    lat: float
    lng: float

class PolygonRequest(BaseModel):
    coordinates: list[Coordinate]
    polygon_id: int | None = None
    panel_gap: float | None = None # Khoảng cách giữa các panel, mặc định là 0.2m

# ==== Hàm đảm bảo polygon khép kín ====
# def ensure_polygon_closed(coords):
#     if coords[0] != coords[-1]: # Kiểm tra nếu điểm đầu và cuối không giống nhau
#         # Xóa điểm cuối để tránh trùng lặp
#         coords.append(coords[0]) # Thêm điểm đầu vào cuối để khép kín polygon
#         print("Đã tự động đóng polygon bằng cách thêm điểm đầu vào cuối.")
#     return coords

# ==== Chuyển đổi toạ độ từ list sang shapely polygon ====
def to_shapely_polygon(coords: List[Coordinate]):
    points = [(p.lng, p.lat) for p in coords]
    # closed = ensure_polygon_closed(points)
    return Polygon(points)

# ==== Chuyển đổi từ hệ toạ độ lat/lng sang hệ mét (EPSG:4326 sang EPSG:32648) ====
def project_to_meters(polygon):
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True) # EPSG:32648 là UTM zone 48N 
    return transform(transformer.transform, polygon)

# ==== Chuyển đổi từ hệ toạ độ mét sang lat/lng (EPSG:32648 sang EPSG:4326) ====
def project_to_latlng(polygon_meters):
    transformer = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True)
    return transform(transformer.transform, polygon_meters)

# ==== Hàm shrink polygon để tạo hình chữ nhật xoay nhỏ nhất ====
def shrink_polygon(polygon, buffer_value=-0.5):
    return polygon.buffer(buffer_value)

# ==== Tính góc xoay của polygon dựa trên cạnh dài nhất ====
# def calculate_polygon_angle(polygon):
#     coords = list(polygon.exterior.coords)
#     x1, y1 = coords[0]
#     x2, y2 = coords[1]
#     angle_rad = atan2(y2 - y1, x2 - x1)
#     return degrees(angle_rad)

def calculate_polygon_angle(polygon: Polygon):
    coords = list(polygon.exterior.coords)[:-1]  # bỏ điểm đóng
    max_len = 0
    best_angle = 0

    for i in range(len(coords) - 1):
        x1, y1 = coords[i]
        x2, y2 = coords[i + 1]
        length = ((x2 - x1)**2 + (y2 - y1)**2)**0.5
        if length > max_len:
            max_len = length
            angle = degrees(atan2(y2 - y1, x2 - x1))
            best_angle = angle

    return best_angle


# ==== Hàm xử lý polygon để tính toán thông tin mái nhà ====
def process_roof_polygon(coords: List[Coordinate]):
    # B1: Tạo polygon từ toạ độ
    polygon = to_shapely_polygon(coords)  # chuyển list coord sang shapely Polygon
    if not polygon.is_valid or polygon.is_empty:
        raise ValueError("Polygon không hợp lệ!")

    # B2: Chuyển sang hệ toạ độ mét để tính diện tích
    polygon_meters = project_to_meters(polygon)

    # B3: Shrink polygon nhẹ để tránh mép
    shrunken = shrink_polygon(polygon_meters)  # shrink trực tiếp, không ép thành hình chữ nhật

    # B4: Tính góc xoay từ polygon gốc
    angle = calculate_polygon_angle(polygon_meters)  # sửa để tính từ polygon thực tế

    # B5: Convert lại về lat/lng để frontend hiển thị
    shrunken_latlng = project_to_latlng(shrunken)
    shrunken_coords = [{"lat": lat, "lng": lng} for lng, lat in shrunken_latlng.exterior.coords[:-1]]  # bỏ điểm trùng cuối

    # B6: Lấy center point
    bounds = shrunken_latlng.bounds
    center_lat = (bounds[1] + bounds[3]) / 2
    center_lng = (bounds[0] + bounds[2]) / 2

    return {
        "polygon_meters": shrunken,
        "shrunken_coords": shrunken_coords,
        "center_lat": center_lat,
        "center_lng": center_lng,
        "angle_deg": angle,
        "area": shrunken.area,
        "real_area": polygon_meters.area
    }


# ==== Hàm tính diện tích mái nhà từ polygon ====
def calculate_roof_area(polygon: Polygon):
    # Chuyển đổi toạ độ từ list sang shapely polygon
    polygon = to_shapely_polygon(polygon)
    # Chuyển đổi polygon sang hệ mét
    polygon_meters = project_to_meters(polygon)
    # Tính diện tích trong hệ mét
    area_meters = polygon_meters.area
    return area_meters

# ==== Panel lựa chọn và tính toán ====
def estimate_panels(usable_area, panel_width, panel_height):
    return usable_area // (panel_width * panel_height)

# Hàm chọn loại panel tốt nhất dựa trên diện tích mái nhà
def choose_best_panel_type(area):
    usable_area = area * 0.75
    best_panel = None
    max_coverage = 0

    for panel in panel_type.PANEL_TYPES:
        count = estimate_panels(usable_area, panel["width"], panel["height"])
        coverage = count * panel["width"] * panel["height"]
        if coverage > max_coverage:
            max_coverage = coverage
            best_panel = {
                "panel": panel,
                "count": count,
                "coverage": coverage,
            }
    return best_panel

# ==== Hàm tạo lớp panel ====
def generate_panel_grid(polygon_meters, panel_width, panel_height, angle_deg, gap_x=0.5, gap_y=0.5):
    placed_panels = []
    origin = polygon_meters.centroid
    rotated_polygon = rotate(polygon_meters, -angle_deg, origin=origin, use_radians=False)
    minx, miny, maxx, maxy = rotated_polygon.bounds

    width = maxx - minx
    height = maxy - miny
    num_x = int((width + gap_x) // (panel_width + gap_x))
    num_y = int((height + gap_y) // (panel_height + gap_y))

    used_width = num_x * panel_width + (num_x - 1) * gap_x
    used_height = num_y * panel_height + (num_y - 1) * gap_y
    offset_x = (width - used_width) / 2
    offset_y = (height - used_height) / 2
    start_x = minx + offset_x
    start_y = miny + offset_y

    y = start_y
    for _ in range(num_y):
        x = start_x
        for _ in range(num_x):
            panel = Polygon([
                (x, y),
                (x + panel_width, y),
                (x + panel_width, y + panel_height),
                (x, y + panel_height)
            ])
            if rotated_polygon.contains(panel):
                real_panel = rotate(panel, angle_deg, origin=origin, use_radians=False)
                placed_panels.append(real_panel)
            x += panel_width + gap_x
        y += panel_height + gap_y

    transformer = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True)
    panels_latlng = []
    for panel in placed_panels:
        transformed_coords = []
        for x, y in panel.exterior.coords:
            lon, lat = transformer.transform(x, y)
            transformed_coords.append({"lat": lat, "lng": lon})
        panels_latlng.append(transformed_coords)

    return panels_latlng

def find_best_orientation_limited(polygon_meters, panel_width, panel_height, angle_deg, panel_gap=0.5):
    candidates = [angle_deg, (angle_deg + 90) % 180]
    best_angle = None
    best_panels = []
    max_count = 0

    for angle in candidates:
        panels = generate_panel_grid(polygon_meters, panel_width, panel_height, angle, gap_x=panel_gap, gap_y=panel_gap)
        if len(panels) > max_count:
            max_count = len(panels)
            best_angle = angle
            best_panels = panels

    return best_angle, best_panels, max_count

# API chính: xử lý polygon và trả về thông tin
@router.post("/api/polygon")
async def get_panel_map(polygon: PolygonRequest):
    if len(polygon.coordinates) < 3:
        return JSONResponse(content={"error": "Cần ít nhất 3 góc!!!"}, status_code=401)

    try:
        roof_info = process_roof_polygon(polygon.coordinates)
    except Exception as e:
        return JSONResponse(content={"error": f"Lỗi khi xử lý polygon: {str(e)}"}, status_code=400)

    try:
        best_panel = choose_best_panel_type(roof_info["area"])
    except Exception as e:
        return JSONResponse(content={"error": f"Lỗi chọn panel: {str(e)}"}, status_code=400)

    try:
        best_angle, panels_latlng, best_count = find_best_orientation_limited(
            roof_info["polygon_meters"],
            best_panel["panel"]["width"],
            best_panel["panel"]["height"],
            roof_info["angle_deg"],
            panel_gap=polygon.panel_gap if hasattr(polygon, 'panel_gap') else 0.5
        )
    except Exception as e:
        return JSONResponse(content={"error": f"Lỗi sinh grid panel: {str(e)}"}, status_code=400)

    result = {
        "polygon_id": polygon.polygon_id if polygon.polygon_id is not None else None,
        "area_m2": roof_info["area"],
        "shrunken_polygon": roof_info["shrunken_coords"],
        "center_lat": roof_info["center_lat"],
        "center_lng": roof_info["center_lng"],
        "best_panel": {
            "model": best_panel["panel"]["model"],
            "panel_width": best_panel["panel"]["width"],
            "panel_height": best_panel["panel"]["height"],
            "panel_best_power": best_panel["panel"]["best_power"],
            "panel_normal_power": best_panel["panel"]["normal_power"],
            "panel_price": best_panel["panel"]["price_vnd"],
            "panel_image": best_panel["panel"]["image"],
            "count": best_count,
            "coverage": best_panel["coverage"]
        },
        "best_angle": best_angle,
        "panels_latlng": panels_latlng  # Nếu cần render lên bản đồ
    }
    # print(json.dumps(result, indent=2, ensure_ascii=False)) # Debug log

    return result

# Endpoint tính diện tích polygon
@router.post("/api/area")
async def calculate_area(polygon: PolygonRequest):
    print(f"Received polygon: {polygon.polygon_id}")
    if len(polygon.coordinates) < 3:
        return JSONResponse(content={"error": "Cần ít nhất 3 góc!!!"}, status_code=401)

    try:
        area = calculate_roof_area(polygon.coordinates)
        print(f"Calculated area: {area} m²")  # Debug log
        result = {
            "area_m2": area,
            "polygon_id": polygon.polygon_id if polygon.polygon_id is not None else None,
            "coordinates": [{"lat": p.lat, "lng": p.lng} for p in polygon.coordinates]
            }
        return result
    except Exception as e:
        return JSONResponse(content={"error": f"Lỗi khi tính diện tích: {str(e)}"}, status_code=400)

# Test endpoint
@router.get("/api/test")
async def test_endpoint():
    return {"message": "API is working!"}