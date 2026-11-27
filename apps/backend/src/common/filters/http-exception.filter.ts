import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Đã có lỗi xảy ra trên hệ thống. Vui lòng thử lại sau.';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        errorMessage = res;
        errorCode = exception.name || 'HTTP_ERROR';
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        errorMessage = (resObj.message as string) || exception.message;
        errorCode = (resObj.code as string) || (resObj.error as string) || exception.name;
        details = resObj.message instanceof Array ? resObj.message : undefined;
      }
    } else if (exception instanceof Error && (exception as Error & { type?: string }).type === 'entity.too.large') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      errorCode = 'REQUEST_BODY_TOO_LARGE';
      errorMessage = 'Gói dữ liệu vượt giới hạn 5 MB.';
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
    }

    const errorPayload: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: Array.isArray(errorMessage) ? errorMessage[0] : errorMessage,
        details,
      },
    };

    response.status(status).json(errorPayload);
  }
}
