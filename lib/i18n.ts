import type { CatalogEffect } from "./types";

export interface EffectViTranslation {
  title: string;
  doc: string;
}

export const EFFECT_VI_MAP: Record<string, EffectViTranslation> = {
  // === Augraphy (51) ===
  BadPhotoCopy: {
    title: "Photocopy bẩn",
    doc: "Tạo hiệu ứng bản sao chụp bị bẩn với các hạt nhiễu và vệt mực đen như máy photocopy cũ.",
  },
  BindingsAndFasteners: {
    title: "Dấu đóng gáy & ghim bấm",
    doc: "Thêm vết đóng gáy hồ sơ, lỗ đục còng hoặc dấu kẹp ghim lên rìa trang tài liệu.",
  },
  BleedThrough: {
    title: "Thấm mực mặt sau",
    doc: "Mô phỏng hiện tượng chữ và mực in từ mặt sau thấm ngược sang mặt trước của tờ giấy.",
  },
  BookBinding: {
    title: "Cong gáy sách",
    doc: "Tạo hiệu ứng độ cong trang giấy kèm bóng tối ở vùng gáy sách khi mở quét hoặc chụp.",
  },
  Brightness: {
    title: "Điều chỉnh độ sáng",
    doc: "Tăng hoặc giảm độ sáng tổng thể của toàn bộ trang tài liệu theo hệ số nhân.",
  },
  BrightnessTexturize: {
    title: "Vân sáng bề mặt giấy",
    doc: "Tạo nhiễu ngẫu nhiên trên kênh độ sáng để giả lập kết cấu bề mặt giấy sần tự nhiên.",
  },
  ColorPaper: {
    title: "Đổi màu giấy nền",
    doc: "Thay đổi màu nền trang giấy theo tông màu (hue) và độ bão hòa (saturation) tùy chọn.",
  },
  ColorShift: {
    title: "Lệch kênh màu",
    doc: "Dịch chuyển từng kênh màu BGR theo độ lệch nhỏ tạo hiệu ứng bóng màu bị lệch.",
  },
  DelaunayTessellation: {
    title: "Vân lưới tam giác Delaunay",
    doc: "Chia mặt phẳng thành lưới tam giác Delaunay để tạo kết cấu nền sợi giấy phức hợp.",
  },
  DepthSimulatedBlur: {
    title: "Nhòe chiều sâu trường ảnh",
    doc: "Làm mờ một vùng hình elip trên trang nhằm mô phỏng hiện tượng lệch nét theo chiều sâu camera.",
  },
  DirtyDrum: {
    title: "Bụi trống từ máy in",
    doc: "Tạo các dải sọc bẩn dọc và ngang mô phỏng trống từ máy in hoặc máy photocopy bị bám mực.",
  },
  DirtyRollers: {
    title: "Vệt bẩn con lăn kéo giấy",
    doc: "Mô phỏng các vệt sọc bánh xe do con lăn kéo giấy của máy quét tài liệu để lại.",
  },
  DirtyScreen: {
    title: "Mặt kính quét bị bẩn",
    doc: "Tạo các đốm bụi và mảng bẩn kích thước khác nhau như mặt kính máy scan chưa lau sạch.",
  },
  Dithering: {
    title: "Trộn điểm hạt (Dithering)",
    doc: "Chuyển đổi ảnh sang dạng chấm hạt nhị phân bằng thuật toán Ordered hoặc Floyd–Steinberg.",
  },
  DotMatrix: {
    title: "Chữ in kim (Dot Matrix)",
    doc: "Mô phỏng hiệu ứng máy in kim bằng cách vẽ các chấm tròn tạo thành nét chữ.",
  },
  DoubleExposure: {
    title: "Phơi sáng kép (Bóng đôi)",
    doc: "Mô phỏng hiện tượng chồng hai lớp ảnh lệch nhau do rung máy khi chụp bằng điện thoại.",
  },
  Faxify: {
    title: "Bản truyền Fax",
    doc: "Giả lập chất lượng bản fax nhiệt đen trắng với độ tương phản gắt và mất chi tiết nét mảnh.",
  },
  Folding: {
    title: "Nếp gấp trang giấy",
    doc: "Mô phỏng vết gấp tờ giấy kèm biến dạng phối cảnh và bóng đổ dọc theo đường gấp.",
  },
  Gamma: {
    title: "Hiệu chỉnh Gamma",
    doc: "Điều chỉnh độ tương phản phi tuyến (gamma) làm sáng hoặc làm tối sắc độ trung gian.",
  },
  Geometric: {
    title: "Biến đổi hình học cơ bản",
    doc: "Áp dụng các phép biến đổi hình học như thu phóng, lật trang và xoay nghiêng góc tài liệu.",
  },
  GlitchEffect: {
    title: "Lỗi tín hiệu số (Glitch)",
    doc: "Tạo hiệu ứng lỗi sọc màu và trượt lệch các dải ảnh ngang/dọc như lỗi truyền dữ liệu quét.",
  },
  Hollow: {
    title: "Nét chữ rỗng ruột",
    doc: "Làm rỗng phần ruột bên trong nét chữ đậm, chỉ giữ lại đường viền bao quanh ký tự.",
  },
  InkBleed: {
    title: "Loang mực",
    doc: "Phát hiện biên nét chữ và làm mực nhòe loang ra xung quanh như in trên giấy thấm hút mạnh.",
  },
  InkColorSwap: {
    title: "Đổi màu mực in",
    doc: "Nhận diện vùng nét chữ và thay thế màu mực hiện tại sang một màu mực khác.",
  },
  InkMottling: {
    title: "Mực in lốm đốm",
    doc: "Trộn lớp nhiễu Gaussian vào bên trong nét chữ để tạo hiệu ứng mực bám không đều.",
  },
  InkShifter: {
    title: "Xô lệch nét mực",
    doc: "Làm biến dạng và xê dịch nhẹ các vùng nét mực trên bề mặt giấy.",
  },
  Jpeg: {
    title: "Nén giảm chất lượng JPEG",
    doc: "Tạo hiện tượng nhiễu khối vuông (block artifacts) đặc trưng khi lưu ảnh JPEG chất lượng thấp.",
  },
  LCDScreenPattern: {
    title: "Vân sọc màn hình LCD",
    doc: "Phủ lớp lưới sọc điểm ảnh mô phỏng tài liệu được chụp lại từ màn hình hiển thị LCD.",
  },
  LensFlare: {
    title: "Đốm lóa ống kính",
    doc: "Tạo điểm sáng chói kèm quầng tối xung quanh như ánh đèn phản xạ trực tiếp vào camera.",
  },
  Letterpress: {
    title: "In dập chữ nổi (Letterpress)",
    doc: "Mô phỏng kiểu in dập cổ điển với mật độ mực không đồng đều và lỗ rỗ nhỏ trong nét chữ.",
  },
  LightingGradient: {
    title: "Chuyển sắc ánh sáng lệch",
    doc: "Tạo dải ánh sáng mạnh yếu chuyển tiếp trên trang giấy do đèn chiếu từ một phía.",
  },
  LinesDegradation: {
    title: "Suy hao đường kẻ",
    doc: "Làm đứt đoạn hoặc mờ nhạt các đường kẻ bảng biểu và nét vẽ mảnh trên tài liệu.",
  },
  LowInkPeriodicLines: {
    title: "Sọc thiếu mực định kỳ",
    doc: "Tạo các đường sọc mất mực lặp lại theo chu kỳ đều đặn khắp chiều dài trang in.",
  },
  LowInkRandomLines: {
    title: "Sọc thiếu mực ngẫu nhiên",
    doc: "Thêm các vệt sọc đứt mực xuất hiện ở vị trí ngẫu nhiên như đầu in bị tắc mực.",
  },
  LowLightNoise: {
    title: "Nhiễu chụp thiếu sáng",
    doc: "Mô phỏng ảnh tài liệu chụp trong môi trường thiếu sáng với hạt nhiễu cảm biến rõ rệt.",
  },
  Markup: {
    title: "Bút đánh dấu văn bản",
    doc: "Tự động tìm dòng chữ để thêm vết bút dạ quang tô sáng, gạch chân hoặc gạch xóa.",
  },
  Moire: {
    title: "Vân sóng giao thoa Moiré",
    doc: "Phủ hiệu ứng vân gợn sóng giao thoa Moiré thường xuất hiện khi quét lại ảnh in hoặc màn hình.",
  },
  NoiseTexturize: {
    title: "Vân nhiễu chất liệu giấy",
    doc: "Tạo lớp họa tiết nhiễu ngẫu nhiên mô phỏng độ nhám và sợi của giấy in.",
  },
  NoisyLines: {
    title: "Kẻ sọc nhiễu",
    doc: "Vẽ các đường kẻ ngang hoặc dọc có nhiễu đứt quãng theo khoảng cách cố định trên trang.",
  },
  PageBorder: {
    title: "Viền mép & chồng trang",
    doc: "Tạo hiệu ứng viền đen mép trang hoặc các lớp mép giấy xếp chồng lệch nhau ở rìa ảnh.",
  },
  PatternGenerator: {
    title: "Hoa văn nền giả tinh thể",
    doc: "Sinh lớp hoa văn hình học đối xứng giả tinh thể (quasicrystal) phủ mờ lên nền giấy.",
  },
  ReflectedLight: {
    title: "Vùng lóa phản chiếu ánh sáng",
    doc: "Vẽ các vùng sáng hình elip mô phỏng ánh đèn phản xạ trên bề mặt giấy bóng hoặc bìa nilon.",
  },
  Rescale: {
    title: "Thay đổi mật độ điểm ảnh (DPI)",
    doc: "Co giãn lại kích thước ảnh theo chỉ số DPI mục tiêu để giả lập độ phân giải máy quét.",
  },
  Scribbles: {
    title: "Chữ viết & nét gạch nguệch ngoạc",
    doc: "Thêm các nét bút vẽ tay, chữ viết đè hoặc vòng tròn ghi chú nguệch ngoạc lên tài liệu.",
  },
  SectionShift: {
    title: "Trượt lệch phân đoạn ảnh",
    doc: "Dịch chuyển một hoặc nhiều dải hình ảnh theo chiều ngang/dọc như khi giấy bị giật lúc quét.",
  },
  ShadowCast: {
    title: "Bóng đổ lên mặt giấy",
    doc: "Mô phỏng bóng râm của bàn tay, điện thoại hoặc vật cản che nguồn sáng đổ lên tài liệu.",
  },
  Squish: {
    title: "Ép co dòng hoặc cột",
    doc: "Cắt bỏ một số dải ngang/dọc làm nội dung bị ép sát vào nhau như giấy trượt qua trục kéo.",
  },
  Stains: {
    title: "Vết ố & loang nước",
    doc: "Tạo các mảng vết ố vàng, cà phê hoặc vết ẩm mốc hòa trộn tự nhiên lên bề mặt giấy.",
  },
  SubtleNoise: {
    title: "Nhiễu hạt mịn",
    doc: "Thêm lớp nhiễu hạt tinh tế mô phỏng sai số cảm biến khi quét các mảng màu đồng nhất.",
  },
  VoronoiTessellation: {
    title: "Vân lưới đa giác Voronoi",
    doc: "Sinh mạng lưới các ô đa giác Voronoi ngẫu nhiên để tạo họa tiết vân rạn trên nền giấy.",
  },
  WaterMark: {
    title: "Đóng dấu chữ chìm (Watermark)",
    doc: "Chèn dòng chữ hoặc con dấu mờ (watermark) nằm chéo dưới nội dung tài liệu.",
  },

  // === Albumentations (95) ===
  AdditiveNoise: {
    title: "Nhiễu cộng tính",
    doc: "Cộng thêm nhiễu ngẫu nhiên vào các kênh màu dựa trên phân phối xác suất cấu hình.",
  },
  AdvancedBlur: {
    title: "Làm mờ Gaussian nâng cao",
    doc: "Làm mờ ảnh bằng bộ lọc Gaussian tổng quát với góc xoay và độ lệch chuẩn ngẫu nhiên.",
  },
  Affine: {
    title: "Biến đổi Affine",
    doc: "Áp dụng phép biến đổi hình học Affine gồm tịnh tiến, co giãn, xoay và kéo nghiêng.",
  },
  AutoContrast: {
    title: "Tự động cân bằng tương phản",
    doc: "Tự động kéo giãn dải mức xám để tối ưu hóa độ tương phản sáng tối của bức ảnh.",
  },
  Blur: {
    title: "Làm mờ cơ bản (Box Blur)",
    doc: "Làm mờ đồng đều ảnh đầu vào bằng nhân lọc hình vuông kích thước ngẫu nhiên.",
  },
  CLAHE: {
    title: "Tăng tương phản cục bộ (CLAHE)",
    doc: "Cân bằng biểu đồ sáng thích nghi có giới hạn độ tương phản giúp làm rõ nét chữ mờ.",
  },
  CenterCrop: {
    title: "Cắt vùng trung tâm",
    doc: "Cắt lấy vùng hình ảnh nằm ở chính giữa trang theo chiều rộng và chiều cao chỉ định.",
  },
  ChannelDropout: {
    title: "Loại bỏ kênh màu",
    doc: "Ngẫu nhiên xóa toàn bộ thông tin của một kênh màu trong ảnh.",
  },
  ChannelShuffle: {
    title: "Tráo đổi kênh màu RGB",
    doc: "Hoán đổi ngẫu nhiên thứ tự các kênh màu Đỏ, Lục, Lam của bức ảnh.",
  },
  ChromaticAberration: {
    title: "Quang sai viền màu",
    doc: "Tạo hiện tượng lệch kênh màu đỏ và xanh lam ở rìa chi tiết giống quang sai thấu kính.",
  },
  CoarseDropout: {
    title: "Che khuất ô chữ nhật",
    doc: "Ngẫu nhiên che đen các vùng hình chữ nhật rải rác trên ảnh để kiểm thử khả năng phục hồi.",
  },
  ColorJitter: {
    title: "Biến thiên màu sắc tổng hợp",
    doc: "Thay đổi ngẫu nhiên đồng thời độ sáng, độ tương phản, độ bão hòa và sắc thái màu.",
  },
  Crop: {
    title: "Cắt vùng theo tọa độ",
    doc: "Cắt lấy một khung hình chữ nhật cụ thể dựa trên tọa độ giới hạn bốn cạnh.",
  },
  CropAndPad: {
    title: "Cắt bớt & đệm thêm viền",
    doc: "Kết hợp cắt xén hoặc chèn thêm lề vào các cạnh ảnh theo số pixel hoặc tỷ lệ phần trăm.",
  },
  D4: {
    title: "Đối xứng nhóm hình học D4",
    doc: "Áp dụng một trong 8 phép xoay và lật đối xứng bảo toàn hình dạng của nhóm nhị diện D4.",
  },
  Defocus: {
    title: "Nhòe do mất nét (Defocus)",
    doc: "Mô phỏng hiện tượng ảnh bị mờ tròn do ống kính máy ảnh lấy nét sai khoảng cách.",
  },
  Downscale: {
    title: "Giảm độ phân giải ảnh",
    doc: "Làm giảm độ sắc nét bằng cách thu nhỏ kích thước ảnh rồi phóng to trở lại như cũ.",
  },
  ElasticTransform: {
    title: "Biến dạng đàn hồi",
    doc: "Làm uốn lượn và biến dạng cục bộ các nét chữ như nhìn qua bề mặt gợn sóng.",
  },
  Emboss: {
    title: "Hiệu ứng chạm nổi (Emboss)",
    doc: "Làm nổi khối các đường biên và nét chữ trên nền phẳng theo hướng chiếu sáng.",
  },
  Equalize: {
    title: "Cân bằng biểu đồ sáng (Histogram)",
    doc: "Phân bố lại toàn bộ biểu đồ cường độ sáng để tăng độ tách bạch giữa nền và chữ.",
  },
  Erasing: {
    title: "Xóa mảng ngẫu nhiên",
    doc: "Xóa ngẫu nhiên một vùng hình chữ nhật trên trang ảnh (kỹ thuật Random Erasing).",
  },
  FancyPCA: {
    title: "Biến đổi màu theo thành phần chính (PCA)",
    doc: "Điều chỉnh sắc độ ảnh bằng cách thêm bội số ngẫu nhiên theo các vector riêng PCA của kênh RGB.",
  },
  FrequencyMasking: {
    title: "Che dải theo trục tần số",
    doc: "Đặt một dải che khuất nằm ngang trên miền biểu diễn của ảnh.",
  },
  FromFloat: {
    title: "Quy đổi từ số thực sang số nguyên",
    doc: "Nhân dải giá trị số thực [0, 1] về lại mức điểm ảnh nguyên dương chuẩn.",
  },
  GaussNoise: {
    title: "Nhiễu hạt Gaussian",
    doc: "Thêm nhiễu hạt ngẫu nhiên tuân theo phân phối chuẩn Gaussian lên toàn bộ bức ảnh.",
  },
  GaussianBlur: {
    title: "Làm mờ Gaussian",
    doc: "Làm mờ mượt bức ảnh bằng bộ lọc nhân hàm Gauss kích thước ngẫu nhiên.",
  },
  GlassBlur: {
    title: "Nhòe xuyên qua kính nhám",
    doc: "Xáo trộn cục bộ các điểm ảnh lân cận tạo cảm giác nhìn tài liệu qua lớp kính mờ.",
  },
  GridDistortion: {
    title: "Biến dạng uốn lưới",
    doc: "Chia ảnh thành lưới tọa độ và kéo giãn các mắt lưới làm cong vênh dòng chữ.",
  },
  GridDropout: {
    title: "Che khuất theo mạng lưới",
    doc: "Xóa các ô vuông sắp xếp theo hàng cột đều đặn như mạng lưới trên bề mặt ảnh.",
  },
  GridElasticDeform: {
    title: "Biến dạng đàn hồi theo mắt lưới",
    doc: "Làm cong đàn hồi bức ảnh thông qua phép nội suy trên lưới điểm điều khiển.",
  },
  HEStain: {
    title: "Biến đổi tông màu nhuộm H&E",
    doc: "Áp dụng phép biến đổi màu sắc mô phỏng kỹ thuật nhuộm Hematoxylin và Eosin.",
  },
  HorizontalFlip: {
    title: "Lật ngang ảnh",
    doc: "Lật ngược bức ảnh theo phương ngang (đối xứng gương qua trục dọc).",
  },
  HueSaturationValue: {
    title: "Đổi sắc thái, độ bão hòa & độ sáng (HSV)",
    doc: "Dịch chuyển ngẫu nhiên ba kênh Tông màu (Hue), Độ bão hòa (Saturation) và Độ sáng (Value).",
  },
  ISONoise: {
    title: "Nhiễu cảm biến camera (ISO cao)",
    doc: "Mô phỏng nhiễu hạt màu và nhiễu độ chói khi chụp tài liệu bằng điện thoại ở ISO cao.",
  },
  Illumination: {
    title: "Biến thiên nguồn chiếu sáng",
    doc: "Mô phỏng sự thay đổi cường độ và hướng chiếu sáng dạng góc, đường thẳng hoặc đốm sáng.",
  },
  ImageCompression: {
    title: "Nén ảnh mất dữ liệu (JPEG/WebP)",
    doc: "Làm suy giảm chất lượng chi tiết văn bản do nén ảnh ở mức chất lượng thấp.",
  },
  InvertImg: {
    title: "Đảo ngược màu (Âm bản)",
    doc: "Lấy giá trị tối đa trừ đi giá trị từng điểm ảnh để tạo bản âm bản (nền tối chữ sáng).",
  },
  LongestMaxSize: {
    title: "Chuẩn hóa theo cạnh dài nhất",
    doc: "Co giãn toàn bộ ảnh sao cho cạnh dài nhất khớp với kích thước giới hạn chỉ định.",
  },
  MedianBlur: {
    title: "Làm mờ trung vị (Median)",
    doc: "Thay mỗi điểm ảnh bằng giá trị trung vị vùng lân cận, làm tròn góc chữ và lọc hạt lẻ.",
  },
  Morphological: {
    title: "Biến đổi hình thái học (Co/Giãn nét)",
    doc: "Thực hiện phép giãn nở (dilation) hoặc ăn mòn (erosion) làm nét chữ mảnh đi hoặc đậm đặc hơn.",
  },
  MotionBlur: {
    title: "Nhòe do chuyển động (Motion Blur)",
    doc: "Làm nhòe ảnh theo một hướng tuyến tính như khi tay cầm máy ảnh bị rung lúc chụp.",
  },
  MultiplicativeNoise: {
    title: "Nhiễu nhân tính",
    doc: "Nhân giá trị điểm ảnh với hệ số ngẫu nhiên làm biến thiên cường độ sáng từng điểm.",
  },
  Normalize: {
    title: "Chuẩn hóa giá trị điểm ảnh",
    doc: "Chia và chuẩn hóa phân bố cường độ điểm ảnh theo công thức chuẩn hóa chọn trước.",
  },
  OpticalDistortion: {
    title: "Méo quang học ống kính",
    doc: "Mô phỏng hiện tượng phồng tâm (barrel) hoặc lõm tâm (pincushion) của ống kính góc rộng.",
  },
  Pad: {
    title: "Đệm thêm lề ảnh",
    doc: "Mở rộng thêm phần viền đệm vào bốn cạnh trên, dưới, trái, phải của trang ảnh.",
  },
  PadIfNeeded: {
    title: "Đệm viền đạt kích thước tối thiểu",
    doc: "Tự động chèn thêm lề nếu chiều rộng hoặc chiều cao ảnh nhỏ hơn mức quy định.",
  },
  Perspective: {
    title: "Biến dạng phối cảnh 3D",
    doc: "Áp dụng phép chiếu phối cảnh 4 điểm mô phỏng góc chụp nghiêng từ camera cầm tay.",
  },
  PiecewiseAffine: {
    title: "Biến dạng Affine từng mảng",
    doc: "Dịch chuyển cục bộ các điểm nút trên lưới để tạo độ nhăn và gợn nhẹ trên trang giấy.",
  },
  PixelDropout: {
    title: "Rơi rớt điểm ảnh ngẫu nhiên",
    doc: "Đặt ngẫu nhiên một tỷ lệ nhỏ các điểm ảnh rải rác trên trang về giá trị màu rỗng.",
  },
  PlanckianJitter: {
    title: "Lệch nhiệt độ màu ánh sáng (Planckian)",
    doc: "Mô phỏng thay đổi nhiệt độ màu nguồn sáng từ vàng ấm sang xanh lạnh theo phổ Planck.",
  },
  PlasmaBrightnessContrast: {
    title: "Loang sáng tối dạng Plasma",
    doc: "Biến thiên độ sáng và tương phản từng vùng trên trang theo đám mây phân hình Plasma.",
  },
  PlasmaShadow: {
    title: "Bóng tối loang lổ Plasma",
    doc: "Tạo các vùng bóng râm tự nhiên bằng họa tiết phân hình thuật toán Diamond–Square.",
  },
  Posterize: {
    title: "Giảm bậc màu (Posterize)",
    doc: "Giảm số bit màu trên mỗi kênh làm giảm số lượng sắc độ chuyển tiếp trong ảnh.",
  },
  RGBShift: {
    title: "Lệch cân bằng kênh RGB",
    doc: "Cộng thêm độ lệch ngẫu nhiên độc lập vào từng kênh màu Đỏ, Lục và Lam.",
  },
  RandomBrightnessContrast: {
    title: "Độ sáng & tương phản ngẫu nhiên",
    doc: "Tăng giảm ngẫu nhiên độ sáng và độ tương phản chung của bức ảnh đầu vào.",
  },
  RandomCrop: {
    title: "Cắt khung ảnh ngẫu nhiên",
    doc: "Cắt lấy một vùng hình chữ nhật tại vị trí ngẫu nhiên trên bức ảnh gốc.",
  },
  RandomCropFromBorders: {
    title: "Cắt xén lề ngẫu nhiên",
    doc: "Cắt bớt một phần rìa ở bốn cạnh ảnh theo tỷ lệ ngẫu nhiên mà không co giãn lại.",
  },
  RandomFog: {
    title: "Phủ lớp mờ sương mù",
    doc: "Thêm lớp màn trắng mờ đục làm giảm độ tương phản như ống kính bị hấp hơi nước.",
  },
  RandomGamma: {
    title: "Biến thiên Gamma ngẫu nhiên",
    doc: "Áp dụng hiệu chỉnh gamma với hệ số ngẫu nhiên làm thay đổi độ sáng vùng trung tính.",
  },
  RandomGravel: {
    title: "Vết bụi đá & mảnh vụn",
    doc: "Thêm các đốm hạt thô ráp giống mảnh vụn hoặc vết bẩn bám trên mặt tài liệu.",
  },
  RandomGridShuffle: {
    title: "Xáo trộn các ô lưới ảnh",
    doc: "Chia bức ảnh thành lưới các ô đều nhau và tráo đổi ngẫu nhiên vị trí giữa chúng.",
  },
  RandomRain: {
    title: "Hiệu ứng vệt mưa rơi",
    doc: "Vẽ các tia nước mưa xiên góc kèm giảm nhẹ độ sáng trên bề mặt bức ảnh.",
  },
  RandomResizedCrop: {
    title: "Cắt ngẫu nhiên & đưa về cỡ chuẩn",
    doc: "Cắt một vùng tỷ lệ ngẫu nhiên trên ảnh rồi co giãn về kích thước đầu ra quy định.",
  },
  RandomRotate90: {
    title: "Xoay bội số góc 90°",
    doc: "Xoay ngẫu nhiên bức ảnh theo các góc vuông 0°, 90°, 180° hoặc 270°.",
  },
  RandomScale: {
    title: "Phóng to / thu nhỏ ngẫu nhiên",
    doc: "Thay đổi kích thước bức ảnh theo một hệ số tỷ lệ được chọn ngẫu nhiên.",
  },
  RandomShadow: {
    title: "Bóng râm đa giác ngẫu nhiên",
    doc: "Phủ các vùng bóng tối hình đa giác làm giảm độ sáng một phần trang tài liệu.",
  },
  RandomSizedCrop: {
    title: "Cắt vùng cỡ ngẫu nhiên & co giãn",
    doc: "Cắt một khung hình kích thước ngẫu nhiên rồi co giãn về chiều rộng và cao chỉ định.",
  },
  RandomSnow: {
    title: "Phủ sáng trắng như tuyết",
    doc: "Làm lóa sáng các mảng trên ảnh mô phỏng hiện tượng phủ tuyết hoặc cháy sáng nền.",
  },
  RandomSunFlare: {
    title: "Chói nắng & vòng phản quang",
    doc: "Thêm nguồn sáng chói lòa kèm chuỗi vòng tròn phản xạ quang học trên bức ảnh.",
  },
  RandomToneCurve: {
    title: "Biến đổi đường cong sắc độ",
    doc: "Uốn đường cong ánh xạ sáng tối (Tone Curve) làm thay đổi tương quan vùng sáng và vùng tối.",
  },
  Resize: {
    title: "Đổi về kích thước cố định",
    doc: "Co giãn bức ảnh về đúng chiều cao và chiều rộng điểm ảnh được cấu hình.",
  },
  RingingOvershoot: {
    title: "Nhiễu gợn sóng quanh biên chữ",
    doc: "Tạo hiệu ứng bóng gợn sóng (ringing/overshoot) dọc theo cạnh nét chữ sắc nét.",
  },
  Rotate: {
    title: "Xoay góc nghiêng tùy ý",
    doc: "Xoay nghiêng bức ảnh theo một góc chọn ngẫu nhiên từ phân phối đều.",
  },
  SafeRotate: {
    title: "Xoay nghiêng giữ trọn khung",
    doc: "Xoay nghiêng ảnh và tự động thu nhỏ tỷ lệ để bốn góc trang không bị cắt mất.",
  },
  SaltAndPepper: {
    title: "Nhiễu hạt muối tiêu",
    doc: "Rải ngẫu nhiên các điểm ảnh trắng tinh và đen đặc lên khắp bề mặt bức ảnh.",
  },
  Sharpen: {
    title: "Tăng độ sắc nét",
    doc: "Làm sắc nét biên dạng chữ và chi tiết ảnh bằng nhân lọc tích chập.",
  },
  ShiftScaleRotate: {
    title: "Dịch chuyển, thu phóng & xoay",
    doc: "Áp dụng đồng thời ba phép biến đổi: tịnh tiến vị trí, đổi tỷ lệ và xoay góc nghiêng.",
  },
  ShotNoise: {
    title: "Nhiễu hạt lượng tử (Shot Noise)",
    doc: "Mô phỏng nhiễu hạt quang học tuân theo phân phối Poisson khi thu nhận ánh sáng.",
  },
  SmallestMaxSize: {
    title: "Chuẩn hóa theo cạnh ngắn nhất",
    doc: "Co giãn toàn bộ ảnh sao cho cạnh ngắn nhất khớp với kích thước mục tiêu.",
  },
  Solarize: {
    title: "Đảo sắc vùng sáng (Solarize)",
    doc: "Đảo ngược giá trị màu của mọi điểm ảnh có độ sáng vượt quá ngưỡng thiết lập.",
  },
  Spatter: {
    title: "Vết bắn bùn & giọt nước",
    doc: "Mô phỏng vết bùn đất hoặc giọt nước bắn bám lên ống kính hoặc mặt trang giấy.",
  },
  SquareSymmetry: {
    title: "Biến đổi đối xứng hình vuông",
    doc: "Áp dụng ngẫu nhiên một trong 8 phép đối xứng hình vuông lên bức ảnh.",
  },
  Superpixels: {
    title: "Gom mảng siêu điểm ảnh (Superpixels)",
    doc: "Thay thế từng nhóm điểm ảnh lân cận bằng màu trung bình tạo hiệu ứng mảng ghép.",
  },
  ThinPlateSpline: {
    title: "Uốn cong bề mặt mượt (TPS)",
    doc: "Áp dụng phép biến dạng tấm mỏng (Thin Plate Spline) tạo độ cong phồng tự nhiên cho trang giấy.",
  },
  TimeMasking: {
    title: "Che dải theo trục ngang",
    doc: "Đặt một dải băng che khuất dọc theo trục thời gian/chiều ngang của ảnh.",
  },
  TimeReverse: {
    title: "Đảo ngược trục ngang",
    doc: "Lật ngược trình tự điểm ảnh dọc theo trục thời gian của ảnh.",
  },
  ToFloat: {
    title: "Chuyển sang biểu diễn số thực",
    doc: "Chia giá trị điểm ảnh cho mức tối đa để đưa về miền số thực dấu phẩy động.",
  },
  ToGray: {
    title: "Chuyển sang ảnh đen trắng (Độ xám)",
    doc: "Loại bỏ thông tin màu sắc, chuyển bức ảnh về thang độ xám (grayscale).",
  },
  ToRGB: {
    title: "Đưa về định dạng 3 kênh RGB",
    doc: "Chuyển đổi ảnh đơn sắc về định dạng 3 kênh màu RGB tiêu chuẩn.",
  },
  ToSepia: {
    title: "Nhuộm màu nâu cổ điển (Sepia)",
    doc: "Áp dụng bộ lọc màu nâu vàng hoài cổ lên toàn bộ trang tài liệu.",
  },
  Transpose: {
    title: "Chuyển vị hàng & cột ảnh",
    doc: "Hoán đổi vị trí giữa các hàng và các cột của ma trận điểm ảnh (lật qua đường chéo chính).",
  },
  UnsharpMask: {
    title: "Làm nét viền (Unsharp Mask)",
    doc: "Tăng độ sắc nét bằng cách tách phần chi tiết tần số cao và cộng chồng lên ảnh gốc.",
  },
  VerticalFlip: {
    title: "Lật dọc ảnh",
    doc: "Lật ngược bức ảnh từ trên xuống dưới (đối xứng qua trục ngang).",
  },
  XYMasking: {
    title: "Che dải sọc ngang & dọc",
    doc: "Đặt đồng thời các dải băng che khuất theo cả chiều ngang (X) và chiều dọc (Y).",
  },
  ZoomBlur: {
    title: "Nhòe hướng tâm (Zoom Blur)",
    doc: "Tạo hiệu ứng nhòe tỏa tròn từ tâm ra ngoài như khi phóng ống kính lúc đang chụp.",
  },
};

