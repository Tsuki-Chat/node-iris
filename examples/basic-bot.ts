/**
 * Example usage of Kakaotalk Bot
 * Based on Python iris.Bot reference
 */

import { Bot, ChatContext, decorators } from '../src';

// .env 파일 예시:
// IRIS_URL=127.0.0.1:3000
// MAX_WORKERS=4
// BANNED_USERS=123456789,987654321

// 환경변수에서 Iris URL을 가져옵니다
const IRIS_URL = process.env.IRIS_URL || '127.0.0.1:3000';

// Bot 인스턴스 생성
const bot = new Bot('Create-Node-Iris-App', IRIS_URL, { maxWorkers: 4 });

// 간단한 메시지 핸들러
bot.on('message', async (context: ChatContext) => {
  console.log(
    `메시지 수신: ${context.message.msg} from ${await context.sender.getName()}`
  );

  if (context.message.command === '안녕') {
    await context.reply('안녕하세요!');
  }
});

// 파라미터가 필요한 명령어 (데코레이터 사용)
const echoHandler = decorators.hasParam(async (context: ChatContext) => {
  await context.reply(`에코: ${context.message.param}`);
});

bot.on('message', async (context: ChatContext) => {
  if (context.message.command === '에코') {
    await echoHandler(context);
  }
});

// 관리자만 사용할 수 있는 명령어
const adminHandler = decorators.isAdmin(async (context: ChatContext) => {
  await context.reply('관리자 명령어가 실행되었습니다.');
});

bot.on('message', async (context: ChatContext) => {
  if (context.message.command === '관리자') {
    await adminHandler(context);
  }
});

// 답장 필요한 명령어
const replyHandler = decorators.isReply(async (context: ChatContext) => {
  await context.reply('답장을 확인했습니다!');
});

bot.on('message', async (context: ChatContext) => {
  if (context.message.command === '답장확인') {
    await replyHandler(context);
  }
});

// 차단된 사용자는 실행할 수 없는 명령어
const notBannedHandler = decorators.isNotBanned(
  async (context: ChatContext) => {
    await context.reply('차단되지 않은 사용자입니다.');
  }
);

bot.on('message', async (context: ChatContext) => {
  if (context.message.command === '상태확인') {
    await notBannedHandler(context);
  }
});

// 새 멤버 환영 메시지
bot.on('new_member', async (context: ChatContext) => {
  const userName = await context.sender.getName();
  await context.reply(`${userName}님, 환영합니다! 🎉`);
});

// 멤버 퇴장 메시지
bot.on('del_member', async (context: ChatContext) => {
  const userName = await context.sender.getName();
  await context.reply(`${userName}님이 채팅방을 나가셨습니다. 😢`);
});

// 이미지 처리
bot.on('message', async (context: ChatContext) => {
  if (context.message.image) {
    const imageCount = context.message.image.url.length;
    await context.reply(`이미지 ${imageCount}개를 감지했습니다!`);
  }
});

// 오류 처리
bot.on('error', (errorContext) => {
  console.error('오류 발생:', {
    event: errorContext.event,
    error: errorContext.exception.message,
    stack: errorContext.exception.stack,
  });
});

// 알 수 없는 이벤트 처리
bot.on('unknown', async (context: ChatContext) => {
  console.log('알 수 없는 이벤트:', context.raw);
});

// 봇 시작
async function startBot() {
  try {
    console.log('봇을 시작합니다...');
    await bot.run();
  } catch (error) {
    console.error('봇 시작 실패:', error);
    process.exit(1);
  }
}

// 종료 시그널 처리
process.on('SIGINT', () => {
  console.log('봇을 종료합니다...');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('봇을 종료합니다...');
  bot.stop();
  process.exit(0);
});

// 메인 함수가 실행되는 경우에만 봇 시작
if (require.main === module) {
  startBot();
}

export default bot;
