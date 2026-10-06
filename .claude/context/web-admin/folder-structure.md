# LingoRoad Web Admin Folder Structure (Next.js)

Cấu trúc dự án Web Admin chuẩn trong thư mục `src/web-admin/`:

```text
src/
├── app/                 # Next.js App Router (Pages, Layouts)
│   ├── (auth)/          # Group routes cho xác thực (Login)
│   ├── dashboard/       # Trang tổng quan Admin
│   ├── users/           # Trang quản lý người dùng
│   └── courses/         # Trang quản lý khóa học
├── components/          # React Components dùng chung
│   ├── ui/              # Các UI component cơ sở (Button, Input, Table...)
│   └── forms/           # Các form tái sử dụng
├── hooks/               # Custom React Hooks (Quản lý state, fetch data)
├── lib/                 # Các tiện ích (Axios configs, Utils)
├── types/               # Type definitions (TypeScript interfaces)
└── styles/              # Global CSS, Tailwind config
```
