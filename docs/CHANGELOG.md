# CHANGELOG — WebScribble

> Ghi thay đổi theo từng task: Task ID · Ngày · File tạo/sửa · Nội dung ·
> Kết quả kiểm tra. Chỉ thêm mục mới ở đầu phần "Lịch sử"; không viết lại cũ.

## Lịch sử

### TASK-05G — 2026-10-31 — Drawing Engine: Integration & Testing

- **Phạm vi:** kiểm thử tích hợp toàn diện cho TASK-05A → 05F, sửa
  bug phát hiện được, benchmark ghi nhận theo môi trường, kiểm
  chứng trình duyệt thật (headless). Không thêm tính năng, không
  đổi API công khai, không cài thư viện.
- **BUG THẬT đã sửa — StrokeBuilder đánh rơi điểm nhả bút:** sự
  kiện `up`/`cancel` hoàn tất nét mà không bổ sung mẫu cuối, nên
  mọi nét đều cụt tại sự kiện `move` cuối cùng (kéo nhanh hoặc môi
  trường ít sự kiện move thì mất đoạn cuối thấy rõ; bounds của nét
  cũng ngắn hơn thực tế — phát hiện khi kiểm thử tích hợp thấy
  bounds của highlighter ngắn bất thường). ShapeBuilder và các
  Selection builder vốn đã áp vị trí up — StrokeBuilder là nơi duy
  nhất lệch. **Sửa:** `finishFromEvent` bổ sung mẫu cuối trước khi
  hoàn tất, chỉ khi vị trí thực sự khác điểm cuối hiện tại (mẫu
  up/cancel mang pressure 0 nên phép khử trùng theo cả pressure
  không loại được điểm trùng vị trí). 6 test của TASK-05C mã hóa
  hành vi cũ đã được cập nhật cho khớp hành vi đúng (ghi chú
  TASK-05G trong test), kèm 2 test regression chuyên biệt.
- **Test tích hợp mới (48 test, 5 file):** `integrationTools.test.ts`
  (13 — đủ 7 công cụ qua down/move/up/cancel, preview, thao tác
  không hợp lệ không sinh rác, selection/eraser trên cảnh nét giao
  nhau/chồng/sát nhau, không đụng object không liên quan);
  `integrationHistory.test.ts` (4 — chuỗi hỗn hợp 7 thao tác undo/
  redo từng bước, trạng thái cuối bằng đúng tham chiếu ban đầu,
  thứ tự vẽ qua move + segment-erase); `pointerLifecycle.test.ts`
  (12 — đổi công cụ/detach/undo giữa nét, pointer thứ hai và
  non-primary, nút phụ, rời vùng canvas nhờ capture, coalesced
  events, pressure: bút giữ 0 thật, mouse/touch fallback 0.5, chuỗi
  thiết bị hỗn hợp); `splitIsolation.test.ts` (7 — hai engine:
  dữ liệu/selection/camera/công cụ/detach/history độc lập);
  `renderPerf.test.ts` (10 — stress & vòng đời render, xem dưới).
- **Benchmark (môi trường: Node v24.22.1, x86_64, VM hiện tại,
  FakeContext2D ghi lệnh — đo chi phí tính toán phía engine, KHÔNG
  phải thời gian vẽ GPU của trình duyệt):** render toàn cảnh 100
  nét × 50 điểm ≈ 40 ms (lần đầu, còn warm-up), 500 nét ≈ 115 ms,
  1.000 nét ≈ 101 ms; một nét 10.000 điểm ≈ 3,5 ms; 500 nét ở zoom
  3 ≈ 60 ms; `selectObjects` trên 1.000 nét ≈ 3,9 ms; history 200
  add ≈ 6,7 ms, 200 undo ≈ 0,5 ms, 200 redo ≈ 75 ms (redo dùng
  insertObjectAt dựng lại Map — O(n) mỗi lần chèn; chấp nhận được ở
  quy mô này, ghi nhận để theo dõi khi Surface lớn hơn nhiều).
  Không đặt ngưỡng hiệu năng cho thiết bị thật từ các số này.
- **Kiểm chứng trình duyệt (Playwright + chrome-headless-shell):**
  trang harness tạm gắn DrawingEngine lên canvas thật (đã xóa sau
  khi đo). **16/16 kiểm tra đạt:** desktop 1440×900 chuột kéo →
  đúng 1 object, bounds khớp tọa độ kéo (không lệch), 824 pixel
  mực; undo → canvas trắng hoàn toàn, redo → mực trở lại; tablet
  768×1024 cảm ứng qua CDP ở DPR 2: backing store 1600×1200, nét
  đúng tọa độ, trang không cuộn khi vẽ (canvas có
  `touch-action: none`), 4.122 pixel mực; viewport mobile 390×844
  vẽ bình thường; cả ba bối cảnh 0 lỗi console/pageerror. Đây là
  Chromium headless mô phỏng — KHÔNG phải thiết bị thật, không có
  Safari/iPad (xem ISSUE-006).
- **Chất lượng cuối:** 321/321 test đạt (26 file; trước TASK-05G
  là 273), `npm run lint` đạt, `npm run build` đạt; không có
  `skip`/`only`/`todo` trong toàn bộ test; git diff chỉ gồm
  `strokeBuilder.ts` (sửa bug), 5 file test mới, 6 điểm cập nhật
  trong `strokeBuilder.test.ts`, và tài liệu bộ nhớ. Harness QA
  tạm (`drawing-qa.html`, `src/qa-drawing.ts`) đã xóa.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05F — 2026-10-31 — Drawing Engine: History Manager (Undo/Redo)

- **File được tạo:** `src/engines/drawing/history.ts`; test:
  `surfaceInsert.test.ts` (4), `history.test.ts` (15),
  `engineHistory.test.ts` (14). **File được sửa:** `surface.ts`
  (thêm `insertObjectAt`; `replaceObject` giữ vị trí), `engine.ts`
  (tích hợp history toàn diện), `index.ts`, tài liệu bộ nhớ.
  **Không cài thư viện ngoài; không sửa Input Manager.**
- **Phân tích API Surface trước khi làm (theo yêu cầu brief):** API
  05A chưa đủ cho undo/redo CHÍNH XÁC ở ba điểm — (1) `updateObject`/
  `updateObjects` luôn ghi đè `updatedAt` nên không khôi phục nguyên
  bản qua đường update được; (2) không có cách đưa object đã xóa trở
  lại ĐÚNG VỊ TRÍ trong thứ tự vẽ (addObject chỉ nối cuối); (3)
  `replaceObject` xóa rồi nối các object thay thế xuống cuối danh
  sách, làm thứ tự chồng lớp thay đổi ngay trong thao tác tẩy tiến
  về phía trước. Đã bổ sung tối thiểu: **`insertObjectAt(index,
  object)`** — chèn nguyên bản (không đổi trường nào) tại vị trí,
  kiểm tra đầy đủ trước khi ghi; và sửa `replaceObject` để các
  object thay thế đứng tại vị trí của object bị thay. Không thay đổi
  ngữ nghĩa nào khác của Surface.