export function getEffectNameFromId(nameOrId: string): string {
  const clean = nameOrId.trim();
  const dotIdx = clean.lastIndexOf(".");
  return dotIdx !== -1 ? clean.slice(dotIdx + 1) : clean;
}

export function getEffectTitleVi(effectOrName: CatalogEffect | string): string {
  const rawName = typeof effectOrName === "string" ? getEffectNameFromId(effectOrName) : effectOrName.name;
  return EFFECT_VI_MAP[rawName]?.title || rawName;
}

export function getEffectDocVi(effect: CatalogEffect): string {
  return EFFECT_VI_MAP[effect.name]?.doc || effect.doc;
}

/**
 * Formats a single or combined effect label (e.g. "InkBleed+Folding #2") into Vietnamese
 * (e.g. "Loang mực + Nếp gấp trang giấy #2").
 */
export function formatEffectLabelVi(rawLabel: string): string {
  if (!rawLabel) return "";
  const repeatMatch = rawLabel.match(/^(.*?)\s+(#\d+)$/);
  const basePart = repeatMatch ? repeatMatch[1] : rawLabel;
  const suffixPart = repeatMatch ? ` ${repeatMatch[2]}` : "";

  const parts = basePart.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return rawLabel;

  const translated = parts.map((p) => getEffectTitleVi(p));
  return `${translated.join(" + ")}${suffixPart}`;
}
