/**
 * Command-related decorators for bot commands and command handling
 */

import { ChatContext } from '@/types/models';
import {
  commandRegistry,
  controllerPrefixStorage,
  decoratorMetadata,
  getRegisteredCommands,
  methodPrefixStorage,
} from './base';

/**
 * Command decorator for marking methods as event handlers
 * Required for DeleteMemberController, ErrorController, FeedController, NewMemberController, UnknownController
 */
export function Command(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  // Mark as decorated method for controller scanning
  const metadata = decoratorMetadata.get(originalMethod) || {
    commands: [],
    hasDecorators: false,
  };
  metadata.hasDecorators = true;
  decoratorMetadata.set(originalMethod, metadata);

  return descriptor;
}

/**
 * Decorator for bot commands with automatic command matching
 */
export function BotCommand(commands: string | string[], description?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // Normalize commands to array
    const commandArray = Array.isArray(commands) ? commands : [commands];

    // Store metadata for controller scanning
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };

    // Add all commands to metadata
    metadata.commands.push(...commandArray);
    metadata.hasDecorators = true;

    // 여러 방식으로 메타데이터 저장 (AllowedRoom과 일관성 유지)
    decoratorMetadata.set(originalMethod, metadata);
    (originalMethod as any).__decoratorMetadata = metadata;

    // Register each command individually for help system and execution
    for (const command of commandArray) {
      commandRegistry.set(command, {
        method: propertyKey,
        target: target.constructor.name,
        originalCommand: command,
        originalMethod: originalMethod,
        description: description,
        allCommands: commandArray, // Store all alternative commands
      });
    }

    return descriptor;
  };
}

/**
 * Decorator for help commands that automatically generates help text from registered commands
 */
export function HelpCommand(command: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      // Get bot instance for bot name
      const { Bot } = await import('@/services/bot/Bot');
      const bot = Bot.getInstance();
      const botName = bot?.name || '봇';

      // Generate help text from registered commands
      const commands = getRegisteredCommands();
      const helpLines: string[] = [];

      // Add header with bot name
      helpLines.push(`${botName} 도움말`);
      helpLines.push('\u200b'.repeat(500));

      // Group commands by method to avoid duplicates
      const commandGroups = new Map<string, any>();

      for (const [baseCommand, commandInfo] of commands) {
        const methodKey = `${commandInfo.target}.${commandInfo.method}`;

        if (!commandGroups.has(methodKey)) {
          commandGroups.set(methodKey, {
            commands: [],
            description: commandInfo.description || '설명 없음',
            originalMethod: commandInfo.originalMethod,
            target: commandInfo.target,
          });
        }

        commandGroups.get(methodKey)!.commands.push(baseCommand);
      }

      // Collect all command groups and sort them
      const allCommandGroups: any[] = [];
      for (const [methodKey, groupInfo] of commandGroups) {
        // Get full commands with prefix for this controller
        const fullCommands = groupInfo.commands.map((baseCommand: string) =>
          getFullCommand(
            target.constructor,
            groupInfo.originalMethod,
            baseCommand
          )
        );

        // Sort commands within the group
        fullCommands.sort();

        allCommandGroups.push({
          fullCommands,
          description: groupInfo.description,
          primaryCommand: fullCommands[0], // Use first command for sorting
        });
      }

      // Sort command groups alphabetically by primary command
      allCommandGroups.sort((a, b) =>
        a.primaryCommand.localeCompare(b.primaryCommand)
      );

      // Build help text in clean format
      for (const group of allCommandGroups) {
        if (group.fullCommands.length === 1) {
          // Single command
          helpLines.push(`${group.fullCommands[0]}`);
        } else {
          // Multiple commands - show alternatives
          helpLines.push(`${group.fullCommands.join(' | ')}`);
        }
        helpLines.push(` ⌊ ${group.description}`);
        helpLines.push('');
      }

      // If no commands found, show a default message
      if (allCommandGroups.length === 0) {
        helpLines.push('등록된 명령어가 없습니다.');
      } else {
        // Remove last empty line
        if (helpLines[helpLines.length - 1] === '') {
          helpLines.pop();
        }
      }

      const helpText = helpLines.join('\n');
      await context.reply(helpText);
    };

    // Store metadata for controller scanning
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };

    // Store the original command without prefix for metadata
    metadata.commands.push(command);
    metadata.hasDecorators = true;
    decoratorMetadata.set(originalMethod, metadata);

    // Register help command
    commandRegistry.set(command, {
      method: propertyKey,
      target: target.constructor.name,
      originalCommand: command,
      originalMethod: originalMethod,
      description: '도움말 표시',
    });

    return descriptor;
  };
}

/**
 * Helper function to get the full command with prefix for a controller and method
 */
export function getFullCommand(
  controllerConstructor: Function,
  methodFunction: Function,
  baseCommand: string
): string {
  let prefix = '';

  // Method prefix overrides controller prefix
  const methodPrefix = methodPrefixStorage.get(methodFunction);
  if (methodPrefix !== undefined) {
    prefix = methodPrefix;
  } else {
    const controllerPrefix = controllerPrefixStorage.get(controllerConstructor);
    if (controllerPrefix !== undefined) {
      prefix = controllerPrefix;
    }
  }

  return prefix + baseCommand;
}

/**
 * Helper function to check if a message matches a command
 */
export function isCommandMatch(
  messageText: string,
  fullCommand: string
): boolean {
  if (typeof messageText !== 'string') {
    return false;
  }

  // Exact match or command followed by space (for parameters)
  return (
    messageText === fullCommand || messageText.startsWith(fullCommand + ' ')
  );
}

/**
 * Prefix decorator for classes (sets default prefix for all commands in the controller)
 */
export function Prefix(prefix: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    controllerPrefixStorage.set(constructor, prefix);
    return constructor;
  };
}

/**
 * Prefix decorator for methods (sets prefix for specific command, overrides class prefix)
 */
export function MethodPrefix(prefix: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    methodPrefixStorage.set(descriptor.value, prefix);
    return descriptor;
  };
}
