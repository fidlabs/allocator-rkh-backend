import { createLogger, transports, format, Logger as WinstonLogger } from 'winston';

type LogLevel = 'info' | 'debug';

export function createWinstonLogger(service: string, level: LogLevel) {
  return createLogger({
    level,
    defaultMeta: { service },
    format: format.combine(
      format.simple(),
      format.label({
        label: '[LOGGER]',
      }),
      format.colorize({ all: true }),
      format.timestamp({ format: 'YY-MM-DD HH:mm:ss' }),
      format.align(),
      format.printf(info => `[${info.level}] ${info.timestamp} : ${info.message}`),
    ),
    transports: [new transports.Console()],
  });
}

export type Logger = WinstonLogger;
