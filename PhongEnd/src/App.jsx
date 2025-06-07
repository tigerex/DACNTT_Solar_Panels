import {
  GoogleMap,
  LoadScript,
  DrawingManager,
  Marker,
  Polygon,
  Autocomplete,
} from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";
import ResultPanel from "./components/ResultPanel";

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
  const [panel, setPanel] = useState(null);

  const [shape, setShape] = useState(null);
  const [area, setArea] = useState(null);
  const [image, setImage] = useState(null);

  const [data, setData] = useState(null);

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
    console.log("Polygon coordinates:", path);

    // Gửi polygon đến backend
    fetch("http://localhost:8000/roof/api/polygon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: path }),
    })
      .then((res) => res.json())
      .then((result) => {
        console.log("Kết quả từ backend:", result);
        // console.log("Shape:", data[0].shape);
        // console.log("Area:", data.area_m2);
        // console.log("Image (base64):", data.roof_image.slice(0, 50)); // chỉ log 1 phần chuỗi

        // Ví dụ:
        // setShape(data[0].shape);
        setPolygonPath([]); // cập nhật polygon với kết quả từ backend
        polygonPath.length = 0; // xóa polygon hiện tại
        setData(result);
        // setImage(`data:image/png;base64,${result.roof_image}`);
        // setArea(data.area_m2);

        // setPanel(data.panel)
        setShowResult(true); // hiển thị panel kết quả
      })
      .catch((err) => console.error("Lỗi khi gửi polygon:", err));
  };

  // =========================================================================================================================

  // Hàm đóng panel kết quả
  // const handleClose = () => {
  //   console.log("Đóng panel");
  //   setShowResult(false);
  //   setPolygonPath([]); // xóa polygon
  // };

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
        zoom={18}
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
        {data?.shrunken_polygon == [] && polygonPath.length > 0 && (
          <Polygon
            path={polygonPath}
            options={{ fillColor: "#00F", fillOpacity: 0.3 }}
          />
        )}

        {/* Vẽ polygon từ dữ liệu backend đã gửi về, cái polygon đã được chỉnh sửa bởi backend */}
        {data?.shrunken_polygon && (
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
        )}

        {/* Vẽ các panel từ dữ liệu backend đã gửi về */}
        {data?.panels_latlng?.length > 0 &&
          data.panels_latlng.map((panelCoords, idx) => (
            <Polygon
              {...console.log("Panel coordinates:", panelCoords)}
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
        ))}

        {/* Cái này để vẽ mấy cái panel lúc nó chưa được xoay lại theo hướng mái nhà */}
        {/* {data?.test_latlng?.length > 0 &&
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
        ))} */}

        

      </GoogleMap>

      {/* Đoạn này là gọi ResultPanel để hiển thị ảnh mái nhà với panel nè */}
      {/* {showResult && (
        <ResultPanel
          image={image}
          // shape={shape}
          data={data}
          onClose={handleClose}
        />
      )} */}
    </LoadScript>
  );
}

export default App;
