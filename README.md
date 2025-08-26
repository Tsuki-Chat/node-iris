# node-iris

Python [irispy-client](https://github.com/dolidolih/irispy-client) 모듈의 TypeScript 포팅 버전입니다. 카카오톡 봇 개발을 위한 기능을 제공합니다.

## 설치

```bash
npm install @racla-dev/node-iris
# 또는
pnpm install @racla-dev/node-iris
```

## 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음과 같이 설정하세요:

```env
# Iris 서버 URL (IP:PORT 형식)
IRIS_URL=127.0.0.1:3000

# 최대 워커 스레드 수 (선택사항)
MAX_WORKERS=4

# 차단된 사용자 ID 목록 (쉼표로 구분, 선택사항)
BANNED_USERS=123456789,987654321
```

## 기본 사용법

### 봇 생성 및 실행

```typescript
import { Bot, ChatContext } from '@racla-dev/node-iris';

const bot = new Bot(process.env.IRIS_URL, { maxWorkers: 4 });

// 메시지 이벤트 핸들러
bot.on('message', async (context: ChatContext) => {
  if (context.message.command === '안녕') {
    await context.reply('안녕하세요!');
  }
});

// 봇 시작
await bot.run();
```

### 이벤트 종류

- `chat`: 모든 메시지
- `message`: 일반 메시지
- `new_member`: 새 멤버 참여
- `del_member`: 멤버 퇴장
- `unknown`: 알 수 없는 이벤트
- `error`: 오류 발생

### 데코레이터 사용

```typescript
import { decorators } from '@racla-dev/node-iris';

// 파라미터가 있는 경우에만 실행
const echoHandler = decorators.hasParam(async (context: ChatContext) => {
  await context.reply(`에코: ${context.message.param}`);
});

// 관리자만 실행 가능
const adminHandler = decorators.isAdmin(async (context: ChatContext) => {
  await context.reply('관리자 명령어입니다.');
});

// 답장인 경우에만 실행
const replyHandler = decorators.isReply(async (context: ChatContext) => {
  await context.reply('답장을 확인했습니다!');
});

// 차단되지 않은 사용자만 실행
const notBannedHandler = decorators.isNotBanned(
  async (context: ChatContext) => {
    await context.reply('실행 가능합니다.');
  }
);
```

### 카카오링크 사용

```typescript
import {
  IrisLink,
  KakaoLinkException,
  KakaoLinkReceiverNotFoundException,
  KakaoLinkLoginException,
  KakaoLinkSendException,
} from '@racla-dev/node-iris';

const link = new IrisLink(process.env.IRIS_URL);

try {
  // 템플릿을 사용한 메시지 전송
  await link.send(
    '내 채팅방', // receiver_name
    12345, // template_id
    { key: 'value' } // template_args
  );
} catch (error) {
  if (error instanceof KakaoLinkSendException) {
    console.error('메시지 전송 실패');
  }
}
```

#### KakaoLink 설정

환경변수에 다음을 추가하세요:

```env
KAKAOLINK_APP_KEY=your_kakao_app_key
KAKAOLINK_ORIGIN=your_origin
```

## API 참조

### Bot 클래스

#### 생성자

```typescript
new Bot(irisUrl: string, options?: { maxWorkers?: number })
```

#### 메서드

- `on(event: string, handler: Function)`: 이벤트 핸들러 등록
- `run()`: 봇 실행 (비동기)
- `stop()`: 봇 중지

### ChatContext 클래스

#### 속성

- `room`: 채팅방 정보
- `sender`: 발신자 정보
- `message`: 메시지 정보
- `raw`: 원시 데이터
- `api`: API 인스턴스

#### 메서드

- `reply(message: string, roomId?: number)`: 답장 보내기
- `replyMedia(files: Buffer[], roomId?: number)`: 미디어 파일 보내기

### Message 클래스

#### 속성

- `id`: 메시지 ID
- `type`: 메시지 타입
- `msg`: 메시지 내용
- `command`: 명령어 (첫 번째 단어)
- `param`: 매개변수 (나머지 부분)
- `hasParam`: 매개변수 존재 여부
- `image`: 이미지 정보 (있는 경우)

### User 클래스

#### 메서드

- `getName()`: 사용자 이름 조회 (비동기)
- `getType()`: 사용자 권한 조회 (비동기)

#### 사용자 권한

- `HOST`: 방장
- `MANAGER`: 관리자
- `NORMAL`: 일반 사용자
- `BOT`: 봇

### Room 클래스

#### 메서드

- `getType()`: 채팅방 타입 조회 (비동기)

### IrisLink 클래스

#### 생성자

```typescript
new IrisLink(irisUrl: string)
```

#### 메서드

- `send(receiverName, templateId, templateArgs)`: 템플릿 메시지 전송 (비동기)

#### 예외 클래스

- `KakaoLinkException`: 일반적인 KakaoLink 오류
- `KakaoLinkReceiverNotFoundException`: 받는 사람을 찾을 수 없음
- `KakaoLinkLoginException`: 로그인 관련 오류
- `KakaoLinkSendException`: 메시지 전송 오류

## 예시

자세한 사용 예시는 `examples/` 폴더를 참조하세요:

- `examples/basic-bot.ts`: 기본 봇 사용법
- `examples/kakaolink-example.ts`: 카카오링크 사용법

## 라이선스

[MIT](https://github.com/RACLA-DEV/node-iris/LICENSE)

## 참조

Irispy2 and Kakaolink by [@ye-seola](https://github.com/ye-seola)  
irispy-client by [@dolidolih](https://github.com/dolidolih)
