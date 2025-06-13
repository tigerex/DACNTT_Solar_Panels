import {
  GoogleMap,
  LoadScript,
  DrawingManager,
  Marker,
  Polygon,
  Autocomplete,
} from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";
// import { OverlayView } from "@react-google-maps/api";
import HybridPanelOverlay from "./components/HybridPanelOverlay";
import { getDistance } from "geolib";

const containerStyle = {
  width: "100vw",
  height: "100vh",
};

const center = { lat: 10.7626, lng: 106.6602 };

function App() {
  const [marker, setMarker] = useState(null);
  const [polygonPath, setPolygonPath] = useState([]);
  const polygonRef = useRef(null);
  const mapRef = useRef(null); // để dùng panTo (optional)
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const [showResult, setShowResult] = useState(false);

  const [data, setData] = useState(null);

  const [zoom, setZoom] = useState(18);

  const handleOnLoad = (mapInstance) => {
    mapRef.current = mapInstance;
    mapInstance.addListener("zoom_changed", () => {
      setZoom(mapInstance.getZoom());
    });
  };
  

  // Hàm di chuyển bản đồ đến vị trí mới và cập nhật marker
  const moveTo = (lat, lng) => {
    if (mapRef.current) {
      setMarker({ lat, lng }); // cập nhật marker
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(18); // nếu muốn zoom lại
    }
  };

  // Hàm xử lý khi autocomplete chọn địa điểm
  const handlePlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (!place.geometry) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    moveTo(lat, lng);
  };

  // =========================================================================================================================

  // Chủ yếu là đang làm cái này nè, gửi polygon về backend
  // Để vẽ panel lên
  // Hàm xử lý khi vẽ polygon hoàn thành và gửi polygon đến backend
  const handlePolygonComplete = (poly) => {
    const path = poly
      .getPath()
      .getArray()
      .map((latLng) => ({
        lat: latLng.lat(),
        lng: latLng.lng(),
      }));
    setPolygonPath(path);
    polygonRef.current = poly;
    // console.log("Polygon coordinates:", path);

    // Gửi polygon đến backend
    fetch("http://localhost:8000/roof/api/polygon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: path }),
    })
      .then((res) => res.json())
      .then((result) => {
        // ❗ Gỡ polygon thật ra khỏi bản đồ
        if (polygonRef.current) {
          polygonRef.current.setMap(null);
          polygonRef.current = null;
        }

        // ❗ Clear state để xóa polygon đang giữ
        setPolygonPath([]);

        // ✅ Cập nhật data để hiển thị polygon từ backend
        setData(result);
        setShowResult(true); // Hiển thị panel kết quả
      })
      .catch((err) => console.error("Lỗi khi gửi polygon:", err));
  };

  const panelSizeInPixels = (panelCoords) => {
    // panelCoords = 4 lat/lng points

    const widthMeters = getDistance(panelCoords[0], panelCoords[1]);
    const heightMeters = getDistance(panelCoords[1], panelCoords[2]);

    // Tùy zoom, convert đơn giản: 1m ~ 2px (có thể scale theo zoom thực tế sau)
    const meterToPixelRatio = 2;

    return {
      width: widthMeters * meterToPixelRatio,
      height: heightMeters * meterToPixelRatio,
    };
  };

  // =========================================================================================================================

  return (
    <LoadScript
      googleMapsApiKey={import.meta.env.VITE_GG_API_KEY} //Nạp API key từ .env
      libraries={["drawing", "places"]} // Nạp các thư viện cần thiết, drwaing để vẽ polygon, places để sử dụng Autocomplete (search places)
    >
      <Autocomplete
        onLoad={(auto) => (autocompleteRef.current = auto)} // Lưu tham chiếu đến Autocomplete
        onPlaceChanged={handlePlaceChanged} // Gọi hàm khi chọn địa điểm
      >
        {/* Khung tìm kiếm địa chỉ nè */}
        <input
          type="text"
          ref={inputRef}
          placeholder="Tìm kiếm địa điểm..."
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            width: "300px",
            padding: "8px",
          }}
        />
      </Autocomplete>

      {/* Bản đồ Google Maps */}
      <GoogleMap
        mapContainerStyle={containerStyle} // Kích thước của bản đồ
        //Vị trí trung tâm ban đầu của bản đồ
        center={
          data?.shrunken_polygon
            ? { lat: data.center_lat, lng: data.center_lng }
            : center
        }
        zoom={zoom} // Cấp độ zoom của bản đồ
        mapTypeId="satellite" // Chế độ bản đồ là vệ tinh
        // onClick={handleMapClick}
        onLoad={(map) => (mapRef.current = map)} // Lưu tham chiếu đến bản đồ để sử dụng sau này
      >
        {marker && <Marker position={marker} />}

        {/* Vẽ polygon trên bản đồ */}
        <DrawingManager
          onPolygonComplete={handlePolygonComplete}
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: 3,
              drawingModes: ["polygon"],
            },
          }}
        />

        {/* Polygon vẽ bởi người dùng */}
        {(!data?.shrunken_polygon || data.shrunken_polygon.length === 0) &&
          polygonPath.length > 0 &&
          (console.log("Amen:"),
          (
            <Polygon
              path={polygonPath}
              options={{ fillColor: "#00F", fillOpacity: 0.3 }}
            />
          ))}

        {data?.shrunken_polygon == [] &&
          polygonPath.length > 0 &&
          (console.log("Amen:"),
          (
            <Polygon
              path={polygonPath}
              options={{ fillColor: "#00F", fillOpacity: 0.3 }}
            />
          ))}

        {/* Vẽ polygon từ dữ liệu backend đã gửi về, cái polygon đã được chỉnh sửa bởi backend */}
        {data?.shrunken_polygon &&
          (console.log("Polygon path:", polygonPath),
          (
            <Polygon
              path={data.shrunken_polygon}
              options={{
                fillColor: "#0000FF",
                fillOpacity: 0.3,
                strokeColor: "#0000FF",
                strokeOpacity: 1,
                strokeWeight: 3,
              }}
            />
          ))}

        {/* Vẽ các panel từ dữ liệu backend đã gửi về */}
        {/* {data?.panels_latlng?.length > 0 &&
          data.panels_latlng.map((panelCoords, idx) => (
            <Polygon
              key={idx}
              path={panelCoords}
              options={{
                fillColor: "#00AA00",
                fillOpacity: 0.4,
                strokeColor: "#00AA00",
                strokeOpacity: 0.8,
                strokeWeight: 1,
              }}
            />
          ))} */}

        {data?.panels_latlng?.map((panelCoords, idx) => (
          <HybridPanelOverlay // compnent nha, để vẽ panel lẫn grid mà backend trả về
            key={idx}
            panelCoords={panelCoords}
            angle={data.best_angle} // hoặc từng góc riêng nếu có
            zoom={zoom}
            panelWidthInMeters={data.best_panel.panel_width} // nếu cần
            panelHeightInMeters={data.best_panel.panel_height} // nếu cần
          />
        ))}
      </GoogleMap>
    </LoadScript>
  );
}

export default App;

// const handleMapClick = (e) => {
//   const lat = e.latLng.lat();
//   const lng = e.latLng.lng();
//   setMarker({ lat, lng });

//   console.log(`lat: ${lat}, lng: ${lng}`);

//   // Gửi điểm đến backend (ví dụ)
//   fetch("http://localhost:8001/api/location", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ lat, lng })
//   });
// };

{
  /* Cái này để vẽ mấy cái panel lúc nó chưa được xoay lại theo hướng mái nhà */
}
{
  /* {data?.test_latlng?.length > 0 &&
          data.test_latlng.map((panelCoords, idx) => (
            <Polygon
              {...console.log("Hehehehehe:", panelCoords)}
              key={idx}
              path={panelCoords}
              options={{
                fillColor: "#AA0000",
                fillOpacity: 0.4,
                strokeColor: "#AA0000",
                strokeOpacity: 0.8,
                strokeWeight: 1,
              }}
            />
        ))} */
}
