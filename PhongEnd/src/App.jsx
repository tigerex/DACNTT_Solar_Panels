import {
  GoogleMap,
  LoadScript,
  DrawingManager,
  Marker,
  Polygon,
  Autocomplete,
} from "@react-google-maps/api";
import './App.css';
import { useState, useRef, useEffect, useMemo } from "react";
// import { OverlayView } from "@react-google-maps/api";
import HybridPanelOverlay from "./components/HybridPanelOverlay";
import { getDistance } from "geolib";

// Định nghĩa các style
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
  const deleteMenuRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  const [showResult, setShowResult] = useState(false);
  const [polygonResults, setPolygonResults] = useState({});

  // const [data, setData] = useState(null);

  const [zoom, setZoom] = useState(18);

  const [polygons, setPolygons] = useState([]); // Danh sách các polygon đã vẽ
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState(null); // Chỉ số của polygon được chọn
  const [editMode, setEditMode] = useState(false); // Chế độ chỉnh sửa polygon
  
  const onLoadPolygon = (polygon, path) => {
    polygonRef.current = polygon;
    polygonRef.path = path
  };

  const onLoadMap = (map) => {
    mapRef.current = map;

    if (!googleLoaded) {
      class DeleteMenu extends window.google.maps.OverlayView {
        constructor() {
          super();
          this.div_ = document.createElement("div");
          this.div_.className = "delete-menu";
          this.div_.innerHTML = "Delete";
          this.div_.style.position = "absolute";
          this.div_.style.background = "#f44336";
          this.div_.style.color = "#fff";
          this.div_.style.padding = "4px 8px";
          this.div_.style.fontSize = "12px";
          this.div_.style.borderRadius = "4px";
          this.div_.style.cursor = "pointer";
          this.div_.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
          this.div_.style.zIndex = "10000";


          const menu = this;
          window.google.maps.event.addDomListener(this.div_, "click", () => {
            menu.removeVertex();
          });
        }

        onAdd() {
          const deleteMenu = this;
          const map = this.getMap();

          this.getPanes().floatPane.appendChild(this.div_);
          this.divListener_ = window.google.maps.event.addDomListener(
            map.getDiv(),
            "mousedown",
            (e) => {
              if (e.target !== deleteMenu.div_) {
                deleteMenu.close();
              }
            },
            true
          );
        }

        onRemove() {
          if (this.divListener_) {
            window.google.maps.event.removeListener(this.divListener_);
          }
          if (this.div_ && this.div_.parentNode) {
            this.div_.parentNode.removeChild(this.div_);
          }
          this.set("position", null);
          this.set("path", null);
          this.set("vertex", null);
        }

        draw() {
          const position = this.get("position");
          const projection = this.getProjection();

          if (!position || !projection) return;

          const point = projection.fromLatLngToDivPixel(position);
          this.div_.style.top = (point.y - 10) + "px";  // Move slightly up
          this.div_.style.left = (point.x + 10) + "px"; // Move slightly right

        }

        open(map, path, vertex) {
          this.set("position", path.getAt(vertex));
          this.set("path", path);
          this.set("vertex", vertex);
          this.setMap(map);
          this.draw();
        }

        removeVertex() {
          const path = this.get("path");
          const vertex = this.get("vertex");

          if (path && vertex !== undefined) {
            path.removeAt(vertex);
          }
          this.close();
        }

        close() {
          this.setMap(null);
        }
      }

      deleteMenuRef.current = new DeleteMenu();
      setGoogleLoaded(true);
    }
  };

  useEffect(() => {
    if (polygonRef.current && mapRef.current) {
      const path = polygonRef.current.getPath();
      if (!deleteMenuRef.current) {
        deleteMenuRef.current = new DeleteMenu();
      }

      const listener = window.google.maps.event.addListener(
        polygonRef.current,
        "contextmenu",
        (e) => {
          if (e.vertex == undefined) return;
          deleteMenuRef.current.open(mapRef.current, path, e.vertex);
        }
      );

      return () => {
        window.google.maps.event.removeListener(listener);
      };
    }
  }, [polygonRef.current]);

  const selectedResult = useMemo(() => {
    if (selectedPolygonIndex === null) return null;
    return polygonResults[selectedPolygonIndex];
  }, [polygonResults, selectedPolygonIndex]);

  const renderedPanels = useMemo(() => {
    if (!selectedResult ?.panels_latlng?.length) return null;

    return selectedResult .panels_latlng.map((panelCoords, idx) => (
      <Polygon
        key={idx}
        path={panelCoords}
        options={{
          fillColor: "#00AA00",
          fillOpacity: 0.3,
          strokeColor: "#00AA00",
          strokeOpacity: 0.8,
          strokeWeight: 1,
        }}
      />
    ));
  }, [selectedResult ?.panels_latlng]); // chỉ render lại khi panels_latlng thay đổi

  const renderedOverlayPanels = useMemo(() => {
    if (!selectedResult ?.panels_latlng?.length) return null;

    return selectedResult .panels_latlng.map((panelCoords, idx) => (
      <HybridPanelOverlay
        key={idx}
        panelCoords={panelCoords}
        angle={selectedResult .best_angle}
        zoom={zoom}
        panelWidthInMeters={selectedResult .best_panel.panel_width}
        panelHeightInMeters={selectedResult .best_panel.panel_height}
      />
    ));
  }, [
    selectedResult ?.panels_latlng,
    selectedResult ?.best_angle,
    selectedResult ?.best_panel?.panel_width,
    selectedResult ?.best_panel?.panel_height,
    zoom
  ]);

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
  // Hàm xử lý khi vẽ polygon hoàn thành và gửi polygon đến backend chỉ để tính diện tích
  const handlePolygonComplete = (poly) => {
    const path = poly.getPath().getArray().map(latLng => ({
      lat: latLng.lat(),
      lng: latLng.lng(),
    }));

    // Lưu polygon vào state
    const newIndex = polygons.length;
    setPolygons(prev => [...prev, path]);
    setPolygonPath(path);
    setSelectedPolygonIndex(newIndex);

    // Xóa polygon cũ nếu có
    poly.setMap(null);
    console.log("Polygon mới:", path);
    // Gửi polygon đến backend để tính diện tích
    fetch("http://localhost:8000/roof/api/area", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: path,
        polygon_id: newIndex,
      }),
    })
      .then(res => res.json())
      .then(result => {
        const { polygon_id } = result;
        console.log("Kết quả:", result);
        // Lưu theo polygon_id
        setPolygonResults(prev => ({
          ...prev,
          [polygon_id]: result,
        }));
        setShowResult(true);
      })
      .catch(err => {
        console.error("Lỗi khi gửi polygon:", err);
      });
  };

  // Hàm xử lý khi gửi polygon đã vẽ đến backend, hàm này sẽ trả về các panel ble ble
  const HandleSentPolygon = () => {
    if (selectedPolygonIndex != null) {
      const path = polygons[selectedPolygonIndex];
      console.log("Sending polygon:", path);
      fetch("http://localhost:8000/roof/api/polygon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: path,
          polygon_id: selectedPolygonIndex,
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          const { polygon_id } = result;
          
          // Save result polygon
          setPolygonResults((prev) => ({
            ...prev,
            [polygon_id]: result,
          }));
          setPolygonPath([]);
          console.log("Kết quả gắn panel:", result);
          setShowResult(true);
        })
        .catch((err) => console.error("Lỗi khi gửi polygon:", err));
    }
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
          className="search-input"
          type="text"
          ref={inputRef}
          placeholder="Tìm kiếm địa điểm..."
        />

      </Autocomplete>

      {/* Bản đồ Google Maps */}
      <GoogleMap
        mapContainerStyle={containerStyle} // Kích thước của bản đồ
        //Vị trí trung tâm ban đầu của bản đồ
        center={center}
        zoom={zoom} // Cấp độ zoom của bản đồ
        onLoad={onLoadMap} // Lưu tham chiếu đến bản đồ để sử dụng sau này
        options={{
          minZoom: 2, // Cấp độ zoom tối thiểu, tránh zoom quá xa
          disableDefaultUI: false, // Ẩn UI mặc định của Google Maps
          streetViewControl: false, // Ẩn chế độ Street View
          // Giới hạn bản đồ để không thể zoom ra ngoài phạm vi toàn cầu
          restriction: {
            latLngBounds: {
              north: 85, // Giới hạn vĩ độ bắc
              south: -85, // Giới hạn vĩ độ nam
              east: 180, // Giới hạn kinh độ đông
              west: -180, // Giới hạn kinh độ tây
            },
            strictBounds: true, // Không cho zoom ra bản đồ ảo
          },
          mapTypeId: "satellite", // Chế độ bản đồ vệ tinh
          styles: [
            {
              featureType: "all", // Tất cả các tính năng
              elementType: "labels", // Các nhãn
              stylers: [{ visibility: "off" }], // Ẩn nhãn
            },
          ],
        }
      }
      >
        {marker && <Marker position={marker} />}

        {/* Vẽ polygon trên bản đồ */}
        <DrawingManager
          onPolygonComplete={handlePolygonComplete} // Gọi hàm khi vẽ polygon xong
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: 3,
              drawingModes: ["polygon"]
            },
            polygonOptions: {
              fillColor: "#fff700",        // Màu vàng sáng
              fillOpacity: 0.1,
              strokeColor: "#fcd200",      // Viền vàng sáng
              strokeWeight: 5,
              clickable: true,
              editable: true,
              zIndex: 1000,
            }
          }}
        />

        {polygons.map((path, idx) => (
          <Polygon
            key={idx}
            path={path}
            options={{
              editable: editMode && selectedPolygonIndex === idx,
              fillColor: selectedPolygonIndex === idx ? "#087500" : "#001975",
              fillOpacity: selectedPolygonIndex === idx ? 0.6 : 0.4,
              strokeColor: selectedPolygonIndex === idx ? "#00fc5d" : "#00f8fc",
              strokeWeight: selectedPolygonIndex === idx ? 3 : 1,
              clickable: true
            }}
            onClick={() => {
              setSelectedPolygonIndex(idx);
              if (selectedPolygonIndex != null && selectedPolygonIndex !== idx) {
                console.log("Polygon đang chọn:", idx);
                console.log("Tọa độ các góc:", path);
                setEditMode(false); // Reset edit mode if another polygon is selected
              }
            }}
            onLoad={onLoadPolygon} // Lưu tham chiếu đến polygon để có thể chỉnh sửa
          />
        ))}

        {selectedPolygonIndex !== null && (
          <div style={{ position: "absolute", top: 60, left: 10, zIndex: 1000, background: "rgba(0, 0, 0, 0.57)", padding: "10px", borderRadius: "6px" }}>
            <div style={{ marginBottom: "6px", fontWeight: "bold" }}>
              Thông tin polygon #{selectedPolygonIndex}
            </div>
            {/* Hiển thị diện tích và các thông tin khác của polygon đã chọn: */}
            {polygonResults[selectedPolygonIndex]?.area_m2 && (
            <div style={{ marginBottom: "10px" }}>
              Diện tích: {polygonResults[selectedPolygonIndex].area_m2.toFixed(2)} m²
            </div>
            )}
            {polygonResults[selectedPolygonIndex]?.best_panel && (
            <div style={{ marginBottom: "10px" }}>
              Panel tốt nhất: {polygonResults[selectedPolygonIndex].best_panel.panel_width}m x {polygonResults[selectedPolygonIndex].best_panel.panel_height}m
            </div>
            )}

            {!editMode && (
              <button 
                onClick={() => setEditMode(true)}
                className="button" id="edit-button"
              >
                Chỉnh Sửa
              </button>
            )}
            {editMode && (
              <button 
                onClick={() => {
                  if (polygonRef.current) {
                    const newPath = polygonRef.current.getPath().getArray().map((latLng) => ({
                      lat: latLng.lat(),
                      lng: latLng.lng()
                    }));

                    // Cập nhật polygon hiện tại trong danh sách
                    setPolygons(prev => {
                      const updated = [...prev];
                      updated[selectedPolygonIndex] = newPath;
                      return updated;
                    });

                    console.log("Đã cập nhật polygon:", selectedPolygonIndex);
                  }
                  setEditMode(false);
                }}
                className="button" id="confirm-edit-button"
              >
                Xác Nhận
              </button>
            )}
                        <button 
              onClick={() => {
                const newPolygons = polygons.filter((_, idx) => idx !== selectedPolygonIndex);
                setPolygons(newPolygons);

                setPolygonResults(prev => {
                  const newResults = { ...prev };
                  delete newResults[selectedPolygonIndex];
                  return newResults;
                });

                setSelectedPolygonIndex(null);
                setEditMode(false);
                console.log("Polygon deleted, ID: ", selectedPolygonIndex);
            }}
              className="button button-danger" id ="delete-button"
            >
              Xóa
            </button>
            <button 
              onClick={() => {HandleSentPolygon();}}
              className="button" id="send-button"
            >
              Gắn Panel
            </button>
          </div>
        )}

        {/* Polygon vẽ bởi người dùng
        {(!data?.shrunken_polygon || data.shrunken_polygon.length === 0) && polygonPath.length > 0 &&
          (console.log("shrunken_polygon 1"),
          (
            <Polygon
              path={polygonPath}
              options={{ fillColor: "#00F", fillOpacity: 0.3 }}
            />
          ))}

        {data?.shrunken_polygon == [] &&
          polygonPath.length > 0 &&
          (console.log("shrunken_polygon 2"),
          (
            <Polygon
              path={polygonPath}
              options={{ fillColor: "#00F", fillOpacity: 0.3 }}
            />
          ))} */}

        
        {/* Vẽ polygon từ dữ liệu backend đã gửi về, cái polygon đã được chỉnh sửa bởi backend */}
        
        {selectedResult?.shrunken_polygon && selectedResult.shrunken_polygon.length > 0 && (
          (
            <Polygon
              path={selectedResult.shrunken_polygon}
              options={{
                fillColor: "#616161",
                fillOpacity: 0.3,
                strokeColor: "#bf4000",
                strokeOpacity: 1,
                strokeWeight: 2,
              }}
            />
          ))}

        {/* Vẽ các panel từ dữ liệu backend đã gửi về */}
        {renderedOverlayPanels}
        {renderedPanels}  

        {/* Vẽ các panel overlay */}
        
      </GoogleMap>
    </LoadScript>
  );
}

export default App;