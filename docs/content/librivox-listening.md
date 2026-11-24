# Bài nghe từ sách nói LibriVox

Hai bài thuộc mục **Luyện tập → Nghe → B2**. Người học nghe một người kể chuyện, trả lời năm câu hỏi và có thể nghe lại đúng đoạn làm căn cứ khi chữa bài. Mức B2 là ước lượng biên tập theo tốc độ kể, từ vựng và độ phức tạp của câu. Các bài chưa được thử nghiệm xếp mức với người học.

| Bài | Tác phẩm và chương | Người đọc | Các đoạn trong Mini LibriSpeech |
| --- | --- | --- | --- |
| Aboard the Valkyrie | Jules Verne, *Journey to the Centre of the Earth*, chương 6 “Our Voyage to Iceland” | [badey](https://librivox.org/reader/6241) | `6241-61943`, đoạn 0000 rồi 0008–0012 |
| A Walk Underground | Jane Andrews, *The Stories Mother Nature Told Her Children*, chương 11 “A Peep Into One of God's Storehouses” | [aquielisunari](https://librivox.org/reader/2803) | `2803-161169`, đoạn 0004–0007 |

Nguồn âm thanh là sách do tình nguyện viên LibriVox đọc, được dự án LibriSpeech của Vassil Panayotov và cộng sự chia thành từng đoạn kèm transcript. Mini LibriSpeech phát hành các đoạn này theo CC BY 4.0. LingoRoad tuyển đoạn từ cùng chương, giữ tốc độ và cao độ gốc, ghép theo thứ tự nguồn với khoảng nghỉ 250 ms, chuyển FLAC sang WAV và bổ sung dấu câu, bản dịch, từ vựng và câu hỏi. Tệp WAV chứa thông tin ghi công và liên kết giấy phép trong trường RIFF INFO. [OpenSLR 31](https://www.openslr.org/31/) · [LibriSpeech](https://www.openslr.org/12/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Tạo lại học liệu

Từ thư mục gốc, chạy `uv run scripts/import-librivox-listening.py`. Có thể thêm `--archive <đường-dẫn-dev-clean-2.tar.gz>` để dùng bản tải sẵn. Script kiểm tra SHA-256 của gói nguồn và đối chiếu từng đoạn tiếng Anh với transcript trước khi tạo WAV và cập nhật mốc thời gian. Hai tệp WAV đã có trong repo để backend phục vụ khi chạy app.

## Nguồn cho các bài tiếp theo

Tatoeba phù hợp với bài phân biệt âm hoặc nghe câu ngắn ở mức cơ bản. Khi tuyển âm thanh từ bảng xuất dữ liệu, cần kiểm tra giấy phép và thông tin ghi công của từng bản thu riêng với giấy phép câu chữ. Các câu độc lập cần được biên soạn theo một tình huống trước khi dùng làm bài nghe hiểu. [Tatoeba Downloads](https://tatoeba.org/en/downloads) · [Điều khoản sử dụng](https://tatoeba.org/en/terms_of_use)
