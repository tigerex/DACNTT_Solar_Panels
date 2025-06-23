import os
# import base64
# import requests
# from io import BytesIO
# from PIL import Image

from dotenv import load_dotenv
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

# import math
from math import atan2, degrees

from pydantic import BaseModel

from shapely.geometry import Polygon, box
from shapely.ops import transform
from shapely.affinity import rotate, translate

from pyproj import Transformer

from typing import List

from . import panel_type


# Load biến môi trường
load_dotenv()
GG_API_KEY = os.getenv("GG_API_KEY")

# Khởi tạo router
router = APIRouter()


# ==== Input Models ====
class Coordinate(BaseModel):
    lat: float
    lng: float

class PolygonRequest(BaseModel):
    coordinates: list[Coordinate]
    polygon_id: int | None = None  # ID của polygon, có thể là None

# ==== Helper Functions ====
# Hàm chuyển polygon từ đơn vị lat/lng → mét
# Tại sao cần chuyển về mét?
# Vì diện tích tính bằng mét vuông, và các phép toán hình học trên polygon cần sử dụng hệ mét để chính xác hơn
def project_polygon_to_meters(shrunken):
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True)  # UTM zone 48N
    return transform(transformer.transform, shrunken)


# Hàm chuyển polygon từ đơn vị mét → lat/lng
# Tại sao cần chuyển về lat/lng?
# Vì frontend cần tọa độ lat/lng để hiển thị trên bản đồ, tính toán thì cần mét, nhưng trả về cho frontend thì cần lat/lng
def project_to_latlng(polygon_in_meters):
    transformer = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True)
    return transform(transformer.transform, polygon_in_meters)

# Tính diện tích mái nhà từ tọa độ polygon
def roof_area(coords):

    polygon_points = [(p.lng, p.lat) for p in coords] # Chuyển đổi sang (lng, lat) tuple

    if polygon_points[0] != polygon_points[-1]: # Đảm bảo polygon khép kín
        polygon_points.append(polygon_points[0]) 
    
    polygon = Polygon(polygon_points) # Tạo polygon từ tọa độ cung cấp bởi frontend
    polygon_meters = project_polygon_to_meters(polygon) # Chuyển đổi polygon sang mét để tính diện tích

    # Dòng code ở dưới là để chuẩn hóa hình dạng polygon, vì người dùng vẽ chắc chắn méo (đang nói tới case mái nhà hình chữ nhật)
    min_rect = polygon_meters.minimum_rotated_rectangle  # Tính hình chữ nhật bao ngoài nhỏ nhất của polygon để tính diện tích
    real_area = min_rect.area # Diện tích thực tế của mái nhà (để test chứ không gì)
    shrunken = min_rect.buffer(-0.3) # Shrink polygon để tránh các vấn đề về méo mó, buffer âm để thu nhỏ lại
    # Shrink tránh lắp panel dính ngay mép mái nhà, cơ mà tui vẫn cần coi lại đoạn này sau


    # Tính góc của mái nhà, dùng để xoay panel sau này
    # Lấy 2 điểm đầu tiên của polygon để tính góc
    # Giả sử mái nhà là hình chữ nhật, lấy 2 điểm đầu tiên để tính góc
    coords = list(min_rect.exterior.coords)
    x1, y1 = coords[0] # Lấy điểm đầu tiên
    x2, y2 = coords[1] # Lấy điểm thứ hai
    angle_rad = atan2(y2 - y1, x2 - x1) # Tính góc giữa 2 điểm theo radian
    angle_deg = degrees(angle_rad)  # Chuyển đổi góc sang độ

    print("\nAngle in degrees:", angle_deg)  # Debugging output
    print("\n")



    shrunken_latlng = project_to_latlng(shrunken) # Chuyển đổi lại sang lat/lng sau khi shrink để hiển thị lên frontend

    min_lng, min_lat, max_lng, max_lat = shrunken_latlng.bounds  # Lấy bounds của polygon đã được shrink
    center_lng = (min_lng + max_lng) / 2 # Tính tọa độ trung tâm của polygon đã được shrink
    center_lat = (min_lat + max_lat) / 2 # Tính tọa độ trung tâm của polygon đã được shrink


    # Tạo danh sách tọa độ lat/lng của polygon đã được shrink
    shrunken_coords = [
        {"lat": lat, "lng": lng}
        for lng, lat in shrunken_latlng.exterior.coords
    ]


    # And BOOM, có diện tích, ngoài ra còn cung cấp bounds để tính vị trí xếp panel trên mái
    print("\nPolygon valid:", shrunken.is_valid)
    print("Area m²:", shrunken.area)
    print("Bounds:", shrunken.bounds)
    print("real_area m²:", real_area)
    print("\n")

    return shrunken, shrunken_coords, center_lat, center_lng, angle_deg # shrunken là polygon đã đổi thành mét để shrink và tính diện tích. 
            # shrunken_coords là tọa độ polygon của mái nhà đã được shrink và chuyển đổi sang lat/lng lạilại để trả về cho frontend


