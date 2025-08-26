/**
 * Example usage of IrisLink for KakaoLink messages
 * Based on Python iris.kakaolink.IrisLink reference
 */

import { IrisLink } from '../src';

// .env 파일 예시:
// IRIS_URL=127.0.0.1:3000

const IRIS_URL = process.env.IRIS_URL || '127.0.0.1:3000';

async function basicExample() {
  // IrisLink 인스턴스 생성
  const link = new IrisLink(IRIS_URL);

  // 카카오링크 메시지 전송
  await link.send(
    '내 채팅방', // receiver_name
    12345, // template_id
    { key: 'value' } // template_args
  );
}

// 메인 함수
async function main() {
  try {
    await basicExample();
    console.log('카카오링크 메시지가 전송되었습니다.');
  } catch (error) {
    console.error('메시지 전송 실패:', error);
  }
}

// 스크립트로 직접 실행될 때만 예제 실행
if (require.main === module) {
  main().catch(console.error);
}

export { basicExample };
