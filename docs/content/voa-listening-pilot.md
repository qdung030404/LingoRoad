# Lô thử Listening A1, A2 và B1

Lô đầu gồm năm bài cho **Luyện tập → Nghe** của LingoRoad. Nhóm đã thử trên MuMu và phát hành lô đầu lên Azure ngày 23/11/2026. Cấp độ trong bảng là mức mục tiêu biên tập, còn chờ duyệt độc lập và hiệu chỉnh bằng dữ liệu người học.

| Bài | Mức mục tiêu | Thời lượng | Nhiệm vụ nghe |
| --- | --- | --- | --- |
| [Anna and Her Phone](../../apps/backend/media/learning/v1/listening-pilot-voa-weather-v1.wav) | A1 | 46 giây | Nhận ra nhiệt độ, đặc điểm thời tiết và lời đáp ngắn |
| [Looking Around the Building](../../apps/backend/media/learning/v1/listening-pilot-voa-gym-v1.wav) | A2 | 82 giây | Theo dõi vị trí tương đối và những nơi đi nhầm bằng thông tin trong audio |
| [Are We Both Free?](../../apps/backend/media/learning/v1/listening-pilot-voa-friday-v1.wav) | A2 | 76 giây | Phân biệt lịch đề xuất với kế hoạch đã chốt |
| [Anna and Pete at a Café](../../apps/backend/media/learning/v1/listening-pilot-voa-skills-v1.wav) | A2 | 66 giây | So sánh các kỹ năng và xác định đề xuất cuối |
| [Pete Meets Ms. Weaver](../../apps/backend/media/learning/v1/listening-pilot-voa-interview-v1.wav) | B1 | 80 giây | Hiểu mục đích phỏng vấn, chi tiết hỗ trợ và kết quả bất ngờ |

## Nguồn và tái tạo

[Manifest](../../apps/backend/prisma/listening-content/voa-pilot/manifest.json) ghi trang nguồn, URL audio gốc, SHA-256 của MP3 và khoảng cắt. Âm thanh và lời thoại trích từ các bài hội thoại do VOA Learning English xuất bản. [Quyền sử dụng và ghi công của VOA](https://learningenglish.voanews.com/p/6861.html)

LingoRoad tuyển đoạn, chuyển sang WAV mono PCM 16-bit ở tốc độ gốc, so lời thoại VOA với các mốc từ nhận dạng giọng nói và bổ sung bản dịch, câu hỏi cùng căn cứ nghe lại. Ghi công nằm trong mô tả bài và metadata WAV. Bài thời tiết dùng giọng điện thoại của bản ghi nguồn.

```powershell
uv run scripts/import-voa-listening-pilot.py
```

Dùng `--source-dir <thư-mục-MP3>` để tái tạo từ năm MP3 đã lưu với tên `weather`, `gym`, `friday`, `skills` và `interview`. Importer kiểm checksum trước khi cắt.

## Kiểm thử trên môi trường riêng

Chuẩn bị database local `lingoroad_listening_pilot_test` trên PostgreSQL và cấu hình `DATABASE_URL` đến database đó. Từ thư mục gốc chạy migration và build, sau đó chạy seed và HTTP suite từ `apps/backend`.

```powershell
npm run prisma:migrate --workspace apps/backend
npm run build --workspace apps/backend
Set-Location apps/backend
npx --no-install ts-node prisma/seed-listening-pilot.ts --validate
npx --no-install ts-node prisma/seed-listening-pilot.ts
$env:LINGOROAD_VERIFY_LISTENING_PILOT = '1'
node --test test/listening.e2e.cjs
```

Seed riêng kiểm tra database loopback và tên đã nêu. Các bài pilot xuất hiện trong danh mục của database này sau khi seed. Luồng chấm điểm và chữa bài dùng API Learning hiện có.

## Phiếu duyệt và thử với người học

1. Nhờ hai người dạy nghe độc lập ở tốc độ gốc và gán mức dựa trên [thang nghe CEFR](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4#page=48). Kiểm tra từng mốc nghe lại, câu trả lời duy nhất, độ rõ và độ khó của câu hỏi so với audio. Đặc biệt kiểm tra các câu chỉ đường có thể trả lời bằng lời thoại và câu phỏng vấn đo được khả năng suy luận từ chi tiết.
2. Cho một nhóm nhỏ sinh viên ở A1, A2 và B1 làm bài theo cùng điều kiện, ví dụ hai lượt nghe ở tốc độ 1×. Ghi kết quả xếp mức nghe từ bài tham chiếu riêng, phương án mỗi câu, số lượt nghe, và chi tiết nào khiến họ nhầm. Dùng mã người tham gia khi tổng hợp.
3. Đối chiếu kết quả giữa hai mức liền kề. Sửa các câu có hai đáp án hợp lý, câu có thể đoán từ phần chuẩn bị hoặc câu mà nhiều người nghe tốt vẫn hiểu khác đáp án. Dữ liệu lô nhỏ dùng để sửa bài và điều chỉnh mức mục tiêu. Báo cáo kết quả duyệt và thử nghiệm cùng phiên bản audio trước khi công bố mức đã hiệu chuẩn.

## Lô thứ hai

| Bài | Mức mục tiêu | Thời lượng | Nhiệm vụ nghe |
| --- | --- | --- | --- |
| [A Visit with Marsha](../../apps/backend/media/learning/v1/listening-pilot-voa-rooms-v1.wav) | A1 | 44 giây | Nhận ra tên phòng và hoạt động được nói rõ |
| [Anna Talks to Her Colleagues](../../apps/backend/media/learning/v1/listening-pilot-voa-busy-v1.wav) | A2 | 77 giây | Ghép đúng người nói, hoạt động và thời điểm hẹn |
| [Pete Explains the Delay](../../apps/backend/media/learning/v1/listening-pilot-voa-late-v1.wav) | B1 | 84 giây | Theo dõi chuỗi sự việc, thái độ và góc nhìn của các nhân vật |

Lô thứ hai dùng [manifest riêng](../../apps/backend/prisma/listening-content/voa-pilot/wave-2/manifest.json) để duyệt trong database pilot. Thêm `--wave-2` khi chạy importer và seed, rồi đặt `LINGOROAD_VERIFY_LISTENING_WAVE_2=1` cùng biến verify pilot để chạy vòng HTTP tương ứng. Mỗi bài có năm câu và mốc nghe lại. Mức CEFR vẫn là mục tiêu biên tập.