- **Thiết kế Command Pattern:** một command tổng quát
  `SurfaceChangeCommand` thay cho mười class riêng (brief cho phép):
  mọi thao tác quy về `SurfaceChange` = hai danh sách
  `{object, index}` bị ảnh hưởng ở trạng thái trước/sau. Object bất
  biến nên command chỉ giữ tham chiếu — không sao chép dữ liệu,
  không snapshot toàn Surface, không bitmap; bộ nhớ tỉ lệ với số
  object bị chạm. Các performer `performAddObject`/
  `performRemoveObjects`/`performUpdateObjects`/
  `performReplaceObject`/`performMoveObjects` thực thi bằng API
  Surface thường (giữ ngữ nghĩa gốc, gồm updatedAt làm mới khi
  update tiến) và chụp trạng thái SAU từ chính object Surface đã lưu.
  Undo/redo là hoán đổi trạng thái nguyên bản (removeObject +
  insertObjectAt theo chỉ số tăng dần) — không chạy lại logic, không
  tạo ID mới, redo của Segment Eraser tái tạo đúng các đoạn cùng ID,
  redo của move khôi phục đúng bản đã lưu chứ không làm mới updatedAt
  lần nữa. `mergeChanges` gộp chuỗi thay đổi liên tiếp (object trung
  gian biến mất khỏi cả hai phía). Thao tác không đổi dữ liệu →
  performer trả null → không ghi.
- **HistoryManager:** một instance gắn đúng một Surface (Split dùng
  hai manager độc lập, không có lịch sử toàn cục); API record/
  execute/undo/redo/canUndo/canRedo/undoCount/redoCount/clear; thao
  tác mới xóa nhánh redo; **giới hạn mặc định 100 command** — vượt
  giới hạn loại command cũ nhất khỏi lịch sử (dữ liệu Surface không
  đổi), lý do: đủ sâu cho một phiên làm việc và bộ nhớ bị chặn vì mỗi
  command chỉ giữ object nó chạm vào. Giới hạn không hợp lệ bị từ chối.
- **Tích hợp DrawingEngine:** engine sở hữu `history` của Surface
  mình; nét/hình hoàn tất, text, moveSelectionBy, deleteSelection đi
  qua history (một thao tác = một command; preview đang vẽ dở không
  ghi; camera/requestRender không ghi). Hai chế độ tẩy: engine chụp
  khung tham chiếu object tại pointer-down và tại pointer-up dựng
  MỘT SurfaceChange (trước = các object đầu lần tẩy đã biến mất, sau
  = các object mới xuất hiện) — một lần kéo tẩy qua nhiều move, kể cả
  Segment Eraser thay đi thay lại các đoạn, vẫn là một command.
  `engine.undo()/redo()/canUndo/canRedo` ủy quyền cho history, tự
  loại ID chết khỏi lựa chọn và yêu cầu renderer vẽ lại.
- **Kiểm thử (đã chạy thật):** **273/273 test đạt** (21 file; 05F
  thêm 33) — insertObjectAt (vị trí/ nguyên bản/ từ chối lỗi) và
  replaceObject giữ vị trí; command cho Add/Remove/Update/Replace/
  Move (khôi phục đúng tham chiếu, đúng vị trí, đúng updatedAt);
  command thất bại không đổi Surface lẫn history; mergeChanges hai
  bước thay thế; chuỗi undo/redo LIFO, nhánh redo bị xóa, giới hạn
  3/100, clear; độc lập hai Surface; tích hợp engine: pen (preview
  không ghi), highlighter, 4 loại shape, text, di chuyển/xóa nhóm,
  Stroke Eraser một kéo ba nét, Segment Eraser (kéo dài nhiều move,
  redo cùng ID đoạn), tẩy trượt không ghi, redraw sau undo/redo
  (đếm clearRect), hai engine Split độc lập. Một kỳ vọng test ban
  đầu của chính tôi sai (đoạn còn lại sau khi tẩy giữa nét dài là 2,
  không phải 1) — đã sửa test theo hành vi đúng. `npm run lint` đạt;
  `npm run build` đạt. Chưa kiểm chứng trình duyệt/thiết bị thật
  (pha trang thử nghiệm).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05E — 2026-10-31 — Drawing Engine: Selection & Eraser

- **File được tạo:** `src/engines/drawing/selection.ts`,
  `src/engines/drawing/eraser.ts`; test: `hitGeometry.test.ts` (16),
  `selection.test.ts` (29), `eraser.test.ts` (20),
  `engineSelection.test.ts` (9). **File được sửa:** `geometry.ts`
  (hình học khoảng cách/giao nhau + bounds mới), `objects.ts`
  (factory dùng bounds mới), `renderer.ts` (hình học đầu mũi tên
  chuyển về geometry, thêm setLineDash vào context interface),
  `canvasRenderer.ts` (lớp phủ `getOverlay`), `engine.ts` (công cụ
  chọn/tẩy + quản lý lựa chọn), `index.ts`, `tests/drawing/fakes.ts`
  (setLineDash), 4 test cũ cập nhật kỳ vọng bounds (objects,
  surfaceUpdate, shapeBuilder, engine). **Không cài thư viện ngoài;
  không sửa Input Manager.**
- **Sửa bounds (theo yêu cầu kiểm tra của brief):** phát hiện bounds
  cũ của MỌI hình hai điểm chỉ là hộp hai điểm — nét vẽ của hình tràn
  ra ngoài nửa độ dày nét, riêng arrow thì đầu mũi tên nằm hẳn ngoài
  bounds. Đã sửa ở tầng geometry/factory: `shapeObjectBounds` (nới
  nửa độ dày nét) và `arrowBounds` (hợp hộp thân + hộp hai cánh đầu
  mũi tên rồi nới nửa độ dày nét); `arrowHeadPoints`/`arrowHeadLength`
  chuyển từ renderer về geometry để bounds/renderer/selection dùng
  chung một định nghĩa; renderer bỏ mức tối thiểu 10px màn hình của
  đầu mũi tên, chuyển sang đơn vị world (× zoom) để khớp bounds ở
  mọi mức zoom. Bounds của mọi object nay = phạm vi mực vẽ thật.
