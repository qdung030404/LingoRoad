import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description:
    'Điều khoản sử dụng, quy tắc sử dụng hợp lệ, quyền sở hữu trí tuệ và cam kết vận hành dịch vụ LingoRoad.',
};

export default function TermsPage() {
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
              <FileText className="h-4 w-4 text-brand-600" />
              <span>Quy định sử dụng dịch vụ</span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
              Điều khoản sử dụng
            </h1>
            <p className="mt-2 text-sm text-slateDark-500">
              Cập nhật lần cuối: Tháng 11 năm 2026
            </p>

            <div className="mt-8 space-y-8 text-sm leading-relaxed text-slateDark-700 sm:text-base">
              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  1. Chấp nhận điều khoản
                </h2>
                <p className="mt-2">
                  Bằng việc truy cập trang thông tin hoặc sử dụng ứng dụng di động LingoRoad, bạn đồng ý tuân thủ các điều khoản sử dụng này cùng{' '}
                  <Link
                    href="/privacy"
                    className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
                  >
                    Chính sách bảo mật
                  </Link>{' '}
                  của chúng tôi. Nếu bạn không đồng ý với bất kỳ nội dung nào, vui lòng ngừng sử dụng dịch vụ.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  2. Quy tắc sử dụng hợp lệ
                </h2>
                <p className="mt-2">
                  Bạn chịu trách nhiệm bảo mật thông tin đăng nhập tài khoản của mình và cam kết sử dụng LingoRoad đúng mục đích học tập cá nhân. Nghiêm cấm các hành vi khai thác trái phép API, sử dụng công cụ tự động gây quá tải máy chủ, can thiệp vào hệ thống đánh giá năng lực hoặc đăng tải nội dung vi phạm pháp luật.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  3. Quyền sở hữu trí tuệ
                </h2>
                <p className="mt-2">
                  Toàn bộ giao diện, nhãn hiệu LingoRoad, cấu trúc bài học, ngân hàng câu hỏi, tài liệu ngữ pháp và mã nguồn thuộc quyền sở hữu hợp pháp của LingoRoad. Bạn được cấp quyền truy cập và sử dụng cho mục đích học tập cá nhân, phi thương mại; không được sao chép, phân phối lại hoặc khai thác thương mại khi chưa có sự chấp thuận bằng văn bản.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  4. Tính sẵn sàng của dịch vụ
                </h2>
                <p className="mt-2">
                  LingoRoad nỗ lực duy trì hệ thống hoạt động ổn định và liên tục cải thiện chất lượng bài học cũng như trợ lý AI. Tuy nhiên, dịch vụ có thể tạm gián đoạn trong thời gian bảo trì, nâng cấp kỹ thuật hoặc do sự cố khách quan ngoài tầm kiểm soát. Các phản hồi từ gia sư AI phục vụ mục đích hỗ trợ học tập và mang tính tham khảo.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slateDark-900">
                  5. Thay đổi điều khoản và liên hệ
                </h2>
                <p className="mt-2">
                  Chúng tôi có thể cập nhật các điều khoản này khi cần thiết để phản ánh thay đổi về tính năng hoặc quy định pháp luật. Mọi câu hỏi, góp ý hoặc yêu cầu hỗ trợ liên quan đến điều khoản sử dụng, vui lòng gửi về:{' '}
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
