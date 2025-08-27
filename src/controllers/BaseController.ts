/**
 * Base Controller class for bot command handling
 */

import { ChatContext } from '../types/models';

export abstract class BaseController {
  protected kakaoLink?: any;

  constructor(kakaoLink?: any) {
    this.kakaoLink = kakaoLink;
  }

  /**
   * Get all methods with decorators from this controller
   */
  public getDecoratedMethods(): {
    methodName: string;
    method: Function;
    commands?: string[];
  }[] {
    const methods: {
      methodName: string;
      method: Function;
      commands?: string[];
    }[] = [];
    const prototype = Object.getPrototypeOf(this);
    const methodNames = Object.getOwnPropertyNames(prototype);

    for (const methodName of methodNames) {
      if (methodName === 'constructor' || methodName === 'getDecoratedMethods')
        continue;

      const method = this[methodName as keyof this];
      if (typeof method === 'function') {
        // Check if method has BotCommand metadata
        const boundMethod = method.bind(this);

        // For now, we'll scan all methods and let the Bot class handle the filtering
        // In the future, we could check for actual decorator metadata here
        methods.push({
          methodName,
          method: boundMethod,
        });
      }
    }

    return methods;
  }
}
