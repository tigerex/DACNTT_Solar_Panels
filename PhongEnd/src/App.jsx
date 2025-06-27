import {GoogleMap,LoadScript,DrawingManager,Marker,Polygon,  Autocomplete,} from "@react-google-maps/api";
import './App.css';
import { useState, useRef, useEffect, useMemo } from "react";
import { OverlayView } from "@react-google-maps/api";
import HybridPanelOverlay from "./components/HybridPanelOverlay";
import SnippingTool from "./components/SnipingTool"; // Import snipping tool component, nếu cần dùng thì bỏ comment dòng này

// Định nghĩa các style, không cần nữa do có CSS riêng, nhưng tui thích để 2 thằng này ở đây :D
const containerStyle = {
  width: "100vw",
  height: "100vh",
};

const center = { lat: 10.7626, lng: 106.6602 };  // Vị trí trung tâm của bản đồ, mỗi lần load sẽ hiện ở đây.

function App() {
  const [marker, setMarker] = useState(null);                             // Vị trí marker hiện tại
  const [polygonPath, setPolygonPath] = useState([]);                     // Lưu trữ tọa độ của polygon đã vẽ
  const polygonRef = useRef(null);                                        // để lưu trữ polygon hiện tại, dùng để chỉnh sửa sau này
  const mapRef = useRef(null);                                            // để dùng panTo (optional)
  const deleteMenuRef = useRef(null);                                     // Lưu trữ menu xóa góc polygon
  const inputRef = useRef(null);                                          // Tham chiếu đến input tìm kiếm địa chỉ
  const autocompleteRef = useRef(null);                                   // Tham chiếu đến Autocomplete để lấy địa điểm đã chọn
  const [googleLoaded, setGoogleLoaded] = useState(false);                // Biến để kiểm tra xem Google Maps API đã được nạp hay chưa

  const [showResult, setShowResult] = useState(false);                    // Biến để kiểm tra xem có hiển thị kết quả tính toán diện tích và panel hay không
  const [polygonResults, setPolygonResults] = useState({});               // Lưu trữ kết quả tính toán diện tích và panel cho từng polygon, key là polygon_id

  // const [data, setData] = useState(null);

  const [zoom, setZoom] = useState(18);                                   // Cấp độ zoom ban đầu của bản đồ

  const [polygons, setPolygons] = useState([]);                           // Danh sách các polygon đã vẽ
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState(null); // Chỉ số của polygon được chọn
  const [editMode, setEditMode] = useState(false);                        // Chế độ chỉnh sửa polygon

  const [sunlightHours, setSunlightHours] = useState(5);                  // Số giờ nắng trung bình mỗi ngày, mặc định là 4.5 giờ 
  const [panelGap, setPanelGap] = useState(0.5);                          // Khoảng cách giữa các panel, mặc định là 0.1 mét
  const [startPos, setStartPos] = useState(null);
  const [endPos, setEndPos] = useState(null);
  const [isPolygonMenuHovered, setIsPolygonMenuHovered] = useState(false);
  const [snipActive, setSnipActive] = useState(false);                    // Biến để kiểm tra xem snipping tool có đang hoạt động hay không
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [maskResult, setMaskResult] = useState(null);

  
  const onLoadPolygon = (polygon, path) => {  // Hàm này sẽ được gọi khi polygon được tải xong
    polygonRef.current = polygon;             // Lưu tham chiếu đến polygon để có thể chỉnh sửa sau này
    polygonRef.path = path 
  };

  // Hàm này sẽ được gọi khi bản đồ được tải xong
  const onLoadMap = (map) => {
    mapRef.current = map; // Lưu tham chiếu đến bản đồ để có thể sử dụng sau này

    if (!googleLoaded) {
      // Tạo lớp OverlayView để hiển thị menu xóa góc
      class DeleteMenu extends window.google.maps.OverlayView {
        constructor() {
          super();
          this.div_ = document.createElement("div");                  // Tạo một div để chứa menu
          this.div_.className = "delete-menu";                        // Thêm class để có thể style dễ dàng
          this.div_.innerHTML = "Delete";                             // Nội dung của menu
          this.div_.style.position = "absolute";                      // Style thoai
          this.div_.style.background = "#f44336";                     // Màu
          this.div_.style.color = "#fff";                             // Màu chữ
          this.div_.style.padding = "4px 8px";                        // Padding
          this.div_.style.fontSize = "12px";                          // Font size
          this.div_.style.borderRadius = "4px";                       // Bo tròn góc
          this.div_.style.cursor = "pointer";                         // Con trỏ chuột
          this.div_.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";  // Đổ bóng
          this.div_.style.zIndex = "10000";                           // Đặt z-index cao để hiển thị trên các đối tượng khác


          const menu = this;
          window.google.maps.event.addDomListener(this.div_, "click", () => { // Thêm sự kiện click để xóa góc
            menu.removeVertex(); // Gọi hàm xóa góc
          });
        }

        // Hàm này sẽ được gọi khi menu được thêm vào bản đồ
        onAdd() {
          const deleteMenu = this; 
          const map = this.getMap();
          // Kiểm tra xem bản đồ đã được tải chưa
          this.getPanes().floatPane.appendChild(this.div_);
          this.divListener_ = window.google.maps.event.addDomListener( // Thêm listener để đóng menu khi click ra ngoài
            map.getDiv(),
            "mousedown", // Thêm sự kiện mousedown để đóng menu khi click ra ngoài
            (e) => {
              if (e.target !== deleteMenu.div_) {
                deleteMenu.close(); // Gọi hàm close để ẩn menu
              }
            },
            true // true để sự kiện này được xử lý trước các sự kiện khác
          );
        }
        
        // Hàm này sẽ được gọi khi menu bị xóa khỏi bản đồ
        onRemove() {
          if (this.divListener_) {
            window.google.maps.event.removeListener(this.divListener_); // Xóa listener để tránh rò rỉ bộ nhớ
          }
          if (this.div_ && this.div_.parentNode) {
            this.div_.parentNode.removeChild(this.div_); // Xóa div khỏi DOM
          }
          this.set("position", null); // Reset position
          this.set("path", null);     // Reset path
          this.set("vertex", null);   // Reset vertex
        }

        // Hàm này sẽ được gọi để vẽ menu lên bản đồ
        draw() {
          const position = this.get("position");  // Lấy vị trí của góc polygon
          const projection = this.getProjection();// Lấy projection của bản đồ

          if (!position || !projection) return;   // Nếu không có vị trí hoặc projection thì không vẽ gì cả

          const point = projection.fromLatLngToDivPixel(position); // Chuyển đổi vị trí từ LatLng sang pixel
          this.div_.style.top = (point.y - 10) + "px";  // Di chuyển lên trên một chút
          this.div_.style.left = (point.x + 10) + "px"; // Di chuyển sang bên phải một chút

        }

        // Hàm này sẽ được gọi để mở menu
        open(map, path, vertex) {
          this.set("position", path.getAt(vertex)); // Lấy vị trí của góc polygon
          this.set("path", path);                   // Lưu trữ đường dẫn của polygon
          this.set("vertex", vertex);               // Lưu trữ chỉ số của góc polygon
          this.setMap(map);                         // Hiển thị menu trên bản đồ
          this.draw();
        }
        // Hàm này sẽ được gọi để xóa góc polygon
        removeVertex() {
          const path = this.get("path");            // Lấy đường dẫn của polygon
          const vertex = this.get("vertex");        // Lấy chỉ số của góc polygon

          if (path && vertex !== undefined) {
            path.removeAt(vertex); // Xóa góc polygon tại chỉ số vertex
          }
          this.close();
        }
        // Hàm này sẽ được gọi để đóng menu
        close() {
          this.setMap(null);
        }
      }
      // Tạo một instance của DeleteMenu và lưu vào ref để sử dụng sau này
      deleteMenuRef.current = new DeleteMenu();
      setGoogleLoaded(true); // Đánh dấu là đã nạp Google Maps API
    }
  };

  // useEffect là một hook của React, dùng để thực hiện side effects trong component
  // Trong trường hợp này, nó sẽ được gọi khi polygonRef hoặc mapRef thay đổi
  useEffect(() => {
    if (polygonRef.current && mapRef.current) {       // Kiểm tra xem polygonRef và mapRef đã được khởi tạo chưa
      const path = polygonRef.current.getPath();      // Lấy đường dẫn của polygon hiện tại
      if (!deleteMenuRef.current) {                   // Nếu chưa có DeleteMenu thì tạo mới
        deleteMenuRef.current = new DeleteMenu();     // Tạo một instance của DeleteMenu
      }

      const listener = window.google.maps.event.addListener( // Thêm listener để mở menu xóa góc khi click chuột phải vào góc polygon
        polygonRef.current,
        "contextmenu",
        (e) => {
          if (e.vertex == undefined) return;                            // Nếu không phải là góc polygon thì không làm gì cả
          deleteMenuRef.current.open(mapRef.current, path, e.vertex);   // Mở menu xóa góc tại vị trí của góc polygon
        }
      );

      return () => {
        window.google.maps.event.removeListener(listener); // Xóa listener khi unmount
      };
    }
  }, [polygonRef.current]); // Chỉ chạy khi polygonRef.current thay đổi

  // Hàm này dùng Memo để tối ưu hiệu suất, chỉ tính toán lại khi polygonResults hoặc selectedPolygonIndex thay đổi
  // selectedResult sẽ chứa kết quả của polygon đang được chọn
  const selectedResult = useMemo(() => {          
    if (selectedPolygonIndex === null) return null; // Nếu không có polygon nào được chọn thì trả về null
    return polygonResults[selectedPolygonIndex];    // Trả về kết quả của polygon đang được chọn
  }, [polygonResults, selectedPolygonIndex]);       // Theo dõi sự thay đổi của polygonResults và selectedPolygonIndex

  // Lại thêm một useMemo để render các panel từ selectedResult
  // Chỉ render lại khi selectedResult.panels_latlng thay đổi
  const renderedPanels = useMemo(() => {
    if (!selectedResult ?.panels_latlng?.length) return null;         // Nếu không có panels_latlng thì không render gì cả

    return selectedResult .panels_latlng.map((panelCoords, idx) => (  // Duyệt qua từng panel trong panels_latlng
      <Polygon
        key={idx}
        path={panelCoords}
        options={{
          fillColor: "#00AA00", // Màu xanh lá cây
          fillOpacity: 0.3,
          strokeColor: "#00AA00", // Viền màu xanh lá cây
          strokeOpacity: 0.8,
          strokeWeight: 1,
        }}
        
      />
    ));
  }, [selectedResult ?.panels_latlng]); // Theo dõi sự thay đổi của selectedResult.panels_latlng

  // Lại lại  một useMemo nữa để render các panel overlay từ selectedResult
  const renderedOverlayPanels = useMemo(() => {
    if (!selectedResult ?.panels_latlng?.length) return null; // Nếu không có panels_latlng thì không render gì cả

    return selectedResult .panels_latlng.map((panelCoords, idx) => ( // Duyệt qua từng panel trong panels_latlng
      <HybridPanelOverlay // Compenent của QUân
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
  ]); // Theo dõi mấy bé này

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

    const handleMaskResult = (data) => {
      setMaskResult(data);  // This could include base64 image, time taken, etc.
      
      console.log("Tổng cộng polygon:", data.length);
      data.forEach((polygon, index) => {
        console.log(`Polygon #${index + 1} (${polygon.length} điểm):`, polygon);
      });

      const paths = data.map((polygon) =>
        polygon.map(([lat, lng]) => ({ lat, lng }))
      );

      data.forEach((polygonCoords, index) => {
        const polygon = new google.maps.Polygon({
          paths: polygonCoords.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: "#FF0000",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#FF0000",
          fillOpacity: 0.35,
        });

        polygon.setMap(mapRef.current); // mapInstance là Google Maps instance

        // ✅ Gọi thẳng luôn handler như khi user tự vẽ
        handlePolygonComplete(polygon);
      });


    };
  
  // =========================================================================================================================
  // Hàm này sẽ render các nhãn khoảng cách giữa các cạnh của polygon
  const renderPolygonEdgeLengths = (path) => {
    if (!window.google || path.length < 2 || !mapRef.current) return null; // Kiểm tra xem có đủ điểm và bản đồ đã được tải chưa

    const map = mapRef.current; // Lấy bản đồ từ ref
    const projection = map.getProjection?.(); // Lấy projection của bản đồ, nếu không có thì trả về null
    if (!projection) return null; // Nếu không có projection thì không thể tính toán được

    // Xử lý các đoạn đường giữa các điểm trong path
    return path.map((start, i) => {
      const end = path[(i + 1) % path.length]; // Lấy điểm tiếp theo, nếu là điểm cuối thì quay về điểm đầu

      const startLatLng = new window.google.maps.LatLng(start.lat, start.lng);  // Chuyển đổi tọa độ từ đối tượng sang LatLng, điểm bắt đầu
      const endLatLng = new window.google.maps.LatLng(end.lat, end.lng);        // Chuyển đổi tọa độ từ đối tượng sang LatLng, điểm kết thúc
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(startLatLng, endLatLng); // Tính khoảng cách giữa hai điểm

      // === Đoạn này là để hiển thị nhãn khoảng cách trên bản đồ ===
      // Tìm trung điểm giữa hai điểm để đặt nhãn
      const midLat = (start.lat + end.lat) / 2;   // Tính vĩ độ trung bình
      const midLng = (start.lng + end.lng) / 2;   // Tính kinh độ trung bình
      const midLatLng = new window.google.maps.LatLng(midLat, midLng); // Tạo đối tượng LatLng cho trung điểm

      const pointStart = projection.fromLatLngToPoint(startLatLng); // Chuyển đổi LatLng của điểm bắt đầu sang điểm pixel trên bản đồ
      const pointEnd = projection.fromLatLngToPoint(endLatLng);     // Chuyển đổi LatLng của điểm kết thúc sang điểm pixel trên bản đồ
      const pointMid = projection.fromLatLngToPoint(midLatLng);     // Chuyển đổi LatLng trung điểm sang điểm pixel trên bản đồ

      const edgeDx = pointEnd.x - pointStart.x;                     // Tính khoảng cách theo trục X giữa hai điểm
      const edgeDy = pointEnd.y - pointStart.y;                     // Tính khoảng cách theo trục Y giữa hai điểm
      const length = Math.sqrt(edgeDx ** 2 + edgeDy ** 2);              // Không hiểu dòng này :)))
      const offsetPx = -20; // Khoảng cách offset trục X theo pixel, có thể điều chỉnh tùy ý
      const offsetPy = -20; // Khoảng cách offset trục Y theo pixel, có thể điều chỉnh tùy ý

      const normalX = -(edgeDy / length); // Tính vector pháp tuyến trục X, đảm bảo nó hướng ra ngoài
      const normalY = edgeDx / length;    // Tính vector pháp tuyến trục Y, đảm bảo nó hướng ra ngoài

      const offsetMidX = pointMid.x + normalX * (offsetPx / (1 << map.getZoom()));  // Tính tọa độ X của nhãn, offset theo vector pháp tuyến
      const offsetMidY = pointMid.y + normalY * (offsetPy / (1 << map.getZoom()));  // Tính tọa độ Y của nhãn, offset theo vector pháp tuyến

      // Chuyển đổi tọa độ pixel đã offset về LatLng để hiển thị nhãn
      const offsetLatLng = projection.fromPointToLatLng(
        new window.google.maps.Point(offsetMidX, offsetMidY)
      );

      // Tính góc xoay của nhãn dựa trên vector từ điểm bắt đầu đến điểm kết thúc
      const angleRad = Math.atan2(edgeDy, edgeDx);  // Tính góc theo radian
      let angleDeg = angleRad * (180 / Math.PI);    // Chuyển đổi sang độ
      const normalized = (angleDeg + 360) % 360;    // Chuẩn hóa góc về khoảng [0, 360)
      if (normalized > 90 && normalized < 270) {    // Nếu góc nằm trong khoảng 90 đến 270 độ, cần lật nhãn
        angleDeg += 180; // Lật 180 độ để nhãn luôn hướng lên trên
      }
      const color = "#d4ffb8"; // Biến đổ màu
      return (
        <OverlayView
          key={`edge-${i}`}
          position={offsetLatLng}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div
            style={{
              transform: `rotate(${angleDeg}deg)`,
              transformOrigin: "center",      
              color: "#00061f",
              fontSize: "15px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              display: "flex",
              justifyContent: "center",
              textShadow: `0 0 3px ${color}, 0 0 3px ${color}, 0 0 3px ${color}, 0 0 3px ${color}, 0 0 3px ${color},0 0 3px ${color},0 0 3px ${color},0 0 3px ${color},0 0 3px ${color},0 0 3px ${color}`, // Hiệu ứng đổ bóng cho chữ
              }}
          >
            {distance.toFixed(2)} m
          </div>
        </OverlayView>
      );
    });
  };

  // =========================================================================================================================
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
          [polygon_id]: result, // Lưu kết quả theo polygon_id
        }));
        setPolygonPath(result.coordinates); // Cập nhật lại polygonPath
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
          panel_gap: panelGap, // Khoảng cách giữa các panel
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          const { polygon_id } = result;
          
          // Lưu kết quả trả về theo polygon_id
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

  const centerPolygonOnMap = () => {
    if (selectedPolygonIndex !== null && polygons[selectedPolygonIndex]) {
      const bounds = new window.google.maps.LatLngBounds();
      polygons[selectedPolygonIndex].forEach(coord => {
        bounds.extend(new window.google.maps.LatLng(coord.lat, coord.lng));
      });

      mapRef.current.fitBounds(bounds);
    }
  };

  // =========================================================================================================================
  // Từ đây là render giao diện chính của ứng dụng
  return (
    <LoadScript
      googleMapsApiKey={import.meta.env.VITE_GG_API_KEY} //Nạp API key từ .env
      libraries={["drawing", "places", "geometry"]} // Nạp các thư viện cần thiết, drwaing để vẽ polygon, places để sử dụng Autocomplete (search places)
    >
      {/* CÁC CÔNG CỤ, HIỆN TẠI MỚI CÓ SNIPPING TOOL VỚI SEARCH BAR THÔI */}
      <div id="toolbar">
        <Autocomplete
          onLoad={(auto) => (autocompleteRef.current = auto)}
          onPlaceChanged={handlePlaceChanged}
        >
          <input id="search-input"
            ref={inputRef}
            type="text"
            placeholder="Tìm kiếm địa điểm..."
          />
        </Autocomplete>

        {/* MENU CÔNG CỤ */}
          <div className="tools-menu-wrapper">
            <button className="tools-button"
              onClick={() => setShowToolsMenu(prev => !prev)}
            >🧰 Tools</button>

            {showToolsMenu && (
              <div className="tools-dropdown">
                <div id="snipping-tool"
                  onClick={() => {
                    setSnipActive(true);
                    setShowToolsMenu(false);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  ✂️ Snipping Tool
                </div>
              </div>
            )}
          </div>        
      </div>

      {snipActive && (
        <SnippingTool
          onResult={handleMaskResult}
          onClose={() => setSnipActive(false)}
          mapCenter={mapRef.current.getCenter().toJSON()}
          zoom={mapRef.current.getZoom()}
          polygonPath={selectedPolygonIndex != null ? polygons[selectedPolygonIndex] : []}
          mapType="satellite"
        />
      )}
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
              stylers: [{ visibility: "on" }], // Ẩn nhãn
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
          <>
            <Polygon
              path={path}
              options={{
                editable: editMode && selectedPolygonIndex === idx,
                fillColor: selectedPolygonIndex === idx ? "#8cff80" : "#0015ff",
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
                  setEditMode(false);
                }
              }}
              onLoad={onLoadPolygon}
            />
            {selectedPolygonIndex === idx && renderPolygonEdgeLengths(path)}
          </>
        ))}

        {/* Hiển thị snipping tool nếu cần */}
        {/* danh sách polygon  */}
        <div
          className={`polygon-slide-container ${isPolygonMenuHovered ? "expanded" : ""}`}
          onMouseEnter={() => setIsPolygonMenuHovered(true)}
          onMouseLeave={() => setIsPolygonMenuHovered(false)}
        >
          <div className="polygon-slide-tab">
            P O L Y G O N S 
          </div>

          <div className="polygon-slide-menu">
            <div className="polygon-slide-title">Danh sách</div>
            <div className="polygon-slide-list">
              {polygons.map((path, idx) => (
                <div
                  key={idx}
                  className={`polygon-slide-item ${
                    selectedPolygonIndex === idx ? "selected" : ""
                  }`}
                  onClick={() => setSelectedPolygonIndex(idx)}
                  title={`Polygon #${idx}`}
                >
                  Polygon #{idx}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Hiển thị thông tin polygon đã chọn */}
        {selectedPolygonIndex !== null && (
          <div
            style={{
              position: "absolute",
              top: 60,
              left: 10,
              zIndex: 1000,
              background: "rgba(0, 0, 0, 0.57)",
              padding: "10px",
              borderRadius: "6px",
              color: "#fff",
              minWidth: "260px"
            }}
          >
            <div style={{ marginBottom: "6px", fontWeight: "bold"}}>
              Thông tin polygon #{selectedPolygonIndex}
            </div>

            {polygonResults[selectedPolygonIndex]?.area_m2 && (
              <div style={{ marginBottom: "10px" }}>
                <strong>Diện tích:</strong> {polygonResults[selectedPolygonIndex].area_m2.toFixed(2)} m²
              </div>
            )}

            {polygonResults[selectedPolygonIndex]?.best_panel && (() => {
              const bp = polygonResults[selectedPolygonIndex].best_panel;
              const totalBestPower = bp.count * bp.panel_best_power;
              const totalNormalPower = bp.count * bp.panel_normal_power;
              const totalPrice = bp.count * bp.panel_price;

              return (
                <div style={{ marginBottom: "10px", lineHeight: "1.6" }}>
                  {/* BẢNG THÔNG TIN KỸ THUẬT TẤM PIN */}
                  <div style={{ padding: "10px", background: "#303030", borderRadius: "6px", marginBottom: "12px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "6px" }}>🔧 Thông số kỹ thuật pin năng lượng mặt trời</div>
                    <div><strong>Model:</strong> {bp.model}</div>
                    <div><strong>Kích thước:</strong> {(bp.panel_width * 1000).toFixed(0)}mm × {(bp.panel_height * 1000).toFixed(0)}mm</div>
                    <div>
                      <strong>Công suất tối đa </strong>
                      <span className="tooltip">
                        (STC*)
                        <span className="tooltip-text">
                          Điều Kiện Kiểm Tra Chuẩn<br />
                          <em>(Standard Test Conditions)</em>
                          <pre>Mật độ nắng: 1000W/m²</pre>
                          <pre>Nhiệt độ: 25°C</pre>
                          <pre>Áp suất khí quyền: AM1.5</pre>
                        </span>
                      </span>: {bp.panel_best_power} W
                    </div>
                    <div>
                      <strong>Công suất thông thường </strong>
                      <span className="tooltip">
                        (NOCT*)
                        <span className="tooltip-text">
                          Điều Kiện Vận Hành Ngoài Trời<br />
                          <em>(Nominal Operating Cell Temperature)</em>
                          <pre>Mật độ nắng: 800W/m²</pre>
                          <pre>Nhiệt độ: 20°C</pre>
                          <pre>Gió: 1m/s)</pre>
                        </span>
                      </span>: {bp.panel_normal_power} W
                    </div>
                  </div>

                  {/* BẢNG THÔNG TIN THEO POLYGON */}
                  <div style={{ padding: "10px", background: "#303030", borderRadius: "6px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "6px" }}>📊 Thống kê cho polygon #{selectedPolygonIndex}</div>
                    <div><strong>Số lượng tấm:</strong> {bp.count}</div>
                    <div>
                      <strong>Công suất tổng khả thi </strong>
                      <span className="tooltip">
                        (STC*)
                        <span className="tooltip-text">
                          Điều Kiện Kiểm Tra Chuẩn<br />
                          <em>(Standard Test Conditions)</em>
                          <pre>Mật độ nắng: 1000W/m²</pre>
                          <pre>Nhiệt độ: 25°C</pre>
                          <pre>Áp suất khí quyền: AM1.5</pre>
                        </span>
                      </span>: {totalBestPower.toFixed(2)} W
                    </div>
                    <div>
                      <strong>Công suất tổng thông thường </strong>
                      <span className="tooltip">
                        (NOCT*)
                        <span className="tooltip-text">
                          Điều Kiện Vận Hành Ngoài Trời<br />
                          <em>(Nominal Operating Cell Temperature)</em>
                          <pre>Mật độ nắng: 800W/m²</pre>
                          <pre>Nhiệt độ: 20°C</pre>
                          <pre>Gió: 1m/s)</pre>
                        </span>
                      </span>: {totalNormalPower.toFixed(2)} W
                    </div>
                    <div><strong>Điện năng tối đa/ngày:</strong> {(bp.count * bp.panel_best_power * sunlightHours  * 0.8 / 1000).toFixed(2)} kWh</div> {/* giả sử 4.5 giờ nắng và hiệu suất 80% */}
                    <div><strong>Điện năng trung bình/ngày:</strong> {(bp.count * bp.panel_normal_power * sunlightHours  * 0.8 / 1000).toFixed(2)} kWh</div> {/* giả sử 4.5 giờ nắng và hiệu suất 80% */}
                    <div><strong>Tổng giá:</strong> {totalPrice.toLocaleString()} VND</div>
                  </div>

                 {/* SLIDER GIỜ NẮNG TRUNG BÌNH MỖI NGÀY */}
                  <div className="sunlight-container">
                    <div className="sunlight-header">
                      <label htmlFor="sun-slider" className="sunlight-label">
                        ☀️ Số giờ nắng trung bình mỗi ngày:
                      </label>
                      <div className="sunlight-value">
                        {sunlightHours.toFixed(1)} giờ
                      </div>
                    </div>
                    <input
                      id="sun-slider"
                      type="range"
                      min="1"
                      max="8"
                      step="0.1"
                      value={sunlightHours}
                      onChange={(e) => setSunlightHours(parseFloat(e.target.value))}
                      className="sunlight-slider"
                    />
                  </div>

                  {/* SLIDER KHOẢNG CÁCH GIỮA CÁC TẤM PIN */}
                  <div className="panel-gap-container">
                    <label htmlFor="panel-gap" className="panel-gap-label">
                      🧱 Khoảng cách giữa các tấm (m):
                    </label>
                    <input
                      id="panel-gap"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={panelGap}
                      onChange={(e) => setPanelGap(parseFloat(e.target.value))}
                      className="panel-gap-input"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Nút chỉnh sửa / xác nhận */}
            {!editMode ? (
              <button onClick={() => setEditMode(true)} className="button" id="edit-button">
                Chỉnh Sửa
              </button>
            ) : (
              <button
                onClick={() => {
                  if (polygonRef.current) {
                    const newPath = polygonRef.current.getPath().getArray().map((latLng) => ({
                      lat: latLng.lat(),
                      lng: latLng.lng()
                    }));
                    setPolygons((prev) => {
                      const updated = [...prev];
                      updated[selectedPolygonIndex] = newPath;
                      return updated;
                    });
                    console.log("Đã cập nhật polygon:", selectedPolygonIndex);
                  }
                  setEditMode(false);
                }}
                className="button"
                id="confirm-edit-button"
              >
                Xác Nhận
              </button>
            )}

            {/* Nút xoá */}
            <button
              onClick={() => {
                const newPolygons = polygons.filter((_, idx) => idx !== selectedPolygonIndex);

                setPolygons(newPolygons);
                setPolygonResults((prev) => {
                  const newResults = { ...prev };
                  delete newResults[selectedPolygonIndex];
                  return newResults;
                });

                setSelectedPolygonIndex(null);
                setEditMode(false);
                console.log("Polygon deleted, ID: ", selectedPolygonIndex);
              }}
              className="button button-danger"
              id="delete-button"
            >
              Xóa
            </button>

            {/* Nút gửi backend */}
            <button
              onClick={() => {
                HandleSentPolygon();
              }}
              className="button"
              id="send-button"
            >
              Gắn Panel
            </button>

            {/* Nút canh giữa bản đồ */}
            <button
              onClick={centerPolygonOnMap}
              className="button"
              id="center-button"
              style={{ marginTop: "10px" }}
            >
              Đi đến
            </button>
            {/* <div className="info-footnote">
              <strong>*STC</strong> (Standard Test Conditions): điều kiện kiểm tra chuẩn (Mật độ nắng: 1000W/m², Nhiệt độ: 25°C, Áp suất khí quyền: AM1.5). <br />
              <strong>*NOCT</strong> (Nominal Operating Cell Temperature): điều kiện vận hành ngoài trời (800W/m², 20°C, gió 1m/s).
            </div> */}


          </div>
          
        )}

        {/* Hiển thị kết quả tính toán diện tích và panel nếu có */}
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