import os
import math
import base64
import requests
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import math
from pydantic import BaseModel
from shapely.geometry import Polygon, box
from shapely.ops import transform
from pyproj import Transformer

from . import panel_type

# Load biến môi trường
load_dotenv()
GG_API_KEY = os.getenv("GG_API_KEY")

router = APIRouter()


# ==== Input Models ====
class Coordinate(BaseModel):
    lat: float
    lng: float

class PolygonRequest(BaseModel):
    coordinates: list[Coordinate]

# ==== Helper Functions ====

# B1. Shrink polygon (vẫn dùng lat/lng)
def shrink_polygon(coords, margin=0.00001):  # shrink nhỏ hơn vì lat/lng rất nhỏ
    polygon_points = [(p.lng, p.lat) for p in coords]

    if polygon_points[0] != polygon_points[-1]:
        polygon_points.append(polygon_points[0])

    poly = Polygon(polygon_points)
    shrunken = poly.buffer(-margin)
    return shrunken

# B2. Project polygon từ lat/lng → mét
def project_polygon_to_meters(polygon):
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True)  # UTM zone 48N
    return transform(transformer.transform, polygon)

# B3. Tính diện tích và tạo panel
def roof_area(coords):
    # Shrink polygon theo lat/lng
    poly_wgs84 = shrink_polygon(coords)

    # Project sang hệ mét
    poly_meters = project_polygon_to_meters(poly_wgs84)

    print("Polygon valid:", poly_meters.is_valid)
    print("Area m²:", poly_meters.area)
    print("Bounds:", poly_meters.bounds)

    return poly_meters


#B4. Chọn panel có độ phủ tốt nhất dựa trên diện tích mái
# Ước lượng số lượng tấm pin mặt trời có thể lắp đặt dựa trên diện tích mái nhà
def estimate_panels(usableArea, panel_width, panel_height):
    count = usableArea // (panel_width * panel_height)
    return count

# Chọn loại tấm pin mặt trời tốt nhất dựa trên diện tích mái nhà
# Xét đến các chướng ngại vật trên mái, và vấn đề kỹ thuật thì chọn panel dựa trên 70-80% diện tích mái để chọn ra panel tối ưu nhất
def choose_best_panel_type(area):
    usableArea = area * 0.75  # Giả sử 75% diện tích có thể sử dụng
    best_panel = None
    max_coverage = 0

    for panel in panel_type.PANEL_TYPES:
        count = estimate_panels(usableArea, panel["width"], panel["height"])
        coverage = count * panel["width"] * panel["height"]
        # print("each panel", coverage)
        # print("each panel", count)

        if coverage > max_coverage:
            max_coverage = coverage
            best_panel = {
                "panel": panel["model"],
                "count": count,
                "coverage": coverage,
                "panel_width": panel["width"],
                "panel_height": panel["height"],
                "panel_power": panel["power"],
                "panel_price": panel["price_vnd"],
                "panel_image": panel["image"]
            }
            

    # print(best_panel)
    return best_panel


#B5. Tính panel position
def generate_panel_positions(coords, gap=0.1):
    poly_meters = roof_area(coords)
    best_panel = choose_best_panel_type(poly_meters.area)

    panel_w = best_panel["panel_width"]
    panel_h = best_panel["panel_height"]
    print("generate_panel_positions")
    print("PanelW", panel_w)
    print("PanelH", panel_h)

    print(poly_meters.is_valid)
    print("Area m²:", poly_meters.area)
    print("Bounds:", poly_meters.bounds)

    bounds = poly_meters.bounds  # (minx, miny, maxx, maxy)
    minx, miny, maxx, maxy = bounds # Vùng mái sau khi được shrink và chuyển từ tọa độ sang mét

    step_x = panel_w + gap
    step_y = panel_h + gap

    placed_panels = []

    y = miny
    while y + panel_h <= maxy:
        x = minx
        while x + panel_w <= maxx:
            panel = box(x, y, x + panel_w, y + panel_h)
            if poly_meters.contains(panel):
                placed_panels.append(panel)
            x += step_x
        y += step_y

    result = {
        "area_m2": poly_meters.area,
        "usable_area_m2": poly_meters.area * 0.75,  # Giả sử 75% diện tích có thể sử dụng
        "bounds": bounds,
        "panel": best_panel["panel"],
        "count": best_panel["count"],
        "coverage": best_panel["coverage"],
        "panel_width": best_panel["panel_width"],
        "panel_height": best_panel["panel_height"],
        "panel_power": best_panel["panel_power"],
        "panel_price": best_panel["panel_price"],
        "panel_image": best_panel["panel_image"],
        "placed_panels": placed_panels
    }
    return result


import math

def calculate_polygon_angle(coords):
    polygon = roof_area(coords)
    # Lấy 2 điểm đầu tiên (x1, y1), (x2, y2)
    coords = list(polygon.exterior.coords)
    max_len = 0
    best_angle = 0

    for i in range(len(coords) - 1):
        (x1, y1), (x2, y2) = coords[i], coords[i + 1]
        dx = x2 - x1
        dy = y2 - y1
        length = (dx ** 2 + dy ** 2) ** 0.5

        if length > max_len:
            max_len = length
            angle_rad = math.atan2(dy, dx)
            best_angle = math.degrees(angle_rad)

    return best_angle


