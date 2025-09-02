# Batch Processing and Scheduling Features

node-iris 라이브러리에 추가된 배치 처리 및 스케줄링 기능을 설명합니다.

## 새로 추가된 기능

### 1. BatchController (@BatchController)
특정 시간 간격으로 채팅 메시지들을 배치 단위로 처리할 수 있는 컨트롤러입니다.

### 2. BootstrapController (@BootstrapController)
봇 시작 시 초기화 작업을 수행하는 컨트롤러입니다.

### 3. 스케줄링 데코레이터들
- `@Schedule(interval, scheduleId?)`: 배치 처리 스케줄 설정
- `@ScheduleMessage(key)`: 예약 메시지 처리
- `@Bootstrap(priority)`: 부트스트랩 초기화 설정

## 사용 방법

### BatchController 예제

```typescript
import { BatchController, Schedule, ScheduleMessage } from 'node-iris';
import { ChatContext } from 'node-iris';

@BatchController
export class MyBatchController {
  @Schedule(5000) // 5초마다 실행
  async processBatchedMessages(contexts: ChatContext[]) {
    console.log(`Processing ${contexts.length} batched messages`);
    
    for (const context of contexts) {
      const senderName = await context.sender.getName();
      const message = context.message.msg;
      console.log(`Batch processing: ${senderName} - ${message}`);
    }
  }

  @Schedule(30000, 'daily-summary') // 30초마다, 커스텀 ID
  async generateDailySummary(contexts: ChatContext[]) {
    if (contexts.length === 0) return;
    
    const uniqueUsers = new Set();
    contexts.forEach(async ctx => {
      const senderName = await ctx.sender.getName();
      uniqueUsers.add(senderName);
    });
    
    console.log(`Summary: ${contexts.length} messages from ${uniqueUsers.size} users`);
  }

  @ScheduleMessage('reminder')
  async handleReminderMessages(scheduledMessage: ScheduledMessage) {
    console.log(`Processing reminder: ${scheduledMessage.message}`);
    
    // 반복 알림 설정
    if (scheduledMessage.metadata?.recurring) {
      const nextTime = Date.now() + scheduledMessage.metadata.interval;
      const scheduler = BatchScheduler.getInstance();
      scheduler.scheduleMessage(
        scheduledMessage.id + '_next',
        scheduledMessage.roomId,
        scheduledMessage.message,
        nextTime,
        scheduledMessage.metadata
      );
    }
  }
}
```

### BootstrapController 예제

```typescript
import { BootstrapController, Bootstrap } from 'node-iris';

@BootstrapController
export class MyBootstrapController {
  @Bootstrap(100) // 높은 우선순위 (먼저 실행)
  async initializeDatabase() {
    console.log('Initializing database...');
    
    // 데이터베이스에서 예약된 메시지들 로드
    const savedSchedules = await this.loadSchedulesFromDB();
    
    const scheduler = BatchScheduler.getInstance();
    for (const schedule of savedSchedules) {
      scheduler.scheduleMessage(
        schedule.id,
        schedule.roomId,
        schedule.message,
        schedule.scheduledTime,
        { key: 'reminder', ...schedule.metadata }
      );
    }
    
    console.log(`Loaded ${savedSchedules.length} saved schedules`);
  }

  @Bootstrap(50) // 중간 우선순위
  async loadConfiguration() {
    console.log('Loading configuration...');
    // 설정 로드 로직
  }

  @Bootstrap(10) // 낮은 우선순위 (나중에 실행)
  async setupPeriodicTasks() {
    console.log('Setting up periodic tasks...');
    
    const scheduler = BatchScheduler.getInstance();
    
    // 매일 오전 9시 알림 설정
    const tomorrow9AM = new Date();
    tomorrow9AM.setDate(tomorrow9AM.getDate() + 1);
    tomorrow9AM.setHours(9, 0, 0, 0);
    
    scheduler.scheduleMessage(
      'daily-greeting',
      'room-id-here',
      '좋은 아침입니다! 😊',
      tomorrow9AM.getTime(),
      { key: 'reminder', recurring: true, interval: 24 * 60 * 60 * 1000 }
    );
  }

  private async loadSchedulesFromDB() {
    // 데이터베이스 로드 로직
    return [];
  }
}
```

### 프로그래매틱 사용법

