import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import SuperJSON from 'superjson';

export function superJSONInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) {
  return req.responseType === 'json'
    ? next(
        req.clone({
          responseType: 'text',
        }),
      ).pipe(
        map((event) => {
          if (event instanceof HttpResponse) {
            return event.clone({
              body:
                event.body && typeof event.body === 'string'
                  ? SuperJSON.parse(event.body)
                  : event.body,
            });
          } else return event;
        }),
      )
    : next(req);
}
