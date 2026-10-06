# LingoRoad Mobile Folder Structure (Flutter)

Cấu trúc dự án di động chuẩn trong `src/mobile/`:

```text
lib/
├── main.dart            # Entry point
├── app.dart             # Root widget, Cấu hình Theme & Routing
├── core/                # Core logic, Network (Dio/HTTP), Di, Utils
├── config/              # App config (Routes, Constants, Enums)
├── data/                # Data layer (Models, Repositories, Data sources)
├── features/            # Các tính năng chính (Feature-based structure)
│   ├── auth/            # Tính năng xác thực
│   │   ├── presentation/# UI (Screens, Widgets)
│   │   └── providers/   # State Management
│   └── home/            # Tính năng trang chủ
└── shared/              # Thành phần UI dùng chung
    ├── widgets/         # Custom Widgets (Buttons, Inputs...)
    └── theme/           # App Colors, TextStyles, Spacing, Radius
```
