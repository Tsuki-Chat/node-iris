/**
 * Controller class decorators for event registration
 */

import { registerController } from './base';

/**
 * Class decorator for MessageController
 */
export function MessageController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('message', constructor);
  return constructor;
}

/**
 * Class decorator for NewMemberController
 */
export function NewMemberController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('new_member', constructor);
  return constructor;
}

/**
 * Class decorator for DeleteMemberController
 */
export function DeleteMemberController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('del_member', constructor);
  return constructor;
}

/**
 * Class decorator for ErrorController
 */
export function ErrorController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('error', constructor);
  return constructor;
}

/**
 * Class decorator for FeedController
 */
export function FeedController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('feed', constructor);
  return constructor;
}

/**
 * Class decorator for UnknownController
 */
export function UnknownController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('unknown', constructor);
  return constructor;
}

/**
 * Class decorator for ChatController (handles all chat events)
 */
export function ChatController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('chat', constructor);
  return constructor;
}