#B4. Chọn panel có độ phủ tốt nhất dựa trên diện tích mái
# Ước lượng số lượng tấm pin mặt trời có thể lắp đặt dựa trên diện tích mái nhà
# Hàm này sẽ được gọi bởi hàm choose_best_panel_type
def estimate_panels(usableArea, panel_width, panel_height):
    count = usableArea // (panel_width * panel_height)
    return count

# Chọn loại tấm pin mặt trời tốt nhất dựa trên diện tích mái nhà
# Xét đến các chướng ngại vật trên mái, và vấn đề kỹ thuật thì chọn panel dựa trên 70-80% diện tích mái để chọn ra panel tối ưu nhất
# Best panel được chọn dựa trên độ phủ (coverage) 
# Cái này còn cần xem xét hiệu suất(?) nữa và tui chưa coi tới amen
def choose_best_panel_type(area):
    usableArea = area * 0.75  # Giả sử 75% diện tích có thể sử dụng
    best_panel = None
    max_coverage = 0

    for panel in panel_type.PANEL_TYPES: # panel_type.PANEL_TYPES là danh sách các loại panel được liệt kê trong file panel_type.py
        count = estimate_panels(usableArea, panel["width"], panel["height"]) # Ước lượng số lượng panel có thể lắp đặt dựa trên diện tích mái nhà
        coverage = count * panel["width"] * panel["height"] # Tính độ phủ của panel trên mái nhà
        # print("each panel", coverage)
        # print("each panel", count)

        # Xét xem panel nào coverage tốt nhất
        if coverage > max_coverage:
            max_coverage = coverage
            best_panel = {
                "panel": panel,
                "count": count,
                "coverage": coverage,
            }
            

    # print(best_panel)
    return best_panel # Return panel tốt nhất với độ phủ lớn nhất cho bước tính panel position (sắp xếp vị trí các panel) tiếp theo
 