- **Selection:** hai tầng — lọc ứng viên bằng bounds, kết luận bằng
  hình học thật theo loại (nét/line: polyline với bán kính mực so với
  polygon; rectangle/text: polygon vùng kín; ellipse: polygon xấp xỉ
  48 cạnh; arrow: thân + tam giác đầu mũi tên). Kiểm chứng then chốt:
  vùng chọn giao bounds của nét chéo nhưng không chạm nét → không
  chọn. Rectangle Selection và Lasso dùng CHUNG một hàm kết luận.
  Lasso đóng polygon khi hoàn tất; lasso tự cắt bị TỪ CHỐI tường
  minh ('self-intersecting') — thứ tự kiểm tra đặt tự cắt trước diện
  tích vì hình nơ có diện tích triệt tiêu (lỗi thứ tự này do test bắt
  được trong quá trình làm). Di chuyển: `translateObject` thuần +
  `moveObjects` qua `updateObjects` — nguyên tử (ID lạ/delta NaN →
  ném lỗi, không object nào thay đổi). Rect builder ban đầu quên áp
  vị trí tại sự kiện up vào cạnh cuối vùng chọn — test bắt được, đã sửa.
- **Eraser:** Stroke Eraser kết luận bằng khoảng cách đoạn–đoạn thật
  cộng nửa độ dày nét, xóa toàn bộ nét qua removeObject. Segment
  Eraser: đường tẩy phủ bằng dãy hình tròn chồng lấp (tâm cách ≤ 1
  bán kính); mỗi hình tròn cắt các đoạn nét bằng nghiệm phương trình
  đoạn–tròn, điểm biên nội suy x/y/áp suất/thời gian (giữ thứ tự thời
  gian không giảm — yêu cầu của validation); đoạn còn lại tạo qua
  factory với ID MỚI (kế thừa createdAt + style) và thay nguyên tử
  qua replaceObject; xóa hết → replaceObject với danh sách rỗng. Cả
  hai chế độ chỉ tác động pen/highlighter; không pixel erasing.
- **Engine/UI:** DrawingEngine thêm công cụ select-rect/select-lasso/
  stroke-eraser/segment-eraser; giữ danh sách ID đang chọn
  (getSelection/clearSelection/moveSelectionBy/deleteSelection);
  ID bị tẩy xóa/tách tự rời khỏi lựa chọn; setEraserSize áp dụng
  ngay cho phiên đang mở. CanvasRenderer thêm `getOverlay` — engine
  vẽ vùng chọn đang kéo (nét đứt), khung bounds các object đã chọn
  và vòng tròn con trỏ tẩy qua lớp phủ này.
- **Kiểm thử (đã chạy thật):** **240/240 test đạt** (18 file; 05E
  thêm 74) — hình học khoảng cách/giao nhau/bounds mũi tên; chọn đủ
  7 loại (gồm trường hợp giao bounds nhưng không giao hình học, độ
  dày mực highlighter vs pen, đầu mũi tên); builder rect/lasso (tự
  cắt, lấy mẫu thưa, hủy); di chuyển 1/nhiều object + nguyên tử khi
  lỗi; hai chế độ tẩy (đầu/cuối/giữa/toàn bộ nét, nhiều đoạn, ID mới,
  không sửa object gốc đóng băng sâu, không tác động Shape/Text);
  tích hợp engine gồm camera pan và overlay. `npm run lint` đạt;
  `npm run build` đạt. Chưa kiểm chứng trình duyệt/thiết bị thật
  (thuộc pha trang thử nghiệm; ISSUE-006 vẫn mở).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05D — 2026-10-31 — Drawing Engine: Shape & Text Engine

- **File được tạo:** `src/engines/drawing/shapeBuilder.ts`,
  `src/engines/drawing/text.ts`; test: `shapeBuilder.test.ts` (13),
  `text.test.ts` (11), `shapeTextRenderer.test.ts` (14) và 4 test
  engine bổ sung. **File được sửa:** `renderer.ts` (thêm drawShape/
  drawText/drawObject + mở rộng CanvasContextLike), `canvasRenderer.ts`
  (vẽ mọi loại object qua drawObject), `engine.ts` (công cụ hình +
  text), `index.ts`, `tests/drawing/fakes.ts` (context giả có thêm
  stroke/ellipse/clip/fillText/measureText xác định), engine.test.ts
  (đổi tên getter isStrokeInProgress → isDrawingInProgress), tài liệu
  bộ nhớ. **Không cài thư viện ngoài; không sửa Input Manager.**
- **Shape Builder:** vòng đời như StrokeBuilder (down neo + sinh ID,
  move cập nhật, up hoàn tất, cancel giữ hình hợp lệ, down mới chốt
  hình cũ, abandon là đường hủy duy nhất, preview chung ID). Chính
  sách hình suy biến khi hoàn tất: line/arrow dài < minSize hoặc
  rectangle/ellipse một chiều < minSize → sự kiện `discarded`
  (minSize mặc định 2 world units, cấu hình được); preview lúc kéo
  không bị ảnh hưởng. Object qua factory nên bounds/validation chuẩn.
- **Text Engine (DEC-026):** ba lớp tách bạch — nội dung (chuỗi thật,
  Unicode/tiếng Việt nguyên trạng), kích thước layout (width/height
  lưu trong object, đo bằng TextMeasurer tiêm vào: bản Canvas dùng
  measureText + lineHeight = fontSize × 1.25), hiển thị (renderer).
  Chia dòng: '\n' + gói từ tham lam theo maxWidth, từ quá dài giữ
  nguyên dòng riêng. Text rỗng bị từ chối. `updateTextContent` trả
  object mới giữ id/createdAt/vị trí để dùng với updateObject.
- **Renderer:** `drawShape` tôn trọng ShapeStyle (stroke/fill/
  opacity; rect/ellipse mặc định không fill; arrow = thân stroke +
  đầu tam giác đặc từ hàm thuần `arrowHeadPoints`, cánh đối xứng
  30°); `drawText` chia dòng bằng cùng thuật toán layout (gói theo
  width của object), clip trong hộp object, font × zoom, và phép đo
  nằm trong save/restore sau một lỗi rò trạng thái font bị test bắt
  được. `drawObject` là điểm dispatch chung; pen/highlighter giữ
  nguyên hành vi (test hồi quy đạt).
- **DrawingEngine:** điều phối StrokeBuilder/ShapeBuilder theo công
  cụ (`setTool` có overload theo họ style); công cụ 'text': down →
  callback `onTextPlacementRequested(position)` cho tầng view,
  `addTextObject` tạo object qua Text Engine với measurer được tiêm
  hoặc tự tạo từ canvas của engine.
