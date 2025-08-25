import { createLogger, transports, format, Logger as WinstonLogger } from 'winston';

export function createWinstonLogger(service: string, level: 'info' | 'debug' = 'info') {
  const winstonLevel = level === 'debug' ? 'silly' : 'info';

  return createLogger({
    level: winstonLevel,
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
