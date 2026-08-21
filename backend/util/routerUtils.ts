import { Response } from 'express';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from './authUtils';

export function handleError(err: unknown, res: Response) {
  console.error(err);

  if (err instanceof BadRequestError)
    res.status(400).json({ message: 'Bad Request', error: err.message });
  else if (err instanceof UnauthorizedError)
    res.status(401).json({ message: 'Unauthorized', error: err.message });
  else if (err instanceof ForbiddenError)
    res.status(403).json({ message: 'Forbidden', error: err.message });
  else if (err instanceof NotFoundError)
    res.status(404).json({ message: 'Not Found', error: err.message });
  else if (err instanceof InternalServerError)
    res
      .status(500)
      .json({ message: 'Internal Server Error', error: err.message });
  else
    res.status(500).json({
      message: 'Unexpected Error',
      error: err,
    });
}