- **Kiểm thử (đã chạy thật):** **166/166 test đạt** (14 file; 05D
  thêm 42) — tạo đủ 4 hình + kéo cập nhật + hoàn tất/hủy + bounds +
  hình học đầu mũi tên + hình suy biến; text: layout/gói dòng/
  Unicode/đa dòng/width-height/cập nhật/từ chối rỗng/bộ đo canvas;
  renderer từng loại + camera pan/zoom + đóng băng dữ liệu nguồn +
  redraw toàn bộ Surface trộn 7 loại; engine: kéo tạo rectangle,
  loại hình suy biến, đặt text + addTextObject. `npm run lint` đạt;
  `npm run build` đạt. Chưa kiểm chứng trình duyệt/thiết bị thật
  (vẽ text thật phụ thuộc font hệ thống; thuộc pha trang thử nghiệm).
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05C — 2026-10-31 — Drawing Engine: Stroke Engine & Renderer

- **File được tạo:** `src/engines/drawing/strokeBuilder.ts`,
  `renderer.ts`, `canvasRenderer.ts`, `engine.ts`; test:
  `tests/drawing/fakes.ts` (context 2D/canvas/scheduler/element giả
  dùng chung), `strokeBuilder.test.ts` (16), `renderer.test.ts` (9),
  `canvasRenderer.test.ts` (7), `engine.test.ts` (5) và 1 test bổ
  sung cho `reset()` trong `input.test.ts`. **File được sửa:**
  `src/engines/drawing/input.ts` (thêm `PointerInputManager.reset()`),
  `index.ts`, README drawing engine, `package.json`/`package-lock.json`.
- **Dependency mới:** `perfect-freehand@1.2.3` (MIT — đọc từ gói đã
  cài) theo đúng DEC-016; đã kiểm chứng hành vi bằng script trước khi
  dùng (nét 1 điểm vẫn sinh outline 44 điểm; pressure làm outline biến
  thiên đúng kỳ vọng).
- **Stroke Builder (Phần A):** down mở nét (ID + createdAt sinh ngay,
  preview và object cuối dùng chung), move thêm điểm, up hoàn tất.
  Chính sách gián đoạn: `cancel` hoàn tất và GIỮ nét (kết quả mang
  `endedBy`); down mới giữa nét → hoàn tất nét cũ `endedBy:
  'interrupted'` rồi mở nét mới; `abandon()` là đường hủy duy nhất và
  phải do tầng gọi chủ động. Time: tương đối từ điểm đầu, kẹp không
  giảm (mẫu lệch thứ tự/đồng hồ) — object tạo ra luôn qua validation
  của TASK-05A (test đối chiếu trực tiếp). Điểm trùng hoàn toàn bị bỏ
  qua. Bounds qua factory (strokeBounds) và `currentBounds` trong lúc
  vẽ khớp bounds cuối cùng (có test).
- **Renderer (Phần B + C):** outline tính lúc render bằng
  perfect-freehand từ raw points đã qua camera (size × zoom,
  `simulatePressure: false` vì pressure đã chuẩn hóa ở 05B); pen
  thinning 0.5 (dày theo pressure), highlighter thinning 0 + opacity
  từ style. `drawStroke` chỉ đọc object (test đóng băng sâu object
  vẫn vẽ được, dữ liệu không đổi). `CanvasRenderer`: rAF có gộp yêu
  cầu trùng, resize đặt backing store = CSS × DPR và vẽ theo
  transform DPR (test ghi lại đúng dãy setTransform/clearRect), redraw
  toàn bộ từ `getObjects`/`getPreviewObjects` mỗi frame, `dispose()`
  hủy frame đang chờ (có test). Object không phải nét bị bỏ qua an
  toàn.
- **Tích hợp (Phần D):** `DrawingEngine` là điểm nối duy nhất cho một
  bề mặt (input → builder → surface, renderer đọc surface + preview).
  Test tích hợp bắt được một lỗi thật: đổi công cụ giữa nét làm lệch
  trạng thái Input Manager (pointer cũ còn "đang hoạt động") → đã sửa
  bằng `reset()` ở trên và đổi công cụ/detach đều chốt nét vào Surface
  trước. Hai engine trên hai surface độc lập hoàn toàn (Split).
- **Kiểm thử (đã chạy thật):** **124/124 test đạt** (11 file; 05C thêm
  38 test mới); `npm run lint` đạt; `npm run build` đạt. Toàn bộ test
  chạy trên mock canvas có kiểm soát trong môi trường Node — **chưa
  kiểm chứng trên trình duyệt/thiết bị thật** (độ mượt, cảm giác bút,
  Safari/iPad): thuộc pha trang thử nghiệm của TASK-05 và ISSUE-006.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05B — 2026-10-31 — Drawing Engine: Input Manager

- **File được tạo:** `src/engines/drawing/input.ts` (Input Manager) và
  `tests/drawing/input.test.ts` (25 test). **File được sửa:**
  `src/engines/drawing/index.ts` (export input), README của drawing
  engine, tài liệu bộ nhớ (mục này). **Không cài thư viện ngoài** —
  dùng Pointer Events thuần của nền tảng web.
- **API:** `PointerInputManager` (constructor nhận `target` theo
  interface cấu trúc tối thiểu `PointerTargetLike`, `getCamera()` —
  gọi lại cho mỗi sự kiện — và callback `onEvent`; phương thức
  `attach()`/`detach()` idempotent, thuộc tính `activePointerId`,
  `isAttached`). Phát ra `PointerInputEvent {type: down|move|up|cancel,
  sample: PointerSample}`; sample gồm pointerId, pointerType đã chuẩn
  hóa, `position` (world) + `screenPosition`, pressure/tiltX/tiltY đã
  chuẩn hóa, `time` (timeStamp gốc), `buttons`. Các hàm thuần được
  export riêng để kiểm thử: `normalizePointerKind`,
  `normalizePressure`, `normalizeTilt`, `pointerEventToSample`.
- **Luồng pointer:** down (chỉ pointer chính, nút chính, khi chưa có
  thao tác nào) → set pointer capture → phát 'down'; move → chỉ của
  pointer đang hoạt động, mở rộng thành các sample coalesced khi có
  `getCoalescedEvents`; up/cancel → phát sự kiện kết thúc, giải phóng
  capture, reset trạng thái (dọn trạng thái trong `finally` nên cả khi
  dữ liệu sự kiện kết thúc bị hỏng, thao tác vẫn kết thúc sạch).
- **Pressure/tilt & fallback:** pressure kẹp về [0,1]; giá trị 0 lúc
  đang nhấn ở mouse/touch → 0.5 (`FALLBACK_PRESSURE`, khớp quy ước
  StrokePoint ở TASK-05A); với bút, 0 được giữ nguyên vì là dữ liệu
  thật; thiếu dữ liệu (undefined/NaN) → 0.5 khi đang nhấn, 0 khi
  không; tilt thiếu → 0, có thì kẹp [-90, 90].
