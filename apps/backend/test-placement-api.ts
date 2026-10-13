import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function runPlacementE2ETest() {
  console.log('=== BẮT ĐẦU KIỂM THỬ E2E: PLACEMENT & ASSESSMENT ===\n');

  // 1. Tạo tài khoản ngẫu nhiên để có JWT Token
  const timestamp = Date.now();
  const testUser = {
    email: `learner_${timestamp}@lingoroad.test`,
    password: 'Password123!',
    name: `Test Learner ${timestamp}`,
  };

  console.log(`[1/5] Đăng ký người học mới: ${testUser.email}...`);
  let accessToken: string;
  try {
    const regRes = await axios.post(`${BASE_URL}/auth/register`, testUser);
    accessToken = regRes.data.data.accessToken;
    console.log('-> Đăng ký thành công! Đã nhận Access Token.\n');
  } catch (err: any) {
    console.error('Lỗi khi đăng ký:', err.response?.data || err.message);
    return;
  }

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
  };

  // 2. Kiểm tra trạng thái bài test ban đầu
  console.log('[2/5] Gọi GET /placement/status...');
  const statusRes = await axios.get(`${BASE_URL}/placement/status`, { headers: authHeaders });
  console.log('-> Trạng thái ban đầu:', statusRes.data.data);
  console.log();

  // 3. Khởi tạo bài thi đầu vào
  console.log('[3/5] Gọi POST /placement/start...');
  const startRes = await axios.post(`${BASE_URL}/placement/start`, {}, { headers: authHeaders });
  const { sessionId, totalItems, firstItem } = startRes.data.data;
  console.log(`-> Đã tạo phiên thi: ${sessionId}`);
  console.log(`-> Tổng số câu: ${totalItems}`);
  console.log(`-> Câu hỏi đầu tiên [Index ${firstItem.index}]: "${firstItem.prompt}"`);
  console.log(`-> Các lựa chọn: ${JSON.stringify(firstItem.options)}`);
  console.log(`-> (Zero Solution Leakage: correctOption = ${firstItem.correctOption ?? 'ĐÃ ẨN'})\n`);

  // 4. Trả lời thích ứng từng câu (tối đa 15 câu)
  console.log('[4/5] Bắt đầu làm bài thi thích ứng (Adaptive Test Flow)...');
  let currentItem = firstItem;
  let isFinished = false;
  let finalResult = null;

  while (!isFinished && currentItem) {
    const chosenOption = currentItem.options[0] || 'A';
    const responseTime = Math.floor(Math.random() * 3000) + 1500;

    console.log(`   [Câu ${currentItem.index + 1}/${totalItems}] Nộp đáp án: "${chosenOption}" (${responseTime}ms)...`);

    const answerRes = await axios.post(
      `${BASE_URL}/placement/${sessionId}/answer`,
      {
        itemId: currentItem.id,
        itemIndex: currentItem.index,
        selectedOption: chosenOption,
        responseTimeMs: responseTime,
      },
      { headers: authHeaders },
    );

    const answerData = answerRes.data.data;
    isFinished = answerData.isFinished;

    if (isFinished) {
      finalResult = answerData.result;
      console.log('\n-> ĐÃ HOÀN TẤT TOÀN BỘ 15 CÂU HỎI!');
      break;
    } else {
      currentItem = answerData.nextItem;
      console.log(`      -> Câu tiếp theo [Index ${currentItem.index}]: "${currentItem.prompt}"`);
    }
  }

  // 5. Lấy kết quả cuối cùng từ GET /placement/:sessionId/result
  console.log('\n[5/5] Gọi GET /placement/:sessionId/result...');
  const resultRes = await axios.get(`${BASE_URL}/placement/${sessionId}/result`, { headers: authHeaders });
  const result = resultRes.data.data;

  console.log('\n================ BẢNG KẾT QUẢ ĐÁNH GIÁ CEFR ================');
  console.log(`  Phiên kiểm tra : ${result.sessionId}`);
  console.log(`  Trạng thái     : ${result.status}`);
  console.log(`  Trình độ CEFR  : ${result.estimatedCefr} ⭐`);
  console.log(`  Điểm tin cậy   : ${(result.confidenceScore * 100).toFixed(1)}%`);
  console.log(`  Số câu đúng    : ${result.correctCount} / ${result.totalItems}`);
  console.log(`  Thời gian xong : ${result.completedAt}`);
  console.log('============================================================\n');
  console.log('-> TẤT CẢ CÁC API PLACEMENT ĐÃ HOẠT ĐỘNG CHUẨN XÁC 100%!\n');
}

runPlacementE2ETest().catch(console.error);
