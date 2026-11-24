# Hướng Dẫn Các Lệnh Build & Chạy 1 Container Docker

Tài liệu tổng hợp các lệnh Docker phổ biến để build, khởi chạy, kiểm tra và dọn dẹp một container độc lập hoặc một service trong `docker-compose.yml` (áp dụng cho hệ sinh thái LingoRoad).

---

## 1. Build Docker Image (từ `Dockerfile`)

```bash
# Build cơ bản từ thư mục hiện tại (chứa Dockerfile)
docker build -t <ten-image>:<tag> .

# Build khi Dockerfile nằm ở thư mục con
docker build -t <ten-image>:<tag> -f <duong-dan/Dockerfile> <build-context>

# Build lại hoàn toàn không dùng cache (khi thay đổi dependencies hoặc cấu hình)
docker build --no-cache -t <ten-image>:<tag> .

# Truyền build-arg lúc build (nếu Dockerfile có khai báo ARG)
docker build --build-arg NODE_ENV=production -t <ten-image>:<tag> .
```

### Ví dụ trong dự án LingoRoad

- **Backend API** (`apps/backend/Dockerfile`):
  ```bash
  docker build -t lingoroad-backend:latest -f apps/backend/Dockerfile apps/backend
  ```
- **ML Service** (`apps/ml/Dockerfile`):
  ```bash
  docker build -t lingoroad-ml:latest -f apps/ml/Dockerfile apps/ml
  ```

---

## 2. Chạy (Run) 1 Container từ Image vừa build

```bash
# Chạy ngầm (-d), đặt tên (--name), map port (-p host:container)
docker run -d --name <ten-container> -p <port-may>:<port-container> <ten-image>:<tag>

# Chạy kèm file biến môi trường (.env) và tự khởi động lại khi lỗi
docker run -d --name <ten-container> -p 3000:3000 --env-file apps/backend/.env --restart unless-stopped <ten-image>:<tag>

# Truyền trực tiếp từng biến môi trường (-e) và gắn volume (-v)
docker run -d --name <ten-container> -p 3000:3000 -e NODE_ENV=production -v <thu-muc-may>:<thu-muc-container> <ten-image>:<tag>

# Chạy chế độ tương tác để debug rồi tự xóa container khi thoát (--rm)
docker run -it --rm -p 3000:3000 <ten-image>:<tag>
```

---

## 3. Build & chạy riêng 1 service bằng Docker Compose

Áp dụng khi dự án có file `docker-compose.yml` ở thư mục gốc:

```bash
# Chỉ build lại 1 service (ví dụ: backend)
docker compose build backend

# Build lại không dùng cache cho 1 service
docker compose build --no-cache backend

# Build và chạy riêng 1 service (kèm các service phụ thuộc như postgres, redis)
docker compose up -d --build backend

# Build và chạy chỉ đúng 1 container đó, không khởi động dependencies
docker compose up -d --build --no-deps backend
```

---

## 4. Kiểm tra, debug & quản lý Container / Image

```bash
# Liệt kê container đang chạy / tất cả container (kể cả đã dừng)
docker ps
docker ps -a

# Xem log real-time của container
docker logs -f <ten-container>
docker logs --tail 100 <ten-container>

# Mở shell bên trong container đang chạy để kiểm tra
docker exec -it <ten-container> sh
# (Hoặc bash nếu image hỗ trợ)
docker exec -it <ten-container> bash

# Dừng, khởi động lại, xóa container
docker stop <ten-container>
docker restart <ten-container>
docker rm <ten-container>        # Thêm -f để xóa ép khi đang chạy

# Quản lý image
docker images                    # Danh sách image hiện có
docker rmi <ten-image>:<tag>     # Xóa image
docker image prune -f            # Dọn các image trung gian (<none>) không còn dùng
```