- **Giới hạn có chủ ý (theo brief):** chỉ một pointer tại một thời
  điểm — pointer thứ hai/non-primary bị bỏ qua, không multi-touch
  gesture; manager không vẽ, không tạo DrawingObject, không quản lý
  history; việc chặn cuộn trang (`touch-action: none`) thuộc tầng
  view, xử lý ở pha Renderer. Cập nhật tiến triển vào ISSUE-006 (vẫn
  OPEN — còn phần kiểm chứng thiết bị thật).
- **Kiểm thử (đã chạy thật):** 25 test mới đạt — mouse (down/move/up,
  move/up khi không có thao tác, nút phụ bị bỏ qua), touch, stylus
  (pressure/tilt giữ nguyên, pressure 0 thật của bút không bị thay),
  chuẩn hóa + fallback, capture (set/release ở up/cancel, lỗi capture
  không làm hỏng luồng), pointer ID không khớp + non-primary, chuyển
  đổi tọa độ qua camera và camera thay đổi giữa thao tác, coalesced
  (mở rộng đúng thứ tự; rỗng/không hỗ trợ thì dùng sự kiện gốc), dữ
  liệu không hợp lệ (NaN vẫn dọn trạng thái sạch), attach/detach.
  Tổng toàn dự án: **86/86 test đạt** (7 file); `npm run lint` đạt;
  `npm run build` đạt.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05A (bổ sung) — 2026-10-31 — Phê duyệt đề xuất + DrawingSurface.updateObject

- **Quyết định:** Chủ dự án phê duyệt cả 3 đề xuất của TASK-05A →
  chuyển thành quyết định chính thức trong DECISIONS.md: **DEC-024**
  (Vitest là test runner chính thức), **DEC-025** (StrokePoint.time là
  ms tương đối từ điểm đầu của nét), **DEC-026** (TextObject tự mang
  width/height). Mục đề xuất ở cuối DECISIONS.md đã dọn sạch, chỉ còn
  dòng ghi nhận việc chuyển đổi. Kiểm tra số: DEC chạy đủ 001 → 026,
  không trùng, không mâu thuẫn (DEC-024 bổ sung cho DEC-016 về kiểm
  thử; DEC-025/026 cụ thể hóa mô hình dữ liệu của DEC-015/019).
- **Code (`src/engines/drawing/surface.ts`):** Bổ sung vào interface
  `DrawingSurface` và `InMemorySurface`:
  - `updateObject(object)` — thay object cùng ID; kiểm tra tồn tại +
    đúng bề mặt + `validateDrawingObject` trước khi ghi; surface tự
    đặt `updatedAt` = thời điểm cập nhật và trả về bản đã lưu; ID và
    surfaceId không thể thay đổi (định danh bằng chính ID của object
    truyền vào; ID lạ → lỗi not found); thất bại → object gốc giữ
    nguyên tham chiếu.
  - `updateObjects(objects)` — batch nguyên tử hai pha (kiểm tra tất
    cả, gồm trùng ID trong batch → mới ghi tất cả), cho thao tác nhiều
    object như di chuyển selection.
  - `replaceObject(id, replacements)` — thay nguyên tử 1 object bằng
    0..N object có ID mới (mảng rỗng = xóa hẳn), phục vụ Segment
    Eraser; replacements dùng lại ID cũ, trùng ID sẵn có, khác bề mặt
    hoặc không hợp lệ đều bị từ chối trước khi đụng vào dữ liệu.
- **Kiểm thử:** Thêm `tests/drawing/surfaceUpdate.test.ts` — 13 test:
  di chuyển object (bounds + updatedAt làm mới), sửa text, đổi style,
  giữ thứ tự danh sách; thất bại không đổi dữ liệu (unknown ID, khác
  surface, bounds bị sửa — đối chiếu bằng tham chiếu gốc); batch
  nguyên tử (một item hỏng → không item nào được ghi; trùng ID trong
  batch); replace thành 2 đoạn, replace bằng mảng rỗng, 5 kiểu thất
  bại của replace; cô lập 2 surface khi update. Tổng toàn dự án:
  **61/61 test đạt** (6 file); `npm run lint` đạt; `npm run build` đạt.
- **Tài liệu đồng bộ:** ARCHITECTURE.md mục 2.6, TASKS.md, CURRENT_STATE.md,
  PROJECT_INDEX.md (docs version 1.7), CHANGELOG.md.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-05A — 2026-10-31 — Drawing Engine: Data Model & Surface Interface

- **File được tạo (7, trong `src/engines/drawing/`):** `types.ts`
  (DrawingObject discriminated union 7 loại: pen, highlighter, line,
  rectangle, ellipse, arrow, text; StrokePoint = x/y/pressure/time;
  Bounds; 3 họ style), `objects.ts` (factory từng loại + sinh ID bằng
  crypto.randomUUID có dự phòng + style mặc định), `geometry.ts`
  (bounds: stroke nới nửa độ dày nét, chuẩn hóa hình hai điểm, union/
  expand/intersect/contains, computeObjectBounds), `coordinates.ts`
  (Camera {x, y, zoom} tách khỏi dữ liệu; worldToScreen/screenToWorld;
  pan & zoom giữ điểm neo), `validation.ts` (validateDrawingObject +
  type guard — kiểm tra cấu trúc, pressure ∈ [0,1], time không giảm,
  bounds khớp dữ liệu tính lại), `surface.ts` (interface DrawingSurface
  + InMemorySurface — addObject từ chối object thuộc surface khác và ID
  trùng), `index.ts` (barrel export).
- **File được sửa:** `src/engines/drawing/README.md` (trạng thái 05A),
  `package.json` + `package-lock.json` (thêm vitest + script `test`),
  tài liệu bộ nhớ (mục này). Đã xóa `tests/.gitkeep`.
- **Dependency mới:** `vitest@5.0.5` (devDependency, MIT — đọc từ gói đã
  cài) làm test runner; script `npm run test` = `vitest run`. Chưa cài
  perfect-freehand/Zustand/Dexie — thuộc các pha/task sau. Không dùng
  `any` trong toàn bộ code mới (kiểm chứng bằng grep + lint).
- **Kiểm thử (đã chạy thật):** 5 file test trong `tests/drawing/`
  (objects, geometry, coordinates, validation, surface) — **48/48 test
  đạt**: tạo object từng loại, ID không trùng (2.000 ID), bounds từng
  loại, round-trip world↔screen ở 4 cấu hình camera, pan/zoom giữ điểm
  neo, cô lập 2 surface (mô hình Split DEC-020), validation nhận diện
  dữ liệu hỏng (NaN, pressure ngoài khoảng, time giảm, bounds bị sửa),
  JSON round-trip cho cả 7 loại. `npm run lint` đạt (exit 0);
  `npm run build` đạt (exit 0, gồm `tsc -b`).
