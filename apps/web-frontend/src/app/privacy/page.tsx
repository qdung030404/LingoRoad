import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật',
  description:
    'Chính sách bảo mật dữ liệu tài khoản, tiến độ học tập và quy trình xử lý âm thanh luyện nói của nền tảng LingoRoad.',
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex-grow bg-slateDark-25/50 py-14 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại trang chủ</span>
          </Link>

          <article className="mt-6 rounded-3xl border border-slateDark-200 bg-white p-7 shadow-sm sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <span>Quyền riêng tư &amp; Bảo mật</span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
              Chính sách bảo mật
            </h1>
            <p className="mt-2 text-sm text-slateDark-500">
              Cập nhật lần cuối: Tháng 11 năm 2026
            </p>

            <div className="mt-8 space-y-8 text-sm leading-relaxed text-slateDark-700 sm:text-base">
              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  1. Thông tin tài khoản chúng tôi thu thập
                </h2>
                <p className="mt-2">
                  Khi bạn đăng ký và sử dụng ứng dụng di động LingoRoad, chúng tôi thu thập các thông tin cơ bản cần thiết để vận hành tài khoản gồm địa chỉ email, tên hiển thị, mật khẩu (được băm một chiều an toàn, không lưu dạng văn bản thuần) và các thiết lập mục tiêu học tập mà bạn chủ động cung cấp.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  2. Dữ liệu tiến độ học tập
                </h2>
                <p className="mt-2">
                  Để cá nhân hóa lộ trình học thích ứng, LingoRoad lưu trữ kết quả bài kiểm tra trình độ đầu vào, lịch sử làm bài tập ngữ pháp/đọc/nghe, trạng thái ghi nhớ từ vựng (FSRS), điểm kinh nghiệm và chuỗi ngày học (Streak). Dữ liệu này chỉ phục vụ việc đồng bộ tiến độ giữa các phiên học và đề xuất bài ôn tập phù hợp với năng lực thực tế của bạn.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  3. Xử lý âm thanh luyện nói (Không lưu trữ tệp âm thanh gốc)
                </h2>
                <p className="mt-2">
                  Khi bạn sử dụng tính năng luyện nói hoặc hội thoại với gia sư AI, dữ liệu âm thanh được truyền qua kết nối mã hóa để hệ thống chấm điểm phát âm và phân tích lỗi tạm thời (transient processing).{' '}
                  <strong className="font-semibold text-slateDark-900">
                    LingoRoad không lưu trữ tệp âm thanh ghi âm gốc của người dùng
                  </strong>{' '}
                  sau khi quá trình chấm điểm hoàn tất; hệ thống chỉ lưu kết quả điểm số và phản hồi dạng văn bản nhằm theo dõi sự tiến bộ của bạn.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  4. Bảo vệ và chia sẻ dữ liệu
                </h2>
                <p className="mt-2">
                  Chúng tôi không bán, trao đổi hoặc cho thuê thông tin cá nhân của người dùng cho bất kỳ bên thứ ba nào. Dữ liệu được bảo vệ bằng giao thức mã hóa khi truyền tải (HTTPS/TLS) và kiểm soát phân quyền truy cập nghiêm ngặt trong hệ thống quản trị.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  5. Quyền kiểm soát và yêu cầu xóa dữ liệu
                </h2>
                <p className="mt-2">
                  Bạn có quyền yêu cầu truy cập, chỉnh sửa thông tin cá nhân hoặc xóa vĩnh viễn tài khoản cùng toàn bộ dữ liệu học tập liên quan bất kỳ lúc nào. Để gửi yêu cầu xóa dữ liệu hoặc giải đáp thắc mắc về quyền riêng tư, vui lòng liên hệ trực tiếp qua email:{' '}
                  <a
                    href="mailto:support@lingoroad.app"
                    className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
                  >
                    support@lingoroad.app
                  </a>
                  .
                </p>
              </section>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
