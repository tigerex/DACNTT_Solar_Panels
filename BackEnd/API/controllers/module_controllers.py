from services.roof_geometry_service import convert_coords_to_meters, calculate_shape_and_area

def calculate_area_from_coordinates(coords):
    try:
        coords_meter = convert_coords_to_meters(coords)
        if len(coords_meter) != 4:
            return {"error": "Requires exactly 4 points"}
        result = calculate_shape_and_area(coords_meter)
        return result
    except Exception as e:
        return {"error": str(e)}