- **Thiết kế chính:** tọa độ world của bề mặt; stroke chỉ lưu raw
  points — không outline, không bitmap; camera không chạm vào dữ liệu
  object; object là dữ liệu thuần tuần tự hóa được, sẵn sàng cho
  persistence (TASK-08), undo/redo và selection/eraser ở các pha sau.
- **Đề xuất chờ xác nhận** (ghi ở cuối DECISIONS.md, chưa phải quyết
  định): PROP-001 Vitest là test runner chính thức; PROP-002 quy ước
  `StrokePoint.time` là ms tương đối từ đầu nét; PROP-003 Text object
  lưu width/height do lớp tạo text đo.
- **Git:** chưa commit — chờ chủ dự án duyệt.

### TASK-04 — 2026-10-30 — UI shell & điều hướng cơ bản

- **File được tạo (11):** `src/app/navigation.ts` (kiểu ViewKey/ModeKey +
  tiêu đề các khu vực); `src/app/layouts/AppShell.tsx`;
  `src/app/components/Sidebar.tsx` (Sidebar desktop thu gọn được +
  MobileDrawer), `Header.tsx`, `WelcomeSection.tsx`, `QuickActions.tsx`,
  `RecentDocuments.tsx`, `WorkspaceModes.tsx` (3 thẻ chế độ + panel xem
  trước); `src/app/features/home/HomePage.tsx`,
  `features/documents/DocumentsPage.tsx` (2 biến thể: gần đây / tất cả),
  `features/whiteboard/WhiteboardPage.tsx`,
  `features/settings/SettingsPage.tsx`.
- **File được sửa:** `src/app/App.tsx` (giữ mỏng — chỉ giữ state điều
  hướng và ghép shell + trang), `src/app/components/Sidebar.tsx` (sửa
  hiển thị tagline ở brand: bỏ cắt chữ bằng dấu "…" để tagline xuống
  dòng gọn — phát hiện khi xem ảnh chụp kiểm tra), `package.json` +
  `package-lock.json` (thêm lucide-react). Đã xóa 3 `.gitkeep` ở
  components/layouts/features vì thư mục đã có file thật.
- **Dependency mới:** `lucide-react@1.65.0` — giấy phép **ISC** (đọc từ
  gói đã cài), cài qua npm, không CDN. Lưu ý phiên bản này đã đổi tên
  một số icon (Home → House, FilePlus2 → FilePlus/FilePlusCorner) — đã
  đối chiếu tên icon với bản cài trước khi dùng.
- **Thiết kế:** Minimalist Premium; trắng/xám trung tính/xanh dương nhạt,
  xanh dương đậm cho primary/active/focus; bo góc, bóng nhẹ; không dùng
  Aurora Gradient; không sao chép giao diện ứng dụng khác. Responsive:
  sidebar tĩnh từ breakpoint `lg`, dưới `lg` dùng drawer có backdrop;
  lưới thẻ 3 cột → 1 cột; header rút gọn (ẩn ô tìm kiếm dưới `md`).
- **Tương tác đã hoạt động (kiểm chứng thật):** điều hướng 5 khu vực;
  thu gọn sidebar 256px → 76px; drawer mobile mở/đóng và tự đóng sau khi
  chọn mục; chọn 1 trong 3 chế độ (trạng thái active qua `aria-selected`
  + panel xem trước đổi theo chế độ, gồm mock 2 vùng cho Split Mode);
  Quick Actions điều hướng đúng đích. Các nút chưa có chức năng thật
  (Mở tài liệu từ thiết bị, Tạo bảng trắng, Tạo tài liệu mới) hiển thị
  **thông báo trung thực** nêu rõ task sẽ triển khai — không dữ liệu giả,
  không giả vờ thành công. Ô tìm kiếm là UI hiển thị (chưa gắn tìm kiếm
  thật, thuộc các task sau).
- **Kiểm tra đã chạy:** `npm run lint` đạt (exit 0); `npm run build` đạt
  (CSS 24,05 kB, JS 247,30 kB); grep CDN — sạch. Kiểm tra trình duyệt:
  trình duyệt xem trước từ xa **không truy cập được localhost** của máy
  này, nên đã tự kiểm tra bằng Chromium headless (Playwright) chạy ngay
  trên máy — 9 ảnh chụp ở 1440×900, 768×1024, 390×844: không tràn ngang
  ở cả 3 kích thước, đủ các tương tác nêu trên, **0 lỗi console/page**.
  Thư viện Playwright chỉ cài ở `/tmp/qa` phục vụ kiểm tra, **không**
  phải dependency của dự án.
- **Git:** thay đổi TASK-04 đang ở working tree (18 mục), **chưa commit**
  theo yêu cầu — chờ chủ dự án duyệt.

### TASK-03 — 2026-10-30 — Khởi tạo khung dự án

- **File/thư mục được tạo:** khung ứng dụng tại `~/workspace/webscribble/`
  (ngoài `docs/`): `package.json`, `package-lock.json`, `vite.config.ts`,
  `eslint.config.js`, `tsconfig*.json`, `index.html`, `public/`,
  `README.md`, `.gitignore` (bổ sung `.env*`), và `src/` theo cấu trúc:
  `app/` (App.tsx trang khởi đầu + components/layouts/features),
  `core/` (services/stores), `engines/` (pdf, word, document, whiteboard,
  drawing, annotation, export — mỗi thư mục một README placeholder nêu
  vai trò + DEC liên quan + task triển khai), `data/repositories`,
  `offline/`, `types/`, `hooks/`, `utils/`, `config/`, `assets/`,
  `styles/` (index.css với `@import "tailwindcss"`), `main.tsx`,
  `tests/`. Thư mục rỗng giữ chỗ bằng `.gitkeep`.
- **Hai điều chỉnh so với khuôn mẫu mặc định (đã báo cáo chủ dự án):**
  (1) Template `create-vite` hiện tại dùng **oxlint** — đã gỡ và thay
  bằng **ESLint** (flat config + typescript-eslint + react-hooks +
  react-refresh) đúng yêu cầu của task. (2) **TypeScript chốt 5.9.3**
  thay vì 7.0.2 của template, vì `typescript-eslint@8.72.1` khai báo
  peer `typescript <6.1.0` (cài cùng TS 7 báo ERESOLVE); nâng lại khi
  typescript-eslint hỗ trợ TS 7. Không quyết định nào trong DEC-016 →
  023 bị thay đổi (DEC-016 không ghim phiên bản TypeScript).
- **Phiên bản + giấy phép thực tế (đọc từ gói đã cài):** react/react-dom
  19.3.1 MIT; vite 8.3.5 MIT; @vitejs/plugin-react 6.1.2 MIT;
  tailwindcss/@tailwindcss/vite 4.3.3 MIT; typescript 5.9.3 Apache-2.0;
  eslint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.1,
  eslint-plugin-react-hooks 7.1.1, eslint-plugin-react-refresh 0.5.7,
  globals 17.13.0, @types/node 24.19.2, @types/react 19.3.0,
  @types/react-dom 19.3.0 — tất cả MIT. Không thư viện trả phí, không
  CDN (đã grep kiểm tra src + cấu hình).
