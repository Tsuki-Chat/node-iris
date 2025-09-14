/**
 * Message type decorators for handling different message types
 */

import { ChatContext } from '@/types/models';
import { decoratorMetadata } from './base';

/**
 * Helper function to create message handler decorators
 */
function createMessageHandlerDecorator(
  condition: (context: ChatContext) => boolean
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      if (!condition(context)) {
        return;
      }

      return originalMethod.call(this, context);
    };

    // Register metadata using function properties
    const metadata = {
      commands: [],
      hasDecorators: true,
      isMessageHandler: true,
    };

    // 여러 방식으로 메타데이터 저장 (AllowedRoom과 일관성 유지)
    decoratorMetadata.set(originalMethod, metadata);
    (originalMethod as any).__decoratorMetadata = metadata;

    return descriptor;
  };
}

/**
 * Decorator that executes on every message (regardless of command)
 * Useful for logging, monitoring, or general message processing
 */
export function OnMessage(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  // Mark as message handler for controller scanning
  const metadata = {
    commands: [],
    hasDecorators: true,
    isMessageHandler: true,
  };

  // 여러 방식으로 메타데이터 저장 (AllowedRoom과 일관성 유지)
  decoratorMetadata.set(originalMethod, metadata);
  (originalMethod as any).__decoratorMetadata = metadata;

  return descriptor;
}

/**
 * Decorator that executes only on normal text messages (type 1)
 */
export const OnNormalMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isNormalMessage()
);

/**
 * Decorator that executes only on photo messages (type 2)
 */
export const OnPhotoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isPhotoMessage()
);

/**
 * Decorator that executes only on video messages (type 3)
 */
export const OnVideoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isVideoMessage()
);

/**
 * Decorator that executes only on audio messages (type 5)
 */
export const OnAudioMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isAudioMessage()
);

/**
 * Decorator that executes only on emoticon messages (types 6, 12, 20, 25)
 */
export const OnEmoticonMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isEmoticonMessage()
);

/**
 * Decorator that executes only on map/location messages (type 16)
 */
export const OnMapMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isMapMessage()
);

/**
 * Decorator that executes only on profile messages (type 17)
 */
export const OnProfileMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isProfileMessage()
);

/**
 * Decorator that executes only on file messages (type 18)
 */
export const OnFileMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isFileMessage()
);

/**
 * Decorator that executes only on reply messages (type 26)
 */
export const OnReplyMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isReplyMessage()
);

/**
 * Decorator that executes only on multi-photo messages (type 27 - legacy)
 */
export const OnMultiPhotoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isMultiPhotoMessage()
);

/**
 * Decorator that executes only on new multi-photo messages (type 71 - modern)
 */
export const OnNewMultiPhotoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isNewMultiPhotoMessage()
);

/**
 * Decorator that executes only on any image messages (types 2, 27, 71)
 */
export const OnImageMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isImageMessage()
);

/**
 * Decorator that executes only on feed messages
 */
export const OnFeedMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isFeedMessage()
);

/**
 * Decorator that executes only on user invite feed messages
 */
export const OnInviteUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isInviteUserFeed()
);

/**
 * Decorator that executes only on user leave feed messages
 */
export const OnLeaveUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isLeaveUserFeed()
);

/**
 * Decorator that executes only on open chat join feed messages
 */
export const OnOpenChatJoinUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatJoinUserFeed()
);

/**
 * Decorator that executes only on open chat kicked user feed messages
 */
export const OnOpenChatKickedUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatKickedUserFeed()
);

/**
 * Decorator that executes only on manager promotion feed messages
 */
export const OnPromoteManagerFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatPromoteManagerFeed()
);

/**
 * Decorator that executes only on manager demotion feed messages
 */
export const OnDemoteManagerFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatDemoteManagerFeed()
);

/**
 * Decorator that executes only on delete message feed messages
 */
export const OnDeleteMessageFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isDeleteMessageFeed()
);

/**
 * Decorator that executes only on host handover feed messages
 */
export const OnHandOverHostFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatHandOverHostFeed()
);

/**
 * Decorator that executes only on hide message feed messages
 */
export const OnHideMessageFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatHideMessageFeed()
);

/**
 * Get all registered message handlers (OnMessage decorators)
 */
export function getMessageHandlers(controllerInstance: any): Function[] {
  const handlers: Function[] = [];

  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(controllerInstance)
  );
  methods.forEach((methodName) => {
    if (methodName !== 'constructor') {
      const method = controllerInstance[methodName];
      if (typeof method === 'function') {
        const metadata = decoratorMetadata.get(method);
        if (metadata && metadata.isMessageHandler) {
          handlers.push(method);
        }
      }
    }
  });

  return handlers;
}

/**
 * Get methods with @Command decorator from a controller instance
 */
export function getDecoratedMethods(controller: any): Function[] {
  const methods: Function[] = [];

  const methodNames = Object.getOwnPropertyNames(
    Object.getPrototypeOf(controller)
  );
  methodNames.forEach((methodName) => {
    if (methodName !== 'constructor') {
      const method = controller[methodName];
      if (typeof method === 'function') {
        const metadata = decoratorMetadata.get(method);
        if (metadata && metadata.hasDecorators) {
          methods.push(method);
        }
      }
    }
  });

  return methods;
}