# Tính vị trí các panel trên mái nhà
# Nói cách khác là lát gạch (nói cách khác là chia grid - chia từng khung vị trí cho các panel)
def generate_panel_grid(
    polygon_meters: Polygon, 
    panel_width: float,
    panel_height: float,
    angle_deg: float,
    gap_x: float = 0.2,
    gap_y: float = 0.2
) -> List[List[dict]]: # Trả về danh sách các panel đã được xoay và chuyển đổi sang lat/lng để hiển thị trên bản đồ


    # cách làm của hàm này sẽ là quay polygon về 0 độ, sau đó xếp panel theo lưới trục X/Y chuẩn, rồi xoay lại theo góc mái nhà
    # Vì sao không xoay panel ngay từ đầu mà phải chuyển polygon về 0 độ?
    # Vì xoay panel ngay từ đầu sẽ làm cho việc tính toán vị trí panel trở nên phức tạp hơn, 
    # và vì nó không cho kết quả tốt nên tui mới phải nghĩ ra cách này để thay thế 

    placed_panels = [] # Danh sách các panel đã được đặt lên mái nhà

    # 1. Gốc xoay là centroid của mái
    origin = polygon_meters.centroid

    # 2. Quay polygon về 0 độ
    rotated_polygon = rotate(polygon_meters, -angle_deg, origin=origin, use_radians=False)

    # 3. Lấy bounds của polygon đã xoay
    minx, miny, maxx, maxy = rotated_polygon.bounds


    # 4. Xếp panel theo lưới trục X/Y chuẩn
    test=[]

    # Tính kích thước vùng mái
    width = maxx - minx
    height = maxy - miny

    # Tính số panel có thể xếp theo trục X và Y
    num_x = int((width + gap_x) // (panel_width + gap_x))
    num_y = int((height + gap_y) // (panel_height + gap_y))

    # Tính khoảng dư để canh giữa
    used_width = num_x * panel_width + (num_x - 1) * gap_x
    used_height = num_y * panel_height + (num_y - 1) * gap_y

    offset_x = (width - used_width) / 2
    offset_y = (height - used_height) / 2

    start_x = minx + offset_x
    start_y = miny + offset_y

    # Xếp panel như cũ, nhưng bắt đầu từ offset (centered)
    y = start_y
    for _ in range(num_y):
        x = start_x
        row = []
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


    # 6. Convert kết quả sang lat/lng để hiển thị
    transformer = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True)
    panels_latlng = []
    for panel in placed_panels:
        transformed_coords = []
        for x, y in panel.exterior.coords:
            lon, lat = transformer.transform(x, y)
            transformed_coords.append({"lat": lat, "lng": lon})
        panels_latlng.append(transformed_coords)

    # for panel in placed_panels:
    #     transformed_coords = []
    #     for x, y in panel.exterior.coords:
    #         lon, lat = transformer.transform(x, y)
    #         transformed_coords.append({"lat": lat, "lng": lon})

    #     # 👉 Convert centroid to lat/lng before sending
    #     cx, cy = panel.centroid.coords[0]
    #     center_lng, center_lat = transformer.transform(cx, cy)

    #     panels_latlng.append({
    #         "coords": transformed_coords,
    #         "center": {"lat": center_lat, "lng": center_lng}
    #     })

        

    print("Generated panels:", len(panels_latlng))
    return panels_latlng # Trả về danh sách các panel đã được xoay và chuyển đổi sang lat/lng để hiển thị trên bản đồ


def find_best_orientation_limited(polygon_meters, panel_width, panel_height, angle_deg):
    candidates = [
        angle_deg,
        (angle_deg + 90) % 180
    ]
    
    best_angle = None
    best_panels = []
    max_count = 0

    for angle in candidates:
        panels = generate_panel_grid(
            polygon_meters, panel_width, panel_height, angle
        )
        if len(panels) > max_count:
            max_count = len(panels)
            best_angle = angle
            best_panels = panels
    print("\nBest angle:", best_angle, "with", max_count, "panels")
    print("\n")
    return best_angle, best_panels



# ==== API Endpoints ====
# Endpoint để nhận tọa độ polygon từ frontend và trả về vị trí panel
@router.post("/api/polygon")
# async def get_panel_map(polygon: PolygonRequest):
async def get_panel_map(polygon: PolygonRequest):
    body = polygon # Lấy tọa độ từ request body
    coords = body.coordinates # Lấy tọa độ từ request body, mặc định là mảng rỗng
    id = body.polygon_id # Lấy id của polygon từ request body, mặc định là None
    if len(coords) < 3: # Kiểm tra xem có đủ 4 tọa độ không
        return JSONResponse(content={"error": "Cần ít nhất 3 góc!!!"}, status_code=401)

    print("\nReceived polygon ID:", id)  # Debugging output
    print("Received coordinates:", coords)
    print("\n")
    
    # B1. Shrink polygon để tránh các vấn đề về méo mó và tính diện tích
    try:
        shrunken, shrunken_coords, center_lat, center_lng, angle_deg = roof_area(coords) # Tính diện tích mái nhà và chuyển đổi sang mét
    except Exception as e:
        print("Error processing polygon:", e)
    # B2. Chọn panel tốt nhất dựa trên diện tích mái nhà
    try:
        best_panel = choose_best_panel_type(shrunken.area) # Chọn panel tốt nhất dựa trên diện tích mái nhà
    except Exception as e:
        print("Error choosing best panel type:", e)

    print("count panel:", best_panel["count"])  # Debugging output

    try:
    # Tính vị trí các panel trên mái nhà
        best_angle, panels_latlng = find_best_orientation_limited(
            shrunken,
            best_panel["panel"]["width"],
            best_panel["panel"]["height"],
            angle_deg
        )
    except Exception as e:
        print("Error generating panel grid:", e)

    try:
        result = {
            "area_m2": shrunken.area,
            "shrunken_polygon": shrunken_coords,  # Tọa độ polygon đã được shrink và chuyển sang pixel
            "center_lat": center_lat,  # Tọa độ trung tâm của polygon đã được shrink
            "center_lng": center_lng,  # Tọa độ trung tâm của polygon đã được shrink
            "best_panel": {
                "model": best_panel["panel"]["model"],
                "panel_width": best_panel["panel"]["width"],
                "panel_height": best_panel["panel"]["height"],
                "panel_power": best_panel["panel"]["power"],
                "panel_price": best_panel["panel"]["price_vnd"],
                "panel_image": best_panel["panel"]["image"],
                "count": best_panel["count"],
                "coverage": best_panel["coverage"]
            },
            # "panels_latlng": panels_latlng,  # Vị trí các panel trên mái nhà
            "best_angle": best_angle,  # Góc xoay tốt nhất của panel
        }
    except Exception as e:
        print("Error preparing result:", e)

    print("\nResult:", result)  # Debugging output
    print("\n")
    return body

@router.get("/api/test")
async def test_endpoint():
    # Test endpoint để kiểm tra xem API có hoạt động không
    return {"message": "API is working!"}