- **Kiểm tra đã chạy thật:** `npm install` thành công, có
  `package-lock.json`; `npm run build` đạt (`tsc -b` + vite build, CSS
  Tailwind 7,99 kB); `npm run lint` đạt (exit 0, không lỗi/cảnh báo);
  `npm run dev` khởi động (Vite ready ~439 ms), phục vụ index.html với
  tiêu đề WebScribble và module App.tsx chứa đúng tên + tagline, sau đó
  đã tắt server.
- **Git:** `git init` (nhánh đổi tên `master` → `main`), `.gitignore`
  đã kiểm tra chặn đúng `node_modules`/`dist`/`.env*`; `git status` gồm
  14 mục chưa track; **chưa commit, chưa remote** theo yêu cầu. ISSUE-008
  thu hẹp còn quyết định hosting/remote.
- **Đồng bộ bộ nhớ:** TASKS.md (TASK-03 DONE + kết quả),
  CURRENT_STATE.md, KNOWN_ISSUES.md (ISSUE-008), PROJECT_INDEX.md (docs
  version 1.4), CHANGELOG.md. Không triển khai engine/PWA/IndexedDB nào;
  không sửa StudyWrite.

### TASK-02 — 2026-10-30 — Chốt kiến trúc & quyết định công nghệ

- **File được sửa (7):** `docs/DECISIONS.md`, `docs/PRODUCT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/KNOWN_ISSUES.md`, `docs/TASKS.md`,
  `docs/CURRENT_STATE.md`, `docs/PROJECT_INDEX.md` (docs version 1.3).
  Không sửa: PROJECT_CONTEXT.md, AI_WORKFLOW.md, 3 file research.
- **Nội dung:**
  - DECISIONS.md: ghi 8 quyết định do chủ dự án xác nhận thành
    **DEC-016 → DEC-023** — stack chính thức + Dexie + 7 điều kiện
    (DEC-016); phạm vi PDF flatten, bảo vệ file gốc (DEC-017); phạm vi
    DOCX chấp nhận mất định dạng, giữ file gốc, cảnh báo khi xuất, xuất
    bằng thư viện `docx` (DEC-018); Whiteboard trang cố định, chưa
    Infinite Canvas, dữ liệu sẵn sàng mở rộng (DEC-019); mô hình
    Workspace/Surface, tự lưu + undo theo Surface (DEC-020); xuất Split
    Mode = phương án B (DEC-021); iOS offline + sao lưu/khôi phục bắt
    buộc (DEC-022); HEIC chưa tích hợp decoder (DEC-023). DEC-017/018/020
    ghi rõ là cụ thể hóa DEC-005/006/014-015 — không quyết định cũ nào bị
    sửa hoặc xóa.
  - PRODUCT_SPEC.md: thêm stack đã chốt (mục 1); ma trận Document Mode
    cập nhật (PDF sửa gốc = không cam kết theo DEC-017; HEIC theo
    DEC-023); Split Mode thêm mô hình lưu DEC-020 + xuất phương án B;
    Whiteboard chốt trang cố định; module PDF/Word/Annotation/Storage/
    Export/PWA đồng bộ theo DEC-017/018/020/021/022.
  - ARCHITECTURE.md: mục 1 chuyển từ "đề xuất" sang bảng công nghệ đã
    chốt kèm ghi chú bắt buộc (thêm Mammoth, thư viện `docx`, Dexie,
    perfect-freehand); Engine Layer mô tả pipeline Word (Mammoth →
    sanitize → Tiptap) và xuất flatten; Data Layer thêm Dexie, điều
    kiện dữ liệu của DEC-019, sao lưu/khôi phục và `storage.persist()`;
    thêm luồng 4.4 Sao lưu/Khôi phục; mục 6 cập nhật trạng thái đã chốt.
  - KNOWN_ISSUES.md: ISSUE-001/002/007/010/012/013 → **RESOLVED** (mỗi
    mục ghi bằng chứng là quyết định tương ứng); ISSUE-014 thu hẹp còn
    mobile + GIF; ISSUE-005 thêm ghi chú giảm nhẹ bởi DEC-022, giữ OPEN.
  - TASKS.md: TASK-02 → DONE + kết quả; TASK-03 giữ NOT_STARTED.
- **Kết quả kiểm tra:** DEC chạy đủ 001→023 không trùng; 3 task DONE
  (00/01/02), còn lại NOT_STARTED; đối chiếu SPEC ↔ ARCHITECTURE ↔
  DECISIONS ở các điểm đã chốt (PDF flatten, DOCX, Split, Whiteboard,
  HEIC, backup) — nhất quán; không còn nhãn CHƯA XÁC MINH nào mâu thuẫn
  với quyết định mới. Không tạo code/package.json, không cài dependency.

### TASK-01 — 2026-10-30 — Khảo sát & kiểm chứng công nghệ

- **File được tạo (3):** `docs/research/TECH_SURVEY.md` (Luồng A),
  `docs/research/STUDYWRITE_MODULE_AUDIT.md` (Luồng B),
  `docs/research/THREE_MODES_ARCHITECTURE_RESEARCH.md` (Luồng C).
- **File được sửa:** `docs/TASKS.md` (TASK-01 → DONE + kết quả),
  `docs/CURRENT_STATE.md`, `docs/KNOWN_ISSUES.md` (ISSUE-001 →
  INVESTIGATING; bổ sung bằng chứng/kết luận cho ISSUE-002/007/010/012/
  013/014), `docs/ARCHITECTURE.md` (ghi chú trạng thái khảo sát ở mục 1),
  `docs/PROJECT_INDEX.md` (docs version 1.2), `docs/CHANGELOG.md`.