```typescript
import { BatchScheduler } from 'node-iris';

const scheduler = BatchScheduler.getInstance();

// 즉시 메시지 스케줄링
scheduler.scheduleMessage(
  'test-message-1',
  'room123',
  '안녕하세요! 스케줄된 메시지입니다.',
  Date.now() + 10000, // 10초 후
  { type: 'test' }
);

// 특정 시간에 메시지 스케줄링
const specificTime = new Date('2024-12-25 09:00:00').getTime();
scheduler.scheduleMessage(
  'christmas-greeting',
  'room123',
  '🎄 메리 크리스마스! 🎄',
  specificTime,
  { key: 'reminder', holiday: 'christmas' }
);

// 스케줄 상태 조회
const status = scheduler.getScheduleTaskStatus('daily-summary');
console.log('Schedule status:', status);

// 예약 메시지 취소
scheduler.cancelScheduledMessage('test-message-1');
```

## 주요 특징

### 1. 자동 배치 처리
- 모든 채팅 메시지가 자동으로 등록된 스케줄 태스크의 컨텍스트 배열에 추가됩니다
- 설정된 간격마다 배치 처리 메서드가 실행됩니다

### 2. 우선순위 기반 Bootstrap
- 숫자가 높을수록 먼저 실행됩니다
- 데이터베이스 초기화, 설정 로드 등의 순서를 제어할 수 있습니다

### 3. 예약 메시지 시스템
- 특정 시간에 메시지를 자동 전송할 수 있습니다
- 메타데이터를 통해 반복 알림 등을 구현할 수 있습니다

### 4. 키 기반 메시지 핸들링
- `@ScheduleMessage(key)` 데코레이터로 특정 키의 메시지만 처리할 수 있습니다
- 메시지 타입별로 다른 처리 로직을 구현할 수 있습니다

## API 참조

### BatchScheduler 클래스

```typescript
class BatchScheduler {
  static getInstance(): BatchScheduler;
  
  registerScheduleTask(id: string, interval: number, handler: Function): void;
  scheduleMessage(id: string, roomId: string, message: string, scheduledTime: number, metadata?: any): void;
  registerBootstrapHandler(handler: Function, priority: number): void;
  
  start(): void;
  stop(): void;
  
  getScheduleTaskStatus(id: string): ScheduleTask | undefined;
  getAllScheduleTaskStatus(): Map<string, ScheduleTask>;
  getScheduledMessageStatus(id: string): ScheduledMessage | undefined;
  getAllScheduledMessageStatus(): Map<string, ScheduledMessage>;
  
  cancelScheduledMessage(id: string): boolean;
  removeScheduleTask(id: string): boolean;
}
```

### 유틸리티 함수들

```typescript
// 컨텍스트를 특정 스케줄에 추가
addContextToSchedule(scheduleId: string, context: ChatContext): void;

// 메시지 스케줄링
scheduleMessage(id: string, roomId: string, message: string, scheduledTime: number, metadata?: any): void;

// 등록된 컨트롤러 조회
getBatchControllers(): Map<string, any[]>;
getBootstrapControllers(): Map<string, any[]>;

// 메서드 정보 조회
getScheduleMethods(controller: any): Array<{method: Function, scheduleId: string, interval: number}>;
getScheduleMessageMethods(controller: any): Array<{method: Function, key: string}>;
getBootstrapMethods(controller: any): Array<{method: Function, priority: number}>;
```

## 주의사항

1. **성능 고려사항**: 배치 크기가 클 수 있으므로 처리 로직에서 성능을 고려해야 합니다.
2. **메모리 관리**: 컨텍스트 배열이 계속 쌓이므로 적절한 간격으로 처리해야 합니다.
3. **에러 처리**: 배치 처리 중 에러가 발생해도 다른 작업에 영향을 주지 않도록 try-catch를 사용하세요.
4. **데이터 지속성**: 예약 메시지는 메모리에만 저장되므로, 중요한 데이터는 데이터베이스에 별도 저장하세요.

## 실행 순서

1. Bot 인스턴스 생성
2. Bootstrap 핸들러 실행 (우선순위 순)
3. BatchScheduler 시작
4. 메시지 이벤트 수신 시 해당 스케줄 태스크에 컨텍스트 추가
5. 설정된 간격마다 배치 처리 메서드 실행
6. 예약된 시간에 도달하면 스케줄된 메시지 자동 전송