def scale_panels_to_pixels(placed_panels, bounds, image_width=400, image_height=400, angle=0):
    
    # Convert placed panels (in meters) into pixel positions/sizes based on bounding box and image size.
    
    # Args:
    #     placed_panels: List of shapely.geometry.Polygon (panel rectangles)
    #     bounds: Tuple of (minx, miny, maxx, maxy) in meters (from polygon_meters.bounds)
    #     image_width: Width of static image (px)
    #     image_height: Height of static image (px)

    # Returns:
    #     List of dicts with pixel {x, y, width, height}
  
    minx, miny, maxx, maxy = bounds

    scale_x = image_width / (maxx - minx)
    scale_y = image_height / (maxy - miny)

    result = []

    for panel in placed_panels:
        p_minx, p_miny, p_maxx, p_maxy = panel.bounds

        x_px = (p_minx - minx) * scale_x
        y_px = (maxy - p_maxy) * scale_y  # Y đảo chiều vì pixel top-down

        w_px = (p_maxx - p_minx) * scale_x
        h_px = (p_maxy - p_miny) * scale_y

        result.append({
            "x": x_px,
            "y": y_px,
            "width": w_px,
            "height": h_px,
            "angle": angle  # Thêm góc xoay
        })

    return result



def get_static_map_zoom(min_lat, max_lat, min_lng, max_lng, img_width=400, img_height=400):
    WORLD_DIM = { "height": 256, "width": 256 }
    ZOOM_MAX = 21

    def lat_rad(lat):
        sin = math.sin(lat * math.pi / 180)
        return math.log((1 + sin) / (1 - sin)) / 2

    def zoom(map_px, world_px, fraction):
        return math.floor(math.log(map_px / world_px / fraction) / math.log(2))

    lat_fraction = (lat_rad(max_lat) - lat_rad(min_lat)) / math.pi
    lng_fraction = (max_lng - min_lng) / 360

    lat_zoom = zoom(img_height, WORLD_DIM["height"], lat_fraction)
    lng_zoom = zoom(img_width, WORLD_DIM["width"], lng_fraction)

    return min(lat_zoom, lng_zoom, ZOOM_MAX)



def call_static_map (bounds):
    to_latlng = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True).transform

    minx, miny, maxx, maxy = bounds  # bounds là (x, y) trong mét

    # Convert từng cặp (x, y) sang (lng, lat)
    min_lng, min_lat = to_latlng(minx, miny)
    max_lng, max_lat = to_latlng(maxx, maxy)

    center_lng = (min_lng + max_lng) / 2
    center_lat = (min_lat + max_lat) / 2


    

    min_lng, min_lat = to_latlng(minx, miny)
    max_lng, max_lat = to_latlng(maxx, maxy)

    zoom = get_static_map_zoom(min_lat, max_lat, min_lng, max_lng, 400, 400)
    # # Tính trung tâm (center)
    # avg_lng = sum(c.lng for c in coords) / len(coords)
    # avg_lat = sum(c.lat for c in coords) / len(coords)

    # # Tính bbox và độ rộng cao
    # lngs = [c.lng for c in coords]
    # lats = [c.lat for c in coords]
    # width = max(lngs) - min(lngs)
    # height = max(lats) - min(lats)

    # # Ước lượng zoom
    # if width > 0.005 or height > 0.005:
    #     zoom = 17
    # elif width > 0.002 or height > 0.002:
    #     zoom = 18
    # else:
    #     zoom = 19

    url = f"https://maps.googleapis.com/maps/api/staticmap?center={center_lat},{center_lng}&zoom=20&size=400x400&maptype=satellite&key={GG_API_KEY}"
    print('🌐url: ', url)
    
    response = requests.get(url)
    if response.status_code == 200:
        image_base64 = base64.b64encode(response.content).decode("utf-8")
    else:
        raise Exception("Failed to fetch Google Static Map")

    return image_base64   



@router.post("/api/polygon")
async def get_panel_map(polygon: PolygonRequest):
    coords = polygon.coordinates
    if len(coords) != 4:
        return JSONResponse(content={"error": "Need 4 coordinates for a quadrilateral"}, status_code=400)

    print("Received coordinates:", coords)
    print(coords[0].lat, coords[0].lng)  # Debugging output

    

    # Tính diện tích và loại hình
    result = generate_panel_positions(coords)

    # Lấy ảnh tĩnh tại tọa độ mái nhà
    result["roof_image"] = call_static_map(result["bounds"])

    angle = calculate_polygon_angle(coords)

    scaled_panels = scale_panels_to_pixels(
        result["placed_panels"], 
        bounds=result["bounds"], 
        image_width=400,
        image_height=400,
        angle=angle
    )


    print("Organized panel positions:", result["placed_panels"].__len__())
    result["placed_panels"] = scaled_panels
    return result












# class Coordinate(BaseModel):
#     lat: float
#     lng: float

# class PolygonRequest(BaseModel):
#     coordinates: list[Coordinate]

# def convert_coords_to_meters(coords):
#     # Chuyển đổi (lng, lat) sang mét, ví dụ dùng pyproj hoặc công thức gần đúng
#     # Giả sử tọa độ đầu vào WGS84 EPSG:4326
#     transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
#     return [transformer.transform(lng, lat) for lng, lat in coords]

# def calculate_shape_and_area(coords_meter):
    # # Shoelace
    # x = [p[0] for p in coords_meter]
    # y = [p[1] for p in coords_meter]
    # area = 0.5 * abs(sum(x[i]*y[(i+1)%4] - x[(i+1)%4]*y[i] for i in range(4))) 

    # # Tính các góc của tứ giác
    # # angles = []
    # for i in range(4):
    #     a = coords_meter[i - 1]
    #     b = coords_meter[i]
    #     c = coords_meter[(i + 1) % 4]
    #     # angle = calculate_angle(a, b, c)
    #     # angles.append(angle)

    # # avg_angle = sum(angles) / len(angles)
    # # is_rectangle = all(88 <= angle <= 92 for angle in angles)

    # # shape = "rectangle" if is_rectangle else "parallelogram"

    # return {
    #     # "shape": shape,
    #     "area_m2": area,
    #     # "angles": angles,
    # }