- **Nội dung chính:**
  - Luồng A: toàn bộ stack có khuyến nghị kèm nguồn chính thức — USE cho
    React/TypeScript/Vite/Tailwind/IndexedDB/Zustand/Canvas 2D +
    perfect-freehand; USE WITH CONDITIONS cho PDF.js (virtualization,
    worker cùng origin), pdf-lib (chỉ flatten, **không sửa được text
    gốc PDF** — trích Limitations chính thức), Tiptap (DOCX là nhập/xuất
    mất mát; tránh Pro/Cloud), Mammoth (chỉ trích ngữ nghĩa; phải
    sanitize), Service Worker/PWA (HTTPS; **ITP Safari xóa storage sau
    7 ngày nếu chưa cài vào Màn hình chính**). Giấy phép đã kiểm chứng
    qua npm registry: toàn MIT/Apache-2.0/BSD/ISC.
  - Luồng B (chỉ đọc StudyWrite): 11 cụm module được chấm — USE: xử lý
    ảnh/chip WMF; USE AFTER REFACTOR: tiền xử lý DOCX, OMML→MathML, đường
    nhập DOCX, thước/zoom, xuất DOCX bằng thư viện `docx`; tham chiếu
    thiết kế: hệ bút vẽ; DO NOT USE: xuất PDF raster, `.swp.json`, UI
    shell/nạp CDN. Ghi nhận JSZip dual license MIT/GPLv3 và hai module
    "không tồn tại" (annotation độc lập, chuyển đổi WMF/EMF thật).
  - Luồng C: ma trận ảnh (HEIC chỉ Safari ≥17 + cần WASM ở nơi khác; BMP
    không ưu tiên lưu); mô hình stroke điểm thô + bbox; undo/redo theo bề
    mặt; mô hình Workspace/Surface + tự lưu theo bề mặt cho Split Mode; 4
    phương án xuất Split Mode (chưa chốt); khuyến nghị Whiteboard trang
    cố định trước, dữ liệu sẵn sàng cho Infinite Canvas.
  - Mâu thuẫn nguồn được ghi minh bạch trong TECH_SURVEY: trạng thái hỗ
    trợ `getCoalescedEvents` trên Safari (18.2+ theo dữ liệu MDN mới vs
    chưa hỗ trợ theo bảng MDN khác) — cần kiểm chứng bằng thiết bị ở TASK-05.
- **Kết quả kiểm tra:** Đủ 3 file nghiên cứu; đối chiếu trạng thái task/
  issue giữa TASKS, CURRENT_STATE, KNOWN_ISSUES — nhất quán. Không tạo
  code ứng dụng, không sửa StudyWrite, không chốt quyết định nào thay
  chủ dự án (mọi khuyến nghị để lại cho TASK-02).

### Cập nhật bộ nhớ — 2026-10-30 — Quyết định StudyWrite (phương án C) + hệ thống 3 chế độ

- **Bối cảnh:** Lượt cập nhật theo yêu cầu chủ dự án, không phải task trong
  roadmap; không task nào được đánh dấu DONE trong lượt này.
- **File được sửa (8):** `docs/DECISIONS.md`, `docs/PRODUCT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`,
  `docs/KNOWN_ISSUES.md`, `docs/PROJECT_INDEX.md`, `docs/CHANGELOG.md`.
  (Không sửa: `PROJECT_CONTEXT.md`, `AI_WORKFLOW.md` — không có nội dung liên quan.)
- **Nội dung:**
  - DECISIONS.md: thêm DEC-013 (WebScribble độc lập với StudyWrite, tái sử
    dụng module có chọn lọc theo 4 điều kiện), DEC-014 (3 chế độ làm việc:
    Document / Split / Whiteboard + nguyên tắc phân biệt sửa nội dung gốc
    vs chú thích phủ), DEC-015 (một Drawing Engine duy nhất cho cả 3 chế độ).
  - KNOWN_ISSUES.md: ISSUE-009 → RESOLVED (bằng chứng: DEC-013); mở mới
    ISSUE-012 (Infinite Canvas chưa đánh giá), ISSUE-013 (lưu trạng thái
    Split Mode), ISSUE-014 (chi tiết ma trận định dạng).
  - PRODUCT_SPEC.md: thêm mục 3 "Ba chế độ làm việc" kèm ma trận khả năng
    theo định dạng; các mục sau đánh số lại (module → mục 4, phi chức năng
    → mục 5, nghiệm thu → mục 6); bổ sung ghi chú DEC-015 ở module Drawing
    Engine và Annotation Engine.
  - ARCHITECTURE.md: thêm Whiteboard Engine, khái niệm Workspace/Surface ở
    Application Core và Data Layer, thư mục `engines/whiteboard/`, và mục 6
    phân tích ảnh hưởng của 3 chế độ.
  - TASKS.md: mở rộng TASK-01 thành 3 luồng khảo sát (stack / audit module
    StudyWrite / kiến trúc 3 chế độ) kèm file đầu ra; thêm TASK-12
    (Whiteboard Engine & Mode) và TASK-13 (Split Mode); TASK-11 cập nhật
    phụ thuộc và tham chiếu PRODUCT_SPEC mục 6.
  - CURRENT_STATE.md và PROJECT_INDEX.md: cập nhật trạng thái, docs
    version 1.1.
- **Kết quả kiểm tra:** Đối chiếu chéo ID (DEC-001→015, ISSUE-001→014,
  TASK-00→13) giữa các file — nhất quán; ISSUE-009 đúng trạng thái RESOLVED;
  3 chế độ có mặt trong PRODUCT_SPEC và ARCHITECTURE. Không tạo/sửa bất kỳ
  file mã nguồn nào.

### TASK-00 — 2026-10-30 — Khởi tạo hệ thống bộ nhớ dự án

- **File được tạo (10):** `docs/PROJECT_INDEX.md`, `docs/PROJECT_CONTEXT.md`,
  `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_STATE.md`,
  `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`,
  `docs/KNOWN_ISSUES.md`, `docs/AI_WORKFLOW.md`.
- **File được sửa:** Không có (dự án mới).
- **Nội dung:**
  - Kiểm tra trước khi tạo: chưa tồn tại dự án WebScribble; thư mục gốc dự án
    `~/workspace/webscribble/` được tạo mới chỉ để chứa `docs/`; không có
    package.json/framework nào thuộc dự án này; `~/workspace` không phải
    Git repo. Dự án HSA và file StudyWrite sẵn có không bị đụng tới.
  - Ghi nhận 12 quyết định nền tảng của chủ dự án vào DECISIONS.md
    (DEC-001 → DEC-012).
  - Đặc tả sản phẩm theo module vào PRODUCT_SPEC.md, có gắn nhãn
    ĐÃ THỐNG NHẤT / ĐỀ XUẤT / CHƯA XÁC MINH.
  - Kiến trúc đề xuất (5 lớp) + nguyên tắc tách Drawing Engine khỏi
    Document Engine vào ARCHITECTURE.md; stack ghi rõ là đề xuất chưa chốt.
  - Roadmap TASK-00 → TASK-11 vào TASKS.md; CURRENT_STATE.md ghi rõ ứng
    dụng chưa được lập trình.
  - Mở 11 issue ban đầu trong KNOWN_ISSUES.md (ISSUE-001 → ISSUE-011).
- **Kết quả kiểm tra:** Đủ 10 file; PROJECT_INDEX.md dưới 100 dòng; đối chiếu
  chéo ID task/quyết định/issue giữa các file — nhất quán (chi tiết trong báo
  cáo TASK-00). Không chạy kiểm thử code vì chưa có code.
